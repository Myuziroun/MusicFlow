import React from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Repeat1,
  Shuffle,
  Volume2,
  VolumeX,
  ListMusic,
  Maximize2,
  Music
} from 'lucide-react';
import { usePlayer, usePlayerProgress } from '../../context/PlayerContext';
import { formatDuration } from '../../utils/formatters';

export const PlayerBar: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    volume,
    isMuted,
    repeatMode,
    isShuffle,
    togglePlay,
    nextTrack,
    previousTrack,
    seek,
    setVolume,
    toggleMute,
    toggleRepeat,
    toggleShuffle,
    setIsPlayerModalOpen,
    setIsQueueModalOpen
  } = usePlayer();
  const { currentTime, duration } = usePlayerProgress();

  if (!currentTrack) {
    return null;
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="w-full flex-shrink-0 border-t border-zinc-800 bg-black/95 backdrop-blur-xl px-4 md:px-6 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4 z-20 select-none shadow-2xl">
      {/* Mini Progress Bar on Top for Mobile */}
      <div
        className="w-full h-1 bg-zinc-800 md:hidden rounded-full overflow-hidden cursor-pointer"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const percent = (e.clientX - rect.left) / rect.width;
          seek(percent * duration);
        }}
      >
        <div
          className="h-full bg-white transition-all duration-150"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="flex items-center justify-between w-full md:w-auto">
        {/* Track Info (Click to open full player) */}
        <div
          onClick={() => setIsPlayerModalOpen(true)}
          className="flex items-center gap-3 cursor-pointer group flex-1 md:w-60 min-w-0"
        >
          <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden flex-shrink-0 relative shadow-md">
            {currentTrack.coverUrl ? (
              <img
                src={currentTrack.coverUrl}
                alt={currentTrack.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-white">
                <Music className="w-6 h-6" />
              </div>
            )}
          </div>
          <div className="min-w-0 pr-2">
            <h4 className="text-sm font-semibold text-white truncate group-hover:text-zinc-300 transition-colors">
              {currentTrack.title}
            </h4>
            <p className="text-xs text-zinc-400 truncate">{currentTrack.artist}</p>
          </div>
        </div>

        {/* Mobile Quick Controls */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-full bg-white hover:bg-zinc-200 text-black flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
          </button>
          <button
            onClick={() => setIsPlayerModalOpen(true)}
            className="p-2 text-zinc-400 hover:text-white"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Desktop Center Controls & Timeline */}
      <div className="hidden md:flex flex-col items-center flex-1 max-w-2xl px-4">
        {/* Playback Buttons */}
        <div className="flex items-center gap-5 mb-1.5">
          <button
            onClick={toggleShuffle}
            title={isShuffle ? 'Acak Aktif' : 'Acak Mati'}
            className={`p-1.5 transition-colors ${
              isShuffle ? 'text-white scale-110' : 'text-zinc-500 hover:text-white'
            }`}
          >
            <Shuffle className="w-4 h-4" />
          </button>

          <button
            onClick={previousTrack}
            title="Lagu Sebelumnya"
            className="p-1.5 text-zinc-300 hover:text-white active:scale-95 transition-transform"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>

          <button
            onClick={togglePlay}
            title={isPlaying ? 'Jeda' : 'Putar'}
            className="w-10 h-10 rounded-full bg-white hover:bg-zinc-200 text-black flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
          </button>

          <button
            onClick={nextTrack}
            title="Lagu Berikutnya"
            className="p-1.5 text-zinc-300 hover:text-white active:scale-95 transition-transform"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>

          <button
            onClick={toggleRepeat}
            title={
              repeatMode === 'one'
                ? 'Ulang 1 Lagu'
                : repeatMode === 'all'
                ? 'Ulang Semua'
                : 'Ulang Mati'
            }
            className={`p-1.5 transition-colors ${
              repeatMode !== 'off' ? 'text-white scale-110' : 'text-zinc-500 hover:text-white'
            }`}
          >
            {repeatMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
          </button>
        </div>

        {/* Progress Slider */}
        <div className="w-full flex items-center gap-3 text-xs text-zinc-400">
          <span className="w-10 text-right">{formatDuration(currentTime)}</span>
          <div
            className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden cursor-pointer relative group"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const percent = (e.clientX - rect.left) / rect.width;
              seek(percent * duration);
            }}
          >
            <div
              className="h-full bg-zinc-400 group-hover:bg-white transition-colors relative"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="w-10">{formatDuration(duration)}</span>
        </div>
      </div>

      {/* Desktop Right: Volume & Queue */}
      <div className="hidden md:flex items-center gap-3 w-60 justify-end">
        <button
          onClick={() => setIsQueueModalOpen(true)}
          title="Antrean Putar"
          className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <ListMusic className="w-5 h-5" />
        </button>

        {/* Volume Slider */}
        <div className="flex items-center gap-2">
          <button onClick={toggleMute} className="text-zinc-400 hover:text-white p-1">
            {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-20 accent-white h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};
