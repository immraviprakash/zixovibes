import { useState } from 'react';
import { API_BASE, fetchWithTimeoutAndRetry } from '../../../config/api';
import { useApp } from '../../../context/AppContext';
import { useTimer } from '../../../context/TimerContext';
import { focusPlaylists, getRandomSubtitle, sanitizePlan } from '../../../data/focusData';
import styles from './FocusOnboarding.module.css';

export default function FocusOnboarding() {
  const {
    setHasOnboarded,
    setSessionTitle,
    setSessionSubtitle,
    setTasks,
    setEstimatedDuration,
    setSuggestedPomodoros,
    setMotivationalNote,
    announce,
    setActivePlaylist,
    setCurrentSong,
    songs,
    generateAIPlaylistForTaskText,
  } = useApp();

  const { setTimerSeconds } = useTimer();

  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [onboardingStage, setOnboardingStage] = useState('input'); // 'input' | 'preview'
  const [generatedPlan, setGeneratedPlan] = useState(null);
  const [validationError, setValidationError] = useState('');
  const [loadingText, setLoadingText] = useState('Analyzing Goals');
  
  const [needsClarification, setNeedsClarification] = useState(false);
  const [clarificationQuestion, setClarificationQuestion] = useState('');
  const [clarificationResponse, setClarificationResponse] = useState('');

  const validateFocusInput = (str) => {
    const trimmed = str.trim();
    if (trimmed.length === 0) return '';
    if (trimmed.length < 10) return 'Please describe your goals in more detail (at least 10 characters).';
    if (trimmed.length > 1000) return 'Your description is too long (maximum 1000 characters).';

    const letters = trimmed.replace(/[^a-zA-Z]/g, '');
    if (letters.length < 5) return 'Your goal must contain at least 5 letters.';

    const words = trimmed.split(/\s+/).filter(w => w.length > 0);
    if (words.length < 2) return 'Please describe your goals in at least 2 words.';

    const nonSpaces = trimmed.replace(/\s/g, '');
    if (letters.length / nonSpaces.length < 0.2) {
      return 'Please enter a meaningful goal description, not just symbols or numbers.';
    }

    return '';
  };

  const handleInputChange = (val) => {
    setInput(val);
    const err = validateFocusInput(val);
    setValidationError(err);
  };

  const handleGeneratePlan = async () => {
    if (!input.trim() || isProcessing) return;
    const err = validateFocusInput(input);
    if (err) {
      setValidationError(err);
      return;
    }

    setIsProcessing(true);
    setValidationError('');
    setLoadingText('Analyzing Goals');

    let secondsElapsed = 0;
    const interval = setInterval(() => {
      secondsElapsed += 1;
      if (secondsElapsed >= 5 && secondsElapsed < 15) {
        setLoadingText("Warming up Zix'Ovibes AI");
      } else if (secondsElapsed >= 15) {
        setLoadingText("Still connecting (Render free tier wakes in ~50s)");
      }
    }, 1000);

    try {
      const finalInput = needsClarification && clarificationResponse.trim()
        ? `${input}\nClarification: ${clarificationResponse.trim()}`
        : input;

      const response = await fetchWithTimeoutAndRetry(`${API_BASE}/api/ai/df/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'plan',
          rawInput: finalInput,
          availableTime: 120
        })
      });

      if (!response.ok) {
        let errMsg = "Unable to generate your focus plan right now. Please try again in a moment.";
        try {
          const errData = await response.json();
          if (errData.error) errMsg = errData.error;
        } catch (_) {}
        throw new Error(errMsg);
      }

      const data = await response.json();

      if (data.needsClarification) {
        setNeedsClarification(true);
        setClarificationQuestion(data.clarificationQuestion);
        setIsProcessing(false);
        announce("A clarification question is required.");
        return;
      }

      // Successful plan!
      const planData = sanitizePlan(data.plan);
      planData.playlistId = planData.suggestedPlaylist.id;
      planData.subtitle = planData.sessionSubtitle;

      setGeneratedPlan(planData);
      setOnboardingStage('preview');
      setNeedsClarification(false);
      setClarificationQuestion('');
      setClarificationResponse('');
      announce("Focus plan generated.");
    } catch (error) {
      console.error('[Onboarding] Error generating plan:', error);
      let displayMsg = error.message;
      if (displayMsg === 'Failed to fetch' || displayMsg.includes('fetch')) {
        displayMsg = "Unable to generate your focus plan right now. Please try again in a moment.";
      }
      setValidationError(displayMsg || "Unable to generate your focus plan right now. Please try again in a moment.");
    } finally {
      clearInterval(interval);
      setIsProcessing(false);
    }
  };

  const handleSkipOnboarding = () => {
    if (isProcessing) return;
    setIsProcessing(true);

    // Create an empty focus session with direct entry defaults
    setSessionTitle("Focus Session");
    setSessionSubtitle("Direct entry session");
    setTasks([]);
    setEstimatedDuration("");
    setSuggestedPomodoros(3);
    setMotivationalNote("");
    setTimerSeconds(25 * 60);

    const matchedPlaylist = focusPlaylists[0];
    setActivePlaylist(matchedPlaylist);
    if (matchedPlaylist && songs && songs.length > 0) {
      const playlistSongs = songs.filter(s => s.playlist === matchedPlaylist.id);
      if (playlistSongs.length > 0) {
        setCurrentSong(playlistSongs[0]);
      }
    }

    setIsFadingOut(true);
    announce("Focus session started.");
    setTimeout(() => {
      setHasOnboarded(true);
    }, 600);
  };

  const handleBeginSession = () => {
    if (!generatedPlan || isProcessing) return;
    setIsProcessing(true);

    // Set App context variables
    setSessionTitle(generatedPlan.sessionTitle);
    setSessionSubtitle(generatedPlan.subtitle);
    
    // Map initial task states ('Ready' for first task, 'Planned' for remaining)
    const parsedTasks = generatedPlan.tasks.map((t, idx) => ({
      ...t,
      status: idx === 0 ? 'Ready' : 'Planned',
      completed: t.status === 'Completed' || t.completed || false
    }));
    setTasks(parsedTasks);

    const durationMins = generatedPlan.totalDuration || (generatedPlan.suggestedPomodoros * 25);
    const hours = Math.floor(durationMins / 60);
    const mins = durationMins % 60;
    const durStr = hours > 0
      ? `${hours} Hour${hours > 1 ? 's' : ''}${mins > 0 ? ` ${mins} Minutes` : ''}`
      : `${mins} Minutes`;
    setEstimatedDuration(durStr);

    setSuggestedPomodoros(generatedPlan.suggestedPomodoros);
    setMotivationalNote(generatedPlan.motivationalNote);
    const firstTask = parsedTasks[0];
    let firstPomoMins = 25;
    if (firstTask) {
      const totalPomos = firstTask.pomodoros ? firstTask.pomodoros.length : 1;
      firstPomoMins = Array.isArray(firstTask.pomodoroDurations) && firstTask.pomodoroDurations[0] !== undefined
        ? firstTask.pomodoroDurations[0]
        : Math.round((firstTask.estimatedDuration || (totalPomos * 25)) / totalPomos);
    }
    setTimerSeconds(firstPomoMins * 60);

    // Map suggested playlist
    const matchedPlaylist = focusPlaylists.find(p => p.id === generatedPlan.playlistId) || focusPlaylists[0];
    setActivePlaylist(matchedPlaylist);
    if (matchedPlaylist && songs && songs.length > 0) {
      const playlistSongs = songs.filter(s => s.playlist === matchedPlaylist.id);
      if (playlistSongs.length > 0) {
        setCurrentSong(playlistSongs[0]);
      }
    }

    const focusTasks = parsedTasks.filter(t => !t.taskType || t.taskType === 'focus');
    const focusDurationMins = focusTasks.reduce((sum, t) => {
      const duration = typeof t.estimatedDuration === 'number'
        ? t.estimatedDuration
        : ((t.pomodoroCount || t.pomodoros?.length || 0) * 25);
      return sum + duration;
    }, 0);
    generateAIPlaylistForTaskText(input, focusDurationMins * 60);

    setIsFadingOut(true);
    announce("Focus session started.");
    setTimeout(() => {
      setHasOnboarded(true);
    }, 600);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      if (onboardingStage === 'input') {
        handleGeneratePlan();
      } else {
        handleBeginSession();
      }
    }
  };

  return (
    <div className={`${styles.overlay} ${isFadingOut ? styles.fadeOut : ''}`}>
      <div className={`${styles.panel} ${isProcessing ? styles.processing : ''}`}>

        <div className={styles.content}>
          {onboardingStage === 'input' ? (
            <>
              <div className={styles.accentLine} />

              <h2 className={styles.heading}>What are we focusing on today?</h2>
              <p className={styles.subtext}>
                Describe your goals. Let's structure a custom focus plan.
              </p>

              {needsClarification ? (
                <div style={{ marginTop: '12px', textAlign: 'left', width: '100%' }}>
                  <div style={{ color: 'var(--df-accent)', fontWeight: '600', marginBottom: '8px', fontSize: '0.92rem' }}>
                    Clarification Required: {clarificationQuestion}
                  </div>
                  <textarea
                    className={styles.textarea}
                    value={clarificationResponse}
                    onChange={(e) => setClarificationResponse(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Provide a quick clarification..."
                    rows={3}
                    disabled={isProcessing}
                    autoFocus
                  />
                </div>
              ) : (
                <textarea
                  className={styles.textarea}
                  value={input}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={"Example: Need to revise Machine Learning Module 3, practice KNN problems, prepare notes, and complete assignment."}
                  rows={5}
                  disabled={isProcessing}
                  autoFocus
                  aria-label="Describe your focus goals"
                  aria-describedby={validationError ? "onboarding-validation-error" : undefined}
                />
              )}

              {validationError && (
                <div id="onboarding-validation-error" className={styles.validationError} style={{ color: '#ff6b6b', fontSize: '0.85rem', marginTop: '6px', textAlign: 'left' }}>
                  ⚠️ {validationError}
                </div>
              )}

              <div className={styles.inputActions}>
                {needsClarification ? (
                  <button
                    type="button"
                    className={styles.skipBtn}
                    onClick={() => {
                      setNeedsClarification(false);
                      setClarificationQuestion('');
                      setClarificationResponse('');
                    }}
                    disabled={isProcessing}
                  >
                    Cancel
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.skipBtn}
                    onClick={handleSkipOnboarding}
                    disabled={isProcessing}
                    aria-label="Skip onboarding and enter workspace immediately"
                  >
                    Skip & Enter Workspace
                  </button>
                )}
                <button
                  className={styles.submitBtn}
                  onClick={handleGeneratePlan}
                  disabled={isProcessing || (needsClarification ? !clarificationResponse.trim() : (!input.trim() || !!validationError))}
                  aria-label="Generate focus plan"
                >
                  {isProcessing ? (
                    <span className={styles.loadingDots}>
                      <span>{loadingText}</span>
                      <span className={styles.dot}>.</span>
                      <span className={styles.dot}>.</span>
                      <span className={styles.dot}>.</span>
                    </span>
                  ) : (
                    'Generate Focus Plan'
                  )}
                </button>
              </div>

              <span className={styles.hint}>Ctrl + Enter to generate</span>
            </>
          ) : (
            <>
              {/* Preview Stage */}
              <div className={styles.previewHeader}>
                <div className={styles.accentLine} />
                <h2 className={styles.heading}>Your Focus Plan</h2>
              </div>

              <div className={styles.planCard}>
                <div className={styles.planMeta}>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Session Type</span>
                    <span className={styles.metaVal}>{generatedPlan.sessionTitle}</span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Pomodoros</span>
                    <span className={styles.metaVal}>{generatedPlan.suggestedPomodoros} Sessions</span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Duration</span>
                    <span className={styles.metaVal}>{generatedPlan.estimatedDuration}</span>
                  </div>
                </div>

                <div className={styles.planTasks}>
                  <span className={styles.tasksLabel}>Today's Schedule:</span>
                  <div className={styles.taskList}>
                    {generatedPlan.tasks.map((task, i) => (
                      <div key={i} className={styles.taskItem}>
                        <span className={styles.bullet}>✓</span>
                        <span className={styles.taskText}>{task.text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {generatedPlan.motivationalNote && (
                  <p className={styles.motivation}>
                    &ldquo;{generatedPlan.motivationalNote}&rdquo;
                  </p>
                )}
              </div>

              <div className={styles.previewActions}>
                <button
                  className={styles.backBtn}
                  onClick={() => setOnboardingStage('input')}
                  disabled={isProcessing}
                >
                  Edit Input
                </button>
                <button
                  className={styles.submitBtn}
                  onClick={handleBeginSession}
                  disabled={isProcessing}
                >
                  Begin Focus Session
                </button>
              </div>

              <span className={styles.hint}>Ctrl + Enter to start</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
