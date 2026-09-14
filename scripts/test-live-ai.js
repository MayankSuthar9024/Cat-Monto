const { app, BrowserWindow, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');

// Set app name so userData matches Catmonto
if (app) {
  try {
    app.setName('Catmonto');
  } catch (_) {}
}

const { SettingsStore } = require('../electron/settings/store');
const { ScreenCapturer } = require('../electron/capture/capturer');
const { GeminiProvider } = require('../electron/ai/gemini-provider');

const ARTIFACT_DIR = 'C:/Users/tmgma/.gemini/antigravity/brain/9e2c25a4-b261-46e9-bc46-a517c45466e6';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

app.whenReady().then(async () => {
  console.log('=== STARTING LIVE COMPANION DIAGNOSTICS & DEBUGGING ===');

  // 1. Create a live BrowserWindow to ensure the desktop window station is attached
  const win = new BrowserWindow({
    width: 320,
    height: 240,
    show: true,
    title: 'Catmonto Live Diagnostic Test',
  });
  await sleep(600);

  console.log('[1] Checking safeStorage DPAPI...');
  const isSafeStorage = safeStorage && safeStorage.isEncryptionAvailable();
  console.log('safeStorage available:', isSafeStorage);

  console.log('[2] Loading settings store...');
  const store = new SettingsStore();
  // If not found in default userData, check AppData/Catmonto
  const catmontoSettingsPath = path.join(app.getPath('appData'), 'Catmonto', 'catmonto-settings.json');
  if (fs.existsSync(catmontoSettingsPath)) {
    store.filePath = catmontoSettingsPath;
  }
  store.reload();
  const settings = store.get();

  console.log('Settings file path:', store.filePath);
  console.log('Active provider:', settings.aiProvider);
  console.log('Gemini model:', settings.geminiModel);
  console.log('Target source ID:', settings.targetSourceId);
  console.log('Target source name:', settings.targetSourceName);
  console.log('Has encrypted key:', Boolean(settings.geminiApiKeyEncrypted));
  console.log('Has decrypted key:', Boolean(settings.geminiApiKey));
  if (settings.geminiApiKey) {
    console.log('Key prefix:', settings.geminiApiKey.substring(0, 10) + '...');
  }

  console.log('[3] Testing Gemini API health with decrypted key...');
  const gemini = new GeminiProvider({
    apiKey: settings.geminiApiKey,
    model: settings.geminiModel || 'gemini-3.6-flash',
  });

  const health = await gemini.checkHealth();
  console.log('Gemini health result:', JSON.stringify(health));

  console.log('[4] Testing live screen capturer with desktop window station...');
  const capturer = new ScreenCapturer();
  const sources = await capturer.getAvailableSources();
  console.log(`Found ${sources.length} open capture sources:`);
  sources.forEach((s, idx) => {
    console.log(`  [${idx + 1}] ${s.type.toUpperCase()}: "${s.name}" (id: ${s.id})`);
  });

  console.log('[5] Capturing frame of target source...');
  let targetId = settings.targetSourceId;
  const match = sources.find((s) => s.id === targetId);
  if (!match) {
    console.log(`Target window ID "${targetId}" not found in current open windows, capturing entire screen.`);
    targetId = 'entire-screen';
  } else {
    console.log(`Matched target window: "${match.name}"`);
  }

  const capture = await capturer.captureScreen(targetId);
  console.log(`Captured frame size: ${capture.width}x${capture.height}, base64 length: ${capture.base64.length}`);

  if (capture.base64 && capture.base64.length > 0) {
    const liveFramePath = path.join(ARTIFACT_DIR, '09_live_screen_capture.jpg');
    fs.writeFileSync(liveFramePath, Buffer.from(capture.base64, 'base64'));
    console.log(`Live screen frame saved to: ${liveFramePath}`);

    console.log('[6] Sending live screen capture to Google Gemini 2.0 Flash...');
    const startTime = Date.now();
    try {
      const aiResponse = await gemini.analyzeScreen({
        imageBase64: capture.base64,
        userPrompt: 'What code or task is the user working on? Give a friendly 1-2 sentence response in Hinglish/English.',
        contextHint: capture.name || 'User active workspace',
      });
      const duration = Date.now() - startTime;
      console.log(`Gemini response received in ${duration}ms:`);
      console.log('====================================================');
      console.log(aiResponse.suggestion || aiResponse.raw);
      console.log('====================================================');
    } catch (err) {
      console.error('Gemini vision call failed:', err.message);
    }
  } else {
    console.error('Frame capture returned empty data.');
  }

  console.log('=== DIAGNOSTICS COMPLETE ===');
  win.close();
  app.quit();
});
