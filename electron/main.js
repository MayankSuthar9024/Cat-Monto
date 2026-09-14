const { app, BrowserWindow, ipcMain, screen, desktopCapturer } = require('electron');
const path = require('path');

// Ensure consistent application name in dev and prod
if (app) {
  try {
    app.setName('Catmonto');
  } catch (_) {}

  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
  } else {
    app.on('second-instance', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });
  }
}

const { SettingsStore } = require('./settings/store');
const { PrivacyFilter } = require('./privacy/exclusion');
const { ScreenCapturer } = require('./capture/capturer');
const { OllamaProvider } = require('./ai/ollama-provider');
const { GeminiProvider } = require('./ai/gemini-provider');

let mainWindow = null;
let monitorInterval = null;
let isAnalyzing = false;
let lastAnalysisTime = 0;
let lastSuggestionTime = 0;
let lastScreenChangeTime = 0;
let hasPendingChange = false;
let pendingCaptureResult = null;

const settingsStore = new SettingsStore();
const privacyFilter = new PrivacyFilter(settingsStore.get('excludedApps'));
const screenCapturer = new ScreenCapturer();

let ollamaProvider = new OllamaProvider({
  baseUrl: settingsStore.get('ollamaUrl'),
  model: settingsStore.get('model'),
});

let geminiProvider = new GeminiProvider({
  apiKey: settingsStore.get('geminiApiKey'),
  model: settingsStore.get('geminiModel'),
});

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  const savedBounds = settingsStore.get('windowBounds') || {};
  const winWidth = savedBounds.width || 340;
  const winHeight = savedBounds.height || 420;
  const winX = savedBounds.x !== null && savedBounds.x !== undefined ? savedBounds.x : screenWidth - winWidth - 24;
  const winY = savedBounds.y !== null && savedBounds.y !== undefined ? savedBounds.y : screenHeight - winHeight - 32;

  mainWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: winX,
    y: winY,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    maximizable: false,
    hasShadow: false,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  // Keep window on top across all workspaces
  mainWindow.setAlwaysOnTop(true, 'screen-saver');

  // Exclude Catmonto window from desktopCapturer so the code underneath the cat is always visible
  try {
    mainWindow.setContentProtection(true);
  } catch (e) {
    console.warn('[main] setContentProtection failed:', e.message);
  }

  // Broadcast maximize state changes
  mainWindow.on('maximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window:maximizedChange', true);
    }
  });

  mainWindow.on('unmaximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window:maximizedChange', false);
    }
  });

  // Save bounds on move
  mainWindow.on('moved', () => {
    if (!mainWindow || mainWindow.isMaximized()) return;
    const bounds = mainWindow.getBounds();
    // Only save if it's the normal compact size (don't overwrite default with modal size)
    if (bounds.width < 500) {
      settingsStore.set('windowBounds', bounds);
    }
  });

  const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    stopMonitoring();
  });
}

/**
 * Screen monitoring loop with Smart Typing Debounce & Delay
 */
