import { useState, useEffect, useRef } from 'react';
import styles from './ExitConfirmModal.module.css';

export default function ExitConfirmModal({ onStay, onExit }) {
  const [deleteSession, setDeleteSession] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const modalRef = useRef(null);
  const previousActiveElement = useRef(null);
  const exitTimeoutRef = useRef(null);
  const stayTimeoutRef = useRef(null);

  useEffect(() => {
    // Store active element for precise focus restoration
    previousActiveElement.current = document.activeElement;

    // Focus trap implementation
    if (modalRef.current) {
      const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
      const focusableElements = modalRef.current.querySelectorAll(focusableSelector);
      if (focusableElements.length > 0) {
        // Focus the first button/input
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
      }
      // Note: Escape key is deliberately disabled for critical destructive confirmations (Smart Escape Rules)
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      
      // Clear timeouts on unmount
      if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current);
      if (stayTimeoutRef.current) clearTimeout(stayTimeoutRef.current);

      // Restore focus to original triggering control
      if (previousActiveElement.current && typeof previousActiveElement.current.focus === 'function') {
        previousActiveElement.current.focus();
      }
    };
  }, []);

  const handleExitClick = () => {
    if (isProcessing) return;
    setIsProcessing(true);
    // Action lock duration
    exitTimeoutRef.current = setTimeout(() => {
      onExit(deleteSession);
    }, 300);
  };

  const handleStayClick = () => {
    if (isProcessing) return;
    setIsProcessing(true);
    stayTimeoutRef.current = setTimeout(() => {
      onStay();
    }, 300);
  };

  return (
    <div
      className={styles.backdrop}
      onClick={handleStayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="exit-modal-title"
      ref={modalRef}
    >
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        <div className={styles.warningIcon}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h3 className={styles.title} id="exit-modal-title">Leave Deep Focus Session?</h3>
        <p className={styles.body}>You still have unfinished focus tasks. Would you like to stay focused and continue your session, or exit anyway?</p>
        
        {/* Checkbox Section */}
        <div className={styles.checkboxContainer}>
          <label className={styles.checkboxLabel}>
            <input 
              type="checkbox" 
              checked={deleteSession} 
              onChange={(e) => setDeleteSession(e.target.checked)} 
              className={styles.checkboxInput}
              disabled={isProcessing}
              aria-label="Delete this focus session and start fresh next time"
            />
            <span className={styles.checkboxText}>Delete this focus session and start fresh next time</span>
          </label>
          {deleteSession && (
            <div className={styles.helperText}>
              All current tasks, progress, and focus planning data will be removed.
            </div>
          )}
        </div>

        <div className={styles.actions}>
          <button
            className={styles.stayBtn}
            onClick={handleStayClick}
            disabled={isProcessing}
            aria-label="Stay focused"
          >
            Stay Focused
          </button>
          <button
            className={styles.exitBtn}
            onClick={handleExitClick}
            disabled={isProcessing}
            aria-label="Exit anyway"
          >
            Exit Anyway
          </button>
        </div>
      </div>
    </div>
  );
}
