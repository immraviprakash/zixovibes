import { useState, useEffect } from 'react';
import { useApp } from '../../../context/AppContext';
import { useTimer } from '../../../context/TimerContext';
import { motivationalQuotes } from '../../../data/focusData';
import styles from './QuoteCard.module.css';

// Helper to format remaining timer seconds to MM:SS
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

// Helper to format elapsed focus seconds into Mins/Hours
const formatFocusTime = (seconds) => {
  if (!seconds) return '0 Mins';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) {
    return `${mins} Min${mins !== 1 ? 's' : ''}`;
  }
  const hrs = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hrs} Hr${hrs !== 1 ? 's' : ''}${remainingMins > 0 ? ` ${remainingMins} Min` : ''}`;
};

export default function QuoteCard() {
  const {
    tasks,
    currentPomodoroIndex,
    pomodorosCompleted,
    sessionComplete,
    totalFocusTime,
    flattenedPomodoros,
  } = useApp();

  const {
    timerSeconds,
    timerRunning,
    isBreakMode,
  } = useTimer();

  const [index, setIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const [flipped, setFlipped] = useState(false);

  // Auto quote transitions (every 15s) when card is NOT flipped
  useEffect(() => {
    if (flipped) return;
    const interval = setInterval(() => {
      setIsFading(true);
      setTimeout(() => {
        setIndex(prev => (prev + 1) % motivationalQuotes.length);
        setIsFading(false);
      }, 400);
    }, 15000);
    return () => clearInterval(interval);
  }, [flipped]);

  // Auto flip back to quote when session completes after 8 seconds
  useEffect(() => {
    if (sessionComplete && flipped) {
      const timer = setTimeout(() => {
        setFlipped(false);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [sessionComplete, flipped]);

  // Helper values for dynamic card state display
  const totalPomos = flattenedPomodoros.length;
  const isBeforeStart = !timerRunning && currentPomodoroIndex === 0 && pomodorosCompleted === 0;

  let titleVal = isBreakMode ? 'Rest Break' : 'Focus Session';
  let activeTaskVal = flattenedPomodoros[currentPomodoroIndex]?.taskText || 'Ready to Focus';
  let pomoProgress = `${currentPomodoroIndex + 1} / ${totalPomos || 1}`;
  let progressPercent = totalPomos > 0 ? Math.round((currentPomodoroIndex / totalPomos) * 100) : 0;
  let nextTextVal = isBreakMode ? 'Focus Session' : 'Short Break';

  if (isBeforeStart) {
    titleVal = 'Ready to Focus';
    activeTaskVal = tasks[0]?.text || 'No tasks planned';
    pomoProgress = `0 / ${totalPomos || 3}`;
    progressPercent = 0;
    nextTextVal = 'Press Start to begin';
  } else if (sessionComplete) {
    titleVal = 'Session Complete ✓';
    activeTaskVal = 'Excellent work!';
    pomoProgress = `${pomodorosCompleted} Completed`;
    progressPercent = 100;
    nextTextVal = `Focused for ${formatFocusTime(totalFocusTime)}`;
  }

  // Keyboard navigation accessibility
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setFlipped(prev => !prev);
    }
  };

  return (
    <div 
      className={`${styles.card} ${flipped ? styles.flipped : ''}`}
      onClick={() => setFlipped(prev => !prev)}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label="Toggle Focus Status Overview Card"
    >
      <div className={styles.cardInner}>
        {/* Front: Inspirational Quote */}
        <div className={styles.cardFront}>
          <span className={styles.quoteIcon}>&ldquo;</span>
          <p className={`${styles.text} ${isFading ? styles.fading : ''}`}>
            {motivationalQuotes[index]}
          </p>
        </div>

        {/* Back: Live Focus Session Overview */}
        <div className={styles.cardBack}>
          <div className={styles.backHeader}>
            {timerRunning && !isBeforeStart && !sessionComplete && (
              <span className={styles.pulseDot}></span>
            )}
            <h4 className={styles.backTitle}>{titleVal}</h4>
          </div>

          <div className={styles.backMain}>
            <div className={styles.activeTaskArea}>
              <span className={styles.label}>Active Task</span>
              <p className={styles.taskName}>{activeTaskVal}</p>
            </div>

            <div className={styles.statsGrid}>
              <div className={styles.statBox}>
                <span className={styles.label}>Pomodoro</span>
                <span className={styles.value}>{pomoProgress}</span>
              </div>
              <div className={styles.statBox}>
                <span className={styles.label}>Time</span>
                <span className={styles.value}>
                  {sessionComplete ? 'Done' : formatTime(timerSeconds)}
                </span>
              </div>
            </div>
          </div>

          <div className={styles.progressSection}>
            <div className={styles.progressBarBg}>
              <div 
                className={styles.progressBarFill} 
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
            <div className={styles.progressTextRow}>
              <span className={styles.nextEvent}>
                {nextTextVal}
              </span>
              <span className={styles.percentText}>
                {progressPercent}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
