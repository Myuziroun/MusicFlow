import React, { useState } from 'react';
import { Play, Pause, MoreVertical, Trash2, Plus, Music, Youtube, HardDrive, Edit3, QrCode } from 'lucide-react';
import type { Track } from '../../types/music';
import { usePlayer } from '../../context/PlayerContext';
import { useLibrary } from '../../context/LibraryContext';
import { formatDuration } from '../../utils/formatters';
import { EditTrackModal } from './EditTrackModal';
import { ShareModal } from '../share/ShareModal';

interface TrackItemProps {
  track: Track;
  index: number;
  allTracks: Track[];
}

export const TrackItem: React.FC<TrackItemProps> = ({ track, index, allTracks }) => {
  const { currentTrack, isPlaying, playTrack, togglePlay, addToQueue } = usePlayer();
  const { deleteTrack, playlists, addTrackToPlaylist } = useLibrary();

  const [showMenu, setShowMenu] = useState<boolean>(false);
  const [showPlaylistSubmenu, setShowPlaylistSubmenu] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);

  const isCurrent = currentTrack?.id === track.id;

  const handlePlay = () => {
    if (isCurrent) {
      togglePlay();
    } else {
      playTrack(track, allTracks);
    }
  };

  return (
    <div
      className={`group flex items-center justify-between p-2.5 sm:p-3 rounded-xl transition-all ${
        isCurrent ? 'bg-white/10 border border-white/20' : 'hover:bg-zinc-900/60'
      }`}
    >
      {/* Left: Index / Play Button & Album Art & Title */}
      <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
        {/* Play indicator / Track number */}
        <div
          onClick={handlePlay}
          className="w-7 h-7 flex items-center justify-center cursor-pointer flex-shrink-0 text-zinc-400 group-hover:text-white"
        >
          {isCurrent && isPlaying ? (
            <Pause className="w-5 h-5 text-white fill-current" />
          ) : isCurrent && !isPlaying ? (
            <Play className="w-5 h-5 text-white fill-current" />
          ) : (
            <>
              <span className="group-hover:hidden text-xs font-medium text-zinc-500">
                {index + 1}
              </span>
              <Play className="hidden group-hover:block w-4 h-4 fill-current text-white" />
            </>
          )}
        </div>

        {/* Thumbnail */}
        <div
          onClick={handlePlay}
          className="w-11 h-11 rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800 flex-shrink-0 cursor-pointer shadow-sm relative"
        >
          {track.coverUrl ? (
            <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-500 bg-zinc-900">
              <Music className="w-5 h-5" />
            </div>
          )}
        </div>

        {/* Title & Artist */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={handlePlay}>
          <h4
            className={`text-sm font-semibold truncate ${
              isCurrent ? 'text-white font-bold' : 'text-zinc-100 group-hover:text-white'
            }`}
          >
            {track.title}
          </h4>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-zinc-400 truncate max-w-[150px] sm:max-w-none">
              {track.artist}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded bg-zinc-900 text-zinc-300 border border-zinc-800">
              {track.source === 'youtube' ? (
                <>
                  <Youtube className="w-2.5 h-2.5 text-zinc-300" /> YT
                </>
              ) : (
                <>
                  <HardDrive className="w-2.5 h-2.5 text-zinc-300" /> MP3
                </>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Right: Duration & Actions Menu */}
      <div className="flex items-center gap-3 relative">
        <span className="text-xs text-zinc-400 hidden sm:inline">
          {formatDuration(track.duration)}
        </span>

        {/* More Menu Button */}
        <div className="relative">
          <button
            onClick={() => setShowMenu((prev) => !prev)}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {/* Dropdown Menu */}
          {showMenu && (
            <div
              onMouseLeave={() => {
                setShowMenu(false);
                setShowPlaylistSubmenu(false);
              }}
              className="absolute right-0 top-8 z-30 w-48 bg-zinc-950 border border-zinc-800 rounded-xl shadow-xl py-1 text-xs text-zinc-200 animate-in fade-in zoom-in-95"
            >
              <button
                onClick={() => {
                  addToQueue(track);
                  setShowMenu(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-zinc-900 flex items-center gap-2"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah ke Antrean
              </button>

              <div className="relative">
                <button
                  onClick={() => setShowPlaylistSubmenu((prev) => !prev)}
                  className="w-full text-left px-3 py-2 hover:bg-zinc-900 flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Plus className="w-3.5 h-3.5" /> Masukkan ke Playlist
                  </span>
                  <span>▸</span>
                </button>

                {showPlaylistSubmenu && (
                  <div className="absolute right-full top-0 w-44 bg-zinc-950 border border-zinc-800 rounded-xl shadow-xl py-1 text-xs">
                    {playlists.length === 0 ? (
                      <div className="px-3 py-2 text-zinc-500">Belum ada playlist</div>
                    ) : (
                      playlists.map((pl) => (
                        <button
                          key={pl.id}
                          onClick={() => {
                            addTrackToPlaylist(pl.id, track.id);
                            setShowMenu(false);
                            setShowPlaylistSubmenu(false);
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-zinc-900 truncate"
                        >
                          {pl.name}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="border-t border-zinc-800 my-1" />

              <button
                onClick={() => {
                  setIsShareModalOpen(true);
                  setShowMenu(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-zinc-900 flex items-center gap-2 text-zinc-200"
              >
                <QrCode className="w-3.5 h-3.5 text-white" /> Bagikan Lagu (ShareFlow)
              </button>

              <button
                onClick={() => {
                  setIsEditModalOpen(true);
                  setShowMenu(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-zinc-900 flex items-center gap-2 text-zinc-200"
              >
                <Edit3 className="w-3.5 h-3.5 text-white" /> Ubah Nama Musik
              </button>

              <button
                onClick={() => {
                  deleteTrack(track.id);
                  setShowMenu(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-zinc-900 text-zinc-400 hover:text-white flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" /> Hapus dari Koleksi
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Edit Track Metadata Modal */}
      <EditTrackModal
        track={track}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
      />

      {/* ShareFlow P2P Modal */}
      <ShareModal
        track={track}
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
      />
    </div>
  );
};
