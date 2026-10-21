import React, { useState } from 'react';
import { X, ListMusic } from 'lucide-react';
import { useLibrary } from '../../context/LibraryContext';

interface CreatePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (playlistId: string) => void;
}

export const CreatePlaylistModal: React.FC<CreatePlaylistModalProps> = ({
  isOpen,
  onClose,
  onCreated
}) => {
  const { createPlaylist } = useLibrary();
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const pl = await createPlaylist(name, description);
      setName('');
      setDescription('');
      onClose();
      onCreated(pl.id);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <ListMusic className="w-5 h-5 text-white" />
            <h3 className="font-bold text-base text-white">Buat Playlist Baru</h3>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Nama Playlist <span className="text-white font-bold">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Lagu Semangat, Santai Sore..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-white transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Deskripsi (Opsional)
            </label>
            <textarea
              placeholder="Keterangan singkat tentang playlist..."
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-white resize-none transition-colors"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-zinc-200 text-black disabled:opacity-50 transition-all shadow-md active:scale-95"
            >
              {isSubmitting ? 'Membuat...' : 'Buat Playlist'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
