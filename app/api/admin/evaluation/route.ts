import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { isEligibilityCategory } from '@/lib/categories';

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
        },
        test_responses: {
          select: {
            evaluation_status: true,
            question: { select: { type: true, section: true } }
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    const REVIEWABLE_TYPES = ['coding', 'structured_response', 'open_text'];

    const mappedTests = tests.map(test => {
      const hasFailed = test.status === 'evaluation_failed' || test.test_responses?.some(
        r => REVIEWABLE_TYPES.includes(r.question?.type || '') && !isEligibilityCategory(r.question?.section) && r.evaluation_status === 'FAILED'
      );

      let effectiveStatus = test.status;
      if (test.status === 'ineligible_attempt') {
        effectiveStatus = 'ineligible_attempt';
      } else if (hasFailed) {
        effectiveStatus = 'evaluation_failed';
      }

      return {
        id: test.id,
        fullName: test.student?.full_name || 'Unknown',
        usn: test.student?.usn || '',
        branch: test.student?.branch_name || '',
        email: test.student?.user?.email || '',
        status: effectiveStatus,
        score: (effectiveStatus === 'evaluation_failed' || effectiveStatus === 'ineligible_attempt') ? null : (test.score !== null && test.score !== undefined ? Number(test.score) : null),
        violations: test.violations_count || 0,
        createdAt: test.created_at,
        submittedAt: test.end_time,
        results_published: test.results_published
      };
    });

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
