const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');

const DEFAULT_SETTINGS = {
  monitoringEnabled: true,
  aiProvider: 'gemini', // 'antigravity' | 'gemini' | 'ollama'
  antigravityModel: 'gemini-3.8-flash',
  autoModelFailover: true,
  geminiApiKey: '',
  geminiApiKeyEncrypted: '',
  geminiModel: 'gemini-3.8-flash',
  ollamaUrl: 'http://127.0.0.1:11434',
  model: 'qwen2.5-vl:latest',
  checkIntervalSeconds: 3,
  typingPauseDelaySeconds: 0.6,
  suggestionCooldownSeconds: 4,
  windowBounds: { x: null, y: null, width: 240, height: 185 },
  targetSourceId: 'entire-screen',
  targetSourceName: 'Entire Screen',
  rememberSecurely: true,
  privacyShield: true,
  completedOnboarding: false,
  excludedApps: [
    'bitwarden',
    '1password',
    'keepass',
    'lastpass',
    'banking',
    'paytm',
    'paypal',
    'auth',
    'authenticator',
    'private',
    'incognito',
  ],
  simulationMode: false,
};

class SettingsStore {
  getSettingsFilePath() {
    if (!app) return path.join(process.cwd(), 'catmonto-settings.json');
    try {
      const preferred = path.join(app.getPath('appData'), 'Catmonto', 'catmonto-settings.json');
      if (fs.existsSync(preferred)) return preferred;
    } catch (_) {}
    return path.join(app.getPath('userData'), 'catmonto-settings.json');
  }

  constructor() {
    this.filePath = this.getSettingsFilePath();
    this.settings = this.load();
  }

  encryptValue(val) {
    if (!val) return '';
    try {
      if (safeStorage && safeStorage.isEncryptionAvailable()) {
        const buffer = safeStorage.encryptString(val);
        return buffer.toString('base64');
      }
    } catch (e) {
      console.warn('[SettingsStore] safeStorage encryption failed:', e.message);
    }
    return val;
  }

  decryptValue(encryptedVal) {
    if (!encryptedVal) return '';
    try {
      if (safeStorage && safeStorage.isEncryptionAvailable()) {
        const buffer = Buffer.from(encryptedVal, 'base64');
        return safeStorage.decryptString(buffer);
      }
    } catch (e) {
      console.warn('[SettingsStore] safeStorage decryption failed:', e.message);
    }
    return encryptedVal;
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        const merged = { ...DEFAULT_SETTINGS, ...parsed };

        // If encrypted key exists, decrypt it if safeStorage is ready
        if (merged.geminiApiKeyEncrypted) {
          if (safeStorage && safeStorage.isEncryptionAvailable()) {
            const dec = this.decryptValue(merged.geminiApiKeyEncrypted);
            if (dec) merged.geminiApiKey = dec;
          }
        }

        // Ensure autoModelFailover default
        if (merged.autoModelFailover === undefined) {
          merged.autoModelFailover = true;
        }
        if (!merged.antigravityModel) {
          merged.antigravityModel = 'gemini-3.8-flash';
        }

        // Migrate deprecated models (2.0, 1.5) to Gemini 3.8 / 3.5 Flash
        if (
          !merged.geminiModel ||
          merged.geminiModel.includes('2.0') ||
          merged.geminiModel.includes('1.5') ||
          merged.geminiModel.includes('lite-latest')
        ) {
          merged.geminiModel = 'gemini-3.8-flash';
        }

        // Ensure minimum compact bounds so buttons never clip on narrow screens or high-DPI
        if (
          !merged.windowBounds ||
          !merged.windowBounds.width ||
          merged.windowBounds.width < 235 ||
          merged.windowBounds.width > 260
        ) {
          merged.windowBounds = {
            ...(merged.windowBounds || {}),
            width: 240,
            height: 185,
          };
        }

        return merged;
      }
    } catch (err) {
      console.warn('[SettingsStore] Failed to read settings, using defaults:', err.message);
    }
    return { ...DEFAULT_SETTINGS };
  }

  reload() {
    this.filePath = this.getSettingsFilePath();
    this.settings = this.load();
    return this.settings;
  }

  save() {
    try {
      const toSave = { ...this.settings };
      // Encrypt sensitive key if requested
      if (toSave.rememberSecurely && toSave.geminiApiKey) {
        const enc = this.encryptValue(toSave.geminiApiKey);
        if (enc && enc !== toSave.geminiApiKey) {
          toSave.geminiApiKeyEncrypted = enc;
          toSave.geminiApiKey = ''; // Do not store plaintext on disk when encrypted
        }
      } else if (!toSave.rememberSecurely) {
        toSave.geminiApiKeyEncrypted = '';
      }

      fs.writeFileSync(this.filePath, JSON.stringify(toSave, null, 2), 'utf-8');
    } catch (err) {
      console.error('[SettingsStore] Failed to save settings:', err.message);
    }
  }

  get(key) {
    if (key) return this.settings[key];
    return { ...this.settings };
  }

  set(key, value) {
    if (typeof key === 'object') {
      this.settings = { ...this.settings, ...key };
    } else {
      this.settings[key] = value;
    }
    this.save();
    return this.settings;
  }
}

module.exports = { SettingsStore, DEFAULT_SETTINGS };
