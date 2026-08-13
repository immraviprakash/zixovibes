import { useEffect } from 'react';
import { useApp } from '../../../context/AppContext';
import FocusOnboarding from '../FocusOnboarding/FocusOnboarding';
import FocusPlaylistCards from '../FocusPlaylistCards/FocusPlaylistCards';
import SongList from '../../SongList/SongList';
import FocusNotebook from '../FocusNotebook/FocusNotebook';
import FocusTimer from '../FocusTimer/FocusTimer';
import QuoteCard from '../QuoteCard/QuoteCard';
import CompactPlayer from '../CompactPlayer/CompactPlayer';
import SessionComplete from '../SessionComplete/SessionComplete';
import styles from './DeepFocusDashboard.module.css';


export default function DeepFocusDashboard() {
  const {
    hasOnboarded,
    sessionTitle,
    sessionSubtitle,
    allTasksDone,
    sessionComplete,
    setSessionComplete,
    pomodorosCompleted,
    notebookOpen,
    hasDismissedCompletion,
    openedPlaylist,
    setOpenedPlaylist,
    currentPlaylistSongs,
    currentSong,
    isPlaying,
    playSong,
    songs,
    tasks,
    currentPomodoroIndex,
    flattenedPomodoros,
    aiPlaylistSongs,
  } = useApp();

  // Trigger session complete when all tasks done, if not already dismissed
  useEffect(() => {
    if (hasOnboarded && !sessionComplete && !hasDismissedCompletion) {
      if (allTasksDone) {
        const timeout = setTimeout(() => {
          setSessionComplete(true);
        }, 800);
        return () => clearTimeout(timeout);
      }
    }
  }, [allTasksDone, hasOnboarded, sessionComplete, setSessionComplete, hasDismissedCompletion]);



  const activePomo = Array.isArray(flattenedPomodoros) ? flattenedPomodoros[currentPomodoroIndex] : null;
  const activeTask = activePomo && Array.isArray(tasks) ? tasks[activePomo.taskIndex] : (Array.isArray(tasks) && tasks.length > 0 ? tasks[0] : null);
  const activeTaskText = activePomo?.taskText || (activeTask ? activeTask.text : '');
  const activePomoName = activePomo?.name || '';
  const activeCategory = activeTask?.executionLabel || activeTask?.category || 'Deep Work';
  const completedTaskCount = Array.isArray(tasks) ? tasks.filter(t => t.completed).length : 0;

  if (!hasOnboarded) {
    return <FocusOnboarding />;
  }

  return (
    <>
      <div className={styles.dashboard}>
        {/* Left/Center: Session Info + Playlists + Focus Notebook */}
        <div className={`${styles.leftSection} ${notebookOpen ? styles.leftExpanded : ''}`}>
          <div className={styles.sessionInfo}>
            <div className={styles.currentTaskBanner}>
              <div className={styles.bannerHeader}>
                <span className={styles.bannerBadge}>CURRENT TASK</span>
                {Array.isArray(tasks) && tasks.length > 0 && (
                  <span className={styles.progressPill}>
                    Task {completedTaskCount + 1} of {tasks.length} • Pomodoro {Math.min(currentPomodoroIndex + 1, (flattenedPomodoros || []).length || 1)} of {(flattenedPomodoros || []).length || 1}
                  </span>
                )}
              </div>
              <div className={styles.bannerTitle}>
                {activeTaskText || 'No active task'}
              </div>
              <div className={styles.bannerDetail}>
                {Array.isArray(tasks) && tasks.length > 0
                  ? `${activeCategory} • ${activePomoName ? activePomoName : `Pomodoro ${currentPomodoroIndex + 1}`}`
                  : 'Generate a focus plan or add a task to begin.'
                }
              </div>
            </div>
          </div>

          <div className={styles.leftContentWrap}>
            <div className={styles.playlistContentArea}>
              <div className={`${styles.slideContainer} ${openedPlaylist ? styles.slideActive : ''}`}>
                <div className={styles.playlistCardsPane}>
                  <FocusPlaylistCards layout={notebookOpen ? 'vertical' : 'horizontal'} />
                </div>
                <div className={styles.songListPane}>
                  {openedPlaylist && (
                    <SongList
                      playlist={openedPlaylist}
                      songs={openedPlaylist.id === 'playlist_for_you' ? aiPlaylistSongs : songs.filter(s => s.playlist === openedPlaylist.id)}
                      currentSong={currentSong}
                      isPlaying={isPlaying}
                      onBack={() => setOpenedPlaylist(null)}
                      onPlaySong={playSong}
                      isDeepFocus={true}
                      layout={notebookOpen ? 'vertical' : 'horizontal'}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
          <FocusNotebook />
        </div>

        {/* Right Stack: Timer + Quote Card */}
        <div className={styles.rightSection}>
          <FocusTimer />
          <QuoteCard />
        </div>
      </div>

      {/* Compact Player Bar */}
      <CompactPlayer />

      {/* Session Complete Overlay */}
      <SessionComplete />
    </>
  );
}
