# MusicFlow - Music Player and Downloader

MusicFlow adalah aplikasi pemutar musik dan pengunduh audio YouTube lintas platform (Desktop Windows dan Android). Aplikasi ini dirancang dengan pendekatan Client-First dan Local-Only, di mana seluruh berkas audio, metadata, playlist, dan riwayat pemutaran disimpan secara privat di dalam penyimpanan lokal perangkat pengguna tanpa ketergantungan pada server cloud berbayar.

---

## Teknologi Utama

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Desktop Runtime: Electron, Electron Builder
- Mobile Runtime: Capacitor 6 (Android)
- Basis Data Lokal: Dexie.js (IndexedDB)
- Audio Engine dan Tagging:
  - Komponen Klien: Web Audio API, lamejs, browser-id3-writer, music-metadata-browser
  - Komponen Server Lokal: Node.js, Express, yt-dlp, FFmpeg

---

## Fitur Aplikasi

1. Pemutar Audio Terintegrasi:
   - Panel pemutar bawah (PlayerBar) penuh pada seluruh lebar layar.
   - Antarmuka pemutar layar penuh (Fullscreen Player) dengan visual cover art, pengatur posisi lagu, pengatur volume, mode acak (shuffle), dan pengulangan (repeat).
   - Antrean pemutaran lagu (Queue Management) yang dinamis.
   - Integrasi MediaSession API untuk sinkronisasi kontrol media pada layar kunci perangkat, area notifikasi, dan tombol media keyboard.

2. Manajemen Pustaka dan Playlist:
   - Pembuatan, pembaruan, dan penghapusan playlist kustom.
   - Impor berkas musik lokal dari memori penyimpanan perangkat (mendukung format MP3, M4A, WAV, dan FLAC) beserta ekstraksi metadata ID3 secara otomatis.
   - Fitur pencarian instan berdasarkan judul lagu atau nama artis.
   - Kemampuan penyuntingan informasi metadata lagu secara manual.

3. Pengunduh Audio YouTube:
   - Pencarian lagu langsung melalui kata kunci atau tautan video YouTube.
   - Pilihan bitrate unduhan audio MP3: 128 kbps, 192 kbps, dan 320 kbps.
   - Penanaman cover art resolusi tinggi dan sanitasi metadata cerdas (pembersihan label video resmi, penyesuaian format artis dan judul lagu).
   - Pengoperasian mandiri dengan deteksi otomatis engine lokal pada desktop serta fallback engine publik untuk perangkat mobile.

4. Desain Antarmuka:
   - Tema monokrom hitam dan putih minimalis tanpa aksen warna sistem.
   - Title bar desktop dengan notch tengah dan kontrol jendela kustom: minimize, mode notch, maximize/restore, dan close.
   - Close-to-tray pada desktop: tombol close menyembunyikan jendela ke system tray tanpa menghentikan audio.
   - Mode notch bebas: mini-player selalu di atas, dapat digeser, dan menyediakan kontrol putar/jeda, restore, maximize, serta close.

5. Pemutaran Latar Belakang Android:
   - Foreground service dengan MediaSession native agar audio tetap berjalan saat layar mati atau aplikasi berpindah ke latar belakang.
   - Kontrol putar, jeda, sebelumnya, berikutnya, dan seek melalui notifikasi serta layar kunci.
   - Metadata judul, artis, album, dan cover art tersinkron dengan pemutar di WebView.
   - Cover diambil dari gambar tertanam pada file audio, data URL cover lokal, atau URL thumbnail sebagai fallback.

---

## Prasyarat Sistem

Sebelum melakukan instalasi atau kompilasi dari sumber kode, pastikan sistem telah memenuhi persyaratan berikut:

- Node.js versi 18.0.0 atau lebih baru
- NPM versi 9.0.0 atau lebih baru
- Python 3.10 atau lebih baru dengan modul yt-dlp terpasang (`pip install yt-dlp`)
- FFmpeg terpasang dan terdaftar pada PATH sistem (diperlukan untuk konversi engine lokal desktop)
- Android Studio (hanya jika ingin melakukan kompilasi berkas APK untuk platform Android)

---

## Panduan Instalasi Aplikasi Desktop Windows

