import { useState, useEffect, useRef } from 'react';
import styles from '../ExitConfirmModal/ExitConfirmModal.module.css';

export default function CompletedConfirmModal({ onStay, onExit }) {
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
      // Escape key disabled for critical session transition modal (Smart Escape Rules)
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
    exitTimeoutRef.current = setTimeout(() => {
      onExit();
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
      aria-labelledby="completed-modal-title"
      ref={modalRef}
    >
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        <div 
          className={styles.warningIcon} 
          style={{ 
            borderColor: 'rgba(110, 200, 122, 0.25)', 
            background: 'rgba(110, 200, 122, 0.06)', 
            color: 'var(--df-success, #6ec87a)', 
            boxShadow: '0 0 20px rgba(110, 200, 122, 0.08)' 
          }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h3 className={styles.title} id="completed-modal-title">Focus Session Completed</h3>
        <p className={styles.body} style={{ marginBottom: '32px' }}>
          You've completed your focus plan. Are you ready to return to Classic Mode?
        </p>
        
        <div className={styles.actions}>
          <button
            className={styles.stayBtn}
            onClick={handleStayClick}
            disabled={isProcessing}
            aria-label="Stay in Deep Focus"
          >
            Stay in Deep Focus
          </button>
          <button
            className={styles.neutralExitBtn}
            onClick={handleExitClick}
            disabled={isProcessing}
            aria-label="Return to Classic"
          >
            Return to Classic
          </button>
        </div>
      </div>
    </div>
  );
}
