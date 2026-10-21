import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import * as mm from 'music-metadata-browser';
import { db } from '../db/database';
import type { Track, Playlist, DownloadJob, YouTubeSearchResult } from '../types/music';
import { generateId, cleanTrackMetadata, getAudioBlobDuration } from '../utils/formatters';
import { YouTubeService } from '../services/youtubeService';
import { FileStorageService } from '../services/fileStorage';

interface LibraryContextType {
  tracks: Track[];
  playlists: Playlist[];
  downloadJobs: DownloadJob[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filteredTracks: Track[];
  addTrack: (track: Track) => Promise<void>;
  updateTrack: (trackId: string, updates: Partial<Track>) => Promise<void>;
  deleteTrack: (trackId: string) => Promise<void>;
  createPlaylist: (name: string, description?: string) => Promise<Playlist>;
  deletePlaylist: (playlistId: string) => Promise<void>;
  updatePlaylist: (playlistId: string, updates: Partial<Playlist>) => Promise<void>;
  addTrackToPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  importLocalFiles: (files: FileList | File[]) => Promise<number>;
  startDownload: (item: YouTubeSearchResult, bitrate?: 128 | 192 | 320) => Promise<void>;
  clearCompletedDownloads: () => Promise<void>;
}

const LibraryContext = createContext<LibraryContextType | undefined>(undefined);

export const LibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Ambil data live langsung dari Dexie IndexedDB
  const tracks = useLiveQuery(() => db.tracks.orderBy('dateAdded').reverse().toArray()) || [];
  const playlists = useLiveQuery(() => db.playlists.orderBy('createdAt').reverse().toArray()) || [];
  const downloadJobs = useLiveQuery(() => db.downloadJobs.orderBy('createdAt').reverse().toArray()) || [];

  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pastikan inisialisasi default playlist "Lagu Favorit" jika belum ada
  useEffect(() => {
    const initDefaultPlaylist = async () => {
      const count = await db.playlists.count();
      if (count === 0) {
        await db.playlists.add({
          id: 'favorites',
          name: 'Lagu Favorit',
          description: 'Kumpulan musik favorit Anda',
          trackIds: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      }
    };
    initDefaultPlaylist();
  }, []);

  // Auto-heal: perbaiki lagu-lagu tersimpan yang durasinya 0:00 atau metadata belum bersih / tertukar
  useEffect(() => {
    const healExistingTracks = async () => {
      try {
        const allSaved = await db.tracks.toArray();
        for (const t of allSaved) {
          const updates: Partial<Track> = {};

          // 1. Perbaiki durasi jika masih 0
          if ((!t.duration || t.duration === 0) && t.audioBlob) {
            const exactDur = await getAudioBlobDuration(t.audioBlob);
            if (exactDur > 0) {
              updates.duration = exactDur;
            }
          }

          // 2. Deteksi kasus tertukar: jika title mengandung tag cover (misal: "hololive ID [Cover]")
          const isCoverInTitle =
            /[\(\[\{【]\s*(cover|歌ってみた|covered\s*by)[\)\]\}】]/i.test(t.title) ||
            t.title.toLowerCase().includes('cover') ||
            t.title.toLowerCase().includes('hololive');

          let meta: { title: string; artist: string };
          if (isCoverInTitle && t.artist && t.artist !== 'YouTube') {
            // Kasus terbalik: artist sebenarnya adalah judul, title sebenarnya adalah penyanyi cover
            const combined = `${t.artist} - ${t.title}`;
            meta = cleanTrackMetadata(combined, '');
          } else {
            meta = cleanTrackMetadata(t.title, t.artist);
          }

          // 3. Jika artis masih 'YouTube' atau 'Artis Tidak Diketahui', coba lookup dari youtubeId atau downloadJobs
          if (!meta.artist || meta.artist === 'YouTube' || meta.artist === 'Artis Tidak Diketahui') {
            let yId = t.youtubeId;
            if (!yId) {
              const matchedJob = await db.downloadJobs
                .filter((j) => (j.title && (j.title.includes(t.title) || t.title.includes(j.title))) || j.id === t.id)
                .first();
              if (matchedJob?.youtubeId) {
                yId = matchedJob.youtubeId;
              }
            }

            if (yId) {
              try {
                const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${yId}&format=json`;
                const oRes = await fetch(oembedUrl);
                if (oRes.ok) {
                  const oData = await oRes.json();
                  const reClean = cleanTrackMetadata(oData.title || meta.title, oData.author_name || '');
                  if (reClean.title) meta.title = reClean.title;
                  if (reClean.artist && reClean.artist !== 'Artis Tidak Diketahui') meta.artist = reClean.artist;
                }
              } catch {
                // Abaikan jika offline
              }
            }
          }

          if (meta.title && meta.title !== t.title) {
            updates.title = meta.title;
          }
          if (meta.artist && meta.artist !== t.artist && meta.artist !== 'Artis Tidak Diketahui') {
            updates.artist = meta.artist;
          }

          if (Object.keys(updates).length > 0) {
            await db.tracks.update(t.id, updates);
          }
        }
      } catch (err) {
        console.warn('Auto-heal tracks gagal:', err);
      }
    };
    healExistingTracks();
  }, [tracks.length]);

  // Filter lagu berdasarkan kata kunci pencarian
  const filteredTracks = tracks.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q);
  });

  const addTrack = async (track: Track) => {
    await db.tracks.put(track);
  };

  const updateTrack = async (trackId: string, updates: Partial<Track>) => {
    await db.tracks.update(trackId, updates);
  };

  const deleteTrack = async (trackId: string) => {
    await db.tracks.delete(trackId);
    // Hapus juga trackId dari semua playlist terkait
    for (const pl of playlists) {
      if (pl.trackIds.includes(trackId)) {
        await removeTrackFromPlaylist(pl.id, trackId);
      }
    }
  };

  const createPlaylist = async (name: string, description?: string): Promise<Playlist> => {
    const newPlaylist: Playlist = {
      id: generateId(),
      name: name.trim() || 'Playlist Baru',
      description,
      trackIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await db.playlists.add(newPlaylist);
    return newPlaylist;
  };

  const deletePlaylist = async (playlistId: string) => {
    await db.playlists.delete(playlistId);
  };

  const updatePlaylist = async (playlistId: string, updates: Partial<Playlist>) => {
    await db.playlists.update(playlistId, {
      ...updates,
      updatedAt: Date.now()
    });
  };

  const addTrackToPlaylist = async (playlistId: string, trackId: string) => {
    const pl = await db.playlists.get(playlistId);
    if (!pl) return;
    if (!pl.trackIds.includes(trackId)) {
      const updatedTrackIds = [...pl.trackIds, trackId];
      await db.playlists.update(playlistId, {
        trackIds: updatedTrackIds,
        updatedAt: Date.now()
      });
    }
  };

  const removeTrackFromPlaylist = async (playlistId: string, trackId: string) => {
    const pl = await db.playlists.get(playlistId);
    if (!pl) return;
    const updatedTrackIds = pl.trackIds.filter((id) => id !== trackId);
    await db.playlists.update(playlistId, {
      trackIds: updatedTrackIds,
      updatedAt: Date.now()
    });
  };

  // Import file lokal (.mp3, .m4a, .wav) dari perangkat
  const importLocalFiles = async (files: FileList | File[]): Promise<number> => {
    let successCount = 0;
    const fileArray = Array.from(files);

    for (const file of fileArray) {
      try {
        let title = file.name.replace(/\.[^/.]+$/, '');
        let artist = 'Unknown Artist';
        let album = '';
        let duration = 0;
        let coverUrl: string | undefined = undefined;

        // Ekstraksi tag ID3
        try {
          const metadata = await mm.parseBlob(file);
          if (metadata.common.title) title = metadata.common.title;
          if (metadata.common.artist) artist = metadata.common.artist;
          if (metadata.common.album) album = metadata.common.album;
          if (metadata.format.duration) duration = Math.round(metadata.format.duration);

          const cover = mm.selectCover(metadata.common.picture);
          if (cover) {
            const blob = new Blob([new Uint8Array(cover.data)], { type: cover.format });
            coverUrl = URL.createObjectURL(blob);
          }
        } catch (metaErr) {
          console.warn('Gagal membaca metadata ID3, menggunakan nama file:', metaErr);
        }

        // Jika ID3 tidak menemukan durasi, ukur langsung dari audio element
        if (duration === 0) {
          duration = await getAudioBlobDuration(file);
        }

        const newTrack: Track = {
          id: generateId(),
          title,
          artist,
          album,
          duration,
          coverUrl,
          audioBlob: file,
          source: 'local',
          fileSize: file.size,
          dateAdded: Date.now()
        };

        await db.tracks.add(newTrack);
        successCount++;
      } catch (err) {
        console.error('Error saat import file lokal:', err);
      }
    }

    return successCount;
  };

  // Download dari YouTube dan konversi otomatis ke MP3
  const startDownload = async (item: YouTubeSearchResult, bitrate: 128 | 192 | 320 = 192) => {
    const jobId = generateId();
    const newJob: DownloadJob = {
      id: jobId,
      youtubeId: item.id,
      youtubeUrl: item.url,
      title: item.title,
      artist: item.artist,
      thumbnail: item.thumbnail,
      duration: item.duration,
      progress: 10,
      status: 'downloading',
      statusText: 'Mengunduh stream audio...',
      bitrate,
      createdAt: Date.now()
    };

    await db.downloadJobs.put(newJob);

    try {
      // 1. Request unduh & konversi ke MP3 via service
      await db.downloadJobs.update(jobId, {
        progress: 40,
        status: 'converting',
        statusText: 'Mengonversi ke MP3 & menanam cover art...'
      });

      const downloadResult = await YouTubeService.downloadAndConvert(
        item.url,
        bitrate,
        item.title,
        item.artist
      );

      await db.downloadJobs.update(jobId, {
        progress: 80,
        status: 'converting',
        statusText: 'Menyimpan ke memori perangkat...'
      });

      const meta = cleanTrackMetadata(downloadResult.title || item.title || '', downloadResult.artist || item.artist || '');
      const realTitle = meta.title || 'Lagu Terunduh';
      const realArtist = meta.artist || 'Artis Tidak Diketahui';
      let realDuration = downloadResult.duration || item.duration || 0;
      if (realDuration <= 0 && downloadResult.blob) {
        realDuration = await getAudioBlobDuration(downloadResult.blob);
      }
      const realCover = downloadResult.thumbnail || item.thumbnail;

      // 2. Simpan file MP3 ke Capacitor Filesystem jika di Android
      const localFilePath = await FileStorageService.saveAudioFile(
        downloadResult.fileName,
        new Uint8Array(await downloadResult.blob.arrayBuffer())
      );

      // 3. Masukkan track baru ke Library Musik
      const trackId = generateId();
      const track: Track = {
        id: trackId,
        title: realTitle,
        artist: realArtist,
        duration: realDuration,
        coverUrl: realCover,
        audioBlob: downloadResult.blob,
        filePath: localFilePath,
        source: 'youtube',
        youtubeId: item.id,
        bitrate,
        fileSize: downloadResult.fileSize,
        dateAdded: Date.now()
      };

      await db.tracks.add(track);

      // 4. Update status download job menjadi selesai dan sinkronkan nama lagu asli
      await db.downloadJobs.update(jobId, {
        title: realTitle,
        artist: realArtist,
        thumbnail: realCover,
        progress: 100,
        status: 'completed',
        statusText: 'Selesai diunduh dan tersimpan di Library!'
      });
    } catch (err) {
      console.error('Gagal mengunduh:', err);
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan saat mengunduh';
      await db.downloadJobs.update(jobId, {
        status: 'error',
        progress: 0,
        errorMessage: message,
        statusText: `Gagal: ${message}`
      });
    }
  };

  const clearCompletedDownloads = async () => {
    await db.downloadJobs.filter((j) => j.status === 'completed' || j.status === 'error').delete();
  };

  return (
    <LibraryContext.Provider
      value={{
        tracks,
        playlists,
        downloadJobs,
        searchQuery,
        setSearchQuery,
        filteredTracks,
        addTrack,
        updateTrack,
        deleteTrack,
        createPlaylist,
        deletePlaylist,
        updatePlaylist,
        addTrackToPlaylist,
        removeTrackFromPlaylist,
        importLocalFiles,
        startDownload,
        clearCompletedDownloads
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
};

export const useLibrary = (): LibraryContextType => {
  const context = useContext(LibraryContext);
  if (!context) {
    throw new Error('useLibrary must be used within a LibraryProvider');
  }
  return context;
};
