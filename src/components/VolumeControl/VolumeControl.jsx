import { useState, useEffect, memo } from 'react';
import { useApp } from '../../context/AppContext';
import styles from './VolumeControl.module.css';

const VolumeControl = memo(function VolumeControl() {
  const { volume, setVolume, announce } = useApp();
  const [prevVolume, setPrevVolume] = useState(65);

  // Sync prevVolume dynamically with the last non-zero volume
  useEffect(() => {
    if (volume > 0) {
      setPrevVolume(volume);
    }
  }, [volume]);

  const toggleMute = () => {
    if (volume > 0) {
      setVolume(0);
      announce("Audio muted.");
    } else {
      setVolume(prevVolume);
      announce(`Audio unmuted. Volume set to ${prevVolume} percent.`);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault();
      const newVol = Math.min(100, volume + 5);
      setVolume(newVol);
      announce(`Volume ${newVol} percent`);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const newVol = Math.max(0, volume - 5);
      setVolume(newVol);
      announce(`Volume ${newVol} percent`);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setVolume(0);
      announce("Volume 0 percent");
    } else if (e.key === 'End') {
      e.preventDefault();
      setVolume(100);
      announce("Volume 100 percent");
    }
  };

  return (
    <div className={styles.volumeControl}>
      <button
        className={styles.speakerBtn}
        aria-label={volume > 0 ? "Mute audio" : "Unmute audio"}
        onClick={toggleMute}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            toggleMute();
          }
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {volume > 0 ? (
            <>
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              {volume > 30 && (
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              )}
              {volume > 60 && (
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              )}
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
      
      <div className={styles.sliderWrapper}>
        <input
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={(e) => {
            const val = Number(e.target.value);
            setVolume(val);
          }}
          onKeyDown={handleKeyDown}
          className={styles.nativeInput}
          role="slider"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={volume}
          aria-label="Volume slider"
        />
        <div className={styles.visualTrack}>
          <div className={styles.trackProgress} style={{ width: `${volume}%` }} />
          <div className={styles.visualThumb} style={{ left: `${volume}%` }} />
        </div>
      </div>
    </div>
  );
});

export default VolumeControl;
