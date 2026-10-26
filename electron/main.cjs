const {
  app,
  BrowserWindow,
  nativeTheme,
  Tray,
  Menu,
  nativeImage,
  ipcMain,
  screen
} = require('electron');
const path = require('path');
const { fork } = require('child_process');

// Optimasi Memori Chromium (terverifikasi: 61 FPS, CPU ~2% dari 1 core)
// 1. Matikan Spare Renderer: tab cadangan bawaan Chrome yang tidak terpakai di aplikasi desktop.
app.commandLine.appendSwitch('disable-features', 'SpareRendererForSitePerProcess');
// 2. Komposisi layer dilakukan software compositor Chromium, sementara rasterisasi tetap di GPU.
//    Ini mencegah proses GPU menumpuk surface akselerasi hardware saat audio diputar
//    (terukur menurunkan RAM running dari ~419 MB menjadi ~215 MB tanpa penurunan FPS).
app.commandLine.appendSwitch('disable-gpu-compositing');
// 3. Batas heap moderat (256 MB) agar Garbage Collector V8 lebih sigap membersihkan memori
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=256');
// NOTE: Flag media-cache-size dan disable-renderer-backgrounding sengaja TIDAK dipasang
// karena terbukti menaikkan pemakaian RAM (buffer audio tertahan di memori renderer
// dan Chromium kehilangan mekanisme trimming working set saat jendela tidak aktif).

// Pastikan tema sistem selalu Dark
if (nativeTheme) {
  nativeTheme.themeSource = 'dark';
}

let serverProcess = null;
let mainWindow = null;
let tray = null;
let isQuitting = false;
let notchMode = false;
let notchDock = 'top';
let isNotchCollapsed = false;
let isEnteringNotch = false;
let notchEntryTimer = null;
let notchEntryListener = null;
let savedWindowState = null;
let lastNotchBounds = null;

const NOTCH_SIZES = {
  top: {
    expanded: { width: 380, height: 60 },
    collapsed: { width: 190, height: 42 }
  },
  left: {
    expanded: { width: 76, height: 260 },
    collapsed: { width: 48, height: 140 }
  },
  right: {
    expanded: { width: 76, height: 260 },
    collapsed: { width: 48, height: 140 }
  }
};

const NOTCH_ANIMATION_DURATION_MS = 180;
const NOTCH_ANIMATION_FRAME_MS = 12;
const NOTCH_MOVE_COOLDOWN_MS = 100;

// Pemantauan posisi kursor dilakukan main process karena area drag pada
// window notch menelan event mouse di renderer, sehingga hover tidak andal.
const NOTCH_CURSOR_POLL_MS = 50;

// Masa tenggang sebelum notch mengecil setelah kursor keluar dari area notch.
const NOTCH_COLLAPSE_DELAY_MS = 500;

let notchAnimationTimer = null;
let notchAnimationCooldownTimer = null;
let notchCursorTimer = null;
let notchCollapseTimer = null;

// Mulai backend local engine (yt-dlp + ffmpeg server) di background
function startLocalServer() {
  try {
    const isPackaged = app.isPackaged;
    const serverScript = isPackaged
      ? path.join(process.resourcesPath, 'app.asar.unpacked', 'server', 'index.mjs')
      : path.join(__dirname, '../server/index.mjs');

    const downloadsDir = path.join(app.getPath('userData'), 'downloads');
    const fs = require('fs');
    if (!fs.existsSync(downloadsDir)) {
      try {
        fs.mkdirSync(downloadsDir, { recursive: true });
      } catch (e) {
        console.warn('Gagal membuat downloadsDir:', e);
      }
    }

    serverProcess = fork(serverScript, [], {
      env: {
        ...process.env,
        PORT: '3001',
        ELECTRON_RUN_AS_NODE: '1',
        DOWNLOADS_DIR: downloadsDir
      },
      stdio: 'pipe'
    });

    serverProcess.stdout?.on('data', (d) => {
      console.log('[Local Engine]:', d.toString().trim());
    });

    serverProcess.stderr?.on('data', (d) => {
      console.warn('[Local Engine Err]:', d.toString().trim());
    });

    serverProcess.on('error', (err) => {
      console.warn('Gagal memulai server internal Electron:', err);
    });
  } catch (err) {
    console.warn('Pengecualian saat fork server internal:', err);
  }
}

