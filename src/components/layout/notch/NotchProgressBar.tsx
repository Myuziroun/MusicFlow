import React, { useRef, useState } from 'react';
import { formatDuration } from '../../../utils/formatters';

interface NotchProgressBarProps {
  currentTime: number;
  duration: number;
  onSeek: (seconds: number) => void;
  disabled?: boolean;
  className?: string;
}

export const NotchProgressBar: React.FC<NotchProgressBarProps> = ({
  currentTime,
  duration,
  onSeek,
  disabled = false,
  className = ''
}) => {
  const barRef = useRef<HTMLDivElement>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubRatio, setScrubRatio] = useState<number | null>(null);

  const safeDuration = duration > 0 ? duration : 0;
  const currentRatio = safeDuration > 0 ? Math.min(Math.max(currentTime / safeDuration, 0), 1) : 0;
  const displayRatio = scrubRatio !== null ? scrubRatio : currentRatio;
  const progressPercent = displayRatio * 100;

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || safeDuration <= 0) return;
    event.preventDefault();
    event.stopPropagation();

    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    setIsScrubbing(true);

    const rect = target.getBoundingClientRect();
    const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    setScrubRatio(ratio);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbing || !barRef.current || safeDuration <= 0) return;
    event.preventDefault();
    event.stopPropagation();

    const rect = barRef.current.getBoundingClientRect();
    const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    setScrubRatio(ratio);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbing) return;
    event.preventDefault();
    event.stopPropagation();

    if (barRef.current) {
      try {
        barRef.current.releasePointerCapture(event.pointerId);
      } catch {
        // Abaikan jika pointer capture telah terlepas
      }
    }

    if (scrubRatio !== null && safeDuration > 0) {
      onSeek(scrubRatio * safeDuration);
    }

    setIsScrubbing(false);
    setScrubRatio(null);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled || safeDuration <= 0) return;

    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault();
      onSeek(Math.min(currentTime + 5, safeDuration));
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault();
      onSeek(Math.max(currentTime - 5, 0));
    }
  };

  return (
    <div
      ref={barRef}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      data-window-control="seek"
      aria-label="Bilah progres lagu"
      aria-valuemin={0}
      aria-valuemax={safeDuration}
      aria-valuenow={Math.round(currentTime)}
      aria-valuetext={`${formatDuration(currentTime)} dari ${formatDuration(safeDuration)}`}
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
      className={`group relative flex items-center h-4 cursor-pointer select-none outline-none ${
        disabled ? 'pointer-events-none opacity-40' : ''
      } ${className}`}
    >
      {/* Background Track */}
      <div className="w-full h-[3px] group-hover:h-[4px] rounded-full bg-zinc-800 transition-all overflow-hidden relative">
        <div
          className="h-full bg-white rounded-full transition-[width] duration-75"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Scrubber Thumb */}
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-white opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 shadow-[0_0_6px_rgba(255,255,255,0.4)] transition-opacity pointer-events-none"
        style={{ left: `${progressPercent}%` }}
      />
    </div>
  );
};
