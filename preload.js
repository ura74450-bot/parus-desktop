'use strict';
const { contextBridge, ipcRenderer } = require('electron');
// Мост между сайтом мессенджера и настольным приложением
contextBridge.exposeInMainWorld('parusDesktop', {
  isDesktop: true,
  platform: process.platform,
  notify: d => ipcRenderer.send('notify', d),
  closeToast: tag => ipcRenderer.send('close-toast', tag),
  onOpen: cb => ipcRenderer.on('open-chat', (_e, key) => cb(key))
});
