import React, { useState, useEffect } from 'react';
import { Search, Plus, Radio, CheckCircle2, XCircle } from 'lucide-react';
import { useLibrary } from '../../context/LibraryContext';
import { YouTubeService } from '../../services/youtubeService';

interface NavbarProps {
  onOpenImport: () => void;
  activeTab: string;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenImport, activeTab }) => {
  const { searchQuery, setSearchQuery } = useLibrary();
  const [engineOnline, setEngineOnline] = useState<boolean>(false);

  useEffect(() => {
    const checkEngine = async () => {
      const ok = await YouTubeService.isLocalEngineAvailable();
      setEngineOnline(ok);
    };
    checkEngine();
    const interval = setInterval(checkEngine, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 border-b border-dark-border bg-dark-surface/80 backdrop-blur-md px-4 md:px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Brand info (Mobile) */}
      <div className="flex items-center gap-2 md:hidden">
        <div className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center font-bold">
          <Radio className="w-5 h-5 text-white animate-pulse" />
        </div>
        <span className="font-bold text-lg text-white">MusicFlow</span>
      </div>

      {/* Search Input */}
      {activeTab === 'tracks' && (
        <div className="relative flex-1 max-w-md mx-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Cari lagu atau artis..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/60 border border-dark-border rounded-full pl-9 pr-4 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-white transition-all"
          />
        </div>
      )}

      {/* Action Buttons & Engine Status */}
      <div className="flex items-center gap-3 ml-auto">
        {/* Engine Status Icon with Hover Tooltip */}
        <div className="relative group flex items-center">
          <div
            title={
              engineOnline
                ? 'Engine Lokal: Aktif (yt-dlp & FFmpeg berjalan di PC)'
                : 'Engine Publik: Aktif (Cloud Fallback)'
            }
            className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all cursor-help ${
              engineOnline
                ? 'bg-zinc-900 border-zinc-700 text-white shadow-sm'
                : 'bg-zinc-950 border-zinc-800 text-zinc-500'
            }`}
          >
            {engineOnline ? (
              <CheckCircle2 className="w-4 h-4 text-white" />
            ) : (
              <XCircle className="w-4 h-4 text-zinc-400" />
            )}
          </div>

          {/* Floating Tooltip saat kursor berada di daerah icon */}
          <div className="absolute right-0 top-full mt-2 hidden group-hover:flex flex-col items-end z-50 pointer-events-none">
            <div className="bg-zinc-900 text-white text-xs px-3 py-2 rounded-lg border border-zinc-700 shadow-2xl whitespace-nowrap">
              <div className="flex items-center gap-1.5 font-semibold">
                {engineOnline ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    <span>Engine Lokal: Aktif</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Engine Publik: Aktif</span>
                  </>
                )}
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {engineOnline
                  ? 'yt-dlp & FFmpeg lokal berjalan di background PC'
                  : 'Unduhan via cloud fallback standalone'}
              </p>
            </div>
          </div>
        </div>

        {/* Tombol Tambah Musik Lokal */}
        <button
          onClick={onOpenImport}
          className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-white hover:bg-zinc-200 text-black font-semibold text-xs md:text-sm shadow-md shadow-white/5 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span className="hidden sm:inline">Import Musik</span>
          <span className="sm:hidden">Import</span>
        </button>
      </div>
    </header>
  );
};
