import React from 'react';
import { ArrowLeft, Play, Trash2, ListMusic } from 'lucide-react';
import { useLibrary } from '../../context/LibraryContext';
import { usePlayer } from '../../context/PlayerContext';
import { TrackItem } from './TrackItem';

interface PlaylistDetailProps {
  playlistId: string;
  onBack: () => void;
}

export const PlaylistDetail: React.FC<PlaylistDetailProps> = ({ playlistId, onBack }) => {
  const { playlists, tracks, deletePlaylist } = useLibrary();
  const { playTrack } = usePlayer();

  const playlist = playlists.find((p) => p.id === playlistId);

  if (!playlist) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-zinc-400">Playlist tidak ditemukan</p>
        <button
          onClick={onBack}
          className="mt-3 text-xs text-white hover:underline"
        >
          Kembali ke Daftar Playlist
        </button>
      </div>
    );
  }

  // Ambil lagu-lagu yang ada di playlist ini
  const playlistTracks = playlist.trackIds
    .map((id) => tracks.find((t) => t.id === id))
    .filter(Boolean) as typeof tracks;

  const handlePlayAll = () => {
    if (playlistTracks.length > 0) {
      playTrack(playlistTracks[0], playlistTracks);
    }
  };

  const handleDelete = async () => {
    if (window.confirm(`Hapus playlist "${playlist.name}"? (Lagu di dalamnya tidak akan terhapus dari koleksi)`)) {
      await deletePlaylist(playlist.id);
      onBack();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden flex-shrink-0 flex items-center justify-center shadow-lg">
            {playlistTracks[0]?.coverUrl ? (
              <img
                src={playlistTracks[0].coverUrl}
                alt={playlist.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <ListMusic className="w-12 h-12 text-white/50" />
            )}
          </div>
          <div>
            <span className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">
              Playlist
            </span>
            <h1 className="text-xl sm:text-3xl font-extrabold text-white mt-0.5">
              {playlist.name}
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              {playlist.description || `${playlistTracks.length} lagu`}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-end">
          {playlistTracks.length > 0 && (
            <button
              onClick={handlePlayAll}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white hover:bg-zinc-200 text-black font-semibold text-xs shadow-md active:scale-95 transition-all"
            >
              <Play className="w-4 h-4 fill-current" /> Putar Semua
            </button>
          )}

          {playlist.id !== 'favorites' && (
            <button
              onClick={handleDelete}
              title="Hapus Playlist"
              className="p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tracks in Playlist */}
      {playlistTracks.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <ListMusic className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium text-zinc-300">Playlist ini masih kosong</p>
          <p className="text-xs text-zinc-500 mt-1">
            Buka menu "Koleksi Lagu", klik tombol titik tiga (⋮) pada lagu, lalu pilih "Masukkan ke Playlist".
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {playlistTracks.map((track, idx) => (
            <TrackItem
              key={track.id}
              track={track}
              index={idx}
              allTracks={playlistTracks}
            />
          ))}
        </div>
      )}
    </div>
  );
};
