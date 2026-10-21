import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Direktori penyimpanan file hasil unduhan
const DOWNLOADS_DIR = process.env.DOWNLOADS_DIR || path.join(
  process.env.APPDATA || process.env.HOME || path.join(__dirname, '..'),
  'MusicFlow',
  'downloads'
);
try {
  if (!fs.existsSync(DOWNLOADS_DIR)) {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('Gagal membuat DOWNLOADS_DIR:', e.message);
}

app.use(cors());
app.use(express.json());

// Path executable Python & FFmpeg
const PYTHON_PATH = 'C:\\Users\\Lenovo\\AppData\\Local\\Python\\bin\\python.exe';
const FFMPEG_DIR = 'D:\\download\\ffmpeg\\bin';

/**
 * Pembersih metadata judul & artis dari kebisingan YouTube
 */
function cleanMetadata(rawTitle, rawArtist) {
  let title = (rawTitle || '').trim();
  let artist = (rawArtist || '').trim();

  // 1. Bersihkan channel suffix YouTube
  let cleanedArtist = artist
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/\s*VEVO$/i, '')
    .replace(/\s*Official(\s*Channel)?$/i, '')
    .replace(/\s*Channel$/i, '')
    .replace(/\s*Ch\..*$/i, '')
    .trim();

  const isCover = /[\(\[\{【]\s*(cover|歌ってみた|covered\s*by)[\)\]\}】]/i.test(title);

  // 2. Deteksi separator: ' - ', ' / ', ' // ', ' | '
  let separator = '';
  if (title.includes(' - ')) separator = ' - ';
  else if (title.includes(' / ')) separator = ' / ';
  else if (title.includes(' // ')) separator = ' // ';
  else if (title.includes(' | ')) separator = ' | ';

  if (separator) {
    const rawParts = title.split(separator).map((p) => p.trim()).filter(Boolean);
    if (rawParts.length >= 2) {
      const part0 = rawParts[0];
      const part1 = rawParts.slice(1).join(separator).trim();

      const p0HasCover = /[\(\[\{【]\s*(cover|歌ってみた|covered\s*by)[\)\]\}】]/i.test(part0);
      const p1HasCover = /[\(\[\{【]\s*(cover|歌ってみた|covered\s*by)[\)\]\}】]/i.test(part1);

      const p0HasOfficial = /[\(\[\{【]\s*(official|mv|ch|channel)[\)\]\}】]/i.test(part0);
      const p1HasOfficial = /[\(\[\{【]\s*(official|mv|ch|channel)[\)\]\}】]/i.test(part1);

      const cleanNoise = (str) =>
        str
          .replace(
            /[\(\[\{【]\s*(official\s*(music\s*)?video|official\s*audio|official|lyrics?|lyric\s*video|audio|remaster(ed)?|hd|4k|hq|visualizer|video\s*clip|klip\s*resmi|mv|full\s*album|live|cover|歌ってみた|covered\s*by)[\)\]\}】]/gi,
            ''
          )
          .replace(/\s*\|\s*[\w\s]+$/i, '')
          .trim();

      const p0Clean = cleanNoise(part0);
      const p1Clean = cleanNoise(part1);

      const artistWords = cleanedArtist
        .toLowerCase()
        .split(/[\s_-]+/)
        .filter((w) => w.length > 2 && w !== 'youtube' && w !== 'music');

      const matchP0 = artistWords.some((w) => p0Clean.toLowerCase().includes(w));
      const matchP1 = artistWords.some((w) => p1Clean.toLowerCase().includes(w));

      if (p1HasCover || p1HasOfficial || matchP1) {
        title = p0Clean;
        artist = p1Clean;
      } else if (p0HasCover || p0HasOfficial || matchP0) {
        artist = p0Clean;
        title = p1Clean;
      } else if (isCover) {
        title = p0Clean;
        artist = p1Clean;
      } else {
        artist = p0Clean;
        title = p1Clean;
      }
    }
  } else {
    title = title
      .replace(
        /[\(\[\{【]\s*(official\s*(music\s*)?video|official\s*audio|official|lyrics?|lyric\s*video|audio|remaster(ed)?|hd|4k|hq|visualizer|video\s*clip|klip\s*resmi|mv|full\s*album|live|cover|歌ってみた|covered\s*by)[\)\]\}】]/gi,
        ''
      )
      .replace(/\s*\|\s*[\w\s]+$/i, '')
      .trim();

    if (cleanedArtist && cleanedArtist.toLowerCase() !== 'youtube') {
      artist = cleanedArtist;
    }
  }

  title = title.replace(/[\(\[\{【]\s*(cover|歌ってみた|covered\s*by)[\)\]\}】]/gi, '').trim();
  artist = artist.replace(/[\(\[\{【]\s*(cover|歌ってみた|covered\s*by)[\)\]\}】]/gi, '').trim();

  if (!artist || artist.toLowerCase() === 'youtube') {
    artist = cleanedArtist && cleanedArtist.toLowerCase() !== 'youtube' ? cleanedArtist : 'Artis Tidak Diketahui';
  }

  if (!title) {
    title = rawTitle || 'Lagu Tanpa Judul';
  }

  return { title, artist };
}

