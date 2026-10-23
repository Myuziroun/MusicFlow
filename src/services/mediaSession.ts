import { Capacitor } from '@capacitor/core';
import type { Track } from '../types/music';

const IS_ANDROID = Capacitor.getPlatform() === 'android';

/**
 * Service untuk menghubungkan audio player dengan sistem kontrol media OS
 * (Lockscreen Android, Notification bar, serta kontrol tombol keyboard PC).
 *
 * Di Android, MediaSession ditangani secara native oleh PlaybackService.
 * Web MediaSession sengaja dinonaktifkan di sana agar tidak ada dua sesi
 * media yang berebut metadata dan tombol kontrol.
 */
export class MediaSessionService {
  private static get isAvailable(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      !IS_ANDROID &&
      'mediaSession' in navigator
    );
  }

  /**
   * Perbarui metadata lagu di Lockscreen & Notification
   */
  static updateMetadata(track: Track | null): void {
    if (!MediaSessionService.isAvailable || !track) {
      return;
    }

    const artwork: MediaImage[] = [];
    if (track.coverUrl) {
      artwork.push({
        src: track.coverUrl,
        sizes: '512x512',
        type: 'image/jpeg'
      });
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: track.album || 'Music Listener',
      artwork
    });
  }

  /**
   * Perbarui status playback (playing / paused)
   */
  static updatePlaybackState(isPlaying: boolean): void {
    if (MediaSessionService.isAvailable) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }

  /**
   * Perbarui posisi seekbar pada media notification
   */
  static updatePositionState(duration: number, currentTime: number): void {
    if (!MediaSessionService.isAvailable || !duration || isNaN(duration)) return;
    try {
      if (typeof navigator.mediaSession.setPositionState === 'function') {
        navigator.mediaSession.setPositionState({
          duration: Math.max(0, duration),
          playbackRate: 1,
          position: Math.min(duration, Math.max(0, currentTime))
        });
      }
    } catch (e) {
      // Abaikan jika browser tidak mendukung setPositionState
    }
  }

  /**
   * Daftarkan action handlers untuk tombol lockscreen/keyboard
   */
  static setActionHandlers(handlers: {
    onPlay: () => void;
    onPause: () => void;
    onNext: () => void;
    onPrevious: () => void;
    onSeek?: (seekTime: number) => void;
  }): void {
    if (!MediaSessionService.isAvailable) return;

    try {
      navigator.mediaSession.setActionHandler('play', handlers.onPlay);
      navigator.mediaSession.setActionHandler('pause', handlers.onPause);
      navigator.mediaSession.setActionHandler('previoustrack', handlers.onPrevious);
      navigator.mediaSession.setActionHandler('nexttrack', handlers.onNext);

      if (handlers.onSeek) {
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (details.seekTime !== undefined && details.seekTime !== null) {
            handlers.onSeek!(details.seekTime);
          }
        });
      }
    } catch (e) {
      console.warn('Gagal mendaftarkan handler MediaSession:', e);
    }
  }
}
