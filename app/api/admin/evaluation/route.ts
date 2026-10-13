import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const decoded = verifyToken(token);

    if (!decoded || (decoded.role !== 'admin' && decoded.role !== 'super_admin')) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const tests = await prisma.test.findMany({
      include: {
        student: {
          include: {
            user: {
              select: { email: true }
            }
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    const mappedTests = tests.map(test => ({
      id: test.id,
      fullName: test.student?.full_name || 'Unknown',
      usn: test.student?.usn || '',
      branch: test.student?.branch_name || '',
      email: test.student?.user?.email || '',
      status: test.status,
      score: test.score !== null && test.score !== undefined ? Number(test.score) : null,
      violations: test.violations_count || 0,
      createdAt: test.created_at,
      submittedAt: test.end_time,
      results_published: test.results_published
    }));

    return NextResponse.json({
      message: 'Evaluations retrieved successfully',
      tests: mappedTests
    });

  } catch (error: any) {
    console.error('[Get Evaluations Error]', error);
    return NextResponse.json(
      { message: error.message || 'Failed to retrieve evaluations' },
      { status: 500 }
    );
  }
}
