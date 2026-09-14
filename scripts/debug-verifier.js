const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

const ARTIFACT_DIR = 'C:/Users/tmgma/.gemini/antigravity/brain/9e2c25a4-b261-46e9-bc46-a517c45466e6';
if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

const LOCAL_SCREENSHOTS = path.join(__dirname, '../screenshots');
if (!fs.existsSync(LOCAL_SCREENSHOTS)) {
  fs.mkdirSync(LOCAL_SCREENSHOTS, { recursive: true });
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function saveScreenshot(win, name) {
  await sleep(450);
  const image = await win.webContents.capturePage();
  const pngBuffer = image.toPNG();
  const artifactPath = path.join(ARTIFACT_DIR, `${name}.png`);
  const localPath = path.join(LOCAL_SCREENSHOTS, `${name}.png`);
  fs.writeFileSync(artifactPath, pngBuffer);
  fs.writeFileSync(localPath, pngBuffer);
  console.log(`[Screenshot Saved] -> ${name}.png (${image.getSize().width}x${image.getSize().height})`);
  return artifactPath;
}

app.whenReady().then(async () => {
  console.log('=== CATMONTO AUTONOMOUS DEBUG & SCREEN CAPTURE SUITE ===');

  const win = new BrowserWindow({
    width: 840,
    height: 620,
    show: true,
    transparent: true,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, '../electron/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const consoleLogs = [];
  win.webContents.on('console-message', (event, level, message) => {
    consoleLogs.push({ level, message });
    console.log(`[Renderer Console] [level=${level}]: ${message}`);
  });

  // Mock handlers
  ipcMain.handle('settings:get', async () => ({
    monitoringEnabled: false,
    aiProvider: 'gemini',
    geminiApiKey: '',
    geminiModel: 'gemini-3.6-flash',
    ollamaUrl: 'http://127.0.0.1:11434',
    model: 'qwen2.5-vl:latest',
    targetSourceId: 'entire-screen',
    targetSourceName: 'Entire Screen (Desktop)',
    rememberSecurely: true,
    privacyShield: true,
    excludedApps: ['bitwarden', '1password', 'bank'],
  }));

  ipcMain.handle('settings:update', async (event, s) => s);
  ipcMain.handle('ollama:check', async () => ({ available: true, models: ['qwen2.5-vl:latest'] }));
  ipcMain.handle('gemini:validate', async () => ({ available: true, models: ['gemini-3.6-flash'] }));
  ipcMain.handle('permissions:check', async () => ({ granted: true }));
  ipcMain.handle('monitoring:toggle', async (event, en) => ({ monitoringEnabled: en }));
  ipcMain.handle('screen:getSources', async () => [
    { id: 'screen:0', name: 'Entire Screen (Primary Display)', type: 'screen' },
    { id: 'window:1', name: 'Visual Studio Code - Catmonto', type: 'window' },
    { id: 'window:2', name: 'Google Chrome - AI Vision Research', type: 'window' },
    { id: 'window:3', name: 'Windows PowerShell Terminal', type: 'window' },
  ]);
  ipcMain.handle('screen:captureNow', async () => ({
    success: true,
    dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    name: 'Primary Display',
  }));
  ipcMain.handle('window:isMaximized', async () => false);
  ipcMain.handle('window:toggleMaximize', async () => false);
  ipcMain.on('window:resize', () => {});

  const loadTarget = 'http://localhost:5173';
  console.log(`Loading application from: ${loadTarget}...`);
  await win.loadURL(loadTarget);
  await sleep(1500);

  // 1. CAPTURE COMPACT FLOATING CAT COMPANION
  win.setSize(340, 440);
  await sleep(600);
  await saveScreenshot(win, '01_compact_cat_companion');

  // 1b. CAPTURE WITH SPEECH BUBBLE
  win.setSize(340, 520);
  win.webContents.send('cat:suggestion', {
    text: "Hi! I'm Catmonto. Your desktop companion is active and watching safely!",
  });
  await sleep(600);
  await saveScreenshot(win, '01b_speech_bubble');

  // Dismiss suggestion
  await win.webContents.executeJavaScript(`(() => {
    const dismissBtn = document.querySelector('.bubble-close-btn');
    if (dismissBtn) dismissBtn.click();
  })()`);
  await sleep(300);
  win.setSize(340, 440);

  // 2. TRIGGER ASK CAT INPUT
  await win.webContents.executeJavaScript(`(() => {
    const askBtn = document.querySelector('.quick-ask-btn');
    if (askBtn) askBtn.click();
  })()`);
  await sleep(500);
  await saveScreenshot(win, '02_ask_cat_dialog');

  // Dismiss Ask Cat input
  await win.webContents.executeJavaScript(`(() => {
    const askBtn = document.querySelector('.quick-ask-btn');
    if (askBtn) askBtn.click();
  })()`);
  await sleep(300);

  // 3. OPEN SETUP WIZARD (STEP 1: PRIVACY)
  win.setSize(840, 620);
  await win.webContents.executeJavaScript(`(() => {
    const cat = document.querySelector('.cat-character-wrapper');
    if (cat) cat.click();
  })()`);
  await sleep(700);

  // Switch to Step 1
  await win.webContents.executeJavaScript(`(() => {
    const stepperBtns = document.querySelectorAll('.stepper-item');
    if (stepperBtns[0]) stepperBtns[0].click();
  })()`);
  await sleep(600);
  await saveScreenshot(win, '03_wizard_step1_privacy');

  // 4. STEP 2: API KEY (GEMINI)
  await win.webContents.executeJavaScript(`(() => {
    const stepperBtns = document.querySelectorAll('.stepper-item');
    if (stepperBtns[1]) stepperBtns[1].click();
  })()`);
  await sleep(600);
  await saveScreenshot(win, '04_wizard_step2_gemini_key');

  // 5. STEP 2: API KEY (OLLAMA TAB)
  await win.webContents.executeJavaScript(`(() => {
    const tabs = document.querySelectorAll('.provider-tab');
    if (tabs[1]) tabs[1].click();
  })()`);
  await sleep(600);
  await saveScreenshot(win, '05_wizard_step2_ollama_tab');

  // Switch back to Gemini tab
  await win.webContents.executeJavaScript(`(() => {
    const tabs = document.querySelectorAll('.provider-tab');
    if (tabs[0]) tabs[0].click();
  })()`);
  await sleep(300);

  // 6. STEP 3: SYSTEM PERMISSIONS
  await win.webContents.executeJavaScript(`(() => {
    const stepperBtns = document.querySelectorAll('.stepper-item');
    if (stepperBtns[2]) stepperBtns[2].click();
  })()`);
  await sleep(600);
  await saveScreenshot(win, '06_wizard_step3_permissions');

  // 7. STEP 4: WINDOW SELECTION
  await win.webContents.executeJavaScript(`(() => {
    const stepperBtns = document.querySelectorAll('.stepper-item');
    if (stepperBtns[3]) stepperBtns[3].click();
  })()`);
  await sleep(800);
  await saveScreenshot(win, '07_wizard_step4_window_selection');

  // 8. STEP 5: READY & SUMMARY
  await win.webContents.executeJavaScript(`(() => {
    const stepperBtns = document.querySelectorAll('.stepper-item');
    if (stepperBtns[4]) stepperBtns[4].click();
  })()`);
  await sleep(600);
  await saveScreenshot(win, '08_wizard_step5_ready');

  console.log('=== ALL SCREENSHOTS CAPTURED SUCCESSFULLY ===');
  console.log(`Console logs recorded: ${consoleLogs.length}`);

  const errors = consoleLogs.filter((l) => l.level === 'error' || l.message.includes('Error'));
  if (errors.length > 0) {
    console.error('Renderer Errors detected:', errors);
  } else {
    console.log('NO RENDERER ERRORS DETECTED! Platform is healthy.');
  }

  win.close();
  app.quit();
});
