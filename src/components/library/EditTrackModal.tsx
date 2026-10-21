import React, { useState, useEffect } from 'react';
import { X, Edit3, Music } from 'lucide-react';
import type { Track } from '../../types/music';
import { useLibrary } from '../../context/LibraryContext';
import { usePlayer } from '../../context/PlayerContext';

interface EditTrackModalProps {
  track: Track | null;
  isOpen: boolean;
  onClose: () => void;
}

export const EditTrackModal: React.FC<EditTrackModalProps> = ({
  track,
  isOpen,
  onClose
}) => {
  const { updateTrack } = useLibrary();
  const { updateTrackInPlayer } = usePlayer();

  const [title, setTitle] = useState<string>('');
  const [artist, setArtist] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    if (track) {
      setTitle(track.title);
      setArtist(track.artist);
    }
  }, [track]);

  if (!isOpen || !track) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSaving(true);
    try {
      const updates = {
        title: title.trim(),
        artist: artist.trim() || 'Unknown Artist'
      };

      await updateTrack(track.id, updates);
      updateTrackInPlayer(track.id, updates);
      onClose();
    } catch (err) {
      console.error('Gagal memperbarui info lagu:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-white" />
            <h3 className="font-bold text-base text-white">Ubah Nama Musik</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Thumbnail Preview */}
        <div className="flex items-center gap-3.5 my-4 p-3 rounded-xl bg-black border border-zinc-800">
          <div className="w-12 h-12 rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800 flex-shrink-0 relative">
            {track.coverUrl ? (
              <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-500">
                <Music className="w-5 h-5" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-zinc-400">Sedang mengedit:</p>
            <h4 className="text-sm font-semibold text-zinc-200 truncate">{track.title}</h4>
          </div>
        </div>

        {/* Form Inputs */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Nama Musik / Judul Lagu <span className="text-white font-bold">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Masukkan judul lagu..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-white transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Nama Artis / Penyanyi
            </label>
            <input
              type="text"
              placeholder="Masukkan nama artis..."
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-white transition-colors"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving || !title.trim()}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-zinc-200 text-black disabled:opacity-50 transition-all shadow-md active:scale-95"
            >
              {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
