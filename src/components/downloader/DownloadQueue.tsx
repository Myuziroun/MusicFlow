import React from 'react';
import { CheckCircle2, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { useLibrary } from '../../context/LibraryContext';

export const DownloadQueue: React.FC = () => {
  const { downloadJobs, clearCompletedDownloads } = useLibrary();

  if (downloadJobs.length === 0) return null;

  const hasFinishedJobs = downloadJobs.some(
    (j) => j.status === 'completed' || j.status === 'error'
  );

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm text-white flex items-center gap-2">
          <span>Riwayat & Antrean Unduhan</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
            {downloadJobs.length}
          </span>
        </h3>
        {hasFinishedJobs && (
          <button
            onClick={clearCompletedDownloads}
            className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" /> Bersihkan
          </button>
        )}
      </div>

      <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1 divide-y divide-zinc-800">
        {downloadJobs.map((job) => {
          const isDone = job.status === 'completed';
          const isError = job.status === 'error';
          const isLoading = job.status === 'downloading' || job.status === 'converting';

          return (
            <div key={job.id} className="pt-2.5 first:pt-0 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800 flex-shrink-0">
                    <img
                      src={job.thumbnail}
                      alt={job.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h5 className="text-xs font-semibold text-white truncate">{job.title}</h5>
                    <p className="text-[11px] text-zinc-400 truncate">
                      {job.statusText || job.artist}
                    </p>
                  </div>
                </div>

                <div className="flex-shrink-0">
                  {isLoading && <Loader2 className="w-4 h-4 text-white animate-spin" />}
                  {isDone && <CheckCircle2 className="w-4 h-4 text-white" />}
                  {isError && <AlertCircle className="w-4 h-4 text-zinc-400" />}
                </div>
              </div>

              {/* Progress bar */}
              {isLoading && (
                <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white transition-all duration-300 rounded-full"
                    style={{ width: `${job.progress}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
