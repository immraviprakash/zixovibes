import { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import logo from '../../assets/zixovibes-logo.png';
import zoFavicon from '../../assets/zixovibes-favicon.png';
import woodBackground from '../../assets/wood-background.jpg';
import goldenVinyl from '../../assets/golden-vinyl-disc.png';
import styles from './AuthPage.module.css';

export default function AuthPage() {
  const { login, signUp, resetPassword, previousMode, switchMode } = useApp();
  const [tab, setTab] = useState('signin'); // 'signin' | 'signup' | 'forgot'
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [identifier, setIdentifier] = useState(''); // Username OR Email for login & forgot
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState(''); // Unique handle for signup
  const [displayName, setDisplayName] = useState(''); // Human-readable name for signup
  const [email, setEmail] = useState(''); // Email for signup
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // Error and Success States
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');

  // Password Visibility States
  const [showPassword, setShowPassword] = useState(false);

  // Transition key for content animation
  const [contentKey, setContentKey] = useState(0);

  // Ambient cursor glow position
  const [glowPos, setGlowPos] = useState({ x: -1000, y: -1000, opacity: 0 });

  const containerRef = useRef(null);

  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setGlowPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      opacity: 1
    });
  };

  const handleMouseLeave = () => {
    setGlowPos(prev => ({ ...prev, opacity: 0 }));
  };

  // Focus trap on tab switch
  useEffect(() => {
    if (containerRef.current) {
      const inputs = containerRef.current.querySelectorAll('input');
      if (inputs.length > 0) {
        setTimeout(() => inputs[0].focus(), 300);
      }
    }
  }, [tab]);

  // Handle Tab Switch
  const handleTabChange = (targetTab) => {
    setTab(targetTab);
    setErrors({});
    setSuccessMessage('');
    setIdentifier('');
    setPassword('');
    setUsername('');
    setDisplayName('');
    setEmail('');
    setConfirmPassword('');
    setContentKey(prev => prev + 1);
  };

  const validate = () => {
    const errs = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (tab === 'signin') {
      if (!identifier.trim()) {
        errs.identifier = 'Please enter your username or email address.';
      }
      if (!password) {
        errs.password = 'Password is required.';
      }
    } else if (tab === 'signup') {
      // 1. Username
      const trimmedUname = username.trim();
      if (!trimmedUname) {
        errs.username = 'Please choose a username.';
      } else if (trimmedUname.length < 3) {
        errs.username = 'Username must be at least 3 characters.';
      } else if (!/^[a-zA-Z0-9_.-]+$/.test(trimmedUname)) {
        errs.username = 'Username can only contain letters, numbers, underscores, and hyphens.';
      }

      // 2. Display Name
      if (!displayName.trim()) {
        errs.displayName = 'Please enter your display name.';
      } else if (displayName.length > 20) {
        errs.displayName = 'Display name cannot exceed 20 characters.';
      }

      // 3. Email
      if (!email.trim()) {
        errs.email = 'Email address is required.';
      } else if (!emailRegex.test(email.trim())) {
        errs.email = 'Please enter a valid email address.';
      }

      // 4. Password
      if (!password) {
        errs.password = 'Password is required.';
      } else if (password.length < 6) {
        errs.password = 'Password must be at least 6 characters.';
      } else if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
        errs.password = 'Password must contain at least one letter and one number.';
      }

      // 5. Confirm Password
      if (!confirmPassword) {
        errs.confirmPassword = 'Please confirm your password.';
      } else if (password !== confirmPassword) {
        errs.confirmPassword = 'Passwords do not match.';
      }
    } else if (tab === 'forgot') {
      if (!identifier.trim()) {
        errs.identifier = 'Please enter your username or email address.';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!validate()) return;

    setIsSubmitting(true);
    setErrors({});
    setSuccessMessage('');

    try {
      if (tab === 'signin') {
        await login(identifier, password, rememberMe);
      } else if (tab === 'signup') {
        await signUp(username, displayName, email, password);
      } else if (tab === 'forgot') {
        await resetPassword(identifier);
        setSuccessMessage('Password reset instructions have been sent to your email. Please check your inbox and spam/junk folder.');
      }
    } catch (error) {
      console.error("[Firebase Auth] Error during auth operation:", error);
      const errs = {};
      
      if (error.code === 'auth/username-already-in-use') {
        errs.username = 'Username already exists. Please choose another username.';
      } else if (error.code === 'auth/username-not-found') {
        errs.identifier = error.customMessage || 'Username not found. Try your email address or check your username.';
      } else if (error.code === 'auth/user-not-found') {
        errs.identifier = error.customMessage || 'Account not found. Please check your email or username.';
      } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errs.password = 'That email, username, or password doesn\'t look right. Please check your details and try again.';
      } else if (error.code === 'auth/email-already-in-use') {
        errs.email = 'This email is already registered to another account.';
      } else if (error.code === 'auth/invalid-email') {
        if (tab === 'signup') {
          errs.email = 'Please enter a valid email address.';
        } else {
          errs.identifier = 'Please enter a valid email address or username.';
        }
      } else if (error.code === 'auth/weak-password') {
        errs.password = 'Password must be at least 6 characters.';
      } else if (error.code === 'auth/too-many-requests') {
        errs.submit = 'Access to this account has been temporarily disabled due to many failed login attempts. Please try again later or reset your password.';
      } else if (error.code === 'auth/network-request-failed') {
        errs.submit = 'Network connection issue. Please check your internet connection and try again.';
      } else if (error.code === 'auth/user-disabled') {
        errs.submit = 'This account has been disabled. Please contact support.';
      } else {
        const rawMsg = error.customMessage || error.message || '';
        if (rawMsg && !rawMsg.includes('Firebase') && !rawMsg.includes('auth/') && !rawMsg.includes('Error (')) {
          errs.submit = rawMsg;
        } else {
          errs.submit = 'Authentication failed. Please check your credentials and try again.';
        }
      }
      
      setErrors(errs);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    switchMode(previousMode || 'classic', true);
  };

  /* ── Password visibility icon ── */
  const EyeIcon = ({ visible }) => (
    visible ? (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    ) : (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )
  );

  /* ── Input field icon components ── */
  const EmailIcon = () => (
    <svg className={styles.inputIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );

  const LockIcon = () => (
    <svg className={styles.inputIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );

  const UserIcon = () => (
    <svg className={styles.inputIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );

  const BadgeIcon = () => (
    <svg className={styles.inputIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );

  return (
    <div
      className={styles.authContainer}
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        '--glow-x': `${glowPos.x}px`,
        '--glow-y': `${glowPos.y}px`,
        '--glow-opacity': glowPos.opacity
      }}
    >
      {/* Background layers */}
      <div className={styles.authBg} style={{ backgroundImage: `url(${woodBackground})` }} />
      <div className={styles.authBgOverlay} />
      <div className={styles.ambientGlow} />
      <div className={styles.authVignette} />

      {/* Close button */}
      <button
        className={styles.closeBtn}
        onClick={handleClose}
        aria-label="Back to Dashboard"
        title="Back to Dashboard"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Main layout */}
      <div className={styles.authLayout}>
        {/* Left: Brand & Golden Vinyl atmospheric panel */}
        <div className={styles.brandPanel}>
          <div className={styles.brandCluster}>
            <img src={logo} alt="Zix'Ovibes" className={styles.brandLogo} draggable="false" />
            <span className={styles.brandTagline}>Focus · Flow · Finish</span>
          </div>

          <div className={styles.vinylStage}>
            <div className={styles.vinylGlow} />
            <div className={styles.vinylOuter}>
              {/* Entire record (grooves + center label) rotates as a single coherent object */}
              <div className={`${styles.vinylDisc} ${styles.spinning}`}>
                <img src={goldenVinyl} alt="Zix'Ovibes Golden Vinyl" className={styles.vinylDiscImg} draggable="false" />
                
                {/* Zix'Ovibes Luxury Record Center Label */}
                <div className={styles.vinylCenterLabel}>
                  <img src={zoFavicon} alt="" className={styles.vinylFaviconMark} draggable="false" />
                  <span className={styles.vinylLabelBrand}>Zix'Ovibes</span>
                </div>
              </div>
              <div className={styles.vinylRimGlow} />
            </div>
          </div>

          <p className={styles.brandQuote}>
            Your personal space for music, focus, and creative flow.
          </p>
        </div>

        {/* Right: Authentication form */}
        <div className={styles.formPanel}>
          <form onSubmit={handleSubmit} className={styles.formBody}>
            <div className={styles.formContent} key={contentKey}>
              {tab === 'signin' ? (
                <>
                  <h2 className={styles.authTitle}>Welcome Back</h2>
                  <p className={styles.authSubtitle}>Continue your music and focus journey.</p>

                  {/* Username / Email */}
                  <div className={styles.inputGroup}>
                    <label className={styles.inputLabel}>Username / Email</label>
                    <div className={`${styles.inputWrapper} ${errors.identifier ? styles.inputWrapperError : ''}`}>
                      <UserIcon />
                      <input
                        type="text"
                        value={identifier}
                        onChange={(e) => {
                          setIdentifier(e.target.value);
                          setErrors(prev => ({ ...prev, identifier: null }));
                        }}
                        className={styles.textInput}
                        placeholder="Enter username or email"
                        autoComplete="username"
                        required
                      />
                    </div>
                    {errors.identifier && <span className={styles.fieldError}>{errors.identifier}</span>}
                  </div>

                  {/* Password */}
                  <div className={styles.inputGroup}>
                    <label className={styles.inputLabel}>Password</label>
                    <div className={`${styles.inputWrapper} ${errors.password ? styles.inputWrapperError : ''}`}>
                      <LockIcon />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setErrors(prev => ({ ...prev, password: null }));
                        }}
                        className={styles.textInput}
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        required
                      />
                      <button
                        type="button"
                        className={styles.eyeBtn}
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex="-1"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        <EyeIcon visible={showPassword} />
                      </button>
                    </div>
                    {errors.password && <span className={styles.fieldError}>{errors.password}</span>}
                  </div>

                  {/* Keep me signed in / Forgot */}
                  <div className={styles.formRow}>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className={styles.checkboxInput}
                      />
                      <span>Keep me signed in</span>
                    </label>
                    <button
                      type="button"
                      className={styles.forgotLink}
                      onClick={() => handleTabChange('forgot')}
                    >
                      Forgot password?
                    </button>
                  </div>

                  {errors.submit && (
                    <div className={styles.submitError}>{errors.submit}</div>
                  )}

                  <button
                    type="submit"
                    className={styles.submitBtn}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <div className={styles.spinner} />
                    ) : (
                      'Sign In'
                    )}
                  </button>

                  <div className={styles.divider} />

                  <div className={styles.switchTabBlock}>
                    <span>New to Zix'Ovibes?</span>
                    <button
                      type="button"
                      className={styles.switchTabBtn}
                      onClick={() => handleTabChange('signup')}
                    >
                      Create Account
                    </button>
                  </div>
                </>
              ) : tab === 'signup' ? (
                <>
                  <h2 className={styles.authTitle}>Create Account</h2>
                  <p className={styles.authSubtitle}>Start your journey with Zix'Ovibes.</p>

                  {/* 1. Choose a Username */}
                  <div className={styles.inputGroup}>
                    <label className={styles.inputLabel}>Choose a Username</label>
                    <div className={`${styles.inputWrapper} ${errors.username ? styles.inputWrapperError : ''}`}>
                      <UserIcon />
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => {
                          setUsername(e.target.value);
                          setErrors(prev => ({ ...prev, username: null }));
                        }}
                        className={styles.textInput}
                        placeholder="Choose a username"
                        autoComplete="username"
                        required
                      />
                    </div>
                    {errors.username && <span className={styles.fieldError}>{errors.username}</span>}
                  </div>

                  {/* 2. Display Name */}
                  <div className={styles.inputGroup}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label className={styles.inputLabel} style={{ marginBottom: 0 }}>Display Name</label>
                      <span style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.4)', fontFamily: 'monospace' }}>{displayName.length}/20</span>
                    </div>
                    <div className={`${styles.inputWrapper} ${errors.displayName ? styles.inputWrapperError : ''}`} style={{ marginTop: '6px' }}>
                      <BadgeIcon />
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => {
                          setDisplayName(e.target.value);
                          setErrors(prev => ({ ...prev, displayName: null }));
                        }}
                        maxLength={20}
                        className={styles.textInput}
                        placeholder="Example: Zix"
                        autoComplete="name"
                        required
                      />
                    </div>
                    {errors.displayName && <span className={styles.fieldError}>{errors.displayName}</span>}
                  </div>

                  {/* 3. Email */}
                  <div className={styles.inputGroup}>
                    <label className={styles.inputLabel}>Email</label>
                    <div className={`${styles.inputWrapper} ${errors.email ? styles.inputWrapperError : ''}`}>
                      <EmailIcon />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setErrors(prev => ({ ...prev, email: null }));
                        }}
                        className={styles.textInput}
                        placeholder="Enter your email"
                        autoComplete="email"
                        required
                      />
                    </div>
                    {errors.email && <span className={styles.fieldError}>{errors.email}</span>}
                  </div>

                  {/* 4. Password */}
                  <div className={styles.inputGroup}>
                    <label className={styles.inputLabel}>Password</label>
                    <div className={`${styles.inputWrapper} ${errors.password ? styles.inputWrapperError : ''}`}>
                      <LockIcon />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setErrors(prev => ({ ...prev, password: null }));
                        }}
                        className={styles.textInput}
                        placeholder="Create a password"
                        autoComplete="new-password"
                        required
                      />
                      <button
                        type="button"
                        className={styles.eyeBtn}
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex="-1"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        <EyeIcon visible={showPassword} />
                      </button>
                    </div>
                    {errors.password && <span className={styles.fieldError}>{errors.password}</span>}
                  </div>

                  {/* 5. Confirm Password */}
                  <div className={styles.inputGroup}>
                    <label className={styles.inputLabel}>Confirm Password</label>
                    <div className={`${styles.inputWrapper} ${errors.confirmPassword ? styles.inputWrapperError : ''}`}>
                      <LockIcon />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          setErrors(prev => ({ ...prev, confirmPassword: null }));
                        }}
                        className={styles.textInput}
                        placeholder="Confirm your password"
                        autoComplete="new-password"
                        required
                      />
                      <button
                        type="button"
                        className={styles.eyeBtn}
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex="-1"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        <EyeIcon visible={showPassword} />
                      </button>
                    </div>
                    {errors.confirmPassword && <span className={styles.fieldError}>{errors.confirmPassword}</span>}
                  </div>

                  {errors.submit && (
                    <div className={styles.submitError}>{errors.submit}</div>
                  )}

                  <button
                    type="submit"
                    className={styles.submitBtn}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <div className={styles.spinner} />
                    ) : (
                      'Create Account'
                    )}
                  </button>

                  <div className={styles.divider} />

                  <div className={styles.switchTabBlock}>
                    <span>Already have an account?</span>
                    <button
                      type="button"
                      className={styles.switchTabBtn}
                      onClick={() => handleTabChange('signin')}
                    >
                      Sign In
                    </button>
                  </div>
                </>
              ) : (
                /* ── Forgot Password Tab ── */
                <>
                  <h2 className={styles.authTitle}>Reset Password</h2>
                  <p className={styles.authSubtitle}>Enter your username or email to receive password reset instructions.</p>

                  {/* Username / Email */}
                  <div className={styles.inputGroup}>
                    <label className={styles.inputLabel}>Username / Email</label>
                    <div className={`${styles.inputWrapper} ${errors.identifier ? styles.inputWrapperError : ''}`}>
                      <UserIcon />
                      <input
                        type="text"
                        value={identifier}
                        onChange={(e) => {
                          setIdentifier(e.target.value);
                          setErrors(prev => ({ ...prev, identifier: null }));
                        }}
                        className={styles.textInput}
                        placeholder="Enter username or email"
                        autoComplete="username"
                        required
                      />
                    </div>
                    {errors.identifier && <span className={styles.fieldError}>{errors.identifier}</span>}
                  </div>

                  {successMessage && (
                    <div className={styles.submitSuccess}>{successMessage}</div>
                  )}

                  {errors.submit && (
                    <div className={styles.submitError}>{errors.submit}</div>
                  )}

                  <button
                    type="submit"
                    className={styles.submitBtn}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <div className={styles.spinner} />
                    ) : (
                      'Send Reset Link'
                    )}
                  </button>

                  <div className={styles.divider} />

                  <div className={styles.switchTabBlock}>
                    <span>Remember your password?</span>
                    <button
                      type="button"
                      className={styles.switchTabBtn}
                      onClick={() => handleTabChange('signin')}
                    >
                      Back to Sign In
                    </button>
                  </div>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