// Matikan server internal saat aplikasi Electron ditutup
function stopLocalServer() {
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch {
      // Abaikan jika proses sudah mati
    }
    serverProcess = null;
  }
}

function getWindowState() {
  return {
    isMaximized: Boolean(
      mainWindow &&
      !mainWindow.isDestroyed() &&
      mainWindow.isMaximized()
    ),
    isNotchMode: notchMode,
    notchDock,
    isNotchCollapsed
  };
}

function sendWindowState() {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send('window:state-changed', getWindowState());
}

function isMainWindowSender(event) {
  return Boolean(
    mainWindow &&
    !mainWindow.isDestroyed() &&
    event.sender === mainWindow.webContents
  );
}

function clampBoundsToDisplay(bounds) {
  const { workArea } = screen.getDisplayMatching(bounds);
  const width = Math.min(bounds.width, workArea.width);
  const height = Math.min(bounds.height, workArea.height);
  const maxX = workArea.x + workArea.width - width;
  const maxY = workArea.y + workArea.height - height;

  return {
    x: Math.min(Math.max(bounds.x, workArea.x), maxX),
    y: Math.min(Math.max(bounds.y, workArea.y), maxY),
    width,
    height
  };
}

function detectNearestDockEdge(bounds) {
  const display = screen.getDisplayMatching(bounds) || screen.getPrimaryDisplay();
  const { workArea } = display;

  // Snapping 3 tepi: Top, Left, Right (Bottom dikecualikan agar tidak bentrok dengan taskbar)
  const distTop = Math.abs(bounds.y - workArea.y);
  const distLeft = Math.abs(bounds.x - workArea.x);
  const distRight = Math.abs((workArea.x + workArea.width) - (bounds.x + bounds.width));

  if (distTop <= distLeft && distTop <= distRight) {
    return 'top';
  } else if (distLeft <= distRight) {
    return 'left';
  } else {
    return 'right';
  }
}

/**
 * Menentukan bounds notch sesuai dock dan kondisi menciut/membesar.
 *
 * @param {{ x: number, y: number, width: number, height: number }} referenceBounds
 *   Bounds acuan, umumnya posisi notch saat ini.
 * @param {'top'|'left'|'right'} dock
 * @param {boolean} collapsed
 * @param {'center'|'bottom'} anchor
 *   'center' untuk penempatan awal dan snapping setelah drag.
 *   'bottom' untuk transisi collapse/expand agar tepi bawah dock kiri/kanan
 *   tidak bergeser sehingga tombol Play/Pause tetap di tempatnya. Dock atas
 *   selalu menempel di tepi atas layar sehingga anchor ini tidak berpengaruh.
 * @returns {{ x: number, y: number, width: number, height: number }}
 */
function calculateSnappedBounds(
  referenceBounds,
  dock = notchDock,
  collapsed = isNotchCollapsed,
  anchor = 'center'
) {
  const display = screen.getDisplayMatching(referenceBounds) || screen.getPrimaryDisplay();
  const { workArea } = display;
  const size = NOTCH_SIZES[dock][collapsed ? 'collapsed' : 'expanded'];

  let x = referenceBounds.x;
  let y = referenceBounds.y;

  if (dock === 'top') {
    y = workArea.y;
    const centerX = referenceBounds.x + referenceBounds.width / 2;
    x = Math.round(centerX - size.width / 2);
    x = Math.min(Math.max(x, workArea.x), workArea.x + workArea.width - size.width);
  } else if (dock === 'left' || dock === 'right') {
    x = dock === 'left' ? workArea.x : workArea.x + workArea.width - size.width;

    if (anchor === 'bottom') {
      const bottom = referenceBounds.y + referenceBounds.height;
      y = Math.round(bottom - size.height);
    } else {
      const centerY = referenceBounds.y + referenceBounds.height / 2;
      y = Math.round(centerY - size.height / 2);
    }

    y = Math.min(Math.max(y, workArea.y), workArea.y + workArea.height - size.height);
  }

  return {
    x,
    y,
    width: size.width,
    height: size.height
  };
}