/**
 * Cek status server dan dependensi yt-dlp serta ffmpeg
 */
app.get('/api/status', (req, res) => {
  res.json({
    ok: true,
    message: 'Music Listener Local Engine aktif',
    downloadsDir: DOWNLOADS_DIR,
    timestamp: Date.now()
  });
});

/**
 * Cari video/musik di YouTube atau ekstrak info dari direct link
 * Query parameter: ?q=judul_lagu_atau_url
 */
app.get('/api/search', async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: 'Parameter pencarian (q) wajib diisi' });
  }

  const trimmedQuery = query.toString().trim();
  const isUrl = /^https?:\/\//i.test(trimmedQuery) || /youtu\.?be/i.test(trimmedQuery);

  const searchArgs = isUrl
    ? ['-m', 'yt_dlp', trimmedQuery, '--dump-json', '--no-playlist', '--no-warnings']
    : ['-m', 'yt_dlp', `ytsearch10:${trimmedQuery}`, '--flat-playlist', '--dump-json', '--no-warnings'];

  const proc = spawn(PYTHON_PATH, searchArgs);
  let stdout = '';
  let stderr = '';

  proc.stdout.on('data', (data) => {
    stdout += data.toString();
  });

  proc.stderr.on('data', (data) => {
    stderr += data.toString();
  });

  proc.on('close', (code) => {
    if (code !== 0 && !stdout) {
      return res.status(500).json({ error: 'Gagal melakukan pencarian', details: stderr });
    }

    const lines = stdout.trim().split('\n').filter(Boolean);
    const results = [];

    for (const line of lines) {
      try {
        const item = JSON.parse(line);
        let thumbnail = '';
        if (item.thumbnails && item.thumbnails.length > 0) {
          thumbnail = item.thumbnails[item.thumbnails.length - 1].url;
        } else {
          thumbnail = `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`;
        }

        const rawChannel = item.uploader || item.channel || '';
        const { title: cleanTitle, artist: cleanArtist } = cleanMetadata(item.title, rawChannel);

        results.push({
          id: item.id,
          title: cleanTitle,
          artist: cleanArtist,
          duration: Math.round(Number(item.duration)) || 0,
          durationFormatted: item.duration_string || '0:00',
          thumbnail,
          url: item.webpage_url || item.url || `https://www.youtube.com/watch?v=${item.id}`
        });
      } catch (e) {
        // Abaikan parse error per baris jika ada banner
      }
    }

    res.json({ results });
  });
});

/**
 * Download lagu dari YouTube dan konversi otomatis ke .mp3
 * Mengambil nama asli lagu dan artis dari sumber YouTube
 */
