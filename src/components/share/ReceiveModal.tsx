import React, { useState, useEffect, useRef } from 'react';
import { X, QrCode, Keyboard, Wifi, Loader2, CheckCircle2, AlertCircle, Play, Music } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { ShareService, type ShareTrackInfo } from '../../services/shareService';
import { usePlayer } from '../../context/PlayerContext';
import { formatDuration, formatFileSize } from '../../utils/formatters';
import type { Track } from '../../types/music';

interface ReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReceiveModal: React.FC<ReceiveModalProps> = ({ isOpen, onClose }) => {
  const { playTrack } = usePlayer();

  const [activeTab, setActiveTab] = useState<'scan' | 'manual'>('scan');
  const [manualInput, setManualInput] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'downloading' | 'completed' | 'error'>('idle');
  const [progress, setProgress] = useState<number>(0);
  const [transferredBytes, setTransferredBytes] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [trackInfo, setTrackInfo] = useState<ShareTrackInfo | null>(null);
  const [receivedTrack, setReceivedTrack] = useState<Track | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [cameraError, setCameraError] = useState<string>('');

  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef<boolean>(false);

  // Bersihkan scanner saat modal tertutup
  const stopCamera = async () => {
    if (qrScannerRef.current && isScanningRef.current) {
      try {
        await qrScannerRef.current.stop();
      } catch {}
      try {
        qrScannerRef.current.clear();
      } catch {}
      isScanningRef.current = false;
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setStatus('idle');
      setProgress(0);
      setTrackInfo(null);
      setReceivedTrack(null);
      setErrorMessage('');
      setCameraError('');
      setManualInput('');
      return;
    }

    if (activeTab === 'scan' && status === 'idle') {
      const timer = setTimeout(() => {
        startScanner();
      }, 300);
      return () => {
        clearTimeout(timer);
        stopCamera();
      };
    } else {
      stopCamera();
    }
  }, [isOpen, activeTab, status]);

  const startScanner = async () => {
    await stopCamera();

    const element = document.getElementById('qr-reader-container');
    if (!element) return;

    try {
      const scanner = new Html5Qrcode('qr-reader-container');
      qrScannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          handleIncomingPayload(decodedText);
        },
        () => {
          // Frame scanner ignore
        }
      );
      isScanningRef.current = true;
      setCameraError('');
    } catch (err: any) {
      console.warn('Gagal mengaktifkan kamera:', err);
      setCameraError('Kamera tidak tersedia atau izin belum diberikan. Gunakan tab Token Manual.');
    }
  };

  const handleIncomingPayload = async (rawInput: string) => {
    const parsed = ShareService.parseShareInput(rawInput);
    if (!parsed) {
      setErrorMessage('Format QR Code atau Token tidak valid');
      setStatus('error');
      return;
    }

    await stopCamera();
    processDownload(parsed.ip, parsed.port, parsed.token);
  };

  const processDownload = async (ip: string, port: number, token: string) => {
    setStatus('connecting');
    setErrorMessage('');
    setProgress(0);

    try {
      // 1. Ambil metadata lagu
      const meta = await ShareService.fetchTrackInfo(ip, port, token);
      setTrackInfo(meta);
      setStatus('downloading');

      // 2. Download binary stream dengan callback progress
      const track = await ShareService.downloadSharedTrack(
        ip,
        port,
        token,
        meta,
        (percent, received, total) => {
          setProgress(percent);
          setTransferredBytes({ current: received, total });
        }
      );

      setReceivedTrack(track);
      setStatus('completed');
    } catch (err: any) {
      console.error('Proses transfer gagal:', err);
      setStatus('error');
      setErrorMessage(err.message || 'Gagal menerima file dari pengirim');
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handleIncomingPayload(manualInput);
  };

  const handlePlayNow = () => {
    if (receivedTrack) {
      playTrack(receivedTrack);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in">
      <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-2xl relative animate-in zoom-in-95 flex flex-col items-center text-center">
        {/* Tombol Tutup */}
        <button
          onClick={() => {
            stopCamera();
            onClose();
          }}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-900 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Branding */}
        <div className="flex items-center gap-2 mb-1">
          <QrCode className="w-4 h-4 text-white" />
          <h3 className="text-sm font-bold tracking-wide uppercase text-white">Terima Lagu (ShareFlow)</h3>
        </div>
        <p className="text-xs text-zinc-400 mb-4">Terima lagu dari perangkat lain melalui Wi-Fi lokal</p>

        {/* Mode Selector Tabs (Hanya muncul jika belum proses download) */}
        {status === 'idle' && (
          <div className="flex w-full bg-zinc-900 p-1 rounded-xl mb-4 border border-zinc-800">
            <button
              onClick={() => setActiveTab('scan')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'scan' ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" /> Pindai Barcode
            </button>
            <button
              onClick={() => setActiveTab('manual')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'manual' ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Keyboard className="w-3.5 h-3.5" /> Token Manual
            </button>
          </div>
        )}

        {/* Konten Tab 1: Pindai Barcode Kamera */}
        {status === 'idle' && activeTab === 'scan' && (
          <div className="w-full flex flex-col items-center mb-4">
            <div className="w-64 h-64 bg-black rounded-2xl overflow-hidden border border-zinc-800 relative shadow-inner flex items-center justify-center">
              <div id="qr-reader-container" className="w-full h-full object-cover" />
              {cameraError && (
                <div className="absolute inset-0 bg-zinc-950/90 p-4 flex flex-col items-center justify-center gap-2 text-zinc-300 text-xs text-center">
                  <AlertCircle className="w-6 h-6 text-zinc-400" />
                  <p>{cameraError}</p>
                  <button
                    onClick={() => setActiveTab('manual')}
                    className="mt-2 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-medium"
                  >
                    Beralih ke Input Manual
                  </button>
                </div>
              )}
            </div>
            <p className="text-[11px] text-zinc-400 mt-2">Arahkan kamera ke QR barcode pada layar pengirim</p>
          </div>
        )}

        {/* Konten Tab 2: Input Manual */}
        {status === 'idle' && activeTab === 'manual' && (
          <form onSubmit={handleManualSubmit} className="w-full flex flex-col gap-3 mb-4">
            <div className="text-left">
              <label className="text-[11px] text-zinc-400 block mb-1">
                Masukkan Alamat & Token Pengirim:
              </label>
              <input
                type="text"
                placeholder="Contoh: 192.168.1.15:3001#849201"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-white transition-all font-mono"
                autoFocus
              />
              <span className="text-[10px] text-zinc-500 mt-1 block">
                Format: <code>IP:PORT#TOKEN</code> (lihat di layar pengirim)
              </span>
            </div>
            <button
              type="submit"
              disabled={!manualInput.trim()}
              className="w-full py-2.5 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200 transition-colors disabled:opacity-50"
            >
              Hubungkan & Mulai Unduh
            </button>
          </form>
        )}

        {/* State: Connecting */}
        {status === 'connecting' && (
          <div className="py-8 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-white" />
            <div className="text-xs font-semibold text-white">Menghubungkan ke perangkat pengirim...</div>
            <p className="text-[11px] text-zinc-400">Mengambil metadata lagu dan menyiapkan transfer</p>
          </div>
        )}

        {/* State: Downloading (Progress Bar & Transferred Bytes) */}
        {status === 'downloading' && (
          <div className="w-full py-4 flex flex-col gap-4">
            {trackInfo && (
              <div className="w-full bg-zinc-900/70 border border-zinc-800 rounded-2xl p-3 flex items-center gap-3 text-left">
                <div className="w-10 h-10 rounded-xl bg-zinc-800 overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {trackInfo.coverUrl ? (
                    <img src={trackInfo.coverUrl} alt={trackInfo.title} className="w-full h-full object-cover" />
                  ) : (
                    <Music className="w-4 h-4 text-zinc-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-semibold text-white truncate">{trackInfo.title}</h4>
                  <p className="text-[11px] text-zinc-400 truncate">{trackInfo.artist}</p>
                </div>
                <div className="text-[11px] text-zinc-400 text-right">
                  {formatDuration(trackInfo.duration)}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-white">
                <span className="flex items-center gap-1.5 font-medium">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Menerima file audio...
                </span>
                <span className="font-bold">{progress}%</span>
              </div>
              <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white transition-all duration-200 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-[11px] text-zinc-400 text-right">
                {formatFileSize(transferredBytes.current)} / {formatFileSize(transferredBytes.total)}
              </div>
            </div>
          </div>
        )}

        {/* State: Completed */}
        {status === 'completed' && receivedTrack && (
          <div className="w-full py-4 flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white mb-0.5">Lagu Berhasil Diterima!</h4>
              <p className="text-[11px] text-zinc-400">
                "{receivedTrack.title}" telah ditambahkan ke koleksi Anda
              </p>
            </div>

            <div className="flex w-full gap-2 mt-2">
              <button
                onClick={handlePlayNow}
                className="flex-1 py-2.5 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200 transition-colors flex items-center justify-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-current" /> Putar Sekarang
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white font-medium text-xs hover:bg-zinc-800 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        )}

        {/* State: Error */}
        {status === 'error' && (
          <div className="w-full py-4 flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-red-950/40 border border-red-800/60 flex items-center justify-center text-red-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h4 className="text-xs font-bold text-white mb-0.5">Gagal Menerima Lagu</h4>
              <p className="text-[11px] text-red-400 max-w-xs">{errorMessage}</p>
            </div>
            <button
              onClick={() => {
                setStatus('idle');
                setErrorMessage('');
              }}
              className="mt-2 px-4 py-2 rounded-xl bg-zinc-800 text-white text-xs font-medium hover:bg-zinc-700 transition-colors"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {/* Footer info */}
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mt-2">
          <Wifi className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
          <span>Pastikan kedua perangkat berada di Wi-Fi atau Hotspot yang sama</span>
        </div>
      </div>
    </div>
  );
};
