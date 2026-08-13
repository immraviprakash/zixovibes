import fs from 'fs';
import path from 'path';

const SYSTEM_PROMPT_PATH = path.join(import.meta.dirname, 'system_prompt.txt');

// Keep cached copy of system prompt text, fallback if file read fails
let cachedSystemPrompt = '';

try {
  cachedSystemPrompt = fs.readFileSync(SYSTEM_PROMPT_PATH, 'utf-8');
} catch (err) {
  console.warn('[Prompt Builder v1] Warning: system_prompt.txt could not be pre-loaded.', err);
}

/**
 * Builds a structured, isolated messages array for the LLM context.
 * 
 * @param {Array} history - Pre-loaded message history.
 * @param {string} userMessage - The latest message text.
 * @param {Object} appContext - Frontend application context (library, playback, favorites).
 * @returns {Array} - Array of role/content message objects.
 */
export function buildPrompt(history, userMessage, appContext = {}) {
  // Reload prompt from file to allow dynamic edits during dev (with cache fallback)
  let systemPrompt = cachedSystemPrompt;
  try {
    systemPrompt = fs.readFileSync(SYSTEM_PROMPT_PATH, 'utf-8');
  } catch (err) {
    if (!systemPrompt) {
      systemPrompt = 'You are the calm, companion AI for Zix\'Ovibes.';
    }
  }

  // Format context cleanly as a separate system-role layer
  const playbackState = appContext.context || {};
  const libraryCatalog = appContext.library || { playlists: [], songs: [] };

  // Filter songs to prevent exceeding Groq TPM (Tokens Per Minute) limit for free tiers
  const currentPlaylistId = playbackState.currentPlaylist?.id;
  const favoriteSongIds = new Set(playbackState.favorites?.songs || []);
  const filteredSongs = [];
  const songsPerPlaylistCount = {};

  (libraryCatalog.songs || []).forEach(s => {
    // 1. Keep if in current active playlist
    if (currentPlaylistId && s.playlist === currentPlaylistId) {
      filteredSongs.push(s);
      return;
    }
    // 2. Keep if favorited
    if (favoriteSongIds.has(s.id)) {
      filteredSongs.push(s);
      return;
    }
    // 3. Otherwise, keep a max of 5 sample songs per playlist
    const count = songsPerPlaylistCount[s.playlist] || 0;
    if (count < 5) {
      filteredSongs.push(s);
      songsPerPlaylistCount[s.playlist] = count + 1;
    }
  });

  const formattedContext = {
    mode: appContext.mode || 'classic',
    isPlaying: playbackState.isPlaying || false,
    currentSong: playbackState.currentSong || null,
    currentPlaylist: playbackState.currentPlaylist || null,
    elapsed: playbackState.elapsed || '00:00',
    volume: playbackState.volume || 0.8,
    favorites: playbackState.favorites || { playlists: [], songs: [] },
    recentlyPlayed: playbackState.recentlyPlayed || [],
    availableLibrary: {
      playlists: (libraryCatalog.playlists || []).map(p => ({ id: p.id, title: p.title, description: p.description })),
      songs: filteredSongs.map(s => ({ id: s.id, title: s.title, artist: s.artist, playlist: s.playlist }))
    }
  };

  const messages = [
    {
      role: 'system',
      content: systemPrompt
    },
    {
      role: 'system',
      content: `Current Application Context:\n${JSON.stringify(formattedContext, null, 2)}`
    }
  ];

  // Append history (only include the most recent 7 exchanges / 14 messages to prevent token limits overflow)
  const slidingHistory = history.slice(-14);
  slidingHistory.forEach(msg => {
    messages.push({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.message
    });
  });

  // Append latest user message
  messages.push({
    role: 'user',
    content: userMessage
  });

  return messages;
}