app.post('/api/download', async (req, res) => {
  const { url, bitrate = 192, title, artist } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL YouTube wajib diisi' });
  }

  const fileId = 'track_' + Date.now();
  const outputTemplate = path.join(DOWNLOADS_DIR, `${fileId}.%(ext)s`);

  const downloadArgs = [
    '-m', 'yt_dlp',
    '--no-simulate',
    '-x',
    '--audio-format', 'mp3',
    '--audio-quality', `${bitrate}K`,
    '--ffmpeg-location', FFMPEG_DIR,
    '--embed-thumbnail',
    '--add-metadata',
    '--print', 'after_move:METADATA:%(title)s|||%(uploader)s|||%(duration)s|||%(thumbnail)s|||%(filepath)s',
    '-o', outputTemplate,
    url
  ];

  const proc = spawn(PYTHON_PATH, downloadArgs);

  let stderr = '';
  let finalFileName = '';
  let actualFilePath = '';
  let realTitle = title || '';
  let realArtist = artist || '';
  let realDuration = 0;
  let realThumbnail = '';

  proc.stdout.on('data', (data) => {
    const text = data.toString();

    // Ekstrak metadata asli & path file hasil konversi dari yt-dlp
    const metaMatch = text.match(/METADATA:(.+?)\|\|\|(.+?)\|\|\|(.+?)\|\|\|(.+?)\|\|\|(.+)/);
    if (metaMatch) {
      if (metaMatch[1].trim()) realTitle = metaMatch[1].trim();
      if (metaMatch[2].trim()) realArtist = metaMatch[2].trim();
      realDuration = parseInt(metaMatch[3].trim(), 10) || 0;
      realThumbnail = metaMatch[4].trim();
      if (metaMatch[5].trim()) {
        actualFilePath = metaMatch[5].trim();
        finalFileName = path.basename(actualFilePath);
      }
    }

    const destMatch = text.match(/Destination:\s*(.+?\.mp3)/);
    if (destMatch && !finalFileName) {
      finalFileName = path.basename(destMatch[1].trim());
    }
  });

  proc.stderr.on('data', (data) => {
    stderr += data.toString();
  });

  proc.on('close', (code) => {
    const fallbackPath = path.join(DOWNLOADS_DIR, `${fileId}.mp3`);
    const resolvedPath = actualFilePath && fs.existsSync(actualFilePath)
      ? actualFilePath
      : finalFileName && fs.existsSync(path.join(DOWNLOADS_DIR, finalFileName))
      ? path.join(DOWNLOADS_DIR, finalFileName)
      : fs.existsSync(fallbackPath)
      ? fallbackPath
      : null;

    if (!resolvedPath || (code !== 0 && !resolvedPath)) {
      return res.status(500).json({
        error: 'Gagal mengunduh atau mengonversi video ke MP3',
        details: stderr
      });
    }

    const actualFile = path.basename(resolvedPath);
    let fileSize = 0;
    try {
      fileSize = fs.statSync(resolvedPath).size;
    } catch (e) {
      // Abaikan jika stat gagal
    }

    const meta = cleanMetadata(realTitle || title || '', realArtist || artist || '');

    res.json({
      success: true,
      fileId,
      fileName: actualFile,
      downloadUrl: `/api/files/${actualFile}`,
      fileSize,
      title: meta.title || 'Lagu Terunduh',
      artist: meta.artist || 'Artis Tidak Diketahui',
      duration: realDuration,
      thumbnail: realThumbnail
    });
  });
});

/**
 * Endpoint streaming / download file MP3 yang telah terkonversi
 */
app.get('/api/files/:filename', (req, res) => {
  const safeFilename = path.basename(req.params.filename);
  const filePath = path.join(DOWNLOADS_DIR, safeFilename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File tidak ditemukan' });
  }

  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Accept-Ranges', 'bytes');
  res.sendFile(filePath);
});

// Jalankan server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Music Engine] Berjalan di http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[Music Engine Error] Port ${PORT} sudah digunakan oleh proses lain.`);
    console.error(`Untuk membebaskan port ini di Windows PowerShell, jalankan:`);
    console.error(`Get-NetTCPConnection -LocalPort ${PORT} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }\n`);
    process.exit(1);
  } else {
    console.error('[Music Engine Error]', err);
  }
});
