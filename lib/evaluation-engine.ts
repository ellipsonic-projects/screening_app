import { EvaluationRequest, EvaluationResponse } from '@/types';
import { getEvaluationPrompt } from './prompts/evaluation-templates';

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const PRIMARY_MODEL = 'openai/gpt-oss-120b';
const FALLBACK_MODEL = 'google/gemini-3-flash-preview';
const DEFAULT_TIMEOUT_MS = 35000;
const MAX_RETRIES = 2;
const MAX_EVALUATION_TOKENS = 1500;

/**
 * Core AI Evaluation Engine powered by OpenRouter
 * Purely responsible for evaluating an answer using an LLM via OpenRouter.
 * Uses OpenRouter native model fallback routing ('models' array).
 * Fully decoupled from persistence (Prisma) and queue/execution layers.
 */
export async function evaluateAnswer(request: EvaluationRequest): Promise<EvaluationResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.GROQ_API_KEY;
  if (!apiKey) {
    return createFailedResponse(request, 'OPENROUTER_API_KEY is not configured on the server.');
  }

  const prompt = getEvaluationPrompt(request);
  const models = [PRIMARY_MODEL, FALLBACK_MODEL];

  let lastErrorMsg = '';
  let textContent = '';
  let modelUsed = PRIMARY_MODEL;
  let apiSuccess = false;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(
        `[AI Evaluation Engine] Calling OpenRouter (Attempt ${attempt}/${MAX_RETRIES}) for Question ${request.questionId} using models [${models.join(', ')}] with max_tokens: ${MAX_EVALUATION_TOKENS}`
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

        // Non-retryable client errors (e.g., 401 Unauthorized, 402 Payment Required, 403 Forbidden)
        if (response.status === 401 || response.status === 402 || response.status === 403) {
          break;
        }

        // For retryable errors (429 or 5xx), apply backoff before next attempt
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
        apiSuccess = true;
        break;
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

  if (!apiSuccess || !textContent) {
    return createFailedResponse(request, `API Error: ${lastErrorMsg}`);
  }

  const result = parseLLMResponse(request, textContent, modelUsed);

  console.log('[AI RESULT]', {
    questionId: request.questionId,
    modelUsed: result.modelUsed,
    success: result.success,
    score: result.score,
    status: result.evaluationStatus,
  });

  return result;
}

function parseLLMResponse(request: EvaluationRequest, textContent: string, modelUsed: string): EvaluationResponse {
  let cleanedText = textContent.replace(/```json/gi, '').replace(/```/g, '').trim();

  try {
    const aiResult = JSON.parse(cleanedText);

    // Validate that output is a valid JSON object
    if (typeof aiResult !== 'object' || aiResult === null) {
      throw new Error('AI response is not a valid JSON object');
    }

    // Map backwards compatibility for older coding evaluations that might return "marksAwarded"
    const rawScore = aiResult.score ?? aiResult.marksAwarded;
    if (rawScore === undefined || rawScore === null || isNaN(Number(rawScore))) {
      throw new Error('AI response missing valid score/marksAwarded property');
    }

    const parsedScore = Number(rawScore);
    const cappedScore = Math.min(Math.max(parsedScore, 0), request.maxMarks);

    return {
      questionId: request.questionId,
      score: cappedScore,
      maximumMarks: request.maxMarks,
      feedback: aiResult.feedback || 'No feedback provided.',
      strengths: Array.isArray(aiResult.strengths) ? aiResult.strengths : [],
      improvements: Array.isArray(aiResult.suggestions)
        ? aiResult.suggestions
        : Array.isArray(aiResult.improvements)
        ? aiResult.improvements
        : [],
      evaluationStatus: 'COMPLETED',
      evaluatedAt: new Date().toISOString(),
      modelUsed,
      rawJson: {
        ...aiResult,
        detectedLanguage: aiResult.detectedLanguage,
        codingEvaluationStatus: aiResult.evaluationStatus,
        mistakes: Array.isArray(aiResult.mistakes) ? aiResult.mistakes : [],
        weaknesses: Array.isArray(aiResult.weaknesses) ? aiResult.weaknesses : [],
        deductionReasons: Array.isArray(aiResult.deductionReasons) ? aiResult.deductionReasons : [],
        suggestions: Array.isArray(aiResult.suggestions) ? aiResult.suggestions : [],
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

function createFailedResponse(request: EvaluationRequest, errorMsg: string): EvaluationResponse {
  return {
    questionId: request.questionId,
    score: 0,
    maximumMarks: request.maxMarks,
    feedback: '',
    strengths: [],
    improvements: [],
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
