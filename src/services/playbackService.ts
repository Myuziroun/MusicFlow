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
}

interface PlaybackServicePlugin {
  updateState(options: NativePlaybackState): Promise<void>;
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
  }
};
