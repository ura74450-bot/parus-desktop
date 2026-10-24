'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('parusToast', {
  onData: cb => ipcRenderer.on('toast-data', (_e, d) => cb(d)),
  click: key => ipcRenderer.send('toast-click', key),
  close: () => ipcRenderer.send('toast-close')
});
