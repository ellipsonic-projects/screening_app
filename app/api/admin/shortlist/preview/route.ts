import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { calculateShortlist, validateShortlistConfig, ShortlistConfig } from '@/lib/services/shortlisting-engine';

/**
 * POST /api/admin/shortlist/preview
 * Calculates candidate rankings and preview shortlist for an assessment and round.
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

    // If config was provided in body, validate and use it
    if (body.config || body.shortlistSize !== undefined || body.overallWeight !== undefined) {
      configToUse = validateShortlistConfig(body.config || body);
    } else {
      // Look up saved config from database
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
        // Fallback to default config
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

    // Execute Approach B calculation engine
    const result = await calculateShortlist({
      round,
      templateId,
      config: configToUse
    });

    return NextResponse.json({
      message: 'Shortlist calculated successfully',
      result
    });

  } catch (error: any) {
    console.error('[Shortlist Preview POST Error]', error);
    return NextResponse.json(
      { message: error.message || 'Failed to calculate shortlist preview' },
      { status: 400 }
    );
  }
}

/**
 * GET /api/admin/shortlist/preview
 * GET endpoint using saved database configuration.
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

    const savedSetting = await prisma.shortlistSetting.findFirst({
      where: {
        round,
        template_id: templateId || null
      },
      orderBy: { updated_at: 'desc' }
    });

    const configToUse = savedSetting ? validateShortlistConfig({
      shortlistSize: savedSetting.shortlist_size,
      overallCutoffEnabled: savedSetting.overall_cutoff_enabled,
      overallCutoffPercentage: Number(savedSetting.overall_cutoff_percentage),
      sectionCutoffs: (savedSetting.section_cutoffs as any) || {},
      overallWeight: Number(savedSetting.overall_weight),
      sectionWeight: Number(savedSetting.section_weight),
      categoryWeights: (savedSetting.category_weights as any) || {}
    }) : validateShortlistConfig({
      shortlistSize: 10,
      overallCutoffEnabled: false,
      overallCutoffPercentage: 60,
      sectionCutoffs: {},
      overallWeight: 50,
      sectionWeight: 50,
      categoryWeights: { CODING: 50, APTITUDE: 50 }
    });

    const result = await calculateShortlist({
      round,
      templateId,
      config: configToUse
    });

    return NextResponse.json({
      message: 'Shortlist calculated successfully',
      result
    });

  } catch (error: any) {
    console.error('[Shortlist Preview GET Error]', error);
    return NextResponse.json(
      { message: error.message || 'Failed to calculate shortlist preview' },
      { status: 500 }
    );
  }
}
