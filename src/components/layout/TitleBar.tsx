import React from 'react';
import { Copy, Maximize2, Minus, Music, PanelTop, X } from 'lucide-react';
import { useDesktopWindow } from '../../context/DesktopWindowContext';

const controlButtonClass =
  'w-10 h-full flex items-center justify-center text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white focus:outline-none focus-visible:bg-zinc-800';

export const TitleBar: React.FC = () => {
  const { isDesktop, isMaximized } = useDesktopWindow();
  const api = window.musicflowDesktop;

  if (!isDesktop) return null;

  return (
    <div
      data-drag-region="true"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      className="h-9 w-full shrink-0 border-b border-zinc-900 bg-black flex items-center justify-between pl-3 pr-0 select-none text-xs z-50"
    >
      <div className="flex items-center gap-2 font-medium min-w-0 pr-4">
        <Music className="w-3.5 h-3.5 text-white shrink-0" />
        <span className="text-zinc-300 truncate">MusicFlow - Music Player</span>
      </div>

      <div
        className="flex items-center h-full"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          type="button"
          data-window-control="notch"
          aria-label="Mode notch"
          title="Mode notch bebas"
          onClick={() => api?.enterNotchMode()}
          className={controlButtonClass}
        >
          <PanelTop className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          data-window-control="minimize"
          aria-label="Minimize ke taskbar"
          title="Minimize ke taskbar"
          onClick={() => api?.minimize()}
          className={controlButtonClass}
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          data-window-control="maximize"
          aria-label={isMaximized ? 'Restore jendela' : 'Maximize jendela'}
          title={isMaximized ? 'Restore jendela' : 'Maximize jendela'}
          onClick={() => api?.toggleMaximize()}
          className={controlButtonClass}
        >
          {isMaximized ? <Copy className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>

        <button
          type="button"
          data-window-control="close"
          aria-label="Sembunyikan ke tray"
          title="Sembunyikan ke tray"
          onClick={() => api?.close()}
          className={`${controlButtonClass} hover:bg-white hover:text-black`}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