function getNotchBounds(dock = notchDock, collapsed = isNotchCollapsed, anchor = 'center') {
  const referenceBounds =
    lastNotchBounds ||
    savedWindowState?.bounds ||
    (mainWindow && !mainWindow.isDestroyed() ? mainWindow.getBounds() : null) || {
      x: 0,
      y: 0,
      width: NOTCH_SIZES.top.expanded.width,
      height: NOTCH_SIZES.top.expanded.height
    };

  return calculateSnappedBounds(referenceBounds, dock, collapsed, anchor);
}

function stopNotchBoundsAnimation() {
  if (notchAnimationTimer) {
    clearInterval(notchAnimationTimer);
    notchAnimationTimer = null;
  }

  if (notchAnimationCooldownTimer) {
    clearTimeout(notchAnimationCooldownTimer);
    notchAnimationCooldownTimer = null;
  }
}

function isNotchBoundsAnimating() {
  return Boolean(notchAnimationTimer || notchAnimationCooldownTimer);
}

function easeOutCubic(progress) {
  return 1 - Math.pow(1 - progress, 3);
}

/**
 * Menganimasikan bounds jendela notch secara bertahap agar transisi
 * collapse/expand terasa halus, bukan lompatan ukuran instan.
 * @param {{ x: number, y: number, width: number, height: number }} targetBounds
 */
function animateNotchBounds(targetBounds) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  stopNotchBoundsAnimation();

  const startBounds = mainWindow.getBounds();
  const distance =
    Math.abs(startBounds.x - targetBounds.x) +
    Math.abs(startBounds.y - targetBounds.y) +
    Math.abs(startBounds.width - targetBounds.width) +
    Math.abs(startBounds.height - targetBounds.height);

  if (distance < 2) {
    mainWindow.setBounds(targetBounds);
    return;
  }

  const startedAt = Date.now();

  notchAnimationTimer = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      stopNotchBoundsAnimation();
      return;
    }

    const progress = Math.min((Date.now() - startedAt) / NOTCH_ANIMATION_DURATION_MS, 1);

    if (progress >= 1) {
      mainWindow.setBounds(targetBounds);
      stopNotchBoundsAnimation();

      // NOTE: Event 'moved' di Windows dapat tertunda setelah setBounds
      // terakhir. Beri jeda singkat agar snapping tidak menimpa hasil animasi.
      notchAnimationCooldownTimer = setTimeout(() => {
        notchAnimationCooldownTimer = null;
      }, NOTCH_MOVE_COOLDOWN_MS);
      return;
    }

    const eased = easeOutCubic(progress);
    mainWindow.setBounds({
      x: Math.round(startBounds.x + (targetBounds.x - startBounds.x) * eased),
      y: Math.round(startBounds.y + (targetBounds.y - startBounds.y) * eased),
      width: Math.round(startBounds.width + (targetBounds.width - startBounds.width) * eased),
      height: Math.round(startBounds.height + (targetBounds.height - startBounds.height) * eased)
    });
  }, NOTCH_ANIMATION_FRAME_MS);
}

function handleWindowMoved() {
  if (!mainWindow || mainWindow.isDestroyed() || !notchMode || isNotchBoundsAnimating()) {
    return;
  }

  const currentBounds = mainWindow.getBounds();
  const nextDock = detectNearestDockEdge(currentBounds);
  notchDock = nextDock;

  const snapped = calculateSnappedBounds(currentBounds, notchDock, isNotchCollapsed);
  lastNotchBounds = snapped;
  mainWindow.setBounds(snapped);
  sendWindowState();
}