Terdapat dua cara untuk memasang dan menjalankan aplikasi MusicFlow pada komputer berbasis Windows:

### Metode 1: Menggunakan Berkas Executable Portabel (Tanpa Instalasi)

Jika proyek sudah dikompilasi atau Anda telah memiliki folder biner terdistribusi:

1. Buka direktori hasil kompilasi:
   ```text
   release\win-unpacked\
   ```
2. Temukan berkas aplikasi:
   ```text
   MusicFlow.exe
   ```
3. Klik dua kali pada `MusicFlow.exe`. Aplikasi akan langsung terbuka dan engine lokal di latar belakang akan otomatis diinisialisasi tanpa memerlukan konfigurasi tambahan.

### Metode 2: Kompilasi dan Pembuatan Installer Resmi Windows (.exe)

Untuk menghasilkan installer mandiri (setup installer) yang dapat dipasang ke sistem operasi:

1. Pasang seluruh dependensi proyek:
   ```bash
   npm install
   ```

2. Jalankan perintah kompilasi aplikasi desktop:
   ```bash
   npm run electron:build
   ```

3. Proses kompilasi akan menghasilkan berkas penginstal di dalam direktori `release/`:
   ```text
   release/MusicFlow Setup 1.0.0.exe
   ```

4. Jalankan berkas `MusicFlow Setup 1.0.0.exe` tersebut:
   - Ikuti panduan wizard instalasi pada layar.
   - Tentukan direktori tujuan instalasi (opsional).
   - Installer akan secara otomatis membuat pintasan (shortcut) pada Desktop dan Start Menu Windows.
   - Setelah selesai, buka MusicFlow dari Start Menu atau Desktop.

### Metode 3: Menjalankan Desktop dalam Mode Pengembangan (Development)

Untuk menjalankan aplikasi desktop secara langsung selama proses modifikasi kode:

```bash
npm run electron:dev
```

Perintah ini akan menjalankan server pengembangan Vite bersamaan dengan Electron window secara bersamaan.

### Perilaku Jendela Desktop

- Title bar desktop menggunakan kontrol kustom. Tombol minimize memakai minimize taskbar normal, sedangkan maximize memakai maximize Windows normal, bukan true fullscreen.
- Tombol notch di tengah title bar mengubah jendela menjadi mini-player berukuran 380x64 yang selalu di atas, dapat digeser, dan tidak ditampilkan di taskbar.
- Mode notch menyediakan kontrol putar/jeda, restore ke ukuran dan keadaan jendela sebelumnya, maximize, dan close. Audio tetap berjalan karena player dan audio tidak di-unmount.
- Tombol close selalu menyembunyikan jendela ke system tray, baik dari mode normal maupun mode notch. Audio dan local engine tetap berjalan.
- Klik ikon tray atau pilih menu `Buka MusicFlow` untuk keluar dari mode notch dan menampilkan kembali jendela pada ukuran serta keadaan sebelumnya.
- Tombol minimize tetap meminimalkan jendela ke taskbar seperti biasa.
- Pilih menu `Keluar` pada tray untuk menghentikan aplikasi dan local engine sepenuhnya.
- Membuka shortcut aplikasi saat jendela tersembunyi akan memunculkan instance yang sama, bukan membuat instance baru.
- Tombol media keyboard (play/pause, next, previous) ditangani melalui MediaSession Chromium dan tetap aktif saat jendela disembunyikan maupun dalam mode notch.
- Kontrol jendela kustom menggantikan overlay native. Konsekuensinya, hover Snap Layouts Windows 11 pada tombol maximize tidak tersedia, tetapi maximize dan restore normal tetap berfungsi.
- Aksen warna border jendela Windows dinonaktifkan agar tampilan antarmuka tetap monokrom.

---

## Panduan Menjalankan Versi Web (Browser)

Jika ingin menjalankan aplikasi sebagai antarmuka web murni:

1. Jalankan engine backend lokal pada terminal pertama:
   ```bash
   npm run server
   ```
   Server backend akan aktif pada `http://localhost:3001`.

2. Jalankan server pengembangan antarmuka web pada terminal kedua:
   ```bash
   npm run dev
   ```
   Akses antarmuka aplikasi melalui peramban web pada alamat `http://localhost:5173`.

---

