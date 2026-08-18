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

/**
 * Custom fetch wrapper that supports abort-based timeout and fast automatic retry on transient server-side errors.
 *
 * @param {string} url - Target endpoint
 * @param {object} options - Fetch options (method, headers, body, signal)
 * @param {number} timeoutMs - Timeout duration in ms (default 15s)
 * @param {number} maxRetries - Maximum number of retries (default 1)
 */
export async function fetchWithTimeoutAndRetry(url, options = {}, timeoutMs = 15000, maxRetries = 1) {
  let attempt = 0;
  
  while (attempt <= maxRetries) {
    const controller = new AbortController();
    const { signal } = controller;
    
    // Wire up parent abort signal if provided
    if (options.signal) {
      if (options.signal.aborted) {
        throw new DOMException('Aborted by parent signal', 'AbortError');
      }
      options.signal.addEventListener('abort', () => controller.abort());
    }

    const timer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(url, { ...options, signal });
      clearTimeout(timer);
      
      // Fast retry for transient server cold starts (502 / 503 / 504)
      if (response.status >= 500 && attempt < maxRetries) {
        attempt++;
        console.warn(`[API Client] Transient server error (${response.status}). Retrying... (Attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 800));
        continue;
      }
      
      return response;
    } catch (err) {
      clearTimeout(timer);
      
      // Do not retry if the parent client specifically aborted (user cancellation/unmount)
      if (options.signal?.aborted) {
        throw err;
      }
      
      // Fast retry once on network disconnect / Render cold-start connection failure
      if (attempt < maxRetries) {
        attempt++;
        console.warn(`[API Client] Network failure or timeout. Retrying... (Attempt ${attempt}/${maxRetries})`, err);
        await new Promise(resolve => setTimeout(resolve, 800));
        continue;
      }
      
      throw err;
    }
  }
}

