/**
 * Format durasi dalam detik ke bentuk MM:SS atau HH:MM:SS
 * @param seconds - Durasi dalam detik
 * @returns String waktu terformat
 */
export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const formattedSeconds = s < 10 ? `0${s}` : `${s}`;
  
  if (h > 0) {
    const formattedMinutes = m < 10 ? `0${m}` : `${m}`;
    return `${h}:${formattedMinutes}:${formattedSeconds}`;
  }
  
  return `${m}:${formattedSeconds}`;
}

/**
 * Format ukuran file ke representasi yang mudah dibaca (KB, MB, GB)
 * @param bytes - Ukuran file dalam bytes
 * @returns String ukuran terformat
 */
export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

/**
 * Format timestamp ke tanggal lokal
 * @param timestamp - Unix epoch ms
 * @returns Tanggal terformat
 */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Menghasilkan UUID sederhana
 * @returns string ID acak
 */
export function generateId(): string {
  return 'trk_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

/**
 * Konversi string durasi waktu (misal "3:45" atau "1:12:30") ke detik angka
 */
export function parseDurationStringToSeconds(durationStr?: string): number {
  if (!durationStr || typeof durationStr !== 'string') return 0;
  const parts = durationStr.trim().split(':').map((p) => parseInt(p, 10));
  if (parts.some(isNaN)) return 0;

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

/**
 * Bersihkan judul dan nama artis lagu dari noise video YouTube
 * Mendukung format:
 * - "Artis - Judul" (misal: "Alan Walker - Faded")
 * - "Judul - Artis" (misal: "Faded - Alan Walker")
 * - "Judul - Artis [Cover]" (misal: "Bebas - hololive ID [Cover]")
 * - "Artis / Judul" atau "Judul / Artis" (misal: "HALCALI / おつかれSUMMER")
 * - Judul tunggal dengan nama artis dari channel (misal: "Oh! Asmara" | "Kobo Kanaeru - Topic")
 */
export function cleanTrackMetadata(rawTitle: string, rawArtist?: string): { title: string; artist: string } {
  let title = (rawTitle || '').trim();
  let artist = (rawArtist || '').trim();

  // 1. Bersihkan channel suffix umum dari rawArtist
  let cleanedArtist = artist
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/\s*VEVO$/i, '')
    .replace(/\s*Official(\s*Channel)?$/i, '')
    .replace(/\s*Channel$/i, '')
    .replace(/\s*Ch\..*$/i, '')
    .trim();

  // Cek apakah ada indikasi cover di judul keseluruhan
  const isCover = /[\(\[\{【]\s*(cover|歌ってみた|covered\s*by)[\)\]\}】]/i.test(title);

  // 2. Deteksi pemisah (separator) judul
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

      // Cek atribut sebelum membersihkan noise
      const p0HasCover = /[\(\[\{【]\s*(cover|歌ってみた|covered\s*by)[\)\]\}】]/i.test(part0);
      const p1HasCover = /[\(\[\{【]\s*(cover|歌ってみた|covered\s*by)[\)\]\}】]/i.test(part1);

      const p0HasOfficial = /[\(\[\{【]\s*(official|mv|ch|channel)[\)\]\}】]/i.test(part0);
      const p1HasOfficial = /[\(\[\{【]\s*(official|mv|ch|channel)[\)\]\}】]/i.test(part1);

      // Pembersih noise dalam satu bagian
      const cleanNoise = (str: string) =>
        str
          .replace(
            /[\(\[\{【]\s*(official\s*(music\s*)?video|official\s*audio|official|lyrics?|lyric\s*video|audio|remaster(ed)?|hd|4k|hq|visualizer|video\s*clip|klip\s*resmi|mv|full\s*album|live|cover|歌ってみた|covered\s*by)[\)\]\}】]/gi,
            ''
          )
          .replace(/\s*\|\s*[\w\s]+$/i, '')
          .trim();

      const p0Clean = cleanNoise(part0);
      const p1Clean = cleanNoise(part1);

      // Cek kecocokan kata antara channel dan masing-masing bagian
      const artistWords = cleanedArtist
        .toLowerCase()
        .split(/[\s_-]+/)
        .filter((w) => w.length > 2 && w !== 'youtube' && w !== 'music');

      const matchP0 = artistWords.some((w) => p0Clean.toLowerCase().includes(w));
      const matchP1 = artistWords.some((w) => p1Clean.toLowerCase().includes(w));

      if (p1HasCover || p1HasOfficial || matchP1) {
        // Format terbalik: "Judul Lagu - Artis / Penyanyi Cover"
        title = p0Clean;
        artist = p1Clean;
      } else if (p0HasCover || p0HasOfficial || matchP0) {
        // Format normal: "Artis - Judul Lagu"
        artist = p0Clean;
        title = p1Clean;
      } else if (isCover) {
        // Tag cover di luar: standar YouTube adalah "Judul - Penyanyi"
        title = p0Clean;
        artist = p1Clean;
      } else {
        // Default konvensi standar: "Artis - Judul"
        artist = p0Clean;
        title = p1Clean;
      }
    }
  } else {
    // Tidak ada separator dalam judul video
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

  // Bersihkan sisa tag cover jika masih ada di judul atau artis
  title = title.replace(/[\(\[\{【]\s*(cover|歌ってみた|covered\s*by)[\)\]\}】]/gi, '').trim();
  artist = artist.replace(/[\(\[\{【]\s*(cover|歌ってみた|covered\s*by)[\)\]\}】]/gi, '').trim();

  // Pastikan artis tidak kosong atau sekadar "YouTube"
  if (!artist || artist.toLowerCase() === 'youtube') {
    artist = cleanedArtist && cleanedArtist.toLowerCase() !== 'youtube' ? cleanedArtist : 'Artis Tidak Diketahui';
  }

  if (!title) {
    title = rawTitle || 'Lagu Tanpa Judul';
  }

  return { title, artist };
}

/**
 * Ekstrak durasi audio secara akurat dari file Blob menggunakan elemen Audio HTML5
 */
export function getAudioBlobDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(blob);
      const audio = new Audio();
      audio.preload = 'metadata';

      const cleanup = () => {
        audio.removeEventListener('loadedmetadata', onMetadata);
        audio.removeEventListener('error', onError);
        URL.revokeObjectURL(url);
      };

      const onMetadata = () => {
        const sec = Math.round(audio.duration) || 0;
        cleanup();
        resolve(sec);
      };

      const onError = () => {
        cleanup();
        resolve(0);
      };

      audio.addEventListener('loadedmetadata', onMetadata);
      audio.addEventListener('error', onError);
      audio.src = url;
    } catch {
      resolve(0);
    }
  });
}
