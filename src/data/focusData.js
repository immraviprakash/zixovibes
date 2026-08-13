/* =============================================
   DEEP FOCUS MODE — Data, Quotes & AI Coach
   ============================================= */

// ── Focus Playlists ──

import coffeeShopArtwork from '../assets/coffee-shop-artwork.png';
import jazzLofi from '../assets/jazz-lofi-focus.png';
import dedicatedArt from '../assets/dedicated-playlist.png';

export const focusPlaylists = [
  {
    id: 'f1',
    name: 'Jazz',
    subtitle: 'Smooth • Calm • Focus',
    artwork: coffeeShopArtwork,
    title: 'Jazz LoFi',
    artist: 'Chill Studio',
    songName: 'Midnight Sax',
    duration: 195,
  },
  {
    id: 'f2',
    name: 'Deep Focus',
    subtitle: 'Instrumental • Ambient',
    artwork: jazzLofi,
    title: 'Deep Focus',
    artist: 'ConcernedApe',
    songName: 'Deep Focus',
    duration: 240,
  },
  {
    id: 'f3',
    name: 'Dedicated Playlist',
    subtitle: 'Made based on your tasks',
    artwork: dedicatedArt,
    badge: '✦ AI GENERATED',
    title: 'Focus Made For You',
    artist: "Zix'O AI",
    songName: 'Curated Flow',
    duration: 210,
  },
];

// ── Motivational Quotes ──

export const motivationalQuotes = [
  "Discipline is choosing between what you want now and what you want most.",
  "Focus creates freedom.",
  "Small steps compound into mastery.",
  "The secret of getting ahead is getting started.",
  "Progress, not perfection.",
  "What you do today shapes who you become tomorrow.",
  "Deep work is the superpower of the 21st century.",
  "Consistency beats intensity.",
  "Your focus determines your reality.",
  "Done is better than perfect.",
];

// ── Focus Greeting Subtitles ──

const focusSubtitles = [
  "Stay focused, you've got this.",
  "Progress compounds. Keep going.",
  "One task at a time. You're doing great.",
  "Deep work builds deep results.",
  "Small wins lead to big breakthroughs.",
  "Stay in the zone. Momentum is everything.",
];

export function getRandomSubtitle() {
  return focusSubtitles[Math.floor(Math.random() * focusSubtitles.length)];
}

// ── AI Focus Coach ──

// Keywords to category mapping for session title generation
const categoryKeywords = {
  'Machine Learning': ['machine learning', 'ml', 'deep learning', 'neural', 'knn', 'svm', 'regression', 'classification', 'ai model'],
  'Frontend Development': ['react', 'frontend', 'css', 'html', 'javascript', 'typescript', 'nextjs', 'vite', 'component', 'ui', 'ux', 'dashboard', 'webpage'],
  'Backend Development': ['api', 'backend', 'server', 'database', 'node', 'express', 'django', 'flask', 'rest', 'graphql', 'sql'],
  'Data Science': ['data', 'pandas', 'numpy', 'analysis', 'visualization', 'statistics', 'jupyter'],
  'Mobile Development': ['mobile', 'android', 'ios', 'flutter', 'react native', 'swift', 'kotlin'],
  'Career Preparation': ['resume', 'interview', 'job', 'career', 'portfolio', 'linkedin', 'cover letter', 'hiring'],
  'Exam Preparation': ['exam', 'test', 'revision', 'revise', 'study', 'module', 'chapter', 'syllabus', 'semester', 'quiz'],
  'Writing & Content': ['write', 'blog', 'article', 'essay', 'documentation', 'content', 'report', 'thesis', 'paper'],
  'Design Work': ['design', 'figma', 'sketch', 'prototype', 'wireframe', 'mockup', 'branding', 'logo'],
  'Project Planning': ['plan', 'project', 'roadmap', 'sprint', 'milestone', 'scope', 'organize', 'strategy'],
  'Research': ['research', 'explore', 'literature', 'review', 'survey', 'investigate'],
};

/**
 * AI Focus Coach — Transforms raw user input into a structured focus plan.
 * Generates: session title, cleaned tasks, estimated duration, suggested pomodoros, motivational note.
 */
