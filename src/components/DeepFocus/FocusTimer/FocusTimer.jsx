import { useState, useRef, useEffect } from 'react';
import { useApp } from '../../../context/AppContext';
import { useTimer } from '../../../context/TimerContext';
import styles from './FocusTimer.module.css';

export default function FocusTimer() {
  const {
    notebookOpen,
    setNotebookOpen,
    currentPomodoroIndex,
    flattenedPomodoros,
    tasks,
    resetSession,
  } = useApp();

  const {
    timerSeconds,
    timerRunning,
    setTimerRunning,
    isBreakMode,
    timerDuration,
    showPomodoroOverlay,
    handleStartBreak,
    handleTake5MinBreak,
    handleContinuePomodoro,
    handleStartNextSession,
    changeTimerDuration,
    recommendedBreakMinutes,
    showBreakCompleteOverlay,
    setShowBreakCompleteOverlay,
    handleResumeFocus,
    hasNextSession,
    handleTake5MinBreakAndStartNext,
    handleStartNextSessionNow,
    handleSkipBreak,
  } = useTimer();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customMins, setCustomMins] = useState('25');
  const [validationError, setValidationError] = useState('');
  const [isApplying, setIsApplying] = useState(false);

  const settingsRef = useRef(null);
  const settingsBtnRef = useRef(null);
  const customModalRef = useRef(null);
  const previousActiveElement = useRef(null);

  useEffect(() => {
    if (customModalOpen) {
      previousActiveElement.current = document.activeElement;

      const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
      const focusableElements = customModalRef.current?.querySelectorAll(focusableSelector);
      if (focusableElements && focusableElements.length > 0) {
        const inputEl = Array.from(focusableElements).find(el => el.tagName === 'INPUT');
        if (inputEl) {
          inputEl.focus();
        } else {
          focusableElements[0].focus();
        }
      }

      const handleKeyDown = (e) => {
        if (e.key === 'Tab') {
          if (!customModalRef.current) return;
          const elements = Array.from(customModalRef.current.querySelectorAll(focusableSelector));
          if (elements.length === 0) return;

          const first = elements[0];
          const last = elements[elements.length - 1];

          if (e.shiftKey) {
            if (document.activeElement === first) {
              last.focus();
              e.preventDefault();
            }
          } else {
            if (document.activeElement === last) {
              first.focus();
              e.preventDefault();
            }
          }
        } else if (e.key === 'Escape') {
          setCustomModalOpen(false);
          setValidationError('');
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        if (previousActiveElement.current && typeof previousActiveElement.current.focus === 'function') {
          previousActiveElement.current.focus();
        } else if (settingsBtnRef.current) {
          settingsBtnRef.current.focus();
        }
      };
    }
  }, [customModalOpen]);

  const minutes = Math.floor(timerSeconds / 60);
  const seconds = timerSeconds % 60;
  const display = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const handleStartPause = (e) => {
    e.stopPropagation();
    setTimerRunning(prev => !prev);
  };

  const handleSelectDuration = (mins) => {
    changeTimerDuration(mins);
    setSettingsOpen(false);
  };

  const handleCustomDuration = () => {
    setCustomMins(Math.max(1, Math.floor(timerDuration / 60)).toString());
    setValidationError('');
    setCustomModalOpen(true);
    setSettingsOpen(false);
  };

  const handleApplyCustom = (e) => {
    e.preventDefault();
    if (isApplying) return;

    const val = Number(customMins);
    if (!customMins.trim() || isNaN(val) || !Number.isInteger(val)) {
      setValidationError('Please enter a valid integer.');
      return;
    }
    if (val < 1) {
      setValidationError('Minimum focus length is 1 minute.');
      return;
    }
    if (val > 240) {
      setValidationError('Maximum focus length is 240 minutes.');
      return;
    }

    setIsApplying(true);
    setTimeout(() => {
      changeTimerDuration(val);
      setCustomModalOpen(false);
      setIsApplying(false);
    }, 300);
  };

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setSettingsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Derive upcoming pomodoro for complete modal overlay only
  const upcomingPomodoro =
    currentPomodoroIndex + 1 < flattenedPomodoros.length
      ? flattenedPomodoros[currentPomodoroIndex + 1]
      : null;

  return (
    <div className={styles.card}>
      {/* Pulse border glow when running */}
      {timerRunning && <div className={styles.pulseGlow} />}

      <div className={styles.header}>
        {/* Hourglass icon */}
        <div className={styles.headerLeft}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={styles.hourglassIcon}>
            <path d="M6 2h12M6 22h12M7.5 2v4.5c0 1.38.56 2.7 1.55 3.67L12 13.09l2.95-2.92A5.21 5.21 0 0016.5 6.5V2M7.5 22v-4.5c0-1.38.56-2.7 1.55-3.67L12 10.91l2.95 2.92A5.21 5.21 0 0016.5 17.5V22" />
          </svg>
          <span className={styles.label}>{isBreakMode ? 'Break Time' : 'Focus Session'}</span>
        </div>

        {/* Action icons */}
        <div className={styles.headerRight} ref={settingsRef}>
          {/* Info toggle button */}
          <button
            className={`${styles.iconBtn} ${notebookOpen ? styles.iconBtnActive : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setNotebookOpen(prev => !prev);
            }}
            title={notebookOpen ? "Close Focus Planner" : "Open Focus Planner"}
            aria-label="Info"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </button>

          {/* Settings button */}
          <button
            className={`${styles.iconBtn} ${settingsOpen ? styles.iconBtnActive : ''} ${isBreakMode ? styles.iconBtnDisabled : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              if (isBreakMode) return;
              setSettingsOpen(prev => !prev);
            }}
            disabled={isBreakMode}
            title={isBreakMode ? "Settings unavailable during break" : "Timer Settings"}
            aria-label="Settings"
            ref={settingsBtnRef}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>

          {/* Settings Dropdown Popover */}
          {settingsOpen && (
            <div className={styles.settingsDropdown}>
              <span className={styles.settingsTitle}>Timer Length</span>
              <div className={styles.settingsOptions}>
                <button
                  className={`${styles.settingsOpt} ${timerDuration === 25 * 60 ? styles.settingsOptActive : ''}`}
                  onClick={() => handleSelectDuration(25)}
                >
                  25 Minutes
                </button>
                <button
                  className={`${styles.settingsOpt} ${timerDuration === 45 * 60 ? styles.settingsOptActive : ''}`}
                  onClick={() => handleSelectDuration(45)}
                >
                  45 Minutes
                </button>
                <button
                  className={`${styles.settingsOpt} ${(timerDuration !== 25 * 60 && timerDuration !== 45 * 60) ? styles.settingsOptActive : ''}`}
                  onClick={handleCustomDuration}
                >
                  Custom
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showPomodoroOverlay || showBreakCompleteOverlay ? (
        <div className={styles.completionContainer}>
          {showPomodoroOverlay ? (
            !hasNextSession() ? (
              <>
                <div className={styles.completionHeader}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--df-success, #6ec87a)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.planCompleteSvg}>
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="16 9 10.5 14.5 8 12" />
                  </svg>
                  <h3 className={styles.completionTitle}>Today's Focus Plan Complete</h3>
                  <p className={styles.completionSubtitle}>You completed every scheduled task.</p>
                </div>
                <div className={styles.completionActions}>
                  <button
                    className={styles.goldBtn}
                    onClick={() => {
                      setShowPomodoroOverlay(false);
                      resetSession();
                    }}
                  >
                    Finish Session
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className={styles.completionHeader}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--df-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={styles.completionSvg}>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <h3 className={styles.completionTitle}>Session Complete</h3>
                  <p className={styles.completionSubtitle}>
                    Pomodoro {(flattenedPomodoros[currentPomodoroIndex]?.index ?? 0) + 1} of {tasks[flattenedPomodoros[currentPomodoroIndex]?.taskIndex]?.pomodoros?.length ?? 1} Completed
                  </p>
                </div>
                <div className={styles.completionActions}>
                  <button
                    className={styles.goldBtn}
                    onClick={handleTake5MinBreakAndStartNext}
                  >
                    Take 5 min break & continue
                  </button>
                  <button
                    className={styles.secondaryBtn}
                    onClick={handleStartNextSessionNow}
                  >
                    Start next session now
                  </button>
                </div>
              </>
            )
          ) : (
            <>
              <div className={styles.completionHeader}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--df-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.completionSvg}>
                  <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
                  <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
                  <line x1="6" y1="1" x2="6" y2="4" />
                  <line x1="10" y1="1" x2="10" y2="4" />
                  <line x1="14" y1="1" x2="14" y2="4" />
                </svg>
                <h3 className={styles.completionTitle}>Break Complete</h3>
                <p className={styles.completionSubtitle}>Ready to continue?</p>
              </div>
              <div className={styles.completionActions}>
                <button
                  className={styles.goldBtn}
                  onClick={handleStartNextSession}
                >
                  Continue to Pomodoro {(flattenedPomodoros[currentPomodoroIndex + 1]?.index ?? 0) + 1}
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Clock display */}
          <div key={isBreakMode ? 'break-time' : 'focus-time'} className={styles.time}>
            {display}
          </div>

          {/* Hero control button */}
          <div key={isBreakMode ? 'break-controls' : 'focus-controls'} className={styles.controls}>
            {isBreakMode ? (
              <button
                className={styles.btn}
                onClick={handleSkipBreak}
              >
                SKIP BREAK
              </button>
            ) : (
              <button
                className={styles.btn}
                onClick={handleStartPause}
              >
                {timerRunning ? 'PAUSE' : 'START'}
              </button>
            )}
          </div>
        </>
      )}

      {/* Custom Duration Overlay Modal */}
      {customModalOpen && (
        <div
          className={styles.overlayModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="custom-timer-title"
          ref={customModalRef}
        >
          <form className={styles.modalCard} onSubmit={handleApplyCustom}>
            <div className={styles.modalSuccessIcon} style={{ fontSize: '1.4rem' }}>⏱</div>
            <h3 className={styles.modalHeading} id="custom-timer-title">Custom Duration</h3>
            <p className={styles.modalText} style={{ marginBottom: '4px' }}>
              Set focus length in minutes:
            </p>
            
            <input
              type="number"
              min="1"
              max="1440"
              value={customMins}
              onChange={(e) => {
                setCustomMins(e.target.value);
                setValidationError('');
              }}
              className={styles.modalInput}
              autoFocus
              placeholder="e.g. 25"
            />
            {validationError && (
              <span className={styles.modalError}>{validationError}</span>
            )}
            
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalContinueBtn}
                disabled={isApplying}
                onClick={() => {
                  setCustomModalOpen(false);
                  setValidationError('');
                }}
                aria-label="Cancel custom duration"
              >
                Cancel
              </button>
              <button
                type="submit"
                className={styles.modalStartBreakBtn}
                disabled={isApplying}
                aria-label="Apply custom duration"
              >
                {isApplying ? "Applying..." : "Apply"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
