import prisma from '@/lib/prisma';
import { evaluateAnswer } from '@/lib/evaluation-engine';
import { recalculateTestScore } from '@/lib/services/score-calculation';
import { EvaluationRequest } from '@/types';

export interface BackgroundEvalPayload {
  testId?: string;
  questionId: string;
  studentAnswer: string;
}

/**
 * Executes AI evaluations in the background.
 * Processes each submission, interacts with the Evaluation Engine,
 * updates the DB with structured results, and recalculates the total test score.
 */
export async function processBackgroundEvaluations(
  payloads: BackgroundEvalPayload[],
  fallbackTestId?: string
) {
  if (!payloads || payloads.length === 0) return;

  const testId = fallbackTestId || payloads[0]?.testId;

  if (!testId || typeof testId !== 'string') {
    console.error(`[Background Evaluation Validation Error] Missing or invalid testId: ${testId}`);
    return;
  }

  try {
    const test = await prisma.test.findUnique({ where: { id: testId } });
    if (!test) {
      console.warn(`[Background Evaluation] Test not found for ID: ${testId}`);
      return;
    }

    for (const payload of payloads) {
      const { questionId, studentAnswer } = payload;

      try {
        const existingResponse = await prisma.testResponse.findFirst({
          where: { test_id: testId, question_id: questionId }
        });

        if (existingResponse) {
          await prisma.testResponse.update({
            where: { id: existingResponse.id },
            data: {
              evaluation_status: 'PROCESSING',
              ai_evaluation_json: { evaluationStatus: 'PROCESSING', evaluatedAt: new Date().toISOString() }
            }
          });
        }

        const question = await prisma.question.findUnique({ where: { id: questionId } });
        if (!question) {
          console.warn(`[Background Evaluation] Question ${questionId} not found in DB`);
          continue;
        }

        const pts = question.points || 0;
        
        const evaluationRequest: EvaluationRequest = {
          questionId: question.id,
          section: question.section || undefined,
          questionType: question.type as string,
          question: question.question_text,
          studentAnswer: String(studentAnswer || ''),
          maxMarks: pts,
        };

        const evaluationResponse = await evaluateAnswer(evaluationRequest);

        let pointsEarnedToSave: number | null = null;
        let finalStatus: any = 'FAILED';

        if (evaluationResponse.success) {
          pointsEarnedToSave = evaluationResponse.score;
          finalStatus = 'COMPLETED';
        } else {
          console.error(`[Background Evaluation] Evaluation returned failure for Question ${questionId}:`, evaluationResponse.error);
          pointsEarnedToSave = null;
          finalStatus = evaluationResponse.evaluationStatus === 'RETRYING' ? 'RETRYING' : 'FAILED';
        }

        if (existingResponse) {
          await prisma.testResponse.update({
            where: { id: existingResponse.id },
            data: {
              points_earned: pointsEarnedToSave,
              is_correct: pointsEarnedToSave === pts,
              evaluation_status: finalStatus,
              ai_evaluation_json: evaluationResponse as any
            }
          });

          await prisma.aIEvaluation.upsert({
            where: { test_response_id: existingResponse.id },
            update: {
              obtained_marks: pointsEarnedToSave,
              maximum_marks: pts,
              feedback: evaluationResponse.feedback,
              strengths: evaluationResponse.strengths,
              improvements: evaluationResponse.improvements,
              evaluation_status: finalStatus,
              model_used: evaluationResponse.modelUsed || 'openrouter',
              raw_response: (evaluationResponse.rawJson || { error: evaluationResponse.error || 'Evaluation failed' }) as any,
              evaluated_at: new Date()
            },
            create: {
              test_id: testId,
              student_id: test.student_id,
              question_id: questionId,
              section: question.section,
              question_type: question.type,
              obtained_marks: pointsEarnedToSave,
              maximum_marks: pts,
              feedback: evaluationResponse.feedback,
              strengths: evaluationResponse.strengths,
              improvements: evaluationResponse.improvements,
              evaluation_status: finalStatus,
              model_used: evaluationResponse.modelUsed || 'openrouter',
              raw_response: (evaluationResponse.rawJson || { error: evaluationResponse.error || 'Evaluation failed' }) as any,
              evaluated_at: new Date(),
              test_response_id: existingResponse.id
            }
          });
        }
      } catch (itemError: any) {
        console.error(`[Background Evaluation Error] Question ${questionId} failed:`, itemError?.message || itemError);

        // Record failure on this specific response without aborting the loop for other questions
        try {
          const resp = await prisma.testResponse.findFirst({
            where: { test_id: testId, question_id: questionId }
          });
          if (resp) {
            await prisma.testResponse.update({
              where: { id: resp.id },
              data: {
                points_earned: null,
                evaluation_status: 'FAILED',
                ai_evaluation_json: {
                  evaluationStatus: 'FAILED',
                  error: itemError?.message || 'Unexpected evaluation exception',
                  evaluatedAt: new Date().toISOString()
                }
              }
            });
          }
        } catch (dbErr) {
          console.error(`[Background Evaluation] Failed to record error state for question ${questionId}:`, dbErr);
        }
      }
    }

    try {
      await recalculateTestScore(testId);
    } catch (scoreErr) {
      console.error(`[Background Evaluation] Score recalculation error for test ${testId}:`, scoreErr);
    }
    
  } catch (error) {
    console.error(`[Background Evaluation Fatal Error] Test ID: ${testId}`, error);
  }
}
