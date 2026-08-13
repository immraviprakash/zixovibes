import { useState, useEffect, useRef } from 'react';
import { useApp } from '../../../context/AppContext';
import { playlists } from '../../../data/mockData';
import styles from './CompactPlayer.module.css';

export default function CompactPlayer() {
  const {
    isPlaying, setIsPlaying,
    volume, setVolume,
    isShuffle, setIsShuffle,
    isLoop, setIsLoop,
    isFavorited, setIsFavorited,
    selectedFocusPlaylist, setSelectedFocusPlaylist,
    transitionStage,
    pendingMode,
    currentSong,
    elapsed: audioElapsed,
    seek,
    playNext,
    playPrev,
    setOpenedPlaylist,
    currentPlaylistSongs = [],
  } = useApp();

  const hasSongs = currentPlaylistSongs && currentPlaylistSongs.length > 0;

  const playlist = selectedFocusPlaylist || playlists.find(p => p.id === 'focus') || playlists.find(p => p.id === 7) || playlists[0];
  const duration = currentSong ? currentSong.duration : (playlist ? playlist.duration : 225);
  const [isDragging, setIsDragging] = useState(false);
  const [dragElapsed, setDragElapsed] = useState(0);
  const [prevVolume, setPrevVolume] = useState(volume > 0 ? volume : 65);
  const trackRef = useRef(null);

  useEffect(() => {
    if (volume > 0) {
      setPrevVolume(volume);
    }
  }, [volume]);

  const toggleMute = () => {
    if (volume > 0) {
      setVolume(0);
    } else {
      setVolume(prevVolume);
    }
  };

  const elapsed = isDragging ? dragElapsed : audioElapsed;

  const formatTime = (s) => {
    const min = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const progress = (elapsed / duration) * 100;

  const handlePointerDown = (e) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    document.body.classList.add('dragging-active');

    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.min(1, Math.max(0, x / rect.width));
    const targetTime = Math.round(percent * duration);
    setDragElapsed(targetTime);
    seek(targetTime);
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    e.stopPropagation();

    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.min(1, Math.max(0, x / rect.width));
    setDragElapsed(Math.round(percent * duration));
  };

  const handlePointerUp = (e) => {
    if (!isDragging) return;
    e.stopPropagation();
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsDragging(false);
    document.body.classList.remove('dragging-active');
    seek(dragElapsed);
  };

  const handlePointerCancel = (e) => {
    if (!isDragging) return;
    e.stopPropagation();
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsDragging(false);
    document.body.classList.remove('dragging-active');
  };

  useEffect(() => {
    return () => {
      document.body.classList.remove('dragging-active');
    };
  }, []);

  // Dynamic volume color
  let volumeColor = '#6e5535';
  if (volume > 66) volumeColor = '#e0c4a8';
  else if (volume > 33) volumeColor = '#c9a07c';

  const isLeaving = transitionStage === 'leaving' && pendingMode === 'classic';

  return (
    <div className={`${styles.bar} ${isLeaving ? styles.barLeaving : ''}`}>
      {/* Left: Track info with mini vinyl peek */}
      <div className={styles.trackInfo}>
        <div
          className={styles.artworkContainer}
          onClick={() => {
            if (playlist) {
              setSelectedFocusPlaylist(playlist);
              setIsPlaying(true);
              setOpenedPlaylist(playlist);
            }
          }}
          style={{ cursor: 'pointer' }}
        >
          <img
            src={currentSong ? currentSong.cover : (playlist ? (playlist.cover || playlist.artwork) : '/playlist-covers/sleep.jpg')}
            alt={currentSong ? currentSong.title : playlist.title}
            className={styles.artwork}
            onError={(e) => { e.target.src = playlist?.cover || playlist?.artwork || '/playlist-covers/sleep.jpg'; }}
            draggable="false"
          />
        </div>
        <div className={styles.meta}>
          <span className={styles.nowLabel}>Now playing</span>
          <span className={styles.trackTitle}>{currentSong ? currentSong.title : playlist.title}</span>
          <div className={styles.artistRow}>
            <span className={styles.trackArtist}>{currentSong ? currentSong.artist : playlist.artist}</span>
            <button
              className={`${styles.favBtn} ${isFavorited ? styles.favActive : ''}`}
              onClick={() => setIsFavorited(prev => !prev)}
              aria-label="Favorite"
            >
              <svg width="15" height="15" viewBox="0 0 24 24"
                fill={isFavorited ? 'currentColor' : 'none'}
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Center: Controls + Progress */}
      <div className={styles.center}>
        <div className={styles.controls}>
          <button
            className={`${styles.controlBtn} ${isShuffle ? styles.active : ''}`}
            onClick={() => setIsShuffle(prev => !prev)}
            aria-label="Shuffle"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 3 21 3 21 8" />
              <line x1="4" y1="20" x2="21" y2="3" />
              <polyline points="21 16 21 21 16 21" />
              <line x1="15" y1="15" x2="21" y2="21" />
              <line x1="4" y1="4" x2="9" y2="9" />
            </svg>
          </button>
          <button
            className={styles.controlBtn}
            onClick={() => playPrev()}
            aria-label="Previous"
            disabled={!hasSongs}
            style={!hasSongs ? { opacity: 0.3, cursor: 'not-allowed' } : {}}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>
          <button
            className={`${styles.playBtn} ${!hasSongs ? styles.disabledPlayBtn : ''}`}
            onClick={() => {
              if (hasSongs) {
                setIsPlaying(prev => !prev);
              }
            }}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            disabled={!hasSongs}
          >
            {isPlaying ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            )}
          </button>
          <button
            className={styles.controlBtn}
            onClick={() => playNext()}
            aria-label="Next"
            disabled={!hasSongs}
            style={!hasSongs ? { opacity: 0.3, cursor: 'not-allowed' } : {}}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>
          <button
            className={`${styles.controlBtn} ${isLoop ? styles.active : ''}`}
            onClick={() => setIsLoop(prev => !prev)}
            aria-label="Loop"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
          </button>
        </div>

        {/* Progress bar */}
        <div className={styles.progressRow}>
          <span className={styles.time}>{formatTime(elapsed)}</span>
          <div
            ref={trackRef}
            className={`${styles.progressTrack} ${isDragging ? styles.dragging : ''}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
          >
            <div
              className={styles.progressFill}
              style={{ width: `${progress}%` }}
            />
            <div
              className={styles.progressDot}
              style={{ left: `${progress}%` }}
            />
          </div>
          <span className={styles.time}>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Right: Volume */}
      <div className={styles.volumeArea}>
        <button className={styles.volumeBtn} aria-label="Volume" onClick={toggleMute}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {volume > 0 ? (
              <>
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                {volume > 30 && <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />}
                {volume > 60 && <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />}
              </>
            ) : (
              <>
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </>
            )}
          </svg>
        </button>
        <input
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className={styles.volumeSlider}
          style={{
            '--vol-percent': `${volume}%`,
            '--vol-color': volumeColor,
          }}
          aria-label="Volume"
        />
      </div>
    </div>
  );
}
