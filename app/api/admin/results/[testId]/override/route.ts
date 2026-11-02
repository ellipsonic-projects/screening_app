import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { recalculateTestScore } from '@/lib/services/score-calculation';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.slice(7);
    const decoded = verifyToken(token);

    if (!decoded || (decoded.role !== 'admin' && decoded.role !== 'recruiter' && decoded.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { testId } = await params;
    const body = await req.json();
    const { questionId, newScore, comment, feedback } = body;

    if (!questionId || newScore === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const parsedScore = Number(newScore);
    if (typeof newScore === 'boolean' || newScore === null || isNaN(parsedScore) || !isFinite(parsedScore)) {
      return NextResponse.json({ error: 'Score must be a valid number' }, { status: 400 });
    }

    if (parsedScore < 0) {
      return NextResponse.json({ error: 'Score cannot be negative' }, { status: 400 });
    }

    const testRecord = await prisma.test.findUnique({
      where: { id: testId },
      select: { status: true, student_id: true }
    });

    if (!testRecord) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }

    if (testRecord.status === 'ineligible_attempt') {
      return NextResponse.json(
        { error: 'Cannot override score for an attempt that did not meet minimum attempt requirements' },
        { status: 400 }
      );
    }

    const existingResponse = await prisma.testResponse.findFirst({
      where: { test_id: testId, question_id: questionId }
    });

    if (!existingResponse) {
      return NextResponse.json({ error: 'Response not found' }, { status: 404 });
    }

    const question = await prisma.question.findUnique({
      where: { id: questionId }
    });

    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    const maxMarks = question.points || 0;
    if (parsedScore > maxMarks) {
      return NextResponse.json(
        { error: `Score cannot exceed maximum marks for this question (${maxMarks})` },
        { status: 400 }
      );
    }

    // Update TestResponse
    await prisma.testResponse.update({
      where: { id: existingResponse.id },
      data: {
        points_earned: parsedScore,
        is_correct: parsedScore === maxMarks,
        evaluation_status: 'COMPLETED'
      }
    });

    // Attempt to update AIEvaluation if it exists or create one
    try {
      const aiEval = await prisma.aIEvaluation.findUnique({
        where: { test_response_id: existingResponse.id }
      });
      
      if (aiEval) {
        await prisma.aIEvaluation.update({
          where: { test_response_id: existingResponse.id },
          data: {
            obtained_marks: parsedScore,
            evaluation_status: 'COMPLETED',
            feedback: feedback !== undefined ? feedback : (comment ? `[MANUAL OVERRIDE] ${comment}\n\n${aiEval.feedback || ''}` : undefined)
          }
        });
      } else {
        const testRecord = await prisma.test.findUnique({ where: { id: testId }, select: { student_id: true } });
        if (testRecord) {
          await prisma.aIEvaluation.create({
            data: {
              test_id: testId,
              student_id: testRecord.student_id,
              question_id: questionId,
              section: question.section,
              question_type: question.type,
              obtained_marks: parsedScore,
              maximum_marks: maxMarks,
              feedback: feedback !== undefined ? feedback : (comment ? `[MANUAL OVERRIDE] ${comment}` : 'Manual score override'),
              evaluation_status: 'COMPLETED',
              evaluated_at: new Date(),
              test_response_id: existingResponse.id
            }
          });
        }
      }
    } catch (e) {
      // Ignore if AIEvaluation doesn't exist or fails
    }

    await recalculateTestScore(testId);

    return NextResponse.json({ success: true, message: 'Score updated successfully' });

  } catch (error: any) {
    console.error('Manual Override Error:', error);
    return NextResponse.json(
      { error: 'Failed to update score', details: error.message },
      { status: 500 }
    );
  }
}