## Panduan Kompilasi untuk Android (.apk)

1. Kompilasi aset frontend:
   ```bash
   npm run build
   ```

2. Sinkronisasikan aset ke proyek native Android:
   ```bash
   npm run cap:sync
   ```

3. Buka proyek native di Android Studio:
   ```bash
   npm run cap:open
   ```

4. Di dalam Android Studio:
   - Hubungkan perangkat fisik Android melalui USB Debugging atau gunakan Android Emulator.
   - Pilih menu `Build` lalu `Build Bundle(s) / APK(s)` lalu `Build APK(s)`.
   - Berkas APK siap dipasang pada perangkat Android.

5. Catatan pemutaran latar belakang:
   - Pada beberapa perangkat, sistem dapat menghentikan foreground service karena kebijakan optimasi baterai. Buka pengaturan aplikasi MusicFlow, lalu pilih opsi tanpa batasan atau nonaktifkan optimasi baterai untuk aplikasi ini.
   - Jika kontrol pemutaran tidak muncul di notifikasi pada Android 13 ke atas, pastikan izin notifikasi untuk MusicFlow aktif.
   - Cover yang tertanam di file MP3 tetap tampil tanpa koneksi internet. Cover yang hanya tersedia sebagai URL thumbnail memerlukan koneksi saat pertama kali dimuat.

---

## Struktur Direktori

```text
├── android/                  # Proyek native Android (Capacitor)
├── electron/                 # Konfigurasi dan entry point Electron Desktop
│   ├── main.cjs              # Lifecycle window, tray, mode notch, dan spawn engine lokal
│   └── preload.cjs           # Bridge IPC kontrol jendela ke renderer
├── server/                   # Local Engine backend (Express, yt-dlp, FFmpeg)
│   └── index.mjs             # Endpoint API pencarian, pengunduhan, dan konversi
├── src/
│   ├── components/
│   │   ├── downloader/       # Komponen pencarian YouTube dan antrean unduhan
│   │   ├── layout/           # Navbar, Sidebar, BottomNav, TitleBar, dan NotchMode
│   │   ├── library/          # Pengelolaan daftar lagu, playlist, dan modal impor
│   │   └── player/           # Bar pemutar audio, pemutar layar penuh, dan modal antrean
│   ├── context/
│   │   ├── DesktopWindowContext.tsx # Sinkronisasi state maximize dan mode notch
│   │   ├── LibraryContext.tsx # Manajemen state koleksi lagu dan basis data IndexedDB
│   │   └── PlayerContext.tsx # Logika pemutaran audio dan sinkronisasi MediaSession
│   ├── db/
│   │   └── database.ts       # Skema dan inisialisasi IndexedDB (Dexie)
│   ├── services/
│   │   ├── audioConverter.ts # Utilitas konversi audio dan penulisan tag ID3
│   │   ├── fileStorage.ts    # Abstraksi penyimpanan berkas (Web dan Capacitor)
│   │   ├── mediaSession.ts   # Integrasi notifikasi dan kontrol media sistem operasi
│   │   └── youtubeService.ts # Layanan pencarian dan pengunduhan YouTube
│   ├── types/
│   │   └── music.ts          # Definisi tipe data TypeScript
│   ├── utils/
│   │   └── formatters.ts     # Format durasi, ukuran berkas, dan sanitasi metadata
│   ├── App.tsx               # Tata letak utama antarmuka
│   ├── index.css             # Konfigurasi Tailwind CSS dan gaya global
│   └── main.tsx              # Entry point aplikasi React
├── capacitor.config.ts       # Konfigurasi runtime Capacitor
├── electron-builder.json     # Konfigurasi packaging aplikasi desktop Windows
├── tailwind.config.js        # Konfigurasi tema monokrom
├── tsconfig.json             # Konfigurasi compiler TypeScript
├── vite.config.ts            # Konfigurasi bundling Vite
└── package.json              # Daftar dependensi dan skrip eksekusi proyek
```

---

## Lisensi dan Kebijakan

Aplikasi ini dikembangkan untuk tujuan edukasi dan penggunaan personal. Pengguna bertanggung jawab penuh atas materi audio yang diunduh sesuai dengan ketentuan layanan pihak terkait dan peraturan hak cipta yang berlaku.
