import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import type { Track } from '../types/music';

/**
 * Service untuk menangani penyimpanan file audio baik di Web (IndexedDB)
 * maupun native Android (Capacitor Filesystem).
 */
export class FileStorageService {
  /**
   * Menyimpan buffer audio fisik ke perangkat
   * @param fileName Nama file (contoh: song.mp3)
   * @param data ArrayBuffer atau Uint8Array data audio
   * @returns Path lokal jika di Capacitor, atau undefined di Web
   */
  static async saveAudioFile(fileName: string, data: Uint8Array): Promise<string | undefined> {
    try {
      if (Capacitor.isNativePlatform()) {
        // Konversi Uint8Array ke base64 untuk Capacitor Filesystem
        let binary = '';
        const len = data.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(data[i]);
        }
        const base64Data = btoa(binary);

        const safeFileName = fileName.replace(/[/\\?%*:|"<>]/g, '_');
        const result = await Filesystem.writeFile({
          path: `Music/${safeFileName}`,
          data: base64Data,
          directory: Directory.Documents,
          recursive: true
        });

        return result.uri;
      }
    } catch (err) {
      console.warn('Gagal menyimpan file ke Filesystem native, fallback ke IndexedDB:', err);
    }
    return undefined;
  }

  /**
   * Mendapatkan URL audio yang dapat diputar oleh HTML5 Audio
   * @param track Data track
   * @returns URL yang siap dimasukkan ke audio.src
   */
  static getPlayableUrl(track: Track): string {
    if (track.audioBlob) {
      return URL.createObjectURL(track.audioBlob);
    }
    if (track.filePath && Capacitor.isNativePlatform()) {
      return Capacitor.convertFileSrc(track.filePath);
    }
    if (track.audioUrl) {
      return track.audioUrl;
    }
    return '';
  }
}
