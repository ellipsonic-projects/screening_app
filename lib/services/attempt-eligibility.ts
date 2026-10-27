import { isEligibilityCategory, isPersonalityCategory } from '@/lib/categories';

/**
 * Determines whether a student's answer constitutes an attempted response.
 * An attempt is counted regardless of correctness, but blank or unselected responses are excluded.
 */
export function isQuestionAttempted(answer: string | null | undefined, questionType?: string): boolean {
  if (answer === null || answer === undefined) return false;
  const trimmed = String(answer).trim();
  if (trimmed.length === 0) return false;

  // Handle JSON-encoded structures (multi_select, ranking)
  if (trimmed === '[]' || trimmed === '{}') return false;

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.length > 0 && parsed.some(item => item !== null && item !== undefined && String(item).trim().length > 0);
      }
      if (typeof parsed === 'object' && parsed !== null) {
        return Object.keys(parsed).length > 0;
      }
    } catch {
      // If it fails JSON parsing, any non-empty string is counted as attempted
      return true;
    }
  }

  return true;
}

export interface AttemptEligibilityResult {
  isEligible: boolean;
  applicableQuestionsCount: number;
  attemptedCount: number;
  requiredAttempts: number;
  minPercentage: number;
  enabled: boolean;
  percentageAttempted: number;
}

/**
 * Calculates whether an attempt meets the required percentage threshold using ceiling rounding.
 * E.g., 35 applicable questions at 60% requires Math.ceil(35 * 60 / 100) = 21 attempts.
 */
export function calculateAttemptEligibility(params: {
  applicableQuestionsCount: number;
  attemptedCount: number;
  minPercentage?: number | null;
  enabled?: boolean | null;
}): AttemptEligibilityResult {
  const enabled = params.enabled !== false;
  const minPercentage = typeof params.minPercentage === 'number' && params.minPercentage >= 0 ? params.minPercentage : 60;
  const applicableQuestionsCount = Math.max(0, params.applicableQuestionsCount);
  const attemptedCount = Math.max(0, params.attemptedCount);

  // Ceiling rounding as required: Math.ceil(applicableQuestionsCount * minPercentage / 100)
  const requiredAttempts = Math.ceil((applicableQuestionsCount * minPercentage) / 100);

  const percentageAttempted = applicableQuestionsCount > 0
    ? parseFloat(((attemptedCount / applicableQuestionsCount) * 100).toFixed(2))
    : 100;

  const isEligible = !enabled || applicableQuestionsCount === 0 || attemptedCount >= requiredAttempts;

  return {
    isEligible,
    applicableQuestionsCount,
    attemptedCount,
    requiredAttempts,
    minPercentage,
    enabled,
    percentageAttempted
  };
}

/**
 * Assesses attempt eligibility from full test context and submitted responses.
 * Strictly excludes Eligibility & Logistics and Personality questions from both denominator and attempted count.
 */
export function assessTestAttemptEligibility(
  testQuestions: Array<{ question: { id: string; section?: string | null; type?: string | null } }>,
  existingResponses?: Array<{ question_id: string; student_answer?: string | null }>,
  newResponses?: Array<{ questionId: string; answer?: string | null }>,
  options?: { minPercentage?: number | null; enabled?: boolean | null }
): AttemptEligibilityResult {
  // 1. Exclude Eligibility & Logistics and Personality questions from denominator
  const applicableQuestions = testQuestions.filter(
    tq => tq.question && !isEligibilityCategory(tq.question.section) && !isPersonalityCategory(tq.question.section)
  );
  const applicableQuestionsCount = applicableQuestions.length;

  // 2. Build map of latest student answers
  const answerMap = new Map<string, { answer: string | null | undefined; type?: string }>();

  if (existingResponses) {
    for (const er of existingResponses) {
      if (er.question_id) {
        answerMap.set(er.question_id, { answer: er.student_answer });
      }
    }
  }

  if (newResponses) {
    for (const nr of newResponses) {
      if (nr.questionId) {
        answerMap.set(nr.questionId, { answer: nr.answer });
      }
    }
  }

  // 3. Count valid attempts across applicable questions only
  let attemptedCount = 0;
  for (const tq of applicableQuestions) {
    const qId = tq.question.id;
    const ansObj = answerMap.get(qId);
    if (ansObj && isQuestionAttempted(ansObj.answer, tq.question.type || undefined)) {
      attemptedCount++;
    }
  }

  return calculateAttemptEligibility({
    applicableQuestionsCount,
    attemptedCount,
    minPercentage: options?.minPercentage,
    enabled: options?.enabled
  });
}
