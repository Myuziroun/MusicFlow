import type { YouTubeSearchResult } from '../types/music';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { cleanTrackMetadata, parseDurationStringToSeconds } from '../utils/formatters';

/**
 * Service untuk mencari dan mengunduh musik dari YouTube
 * Mendukung deteksi otomatis Server Engine Lokal (PC) serta fallback langsung ke Public Engine (Mobile/Standalone).
 */
export class YouTubeService {
  private static serverBaseUrl = 'http://localhost:3001';

  /**
   * Cek apakah server backend lokal sedang menyala
   */
  static async isLocalEngineAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.serverBaseUrl}/api/status`, {
        signal: AbortSignal.timeout(1500)
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Cari musik di YouTube berdasarkan query atau URL
   * @param query Judul lagu atau URL YouTube
   * @returns List hasil pencarian
   */
  static async search(query: string): Promise<YouTubeSearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    // 1. Coba lewat Local Engine terlebih dahulu jika menyala
    const hasLocalEngine = await this.isLocalEngineAvailable();
    if (hasLocalEngine) {
      try {
        const res = await fetch(`${this.serverBaseUrl}/api/search?q=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.results && data.results.length > 0) {
            return data.results.map((r: YouTubeSearchResult) => {
              const meta = cleanTrackMetadata(r.title, r.artist);
              return {
                ...r,
                title: meta.title,
                artist: meta.artist
              };
            });
          }
        }
      } catch (err) {
        console.warn('Gagal memanggil search local engine:', err);
      }
    }

    // Jika user memasukkan langsung URL video youtube:
    const videoIdMatch = trimmed.match(/(?:v=|\/embed\/|youtu\.be\/|\/v\/|\/shorts\/)([a-zA-Z0-9_-]{11})/);
    if (videoIdMatch) {
      const id = videoIdMatch[1];
      let rawTitle = `YouTube Video (${id})`;
      let rawArtist = '';
      let thumbnail = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`;
        if (Capacitor.isNativePlatform()) {
          const res = await CapacitorHttp.get({ url: oembedUrl });
          const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
          if (data?.title) rawTitle = data.title;
          if (data?.author_name) rawArtist = data.author_name;
          if (data?.thumbnail_url) thumbnail = data.thumbnail_url;
        } else {
          const res = await fetch(oembedUrl);
          if (res.ok) {
            const data = await res.json();
            if (data?.title) rawTitle = data.title;
            if (data?.author_name) rawArtist = data.author_name;
            if (data?.thumbnail_url) thumbnail = data.thumbnail_url;
          }
        }
      } catch (e) {
        console.warn('Gagal fetch metadata oEmbed:', e);
      }

      const meta = cleanTrackMetadata(rawTitle, rawArtist);

      return [{
        id,
        title: meta.title,
        artist: meta.artist,
        duration: 0,
        durationFormatted: 'Link Video',
        thumbnail,
        url: `https://www.youtube.com/watch?v=${id}`
      }];
    }

    // 2. Fallback: Search via YouTube Innertube API (Client-side langsung tanpa server)
    try {
      const res = await fetch('https://www.youtube.com/youtubei/v1/search?prettyPrint=false', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: {
            client: {
              clientName: 'WEB',
              clientVersion: '2.20240101.00.00',
              hl: 'id',
              gl: 'ID'
            }
          },
          query: trimmed
        })
      });

      if (res.ok) {
        const data = await res.json();
        const sectionList = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
        const itemSection = sectionList[0]?.itemSectionRenderer?.contents || [];
        
        const results: YouTubeSearchResult[] = [];
        for (const item of itemSection) {
          const v = item.videoRenderer;
          if (v && v.videoId) {
            const rawTitle = v.title?.runs?.[0]?.text || 'No Title';
            const rawArtist = v.ownerText?.runs?.[0]?.text || v.shortBylineText?.runs?.[0]?.text || '';
            const durationFormatted = v.lengthText?.simpleText || '0:00';
            const duration = parseDurationStringToSeconds(durationFormatted);
            const { title, artist } = cleanTrackMetadata(rawTitle, rawArtist);
            
            // Thumbnail
            let thumbnail = `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`;
            if (v.thumbnail?.thumbnails?.length > 0) {
              thumbnail = v.thumbnail.thumbnails[v.thumbnail.thumbnails.length - 1].url;
            }

            results.push({
              id: v.videoId,
              title,
              artist,
              duration,
              durationFormatted,
              thumbnail,
              url: `https://www.youtube.com/watch?v=${v.videoId}`
            });
          }
        }
        return results;
      }
    } catch (err) {
      console.warn('Fallback search Innertube gagal:', err);
    }

    return [];
  }

  /**
   * Request unduh dan konversi MP3.
   * Secara otomatis menggunakan Local Engine (jika tersedia),
   * atau beralih ke Public Engine jika berjalan di Mobile / Standalone.
   * @param youtubeUrl URL YouTube
   * @param bitrate Bitrate target
   * @param title Judul lagu
   * @param artist Artis lagu
   * @returns Data blob MP3 hasil konversi
   */
  static async downloadAndConvert(
    youtubeUrl: string,
    bitrate: 128 | 192 | 320 = 192,
    title?: string,
    artist?: string
  ): Promise<{
    blob: Blob;
    fileName: string;
    fileSize: number;
    title: string;
    artist: string;
    duration: number;
    thumbnail?: string;
  }> {
    const hasLocalEngine = await this.isLocalEngineAvailable();

    // Skenario 1: Local Engine (PC / Laptop / Electron) aktif
    if (hasLocalEngine) {
      try {
        const res = await fetch(`${this.serverBaseUrl}/api/download`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: youtubeUrl, bitrate, title, artist })
        });

        if (res.ok) {
          const data = await res.json();
          const meta = cleanTrackMetadata(data.title || title || '', data.artist || artist || '');
          const downloadFileUrl = `${this.serverBaseUrl}${data.downloadUrl}`;
          const fileRes = await fetch(downloadFileUrl);
          if (fileRes.ok) {
            const blob = await fileRes.blob();
            return {
              blob,
              fileName: data.fileName,
              fileSize: blob.size || data.fileSize,
              title: meta.title,
              artist: meta.artist,
              duration: data.duration || 0,
              thumbnail: data.thumbnail
            };
          }
        }
      } catch (err) {
        console.warn('Local engine download gagal, beralih ke Public Engine fallback:', err);
      }
    }

    // Skenario 2: Mobile Android / Standalone (Gunakan Public Engine Fallback)
    return await this.downloadViaPublicEngine(youtubeUrl, bitrate, title, artist);
  }

  /**
   * Unduh dan konversi audio lewat Public Extraction Engine (untuk Mobile/Standalone)
   */
  private static async downloadViaPublicEngine(
    youtubeUrl: string,
    _bitrate: 128 | 192 | 320 = 192,
    title?: string,
    artist?: string
  ): Promise<{
    blob: Blob;
    fileName: string;
    fileSize: number;
    title: string;
    artist: string;
    duration: number;
    thumbnail?: string;
  }> {
    // 1. Ekstraksi ID video dari URL atau input mentah
    const idMatch = youtubeUrl.match(/(?:v=|\/embed\/|youtu\.be\/|\/v\/|\/shorts\/|^)([a-zA-Z0-9_-]{11})(?:[&?]|$)/);
    const videoId = idMatch ? idMatch[1] : youtubeUrl.trim();

    if (!videoId) {
      throw new Error('ID video YouTube tidak valid');
    }

    const defaultHeaders = {
      'Referer': 'https://convertytmp3.org/',
      'Origin': 'https://convertytmp3.org',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };

    const makeGetRequest = async (url: string, headers: Record<string, string> = defaultHeaders) => {
      if (Capacitor.isNativePlatform()) {
        const res = await CapacitorHttp.get({
          url,
          headers,
          connectTimeout: 10000,
          readTimeout: 10000
        });
        return typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      } else {
        const res = await fetch(url, { headers });
        return await res.json();
      }
    };

    // 2. Dapatkan API Key (dengan fallback kunci default terverifikasi)
    const DEFAULT_API_KEY = 'ytmp3_0e54c87af0e7951af060df4bfde2ecba82d0f022592d18b8ca4a0ddec43b43f5';
    let apiKey = DEFAULT_API_KEY;
    try {
      if (!Capacitor.isNativePlatform()) {
        const pageRes = await fetch('https://convertytmp3.org/', { headers: defaultHeaders, signal: AbortSignal.timeout(2000) });
        if (pageRes.ok) {
          const html = await pageRes.text();
          const match = html.match(/var apiKey=['"]([^'"]+)['"]/);
          if (match && match[1]) apiKey = match[1];
        }
      }
    } catch {
      // Gunakan fallback default key
    }

    // 3. Autentikasi sesi konversi ke engine publik
    const authUrl = `https://epsilon.epsiloncloud.org/api/v1/auth?api_key=${apiKey}&_=${Date.now()}`;
    const authData = await makeGetRequest(authUrl);
    if (!authData || !authData.key) {
      throw new Error('Gagal melakukan autentikasi dengan server konversi publik.');
    }

    // 4. Inisialisasi job konversi
    const initUrl = `https://epsilon.epsiloncloud.org/api/v1/init?_=${Date.now()}`;
    const initData = await makeGetRequest(initUrl, {
      ...defaultHeaders,
      'Authorization': `Bearer ${authData.key}`
    });
    if (!initData || !initData.convertURL) {
      throw new Error('Server publik gagal menginisialisasi sesi konversi.');
    }

    // 5. Kirim perintah konversi video ke MP3
    const convertUrl = `${initData.convertURL}&v=${videoId}&f=mp3&_=${Date.now()}`;
    let convData = await makeGetRequest(convertUrl);

    if (convData?.redirect === 1 && convData?.redirectURL) {
      convData = await makeGetRequest(convData.redirectURL);
    }

    if (!convData) {
      throw new Error('Server publik gagal memproses link video YouTube.');
    }

    let downloadUrl = convData.downloadURL || '';
    let finalTitle = convData.title || title || 'Audio';
    const finalThumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    const finalDuration = 0;

    // 6. Polling status progres konversi hingga selesai
    if (convData.progressURL) {
      for (let i = 0; i < 25; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        try {
          const pData = await makeGetRequest(`${convData.progressURL}&_=${Date.now()}`);
          if (pData) {
            if (pData.title) finalTitle = pData.title;
            if (pData.progress >= 3 || convData.downloadURL) {
              if (!downloadUrl && convData.downloadURL) {
                downloadUrl = convData.downloadURL;
              }
              if (pData.progress >= 3) break;
            }
          }
        } catch (pollErr) {
          console.warn('Polling progress error:', pollErr);
        }
      }
    }

    if (!downloadUrl) {
      throw new Error('Proses konversi audio di server publik melebihi batas waktu (timeout). Silakan coba lagi.');
    }

    // 7. Unduh file fisik MP3 hasil konversi
    const downloadTarget = downloadUrl.includes('&v=')
      ? downloadUrl
      : `${downloadUrl}&v=${videoId}&f=mp3&r=convertytmp3.org`;

    let blob: Blob;
    if (Capacitor.isNativePlatform()) {
      try {
        const audioRes = await CapacitorHttp.get({
          url: downloadTarget,
          responseType: 'blob',
          headers: defaultHeaders,
          connectTimeout: 20000,
          readTimeout: 60000
        });

        if (audioRes.data instanceof Blob) {
          blob = audioRes.data;
        } else if (typeof audioRes.data === 'string') {
          const cleanBase64 = audioRes.data.includes(',') ? audioRes.data.split(',')[1] : audioRes.data;
          const binary = atob(cleanBase64);
          const array = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            array[i] = binary.charCodeAt(i);
          }
          blob = new Blob([array], { type: 'audio/mpeg' });
        } else {
          const rawRes = await fetch(downloadTarget, { headers: defaultHeaders });
          blob = await rawRes.blob();
        }
      } catch {
        const rawRes = await fetch(downloadTarget, { headers: defaultHeaders });
        blob = await rawRes.blob();
      }
    } else {
      const audioRes = await fetch(downloadTarget, { headers: defaultHeaders });
      if (!audioRes.ok) {
        throw new Error('Gagal mengambil file MP3 dari server publik.');
      }
      blob = await audioRes.blob();
    }

    // 8. Ekstraksi dan sanitasi judul serta artis secara konsisten
    const meta = cleanTrackMetadata(finalTitle || title || '', artist);
    const safeTitle = `${meta.artist} - ${meta.title}`.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'Audio';
    const fileName = `${safeTitle}.mp3`;

    return {
      blob,
      fileName,
      fileSize: blob.size || 0,
      title: meta.title,
      artist: meta.artist,
      duration: finalDuration,
      thumbnail: finalThumbnail
    };
  }
}
