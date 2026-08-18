import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { API_BASE } from '../config/api';
import { generateFocusPlan } from '../data/focusData';
import { playlists } from '../data/mockData';
import { analyzeTask, generatePlaylistForTask } from '../data/musicBrain';
import initialPlaylists from '../../public/data/playlists.json';
import initialSongs from '../../public/data/songs.json';
import { fetchWithTimeoutAndRetry } from '../config/api';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  updateProfile
} from "firebase/auth";
import { 
  doc, 
  setDoc, 
  getDoc,
  collection,
  getDocs,
  query,
  orderBy,
  limit
} from "firebase/firestore";
import { auth, db } from '../firebase/firebase';

const AppContext = createContext(null);

const STORAGE_KEY = 'zixovibes_deepfocus';
const STATS_KEY = 'zixovibes_focus_stats';

function sanitizeTaskData(task) {
  if (!task || typeof task !== 'object') {
    console.warn("[State Recovery] Invalid task schema detected (not an object). Replaced with null.");
    return null;
  }
  const id = typeof task.id === 'string' ? task.id : `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const text = typeof task.text === 'string' ? task.text : 'Untitled Task';
  const completed = typeof task.completed === 'boolean' ? task.completed : false;
  
  const taskType = typeof task.taskType === 'string' ? task.taskType : 'focus';

  const pomodoros = [];
  if (taskType === 'focus') {
    if (Array.isArray(task.pomodoros)) {
      task.pomodoros.forEach(p => {
        if (typeof p === 'string') {
          pomodoros.push(p);
        }
      });
    }
    if (pomodoros.length === 0) {
      pomodoros.push(text);
    }
  }

  const synopsis = typeof task.synopsis === 'string' ? task.synopsis : '';
  const category = typeof task.category === 'string' ? task.category : 'Deep Work';
  const workCategory = typeof task.workCategory === 'string' ? task.workCategory : category;
  const executionLabel = typeof task.executionLabel === 'string' ? task.executionLabel : category;
  const executionPriority = typeof task.executionPriority === 'string' ? task.executionPriority : 'Medium';
  const status = typeof task.status === 'string' ? task.status : (completed ? 'Completed' : 'Planned');

  const pomodoroCount = taskType === 'focus'
    ? (typeof task.pomodoroCount === 'number' ? task.pomodoroCount : pomodoros.length)
    : 0;

  const estimatedDuration = typeof task.estimatedDuration === 'number'
    ? task.estimatedDuration
    : (taskType === 'focus' ? pomodoroCount * 25 : 0);
  
  const pomodoroDurations = taskType === 'focus'
    ? (Array.isArray(task.pomodoroDurations) ? task.pomodoroDurations : Array(pomodoroCount).fill(Math.round(estimatedDuration / pomodoroCount) || 25))
    : [];

  return {
    id,
    text,
    completed,
    taskType,
    pomodoros,
    synopsis,
    category,
    workCategory,
    executionLabel,
    executionPriority,
    estimatedDuration,
    pomodoroCount,
    status,
    pomodoroDurations
  };
}

function validatePlaylist(pl) {
  if (pl && typeof pl === 'object') {
    return {
      id: typeof pl.id === 'number' && !isNaN(pl.id) ? pl.id : 1,
      name: typeof pl.name === 'string' ? pl.name : 'Sleep',
      artwork: typeof pl.artwork === 'string' ? pl.artwork : '',
      label: typeof pl.label === 'string' ? pl.label : "Zix'Ovibes Library",
      title: typeof pl.title === 'string' ? pl.title : '',
      artist: typeof pl.artist === 'string' ? pl.artist : '',
      songName: typeof pl.songName === 'string' ? pl.songName : '',
      duration: typeof pl.duration === 'number' && !isNaN(pl.duration) ? Math.max(1, pl.duration) : 225,
    };
  }
  return null;
}

function validateDeepFocusState(savedData) {
  if (!savedData || typeof savedData !== 'object') {
    console.warn("[State Recovery] Invalid session state format. Triggering default state fallback.");
    return null;
  }

  const validated = {};

  // Booleans
  validated.hasOnboarded = typeof savedData.hasOnboarded === 'boolean' ? savedData.hasOnboarded : false;
  validated.timerRunning = typeof savedData.timerRunning === 'boolean' ? savedData.timerRunning : false;
  validated.isBreakMode = typeof savedData.isBreakMode === 'boolean' ? savedData.isBreakMode : false;
  validated.sessionComplete = typeof savedData.sessionComplete === 'boolean' ? savedData.sessionComplete : false;
  validated.hasDismissedCompletion = typeof savedData.hasDismissedCompletion === 'boolean' ? savedData.hasDismissedCompletion : false;
  validated.notebookOpen = typeof savedData.notebookOpen === 'boolean' ? savedData.notebookOpen : false;
  validated.showPomodoroOverlay = typeof savedData.showPomodoroOverlay === 'boolean' ? savedData.showPomodoroOverlay : false;
  validated.showBreakCompleteOverlay = typeof savedData.showBreakCompleteOverlay === 'boolean' ? savedData.showBreakCompleteOverlay : false;
  validated.autoStartAfterBreak = typeof savedData.autoStartAfterBreak === 'boolean' ? savedData.autoStartAfterBreak : false;

  // Strings
  validated.sessionTitle = typeof savedData.sessionTitle === 'string' ? savedData.sessionTitle : '';
  validated.sessionSubtitle = typeof savedData.sessionSubtitle === 'string' ? savedData.sessionSubtitle : '';
  validated.estimatedDuration = typeof savedData.estimatedDuration === 'string' ? savedData.estimatedDuration : '';
  validated.motivationalNote = typeof savedData.motivationalNote === 'string' ? savedData.motivationalNote : '';

  // Numbers (with NaN and boundaries validation)
  validated.suggestedPomodoros = typeof savedData.suggestedPomodoros === 'number' && !isNaN(savedData.suggestedPomodoros)
    ? Math.max(1, savedData.suggestedPomodoros)
    : 3;
  validated.timerSeconds = typeof savedData.timerSeconds === 'number' && !isNaN(savedData.timerSeconds)
    ? Math.max(0, savedData.timerSeconds)
    : 1500;
  validated.totalFocusTime = typeof savedData.totalFocusTime === 'number' && !isNaN(savedData.totalFocusTime)
    ? Math.max(0, savedData.totalFocusTime)
    : 0;
  validated.pomodorosCompleted = typeof savedData.pomodorosCompleted === 'number' && !isNaN(savedData.pomodorosCompleted)
    ? Math.max(0, savedData.pomodorosCompleted)
    : 0;
  validated.currentPomodoroIndex = typeof savedData.currentPomodoroIndex === 'number' && !isNaN(savedData.currentPomodoroIndex)
    ? Math.max(0, savedData.currentPomodoroIndex)
    : 0;
  validated.timerDuration = typeof savedData.timerDuration === 'number' && !isNaN(savedData.timerDuration)
    ? Math.max(1, savedData.timerDuration)
    : 1500;

  // Playlist object
  if (savedData.selectedFocusPlaylist && typeof savedData.selectedFocusPlaylist === 'object') {
    const pl = savedData.selectedFocusPlaylist;
    validated.selectedFocusPlaylist = {
      id: typeof pl.id === 'string' ? pl.id : 'default',
      name: typeof pl.name === 'string' ? pl.name : 'Focus Track',
      title: typeof pl.title === 'string' ? pl.title : 'Focus Track',
      artist: typeof pl.artist === 'string' ? pl.artist : 'Ambient',
      artwork: typeof pl.artwork === 'string' ? pl.artwork : '',
      duration: typeof pl.duration === 'number' && !isNaN(pl.duration) ? Math.max(1, pl.duration) : 225,
    };
  } else {
    validated.selectedFocusPlaylist = null;
  }

  // Validate playbackSettings
  let rawSettings = savedData.playbackSettings;
  if (!rawSettings || typeof rawSettings !== 'object') {
    rawSettings = {
      volume: savedData.volume,
      isShuffle: savedData.isShuffle,
      isLoop: savedData.isLoop,
      isFavorited: savedData.isFavorited,
      activePlaylist: savedData.activePlaylist
    };
  }

  validated.playbackSettings = {
    volume: typeof rawSettings.volume === 'number' && !isNaN(rawSettings.volume)
      ? Math.min(100, Math.max(0, rawSettings.volume))
      : 65,
    isShuffle: typeof rawSettings.isShuffle === 'boolean' ? rawSettings.isShuffle : false,
    isLoop: typeof rawSettings.isLoop === 'boolean' ? rawSettings.isLoop : false,
    isFavorited: typeof rawSettings.isFavorited === 'boolean' ? rawSettings.isFavorited : false,
    activePlaylist: validatePlaylist(rawSettings.activePlaylist) || playlists[0]
  };

  // Validate tasks list
  validated.tasks = [];
  if (Array.isArray(savedData.tasks)) {
    savedData.tasks.forEach(t => {
      const sanitized = sanitizeTaskData(t);
      if (sanitized) {
        validated.tasks.push(sanitized);
      }
    });
  } else {
    console.warn("[State Recovery] Tasks list is not an array. Recovered tasks to empty list.");
  }

  // Double check bounds for index mapping
  let totalPomodoros = 0;
  validated.tasks.forEach(t => {
    if (!t.taskType || t.taskType === 'focus') {
      totalPomodoros += t.pomodoros ? t.pomodoros.length : 1;
    }
  });
  if (validated.currentPomodoroIndex >= totalPomodoros && totalPomodoros > 0) {
    validated.currentPomodoroIndex = totalPomodoros - 1;
  }

  return validated;
}

function safeLoadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const validated = validateDeepFocusState(parsed);
    if (!validated) {
      console.warn("[Storage Repair] Restoring default session state due to validation failure.");
      return null;
    }

    // Check if the loaded session was fully completed!
    const loadedAllTasksDone = Array.isArray(validated.tasks) && validated.tasks.length > 0 && validated.tasks.every(t => t.completed);
    if (loadedAllTasksDone) {
      console.warn("[State Recovery] Session was completed in the previous application usage. Cleaning up Playlist For You and resetting focus session.");
      
      // Check if playlist_for_you is favorited. If not favorited, we clean it up!
      let isFav = false;
      try {
        const favsVal = localStorage.getItem('zixovibes_deepFocus_favorites') || localStorage.getItem('zixovibes_classic_favorites');
        if (favsVal) {
          const parsedFavs = JSON.parse(favsVal);
          isFav = parsedFavs.playlists?.some(x => String(x.playlistId) === 'playlist_for_you') || false;
        }
      } catch (_) {}

      if (!isFav) {
        localStorage.removeItem('zixovibes_playlist_for_you_songs');
        localStorage.removeItem('zixovibes_playlist_for_you_saved_songs');
        localStorage.removeItem('zixovibes_last_analyzed_task_text');
      }
      
      // Clean up local storage keys for completed session
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('zixovibes_active_session_id');
      localStorage.removeItem('zixovibes_current_notes');
      
      return null; // Return null so the session starts fresh!
    }

    // Perform elapsed time recovery calculations if timer was running
    if (validated.timerRunning && parsed.lastUpdatedAt) {
      const elapsed = Math.floor((Date.now() - parsed.lastUpdatedAt) / 1000);
      if (elapsed > 0) {
        if (elapsed >= validated.timerSeconds) {
          // Completed the current phase!
          validated.timerRunning = false;
          validated.timerSeconds = 0;
          if (validated.isBreakMode) {
            // Completed break phase
            validated.isBreakMode = false;
            if (validated.autoStartAfterBreak) {
              validated.autoStartAfterBreak = false;
              // Automatically start next session
              let activePomoDuration = 1500;
              const list = [];
              if (Array.isArray(validated.tasks)) {
                validated.tasks.forEach((task, taskIdx) => {
                  if (task.pomodoros) {
                    const totalPomos = task.pomodoros.length || 1;
                    task.pomodoros.forEach((pName, pIdx) => {
                      const pomoDuration = Array.isArray(task.pomodoroDurations) && task.pomodoroDurations[pIdx] !== undefined
                        ? task.pomodoroDurations[pIdx]
                        : Math.round((task.estimatedDuration || (totalPomos * 25)) / totalPomos);
                      list.push(pomoDuration);
                    });
                  }
                });
              }
              const nextDuration = list[validated.currentPomodoroIndex] ? list[validated.currentPomodoroIndex] * 60 : 1500;
              const remainingAfterBreak = elapsed - validated.timerSeconds;
              if (remainingAfterBreak >= nextDuration) {
                // Completed the next session too!
                validated.timerRunning = false;
                validated.timerSeconds = 0;
                validated.showPomodoroOverlay = true;
                validated.pomodorosCompleted += 1;
                validated.totalFocusTime += nextDuration;
              } else {
                validated.timerRunning = true;
                validated.timerSeconds = nextDuration - remainingAfterBreak;
                validated.timerDuration = nextDuration;
              }
            } else {
              validated.showBreakCompleteOverlay = true;
            }
          } else {
            // Completed pomodoro focus phase
            validated.pomodorosCompleted += 1;
            validated.totalFocusTime += validated.timerDuration;
            validated.showPomodoroOverlay = true;

            // Also update stats in localStorage
            try {
              const statsRaw = localStorage.getItem(STATS_KEY);
              const stats = statsRaw ? JSON.parse(statsRaw) : { totalSessions: 0, totalFocusMinutes: 0, tasksCompleted: 0, longestStreakMinutes: 0 };
              stats.totalSessions = (stats.totalSessions || 0) + 1;
              stats.totalFocusMinutes = (stats.totalFocusMinutes || 0) + Math.floor(validated.timerDuration / 60);
              localStorage.setItem(STATS_KEY, JSON.stringify(stats));
            } catch (e) {
              console.warn("[State Recovery] Failed to update stats in localStorage.", e);
            }
          }
        } else {
          // Just subtract elapsed seconds
          validated.timerSeconds = validated.timerSeconds - elapsed;
        }
      }
    }

    console.warn("[State Recovery] Session recovery completed successfully from localStorage.");
    return validated;
  } catch (error) {
    console.warn("[Storage Repair] Failed to load/parse focus session state. Restored to default.", error);
    return null;
  }
}

function safeSaveState(data) {
  try {
    const existingRaw = localStorage.getItem(STORAGE_KEY);
    let existing = {};
    if (existingRaw) {
      try {
        existing = JSON.parse(existingRaw);
      } catch (e) {
        existing = {};
      }
    }
    const merged = { ...existing, ...data };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch (error) {
    console.warn("[Storage Repair] Storage write quota exceeded or failure to persist session.", error);
  }
}

function loadFocusSession() {
  return safeLoadState();
}

function saveFocusSession(data) {
  safeSaveState(data);
}

function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          totalSessions: typeof parsed.totalSessions === 'number' && !isNaN(parsed.totalSessions) ? Math.max(0, parsed.totalSessions) : 0,
          totalFocusMinutes: typeof parsed.totalFocusMinutes === 'number' && !isNaN(parsed.totalFocusMinutes) ? Math.max(0, parsed.totalFocusMinutes) : 0,
          tasksCompleted: typeof parsed.tasksCompleted === 'number' && !isNaN(parsed.tasksCompleted) ? Math.max(0, parsed.tasksCompleted) : 0,
          longestStreakMinutes: typeof parsed.longestStreakMinutes === 'number' && !isNaN(parsed.longestStreakMinutes) ? Math.max(0, parsed.longestStreakMinutes) : 0,
        };
      }
    }
  } catch (error) {
    console.warn("[Storage Repair] Failed to load stats from localStorage.", error);
  }
  return {
    totalSessions: 0,
    totalFocusMinutes: 0,
    tasksCompleted: 0,
    longestStreakMinutes: 0,
  };
}

function saveStats(stats) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch (error) {
    console.warn("[Storage Repair] Failed to save stats to localStorage.", error);
  }
}

/**
 * ============================================================================
 * FUTURE BACKEND & AUTHENTICATION MIGRATION PATH DOCUMENTATION
 * ============================================================================
 * 
 * To integrate authentication, cloud synchronization, and backend APIs:
 * 
 * 1. UI Context vs. Backend-Sync Context:
 *    - Split UI State (mode, transitionStage, showExitConfirm, notebookOpen, etc.)
 *      into a lightweight LocalUIContext to prevent render-storms on page transitions.
 *    - Session and User/Playback States will transition to a synchronized context 
 *      that pulls from backend REST/GraphQL/WebSocket endpoints upon login.
 * 
 * 2. User & Playback State Sync:
 *    - playbackSettings (volume, playlist selection, loop, shuffle, favorites)
 *      will sync using debounced HTTP PATCH requests or WebSockets on state change,
 *      ensuring audio preference synchronization across active user devices.
 * 
 * 3. Session State Sync:
 *    - Deep Focus active sessions, tasks list, notebook notes, and stats
 *      will load from the backend upon login rather than fallback to localStorage.
 *    - Use an offline-first strategy (e.g. queueing operations in IndexedDB) to
 *      allow offline deep focus sessions and synchronize completed Pomodoros when
 *      reconnecting to the internet.
 * 
 * 4. LocalStorage Boundary:
 *    - LocalStorage will act solely as an offline transient cache or fallback 
 *      when the user is unauthenticated. Upon successful user authentication,
 *      the local state will be migrated/merged with the backend cloud database.
 * ============================================================================
 */

const migrateFavoritePlaylists = (rawList) => {
  if (!rawList || !Array.isArray(rawList)) return [];
  return rawList.map(item => {
    if (typeof item === 'string') {
      return { playlistId: item, addedAt: new Date().toISOString() };
    }
    if (item && typeof item === 'object' && item.playlistId) {
      return item;
    }
    return null;
  }).filter(Boolean);
};

const migrateFavoriteSongs = (rawList, songsList) => {
  if (!rawList || !Array.isArray(rawList)) return [];
  return rawList.map(item => {
    if (typeof item === 'string') {
      const song = songsList.find(s => s.id === item);
      return {
        songId: item,
        playlistId: song ? song.playlist : 'unknown',
        addedAt: new Date().toISOString()
      };
    }
    if (item && typeof item === 'object' && item.songId) {
      return item;
    }
    return null;
  }).filter(Boolean);
};

export function AppProvider({ children }) {
  // ── Focus Session State Ref (Load First) ──
  const saved = useRef(loadFocusSession());

  // ==========================================================================
  // 1. UI STATE HOOKS (Local Interface State)
  // ==========================================================================
  const [mode, setMode] = useState(() => localStorage.getItem('zixovibes_mode') || 'classic');
  const [transitionStage, setTransitionStage] = useState(null); // null | 'leaving' | 'entering'
  const [pendingMode, setPendingMode] = useState(null);
  const [notebookOpen, setNotebookOpen] = useState(saved.current?.notebookOpen || false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [pendingModeSwitch, setPendingModeSwitch] = useState(null);
  const [showCompletedConfirm, setShowCompletedConfirm] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  // Screen Reader Live Announcements callback
  const announce = useCallback((msg) => {
    setAnnouncement(msg);
    setTimeout(() => {
      setAnnouncement(prev => prev === msg ? '' : prev);
    }, 1000);
  }, []);

  const isTransitioning = transitionStage !== null;
  const transitionTimeout1Ref = useRef(null);
  const transitionTimeout2Ref = useRef(null);

  useEffect(() => {
    return () => {
      if (transitionTimeout1Ref.current) clearTimeout(transitionTimeout1Ref.current);
      if (transitionTimeout2Ref.current) clearTimeout(transitionTimeout2Ref.current);
    };
  }, []);

  // ==========================================================================
  // 2. MODE-SPECIFIC UI STATES
  // ==========================================================================
  const [classicOpenedPlaylist, setClassicOpenedPlaylist] = useState(null);
  const [dfOpenedPlaylist, setDfOpenedPlaylist] = useState(null);
  const [classicSearchQuery, setClassicSearchQuery] = useState('');
  const [dfSearchQuery, setDfSearchQuery] = useState('');
  const [classicSearchOpen, setClassicSearchOpen] = useState(false);
  const [dfSearchOpen, setDfSearchOpen] = useState(false);
  const [classicHighlightedSongId, setClassicHighlightedSongId] = useState(null);
  const [dfHighlightedSongId, setDfHighlightedSongId] = useState(null);

  // Dynamic Routing of UI States to components
  const openedPlaylist = mode === 'deepfocus' ? dfOpenedPlaylist : classicOpenedPlaylist;
  const setOpenedPlaylist = useCallback((val) => {
    if (mode === 'deepfocus') {
      setDfOpenedPlaylist(val);
    } else {
      setClassicOpenedPlaylist(val);
    }
  }, [mode]);

  const searchQuery = mode === 'deepfocus' ? dfSearchQuery : classicSearchQuery;
  const setSearchQuery = useCallback((val) => {
    if (mode === 'deepfocus') {
      setDfSearchQuery(val);
    } else {
      setClassicSearchQuery(val);
    }
  }, [mode]);

  const searchOpen = mode === 'deepfocus' ? dfSearchOpen : classicSearchOpen;
  const setSearchOpen = useCallback((val) => {
    if (mode === 'deepfocus') {
      setDfSearchOpen(val);
    } else {
      setClassicSearchOpen(val);
    }
  }, [mode]);

  const highlightedSongId = mode === 'deepfocus' ? dfHighlightedSongId : classicHighlightedSongId;
  const setHighlightedSongId = useCallback((val) => {
    if (mode === 'deepfocus') {
      setDfHighlightedSongId(val);
    } else {
      setClassicHighlightedSongId(val);
    }
  }, [mode]);

  // ==========================================================================
  // 3. USER & PLAYBACK STATE HOOKS (Preferences & Audio)
  // ==========================================================================
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('zixovibes_is_authenticated') === 'true';
  });
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [previousMode, setPreviousMode] = useState(() => localStorage.getItem('zixovibes_previous_mode') || 'classic');
  const [username, setUsername] = useState(() => {
    return localStorage.getItem('zixovibes_username') || 'Guest User';
  });
  const [displayName, setDisplayName] = useState(() => {
    return localStorage.getItem('zixovibes_display_name') || 'Guest User';
  });
  const [createdAt, setCreatedAt] = useState(() => {
    return localStorage.getItem('zixovibes_created_at') || null;
  });
  const [userEmail, setUserEmail] = useState('');

  // Canonical user avatar initial derived purely from username (NOT displayName)
  const userInitial = useMemo(() => {
    if (username && typeof username === 'string') {
      const trimmed = username.trim();
      if (trimmed && trimmed !== 'Guest User') {
        return trimmed.charAt(0).toUpperCase();
      }
    }
    return 'U';
  }, [username]);

  // Helpers to parse local storage safely
  const getStoredJSON = useCallback((key, fallback) => {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : fallback;
    } catch (e) {
      return fallback;
    }
  }, []);

  // --------------------------------------------------------------------------
  // Separated Favorites & History States
  // --------------------------------------------------------------------------
  const [classicFavoritePlaylists, setClassicFavoritePlaylists] = useState(() => {
    return getStoredJSON('zixovibes_classic_favorites', { playlists: [], songs: [] }).playlists || [];
  });
  const [classicFavoriteSongs, setClassicFavoriteSongs] = useState(() => {
    return getStoredJSON('zixovibes_classic_favorites', { playlists: [], songs: [] }).songs || [];
  });

  const [dfFavoritePlaylists, setDfFavoritePlaylists] = useState(() => {
    return getStoredJSON('zixovibes_deepFocus_favorites', { playlists: [], songs: [] }).playlists || [];
  });
  const [dfFavoriteSongs, setDfFavoriteSongs] = useState(() => {
    return getStoredJSON('zixovibes_deepFocus_favorites', { playlists: [], songs: [] }).songs || [];
  });

  const [classicHistory, setClassicHistory] = useState(() => {
    return getStoredJSON('zixovibes_classic_history', []);
  });
  const [dfFocusHistory, setDfFocusHistory] = useState(() => {
    return getStoredJSON('zixovibes_deepFocus_focusHistory', []);
  });

  const [listeningHistory, setListeningHistory] = useState(() => {
    return getStoredJSON('zixovibes_listening_history', []);
  });

  const [activeSessionId, setActiveSessionId] = useState(() => {
    return localStorage.getItem('zixovibes_active_session_id') || null;
  });
  const [notes, setNotes] = useState(() => {
    return getStoredJSON('zixovibes_current_notes', []);
  });

  // --------------------------------------------------------------------------
  // Separated Playback States
  // --------------------------------------------------------------------------
  const [classicActivePlaylist, setClassicActivePlaylist] = useState(() => {
    const pb = getStoredJSON('zixovibes_classic_playback', null);
    return pb?.activePlaylist || playlists[0];
  });
  const [classicCurrentSong, setClassicCurrentSong] = useState(() => {
    const pb = getStoredJSON('zixovibes_classic_playback', null);
    return pb?.currentSong || null;
  });
  const [classicElapsed, setClassicElapsed] = useState(0);
  const [classicIsShuffle, setClassicIsShuffle] = useState(() => {
    const pb = getStoredJSON('zixovibes_classic_playback', null);
    return pb?.isShuffle ?? false;
  });
  const [classicIsLoop, setClassicIsLoop] = useState(() => {
    const pb = getStoredJSON('zixovibes_classic_playback', null);
    return pb?.isLoop ?? false;
  });
  const [classicIsPlaying, setClassicIsPlaying] = useState(false);

  const [dfActivePlaylist, setDfActivePlaylist] = useState(() => {
    const pb = getStoredJSON('zixovibes_deepFocus_playback', null);
    let restoredPlaylist = pb?.activePlaylist;
    
    const isValid = restoredPlaylist && restoredPlaylist.id && (
      restoredPlaylist.id !== 'playlist_for_you' || 
      (localStorage.getItem('zixovibes_playlist_for_you_songs') && JSON.parse(localStorage.getItem('zixovibes_playlist_for_you_songs')).length > 0)
    );
    
    if (isValid) {
      return restoredPlaylist;
    }
    return initialPlaylists.find(p => p.id === 'focus') || initialPlaylists[0];
  });
  const [dfCurrentSong, setDfCurrentSong] = useState(() => {
    const pb = getStoredJSON('zixovibes_deepFocus_playback', null);
    let restoredSong = pb?.currentSong;
    let restoredPlaylist = pb?.activePlaylist;
    
    const isPlaylistValid = restoredPlaylist && restoredPlaylist.id && (
      restoredPlaylist.id !== 'playlist_for_you' || 
      (localStorage.getItem('zixovibes_playlist_for_you_songs') && JSON.parse(localStorage.getItem('zixovibes_playlist_for_you_songs')).length > 0)
    );
    
    if (isPlaylistValid && restoredSong) {
      return restoredSong;
    }
    
    const focusSongs = initialSongs.filter(s => s.playlist === 'focus');
    return focusSongs.length > 0 ? focusSongs[0] : null;
  });
  const [dfElapsed, setDfElapsed] = useState(0);
  const [dfIsShuffle, setDfIsShuffle] = useState(() => {
    const pb = getStoredJSON('zixovibes_deepFocus_playback', null);
    return pb?.isShuffle ?? false;
  });
  const [dfIsLoop, setDfIsLoop] = useState(() => {
    const pb = getStoredJSON('zixovibes_deepFocus_playback', null);
    return pb?.isLoop ?? false;
  });
  const [dfIsPlaying, setDfIsPlaying] = useState(false);

  // Global Player States
  const [volume, setVolume] = useState(() => {
    return saved.current?.playbackSettings?.volume ?? 65;
  });
  const [playbackActivated, setPlaybackActivated] = useState(false);
  const [playlistsList, setPlaylistsList] = useState(() => {
    return initialPlaylists.map(p => ({
      ...p,
      songCount: initialSongs.filter(s => s.playlist === p.id).length
    }));
  });
  const [songs, setSongs] = useState(initialSongs);
  const [shufflePlayedSongIds, setShufflePlayedSongIds] = useState([]);
  const [seekTrigger, setSeekTrigger] = useState(0);
  const playbackStateRef = useRef(null);

  playbackStateRef.current = {
    mode,
    classicActivePlaylist,
    classicCurrentSong,
    classicElapsed,
    classicIsShuffle,
    classicIsLoop,
    classicIsPlaying,
    dfActivePlaylist,
    dfCurrentSong,
    dfElapsed,
    dfIsShuffle,
    dfIsLoop,
    dfIsPlaying,
    volume
  };
  const [aiPlaylistSongs, setAiPlaylistSongs] = useState(() => {
    try {
      let isFav = false;
      try {
        const favsVal = localStorage.getItem('zixovibes_deepFocus_favorites');
        if (favsVal) {
          const parsed = JSON.parse(favsVal);
          isFav = parsed.playlists?.some(x => String(x.playlistId) === 'playlist_for_you');
        }
      } catch (_) {}

      if (isFav) {
        const savedVal = localStorage.getItem('zixovibes_playlist_for_you_saved_songs');
        if (savedVal) return JSON.parse(savedVal);
      }

      const val = localStorage.getItem('zixovibes_playlist_for_you_songs');
      return val ? JSON.parse(val) : [];
    } catch (_) {
      return [];
    }
  });
  const [lastAnalyzedTaskText, setLastAnalyzedTaskText] = useState(() => {
    return localStorage.getItem('zixovibes_last_analyzed_task_text') || '';
  });
  const [showUnfavoriteConfirm, setShowUnfavoriteConfirm] = useState(false);
  const [pendingUnfavoritePlaylistId, setPendingUnfavoritePlaylistId] = useState(null);

  // Active state dynamic mappings based on mode
  const activePlaylist = mode === 'classic' ? classicActivePlaylist : dfActivePlaylist;
  const setActivePlaylist = useCallback((val) => {
    if (mode === 'classic') {
      setClassicActivePlaylist(val);
    } else {
      setDfActivePlaylist(val);
    }
  }, [mode]);

  const selectedFocusPlaylist = activePlaylist;
  const setSelectedFocusPlaylist = setActivePlaylist;

  const currentSong = mode === 'classic' ? classicCurrentSong : dfCurrentSong;
  const setCurrentSong = useCallback((val) => {
    if (mode === 'classic') {
      setClassicCurrentSong(val);
    } else {
      setDfCurrentSong(val);
    }
  }, [mode]);

  const elapsed = mode === 'classic' ? classicElapsed : dfElapsed;
  const setElapsed = useCallback((val) => {
    if (mode === 'classic') {
      setClassicElapsed(val);
    } else {
      setDfElapsed(val);
    }
  }, [mode]);

  const isShuffle = mode === 'classic' ? classicIsShuffle : dfIsShuffle;
  const setIsShuffle = useCallback((val) => {
    if (mode === 'classic') {
      setClassicIsShuffle(val);
    } else {
      setDfIsShuffle(val);
    }
  }, [mode]);

  const isLoop = mode === 'classic' ? classicIsLoop : dfIsLoop;
  const setIsLoop = useCallback((val) => {
    if (mode === 'classic') {
      setClassicIsLoop(val);
    } else {
      setDfIsLoop(val);
    }
  }, [mode]);

  const isPlaying = mode === 'classic' ? classicIsPlaying : dfIsPlaying;
  const setIsPlaying = useCallback((val) => {
    if (mode === 'classic') {
      setClassicIsPlaying(val);
    } else {
      setDfIsPlaying(val);
    }
  }, [mode]);

  const saveUserDoc = useCallback(async (subColl, docId, data) => {
    if (!auth.currentUser) {
      localStorage.setItem(`zixovibes_guest_${subColl}_${docId}`, JSON.stringify(data));
      return;
    }
    try {
      const docRef = doc(db, 'users', auth.currentUser.uid, subColl, docId);
      await setDoc(docRef, {
        ...data,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.error(`[Firestore Sync] Error saving ${subColl}/${docId}:`, err);
    }
  }, []);

  // Expose getters for context mapping
  const favoritePlaylists = mode === 'classic' ? classicFavoritePlaylists : dfFavoritePlaylists;
  const favoriteSongs = mode === 'classic' ? classicFavoriteSongs : dfFavoriteSongs;
  const recentlyPlayed = mode === 'classic' ? classicHistory : [];
  const focusHistory = mode === 'classic' ? [] : dfFocusHistory;

  const setFavoritePlaylists = useCallback((val) => {
    if (mode === 'classic') {
      setClassicFavoritePlaylists(val);
    } else {
      setDfFavoritePlaylists(val);
    }
  }, [mode]);

  const setFavoriteSongs = useCallback((val) => {
    if (mode === 'classic') {
      setClassicFavoriteSongs(val);
    } else {
      setDfFavoriteSongs(val);
    }
  }, [mode]);

  // Helper to sync playback state to localStorage
  const persistLocalPlayback = useCallback((tgtMode, playlist, song, elapsedSecs, shuffle, loop, playing) => {
    const data = {
      activePlaylist: playlist,
      currentSong: song,
      elapsed: elapsedSecs,
      isShuffle: shuffle,
      isLoop: loop,
      isPlaying: playing
    };
    localStorage.setItem(tgtMode === 'classic' ? 'zixovibes_classic_playback' : 'zixovibes_deepFocus_playback', JSON.stringify(data));
  }, []);

  // Auto-sync active playback state whenever parameters change
  useEffect(() => {
    persistLocalPlayback(mode, activePlaylist, currentSong, elapsed, isShuffle, isLoop, isPlaying);
  }, [mode, activePlaylist, currentSong, elapsed, isShuffle, isLoop, isPlaying, persistLocalPlayback]);

  // Automated LocalStorage Migration logic
  useEffect(() => {
    const oldFavSongs = localStorage.getItem('zixovibes_favorite_songs');
    const oldFavPlaylists = localStorage.getItem('zixovibes_favorite_playlists');
    const oldRecentlyPlayed = localStorage.getItem('zixovibes_recently_played');
    const oldFocusHistory = localStorage.getItem('zixovibes_focus_history');

    if (!localStorage.getItem('zixovibes_classic_favorites')) {
      const classicFavs = { playlists: [], songs: [] };
      if (oldFavSongs) {
        try {
          const parsed = JSON.parse(oldFavSongs);
          classicFavs.songs = parsed.map(s => typeof s === 'string' ? { songId: s, addedAt: new Date().toISOString() } : s);
        } catch (e) {}
      }
      if (oldFavPlaylists) {
        try {
          const parsed = JSON.parse(oldFavPlaylists);
          const classicPls = parsed.filter(id => id !== 'focus' && id !== 7 && id !== '7');
          classicFavs.playlists = classicPls.map(id => ({ playlistId: String(id), addedAt: new Date().toISOString() }));
        } catch (e) {}
      }
      localStorage.setItem('zixovibes_classic_favorites', JSON.stringify(classicFavs));
      setClassicFavoritePlaylists(classicFavs.playlists);
      setClassicFavoriteSongs(classicFavs.songs);
    }

    if (!localStorage.getItem('zixovibes_deepFocus_favorites')) {
      const dfFavs = { playlists: [], songs: [] };
      if (oldFavPlaylists) {
        try {
          const parsed = JSON.parse(oldFavPlaylists);
          const focusPls = parsed.filter(id => id === 'focus' || id === 7 || id === '7');
          dfFavs.playlists = focusPls.map(id => ({ playlistId: String(id), addedAt: new Date().toISOString() }));
        } catch (e) {}
      }
      localStorage.setItem('zixovibes_deepFocus_favorites', JSON.stringify(dfFavs));
      setDfFavoritePlaylists(dfFavs.playlists);
      setDfFavoriteSongs(dfFavs.songs);
    }

    if (!localStorage.getItem('zixovibes_classic_history') && oldRecentlyPlayed) {
      localStorage.setItem('zixovibes_classic_history', oldRecentlyPlayed);
      try {
        setClassicHistory(JSON.parse(oldRecentlyPlayed));
      } catch (e) {}
    }
    if (!localStorage.getItem('zixovibes_deepFocus_focusHistory') && oldFocusHistory) {
      localStorage.setItem('zixovibes_deepFocus_focusHistory', oldFocusHistory);
      try {
        setDfFocusHistory(JSON.parse(oldFocusHistory));
      } catch (e) {}
    }

    // Clean up legacy keys
    localStorage.removeItem('zixovibes_favorite_songs');
    localStorage.removeItem('zixovibes_favorite_playlists');
    localStorage.removeItem('zixovibes_recently_played');
    localStorage.removeItem('zixovibes_focus_history');
    localStorage.removeItem('zixovibes_listening_history');
  }, []);

  // Monitor Firebase Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsAuthenticated(true);
        setUserEmail(user.email || '');
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          
          // If profile document doesn't exist yet, we are in the middle of signup.
          // Return early and let the signup callback handle initialization and transitions.
          if (!userDoc.exists()) {
            console.warn("[Firebase Auth] User profile document does not exist yet. Skipping automatic state loading.");
            return;
          }

          let fetchedUsername = '';
          let fetchedDisplayName = user.displayName || '';

          const data = userDoc.data();
          fetchedUsername = data.profile?.username || data.username || '';
          fetchedDisplayName = data.profile?.displayName || data.displayName || fetchedDisplayName;

          if (!fetchedDisplayName) {
            fetchedDisplayName = fetchedUsername || (user.email ? user.email.split('@')[0] : 'User');
          }
          if (!fetchedUsername) {
            fetchedUsername = (user.email ? user.email.split('@')[0] : 'user');
          }

          setUsername(fetchedUsername);
          setDisplayName(fetchedDisplayName);
          
          let fetchedCreatedAt = data.profile?.createdAt || data.createdAt || user.metadata?.creationTime || null;
          if (!fetchedCreatedAt) {
            fetchedCreatedAt = user.metadata?.creationTime || new Date().toISOString();
          }
          setCreatedAt(fetchedCreatedAt);
          
          localStorage.setItem('zixovibes_is_authenticated', 'true');
          localStorage.setItem('zixovibes_username', fetchedUsername);
          localStorage.setItem('zixovibes_display_name', fetchedDisplayName);
          localStorage.setItem('zixovibes_created_at', fetchedCreatedAt);

          // Fetch all subcollections in parallel to avoid sequential blocking round-trips
          const [
            classicFavsDoc,
            dfFavsDoc,
            classicPlaybackDoc,
            dfPlaybackDoc,
            classicHistoryDoc,
            dfHistoryDoc,
            aiSongsDoc
          ] = await Promise.all([
            getDoc(doc(db, 'users', user.uid, 'classic', 'favorites')),
            getDoc(doc(db, 'users', user.uid, 'deepFocus', 'favorites')),
            getDoc(doc(db, 'users', user.uid, 'classic', 'playback')),
            getDoc(doc(db, 'users', user.uid, 'deepFocus', 'playback')),
            getDoc(doc(db, 'users', user.uid, 'classic', 'history')),
            getDoc(doc(db, 'users', user.uid, 'deepFocus', 'focusHistory')),
            getDoc(doc(db, 'users', user.uid, 'deepFocus', 'playlist_for_you_songs'))
          ]);

          // 1. Process Classic Favorites & Migrate legacy if not present
          let classicFavPlaylists = [];
          let classicFavSongs = [];
          if (classicFavsDoc.exists()) {
            const data = classicFavsDoc.data();
            classicFavPlaylists = data.playlists || [];
            classicFavSongs = data.songs || [];
          } else {
            // Check legacy favorites
            const [legacyPlaylistsDoc, legacySongsDoc] = await Promise.all([
              getDoc(doc(db, 'users', user.uid, 'favorites', 'playlists')),
              getDoc(doc(db, 'users', user.uid, 'favorites', 'songs'))
            ]);
            
            const rawPls = legacyPlaylistsDoc.exists() ? (legacyPlaylistsDoc.data().list || []) : [];
            const rawSongs = legacySongsDoc.exists() ? (legacySongsDoc.data().list || []) : [];
            
            classicFavPlaylists = rawPls.filter(id => id !== 'focus' && id !== 7 && id !== '7').map(id => 
              typeof id === 'string' || typeof id === 'number' ? { playlistId: String(id), addedAt: new Date().toISOString() } : id
            );
            classicFavSongs = rawSongs.map(s => 
              typeof s === 'string' ? { songId: s, addedAt: new Date().toISOString() } : s
            );
            
            // Save migrated classic favorites
            await setDoc(doc(db, 'users', user.uid, 'classic', 'favorites'), { playlists: classicFavPlaylists, songs: classicFavSongs });
            
            // Migrate Deep Focus favorites as well
            const dfFavPlaylists = rawPls.filter(id => id === 'focus' || id === 7 || id === '7').map(id => ({
              playlistId: String(id),
              addedAt: new Date().toISOString()
            }));
            await setDoc(doc(db, 'users', user.uid, 'deepFocus', 'favorites'), { playlists: dfFavPlaylists, songs: [] });
          }
          setClassicFavoritePlaylists(classicFavPlaylists);
          setClassicFavoriteSongs(classicFavSongs);
          localStorage.setItem('zixovibes_classic_favorites', JSON.stringify({ playlists: classicFavPlaylists, songs: classicFavSongs }));

          // 2. Process Deep Focus Favorites
          let dfFavPlaylists = [];
          let dfFavSongs = [];
          if (dfFavsDoc.exists()) {
            const data = dfFavsDoc.data();
            dfFavPlaylists = data.playlists || [];
            dfFavSongs = data.songs || [];
          }
          setDfFavoritePlaylists(dfFavPlaylists);
          setDfFavoriteSongs(dfFavSongs);
          localStorage.setItem('zixovibes_deepFocus_favorites', JSON.stringify({ playlists: dfFavPlaylists, songs: dfFavSongs }));

          const isAiFav = dfFavPlaylists.some(x => String(x.playlistId) === 'playlist_for_you');
          if (isAiFav && initialSongs && initialSongs.length > 0) {
            if (aiSongsDoc.exists()) {
              const songIds = aiSongsDoc.data().songIds || [];
              const resolvedSongs = songIds.map(id => initialSongs.find(s => s.id === id)).filter(Boolean);
              if (resolvedSongs.length > 0) {
                const resolvedWithPlaylist = resolvedSongs.map(s => ({ ...s, playlist: 'playlist_for_you' }));
                setAiPlaylistSongs(resolvedWithPlaylist);
                localStorage.setItem('zixovibes_playlist_for_you_saved_songs', JSON.stringify(resolvedWithPlaylist));
              }
            }
          }

          // 3. Process Classic Playback settings (only if user has not already started playback locally)
          if (!playbackActivated) {
            if (classicPlaybackDoc.exists()) {
              const pb = classicPlaybackDoc.data();
              if (pb.activePlaylist && typeof pb.activePlaylist === 'object') setClassicActivePlaylist(pb.activePlaylist);
              if (pb.currentSong && typeof pb.currentSong === 'object') setClassicCurrentSong(pb.currentSong);
              if (typeof pb.isShuffle === 'boolean') setClassicIsShuffle(pb.isShuffle);
              if (typeof pb.isLoop === 'boolean') setClassicIsLoop(pb.isLoop);
              if (typeof pb.volume === 'number') setVolume(pb.volume);
            } else {
              // Check legacy preferences settings
              const legacyPrefsDoc = await getDoc(doc(db, 'users', user.uid, 'preferences', 'settings'));
              if (legacyPrefsDoc.exists()) {
                const prefs = legacyPrefsDoc.data();
                if (prefs.lastPlaylistId && initialPlaylists.length > 0) {
                  const pl = initialPlaylists.find(p => p.id === prefs.lastPlaylistId);
                  if (pl) setClassicActivePlaylist(pl);
                }
                if (prefs.lastSongId && initialSongs.length > 0) {
                  const s = initialSongs.find(x => x.id === prefs.lastSongId);
                  if (s) setClassicCurrentSong(s);
                }
                if (typeof prefs.shuffle === 'boolean') setClassicIsShuffle(prefs.shuffle);
                if (typeof prefs.repeat === 'boolean') setClassicIsLoop(prefs.repeat);
                if (typeof prefs.volume === 'number') setVolume(prefs.volume);
              }
            }
          }
          setClassicElapsed(0);
          setClassicIsPlaying(false);

          // 4. Process Deep Focus Playback settings (only if user has not already started playback locally)
          if (!playbackActivated) {
            if (dfPlaybackDoc.exists()) {
              const pb = dfPlaybackDoc.data();
              let restoredPlaylist = pb.activePlaylist;
              let restoredSong = pb.currentSong;
              
              const isPlaylistValid = restoredPlaylist && restoredPlaylist.id && (
                restoredPlaylist.id !== 'playlist_for_you' || 
                (dfFavPlaylists.some(x => String(x.playlistId) === 'playlist_for_you') || (localStorage.getItem('zixovibes_playlist_for_you_songs') && JSON.parse(localStorage.getItem('zixovibes_playlist_for_you_songs')).length > 0))
              );
              
              if (isPlaylistValid) {
                if (restoredPlaylist && typeof restoredPlaylist === 'object') setDfActivePlaylist(restoredPlaylist);
                if (restoredSong && typeof restoredSong === 'object') setDfCurrentSong(restoredSong);
              } else {
                const focusPlaylist = initialPlaylists.find(p => p.id === 'focus') || initialPlaylists[0];
                const focusSongs = initialSongs.filter(s => s.playlist === 'focus');
                setDfActivePlaylist(focusPlaylist);
                setDfCurrentSong(focusSongs.length > 0 ? focusSongs[0] : null);
              }
              if (typeof pb.isShuffle === 'boolean') setDfIsShuffle(pb.isShuffle);
              if (typeof pb.isLoop === 'boolean') setDfIsLoop(pb.isLoop);
            }
          }
          setDfElapsed(0);
          setDfIsPlaying(false);

          // 5. Process Classic Recently Played
          let classHistoryList = [];
          if (classicHistoryDoc.exists()) {
            classHistoryList = classicHistoryDoc.data().history || [];
          } else {
            // Check legacy history
            const legacyHistoryDoc = await getDoc(doc(db, 'users', user.uid, 'recentlyPlayed', 'history'));
            if (legacyHistoryDoc.exists()) {
              classHistoryList = legacyHistoryDoc.data().history || [];
              await setDoc(doc(db, 'users', user.uid, 'classic', 'history'), { history: classHistoryList });
            }
          }
          setClassicHistory(classHistoryList);
          localStorage.setItem('zixovibes_classic_history', JSON.stringify(classHistoryList));

          // 6. Process Deep Focus Completed Sessions History
          let focusHistoryList = [];
          if (dfHistoryDoc.exists()) {
            focusHistoryList = dfHistoryDoc.data().focusHistory || [];
          } else {
            // Check legacy focus sessions query
            const sessionsQuery = query(collection(db, 'users', user.uid, 'focusSessions'), orderBy('startedAt', 'desc'), limit(50));
            const sessionsSnap = await getDocs(sessionsQuery);
            sessionsSnap.forEach(d => {
              focusHistoryList.push(d.data());
            });
            if (focusHistoryList.length > 0) {
              await setDoc(doc(db, 'users', user.uid, 'deepFocus', 'focusHistory'), { focusHistory: focusHistoryList });
            }
          }
          setDfFocusHistory(focusHistoryList);
          localStorage.setItem('zixovibes_deepFocus_focusHistory', JSON.stringify(focusHistoryList));
        } catch (err) {
          console.error("[Firebase Auth] Error loading user Firestore data:", err);
        }
      } else {
        setIsAuthenticated(false);
        setUsername('Guest User');
        setDisplayName('Guest User');
        setCreatedAt(null);
        setUserEmail('');
        setClassicFavoritePlaylists([]);
        setClassicFavoriteSongs([]);
        setDfFavoritePlaylists([]);
        setDfFavoriteSongs([]);
        setClassicHistory([]);
        setDfFocusHistory([]);
        setListeningHistory([]);
        setNotes([]);
        setActiveSessionId(null);
        
        localStorage.setItem('zixovibes_is_authenticated', 'false');
        localStorage.setItem('zixovibes_username', 'Guest User');
        localStorage.setItem('zixovibes_display_name', 'Guest User');
        localStorage.removeItem('zixovibes_created_at');
      }
    });
    return () => unsubscribe();
  }, []);

  const updateDisplayName = useCallback(async (newName) => {
    const trimmed = newName.trim();
    if (trimmed.length > 0) {
      setDisplayName(trimmed);
      localStorage.setItem('zixovibes_display_name', trimmed);
      if (auth.currentUser) {
        try {
          await updateProfile(auth.currentUser, { displayName: trimmed });
          const userDocRef = doc(db, 'users', auth.currentUser.uid);
          await setDoc(userDocRef, {
            profile: { displayName: trimmed }
          }, { merge: true });
        } catch (error) {
          console.error("[Firebase Auth] Failed to save updated display name:", error);
        }
      }
    }
  }, []);

  const updateUsername = useCallback(async (newName) => {
    const trimmed = newName.trim();
    if (trimmed.length > 0) {
      setUsername(trimmed);
      localStorage.setItem('zixovibes_username', trimmed);
      if (auth.currentUser) {
        try {
          const userDocRef = doc(db, 'users', auth.currentUser.uid);
          await setDoc(userDocRef, {
            profile: { username: trimmed }
          }, { merge: true });
          
          // Securely reserve username through backend endpoint instead of direct client write
          const response = await fetchWithTimeoutAndRetry(`${API_BASE}/api/auth/reserve-username`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              username: trimmed,
              email: auth.currentUser.email || userEmail,
              uid: auth.currentUser.uid
            }),
          });
          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || 'Failed to update username registry');
          }
        } catch (error) {
          console.error("[Firebase Auth] Failed to save updated username to Firestore:", error);
        }
      }
    }
  }, [userEmail]);





  // Sync active playlists with loaded metadata
  useEffect(() => {
    if (playlistsList.length > 0) {
      const normalizeId = (id) => {
        const idStr = String(id).toLowerCase();
        if (idStr === '1' || idStr === 'sleep') return 'sleep';
        if (idStr === '2' || idStr === 'relax') return 'relax';
        if (idStr === '3' || idStr === 'lofi' || idStr === 'lo-fi') return 'lofi';
        if (idStr === '4' || idStr === 'jazz') return 'jazz';
        if (idStr === '5' || idStr === 'ambience') return 'ambience';
        if (idStr === '6' || idStr === 'rain') return 'rain';
        if (idStr === '7' || idStr === 'focus') return 'focus';
        if (idStr === 'playlist_for_you') return 'playlist_for_you';
        return idStr;
      };

      if (mode === 'classic') {
        setClassicActivePlaylist(prev => {
          const isClassicId = (id) => ['sleep', 'relax', 'lofi', 'jazz', 'ambience', 'rain'].includes(normalizeId(id));
          if (classicCurrentSong && classicCurrentSong.playlist && isClassicId(classicCurrentSong.playlist)) {
            const foundBySong = playlistsList.find(p => normalizeId(p.id) === normalizeId(classicCurrentSong.playlist));
            if (foundBySong) return foundBySong;
          }
          if (prev && isClassicId(prev.id)) {
            const found = playlistsList.find(p => normalizeId(p.id) === normalizeId(prev.id) || p.title === prev.title || p.title === prev.name);
            if (found) return found;
          }
          return playlistsList.find(p => normalizeId(p.id) === 'lofi') || playlistsList.find(p => normalizeId(p.id) === 'sleep') || playlistsList[0];
        });
      } else {
        setDfActivePlaylist(prev => {
          const isDfId = (id) => ['focus', 'lofi', 'playlist_for_you', 'ambience', 'rain', 'jazz'].includes(normalizeId(id));
          if (dfCurrentSong && dfCurrentSong.playlist && isDfId(dfCurrentSong.playlist)) {
            if (normalizeId(dfCurrentSong.playlist) === 'playlist_for_you') {
              return prev?.id === 'playlist_for_you' ? prev : {
                id: 'playlist_for_you',
                title: 'Playlist for You',
                name: 'Playlist for You',
                cover: '/playlist-covers/playlist-for-you.jpg',
                description: 'A dedicated playlist designed based on your current task.'
              };
            }
            const foundBySong = playlistsList.find(p => normalizeId(p.id) === normalizeId(dfCurrentSong.playlist));
            if (foundBySong) return foundBySong;
          }
          if (prev && isDfId(prev.id)) {
            if (normalizeId(prev.id) === 'playlist_for_you') {
              return prev;
            }
            const found = playlistsList.find(p => normalizeId(p.id) === normalizeId(prev.id) || p.title === prev.title || p.title === prev.name);
            if (found) return found;
          }
          return playlistsList.find(p => normalizeId(p.id) === 'focus') || playlistsList[0];
        });
      }
    }
  }, [playlistsList, mode, classicCurrentSong, dfCurrentSong]);

  // Determine current active playlist and its songs
  const currentActivePlaylist = activePlaylist;

  const currentPlaylistSongs = useMemo(() => {
    if (!currentActivePlaylist) return [];
    if (currentActivePlaylist.id === 'playlist_for_you') {
      return aiPlaylistSongs;
    }
    if (songs.length === 0) return [];
    return songs.filter(s => s.playlist === currentActivePlaylist.id);
  }, [currentActivePlaylist, songs, aiPlaylistSongs]);

  // Sync active song with active playlist
  useEffect(() => {
    if (songs.length > 0) {
      if (currentPlaylistSongs.length > 0) {
        const exists = currentSong && currentPlaylistSongs.some(s => s.id === currentSong.id);
        if (!exists) {
          setCurrentSong(currentPlaylistSongs[0]);
          setElapsed(0);
        }
      } else {
        setCurrentSong(null);
        setElapsed(0);
      }
    }
  }, [currentPlaylistSongs, songs.length]);

  // Reset shuffle cycle when playlist or shuffle state changes
  useEffect(() => {
    if (currentSong) {
      setShufflePlayedSongIds([currentSong.id]);
    } else {
      setShufflePlayedSongIds([]);
    }
  }, [activePlaylist?.id, isShuffle]);

  // Shared HTML5 Audio Reference
  const audioRef = useRef(null);
  if (!audioRef.current) {
    audioRef.current = new Audio();
  }

  const initialTimeRestoredRef = useRef(false);
  const loadedSongIdRef = useRef(null);
  const prevModeRef = useRef(mode);
  const isSeekingRef = useRef(false);

  // Register song to Recently Played (Recent Activity) immediately when playback starts in Classic Mode
  useEffect(() => {
    if (mode === 'classic' && currentSong && isPlaying) {
      const record = {
        songId: currentSong.id,
        playlistId: currentSong.playlist,
        playedAt: new Date().toISOString()
      };

      setClassicHistory(prev => {
        const filtered = prev.filter(x => x.songId !== currentSong.id);
        const next = [record, ...filtered].slice(0, 20);
        localStorage.setItem('zixovibes_classic_history', JSON.stringify(next));
        saveUserDoc('classic', 'history', { history: next });
        return next;
      });
    }
  }, [currentSong?.id, isPlaying, mode, saveUserDoc]);

  // Automatically set playbackActivated to true as soon as music playback starts
  useEffect(() => {
    if (classicIsPlaying || dfIsPlaying) {
      setPlaybackActivated(true);
    }
  }, [classicIsPlaying, dfIsPlaying]);

  // Unified Audio playback state synchronizer (controls src assignment, load, play, and pause)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!currentSong) {
      audio.pause();
      return;
    }

    const songUrl = currentSong.filename;
    // Resolve absolute URL for accurate comparison
    const resolvedUrl = new URL(songUrl, window.location.href).href;

    if (playbackActivated || isPlaying) {
      let isSourceChanged = false;
      if (audio.src !== resolvedUrl) {
        audio.src = songUrl;
        isSourceChanged = true;
        
        // Dispatch load() ONLY when the source path changes, avoiding duplicate load race conditions
        audio.load();

        const isModeSwitch = prevModeRef.current !== mode;
        prevModeRef.current = mode;
        loadedSongIdRef.current = currentSong.id;

        if (!initialTimeRestoredRef.current && elapsed > 0) {
          audio.currentTime = elapsed;
          initialTimeRestoredRef.current = true;
        } else if (isModeSwitch && elapsed > 0) {
          audio.currentTime = elapsed;
        } else {
          audio.currentTime = 0;
          setElapsed(0);
        }
      }

      if (isPlaying) {
        if (audio.paused || isSourceChanged) {
          audio.play().catch(e => console.log("Playback failed to start:", e));
        }
      } else {
        if (!audio.paused) {
          audio.pause();
        }
      }
    }
  }, [currentSong, mode, playbackActivated, isPlaying]);

  // Next-track prefetching to cache next song in the background during playback
  const [nextPrefetchSong, setNextPrefetchSong] = useState(null);

  useEffect(() => {
    if (!playbackActivated || !isPlaying || !currentSong || currentPlaylistSongs.length <= 1) {
      setNextPrefetchSong(null);
      return;
    }

    let nextSong = null;
    if (isShuffle) {
      const unplayedSongs = currentPlaylistSongs.filter(s => !shufflePlayedSongIds.includes(s.id));
      const eligible = unplayedSongs.filter(s => s.id !== currentSong.id);
      const pool = eligible.length > 0 ? eligible : currentPlaylistSongs.filter(s => s.id !== currentSong.id);
      if (pool.length > 0) {
        nextSong = pool[Math.floor(Math.random() * pool.length)];
      }
    } else {
      const currentIndex = currentPlaylistSongs.findIndex(s => s.id === currentSong.id);
      if (currentIndex !== -1) {
        const nextIndex = (currentIndex + 1) % currentPlaylistSongs.length;
        nextSong = currentPlaylistSongs[nextIndex];
      }
    }

    setNextPrefetchSong(nextSong);
  }, [currentSong, currentPlaylistSongs, isShuffle, shufflePlayedSongIds, isPlaying, playbackActivated]);

  useEffect(() => {
    if (!nextPrefetchSong) return;

    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = nextPrefetchSong.filename;
    link.as = 'audio';
    
    document.head.appendChild(link);
    
    return () => {
      document.head.removeChild(link);
    };
  }, [nextPrefetchSong]);

  // Volume sync
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  // Controls actions
  const playNext = useCallback(() => {
    if (currentPlaylistSongs.length === 0 || !currentSong) return;
    
    if (isShuffle) {
      // Find songs in current playlist that haven't been played in this shuffle cycle
      const unplayedSongs = currentPlaylistSongs.filter(s => !shufflePlayedSongIds.includes(s.id));
      
      // If all songs have been played, or only current song is left/unplayed, reset cycle
      if (unplayedSongs.length === 0 || (unplayedSongs.length === 1 && unplayedSongs[0].id === currentSong.id)) {
        // Reset cycle. All songs become eligible except the current one (if playlist has > 1 song)
        const nextPool = currentPlaylistSongs.filter(s => s.id !== currentSong.id);
        const poolToUse = nextPool.length > 0 ? nextPool : currentPlaylistSongs;
        const randomSong = poolToUse[Math.floor(Math.random() * poolToUse.length)];
        
        setCurrentSong(randomSong);
        setShufflePlayedSongIds([randomSong.id]);
      } else {
        // Remove currentSong from eligible pool if it's there
        const eligible = unplayedSongs.filter(s => s.id !== currentSong.id);
        const poolToUse = eligible.length > 0 ? eligible : unplayedSongs;
        const randomSong = poolToUse[Math.floor(Math.random() * poolToUse.length)];
        
        setCurrentSong(randomSong);
        setShufflePlayedSongIds(prev => [...prev, randomSong.id]);
      }
    } else {
      const currentIndex = currentPlaylistSongs.findIndex(s => s.id === currentSong.id);
      const nextIndex = (currentIndex + 1) % currentPlaylistSongs.length;
      setCurrentSong(currentPlaylistSongs[nextIndex]);
    }
    setElapsed(0);
    setIsPlaying(true);
  }, [currentPlaylistSongs, currentSong, isShuffle, shufflePlayedSongIds, setIsPlaying, setElapsed, setCurrentSong]);

  const playPrev = useCallback(() => {
    if (currentPlaylistSongs.length === 0 || !currentSong) return;
    const currentIndex = currentPlaylistSongs.findIndex(s => s.id === currentSong.id);
    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) prevIndex = currentPlaylistSongs.length - 1;
    setCurrentSong(currentPlaylistSongs[prevIndex]);
    setElapsed(0);
    setIsPlaying(true);
  }, [currentPlaylistSongs, currentSong, setIsPlaying, setElapsed, setCurrentSong]);

  const seek = useCallback((time) => {
    if (audioRef.current) {
      isSeekingRef.current = true;
      audioRef.current.currentTime = time;
      setElapsed(time);
      setSeekTrigger(prev => prev + 1);
    }
  }, [setElapsed]);

  const trackPlayStartTimeRef = useRef(null);
  const trackPlayAccumulatedRef = useRef(0);
  const lastTickTimeRef = useRef(null);
  const currentSongRef = useRef(null);
  const hasRecordedCurrentRef = useRef(false);

  const commitListeningRecord = useCallback(async () => {
    trackPlayAccumulatedRef.current = 0;
    trackPlayStartTimeRef.current = null;
    lastTickTimeRef.current = null;
    hasRecordedCurrentRef.current = false;
  }, []);

  // Sync refs and track duration accumulator on currentSong changes
  useEffect(() => {
    commitListeningRecord();

    currentSongRef.current = currentSong;
    initialTimeRestoredRef.current = false;

    if (currentSong) {
      trackPlayStartTimeRef.current = new Date().toISOString();
      trackPlayAccumulatedRef.current = 0;
      lastTickTimeRef.current = Date.now();
    }
  }, [currentSong, commitListeningRecord]);

  const playSong = useCallback((song) => {
    if (!song) return;

    if (song.playlist) {
      const idStr = String(song.playlist);
      const normalizeId = (id) => {
        const s = String(id).toLowerCase();
        if (s === '1' || s === 'sleep') return 'sleep';
        if (s === '2' || s === 'relax') return 'relax';
        if (s === '3' || s === 'lofi' || s === 'lo-fi') return 'lofi';
        if (s === '4' || s === 'jazz') return 'jazz';
        if (s === '5' || s === 'ambience') return 'ambience';
        if (s === '6' || s === 'rain') return 'rain';
        if (s === '7' || s === 'focus') return 'focus';
        if (s === 'playlist_for_you') return 'playlist_for_you';
        return s;
      };
      const canonId = normalizeId(idStr);

      if (mode === 'classic') {
        const isClassicId = ['sleep', 'relax', 'lofi', 'jazz', 'ambience', 'rain'].includes(canonId);
        if (!isClassicId) {
          console.warn("[Playback Guard] Blocked playback of non-Classic song in Classic Mode:", song.title);
          return;
        }
      } else if (mode === 'deepfocus') {
        const isDfId = ['focus', 'lofi', 'playlist_for_you', 'ambience', 'rain', 'jazz'].includes(canonId);
        if (!isDfId) {
          console.warn("[Playback Guard] Blocked playback of non-Deep Focus song in Deep Focus Mode:", song.title);
          return;
        }
      }

      let pl = playlistsList.find(p => p.id === song.playlist) || playlists.find(p => p.id === song.playlist);
      if (!pl && song.playlist === 'playlist_for_you') {
        pl = {
          id: 'playlist_for_you',
          title: 'Playlist for You',
          name: 'Playlist for You',
          cover: '/playlist-covers/playlist-for-you.jpg',
          description: 'A dedicated playlist designed based on your current task.'
        };
      }
      if (pl) {
        setActivePlaylist(pl);
      }
    }

    setCurrentSong(song);
    setShufflePlayedSongIds([song.id]);
    setElapsed(0);
    setIsPlaying(true);
  }, [playlistsList, setActivePlaylist, setCurrentSong, setElapsed, setIsPlaying, mode]);

  const playPlaylist = useCallback((playlist, startIndex = 0, shuffle = false) => {
    if (!playlist) return;

    const idStr = String(playlist.id);
    const normalizeId = (id) => {
      const s = String(id).toLowerCase();
      if (s === '1' || s === 'sleep') return 'sleep';
      if (s === '2' || s === 'relax') return 'relax';
      if (s === '3' || s === 'lofi' || s === 'lo-fi') return 'lofi';
      if (s === '4' || s === 'jazz') return 'jazz';
      if (s === '5' || s === 'ambience') return 'ambience';
      if (s === '6' || s === 'rain') return 'rain';
      if (s === '7' || s === 'focus') return 'focus';
      if (s === 'playlist_for_you') return 'playlist_for_you';
      return s;
    };
    const canonId = normalizeId(idStr);

    if (mode === 'classic') {
      const isClassicId = ['sleep', 'relax', 'lofi', 'jazz', 'ambience', 'rain'].includes(canonId);
      if (!isClassicId) {
        console.warn("[Playback Guard] Blocked playback of non-Classic playlist in Classic Mode:", playlist.id);
        return;
      }
    } else if (mode === 'deepfocus') {
      const isDfId = ['focus', 'lofi', 'playlist_for_you', 'ambience', 'rain', 'jazz'].includes(canonId);
      if (!isDfId) {
        console.warn("[Playback Guard] Blocked playback of non-Deep Focus playlist in Deep Focus Mode:", playlist.id);
        return;
      }
    }

    const pl = playlistsList.find(p => p.id === playlist.id || p.title === playlist.title || p.title === playlist.name) || playlist;
    setActivePlaylist(pl);

    const plSongs = pl.id === 'playlist_for_you' ? aiPlaylistSongs : songs.filter(s => s.playlist === pl.id);
    if (plSongs.length > 0) {
      let targetSong;
      if (shuffle) {
        setIsShuffle(true);
        const randIdx = Math.floor(Math.random() * plSongs.length);
        targetSong = plSongs[randIdx];
      } else {
        const targetIndex = Math.min(Math.max(0, startIndex), plSongs.length - 1);
        targetSong = plSongs[targetIndex];
      }
      setCurrentSong(targetSong);
      setShufflePlayedSongIds([targetSong.id]);
      setElapsed(0);
      setIsPlaying(true);
    }
  }, [playlistsList, songs, aiPlaylistSongs, setActivePlaylist, setIsShuffle, setCurrentSong, setElapsed, setIsPlaying, mode]);

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (isSeekingRef.current) return;
      setElapsed(audio.currentTime);
      localStorage.setItem('zixovibes_last_elapsed', audio.currentTime.toString());

      if (lastTickTimeRef.current) {
        const now = Date.now();
        const delta = (now - lastTickTimeRef.current) / 1000;
        if (delta > 0 && delta < 5) {
          trackPlayAccumulatedRef.current += delta;
        }
        lastTickTimeRef.current = now;
      } else {
        lastTickTimeRef.current = Date.now();
      }
    };

    const handleSeeked = () => {
      isSeekingRef.current = false;
      setElapsed(audio.currentTime);
      localStorage.setItem('zixovibes_last_elapsed', audio.currentTime.toString());
    };

    const handleEnded = () => {
      isSeekingRef.current = false;
      if (isLoop) {
        audio.currentTime = 0;
        audio.play().catch(e => console.log("Loop playback failed:", e));
      } else {
        playNext();
      }
    };

    const handlePause = () => {
      lastTickTimeRef.current = null;
    };

    const handlePlay = () => {
      lastTickTimeRef.current = Date.now();
      if (!trackPlayStartTimeRef.current) {
        trackPlayStartTimeRef.current = new Date().toISOString();
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('seeked', handleSeeked);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('play', handlePlay);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('seeked', handleSeeked);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('play', handlePlay);
    };
  }, [isLoop, playNext, setElapsed, mode, setClassicElapsed, setDfElapsed]);

  // Combined favorites for UI backwards-compatibility
  const favoriteIds = useMemo(() => {
    return favoritePlaylists.map(x => x.playlistId);
  }, [favoritePlaylists]);

  const setFavoriteIds = useCallback((val) => {
    // legacy support
  }, []);

  const isPlaylistFavorited = useCallback((playlistId) => {
    return favoritePlaylists.some(x => String(x.playlistId) === String(playlistId));
  }, [favoritePlaylists]);

  const isSongFavorited = useCallback((songId) => {
    return favoriteSongs.some(x => x.songId === songId);
  }, [favoriteSongs]);

  const executeToggleFavoritePlaylist = useCallback(async (playlistId) => {
    const currentFavPlaylists = mode === 'classic' ? classicFavoritePlaylists : dfFavoritePlaylists;
    const exists = currentFavPlaylists.some(x => String(x.playlistId) === String(playlistId));
    let next;
    if (exists) {
      next = currentFavPlaylists.filter(x => String(x.playlistId) !== String(playlistId));
      if (playlistId === 'playlist_for_you') {
        setAiPlaylistSongs([]);
        localStorage.removeItem('zixovibes_playlist_for_you_saved_songs');
        localStorage.removeItem('zixovibes_playlist_for_you_songs');
        saveUserDoc('deepFocus', 'playlist_for_you_songs', { songIds: [] });
      }
    } else {
      next = [...currentFavPlaylists, { playlistId: String(playlistId), addedAt: new Date().toISOString() }];
      if (playlistId === 'playlist_for_you') {
        localStorage.setItem('zixovibes_playlist_for_you_saved_songs', JSON.stringify(aiPlaylistSongs));
        saveUserDoc('deepFocus', 'playlist_for_you_songs', { songIds: aiPlaylistSongs.map(s => s.id) });
      }
    }

    if (mode === 'classic') {
      setClassicFavoritePlaylists(next);
      localStorage.setItem('zixovibes_classic_favorites', JSON.stringify({ playlists: next, songs: classicFavoriteSongs }));
      await saveUserDoc('classic', 'favorites', { playlists: next, songs: classicFavoriteSongs });
    } else {
      setDfFavoritePlaylists(next);
      localStorage.setItem('zixovibes_deepFocus_favorites', JSON.stringify({ playlists: next, songs: dfFavoriteSongs }));
      await saveUserDoc('deepFocus', 'favorites', { playlists: next, songs: dfFavoriteSongs });
    }
    announce(exists ? "Playlist removed from favorites." : "Playlist added to favorites.");
  }, [mode, classicFavoritePlaylists, classicFavoriteSongs, dfFavoritePlaylists, dfFavoriteSongs, aiPlaylistSongs, announce, saveUserDoc]);

  const toggleFavoritePlaylist = useCallback(async (playlistId) => {
    if (!isAuthenticated) {
      setShowGuestModal(true);
      return;
    }
    const currentFavPlaylists = mode === 'classic' ? classicFavoritePlaylists : dfFavoritePlaylists;
    const exists = currentFavPlaylists.some(x => String(x.playlistId) === String(playlistId));

    if (exists && playlistId === 'playlist_for_you' && mode === 'deepfocus') {
      setPendingUnfavoritePlaylistId(playlistId);
      setShowUnfavoriteConfirm(true);
      return;
    }

    await executeToggleFavoritePlaylist(playlistId);
  }, [isAuthenticated, mode, classicFavoritePlaylists, dfFavoritePlaylists, executeToggleFavoritePlaylist]);

  const confirmUnfavorite = useCallback(async () => {
    setShowUnfavoriteConfirm(false);
    if (pendingUnfavoritePlaylistId) {
      await executeToggleFavoritePlaylist(pendingUnfavoritePlaylistId);
      setPendingUnfavoritePlaylistId(null);
    }
  }, [pendingUnfavoritePlaylistId, executeToggleFavoritePlaylist]);

  const cancelUnfavorite = useCallback(() => {
    setShowUnfavoriteConfirm(false);
    setPendingUnfavoritePlaylistId(null);
  }, []);

  const toggleFavoriteSong = useCallback(async (songId, playlistId) => {
    if (!isAuthenticated) {
      setShowGuestModal(true);
      return;
    }
    const currentFavSongs = mode === 'classic' ? classicFavoriteSongs : dfFavoriteSongs;
    const exists = currentFavSongs.some(x => x.songId === songId);
    let next;
    if (exists) {
      next = currentFavSongs.filter(x => x.songId !== songId);
    } else {
      next = [...currentFavSongs, { songId, playlistId: playlistId || 'unknown', addedAt: new Date().toISOString() }];
    }

    if (mode === 'classic') {
      setClassicFavoriteSongs(next);
      localStorage.setItem('zixovibes_classic_favorites', JSON.stringify({ playlists: classicFavoritePlaylists, songs: next }));
      await saveUserDoc('classic', 'favorites', { playlists: classicFavoritePlaylists, songs: next });
    } else {
      setDfFavoriteSongs(next);
      localStorage.setItem('zixovibes_deepFocus_favorites', JSON.stringify({ playlists: dfFavoritePlaylists, songs: next }));
      await saveUserDoc('deepFocus', 'favorites', { playlists: dfFavoritePlaylists, songs: next });
    }
    announce(exists ? "Song removed from favorites." : "Song added to favorites.");
  }, [mode, classicFavoritePlaylists, classicFavoriteSongs, dfFavoritePlaylists, dfFavoriteSongs, isAuthenticated, announce, saveUserDoc]);

  const isFavorited = useMemo(() => {
    if (currentSong) {
      return favoriteSongs.some(x => x.songId === currentSong.id);
    }
    return false;
  }, [favoriteSongs, currentSong]);

  const setIsFavorited = useCallback((val) => {
    if (currentSong) {
      toggleFavoriteSong(currentSong.id, currentSong.playlist);
    }
  }, [currentSong, toggleFavoriteSong]);

  // Playback sync helper to Firestore
  const syncPlaybackToFirestore = useCallback(() => {
    if (!auth.currentUser) return;
    if (mode === 'classic') {
      saveUserDoc('classic', 'playback', {
        activePlaylist: classicActivePlaylist || null,
        currentSong: classicCurrentSong || null,
        elapsed: classicElapsed,
        isShuffle: classicIsShuffle,
        isLoop: classicIsLoop,
        isPlaying: classicIsPlaying,
        volume
      });
    } else {
      saveUserDoc('deepFocus', 'playback', {
        activePlaylist: dfActivePlaylist || null,
        currentSong: dfCurrentSong || null,
        elapsed: dfElapsed,
        isShuffle: dfIsShuffle,
        isLoop: dfIsLoop,
        isPlaying: dfIsPlaying,
        volume
      });
    }
  }, [
    mode,
    classicActivePlaylist, classicCurrentSong, classicElapsed, classicIsShuffle, classicIsLoop, classicIsPlaying,
    dfActivePlaylist, dfCurrentSong, dfElapsed, dfIsShuffle, dfIsLoop, dfIsPlaying,
    volume,
    saveUserDoc
  ]);

  // Debounced playback settings sync to Firestore (does not depend on ticking elapsed)
  useEffect(() => {
    if (!isAuthenticated) return;
    const timeout = setTimeout(() => {
      syncPlaybackToFirestore();
    }, 4000); // 4s debounce
    return () => clearTimeout(timeout);
  }, [
    mode,
    volume,
    isShuffle,
    isLoop,
    isPlaying,
    activePlaylist?.id,
    currentSong?.id,
    seekTrigger,
    isAuthenticated,
    syncPlaybackToFirestore
  ]);

  // Periodic playback checkpoint auto-save
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(() => {
      if (isPlaying) {
        syncPlaybackToFirestore();
      }
    }, 45000); // 45s interval
    return () => clearInterval(interval);
  }, [isAuthenticated, isPlaying, syncPlaybackToFirestore]);

  const playbackSettings = useMemo(() => ({
    volume,
    isShuffle,
    isLoop,
    isFavorited,
    activePlaylist
  }), [volume, isShuffle, isLoop, isFavorited, activePlaylist]);


  // ==========================================================================
  // 3. SESSION STATE HOOKS (Focus Onboarding, Tasks, Progress & Stats)
  // ==========================================================================
  const [hasOnboarded, setHasOnboarded] = useState(() => {
    const savedSession = saved.current;
    if (savedSession && savedSession.tasks && savedSession.tasks.length > 0) {
      return true;
    }
    return savedSession?.hasOnboarded || false;
  });
  const [sessionTitle, setSessionTitle] = useState(saved.current?.sessionTitle || '');
  const [sessionSubtitle, setSessionSubtitle] = useState(saved.current?.sessionSubtitle || '');
  const [tasks, setTasks] = useState(saved.current?.tasks || []);
  const [estimatedDuration, setEstimatedDuration] = useState(saved.current?.estimatedDuration || '');
  const [suggestedPomodoros, setSuggestedPomodoros] = useState(saved.current?.suggestedPomodoros || 3);
  const [motivationalNote, setMotivationalNote] = useState(saved.current?.motivationalNote || '');
  const [totalFocusTime, setTotalFocusTime] = useState(saved.current?.totalFocusTime || 0);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [pomodorosCompleted, setPomodorosCompleted] = useState(saved.current?.pomodorosCompleted || 0);

  // Workflow Progression States
  const [currentPomodoroIndex, setCurrentPomodoroIndex] = useState(saved.current?.currentPomodoroIndex || 0);
  const [hasDismissedCompletion, setHasDismissedCompletion] = useState(false);

  // Focus Statistics
  const [stats, setStats] = useState(loadStats());

  const initialTimerState = useMemo(() => {
    return {
      timerSeconds: saved.current?.timerSeconds ?? 1500,
      timerRunning: saved.current?.timerRunning ?? false,
      timerDuration: saved.current?.timerDuration ?? 1500,
      isBreakMode: saved.current?.isBreakMode ?? false,
      showPomodoroOverlay: saved.current?.showPomodoroOverlay ?? false,
      showBreakCompleteOverlay: saved.current?.showBreakCompleteOverlay ?? false,
      autoStartAfterBreak: saved.current?.autoStartAfterBreak ?? false,
    };
  }, []);



  // Derive flattened list of all Pomodoros in sequence (Memoized to prevent unnecessary recalculations)
  const flattenedPomodoros = useMemo(() => {
    const list = [];
    if (!Array.isArray(tasks)) return list;
    let globalIndex = 0;
    tasks.forEach((task, taskIdx) => {
      if (task.pomodoros) {
        const totalPomos = task.pomodoros.length || 1;
        task.pomodoros.forEach((pName, pIdx) => {
          const pomoDuration = Array.isArray(task.pomodoroDurations) && task.pomodoroDurations[pIdx] !== undefined
            ? task.pomodoroDurations[pIdx]
            : Math.round((task.estimatedDuration || (totalPomos * 25)) / totalPomos);

          list.push({
            taskIndex: taskIdx,
            parentTaskId: task.id,
            taskText: task.text,
            name: pName,
            index: pIdx,
            duration: pomoDuration,
            order: pIdx,
            executionIndex: globalIndex++,
            workCategory: task.workCategory || task.category || 'Deep Work',
            playlistCategory: task.category || 'Deep Work'
          });
        });
      }
    });
    return list;
  }, [tasks]);

  // Check if all tasks are done (Memoized to avoid recomputing on every render)
  const allTasksDone = useMemo(() => Array.isArray(tasks) && tasks.length > 0 && tasks.every(t => t.completed), [tasks]);

  // Persist session and playback preferences on changes
  useEffect(() => {
    saveFocusSession({
      hasOnboarded,
      sessionTitle,
      sessionSubtitle,
      tasks,
      estimatedDuration,
      suggestedPomodoros,
      motivationalNote,
      totalFocusTime,
      selectedFocusPlaylist,
      pomodorosCompleted,
      currentPomodoroIndex,
      notebookOpen,
      sessionComplete,
      hasDismissedCompletion,
      playbackSettings,
    });
  }, [hasOnboarded, sessionTitle, sessionSubtitle, tasks, estimatedDuration,
      suggestedPomodoros, motivationalNote, totalFocusTime,
      selectedFocusPlaylist, pomodorosCompleted, currentPomodoroIndex,
      notebookOpen, sessionComplete, hasDismissedCompletion, playbackSettings]);

  // Persist stats
  useEffect(() => {
    saveStats(stats);
  }, [stats]);



  // Toggle a task's completed state
  const toggleTask = useCallback((index) => {
    setTasks(prev => {
      const next = [...prev];
      const newCompleted = !next[index].completed;
      next[index] = { 
        ...next[index], 
        completed: newCompleted,
        status: newCompleted ? 'Completed' : 'Planned'
      };

      if (newCompleted) {
        setStats(s => ({ ...s, tasksCompleted: s.tasksCompleted + 1 }));
        announce(`Task completed: ${next[index].text}`);
      } else {
        announce(`Task reopened: ${next[index].text}`);
      }

      // Calculate new currentPomodoroIndex based on updated tasks
      const firstIncompleteIdx = next.findIndex(t => !t.completed && (!t.taskType || t.taskType === 'focus'));
      if (firstIncompleteIdx !== -1) {
        // Find index of the first pomodoro of this task in the list
        let flatIdx = 0;
        for (let i = 0; i < firstIncompleteIdx; i++) {
          if (!next[i].taskType || next[i].taskType === 'focus') {
            flatIdx += next[i].pomodoros ? next[i].pomodoros.length : 1;
          }
        }
        setCurrentPomodoroIndex(flatIdx);
        setSessionComplete(false);
      } else {
        // All tasks completed
        let totalPomos = 0;
        next.forEach(t => {
          if (!t.taskType || t.taskType === 'focus') {
            totalPomos += t.pomodoros ? t.pomodoros.length : 1;
          }
        });
        setCurrentPomodoroIndex(totalPomos > 0 ? totalPomos - 1 : 0);
      }

      return next;
    });
  }, [announce, setCurrentPomodoroIndex, setSessionComplete, setStats]);

  // Delete a task and adjust session progression accordingly
  const deleteTask = useCallback((index) => {
    setTasks(prev => {
      if (index < 0 || index >= prev.length) return prev;

      const deletedTask = prev[index];
      const numDeletedPomodoros = deletedTask?.pomodoros?.length || 0;

      // Determine active task index before deletion
      let activeTaskIndex = -1;
      let pCount = 0;
      for (let tIdx = 0; tIdx < prev.length; tIdx++) {
        const task = prev[tIdx];
        const numP = task.pomodoros?.length || 0;
        if (currentPomodoroIndex >= pCount && currentPomodoroIndex < pCount + numP) {
          activeTaskIndex = tIdx;
          break;
        }
        pCount += numP;
      }

      const next = prev.filter((_, idx) => idx !== index);

      // Adjust currentPomodoroIndex
      let newCPI = currentPomodoroIndex;
      if (activeTaskIndex !== -1) {
        if (activeTaskIndex === index) {
          // Deleting the active task: point to first pomodoro of the next task, or clamp
          let prefixPomodoros = 0;
          for (let i = 0; i < index; i++) {
            prefixPomodoros += prev[i].pomodoros?.length || 0;
          }
          let totalNewP = 0;
          next.forEach(t => {
            totalNewP += t.pomodoros?.length || 0;
          });

          if (totalNewP === 0) {
            newCPI = 0;
          } else {
            newCPI = Math.min(prefixPomodoros, totalNewP - 1);
          }
        } else if (activeTaskIndex > index) {
          // Deleting a task before the active task: shift active index back
          newCPI = Math.max(0, currentPomodoroIndex - numDeletedPomodoros);
        }
      } else {
        let totalNewP = 0;
        next.forEach(t => {
          totalNewP += t.pomodoros?.length || 0;
        });
        newCPI = Math.min(currentPomodoroIndex, Math.max(0, totalNewP - 1));
      }

      // Adjust suggestedPomodoros and estimate duration
      let totalPomos = 0;
      let totalMinutes = 0;
      next.forEach(t => {
        totalPomos += t.pomodoroCount || 0;
        totalMinutes += typeof t.estimatedDuration === 'number' ? t.estimatedDuration : ((t.pomodoroCount || 0) * 25);
      });
      setSuggestedPomodoros(totalPomos);

      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      setEstimatedDuration(
        hours > 0
          ? `${hours} Hour${hours > 1 ? 's' : ''}${mins > 0 ? ` ${mins} Minutes` : ''}`
          : `${mins} Minutes`
      );

      setCurrentPomodoroIndex(newCPI);
      return next;
    });
  }, [currentPomodoroIndex, setEstimatedDuration, setSuggestedPomodoros, setCurrentPomodoroIndex]);

  // Check if all tasks are done (using memoized value defined above)

  // Reset session
  const resetSession = useCallback(() => {
    setHasOnboarded(false);
    setSessionTitle('');
    setSessionSubtitle('');
    setTasks([]);
    setEstimatedDuration('');
    setSuggestedPomodoros(3);
    setMotivationalNote('');
    setTotalFocusTime(0);
    setSelectedFocusPlaylist(null);
    setSessionComplete(false);
    setPomodorosCompleted(0);
    setNotebookOpen(false);
    setCurrentPomodoroIndex(0);
    setHasDismissedCompletion(false);
    setActiveSessionId(null);
    setNotes([]);

    // Check if the playlist_for_you is favorited (either classic or df)
    const isFav = dfFavoritePlaylists.some(x => String(x.playlistId) === 'playlist_for_you') ||
                  classicFavoritePlaylists.some(x => String(x.playlistId) === 'playlist_for_you');
    if (!isFav) {
      setAiPlaylistSongs([]);
      setLastAnalyzedTaskText('');
      localStorage.removeItem('zixovibes_playlist_for_you_songs');
      localStorage.removeItem('zixovibes_last_analyzed_task_text');
    }

    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('zixovibes_active_session_id');
    localStorage.removeItem('zixovibes_current_notes');
  }, [dfFavoritePlaylists, classicFavoritePlaylists]);

  const generateAIPlaylistForTaskText = useCallback((taskText, targetDurationSeconds) => {
    if (!taskText || typeof taskText !== 'string' || !taskText.trim()) return;

    // Do NOT allow regeneration if the playlist is currently favorited/saved!
    const currentFavPlaylists = mode === 'classic' ? classicFavoritePlaylists : dfFavoritePlaylists;
    const isFav = currentFavPlaylists.some(x => String(x.playlistId) === 'playlist_for_you');
    if (isFav) {
      console.warn("[AI Music Brain] Playlist for You is favorited. Skipping regeneration to keep it stable.");
      return;
    }

    // Track that we analyzed this task text, regardless of suitability
    setLastAnalyzedTaskText(taskText);
    localStorage.setItem('zixovibes_last_analyzed_task_text', taskText);

    const profile = analyzeTask(taskText);
    console.warn("[AI Music Brain] Task Analyzed:", taskText, profile);

    if (profile.musicSuitable) {
      const generatedSongs = generatePlaylistForTask(profile, songs, playlistsList, { durationSeconds: targetDurationSeconds });
      console.warn("[AI Music Brain] Generated Playlist Count:", generatedSongs.length);
      setAiPlaylistSongs(generatedSongs);
      setShufflePlayedSongIds([]);
      localStorage.setItem('zixovibes_playlist_for_you_songs', JSON.stringify(generatedSongs));

      // Get 'Playlist for You' details from playlistsList or local fallback
      const playlistObject = playlistsList.find(p => p.id === 'playlist_for_you') || {
        id: 'playlist_for_you',
        title: 'Playlist for You',
        name: 'Playlist for You',
        cover: '/playlist-covers/playlist-for-you.jpg',
        description: 'A dedicated playlist designed based on your current task.'
      };

      // Auto-set as active playlist when suitable playlist is generated!
      setActivePlaylist(playlistObject);

      // Auto-set currentSong to the first song of the generated playlist!
      if (generatedSongs.length > 0) {
        setCurrentSong(generatedSongs[0]);
        setElapsed(0);
      }
    } else {
      console.warn("[AI Music Brain] Task is unsuitable for music generation.");
      // Do not clear the playlist songs if they existed (as per user request: "preserve the previously persisted playlist"),
      // or we can leave it empty if it was empty.
    }
  }, [songs, playlistsList, setActivePlaylist, setCurrentSong, setElapsed]);

  const activePomo = useMemo(() => {
    return Array.isArray(flattenedPomodoros) ? flattenedPomodoros[currentPomodoroIndex] : null;
  }, [flattenedPomodoros, currentPomodoroIndex]);

  const activeTaskText = useMemo(() => {
    return activePomo?.taskText || (Array.isArray(tasks) && tasks[0] ? tasks[0].text : '');
  }, [activePomo, tasks]);

  // Context-aware automatic recommendation trigger
  useEffect(() => {
    if (!hasOnboarded || !activeTaskText) return;
    
    // Only trigger if activeTaskText is genuinely different from the last analyzed task text
    if (activeTaskText !== lastAnalyzedTaskText) {
      console.warn("[AI Music Brain] Active task context shifted to:", activeTaskText);
      const focusTasks = Array.isArray(tasks) ? tasks.filter(t => !t.taskType || t.taskType === 'focus') : [];
      const focusDurationMins = focusTasks.reduce((sum, t) => {
        const duration = typeof t.estimatedDuration === 'number'
          ? t.estimatedDuration
          : ((t.pomodoroCount || t.pomodoros?.length || 0) * 25);
        return sum + duration;
      }, 0);
      generateAIPlaylistForTaskText(activeTaskText, focusDurationMins * 60);
    }
  }, [hasOnboarded, activeTaskText, lastAnalyzedTaskText, generateAIPlaylistForTaskText, tasks]);

  // Helper to execute mode transition
  const executeModeSwitch = useCallback((newMode, onComplete) => {
    // Clear any active transition timers
    if (transitionTimeout1Ref.current) {
      clearTimeout(transitionTimeout1Ref.current);
      transitionTimeout1Ref.current = null;
    }
    if (transitionTimeout2Ref.current) {
      clearTimeout(transitionTimeout2Ref.current);
      transitionTimeout2Ref.current = null;
    }

    // Force PAUSE immediately for both classic and deep focus
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setClassicIsPlaying(false);
    setDfIsPlaying(false);

    // Capture leaving mode's exact playback position
    const currentPos = audioRef.current ? audioRef.current.currentTime : 0;
    if (mode === 'classic') {
      setClassicElapsed(currentPos);
      persistLocalPlayback('classic', classicActivePlaylist, classicCurrentSong, currentPos, classicIsShuffle, classicIsLoop, false);
      if (auth.currentUser) {
        saveUserDoc('classic', 'playback', {
          activePlaylist: classicActivePlaylist || null,
          currentSong: classicCurrentSong || null,
          elapsed: currentPos,
          isShuffle: classicIsShuffle,
          isLoop: classicIsLoop,
          isPlaying: false,
          volume
        });
      }
    } else {
      setDfElapsed(currentPos);
      persistLocalPlayback('deepfocus', dfActivePlaylist, dfCurrentSong, currentPos, dfIsShuffle, dfIsLoop, false);
      if (auth.currentUser) {
        saveUserDoc('deepFocus', 'playback', {
          activePlaylist: dfActivePlaylist || null,
          currentSong: dfCurrentSong || null,
          elapsed: currentPos,
          isShuffle: dfIsShuffle,
          isLoop: dfIsLoop,
          isPlaying: false,
          volume
        });
      }
    }

    setPendingMode(newMode);
    setTransitionStage('leaving');

    transitionTimeout1Ref.current = setTimeout(() => {
      setMode(newMode);
      localStorage.setItem('zixovibes_mode', newMode);
      setTransitionStage('entering');

      if (newMode === 'classic') {
        setNotebookOpen(false); // Close planner panel
        setDfOpenedPlaylist(null); // Close playlist detailed song lists in Deep Focus
        setClassicOpenedPlaylist(null); // Close playlist detailed song lists in Classic
        setSessionComplete(false); // Reset session complete overlay
      }

      transitionTimeout2Ref.current = setTimeout(() => {
        setTransitionStage(null);
        setPendingMode(null);
        transitionTimeout1Ref.current = null;
        transitionTimeout2Ref.current = null;
        if (onComplete) onComplete();
      }, 300);
    }, 300);
  }, [
    mode, volume, saveUserDoc, persistLocalPlayback,
    classicActivePlaylist, classicCurrentSong, classicIsShuffle, classicIsLoop, classicIsPlaying, classicElapsed,
    dfActivePlaylist, dfCurrentSong, dfIsShuffle, dfIsLoop, dfIsPlaying, dfElapsed
  ]);

  const signUp = useCallback(async (rawUsername, rawDisplayName, rawEmail, password) => {
    const trimmedUsername = rawUsername.trim();
    const trimmedDisplayName = rawDisplayName ? rawDisplayName.trim() : trimmedUsername;
    const trimmedEmail = rawEmail.trim().toLowerCase();
    const usernameKey = trimmedUsername.toLowerCase();

    console.log("[AUTH TRACE] STEP 1: Pre-validating username uniqueness via backend for:", trimmedUsername);
    // 1. Pre-validate username availability via backend to avoid orphaned auth accounts
    try {
      const checkRes = await fetchWithTimeoutAndRetry(`${API_BASE}/api/auth/check-username`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: trimmedUsername }),
      });
      if (!checkRes.ok) {
        const checkData = await checkRes.json().catch(() => ({}));
        throw new Error(checkData.error || 'Failed to validate username uniqueness.');
      }
      const checkData = await checkRes.json();
      if (!checkData.available) {
        const err = new Error('Username already exists. Please choose another username.');
        err.code = 'auth/username-already-in-use';
        throw err;
      }
      console.log("[AUTH TRACE] STEP 1: Username availability check SUCCESS");
    } catch (checkErr) {
      console.error("[AUTH TRACE] STEP 1: Username availability check FAILED", checkErr);
      if (checkErr.code === 'auth/username-already-in-use') {
        throw checkErr;
      }
      const err = new Error(checkErr.message || 'Validation error during signup.');
      err.code = 'auth/validation-failed';
      throw err;
    }

    // 2. Set default local persistence
    try {
      await setPersistence(auth, browserLocalPersistence);
    } catch (e) {
      console.warn("[Firebase Auth] Failed to set persistence:", e);
    }

    console.log("[AUTH TRACE] STEP 2: Creating Firebase Auth user with email:", trimmedEmail);
    // 3. Create user in Firebase Authentication
    let userCredential;
    try {
      userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      console.log("[AUTH TRACE] STEP 2: createUserWithEmailAndPassword SUCCESS uid =", userCredential.user.uid, "auth.currentUser =", auth.currentUser ? auth.currentUser.uid : "null");
    } catch (authErr) {
      console.error("[AUTH TRACE] STEP 2: createUserWithEmailAndPassword FAILED", authErr);
      throw authErr;
    }
    const uid = userCredential.user.uid;

    try {
      // 4. Update Firebase Auth displayName
      console.log("[AUTH TRACE] STEP 3: Updating Auth displayName to:", trimmedDisplayName);
      try {
        await updateProfile(userCredential.user, { displayName: trimmedDisplayName });
        console.log("[AUTH TRACE] STEP 3: updateProfile SUCCESS");
      } catch (e) {
        console.warn("[AUTH TRACE] STEP 3: updateProfile FAILED", e);
      }

      console.log("[AUTH TRACE] STEP 4: Calling backend reserve-username for:", trimmedUsername);
      // 5. Reserve username in 'usernames' collection securely via backend
      try {
        const reserveRes = await fetchWithTimeoutAndRetry(`${API_BASE}/api/auth/reserve-username`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: trimmedUsername,
            email: trimmedEmail,
            uid
          }),
        });
        if (!reserveRes.ok) {
          const reserveData = await reserveRes.json().catch(() => ({}));
          throw new Error(reserveData.error || 'Failed to reserve username.');
        }
        console.log("[AUTH TRACE] STEP 4: reserve-username via backend SUCCESS");
      } catch (reserveErr) {
        console.error("[AUTH TRACE] STEP 4: reserve-username via backend FAILED", reserveErr);
        throw reserveErr;
      }

      console.log("[AUTH TRACE] STEP 5: Writing user profile to Firestore /users/" + uid);
      // 6. Create corresponding Firestore document structure in 'users/{uid}'
      const nowIso = new Date().toISOString();
      const userDocRef = doc(db, 'users', uid);
      try {
        await setDoc(userDocRef, {
          profile: {
            uid,
            username: trimmedUsername,
            displayName: trimmedDisplayName,
            email: trimmedEmail,
            createdAt: nowIso,
            lastLogin: nowIso
          }
        });
        console.log("[AUTH TRACE] STEP 5: Writing user profile SUCCESS");
      } catch (profileErr) {
        console.error("[AUTH TRACE] STEP 5: Writing user profile FAILED", profileErr);
        throw profileErr;
      }

      // Save classic & deepFocus structures
      console.log("[AUTH TRACE] STEP 6: Initializing classic/deepFocus favorites and playback structures in Firestore");
      try {
        await setDoc(doc(db, 'users', uid, 'classic', 'favorites'), { playlists: classicFavoritePlaylists, songs: classicFavoriteSongs });
        await setDoc(doc(db, 'users', uid, 'deepFocus', 'favorites'), { playlists: dfFavoritePlaylists, songs: dfFavoriteSongs });
        await setDoc(doc(db, 'users', uid, 'classic', 'playback'), {
          activePlaylist: classicActivePlaylist || null,
          currentSong: classicCurrentSong || null,
          elapsed: classicElapsed,
          isShuffle: classicIsShuffle,
          isLoop: classicIsLoop,
          isPlaying: classicIsPlaying,
          volume
        });
        await setDoc(doc(db, 'users', uid, 'deepFocus', 'playback'), {
          activePlaylist: dfActivePlaylist || null,
          currentSong: dfCurrentSong || null,
          elapsed: dfElapsed,
          isShuffle: dfIsShuffle,
          isLoop: dfIsLoop,
          isPlaying: dfIsPlaying,
          volume
        });
        console.log("[AUTH TRACE] STEP 6: Initializing favorites/playback SUCCESS");
      } catch (structErr) {
        console.warn("[Firebase Auth] Optional subcollection initialization skipped due to security permissions. Using local state fallbacks:", structErr.message);
      }

      // 7. Update state
      setIsAuthenticated(true);
      setUsername(trimmedUsername);
      setDisplayName(trimmedDisplayName);
      setCreatedAt(nowIso);
      
      localStorage.setItem('zixovibes_is_authenticated', 'true');
      localStorage.setItem('zixovibes_username', trimmedUsername);
      localStorage.setItem('zixovibes_display_name', trimmedDisplayName);
      localStorage.setItem('zixovibes_created_at', nowIso);
      setUserEmail(trimmedEmail);

      // 8. Redirect directly back to where the user left
      executeModeSwitch(previousMode || 'classic');
    } catch (err) {
      console.error("[AUTH TRACE] Registration caught error, rolling back auth user. Error details:", err);
      // Rollback Auth user if profile or username registration fails
      try {
        await userCredential.user.delete();
        console.log("[AUTH TRACE] Auth rollback user delete SUCCESS");
      } catch (delErr) {
        console.warn("[Firebase Auth] Failed to delete temporary user on failed profile setup:", delErr);
      }
      throw err;
    }
  }, [
    previousMode, executeModeSwitch,
    classicFavoritePlaylists, classicFavoriteSongs, dfFavoritePlaylists, dfFavoriteSongs,
    classicActivePlaylist, classicCurrentSong, classicElapsed, classicIsShuffle, classicIsLoop, classicIsPlaying,
    dfActivePlaylist, dfCurrentSong, dfElapsed, dfIsShuffle, dfIsLoop, dfIsPlaying, volume
  ]);

  const login = useCallback(async (identifier, password, rememberMe = true) => {
    const trimmedIdentifier = identifier.trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedIdentifier);
    let targetEmail = trimmedIdentifier.toLowerCase();

    // If it's a username, resolve to email via backend resolver securely
    if (!isEmail) {
      const usernameKey = trimmedIdentifier.toLowerCase();
      try {
        const response = await fetchWithTimeoutAndRetry(`${API_BASE}/api/auth/resolve-username`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ username: usernameKey }),
        });
        
        if (!response.ok) {
          const resData = await response.json().catch(() => ({}));
          const err = new Error(resData.error || 'Username not found. Try your email address or check your username.');
          err.code = 'auth/username-not-found';
          throw err;
        }
        
        const resData = await response.json();
        targetEmail = resData.email;
      } catch (err) {
        if (!err.code) {
          err.code = 'auth/username-not-found';
          err.message = 'Invalid username or email.';
        }
        throw err;
      }
    }

    // 1. Set persistence based on rememberMe
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
    } catch (pErr) {
      console.warn("[Firebase Auth] Persistence configuration error:", pErr);
    }

    // 2. Sign in via Firebase Authentication
    let userCredential;
    try {
      userCredential = await signInWithEmailAndPassword(auth, targetEmail, password);
    } catch (authErr) {
      if (authErr.code === 'auth/user-not-found') {
        authErr.customMessage = isEmail
          ? 'Account not found. Please check your email or username.'
          : 'Username not found. Try your email address or check your username.';
      } else if (authErr.code === 'auth/wrong-password' || authErr.code === 'auth/invalid-credential') {
        authErr.customMessage = 'Incorrect password. Please try again.';
      }
      throw authErr;
    }

    const uid = userCredential.user.uid;

    // 3. Update lastLogin in Firestore user profile
    const userDocRef = doc(db, 'users', uid);
    const nowIso = new Date().toISOString();
    try {
      await setDoc(userDocRef, {
        profile: {
          lastLogin: nowIso
        }
      }, { merge: true });
    } catch (e) {
      console.warn("[Firebase Auth] Failed to update lastLogin on login:", e);
    }

    // 4. Load Firestore user document
    let fetchedUsername = '';
    let fetchedDisplayName = userCredential.user.displayName || '';
    let fetchedCreatedAt = null;

    try {
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        const data = userDoc.data();
        fetchedUsername = data.profile?.username || data.username || '';
        fetchedDisplayName = data.profile?.displayName || data.displayName || fetchedDisplayName;
        fetchedCreatedAt = data.profile?.createdAt || data.createdAt || null;
      }
    } catch (e) {
      console.warn("[Firebase Auth] Failed to read user profile on login:", e);
    }

    if (!fetchedDisplayName) {
      fetchedDisplayName = fetchedUsername || targetEmail.split('@')[0] || 'User';
    }
    if (!fetchedUsername) {
      fetchedUsername = targetEmail.split('@')[0] || 'user';
    }
    if (!fetchedCreatedAt) {
      fetchedCreatedAt = userCredential.user.metadata?.creationTime || new Date().toISOString();
    }

    // Self-heal username index for legacy users if missing (run in background, non-blocking)
    if (fetchedUsername && fetchedUsername !== 'user') {
      fetchWithTimeoutAndRetry(`${API_BASE}/api/auth/reserve-username`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: fetchedUsername,
          email: targetEmail,
          uid: uid
        }),
      }).catch(e => {
        console.warn("[Firebase Auth] Failed to self-heal username index:", e);
      });
    }

    // 5. Update state
    setIsAuthenticated(true);
    setUsername(fetchedUsername);
    setDisplayName(fetchedDisplayName);
    setUserEmail(targetEmail);
    setCreatedAt(fetchedCreatedAt);
    
    localStorage.setItem('zixovibes_is_authenticated', 'true');
    localStorage.setItem('zixovibes_username', fetchedUsername);
    localStorage.setItem('zixovibes_display_name', fetchedDisplayName);
    localStorage.setItem('zixovibes_created_at', fetchedCreatedAt);

    // 6. Redirect directly back to where the user left
    executeModeSwitch(previousMode || 'classic');
  }, [previousMode, executeModeSwitch]);

  const resetPassword = useCallback(async (identifier) => {
    const trimmedIdentifier = identifier.trim();
    if (!trimmedIdentifier) {
      const err = new Error('Please enter your username or email address.');
      err.code = 'auth/missing-identifier';
      throw err;
    }

    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedIdentifier);
    let targetEmail = trimmedIdentifier.toLowerCase();

    // If it's a username, resolve to email securely via backend
    if (!isEmail) {
      const usernameKey = trimmedIdentifier.toLowerCase();
      try {
        const response = await fetchWithTimeoutAndRetry(`${API_BASE}/api/auth/resolve-username`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ username: usernameKey }),
        });
        
        if (!response.ok) {
          const resData = await response.json().catch(() => ({}));
          const err = new Error(resData.error || 'Username not found. Please check your username or enter your email.');
          err.code = 'auth/username-not-found';
          throw err;
        }
        
        const resData = await response.json();
        targetEmail = resData.email;
      } catch (err) {
        if (!err.code) {
          err.code = 'auth/username-not-found';
          err.message = 'Invalid username or email.';
        }
        throw err;
      }
    }

    try {
      await sendPasswordResetEmail(auth, targetEmail);
      return { success: true, email: targetEmail };
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        err.customMessage = 'Account not found. Please check your email or username.';
      } else if (err.code === 'auth/invalid-email') {
        err.customMessage = 'Please enter a valid email address.';
      }
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    // 1. Sign out from Firebase Auth
    await signOut(auth);

    // 2. Clear state and LocalStorage preferences
    localStorage.removeItem('zixovibes_classic_playback');
    localStorage.removeItem('zixovibes_deepFocus_playback');
    localStorage.removeItem('zixovibes_classic_favorites');
    localStorage.removeItem('zixovibes_deepFocus_favorites');
    localStorage.removeItem('zixovibes_classic_history');
    localStorage.removeItem('zixovibes_deepFocus_focusHistory');
    localStorage.removeItem('zixovibes_listening_history');
    localStorage.removeItem('zixovibes_active_session_id');
    localStorage.removeItem('zixovibes_current_notes');

    setIsAuthenticated(false);
    setUsername('Guest User');
    setDisplayName('Guest User');
    setCreatedAt(null);
    setUserEmail('');
    setClassicFavoritePlaylists([]);
    setClassicFavoriteSongs([]);
    setDfFavoritePlaylists([]);
    setDfFavoriteSongs([]);
    setClassicHistory([]);
    setDfFocusHistory([]);
    setListeningHistory([]);
    setNotes([]);
    resetSession();
    
    localStorage.setItem('zixovibes_is_authenticated', 'false');
    localStorage.setItem('zixovibes_username', 'Guest User');
    localStorage.setItem('zixovibes_display_name', 'Guest User');
    localStorage.removeItem('zixovibes_created_at');
    
    executeModeSwitch('classic');
  }, [executeModeSwitch, resetSession]);

  // Mode transition with exit protection
  const switchMode = useCallback((newMode, bypassConfirmation = false, onComplete = null) => {
    if (newMode === mode || transitionStage !== null) {
      if (transitionStage !== null) {
        console.warn("[Transition Guard] Duplicate transition blocked. Transition is already in progress.");
      }
      return;
    }

    if (newMode === 'auth') {
      setPreviousMode(mode);
      localStorage.setItem('zixovibes_previous_mode', mode);
    }

    if (!bypassConfirmation && mode === 'deepfocus' && newMode === 'classic') {
      if (hasOnboarded) {
        if (tasks.length > 0 && allTasksDone) {
          setPendingModeSwitch(newMode);
          setShowCompletedConfirm(true);
          return;
        } else {
          setPendingModeSwitch(newMode);
          setShowExitConfirm(true);
          return;
        }
      }
    }

    executeModeSwitch(newMode, onComplete);
  }, [mode, transitionStage, hasOnboarded, tasks, allTasksDone, executeModeSwitch]);

  // Onboarding Session initialization
  const prevHasOnboardedRef = useRef(hasOnboarded);
  useEffect(() => {
    if (!prevHasOnboardedRef.current && hasOnboarded) {
      // New Focus Session starts!
      const sId = 'session_' + Date.now();
      setActiveSessionId(sId);
      localStorage.setItem('zixovibes_active_session_id', sId);
      setNotes([]);
      localStorage.removeItem('zixovibes_current_notes');

      const newSession = {
        sessionId: sId,
        playlistId: activePlaylist?.id || 'focus',
        startedAt: new Date().toISOString(),
        endedAt: null,
        duration: 0,
        completed: false,
        planner: {
          sessionTitle,
          sessionSubtitle,
          tasks,
        },
        notes: [],
        history: {
          startedAt: new Date().toISOString(),
          endedAt: null,
          completed: false
        }
      };
      saveUserDoc('deepFocus', 'activeSession', newSession);
    }
    prevHasOnboardedRef.current = hasOnboarded;
  }, [hasOnboarded, sessionTitle, sessionSubtitle, tasks, activePlaylist, saveUserDoc]);

  // Synchronize checklist task changes to active Focus Session
  const saveActiveSessionPlanner = useCallback((updatedTasks) => {
    if (!activeSessionId) return;
    const updatePayload = {
      planner: {
        sessionTitle,
        sessionSubtitle,
        tasks: updatedTasks
      }
    };
    saveUserDoc('deepFocus', 'activeSession', updatePayload);
  }, [activeSessionId, sessionTitle, sessionSubtitle, saveUserDoc]);

  useEffect(() => {
    if (hasOnboarded && activeSessionId) {
      saveActiveSessionPlanner(tasks);
    }
  }, [tasks, hasOnboarded, activeSessionId, saveActiveSessionPlanner]);

  const notesRef = useRef(notes);
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  const saveNotesDebouncedTimeoutRef = useRef(null);

  const syncNotesToFirestore = useCallback((updatedNotes) => {
    if (!activeSessionId) return;
    if (saveNotesDebouncedTimeoutRef.current) {
      clearTimeout(saveNotesDebouncedTimeoutRef.current);
    }
    saveNotesDebouncedTimeoutRef.current = setTimeout(async () => {
      await saveUserDoc('deepFocus', 'activeSession', { notes: updatedNotes });
    }, 600);
  }, [activeSessionId, saveUserDoc]);

  const syncNotesImmediately = useCallback(async () => {
    if (saveNotesDebouncedTimeoutRef.current) {
      clearTimeout(saveNotesDebouncedTimeoutRef.current);
    }
    if (activeSessionId) {
      await saveUserDoc('deepFocus', 'activeSession', { notes: notesRef.current });
    }
  }, [activeSessionId, saveUserDoc]);

  useEffect(() => {
    return () => {
      if (saveNotesDebouncedTimeoutRef.current) {
        clearTimeout(saveNotesDebouncedTimeoutRef.current);
      }
    };
  }, []);

  // Structured Notes CRUD
  const addFocusNote = useCallback(async (title, text) => {
    const newNote = {
      noteId: 'note_' + Date.now(),
      title: title.trim() || 'Untitled Note',
      text: text.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const nextNotes = [...notes, newNote];
    setNotes(nextNotes);
    localStorage.setItem('zixovibes_current_notes', JSON.stringify(nextNotes));

    if (activeSessionId) {
      await saveUserDoc('deepFocus', 'activeSession', { notes: nextNotes });
    }
    announce("Note created successfully.");
    return newNote;
  }, [notes, activeSessionId, announce, saveUserDoc]);

  const updateFocusNote = useCallback(async (noteId, title, text) => {
    const nextNotes = notesRef.current.map(n => n.noteId === noteId ? {
      ...n,
      title: title.trim() || 'Untitled Note',
      text: text,
      updatedAt: new Date().toISOString()
    } : n);

    setNotes(nextNotes);
    localStorage.setItem('zixovibes_current_notes', JSON.stringify(nextNotes));
    syncNotesToFirestore(nextNotes);
  }, [syncNotesToFirestore]);

  const deleteFocusNote = useCallback(async (noteId) => {
    const nextNotes = notesRef.current.filter(n => n.noteId !== noteId);
    setNotes(nextNotes);
    localStorage.setItem('zixovibes_current_notes', JSON.stringify(nextNotes));

    if (activeSessionId) {
      await saveUserDoc('deepFocus', 'activeSession', { notes: nextNotes });
    }
    announce("Note deleted successfully.");
  }, [activeSessionId, announce, saveUserDoc]);

  // Dynamic Manual Task Customizations
  const updateTaskDuration = useCallback((taskIndex, pomodoroCount) => {
    setTasks(prev => {
      const next = prev.map((t, idx) => {
        if (idx !== taskIndex) return t;
        const lower = t.text.toLowerCase();
        let baseSteps = [];
        if (lower.includes('revise') || lower.includes('study') || lower.includes('learn') || lower.includes('read') || lower.includes('module') || lower.includes('chapter')) {
          baseSteps = ['Concept Review', 'Key Questions Practice', 'Summary Notes Synthesis', 'Advanced Concept Analysis', 'Active Recall Drill', 'Final Review & Recap'];
        } else if (lower.includes('practice') || lower.includes('solve') || lower.includes('knn') || lower.includes('exercise') || lower.includes('problem')) {
          baseSteps = ['Methodology Review', 'Core Problems Execution', 'Complex Cases Analysis', 'Edge Cases Solve', 'Execution Optimization', 'Verification & Debugging'];
        } else if (lower.includes('prepare') || lower.includes('make') || lower.includes('write') || lower.includes('assignment') || lower.includes('notes')) {
          baseSteps = ['Outline & Structure', 'Active Drafting', 'Review & Refinement', 'Proofreading & Formatting', 'Polishing Visuals', 'Final Polish & Assembly'];
        } else {
          baseSteps = ['Initial Research & Setup', 'Active Execution Pass', 'Quality Review', 'Integration testing', 'Polishing Details', 'Deployment/Completion'];
        }

        const nextSteps = [];
        for (let i = 0; i < pomodoroCount; i++) {
          nextSteps.push(baseSteps[i] || `Step ${i + 1}: Deep Focus & Execution`);
        }

        return {
          ...t,
          pomodoros: nextSteps
        };
      });
      return next;
    });
  }, [setTasks]);

  const reorderTasks = useCallback((fromIndex, toIndex) => {
    setTasks(prev => {
      const next = [...prev];
      if (fromIndex < 0 || fromIndex >= next.length || toIndex < 0 || toIndex >= next.length) return prev;
      const [removed] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, removed);

      // Find the first incomplete focus task in the new order
      const firstIncompleteIdx = next.findIndex(t => !t.completed && (!t.taskType || t.taskType === 'focus'));
      if (firstIncompleteIdx !== -1) {
        let globalIndex = 0;
        for (let i = 0; i < firstIncompleteIdx; i++) {
          if (!next[i].taskType || next[i].taskType === 'focus') {
            globalIndex += next[i].pomodoros ? next[i].pomodoros.length : 1;
          }
        }
        setCurrentPomodoroIndex(globalIndex);
      } else {
        setCurrentPomodoroIndex(0);
      }

      return next;
    });
  }, [setCurrentPomodoroIndex, setTasks]);

  // End active session summary recording
  const endFocusSession = useCallback(async (completed = false) => {
    if (!activeSessionId) return;

    const endedAt = new Date().toISOString();
    const updatePayload = {
      endedAt,
      duration: totalFocusTime,
      completed,
      history: {
        endedAt,
        completed
      }
    };

    await saveUserDoc('deepFocus', 'activeSession', updatePayload);

    // Reconstruct full session summary for local list state
    const sessionObj = {
      sessionId: activeSessionId,
      playlistId: activePlaylist?.id || 'focus',
      startedAt: new Date(Date.now() - totalFocusTime * 1000).toISOString(),
      endedAt,
      duration: totalFocusTime,
      completed,
      planner: { sessionTitle, sessionSubtitle, tasks },
      notes,
      history: { startedAt: new Date().toISOString(), endedAt, completed }
    };

    setDfFocusHistory(prev => {
      const filtered = prev.filter(x => x.sessionId !== activeSessionId);
      const next = [sessionObj, ...filtered].slice(0, 50);
      localStorage.setItem('zixovibes_deepFocus_focusHistory', JSON.stringify(next));
      saveUserDoc('deepFocus', 'focusHistory', { focusHistory: next });
      return next;
    });

    // Clear active session tracking
    setActiveSessionId(null);
    localStorage.removeItem('zixovibes_active_session_id');
    setNotes([]);
    localStorage.removeItem('zixovibes_current_notes');
  }, [activeSessionId, totalFocusTime, activePlaylist, sessionTitle, sessionSubtitle, tasks, notes, saveUserDoc]);

  // Monitor timer session complete trigger
  useEffect(() => {
    if (sessionComplete && activeSessionId) {
      endFocusSession(true);
    }
  }, [sessionComplete, activeSessionId, endFocusSession]);

  const confirmExit = useCallback((deleteSession = false) => {
    setShowExitConfirm(false);
    if (pendingModeSwitch) {
      if (pendingModeSwitch === 'classic' && deleteSession) {
        endFocusSession(false);
      }
      executeModeSwitch(pendingModeSwitch, () => {
        if (pendingModeSwitch === 'classic' && deleteSession) {
          resetSession();
        }
      });
    }
    setPendingModeSwitch(null);
  }, [pendingModeSwitch, executeModeSwitch, resetSession, endFocusSession]);

  const confirmCompletedExit = useCallback(() => {
    setShowCompletedConfirm(false);
    if (pendingModeSwitch) {
      endFocusSession(true);
      executeModeSwitch(pendingModeSwitch, () => {
        resetSession();
      });
    }
    setPendingModeSwitch(null);
  }, [pendingModeSwitch, executeModeSwitch, resetSession, endFocusSession]);

  const cancelExit = useCallback(() => {
    setShowExitConfirm(false);
    setShowCompletedConfirm(false);
    setPendingModeSwitch(null);
  }, []);



  // Global spacebar audio controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' || e.key === ' ') {
        const activeEl = document.activeElement;
        const isInput = activeEl && (
          activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.isContentEditable ||
          activeEl.getAttribute('contenteditable') === 'true'
        );
        if (isInput) return;

        e.preventDefault();

        if (mode === 'classic') {
          setClassicIsPlaying(prev => !prev);
        } else if (mode === 'deepfocus') {
          setIsPlaying(prev => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode]);

  const value = useMemo(() => ({
    // Mode
    mode, switchMode, isTransitioning, transitionStage, pendingMode,
    // Playback
    isPlaying, setIsPlaying,
    classicIsPlaying, setClassicIsPlaying,
    volume, setVolume,
    isShuffle, setIsShuffle,
    isLoop, setIsLoop,
    isFavorited, setIsFavorited,
    activePlaylist, setActivePlaylist,
    playbackSettings,
    // Zix'Ovibes Dynamic Audio Library
    playlistsList, songs,
    openedPlaylist, setOpenedPlaylist,
    currentSong, setCurrentSong,
    elapsed, setElapsed,
    seek, playNext, playPrev, playSong, playPlaylist,
    currentPlaylistSongs,
    // User profile dynamic additions
    username, updateUsername,
    displayName, updateDisplayName,
    userInitial,
    createdAt,
    userEmail,
    isAuthenticated, setIsAuthenticated,
    showGuestModal, setShowGuestModal,
    previousMode, setPreviousMode,
    login, signUp, logout, resetPassword,
    // Focus
    hasOnboarded, setHasOnboarded,
    sessionTitle, setSessionTitle,
    sessionSubtitle, setSessionSubtitle,
    tasks, setTasks, toggleTask, deleteTask, allTasksDone,
    estimatedDuration, setEstimatedDuration,
    suggestedPomodoros, setSuggestedPomodoros,
    motivationalNote, setMotivationalNote,
    totalFocusTime, setTotalFocusTime,
    selectedFocusPlaylist, setSelectedFocusPlaylist,
    sessionComplete, setSessionComplete,
    pomodorosCompleted, setPomodorosCompleted,
    notebookOpen, setNotebookOpen,
    resetSession,
    aiPlaylistSongs,
    generateAIPlaylistForTaskText,
    // Exit protection
    showExitConfirm, setShowExitConfirm,
    showCompletedConfirm, setShowCompletedConfirm,
    pendingModeSwitch, setPendingModeSwitch,
    confirmExit, confirmCompletedExit, cancelExit,
    // Unfavorite confirmation
    showUnfavoriteConfirm, confirmUnfavorite, cancelUnfavorite,
    // Progression extensions
    currentPomodoroIndex, setCurrentPomodoroIndex,
    flattenedPomodoros,
    hasDismissedCompletion,
    setHasDismissedCompletion,
    initialTimerState,
    announcement,
    announce,
    // Stats
    stats, setStats,
    // Search and Favorites
    searchOpen, setSearchOpen,
    searchQuery, setSearchQuery,
    highlightedSongId, setHighlightedSongId,
    favoriteIds, setFavoriteIds,
    favoriteSongs, setFavoriteSongs,
    favoritePlaylists, setFavoritePlaylists,
    toggleFavoritePlaylist, toggleFavoriteSong,
    isPlaylistFavorited, isSongFavorited,
    recentlyPlayed, listeningHistory, focusHistory,
    notes, addFocusNote, updateFocusNote, deleteFocusNote, syncNotesImmediately,
    updateTaskDuration, reorderTasks,
    playbackActivated, setPlaybackActivated,
  }), [
    mode, switchMode, isTransitioning, transitionStage, pendingMode,
    isPlaying, classicIsPlaying, playbackActivated, volume, isShuffle, isLoop, isFavorited, activePlaylist, playbackSettings,
    playlistsList, songs, openedPlaylist, currentSong, elapsed, currentPlaylistSongs, seek, playNext, playPrev, playSong, playPlaylist,
    username, updateUsername, displayName, updateDisplayName, userInitial, createdAt, userEmail, isAuthenticated, showGuestModal, previousMode, login, signUp, logout, resetPassword,
    hasOnboarded, sessionTitle, sessionSubtitle, tasks, toggleTask, deleteTask, allTasksDone,
    estimatedDuration, suggestedPomodoros, motivationalNote, totalFocusTime, selectedFocusPlaylist,
    sessionComplete, pomodorosCompleted, notebookOpen, resetSession,
    aiPlaylistSongs, generateAIPlaylistForTaskText,
    showExitConfirm, showCompletedConfirm, pendingModeSwitch, confirmExit, confirmCompletedExit, cancelExit,
    showUnfavoriteConfirm, confirmUnfavorite, cancelUnfavorite,
    currentPomodoroIndex, flattenedPomodoros, hasDismissedCompletion, initialTimerState, announcement, announce,
    stats, setStats,
    searchOpen, searchQuery, highlightedSongId, favoriteIds, favoriteSongs, favoritePlaylists,
    toggleFavoritePlaylist, toggleFavoriteSong, isPlaylistFavorited, isSongFavorited,
    recentlyPlayed, listeningHistory, focusHistory, notes, addFocusNote, updateFocusNote, deleteFocusNote, syncNotesImmediately,
    updateTaskDuration, reorderTasks, seekTrigger, setPlaybackActivated
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
