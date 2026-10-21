import Dexie, { type Table } from 'dexie';
import type { Track, Playlist, DownloadJob } from '../types/music';

/**
 * Kelas database lokal Dexie untuk menyimpan musik, playlist, dan riwayat download
 * secara offline pada perangkat pengguna (Client-Only Storage).
 */
export class MusicDatabase extends Dexie {
  tracks!: Table<Track, string>;
  playlists!: Table<Playlist, string>;
  downloadJobs!: Table<DownloadJob, string>;

  constructor() {
    super('MusicListenerDB');
    
    // Inisialisasi skema versi 1
    // Primary key: id, indexed fields: title, artist, dateAdded, etc.
    this.version(1).stores({
      tracks: 'id, title, artist, dateAdded, source, youtubeId',
      playlists: 'id, name, createdAt, updatedAt',
      downloadJobs: 'id, youtubeId, status, createdAt'
    });
  }
}

export const db = new MusicDatabase();
