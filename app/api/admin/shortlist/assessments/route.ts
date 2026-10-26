import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * GET /api/admin/shortlist/assessments
 * Returns available assessment templates and existing rounds for shortlisting dropdowns.
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

    // Fetch active test templates
    const templates = await prisma.testTemplate.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        total_questions: true,
        total_duration: true
      },
      orderBy: { created_at: 'desc' }
    });

    // Fetch distinct rounds currently in the database tests
    const distinctRounds = await prisma.test.findMany({
      distinct: ['round'],
      select: { round: true },
      orderBy: { round: 'asc' }
    });

    const rounds = distinctRounds.map(r => r.round).filter(r => r > 0);
    if (!rounds.includes(1)) rounds.unshift(1);
    if (!rounds.includes(2)) rounds.push(2);

    return NextResponse.json({
      templates,
      rounds: Array.from(new Set(rounds)).sort((a, b) => a - b)
    });

  } catch (error: any) {
    console.error('[Shortlist Assessments GET Error]', error);
    return NextResponse.json(
      { message: error.message || 'Failed to retrieve assessment templates' },
      { status: 500 }
    );
  }
}
