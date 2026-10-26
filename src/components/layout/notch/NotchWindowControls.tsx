import React from 'react';
import { Maximize2, PanelTopOpen, X } from 'lucide-react';

interface NotchWindowControlsProps {
  onRestore: () => void;
  onMaximize: () => void;
  onClose: () => void;
  orientation?: 'row' | 'column';
  className?: string;
}

export const NotchWindowControls: React.FC<NotchWindowControlsProps> = ({
  onRestore,
  onMaximize,
  onClose,
  orientation = 'row',
  className = ''
}) => {
  const isRow = orientation === 'row';
  const controlBtnClass =
    'w-5 h-5 shrink-0 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors focus:outline-none focus-visible:bg-zinc-800';

  return (
    <div
      data-window-control="window"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      className={`flex ${isRow ? 'items-center gap-0.5' : 'flex-col items-center gap-0.5'} shrink-0 ${className}`}
    >
      <button
        type="button"
        data-window-control="restore"
        aria-label="Kembali ke jendela utama"
        title="Kembali ke jendela utama"
        onClick={onRestore}
        className={controlBtnClass}
      >
        <PanelTopOpen className="w-3 h-3" />
      </button>

      <button
        type="button"
        data-window-control="maximize"
        aria-label="Maximize jendela"
        title="Maximize jendela"
        onClick={onMaximize}
        className={controlBtnClass}
      >
        <Maximize2 className="w-3 h-3" />
      </button>

      <button
        type="button"
        data-window-control="close"
        aria-label="Sembunyikan ke tray"
        title="Sembunyikan ke tray"
        onClick={onClose}
        className={`${controlBtnClass} hover:bg-white hover:text-black`}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
};
