import { EvaluationRequest, EvaluationResponse, CriterionEvaluation } from '@/types';
import { getEvaluationPrompt } from './prompts/evaluation-templates';
import { canonicalizeCategory } from '@/lib/categories';
import { getCriteriaForQuestion, allocateCriterionMarks } from '@/lib/evaluation/criteria-registry';

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const PRIMARY_MODEL = 'openai/gpt-oss-120b';
const FALLBACK_MODEL = 'google/gemini-3-flash-preview';
const DEFAULT_TIMEOUT_MS = 35000;
const MAX_RETRIES = 2;
const MAX_EVALUATION_TOKENS = 1500;

/**
 * Core AI Evaluation Engine powered by OpenRouter
 * Evaluates subjective answers using category-specific and question-type-specific criteria.
 * Fully decoupled from persistence (Prisma) and queue/execution layers.
 */
export async function evaluateAnswer(request: EvaluationRequest): Promise<EvaluationResponse> {
  // Short-circuit blank answers: award 0 marks, status COMPLETED, 0 LLM token consumption
  if (!request.studentAnswer || request.studentAnswer.trim().length === 0) {
    const canonicalCategory = canonicalizeCategory(request.section);
    const expectedCriteria = getCriteriaForQuestion(canonicalCategory, request.questionType);
    let zeroCriteria: CriterionEvaluation[] = [];

    if (expectedCriteria && expectedCriteria.length > 0) {
      const allocated = allocateCriterionMarks(expectedCriteria, request.maxMarks);
      zeroCriteria = allocated.map(c => ({
        id: c.id,
        name: c.name,
        score: 0,
        maxScore: c.maxScore,
        explanation: 'No answer provided.'
      }));
    }

    return {
      questionId: request.questionId,
      score: 0,
      maximumMarks: request.maxMarks,
      feedback: 'No answer provided.',
      strengths: [],
      improvements: ['Provide an answer to be evaluated.'],
      deductionReasons: ['Answer was left blank.'],
      criteriaScores: zeroCriteria,
      evaluationStatus: 'COMPLETED',
      evaluatedAt: new Date().toISOString(),
      modelUsed: 'none',
      rawJson: {
        score: 0,
        marksAwarded: 0,
        criteriaScores: zeroCriteria,
        feedback: 'No answer provided.',
        strengths: [],
        improvements: ['Provide an answer to be evaluated.'],
        deductionReasons: ['Answer was left blank.'],
        evaluationStatus: 'Incorrect'
      },
      success: true
    };
  }

  const apiKey = process.env.OPENROUTER_API_KEY || process.env.GROQ_API_KEY;
  if (!apiKey) {
    return createFailedResponse(request, 'OPENROUTER_API_KEY is not configured on the server.');
  }

  let prompt = '';
  try {
    prompt = getEvaluationPrompt(request);
  } catch (promptErr: any) {
    console.warn(`[AI Evaluation Engine] Prompt selection error: ${promptErr.message}`);
    return createFailedResponse(request, `Prompt Selection Error: ${promptErr.message}`);
  }

  const models = [PRIMARY_MODEL, FALLBACK_MODEL];

  let lastErrorMsg = '';
  let textContent = '';
  let modelUsed = PRIMARY_MODEL;
  let apiSuccess = false;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(
        `[AI Evaluation Engine] Calling OpenRouter (Attempt ${attempt}/${MAX_RETRIES}) for Question ${request.questionId} [${request.section || 'General'}:${request.questionType}] using models [${models.join(', ')}]`
      );

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

      const response = await fetch(OPENROUTER_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://elliphire.com',
          'X-Title': 'EllipHire Assessment Platform',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          models: models,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: MAX_EVALUATION_TOKENS,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        let parsedErrorMessage = `HTTP ${response.status} ${response.statusText}`;
        try {
          const errJson = JSON.parse(errorBody);
          if (errJson?.error?.message) {
            parsedErrorMessage += `: ${errJson.error.message}`;
          }
        } catch {
          if (errorBody) {
            parsedErrorMessage += `: ${errorBody.slice(0, 200)}`;
          }
        }

        lastErrorMsg = `OpenRouter API error: ${parsedErrorMessage}`;
        console.warn(`[AI Evaluation Engine] Request failed: ${lastErrorMsg}`);

        // Non-retryable client errors (401, 402, 403)
        if (response.status === 401 || response.status === 402 || response.status === 403) {
          break;
        }

        // Retryable errors (429 or 5xx)
        if (attempt < MAX_RETRIES) {
          const backoffMs = attempt * 1500;
          await new Promise((res) => setTimeout(res, backoffMs));
          continue;
        }
        break;
      }

      const data = await response.json();
      textContent = data.choices?.[0]?.message?.content || '';
      modelUsed = data.model || PRIMARY_MODEL;

      if (textContent) {
        // Attempt parsing immediately to validate structure on this attempt
        const parsedResult = parseLLMResponse(request, textContent, modelUsed);
        if (parsedResult.success) {
          apiSuccess = true;
          return parsedResult;
        } else {
          lastErrorMsg = parsedResult.error || 'Parsed response was invalid';
          console.warn(`[AI Evaluation Engine] Parse/validation error on attempt ${attempt}: ${lastErrorMsg}`);
        }
      } else {
        lastErrorMsg = `Empty response content from OpenRouter (model: ${modelUsed})`;
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        lastErrorMsg = `OpenRouter request timed out after ${DEFAULT_TIMEOUT_MS / 1000}s`;
      } else {
        lastErrorMsg = `Network/Fetch error: ${err.message || err}`;
      }
      console.warn(`[AI Evaluation Engine] Exception on attempt ${attempt}: ${lastErrorMsg}`);

      if (attempt < MAX_RETRIES) {
        const backoffMs = attempt * 1500;
        await new Promise((res) => setTimeout(res, backoffMs));
      }
    }
  }

  return createFailedResponse(request, `API/Validation Error: ${lastErrorMsg}`);
}