export function generateFocusPlan(rawInput) {
  const lines = rawInput
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length === 0) {
    return {
      sessionTitle: 'Focus Session',
      tasks: [{ text: 'Define your focus goals', completed: false, pomodoros: ['Initial Research', 'Active Execution', 'Review & Quality Check'] }],
      estimatedDuration: '75 Minutes',
      suggestedPomodoros: 3,
      motivationalNote: 'Start small. The first step is always the hardest.',
      subtitle: getRandomSubtitle(),
    };
  }

  // Detect session category from all input text
  const combined = rawInput.toLowerCase();
  let sessionTitle = 'Focus Session';
  let bestMatchCount = 0;

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    let matchCount = 0;
    for (const kw of keywords) {
      if (combined.includes(kw)) matchCount++;
    }
    if (matchCount > bestMatchCount) {
      bestMatchCount = matchCount;
      sessionTitle = category;
    }
  }

  // Clean and enhance task descriptions with smart Pomodoro step breakdowns
  const tasks = lines.map(line => {
    // Remove leading bullet points, dashes, numbers, etc
    let cleaned = line.replace(/^[-•*▪◦→\d.)\]]+\s*/, '').trim();
    // Capitalize first letter
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
    // Remove trailing periods for consistency
    cleaned = cleaned.replace(/\.$/, '');

    // Keyword detection for Pomodoro breakdown steps & synopses
    let pomodoros = [];
    let synopsis = "";
    const lower = cleaned.toLowerCase();
    if (lower.includes('revise') || lower.includes('study') || lower.includes('learn') || lower.includes('read') || lower.includes('module') || lower.includes('chapter')) {
      pomodoros = ['Concept Review', 'Key Questions Practice', 'Summary Notes Synthesis'];
      synopsis = `This session covers the core concepts of the topic (${cleaned}), identifying critical principles, practicing sample questions, and synthesizing quick revision notes.`;
    } else if (lower.includes('practice') || lower.includes('solve') || lower.includes('knn') || lower.includes('exercise') || lower.includes('problem')) {
      pomodoros = ['Methodology Review', 'Core Problems Execution', 'Complex Cases Analysis'];
      synopsis = `This session focuses on practical problem solving and application of ${cleaned}. We'll review the core methodology, solve standard problems, and analyze edge cases.`;
    } else if (lower.includes('prepare') || lower.includes('make') || lower.includes('write') || lower.includes('assignment') || lower.includes('notes')) {
      pomodoros = ['Outline & Structure', 'Active Drafting', 'Review & Refinement'];
      synopsis = `This session is dedicated to content creation and synthesis for "${cleaned}". We will map out a logical structure, draft the content, and refine the quality.`;
    } else {
      pomodoros = ['Initial Research & Setup', 'Active Execution Pass', 'Quality Review'];
      synopsis = `This session is designed for execution of focus goals related to ${cleaned}. We will perform setup/research, run an execution pass, and verify quality.`;
    }

    return { text: cleaned, completed: false, pomodoros, synopsis };
  });

  // Calculate total pomodoro sessions dynamically
  let suggestedPomodoros = 0;
  tasks.forEach(t => {
    suggestedPomodoros += t.pomodoros.length;
  });

  const totalMinutes = suggestedPomodoros * 25;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const estimatedDuration = hours > 0
    ? `${hours} Hour${hours > 1 ? 's' : ''}${mins > 0 ? ` ${mins} Minutes` : ''}`
    : `${mins} Minutes`;

  // Pick motivational note based on task count
  const motivationalNotes = [
    `Complete "${tasks[0]?.text}" first. Momentum will make the rest easier.`,
    'Focus on one task at a time. Quality over quantity.',
    'Start with the hardest task. Everything else will feel effortless after.',
    'Break it down, knock it out. You\'re closer than you think.',
    'Deep focus sessions compound. Every minute counts.',
  ];
  const motivationalNote = motivationalNotes[Math.min(tasks.length - 1, motivationalNotes.length - 1)];

  return {
    sessionTitle,
    tasks,
    estimatedDuration,
    suggestedPomodoros,
    motivationalNote,
    subtitle: getRandomSubtitle(),
  };
}

