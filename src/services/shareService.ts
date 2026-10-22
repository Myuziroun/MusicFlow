import { Capacitor, registerPlugin, CapacitorHttp } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { db } from '../db/database';
import { FileStorageService } from './fileStorage';
import type { Track } from '../types/music';

export interface NetworkInterfaceInfo {
  name: string;
  ip: string;
}

export interface ShareServerPluginInterface {
  getLocalIp(): Promise<{ ip: string; allIps?: NetworkInterfaceInfo[] }>;
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
  availableIps: NetworkInterfaceInfo[];
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
   * Mendapatkan informasi jaringan lengkap (IP utama dan semua adapter valid)
   */
  static async getDeviceNetworkInfo(): Promise<{ ip: string; allIps: NetworkInterfaceInfo[] }> {
    if (Capacitor.isNativePlatform()) {
      try {
        const res = await NativeShareServer.getLocalIp();
        const primary = res && res.ip && res.ip !== '127.0.0.1' ? res.ip : '127.0.0.1';
        const list = res.allIps && res.allIps.length > 0 ? res.allIps : [{ name: 'Wi-Fi / Hotspot', ip: primary }];
        return { ip: primary, allIps: list };
      } catch (e) {
        console.warn('Gagal memanggil NativeShareServer.getLocalIp:', e);
      }
    }

    // Fallback ke server Electron/Desktop lokal
    try {
      const res = await fetch('http://localhost:3001/api/share/ip');
      if (res.ok) {
        const data = await res.json();
        const primary = data.ip || '127.0.0.1';
        const list = data.allIps && data.allIps.length > 0 ? data.allIps : [{ name: 'Jaringan Utama', ip: primary }];
        return { ip: primary, allIps: list };
      }
    } catch {
      // Offline fallback
    }

    return { ip: '127.0.0.1', allIps: [{ name: 'Default', ip: '127.0.0.1' }] };
  }

  /**
   * Mendapatkan alamat IP lokal perangkat
   */
  static async getDeviceIp(): Promise<string> {
    const net = await this.getDeviceNetworkInfo();
    return net.ip;
  }

  /**
   * Membuat QR payload standar MusicFlow
   */
  static buildQrPayload(ip: string, port: number, token: string, trackId: string): string {
    return `musicflow://share?ip=${ip}&port=${port}&token=${token}&id=${encodeURIComponent(trackId)}`;
  }

  /**
   * Memulai sesi pengiriman lagu (SENDER)
   */
  static async startSharing(track: Track, overrideIp?: string): Promise<ShareSessionInfo> {
    // 1. Buat token 6 digit acak
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const port = 3001;

    const netInfo = await this.getDeviceNetworkInfo();
    let deviceIp = overrideIp || netInfo.ip;
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
          selectedIp: deviceIp,
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
    const qrPayload = this.buildQrPayload(deviceIp, port, token, track.id);

    return {
      token,
      ip: deviceIp,
      port,
      qrPayload,
      track,
      availableIps: netInfo.allIps
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

    // 1. Pada native Android, prioritaskan native CapacitorHttp untuk melewati restriksi WebView
    if (Capacitor.isNativePlatform()) {
      try {
        const res = await CapacitorHttp.get({
          url,
          connectTimeout: 8000,
          readTimeout: 8000
        });
        if (res.status === 200 && res.data) {
          return typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
        } else if (res.status === 404) {
          throw new Error('Sesi berbagi tidak ditemukan atau telah kedaluwarsa');
        }
      } catch (err: any) {
        console.warn('Native CapacitorHttp.get gagal, mencoba fetch standar:', err);
        if (err.message && err.message.includes('kedaluwarsa')) throw err;
      }
    }

    // 2. Fallback fetch standar (browser / desktop)
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

    let uint8: Uint8Array | null = null;
    let trackFileSize = meta.fileSize || 0;

    // A. Percobaan 1: Streaming fetch standar untuk update progress byte-by-byte
    try {
      const response = await fetch(downloadUrl);
      if (response.ok && response.body) {
        const contentLength = response.headers.get('content-length');
        const totalBytes = contentLength ? parseInt(contentLength, 10) : meta.fileSize || 0;
        trackFileSize = totalBytes;

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

        uint8 = new Uint8Array(receivedBytes);
        let offset = 0;
        for (const chunk of chunks) {
          uint8.set(chunk, offset);
          offset += chunk.length;
        }
      }
    } catch (fetchErr) {
      console.warn('Streaming fetch gagal, mencoba native fallback:', fetchErr);
    }

    // B. Percobaan 2: Native CapacitorHttp fallback jika streaming fetch gagal pada Android
    if (!uint8 && Capacitor.isNativePlatform()) {
      onProgress(25, 0, meta.fileSize || 0);
      const res = await CapacitorHttp.get({
        url: downloadUrl,
        responseType: 'blob',
        connectTimeout: 15000,
        readTimeout: 60000
      });

      if (res.status === 200 && res.data) {
        onProgress(75, meta.fileSize || 0, meta.fileSize || 0);
        const base64Data: string = res.data;
        const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
        const binaryString = atob(cleanBase64);
        const len = binaryString.length;
        uint8 = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          uint8[i] = binaryString.charCodeAt(i);
        }
        trackFileSize = len;
      }
    }

    if (!uint8 || uint8.length === 0) {
      throw new Error(`Gagal mengunduh audio dari pengirim pada ${ip}:${port}`);
    }

    onProgress(100, uint8.length, trackFileSize || uint8.length);

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
      fileSize: trackFileSize || audioBlob.size,
      dateAdded: Date.now()
    };

    // Simpan ke IndexedDB
    await db.tracks.add(newTrack);

    return newTrack;
  }
}