export function parseLLMResponse(
  request: EvaluationRequest,
  textContent: string,
  modelUsed: string
): EvaluationResponse {
  let cleanedText = textContent.replace(/```json/gi, '').replace(/```/g, '').trim();

  try {
    const aiResult = JSON.parse(cleanedText);

    // Validate valid JSON object
    if (typeof aiResult !== 'object' || aiResult === null) {
      throw new Error('AI response is not a valid JSON object');
    }

    // Retrieve expected criteria for this category & question type
    const canonicalCategory = canonicalizeCategory(request.section);
    const expectedCriteria = getCriteriaForQuestion(canonicalCategory, request.questionType);

    let validatedCriteriaScores: CriterionEvaluation[] = [];
    let calculatedTotal = 0;

    if (expectedCriteria && expectedCriteria.length > 0) {
      const allocatedCriteria = allocateCriterionMarks(expectedCriteria, request.maxMarks);
      const rawCriteriaList = aiResult.criteria;

      if (!Array.isArray(rawCriteriaList) || rawCriteriaList.length === 0) {
        throw new Error('AI response missing required "criteria" array breakdown');
      }

      // Check for duplicate criteria
      const seenIds = new Set<string>();
      for (const item of rawCriteriaList) {
        if (!item || typeof item !== 'object') {
          throw new Error('Criterion item is not a valid object');
        }
        const id = String(item.id || '').trim();
        if (!id) throw new Error('Criterion item missing id');
        if (seenIds.has(id)) {
          throw new Error(`Duplicate criterion "${id}" returned in AI response`);
        }
        seenIds.add(id);
      }

      // Validate each expected criterion is present and no unknown criteria
      const expectedIdSet = new Set(allocatedCriteria.map(c => c.id));
      for (const id of seenIds) {
        if (!expectedIdSet.has(id)) {
          throw new Error(`Unknown criterion "${id}" returned in AI response`);
        }
      }

      for (const expected of allocatedCriteria) {
        const found = rawCriteriaList.find((item: any) => String(item.id || '').trim() === expected.id);
        if (!found) {
          throw new Error(`Missing required criterion "${expected.id}" in AI response`);
        }

        const criterionScoreNum = Number(found.score);
        if (typeof found.score === 'boolean' || isNaN(criterionScoreNum) || !isFinite(criterionScoreNum)) {
          throw new Error(`Criterion "${expected.id}" score must be a finite number`);
        }

        if (criterionScoreNum < 0) {
          throw new Error(`Criterion "${expected.id}" score cannot be negative (got ${criterionScoreNum})`);
        }

        if (criterionScoreNum > expected.maxScore + 0.05) {
          throw new Error(
            `Criterion "${expected.id}" score (${criterionScoreNum}) exceeds maximum allowed (${expected.maxScore})`
          );
        }

        const clampedScore = Math.min(Math.max(criterionScoreNum, 0), expected.maxScore);
        const roundedScore = Math.round(clampedScore * 10) / 10;
        calculatedTotal = Math.round((calculatedTotal + roundedScore) * 10) / 10;

        validatedCriteriaScores.push({
          id: expected.id,
          name: expected.name,
          score: roundedScore,
          maxScore: expected.maxScore,
          explanation: found.explanation || found.reasoning || found.feedback || 'Criterion evaluated.'
        });
      }

      // Validate reported total vs calculated sum
      const reportedScoreRaw = aiResult.score ?? aiResult.marksAwarded;
      if (reportedScoreRaw !== undefined && reportedScoreRaw !== null) {
        const reportedScoreNum = Number(reportedScoreRaw);
        if (!isNaN(reportedScoreNum) && isFinite(reportedScoreNum)) {
          if (Math.abs(reportedScoreNum - calculatedTotal) > 0.5) {
            throw new Error(
              `Criterion scores sum (${calculatedTotal}) does not match reported total score (${reportedScoreNum})`
            );
          }
        }
      }
    } else {
      // Fallback for legacy requests without predefined category criteria
      const rawScore = aiResult.score ?? aiResult.marksAwarded;
      if (rawScore === undefined || rawScore === null || isNaN(Number(rawScore))) {
        throw new Error('AI response missing valid score/marksAwarded property');
      }
      calculatedTotal = Math.min(Math.max(Number(rawScore), 0), request.maxMarks);
    }

    const finalScore = Math.min(Math.max(calculatedTotal, 0), request.maxMarks);
    const deductions = Array.isArray(aiResult.deductionReasons)
      ? aiResult.deductionReasons
      : (Array.isArray(aiResult.mistakes) ? aiResult.mistakes : []);

    return {
      questionId: request.questionId,
      score: finalScore,
      maximumMarks: request.maxMarks,
      feedback: aiResult.feedback || 'No feedback provided.',
      strengths: Array.isArray(aiResult.strengths) ? aiResult.strengths : [],
      improvements: Array.isArray(aiResult.improvements)
        ? aiResult.improvements
        : Array.isArray(aiResult.suggestions)
        ? aiResult.suggestions
        : [],
      deductionReasons: deductions,
      criteriaScores: validatedCriteriaScores,
      evaluationStatus: 'COMPLETED',
      evaluatedAt: new Date().toISOString(),
      modelUsed,
      rawJson: {
        ...aiResult,
        criteriaScores: validatedCriteriaScores,
        score: finalScore,
        marksAwarded: finalScore,
        deductionReasons: deductions,
        codingEvaluationStatus: aiResult.evaluationStatus,
        detectedLanguage: aiResult.detectedLanguage,
      },
      success: true,
    };
  } catch (parseError: any) {
    console.error(`[AI Parser Error] Failed to parse response for Question ${request.questionId}:`, parseError.message);
    return {
      ...createFailedResponse(request, `Failed to parse AI response: ${parseError.message}`),
      rawJson: { raw_response: textContent, parse_error: parseError.message },
    };
  }
}

export function createFailedResponse(request: EvaluationRequest, errorMsg: string): EvaluationResponse {
  return {
    questionId: request.questionId,
    score: 0,
    maximumMarks: request.maxMarks,
    feedback: '',
    strengths: [],
    improvements: [],
    deductionReasons: [],
    criteriaScores: [],
    evaluationStatus: 'FAILED',
    evaluatedAt: new Date().toISOString(),
    error: errorMsg,
    rawJson: {
      error: errorMsg,
      status: 'FAILED',
      evaluatedAt: new Date().toISOString(),
    },
    success: false,
  };
}
