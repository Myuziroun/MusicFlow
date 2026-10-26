import React from 'react';
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';

interface NotchPlaybackControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  disabled?: boolean;
  showTrackSkip?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export const NotchPlaybackControls: React.FC<NotchPlaybackControlsProps> = ({
  isPlaying,
  onTogglePlay,
  onPrevious,
  onNext,
  disabled = false,
  showTrackSkip = true,
  size = 'md',
  className = ''
}) => {
  const isSm = size === 'sm';
  const playButtonSize = isSm ? 'w-6 h-6' : 'w-7 h-7';
  const playIconSize = isSm ? 'w-3 h-3' : 'w-3.5 h-3.5';
  const skipButtonClass =
    'w-6 h-6 shrink-0 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800/80 active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none';

  return (
    <div
      data-window-control="playback"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      className={`flex items-center gap-1 shrink-0 ${className}`}
    >
      {showTrackSkip && onPrevious && (
        <button
          type="button"
          data-window-control="playback"
          aria-label="Lagu sebelumnya"
          title="Lagu sebelumnya"
          onClick={onPrevious}
          disabled={disabled}
          className={skipButtonClass}
        >
          <SkipBack className="w-3.5 h-3.5 fill-current" />
        </button>
      )}

      <button
        type="button"
        data-window-control="playback"
        aria-label={isPlaying ? 'Jeda lagu' : 'Putar lagu'}
        title={isPlaying ? 'Jeda lagu' : 'Putar lagu'}
        onClick={onTogglePlay}
        disabled={disabled}
        className={`${playButtonSize} shrink-0 rounded-full bg-white text-black flex items-center justify-center hover:bg-zinc-200 active:scale-95 transition-all shadow-sm disabled:opacity-40 disabled:pointer-events-none`}
      >
        {isPlaying ? (
          <Pause className={`${playIconSize} fill-current`} />
        ) : (
          <Play className={`${playIconSize} fill-current ml-0.5`} />
        )}
      </button>

      {showTrackSkip && onNext && (
        <button
          type="button"
          data-window-control="playback"
          aria-label="Lagu berikutnya"
          title="Lagu berikutnya"
          onClick={onNext}
          disabled={disabled}
          className={skipButtonClass}
        >
          <SkipForward className="w-3.5 h-3.5 fill-current" />
        </button>
      )}
    </div>
  );
};
