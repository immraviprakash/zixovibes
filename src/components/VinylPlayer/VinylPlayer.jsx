import { useState, useEffect, useRef, memo } from 'react';
import { useApp } from '../../context/AppContext';
import styles from './VinylPlayer.module.css';
import vinylTexture from '../../assets/vinyl-texture.png';

const VinylPlayer = memo(function VinylPlayer({ playlist, onSelectPlaylist }) {
  const {
    classicIsPlaying: isPlaying,
    setClassicIsPlaying: setIsPlaying,
    isShuffle,
    setIsShuffle,
    isLoop,
    setIsLoop,
    isFavorited,
    setIsFavorited,
    announce,
    currentSong,
    elapsed: audioElapsed,
    seek,
    playNext,
    playPrev,
  } = useApp();

  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragElapsed, setDragElapsed] = useState(0);
  const svgRef = useRef(null);
  const hoverTimeoutRef = useRef(null);

  const duration = currentSong ? currentSong.duration : 225;
  const elapsed = isDragging ? dragElapsed : audioElapsed;

  // Playback announcement trigger
  const prevIsPlaying = useRef(isPlaying);
  useEffect(() => {
    if (isPlaying !== prevIsPlaying.current) {
      announce(isPlaying ? "Music playback started." : "Music playback paused.");
      prevIsPlaying.current = isPlaying;
    }
  }, [isPlaying, announce]);

  const formatTime = (s) => {
    const min = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const handleVinylClick = (e) => {
    e.stopPropagation();
    // Prevent pausing if clicking controls or progress seek bar
    if (e.target.closest(`.${styles.controls}`) || e.target.closest(`.${styles.progressInteractive}`)) {
      return;
    }
    setIsPlaying((prev) => !prev);
  };



  const calculateProgress = (e) => {
    if (!svgRef.current) return 0;
    const rect = svgRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;

    let angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
    angleDeg = (angleDeg + 360) % 360;

    let clickAngle = (angleDeg - 180 + 360) % 360;
    const progressVal = clickAngle / 360;
    return Math.min(duration, Math.max(0, Math.round(progressVal * duration)));
  };

  const handlePointerDown = (e) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    document.body.classList.add('dragging-active');
    
    const clickVal = calculateProgress(e);
    setDragElapsed(clickVal);
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    e.stopPropagation();
    const progressVal = calculateProgress(e);
    setDragElapsed(progressVal);
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

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 1000); // 1 second delay
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  const progress = elapsed / duration;

  // circle radius in viewBox is 47.5, center is 50, 50.
  // Start (0%) is at 9 o'clock (pi radians) and goes clockwise
  const angleRad = progress * 2 * Math.PI + Math.PI;
  const dotX = 50 + 47.5 * Math.cos(angleRad);
  const dotY = 50 + 47.5 * Math.sin(angleRad);

  return (
    <div
      className={`${styles.vinylContainer} ${isHovered ? styles.hovered : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Fixed Timeline on the Left Side - Centered Vertically */}
      <div className={styles.timelineFixed}>
        <div className={styles.timeCurrent}>{formatTime(elapsed)}</div>
        <div className={styles.timeTotal}>{formatTime(duration)}</div>
      </div>

      {/* Vinyl Wrapper */}
      <div className={styles.vinylWrapper}>
        
        {/* Gradient shadow expanding mostly toward the right side */}
        <div className={`${styles.gradientShadow} ${isHovered ? styles.active : ''}`} />

        {/* Controls Container - z-index: 1 (sits behind vinyl) */}
        <div className={`${styles.controls} ${isHovered ? styles.controlsActive : ''}`}>
          
          {/* Shuffle button */}
          <button
            className={`${styles.controlBtn} ${styles.ctrlShuffle} ${isShuffle ? styles.btnActive : ''}`}
            aria-label="Toggle shuffle playback"
            aria-pressed={isShuffle}
            onClick={(e) => {
              e.stopPropagation();
              const nextVal = !isShuffle;
              setIsShuffle(nextVal);
              announce(nextVal ? "Shuffle playback enabled." : "Shuffle playback disabled.");
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={styles.goldIcon}>
              <polyline points="16 3 21 3 21 8" />
              <line x1="4" y1="20" x2="21" y2="3" />
              <polyline points="21 16 21 21 16 21" />
              <line x1="15" y1="15" x2="21" y2="21" />
              <line x1="4" y1="4" x2="9" y2="9" />
            </svg>
            <span className={styles.whiteLabel}>Shuffle</span>
          </button>

          {/* Previous button */}
          <button
            className={`${styles.controlBtn} ${styles.ctrlPrev}`}
            aria-label="Play previous track"
            onClick={(e) => {
              e.stopPropagation();
              playPrev();
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className={styles.goldIcon}>
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
            <span className={styles.whiteLabel}>Prev</span>
          </button>

          {/* Favorite button */}
          <button
            className={`${styles.controlBtn} ${styles.ctrlFavorite} ${isFavorited ? styles.favoriteActive : ''}`}
            aria-label="Toggle favorite track"
            aria-pressed={isFavorited}
            onClick={(e) => {
              e.stopPropagation();
              const nextVal = !isFavorited;
              setIsFavorited(nextVal);
              announce(nextVal ? "Track added to favorites." : "Track removed from favorites.");
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill={isFavorited ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={styles.goldIcon}
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <span className={styles.whiteLabel}>Favorite</span>
          </button>

          {/* Next button */}
          <button
            className={`${styles.controlBtn} ${styles.ctrlNext}`}
            aria-label="Play next track"
            onClick={(e) => {
              e.stopPropagation();
              playNext();
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className={styles.goldIcon}>
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
            <span className={styles.whiteLabel}>Next</span>
          </button>

          {/* Loop button */}
          <button
            className={`${styles.controlBtn} ${styles.ctrlLoop} ${isLoop ? styles.btnActive : ''}`}
            aria-label="Toggle loop track"
            aria-pressed={isLoop}
            onClick={(e) => {
              e.stopPropagation();
              const nextVal = !isLoop;
              setIsLoop(nextVal);
              announce(nextVal ? "Loop playback enabled." : "Loop playback disabled.");
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={styles.goldIcon}>
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
            <span className={styles.whiteLabel}>Loop</span>
          </button>

        </div>

        {/* Rotating Vinyl Disc - z-index: 3 (sits on top of controls) */}
        <div
          className={`${styles.vinylDisc} ${isPlaying ? styles.spinning : styles.paused}`}
          role="button"
          tabIndex={0}
          aria-label={isPlaying ? "Pause track" : "Play track"}
          onClick={handleVinylClick}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              handleVinylClick(e);
            }
          }}
        >
          <img
            src={vinylTexture}
            alt="Vinyl Record"
            className={styles.vinylImage}
            draggable="false"
          />

          {/* Center artwork */}
          <div
            className={styles.centerArtwork}
            style={{ cursor: 'pointer' }}
          >
            <img
              src={currentSong ? currentSong.cover : (playlist ? (playlist.cover || playlist.artwork) : '/playlist-covers/sleep.jpg')}
              alt={currentSong ? currentSong.title : (playlist ? (playlist.title || playlist.name) : 'Coffee Shop')}
              className={styles.artworkImage}
              onError={(e) => { e.target.src = playlist?.cover || playlist?.artwork || '/playlist-covers/sleep.jpg'; }}
              draggable="false"
            />
            <div className={styles.centerText}>
              <span className={styles.trackTitle}>{currentSong ? currentSong.title : (playlist ? (playlist.title || playlist.name) : 'Coffee Shop')}</span>
              <span className={styles.trackArtist}>{currentSong ? currentSong.artist : (playlist ? playlist.artist : 'Jazz')}</span>
            </div>
          </div>

          {/* Center hole */}
          <div className={styles.centerHole} />
        </div>

        {/* Interactive Progress Ring (Seek Bar) - z-index: 4 */}
        <svg
          ref={svgRef}
          className={`${styles.progressRing} ${isDragging ? styles.dragging : ''}`}
          viewBox="0 0 100 100"
        >
          <defs>
            <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f9ebbe" />
              <stop offset="40%" stopColor="#dfbe66" />
              <stop offset="80%" stopColor="#b5943a" />
              <stop offset="100%" stopColor="#7a5b16" />
            </linearGradient>
            <linearGradient id="trackGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(201, 168, 76, 0.16)" />
              <stop offset="100%" stopColor="rgba(122, 91, 22, 0.04)" />
            </linearGradient>
          </defs>

          {/* Faint gold background track */}
          <circle
            cx="50"
            cy="50"
            r="47.5"
            stroke="url(#trackGradient)"
            className={styles.progressTrack}
          />
          {/* Active progress fill - start (0%) at 9 o'clock (rotate 180 deg) */}
          <circle
            cx="50"
            cy="50"
            r="47.5"
            stroke="url(#goldGradient)"
            transform="rotate(180 50 50)"
            className={styles.progressFill}
            strokeDasharray={2 * Math.PI * 47.5}
            strokeDashoffset={2 * Math.PI * 47.5 * (1 - progress)}
          />
          {/* Handle dot at current progress position */}
          {progress > 0 && (
            <circle
              cx={dotX}
              cy={dotY}
              r="1.4"
              className={styles.progressDot}
            />
          )}

          {/* Transparent interactive target overlay circle for seek */}
          <circle
            cx="50"
            cy="50"
            r="47.5"
            className={styles.progressInteractive}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
          />
        </svg>

      </div>
    </div>
  );
});

export default VinylPlayer;
