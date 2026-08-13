import { getGroqCompletion } from '../../groqClient.js';
import { buildPlanningPrompt } from './promptBuilder.js';

/**
 * Service to execute Deep Focus Planning, Re-planning, and Task Insertion.
 * 
 * @param {Object} payload - The request payload containing action, rawInput, currentPlan, and availableTime.
 * @returns {Promise<Object>} - Contains planning result parsed as structured JSON.
 */
export async function processPlanningRequest(payload) {
  const { action, rawInput, currentPlan, availableTime = 120 } = payload;

  console.log(`[Planning Service] Prompt Created - Action: ${action}`);
  const messages = buildPlanningPrompt(action, rawInput, currentPlan, availableTime);

  let rawResponse;
  try {
    console.log(`[Planning Service] Groq Request Sent`);
    rawResponse = await getGroqCompletion(messages, {
      stream: false,
      temperature: 0.2, // Low temperature for consistent planning structure
      response_format: { type: 'json_object' }
    });
    console.log(`[Planning Service] Groq Response Received`);
  } catch (groqError) {
    console.error(`[Planning Service] Groq Request Failed:`, groqError.message || groqError);
    throw groqError;
  }

  // Clean rawResponse of any markdown code fence wrappers
  let cleanedResponse = rawResponse.trim();
  if (cleanedResponse.startsWith('```')) {
    cleanedResponse = cleanedResponse.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
  }

  try {
    const parsed = JSON.parse(cleanedResponse);
    console.log(`[Planning Service] Plan Parsed successfully`);
    
    // Validate schema basic properties
    if (parsed.needsClarification === undefined) {
      parsed.needsClarification = false;
    }

    if (parsed.plan && Array.isArray(parsed.plan.tasks)) {
      parsed.plan.tasks = parsed.plan.tasks.map(t => {
        const taskType = t.taskType || 'focus';
        const category = t.category || 'Deep Work';
        const workCategory = t.workCategory || category;
        const executionPriority = t.executionPriority || 'Medium';
        
        let pomodoroCount = 0;
        let pomodoros = [];
        let pomodoroDurations = [];
        let estimatedDuration = t.estimatedDuration || 0;

        if (taskType === 'focus') {
          pomodoroCount = typeof t.pomodoroCount === 'number' ? t.pomodoroCount : (t.pomodoros ? t.pomodoros.length : 1);
          if (pomodoroCount <= 0) pomodoroCount = 1;
          
          pomodoros = Array.isArray(t.pomodoros) ? t.pomodoros : [];
          if (pomodoros.length === 0) {
            pomodoros = [t.text || 'Focus Task'];
          }
          
          estimatedDuration = t.estimatedDuration || pomodoroCount * 25;
          pomodoroDurations = t.pomodoroDurations;
          if (!Array.isArray(pomodoroDurations) || pomodoroDurations.length !== pomodoroCount) {
            const avgDuration = Math.round(estimatedDuration / pomodoroCount);
            pomodoroDurations = Array(pomodoroCount).fill(avgDuration);
          }
        }

        return {
          ...t,
          taskType,
          category,
          workCategory,
          executionPriority,
          pomodoroCount,
          pomodoros,
          estimatedDuration,
          pomodoroDurations
        };
      });
    }
    
    return parsed;
  } catch (error) {
    console.error('[Planning Service] JSON parsing error on raw content:', rawResponse, error);
    
    // Fallback if parsing completely fails: ask a simple clarification
    return {
      needsClarification: true,
      clarificationQuestion: "I had trouble parsing the plan details. Could you please specify your tasks again clearly?",
      plan: null
    };
  }
}
