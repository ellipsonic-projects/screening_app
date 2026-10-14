import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { CATEGORY_ORDER, canonicalizeCategory } from '@/lib/categories';

function sortAndShuffleQuestions(questions: any[]) {
  const grouped: Record<string, any[]> = {};
  const uncategorized: any[] = [];

  questions.forEach(q => {
    const canonical = canonicalizeCategory(q.section);
    if (canonical) {
      if (!grouped[canonical]) grouped[canonical] = [];
      grouped[canonical].push(q);
    } else {
      uncategorized.push(q);
    }
  });

  Object.keys(grouped).forEach(s => {
    grouped[s].sort(() => 0.5 - Math.random());
  });
  uncategorized.sort(() => 0.5 - Math.random());

  const finalQuestions: any[] = [];
  CATEGORY_ORDER.forEach(orderedCategory => {
    if (grouped[orderedCategory]) {
      finalQuestions.push(...grouped[orderedCategory]);
    }
  });

  finalQuestions.push(...uncategorized);

  return finalQuestions;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const decoded = verifyToken(token);

    if (!decoded || (decoded.role !== 'admin' && decoded.role !== 'super_admin')) {
      return NextResponse.json({ message: 'Only admins can publish tests' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { studentIds, questionIds } = body;

    // Support both totalDuration and durationMinutes
    const rawDuration = body.totalDuration ?? body.durationMinutes;
    const totalDuration = typeof rawDuration === 'string' ? parseInt(rawDuration, 10) : Number(rawDuration);

    if (!rawDuration || isNaN(totalDuration) || totalDuration <= 0) {
      return NextResponse.json(
        { message: 'Invalid test duration. Duration must be a positive number of minutes.' },
        { status: 400 }
      );
    }

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return NextResponse.json({ message: 'No students selected' }, { status: 400 });
    }

    if (!questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
      return NextResponse.json({ message: 'No questions selected for Round 2' }, { status: 400 });
    }

    const uniqueStudentIds = Array.from(new Set(studentIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)));
    const uniqueQuestionIds = Array.from(new Set(questionIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)));

    if (uniqueStudentIds.length === 0) {
      return NextResponse.json({ message: 'Invalid student IDs provided' }, { status: 400 });
    }

    if (uniqueQuestionIds.length === 0) {
      return NextResponse.json({ message: 'Invalid question IDs provided' }, { status: 400 });
    }

    // Validate students exist in database
    const existingStudents = await prisma.student.findMany({
      where: { id: { in: uniqueStudentIds } },
      select: { id: true, full_name: true }
    });

    if (existingStudents.length === 0) {
      return NextResponse.json({ message: 'No valid students found for the provided student IDs' }, { status: 400 });
    }

    if (existingStudents.length !== uniqueStudentIds.length) {
      return NextResponse.json({ message: 'One or more selected students do not exist' }, { status: 400 });
    }

    // Validate questions exist in database
    const questions = await prisma.question.findMany({
      where: { id: { in: uniqueQuestionIds } },
      select: { id: true, section: true }
    });

    if (questions.length === 0) {
      return NextResponse.json({ message: 'No valid questions found for the provided question IDs' }, { status: 400 });
    }

    if (questions.length !== uniqueQuestionIds.length) {
      return NextResponse.json({ message: 'One or more selected questions do not exist in the question bank' }, { status: 400 });
    }

    // Atomic transaction across all students
    let publishedCount = 0;
    let alreadyAssignedCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const student of existingStudents) {
        // Deduplication: Check if an unstarted test with the exact same questions already exists for this student
        const existingPendingTests = await tx.test.findMany({
          where: {
            student_id: student.id,
            status: 'not_started'
          },
          include: {
            test_questions: {
              select: { question_id: true }
            }
          }
        });

        const isDuplicate = existingPendingTests.some((t) => {
          const existingQIds = new Set(t.test_questions.map((tq) => tq.question_id));
          return (
            existingQIds.size === uniqueQuestionIds.length &&
            uniqueQuestionIds.every((qId) => existingQIds.has(qId))
          );
        });

        if (isDuplicate) {
          alreadyAssignedCount++;
          continue;
        }

        // Shuffle questions in section order for the student
        const shuffled = sortAndShuffleQuestions(questions);

        const test = await tx.test.create({
          data: {
            student_id: student.id,
            total_duration: totalDuration,
            status: 'not_started',
            is_completed: false,
          }
        });

        await tx.testQuestion.createMany({
          data: shuffled.map((q, index) => ({
            test_id: test.id,
            question_id: q.id,
            sequence_number: index + 1
          }))
        });

        publishedCount++;
      }

      // Mark questions as published
      if (publishedCount > 0) {
        await tx.question.updateMany({
          where: { id: { in: uniqueQuestionIds } },
          data: { is_published: true }
        });
      }
    });

    if (publishedCount === 0 && alreadyAssignedCount > 0) {
      return NextResponse.json({
        message: `Round 2 test is already published for the selected student${alreadyAssignedCount > 1 ? 's' : ''}`,
        publishedCount: 0,
        alreadyAssignedCount
      }, { status: 200 });
    }

    return NextResponse.json({ 
      message: `Round 2 tests successfully published for ${publishedCount} student${publishedCount > 1 ? 's' : ''}${alreadyAssignedCount > 0 ? ` (${alreadyAssignedCount} already had this test assigned)` : ''}`,
      publishedCount,
      alreadyAssignedCount
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Publish Round 2 Error]', error);
    return NextResponse.json({ message: 'Failed to publish Round 2 tests' }, { status: 500 });
  }
}
