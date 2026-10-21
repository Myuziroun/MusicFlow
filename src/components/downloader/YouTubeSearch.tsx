import React, { useState } from 'react';
import { Search, Download, Youtube, Loader2, Music, Check, Sparkles, Copy, ClipboardPaste } from 'lucide-react';
import { YouTubeService } from '../../services/youtubeService';
import type { YouTubeSearchResult } from '../../types/music';
import { useLibrary } from '../../context/LibraryContext';
import { DownloadQueue } from './DownloadQueue';

export const YouTubeSearch: React.FC = () => {
  const { startDownload, downloadJobs } = useLibrary();

  const [query, setQuery] = useState<string>('');
  const [bitrate, setBitrate] = useState<128 | 192 | 320>(192);
  const [results, setResults] = useState<YouTubeSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [pasteStatus, setPasteStatus] = useState<string | null>(null);
  const [inputCopied, setInputCopied] = useState<boolean>(false);

  const executeSearch = async (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    setIsSearching(true);
    setSearchError(null);
    try {
      const data = await YouTubeService.search(trimmed);
      setResults(data);
      if (data.length === 0) {
        setSearchError('Tidak ada video yang ditemukan. Pastikan kata kunci atau link benar.');
      }
    } catch (err) {
      console.error(err);
      setSearchError('Gagal mencari video. Pastikan koneksi internet aktif.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    executeSearch(query);
  };

  const handlePasteOrCopy = async () => {
    try {
      // 1. Coba baca link dari clipboard
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          const clean = text.trim();
          setQuery(clean);
          setPasteStatus('Link Ditempel!');
          setTimeout(() => setPasteStatus(null), 2000);
          executeSearch(clean);
          return;
        }
      }
    } catch (err) {
      console.warn('Gagal membaca clipboard:', err);
    }

    // 2. Fallback: jika input sudah berisi teks, salin ke clipboard
    if (query.trim()) {
      try {
        await navigator.clipboard.writeText(query.trim());
        setPasteStatus('Link Tersalin!');
        setTimeout(() => setPasteStatus(null), 2000);
      } catch (err) {
        console.warn('Gagal menyalin ke clipboard:', err);
      }
    }
  };

  const handleCopyInput = async () => {
    if (!query.trim()) return;
    try {
      await navigator.clipboard.writeText(query.trim());
      setInputCopied(true);
      setTimeout(() => setInputCopied(false), 2000);
    } catch (err) {
      console.warn('Gagal menyalin link:', err);
    }
  };

  const isDownloading = (youtubeId: string) => {
    return downloadJobs.some(
      (j) => j.youtubeId === youtubeId && (j.status === 'downloading' || j.status === 'converting')
    );
  };

  const isDownloaded = (youtubeId: string) => {
    return downloadJobs.some(
      (j) => j.youtubeId === youtubeId && j.status === 'completed'
    );
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
          <Youtube className="w-6 h-6 text-white" />
          <span>Download Musik</span>
        </h2>
        <p className="text-xs text-zinc-400 mt-1">
          Cari judul lagu atau tempel URL video/musik. Audio otomatis dikonversi ke format .mp3 dengan cover art.
        </p>
      </div>

      {/* Search Input & Options Bar */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2.5">
          {/* Input Bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Ketik judul lagu, artis, atau paste link https://youtu.be/..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-black border border-zinc-800 rounded-xl pl-10 pr-16 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-white transition-colors"
            />
            {query.trim() && (
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleCopyInput}
                  title="Salin link di kolom ini"
                  className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  {inputCopied ? (
                    <Check className="w-3.5 h-3.5 text-white" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  title="Hapus teks"
                  className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors text-xs"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Tombol Salin / Tempel Link (Sebelah Tombol Cari) */}
          <button
            type="button"
            onClick={handlePasteOrCopy}
            title="Salin / Tempel link dari clipboard untuk mencari video"
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white font-medium text-xs sm:text-sm transition-all border border-zinc-800 active:scale-95 flex-shrink-0"
          >
            {pasteStatus ? (
              <>
                <Check className="w-4 h-4 text-white" />
                <span className="text-white font-semibold">{pasteStatus}</span>
              </>
            ) : (
              <>
                <ClipboardPaste className="w-4 h-4 text-zinc-300" />
                <span>Salin / Tempel Link</span>
              </>
            )}
          </button>

          {/* Tombol Cari */}
          <button
            type="submit"
            disabled={isSearching || !query.trim()}
            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-sm disabled:opacity-50 transition-all shadow-md active:scale-95 flex-shrink-0"
          >
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 stroke-[2.5]" />}
            <span>Cari</span>
          </button>
        </form>

        {/* Bitrate Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-800 text-xs">
          <div className="flex items-center gap-2 text-zinc-400">
            <Sparkles className="w-4 h-4 text-white" />
            <span>Kualitas MP3:</span>
          </div>
          <div className="flex items-center gap-2">
            {([128, 192, 320] as const).map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => setBitrate(rate)}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  bitrate === rate
                    ? 'bg-white text-black shadow-sm'
                    : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                }`}
              >
                {rate} kbps {rate === 192 ? '(Rekomendasi)' : ''}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Search Error Notice */}
      {searchError && (
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs text-center">
          {searchError}
        </div>
      )}

      {/* 1. Hasil Pencarian Terlebih Dahulu */}
      {results.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-bold text-sm text-white">Hasil Pencarian</h3>
          <div className="space-y-2">
            {results.map((item) => {
              const downloading = isDownloading(item.id);
              const downloaded = isDownloaded(item.id);

              return (
                <div
                  key={item.id}
                  className="bg-zinc-950 hover:bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-16 h-12 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 flex-shrink-0 relative">
                      <img
                        src={item.thumbnail}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                      {item.durationFormatted && (
                        <span className="absolute bottom-1 right-1 bg-black/80 px-1 py-0.2 rounded text-[10px] text-white font-mono">
                          {item.durationFormatted}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-semibold text-white truncate">{item.title}</h4>
                      <p className="text-xs text-zinc-400 truncate mt-0.5">{item.artist}</p>
                    </div>
                  </div>

                  {/* Actions: Download Button */}
                  <div className="flex items-center justify-end">
                    <button
                      onClick={() => startDownload(item, bitrate)}
                      disabled={downloading}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                        downloaded
                          ? 'bg-zinc-900 text-zinc-200 border border-zinc-700'
                          : downloading
                          ? 'bg-zinc-900 text-zinc-400 border border-zinc-800 cursor-wait'
                          : 'bg-white hover:bg-zinc-200 text-black shadow-md'
                      }`}
                    >
                      {downloading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Memproses...</span>
                        </>
                      ) : downloaded ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Tersimpan di Library</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Unduh .MP3 ({bitrate}k)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty Search Placeholder */}
      {results.length === 0 && !isSearching && !searchError && (
        <div className="text-center py-12 text-zinc-600">
          <Music className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-xs">Cari musik apa saja dari YouTube atau tempel link dan simpan langsung ke perangkat.</p>
        </div>
      )}

      {/* 2. Riwayat & Antrean Unduhan diletakkan di bawah Hasil Pencarian */}
      <DownloadQueue />
    </div>
  );
};
