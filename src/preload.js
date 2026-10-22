'use strict';

const { contextBridge, ipcRenderer, webUtils } = require('electron');
const { FORMATS, formatsFor, categoryFor, extOf, isCompatible } = require('./formats');
const { TRIGGER_OPTIONS, THEME_OPTIONS, triggerLabel } = require('./preferences');

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
  isCompatible,
  formats: FORMATS,
  triggerOptions: TRIGGER_OPTIONS.map(({ key, label, hint }) => ({ key, label, hint })),
  themeOptions: THEME_OPTIONS.map(({ key, label, hint }) => ({ key, label, hint })),
  triggerLabel,

  startConversion: (filePath, target) => ipcRenderer.send('convert:start', { path: filePath, target }),
  closeMenu: () => ipcRenderer.send('menu:cancel'),
  dismissToast: () => ipcRenderer.send('toast:dismiss'),
  openFolder: (filePath) => ipcRenderer.send('toast:show-folder', filePath),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (patch) => ipcRenderer.invoke('settings:update', patch),
  closeSettings: () => ipcRenderer.send('settings:close'),
  onSettingsChanged: (cb) => ipcRenderer.on('settings:changed', (_e, payload) => cb(payload)),

  onMenuOpen: (cb) => ipcRenderer.on('menu:open', (_e, payload) => cb(payload)),
  onMenuClose: (cb) => ipcRenderer.on('menu:close', () => cb()),
  onToastUpdate: (cb) => ipcRenderer.on('toast:update', (_e, payload) => cb(payload)),

  platform: process.platform,
});
