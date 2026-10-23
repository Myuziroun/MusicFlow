import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * State pemutaran yang dikirim ke foreground service Android.
 * Durasi dan posisi memakai satuan detik.
 */
export interface NativePlaybackState {
  isPlaying: boolean;
  title: string;
  artist: string;
  album: string;
  duration: number;
  position: number;
  coverKey: string;
}

/**
 * Sumber cover art untuk notifikasi Android.
 * `coverData` hanya dipakai untuk blob URL lama yang tidak dapat diakses
 * langsung oleh proses native.
 */
export interface NativeCoverSource {
  key: string;
  coverUrl?: string;
  filePath?: string;
  coverData?: string;
}

interface PlaybackServicePlugin {
  updateState(options: NativePlaybackState): Promise<void>;
  setCoverSource(options: NativeCoverSource): Promise<void>;
}

const PlaybackService = registerPlugin<PlaybackServicePlugin>('PlaybackService');
const IS_ANDROID = Capacitor.getPlatform() === 'android';

/**
 * Pembungkus aman untuk plugin PlaybackService.
 * Di desktop dan web seluruh panggilan menjadi no-op.
 */
export const NativePlayback = {
  isAvailable(): boolean {
    return IS_ANDROID;
  },

  async updateState(state: NativePlaybackState): Promise<void> {
    if (!IS_ANDROID) return;

    try {
      await PlaybackService.updateState(state);
    } catch (err) {
      // Jangan ganggu pemutaran jika service gagal dimulai (misalnya izin
      // foreground service ditolak oleh kebijakan baterai perangkat).
      console.warn('Gagal menyinkronkan state ke playback service Android:', err);
    }
  },

  async setCoverSource(source: NativeCoverSource): Promise<void> {
    if (!IS_ANDROID) return;

    try {
      await PlaybackService.setCoverSource(source);
    } catch (err) {
      // Cover bersifat pelengkap; kegagalan memuat cover tidak boleh
      // menghentikan pemutaran atau menghilangkan kontrol notifikasi.
      console.warn('Gagal mengirim sumber cover ke playback service Android:', err);
    }
  }
};
