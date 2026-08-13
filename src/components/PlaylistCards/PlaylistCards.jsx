import { useState, memo, useCallback, useMemo, useRef, useEffect } from 'react';
import styles from './PlaylistCards.module.css';
import { playlists } from '../../data/mockData';
import vinylTexture from '../../assets/vinyl-texture.png';
import { useApp } from '../../context/AppContext';
import { auth, db } from '../../firebase/firebase';
import { doc, setDoc } from 'firebase/firestore';

const PlaylistCards = memo(function PlaylistCards({ activePlaylist }) {
  const {
    searchQuery = '',
    playlistsList = [],
    openedPlaylist,
    setOpenedPlaylist,
    setActivePlaylist,
    currentSong,
    classicIsPlaying: isPlaying,
    songs,
    playSong,
    playPlaylist,
    setIsShuffle,
    isPlaylistFavorited,
    toggleFavoritePlaylist,
    isAuthenticated,
    setShowGuestModal,
    announce,
    highlightedSongId,
    setHighlightedSongId,
    playbackActivated,
  } = useApp();

  const playlistStackRef = useRef(null);

  const sourcePlaylists = playlistsList.length > 0 ? playlistsList : playlists;

  const filteredPlaylists = useMemo(() => {
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
    const classicOrder = ['lofi', 'jazz', 'sleep', 'relax', 'ambience', 'rain'];
    return sourcePlaylists
      .filter((playlist) => {
        const canonId = normalizeId(playlist.id);
        return classicOrder.includes(canonId);
      })
      .sort((a, b) => {
        const indexA = classicOrder.indexOf(normalizeId(a.id));
        const indexB = classicOrder.indexOf(normalizeId(b.id));
        return indexA - indexB;
      });
  }, [sourcePlaylists]);

  // Smooth scroll positioning effect
  useEffect(() => {
    if (openedPlaylist && playlistStackRef.current) {
      const idx = filteredPlaylists.findIndex(p => p.id === openedPlaylist.id);
      if (idx >= 0) {
        const cardHeight = 220;
        const gapY = 60;
        const targetScrollTop = Math.max(0, idx * (cardHeight + gapY) - 20);
        
        const timer = setTimeout(() => {
          playlistStackRef.current.scrollTo({
            top: targetScrollTop,
            behavior: 'smooth'
          });
        }, 50);
        return () => clearTimeout(timer);
      }
    }
  }, [openedPlaylist, filteredPlaylists]);

  // Clear highlightedSongId after a delay to allow future scrolls
  useEffect(() => {
    if (highlightedSongId) {
      const timer = setTimeout(() => {
        setHighlightedSongId(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [highlightedSongId, setHighlightedSongId]);

  const handleCardClick = useCallback((playlist) => {
    if (openedPlaylist && openedPlaylist.id === playlist.id) {
      setOpenedPlaylist(null);
    } else {
      setOpenedPlaylist(playlist);
    }
  }, [openedPlaylist, setOpenedPlaylist]);

  const songsListRef = useRef(null);

  // Reset scroll position of song list when opened playlist changes
  useEffect(() => {
    if (openedPlaylist && songsListRef.current) {
      songsListRef.current.scrollTop = 0;
    }
  }, [openedPlaylist]);

  // Smooth, controlled scroll listener
  useEffect(() => {
    const container = songsListRef.current;
    if (!container) return;

    const handleWheel = (e) => {
      e.preventDefault();
      container.scrollTop += e.deltaY * 0.40;
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [openedPlaylist]);

  const formatTime = (s) => {
    const min = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  // Songs for the opened playlist
  const expandedSongs = useMemo(() => {
    if (!openedPlaylist) return [];
    return songs.filter(s => s.playlist === openedPlaylist.id);
  }, [openedPlaylist, songs]);

  const isFavorited = openedPlaylist ? isPlaylistFavorited(openedPlaylist.id) : false;

  const handlePlayClick = useCallback(() => {
    if (openedPlaylist) {
      playPlaylist(openedPlaylist);
    } else if (expandedSongs.length > 0) {
      playSong(expandedSongs[0]);
    }
  }, [openedPlaylist, expandedSongs, playPlaylist, playSong]);

  const handleShuffleClick = useCallback(() => {
    if (openedPlaylist) {
      playPlaylist(openedPlaylist, 0, true);
    } else if (expandedSongs.length > 0) {
      setIsShuffle(true);
      const randIndex = Math.floor(Math.random() * expandedSongs.length);
      playSong(expandedSongs[randIndex]);
    }
  }, [openedPlaylist, expandedSongs, playPlaylist, playSong, setIsShuffle]);

  const handleFavoriteToggle = useCallback(() => {
    if (!openedPlaylist) return;
    toggleFavoritePlaylist(openedPlaylist.id);
  }, [openedPlaylist, toggleFavoritePlaylist]);

  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const colsCount = useMemo(() => {
    if (windowWidth > 1400) return 3;
    if (windowWidth > 800) return 2;
    return 1;
  }, [windowWidth]);

  // Compute position coordinates for each card to allow smooth CSS transitions
  const cardPositions = useMemo(() => {
    const positions = {};
    const cardWidth = 180;
    const cardHeight = 220;
    const gapX = 60;
    const gapY = 60;

    if (!openedPlaylist) {
      // Grid mode: dynamic columns based on viewport width
      filteredPlaylists.forEach((playlist, idx) => {
        const col = idx % colsCount;
        const row = Math.floor(idx / colsCount);
        positions[playlist.id] = {
          x: col * (cardWidth + gapX),
          y: row * (cardHeight + gapY)
        };
      });
    } else {
      // Stack mode: all playlists keep their original index order (no reordering)
      filteredPlaylists.forEach((playlist, idx) => {
        positions[playlist.id] = {
          x: 0,
          y: idx * (cardHeight + gapY)
        };
      });
    }
    return positions;
  }, [filteredPlaylists, openedPlaylist, colsCount]);

  // Dynamic height of the relative cards container to push any content below it naturally
  const containerHeight = useMemo(() => {
    const cardHeight = 220;
    const gapY = 60;
    if (!openedPlaylist) {
      const rowsCount = Math.ceil(filteredPlaylists.length / colsCount);
      return rowsCount * (cardHeight + gapY) - gapY;
    } else {
      return filteredPlaylists.length * (cardHeight + gapY) - gapY;
    }
  }, [filteredPlaylists, openedPlaylist, colsCount]);

  // Calculate the y coordinate of the opened playlist in the stack to align the unfold animation
  const unfoldY = useMemo(() => {
    if (!openedPlaylist) return 0;
    const idx = filteredPlaylists.findIndex(p => p.id === openedPlaylist.id);
    return idx >= 0 ? idx * 280 : 0;
  }, [openedPlaylist, filteredPlaylists]);

  if (filteredPlaylists.length === 0) {
    return (
      <div className={styles.noResults}>
        <h3 className={styles.noResultsTitle}>No results found</h3>
        <p className={styles.noResultsSubtitle}>Try searching for another song, artist, or playlist</p>
      </div>
    );
  }

  return (
    <div className={`${styles.playlistBrowser} ${openedPlaylist ? styles.expanded : ''}`}>
      {/* Left/Middle: Playlist Browser Stack with Absolute Positioned Cards */}
      <div 
        ref={playlistStackRef}
        className={`${styles.playlistStack} hide-scrollbar`}
        style={{ height: openedPlaylist ? '100%' : `${containerHeight}px` }}
      >
        <div 
          className={styles.cardsContainer} 
          style={{ height: `${containerHeight}px` }}
        >
          {filteredPlaylists.map((playlist) => {
            const isExpanded = openedPlaylist && openedPlaylist.id === playlist.id;
            const isPlayingCurrent = activePlaylist && activePlaylist.id === playlist.id && isPlaying;
            const title = playlist.title || playlist.name;
            const cover = playlist.cover || playlist.artwork;
            const pos = cardPositions[playlist.id] || { x: 0, y: 0 };

            return (
              <div
                key={playlist.id}
                className={`${styles.card} ${isExpanded ? styles.activeCard : ''}`}
                style={{
                  transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`
                }}
                onClick={() => handleCardClick(playlist)}
              >
                <div className={styles.cardInner}>
                  {/* Vinyl peeking from behind - slides out on expand, static (no rotation) */}
                  <div className={`${styles.vinylPeek} ${
                    isExpanded ? styles.activeVinyl : (isPlayingCurrent ? styles.playingVinyl : '')
                  }`}>
                    <img
                      src={vinylTexture}
                      alt=""
                      className={styles.vinylPeekImg}
                      draggable="false"
                    />
                  </div>

                  {/* Album artwork */}
                  <div className={styles.artworkWrap}>
                    <img
                      src={cover}
                      alt={title}
                      className={styles.artwork}
                      onError={(e) => { e.target.src = '/playlist-covers/sleep.jpg'; }}
                      draggable="false"
                    />
                  </div>
                </div>
                <span className={styles.cardTitle}>{title}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Opened Playlist Detail Panel (Glassmorphic, Unfolds smoothly) */}
      <div 
        className={`${styles.detailPanel} ${openedPlaylist ? styles.detailPanelActive : ''}`}
        style={{
          '--unfold-y': `${unfoldY}px`
        }}
      >
        {openedPlaylist && (
          <div className={styles.panelContent}>
            {/* Header */}
            <div className={styles.panelHeader}>
              <img
                src={openedPlaylist.cover || openedPlaylist.artwork}
                alt={openedPlaylist.title || openedPlaylist.name}
                className={styles.panelCover}
                onError={(e) => { e.target.src = '/playlist-covers/sleep.jpg'; }}
                draggable="false"
              />
              <div className={styles.panelMeta}>
                <div className={styles.panelTitleRow}>
                  <h2 className={styles.panelTitle}>{openedPlaylist.title || openedPlaylist.name}</h2>
                </div>
                <div className={styles.panelActions}>
                  <button className={styles.actionBtn} onClick={handlePlayClick}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    <span>Play</span>
                  </button>
                  <button className={styles.actionBtn} onClick={handleShuffleClick}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="16 3 21 3 21 8" />
                      <line x1="4" y1="20" x2="21" y2="3" />
                      <polyline points="21 16 21 21 16 21" />
                      <line x1="15" y1="15" x2="21" y2="21" />
                      <line x1="4" y1="4" x2="9" y2="9" />
                    </svg>
                    <span>Shuffle</span>
                  </button>
                  <button
                    className={`${styles.actionBtn} ${isFavorited ? styles.favoriteActive : ''}`}
                    onClick={handleFavoriteToggle}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill={isFavorited ? 'currentColor' : 'none'}
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                    <span>Favorite</span>
                  </button>
                </div>
              </div>
            </div>

            {openedPlaylist.description && (
              <p className={styles.panelDesc}>{openedPlaylist.description}</p>
            )}

            {/* Scrollable Song List */}
            <div ref={songsListRef} className={`${styles.songsList} hide-scrollbar`}>
              {expandedSongs.map((song, idx) => {
                const isSongActive = currentSong && currentSong.id === song.id;
                const isHighlighted = highlightedSongId === song.id;
                return (
                  <div
                    key={song.id}
                    ref={isHighlighted ? (el) => {
                      if (el) {
                        setTimeout(() => {
                          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }, 100);
                      }
                    } : null}
                    className={`${styles.songRow} ${isSongActive ? styles.activeSongRow : ''} ${isHighlighted ? styles.highlightedSongRow : ''}`}
                    onClick={() => playSong(song)}
                  >
                    <div className={styles.songLeft}>
                      <span className={song.id} style={{ display: 'none' }} />
                      <span className={styles.songIndex}>
                        {isSongActive && isPlaying ? (
                          <span className={styles.playingIndicator}>
                            <span className={styles.bar1}></span>
                            <span className={styles.bar2}></span>
                            <span className={styles.bar3}></span>
                          </span>
                        ) : (
                          idx + 1
                        )}
                      </span>
                      <div className={styles.songDetails}>
                        <span className={styles.songTitle} title={song.title}>{song.title}</span>
                        <span className={styles.songArtist}>{song.artist}</span>
                      </div>
                    </div>
                    <span className={styles.songDuration}>{formatTime(song.duration)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default PlaylistCards;
