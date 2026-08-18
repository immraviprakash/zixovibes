import { useState, useEffect, useRef, memo } from 'react';
import { API_BASE, fetchWithTimeoutAndRetry } from '../../config/api';
import { useApp } from '../../context/AppContext';
import { auth, db } from '../../firebase/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import styles from './MoodInput.module.css';

const MoodInput = memo(function MoodInput() {
  const {
    songs,
    playlistsList,
    currentSong,
    activePlaylist,
    isPlaying,
    elapsed,
    volume,
    favoritePlaylists,
    favoriteSongs,
    recentlyPlayed,
    playSong,
    playPlaylist,
    setIsPlaying,
    displayName,
    username,
    userInitial
  } = useApp();

  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [thinkingText, setThinkingText] = useState('Thinking...');
  const [errorMsg, setErrorMsg] = useState(null);

  const containerRef = useRef(null);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const abortControllerRef = useRef(null);

  const currentUser = auth.currentUser;
  const userId = currentUser ? currentUser.uid : 'guest';

  // Compute user avatar initial: derived purely from username (NOT displayName)
  const computedUserInitial = userInitial || (() => {
    if (username && typeof username === 'string') {
      const trimmed = username.trim();
      if (trimmed && trimmed !== 'Guest User') {
        return trimmed.charAt(0).toUpperCase();
      }
    }
    return 'U';
  })();

  // Load conversation history on mount or when user shifts login states
  useEffect(() => {
    if (userId !== 'guest') {
      const loadHistory = async () => {
        try {
          const docRef = doc(db, 'users', userId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            const messagesList = data.ai?.classicConversation?.messages || [];
            setMessages(messagesList);
          } else {
            setMessages([]);
          }
        } catch (err) {
          console.error('[Classic AI] Failed to load chat history from Firestore:', err);
        }
      };
      loadHistory();
    } else {
      const saved = localStorage.getItem('zixovibes_guest_chat');
      if (saved) {
        try {
          setMessages(JSON.parse(saved));
        } catch (e) {
          setMessages([]);
        }
      } else {
        setMessages([]);
      }
    }
  }, [userId]);

  // Scroll to bottom on new messages or thinking transitions
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, isExpanded]);

  // Handle outside clicks to collapse the panel smoothly
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleClearChat = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setErrorMsg(null);
    setInputValue(''); // Clear any unsent text currently in the input field

    if (userId !== 'guest') {
      try {
        const docRef = doc(db, 'users', userId);
        await setDoc(docRef, {
          ai: {
            classicConversation: {
              messages: []
            }
          }
        }, { merge: true });
        setMessages([]);
      } catch (err) {
        console.error('[Classic AI] Clear error:', err);
        setErrorMsg('Failed to clear conversation in database.');
      }
    } else {
      localStorage.removeItem('zixovibes_guest_chat');
      setMessages([]);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    setErrorMsg(null);
    const userMsgText = inputValue.trim();
    setInputValue('');
    setIsExpanded(true);

    // Cancel in-flight duplicate requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // Optimistically update local message list
    const tempUserMsg = { sender: 'user', message: userMsgText, timestamp: new Date().toISOString() };
    const historyBeforeRequest = [...messages, tempUserMsg];
    setMessages(historyBeforeRequest);
    setIsLoading(true);
    setThinkingText('Thinking...');

    let secondsElapsed = 0;
    const interval = setInterval(() => {
      secondsElapsed += 1;
      if (secondsElapsed >= 2) {
        setThinkingText("Warming up Bro...");
      }
    }, 1000);

    // Build structured state context payload (no server-side asset reading)
    const structuredPayload = {
      mode: 'classic',
      userId,
      userMessage: userMsgText,
      localHistory: messages,
      library: {
        playlists: playlistsList || [],
        songs: songs || []
      },
      context: {
        currentSong: currentSong || null,
        currentPlaylist: activePlaylist || null,
        isPlaying,
        elapsed,
        volume,
        favorites: {
          playlists: (favoritePlaylists || []).map(fp => fp.playlistId),
          songs: (favoriteSongs || []).map(fs => fs.songId)
        },
        recentlyPlayed: recentlyPlayed || []
      }
    };

    try {
      const response = await fetchWithTimeoutAndRetry(
        `${API_BASE}/api/ai/chat`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(structuredPayload),
          signal: abortControllerRef.current.signal
        },
        5000,
        0
      );
      if (!response.ok) {
        let errMsg = `Server returned ${response.status}`;
        try {
          const errData = await response.json();
          if (errData.error) errMsg = errData.error;
        } catch (_) {}
        throw new Error(errMsg);
      }

      const data = await response.json();
      if (data.history) {
        setMessages(data.history);
        if (userId === 'guest') {
          localStorage.setItem('zixovibes_guest_chat', JSON.stringify(data.history));
        } else {
          try {
            const docRef = doc(db, 'users', userId);
            await setDoc(docRef, {
              ai: {
                classicConversation: {
                  messages: data.history
                }
              }
            }, { merge: true });
          } catch (e) {
            console.error('[Classic AI] Failed to save chat history to Firestore:', e);
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        return;
      }
      let message = "Bro is taking a quick moment to chill. Please try asking again in a second!";
      if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('Network failure') || err.message.includes('timed out') || err.message.includes('abort'))) {
        message = 'Connection error: Bro is taking a moment to reconnect. Please try again.';
      } else if (err.message && !err.message.includes('Server returned') && !err.message.includes('500') && !err.message.includes('502') && !err.message.includes('503') && !err.message.includes('404') && !err.message.includes('Error (')) {
        message = err.message;
      }
      setErrorMsg(message);
    } finally {
      clearInterval(interval);
      setIsLoading(false);
    }
  };

  const handleInputFocus = () => {
    setIsExpanded(true);
  };

  const handleKeyDown = (e) => {
    // Send message on Enter without shift key, allow new lines with Shift+Enter
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  // Adjust textarea height dynamically up to 2 lines max
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      // Cap height to 44px (approx 2 lines including padding)
      if (scrollHeight > 24) {
        textareaRef.current.style.height = `${Math.min(scrollHeight, 44)}px`;
        textareaRef.current.style.overflowY = scrollHeight > 44 ? 'auto' : 'hidden';
      } else {
        textareaRef.current.style.height = '20px';
        textareaRef.current.style.overflowY = 'hidden';
      }
    }
  }, [inputValue]);

  // Scans message text for matching songs or playlists in library to render as cards
  const detectRecommendations = (text) => {
    const recommendedSongs = [];
    const recommendedPlaylists = [];

    if (!text || !songs || !playlistsList) {
      return { songs: [], playlists: [] };
    }

    // Scan songs catalog
    songs.forEach(song => {
      if (!song.title) return;
      if (song.playlist === 'playlist_for_you') return;
      const titleEscaped = song.title.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`\\b${titleEscaped}\\b`, 'i');
      if (regex.test(text)) {
        if (!recommendedSongs.some(s => s.id === song.id)) {
          recommendedSongs.push(song);
        }
      }
    });

    // Scan playlists catalog
    playlistsList.forEach(playlist => {
      if (!playlist.title) return;
      if (playlist.id === 'playlist_for_you') return;
      const titleEscaped = playlist.title.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`\\b${titleEscaped}\\b`, 'i');
      if (regex.test(text)) {
        if (!recommendedPlaylists.some(p => p.id === playlist.id)) {
          recommendedPlaylists.push(playlist);
        }
      }
    });

    return { songs: recommendedSongs, playlists: recommendedPlaylists };
  };

  // Sanitizes any raw markdown artifacts to ensure clean, conversational UI presentation
  const cleanMessageText = (text) => {
    if (!text || typeof text !== 'string') return '';
    let cleaned = text;
    // 1. Remove markdown code fences and backticks
    cleaned = cleaned.replace(/```[\s\S]*?```/g, (match) => {
      return match.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '');
    });
    cleaned = cleaned.replace(/`([^`]+)`/g, '$1');
    // 2. Remove markdown table separator lines (|---|---| or ||---||)
    cleaned = cleaned.replace(/^\s*\|?[\s\-:|]+\|?\s*$/gm, '');
    // 3. Convert table rows to readable bullet lines
    cleaned = cleaned.replace(/^\s*\|\s*([^|\n]+?)\s*\|\s*([^|\n]+?)\s*\|\s*$/gm, '• $1: $2');
    cleaned = cleaned.replace(/^\s*\|(.*)\|\s*$/gm, (match, inner) => {
      const cells = inner.split('|').map(c => c.trim()).filter(Boolean);
      if (cells.length === 0) return '';
      if (cells.length === 1) return `• ${cells[0]}`;
      return `• ${cells[0]}: ${cells.slice(1).join(' - ')}`;
    });
    // 4. Strip header hashes (# Header -> Header)
    cleaned = cleaned.replace(/^#{1,6}\s+(.*)$/gm, '$1');
    // 5. Convert bold/italic syntax (**text**, *text*, __text__, _text_)
    cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
    cleaned = cleaned.replace(/__([^_]+)__/g, '$1');
    // 6. Convert bullet asterisks or hyphens at start of lines (* item or - item -> • item)
    cleaned = cleaned.replace(/^[\s]*[*-]\s+/gm, '• ');
    // 7. Strip leftover stray pipe characters at edges
    cleaned = cleaned.replace(/^\s*\|+|\s*\|+$/gm, '');
    // 8. Normalize multiple empty lines
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    return cleaned.trim();
  };

  const playSongAndActivate = (song) => {
    // Leverage the global audio player playSong from AppContext
    playSong(song);
  };

  return (
    <div 
      ref={containerRef} 
      className={`${styles.moodSection} ${isExpanded ? styles.expanded : ''}`}
    >
      <div className={`${styles.inputWrap} ${isExpanded ? styles.inputWrapExpanded : ''}`}>
        <h3 className={styles.heading}>How's your mood today?</h3>
        
        <div className={styles.chatArea}>
          <div className={styles.chatAreaInner}>
            <div className={styles.chatHeader}>
              <span className={styles.companionVibe}>Bro</span>
              {messages.length > 0 && (
                <button 
                  className={styles.clearBtn} 
                  onClick={handleClearChat}
                  title="Clear conversation"
                >
                  Clear
                </button>
              )}
            </div>

            <div ref={scrollRef} className={`${styles.messageList} hide-scrollbar`}>
              {messages.length === 0 ? (
                <div className={styles.emptyState}>
                  Tell Bro how you feel or ask for a playlist suggestion...
                </div>
              ) : (
                messages.map((msg, i) => {
                  const { songs: recSongs, playlists: recPlaylists } = detectRecommendations(msg.message);
                  return (
                    <div 
                      key={i} 
                      className={`${styles.messageBubbleRow} ${msg.sender === 'user' ? styles.userRow : styles.aiRow}`}
                    >
                      <div className={styles.avatar}>
                        {msg.sender === 'user' ? computedUserInitial : 'Z'}
                      </div>
                      <div className={styles.messageContainer}>
                        <div className={styles.messageBubble}>
                          <p className={styles.messageText}>{cleanMessageText(msg.message)}</p>
                        </div>

                        {/* Renders interactive preview cards for recommended items */}
                        {msg.sender === 'ai' && (recSongs.length > 0 || recPlaylists.length > 0) && (
                          <div className={styles.recommendationsList}>
                            {recSongs.map(song => {
                              const isCurrentPlayingSong = isPlaying && currentSong?.id === song.id;
                              return (
                                <div key={song.id} className={styles.recCard}>
                                  <img 
                                    src={song.cover || '/assets/default-cover.jpg'} 
                                    alt={song.title} 
                                    className={styles.recCover} 
                                  />
                                  <div className={styles.recInfo}>
                                    <span className={styles.recTitle}>{song.title}</span>
                                    <span className={styles.recArtist}>{song.artist}</span>
                                  </div>
                                  <button 
                                    className={`${styles.recPlayBtn} ${isCurrentPlayingSong ? styles.recPlaying : ''}`}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      if (isCurrentPlayingSong) {
                                        setIsPlaying(false);
                                      } else {
                                        if (currentSong?.id === song.id) {
                                          setIsPlaying(true);
                                        } else {
                                          playSongAndActivate(song);
                                        }
                                      }
                                    }}
                                    title={isCurrentPlayingSong ? `Pause ${song.title}` : `Play ${song.title}`}
                                  >
                                    {isCurrentPlayingSong ? (
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                                        <rect x="5" y="4" width="4" height="16" />
                                        <rect x="15" y="4" width="4" height="16" />
                                      </svg>
                                    ) : (
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                                        <polygon points="5 3 19 12 5 21 5 3" />
                                      </svg>
                                    )}
                                  </button>
                                </div>
                              );
                            })}

                            {recPlaylists.map(pl => {
                              const plSongs = songs.filter(s => s.playlist === pl.id);
                              const isCurrentPlayingPlaylist = isPlaying && activePlaylist?.id === pl.id;
                              return (
                                <div key={pl.id} className={styles.recCard}>
                                  <img 
                                    src={pl.cover || '/playlist-covers/default.jpg'} 
                                    alt={pl.title} 
                                    className={styles.recCover} 
                                  />
                                  <div className={styles.recInfo}>
                                    <span className={styles.recTitle}>{pl.title}</span>
                                    <span className={styles.recArtist}>Playlist • {plSongs.length} songs</span>
                                  </div>
                                  <button 
                                    className={`${styles.recPlayBtn} ${isCurrentPlayingPlaylist ? styles.recPlaying : ''}`}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      if (isCurrentPlayingPlaylist) {
                                        setIsPlaying(false);
                                      } else {
                                        if (activePlaylist?.id === pl.id) {
                                          setIsPlaying(true);
                                        } else {
                                          playPlaylist(pl);
                                        }
                                      }
                                    }}
                                    title={isCurrentPlayingPlaylist ? `Pause ${pl.title}` : `Play ${pl.title}`}
                                  >
                                    {isCurrentPlayingPlaylist ? (
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                                        <rect x="5" y="4" width="4" height="16" />
                                        <rect x="15" y="4" width="4" height="16" />
                                      </svg>
                                    ) : (
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                                        <polygon points="5 3 19 12 5 21 5 3" />
                                      </svg>
                                    )}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              {isLoading && (
                <div className={`${styles.messageBubbleRow} ${styles.aiRow}`}>
                  <div className={styles.avatar}>Z</div>
                  <div className={styles.messageContainer}>
                    <div className={`${styles.messageBubble} ${styles.thinkingBubble}`}>
                      <span className={styles.thinkingText}>{thinkingText}</span>
                    </div>
                  </div>
                </div>
              )}
              {errorMsg && (
                <div className={styles.errorNotice}>{errorMsg}</div>
              )}
            </div>
          </div>
        </div>

        <form onSubmit={handleSendMessage} className={`${styles.inputForm} ${isExpanded ? styles.inputFormExpanded : ''}`}>
          <textarea
            ref={textareaRef}
            placeholder="Describe your vibe..."
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setIsExpanded(true);
            }}
            onKeyDown={handleKeyDown}
            onFocus={handleInputFocus}
            className={styles.input}
            aria-label="Bro chat input"
            rows={1}
          />
          <button 
            type="submit"
            className={styles.chatBtn} 
            aria-label="Send message"
            disabled={!inputValue.trim() && !isLoading}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
});

export default MoodInput;
