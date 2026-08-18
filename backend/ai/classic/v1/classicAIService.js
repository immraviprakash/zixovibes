import { getGroqCompletion } from '../../groqClient.js';
import { buildPrompt } from './promptBuilder.js';
import { loadConversation, saveConversation } from '../../conversationService.js';

/**
 * Sanitizes any raw markdown syntax (bold, headings, tables, asterisks)
 * from LLM output to produce a clean, conversational user-facing response.
 */
function cleanMarkdownSyntax(text) {
  if (!text || typeof text !== 'string') return '';

  let cleaned = text;

  // 1. Remove markdown code fences and backticks
  cleaned = cleaned.replace(/```[\s\S]*?```/g, (match) => {
    return match.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '');
  });
  cleaned = cleaned.replace(/`([^`]+)`/g, '$1');

  // 2. Remove markdown tables (separator rows like |---|---| or ||---||)
  cleaned = cleaned.replace(/^\s*\|?[\s\-:|]+\|?\s*$/gm, '');

  // 3. Convert markdown table data rows | col1 | col2 | to clean bullets or readable text
  cleaned = cleaned.replace(/^\s*\|\s*([^|\n]+?)\s*\|\s*([^|\n]+?)\s*\|\s*$/gm, '• $1: $2');
  cleaned = cleaned.replace(/^\s*\|(.*)\|\s*$/gm, (match, inner) => {
    const cells = inner.split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length === 0) return '';
    if (cells.length === 1) return `• ${cells[0]}`;
    return `• ${cells[0]}: ${cells.slice(1).join(' - ')}`;
  });

  // 4. Strip header hashes (# Header -> Header)
  cleaned = cleaned.replace(/^#{1,6}\s+(.*)$/gm, '$1');

  // 5. Convert bold/italic syntax (**text**, *text*, __text__, _text_)
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
  cleaned = cleaned.replace(/__([^_]+)__/g, '$1');

  // 6. Convert bullet asterisks or hyphens at start of lines (* item or - item -> • item)
  cleaned = cleaned.replace(/^[\s]*[\*\-]\s+/gm, '• ');

  // 7. Strip leftover stray asterisks or pipe characters at start/end of lines
  cleaned = cleaned.replace(/^\s*\|+|\s*\|+$/gm, '');

  // 8. Normalize multiple empty lines (max 2 consecutive newlines)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return cleaned.trim();
}

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

  // Request completion from GroqCloud using fast model and 4.5s timeout budget
  const rawAiResponse = await getGroqCompletion(messages, {
    stream: false,
    model: 'openai/gpt-oss-20b',
    max_completion_tokens: 350,
    timeoutMs: 4500
  });

  // Sanitize any raw markdown syntax
  const aiResponse = cleanMarkdownSyntax(rawAiResponse);

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
