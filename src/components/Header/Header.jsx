import { memo, useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { playlists } from '../../data/mockData';
import styles from './Header.module.css';
import logo from '../../assets/zixovibes-logo.png';

const Header = memo(function Header({ mode = 'classic', onModeChange }) {
  const {
    hasOnboarded,
    resetSession,
    username,
    updateUsername,
    setActivePlaylist,
    setClassicIsPlaying,
    isAuthenticated,
    logout,
    // Search states
    searchOpen,
    setSearchOpen,
    searchQuery,
    setSearchQuery,
    highlightedSongId,
    setHighlightedSongId,
    // Music library
    songs,
    playlistsList,
    openedPlaylist,
    setOpenedPlaylist,
    playSong,
    playPlaylist,
    // Favorites states
    favoriteSongs,
    favoritePlaylists,
    recentlyPlayed,
    listeningHistory,
    focusHistory,
    // Deep Focus states
    setSelectedFocusPlaylist,
    setIsPlaying,
    notebookOpen,
    setNotebookOpen
  } = useApp();
  const isDeepFocus = mode === 'deepfocus';
  const showNav = !isDeepFocus || hasOnboarded;

  // Dropdown & Card States
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false); // for dropdown menu
  const [activeCard, setActiveCard] = useState(null); // null | 'profile' | 'activity' | 'settings'
  const [isCollapsing, setIsCollapsing] = useState(false); // for expanded card
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [expandedHelpIndex, setExpandedHelpIndex] = useState(null);
  const [showEmailDetails, setShowEmailDetails] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');

  // Favorites local state
  const [favoritesOpen, setFavoritesOpen] = useState(false);

  // Global song search local states
  const [localQuery, setLocalQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const avatarRef = useRef(null);
  const navRef = useRef(null);
  const collapseTimeoutRef1 = useRef(null);
  const collapseTimeoutRef2 = useRef(null);
  const cardTimeoutRef = useRef(null);
  const searchInputRef = useRef(null);
  const favoritesButtonRef = useRef(null);
  const favoritesDropdownRef = useRef(null);
  const searchWrapperRef = useRef(null);

  // Sync global searchQuery with local input
  useEffect(() => {
    setLocalQuery(searchQuery);
  }, [searchQuery]);

  // Debounce query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(localQuery);
    }, 150);
    return () => clearTimeout(handler);
  }, [localQuery]);

  // Close search dropdown on click outside
  useEffect(() => {
    const handleDocumentClick = (e) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target)) {
        // Clear local query so dropdown collapses
        setLocalQuery('');
      }
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

  // Helper search and rank algorithm
  const searchSuggestions = useMemo(() => {
    if (!debouncedQuery.trim()) return [];
    const term = debouncedQuery.trim().toLowerCase();
    
    const playlistNameMap = {};
    const sourcePlaylists = playlistsList.length > 0 ? playlistsList : playlists;
    sourcePlaylists.forEach(p => {
      playlistNameMap[p.id] = (p.title || p.name || '').toLowerCase();
    });
    
    const matches = [];
    songs.forEach(song => {
      if (!isDeepFocus && song.playlist === 'playlist_for_you') {
        return;
      }
      const title = (song.title || '').toLowerCase();
      const artist = (song.artist || '').toLowerCase();
      const playlistName = playlistNameMap[song.playlist] || '';
      
      let score = 0;
      if (title === term) {
        score = 100; // Exact match
      } else if (title.startsWith(term)) {
        score = 80;  // Starts-with match
      } else if (title.includes(term)) {
        score = 60;  // Partial match
      } else if (artist.includes(term)) {
        score = 40;  // Artist match
      } else if (playlistName.includes(term)) {
        score = 20;  // Playlist match
      }
      
      if (score > 0) {
        matches.push({ song, score });
      }
    });

    matches.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.song.title.localeCompare(b.song.title);
    });

    return matches.map(m => m.song).slice(0, 8);
  }, [debouncedQuery, songs, playlistsList, isDeepFocus]);

  const clearCollapseTimeouts = () => {
    if (collapseTimeoutRef1.current) clearTimeout(collapseTimeoutRef1.current);
    if (collapseTimeoutRef2.current) clearTimeout(collapseTimeoutRef2.current);
    if (cardTimeoutRef.current) clearTimeout(cardTimeoutRef.current);
  };

  useEffect(() => {
    return () => clearCollapseTimeouts();
  }, []);

  // Favorites dropdown click-outside & Escape key listener
  useEffect(() => {
    if (!favoritesOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setFavoritesOpen(false);
      }
    };

    const handleClickOutside = (e) => {
      if (
        favoritesButtonRef.current && !favoritesButtonRef.current.contains(e.target) &&
        favoritesDropdownRef.current && !favoritesDropdownRef.current.contains(e.target)
      ) {
        setFavoritesOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [favoritesOpen]);

  // Search input click-outside & Escape key listener
  useEffect(() => {
    if (!searchOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setSearchOpen(false);
        setSearchQuery('');
      }
    };

    const handleClickOutside = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setSearchOpen(false);
        setSearchQuery('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [searchOpen, setSearchOpen, setSearchQuery]);

  // Navigation handlers
  const handleHomeClick = () => {
    setSearchOpen(false);
    setSearchQuery('');
    setFavoritesOpen(false);
    setOpenedPlaylist(null);
    if (isDeepFocus) {
      setNotebookOpen(false);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFavoritesClick = () => {
    if (searchOpen) {
      setSearchOpen(false);
      setSearchQuery('');
      setTimeout(() => {
        setFavoritesOpen(true);
      }, 350); // allow search to collapse naturally (350ms transition)
    } else {
      setFavoritesOpen(prev => !prev);
    }
  };

  const handleSearchClick = () => {
    if (favoritesOpen) {
      setFavoritesOpen(false);
      setTimeout(() => {
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }, 180); // allow favorites dropdown to close first
    } else {
      if (searchOpen) {
        setSearchOpen(false);
        setSearchQuery('');
        setLocalQuery('');
      } else {
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    }
  };

  const handleSearchResultClick = (song) => {
    // 1. Close search dropdown & clear input
    setLocalQuery('');
    setSearchQuery('');
    setSearchOpen(false);

    // 2. Play the selected song immediately (automatically updates player & reveals vinyl peek)
    playSong(song);
  };

  const handlePlayFavorite = (item) => {
    if (item.songName || item.artist || item.filename) {
      playSong(item);
    } else {
      if (isDeepFocus) {
        setSelectedFocusPlaylist(item);
        setOpenedPlaylist(item);
        playPlaylist(item);
      } else {
        setOpenedPlaylist(item);
        playPlaylist(item);
      }
    }
    setFavoritesOpen(false);
  };

  const favoritePlaylistsMapped = useMemo(() => {
    return favoritePlaylists.map(entry => {
      if (!isDeepFocus && entry.playlistId === 'playlist_for_you') {
        return null;
      }
      const pl = playlistsList.find(p => p.id === entry.playlistId) || playlists.find(p => p.id === entry.playlistId);
      return pl ? { ...pl, artwork: pl.cover || pl.artwork, name: pl.title || pl.name } : null;
    }).filter(Boolean);
  }, [favoritePlaylists, playlistsList, isDeepFocus]);

  const favoriteSongsMapped = useMemo(() => {
    return favoriteSongs.map(entry => {
      const s = songs.find(x => x.id === entry.songId);
      if (!isDeepFocus && s && s.playlist === 'playlist_for_you') {
        return null;
      }
      return s ? { ...s, artwork: s.cover, songName: s.title, artist: s.artist } : null;
    }).filter(Boolean);
  }, [favoriteSongs, songs, isDeepFocus]);


  const toggleDropdown = (e) => {
    e.stopPropagation();
    if (isFadingOut || isCollapsing) return;
    if (dropdownOpen) {
      handleCloseDropdown();
    } else {
      clearCollapseTimeouts();
      setDropdownOpen(true);
      setIsFadingOut(false);
      setActiveCard(null);
      setIsCollapsing(false);
      setIsEditingName(false);
    }
  };

  const handleCloseCard = () => {
    if (isCollapsing) return;
    document.activeElement?.blur(); // Clear active focus state
    setIsCollapsing(true);

    if (cardTimeoutRef.current) clearTimeout(cardTimeoutRef.current);
    cardTimeoutRef.current = setTimeout(() => {
      setActiveCard(null);
      setIsCollapsing(false);
      setIsEditingName(false);
    }, 500); // 500ms collapse animation duration
  };

  const handleCloseDropdown = () => {
    clearCollapseTimeouts();
    if (activeCard) {
      // 1. Set isCollapsing to true immediately (card shrink, slide left behind dropdown)
      setIsCollapsing(true);

      // 2. After a 500ms delay, set isFadingOut to true (dropdown fade-out)
      collapseTimeoutRef1.current = setTimeout(() => {
        setIsFadingOut(true);
      }, 500);

      // 3. After a total of 680ms (500ms + 180ms dropdownClose duration), reset all states
      collapseTimeoutRef2.current = setTimeout(() => {
        setDropdownOpen(false);
        setIsFadingOut(false);
        setActiveCard(null);
        setIsCollapsing(false);
        setIsEditingName(false);
        avatarRef.current?.focus();
      }, 680);
    } else {
      // If no card is active, fade out dropdown immediately
      setIsFadingOut(true);
      collapseTimeoutRef2.current = setTimeout(() => {
        setDropdownOpen(false);
        setIsFadingOut(false);
        avatarRef.current?.focus();
      }, 180);
    }
  };

  const handleOpenCard = (cardType) => {
    if (isCollapsing) return; // Prevent switching while card is actively collapsing
    document.activeElement?.blur(); // Clear active focus state
    if (activeCard === cardType) {
      handleCloseCard();
    } else {
      setActiveCard(cardType);
      setIsCollapsing(false);
      setIsEditingName(false);
      setConfirmLogout(false);
    }
  };

  const handleLogout = () => {
    logout();
    handleCloseDropdown();
  };

  // Dropdown outside click and escape listener
  useEffect(() => {
    if (!dropdownOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCloseDropdown();
      }
    };

    const handleClickOutside = (e) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target)) {
        const menuEl = document.getElementById('profile-dropdown-menu');
        const cardEl = document.getElementById('profile-floating-card');
        if (menuEl && menuEl.contains(e.target)) return;
        if (cardEl && cardEl.contains(e.target)) return;
        handleCloseDropdown();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  // Calculate dynamic card scale ratios to fit dropdown footprint during collapse
  useEffect(() => {
    if (activeCard && dropdownOpen && !isCollapsing) {
      const timer = setTimeout(() => {
        const dropdownEl = document.getElementById('profile-dropdown-menu');
        const cardEl = document.getElementById('profile-floating-card');
        if (dropdownEl && cardEl) {
          const dw = dropdownEl.offsetWidth;
          const dh = dropdownEl.offsetHeight;
          const cw = cardEl.offsetWidth;
          const ch = cardEl.offsetHeight;
          
          if (cw > 0 && ch > 0) {
            cardEl.style.setProperty('--target-scale-x', dw / cw);
            cardEl.style.setProperty('--target-scale-y', dh / ch);
          }
        }
      }, 50); // Small delay to guarantee stable offset dimensions in DOM
      return () => clearTimeout(timer);
    }
  }, [activeCard, dropdownOpen, isCollapsing]);

  // Custom Close Button (Simple X, modern, top-right of card)
  const renderCloseBtn = (label) => (
    <button
      className={styles.closeBtn}
      onClick={handleCloseCard}
      aria-label={`Close ${label}`}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="1.5" y1="1.5" x2="10.5" y2="10.5" />
        <line x1="10.5" y1="1.5" x2="1.5" y2="10.5" />
      </svg>
    </button>
  );

  // Profile Card Renderer
  const renderProfileCard = () => {
    const handleEditClick = () => {
      setTempName(username);
      setIsEditingName(true);
    };

    const handleSaveName = () => {
      const trimmed = tempName.trim();
      if (trimmed.length > 0) {
        updateUsername(trimmed);
      }
      setIsEditingName(false);
    };

    const handleCancelEdit = () => {
      setIsEditingName(false);
    };

    return (
      <div key="profile" className={styles.cardContentWrapper}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Profile</span>
        </div>
        <div className={styles.profileSection}>
          <div className={styles.largeAvatar}>R</div>
          
          {isEditingName ? (
            <div className={styles.nameEditBlock}>
              <input
                type="text"
                className={styles.nameInput}
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') handleCancelEdit();
                }}
              />
              <div className={styles.editActions}>
                <button className={styles.saveBtn} onClick={handleSaveName}>Save</button>
                <button className={styles.cancelBtn} onClick={handleCancelEdit}>Cancel</button>
              </div>
            </div>
          ) : (
            <div className={styles.nameDisplayBlock}>
              <h4 className={styles.profileName}>{username}</h4>
              <button className={styles.editLinkBtn} onClick={handleEditClick}>
                Edit Name
              </button>
            </div>
          )}

          <div className={styles.profileDetailsQuiet}>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Member Since</span>
              <span className={styles.detailVal}>June 2026</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Current Mode</span>
              <span className={styles.detailVal}>{isDeepFocus ? 'Deep Focus' : 'Classic'}</span>
            </div>
          </div>

          <button 
            className={styles.detailsToggleBtn} 
            onClick={() => setShowEmailDetails(!showEmailDetails)}
          >
            {showEmailDetails ? 'Hide Details' : 'View Account Details'}
          </button>

          {showEmailDetails && (
            <div className={styles.expandedDetails}>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Email Address</span>
                <span className={styles.detailVal}>ravixxxxxx@gmail.com</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Joined Date</span>
                <span className={styles.detailVal}>June 24, 2026</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Account Info</span>
                <span className={styles.detailVal}>Premium Listener</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const formatTimeAgo = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  // Recently Played Card / Productivity History Renderer
  const renderActivityCard = () => {
    if (isDeepFocus) {
      return (
        <div key="activity" className={styles.cardContentWrapper}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>Focus History</span>
          </div>
          <div className={styles.recentSection}>
            <div className={styles.trackList}>
              {focusHistory.length === 0 ? (
                <div className={styles.emptyFavText} style={{ padding: '20px 0', textAlign: 'center', opacity: 0.6 }}>No completed sessions yet</div>
              ) : (
                focusHistory.map((item, idx) => {
                  const tasksCompletedCount = item.planner?.tasks?.filter(t => t.completed).length || 0;
                  const notesCount = item.notes?.length || 0;
                  const totalTasksCount = item.planner?.tasks?.length || 0;
                  const mins = Math.round((item.duration || 0) / 60);
                  const isFinished = item.completed;
                  return (
                    <div
                      key={idx}
                      className={styles.historyRow}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                    >
                      <div className={styles.historyMeta} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <span className={styles.historyTitle} style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>{item.planner?.sessionTitle || 'Focus Session'}</span>
                        <span className={styles.historyDetails} style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', marginTop: '2px' }}>
                          {isFinished ? 'Completed' : 'Interrupted'} • {mins}m • {tasksCompletedCount}/{totalTasksCount} Tasks • {notesCount} Notes
                        </span>
                      </div>
                      <span className={styles.historyDate} style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginLeft: '12px' }}>{formatTimeAgo(item.endedAt || item.startedAt)}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      );
    }

    const recentTracks = recentlyPlayed.map(item => {
      const s = songs.find(x => x.id === item.songId);
      return s ? {
        ...item,
        title: s.title,
        songObj: s
      } : null;
    }).filter(Boolean);

    return (
      <div key="activity" className={styles.cardContentWrapper}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Recent Activity</span>
        </div>
        <div className={styles.recentSection}>
          <div className={styles.recentScroll}>
            <div className={styles.trackList}>
              {recentTracks.length === 0 ? (
                <div className={styles.emptyFavText} style={{ padding: '20px 0', textAlign: 'center', opacity: 0.6 }}>No tracks played yet</div>
              ) : (
                recentTracks.map((item, idx) => {
                  return (
                    <button
                      key={idx}
                      className={styles.trackRow}
                      onClick={() => playSong(item.songObj)}
                      style={{ padding: '8px 12px' }}
                    >
                      <div className={styles.trackMeta}>
                        <span className={styles.trackName} style={{ fontSize: '13px', fontWeight: 500 }}>{item.title}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Settings Card Renderer
  const renderSettingsCard = () => {
    return (
      <div key="settings" className={styles.cardContentWrapper}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Settings</span>
        </div>
        <div className={styles.settingsSection}>
          {confirmLogout ? (
            <div className={styles.logoutConfirmationInline}>
              <p className={styles.confirmTextQuiet}>
                Are you sure you want to log out?
              </p>
              <div className={styles.confirmActionsInline}>
                <button
                  className={styles.cancelLogoutBtnInline}
                  onClick={() => setConfirmLogout(false)}
                >
                  Cancel
                </button>
                <button
                  className={styles.confirmLogoutBtnInline}
                  onClick={handleLogout}
                >
                  Log Out
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Help & Guide */}
              <div className={styles.settingItemQuiet}>
                <span className={styles.settingLabelQuiet}>Help & Guide</span>
                <div className={styles.accordionQuiet}>
                  {[
                    {
                      q: 'How Classic Mode Works',
                      a: 'Click the central vinyl record to play or pause. Switch playlists or adjust the volume with adjacent deck controls.'
                    },
                    {
                      q: 'How Deep Focus Works',
                      a: 'Set a goal, follow structured focus and break intervals, track tasks, and maintain study flow.'
                    },
                    {
                      q: 'Keyboard Shortcuts',
                      a: 'Spacebar: Toggle play/pause music. Escape: Close open cards and dropdown menus.'
                    }
                  ].map((item, idx) => {
                    const isHelpExpanded = expandedHelpIndex === idx;
                    return (
                      <div key={idx} className={styles.accordionItemQuiet}>
                        <button
                          className={styles.accordionHeaderQuiet}
                          onClick={() => setExpandedHelpIndex(isHelpExpanded ? null : idx)}
                          aria-expanded={isHelpExpanded}
                        >
                          <span>{item.q}</span>
                          <span>{isHelpExpanded ? '▲' : '▼'}</span>
                        </button>
                        {isHelpExpanded && (
                          <p className={styles.accordionBodyQuiet}>{item.a}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* About Zix'Ovibes */}
              <div className={styles.settingItemQuiet}>
                <span className={styles.settingLabelQuiet}>About Zix'Ovibes</span>
                <div className={styles.aboutCardQuiet}>
                  <span className={styles.aboutVersionQuiet}>Version 1.0.0</span>
                  <p className={styles.aboutTextQuiet}>
                    Premium ambient music and focus platform crafted for relaxation, productivity, and immersive listening.
                  </p>
                </div>
              </div>

              {/* Log Out */}
              {isAuthenticated && (
                <button
                  className={styles.logoutBtnClassic}
                  onClick={() => setConfirmLogout(true)}
                >
                  Log Out
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <header className={`${styles.header} ${isDeepFocus ? styles.deepFocus : ''}`}>
      {/* Left: Branding */}
      <div className={styles.branding}>
        <div className={styles.avatarContainer}>
          <button
            className={`${styles.avatar} ${isDeepFocus ? styles.avatarDf : ''}`}
            onClick={toggleDropdown}
            ref={avatarRef}
            aria-label="Open User Menu"
            aria-haspopup="true"
            aria-expanded={dropdownOpen}
          >
            <span>{isAuthenticated ? (username ? username[0].toUpperCase() : 'R') : 'U'}</span>
          </button>

          {/* Profile Dropdown Menu Card */}
          {dropdownOpen && (
            <div
              id="profile-dropdown-menu"
              className={`${styles.dropdownMenu} ${isDeepFocus ? styles.dropdownMenuDf : ''} ${isFadingOut ? styles.fadeOut : ''} ${activeCard && !isCollapsing ? styles.hasActiveCard : ''} ${isCollapsing ? styles.cardCollapsing : ''}`}
              role="menu"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className={`${styles.dropdownInner} ${isDeepFocus ? styles.dropdownInnerDf : ''}`}>
                {!isAuthenticated ? (
                  <>
                    <div className={styles.dropdownHeader}>
                      <span className={styles.username}>Guest User</span>
                    </div>
                    <div className={styles.divider} />
                    <button
                      className={styles.menuItem}
                      role="menuitem"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCloseDropdown();
                        onModeChange?.('auth');
                      }}
                    >
                      Sign In / Create Account
                    </button>
                    <button
                      className={styles.menuItem}
                      role="menuitem"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCard('settings');
                      }}
                    >
                      Settings
                    </button>
                  </>
                ) : (
                  <>
                    <div className={styles.dropdownHeader}>
                      <span className={styles.username}>{username}</span>
                    </div>
                    <div className={styles.divider} />
                    <button
                      className={styles.menuItem}
                      role="menuitem"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCard('profile');
                      }}
                    >
                      Profile
                    </button>
                    <button
                      className={styles.menuItem}
                      role="menuitem"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCard('activity');
                      }}
                    >
                      Recent Activity
                    </button>
                    <button
                      className={styles.menuItem}
                      role="menuitem"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCard('settings');
                      }}
                    >
                      Settings
                    </button>
                  </>
                )}
              </div>

              {/* Floating Card inside Dropdown Menu */}
              {activeCard && (
                <div
                  id="profile-floating-card"
                  className={`${styles.floatingCard} ${isDeepFocus ? styles.floatingCardDf : ''} ${isCollapsing ? styles.collapsing : ''}`}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {renderCloseBtn(activeCard)}
                  {activeCard === 'profile' && renderProfileCard()}
                  {activeCard === 'activity' && renderActivityCard()}
                  {activeCard === 'settings' && renderSettingsCard()}
                </div>
              )}
            </div>
          )}
        </div>

        <div className={styles.logoArea}>
          <img src={logo} alt="Zix'Ovibes" className={styles.logoImg} draggable="false" />
          {isDeepFocus && (
            <span className={styles.tagline}>Focus. Flow. Finish.</span>
          )}
        </div>
      </div>

      {/* Center: Navigation */}
      {showNav && (
        <nav 
          ref={navRef}
          className={`${styles.nav} ${isDeepFocus ? styles.navDf : ''} ${searchOpen ? styles.searchActive : ''}`}
        >
          {/* Home Button */}
          <button 
            className={`${styles.navBtn} ${isDeepFocus ? styles.navBtnDf : ''} ${isDeepFocus && !searchOpen && !favoritesOpen ? styles.activeNavDf : ''}`} 
            aria-label="Home"
            onClick={handleHomeClick}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </button>

          {/* Search Button / Input */}
          <div 
            ref={searchWrapperRef}
            className={`${styles.searchWrapper} ${isDeepFocus ? styles.searchWrapperDf : ''}`}
          >
            <button 
              className={`${styles.navBtn} ${isDeepFocus ? styles.navBtnDf : ''} ${styles.searchIconBtn}`} 
              aria-label="Search"
              onClick={handleSearchClick}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
            <input
              ref={searchInputRef}
              type="text"
              className={`${styles.searchInput} ${isDeepFocus ? styles.searchInputDf : ''} ${searchOpen ? styles.expanded : ''}`}
              placeholder="Search your favorite music..."
              value={localQuery}
              onChange={(e) => {
                setLocalQuery(e.target.value);
                setSearchQuery(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearchOpen(false);
                  setSearchQuery('');
                  setLocalQuery('');
                }
              }}
            />

            {/* Spotify-style Floating Dropdown */}
            {searchOpen && localQuery.trim() !== '' && (
              <div className={`${styles.searchDropdown} hide-scrollbar`}>
                {searchSuggestions.length > 0 ? (
                  searchSuggestions.map((song) => {
                    const pl = playlistsList.find(p => p.id === song.playlist) || playlists.find(p => p.id === song.playlist);
                    const plTitle = pl ? (pl.title || pl.name) : '';
                    return (
                      <div
                        key={song.id}
                        className={styles.searchResultRow}
                        onClick={() => handleSearchResultClick(song)}
                      >
                        <img
                          src={song.cover || '/playlist-covers/sleep.jpg'}
                          alt={song.title}
                          className={styles.searchResultThumb}
                          onError={(e) => { e.target.src = '/playlist-covers/sleep.jpg'; }}
                          draggable="false"
                        />
                        <div className={styles.searchResultMeta}>
                          <span className={styles.searchResultTitle} title={song.title}>
                            {song.title}
                          </span>
                          <span className={styles.searchResultArtist} title={song.artist}>
                            {song.artist}
                          </span>
                          {plTitle && (
                            <span className={styles.searchResultPlaylist} title={plTitle}>
                              {plTitle}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className={styles.searchEmptyState}>
                    No songs found
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Favorites Button / Dropdown */}
          <div className={styles.favoritesContainer}>
            <button 
              ref={favoritesButtonRef}
              className={`${styles.navBtn} ${isDeepFocus ? styles.navBtnDf : ''}`} 
              aria-label="Favorites"
              onClick={handleFavoritesClick}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
            {favoritesOpen && (
              <div 
                ref={favoritesDropdownRef}
                className={`${styles.favoritesDropdown} ${isDeepFocus ? styles.favoritesDropdownDf : ''}`}
              >
                <div className={`${styles.favDropdownInner} ${isDeepFocus ? styles.favDropdownInnerDf : ''}`}>
                  <div className={styles.favSection}>
                    <div className={`${styles.favSectionTitle} ${isDeepFocus ? styles.favSectionTitleDf : ''}`}>Favorite Playlists</div>
                    {favoritePlaylistsMapped.length === 0 ? (
                      <div className={`${styles.emptyFavText} ${isDeepFocus ? styles.emptyFavTextDf : ''}`}>No favorite playlists yet</div>
                    ) : (
                      favoritePlaylistsMapped.map(pl => (
                        <button 
                          key={pl.id} 
                          className={`${styles.favItem} ${isDeepFocus ? styles.favItemDf : ''}`}
                          onClick={() => handlePlayFavorite(pl)}
                        >
                          <img src={pl.artwork} className={styles.favThumb} alt="" draggable="false" />
                          <span className={`${styles.favName} ${isDeepFocus ? styles.favNameDf : ''}`}>{pl.name}</span>
                        </button>
                      ))
                    )}
                  </div>
                  
                  <div className={`${styles.favDivider} ${isDeepFocus ? styles.favDividerDf : ''}`} />
                  
                  <div className={styles.favSection}>
                    <div className={`${styles.favSectionTitle} ${isDeepFocus ? styles.favSectionTitleDf : ''}`}>Favorite Songs</div>
                    <div className={styles.favSongsScroll}>
                      {favoriteSongsMapped.length === 0 ? (
                        <div className={`${styles.emptyFavText} ${isDeepFocus ? styles.emptyFavTextDf : ''}`}>No liked songs yet</div>
                      ) : (
                        favoriteSongsMapped.map(song => (
                          <button 
                            key={song.id} 
                            className={`${styles.favItem} ${isDeepFocus ? styles.favItemDf : ''}`}
                            onClick={() => handlePlayFavorite(song)}
                          >
                            <img src={song.artwork} className={styles.favThumb} alt="" draggable="false" />
                            <div className={styles.favMeta}>
                              <span className={`${styles.favSongName} ${isDeepFocus ? styles.favSongNameDf : ''}`}>{song.songName}</span>
                              <span className={`${styles.favArtist} ${isDeepFocus ? styles.favArtistDf : ''}`}>{song.artist}</span>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </nav>
      )}

      {/* Right: Mode Switch */}
      <div className={styles.modeSwitch}>
        <button
          className={`${styles.modeBtn} ${!isDeepFocus ? styles.active : ''}`}
          onClick={() => onModeChange?.('classic')}
        >
          CLASSIC
        </button>
        <button
          className={`${styles.modeBtn} ${isDeepFocus ? styles.activeDf : ''}`}
          onClick={() => onModeChange?.('deepfocus')}
        >
          DEEP FOCUS
        </button>
      </div>

      {/* Lampshade Background Dimming Overlay */}
      {dropdownOpen && (
        <div
          className={`${styles.lampshadeOverlay} ${isFadingOut ? styles.fadeOut : ''}`}
          onClick={handleCloseDropdown}
        />
      )}
    </header>
  );
});

export default Header;
