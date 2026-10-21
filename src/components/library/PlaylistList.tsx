import React from 'react';
import { Plus, ListMusic, Music } from 'lucide-react';
import { useLibrary } from '../../context/LibraryContext';

interface PlaylistListProps {
  onSelectPlaylist: (playlistId: string) => void;
  onOpenCreateModal: () => void;
}

export const PlaylistList: React.FC<PlaylistListProps> = ({
  onSelectPlaylist,
  onOpenCreateModal
}) => {
  const { playlists, tracks } = useLibrary();

  // Helper untuk mendapatkan thumbnail cover dari lagu pertama dalam playlist
  const getPlaylistCover = (trackIds: string[]) => {
    if (!trackIds || trackIds.length === 0) return null;
    const firstTrack = tracks.find((t) => t.id === trackIds[0]);
    return firstTrack?.coverUrl || null;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">Daftar Playlist</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            {playlists.length} koleksi playlist pribadi
          </p>
        </div>
        <button
          onClick={onOpenCreateModal}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-zinc-200 text-black font-semibold text-xs transition-all shadow-md active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" /> Buat Playlist
        </button>
      </div>

      {/* Grid Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {/* Create Card Button */}
        <div
          onClick={onOpenCreateModal}
          className="aspect-square rounded-2xl border-2 border-dashed border-zinc-800 hover:border-zinc-500 bg-zinc-950/60 hover:bg-zinc-900/60 flex flex-col items-center justify-center p-4 cursor-pointer group transition-all"
        >
          <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center group-hover:scale-110 group-hover:bg-white text-zinc-400 group-hover:text-black transition-all mb-2">
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </div>
          <span className="text-xs font-semibold text-zinc-400 group-hover:text-white">
            Buat Baru
          </span>
        </div>

        {/* Playlists Cards */}
        {playlists.map((pl) => {
          const cover = pl.coverUrl || getPlaylistCover(pl.trackIds);
          return (
            <div
              key={pl.id}
              onClick={() => onSelectPlaylist(pl.id)}
              className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-3 flex flex-col cursor-pointer group transition-all shadow-lg"
            >
              <div className="aspect-square rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 relative mb-2.5">
                {cover ? (
                  <img
                    src={cover}
                    alt={pl.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-600 bg-zinc-900">
                    <ListMusic className="w-10 h-10 text-zinc-500" />
                  </div>
                )}
                <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-full text-[10px] text-zinc-300 font-semibold flex items-center gap-1 border border-zinc-800">
                  <Music className="w-2.5 h-2.5" /> {pl.trackIds.length}
                </div>
              </div>

              <h4 className="font-semibold text-sm text-white truncate group-hover:text-zinc-300 transition-colors">
                {pl.name}
              </h4>
              <p className="text-xs text-zinc-400 truncate mt-0.5">
                {pl.description || `${pl.trackIds.length} lagu`}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
