import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * GET /api/admin/students
 * Get all students (Admin only)
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
      return NextResponse.json({ message: 'Only admins can view all students' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');
    const roundParam = searchParams.get('round');
    const templateId = searchParams.get('templateId') || searchParams.get('assessmentId');
    const targetRound = roundParam ? parseInt(roundParam, 10) : undefined;

    // Build Prisma query filters
    const whereClause: any = {};

    const testsWhere: any = {};
    if (targetRound !== undefined && !isNaN(targetRound)) {
      testsWhere.round = targetRound;
    }
    if (templateId) {
      testsWhere.template_id = templateId;
    }

    const students = await prisma.student.findMany({
      where: whereClause,
      include: {
        user: {
          select: { email: true }
        },
        tests: {
          where: Object.keys(testsWhere).length > 0 ? testsWhere : undefined,
          select: {
            id: true,
            score: true,
            status: true,
            round: true,
            title: true,
            template_id: true,
            created_at: true,
            end_time: true
          },
          orderBy: [
            { round: 'desc' },
            { created_at: 'desc' }
          ]
        }
      },
      take: limit,
      skip: offset,
      orderBy: { created_at: 'desc' }
    });

    const formattedStudents = students.map(s => {
      const tests = s.tests || [];
      const test_count = tests.length;
      const validTests = tests.filter(t => t.score !== null);
      const avg_score = validTests.length > 0 ? Number(validTests[0].score) : 0;

      const rounds = tests.map(t => ({
        id: t.id,
        round: t.round,
        title: t.title || (t.round === 2 ? 'Round 2 Technical Interview Assessment' : 'Round 1 Assessment'),
        score: t.score !== null ? Number(t.score) : null,
        status: t.status,
        submittedAt: t.end_time,
        templateId: t.template_id
      }));

      return {
        id: s.id,
        fullName: s.full_name,
        usn: s.usn,
        branch: s.branch_name || '',
        college: s.college,
        email: s.user?.email || '',
        test_count,
        avg_score,
        rounds,
        eligibility_status: 'N/A',
        eligibility_reason: 'N/A'
      };
    });

    return NextResponse.json({
      message: 'Students retrieved',
      students: formattedStudents,
    });
  } catch (error: any) {
    console.error('[Get Students Error]', error);
    return NextResponse.json(
      { message: error.message || 'Failed to retrieve students' },
      { status: 400 }
    );
  }
}
