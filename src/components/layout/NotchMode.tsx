import React, { useEffect, useRef } from 'react';
import { Maximize2, Music, PanelTopOpen, Pause, Play, X } from 'lucide-react';
import { useDesktopWindow } from '../../context/DesktopWindowContext';
import { usePlayer, usePlayerProgress } from '../../context/PlayerContext';
import { formatDuration } from '../../utils/formatters';

const notchControlClass =
  'w-6 h-6 shrink-0 rounded flex items-center justify-center text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white focus:outline-none focus-visible:bg-zinc-800';

// Delay auto-shrink singkat agar notch cepat mengecil saat kursor tidak aktif,
// baik ketika kursor berada di dalam maupun di luar area notch.
const COLLAPSE_DELAY_MS = 500;

export const NotchMode: React.FC = () => {
  const { isNotchMode, notchDock = 'top', isNotchCollapsed = false } = useDesktopWindow();
  const {
    currentTrack,
    isPlaying,
    togglePlay,
    setIsPlayerModalOpen,
    setIsQueueModalOpen
  } = usePlayer();
  const { currentTime, duration } = usePlayerProgress();
  const api = window.musicflowDesktop;
  const wasNotchModeRef = useRef<boolean>(false);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bersihkan modal berat saat masuk ke mode notch
  useEffect(() => {
    if (isNotchMode && !wasNotchModeRef.current) {
      setIsPlayerModalOpen(false);
      setIsQueueModalOpen(false);
    }
    wasNotchModeRef.current = isNotchMode;
  }, [isNotchMode, setIsPlayerModalOpen, setIsQueueModalOpen]);

  // Manajemen auto-shrink setelah delay inaktivitas kursor (COLLAPSE_DELAY_MS)
  const clearCollapseTimer = () => {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
  };

  const scheduleCollapse = () => {
    clearCollapseTimer();
    collapseTimerRef.current = setTimeout(() => {
      void api?.setNotchCollapsed(true);
    }, COLLAPSE_DELAY_MS);
  };

  const handleMouseEnter = () => {
    clearCollapseTimer();
    if (isNotchCollapsed) {
      void api?.setNotchCollapsed(false);
    }
    scheduleCollapse();
  };

  const handleMouseMove = () => {
    if (isNotchCollapsed) {
      void api?.setNotchCollapsed(false);
    }
    scheduleCollapse();
  };

  const handleMouseLeave = () => {
    scheduleCollapse();
  };

  useEffect(() => {
    if (isNotchMode) {
      scheduleCollapse();
    }
    return () => {
      clearCollapseTimer();
    };
  }, [isNotchMode]);

  if (!isNotchMode) return null;

  const restoreWindow = () => {
    clearCollapseTimer();
    void api?.exitNotchMode({ maximize: false });
  };

  const maximizeWindow = () => {
    clearCollapseTimer();
    void api?.exitNotchMode({ maximize: true });
  };

  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('[data-window-control]')) return;
    restoreWindow();
  };

  const isLandscape = notchDock === 'top';
  const trackDuration = duration || currentTrack?.duration || 0;
  const formattedProgress = `${formatDuration(currentTime)} / ${formatDuration(trackDuration)}`;

  return (
    <div
      data-notch-mode="true"
      data-notch-dock={notchDock}
      data-notch-collapsed={isNotchCollapsed ? 'true' : 'false'}
      data-drag-region="true"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="h-screen w-screen bg-black overflow-hidden select-none"
    >
      {/* 1. Tampilan Landscape (Dock: Top) */}
      {isLandscape && (
        <div className="h-full w-full p-1 flex items-center justify-center">
          {isNotchCollapsed ? (
            /* Landscape - Collapsed Capsule (190 x 42) */
            <div
              key="landscape-collapsed"
              className="animate-notch-content-in w-full h-full rounded-full border border-zinc-800 bg-zinc-950 flex items-center justify-between px-2 gap-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.6)]"
            >
              <div className="w-7 h-7 shrink-0 rounded-full border border-zinc-800 bg-zinc-900 overflow-hidden flex items-center justify-center">
                {currentTrack?.coverUrl ? (
                  <img
                    src={currentTrack.coverUrl}
                    alt={currentTrack.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Music className="w-3.5 h-3.5 text-zinc-400" />
                )}
              </div>

              <div className="min-w-0 flex-1 text-center font-mono text-[10px] text-zinc-300 font-medium truncate tracking-tight">
                {formattedProgress}
              </div>

              <button
                type="button"
                data-window-control="playback"
                aria-label={isPlaying ? 'Jeda lagu' : 'Putar lagu'}
                title={isPlaying ? 'Jeda lagu' : 'Putar lagu'}
                onClick={() => {
                  if (currentTrack) togglePlay();
                }}
                disabled={!currentTrack}
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                className="w-6 h-6 shrink-0 rounded-full bg-white text-black flex items-center justify-center hover:bg-zinc-200 active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-default disabled:active:scale-100"
              >
                {isPlaying ? (
                  <Pause className="w-3 h-3 fill-current" />
                ) : (
                  <Play className="w-3 h-3 fill-current ml-0.5" />
                )}
              </button>
            </div>
          ) : (
            /* Landscape - Expanded Card (380 x 60) */
            <div
              key="landscape-expanded"
              className="animate-notch-content-in w-full h-full rounded-xl border border-zinc-800 bg-zinc-950 flex items-center gap-2 px-2.5 shadow-[0_6px_16px_rgba(0,0,0,0.6)]"
            >
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
                <p className="text-[9px] font-mono text-zinc-400 leading-tight mt-0.5">
                  {formattedProgress}
                </p>
              </div>

              <div
                className="flex items-center gap-1 shrink-0"
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
          )}
        </div>
      )}

      {/* 2. Tampilan Portrait (Dock: Left / Right) */}
      {!isLandscape && (
        <div className="h-full w-full p-1 flex items-center justify-center">
          {isNotchCollapsed ? (
            /* Portrait - Collapsed Capsule (48 x 140) */
            <div
              key="portrait-collapsed"
              className="animate-notch-content-in w-full h-full rounded-2xl border border-zinc-800 bg-zinc-950 flex flex-col items-center justify-between py-2 px-1 shadow-[0_4px_12px_rgba(0,0,0,0.6)]"
            >
              <div className="w-7 h-7 shrink-0 rounded-md border border-zinc-800 bg-zinc-900 overflow-hidden flex items-center justify-center">
                {currentTrack?.coverUrl ? (
                  <img
                    src={currentTrack.coverUrl}
                    alt={currentTrack.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Music className="w-3.5 h-3.5 text-zinc-400" />
                )}
              </div>

              <div className="flex flex-col items-center justify-center text-[9px] font-mono leading-none text-zinc-300">
                <span>{formatDuration(currentTime)}</span>
                <span className="text-zinc-600 my-0.5 text-[8px]">-</span>
                <span>{formatDuration(trackDuration)}</span>
              </div>

              <button
                type="button"
                data-window-control="playback"
                aria-label={isPlaying ? 'Jeda lagu' : 'Putar lagu'}
                title={isPlaying ? 'Jeda lagu' : 'Putar lagu'}
                onClick={() => {
                  if (currentTrack) togglePlay();
                }}
                disabled={!currentTrack}
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                className="w-7 h-7 shrink-0 rounded-full bg-white text-black flex items-center justify-center hover:bg-zinc-200 active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-default disabled:active:scale-100"
              >
                {isPlaying ? (
                  <Pause className="w-3 h-3 fill-current" />
                ) : (
                  <Play className="w-3 h-3 fill-current ml-0.5" />
                )}
              </button>
            </div>
          ) : (
            /* Portrait - Expanded Card (76 x 260) */
            <div
              key="portrait-expanded"
              className="animate-notch-content-in w-full h-full rounded-2xl border border-zinc-800 bg-zinc-950 flex flex-col items-center justify-between py-2 px-1 shadow-[0_6px_16px_rgba(0,0,0,0.6)] overflow-hidden"
            >
              {/* Mini Window Controls */}
              <div
                className="flex items-center justify-center gap-0.5 w-full shrink-0"
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              >
                <button
                  type="button"
                  data-window-control="restore"
                  aria-label="Kembali ke jendela utama"
                  title="Kembali ke jendela utama"
                  onClick={restoreWindow}
                  className="w-5 h-5 rounded flex items-center justify-center text-zinc-400 hover:bg-zinc-800 hover:text-white"
                >
                  <PanelTopOpen className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  data-window-control="maximize"
                  aria-label="Maximize jendela"
                  title="Maximize jendela"
                  onClick={maximizeWindow}
                  className="w-5 h-5 rounded flex items-center justify-center text-zinc-400 hover:bg-zinc-800 hover:text-white"
                >
                  <Maximize2 className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  data-window-control="close"
                  aria-label="Sembunyikan ke tray"
                  title="Sembunyikan ke tray"
                  onClick={() => api?.close()}
                  className="w-5 h-5 rounded flex items-center justify-center text-zinc-400 hover:bg-white hover:text-black"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>

              {/* Cover Art & Track Info */}
              <div className="flex flex-col items-center text-center w-full min-w-0 px-1 my-auto">
                <div className="w-12 h-12 shrink-0 rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden flex items-center justify-center mb-1.5 shadow-sm">
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

                <p className="text-[10px] font-semibold text-white truncate max-w-full leading-tight">
                  {currentTrack?.title || 'MusicFlow'}
                </p>
                <p className="text-[9px] text-zinc-500 truncate max-w-full leading-tight">
                  {currentTrack?.artist || 'Belum ada lagu'}
                </p>
                <p className="text-[8px] font-mono text-zinc-400 leading-tight mt-1">
                  {formatDuration(currentTime)} / {formatDuration(trackDuration)}
                </p>
              </div>

              {/* Play/Pause Button */}
              <div
                className="shrink-0 pt-1"
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
                  className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:bg-zinc-200 active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-default disabled:active:scale-100"
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
