import React, { useState, useEffect, useRef } from 'react';
import { X, QrCode, Copy, Check, Music, Wifi, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import QRCode from 'qrcode';
import { ShareService, type ShareSessionInfo } from '../../services/shareService';
import { formatDuration, formatFileSize } from '../../utils/formatters';
import type { Track } from '../../types/music';

interface ShareModalProps {
  track: Track | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ track, isOpen, onClose }) => {
  const [session, setSession] = useState<ShareSessionInfo | null>(null);
  const [qrUrl, setQrUrl] = useState<string>('');
  const [status, setStatus] = useState<string>('initializing'); // 'initializing', 'waiting', 'transferring', 'completed', 'error'
  const [progress, setProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const pollIntervalRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen || !track) {
      if (session) {
        ShareService.stopSharing(session.token);
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      setSession(null);
      setQrUrl('');
      setStatus('initializing');
      setProgress(0);
      setErrorMessage('');
      return;
    }

    let isMounted = true;

    const initShare = async () => {
      try {
        setStatus('initializing');
        const s = await ShareService.startSharing(track);
        if (!isMounted) return;

        setSession(s);

        // Generate QR Code data URL
        const qrImage = await QRCode.toDataURL(s.qrPayload, {
          width: 320,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#ffffff'
          }
        });
        if (!isMounted) return;

        setQrUrl(qrImage);
        setStatus('waiting');

        // Mulai polling status transfer dari sisi server
        pollIntervalRef.current = setInterval(async () => {
          try {
            const prog = await ShareService.getSenderProgress(s.token);
            if (!isMounted) return;

            if (prog.status === 'transferring') {
              setStatus('transferring');
              setProgress(prog.progress);
            } else if (prog.status === 'completed') {
              setStatus('completed');
              setProgress(100);
              clearInterval(pollIntervalRef.current);
            }
          } catch {
            // Abaikan kesalahan polling sesaat
          }
        }, 1000);
      } catch (err: any) {
        if (!isMounted) return;
        setStatus('error');
        setErrorMessage(err.message || 'Gagal memulai sesi berbagi');
      }
    };

    initShare();

    return () => {
      isMounted = false;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [isOpen, track]);

  const handleCopyCode = () => {
    if (!session) return;
    const shareText = `${session.ip}:${session.port}#${session.token}`;
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    if (session) {
      ShareService.stopSharing(session.token);
    }
    onClose();
  };

  if (!isOpen || !track) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in">
      <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-2xl relative animate-in zoom-in-95 flex flex-col items-center text-center">
        {/* Tombol Tutup */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-900 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Branding */}
        <div className="flex items-center gap-2 mb-1">
          <QrCode className="w-4 h-4 text-white" />
          <h3 className="text-sm font-bold tracking-wide uppercase text-white">ShareFlow (P2P)</h3>
        </div>
        <p className="text-xs text-zinc-400 mb-4">Bagikan lagu secara offline antar perangkat</p>

        {/* Ringkasan Lagu */}
        <div className="w-full bg-zinc-900/70 border border-zinc-800 rounded-2xl p-3 flex items-center gap-3 mb-4 text-left">
          <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
            {track.coverUrl ? (
              <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
            ) : (
              <Music className="w-4 h-4 text-zinc-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-semibold text-white truncate">{track.title}</h4>
            <p className="text-[11px] text-zinc-400 truncate">{track.artist}</p>
          </div>
          <div className="text-[11px] text-zinc-400 text-right">
            <span>{formatDuration(track.duration)}</span>
            {track.fileSize ? <p>{formatFileSize(track.fileSize)}</p> : null}
          </div>
        </div>

        {/* QR Code Container */}
        <div className="w-56 h-56 bg-white rounded-2xl p-3 shadow-lg flex items-center justify-center mb-4">
          {status === 'initializing' ? (
            <div className="flex flex-col items-center gap-2 text-black">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="text-xs font-medium">Menyiapkan kode...</span>
            </div>
          ) : qrUrl ? (
            <img src={qrUrl} alt="QR Barcode Lagu" className="w-full h-full object-contain" />
          ) : (
            <div className="text-xs text-red-600 flex flex-col items-center gap-1">
              <AlertCircle className="w-6 h-6" />
              <span>Gagal memuat QR</span>
            </div>
          )}
        </div>

        {/* Token Kode & Tombol Salin */}
        {session && (
          <div className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 flex items-center justify-between mb-4">
            <div className="text-left pl-2">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Token Perangkat</span>
              <span className="text-sm font-mono font-bold text-white tracking-widest">{session.token}</span>
            </div>
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 transition-colors font-medium"
              title="Salin Alamat & Token"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-white" /> Tersalin
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Salin Kode
                </>
              )}
            </button>
          </div>
        )}

        {/* Status Transfer */}
        <div className="w-full mb-3">
          {status === 'waiting' && (
            <div className="flex items-center justify-center gap-2 text-xs text-zinc-300">
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              <span>Menunggu perangkat penerima memindai...</span>
            </div>
          )}

          {status === 'transferring' && (
            <div className="w-full space-y-1.5">
              <div className="flex items-center justify-between text-xs text-white">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Mengirim lagu ke perangkat...
                </span>
                <span className="font-semibold">{progress}%</span>
              </div>
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {status === 'completed' && (
            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-white bg-zinc-900 border border-zinc-700 py-2 rounded-xl">
              <CheckCircle2 className="w-4 h-4 text-white" />
              <span>Lagu berhasil terkirim ke perangkat!</span>
            </div>
          )}

          {status === 'error' && (
            <p className="text-xs text-red-400">{errorMessage || 'Terjadi kesalahan saat berbagi lagu'}</p>
          )}
        </div>

        {/* Petunjuk Koneksi */}
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
          <Wifi className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
          <span>Pastikan kedua perangkat berada di Wi-Fi atau Hotspot yang sama</span>
        </div>
      </div>
    </div>
  );
};