export function sanitizePlan(rawPlan) {
  if (!rawPlan || typeof rawPlan !== 'object') {
    return {
      sessionTitle: 'Focus Session',
      sessionSubtitle: 'Structured work session',
      tasks: [],
      totalDuration: 120,
      suggestedPomodoros: 4,
      suggestedPlaylist: { id: 'f2' },
      motivationalNote: 'Let\'s stay focused and make progress.'
    };
  }

  const sessionTitle = typeof rawPlan.sessionTitle === 'string' && rawPlan.sessionTitle.trim()
    ? rawPlan.sessionTitle.trim()
    : 'Focus Session';

  const sessionSubtitle = typeof rawPlan.sessionSubtitle === 'string' && rawPlan.sessionSubtitle.trim()
    ? rawPlan.sessionSubtitle.trim()
    : (typeof rawPlan.subtitle === 'string' && rawPlan.subtitle.trim() ? rawPlan.subtitle.trim() : 'Structured work session');

  const tasks = Array.isArray(rawPlan.tasks)
    ? rawPlan.tasks.map((t, idx) => {
        if (!t || typeof t !== 'object') {
          return {
            id: `task_${Date.now()}_${idx}`,
            text: 'Focus Task',
            category: 'Deep Work',
            estimatedDuration: 25,
            pomodoroCount: 1,
            pomodoros: ['Focus Block'],
            status: 'Planned',
            completed: false
          };
        }

        const id = typeof t.id === 'string' && t.id.trim() ? t.id.trim() : `task_${Date.now()}_${idx}`;
        const text = typeof t.text === 'string' && t.text.trim() ? t.text.trim() : 'Focus Task';
        const taskType = typeof t.taskType === 'string' ? t.taskType : 'focus';
        const category = ['Deep Work', 'Administrative', 'Personal', 'Health', 'Errands', 'Appointments'].includes(t.category)
          ? t.category
          : 'Deep Work';

        const workCategory = ['Deep Work', 'Administrative', 'Personal', 'Health', 'Errands', 'Appointments'].includes(t.workCategory)
          ? t.workCategory
          : category;

        const validExecutionLabels = ['Deep Work', 'High Priority', 'Quick Win', 'Routine', 'Review', 'Admin', 'Low Focus', 'Break'];
        const executionLabel = validExecutionLabels.includes(t.executionLabel)
          ? t.executionLabel
          : (category === 'Administrative' ? 'Admin' : (validExecutionLabels.includes(category) ? category : 'Deep Work'));

        const executionPriority = ['High', 'Medium', 'Low'].includes(t.executionPriority)
          ? t.executionPriority
          : 'Medium';
        
        let pomodoros = [];
        if (taskType === 'focus') {
          pomodoros = Array.isArray(t.pomodoros)
            ? t.pomodoros.filter(p => typeof p === 'string' && p.trim())
            : [];
          if (pomodoros.length === 0) {
            pomodoros = [text];
          }
        }

        const pomodoroCount = taskType === 'focus'
          ? (typeof t.pomodoroCount === 'number' && t.pomodoroCount > 0 ? t.pomodoroCount : pomodoros.length)
          : 0;

        const estimatedDuration = typeof t.estimatedDuration === 'number' && t.estimatedDuration > 0
          ? t.estimatedDuration
          : (taskType === 'focus' ? pomodoroCount * 25 : 0);

        let pomodoroDurations = taskType === 'focus' ? (Array.isArray(t.pomodoroDurations) ? t.pomodoroDurations : null) : [];
        if (taskType === 'focus' && (!pomodoroDurations || pomodoroDurations.length !== pomodoroCount)) {
          const avg = Math.round(estimatedDuration / pomodoroCount);
          pomodoroDurations = Array(pomodoroCount).fill(avg);
        }

        const status = ['Planned', 'Ready', 'In Progress', 'Completed', 'Deferred', 'Skipped', 'Cancelled'].includes(t.status)
          ? t.status
          : 'Planned';

        const completed = typeof t.completed === 'boolean'
          ? t.completed
          : (status === 'Completed');

        return {
          id,
          text,
          completed,
          taskType,
          category,
          workCategory,
          executionLabel,
          executionPriority,
          estimatedDuration,
          pomodoroCount,
          pomodoroDurations,
          pomodoros,
          status
        };
      })
    : [];

  const suggestedPomodoros = typeof rawPlan.suggestedPomodoros === 'number' && rawPlan.suggestedPomodoros > 0
    ? rawPlan.suggestedPomodoros
    : tasks.reduce((sum, t) => sum + t.pomodoroCount, 0);

  const totalDuration = typeof rawPlan.totalDuration === 'number' && rawPlan.totalDuration > 0
    ? rawPlan.totalDuration
    : tasks.reduce((sum, t) => sum + t.estimatedDuration, 0);

  const playlistId = rawPlan.suggestedPlaylist && typeof rawPlan.suggestedPlaylist.id === 'string'
    ? rawPlan.suggestedPlaylist.id
    : (typeof rawPlan.playlistId === 'string' ? rawPlan.playlistId : 'f2');

  const suggestedPlaylist = {
    id: ['f1', 'f2', 'f3'].includes(playlistId) ? playlistId : 'f2'
  };

  const motivationalNote = typeof rawPlan.motivationalNote === 'string'
    ? rawPlan.motivationalNote
    : 'Let\'s stay focused and make progress.';

  return {
    sessionTitle,
    sessionSubtitle,
    tasks,
    totalDuration,
    suggestedPomodoros,
    suggestedPlaylist,
    motivationalNote
  };
}
