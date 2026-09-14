const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('catmonto', {
  // Screen & Monitoring
  toggleMonitoring: (enabled) => ipcRenderer.invoke('monitoring:toggle', enabled),
  getMonitoringStatus: () => ipcRenderer.invoke('monitoring:status'),
  captureNow: () => ipcRenderer.invoke('screen:captureNow'),

  // AI & Ask Cat
  checkOllama: () => ipcRenderer.invoke('ollama:check'),
  askCat: (prompt) => ipcRenderer.invoke('cat:ask', prompt),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (newSettings) => ipcRenderer.invoke('settings:update', newSettings),

  // Window operations
  minimize: () => ipcRenderer.send('window:minimize'),
  close: () => ipcRenderer.send('window:close'),
  setWindowSize: (width, height) => ipcRenderer.send('window:resize', { width, height }),

  // Subscriptions from main process
  onSuggestion: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('cat:suggestion', handler);
    return () => ipcRenderer.removeListener('cat:suggestion', handler);
  },
  onStateChange: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('cat:state', handler);
    return () => ipcRenderer.removeListener('cat:state', handler);
  },
  onEyeTarget: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('cat:eyeTarget', handler);
    return () => ipcRenderer.removeListener('cat:eyeTarget', handler);
  },
});
