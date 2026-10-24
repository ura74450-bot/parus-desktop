'use strict';
const { app, BrowserWindow, Tray, Menu, ipcMain, shell, screen, session, dialog, nativeImage, desktopCapturer } = require('electron');
const path = require('path');
const fs = require('fs');

// Адрес мессенджера. Можно переопределить переменной окружения PARUS_URL.
const SITE = (process.env.PARUS_URL || 'https://parus.onrender.com').replace(/\/+$/, '');
const SITE_ORIGIN = new URL(SITE).origin;
const ICON = path.join(__dirname, 'build', 'icon.png');
const SPLASH = path.join(__dirname, 'splash.html');
const startHidden = process.argv.includes('--hidden');

let win = null, tray = null, quitting = false, cfg = {};
const toasts = [];

app.setAppUserModelId('com.parus.messenger');

/* ---------- настройки ---------- */
const cfgPath = () => path.join(app.getPath('userData'), 'settings.json');
const readCfg = () => { try { return JSON.parse(fs.readFileSync(cfgPath(), 'utf8')); } catch { return {}; } };
const writeCfg = () => { try { fs.writeFileSync(cfgPath(), JSON.stringify(cfg)); } catch {} };
function setAutostart(on) { app.setLoginItemSettings({ openAtLogin: !!on, args: ['--hidden'] }); if (tray) tray.setContextMenu(trayMenu()); }

/* ---------- главное окно ---------- */
function loadSplash() { if (win) win.loadFile(SPLASH, { query: { u: SITE } }); }
function showWin() {
  if (!win) createWindow();
  if (win.isMinimized()) win.restore();
  win.show(); win.focus();
}
function createWindow() {
  win = new BrowserWindow({
    width: 1180, height: 780, minWidth: 420, minHeight: 560, show: false, backgroundColor: '#0e1116',
    title: 'Parus', icon: ICON, autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true,
      backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required', spellcheck: false
    }
  });
  win.setMenu(null);
  loadSplash();
  win.once('ready-to-show', () => { if (!startHidden) { win.show(); setTimeout(firstRun, 2500); } });
  win.on('close', e => {
    if (quitting) return;
    e.preventDefault(); win.hide();
    if (!cfg.trayHint) {
      cfg.trayHint = true; writeCfg();
      showToast({ title: 'Parus работает в фоне', body: 'Значок возле часов — открыть или выйти. Новые сообщения будут появляться в углу экрана.', tag: 'hint' });
    }
  });
  win.on('closed', () => { win = null; });
  win.on('focus', () => { if (win) win.flashFrame(false); });

  const wc = win.webContents;
  wc.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(SITE_ORIGIN)) wc.downloadURL(url);
    else if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  wc.on('will-navigate', (e, url) => {
    if (url.startsWith(SITE_ORIGIN) || url.startsWith('file://')) return;
    e.preventDefault(); if (/^https?:\/\//i.test(url)) shell.openExternal(url);
  });
  wc.on('did-fail-load', (_e, code, _d, _u, isMain) => { if (isMain && code !== -3) setTimeout(loadSplash, 800); });
  wc.on('before-input-event', (e, i) => {
    if (i.type === 'keyDown' && (i.key === 'F5' || (i.control && String(i.key).toLowerCase() === 'r'))) { e.preventDefault(); wc.reload(); }
  });
  wc.on('context-menu', (_e, p) => {
    if (!p.isEditable && !p.selectionText) return;
    Menu.buildFromTemplate([{ role: 'cut', label: 'Вырезать' }, { role: 'copy', label: 'Копировать' }, { role: 'paste', label: 'Вставить' }, { role: 'selectAll', label: 'Выделить всё' }]).popup();
  });
}
async function firstRun() {
  if (cfg.asked || !win) return;
  cfg.asked = true; writeCfg();
  const r = await dialog.showMessageBox(win, {
    type: 'question', buttons: ['Да', 'Нет'], defaultId: 0, cancelId: 1, title: 'Parus',
    message: 'Запускать Parus вместе с Windows?',
    detail: 'Так вы не пропустите сообщения: уведомления будут появляться в углу экрана, даже когда окно закрыто.'
  });
  if (r.response === 0) setAutostart(true);
}

