const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const { SettingsStore } = require('./settings/store');
const { PrivacyFilter } = require('./privacy/exclusion');
const { ScreenCapturer } = require('./capture/capturer');
const { OllamaProvider } = require('./ai/ollama-provider');

let mainWindow = null;
let monitorInterval = null;
let isAnalyzing = false;
let lastAnalysisTime = 0;

const settingsStore = new SettingsStore();
const privacyFilter = new PrivacyFilter(settingsStore.get('excludedApps'));
const screenCapturer = new ScreenCapturer();
let ollamaProvider = new OllamaProvider({
  baseUrl: settingsStore.get('ollamaUrl'),
  model: settingsStore.get('model'),
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

  // Save bounds on move
  mainWindow.on('moved', () => {
    if (!mainWindow) return;
    const bounds = mainWindow.getBounds();
    settingsStore.set('windowBounds', bounds);
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
 * Screen monitoring loop
 */
function startMonitoring() {
  if (monitorInterval) return;

  const intervalSec = settingsStore.get('checkIntervalSeconds') || 4;

  monitorInterval = setInterval(async () => {
    if (isAnalyzing) return;

    // Minimum cooldown between AI calls (10 seconds) to avoid spamming
    const now = Date.now();
    if (now - lastAnalysisTime < 10000) return;

    try {
      // Step 1: Capture screen and test for visual changes
      const captureResult = await screenCapturer.captureScreen();
      if (!captureResult.hasMeaningfulChange) {
        // Screen hasn't changed meaningfully -> stay quiet
        return;
      }

      // Check if simulation mode is active or Ollama is online
      const isSim = settingsStore.get('simulationMode');
      const health = await ollamaProvider.checkHealth();

      if (!health.available && !isSim) {
        // Broadcast Ollama unavailable status occasionally if needed
        return;
      }

      isAnalyzing = true;
      lastAnalysisTime = now;

      // Broadcast thinking state to cat
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('cat:state', 'thinking');
      }

      let suggestion = null;

      if (isSim) {
        // Demo simulation trigger
        suggestion = "Bhai, coding smooth chal rahi hai! Sab sahi lag raha hai.";
      } else {
        const aiResult = await ollamaProvider.analyzeScreen({
          imageBase64: captureResult.base64,
          contextHint: 'Windows Desktop Workspace',
        });
        suggestion = aiResult.suggestion;
      }

      if (suggestion && suggestion.trim().length > 0) {
        // We have a valuable suggestion!
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('cat:state', 'attention');
          setTimeout(() => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('cat:suggestion', {
                text: suggestion,
                timestamp: Date.now(),
              });
              mainWindow.webContents.send('cat:state', 'speaking');
            }
          }, 400);
        }
      } else {
        // NO_SUGGESTION -> return to idle
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('cat:state', 'idle');
        }
      }
    } catch (err) {
      console.error('[Monitoring loop error]:', err.message);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('cat:state', 'idle');
      }
    } finally {
      isAnalyzing = false;
    }
  }, intervalSec * 1000);
}

function stopMonitoring() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
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
    const result = await screenCapturer.captureScreen();
    return { success: true, base64: result.base64 };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('ollama:check', async () => {
  return await ollamaProvider.checkHealth();
});

ipcMain.handle('cat:ask', async (event, userPrompt) => {
  try {
    if (!userPrompt || !userPrompt.trim()) return { error: 'Empty prompt' };

    // Broadcast thinking state
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('cat:state', 'thinking');
    }

    // Capture screen right now for direct inquiry
    const capture = await screenCapturer.captureScreen();
    const isSim = settingsStore.get('simulationMode');

    let answer = '';

    if (isSim) {
      answer = `Main samajh gaya: "${userPrompt}". Screen par sab clear dikh raha hai!`;
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
        contextHint: 'User direct question about screen',
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
      mainWindow.webContents.send('cat:state', 'idle');
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
  if (newSettings.excludedApps) {
    privacyFilter.setExclusions(updated.excludedApps);
  }
  return updated;
});

ipcMain.on('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window:close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.on('window:resize', (event, { width, height }) => {
  if (mainWindow) {
    mainWindow.setSize(width, height);
  }
});

// App Lifecycle
app.whenReady().then(() => {
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
