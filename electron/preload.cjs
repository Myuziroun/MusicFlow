const { contextBridge, ipcRenderer } = require('electron');

const stateListeners = new Set();

ipcRenderer.on('window:state-changed', (_event, state) => {
  for (const listener of stateListeners) {
    try {
      listener(state);
    } catch (error) {
      console.warn('Gagal memproses state jendela:', error);
    }
  }
});

contextBridge.exposeInMainWorld('musicflowDesktop', {
  minimize: () => ipcRenderer.send('window:minimize'),
  toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
  close: () => ipcRenderer.send('window:close'),
  enterNotchMode: () => ipcRenderer.invoke('window:enter-notch'),
  exitNotchMode: (options) => ipcRenderer.invoke('window:exit-notch', options),
  setNotchCollapsed: (collapsed) => ipcRenderer.invoke('window:set-notch-collapsed', collapsed),
  getWindowState: () => ipcRenderer.invoke('window:get-state'),
  onWindowStateChange: (listener) => {
    if (typeof listener !== 'function') {
      return () => {};
    }

    stateListeners.add(listener);
    return () => stateListeners.delete(listener);
  }
});
