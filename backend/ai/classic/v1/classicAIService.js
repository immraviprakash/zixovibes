import { getGroqCompletion } from '../../groqClient.js';
import { buildPrompt } from './promptBuilder.js';
import { loadConversation, saveConversation } from '../../conversationService.js';

/**
 * Main service logic orchestrator for Zix'Ovibes Classic AI v1.
 * 
 * @param {Object} payload - The chat request payload.
 * @returns {Promise<Object>} - Contains completion response and updated message history.
 */
export async function processUserMessage(payload) {
  const { userId, userMessage, context, library, localHistory, mode } = payload;

  // Use the frontend-provided history context directly for stateless completion
  const conversationHistory = localHistory || [];

  // Construct structured messages layer
  const appContext = { mode, context, library };
  const messages = buildPrompt(conversationHistory, userMessage, appContext);

  // Request completion from GroqCloud
  const aiResponse = await getGroqCompletion(messages, { stream: false });

  // Append new exchange to history
  const updatedHistory = [
    ...conversationHistory,
    { sender: 'user', message: userMessage, timestamp: new Date().toISOString() },
    { sender: 'ai', message: aiResponse, timestamp: new Date().toISOString() }
  ];

  return {
    response: aiResponse,
    history: updatedHistory
  };
}
