import React, { useState } from 'react';
import { PlayerProvider } from './context/PlayerContext';
import { LibraryProvider } from './context/LibraryContext';
import { DesktopWindowProvider, useDesktopWindow } from './context/DesktopWindowContext';
import { Navbar } from './components/layout/Navbar';
import { TitleBar } from './components/layout/TitleBar';
import { NotchMode } from './components/layout/NotchMode';
import { Sidebar } from './components/layout/Sidebar';
import { BottomNav } from './components/layout/BottomNav';
import { PlayerBar } from './components/player/PlayerBar';
import { FullscreenPlayer } from './components/player/FullscreenPlayer';
import { QueueModal } from './components/player/QueueModal';
import { TrackList } from './components/library/TrackList';
import { PlaylistList } from './components/library/PlaylistList';
import { PlaylistDetail } from './components/library/PlaylistDetail';
import { CreatePlaylistModal } from './components/library/CreatePlaylistModal';
import { ImportLocalModal } from './components/library/ImportLocalModal';
import { ReceiveModal } from './components/share/ReceiveModal';
import { YouTubeSearch } from './components/downloader/YouTubeSearch';

const MainLayout: React.FC = () => {
  const { isNotchMode } = useDesktopWindow();
  const [activeTab, setActiveTab] = useState<string>('tracks');
  const [isImportOpen, setIsImportOpen] = useState<boolean>(false);
  const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState<boolean>(false);
  const [isReceiveOpen, setIsReceiveOpen] = useState<boolean>(false);

  // Cek apakah tab aktif adalah detail playlist tertentu (misal: playlist-favorites)
  const isPlaylistDetail = activeTab.startsWith('playlist-');
  const selectedPlaylistId = isPlaylistDetail ? activeTab.replace('playlist-', '') : null;

  return (
    <div
      className={
        isNotchMode
          ? 'hidden'
          : 'flex flex-col h-screen w-screen overflow-hidden bg-black text-white font-sans'
      }
    >
      {/* Desktop Window Title Bar (Electron) */}
      <TitleBar />

      {/* Upper Area: Sidebar + Main Content (Desktop & Mobile) */}
      <div className="flex flex-1 min-h-0 w-full overflow-hidden">
        {/* Sidebar Nav (Desktop) */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenReceive={() => setIsReceiveOpen(true)}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 h-full relative">
          {/* Top Navbar */}
          <Navbar
            activeTab={activeTab}
            onOpenImport={() => setIsImportOpen(true)}
            onOpenReceive={() => setIsReceiveOpen(true)}
          />

          {/* Scrollable View Content */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-6">
            {activeTab === 'tracks' && (
              <TrackList
                onOpenImport={() => setIsImportOpen(true)}
                onGoToDownload={() => setActiveTab('youtube')}
              />
            )}

            {activeTab === 'playlists' && (
              <PlaylistList
                onSelectPlaylist={(id) => setActiveTab(`playlist-${id}`)}
                onOpenCreateModal={() => setIsCreatePlaylistOpen(true)}
              />
            )}

            {isPlaylistDetail && selectedPlaylistId && (
              <PlaylistDetail
                playlistId={selectedPlaylistId}
                onBack={() => setActiveTab('playlists')}
              />
            )}

            {activeTab === 'youtube' && <YouTubeSearch />}
          </main>
        </div>
      </div>

      {/* Komponen pemutar tidak dirender saat notch agar subscription progress
          tidak memicu render terus-menerus di jendela kecil. Audio tetap hidup
          karena berada di PlayerProvider. */}
      {!isNotchMode && (
        <>
          {/* Persistent Bottom Audio Player Bar - FULL WIDTH (Spanning 100% Screen Width) */}
          <PlayerBar />

          {/* Fullscreen Player Modal (Mobile Optimized) */}
          <FullscreenPlayer />

          {/* Queue Drawer Modal */}
          <QueueModal />
        </>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Import Local Audio Modal */}
      <ImportLocalModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
      />

      {/* Create Playlist Modal */}
      <CreatePlaylistModal
        isOpen={isCreatePlaylistOpen}
        onClose={() => setIsCreatePlaylistOpen(false)}
        onCreated={(newId) => setActiveTab(`playlist-${newId}`)}
      />

      {/* ShareFlow Receive Modal */}
      <ReceiveModal
        isOpen={isReceiveOpen}
        onClose={() => setIsReceiveOpen(false)}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <PlayerProvider>
      <DesktopWindowProvider>
        <LibraryProvider>
          <MainLayout />
        </LibraryProvider>
        <NotchMode />
      </DesktopWindowProvider>
    </PlayerProvider>
  );
};

export default App;
