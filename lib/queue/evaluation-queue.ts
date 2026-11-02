import { processBackgroundEvaluations } from '../services/evaluation-pipeline';

export interface EvaluationJobPayload {
  testId: string;
  evalPayloads: {
    questionId: string;
    studentAnswer: string;
  }[];
}

/**
 * Executes AI Evaluation asynchronously without requiring a Redis server.
 * This fixes the root cause where missing local Redis caused evaluations to silently fail.
 */
export async function enqueueEvaluationJob(testId: string, evalPayloads: EvaluationJobPayload['evalPayloads']) {
  if (!testId || typeof testId !== 'string') {
    console.error(`[Queue Error] Invalid or missing testId: ${testId}`);
    return;
  }

  if (!evalPayloads || evalPayloads.length === 0) return;

  console.log(`[Queue] Starting background evaluation for Test ${testId} with ${evalPayloads.length} questions.`);
  
  // Attach testId to each payload item so processBackgroundEvaluations receives testId
  const mappedPayloads = evalPayloads.map(p => ({
    testId,
    questionId: p.questionId,
    studentAnswer: p.studentAnswer
  }));

  // Execute asynchronously but wait for it to finish so Next.js doesn't kill the context
  try {
    await processBackgroundEvaluations(mappedPayloads, testId);
  } catch (err) {
    console.error(`[Background Worker Error] Test ${testId}:`, err);
  }
}
