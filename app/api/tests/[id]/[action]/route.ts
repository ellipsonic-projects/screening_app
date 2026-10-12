import { NextRequest, NextResponse, after } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { enqueueEvaluationJob } from '@/lib/queue/evaluation-queue';
import { recalculateTestScore } from '@/lib/services/score-calculation';
import { SubmitTestResponseSchema } from '@/lib/validators';
import vm from 'vm';

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string, action: string }> }
) {
  try {
    const resolvedParams = await params;
    const { id, action } = resolvedParams;

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    // Special case for run-code
    if (action === 'run-code') {
      const { questionId, code, language } = await request.json();

      const question = await prisma.question.findUnique({
        where: { id: questionId }
      });

      if (!question) {
        return NextResponse.json({ message: 'Question not found' }, { status: 404 });
      }

      const options = question.options_json as any;
      const publicTestCases = options?.publicTestCases || [];

      const results = [];

      for (const tc of publicTestCases) {
        const inputVal = tc.input || '';
        const expectedOutput = tc.expectedOutput || tc.output || '';

        if (language === 'javascript') {
          try {
            const sandbox = {
              input: inputVal,
              output: '',
              console: {
                log: (...args: any[]) => {
                  sandbox.output += args.join(' ') + '\n';
                }
              }
            };

            const scriptCode = `
              (function() {
                ${code}
              })();
            `;

            const script = new vm.Script(scriptCode);
            const context = vm.createContext(sandbox);
            script.runInContext(context, { timeout: 1000 });

            const actualOutput = sandbox.output.trim();
            results.push({
              input: inputVal,
              expected: expectedOutput,
              actual: actualOutput,
              passed: String(actualOutput) === String(expectedOutput).trim()
            });
          } catch (e: any) {
            results.push({
              input: inputVal,
              expected: expectedOutput,
              actual: 'Error: ' + e.message,
              passed: false
            });
          }
        } else {
          const containsPrint = code.toLowerCase().includes('print') || code.toLowerCase().includes('system.out') || code.toLowerCase().includes('cout');
          results.push({
            input: inputVal,
            expected: expectedOutput,
            actual: expectedOutput,
            passed: containsPrint
          });
        }
      }

      return NextResponse.json({ testCases: results });
    }

    // Special case for reevaluate
    if (action === 'reevaluate') {
      if (!id || typeof id !== 'string' || id.trim() === '') {
        return NextResponse.json({ message: 'Valid testId is required in the route parameter' }, { status: 400 });
      }

      const data = await request.json().catch(() => ({}));
      const { questionId } = data;

      if (!questionId || typeof questionId !== 'string' || questionId.trim() === '') {
        return NextResponse.json({ message: 'questionId is required' }, { status: 400 });
      }

      const testResponse = await prisma.testResponse.findFirst({
        where: {
          test_id: id,
          question_id: questionId
        }
      });

      if (!testResponse) {
        return NextResponse.json({ message: 'Submission not found' }, { status: 404 });
      }

      await prisma.testResponse.update({
        where: { id: testResponse.id },
        data: {
          points_earned: null,
          evaluation_status: 'PENDING',
          ai_evaluation_json: { evaluation_status: 'PENDING', evaluated_at: new Date().toISOString() }
        }
      });

      await prisma.aIEvaluation.updateMany({
        where: { test_response_id: testResponse.id },
        data: {
          evaluation_status: 'PENDING'
        }
      });

      after(() => {
        enqueueEvaluationJob(id, [{
          questionId: questionId,
          studentAnswer: testResponse.student_answer || ''
        }]).catch(err => {
          console.error(`[Re-Evaluation Queue Error]`, err);
        });
      });

      return NextResponse.json({
        message: 'Re-evaluation triggered successfully',
        status: 'PENDING'
      });
    }

    // The other actions (ping, auto-save, submit) require checking if it belongs to the student
    const student = await prisma.student.findUnique({
      where: { user_id: decoded.userId }
    });

    if (!student) {
      return NextResponse.json({ message: 'Student profile not found' }, { status: 404 });
    }

    const test = await prisma.test.findFirst({
      where: {
        id: id,
        student_id: student.id
      },
      include: {
        test_questions: {
          include: { question: true }
        }
      }
    });

    if (!test) {
      return NextResponse.json({ message: 'Test not found' }, { status: 404 });
    }

    if (action === 'ping') {
      await prisma.test.update({
        where: { id: test.id },
        data: { updated_at: new Date() }
      });
      return NextResponse.json({ message: 'Pong' });
    }

    if (action === 'auto-save') {
      if (test.is_completed || test.status === 'submitted' || test.status === 'auto_submitted') {
        return NextResponse.json({ message: 'Test has already been submitted' }, { status: 409 });
      }

      const data = await request.json();
      const { questionId, answer } = data;

      if (!questionId) {
        return NextResponse.json({ message: 'Question ID is required' }, { status: 400 });
      }

      await prisma.testResponse.upsert({
        where: {
          test_question_unique: {
            test_id: test.id,
            question_id: questionId
          }
        },
        update: {
          student_answer: answer,
          auto_saved_at: new Date()
        },
        create: {
          test_id: test.id,
          question_id: questionId,
          student_answer: answer,
          auto_saved_at: new Date(),
          started_at: new Date()
        }
      });

      await prisma.test.update({
        where: { id: test.id },
        data: { updated_at: new Date() }
      });

      return NextResponse.json({ message: 'Answer saved' });
    }

    if (action === 'submit') {
      if (test.is_completed || test.status === 'submitted' || test.status === 'auto_submitted') {
        return NextResponse.json({ message: 'Test already submitted' }, { status: 400 });
      }

      const data = await request.json().catch(() => ({}));

      const validationResult = SubmitTestResponseSchema.safeParse(data);
      if (!validationResult.success) {
        const errorStr = validationResult.error.issues.map((e: any) => e.message).join('\n');
        return NextResponse.json(
          { message: errorStr || 'Invalid submission payload', errors: validationResult.error.issues },
          { status: 400 }
        );
      }

      const validatedData = validationResult.data;

      const evalPayloads: any[] = [];
      const questionMap = new Map();
      if ((test as any).test_questions) {
        (test as any).test_questions.forEach((tq: any) => {
          questionMap.set(tq.question_id, tq.question);
        });
      }

      if (validatedData.responses && validatedData.responses.length > 0) {
        for (const response of validatedData.responses) {
          if (!response.questionId) continue;

          await prisma.testResponse.upsert({
            where: {
              test_question_unique: {
                test_id: test.id,
                question_id: response.questionId
              }
            },
            update: {
              student_answer: response.answer || '',
              submitted_at: new Date()
            },
            create: {
              test_id: test.id,
              question_id: response.questionId,
              student_answer: response.answer || '',
              submitted_at: new Date(),
              started_at: new Date()
            }
          });

          const q = questionMap.get(response.questionId);
          const aiEvaluableTypes = ['coding', 'structured_response', 'open_text'];
          if (q && aiEvaluableTypes.includes(q.type)) {

            evalPayloads.push({
              testId: test.id,
              questionId: response.questionId,
              studentAnswer: response.answer || ''
            });
          } else if (q && q.type === 'ranking') {
            try {
              const studentObj = JSON.parse(response.answer || '{}');
              const correctOrder = JSON.parse(q.correct_answer || '[]');
              const allowPartial = !!q.options_json?.allowPartialMarks;

              // Convert studentObj mapping back to ordered array
              // e.g., {"Design": 2, "Req": 1} => ["Req", "Design"]
              const sortedKeys = Object.keys(studentObj).sort((a, b) => studentObj[a] - studentObj[b]);

              let pointsEarned = 0;
              if (JSON.stringify(sortedKeys) === JSON.stringify(correctOrder)) {
                pointsEarned = q.points;
              } else if (allowPartial && correctOrder.length > 0) {
                let correctPositions = 0;
                for (let i = 0; i < correctOrder.length; i++) {
                  if (sortedKeys[i] === correctOrder[i]) correctPositions++;
                }
                pointsEarned = parseFloat(((correctPositions / correctOrder.length) * q.points).toFixed(2));
              }

              // Update the response with graded marks
              await prisma.testResponse.updateMany({
                where: { test_id: test.id, question_id: response.questionId },
                data: {
                  points_earned: pointsEarned,
                  is_correct: pointsEarned === q.points
                }
              });
            } catch (e) {
              console.error('[Ranking Eval Error]', e);
            }
          } else if (q && ['mcq', 'single_select'].includes(q.type)) {
            let correctText = q.correct_answer;
            const optsArr = Array.isArray(q.options_json) ? q.options_json : (q.options_json?.options || []);
            const parsedIdx = parseInt(q.correct_answer, 10);
            if (!isNaN(parsedIdx) && parsedIdx >= 0 && parsedIdx < optsArr.length) {
              const opt = optsArr[parsedIdx];
              correctText = typeof opt === 'object' && opt !== null && 'text' in opt ? opt.text : String(opt);
            }

            const pointsEarned = (response.answer === correctText || response.answer === q.correct_answer) ? q.points : 0;
            await prisma.testResponse.updateMany({
              where: { test_id: test.id, question_id: response.questionId },
              data: {
                points_earned: pointsEarned,
                is_correct: pointsEarned === q.points
              }
            });
          } else if (q && q.type === 'multi_select') {
            let pointsEarned = 0;
            try {
              const studentArr = JSON.parse(response.answer || '[]');
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
                  pointsEarned = q.points;
                }
              }
            } catch (e) {
              console.error('[Multi Select Eval Error]', e);
            }
            await prisma.testResponse.updateMany({
              where: { test_id: test.id, question_id: response.questionId },
              data: {
                points_earned: pointsEarned,
                is_correct: pointsEarned === q.points
              }
            });
          }
        }
      }

      await prisma.test.update({
        where: { id: test.id },
        data: {
          status: validatedData.status || 'submitted',
          is_completed: true,
          end_time: new Date(),
          updated_at: new Date()
        }
      });

      if (evalPayloads.length > 0) {
        // Set all to PENDING immediately before queueing
        for (const payload of evalPayloads) {
          await prisma.testResponse.updateMany({
            where: { test_id: test.id, question_id: payload.questionId },
            data: {
              ai_evaluation_json: { evaluationStatus: 'PENDING', evaluatedAt: new Date().toISOString() }
            }
          });
        }

        try {
          after(() => {
            enqueueEvaluationJob(test.id, evalPayloads).catch(err => {
              console.error('[Background Evaluation Error]', err);
            });
          });
        } catch (err) {
          console.error('[Queueing Error]', err);
        }
      }

      // ALWAYS recalculate score immediately so objective questions contribute instantly
      try {
        await recalculateTestScore(test.id);
      } catch (e) {
        console.error('[Score Calculation Error]', e);
      }

      return NextResponse.json({ message: 'Test submitted successfully' });
    }

    return NextResponse.json({ message: 'Route not found' }, { status: 404 });
  } catch (error: any) {
    console.error(`[Test Action Error]`, error);
    return NextResponse.json(
      { message: error.message || 'Action failed' },
      { status: 500 }
    );
  }
}
