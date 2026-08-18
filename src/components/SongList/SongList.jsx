import { memo, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import styles from './SongList.module.css';

const SongList = memo(function SongList({ playlist, songs, currentSong, isPlaying, onBack, onPlaySong, isDeepFocus, layout }) {
  const { isPlaylistFavorited, toggleFavoritePlaylist } = useApp();
  const songsContainerRef = useRef(null);

  // Reset scroll position to top whenever playlist changes
  useEffect(() => {
    if (songsContainerRef.current) {
      songsContainerRef.current.scrollTop = 0;
    }
  }, [playlist]);

  // Smooth, controlled scroll listener
  useEffect(() => {
    const container = songsContainerRef.current;
    if (!container) return;

    const handleWheel = (e) => {
      e.preventDefault();
      container.scrollTop += e.deltaY * 0.40;
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [playlist]);

  const formatTime = (s) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const isVertical = layout === 'vertical';
  const isFavorited = isPlaylistFavorited(playlist.id);

  return (
    <div className={`${styles.songListContainer} ${isDeepFocus ? styles.dfMode : ''} ${isVertical ? styles.verticalMode : ''}`}>
      {/* Header with back button */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onBack} aria-label="Back to playlists">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          <span>Back to Playlists</span>
        </button>
      </div>

      {/* Playlist Meta Banner */}
      <div className={styles.playlistBanner}>
        <img
          src={playlist.cover}
          alt={playlist.title}
          className={styles.bannerCover}
          onError={(e) => { e.target.src = '/playlist-covers/sleep.jpg'; }}
          draggable="false"
          loading="lazy"
        />
        <div className={styles.bannerInfo}>
          <h2 className={styles.playlistTitle}>{playlist.title}</h2>
          <p className={styles.playlistDesc}>{playlist.description}</p>
          <div className={styles.bannerActions}>
            <span className={styles.songCount}>{songs.length} songs</span>
            <button 
              className={styles.dfPlayBtn}
              onClick={() => {
                if (songs && songs.length > 0) {
                  onPlaySong(songs[0]);
                }
              }}
              disabled={!songs || songs.length === 0}
              aria-label={(!songs || songs.length === 0) ? "No songs available" : `Play ${playlist.title} from beginning`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <span>Play</span>
            </button>
            <button
              className={`${styles.dfFavBtn} ${isFavorited ? styles.favActive : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleFavoritePlaylist(playlist.id);
              }}
              aria-label={isFavorited ? `Remove ${playlist.title} from favorites` : `Add ${playlist.title} to favorites`}
              title={isFavorited ? "Remove from Favorites" : "Add to Favorites"}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill={isFavorited ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Songs Table/List */}
      <div ref={songsContainerRef} className={`${styles.songsContainer} hide-scrollbar`}>
        {songs && songs.length > 0 ? (
          songs.map((song, index) => {
            const isActive = currentSong && currentSong.id === song.id;
            return (
              <div
                key={song.id}
                className={`${styles.songRow} ${isActive ? styles.activeRow : ''}`}
                onClick={() => onPlaySong(song)}
              >
                <div className={styles.songLeft}>
                  <span className={styles.trackNum}>
                    {isActive && isPlaying ? (
                      <span className={styles.playingIndicator}>
                        <span className={styles.bar1}></span>
                        <span className={styles.bar2}></span>
                        <span className={styles.bar3}></span>
                      </span>
                    ) : (
                      index + 1
                    )}
                  </span>
                  <div className={styles.songMeta}>
                    <span className={styles.songTitle} title={song.title}>{song.title}</span>
                    <span className={styles.songArtist}>{song.artist}</span>
                  </div>
                </div>
                <span className={styles.songDuration}>{formatTime(song.duration)}</span>
              </div>
            );
          })
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v8" />
                <path d="M8 12h8" />
              </svg>
            </div>
            <p className={styles.emptyText}>Your focus playlist will be created as you start working.</p>
          </div>
        )}
      </div>
    </div>
  );
});

export default SongList;
