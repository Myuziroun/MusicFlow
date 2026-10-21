import React from 'react';
import { Play, Shuffle, Music, Download, Upload } from 'lucide-react';
import { useLibrary } from '../../context/LibraryContext';
import { usePlayer } from '../../context/PlayerContext';
import { TrackItem } from './TrackItem';

interface TrackListProps {
  onOpenImport: () => void;
  onGoToDownload: () => void;
}

export const TrackList: React.FC<TrackListProps> = ({ onOpenImport, onGoToDownload }) => {
  const { filteredTracks, tracks, searchQuery } = useLibrary();
  const { playTrack } = usePlayer();

  const handlePlayAll = () => {
    if (filteredTracks.length > 0) {
      playTrack(filteredTracks[0], filteredTracks);
    }
  };

  const handleShuffleAll = () => {
    if (filteredTracks.length > 0) {
      const shuffled = [...filteredTracks].sort(() => Math.random() - 0.5);
      playTrack(shuffled[0], shuffled);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header bar: Title & Quick Play Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">Semua Lagu</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            {tracks.length} lagu tersimpan di memori perangkat
            {searchQuery && ` (Ditemukan: ${filteredTracks.length})`}
          </p>
        </div>

        {filteredTracks.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handlePlayAll}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-zinc-200 text-black font-semibold text-xs transition-all shadow-md active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-current" /> Putar Semua
            </button>
            <button
              onClick={handleShuffleAll}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-semibold text-xs transition-all border border-zinc-800 active:scale-95"
            >
              <Shuffle className="w-3.5 h-3.5" /> Acak
            </button>
          </div>
        )}
      </div>

      {/* Track List Items */}
      {filteredTracks.length === 0 ? (
        <div className="text-center py-20 px-4">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-4 text-zinc-500">
            <Music className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-zinc-200">
            {searchQuery ? 'Tidak ada lagu yang cocok' : 'Belum Ada Musik Tersimpan'}
          </h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1 mb-6">
            {searchQuery
              ? `Tidak ditemukan lagu dengan kata kunci "${searchQuery}"`
              : 'Anda dapat mengimpor file MP3 dari memori HP atau langsung mendownload lagu favorit Anda.'}
          </p>

          {!searchQuery && (
            <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={onOpenImport}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-semibold border border-zinc-800 transition-colors"
              >
                <Upload className="w-4 h-4" /> Import File Lokal
              </button>
              <button
                onClick={onGoToDownload}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow-md transition-all"
              >
                <Download className="w-4 h-4 stroke-[2.5]" /> Download Musik
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          {filteredTracks.map((track, index) => (
            <TrackItem
              key={track.id}
              track={track}
              index={index}
              allTracks={filteredTracks}
            />
          ))}
        </div>
      )}
    </div>
  );
};
