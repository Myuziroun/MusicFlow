const { app, BrowserWindow, nativeTheme, Tray, Menu, nativeImage } = require('electron');
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

function showMainWindow() {
  if (!app.isReady()) return;

  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
  }

  if (!mainWindow) return;

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
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#000000',
      symbolColor: '#ffffff',
      height: 36
    },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Memperbolehkan streaming audio lokal tanpa blokir CORS
      spellcheck: false, // Mematikan dictionary Chromium (menghemat ~15-20 MB RAM)
      backgroundThrottling: false // Menjaga pemutaran audio di latar belakang tetap stabil
    }
  });

  // Pembersihan cache sesaat saat jendela diminimalkan agar konsumsi RAM turun
  mainWindow.on('minimize', () => {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.session.clearCache().catch(() => {});
    }
  });

  // Close-to-tray: audio tetap berjalan karena renderer tidak dimusnahkan.
  // Jika tray gagal dibuat, close tetap menutup aplikasi seperti biasa.
  mainWindow.on('close', (event) => {
    if (!isQuitting && tray) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

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
    mainWindow = null;
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
