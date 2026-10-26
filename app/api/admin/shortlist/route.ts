import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * GET /api/admin/shortlist
 * Retrieves the published shortlist for a given assessment and round.
 * Checks for stale data if candidate scores or tests changed after publication.
 */
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
    const round = roundParam ? parseInt(roundParam, 10) : 1;

    // Retrieve the latest published shortlist
    const published = await prisma.publishedShortlist.findFirst({
      where: {
        round,
        template_id: templateId || null
      },
      include: {
        template: {
          select: { id: true, name: true }
        },
        candidates: {
          include: {
            student: {
              include: {
                user: { select: { email: true } }
              }
            },
            test: {
              select: {
                id: true,
                title: true,
                status: true,
                score: true,
                start_time: true,
                end_time: true
              }
            }
          },
          orderBy: [
            { rank: 'asc' },
            { created_at: 'asc' }
          ]
        }
      },
      orderBy: { published_at: 'desc' }
    });

    if (!published) {
      return NextResponse.json({
        message: 'No published shortlist found for this assessment and round',
        isPublished: false,
        round,
        templateId: templateId || null
      });
    }

    // Check if source tests were updated after the shortlist was published (Staleness Detection)
    const latestTestUpdate = await prisma.test.findFirst({
      where: {
        round,
        template_id: templateId || null
      },
      select: { updated_at: true },
      orderBy: { updated_at: 'desc' }
    });

    let isStale = false;
    let staleReason: string | null = null;

    if (latestTestUpdate?.updated_at && published.published_at) {
      if (new Date(latestTestUpdate.updated_at).getTime() > new Date(published.published_at).getTime()) {
        isStale = true;
        staleReason = 'Candidate test attempts or evaluations were updated after this shortlist was published. Re-calculating or re-publishing is recommended.';
      }
    }

    const formattedCandidates = published.candidates.map(c => ({
      id: c.id,
      rank: c.rank,
      studentId: c.student_id,
      fullName: c.student?.full_name || 'Unknown Candidate',
      usn: c.student?.usn || '',
      email: c.student?.user?.email || '',
      branch: c.student?.branch_name || '',
      testId: c.test_id,
      testTitle: c.test?.title || (round === 2 ? 'Round 2 Technical Interview Assessment' : 'Round 1 Assessment'),
      rankingScore: c.ranking_score !== null ? Number(c.ranking_score) : null,
      overallPercentage: c.overall_percentage !== null ? Number(c.overall_percentage) : null,
      sectionPercentages: c.section_percentages,
      status: c.status,
      exclusionReasons: c.exclusion_reasons || []
    }));

    return NextResponse.json({
      message: 'Published shortlist retrieved successfully',
      isPublished: true,
      isStale,
      staleReason,
      shortlist: {
        id: published.id,
        round: published.round,
        templateId: published.template_id,
        templateName: published.template?.name || null,
        shortlistSize: published.shortlist_size,
        publishedAt: published.published_at,
        configSnapshot: published.config_snapshot,
        candidatesCount: formattedCandidates.length,
        shortlistedCount: formattedCandidates.filter(c => c.status === 'shortlisted').length,
        candidates: formattedCandidates
      }
    });

  } catch (error: any) {
    console.error('[Get Shortlist Error]', error);
    return NextResponse.json(
      { message: error.message || 'Failed to retrieve published shortlist' },
      { status: 500 }
    );
  }
}
