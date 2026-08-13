import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { processUserMessage } from './ai/classic/v1/classicAIService.js';
import { clearConversation, loadConversation } from './ai/conversationService.js';
import { processPlanningRequest } from './ai/deepfocus/v1/planningService.js';
import { adminDb } from './firebaseAdmin.js';

dotenv.config({ path: path.join(import.meta.dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// In production, ALLOWED_ORIGINS should be set to the deployed frontend URL(s).
// Example: ALLOWED_ORIGINS=https://zixovibes.netlify.app
// Multiple origins can be comma-separated.
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:4173'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no Origin header (curl, Render healthcheck, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true
}));
app.use(express.json());

// Auth Router for username verification and lookup
const authRouter = express.Router();

// Endpoint to resolve username to email securely (unauthenticated guest allowed)
authRouter.post('/resolve-username', async (req, res) => {
  const { username } = req.body;
  if (!username || typeof username !== 'string' || !username.trim()) {
    return res.status(400).json({ error: 'Username is required.' });
  }

  if (!adminDb) {
    console.error("[Backend Server] Firebase Admin is not initialized.");
    return res.status(500).json({ error: 'Authentication service configuration error.' });
  }

  try {
    const usernameKey = username.trim().toLowerCase();
    const docRef = adminDb.collection('usernames').doc(usernameKey);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      // Return a controlled generic authentication failure message
      return res.status(404).json({ error: 'Invalid username or email.' });
    }

    const data = docSnap.data();
    if (!data || !data.email) {
      return res.status(404).json({ error: 'Invalid username or email.' });
    }

    // Return only the minimum identifier required
    res.json({ email: data.email });
  } catch (error) {
    console.error('[Backend Server] Resolve username error:', error);
    res.status(500).json({ error: 'Temporary authentication failure.' });
  }
});

// Endpoint to check username uniqueness atomically
authRouter.post('/check-username', async (req, res) => {
  const { username } = req.body;
  if (!username || typeof username !== 'string' || !username.trim()) {
    return res.status(400).json({ error: 'Username is required.' });
  }

  if (!adminDb) {
    console.error("[Backend Server] Firebase Admin is not initialized.");
    return res.status(500).json({ error: 'Authentication service configuration error.' });
  }

  try {
    const usernameKey = username.trim().toLowerCase();
    const docRef = adminDb.collection('usernames').doc(usernameKey);
    const docSnap = await docRef.get();

    res.json({ available: !docSnap.exists });
  } catch (error) {
    console.error('[Backend Server] Check username error:', error);
    res.status(500).json({ error: 'Temporary validation failure.' });
  }
});

// Endpoint to reserve username securely via Admin SDK (bypasses direct client write rules)
authRouter.post('/reserve-username', async (req, res) => {
  const { username, email, uid } = req.body;
  if (!username || !email || !uid) {
    return res.status(400).json({ error: 'Username, email, and uid are required.' });
  }

  if (!adminDb) {
    console.error("[Backend Server] Firebase Admin is not initialized.");
    return res.status(500).json({ error: 'Authentication service configuration error.' });
  }

  try {
    const usernameKey = username.trim().toLowerCase();
    const docRef = adminDb.collection('usernames').doc(usernameKey);
    const docSnap = await docRef.get();

    if (docSnap.exists && docSnap.data().uid !== uid) {
      return res.status(400).json({ error: 'Username already taken.' });
    }

    const nowIso = new Date().toISOString();
    await docRef.set({
      uid,
      email: email.trim().toLowerCase(),
      username: username.trim(),
      createdAt: nowIso
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[Backend Server] Reserve username error:', error);
    res.status(500).json({ error: 'Temporary reservation failure.' });
  }
});

// Mount auth router under /api/auth prefix
app.use('/api/auth', authRouter);

// Endpoint to post a new chat message
app.post('/api/ai/chat', async (req, res) => {
  const { userId, userMessage, context, library, localHistory, mode } = req.body;

  if (!userMessage || typeof userMessage !== 'string' || !userMessage.trim()) {
    return res.status(400).json({ error: 'Message content (userMessage) is required.' });
  }

  try {
    const result = await processUserMessage({
      userId,
      userMessage,
      context,
      library,
      localHistory,
      mode: mode || 'classic'
    });
    res.json(result);
  } catch (error) {
    console.error('[Backend Server] Chat handler error:', error);
    res.status(500).json({ error: "I'm having a little trouble responding right now. Please try again in a moment." });
  }
});

// Endpoint to handle Deep Focus planning requests
app.post('/api/ai/df/plan', async (req, res) => {
  const { action, rawInput, currentPlan, availableTime } = req.body;
  console.log(`[Backend Server] Incoming Request - Action: ${action || 'plan'}`);

  if (action === 'plan' && (!rawInput || typeof rawInput !== 'string' || !rawInput.trim())) {
    console.warn('[Backend Server] Incoming Request Validation Failed: Missing rawInput');
    return res.status(400).json({ error: 'Goal description (rawInput) is required for initial planning.' });
  }

  try {
    const result = await processPlanningRequest({
      action: action || 'plan',
      rawInput,
      currentPlan,
      availableTime: availableTime || 120
    });
    console.log(`[Backend Server] Response Sent successfully for Action: ${action || 'plan'}`);
    res.json(result);
  } catch (error) {
    console.error('[Backend Server] Planning handler error:', error);
    res.status(500).json({ error: "Unable to generate your focus plan right now. Please try again in a moment." });
  }
});

// Endpoint to fetch existing conversation history
app.post('/api/ai/history', async (req, res) => {
  const { userId } = req.body;

  if (!userId || userId === 'guest') {
    return res.json({ history: [] });
  }

  try {
    const history = await loadConversation(userId);
    res.json({ history });
  } catch (error) {
    console.error('[Backend Server] History fetch error:', error);
    res.status(500).json({ error: `AI Service Error: ${error.message}` });
  }
});

// Endpoint to permanently clear a user's conversation history
app.post('/api/ai/clear', async (req, res) => {
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID (userId) is required to clear conversation.' });
  }

  try {
    await clearConversation(userId);
    res.json({ success: true });
  } catch (error) {
    console.error('[Backend Server] Clear handler error:', error);
    res.status(500).json({ error: `Database Error: ${error.message}` });
  }
});

// healthcheck check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Zix'Ovibes Backend] Server listening on port ${PORT}`);
});
