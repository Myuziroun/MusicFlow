# MusicFlow - Music Listener & YouTube Downloader (.mp3)

Aplikasi pemutar musik modern dan pengunduh audio YouTube otomatis terkonversi ke format `.mp3`. Dirancang dengan pendekatan **Client-First / Local-Only** sehingga semua musik, playlist, dan riwayat disimpan secara privat langsung di memori perangkat masing-masing (HP Android atau PC/Laptop) tanpa membutuhkan sewa server eksternal berbayar.

---

## 🌟 Fitur Utama

1. **Pemutar Musik Lengkap (Audio Player):**
   - Mini Player bar di bagian bawah (Desktop & Mobile).
   - Fullscreen Player modal dengan cover art album, seekbar interaktif, volume, shuffle, dan mode pengulangan (Repeat Off / All / One).
   - Antrean lagu (*Playback Queue*) yang dapat dipantau dan dikelola langsung.
   - Dukungan **MediaSession API**: Kontrol pemutaran otomatis terhubung ke **Lockscreen HP**, bar notifikasi Android, dan tombol media keyboard PC.

2. **Manajemen Playlist & Koleksi Pribadi:**
   - Buat, edit nama, dan hapus playlist custom (termasuk playlist bawaan "Lagu Favorit").
   - Tambahkan dan hapus lagu dari playlist dengan mudah.
   - Pencarian instan lagu berdasarkan judul atau artis.
   - **Import Musik Lokal**: Dapat memilih langsung file audio (`.mp3`, `.m4a`, `.wav`, `.flac`) yang sudah ada di memori internal HP atau komputer. Metadata ID3 (judul, artis, album, dan cover) diekstrak otomatis.

3. **YouTube Downloader & Konversi Otomatis ke MP3:**
   - Cari lagu langsung via judul/artis atau tempel URL video YouTube.
   - Pilihan bitrate audio MP3: **128 kbps**, **192 kbps (Rekomendasi)**, atau **320 kbps (Ultra HD)**.
   - Thumbnail YouTube otomatis dijadikan Cover Art MP3 dan metadata channel dijadikan nama artis.
   - Widget antrean unduhan (*Download Queue*) dengan indikator status riil (Mengunduh -> Mengonversi -> Selesai).

4. **Multi-Platform (Mobile & Desktop):**
   - **Mobile (Android):** Layout mobile-first responsif dengan Bottom Navigation Bar, Touch Gestures, dan siap di-build menjadi file **.apk native** via **Capacitor**.
   - **Desktop:** Sidebar navigasi modern mirip Spotify/Apple Music, dapat diakses via Web Browser maupun dijadikan Desktop App.

---

## 🛠️ Arsitektur & Teknologi

* **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, Lucide React Icons.
* **Database Offline:** Dexie.js (IndexedDB) untuk penyimpanan metadata lagu dan file blob musik tanpa internet.
* **Mobile Runtime:** Capacitor 6 (Android native bridge & Filesystem plugin).
* **Audio Engine & Tagger:**
  * Client-side: `@breezystack/lamejs` + `browser-id3-writer` + Web Audio API.
  * Desktop Engine: Node.js (Express) + `yt-dlp` + `FFmpeg`.

---

## 🚀 Panduan Menjalankan Aplikasi

### 1. Prasyarat Sistem
* **Node.js** (v18 ke atas)
* **Python** dengan paket `yt-dlp` (`pip install yt-dlp`)
* **FFmpeg** (telah terpasang pada PATH sistem)

### 2. Instalasi Dependensi
```bash
npm install
```

### 3. Menjalankan di Desktop (Web)
Buka 2 tab terminal:

* **Terminal 1 (Jalankan Engine Downloader YouTube):**
  ```bash
  npm run server
  ```
  *Engine akan aktif di port `http://localhost:3001`.*

* **Terminal 2 (Jalankan Antarmuka Web/Frontend):**
  ```bash
  npm run dev
  ```
  *Buka browser di `http://localhost:5173`.*

---

## 📱 Membangun untuk Android (.apk)

Proyek ini telah dikonfigurasi penuh dengan **Capacitor Android**:

1. **Build asset frontend:**
   ```bash
   npm run build
   ```

2. **Sinkronisasi ke direktori Android:**
   ```bash
   npm run cap:sync
   ```

3. **Buka project di Android Studio:**
   ```bash
   npm run cap:open
   ```
   *Dari Android Studio, Anda dapat langsung menghubungkan HP Android via kabel USB / USB Debugging untuk menginstall aplikasi secara langsung atau mengekspor file `.apk` (Build -> Build Bundle(s) / APK(s) -> Build APK(s)).*

---

## 📁 Struktur Direktori

```text
├── android/                  # Proyek native Android (Capacitor)
├── server/                   # Local Engine (Express, yt-dlp, FFmpeg)
│   └── index.mjs             # API /api/search, /api/download, /api/files
├── src/
│   ├── components/
│   │   ├── downloader/       # Komponen pencarian YouTube & Download queue
│   │   ├── layout/           # Navbar, Sidebar, BottomNav
│   │   ├── library/          # TrackList, PlaylistList, ImportModal, dll.
│   │   └── player/           # PlayerBar, FullscreenPlayer, QueueModal
│   ├── context/
│   │   ├── LibraryContext.tsx# State manajemen lagu & playlist (Dexie.js)
│   │   └── PlayerContext.tsx # Audio playback engine & MediaSession
│   ├── db/
│   │   └── database.ts       # Skema IndexedDB (Dexie)
│   ├── services/
│   │   ├── audioConverter.ts # Konversi Web Audio ke MP3 & ID3 tagging
│   │   ├── fileStorage.ts    # Unified Web/Capacitor file storage
│   │   ├── mediaSession.ts   # Integrasi Lockscreen & Notifikasi OS
│   │   └── youtubeService.ts # Client API YouTube downloader
│   ├── types/
│   │   └── music.ts          # Definisi TypeScript Track & Playlist
│   ├── App.tsx
│   └── main.tsx
├── capacitor.config.ts       # Konfigurasi Capacitor Android
├── tailwind.config.js
└── package.json
```
