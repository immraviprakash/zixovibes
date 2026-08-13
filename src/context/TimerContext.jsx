import { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useApp } from './AppContext';
import { generateFocusPlan, focusPlaylists, sanitizePlan } from '../data/focusData';

const TimerContext = createContext(null);

const STORAGE_KEY = 'zixovibes_deepfocus';

export function TimerProvider({ children }) {
  const {
    hasOnboarded,
    tasks,
    setTasks,
    currentPomodoroIndex,
    setCurrentPomodoroIndex,
    pomodorosCompleted,
    setPomodorosCompleted,
    totalFocusTime,
    setTotalFocusTime,
    setSessionComplete,
    flattenedPomodoros,
    playbackSettings,
    stats,
    setStats,
    sessionTitle,
    setSessionTitle,
    sessionSubtitle,
    setSessionSubtitle,
    estimatedDuration,
    setEstimatedDuration,
    suggestedPomodoros,
    setSuggestedPomodoros,
    motivationalNote,
    setMotivationalNote,
    selectedFocusPlaylist,
    sessionComplete,
    hasDismissedCompletion,
    setHasDismissedCompletion,
    notebookOpen,
    initialTimerState,
    announce,
    setClassicIsPlaying,
    setActivePlaylist,
    setCurrentSong,
    songs,
    generateAIPlaylistForTaskText,
    favoritePlaylists,
  } = useApp();

  const [timerSeconds, setTimerSeconds] = useState(initialTimerState.timerSeconds);
  const [timerRunning, setTimerRunning] = useState(initialTimerState.timerRunning);
  const [timerDuration, setTimerDuration] = useState(initialTimerState.timerDuration);
  const [isBreakMode, setIsBreakMode] = useState(initialTimerState.isBreakMode);
  const [showPomodoroOverlay, setShowPomodoroOverlay] = useState(initialTimerState.showPomodoroOverlay);
  const [showBreakCompleteOverlay, setShowBreakCompleteOverlay] = useState(initialTimerState.showBreakCompleteOverlay);
  const [autoStartAfterBreak, setAutoStartAfterBreak] = useState(initialTimerState.autoStartAfterBreak || false);

  // Time stamp reconciliation to eliminate drift
  const expectedTimeRef = useRef(null);

  // Synchronize timer durations from active pomodoro when index changes or plan updates
  const lastActivePomoRef = useRef(null);
  const isInitialMountRef = useRef(true);
  useEffect(() => {
    if (!isBreakMode) {
      const activePomo = flattenedPomodoros[currentPomodoroIndex];
      const activePomoDuration = activePomo ? activePomo.duration * 60 : 1500;
      
      setTimerDuration(activePomoDuration);
      
      // If we switched pomodoros, reset the countdown seconds
      // But skip resetting on initial mount to preserve recovered countdown state
      if (isInitialMountRef.current) {
        isInitialMountRef.current = false;
        lastActivePomoRef.current = currentPomodoroIndex;
      } else {
        if (lastActivePomoRef.current !== currentPomodoroIndex) {
          setTimerSeconds(activePomoDuration);
          expectedTimeRef.current = null;
        }
        lastActivePomoRef.current = currentPomodoroIndex;
      }
    } else {
      if (isInitialMountRef.current) {
        isInitialMountRef.current = false;
      }
    }
  }, [currentPomodoroIndex, flattenedPomodoros, isBreakMode]);

  // Derived recommended break minutes
  const recommendedBreakMinutes = useMemo(() => {
    const focusMins = Math.round(timerDuration / 60);
    let breakMins = 5;
    if (focusMins <= 25) {
      breakMins = 5;
    } else if (focusMins <= 45) {
      breakMins = 12;
    } else {
      breakMins = Math.round(focusMins * 0.3);
    }

    const incompleteTasksCount = tasks.filter(t => !t.completed).length;
    if (incompleteTasksCount > 4) {
      breakMins += 2;
    }
    return Math.min(25, Math.max(1, breakMins));
  }, [timerDuration, tasks]);

  // Handle break and pomodoro completions
  const handlePomodoroComplete = useCallback(() => {
    setTimerRunning(false);
    setPomodorosCompleted(p => p + 1);
    setTotalFocusTime(t => t + timerDuration);
    setStats(prev => ({
      ...prev,
      totalSessions: prev.totalSessions + 1,
      totalFocusMinutes: prev.totalFocusMinutes + Math.floor(timerDuration / 60),
    }));
    setShowPomodoroOverlay(true);
    announce("Focus session pomodoro complete. Take a break.");
    console.warn("[Timer Engine] Focus session pomodoro complete. Triggered break selection prompt.");
  }, [timerDuration, setPomodorosCompleted, setTotalFocusTime, setStats, announce]);

  const handleBreakComplete = useCallback(() => {
    if (autoStartAfterBreak) {
      setAutoStartAfterBreak(false);
      setIsBreakMode(false);
      setShowPomodoroOverlay(false);
      setShowBreakCompleteOverlay(false);
      
      const activePomo = flattenedPomodoros[currentPomodoroIndex];
      const activePomoDuration = activePomo ? activePomo.duration * 60 : 1500;
      setTimerDuration(activePomoDuration);
      setTimerSeconds(activePomoDuration);
      setTimerRunning(true);
      expectedTimeRef.current = Date.now() + activePomoDuration * 1000;
      announce(activePomo ? `Break complete. Starting next session: ${activePomo.name}` : "Break complete. Starting next session.");
    } else {
      setTimerRunning(false);
      setIsBreakMode(false);
      setShowBreakCompleteOverlay(true);
      announce("Rest break complete. Ready to resume focus.");
      console.warn("[Timer Engine] Rest break complete. Triggered resume focus prompt.");
    }
  }, [autoStartAfterBreak, currentPomodoroIndex, flattenedPomodoros, announce]);

  // Timer Ticks implementation (driftless)
  useEffect(() => {
    if (!timerRunning || timerSeconds <= 0) {
      expectedTimeRef.current = null;
      return;
    }

    if (!expectedTimeRef.current) {
      expectedTimeRef.current = Date.now() + timerSeconds * 1000;
    }

    const tick = () => {
      const remaining = Math.round((expectedTimeRef.current - Date.now()) / 1000);
      if (remaining <= 0) {
        setTimerSeconds(0);
        setTimerRunning(false);
        expectedTimeRef.current = null;
        if (isBreakMode) {
          handleBreakComplete();
        } else {
          handlePomodoroComplete();
        }
      } else {
        setTimerSeconds(remaining);
      }
    };

    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [timerRunning, isBreakMode, handleBreakComplete, handlePomodoroComplete]);

  // Mode transition lifecycle action (pause timer and clear overlays on classic mode)
  const appMode = useApp().mode;
  useEffect(() => {
    if (appMode === 'classic') {
      if (timerRunning) {
        setTimerRunning(false);
        console.warn("[Timer Engine] Paused countdown automatically due to active Classic Mode.");
      }
      setShowPomodoroOverlay(false);
      setShowBreakCompleteOverlay(false);
    }
  }, [appMode, timerRunning]);

  // Actions
  const handleStartBreak = useCallback(() => {
    setShowPomodoroOverlay(false);
    setIsBreakMode(true);
    const secs = recommendedBreakMinutes * 60;
    setTimerSeconds(secs);
    expectedTimeRef.current = Date.now() + secs * 1000;
    setTimerRunning(true);
    announce("Break started.");
  }, [recommendedBreakMinutes, announce]);

  const handleTake5MinBreak = useCallback(() => {
    setShowPomodoroOverlay(false);
    setShowBreakCompleteOverlay(false);
    setIsBreakMode(true);
    const secs = 5 * 60;
    setTimerSeconds(secs);
    setTimerRunning(false);
    expectedTimeRef.current = null;
    announce("5-minute break selected. Press Start Break when ready.");
  }, [announce]);

  const advanceSessionPomodoro = useCallback((shouldStartRunning = false) => {
    let updatedTasks = [...tasks];
    const currentPomo = flattenedPomodoros[currentPomodoroIndex];
    let isTaskCompletedNow = false;
    let completedTaskIdx = -1;

    if (currentPomo) {
      const taskIdx = currentPomo.taskIndex;
      const nextIdx = currentPomodoroIndex + 1;
      const isLastPomoOfTask = !flattenedPomodoros[nextIdx] || flattenedPomodoros[nextIdx].taskIndex !== taskIdx;
      
      if (isLastPomoOfTask) {
        isTaskCompletedNow = true;
        completedTaskIdx = taskIdx;
        updatedTasks[taskIdx] = { 
          ...updatedTasks[taskIdx], 
          completed: true, 
          status: 'Completed' 
        };
      }
    }

    if (isTaskCompletedNow) {
      setTasks(updatedTasks);
      setStats(s => ({ ...s, tasksCompleted: s.tasksCompleted + 1 }));
      announce(`Task completed: ${tasks[completedTaskIdx].text}`);
    }

    setShowPomodoroOverlay(false);
    setShowBreakCompleteOverlay(false);
    setIsBreakMode(false);
    setTimerRunning(shouldStartRunning);

    if (!isTaskCompletedNow) {
      const nextIdx = currentPomodoroIndex + 1;
      if (nextIdx < flattenedPomodoros.length) {
        setCurrentPomodoroIndex(nextIdx);
        const nextPomo = flattenedPomodoros[nextIdx];
        const nextDuration = nextPomo ? nextPomo.duration * 60 : timerDuration;
        setTimerDuration(nextDuration);
        setTimerSeconds(nextDuration);
        expectedTimeRef.current = shouldStartRunning ? Date.now() + nextDuration * 1000 : null;
        announce(`Continuing to ${nextPomo ? nextPomo.name : 'next session'}`);
      } else {
        setTimerRunning(false);
        expectedTimeRef.current = null;
        setSessionComplete(true);
        announce("All focus sessions completed.");
      }
    } else {
      const nextIncompleteIdx = updatedTasks.findIndex((t) => !t.completed && (!t.taskType || t.taskType === 'focus'));
      if (nextIncompleteIdx !== -1) {
        let flatIdx = 0;
        for (let i = 0; i < nextIncompleteIdx; i++) {
          if (!updatedTasks[i].taskType || updatedTasks[i].taskType === 'focus') {
            flatIdx += updatedTasks[i].pomodoros ? updatedTasks[i].pomodoros.length : 1;
          }
        }
        
        setCurrentPomodoroIndex(flatIdx);

        const nextTask = updatedTasks[nextIncompleteIdx];
        const totalPomos = nextTask.pomodoros ? nextTask.pomodoros.length : 1;
        const nextDurationVal = Array.isArray(nextTask.pomodoroDurations) && nextTask.pomodoroDurations[0] !== undefined
          ? nextTask.pomodoroDurations[0]
          : Math.round((nextTask.estimatedDuration || (totalPomos * 25)) / totalPomos);

        const nextDurationSecs = nextDurationVal * 60;
        setTimerDuration(nextDurationSecs);
        setTimerSeconds(nextDurationSecs);
        expectedTimeRef.current = shouldStartRunning ? Date.now() + nextDurationSecs * 1000 : null;
        announce(`Continuing to next task: ${nextTask.text}`);
      } else {
        setTimerRunning(false);
        expectedTimeRef.current = null;
        setSessionComplete(true);
        announce("All focus sessions completed.");
      }
    }
  }, [currentPomodoroIndex, flattenedPomodoros, tasks, setTasks, timerDuration, setCurrentPomodoroIndex, setSessionComplete, setStats, announce, setTimerDuration, setTimerSeconds, setShowPomodoroOverlay, setShowBreakCompleteOverlay, setIsBreakMode, setTimerRunning]);

  const hasNextSession = useCallback(() => {
    const currentPomo = flattenedPomodoros[currentPomodoroIndex];
    if (!currentPomo) return false;

    const taskIdx = currentPomo.taskIndex;
    const nextIdx = currentPomodoroIndex + 1;
    const isLastPomoOfTask = !flattenedPomodoros[nextIdx] || flattenedPomodoros[nextIdx].taskIndex !== taskIdx;

    if (!isLastPomoOfTask) {
      return nextIdx < flattenedPomodoros.length;
    } else {
      const hasIncomplete = tasks.some((t, idx) => idx !== taskIdx && !t.completed && (!t.taskType || t.taskType === 'focus'));
      return hasIncomplete;
    }
  }, [currentPomodoroIndex, flattenedPomodoros, tasks]);

  const handleTake5MinBreakAndStartNext = useCallback(() => {
    advanceSessionPomodoro(false);
    
    setIsBreakMode(true);
    const secs = 5 * 60;
    setTimerSeconds(secs);
    setTimerDuration(secs);
    setAutoStartAfterBreak(true);
    setTimerRunning(true);
    expectedTimeRef.current = Date.now() + secs * 1000;
    announce("5-minute break started. Next session will start automatically after the break.");
  }, [advanceSessionPomodoro, announce]);

  const handleStartNextSessionNow = useCallback(() => {
    advanceSessionPomodoro(true);
  }, [advanceSessionPomodoro]);

  const handleSkipBreak = useCallback(() => {
    setAutoStartAfterBreak(false);
    setIsBreakMode(false);
    setShowPomodoroOverlay(false);
    setShowBreakCompleteOverlay(false);
    advanceSessionPomodoro(true);
    announce("Break skipped. Starting next session.");
  }, [advanceSessionPomodoro, announce]);

  const handleContinuePomodoro = useCallback(() => {
    advanceSessionPomodoro(false);
  }, [advanceSessionPomodoro]);

  const handleStartNextSession = useCallback(() => {
    advanceSessionPomodoro(false);
  }, [advanceSessionPomodoro]);

  const handleResumeFocus = useCallback(() => {
    advanceSessionPomodoro(false);
  }, [advanceSessionPomodoro]);

  const changeTimerDuration = useCallback((mins) => {
    const secs = mins * 60;
    setTimerDuration(secs);
    setTimerSeconds(secs);
    expectedTimeRef.current = null;
    
    // Update active task's duration in the plan
    const activePomo = flattenedPomodoros[currentPomodoroIndex];
    if (activePomo) {
      const taskIdx = activePomo.taskIndex;
      setTasks(prev => {
        const next = [...prev];
        const task = next[taskIdx];
        if (task) {
          const totalPomos = task.pomodoros ? task.pomodoros.length : 1;
          let pomodoroDurations = Array.isArray(task.pomodoroDurations) ? [...task.pomodoroDurations] : [];
          if (pomodoroDurations.length !== totalPomos) {
            const avg = Math.round(task.estimatedDuration / totalPomos) || 25;
            pomodoroDurations = Array(totalPomos).fill(avg);
          }
          pomodoroDurations[activePomo.index] = mins;
          
          next[taskIdx] = {
            ...task,
            estimatedDuration: pomodoroDurations.reduce((sum, d) => sum + d, 0),
            pomodoroCount: totalPomos,
            pomodoroDurations
          };
        }
        return next;
      });
    }
    announce(`Timer updated to ${mins} minutes.`);
  }, [currentPomodoroIndex, flattenedPomodoros, setTasks, announce]);

  const resetTimerState = useCallback(() => {
    setTimerSeconds(1500);
    setTimerRunning(false);
    setTimerDuration(1500);
    setIsBreakMode(false);
    setShowPomodoroOverlay(false);
    setShowBreakCompleteOverlay(false);
    expectedTimeRef.current = null;
  }, []);

  // Synchronize reset logic from AppContext
  const prevHasOnboarded = useRef(hasOnboarded);
  useEffect(() => {
    if (prevHasOnboarded.current && !hasOnboarded) {
      resetTimerState();
    }
    prevHasOnboarded.current = hasOnboarded;
  }, [hasOnboarded, resetTimerState]);

  // Screen Reader Live Announcements for Timer/Break transitions
  const prevTimerRunning = useRef(timerRunning);
  useEffect(() => {
    if (appMode !== 'deepfocus') return;
    
    if (timerRunning !== prevTimerRunning.current) {
      if (timerRunning) {
        if (isBreakMode) {
          announce("Break timer started.");
        } else {
          announce(prevTimerRunning.current === false && timerSeconds < timerDuration ? "Focus session resumed." : "Focus session started.");
        }
      } else {
        if (timerSeconds > 0 && !showPomodoroOverlay && !showBreakCompleteOverlay) {
          announce("Focus session paused.");
        }
      }
      prevTimerRunning.current = timerRunning;
    }
  }, [timerRunning, isBreakMode, timerSeconds, timerDuration, showPomodoroOverlay, showBreakCompleteOverlay, announce, appMode]);


  // Replanning session - merges completed tasks and regenerates from new input
  // Replanning session - merges completed tasks and reorganizes from new input using the AI Planning service
  const replanSession = useCallback(async (newInput) => {
    try {
      const response = await fetch('http://localhost:3001/api/ai/df/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'replan',
          rawInput: newInput,
          currentPlan: {
            sessionTitle,
            sessionSubtitle,
            tasks,
            suggestedPlaylist: { id: selectedFocusPlaylist?.id || 'f2' }
          },
          availableTime: 120
        })
      });

      if (!response.ok) {
        let errMsg = "Planning service is temporarily unavailable. Your current workspace has not been modified.";
        try {
          const errData = await response.json();
          if (errData.error) errMsg = errData.error;
        } catch (_) {}
        throw new Error(errMsg);
      }

      const data = await response.json();
      if (data.needsClarification) {
        throw new Error(`Clarification needed: ${data.clarificationQuestion}`);
      }

      const sanitized = sanitizePlan(data.plan);

      const mergedTasks = sanitized.tasks.map((t) => {
        const existing = tasks.find(ex => ex.text === t.text);
        if (existing) {
          return {
            ...t,
            completed: existing.completed,
            status: existing.status,
            taskType: existing.taskType || t.taskType,
            estimatedDuration: existing.estimatedDuration,
            pomodoroCount: existing.pomodoroCount,
            pomodoroDurations: existing.pomodoroDurations,
            pomodoros: existing.pomodoros
          };
        }
        return {
          ...t,
          completed: t.status === 'Completed' || t.completed || false
        };
      });

      setTasks(mergedTasks);
      setSessionTitle(sanitized.sessionTitle);
      setSessionSubtitle(sanitized.sessionSubtitle || "Refined Plan");
      setMotivationalNote(sanitized.motivationalNote || "");
      setSuggestedPomodoros(sanitized.suggestedPomodoros);

      const durationMins = sanitized.totalDuration || (sanitized.suggestedPomodoros * 25);
      const hours = Math.floor(durationMins / 60);
      const mins = durationMins % 60;
      setEstimatedDuration(
        hours > 0
          ? `${hours} Hour${hours > 1 ? 's' : ''}${mins > 0 ? ` ${mins} Minutes` : ''}`
          : `${mins} Minutes`
      );

      const firstIncompleteIdx = mergedTasks.findIndex(t => !t.completed && (!t.taskType || t.taskType === 'focus'));
      if (firstIncompleteIdx !== -1) {
        let flatIdx = 0;
        for (let i = 0; i < firstIncompleteIdx; i++) {
          if (!mergedTasks[i].taskType || mergedTasks[i].taskType === 'focus') {
            flatIdx += mergedTasks[i].pomodoros ? mergedTasks[i].pomodoros.length : 1;
          }
        }
        setCurrentPomodoroIndex(flatIdx);
      } else {
        let totalPomos = 0;
        mergedTasks.forEach(t => {
          if (!t.taskType || t.taskType === 'focus') {
            totalPomos += t.pomodoros ? t.pomodoros.length : 1;
          }
        });
        setCurrentPomodoroIndex(totalPomos > 0 ? totalPomos - 1 : 0);
      }

      const isFav = favoritePlaylists.some(p => String(p.playlistId) === 'playlist_for_you');
      const isActivePlaylistFav = selectedFocusPlaylist?.id === 'playlist_for_you' && isFav;

      if (!isActivePlaylistFav && sanitized.suggestedPlaylist && sanitized.suggestedPlaylist.id) {
        const matchedPlaylist = focusPlaylists.find(p => p.id === sanitized.suggestedPlaylist.id) || focusPlaylists[0];
        setActivePlaylist(matchedPlaylist);
        if (matchedPlaylist && songs && songs.length > 0) {
          const playlistSongs = songs.filter(s => s.playlist === matchedPlaylist.id);
          if (playlistSongs.length > 0) {
            setCurrentSong(playlistSongs[0]);
          }
        }
      }

      const focusTasks = mergedTasks.filter(t => !t.taskType || t.taskType === 'focus');
      const focusDurationMins = focusTasks.reduce((sum, t) => {
        const duration = typeof t.estimatedDuration === 'number'
          ? t.estimatedDuration
          : ((t.pomodoroCount || t.pomodoros?.length || 0) * 25);
        return sum + duration;
      }, 0);

      generateAIPlaylistForTaskText(newInput, focusDurationMins * 60);

      announce("Focus plan updated.");
    } catch (error) {
      console.error('[TimerContext] Replan error:', error);
      let displayMsg = error.message;
      if (displayMsg === 'Failed to fetch' || displayMsg.includes('fetch')) {
        displayMsg = "Planning service is temporarily unavailable. Your current workspace has not been modified.";
      }
      throw new Error(displayMsg);
    }
  }, [
    tasks, setTasks, setSessionTitle, setSessionSubtitle,
    setMotivationalNote, setSuggestedPomodoros, setEstimatedDuration,
    setCurrentPomodoroIndex, announce,
    sessionTitle, sessionSubtitle, selectedFocusPlaylist, setActivePlaylist, setCurrentSong, songs, generateAIPlaylistForTaskText, favoritePlaylists
  ]);

  // Persist session changes using debouncing for active timer seconds
  const lastSavedSecondsRef = useRef(timerSeconds);
  const saveState = useCallback(() => {
    try {
      const stateToSave = {
        hasOnboarded,
        sessionTitle,
        sessionSubtitle,
        tasks,
        estimatedDuration,
        suggestedPomodoros,
        motivationalNote,
        timerSeconds,
        totalFocusTime,
        selectedFocusPlaylist,
        pomodorosCompleted,
        currentPomodoroIndex,
        isBreakMode,
        timerDuration,
        notebookOpen,
        sessionComplete,
        hasDismissedCompletion,
        playbackSettings,
        // Timer Provider states
        timerRunning,
        showPomodoroOverlay,
        showBreakCompleteOverlay,
        autoStartAfterBreak,
        lastUpdatedAt: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
      lastSavedSecondsRef.current = timerSeconds;
    } catch (e) {
      console.warn("[Storage Repair] Failed to serialize countdown parameters.", e);
    }
  }, [
    hasOnboarded, sessionTitle, sessionSubtitle, tasks, estimatedDuration,
    suggestedPomodoros, motivationalNote, timerSeconds, totalFocusTime,
    selectedFocusPlaylist, pomodorosCompleted, currentPomodoroIndex, isBreakMode,
    timerDuration, notebookOpen, sessionComplete, hasDismissedCompletion,
    playbackSettings, timerRunning, showPomodoroOverlay, showBreakCompleteOverlay,
    autoStartAfterBreak
  ]);

  // Debounced write hook for countdown ticks (every 10s), immediate for all other modifications
  useEffect(() => {
    const isTickOnly = Math.abs(lastSavedSecondsRef.current - timerSeconds) === 1 && timerRunning;
    if (!isTickOnly) {
      saveState();
    } else if (timerSeconds % 10 === 0 || timerSeconds === 0) {
      saveState();
    }
  }, [
    timerSeconds, timerRunning, isBreakMode, showPomodoroOverlay, showBreakCompleteOverlay,
    hasOnboarded, tasks, currentPomodoroIndex, pomodorosCompleted, totalFocusTime,
    sessionComplete, hasDismissedCompletion, notebookOpen, playbackSettings, saveState,
    autoStartAfterBreak
  ]);

  // Save state on window unloading/unmount
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveState();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveState]);

  const value = {
    timerSeconds,
    setTimerSeconds,
    timerRunning,
    setTimerRunning,
    timerDuration,
    setTimerDuration,
    isBreakMode,
    recommendedBreakMinutes,
    showPomodoroOverlay,
    setShowPomodoroOverlay,
    showBreakCompleteOverlay,
    setShowBreakCompleteOverlay,
    handleStartBreak,
    handleTake5MinBreak,
    handleContinuePomodoro,
    handleStartNextSession,
    handleResumeFocus,
    changeTimerDuration,
    resetTimerState,
    replanSession,
    autoStartAfterBreak,
    setAutoStartAfterBreak,
    hasNextSession,
    handleTake5MinBreakAndStartNext,
    handleStartNextSessionNow,
    handleSkipBreak,
  };

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
}

export function useTimer() {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error('useTimer must be used within TimerProvider');
  return ctx;
}
