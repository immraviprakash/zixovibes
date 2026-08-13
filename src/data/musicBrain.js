/**
 * Zix'Ovibes — Deep Focus AI Music Brain
 *
 * Local deterministic recommendation engine.
 *
 * Pipeline:
 *   Task
 *    ↓
 *   Intent / category analysis
 *    ↓
 *   Music suitability
 *    ↓
 *   Candidate filtering
 *    ↓
 *   Multi-factor scoring
 *    ↓
 *   Playlist composition
 *    ↓
 *   Artist / song diversity
 *    ↓
 *   Duration-aware selection
 *    ↓
 *   Deterministic shuffle
 *    ↓
 *   Playlist for You
 *
 * No external AI/API is required.
 * The engine works entirely from the local song catalogue.
 */

const PLAYLIST_ID = 'playlist_for_you';

const DEFAULT_TARGET_SECONDS = 25 * 60;
const MINIMUM_PLAYLIST_SECONDS = 20 * 60;
const LONG_SESSION_SECONDS = 60 * 60;

const PLAYLISTS = {
  focus: 'focus',
  lofi: 'lofi',
  ambience: 'ambience',
  rain: 'rain',
  jazz: 'jazz',
  sleep: 'sleep',
};

/* -------------------------------------------------------------------------- */
/* Utilities                                                                  */
/* -------------------------------------------------------------------------- */

function normalize(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value = '') {
  return normalize(value)
    .split(' ')
    .filter(Boolean);
}

function unique(array = []) {
  return [...new Set(array)];
}

function includesAny(text, words = []) {
  const normalized = normalize(text);

  return words.some((word) => {
    const target = normalize(word);

    if (target.includes(' ')) {
      return normalized.includes(target);
    }

    return new RegExp(`\\b${target}\\b`, 'i').test(normalized);
  });
}

