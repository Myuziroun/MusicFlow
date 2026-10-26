import React from 'react';

interface NotchEqualizerProps {
  isPlaying: boolean;
  className?: string;
}

export const NotchEqualizer: React.FC<NotchEqualizerProps> = ({ isPlaying, className = '' }) => {
  return (
    <div
      aria-hidden="true"
      className={`flex items-end gap-[2px] h-3 px-0.5 ${isPlaying ? 'opacity-90' : 'opacity-40'} ${className}`}
      title={isPlaying ? 'Audio sedang diputar' : 'Audio dijeda'}
    >
      <span
        className={`w-[2px] h-3 bg-white rounded-full ${
          isPlaying ? 'animate-notch-eq' : 'scale-y-[0.3] origin-bottom'
        }`}
      />
      <span
        className={`w-[2px] h-3 bg-white rounded-full ${
          isPlaying ? 'animate-notch-eq animate-notch-eq-delay-1' : 'scale-y-[0.5] origin-bottom'
        }`}
      />
      <span
        className={`w-[2px] h-3 bg-white rounded-full ${
          isPlaying ? 'animate-notch-eq animate-notch-eq-delay-2' : 'scale-y-[0.7] origin-bottom'
        }`}
      />
      <span
        className={`w-[2px] h-3 bg-white rounded-full ${
          isPlaying ? 'animate-notch-eq animate-notch-eq-delay-3' : 'scale-y-[0.3] origin-bottom'
        }`}
      />
    </div>
  );
};
