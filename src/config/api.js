/**
 * Central API base URL.
 *
 * Development:  set VITE_API_URL=http://localhost:3001 in a root .env file (git-ignored).
 * Production:   set VITE_API_URL=<Render backend URL> as a Netlify environment variable.
 *
 * Falls back to http://localhost:3001 when the variable is not defined so that
 * local development works out of the box without any .env setup.
 */
export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