function startMonitoring() {
  if (monitorInterval) return;

  // Check screen diff every 1.5s for snappy typing activity detection
  const tickIntervalMs = 1500;

  monitorInterval = setInterval(async () => {
    if (isAnalyzing) return;

    const now = Date.now();
    // Backoff protection if rate-limited
    if (now < lastAnalysisTime) return;

    const typingPauseDelay = (settingsStore.get('typingPauseDelaySeconds') || 4) * 1000;
    const suggestionCooldown = (settingsStore.get('suggestionCooldownSeconds') || 15) * 1000;

    try {
      const targetSourceId = settingsStore.get('targetSourceId');
      // Step 1: Capture screen / window and test for visual changes
      const captureResult = await screenCapturer.captureScreen(targetSourceId);

      // Check Privacy Filter
      if (settingsStore.get('privacyShield') !== false) {
        if (privacyFilter.isExcluded(captureResult.name, captureResult.name)) {
          // Sensitive app detected -> clear pending work and stay quiet
          hasPendingChange = false;
          pendingCaptureResult = null;
          return;
        }
      }

      if (captureResult.hasMeaningfulChange) {
        // The user is actively typing, editing, or moving on screen!
        // Record timestamp and wait until typing pauses before analyzing.
        lastScreenChangeTime = now;
        hasPendingChange = true;
        pendingCaptureResult = captureResult;
        return;
      }

      // If we reach here, captureResult.hasMeaningfulChange is FALSE (screen was steady).
      if (!hasPendingChange) {
        // No unanalyzed edits pending -> keep cat resting
        return;
      }

      // Screen is steady. Check how long the user has paused:
      const quietDuration = now - lastScreenChangeTime;
      if (quietDuration < typingPauseDelay) {
        // User paused briefly mid-thought -> wait for full typing pause delay!
        return;
      }

      // Check cooldown between suggestions to avoid spam
      if (now - lastSuggestionTime < suggestionCooldown) {
        return;
      }

      // Screen has been steady for >= typingPauseDelay, cooldown passed, and pending changes exist!
      // The user finished writing their code or paused. Now analyze the settled screen!
      const isSim = settingsStore.get('simulationMode');
      const aiProviderType = settingsStore.get('aiProvider') || 'gemini';

      // Check provider readiness
      if (!isSim) {
        if (aiProviderType === 'gemini') {
          if (!geminiProvider.apiKey) return;
        } else {
          const health = await ollamaProvider.checkHealth();
          if (!health.available) return;
        }
      }

      isAnalyzing = true;
      lastAnalysisTime = now;
      hasPendingChange = false;
      const analyzeCapture = pendingCaptureResult || captureResult;
      pendingCaptureResult = null;

      // Broadcast thinking state to cat
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('cat:state', 'thinking');
      }

      let suggestion = null;

      if (isSim) {
        suggestion = "Bhai, coding smooth chal rahi hai! Sab sahi lag raha hai.";
      } else if (aiProviderType === 'gemini') {
        const aiResult = await geminiProvider.analyzeScreen({
          imageBase64: analyzeCapture.base64,
          contextHint: analyzeCapture.name || 'Desktop Workspace',
        });
        suggestion = aiResult.suggestion;
      } else {
        const aiResult = await ollamaProvider.analyzeScreen({
          imageBase64: analyzeCapture.base64,
          contextHint: analyzeCapture.name || 'Desktop Workspace',
        });
        suggestion = aiResult.suggestion;
      }

      if (
        suggestion &&
        suggestion.trim().length > 0 &&
        !suggestion.toUpperCase().includes('NO_SUGGESTION')
      ) {
        // Verified real error found on settled code!
        lastSuggestionTime = Date.now();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('cat:state', 'attention');
          setTimeout(() => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('cat:suggestion', {
                text: suggestion.trim(),
                timestamp: Date.now(),
              });
              mainWindow.webContents.send('cat:state', 'speaking');
            }
          }, 350);
        }
      } else {
        // NO_SUGGESTION -> no errors found on screen, cat sleeps peacefully
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('cat:state', 'sleeping');
        }
      }
    } catch (err) {
      if (!err.message?.includes('Screen capture image buffer is empty')) {
        console.error('[Monitoring loop error]:', err.message);
      }
      const isRateLimit = err.message && (err.message.includes('quota') || err.message.includes('429') || err.message.includes('rate-limit') || err.message.includes('exceeded your current quota'));
      if (isRateLimit) {
        // Backoff for 30 seconds so we don't spam Google API when quota limit is hit
        lastAnalysisTime = Date.now() + 30000;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('cat:suggestion', {
            text: '[System] Gemini API rate limit reached. Pausing checks for 30 seconds.',
            timestamp: Date.now(),
          });
          mainWindow.webContents.send('cat:state', 'speaking');
        }
      } else {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('cat:state', 'sleeping');
        }
      }
    } finally {
      isAnalyzing = false;
    }
  }, tickIntervalMs);
}

