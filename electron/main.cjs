const { app, BrowserWindow, nativeTheme } = require('electron');
const path = require('path');
const { fork } = require('child_process');

// Optimasi Memori & Kestabilan Audio Chromium (Tanpa mengorbankan performa GPU/60fps)
// 1. Matikan Spare Renderer (tab cadangan bawaan Chrome yang tidak terpakai di desktop)
app.commandLine.appendSwitch('disable-features', 'SpareRendererForSitePerProcess');
// 2. Cegah pelambatan timer audio saat aplikasi diminimalkan / berjalan di latar belakang
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
// 3. Batas heap moderat (256 MB) agar Garbage Collector V8 lebih sigap membersihkan memori
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=256');
// 4. Batasi buffer media cache Chromium agar tidak menimbun audio PCM di RAM
app.commandLine.appendSwitch('media-cache-size', '16777216');

// Pastikan tema sistem selalu Dark
if (nativeTheme) {
  nativeTheme.themeSource = 'dark';
}

let serverProcess = null;
let mainWindow = null;

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

app.whenReady().then(() => {
  startLocalServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopLocalServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopLocalServer();
});
