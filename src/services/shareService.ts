import { Capacitor, registerPlugin } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { db } from '../db/database';
import { FileStorageService } from './fileStorage';
import type { Track } from '../types/music';

export interface ShareServerPluginInterface {
  getLocalIp(): Promise<{ ip: string }>;
  startServer(options: {
    port: number;
    token: string;
    filePath: string;
    title: string;
    artist: string;
    duration: number;
    fileSize: number;
    coverUrl?: string;
  }): Promise<{ success: boolean; port: number }>;
  stopServer(): Promise<{ success: boolean }>;
  getStatus(): Promise<{ status: string; progress: number }>;
}

const NativeShareServer = registerPlugin<ShareServerPluginInterface>('ShareServer');

export interface ShareSessionInfo {
  token: string;
  ip: string;
  port: number;
  qrPayload: string;
  track: Track;
}

export interface ShareTrackInfo {
  title: string;
  artist: string;
  album?: string;
  duration: number;
  fileSize: number;
  coverUrl?: string;
  token: string;
}

export class ShareService {
  /**
   * Mengonversi Blob ke string Base64
   */
  static blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = reader.result as string;
        const base64 = res.includes(',') ? res.split(',')[1] : res;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Mendapatkan alamat IP lokal perangkat
   */
  static async getDeviceIp(): Promise<string> {
    if (Capacitor.isNativePlatform()) {
      try {
        const res = await NativeShareServer.getLocalIp();
        if (res && res.ip && res.ip !== '127.0.0.1') {
          return res.ip;
        }
      } catch (e) {
        console.warn('Gagal memanggil NativeShareServer.getLocalIp:', e);
      }
    }

    // Fallback ke server Electron/Desktop lokal jika tersedia
    try {
      const res = await fetch('http://localhost:3001/api/share/ip');
      if (res.ok) {
        const data = await res.json();
        return data.ip || '127.0.0.1';
      }
    } catch {
      // Offline fallback
    }

    return '127.0.0.1';
  }

