'use strict';

const { contextBridge, ipcRenderer, webUtils } = require('electron');
const { FORMATS, formatsFor, categoryFor, extOf } = require('./formats');

contextBridge.exposeInMainWorld('gc', {
  /** Абсолютный путь из File (Electron 32+). */
  getPathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file);
    } catch (_) {
      return '';
    }
  },
  formatsFor,
  categoryFor,
  extOf,
  formats: FORMATS,

  startConversion: (filePath, target) => ipcRenderer.send('convert:start', { path: filePath, target }),
  closeMenu: () => ipcRenderer.send('menu:cancel'),
  dismissToast: () => ipcRenderer.send('toast:dismiss'),
  openFolder: (filePath) => ipcRenderer.send('toast:show-folder', filePath),

  onMenuOpen: (cb) => ipcRenderer.on('menu:open', (_e, payload) => cb(payload)),
  onMenuClose: (cb) => ipcRenderer.on('menu:close', () => cb()),
  onToastUpdate: (cb) => ipcRenderer.on('toast:update', (_e, payload) => cb(payload)),

  platform: process.platform,
});
