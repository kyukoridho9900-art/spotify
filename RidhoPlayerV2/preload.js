const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ridho', {
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  toFileUrl: (p) => ipcRenderer.invoke('to-file-url', p),
  readMetadata: (p) => ipcRenderer.invoke('read-metadata', p),
});