  /**
   * Memulai sesi pengiriman lagu (SENDER)
   */
  static async startSharing(track: Track): Promise<ShareSessionInfo> {
    // 1. Buat token 6 digit acak
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const port = 3001;

    let deviceIp = await this.getDeviceIp();
    if (!deviceIp || deviceIp === '127.0.0.1') {
      deviceIp = '192.168.1.1'; // Fallback display jika offline murni
    }

    // 2. Jika di Native Android (Capacitor)
    if (Capacitor.isNativePlatform()) {
      let resolvedPath = track.filePath || '';

      // Jika path fisik belum ada tapi audioBlob ada di IndexedDB, tulis ke cache lokal
      if (!resolvedPath && track.audioBlob) {
        const base64 = await this.blobToBase64(track.audioBlob);
        const fileName = `share_${track.id.replace(/[^a-zA-Z0-9]/g, '_')}.mp3`;
        const writeRes = await Filesystem.writeFile({
          path: `cache/${fileName}`,
          data: base64,
          directory: Directory.Cache,
          recursive: true
        });
        resolvedPath = writeRes.uri;
      }

      await NativeShareServer.startServer({
        port,
        token,
        filePath: resolvedPath,
        title: track.title,
        artist: track.artist,
        duration: track.duration,
        fileSize: track.fileSize || (track.audioBlob ? track.audioBlob.size : 0),
        coverUrl: track.coverUrl
      });
    } else {
      // 3. Jika di Desktop (Node.js/Electron)
      let base64Audio: string | undefined = undefined;
      if (track.audioBlob) {
        base64Audio = await this.blobToBase64(track.audioBlob);
      }

      const res = await fetch('http://localhost:3001/api/share/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          track: {
            title: track.title,
            artist: track.artist,
            album: track.album,
            duration: track.duration,
            fileSize: track.fileSize || (track.audioBlob ? track.audioBlob.size : 0),
            coverUrl: track.coverUrl,
            fileName: track.id ? `${track.id}.mp3` : undefined
          },
          base64Audio
        })
      });

      if (!res.ok) {
        throw new Error('Gagal mendaftarkan sesi berbagi ke engine lokal');
      }

      const data = await res.json();
      if (data.ip) {
        deviceIp = data.ip;
      }
    }

    // Buat format QR payload terstandar
    const qrPayload = `musicflow://share?ip=${deviceIp}&port=${port}&token=${token}&id=${encodeURIComponent(track.id)}`;

    return {
      token,
      ip: deviceIp,
      port,
      qrPayload,
      track
    };
  }

  /**
   * Menghentikan sesi pengiriman
   */
  static async stopSharing(token: string): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      try {
        await NativeShareServer.stopServer();
      } catch (e) {
        console.warn('Gagal menghentikan native server:', e);
      }
    } else {
      try {
        await fetch('http://localhost:3001/api/share/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
      } catch {}
    }
  }

  /**
   * Cek progress transfer pada sisi pengirim
   */
  static async getSenderProgress(token: string): Promise<{ status: string; progress: number }> {
    if (Capacitor.isNativePlatform()) {
      try {
        return await NativeShareServer.getStatus();
      } catch {
        return { status: 'waiting', progress: 0 };
      }
    } else {
      try {
        const res = await fetch(`http://localhost:3001/api/share/status?token=${token}`);
        if (res.ok) {
          return await res.json();
        }
      } catch {}
      return { status: 'waiting', progress: 0 };
    }
  }

  /**
   * Parsing data barcode atau token dari input pengguna
   */
  static parseShareInput(input: string): { ip: string; port: number; token: string } | null {
    const trimmed = input.trim();

    // 1. Format URL MusicFlow: musicflow://share?ip=192.168.1.15&port=3001&token=849201
    if (trimmed.startsWith('musicflow://share')) {
      try {
        const urlObj = new URL(trimmed.replace('musicflow://', 'http://'));
        const ip = urlObj.searchParams.get('ip');
        const port = parseInt(urlObj.searchParams.get('port') || '3001', 10);
        const token = urlObj.searchParams.get('token');
        if (ip && token) {
          return { ip, port, token };
        }
      } catch {}
    }

    // 2. Format HTTP standar: http://192.168.1.15:3001/api/share/download?token=849201
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      try {
        const urlObj = new URL(trimmed);
        const token = urlObj.searchParams.get('token');
        const ip = urlObj.hostname;
        const port = parseInt(urlObj.port || '3001', 10);
        if (ip && token) {
          return { ip, port, token };
        }
      } catch {}
    }

    // 3. Format Ringkas: 192.168.1.15:3001#849201 atau 192.168.1.15#849201
    if (trimmed.includes('#')) {
      const [hostPart, tokenPart] = trimmed.split('#');
      let ip = hostPart.trim();
      let port = 3001;
      if (ip.includes(':')) {
        const [h, p] = ip.split(':');
        ip = h;
        port = parseInt(p, 10) || 3001;
      }
      if (ip && tokenPart) {
        return { ip, port, token: tokenPart.trim() };
      }
    }

    return null;
  }

  /**
   * Mengambil info lagu dari pengirim (RECEIVER)
   */
  static async fetchTrackInfo(ip: string, port: number, token: string): Promise<ShareTrackInfo> {
    const url = `http://${ip}:${port}/api/share/info?token=${encodeURIComponent(token)}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Gagal menghubungi perangkat pengirim pada ${ip}:${port} (Status: ${res.status})`);
    }
    return await res.json();
  }

  /**
   * Mengunduh file lagu dari pengirim dengan callback progres (RECEIVER)
   */
  static async downloadSharedTrack(
    ip: string,
    port: number,
    token: string,
    meta: ShareTrackInfo,
    onProgress: (percent: number, receivedBytes: number, totalBytes: number) => void
  ): Promise<Track> {
    const downloadUrl = `http://${ip}:${port}/api/share/download?token=${encodeURIComponent(token)}`;
    const response = await fetch(downloadUrl);

    if (!response.ok || !response.body) {
      throw new Error(`Gagal mengunduh audio dari pengirim (Status: ${response.status})`);
    }

    const contentLength = response.headers.get('content-length');
    const totalBytes = contentLength ? parseInt(contentLength, 10) : meta.fileSize || 0;

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      if (value) {
        chunks.push(value);
        receivedBytes += value.length;

        if (totalBytes > 0) {
          const percent = Math.min(100, Math.round((receivedBytes * 100) / totalBytes));
          onProgress(percent, receivedBytes, totalBytes);
        } else {
          onProgress(50, receivedBytes, 0);
        }
      }
    }

    onProgress(100, receivedBytes, totalBytes || receivedBytes);

    // Gabungkan chunks ke dalam Uint8Array terpadu
    const uint8 = new Uint8Array(receivedBytes);
    let offset = 0;
    for (const chunk of chunks) {
      uint8.set(chunk, offset);
      offset += chunk.length;
    }

    const audioBlob = new Blob([uint8.buffer as ArrayBuffer], { type: 'audio/mpeg' });
    const trackId = `track_${Date.now()}`;
    const safeTitle = (meta.title || 'Lagu Terbagi').trim();
    const safeArtist = (meta.artist || 'Artis Tidak Diketahui').trim();

    // Simpan ke storage native jika di Android
    let nativeFilePath: string | undefined = undefined;
    if (Capacitor.isNativePlatform()) {
      const fileName = `${safeTitle} - ${safeArtist}.mp3`.replace(/[/\\?%*:|"<>]/g, '_');
      nativeFilePath = await FileStorageService.saveAudioFile(fileName, uint8);
    }

    // Buat objek Track lengkap
    const newTrack: Track = {
      id: trackId,
      title: safeTitle,
      artist: safeArtist,
      album: meta.album || 'ShareFlow',
      duration: meta.duration || 0,
      coverUrl: meta.coverUrl,
      audioBlob,
      filePath: nativeFilePath,
      source: 'local',
      fileSize: receivedBytes,
      dateAdded: Date.now()
    };

    // Simpan ke IndexedDB
    await db.tracks.add(newTrack);

    return newTrack;
  }
}
