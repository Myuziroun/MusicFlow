import React from 'react';
import { Music, ListMusic, Download } from 'lucide-react';
import { useLibrary } from '../../context/LibraryContext';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab }) => {
  const { downloadJobs } = useLibrary();

  const activeDownloads = downloadJobs.filter(
    (j) => j.status === 'downloading' || j.status === 'converting' || j.status === 'queued'
  ).length;

  const items = [
    { id: 'tracks', label: 'Lagu', icon: Music },
    { id: 'playlists', label: 'Playlist', icon: ListMusic },
    {
      id: 'youtube',
      label: 'Download',
      icon: Download,
      badge: activeDownloads > 0 ? activeDownloads : undefined
    }
  ];

  return (
    <nav className="md:hidden border-t border-zinc-850 bg-black px-2 py-1.5 flex justify-around items-center z-30 select-none pb-safe">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id || (item.id === 'playlists' && activeTab.startsWith('playlist-'));
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center justify-center flex-1 py-1 relative transition-colors ${
              isActive ? 'text-white font-semibold' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <div className="relative">
              <Icon className={`w-5 h-5 ${isActive ? 'scale-110 text-white' : 'text-zinc-400'}`} />
              {item.badge !== undefined && (
                <span className="absolute -top-1 -right-2 bg-white text-black text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
                  {item.badge}
                </span>
              )}
            </div>
            <span className="text-[11px] mt-1">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
