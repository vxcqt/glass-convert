'use strict';

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  Tray,
  Menu,
  nativeImage,
  shell,
  Notification,
  globalShortcut,
} = require('electron');

const { makeIconPng } = require('./src/icon');
const { convertFile, resolveFfmpeg } = require('./src/convert');
const { FORMATS, extOf, categoryFor, isCompatible } = require('./src/formats');

const APP_ID = 'com.glassconvert.app';
const MENU_SIZE = 600;
const TOAST_W = 400;
const TOAST_H = 116;
const SHOW_DELAY = 110;

app.setAppUserModelId(APP_ID);

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

/* ------------------------------------------------------------------ */
/* настройки                                                          */
/* ------------------------------------------------------------------ */

const settingsPath = path.join(app.getPath('userData'), 'settings.json');
const settings = { enabled: true, autoLaunch: false };

function loadSettings() {
  try {
    Object.assign(settings, JSON.parse(fs.readFileSync(settingsPath, 'utf8')));
  } catch (_) {
    /* первый запуск */
  }
}

function saveSettings() {
  try {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  } catch (_) {
    /* ignore */
  }
}

function applyAutoLaunch() {
  try {
    app.setLoginItemSettings({
      openAtLogin: Boolean(settings.autoLaunch),
      args: ['--hidden'],
    });
  } catch (_) {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* состояние                                                          */
/* ------------------------------------------------------------------ */

let tray = null;
let overlay = null;
let toast = null;
let menuVisible = false;
let menuMode = null;
let menuOpening = false;
let menuToken = 0;
let overlayHideTimer = null;
let overlayReady = false;
let hookStarted = false;

let shiftDown = false;
let lmbDown = false;
let showTimer = null;
let releaseHideTimer = null;
let suppressUntil = 0;

let toastTimer = null;
let busy = false;
const queue = [];
let lastResultPath = null;

/* ------------------------------------------------------------------ */
/* окна                                                               */
/* ------------------------------------------------------------------ */

function icon(size) {
  return nativeImage.createFromBuffer(makeIconPng(size));
}

function createOverlay() {
  overlay = new BrowserWindow({
    width: MENU_SIZE,
    height: MENU_SIZE,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: true,
    alwaysOnTop: true,
    type: process.platform === 'win32' ? 'toolbar' : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'src', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlay.loadFile(path.join(__dirname, 'src', 'overlay.html'));
  overlay.webContents.on('did-finish-load', () => {
    overlayReady = true;
  });
  overlay.on('closed', () => {
    overlay = null;
    overlayReady = false;
  });
}

function createToast() {
  toast = new BrowserWindow({
    width: TOAST_W,
    height: TOAST_H,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: true,
    alwaysOnTop: true,
    type: process.platform === 'win32' ? 'toolbar' : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'src', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  toast.setAlwaysOnTop(true, 'screen-saver');
  toast.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  toast.loadFile(path.join(__dirname, 'src', 'toast.html'));
  toast.on('closed', () => {
    toast = null;
  });
}

function menuBounds() {
  const point = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(point);
  const area = display.workArea;
  let x = Math.round(point.x - MENU_SIZE / 2);
  let y = Math.round(point.y - MENU_SIZE / 2);
  x = Math.max(area.x, Math.min(area.x + area.width - MENU_SIZE, x));
  y = Math.max(area.y, Math.min(area.y + area.height - MENU_SIZE, y));
  return { x, y, width: MENU_SIZE, height: MENU_SIZE, display };
}

/**
 * Снимок области под меню через gdigrab (≈180 мс).
 * Позже он размывается в CSS и работает как настоящее матовое стекло.
 */
function captureBackdrop(bounds) {
  return new Promise((resolve) => {
    let ffmpeg;
    try {
      ffmpeg = resolveFfmpeg();
    } catch (_) {
      resolve(null);
      return;
    }

    const topLeft = screen.dipToScreenPoint({ x: bounds.x, y: bounds.y });
    const bottomRight = screen.dipToScreenPoint({ x: bounds.x + bounds.width, y: bounds.y + bounds.height });
    if (
      ![topLeft.x, topLeft.y, bottomRight.x, bottomRight.y].every(
        (value) => typeof value === 'number' && Number.isFinite(value)
      )
    ) {
      resolve(null);
      return;
    }

    // gdigrab снимает только основной монитор; на остальных оставляем обычное стекло.
    const primary = screen.getPrimaryDisplay();
    if (bounds.display && primary && bounds.display.id !== primary.id) {
      resolve(null);
      return;
    }
    const origin = screen.dipToScreenPoint({ x: primary.bounds.x, y: primary.bounds.y });
    if (typeof origin.x !== 'number' || typeof origin.y !== 'number') {
      resolve(null);
      return;
    }

    const primaryW = Math.round(primary.size.width * primary.scaleFactor);
    const primaryH = Math.round(primary.size.height * primary.scaleFactor);

    let x = Math.round(topLeft.x - origin.x);
    let y = Math.round(topLeft.y - origin.y);
    let width = Math.max(2, Math.round(bottomRight.x - topLeft.x));
    let height = Math.max(2, Math.round(bottomRight.y - topLeft.y));
    if (width > primaryW || height > primaryH) {
      resolve(null);
      return;
    }
    x = Math.max(0, Math.min(primaryW - width, x));
    y = Math.max(0, Math.min(primaryH - height, y));

    const args = [
      '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
      '-f', 'gdigrab', '-framerate', '30', '-draw_mouse', '0',
      '-i', 'desktop', '-frames:v', '1',
      '-vf', `crop=${width}:${height}:${x}:${y}`,
      '-f', 'image2pipe', '-vcodec', 'png', 'pipe:1',
    ];

    const child = spawn(ffmpeg, args, { windowsHide: true });
    const chunks = [];
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch (_) {
        /* ignore */
      }
      finish(null);
    }, 1200);

    child.stdout.on('data', (chunk) => chunks.push(chunk));
    child.on('error', () => finish(null));
    child.on('close', (code) => {
      if (code === 0 && chunks.length > 0) {
        finish(`data:image/png;base64,${Buffer.concat(chunks).toString('base64')}`);
      } else {
        finish(null);
      }
    });
  });
}

async function showMenu(mode = 'manual') {
  if (!overlay || !overlayReady) return;
  if (menuVisible || menuOpening) return;

  clearTimeout(overlayHideTimer);
  clearTimeout(showTimer);
  clearTimeout(releaseHideTimer);

  const token = ++menuToken;
  menuOpening = true;

  const bounds = menuBounds();
  const backdrop = await captureBackdrop(bounds);

  if (token !== menuToken) {
    menuOpening = false;
    return;
  }
  if (mode === 'drag' && (!shiftDown || !lmbDown || Date.now() < suppressUntil)) {
    menuOpening = false;
    return;
  }

  overlay.setPosition(bounds.x, bounds.y, false);
  menuVisible = true;
  menuMode = mode;
  menuOpening = false;
  overlay.setIgnoreMouseEvents(false);
  overlay.showInactive();
  overlay.webContents.send('menu:open', { mode, backdrop });
}

function hideMenu(immediate = false) {
  if (!overlay) return;
  menuToken += 1;
  menuOpening = false;
  if (!menuVisible) return;
  menuVisible = false;
  menuMode = null;
  clearTimeout(overlayHideTimer);
  clearTimeout(releaseHideTimer);
  overlay.webContents.send('menu:close');
  overlayHideTimer = setTimeout(
    () => {
      if (!menuVisible && overlay) overlay.hide();
    },
    immediate ? 0 : 200
  );
}

/**
 * Отложенное скрытие: отпускание мыши приходит раньше, чем событие drop,
 * поэтому даём окну время принять файл.
 */
function hideMenuSoon(delay = 300) {
  clearTimeout(releaseHideTimer);
  releaseHideTimer = setTimeout(() => {
    if (menuVisible && menuMode === 'drag') hideMenu();
  }, delay);
}

/* ------------------------------------------------------------------ */
/* глобальный хук Shift + ЛКМ                                          */
/* ------------------------------------------------------------------ */

let UiohookKey = {};
let uIOhook = null;

function startHook() {
  try {
    const mod = require('uiohook-napi');
    uIOhook = mod.uIOhook;
    UiohookKey = mod.UiohookKey || {};
  } catch (err) {
    console.error('uiohook-napi недоступен:', err.message);
    return;
  }

  const SHIFT = UiohookKey.Shift ?? 42;
  const SHIFT_RIGHT = UiohookKey.ShiftRight ?? 54;
  const ESC = UiohookKey.Escape ?? 1;

  const isShift = (code) => code === SHIFT || code === SHIFT_RIGHT;

  const maybeOpen = () => {
    if (!settings.enabled) return;
    if (!shiftDown || !lmbDown) return;
    if (menuVisible || menuOpening) return;
    if (Date.now() < suppressUntil) return;
    clearTimeout(showTimer);
    showTimer = setTimeout(() => {
      if (settings.enabled && shiftDown && lmbDown && !menuVisible) showMenu('drag');
    }, SHOW_DELAY);
  };

  uIOhook.on('keydown', (event) => {
    if (event.keycode === ESC) {
      hideMenu();
      return;
    }
    if (isShift(event.keycode)) {
      if (shiftDown) return;
      shiftDown = true;
      maybeOpen();
    }
  });

  uIOhook.on('keyup', (event) => {
    if (isShift(event.keycode)) {
      shiftDown = false;
      clearTimeout(showTimer);
      if (menuOpening) hideMenu();
      else if (menuVisible && menuMode === 'drag') hideMenuSoon(160);
    }
  });

  uIOhook.on('mousedown', (event) => {
    if (event.button === 1) {
      lmbDown = true;
      maybeOpen();
    }
  });

  uIOhook.on('mouseup', (event) => {
    if (event.button === 1) {
      lmbDown = false;
      clearTimeout(showTimer);
      if (menuOpening) hideMenu();
      else if (menuVisible && menuMode === 'drag') hideMenuSoon(320);
    }
  });

  try {
    uIOhook.start();
    hookStarted = true;
  } catch (err) {
    console.error('Не удалось запустить глобальный хук:', err.message);
  }
}

/* ------------------------------------------------------------------ */
/* тост                                                               */
/* ------------------------------------------------------------------ */

function displayForCursor() {
  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
}

function positionToast() {
  if (!toast) return;
  const area = displayForCursor().workArea;
  toast.setPosition(
    Math.round(area.x + area.width - TOAST_W - 24),
    Math.round(area.y + area.height - TOAST_H - 24),
    false
  );
}

function showToast(payload, timeout = 6000) {
  if (!toast) return;
  clearTimeout(toastTimer);
  positionToast();
  toast.showInactive();
  toast.webContents.send('toast:update', payload);
  if (timeout > 0) {
    toastTimer = setTimeout(() => {
      if (toast) toast.hide();
    }, timeout);
  }
}

function hideToast() {
  clearTimeout(toastTimer);
  if (toast) toast.hide();
}

/* ------------------------------------------------------------------ */
/* конвертация                                                        */
/* ------------------------------------------------------------------ */

function enqueueConversion(filePath, targetKey) {
  if (!filePath || typeof filePath !== 'string') return;
  const srcCategory = categoryFor(filePath);
  const target = FORMATS[targetKey];
  if (!target) return;

  if (extOf(filePath) === target.ext) {
    showToast(
      {
        status: 'error',
        title: 'Файл уже в этом формате',
        subtitle: `${path.basename(filePath)} · ${target.label}`,
        progress: null,
      },
      7000
    );
    return;
  }

  if (!isCompatible(srcCategory, targetKey)) {
    showToast(
      {
        status: 'error',
        title: 'Несовместимый формат',
        subtitle: `Из ${extOf(filePath).toUpperCase() || 'этого файла'} нельзя сделать ${target.label}`,
        progress: null,
      },
      8000
    );
    return;
  }

  queue.push({ filePath, targetKey });
  processQueue();
}

let lastProgressSent = 0;

async function processQueue() {
  if (busy) return;
  const job = queue.shift();
  if (!job) {
    return;
  }
  busy = true;
  const target = FORMATS[job.targetKey];
  const srcExt = (extOf(job.filePath) || 'file').toUpperCase();
  const baseName = path.basename(job.filePath);
  const queued = queue.length;

  showToast(
    {
      status: 'working',
      title: `${srcExt} → ${target.label}`,
      subtitle: queued > 0 ? `${baseName} · ещё ${queued} в очереди` : baseName,
      progress: 0,
    },
    0
  );

  try {
    const result = await convertFile({
      input: job.filePath,
      targetKey: job.targetKey,
      onProgress: (p) => {
        const now = Date.now();
        if (now - lastProgressSent < 70 && p < 1) return;
        lastProgressSent = now;
        showToast(
          {
            status: 'working',
            title: `${srcExt} → ${target.label}`,
            subtitle: queued > 0 ? `${baseName} · ещё ${queued} в очереди` : baseName,
            progress: p,
          },
          0
        );
      },
    });

    const outName = path.basename(result.output);
    lastResultPath = result.output;
    showToast(
      {
        status: 'done',
        title: `${srcExt} → ${target.label}`,
        subtitle: outName,
        progress: 1,
        path: result.output,
      },
      queue.length > 0 ? 2500 : 7000
    );

    if (Notification.isSupported()) {
      const n = new Notification({
        title: 'Glass Convert · готово',
        body: `${outName} — рядом с исходным файлом`,
        icon: icon(64),
        silent: true,
      });
      n.on('click', () => shell.showItemInFolder(result.output));
      n.show();
    }
  } catch (err) {
    showToast(
      {
        status: 'error',
        title: 'Не удалось конвертировать',
        subtitle: err.message || 'Неизвестная ошибка',
        progress: null,
      },
      queue.length > 0 ? 4000 : 10000
    );
  } finally {
    busy = false;
    if (queue.length > 0) setTimeout(processQueue, 250);
  }
}

/* ------------------------------------------------------------------ */
/* трей и меню приложения                                             */
/* ------------------------------------------------------------------ */

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    {
      label: settings.enabled ? 'Glass Convert · активен' : 'Glass Convert · пауза',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Открыть меню конвертации',
      accelerator: 'Control+Alt+Space',
      click: () => showMenu('manual'),
    },
    {
      label: 'Включено',
      type: 'checkbox',
      checked: settings.enabled,
      click: (item) => {
        settings.enabled = item.checked;
        saveSettings();
        if (!settings.enabled) hideMenu();
        refreshTray();
      },
    },
    {
      label: 'Запускать при входе',
      type: 'checkbox',
      checked: settings.autoLaunch,
      click: (item) => {
        settings.autoLaunch = item.checked;
        applyAutoLaunch();
        saveSettings();
        refreshTray();
      },
    },
    { type: 'separator' },
    {
      label: 'Как это работает',
      click: () => {
        showToast(
          {
            status: 'info',
            title: 'Зажмите Shift во время перетаскивания',
            subtitle: 'Отпустите файл на нужный формат — готовый файл появится рядом',
            progress: null,
          },
          9000
        );
      },
    },
    { type: 'separator' },
    { label: 'Выход', click: () => app.quit() },
  ]);
}

function refreshTray() {
  if (!tray) return;
  tray.setToolTip(
    settings.enabled ? 'Glass Convert · Shift + перетаскивание' : 'Glass Convert · на паузе'
  );
  tray.setContextMenu(buildTrayMenu());
}

function createTray() {
  const image = icon(32);
  image.addRepresentation({ scaleFactor: 2, buffer: makeIconPng(64) });
  tray = new Tray(image);
  tray.on('click', () => {
    if (menuVisible) hideMenu();
    else showMenu('manual');
  });
  refreshTray();
}

/* ------------------------------------------------------------------ */
/* IPC                                                                */
/* ------------------------------------------------------------------ */

function registerIpc() {
  ipcMain.on('convert:start', (_event, payload) => {
    if (!payload || typeof payload !== 'object') return;
    suppressUntil = Date.now() + 900;
    hideMenu();
    enqueueConversion(payload.path, payload.target);
  });

  ipcMain.on('menu:hide', () => {
    hideMenu();
  });

  ipcMain.on('menu:cancel', () => {
    suppressUntil = Date.now() + 400;
    hideMenu(true);
  });

  ipcMain.on('toast:dismiss', () => hideToast());

  ipcMain.on('toast:open-folder', () => {
    if (lastResultPath) shell.showItemInFolder(lastResultPath);
    hideToast();
  });

  ipcMain.on('toast:show-folder', (_event, filePath) => {
    if (typeof filePath === 'string' && fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath);
    }
    hideToast();
  });
}

/* ------------------------------------------------------------------ */
/* запуск                                                             */
/* ------------------------------------------------------------------ */

app.on('second-instance', () => {
  showMenu('manual');
});

app.whenReady().then(() => {
  loadSettings();
  applyAutoLaunch();

  createOverlay();
  createToast();
  createTray();
  registerIpc();
  startHook();

  try {
    globalShortcut.register('Control+Alt+Space', () => showMenu('manual'));
  } catch (_) {
    /* ignore */
  }

  app.on('activate', () => {
    if (!overlay) createOverlay();
  });
});

app.on('window-all-closed', () => {
  /* приложение живёт в трее */
});

app.on('will-quit', () => {
  try {
    if (hookStarted && uIOhook) uIOhook.stop();
  } catch (_) {
    /* ignore */
  }
  globalShortcut.unregisterAll();
  clearTimeout(showTimer);
  clearTimeout(releaseHideTimer);
  clearTimeout(overlayHideTimer);
  clearTimeout(toastTimer);
});
