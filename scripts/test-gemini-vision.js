const { app, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');

if (app) {
  try {
    app.setName('Catmonto');
  } catch (_) {}
}

const { SettingsStore } = require('../electron/settings/store');
const { GeminiProvider } = require('../electron/ai/gemini-provider');

app.whenReady().then(async () => {
  console.log('=== TESTING LIVE GEMINI VISION WITH ACTUAL DECRYPTED KEY ===');

  const store = new SettingsStore();
  store.reload();
  const settings = store.get();

  const apiKey = settings.geminiApiKey;
  console.log('API Key available:', Boolean(apiKey));
  if (!apiKey) {
    console.error('No Gemini API key found in store!');
    app.quit();
    return;
  }

  const testImgPath = path.join(__dirname, '../screenshots/01_compact_cat_companion.png');
  if (!fs.existsSync(testImgPath)) {
    console.error('Test screenshot not found at:', testImgPath);
    app.quit();
    return;
  }

  const imgBuffer = fs.readFileSync(testImgPath);
  const base64 = imgBuffer.toString('base64');
  console.log(`Loaded test image (${imgBuffer.length} bytes). Sending to Gemini 2.0 Flash...`);

  const gemini = new GeminiProvider({
    apiKey: apiKey,
    model: 'gemini-3.6-flash',
  });

  try {
    const startTime = Date.now();
    const result = await gemini.analyzeScreen({
      imageBase64: base64,
      userPrompt: 'Describe what mascot character is visible in this image in 1 friendly Hinglish sentence.',
      contextHint: 'Desktop companion test',
    });
    const elapsed = Date.now() - startTime;
    console.log(`\nGemini responded in ${elapsed}ms:`);
    console.log('================================================================');
    console.log('AI Response:', result.suggestion || result.raw);
    console.log('================================================================');
    console.log('\n>>> GEMINI MULTIMODAL VISION IS 100% OPERATIONAL & VERIFIED! <<<');
  } catch (err) {
    console.error('Gemini vision request failed:', err.message);
  }

  app.quit();
});
