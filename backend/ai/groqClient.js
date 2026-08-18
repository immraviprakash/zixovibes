import dotenv from 'dotenv';
import path from 'path';

// Force dotenv to load from the specific backend directory
dotenv.config({ path: path.join(import.meta.dirname, '..', '.env') });

// In-memory key state manager for cooldowns
// Maps key value to a cooldown expiration timestamp
const keyCooldowns = new Map();

/**
 * Calls the GroqCloud Chat Completions endpoint.
 * Designed to support stream configuration for future integration passes.
 * Implements a robust multi-key failover system.
 * 
 * @param {Array} messages - The isolated prompt messages array.
 * @param {Object} options - Completion parameters (e.g. stream, temperature).
 */
export async function getGroqCompletion(messages, options = {}) {
  // Collect all unique non-empty configured keys
  const rawKeys = [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_KEY_1,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3
  ].map(k => k?.trim()).filter(Boolean);

  const keys = Array.from(new Set(rawKeys));

  if (keys.length === 0) {
    throw new Error('No valid Groq API Key is configured in backend/.env');
  }

  const { stream = false, temperature = 0.7, response_format, max_completion_tokens = 1500, model, timeoutMs = 4500, globalTimeoutMs = 4500 } = options;
  const modelName = model || process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
  const globalDeadline = Date.now() + globalTimeoutMs;

  // Order keys: try non-cooldowned keys first, keeping their relative order
  const now = Date.now();
  const availableKeysInfo = keys.map((key, index) => {
    const cooldown = keyCooldowns.get(key) || 0;
    const isCooldowned = cooldown > now;
    return { key, originalIndex: index + 1, isCooldowned, cooldown };
  });

  // Sort keys: non-cooldowned first, then cooldowned
  const orderedKeysInfo = [
    ...availableKeysInfo.filter(k => !k.isCooldowned),
    ...availableKeysInfo.filter(k => k.isCooldowned)
  ];

  let lastError = null;

  for (let attempt = 0; attempt < orderedKeysInfo.length; attempt++) {
    const remainingTime = globalDeadline - Date.now();
    if (remainingTime <= 300) {
      console.warn('[Groq Client] Global request budget exceeded. Terminating fallback sequence.');
      break;
    }

    const { key, originalIndex } = orderedKeysInfo[attempt];

    const makeRequest = async (targetModel) => {
      const remainingForAttempt = Math.min(timeoutMs, Math.max(300, globalDeadline - Date.now()));
      const payloadBody = {
        model: targetModel,
        messages,
        temperature,
        max_completion_tokens,
        stream
      };
      if (response_format) {
        payloadBody.response_format = response_format;
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), remainingForAttempt);

      let response;
      try {
        response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payloadBody),
          signal: controller.signal
        });
      } catch (fetchErr) {
        fetchErr.isNetworkError = true;
        throw fetchErr;
      } finally {
        clearTimeout(timer);
      }

      if (!response.ok) {
        const errorText = await response.text();
        const err = new Error(`Groq API returned error: ${response.status} - ${errorText}`);
        err.status = response.status;
        err.isProviderError = true;
        throw err;
      }

      const data = await response.json();
      return data.choices[0].message.content;
    };

    const tryRequest = async () => {
      try {
        return await makeRequest(modelName);
      } catch (err) {
        const remainingAfterPrimary = globalDeadline - Date.now();
        if (remainingAfterPrimary <= 400) {
          throw err;
        }

        const errMsg = err.message || '';
        const isRateLimit = errMsg.includes('429') || errMsg.includes('rate_limit') || errMsg.includes('limit reached') || err.status === 429;
        const isTimeout = err.name === 'AbortError' || errMsg.includes('aborted');

        if (isRateLimit || isTimeout) {
          const fallbackModel = modelName === 'llama-3.1-8b-instant' ? 'gemma2-9b-it' : 'llama-3.1-8b-instant';
          if (modelName !== fallbackModel) {
            console.warn(`[Groq Client] [Key Slot ${originalIndex}] Primary model ${modelName} ${isTimeout ? 'timed out' : 'rate limited'}. Retrying with fast fallback: ${fallbackModel}`);
            try {
              return await makeRequest(fallbackModel);
            } catch (fallbackErr) {
              const remainingAfterFallback = globalDeadline - Date.now();
              if (remainingAfterFallback <= 400) {
                throw fallbackErr;
              }
              const fallbackMsg = fallbackErr.message || '';
              if (fallbackMsg.includes('429') || fallbackMsg.includes('rate_limit') || fallbackErr.status === 429) {
                const secondFallback = 'llama-3.3-70b-versatile';
                console.warn(`[Groq Client] [Key Slot ${originalIndex}] Fallback model ${fallbackModel} rate limited. Retrying with second fallback: ${secondFallback}`);
                try {
                  return await makeRequest(secondFallback);
                } catch (_) {}
              }
              throw fallbackErr;
            }
          }
        }
        throw err;
      }
    };

    try {
      const result = await tryRequest();
      if (attempt > 0) {
        console.log(`[Groq Client] AI request succeeded using fallback key slot ${originalIndex}.`);
      }
      keyCooldowns.delete(key);
      return result;
    } catch (err) {
      lastError = err;

      // Determine if error is retryable
      const isRetryableStatus = err.status === 401 || err.status === 403 || err.status === 429 || (err.status >= 500 && err.status <= 599);
      const isTimeout = err.name === 'AbortError' || (err.message && err.message.includes('aborted'));
      const isRetryable = isTimeout || err.isNetworkError || (err.isProviderError && isRetryableStatus);

      if (isRetryable) {
        // Apply cooldown to this key (1 minute)
        keyCooldowns.set(key, Date.now() + 60000);

        console.warn(`[Groq Client] AI request failed for configured key slot ${originalIndex} (Status: ${err.status || err.name || 'Network Error'}). Attempting next key...`);
      } else {
        // Non-retryable application-level or request error
        console.error(`[Groq Client] Non-retryable request/application error encountered on key slot ${originalIndex}. Terminating fallback sequence.`);
        throw err;
      }
    }
  }

  // All keys exhausted or deadline hit
  console.error('[Groq Client] All configured API keys have been exhausted, failed, or exceeded deadline.');
  throw new Error("The AI service is temporarily busy. Please try again in a moment.");
}
