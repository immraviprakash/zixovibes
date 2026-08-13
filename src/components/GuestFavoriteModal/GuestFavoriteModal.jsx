import { useEffect, useRef } from 'react';
import styles from './GuestFavoriteModal.module.css';

export default function GuestFavoriteModal({ onStay, onExit }) {
  const modalRef = useRef(null);
  const previousActiveElement = useRef(null);

  useEffect(() => {
    // Store active element for precise focus restoration
    previousActiveElement.current = document.activeElement;

    // Focus trap implementation
    if (modalRef.current) {
      const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
      const focusableElements = modalRef.current.querySelectorAll(focusableSelector);
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      }
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Tab') {
        if (!modalRef.current) return;
        const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
        const focusableElements = Array.from(modalRef.current.querySelectorAll(focusableSelector));
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onStay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (previousActiveElement.current && typeof previousActiveElement.current.focus === 'function') {
        previousActiveElement.current.focus();
      }
    };
  }, [onStay]);

  return (
    <div
      className={styles.backdrop}
      onClick={onStay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="guest-modal-title"
      ref={modalRef}
    >
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        <div className={styles.heartIcon}>
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </div>

        <h3 className={styles.title} id="guest-modal-title">
          Save Your Favorites
        </h3>

        <p className={styles.body}>
          Save your favorite playlists, liked songs and focus sessions across all your devices.
        </p>

        <div className={styles.actions}>
          <button
            className={`${styles.btn} ${styles.primaryBtn}`}
            onClick={onExit}
            aria-label="Sign In or Create Account"
          >
            Sign In / Create Account
          </button>
          <button
            className={`${styles.btn} ${styles.secondaryBtn}`}
            onClick={onStay}
            aria-label="Maybe Later"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}
