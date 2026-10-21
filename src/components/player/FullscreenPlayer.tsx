import React from 'react';
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Repeat1,
  Shuffle,
  ListMusic,
  Music,
  Share2
} from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { formatDuration } from '../../utils/formatters';

export const FullscreenPlayer: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    repeatMode,
    isShuffle,
    isPlayerModalOpen,
    togglePlay,
    nextTrack,
    previousTrack,
    seek,
    toggleRepeat,
    toggleShuffle,
    setIsPlayerModalOpen,
    setIsQueueModalOpen
  } = usePlayer();

  if (!isPlayerModalOpen || !currentTrack) return null;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-zinc-950 via-black to-black flex flex-col justify-between p-6 animate-in slide-in-from-bottom duration-300 select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between pt-safe">
        <button
          onClick={() => setIsPlayerModalOpen(false)}
          className="p-2.5 rounded-full bg-zinc-900 text-zinc-300 hover:text-white transition-colors"
        >
          <ChevronDown className="w-6 h-6" />
        </button>
        <div className="text-center">
          <span className="text-[11px] uppercase tracking-widest text-zinc-400 font-semibold">
            Sedang Memutar
          </span>
          <p className="text-xs text-zinc-200 font-medium truncate max-w-[200px]">
            {currentTrack.album || 'Koleksi Musik'}
          </p>
        </div>
        <button
          onClick={() => {
            if (navigator.share) {
              navigator.share({
                title: currentTrack.title,
                text: `Mendengarkan ${currentTrack.title} oleh ${currentTrack.artist}`
              }).catch(() => {});
            }
          }}
          className="p-2.5 rounded-full bg-zinc-900 text-zinc-300 hover:text-white transition-colors"
        >
          <Share2 className="w-5 h-5" />
        </button>
      </div>

      {/* Album Art Showcase */}
      <div className="flex-1 flex items-center justify-center py-6">
        <div className="w-72 h-72 sm:w-80 sm:h-80 md:w-96 md:h-96 rounded-2xl overflow-hidden shadow-2xl shadow-white/5 border border-zinc-800 relative">
          {currentTrack.coverUrl ? (
            <img
              src={currentTrack.coverUrl}
              alt={currentTrack.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-white">
              <Music className="w-24 h-24" />
            </div>
          )}
        </div>
      </div>

      {/* Track Details & Controls Container */}
      <div className="space-y-6 pb-safe max-w-md mx-auto w-full">
        {/* Title & Artist */}
        <div className="flex items-center justify-between">
          <div className="min-w-0 pr-4">
            <h2 className="text-xl sm:text-2xl font-bold text-white truncate">
              {currentTrack.title}
            </h2>
            <p className="text-sm sm:text-base text-zinc-400 truncate mt-1">
              {currentTrack.artist}
            </p>
          </div>
          <button
            onClick={() => {
              setIsPlayerModalOpen(false);
              setIsQueueModalOpen(true);
            }}
            className="p-3 text-zinc-300 hover:text-white rounded-full bg-zinc-900 transition-colors"
          >
            <ListMusic className="w-5 h-5" />
          </button>
        </div>

        {/* Timeline Slider */}
        <div className="space-y-2">
          <div
            className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden cursor-pointer relative"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const percent = (e.clientX - rect.left) / rect.width;
              seek(percent * duration);
            }}
          >
            <div
              className="h-full bg-white rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-zinc-400 font-medium">
            <span>{formatDuration(currentTime)}</span>
            <span>{formatDuration(duration)}</span>
          </div>
        </div>

        {/* Playback Buttons */}
        <div className="flex items-center justify-between pt-2">
          {/* Shuffle Toggle */}
          <button
            onClick={toggleShuffle}
            className={`p-3 transition-colors ${
              isShuffle ? 'text-white scale-110' : 'text-zinc-500 hover:text-white'
            }`}
          >
            <Shuffle className="w-6 h-6" />
          </button>

          {/* Previous Track */}
          <button
            onClick={previousTrack}
            className="p-3 text-zinc-300 hover:text-white active:scale-90 transition-transform"
          >
            <SkipBack className="w-8 h-8 fill-current" />
          </button>

          {/* Large Play/Pause */}
          <button
            onClick={togglePlay}
            className="w-16 h-16 rounded-full bg-white hover:bg-zinc-200 text-black flex items-center justify-center shadow-xl shadow-white/10 active:scale-95 transition-all"
          >
            {isPlaying ? (
              <Pause className="w-8 h-8 fill-current" />
            ) : (
              <Play className="w-8 h-8 fill-current ml-1" />
            )}
          </button>

          {/* Next Track */}
          <button
            onClick={nextTrack}
            className="p-3 text-zinc-300 hover:text-white active:scale-90 transition-transform"
          >
            <SkipForward className="w-8 h-8 fill-current" />
          </button>

          {/* Repeat Toggle */}
          <button
            onClick={toggleRepeat}
            className={`p-3 transition-colors ${
              repeatMode !== 'off' ? 'text-white scale-110' : 'text-zinc-500 hover:text-white'
            }`}
          >
            {repeatMode === 'one' ? <Repeat1 className="w-6 h-6" /> : <Repeat className="w-6 h-6" />}
          </button>
        </div>
      </div>
    </div>
  );
};
