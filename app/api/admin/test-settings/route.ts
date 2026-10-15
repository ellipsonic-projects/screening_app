import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

const MASTER_TEST_NAME = 'MASTER_TEST_CONFIG';

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

    let config = await prisma.testTemplate.findFirst({
      where: { name: MASTER_TEST_NAME }
    });

    if (!config) {
      // Create a default if it doesn't exist
      const admin = await prisma.admin.findUnique({ where: { user_id: decoded.userId }});
      config = await prisma.testTemplate.create({
        data: {
          name: MASTER_TEST_NAME,
          total_duration: 60,
          total_questions: 30,
          min_attempt_percentage: 60,
          min_attempt_enabled: true,
          created_by: decoded.userId
        }
      });
    }

    return NextResponse.json({ config });
  } catch (error: any) {
    console.error('[Get Test Config Error]', error);
    return NextResponse.json({ message: 'Failed to retrieve config' }, { status: 500 });
  }
}

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

    const { total_duration, total_questions, min_attempt_percentage, min_attempt_enabled } = await request.json();

    const parsedMinPercentage = min_attempt_percentage !== undefined
      ? Math.max(1, Math.min(100, Math.round(Number(min_attempt_percentage))))
      : undefined;
    const parsedMinEnabled = min_attempt_enabled !== undefined
      ? Boolean(min_attempt_enabled)
      : undefined;

    let config = await prisma.testTemplate.findFirst({
      where: { name: MASTER_TEST_NAME }
    });

    if (config) {
      config = await prisma.testTemplate.update({
        where: { id: config.id },
        data: {
          total_duration: Number(total_duration),
          total_questions: total_questions ? Number(total_questions) : config.total_questions,
          min_attempt_percentage: parsedMinPercentage !== undefined ? parsedMinPercentage : (config.min_attempt_percentage ?? 60),
          min_attempt_enabled: parsedMinEnabled !== undefined ? parsedMinEnabled : (config.min_attempt_enabled ?? true),
          updated_at: new Date()
        }
      });
    } else {
      config = await prisma.testTemplate.create({
        data: {
          name: MASTER_TEST_NAME,
          total_duration: Number(total_duration),
          total_questions: Number(total_questions) || 30,
          min_attempt_percentage: parsedMinPercentage !== undefined ? parsedMinPercentage : 60,
          min_attempt_enabled: parsedMinEnabled !== undefined ? parsedMinEnabled : true,
          created_by: decoded.userId
        }
      });
    }

    return NextResponse.json({ message: 'Config updated successfully', config });
  } catch (error: any) {
    console.error('[Update Test Config Error]', error);
    return NextResponse.json({ message: 'Failed to update config' }, { status: 500 });
  }
}