function setNotchCollapsed(collapsed) {
  if (!mainWindow || mainWindow.isDestroyed() || !notchMode) return;

  const nextCollapsed = Boolean(collapsed);
  if (isNotchCollapsed === nextCollapsed) return;

  clearNotchCollapseTimer();
  isNotchCollapsed = nextCollapsed;

  // Anchor 'bottom' agar tepi bawah dock kiri/kanan tetap stabil sehingga
  // tombol Play/Pause tidak bergeser saat notch membesar atau menciut.
  const targetBounds = getNotchBounds(notchDock, isNotchCollapsed, 'bottom');
  lastNotchBounds = targetBounds;

  // State dikirim lebih dulu agar konten notch berganti bersamaan dengan
  // awal animasi ukuran jendela.
  sendWindowState();
  animateNotchBounds(targetBounds);
}

function clearNotchCollapseTimer() {
  if (notchCollapseTimer) {
    clearTimeout(notchCollapseTimer);
    notchCollapseTimer = null;
  }
}

function scheduleNotchCollapse() {
  if (notchCollapseTimer) return;

  notchCollapseTimer = setTimeout(() => {
    notchCollapseTimer = null;

    if (!notchMode || !mainWindow || mainWindow.isDestroyed()) return;

    // Cek ulang posisi kursor agar notch tidak mengecil ketika kursor sudah
    // kembali masuk saat masa tenggang berjalan.
    if (isCursorInsideNotch() || isNotchCollapsed || isNotchBoundsAnimating()) return;

    setNotchCollapsed(true);
  }, NOTCH_COLLAPSE_DELAY_MS);
}

function isCursorInsideNotch() {
  if (!mainWindow || mainWindow.isDestroyed()) return false;

  const point = screen.getCursorScreenPoint();
  const bounds = mainWindow.getBounds();

  return (
    point.x >= bounds.x &&
    point.x < bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y < bounds.y + bounds.height
  );
}

function handleNotchCursorTick() {
  if (!notchMode || !mainWindow || mainWindow.isDestroyed()) {
    stopNotchCursorTracking();
    return;
  }

  if (isCursorInsideNotch()) {
    // Selama kursor berada di dalam notch, notch selalu membesar dan
    // penciutan dibatalkan tanpa memakai timer inaktivitas.
    clearNotchCollapseTimer();

    if (isNotchCollapsed) {
      setNotchCollapsed(false);
    }

    return;
  }

  if (!isNotchCollapsed && !isNotchBoundsAnimating()) {
    scheduleNotchCollapse();
  }
}

function startNotchCursorTracking() {
  if (notchCursorTimer) return;
  notchCursorTimer = setInterval(handleNotchCursorTick, NOTCH_CURSOR_POLL_MS);
}

function stopNotchCursorTracking() {
  if (notchCursorTimer) {
    clearInterval(notchCursorTimer);
    notchCursorTimer = null;
  }

  clearNotchCollapseTimer();
}

function clearNotchEntryTransition() {
  isEnteringNotch = false;

  if (notchEntryTimer) {
    clearTimeout(notchEntryTimer);
    notchEntryTimer = null;
  }

  if (notchEntryListener && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.removeListener('unmaximize', notchEntryListener);
  }
  notchEntryListener = null;
}

function cancelPendingNotchEntry() {
  if (!isEnteringNotch) return;
  clearNotchEntryTransition();
  savedWindowState = null;
}

