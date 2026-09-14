const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const DEFAULT_SETTINGS = {
  monitoringEnabled: false, // Default off until user activates
  ollamaUrl: 'http://127.0.0.1:11434',
  model: 'qwen2.5-vl:latest',
  checkIntervalSeconds: 4, // Intelligently checks change delta
  windowBounds: { x: null, y: null, width: 340, height: 380 },
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
  simulationMode: false, // Useful when testing without active Ollama
};

class SettingsStore {
  constructor() {
    this.filePath = path.join(
      app ? app.getPath('userData') : process.cwd(),
      'catmonto-settings.json'
    );
    this.settings = this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      }
    } catch (err) {
      console.warn('[SettingsStore] Failed to read settings, using defaults:', err.message);
    }
    return { ...DEFAULT_SETTINGS };
  }

  save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.settings, null, 2), 'utf-8');
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
