import fs from 'fs';
import path from 'path';

const systemPromptPath = path.join(import.meta.dirname, 'system_prompt.txt');
const systemPrompt = fs.readFileSync(systemPromptPath, 'utf8');

/**
 * Builds the isolated structured messages list to send to Groq for Deep Focus Planning.
 * 
 * @param {string} action - 'plan' | 'replan' | 'add_task'
 * @param {string} rawInput - The user's unstructured request/input text
 * @param {Object|null} currentPlan - The active focus plan state (if any)
 * @param {number} availableTime - The available session duration in minutes
 * @returns {Array} - The message payload array.
 */
export function buildPlanningPrompt(action, rawInput, currentPlan = null, availableTime = 120) {
  const userPayload = {
    action,
    rawInput: rawInput || "",
    currentPlan,
    availableTime
  };

  return [
    {
      role: 'system',
      content: systemPrompt
    },
    {
      role: 'user',
      content: JSON.stringify(userPayload, null, 2)
    }
  ];
}