function applyNotchMode() {
  if (!mainWindow || mainWindow.isDestroyed() || !notchMode) return;

  mainWindow.setMinimumSize(0, 0);
  mainWindow.setBounds(getNotchBounds());
  mainWindow.setResizable(false);
  mainWindow.setMaximizable(false);
  mainWindow.setAlwaysOnTop(true);
  mainWindow.setSkipTaskbar(true);
  mainWindow.show();
  mainWindow.focus();

  // Windows dapat mengabaikan topmost saat animasi unmaximize masih berjalan.
  // Terapkan ulang setelah transisi agar mini-player benar-benar berada di atas.
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && notchMode) {
      mainWindow.setAlwaysOnTop(true);
    }
  }, 150);

  sendWindowState();

  // Mulai memantau posisi kursor untuk ekspansi dan penciutan notch.
  startNotchCursorTracking();
}

function enterNotchMode() {
  if (!mainWindow || mainWindow.isDestroyed() || notchMode || isEnteringNotch) {
    return getWindowState();
  }

  stopNotchBoundsAnimation();

  const wasMaximized = mainWindow.isMaximized();
  const bounds = wasMaximized ? mainWindow.getNormalBounds() : mainWindow.getBounds();
  const [minWidth, minHeight] = mainWindow.getMinimumSize();

  savedWindowState = {
    bounds: clampBoundsToDisplay(bounds),
    wasMaximized,
    minWidth,
    minHeight
  };

  isNotchCollapsed = false;

  if (wasMaximized) {
    mainWindow.setAlwaysOnTop(true);
    isEnteringNotch = true;
    const finishEntry = () => {
      if (!isEnteringNotch) return;
      clearNotchEntryTransition();
      notchMode = true;
      applyNotchMode();
    };

    notchEntryListener = finishEntry;
    mainWindow.once('unmaximize', finishEntry);
    notchEntryTimer = setTimeout(finishEntry, 300);
    mainWindow.unmaximize();
  } else {
    notchMode = true;
    applyNotchMode();
  }

  return getWindowState();
}

function exitNotchMode(maximize = false) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return getWindowState();
  }

  if (isEnteringNotch) {
    cancelPendingNotchEntry();
    return getWindowState();
  }

  if (!notchMode || !savedWindowState) {
    return getWindowState();
  }

  clearNotchEntryTransition();
  stopNotchBoundsAnimation();
  stopNotchCursorTracking();
  lastNotchBounds = mainWindow.getBounds();

  const saved = savedWindowState;
  savedWindowState = null;
  notchMode = false;
  isNotchCollapsed = false;

  mainWindow.setAlwaysOnTop(false);
  mainWindow.setSkipTaskbar(false);
  mainWindow.setResizable(true);
  mainWindow.setMaximizable(true);
  mainWindow.setMinimumSize(saved.minWidth, saved.minHeight);
  mainWindow.setBounds(clampBoundsToDisplay(saved.bounds));
  mainWindow.show();

  if (maximize || saved.wasMaximized) {
    mainWindow.maximize();
  }

  mainWindow.focus();
  sendWindowState();

  return getWindowState();
}

