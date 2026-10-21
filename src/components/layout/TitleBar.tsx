import React from 'react';
import { Music } from 'lucide-react';

export const TitleBar: React.FC = () => {
  // Hanya tampilkan jika berjalan di lingkungan Electron Desktop
  const isElectron =
    typeof window !== 'undefined' &&
    (window.navigator?.userAgent?.includes('Electron') || (window as unknown as { electron?: unknown }).electron !== undefined);

  if (!isElectron) return null;

  return (
    <div
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      className="h-9 w-full bg-black border-b border-zinc-900 flex items-center justify-between px-3 select-none z-50 text-xs shrink-0"
    >
      <div className="flex items-center gap-2 font-medium">
        <Music className="w-3.5 h-3.5 text-white" />
        <span className="text-zinc-300">MusicFlow - Music Player</span>
      </div>
      {/* Area kosong di sisi kanan tempat tombol minimize, maximize, close berada */}
      <div
        className="w-36 h-full"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      />
    </div>
  );
};
