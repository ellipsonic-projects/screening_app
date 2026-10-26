import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { validateShortlistConfig, ShortlistConfig } from '@/lib/services/shortlisting-engine';

/**
 * GET /api/admin/shortlist/settings
 * Retrieves shortlisting configuration for a given assessment and round.
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

    const setting = await prisma.shortlistSetting.findFirst({
      where: {
        round,
        template_id: templateId || null
      },
      orderBy: { updated_at: 'desc' }
    });

    if (!setting) {
      // Default initial configuration
      const defaultConfig: ShortlistConfig = {
        shortlistSize: 10,
        overallCutoffEnabled: false,
        overallCutoffPercentage: 60,
        sectionCutoffs: {},
        overallWeight: 50,
        sectionWeight: 50,
        categoryWeights: {
          CODING: 50,
          APTITUDE: 50
        }
      };

      return NextResponse.json({
        message: 'Default settings loaded',
        isDefault: true,
        settings: {
          round,
          templateId: templateId || null,
          ...defaultConfig
        }
      });
    }

    return NextResponse.json({
      message: 'Settings retrieved successfully',
      isDefault: false,
      settings: {
        id: setting.id,
        round: setting.round,
        templateId: setting.template_id,
        shortlistSize: setting.shortlist_size,
        overallCutoffEnabled: setting.overall_cutoff_enabled,
        overallCutoffPercentage: setting.overall_cutoff_percentage !== null ? Number(setting.overall_cutoff_percentage) : 60,
        sectionCutoffs: (setting.section_cutoffs as any) || {},
        overallWeight: Number(setting.overall_weight),
        sectionWeight: Number(setting.section_weight),
        categoryWeights: (setting.category_weights as any) || {},
        tieBreakRules: (setting.tie_break_rules as any) || null,
        updatedAt: setting.updated_at
      }
    });

  } catch (error: any) {
    console.error('[Shortlist Settings GET Error]', error);
    return NextResponse.json(
      { message: error.message || 'Failed to retrieve shortlist settings' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/shortlist/settings
 * Saves or updates shortlisting configuration for a given assessment and round.
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

    // Server-side validation of Approach B configuration
    const validatedConfig = validateShortlistConfig(body);

    // Check if an existing setting exists for (template_id, round)
    const existing = await prisma.shortlistSetting.findFirst({
      where: {
        round,
        template_id: templateId
      }
    });

    const isValidUuid = (id?: string) => Boolean(id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
    let adminUserId: string | null = null;
    if (isValidUuid(decoded.userId)) {
      const u = await prisma.user.findUnique({ where: { id: decoded.userId }, select: { id: true } });
      if (u) adminUserId = u.id;
    }

    let savedSetting: any;
    if (existing) {
      savedSetting = await prisma.shortlistSetting.update({
        where: { id: existing.id },
        data: {
          shortlist_size: validatedConfig.shortlistSize,
          overall_cutoff_enabled: validatedConfig.overallCutoffEnabled,
          overall_cutoff_percentage: validatedConfig.overallCutoffPercentage,
          section_cutoffs: validatedConfig.sectionCutoffs,
          overall_weight: validatedConfig.overallWeight,
          section_weight: validatedConfig.sectionWeight,
          category_weights: validatedConfig.categoryWeights,
          created_by: adminUserId,
          updated_at: new Date()
        }
      });
    } else {
      savedSetting = await prisma.shortlistSetting.create({
        data: {
          template_id: templateId,
          round,
          shortlist_size: validatedConfig.shortlistSize,
          overall_cutoff_enabled: validatedConfig.overallCutoffEnabled,
          overall_cutoff_percentage: validatedConfig.overallCutoffPercentage,
          section_cutoffs: validatedConfig.sectionCutoffs,
          overall_weight: validatedConfig.overallWeight,
          section_weight: validatedConfig.sectionWeight,
          category_weights: validatedConfig.categoryWeights,
          created_by: adminUserId
        }
      });
    }

    return NextResponse.json({
      message: 'Shortlist settings saved successfully',
      settings: {
        id: savedSetting.id,
        round: savedSetting.round,
        templateId: savedSetting.template_id,
        shortlistSize: savedSetting.shortlist_size,
        overallCutoffEnabled: savedSetting.overall_cutoff_enabled,
        overallCutoffPercentage: Number(savedSetting.overall_cutoff_percentage),
        sectionCutoffs: savedSetting.section_cutoffs,
        overallWeight: Number(savedSetting.overall_weight),
        sectionWeight: Number(savedSetting.section_weight),
        categoryWeights: savedSetting.category_weights,
        updatedAt: savedSetting.updated_at
      }
    });

  } catch (error: any) {
    console.error('[Shortlist Settings POST Error]', error);
    return NextResponse.json(
      { message: error.message || 'Failed to save shortlist settings' },
      { status: 400 }
    );
  }
}
