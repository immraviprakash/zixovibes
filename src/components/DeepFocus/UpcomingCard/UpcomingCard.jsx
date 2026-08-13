import { useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { useTimer } from '../../../context/TimerContext';
import styles from './UpcomingCard.module.css';

export default function UpcomingCard() {
  const {
    currentPomodoroIndex,
    isBreakMode,
    flattenedPomodoros,
  } = useApp();

  const { replanSession } = useTimer();

  const [isEditing, setIsEditing] = useState(false);
  const [replanInput, setReplanInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Find upcoming Pomodoro steps to run (up to 3)
  const upcomingPomodoros = Array.isArray(flattenedPomodoros)
    ? (isBreakMode
        ? flattenedPomodoros.slice(currentPomodoroIndex, currentPomodoroIndex + 3)
        : flattenedPomodoros.slice(currentPomodoroIndex + 1, currentPomodoroIndex + 4))
    : [];

  const hasNext = upcomingPomodoros && upcomingPomodoros.length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!replanInput.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await replanSession(replanInput);
      setReplanInput('');
      setIsEditing(false);
    } catch (err) {
      console.error('[UpcomingCard] Replan error:', err);
      setErrorMsg(err.message || "I encountered a slight issue organizing your focus plan. Let's try again in a moment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setReplanInput('');
    setErrorMsg('');
    setIsEditing(false);
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.icon}>
            <polyline points="9 11 12 14 22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          <span className={styles.label}>Upcoming Tasks</span>
        </div>
      </div>

      <div className={styles.content}>
        {hasNext ? (
          <div className={styles.upcomingList}>
            {upcomingPomodoros.map((pomo, idx) => (
              <div key={idx} className={styles.upcomingItem}>
                <span className={styles.upcomingDot}>•</span>
                <div className={styles.upcomingTextCol}>
                  <span className={styles.upcomingTaskText}>{pomo.taskText}</span>
                  <span className={styles.upcomingStepName}>{pomo.name}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.finalInfo}>
            <span>No upcoming tasks. Wrap up your current session!</span>
          </div>
        )}

        {/* Action input block */}
        {!isEditing ? (
          <button
            className={styles.triggerBtn}
            onClick={() => setIsEditing(true)}
            title="Explain schedule changes to AI Focus Coach"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            <span>Explain schedule changes...</span>
          </button>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            <span className={styles.formTitle}>Tell AI Coach how your plans changed:</span>
            <textarea
              className={styles.textarea}
              value={replanInput}
              onChange={(e) => setReplanInput(e.target.value)}
              placeholder="e.g. Finished revision. Need to prepare notes now."
              rows={2}
              autoFocus
            />
            {errorMsg && (
              <div style={{ color: '#ff6b6b', fontSize: '0.72rem', marginTop: '2px', marginBottom: '6px', textAlign: 'left', width: '100%' }}>
                ⚠️ {errorMsg}
              </div>
            )}
            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={styles.submitBtn}
                disabled={!replanInput.trim() || isSubmitting}
              >
                {isSubmitting ? "Updating..." : "Update Focus Plan"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
