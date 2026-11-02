import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { gradePersistedTestResponses } from '@/lib/services/evaluation-pipeline';
import { recalculateTestScore } from '@/lib/services/score-calculation';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    const isStudent = decoded.role === 'student';
    let test: any;

    if (isStudent) {
      const student = await prisma.student.findUnique({
        where: { user_id: decoded.userId }
      });

      if (!student) {
        return NextResponse.json({ message: 'Student profile not found' }, { status: 404 });
      }

      test = await prisma.test.findFirst({
        where: {
          id: id,
          student_id: student.id
        },
        include: {
          test_questions: {
            include: {
              question: true
            },
            orderBy: {
              sequence_number: 'asc'
            }
          },
          test_responses: true
        }
      });
    } else {
      // Admin or super_admin
      test = await prisma.test.findFirst({
        where: { id: id },
        include: {
          test_questions: {
            include: {
              question: true
            },
            orderBy: {
              sequence_number: 'asc'
            }
          },
          student: {
            include: {
              user: {
                select: { email: true }
              }
            }
          },
          test_responses: true
        }
      });
    }

    if (!test) {
      return NextResponse.json({ message: 'Test not found' }, { status: 404 });
    }

    // 3-Minute Resume Timeout Logic
    if (isStudent && test.status === 'in_progress') {
      const lastPingTime = new Date(test.updated_at).getTime();
      const diffMs = Date.now() - lastPingTime;
      // 3 minutes = 180000 ms
      if (diffMs > 180000) {
        // Atomic transition to prevent race conditions and duplicate evaluations
        const updated = await prisma.test.updateMany({
          where: {
            id: test.id,
            status: 'in_progress',
            is_completed: false
          },
          data: {
            status: 'auto_submitted',
            is_completed: true,
            end_time: new Date(),
            updated_at: new Date()
          }
        });

        if (updated.count > 0) {
          try {
            await gradePersistedTestResponses(test.id);
          } catch (evalErr) {
            console.error('[Auto-submit Evaluation Error]', evalErr);
          }
        }

        // Re-fetch the updated test with its latest evaluation results & score
        const refreshedTest = await prisma.test.findFirst({
          where: {
            id: id,
            student_id: test.student_id
          },
          include: {
            test_questions: {
              include: {
                question: true
              },
              orderBy: {
                sequence_number: 'asc'
              }
            },
            test_responses: true,
            student: {
              include: {
                user: { select: { email: true } }
              }
            }
          }
        });

        if (refreshedTest) {
          test = refreshedTest;
        }
      }
    }

    const showResults = !isStudent || test.results_published;

    // Format the response to match what the frontend expects
    const formattedTest = {
      id: test.id,
      student_id: test.student_id,
      status: (test.is_completed && test.status === 'in_progress') ? 'submitted' : test.status,
      is_completed: test.is_completed,
      isCompleted: test.is_completed,
      score: showResults ? (test.score !== null ? Number(test.score) : null) : null,
      results_published: test.results_published,
      start_time: test.start_time,
      end_time: test.end_time,
      created_at: test.created_at,
      total_duration: test.total_duration,
      student: test.student ? {
        fullName: test.student.full_name,
        usn: test.student.usn,
        email: test.student.user?.email || '',
        branchName: test.student.branch_name || 'General'
      } : undefined,
      responses: test.test_responses ? test.test_responses.map((tr: any) => ({
        id: tr.id,
        question_id: tr.question_id,
        student_answer: tr.student_answer,
        is_correct: tr.is_correct,
        points_earned: tr.points_earned !== null ? Number(tr.points_earned) : null,
        ai_evaluation_json: tr.ai_evaluation_json,
      })) : undefined,
      questions: test.test_questions.filter((tq: any) => tq.question).map((tq: any) => ({
        id: tq.question.id,
        section: tq.question.section,
        optionsJson: tq.question.options_json,
        questionText: tq.question.question_text,
        type: tq.question.type,
        points: tq.question.points,
        timeLimitSeconds: tq.question.time_limit_seconds,
        correctAnswer: showResults ? tq.question.correct_answer : null,
        explanation: showResults ? tq.question.explanation : null
      }))
    };

    return NextResponse.json({
      message: 'Test retrieved',
      test: formattedTest,
    });
  } catch (error: any) {
    console.error('[Get Test Error]', error);
    return NextResponse.json(
      { message: error.message || 'Failed to retrieve test' },
      { status: 400 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    const resolvedParams = await params;
    const { id } = resolvedParams;

    const data = await request.json();
    const { status, evaluations } = data;

    if (evaluations && Array.isArray(evaluations)) {
      const currentTest = await prisma.test.findUnique({
        where: { id },
        select: { status: true }
      });

      if (currentTest?.status === 'ineligible_attempt') {
        return NextResponse.json(
          { message: 'Cannot evaluate or award marks to an attempt that did not meet minimum attempt requirements' },
          { status: 400 }
        );
      }

      for (const ev of evaluations) {
        const { questionId, pointsEarned, remarks } = ev;

        const response = await prisma.testResponse.findFirst({
          where: {
            test_id: id,
            question_id: questionId
          }
        });

        const question = await prisma.question.findUnique({
          where: { id: questionId }
        });

        if (response && question) {
          const parsedPoints = Number(pointsEarned);
          const maxPoints = question.points || 0;
          if (typeof pointsEarned === 'boolean' || isNaN(parsedPoints) || parsedPoints < 0 || parsedPoints > maxPoints) {
            return NextResponse.json(
              { message: `Invalid pointsEarned for question ${questionId}. Must be numeric between 0 and ${maxPoints}` },
              { status: 400 }
            );
          }

          let cleanCode = response.student_answer || '';
          if (cleanCode.startsWith('// === EVALUATION REMARKS ===')) {
            const parts = cleanCode.split('// ==========================\n\n');
            if (parts.length > 1) {
              cleanCode = parts.slice(1).join('// ==========================\n\n');
            }
          }

          let finalAnswer = cleanCode;
          if (remarks && remarks.trim() !== '') {
            finalAnswer = `// === EVALUATION REMARKS ===\n// ${remarks.replace(/\n/g, '\n// ')}\n// ==========================\n\n${cleanCode}`;
          }

          await prisma.testResponse.update({
            where: { id: response.id },
            data: {
              points_earned: parsedPoints,
              is_correct: parsedPoints === maxPoints,
              evaluation_status: 'COMPLETED',
              student_answer: finalAnswer
            }
          });

          await prisma.aIEvaluation.updateMany({
            where: { test_response_id: response.id },
            data: {
              obtained_marks: parsedPoints,
              evaluation_status: 'COMPLETED',
              feedback: remarks ? `[EVALUATION REMARKS] ${remarks}` : undefined
            }
          });
        }
      }

      // Centralize score recalculation through recalculateTestScore service
      await recalculateTestScore(id);

      const test = await prisma.test.update({
        where: { id },
        data: {
          status: 'evaluated'
        }
      });

      return NextResponse.json({ message: 'Test evaluated successfully', test });
    }

    const existingTest = await prisma.test.findUnique({
      where: { id },
      select: { start_time: true, status: true, is_completed: true }
    });

    if (!existingTest) {
      return NextResponse.json({ message: 'Test not found' }, { status: 404 });
    }

    if (status === 'in_progress' && (existingTest.is_completed || existingTest.status === 'submitted' || existingTest.status === 'auto_submitted' || existingTest.status === 'ineligible_attempt')) {
      return NextResponse.json(
        { message: 'Assessment has already been completed and cannot be restarted', status: existingTest.status },
        { status: 409 }
      );
    }

    const updateData: any = { status };
    if (status === 'in_progress' && !existingTest?.start_time) {
      updateData.start_time = new Date();
    }

    const test = await prisma.test.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json({ message: 'Test status updated', test });
  } catch (error: any) {
    console.error('[Update Test Status/Evaluation Error]', error);
    return NextResponse.json(
      { message: error.message || 'Failed to update test status or evaluation' },
      { status: 400 }
    );
  }
}

