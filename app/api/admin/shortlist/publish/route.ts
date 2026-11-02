import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { 
  calculateShortlist, 
  validateShortlistConfig, 
  publishShortlistSnapshot, 
  ShortlistConfig 
} from '@/lib/services/shortlisting-engine';

/**
 * POST /api/admin/shortlist/publish
 * Confirms and publishes the candidate shortlist after admin review.
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json().catch(() => ({}));
    const round = body.round !== undefined ? parseInt(String(body.round), 10) : 1;
    const templateId = body.templateId || body.assessmentId || null;

    let configToUse: ShortlistConfig;

    if (body.config || body.shortlistSize !== undefined || body.overallWeight !== undefined) {
      configToUse = validateShortlistConfig(body.config || body);
    } else {
      const savedSetting = await prisma.shortlistSetting.findFirst({
        where: {
          round,
          template_id: templateId
        },
        orderBy: { updated_at: 'desc' }
      });

      if (savedSetting) {
        configToUse = validateShortlistConfig({
          shortlistSize: savedSetting.shortlist_size,
          overallCutoffEnabled: savedSetting.overall_cutoff_enabled,
          overallCutoffPercentage: Number(savedSetting.overall_cutoff_percentage),
          sectionCutoffs: (savedSetting.section_cutoffs as any) || {},
          overallWeight: Number(savedSetting.overall_weight),
          sectionWeight: Number(savedSetting.section_weight),
          categoryWeights: (savedSetting.category_weights as any) || {}
        });
      } else {
        configToUse = validateShortlistConfig({
          shortlistSize: 10,
          overallCutoffEnabled: false,
          overallCutoffPercentage: 60,
          sectionCutoffs: {},
          overallWeight: 50,
          sectionWeight: 50,
          categoryWeights: { CODING: 50, APTITUDE: 50 }
        });
      }
    }

    // Recalculate shortlist with latest candidate test states
    const calculatedResult = await calculateShortlist({
      round,
      templateId,
      config: configToUse
    });

    // Save snapshot to database in a safe atomic transaction
    const isValidUuid = (id?: string) => Boolean(id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
    let adminUserId: string | null = null;
    if (isValidUuid(decoded.userId)) {
      const u = await prisma.user.findUnique({ where: { id: decoded.userId }, select: { id: true } });
      if (u) adminUserId = u.id;
    }

    if (!adminUserId) {
      const fallbackAdmin = await prisma.user.findFirst({
        where: { role: { in: ['admin', 'super_admin'] } },
        select: { id: true }
      });
      if (!fallbackAdmin) {
        return NextResponse.json({ message: 'No valid administrator account found to authorize publication' }, { status: 403 });
      }
      adminUserId = fallbackAdmin.id;
    }

    const published = await publishShortlistSnapshot({
      round,
      templateId,
      adminUserId,
      config: configToUse,
      candidates: calculatedResult.candidates
    });

    return NextResponse.json({
      message: 'Shortlist published successfully',
      publishedId: published.id,
      publishedAt: published.published_at,
      summary: calculatedResult.summary,
      shortlistedCandidatesCount: calculatedResult.summary.shortlistedCount,
      totalCandidatesCount: calculatedResult.summary.totalUniqueCandidates
    });

  } catch (error: any) {
    console.error('[Shortlist Publish Error]', error);
    return NextResponse.json(
      { message: error.message || 'Failed to publish shortlist' },
      { status: 400 }
    );
  }
}
