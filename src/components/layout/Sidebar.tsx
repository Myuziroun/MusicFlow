import React from 'react';
import { Music, ListMusic, Download, Radio } from 'lucide-react';
import { useLibrary } from '../../context/LibraryContext';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { tracks, playlists, downloadJobs } = useLibrary();

  const activeDownloadsCount = downloadJobs.filter(
    (j) => j.status === 'downloading' || j.status === 'converting' || j.status === 'queued'
  ).length;

  const navItems = [
    {
      id: 'tracks',
      label: 'Koleksi Lagu',
      icon: Music,
      badge: tracks.length > 0 ? tracks.length : undefined
    },
    {
      id: 'playlists',
      label: 'Playlist',
      icon: ListMusic,
      badge: playlists.length > 0 ? playlists.length : undefined
    },
    {
      id: 'youtube',
      label: 'Download Musik',
      icon: Download,
      badge: activeDownloadsCount > 0 ? activeDownloadsCount : undefined,
      badgeColor: 'bg-white text-black'
    }
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 border-r border-dark-border bg-black p-4 select-none">
      {/* Logo Header */}
      <div className="flex items-center gap-3 px-3 py-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center shadow-lg shadow-white/10">
          <Radio className="w-6 h-6 stroke-[2.5]" />
        </div>
        <div>
          <h1 className="font-extrabold text-lg text-white tracking-tight flex items-center gap-1.5">
            MusicFlow <Music className="w-4 h-4 text-white" />
          </h1>
          <p className="text-xs text-zinc-400">Offline & Downloader</p>
        </div>
      </div>

      {/* Nav Menu */}
      <nav className="space-y-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-medium text-sm transition-all ${
                isActive
                  ? 'bg-white/15 text-white shadow-sm border border-white/20 font-semibold'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-zinc-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    item.badgeColor || 'bg-zinc-800 text-zinc-200'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Quick Playlists Section */}
      <div className="mt-8 flex-1 overflow-y-auto pr-1">
        <div className="text-xs font-semibold text-zinc-500 uppercase px-3 mb-2 tracking-wider">
          Playlist Saya
        </div>
        <div className="space-y-1">
          {playlists.map((pl) => (
            <button
              key={pl.id}
              onClick={() => setActiveTab(`playlist-${pl.id}`)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs truncate transition-colors ${
                activeTab === `playlist-${pl.id}`
                  ? 'text-white font-semibold bg-zinc-800'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
              }`}
            >
              {pl.name}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
};
