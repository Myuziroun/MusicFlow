import React, { useEffect, useRef } from 'react';
import { Music } from 'lucide-react';
import { useDesktopWindow } from '../../context/DesktopWindowContext';
import { usePlayer, usePlayerProgress } from '../../context/PlayerContext';
import { formatDuration } from '../../utils/formatters';
import { NotchEqualizer } from './notch/NotchEqualizer';
import { NotchProgressBar } from './notch/NotchProgressBar';
import { NotchPlaybackControls } from './notch/NotchPlaybackControls';
import { NotchWindowControls } from './notch/NotchWindowControls';

// NOTE: Deteksi kursor untuk ekspansi/menciut dilakukan oleh main process.
// Area drag pada window notch menelan event mouse di renderer sehingga hover
// tidak pernah terdeteksi di area selain elemen no-drag.
export const NotchMode: React.FC = () => {
  const { isNotchMode, notchDock = 'top', isNotchCollapsed = false } = useDesktopWindow();
  const {
    currentTrack,
    isPlaying,
    togglePlay,
    nextTrack,
    previousTrack,
    seek,
    setIsPlayerModalOpen,
    setIsQueueModalOpen
  } = usePlayer();
  const { currentTime, duration } = usePlayerProgress();
  const api = window.musicflowDesktop;
  const wasNotchModeRef = useRef<boolean>(false);

  // Bersihkan modal berat saat masuk ke mode notch
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

  const closeWindow = () => {
    void api?.close();
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
      className="h-screen w-screen bg-zinc-950 overflow-hidden select-none"
    >
      {/* 1. Tampilan Landscape (Dock: Top) */}
      {isLandscape && (
        <div className="h-full w-full">
          {isNotchCollapsed ? (
            /* Landscape - Collapsed Capsule (190 x 42) */
            <div
              key="landscape-collapsed"
              className="animate-notch-content-in w-full h-full rounded-full border border-zinc-800 bg-zinc-950 flex items-center justify-between px-2.5 gap-2"
            >
              {/* Cover Art Mini tanpa border tambahan */}
              <div className="w-6 h-6 shrink-0 rounded-full bg-zinc-900 overflow-hidden flex items-center justify-center">
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

              {/* Durasi Pemutaran */}
              <div className="min-w-0 flex-1 text-center font-mono text-[10px] text-zinc-300 font-medium truncate tracking-tight">
                {formattedProgress}
              </div>

              {/* Tombol Play/Pause */}
              <NotchPlaybackControls
                isPlaying={isPlaying}
                onTogglePlay={togglePlay}
                disabled={!currentTrack}
                showTrackSkip={false}
                size="sm"
              />
            </div>
          ) : (
            /* Landscape - Expanded Card (400 x 68) */
            <div
              key="landscape-expanded"
              className="animate-notch-content-in w-full h-full rounded-2xl border border-zinc-800 bg-zinc-950 flex items-center px-3 gap-2.5"
            >
              {/* Cover Art tanpa border ganda */}
              <div className="w-11 h-11 shrink-0 rounded-xl bg-zinc-900 overflow-hidden flex items-center justify-center shadow-sm">
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

              {/* Informasi Lagu, Equalizer, dan Bilah Progres */}
              <div className="min-w-0 flex-1 flex flex-col justify-center">
                {/* Baris Atas: Judul, Artis, dan Equalizer */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[11px] font-semibold text-white truncate leading-tight">
                    {currentTrack?.title || 'MusicFlow'}
                  </span>
                  <span className="text-[10px] text-zinc-500 truncate leading-tight">
                    {currentTrack?.artist ? `• ${currentTrack.artist}` : '• Pemutar Musik'}
                  </span>
                  {currentTrack && (
                    <NotchEqualizer isPlaying={isPlaying} className="ml-auto shrink-0 mr-1" />
                  )}
                </div>

                {/* Baris Bawah: Bilah Progres Seekable & Waktu */}
                <div className="flex items-center gap-1.5 w-full mt-1">
                  <span className="text-[9px] font-mono text-zinc-400 shrink-0 select-none">
                    {formatDuration(currentTime)}
                  </span>
                  <NotchProgressBar
                    currentTime={currentTime}
                    duration={trackDuration}
                    onSeek={seek}
                    disabled={!currentTrack}
                    className="flex-1 min-w-0"
                  />
                  <span className="text-[9px] font-mono text-zinc-500 shrink-0 select-none">
                    {formatDuration(trackDuration)}
                  </span>
                </div>
              </div>

              {/* Pemisah Vertikal Halus */}
              <div className="w-[1px] h-8 bg-zinc-850 shrink-0" />

              {/* Sisi Kanan: Kontrol Jendela (Atas) & Kontrol Musik (Bawah) */}
              <div className="flex flex-col items-end justify-between h-11 shrink-0">
                <NotchWindowControls
                  onRestore={restoreWindow}
                  onMaximize={maximizeWindow}
                  onClose={closeWindow}
                  orientation="row"
                />

                <NotchPlaybackControls
                  isPlaying={isPlaying}
                  onTogglePlay={togglePlay}
                  onPrevious={previousTrack}
                  onNext={nextTrack}
                  disabled={!currentTrack}
                  showTrackSkip={true}
                  size="sm"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. Tampilan Portrait (Dock: Left / Right) */}
      {!isLandscape && (
        <div className="h-full w-full">
          {isNotchCollapsed ? (
            /* Portrait - Collapsed Capsule (48 x 140) */
            <div
              key="portrait-collapsed"
              className="animate-notch-content-in w-full h-full rounded-2xl border border-zinc-800 bg-zinc-950 flex flex-col items-center justify-between py-2 px-1"
            >
              {/* Cover Art Mini tanpa border tambahan */}
              <div className="w-7 h-7 shrink-0 rounded-lg bg-zinc-900 overflow-hidden flex items-center justify-center">
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

              {/* Teks Durasi Vertikal */}
              <div className="flex flex-col items-center justify-center text-[9px] font-mono leading-none text-zinc-300">
                <span>{formatDuration(currentTime)}</span>
                <span className="text-zinc-600 my-0.5 text-[8px]">-</span>
                <span>{formatDuration(trackDuration)}</span>
              </div>

              {/* Tombol Play/Pause */}
              <NotchPlaybackControls
                isPlaying={isPlaying}
                onTogglePlay={togglePlay}
                disabled={!currentTrack}
                showTrackSkip={false}
                size="sm"
              />
            </div>
          ) : (
            /* Portrait - Expanded Card (84 x 300) */
            <div
              key="portrait-expanded"
              className="animate-notch-content-in w-full h-full rounded-2xl border border-zinc-800 bg-zinc-950 flex flex-col items-center justify-between py-2.5 px-1.5 overflow-hidden"
            >
              {/* Mini Window Controls di Atas */}
              <NotchWindowControls
                onRestore={restoreWindow}
                onMaximize={maximizeWindow}
                onClose={closeWindow}
                orientation="row"
              />

              {/* Cover Art & Track Info di Tengah */}
              <div className="flex flex-col items-center text-center w-full min-w-0 px-1 my-auto">
                <div className="w-13 h-13 shrink-0 rounded-xl bg-zinc-900 overflow-hidden flex items-center justify-center mb-1.5 shadow-sm">
                  {currentTrack?.coverUrl ? (
                    <img
                      src={currentTrack.coverUrl}
                      alt={currentTrack.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Music className="w-6 h-6 text-zinc-400" />
                  )}
                </div>

                <p className="text-[10px] font-semibold text-white truncate max-w-full leading-tight">
                  {currentTrack?.title || 'MusicFlow'}
                </p>
                <p className="text-[9px] text-zinc-500 truncate max-w-full leading-tight">
                  {currentTrack?.artist || 'Belum ada lagu'}
                </p>

                {currentTrack && (
                  <div className="my-1">
                    <NotchEqualizer isPlaying={isPlaying} />
                  </div>
                )}

                {/* Bilah Progres & Waktu */}
                <div className="w-full px-0.5 mt-1">
                  <NotchProgressBar
                    currentTime={currentTime}
                    duration={trackDuration}
                    onSeek={seek}
                    disabled={!currentTrack}
                    className="w-full"
                  />
                  <div className="flex items-center justify-between text-[8px] font-mono text-zinc-500 mt-0.5 px-0.5">
                    <span>{formatDuration(currentTime)}</span>
                    <span>{formatDuration(trackDuration)}</span>
                  </div>
                </div>
              </div>

              {/* Kontrol Musik Lengkap di Bawah (Prev, Play/Pause, Next) */}
              <NotchPlaybackControls
                isPlaying={isPlaying}
                onTogglePlay={togglePlay}
                onPrevious={previousTrack}
                onNext={nextTrack}
                disabled={!currentTrack}
                showTrackSkip={true}
                size="sm"
                className="pt-1"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
