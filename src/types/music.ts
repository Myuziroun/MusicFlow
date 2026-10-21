/**
 * Tipe data utama untuk aplikasi Music Listener & Downloader
 */

export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number; // detik
  coverUrl?: string; // Data URL atau URL gambar
  audioBlob?: Blob; // Disimpan di IndexedDB untuk pemutaran offline murni
  audioUrl?: string; // URL object sementara atau stream URL
  filePath?: string; // Path penyimpanan fisik di Capacitor/Android
  source: 'local' | 'youtube';
  youtubeId?: string;
  bitrate?: number; // kbps, misal 128, 192, 320
  fileSize?: number; // bytes
  dateAdded: number; // timestamp
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  coverUrl?: string;
  trackIds: string[];
  createdAt: number;
  updatedAt: number;
}

export type DownloadStatus = 'queued' | 'downloading' | 'converting' | 'completed' | 'error';

export interface DownloadJob {
  id: string;
  youtubeId: string;
  youtubeUrl: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration: number;
  progress: number; // 0 - 100
  status: DownloadStatus;
  statusText?: string;
  errorMessage?: string;
  bitrate: 128 | 192 | 320;
  createdAt: number;
}

export type RepeatMode = 'off' | 'all' | 'one';

export interface YouTubeSearchResult {
  id: string;
  title: string;
  artist: string;
  duration: number; // detik
  durationFormatted: string;
  thumbnail: string;
  url: string;
}