/* ---------- значок в трее ---------- */
function trayMenu() {
  return Menu.buildFromTemplate([
    { label: 'Открыть Parus', click: showWin },
    { label: 'Запускать вместе с Windows', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, click: i => setAutostart(i.checked) },
    { type: 'separator' },
    { label: 'Выход', click: () => { quitting = true; app.quit(); } }
  ]);
}
function createTray() {
  tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 }));
  tray.setToolTip('Parus');
  tray.setContextMenu(trayMenu());
  tray.on('click', () => { if (win && win.isVisible() && win.isFocused()) win.hide(); else showWin(); });
}

/* ---------- всплывающие плашки в углу экрана (как в Telegram) ---------- */
const TW = 372, TH = 104, GAP = 6, MARGIN = 10;
function layoutToasts() {
  const wa = screen.getPrimaryDisplay().workArea;
  let y = wa.y + wa.height - MARGIN;
  toasts.forEach(t => {
    y -= TH;
    if (!t.win.isDestroyed()) t.win.setBounds({ x: wa.x + wa.width - TW - MARGIN, y, width: TW, height: TH });
    y -= GAP;
  });
}
function closeToast(t) {
  const i = toasts.indexOf(t); if (i >= 0) toasts.splice(i, 1);
  try { if (!t.win.isDestroyed()) t.win.destroy(); } catch {}
  layoutToasts();
}
function showToast(d) {
  toasts.filter(t => t.tag === d.tag).forEach(closeToast);
  while (toasts.length >= 4) closeToast(toasts[toasts.length - 1]);
  const w = new BrowserWindow({
    width: TW, height: TH, show: false, frame: false, transparent: true, resizable: false, movable: false,
    minimizable: false, maximizable: false, fullscreenable: false, skipTaskbar: true, focusable: false,
    alwaysOnTop: true, hasShadow: false,
    webPreferences: { preload: path.join(__dirname, 'toast-preload.js'), contextIsolation: true, sandbox: true, backgroundThrottling: false }
  });
  const t = { win: w, tag: d.tag };
  toasts.unshift(t); layoutToasts();
  w.setAlwaysOnTop(true, 'screen-saver');
  w.loadFile(path.join(__dirname, 'toast.html'));
  w.webContents.once('did-finish-load', () => { if (w.isDestroyed()) return; w.webContents.send('toast-data', d); w.showInactive(); });
  w.on('closed', () => { const i = toasts.indexOf(t); if (i >= 0) { toasts.splice(i, 1); layoutToasts(); } });
}
const fromToast = e => toasts.find(x => !x.win.isDestroyed() && x.win.webContents === e.sender);

ipcMain.on('notify', (e, d) => {
  if (!win || e.sender !== win.webContents || !d || typeof d !== 'object') return;
  showToast({
    title: String(d.title || 'Parus').slice(0, 80), body: String(d.body || '').slice(0, 200), tag: String(d.tag || Date.now()),
    key: d.key ? String(d.key) : '', avatar: /^https?:\/\//i.test(d.avatar || '') ? String(d.avatar) : '', sticky: !!d.sticky
  });
  if (!win.isFocused()) win.flashFrame(true);
});
ipcMain.on('close-toast', (e, tag) => { toasts.filter(t => t.tag === String(tag)).forEach(closeToast); });
ipcMain.on('toast-click', (e, key) => {
  showWin(); if (key && win) win.webContents.send('open-chat', key);
  const t = fromToast(e); if (t) closeToast(t);
});
ipcMain.on('toast-close', e => { const t = fromToast(e); if (t) closeToast(t); });

/* ---------- запуск ---------- */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showWin());
  app.on('before-quit', () => { quitting = true; });
  app.on('window-all-closed', () => { /* остаёмся в трее */ });
  app.whenReady().then(() => {
    cfg = readCfg();
    const ses = session.defaultSession;
    const trusted = u => { try { return new URL(u).origin === SITE_ORIGIN; } catch { return false; } };
    const OK = new Set(['media', 'notifications', 'fullscreen', 'clipboard-read', 'clipboard-sanitized-write', 'display-capture']);
    ses.setPermissionRequestHandler((wc, perm, cb) => cb(OK.has(perm) && trusted(wc.getURL())));
    ses.setPermissionCheckHandler((wc, perm, origin) => OK.has(perm) && trusted(origin));
    // трансляция экрана со звуком системы
    ses.setDisplayMediaRequestHandler((req, cb) => {
      desktopCapturer.getSources({ types: ['screen'] })
        .then(s => (s.length ? cb({ video: s[0], audio: 'loopback' }) : cb({})))
        .catch(() => cb({}));
    });
    createTray();
    createWindow();
  });
}