function showMainWindow() {
  if (!app.isReady()) return;

  cancelPendingNotchEntry();

  if (!mainWindow || mainWindow.isDestroyed()) {
    notchMode = false;
    savedWindowState = null;
    createWindow();
  }

  if (!mainWindow) return;

  if (notchMode) {
    exitNotchMode(false);
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  if (tray) return tray;

  const iconPath = path.join(app.getAppPath(), 'build', 'icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) {
    // Tanpa ikon tray, close-to-tray akan membuat jendela tidak bisa
    // dipulihkan. Biarkan perilaku close normal jika ikon gagal dimuat.
    console.warn('Ikon tray tidak dapat dimuat:', iconPath);
    return null;
  }

  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('MusicFlow');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Buka MusicFlow', click: showMainWindow },
      {
        label: 'Keluar',
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ])
  );
  tray.on('click', showMainWindow);
  tray.on('double-click', showMainWindow);

  return tray;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: 'MusicFlow - Music Player',
    icon: path.join(__dirname, '../build/icon.ico'),
    backgroundColor: '#000000',
    accentColor: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Memperbolehkan streaming audio lokal tanpa blokir CORS
      spellcheck: false, // Mematikan dictionary Chromium (menghemat ~15-20 MB RAM)
      backgroundThrottling: false // Menjaga pemutaran audio di latar belakang tetap stabil
    }
  });

  // Pembersihan cache sesaat saat jendela diminimalkan agar konsumsi RAM turun.
  // Pemantauan kursor notch juga dihentikan karena jendela tidak terlihat.
  mainWindow.on('minimize', () => {
    cancelPendingNotchEntry();
    stopNotchCursorTracking();
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.session.clearCache().catch(() => {});
    }
  });

  // Close-to-tray: audio tetap berjalan karena renderer tidak dimusnahkan.
  // Jika tray gagal dibuat, close tetap menutup aplikasi seperti biasa.
  mainWindow.on('close', (event) => {
    cancelPendingNotchEntry();
    if (!isQuitting && tray) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('maximize', () => {
    cancelPendingNotchEntry();
    sendWindowState();
  });
  mainWindow.on('unmaximize', sendWindowState);
  mainWindow.on('restore', () => {
    sendWindowState();
    if (notchMode) startNotchCursorTracking();
  });
  mainWindow.on('hide', stopNotchCursorTracking);
  mainWindow.on('moved', handleWindowMoved);
  mainWindow.webContents.on('did-finish-load', sendWindowState);

  const isDev = process.argv.includes('--dev');
  if (isDev) {
    // Saat development: muat dari Vite dev server
    mainWindow.loadURL('http://localhost:5173');
  } else {
    // Saat production (.exe): muat file HTML build
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Dukungan tombol F12 untuk membuka DevTools jika diperlukan debugging
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    clearNotchEntryTransition();
    stopNotchBoundsAnimation();
    stopNotchCursorTracking();
    mainWindow = null;
    notchMode = false;
    savedWindowState = null;
  });
}

function registerWindowIpc() {
  ipcMain.on('window:minimize', (event) => {
    if (!isMainWindowSender(event) || !mainWindow) return;
    mainWindow.minimize();
  });

  ipcMain.on('window:toggle-maximize', (event) => {
    if (!isMainWindowSender(event) || !mainWindow) return;

    if (isEnteringNotch) {
      cancelPendingNotchEntry();
    }

    if (notchMode) {
      exitNotchMode(true);
      return;
    }

    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  ipcMain.on('window:close', (event) => {
    if (!isMainWindowSender(event) || !mainWindow) return;
    mainWindow.close();
  });

  ipcMain.handle('window:get-state', (event) => {
    if (!isMainWindowSender(event)) {
      return { isMaximized: false, isNotchMode: false };
    }
    return getWindowState();
  });

  ipcMain.handle('window:enter-notch', (event) => {
    if (!isMainWindowSender(event)) return getWindowState();
    return enterNotchMode();
  });

  ipcMain.handle('window:exit-notch', (event, options) => {
    if (!isMainWindowSender(event)) return getWindowState();
    return exitNotchMode(Boolean(options?.maximize));
  });
}

// Cegah instance kedua membuat server lokal baru saat aplikasi sudah berjalan
// di tray. Membuka shortcut kembali akan memunculkan jendela yang sama.
const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showMainWindow();
  });

  app.whenReady().then(() => {
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.musicflow.desktop');
    }

    registerWindowIpc();
    startLocalServer();
    createWindow();
    createTray();

    app.on('activate', () => {
      showMainWindow();
    });
  });
}

app.on('window-all-closed', () => {
  // Saat close-to-tray aktif, jendela hanya disembunyikan. Jika jendela
  // benar-benar hancur, biarkan tray dan local engine tetap hidup.
  if (!isQuitting && tray) {
    return;
  }

  stopLocalServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  stopLocalServer();
});

// Saat Windows logout/shutdown, jangan tahan jendela di tray.
app.on('session-end', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  if (tray) {
    tray.destroy();
    tray = null;
  }
});
