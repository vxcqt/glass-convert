'use strict';

/**
 * Снимает превью интерфейса в preview/*.png
 * Запуск: npm run preview
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'preview');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const common = {
  preload: path.join(ROOT, 'src', 'preload.js'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: false,
  backgroundThrottling: false,
};

const WALLPAPER = 'C:\\Windows\\Web\\Wallpaper\\ThemeA\\img20.jpg';
const wallpaperData =
  process.env.GC_WALLPAPER !== '0' && fs.existsSync(WALLPAPER)
    ? `data:image/jpeg;base64,${fs.readFileSync(WALLPAPER).toString('base64')}`
    : '';

function wireLogs(win, label) {
  win.webContents.on('console-message', (event) => {
    const message = typeof event === 'object' && event.message ? event.message : '';
    if (message && !/Security Warning/.test(message)) console.log(`[${label}]`, message);
  });
  win.webContents.on('did-fail-load', (_e, code, desc) => {
    console.error(`[${label}] load failed`, code, desc);
  });
}

async function setWallpaper(win) {
  if (!wallpaperData) return;
  await win.webContents.insertCSS(
    `body.is-preview { background-image: url("${wallpaperData}") !important; background-size: cover !important; background-position: center !important; }`
  );
}

async function shotOverlay() {
  const win = new BrowserWindow({
    width: 600,
    height: 600,
    frame: false,
    transparent: false,
    backgroundColor: '#080b16',
    show: true,
    webPreferences: common,
  });
  await win.loadFile(path.join(ROOT, 'src', 'overlay.html'), { query: { preview: '1', hot: '2' } });
  wireLogs(win, 'overlay');
  await setWallpaper(win);
  await wait(2500);
  const image = await win.webContents.capturePage();
  fs.writeFileSync(path.join(OUT, 'overlay.png'), image.toPNG());
  win.destroy();
}

async function shotOverlayIdle() {
  const win = new BrowserWindow({
    width: 600,
    height: 600,
    frame: false,
    transparent: false,
    backgroundColor: '#080b16',
    show: true,
    webPreferences: common,
  });
  await win.loadFile(path.join(ROOT, 'src', 'overlay.html'), { query: { preview: '1' } });
  wireLogs(win, 'overlay-idle');
  await setWallpaper(win);
  await wait(2500);
  const image = await win.webContents.capturePage();
  fs.writeFileSync(path.join(OUT, 'overlay-idle.png'), image.toPNG());
  win.destroy();
}

async function shotToast() {
  const win = new BrowserWindow({
    width: 400,
    height: 116,
    frame: false,
    transparent: false,
    backgroundColor: '#080b16',
    show: true,
    webPreferences: common,
  });
  await win.loadFile(path.join(ROOT, 'src', 'toast.html'), { query: { preview: '1' } });
  await wait(500);
  win.webContents.send('toast:update', {
    status: 'working',
    title: 'MP4 → MP3',
    subtitle: 'sunset-drone.mp4',
    progress: 0.64,
  });
  await wait(600);
  const image = await win.webContents.capturePage();
  fs.writeFileSync(path.join(OUT, 'toast-working.png'), image.toPNG());
  win.webContents.send('toast:update', {
    status: 'done',
    title: 'MP4 → MP3',
    subtitle: 'sunset-drone.mp3',
    progress: 1,
    path: 'C:\\video\\sunset-drone.mp3',
  });
  await wait(500);
  fs.writeFileSync(path.join(OUT, 'toast-done.png'), (await win.webContents.capturePage()).toPNG());
  win.destroy();
}

app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  try {
    await shotOverlayIdle();
    await shotOverlay();
    await shotToast();
    console.log('preview saved to', OUT);
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  }
  app.quit();
});

app.on('window-all-closed', () => {});
