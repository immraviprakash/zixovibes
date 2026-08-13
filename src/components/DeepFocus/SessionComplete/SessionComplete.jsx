import { useApp } from '../../../context/AppContext';
import { playlists } from '../../../data/mockData';
import styles from './SessionComplete.module.css';

export default function SessionComplete() {
  const {
    tasks,
    totalFocusTime,
    selectedFocusPlaylist,
    sessionComplete,
    setSessionComplete,
    resetSession,
    setNotebookOpen,
    pomodorosCompleted,
    switchMode,
    setHasDismissedCompletion,
  } = useApp();

  if (!sessionComplete) return null;

  const completedTasks = tasks.filter(t => t.completed).length;
  const hours = Math.floor(totalFocusTime / 3600);
  const mins = Math.floor((totalFocusTime % 3600) / 60);
  const timeStr = hours > 0
    ? `${hours} Hour${hours > 1 ? 's' : ''} ${mins} Minutes`
    : `${mins} Minutes`;

  const playlistName = selectedFocusPlaylist?.name || playlists.find(p => p.id === 7)?.name || 'Focus';

  // Stay on Deep Focus Action
  const handleStay = () => {
    setSessionComplete(false);
    setHasDismissedCompletion(true);
  };

  // End Session Action
  const handleEndSession = () => {
    // Close overlays immediately so they fade smoothly
    setSessionComplete(false);
    setNotebookOpen(false);

    // Switch back to classic, bypassing confirmation, and reset session after transition completes
    switchMode('classic', true, () => {
      resetSession();
    });
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div className={styles.successIcon}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>

        <h2 className={styles.heading}>Session Complete</h2>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.checkmark}>✓</span>
            <span>{completedTasks} Tasks Completed</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.checkmark}>✓</span>
            <span>{pomodorosCompleted} Pomodoros Finished</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.checkmark}>✓</span>
            <span>{timeStr} Total Focus Time</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.checkmark}>✓</span>
            <span>{playlistName} Playlist Used</span>
          </div>
        </div>

        <p className={styles.message}>
          Great progress today.<br />
          Small wins build mastery.
        </p>

        <div className={styles.actions}>
          <button className={styles.outlineBtn} onClick={handleStay}>
            Stay on Deep Focus
          </button>
          <button className={`${styles.outlineBtn} ${styles.exitBtn}`} onClick={handleEndSession}>
            End Session
          </button>
        </div>
      </div>
    </div>
  );
}
