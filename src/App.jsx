import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { TimerProvider } from './context/TimerContext';
import Header from './components/Header/Header';
import VinylPlayer from './components/VinylPlayer/VinylPlayer';
import PlaylistCards from './components/PlaylistCards/PlaylistCards';
import SongList from './components/SongList/SongList';
import NowPlaying from './components/NowPlaying/NowPlaying';
import VolumeControl from './components/VolumeControl/VolumeControl';
import MoodInput from './components/MoodInput/MoodInput';
import Watermark from './components/Watermark/Watermark';
import ExitConfirmModal from './components/ExitConfirmModal/ExitConfirmModal';
import CompletedConfirmModal from './components/CompletedConfirmModal/CompletedConfirmModal';
import GuestFavoriteModal from './components/GuestFavoriteModal/GuestFavoriteModal';
import UnfavoriteConfirmModal from './components/UnfavoriteConfirmModal/UnfavoriteConfirmModal';
const AuthPage = lazy(() => import('./components/Auth/AuthPage'));
import { getGreeting } from './data/mockData';
import woodBackground from './assets/wood-background.jpg';
import styles from './App.module.css';

const DeepFocusDashboard = lazy(() => import('./components/DeepFocus/DeepFocusDashboard/DeepFocusDashboard'));

function AppContent() {
  const {
    hasOnboarded,
    mode,
    transitionStage,
    pendingMode,
    switchMode,
    setClassicIsPlaying,
    showExitConfirm,
    confirmExit,
    cancelExit,
    isTransitioning,
    showCompletedConfirm,
    confirmCompletedExit,
    showUnfavoriteConfirm,
    confirmUnfavorite,
    cancelUnfavorite,
    activePlaylist,
    setActivePlaylist,
    announcement,
    username,
    displayName,
    showGuestModal,
    setShowGuestModal,
    previousMode,
    openedPlaylist,
    setOpenedPlaylist,
    currentPlaylistSongs,
    currentSong,
    classicIsPlaying,
    playSong,
    playPlaylist,
    notebookOpen,
    setNotebookOpen
  } = useApp();

  // Dynamic Browser Tab Title Sync
  useEffect(() => {
    document.title = mode === 'deepfocus' ? "Zix'Ovibes | Deep Focus" : (mode === 'auth' ? "Zix'Ovibes | Authentication" : "Zix'Ovibes | Classic");
  }, [mode]);

  // Global Escape key navigation handling
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        const activeEl = document.activeElement;
        const isTyping = activeEl && (
          activeEl.tagName === 'INPUT' || 
          activeEl.tagName === 'TEXTAREA' || 
          activeEl.isContentEditable
        );

        // 1. Modals & Overlays (always close on Escape)
        if (showExitConfirm) {
          e.preventDefault();
          cancelExit();
          return;
        }
        if (showCompletedConfirm) {
          e.preventDefault();
          cancelExit();
          return;
        }
        if (showUnfavoriteConfirm) {
          e.preventDefault();
          cancelUnfavorite();
          return;
        }
        if (showGuestModal) {
          e.preventDefault();
          setShowGuestModal(false);
          return;
        }

        // 2. Authentication overlay modal
        if (mode === 'auth') {
          e.preventDefault();
          switchMode(previousMode || 'classic', true);
          return;
        }

        // Avoid triggering view-level escape key behaviors while user is actively typing
        if (isTyping) return;

        // 3. Focus Planner Workspace Pane
        if (notebookOpen) {
          e.preventDefault();
          setNotebookOpen(false);
          return;
        }

        // 4. Playlist detail view (both Classic and Deep Focus)
        if (openedPlaylist) {
          e.preventDefault();
          setOpenedPlaylist(null);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    mode, openedPlaylist, notebookOpen,
    showExitConfirm, showCompletedConfirm, showUnfavoriteConfirm, showGuestModal,
    cancelExit, cancelUnfavorite, setShowGuestModal, switchMode, previousMode, setOpenedPlaylist, setNotebookOpen
  ]);


  const handleSelectPlaylist = useCallback((playlist) => {
    setOpenedPlaylist(playlist);
    playPlaylist(playlist);
  }, [setOpenedPlaylist, playPlaylist]);



  const displayMode = mode === 'auth' ? previousMode : mode;
  const isDeepFocus = displayMode === 'deepfocus';
  const targetMode = pendingMode || mode;
  const targetDisplayMode = targetMode === 'auth' ? previousMode : targetMode;
  const isTargetDf = targetDisplayMode === 'deepfocus';

  // Mount conditions
  const isClassicActive = displayMode === 'classic';
  const isLeavingClassic = isClassicActive && transitionStage === 'leaving';
  const isEnteringClassic = !isClassicActive && pendingMode === 'classic';

  const isDfActive = displayMode === 'deepfocus';
  const isLeavingDf = isDfActive && transitionStage === 'leaving';
  const isEnteringDf = !isDfActive && pendingMode === 'deepfocus';

  const mountClassic = isClassicActive || isEnteringClassic;
  const mountDf = isDfActive || isEnteringDf;



  return (
    <div className={`${styles.app} ${isTargetDf ? styles.deepFocusApp : ''}`}>
      {/* Screen Reader Live Announcements Region */}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: '0',
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: '0'
        }}
      >
        {announcement}
      </div>

      {/* Classic Wood Background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${woodBackground})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed',
          opacity: isTargetDf ? 0 : 1,
          transition: 'opacity 0.6s ease',
          pointerEvents: 'none',
          zIndex: 0
        }}
      />

      {/* Cursor-following ambient warm light over dark wood (isolated re-renders) */}
      {!isTargetDf && mode !== 'auth' && <AmbientGlow />}

      {/* Dark overlay - only for Classic Mode */}
      <div 
        className={styles.overlay} 
        style={{ 
          opacity: isTargetDf ? 0 : 1,
          transition: 'opacity 0.6s ease'
        }}
      />

      {/* Deep Focus background gradient */}
      <div 
        className={styles.dfBackground} 
        style={{ 
          opacity: isTargetDf ? 1 : 0,
          transition: 'opacity 0.6s ease'
        }}
      />

      {/* Background watermark - shared atmospheric branding */}
      {(!isDeepFocus || hasOnboarded) && <Watermark />}

      {/* Header (shared) */}
      <Header
        mode={pendingMode || mode}
        onModeChange={switchMode}
      />

      {/* Transition overlay bridge */}
      <div 
        className={styles.transitionOverlay} 
        style={{ 
          opacity: transitionStage === 'leaving' ? 1 : 0,
          pointerEvents: 'none'
        }}
      />

      {/* Classic Mode Content */}
      {mountClassic && (
        <main
          className={styles.main}
          style={{
            pointerEvents: (isLeavingClassic || isDeepFocus || mode === 'auth') ? 'none' : 'auto',
            transition: 'opacity 0.6s ease, visibility 0.6s ease'
          }}
        >
          {/* Left Column: Greeting + Vinyl + Now Playing */}
          <div className={styles.leftCol}>
            <div className={`${styles.greeting} ${
              isLeavingClassic ? styles.greetingLeaving : ''
            } ${
              isEnteringClassic ? styles.greetingEntering : ''
            }`}>
              <h1 className={styles.greetingText}>
                {getGreeting()},{' '}
                <span className={styles.username}>{displayName || username}</span>
              </h1>
            </div>
            
            <div className={`${styles.vinylTransition} ${
              isLeavingClassic ? styles.vinylLeaving : ''
            } ${
              isEnteringClassic ? styles.vinylEntering : ''
            }`}>
              <VinylPlayer playlist={activePlaylist} onSelectPlaylist={handleSelectPlaylist} />
            </div>

            <div className={`${styles.bottomLeft} ${
              isLeavingClassic ? styles.bottomLeftLeaving : ''
            } ${
              isEnteringClassic ? styles.bottomLeftEntering : ''
            }`}>
              <NowPlaying />
              <VolumeControl />
            </div>
          </div>

          {/* Right Column: Playlists + Mood */}
          <div className={styles.rightCol}>
            <div 
              className={`${styles.playlistTransition} hide-scrollbar ${
                isLeavingClassic ? styles.playlistLeaving : ''
              } ${
                isEnteringClassic ? styles.playlistEntering : ''
              }`}
            >
              <PlaylistCards
                activePlaylist={activePlaylist}
                onSelectPlaylist={handleSelectPlaylist}
              />
            </div>
            
            <div className={`${styles.moodArea} ${
              isLeavingClassic ? styles.moodLeaving : ''
            } ${
              isEnteringClassic ? styles.moodEntering : ''
            }`}>
              <MoodInput />
            </div>
          </div>
        </main>
      )}

      {/* Deep Focus Mode Content */}
      {mountDf && (
        <div
          className={`${styles.deepFocusContent} ${
            isLeavingDf ? styles.contentLeaving : ''
          } ${
            isEnteringDf ? styles.contentEntering : ''
          }`}
          style={{
            pointerEvents: (isLeavingDf || mode === 'auth') ? 'none' : 'auto',
            transition: 'opacity 0.6s ease, visibility 0.6s ease'
          }}
        >
          <Suspense fallback={
            <div className={styles.loaderContainer} aria-busy="true" aria-label="Loading Deep Focus Mode">
              <div className={styles.spinner} />
            </div>
          }>
            <DeepFocusDashboard />
          </Suspense>
        </div>
      )}

      {/* Exit Confirmation Dialog */}
      {showExitConfirm && (
        <ExitConfirmModal onStay={cancelExit} onExit={confirmExit} />
      )}

      {/* Focus Completed Mode Switch Dialog */}
      {showCompletedConfirm && (
        <CompletedConfirmModal onStay={cancelExit} onExit={confirmCompletedExit} />
      )}

      {/* Unfavorite Confirmation Dialog */}
      {showUnfavoriteConfirm && (
        <UnfavoriteConfirmModal onStay={cancelUnfavorite} onConfirm={confirmUnfavorite} />
      )}

      {/* Guest Favorite Modal Prompt */}
      {showGuestModal && (
        <GuestFavoriteModal
          onStay={() => setShowGuestModal(false)}
          onExit={() => {
            setShowGuestModal(false);
            switchMode('auth');
          }}
        />
      )}

      {/* Authentication Screen */}
      {mode === 'auth' && (
        <Suspense fallback={
          <div className={styles.loaderContainer} aria-busy="true" aria-label="Loading Authentication">
            <div className={styles.spinner} />
          </div>
        }>
          <AuthPage />
        </Suspense>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <TimerProvider>
        <AppContent />
      </TimerProvider>
    </AppProvider>
  );
}

function AmbientGlow() {
  const [coords, setCoords] = useState({ x: -1000, y: -1000, opacity: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      setCoords({
        x: e.clientX,
        y: e.clientY,
        opacity: 1
      });
    };
    const handleMouseLeave = () => {
      setCoords(prev => ({ ...prev, opacity: 0 }));
    };

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(550px circle at ${coords.x}px ${coords.y}px, rgba(201, 168, 76, 0.08) 0%, rgba(160, 120, 60, 0.035) 40%, transparent 80%)`,
        opacity: coords.opacity,
        transition: 'opacity 0.4s ease',
        pointerEvents: 'none',
        zIndex: 0
      }}
    />
  );
}
