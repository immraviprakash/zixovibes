import { Component } from 'react';
import styles from './ErrorBoundary.module.css';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[Global Error Boundary] Render exception caught:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    try {
      console.warn("[Global Error Boundary] Resetting stored session to resolve crash.");
      localStorage.removeItem('zixovibes_deepfocus');
      localStorage.removeItem('zixovibes_focus_stats');
      this.setState({ hasError: false });
      window.location.reload();
    } catch (e) {
      console.error("[Global Error Boundary] Failed to clear localStorage:", e);
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.container}>
          <div className={styles.card}>
            <div className={styles.iconArea}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={styles.warningIcon}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            
            <h2 className={styles.title}>Something went wrong</h2>
            <p className={styles.body}>
              Zix'Ovibes detected a problem and restored a safe state.
            </p>

            <div className={styles.actions}>
              <button className={styles.reloadBtn} onClick={this.handleReload}>
                Reload Application
              </button>
              <button className={styles.resetBtn} onClick={this.handleReset}>
                Reset Stored Session
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
