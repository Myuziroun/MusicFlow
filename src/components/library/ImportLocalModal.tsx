import React, { useState, useRef } from 'react';
import { X, Upload, CheckCircle2, Music } from 'lucide-react';
import { useLibrary } from '../../context/LibraryContext';

interface ImportLocalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImportLocalModal: React.FC<ImportLocalModalProps> = ({ isOpen, onClose }) => {
  const { importLocalFiles } = useLibrary();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    setSuccessCount(null);
    try {
      const count = await importLocalFiles(files);
      setSuccessCount(count);
      setTimeout(() => {
        onClose();
        setSuccessCount(null);
      }, 1500);
    } finally {
      setIsProcessing(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-white" />
            <h3 className="font-bold text-base text-white">Import File Musik Lokal</h3>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drag & Drop Area */}
        <div
          onDragOver={onDragOver}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className="mt-5 border-2 border-dashed border-zinc-800 hover:border-zinc-500 rounded-2xl p-8 text-center cursor-pointer bg-black/60 hover:bg-zinc-900/60 transition-all group"
        >
          <input
            type="file"
            ref={fileInputRef}
            multiple
            accept="audio/*,.mp3,.m4a,.wav,.ogg,.flac"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
          />

          {isProcessing ? (
            <div className="py-4 space-y-3">
              <div className="w-10 h-10 border-4 border-zinc-800 border-t-white rounded-full animate-spin mx-auto" />
              <p className="text-sm font-semibold text-zinc-200">
                Membaca & Menyimpan File Musik...
              </p>
              <p className="text-xs text-zinc-400">
                Mengekstrak ID3 Tag (Cover, Judul, Artis)
              </p>
            </div>
          ) : successCount !== null ? (
            <div className="py-4 space-y-2 text-white">
              <CheckCircle2 className="w-12 h-12 mx-auto text-white" />
              <p className="text-sm font-bold">
                Berhasil menambahkan {successCount} lagu!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-full bg-zinc-900 text-white flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                <Music className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  Pilih file musik dari perangkat Anda
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                  Mendukung file .mp3, .m4a, .wav, .flac
                </p>
              </div>
              <button
                type="button"
                className="mt-2 inline-block px-4 py-1.5 rounded-full bg-white hover:bg-zinc-200 text-xs font-semibold text-black transition-colors"
              >
                Pilih File dari HP / Komputer
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 text-[11px] text-zinc-500 text-center">
          File disimpan secara lokal di browser/perangkat Anda tanpa diunggah ke server eksternal.
        </div>
      </div>
    </div>
  );
};
