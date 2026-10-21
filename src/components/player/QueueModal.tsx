import React from 'react';
import { X, Trash2, Music, Play } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { formatDuration } from '../../utils/formatters';

export const QueueModal: React.FC = () => {
  const {
    queue,
    queueIndex,
    isQueueModalOpen,
    playTrack,
    removeFromQueue,
    clearQueue,
    setIsQueueModalOpen
  } = usePlayer();

  if (!isQueueModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex justify-end animate-in fade-in select-none">
      <div className="w-full max-w-md bg-zinc-950 border-l border-zinc-800 h-full flex flex-col p-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div>
            <h3 className="font-bold text-lg text-white">Antrean Putar</h3>
            <p className="text-xs text-zinc-400">{queue.length} lagu dalam antrean</p>
          </div>
          <div className="flex items-center gap-2">
            {queue.length > 0 && (
              <button
                onClick={clearQueue}
                title="Kosongkan Antrean"
                className="p-2 text-zinc-400 hover:text-white transition-colors"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => setIsQueueModalOpen(false)}
              className="p-2 text-zinc-400 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Queue Items */}
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-900 py-2">
          {queue.length === 0 ? (
            <div className="text-center py-16 text-zinc-600">
              <Music className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Antrean saat ini kosong</p>
            </div>
          ) : (
            queue.map((track, idx) => {
              const isCurrent = idx === queueIndex;
              return (
                <div
                  key={`${track.id}-${idx}`}
                  className={`flex items-center gap-3 py-3 px-2 rounded-xl group transition-colors ${
                    isCurrent ? 'bg-white/10 border border-white/20' : 'hover:bg-zinc-900/60'
                  }`}
                >
                  <div
                    onClick={() => playTrack(track, queue)}
                    className="w-10 h-10 rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800 flex-shrink-0 relative cursor-pointer"
                  >
                    {track.coverUrl ? (
                      <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-500">
                        <Music className="w-4 h-4" />
                      </div>
                    )}
                    {isCurrent && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Play className="w-4 h-4 text-white fill-current" />
                      </div>
                    )}
                  </div>

                  <div
                    onClick={() => playTrack(track, queue)}
                    className="flex-1 min-w-0 cursor-pointer"
                  >
                    <h5
                      className={`text-sm truncate font-medium ${
                        isCurrent ? 'text-white font-bold' : 'text-zinc-200'
                      }`}
                    >
                      {track.title}
                    </h5>
                    <p className="text-xs text-zinc-400 truncate">{track.artist}</p>
                  </div>

                  <span className="text-xs text-zinc-500">
                    {formatDuration(track.duration)}
                  </span>

                  <button
                    onClick={() => removeFromQueue(idx)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-400 hover:text-white transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
