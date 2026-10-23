import React, { useEffect, useRef } from 'react';
import { Maximize2, Music, PanelTopOpen, Pause, Play, X } from 'lucide-react';
import { useDesktopWindow } from '../../context/DesktopWindowContext';
import { usePlayer } from '../../context/PlayerContext';

const notchControlClass =
  'w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white focus:outline-none focus-visible:bg-zinc-800';

export const NotchMode: React.FC = () => {
  const { isNotchMode } = useDesktopWindow();
  const {
    currentTrack,
    isPlaying,
    togglePlay,
    setIsPlayerModalOpen,
    setIsQueueModalOpen
  } = usePlayer();
  const api = window.musicflowDesktop;
  const wasNotchModeRef = useRef<boolean>(false);

  // Tutup modal berat sekali saat masuk notch agar tidak ikut tersembunyi
  // lalu muncul kembali secara tiba-tiba ketika jendela dipulihkan.
  useEffect(() => {
    if (isNotchMode && !wasNotchModeRef.current) {
      setIsPlayerModalOpen(false);
      setIsQueueModalOpen(false);
    }
    wasNotchModeRef.current = isNotchMode;
  }, [isNotchMode, setIsPlayerModalOpen, setIsQueueModalOpen]);

  if (!isNotchMode) return null;

  const restoreWindow = () => {
    void api?.exitNotchMode({ maximize: false });
  };

  const maximizeWindow = () => {
    void api?.exitNotchMode({ maximize: true });
  };

  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('[data-window-control]')) return;
    restoreWindow();
  };

  return (
    <div
      data-notch-mode="true"
      data-drag-region="true"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      onDoubleClick={handleDoubleClick}
      className="h-screen w-screen bg-black p-1 overflow-hidden select-none flex items-start justify-center"
    >
      <div className="w-[372px] h-[56px] rounded-xl border border-zinc-800 bg-zinc-950 flex items-center gap-1.5 px-2">
        <div className="w-10 h-10 shrink-0 rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden flex items-center justify-center">
          {currentTrack?.coverUrl ? (
            <img
              src={currentTrack.coverUrl}
              alt={currentTrack.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <Music className="w-5 h-5 text-zinc-400" />
          )}
        </div>

        <div className="min-w-0 flex-1 pr-1">
          <p className="text-[11px] font-semibold leading-tight text-white truncate">
            {currentTrack?.title || 'MusicFlow'}
          </p>
          <p className="text-[10px] leading-tight text-zinc-500 truncate">
            {currentTrack?.artist || 'Belum ada lagu'}
          </p>
        </div>

        <div
          className="flex items-center gap-1.5"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            type="button"
            data-window-control="playback"
            aria-label={isPlaying ? 'Jeda lagu' : 'Putar lagu'}
            title={isPlaying ? 'Jeda lagu' : 'Putar lagu'}
            onClick={() => {
              if (currentTrack) togglePlay();
            }}
            disabled={!currentTrack}
            className="w-8 h-8 shrink-0 rounded-full bg-white text-black flex items-center justify-center hover:bg-zinc-200 active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-default disabled:active:scale-100"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>

          <button
            type="button"
            data-window-control="restore"
            aria-label="Kembali ke jendela utama"
            title="Kembali ke jendela utama"
            onClick={restoreWindow}
            className={notchControlClass}
          >
            <PanelTopOpen className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            data-window-control="maximize"
            aria-label="Maximize jendela"
            title="Maximize jendela"
            onClick={maximizeWindow}
            className={notchControlClass}
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            data-window-control="close"
            aria-label="Sembunyikan ke tray"
            title="Sembunyikan ke tray"
            onClick={() => api?.close()}
            className={`${notchControlClass} hover:bg-white hover:text-black`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
