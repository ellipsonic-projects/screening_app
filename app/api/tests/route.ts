import { NextRequest, NextResponse } from 'next/server';

import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * GET /api/tests
 * Get available tests for student
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json({ message: 'Invalid or expired token' }, { status: 401 });
    }

    const student = await prisma.student.findUnique({
      where: { user_id: decoded.userId }
    });

    if (!student) {
      return NextResponse.json({ message: 'Student not found', tests: [] });
    }

    const isAvailable = request.nextUrl.searchParams.get('available') === 'true';

    const tests = await prisma.test.findMany({
      where: {
        student_id: student.id,
        ...(isAvailable ? { status: 'not_started' } : {})
      },
      select: {
        id: true,
        total_duration: true,
        status: true,
        score: true,
        results_published: true,
        created_at: true,
        _count: {
          select: { test_questions: true }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    return NextResponse.json({
      message: 'Tests retrieved',
      tests: tests.map(t => ({
        id: t.id,
        totalDuration: t.total_duration,
        status: t.status,
        score: t.results_published ? (t.score !== null ? Number(t.score) : null) : null,
        totalQuestions: t._count?.test_questions || 0,
        results_published: t.results_published,
        createdAt: t.created_at,
      })),
    });
  } catch (error: any) {
    console.error('[Get Tests Error]', error);
    return NextResponse.json(
      { 
        message: 'Failed to retrieve tests',
        error: error.message,
        stack: error.stack
      },
      { status: 400 }
    );
  }
}

/**
 * POST /api/tests
 * Create a new test
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json({ message: 'Invalid or expired token' }, { status: 401 });
    }

    if (!decoded || (decoded.role !== 'admin' && decoded.role !== 'super_admin')) {
      return NextResponse.json({ message: 'Only admins can create tests' }, { status: 403 });
    }

    const data = await request.json();
    const { studentId, questionIds, totalDuration, minAttemptPercentage, minAttemptEnabled } = data;

    const config = await prisma.testTemplate.findFirst({
      where: { name: 'MASTER_TEST_CONFIG' }
    });
    const finalMinPercentage = minAttemptPercentage !== undefined
      ? Number(minAttemptPercentage)
      : (config?.min_attempt_percentage ?? 60);
    const finalMinEnabled = minAttemptEnabled !== undefined
      ? Boolean(minAttemptEnabled)
      : (config?.min_attempt_enabled ?? true);

    const test = await prisma.$transaction(async (tx) => {
      const newTest = await tx.test.create({
        data: {
          student_id: studentId,
          total_duration: totalDuration,
          status: 'not_started',
          violations_count: 0,
          min_attempt_percentage: finalMinPercentage,
          min_attempt_enabled: finalMinEnabled,
        }
      });
      
      await tx.testQuestion.createMany({
        data: questionIds.map((qId: string, idx: number) => ({
          test_id: newTest.id,
          question_id: qId,
          sequence_number: idx + 1
        }))
      });
      return newTest;
    });

    return NextResponse.json(
      { message: 'Test created', test },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[Create Test Error]', error);
    return NextResponse.json(
      { message: error.message || 'Failed to create test' },
      { status: 400 }
    );
  }
}