function stopMonitoring() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
  hasPendingChange = false;
  pendingCaptureResult = null;
}

// IPC Handlers
ipcMain.handle('monitoring:toggle', async (event, enabled) => {
  const current = enabled !== undefined ? enabled : !settingsStore.get('monitoringEnabled');
  settingsStore.set('monitoringEnabled', current);
  if (current) {
    startMonitoring();
  } else {
    stopMonitoring();
  }
  return { monitoringEnabled: current };
});

ipcMain.handle('monitoring:status', async () => {
  return {
    monitoringEnabled: settingsStore.get('monitoringEnabled'),
    isAnalyzing,
  };
});

ipcMain.handle('screen:captureNow', async () => {
  try {
    const targetSourceId = settingsStore.get('targetSourceId');
    const result = await screenCapturer.captureScreen(targetSourceId);
    return { success: true, base64: result.base64, dataUrl: result.dataUrl, name: result.name };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('screen:getSources', async () => {
  return await screenCapturer.getAvailableSources();
});

ipcMain.handle('permissions:check', async () => {
  try {
    const sources = await screenCapturer.getAvailableSources();
    return { granted: sources.length > 0 };
  } catch (err) {
    return { granted: false, error: err.message };
  }
});

ipcMain.handle('ollama:check', async () => {
  return await ollamaProvider.checkHealth();
});

ipcMain.handle('gemini:validate', async (event, testKey) => {
  return await geminiProvider.checkHealth(testKey);
});

ipcMain.handle('gemini:testPrompt', async (event, { apiKey, model }) => {
  try {
    const testKey = apiKey || settingsStore.get('geminiApiKey');
    if (!testKey || !testKey.trim()) {
      return { success: false, error: 'No API key provided.' };
    }
    const testModel = model || settingsStore.get('geminiModel') || 'gemini-3.5-flash';
    const tester = new GeminiProvider({ apiKey: testKey, model: testModel });
    const res = await tester.analyzeScreen({
      imageBase64: '',
      userPrompt: 'Say hello in one short friendly sentence as Catmonto the desktop pet!',
      contextHint: 'Live Connection Test',
    });
    return { success: true, text: res.suggestion || res.raw || 'Catmonto API connected!' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('cat:ask', async (event, userPrompt) => {
  try {
    if (!userPrompt || !userPrompt.trim()) return { error: 'Empty prompt' };

    // Broadcast thinking state
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('cat:state', 'thinking');
    }

    const targetSourceId = settingsStore.get('targetSourceId');
    const capture = await screenCapturer.captureScreen(targetSourceId);
    const isSim = settingsStore.get('simulationMode');
    const aiProviderType = settingsStore.get('aiProvider') || 'gemini';

    let answer = '';

    if (isSim) {
      answer = `Main samajh gaya: "${userPrompt}". Screen par sab clear dikh raha hai!`;
    } else if (aiProviderType === 'gemini') {
      if (!geminiProvider.apiKey) {
        return { error: 'Gemini API key is missing. Click on Cat to set it up.' };
      }
      const res = await geminiProvider.analyzeScreen({
        imageBase64: capture.base64,
        userPrompt: userPrompt.trim(),
        contextHint: capture.name || 'User direct question about screen',
      });
      answer = res.suggestion || res.raw || "Screen dekhi, sab theek lag raha hai!";
    } else {
      const health = await ollamaProvider.checkHealth();
      if (!health.available) {
        return {
          error: `Ollama is not running. Please start Ollama at ${settingsStore.get('ollamaUrl')}`,
        };
      }
      const res = await ollamaProvider.analyzeScreen({
        imageBase64: capture.base64,
        userPrompt: userPrompt.trim(),
        contextHint: capture.name || 'User direct question about screen',
      });
      answer = res.suggestion || res.raw || "Mujhe screen par koi specific issue nahi dikha.";
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('cat:suggestion', {
        text: answer,
        timestamp: Date.now(),
      });
      mainWindow.webContents.send('cat:state', 'speaking');
    }

    return { success: true, text: answer };
  } catch (err) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('cat:state', 'sleeping');
    }
    return { success: false, error: err.message };
  }
});

ipcMain.handle('settings:get', async () => {
  return settingsStore.get();
});

ipcMain.handle('settings:update', async (event, newSettings) => {
  const updated = settingsStore.set(newSettings);

  if (newSettings.ollamaUrl || newSettings.model) {
    ollamaProvider = new OllamaProvider({
      baseUrl: updated.ollamaUrl,
      model: updated.model,
    });
  }

  if (newSettings.geminiApiKey !== undefined) {
    geminiProvider.setApiKey(updated.geminiApiKey);
  }
  if (newSettings.geminiModel) {
    geminiProvider.setModel(updated.geminiModel);
  }

  if (newSettings.excludedApps) {
    privacyFilter.setExclusions(updated.excludedApps);
  }

  return updated;
});

ipcMain.on('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window:isMaximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

ipcMain.on('window:maximize', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.on('window:close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.on('window:resize', (event, { width, height, center }) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  // If the window is currently maximized, unmaximize it first before applying new bounds
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  }

  const currentBounds = mainWindow.getBounds();
  // Multi-monitor safe: find display that actually contains the window
  const currentDisplay = screen.getDisplayMatching(currentBounds) || screen.getPrimaryDisplay();
  const { x: dispX, y: dispY, width: screenWidth, height: screenHeight } = currentDisplay.workArea;

  const isWizard = width >= 500;
  mainWindow.setMaximizable(isWizard);

  // Clamp target dimensions to current screen work area
  const targetWidth = Math.min(width, Math.max(300, screenWidth - 20));
  const targetHeight = Math.min(height, Math.max(360, screenHeight - 20));

  let newX = currentBounds.x;
  let newY = currentBounds.y;

  if (center) {
    newX = dispX + Math.round((screenWidth - targetWidth) / 2);
    newY = dispY + Math.round((screenHeight - targetHeight) / 2);
  } else {
    // If shrinking back to compact cat window, restore saved bounds
    if (!isWizard) {
      const savedBounds = settingsStore.get('windowBounds') || {};
      newX = savedBounds.x !== null && savedBounds.x !== undefined ? savedBounds.x : dispX + screenWidth - targetWidth - 24;
      newY = savedBounds.y !== null && savedBounds.y !== undefined ? savedBounds.y : dispY + screenHeight - targetHeight - 32;
    } else {
      // Opening wizard: expand smoothly from current position
      if (targetWidth > currentBounds.width) {
        newX = currentBounds.x - Math.round((targetWidth - currentBounds.width) / 2);
        newY = currentBounds.y - Math.round((targetHeight - currentBounds.height) / 2);
      } else {
        newX = currentBounds.x + Math.round((currentBounds.width - targetWidth) / 2);
        newY = currentBounds.y + Math.round((currentBounds.height - targetHeight) / 2);
      }
    }

    // Clamp to visible work area of this display
    if (newX < dispX + 10) newX = dispX + 10;
    if (newY < dispY + 10) newY = dispY + 10;
    if (newX + targetWidth > dispX + screenWidth - 10) {
      newX = dispX + screenWidth - targetWidth - 10;
    }
    if (newY + targetHeight > dispY + screenHeight - 10) {
      newY = dispY + screenHeight - targetHeight - 10;
    }
  }

  mainWindow.setBounds({
    x: Math.round(newX),
    y: Math.round(newY),
    width: Math.round(targetWidth),
    height: Math.round(targetHeight),
  });
});

// App Lifecycle
app.whenReady().then(() => {
  // Reload settings now that safeStorage DPAPI is ready
  settingsStore.reload();
  const currentKey = settingsStore.get('geminiApiKey');
  if (currentKey) {
    geminiProvider.setApiKey(currentKey);
  }
  geminiProvider.setModel(settingsStore.get('geminiModel') || 'gemini-3.5-flash');

  createWindow();

  if (settingsStore.get('monitoringEnabled')) {
    startMonitoring();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