function countMatches(text, words = []) {
  const normalized = normalize(text);

  return words.reduce((count, word) => {
    const target = normalize(word);

    if (!target) return count;

    if (target.includes(' ')) {
      return count + (normalized.includes(target) ? 1 : 0);
    }

    return count + (
      new RegExp(`\\b${target}\\b`, 'i').test(normalized)
        ? 1
        : 0
    );
  }, 0);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getPlaylist(song) {
  return normalize(
    song?.playlist ??
    song?.playlistId ??
    song?.category ??
    song?.genre ??
    ''
  );
}

function getArtist(song) {
  return String(
    song?.artist ??
    song?.artistName ??
    song?.author ??
    'Unknown Artist'
  ).trim();
}

function getSongTitle(song) {
  return String(
    song?.title ??
    song?.name ??
    'Untitled Track'
  ).trim();
}

function getSongId(song, fallbackIndex = 0) {
  return String(
    song?.id ??
    song?.videoId ??
    song?.youtubeId ??
    `${getArtist(song)}-${getSongTitle(song)}-${fallbackIndex}`
  );
}

/**
 * Converts common duration formats to seconds.
 *
 * Supported:
 *   212
 *   "212"
 *   "3:32"
 *   "01:03:32"
 */
function durationToSeconds(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (!value) return 0;

  const text = String(value).trim();

  if (/^\d+(\.\d+)?$/.test(text)) {
    return Number(text);
  }

  const parts = text.split(':').map(Number);

  if (parts.some(Number.isNaN)) return 0;

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  return 0;
}

function getDuration(song) {
  const val = song?.durationSeconds ??
    song?.duration ??
    song?.length ??
    song?.durationMs;
  if (typeof val === 'number' && val > 10000) {
    return Math.round(val / 1000);
  }
  return durationToSeconds(val);
}

function getMetadataText(song) {
  return normalize([
    song?.title,
    song?.name,
    song?.artist,
    song?.description,
    song?.genre,
    song?.mood,
    song?.tags,
    song?.keywords,
    song?.category,
    song?.playlist,
  ].filter(Boolean).join(' '));
}

/* -------------------------------------------------------------------------- */
/* Deterministic randomization                                                */
/* -------------------------------------------------------------------------- */

function hashString(value = '') {
  let hash = 2166136261;

  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function seededRandom(seed) {
  let state = hashString(seed);

  return () => {
    state += 0x6D2B79F5;

    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher-Yates shuffle using a deterministic seed.
 *
 * Same task + same catalogue = same playlist.
 * Different task = potentially different ordering.
 */
function seededShuffle(items, seed) {
  const result = [...items];
  const random = seededRandom(seed);

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));

    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/* Task vocabulary                                                            */
/* -------------------------------------------------------------------------- */

const TASK_PROFILES = {
  cognitive: {
    label: 'Cognitive',
    preferredPlaylists: ['focus', 'lofi'],
    secondaryPlaylists: ['ambience'],
    avoidedPlaylists: ['sleep'],
    intensity: 'high',
    variety: 'low',

    keywords: [
      'coding',
      'code',
      'programming',
      'debugging',
      'development',
      'develop',
      'software',
      'react',
      'javascript',
      'python',
      'java',
      'database',
      'sql',
      'algorithm',
      'algorithms',
      'studying',
      'study',
      'exam',
      'test',
      'revision',
      'revise',
      'learning',
      'learn',
      'homework',
      'assignment',
      'research',
      'mathematics',
      'math',
      'calculation',
      'calculations',
      'problem solving',
      'solve problems',
      'project',
      'project work',
      'documentation',
      'technical',
      'technical work',
    ],
  },

  creative: {
    label: 'Creative',
    preferredPlaylists: ['lofi', 'focus'],
    secondaryPlaylists: ['ambience', 'jazz'],
    avoidedPlaylists: ['sleep'],
    intensity: 'medium',
    variety: 'high',

    keywords: [
      'design',
      'designing',
      'ui',
      'ux',
      'figma',
      'prototype',
      'prototyping',
      'wireframe',
      'wireframing',
      'branding',
      'logo',
      'illustration',
      'drawing',
      'draw',
      'painting',
      'paint',
      'editing',
      'edit',
      'video editing',
      'photo editing',
      'presentation',
      'presentations',
      'brainstorm',
      'brainstorming',
      'creative',
      'writing',
      'story',
      'content creation',
      'content',
    ],
  },

  reading: {
    label: 'Reading',
    preferredPlaylists: ['ambience', 'lofi'],
    secondaryPlaylists: ['rain', 'focus'],
    avoidedPlaylists: ['sleep'],
    intensity: 'low',
    variety: 'medium',

    keywords: [
      'reading',
      'read',
      'book',
      'books',
      'article',
      'articles',
      'paper',
      'papers',
      'literature',
      'magazine',
      'documentation',
      'docs',
      'research paper',
      'review',
      'reviewing',
      'notes',
    ],
  },

  relaxed: {
    label: 'Relaxed Desk Work',
    preferredPlaylists: ['lofi', 'ambience'],
    secondaryPlaylists: ['rain', 'jazz'],
    avoidedPlaylists: ['sleep'],
    intensity: 'medium',
    variety: 'medium',

    keywords: [
      'email',
      'emails',
      'organizing files',
      'organize files',
      'files',
      'notes',
      'planning',
      'plan',
      'admin',
      'administrative',
      'spreadsheet',
      'excel',
      'sorting',
      'organizing',
      'routine work',
      'desk work',
      'paperwork',
    ],
  },

  exercise: {
    label: 'Exercise',
    preferredPlaylists: [],
    secondaryPlaylists: [],
    avoidedPlaylists: [],
    intensity: 'high',
    variety: 'high',
    keywords: [
      'gym',
      'workout',
      'exercise',
      'running',
      'run',
      'jogging',
      'jog',
      'cycling',
      'cycling',
      'sports',
      'football',
      'basketball',
      'cricket',
      'training',
    ],
    unsuitable: true,
  },

  errands: {
    label: 'Errand / Outside',
    preferredPlaylists: [],
    secondaryPlaylists: [],
    avoidedPlaylists: [],
    intensity: 'medium',
    variety: 'high',
    keywords: [
      'shopping',
      'groceries',
      'grocery',
      'errand',
      'errands',
      'appointment',
      'appointments',
      'commute',
      'commuting',
      'travel',
      'travelling',
      'traveling',
      'outside',
      'go outside',
      'go somewhere',
      'meeting',
      'event',
      'restaurant',
      'bank',
      'post office',
      'delivery',
    ],
    unsuitable: true,
  },

  household: {
    label: 'Household',
    preferredPlaylists: [],
    secondaryPlaylists: [],
    avoidedPlaylists: [],
    intensity: 'medium',
    variety: 'high',
    keywords: [
      'cooking',
      'cook',
      'cleaning',
      'clean',
      'laundry',
      'washing',
      'dishes',
      'housework',
      'chores',
      'eating',
      'eat',
      'lunch',
      'dinner',
      'breakfast',
    ],
    unsuitable: true,
  },
};

/* -------------------------------------------------------------------------- */
/* Task Analyzer                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Determines which task profile best represents the user's work.
 *
 * We intentionally score all profiles instead of stopping at the first
 * matching keyword. This prevents a word like "research" inside a larger
 * task from automatically winning every classification.
 */
export function analyzeTask(taskText) {
  if (!taskText || typeof taskText !== 'string') {
    return {
      category: 'Unknown',
      musicSuitable: false,
      preferredPlaylists: [],
      secondaryPlaylists: [],
      avoidedPlaylists: [],
      intensity: 'medium',
      variety: 'medium',
      confidence: 0,
      taskText: '',
    };
  }

  const text = normalize(taskText);

  if (!text) {
    return {
      category: 'Unknown',
      musicSuitable: false,
      preferredPlaylists: [],
      secondaryPlaylists: [],
      avoidedPlaylists: [],
      intensity: 'medium',
      variety: 'medium',
      confidence: 0,
      taskText: '',
    };
  }

  // 1. Task Validation - Insufficient/meaningless/short tasks
  const tokens = tokenize(taskText);
  const meaninglessWords = new Set([
    'a', 'b', 'c', 'abc', '123', 'testing', 'hello', 
    'do it', 'do', 'it', 'task', 'tasks', 'something', 'stuff', 'thing', 
    'things', 'xyz', 'qwer', 'ok', 'okay', 'yes', 'no', 
    'none', 'nothing', 'blank', 'na', 'n/a', 'misc',
    'asdf', 'asdfgh', '12345', 'qwerty', 'xyzxyz'
  ]);

  const isNumericOnly = /^\d+$/.test(text.replace(/\s+/g, ''));
  const isTooShort = text.length < 3;
  const isGeneric = tokens.length <= 2 && tokens.every(w => meaninglessWords.has(w) || meaninglessWords.has(normalize(w)));
  const hasNoLetters = !/[a-zA-Z]/.test(text);

  if (isNumericOnly || isTooShort || isGeneric || hasNoLetters) {
    return {
      category: 'Insufficient Information',
      musicSuitable: false,
      reason: 'insufficient_task_information',
      preferredPlaylists: [],
      secondaryPlaylists: [],
      avoidedPlaylists: [],
      intensity: 'medium',
      variety: 'medium',
      confidence: 0,
      taskText,
    };
  }

  const initialProfileScores = Object.entries(TASK_PROFILES)
    .map(([key, profile]) => {
      const matches = countMatches(text, profile.keywords);

      return {
        key,
        profile,
        matches,
        score: matches * 10,
      };
    });

  // 2. Phrase-based semantic boosts to resolve overlap
  if (includesAny(text, ['build', 'code', 'program', 'develop', 'react', 'javascript', 'python', 'java', 'sql', 'database', 'technical'])) {
    const entry = initialProfileScores.find(e => e.key === 'cognitive');
    if (entry) entry.score += 15;
  }
  if (includesAny(text, ['read', 'book', 'article', 'literature', 'textbook', 'chapter'])) {
    const entry = initialProfileScores.find(e => e.key === 'reading');
    if (entry) entry.score += 15;
  }
  if (includesAny(text, ['design', 'landing page', 'figma', 'creative', 'draw', 'paint', 'ui', 'ux'])) {
    const entry = initialProfileScores.find(e => e.key === 'creative');
    if (entry) entry.score += 15;
  }
  if (includesAny(text, ['organize', 'files', 'email', 'admin', 'planning', 'plan', 'routine', 'spreadsheet', 'documentation'])) {
    const entry = initialProfileScores.find(e => e.key === 'relaxed');
    if (entry) entry.score += 15;
  }

  // Filter out profiles with zero matches and zero score
  const profileScores = initialProfileScores
    .filter((entry) => entry.matches > 0 || entry.score > 0)
    .sort((a, b) => b.score - a.score);

  /**
   * Explicit outside/physical tasks should win over generic words.
   *
   * Example:
   * "Go to the gym and plan my workout"
   *
   * should not become a cognitive task merely because "plan" appears.
   */
  const unsuitableMatch = profileScores.find(
    (entry) => entry.profile.unsuitable
  );

  if (unsuitableMatch) {
    return {
      category: unsuitableMatch.profile.label,
      musicSuitable: false,
      preferredPlaylists: [],
      secondaryPlaylists: [],
      avoidedPlaylists: [],
      intensity: unsuitableMatch.profile.intensity,
      variety: unsuitableMatch.profile.variety,
      confidence: clamp(
        0.75 + unsuitableMatch.matches * 0.05,
        0,
        1
      ),
      taskText,
      reason: 'This task is not considered a Deep Focus desk-listening task.',
    };
  }

  /**
   * No recognized intent.
   *
   * Rather than rejecting the task, use a safe neutral concentration profile.
   */
  if (profileScores.length === 0) {
    return {
      category: 'General Focus',
      musicSuitable: true,
      preferredPlaylists: ['focus', 'lofi'],
      secondaryPlaylists: ['ambience'],
      avoidedPlaylists: ['sleep'],
      intensity: 'medium',
      variety: 'medium',
      confidence: 0.35,
      taskText,
      reason: 'No strong task-specific music signal was detected.',
    };
  }

  const winner = profileScores[0];

  const confidence = clamp(
    0.45 +
    winner.matches * 0.12 +
    ((winner.score - (profileScores[1]?.score ?? 0)) / 100),
    0,
    1
  );

  return {
    category: winner.profile.label,
    musicSuitable: true,
    preferredPlaylists: [...winner.profile.preferredPlaylists],
    secondaryPlaylists: [...winner.profile.secondaryPlaylists],
    avoidedPlaylists: [...winner.profile.avoidedPlaylists],
    intensity: winner.profile.intensity,
    variety: winner.profile.variety,
    confidence,
    taskText,
  };
}

/* -------------------------------------------------------------------------- */
/* Song Feature Extraction                                                    */
/* -------------------------------------------------------------------------- */

function getSongFeatures(song) {
  const metadata = getMetadataText(song);
  const playlist = getPlaylist(song);

  const features = {
    focus: [
      'focus',
      'deep focus',
      'concentration',
      'concentrate',
      'study',
      'studying',
      'productivity',
      'productive',
      'work',
      'mind',
      'flow',
    ],

    calm: [
      'calm',
      'peace',
      'peaceful',
      'relax',
      'relaxing',
      'soft',
      'gentle',
      'quiet',
      'serene',
      'slow',
    ],

    creative: [
      'creative',
      'dream',
      'inspire',
      'inspiration',
      'imagination',
      'art',
      'artistic',
      'groove',
      'flow',
    ],

    ambient: [
      'ambient',
      'ambience',
      'atmosphere',
      'atmospheric',
      'space',
      'drift',
      'soundscape',
      'environment',
    ],

    rain: [
      'rain',
      'rainfall',
      'storm',
      'thunder',
      'water',
      'drizzle',
    ],

    sleep: [
      'sleep',
      'sleeping',
      'night',
      'lullaby',
      'dreaming',
      'bedtime',
    ],

    energetic: [
      'energy',
      'energetic',
      'upbeat',
      'drive',
      'motion',
      'power',
      'dynamic',
    ],
  };

  return {
    playlist,
    metadata,
    duration: getDuration(song),

    focusScore: countMatches(metadata, features.focus),
    calmScore: countMatches(metadata, features.calm),
    creativeScore: countMatches(metadata, features.creative),
    ambientScore: countMatches(metadata, features.ambient),
    rainScore: countMatches(metadata, features.rain),
    sleepScore: countMatches(metadata, features.sleep),
    energeticScore: countMatches(metadata, features.energetic),
  };
}

/* -------------------------------------------------------------------------- */
/* Playlist Relationship Scoring                                              */
/* -------------------------------------------------------------------------- */

function playlistScore(profile, playlist) {
  if (!playlist) return -20;

  const preferredIndex = profile.preferredPlaylists.indexOf(playlist);

  if (preferredIndex !== -1) {
    return 55 - preferredIndex * 12;
  }

  const secondaryIndex = profile.secondaryPlaylists.indexOf(playlist);

  if (secondaryIndex !== -1) {
    return 25 - secondaryIndex * 7;
  }

  if (profile.avoidedPlaylists.includes(playlist)) {
    return -90;
  }

  /**
   * Unknown playlists are not automatically terrible.
   * They receive a neutral score so a small catalogue does not collapse.
   */
  return 2;
}

/* -------------------------------------------------------------------------- */
/* Song Scoring                                                               */
/* -------------------------------------------------------------------------- */

function scoreSong(song, profile, features) {
  let score = 0;

  const playlist = features.playlist;

  /* Playlist relationship */
  score += playlistScore(profile, playlist);

  /* ---------------------------------------------------------------------- */
  /* Task intensity                                                           */
  /* ---------------------------------------------------------------------- */

  if (profile.intensity === 'high') {
    score += features.focusScore * 8;
    score += features.energeticScore * 2;
    score -= features.sleepScore * 10;
  }

  if (profile.intensity === 'medium') {
    score += features.focusScore * 4;
    score += features.creativeScore * 4;
    score += features.calmScore * 3;
    score -= features.sleepScore * 8;
  }

  if (profile.intensity === 'low') {
    score += features.calmScore * 7;
    score += features.ambientScore * 7;
    score += features.rainScore * 4;
    score -= features.energeticScore * 3;
    score -= features.sleepScore * 5;
  }

  /* ---------------------------------------------------------------------- */
  /* Category-specific preferences                                           */
  /* ---------------------------------------------------------------------- */

  if (profile.category === 'Cognitive') {
    if (playlist === PLAYLISTS.focus) score += 18;
    if (playlist === PLAYLISTS.lofi) score += 10;
    if (playlist === PLAYLISTS.rain) score -= 12;
    if (playlist === PLAYLISTS.sleep) score -= 30;
  }

  if (profile.category === 'Creative') {
    if (playlist === PLAYLISTS.lofi) score += 14;
    if (playlist === PLAYLISTS.focus) score += 9;
    if (playlist === PLAYLISTS.ambience) score += 9;
    if (playlist === PLAYLISTS.jazz) score += 7;
  }

  if (profile.category === 'Reading') {
    if (playlist === PLAYLISTS.ambience) score += 18;
    if (playlist === PLAYLISTS.lofi) score += 12;
    if (playlist === PLAYLISTS.rain) score += 9;
    if (playlist === PLAYLISTS.focus) score += 5;
  }

  if (profile.category === 'Relaxed Desk Work') {
    if (playlist === PLAYLISTS.lofi) score += 16;
    if (playlist === PLAYLISTS.ambience) score += 12;
    if (playlist === PLAYLISTS.rain) score += 9;
    if (playlist === PLAYLISTS.jazz) score += 5;
  }

  /* ---------------------------------------------------------------------- */
  /* Duration quality                                                        */
  /* ---------------------------------------------------------------------- */

  /**
   * Extremely short tracks create a poor Deep Focus listening experience
   * because the player changes tracks too frequently.
   */
  if (features.duration > 0) {
    if (features.duration < 60) {
      score -= 18;
    } else if (features.duration < 120) {
      score -= 6;
    } else if (features.duration >= 180) {
      score += 4;
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Metadata quality                                                        */
  /* ---------------------------------------------------------------------- */

  const metadataFields = [
    song?.mood,
    song?.genre,
    song?.tags,
    song?.keywords,
    song?.description,
  ].filter(Boolean);

  if (metadataFields.length > 0) {
    score += 3;
  }

  /* Small stable tie-breaker */
  score += (hashString(getSongId(song)) % 100) / 1000;

  return score;
}

/* -------------------------------------------------------------------------- */
/* Candidate Filtering                                                        */
/* -------------------------------------------------------------------------- */

function buildCandidates(profile, songs) {
  return songs
    .map((song, index) => ({
      song,
      index,
      features: getSongFeatures(song),
    }))
    .filter(({ song, features }) => {
      const playlist = features.playlist;

      if (!playlist) return false;

      if (playlist === PLAYLIST_ID) return false;

      if (profile.avoidedPlaylists.includes(playlist)) {
        return false;
      }

      /**
       * Deep Focus should not accidentally pull Sleep tracks into a work
       * playlist simply because their title contains "focus".
       */
      if (
        profile.intensity !== 'low' &&
        playlist === PLAYLISTS.sleep
      ) {
        return false;
      }

      return song != null;
    });
}

/* -------------------------------------------------------------------------- */
/* Playlist Composition                                                       */
/* -------------------------------------------------------------------------- */

function calculateTargetSeconds(taskText, requestedDurationSeconds) {
  if (
    Number.isFinite(requestedDurationSeconds) &&
    requestedDurationSeconds > 0
  ) {
    return Math.max(
      MINIMUM_PLAYLIST_SECONDS,
      requestedDurationSeconds
    );
  }

  /**
   * We intentionally do NOT attempt to create a 2-hour playlist for a
   * 2-hour task.
   *
   * Short session → roughly session length.
   * Long session → cap recommendation around 60 minutes.
   */
  const normalized = normalize(taskText);

  if (
    includesAny(normalized, [
      'long session',
      'deep work',
      'work for two hours',
      'work for 2 hours',
      'work for three hours',
      'work for 3 hours',
    ])
  ) {
    return LONG_SESSION_SECONDS;
  }

  return DEFAULT_TARGET_SECONDS;
}

/**
 * Determines a rough target distribution.
 *
 * Example:
 * Cognitive:
 *   Focus 60%
 *   Lo-Fi 30%
 *   Ambience 10%
 *
 * Creative:
 *   Lo-Fi 50%
 *   Focus 25%
 *   Ambience/Jazz 25%
 */
function getPlaylistWeights(profile) {
  const preferred = profile.preferredPlaylists;
  const secondary = profile.secondaryPlaylists;

  const weights = {};

  if (preferred[0]) {
    weights[preferred[0]] = 0.55;
  }

  if (preferred[1]) {
    weights[preferred[1]] = 0.30;
  }

  if (secondary[0]) {
    weights[secondary[0]] = 0.10;
  }

  if (secondary[1]) {
    weights[secondary[1]] = 0.05;
  }

  return weights;
}

/* -------------------------------------------------------------------------- */
/* Duration-aware selection                                                   */
/* -------------------------------------------------------------------------- */

function selectPlaylistSongs(
  scoredCandidates,
  profile,
  targetSeconds,
  taskSeed
) {
  const selected = [];
  const selectedIds = new Set();
  const artistCounts = new Map();
  const playlistCounts = new Map();

  const weights = getPlaylistWeights(profile);

  const sorted = [...scoredCandidates].sort(
    (a, b) => b.score - a.score
  );

  let totalSeconds = 0;

  /**
   * The engine uses a soft artist limit rather than a hard global limit.
   *
   * Default:
   *   max 2 tracks per artist
   *
   * If the catalogue is small, this relaxes to 3.
   */
  const artistLimit = sorted.length >= 40 ? 2 : 3;

  /**
   * Phase 1:
   * Make sure the playlist actually represents the intended music profile.
   */
  for (const preferredPlaylist of profile.preferredPlaylists) {
    const playlistCandidates = sorted.filter(
      (entry) =>
        entry.features.playlist === preferredPlaylist &&
        !selectedIds.has(getSongId(entry.song))
    );

    const desiredWeight = weights[preferredPlaylist] ?? 0;
    const desiredSeconds = targetSeconds * desiredWeight;

    let playlistSeconds = 0;

    for (const entry of playlistCandidates) {
      if (playlistSeconds >= desiredSeconds) break;

      const songId = getSongId(entry.song);

      if (selectedIds.has(songId)) continue;

      const artist = getArtist(entry.song);
      const artistCount = artistCounts.get(artist) ?? 0;

      if (artistCount >= artistLimit) continue;

      const duration = entry.features.duration;

      selected.push(entry);
      selectedIds.add(songId);

      artistCounts.set(artist, artistCount + 1);

      const currentCount =
        playlistCounts.get(preferredPlaylist) ?? 0;

      playlistCounts.set(
        preferredPlaylist,
        currentCount + 1
      );

      playlistSeconds += duration;
      totalSeconds += duration;
    }
  }

  /**
   * Phase 2:
   * Fill remaining duration using globally strong candidates.
   */
  for (const entry of sorted) {
    if (totalSeconds >= targetSeconds) break;

    const songId = getSongId(entry.song);

    if (selectedIds.has(songId)) continue;

    const artist = getArtist(entry.song);
    const artistCount = artistCounts.get(artist) ?? 0;

    if (artistCount >= artistLimit) continue;

    selected.push(entry);
    selectedIds.add(songId);

    artistCounts.set(artist, artistCount + 1);

    const playlist = entry.features.playlist;

    playlistCounts.set(
      playlist,
      (playlistCounts.get(playlist) ?? 0) + 1
    );

    totalSeconds += entry.features.duration;
  }

  /**
   * Phase 3:
   * If we still don't have the minimum duration, relax artist diversity.
   *
   * This prevents a small catalogue from producing a ridiculously short
   * playlist.
   */
  if (totalSeconds < targetSeconds) {
    for (const entry of sorted) {
      if (totalSeconds >= targetSeconds) break;

      const songId = getSongId(entry.song);

      if (selectedIds.has(songId)) continue;

      selected.push(entry);
      selectedIds.add(songId);

      totalSeconds += entry.features.duration;
    }
  }

  /**
   * Final deterministic shuffle.
   *
   * We don't simply randomize the whole list. First we curated it,
   * THEN we shuffle it.
   */
  const shuffled = seededShuffle(
    selected,
    `${taskSeed}:${profile.category}`
  );

  return {
    songs: shuffled.map((entry) => entry.song),
    totalSeconds,
    playlistCounts: Object.fromEntries(playlistCounts),
  };
}

/* -------------------------------------------------------------------------- */
/* Main Generator                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Generates the personalized "Playlist for You".
 *
 * Signature intentionally remains compatible with the existing app:
 *
 * generatePlaylistForTask(profile, songs, playlistsList)
 */
export function generatePlaylistForTask(
  profile,
  songs,
  playlistsList = [],
  options = {}
) {
  if (
    !profile ||
    !profile.musicSuitable ||
    !Array.isArray(songs) ||
    songs.length === 0
  ) {
    return [];
  }

  const targetSeconds = calculateTargetSeconds(
    profile.taskText,
    options.durationSeconds
  );

  const candidates = buildCandidates(profile, songs);

  if (candidates.length === 0) {
    return [];
  }

  const scoredCandidates = candidates.map((entry) => ({
    ...entry,
    score: scoreSong(
      entry.song,
      profile,
      entry.features
    ),
  }));

  const taskSeed =
    options.seed ??
    profile.taskText ??
    profile.category ??
    'zixovibes';

  const result = selectPlaylistSongs(
    scoredCandidates,
    profile,
    targetSeconds,
    taskSeed
  );

  /**
   * Preserve original song metadata while changing only the playlist scope.
   *
   * This makes the generated tracks behave as one playlist inside the
   * existing player.
   */
  return result.songs.map((song) => ({
    ...song,
    playlist: PLAYLIST_ID,
  }));
}

/* -------------------------------------------------------------------------- */
/* Convenience API                                                            */
/* -------------------------------------------------------------------------- */

/**
 * One-call helper:
 *
 * task text → analysis → playlist.
 *
 * Useful for onboarding, manual task creation and replan.
 */
export function createAIPlaylistForTask(
  taskText,
  songs,
  playlistsList = [],
  options = {}
) {
  const profile = analyzeTask(taskText);

  if (!profile.musicSuitable) {
    return {
      profile,
      songs: [],
      musicSuitable: false,
    };
  }

  const playlist = generatePlaylistForTask(
    profile,
    songs,
    playlistsList,
    options
  );

  return {
    profile,
    songs: playlist,
    musicSuitable: true,
  };
}

/**
 * Lightweight explanation for debugging/UI development.
 *
 * This does not expose the entire scoring system to the user.
 */
export function explainAIPlaylist(profile, songs = []) {
  if (!profile) {
    return {
      title: 'No recommendation',
      reason: 'No task profile was provided.',
    };
  }

  if (!profile.musicSuitable) {
    return {
      title: 'Music skipped',
      reason:
        'This task is not considered suitable for a Deep Focus music session.',
      category: profile.category,
    };
  }

  const playlistCounts = {};

  songs.forEach((song) => {
    const originalPlaylist =
      song?.originalPlaylist ??
      song?.sourcePlaylist ??
      song?.playlist;

    const key = normalize(originalPlaylist || 'unknown');

    playlistCounts[key] =
      (playlistCounts[key] ?? 0) + 1;
  });

  return {
    title: 'Playlist for You',
    category: profile.category,
    confidence: profile.confidence,
    preferredPlaylists: profile.preferredPlaylists,
    secondaryPlaylists: profile.secondaryPlaylists,
    avoidedPlaylists: profile.avoidedPlaylists,
    playlistCounts,
    trackCount: songs.length,
  };
}