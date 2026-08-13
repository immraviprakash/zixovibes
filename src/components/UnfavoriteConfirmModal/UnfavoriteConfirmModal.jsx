import { useEffect, useRef, useState } from 'react';
import styles from './UnfavoriteConfirmModal.module.css';

export default function UnfavoriteConfirmModal({ onStay, onConfirm }) {
  const [isProcessing, setIsProcessing] = useState(false);

  const modalRef = useRef(null);
  const previousActiveElement = useRef(null);
  const confirmTimeoutRef = useRef(null);
  const stayTimeoutRef = useRef(null);

  useEffect(() => {
    previousActiveElement.current = document.activeElement;

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
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
      if (stayTimeoutRef.current) clearTimeout(stayTimeoutRef.current);

      if (previousActiveElement.current && typeof previousActiveElement.current.focus === 'function') {
        previousActiveElement.current.focus();
      }
    };
  }, []);

  const handleConfirmClick = () => {
    if (isProcessing) return;
    setIsProcessing(true);
    confirmTimeoutRef.current = setTimeout(() => {
      onConfirm();
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
      aria-labelledby="unfav-modal-title"
      ref={modalRef}
    >
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.title} id="unfav-modal-title">Remove from Favorites?</h3>
        <p className={styles.body}>This playlist will no longer be saved.</p>

        <div className={styles.actions}>
          <button
            className={styles.stayBtn}
            onClick={handleStayClick}
            disabled={isProcessing}
            aria-label="Cancel"
          >
            Cancel
          </button>
          <button
            className={styles.exitBtn}
            onClick={handleConfirmClick}
            disabled={isProcessing}
            aria-label="Remove"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
