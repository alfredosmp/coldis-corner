const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('coldiDesktop', {
  isDesktop: true,
  getRedirectUri: () => ipcRenderer.invoke('coldi:get-redirect-uri'),
  startGoogleOAuth: (authUrl) => ipcRenderer.invoke('coldi:start-google-oauth', authUrl),
  openExternal: (url) => ipcRenderer.invoke('coldi:open-external', url),
  getAppVersion: () => ipcRenderer.invoke('coldi:get-app-version'),
  installUpdateNow: () => ipcRenderer.invoke('coldi:install-update'),
  onUpdateReady: (callback) => {
    const handler = (_event, info) => callback(info);
    ipcRenderer.on('coldi:update-ready', handler);
    return () => ipcRenderer.removeListener('coldi:update-ready', handler);
  },
});
