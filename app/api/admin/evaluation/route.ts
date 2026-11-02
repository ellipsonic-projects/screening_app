import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { isEligibilityCategory, isPersonalityCategory } from '@/lib/categories';

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

    const roundParam = request.nextUrl.searchParams.get('round');
    const templateId = request.nextUrl.searchParams.get('templateId') || request.nextUrl.searchParams.get('assessmentId');
    const targetRound = roundParam ? parseInt(roundParam, 10) : undefined;

    const whereClause: any = {};
    if (targetRound !== undefined && !isNaN(targetRound)) {
      whereClause.round = targetRound;
    }
    if (templateId) {
      whereClause.template_id = templateId;
    }

    const tests = await prisma.test.findMany({
      where: whereClause,
      include: {
        student: {
          include: {
            user: {
              select: { email: true }
            }
          }
        },
        template: {
          select: {
            id: true,
            name: true
          }
        },
        test_responses: {
          select: {
            evaluation_status: true,
            question: { select: { type: true, section: true } }
          }
        }
      },
      orderBy: [
        { round: 'asc' },
        { created_at: 'desc' }
      ]
    });

    const REVIEWABLE_TYPES = ['coding', 'structured_response', 'open_text'];

    const mappedTests = tests.map(test => {
      const hasFailed = test.status === 'evaluation_failed' || test.test_responses?.some(
        r => REVIEWABLE_TYPES.includes(r.question?.type || '') && !isEligibilityCategory(r.question?.section) && !isPersonalityCategory(r.question?.section) && r.evaluation_status === 'FAILED'
      );

      const hasPending = test.test_responses?.some(
        r => REVIEWABLE_TYPES.includes(r.question?.type || '') && 
             !isEligibilityCategory(r.question?.section) && 
             !isPersonalityCategory(r.question?.section) &&
             (r.evaluation_status === 'PENDING' || r.evaluation_status === 'PROCESSING' || r.evaluation_status === 'RETRYING')
      );

      const hasScoredQuestions = test.test_responses?.some(
        r => !isEligibilityCategory(r.question?.section) && !isPersonalityCategory(r.question?.section)
      );

      let effectiveStatus = test.status;
      if (test.status === 'ineligible_attempt') {
        effectiveStatus = 'ineligible_attempt';
      } else if (hasFailed) {
        effectiveStatus = 'evaluation_failed';
      } else if (hasPending || test.status === 'evaluating') {
        effectiveStatus = 'evaluating';
      } else if (!hasScoredQuestions && test.status === 'evaluated') {
        effectiveStatus = 'submitted';
      }

      const isUnfinalized = effectiveStatus === 'evaluation_failed' || effectiveStatus === 'ineligible_attempt' || effectiveStatus === 'evaluating' || !hasScoredQuestions;

      return {
        id: test.id,
        round: test.round || 1,
        title: test.title || (test.round === 2 ? 'Round 2 Technical Interview Assessment' : 'Round 1 Assessment'),
        templateId: test.template_id,
        templateName: test.template?.name || null,
        fullName: test.student?.full_name || 'Unknown',
        usn: test.student?.usn || '',
        branch: test.student?.branch_name || '',
        email: test.student?.user?.email || '',
        status: effectiveStatus,
        score: isUnfinalized ? null : (test.score !== null && test.score !== undefined ? Number(test.score) : null),
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
