import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { QuestionSchema } from '@/lib/validators';
import prisma from '@/lib/prisma';
import { canonicalizeCategory } from '@/lib/categories';

/**
 * GET /api/questions
 * Get questions (with filters)
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json({ message: 'Invalid or expired token' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const isPublished = searchParams.get('isPublished');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build Prisma where clause
    const whereClause: any = {};
    
    // If student, force isPublished to true
    if (decoded.role === 'student') {
      whereClause.is_published = true;
    } else if (isPublished !== null) {
      whereClause.is_published = isPublished === 'true';
    }

    const questions = await prisma.question.findMany({
      where: whereClause,
      take: limit,
      skip: offset,
      orderBy: { created_at: 'desc' }
    });

    return NextResponse.json({
      message: 'Questions retrieved',
      questions,
    });
  } catch (error: any) {
    console.error('[Get Questions Error]', error);
    return NextResponse.json(
      { message: error.message || 'Failed to retrieve questions' },
      { status: 400 }
    );
  }
}

/**
 * POST /api/questions
 * Create a new question (Admin only)
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
      return NextResponse.json({ message: 'Only admins can create questions' }, { status: 403 });
    }

    const data = await request.json();
    const validationResult = QuestionSchema.safeParse(data);
    
    if (!validationResult.success) {
      const errorStr = validationResult.error.issues.map((e: any) => e.message).join('\n');
      return NextResponse.json(
        { 
          message: errorStr || 'Validation failed', 
          errors: validationResult.error.issues 
        }, 
        { status: 400 }
      );
    }
    
    const validatedData = validationResult.data;
    const rawSection = validatedData.section;
    const canonicalSection = rawSection ? canonicalizeCategory(rawSection) : 'APTITUDE';
    if (rawSection && !canonicalSection) {
      return NextResponse.json({ message: `Invalid category: "${rawSection}"` }, { status: 400 });
    }

    const question = await prisma.question.create({
      data: {
        question_text: validatedData.questionText,
        type: validatedData.type,
        options_json: validatedData.optionsJson || {},
        correct_answer: validatedData.correctAnswer,
        time_limit_seconds: validatedData.timeLimitSeconds,
        points: validatedData.points,
        explanation: validatedData.explanation,
        is_published: validatedData.isPublished,
        weight: validatedData.weight,
        expected_duration: validatedData.expectedDuration,
        is_required: validatedData.isRequired,
        display_order: validatedData.displayOrder,
        section: canonicalSection || 'APTITUDE',
        section_order: validatedData.sectionOrder,
        question_order: validatedData.questionOrder,
        created_by: decoded.userId,
      }
    });

    return NextResponse.json(
      { message: 'Question created', question },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[Create Question Error]', error);
    return NextResponse.json(
      { message: error.message || 'Failed to create question' },
      { status: 400 }
    );
  }
}
