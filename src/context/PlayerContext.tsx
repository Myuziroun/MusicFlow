import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Track, RepeatMode } from '../types/music';
import { db } from '../db/database';
import { FileStorageService } from '../services/fileStorage';
import { MediaSessionService } from '../services/mediaSession';

export interface PlayerProgressContextType {
  currentTime: number;
  duration: number;
}

export const PlayerProgressContext = createContext<PlayerProgressContextType>({
  currentTime: 0,
  duration: 0
});

export interface PlayerContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  duration: number;
  volume: number;
  isMuted: boolean;
  repeatMode: RepeatMode;
  isShuffle: boolean;
  queue: Track[];
  queueIndex: number;
  isPlayerModalOpen: boolean;
  isQueueModalOpen: boolean;
  playTrack: (track: Track, customQueue?: Track[]) => void;
  togglePlay: () => void;
  pause: () => void;
  resume: () => void;
  nextTrack: () => void;
  previousTrack: () => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  updateTrackInPlayer: (trackId: string, updates: Partial<Track>) => void;
  setIsPlayerModalOpen: (open: boolean) => void;
  setIsQueueModalOpen: (open: boolean) => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentObjectUrlRef = useRef<string | null>(null);

  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolumeState] = useState<number>(() => {
    const saved = localStorage.getItem('player_volume');
    return saved !== null ? parseFloat(saved) : 0.8;
  });
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [queue, setQueue] = useState<Track[]>([]);
  const [queueIndex, setQueueIndex] = useState<number>(-1);
  const [isPlayerModalOpen, setIsPlayerModalOpen] = useState<boolean>(false);
  const [isQueueModalOpen, setIsQueueModalOpen] = useState<boolean>(false);
  const currentTrackRef = useRef<Track | null>(null);

  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  // Inisialisasi Audio element
  useEffect(() => {
    const audio = new Audio();
    // Menggunakan metadata alih-alih auto agar Chromium tidak menelan seluruh audio ke RAM sekaligus
    audio.preload = 'metadata';
    audioRef.current = audio;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      MediaSessionService.updatePositionState(audio.duration, audio.currentTime);
    };

    const onLoadedMetadata = () => {
      const dur = audio.duration;
      setDuration(dur);
      // Jika track sebelumnya tersimpan dengan durasi 0, perbaiki langsung di DB
      if (currentTrackRef.current && dur > 0 && (!currentTrackRef.current.duration || currentTrackRef.current.duration === 0)) {
        const sec = Math.round(dur);
        db.tracks.update(currentTrackRef.current.id, { duration: sec });
        setCurrentTrack((prev) => (prev ? { ...prev, duration: sec } : prev));
      }
    };

    const onPlay = () => {
      setIsPlaying(true);
      MediaSessionService.updatePlaybackState(true);
    };

    const onPause = () => {
      setIsPlaying(false);
      MediaSessionService.updatePlaybackState(false);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.pause();
      if (currentObjectUrlRef.current) {
        URL.revokeObjectURL(currentObjectUrlRef.current);
      }
    };
  }, []);

  // Update volume audio
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
    localStorage.setItem('player_volume', volume.toString());
  }, [volume, isMuted]);

  // Fungsi navigasi Next Track
  const nextTrack = useCallback(() => {
    if (queue.length === 0) return;

    if (repeatMode === 'one' && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(console.warn);
      return;
    }

    let nextIndex = queueIndex + 1;
    if (isShuffle) {
      nextIndex = Math.floor(Math.random() * queue.length);
    }

    if (nextIndex >= queue.length) {
      if (repeatMode === 'all') {
        nextIndex = 0;
      } else {
        setIsPlaying(false);
        return;
      }
    }

    const nextTrk = queue[nextIndex];
    if (nextTrk) {
      setQueueIndex(nextIndex);
      setCurrentTrack(nextTrk);
      loadAndPlay(nextTrk);
    }
  }, [queue, queueIndex, repeatMode, isShuffle]);

  // Fungsi navigasi Previous Track
  const previousTrack = useCallback(() => {
    if (queue.length === 0) return;

    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }

    let prevIndex = queueIndex - 1;
    if (prevIndex < 0) {
      prevIndex = queue.length - 1;
    }

    const prevTrk = queue[prevIndex];
    if (prevTrk) {
      setQueueIndex(prevIndex);
      setCurrentTrack(prevTrk);
      loadAndPlay(prevTrk);
    }
  }, [queue, queueIndex]);

  // Pasang event audio 'ended'
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onEnded = () => {
      nextTrack();
    };

    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('ended', onEnded);
    };
  }, [nextTrack]);

  // Pasang action handler MediaSession
  useEffect(() => {
    MediaSessionService.setActionHandlers({
      onPlay: () => audioRef.current?.play().catch(console.warn),
      onPause: () => audioRef.current?.pause(),
      onNext: () => nextTrack(),
      onPrevious: () => previousTrack(),
      onSeek: (seekTime) => {
        if (audioRef.current) {
          audioRef.current.currentTime = seekTime;
        }
      }
    });
  }, [nextTrack, previousTrack]);

  // Load file audio dan putar
  const loadAndPlay = (track: Track) => {
    const audio = audioRef.current;
    if (!audio) return;

    if (currentObjectUrlRef.current) {
      URL.revokeObjectURL(currentObjectUrlRef.current);
      currentObjectUrlRef.current = null;
    }

    const playableUrl = FileStorageService.getPlayableUrl(track);
    if (!playableUrl) {
      console.error('URL audio tidak ditemukan untuk track:', track.title);
      return;
    }

    if (track.audioBlob) {
      currentObjectUrlRef.current = playableUrl;
    }

    audio.src = playableUrl;
    audio.load();
    audio.play().catch((err) => {
      console.warn('Autoplay diblokir oleh browser:', err);
    });

    MediaSessionService.updateMetadata(track);
  };

  // Putar lagu spesifik dan atur antrean
  const playTrack = (track: Track, customQueue?: Track[]) => {
    let newQueue = customQueue || queue;
    if (!customQueue || customQueue.length === 0) {
      // Jika queue belum ada lagu ini, masukkan ke queue
      const existingIdx = queue.findIndex((t) => t.id === track.id);
      if (existingIdx === -1) {
        newQueue = [...queue, track];
      }
    }

    const idx = newQueue.findIndex((t) => t.id === track.id);
    setQueue(newQueue);
    setQueueIndex(idx >= 0 ? idx : 0);
    setCurrentTrack(track);
    loadAndPlay(track);
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(console.warn);
    }
  };

  const pause = () => {
    audioRef.current?.pause();
  };

  const resume = () => {
    audioRef.current?.play().catch(console.warn);
  };

  const seek = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      setCurrentTime(seconds);
    }
  };

  const setVolume = (vol: number) => {
    setVolumeState(Math.max(0, Math.min(1, vol)));
    if (isMuted && vol > 0) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    setIsMuted((prev) => !prev);
  };

  const toggleRepeat = () => {
    setRepeatMode((prev) => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  };

  const toggleShuffle = () => {
    setIsShuffle((prev) => !prev);
  };

  const addToQueue = (track: Track) => {
    setQueue((prev) => [...prev, track]);
  };

  const removeFromQueue = (index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index));
    if (index === queueIndex) {
      nextTrack();
    } else if (index < queueIndex) {
      setQueueIndex((prev) => prev - 1);
    }
  };

  const clearQueue = () => {
    setQueue(currentTrack ? [currentTrack] : []);
    setQueueIndex(0);
  };

  const updateTrackInPlayer = (trackId: string, updates: Partial<Track>) => {
    if (currentTrack && currentTrack.id === trackId) {
      const updated = { ...currentTrack, ...updates };
      setCurrentTrack(updated);
      MediaSessionService.updateMetadata(updated);
    }
    setQueue((prevQueue) =>
      prevQueue.map((t) => (t.id === trackId ? { ...t, ...updates } : t))
    );
  };

  // playerContextValue hanya berubah saat state utama pemutar berubah, BUKAN setiap tick detik (timeupdate)
  const playerContextValue = useMemo<PlayerContextType>(() => ({
    currentTrack,
    isPlaying,
    duration,
    volume,
    isMuted,
    repeatMode,
    isShuffle,
    queue,
    queueIndex,
    isPlayerModalOpen,
    isQueueModalOpen,
    playTrack,
    togglePlay,
    pause,
    resume,
    nextTrack,
    previousTrack,
    seek,
    setVolume,
    toggleMute,
    toggleRepeat,
    toggleShuffle,
    addToQueue,
    removeFromQueue,
    clearQueue,
    updateTrackInPlayer,
    setIsPlayerModalOpen,
    setIsQueueModalOpen
  }), [
    currentTrack,
    isPlaying,
    duration,
    volume,
    isMuted,
    repeatMode,
    isShuffle,
    queue,
    queueIndex,
    isPlayerModalOpen,
    isQueueModalOpen,
    nextTrack,
    previousTrack
  ]);

  // progressContextValue khusus mengalirkan detik lagu (currentTime) yang berfrekuensi tinggi (4x per detik)
  const progressContextValue = useMemo<PlayerProgressContextType>(() => ({
    currentTime,
    duration
  }), [currentTime, duration]);

  return (
    <PlayerContext.Provider value={playerContextValue}>
      <PlayerProgressContext.Provider value={progressContextValue}>
        {children}
      </PlayerProgressContext.Provider>
    </PlayerContext.Provider>
  );
};

export const usePlayer = (): PlayerContextType => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
};

export const usePlayerProgress = (): PlayerProgressContextType => {
  return useContext(PlayerProgressContext);
};
