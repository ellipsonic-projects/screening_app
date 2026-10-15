import prisma from '@/lib/prisma';
import { evaluateAnswer } from '@/lib/evaluation-engine';
import { recalculateTestScore } from '@/lib/services/score-calculation';
import { isEligibilityCategory } from '@/lib/categories';
import { assessTestAttemptEligibility } from '@/lib/services/attempt-eligibility';
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

    if (test.status === 'ineligible_attempt') {
      console.warn(`[Background Evaluation] Ineligible attempt cannot be evaluated: ${testId}`);
      return;
    }

    for (const payload of payloads) {
      const { questionId, studentAnswer } = payload;

      try {
        const existingResponse = await prisma.testResponse.findFirst({
          where: { test_id: testId, question_id: questionId }
        });

        // Skip if already completed (prevents duplicate evaluation from repeated submissions)
        if (existingResponse && existingResponse.evaluation_status === 'COMPLETED') {
          continue;
        }

        const question = await prisma.question.findUnique({ where: { id: questionId } });
        if (!question) {
          console.warn(`[Background Evaluation] Question ${questionId} not found in DB`);
          continue;
        }

        // Defense-in-depth: Unscored Eligibility & Logistics questions must never be evaluated by AI
        if (isEligibilityCategory(question.section)) {
          if (existingResponse) {
            await prisma.testResponse.update({
              where: { id: existingResponse.id },
              data: {
                points_earned: 0,
                is_correct: null,
                evaluation_status: 'COMPLETED',
                ai_evaluation_json: {
                  evaluationStatus: 'COMPLETED',
                  score: 0,
                  feedback: 'Eligibility and logistics questions are unscored.',
                  evaluatedAt: new Date().toISOString()
                }
              }
            });
          }
          continue;
        }

        const pts = question.points || 0;
        const trimmedAnswer = String(studentAnswer || '').trim();

        // Prevent blank answers from being sent to OpenRouter; preserve intended blank scoring (0 marks, COMPLETED)
        if (trimmedAnswer.length === 0) {
          if (existingResponse) {
            await prisma.testResponse.update({
              where: { id: existingResponse.id },
              data: {
                points_earned: 0,
                is_correct: false,
                evaluation_status: 'COMPLETED',
                ai_evaluation_json: {
                  evaluationStatus: 'COMPLETED',
                  score: 0,
                  feedback: 'No answer provided.',
                  strengths: [],
                  improvements: ['Provide an answer to be evaluated.'],
                  evaluatedAt: new Date().toISOString()
                }
              }
            });

            await prisma.aIEvaluation.upsert({
              where: { test_response_id: existingResponse.id },
              update: {
                obtained_marks: 0,
                maximum_marks: pts,
                feedback: 'No answer provided.',
                strengths: [],
                improvements: ['Provide an answer to be evaluated.'],
                evaluation_status: 'COMPLETED',
                evaluated_at: new Date()
              },
              create: {
                test_id: testId,
                student_id: test.student_id,
                question_id: questionId,
                section: question.section,
                question_type: question.type,
                obtained_marks: 0,
                maximum_marks: pts,
                feedback: 'No answer provided.',
                strengths: [],
                improvements: ['Provide an answer to be evaluated.'],
                evaluation_status: 'COMPLETED',
                evaluated_at: new Date(),
                test_response_id: existingResponse.id
              }
            });
          }
          continue;
        }

        if (existingResponse) {
          await prisma.testResponse.update({
            where: { id: existingResponse.id },
            data: {
              evaluation_status: 'PROCESSING',
              ai_evaluation_json: { evaluationStatus: 'PROCESSING', evaluatedAt: new Date().toISOString() }
            }
          });
        }
        
        const options = (question.options_json as any) || {};

        const evaluationRequest: EvaluationRequest = {
          questionId: question.id,
          section: question.section || undefined,
          questionType: options.subtype || (question.type as string),
          question: question.question_text,
          studentAnswer: trimmedAnswer,
          maxMarks: pts,
          metadata: {
            constraints: options.constraints,
            sampleInput: options.sampleInput,
            sampleOutput: options.sampleOutput,
            language: options.language,
            fields: options.fields,
            scenario: options.scenario,
            caseStudyTitle: options.caseStudyTitle,
            caseStudyProblemStatement: options.caseStudyProblemStatement,
            caseStudyBackground: options.caseStudyBackground,
            caseStudyContext: options.caseStudyContext,
            minWords: options.minWords,
            maxWords: options.maxWords,
            subtype: options.subtype
          }
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

          const rawResponsePayload = {
            ...(evaluationResponse.rawJson || {}),
            criteriaScores: evaluationResponse.criteriaScores || [],
            deductionReasons: evaluationResponse.deductionReasons || [],
            ...(evaluationResponse.error ? { error: evaluationResponse.error } : {})
          };

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
              raw_response: rawResponsePayload as any,
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
              raw_response: rawResponsePayload as any,
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

            await prisma.aIEvaluation.upsert({
              where: { test_response_id: resp.id },
              update: {
                obtained_marks: null,
                evaluation_status: 'FAILED',
                feedback: `Evaluation failed: ${itemError?.message || 'Unexpected evaluation exception'}`,
                evaluated_at: new Date()
              },
              create: {
                test_id: testId,
                student_id: test.student_id,
                question_id: questionId,
                obtained_marks: null,
                evaluation_status: 'FAILED',
                feedback: `Evaluation failed: ${itemError?.message || 'Unexpected evaluation exception'}`,
                evaluated_at: new Date(),
                test_response_id: resp.id
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

/**
 * Evaluates and grades all persisted responses for an assessment attempt.
 * Objective questions (MCQs, rankings, multi-select) are graded immediately.
 * Subjective questions (coding, open_text, structured_response) are queued for AI evaluation.
 * Total score is recalculated immediately for objective marks, and re-calculated once AI evaluation finishes.
 */
export async function gradePersistedTestResponses(testId: string): Promise<number> {
  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: {
      test_questions: {
        include: { question: true }
      },
      test_responses: true
    }
  });

  if (!test) {
    throw new Error(`Test ${testId} not found`);
  }

  if (test.status === 'ineligible_attempt') {
    return 0;
  }

  // Enforce attempt eligibility gate
  const eligibility = assessTestAttemptEligibility(
    test.test_questions,
    test.test_responses,
    undefined,
    {
      enabled: test.min_attempt_enabled ?? true,
      minPercentage: test.min_attempt_percentage ?? 60
    }
  );

  if (!eligibility.isEligible) {
    await prisma.test.update({
      where: { id: testId },
      data: {
        status: 'ineligible_attempt',
        score: null,
        is_completed: true,
        updated_at: new Date()
      }
    });

    for (const resp of test.test_responses || []) {
      await prisma.testResponse.update({
        where: { id: resp.id },
        data: {
          points_earned: null,
          is_correct: null,
          evaluation_status: null,
          ai_evaluation_json: {
            evaluationStatus: 'INELIGIBLE_ATTEMPT',
            score: null,
            reason: `Minimum attempt requirement not met (${eligibility.attemptedCount}/${eligibility.requiredAttempts} required).`,
            attemptedCount: eligibility.attemptedCount,
            requiredAttempts: eligibility.requiredAttempts,
            applicableQuestionsCount: eligibility.applicableQuestionsCount,
            evaluatedAt: new Date().toISOString()
          }
        }
      });
    }

    await prisma.testAnalytics.upsert({
      where: { test_id: testId },
      update: {
        total_score: null,
        overall_percentage: null,
        overall_ai_marks: null,
        correct_answers: null,
        incorrect_answers: null,
        unanswered: eligibility.applicableQuestionsCount - eligibility.attemptedCount,
        total_questions: eligibility.applicableQuestionsCount,
        section_totals: {
          attemptEligibility: {
            isEligible: false,
            attemptedCount: eligibility.attemptedCount,
            requiredAttempts: eligibility.requiredAttempts,
            applicableQuestionsCount: eligibility.applicableQuestionsCount,
            minPercentage: eligibility.minPercentage
          }
        }
      },
      create: {
        test_id: testId,
        total_score: null,
        overall_percentage: null,
        overall_ai_marks: null,
        correct_answers: null,
        incorrect_answers: null,
        unanswered: eligibility.applicableQuestionsCount - eligibility.attemptedCount,
        total_questions: eligibility.applicableQuestionsCount,
        section_totals: {
          attemptEligibility: {
            isEligible: false,
            attemptedCount: eligibility.attemptedCount,
            requiredAttempts: eligibility.requiredAttempts,
            applicableQuestionsCount: eligibility.applicableQuestionsCount,
            minPercentage: eligibility.minPercentage
          }
        }
      }
    });

    return 0;
  }

  const questionMap = new Map();
  if (test.test_questions) {
    test.test_questions.forEach((tq: any) => {
      questionMap.set(tq.question_id, tq.question);
    });
  }

  const evalPayloads: BackgroundEvalPayload[] = [];
  const aiEvaluableTypes = ['coding', 'structured_response', 'open_text'];

  for (const resp of test.test_responses || []) {
    const q = questionMap.get(resp.question_id);
    if (!q) continue;

    const answer = resp.student_answer || '';
    const qPoints = q.points || 0;

    if (aiEvaluableTypes.includes(q.type)) {
      if (resp.evaluation_status !== 'COMPLETED') {
        if (answer.trim().length > 0) {
          evalPayloads.push({
            testId,
            questionId: resp.question_id,
            studentAnswer: answer
          });

          await prisma.testResponse.update({
            where: { id: resp.id },
            data: {
              evaluation_status: 'PENDING',
              ai_evaluation_json: { evaluationStatus: 'PENDING', evaluatedAt: new Date().toISOString() }
            }
          });
        } else {
          await prisma.testResponse.update({
            where: { id: resp.id },
            data: {
              points_earned: 0,
              is_correct: false,
              evaluation_status: 'COMPLETED',
              ai_evaluation_json: {
                evaluationStatus: 'COMPLETED',
                score: 0,
                feedback: 'No answer provided.',
                strengths: [],
                improvements: ['Provide an answer to be evaluated.'],
                evaluatedAt: new Date().toISOString()
              }
            }
          });

          await prisma.aIEvaluation.upsert({
            where: { test_response_id: resp.id },
            update: {
              obtained_marks: 0,
              maximum_marks: qPoints,
              feedback: 'No answer provided.',
              strengths: [],
              improvements: ['Provide an answer to be evaluated.'],
              evaluation_status: 'COMPLETED',
              evaluated_at: new Date()
            },
            create: {
              test_id: testId,
              student_id: test.student_id,
              question_id: resp.question_id,
              section: q.section,
              question_type: q.type,
              obtained_marks: 0,
              maximum_marks: qPoints,
              feedback: 'No answer provided.',
              strengths: [],
              improvements: ['Provide an answer to be evaluated.'],
              evaluation_status: 'COMPLETED',
              evaluated_at: new Date(),
              test_response_id: resp.id
            }
          });
        }
      }
    } else if (q.type === 'ranking') {
      try {
        const studentObj = JSON.parse(answer || '{}');
        const correctOrder = JSON.parse(q.correct_answer || '[]');
        const allowPartial = !!q.options_json?.allowPartialMarks;

        const sortedKeys = Object.keys(studentObj).sort((a, b) => studentObj[a] - studentObj[b]);

        let pointsEarned = 0;
        if (JSON.stringify(sortedKeys) === JSON.stringify(correctOrder)) {
          pointsEarned = qPoints;
        } else if (allowPartial && correctOrder.length > 0) {
          let correctPositions = 0;
          for (let i = 0; i < correctOrder.length; i++) {
            if (sortedKeys[i] === correctOrder[i]) correctPositions++;
          }
          pointsEarned = parseFloat(((correctPositions / correctOrder.length) * qPoints).toFixed(2));
        }

        await prisma.testResponse.update({
          where: { id: resp.id },
          data: {
            points_earned: pointsEarned,
            is_correct: pointsEarned === qPoints,
            evaluation_status: 'COMPLETED'
          }
        });
      } catch (e) {
        console.error('[Ranking Eval Error]', e);
      }
    } else if (['mcq', 'single_select'].includes(q.type)) {
      let correctText = q.correct_answer;
      const optsArr = Array.isArray(q.options_json) ? q.options_json : (q.options_json?.options || []);
      const parsedIdx = parseInt(q.correct_answer || '', 10);
      if (!isNaN(parsedIdx) && parsedIdx >= 0 && parsedIdx < optsArr.length) {
        const opt = optsArr[parsedIdx];
        correctText = typeof opt === 'object' && opt !== null && 'text' in opt ? opt.text : String(opt);
      }

      const pointsEarned = (answer === correctText || answer === q.correct_answer) ? qPoints : 0;
      await prisma.testResponse.update({
        where: { id: resp.id },
        data: {
          points_earned: pointsEarned,
          is_correct: pointsEarned === qPoints,
          evaluation_status: 'COMPLETED'
        }
      });
    } else if (q.type === 'multi_select') {
      let pointsEarned = 0;
      try {
        const studentArr = JSON.parse(answer || '[]');
        const correctIndices = JSON.parse(q.correct_answer || '[]');

        const optsArr = Array.isArray(q.options_json) ? q.options_json : (q.options_json?.options || []);
        const correctTexts = correctIndices.map((idxVal: any) => {
          const parsedIdx = parseInt(String(idxVal), 10);
          if (!isNaN(parsedIdx) && parsedIdx >= 0 && parsedIdx < optsArr.length) {
            const opt = optsArr[parsedIdx];
            return typeof opt === 'object' && opt !== null && 'text' in opt ? opt.text : String(opt);
          }
          return String(idxVal);
        });

        if (Array.isArray(studentArr)) {
          const isExactMatch = studentArr.length === correctTexts.length &&
            studentArr.every((v: string) => correctTexts.includes(v));
          if (isExactMatch) {
            pointsEarned = qPoints;
          }
        }
      } catch (e) {
        console.error('[Multi Select Eval Error]', e);
      }
      await prisma.testResponse.update({
        where: { id: resp.id },
        data: {
          points_earned: pointsEarned,
          is_correct: pointsEarned === qPoints,
          evaluation_status: 'COMPLETED'
        }
      });
    }
  }

  // Recalculate immediate score with objective points
  const initialScore = await recalculateTestScore(testId);

  // Trigger background AI evaluations if there are pending subjective items
  if (evalPayloads.length > 0) {
    processBackgroundEvaluations(evalPayloads, testId).catch(err => {
      console.error('[Background Evaluation Error]', err);
    });
  }

  return initialScore;
}
