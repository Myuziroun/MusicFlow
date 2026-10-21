# AGENTS.md - Pedoman Operasional AI Agent & Konteks Repositori

Dokumen ini adalah sumber kebenaran (*Single Source of Truth*) bagi AI Agent (OpenCode) yang bekerja pada repositori ini. Dokumen disusun secara **modular**:
- **Bagian 1 (Universal)**: Standar perilaku, kualitas kode, dan operasional AI yang dapat diterapkan pada berbagai proyek.
- **Bagian 2 (Konteks Proyek)**: Panduan teknis spesifik repositori ini (perintah, arsitektur, gotcha kritis, dan alur pengujian).

---

# BAGIAN 1: STANDAR OPERASIONAL & KUALITAS AI (UNIVERSAL)

## 1. Pelaksanaan Perintah (Command Execution)
* **Fokus pada Tujuan Utama:** Eksekusi tugas sesuai instruksi eksplisit pengguna. Jangan mengubah arsitektur, alur kerja, atau dependensi inti kecuali diminta secara spesifik.
* **Verifikasi Sebelum Eksekusi:** Selalu periksa struktur direktori dan isi file terkait sebelum memodifikasi kode atau mengeksekusi perintah terminal yang berisiko tinggi.
* **Iterasi Bertahap:** Pecah tugas kompleks menjadi tahapan kecil yang dapat diverifikasi secara mandiri sebelum melangkah ke tahap berikutnya.
* **Penanganan Error Mandiri:** Jika terjadi error pada perintah atau build, analisis log dan lakukan perbaikan langsung maksimal 2 kali sebelum meminta konfirmasi pengguna.

## 2. Manajemen Cakupan & Anti-Overthinking (Scope Management)
* **Prinsip YAGNI (*You Aren't Gonna Need It*):** Jangan menambahkan fitur, pustaka, helper, atau abstraksi tambahan yang tidak diminta.
* **Dilarang Berasumsi pada Hal Kritis:** Jika skema data, endpoint, alur bisnis, atau spesifikasi ambigu, **berhenti dan konfirmasikan** kepada pengguna.
* **Solusi Sederhana & Langsung:** Utamakan pendekatan teknis yang paling sederhana, langsung, dan mudah dipelihara (*maintainable*). Hindari *over-engineering*.
* **Jangan Mengubah yang Tidak Rusak:** Hindari refactoring pada file atau modul di luar konteks penugasan aktif.

## 3. Standar Kode & Prinsip Clean Code
* **Prinsip Dasar:** Terapkan prinsip DRY (*Don't Repeat Yourself*), KISS (*Keep It Simple, Stupid*), dan SOLID secara proporsional.
* **Penamaan yang Bermakna (*Meaningful Naming*):** Gunakan penamaan variabel, fungsi, dan komponen yang deskriptif serta ikuti konvensi bahasa/framework yang aktif.
* **Modularitas & Tanggung Jawab Tunggal:** Satu fungsi hanya mengerjakan satu tugas spesifik. Hindari fungsi monolitik (>40–50 baris jika dapat dipecah secara logis).
* **Kebersihan Kode (*Code Hygiene*):**
  * Hapus kode mati (*dead code* / kode yang di-komen dan tidak terpakai).
  * Bersihkan log debug sementara (`console.log`, `print`, `var_dump`) sebelum menyelesaikan tugas.
  * Hindari *magic numbers* atau *hardcoded strings*; gunakan konstanta atau konfigurasi.
* **Error Handling:** Jangan menelan error tanpa penanganan (*empty catch blocks*). Berikan log atau pesan error yang informatif dan aman.

## 4. Standar Komentar Logika (Code Commenting)
* **Jelaskan "MENGAPA", Bukan "APA":** Tulis komentar untuk mendokumentasikan alasan keputusan logika, batasan bisnis spesifik, atau workaround terhadap isu teknis.
* **Dokumentasi Fungsi:** Cantumkan deskripsi singkat fungsi, parameter (`@param`), dan nilai kembalian (`@returns`) pada API/modul publik.
* **Tag Standar:** Gunakan tag industri: `TODO:` (rencana penambahan), `FIXME:` (butuh perbaikan), dan `NOTE:` (catatan logika krusial).

## 5. Standar Git, Commit & Keamanan Repositori
* **Pemeriksaan Pra-Commit:** Selalu jalankan `git status` dan `git diff` untuk memastikan tidak ada file artefak atau perubahan tidak disengaja yang masuk.
* **Keamanan Kredensial:** DILARANG KERAS melakukan commit pada file sensitif (`.env`, secret token, private key) maupun direktori dependensi (`node_modules/`, `vendor/`).
* **Conventional Commits:** Gunakan format standar industri:
  * `feat:` (fitur baru)
  * `fix:` (perbaikan bug)
  * `docs:` (perubahan dokumentasi)
  * `refactor:` (restrukturisasi kode tanpa mengubah fungsionalitas)
  * `chore:` (konfigurasi build, dependensi, atau perkakas)
* **Atomic Commits:** Kelompokkan commit berdasarkan satu kesatuan kerja logis yang utuh.
* **Tidak menggunakan ikon:** DILARANG KERAS MENULIS README DENGAN IKON, GUNAKAN PENJELASAN YANG PROFESIONAL*

## 6. Standar Dokumentasi (README & Docs)
* Setiap pembaruan dokumentasi harus mencakup: identitas & deskripsi proyek, teknologi utama, fitur berjalan, prasyarat sistem, langkah instalasi/setup, panduan eksekusi (dev/prod), dan gambaran struktur direktori.

## 7. Keamanan & Pengujian
* **Validasi Input:** Selalu validasi dan sanitasi input dari pengguna maupun sumber eksternal.
* **Verifikasi Regresi:** Jalankan pengujian otomatis (unit/integration test) yang relevan setelah melakukan modifikasi kode untuk memastikan tidak terjadi regresi.

## 8. Protokol Pelaporan Terminal (WAJIB DI SETIAP AKHIR RESPONS)
- **INSTRUKSI KRITIS:** Setiap kali selesai melakukan modifikasi kode, file, atau mengeksekusi perintah apa pun, kamu **WAJIB** menutup respons di terminal dengan blok laporan verifikasi berikut tanpa terkecuali, jika memang benar benar telah menerapkan:
> **Status Operasional (AGENTS.md):**
> - [x] Eksekusi sesuai cakupan instruksi (Anti-Overthinking / YAGNI)
> - [x] Standar Clean Code & Komentar Logika diterapkan
> - [x] Keamanan & kebersihan kode (*code hygiene*) terverifikasi
Jika tidak menerapkan tinggal bilang bahwa tidak menerapkan, Tapi tetap mengikutir rule - rule yang telah diberikan

---

