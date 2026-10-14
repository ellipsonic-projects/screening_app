import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { QuestionSchema } from '@/lib/validators';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { canonicalizeCategory } from '@/lib/categories';

const BulkInputSchema = z.array(z.any()).min(1, 'At least one question is required');

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
    const arrayValidation = BulkInputSchema.safeParse(data);
    
    if (!arrayValidation.success) {
      return NextResponse.json({ message: 'Invalid payload format', errors: arrayValidation.error.flatten() }, { status: 400 });
    }
    
    const rows = arrayValidation.data;
    const validQuestions: any[] = [];
    const errors: { row: number; field: string; reason: string }[] = [];

    // Row-by-row validation
    for (let i = 0; i < rows.length; i++) {
      // row mapping includes 1-based index (header is row 1, data starts row 2 usually, but we use the index provided by the frontend if available, else i+2)
      const rowIndex = rows[i]._rowIndex || (i + 2);
      
      // Clean up internal _rowIndex before validating
      const rowData = { ...rows[i] };
      delete rowData._rowIndex;

      const validation = QuestionSchema.safeParse(rowData);
      if (validation.success) {
        validQuestions.push(validation.data);
      } else {
        validation.error.issues.forEach((err) => {
          errors.push({
            row: rowIndex,
            field: err.path.join('.'),
            reason: err.message
          });
        });
      }
    }

    if (validQuestions.length === 0) {
      return NextResponse.json({
        success: false,
        imported: 0,
        failed: errors.length,
        message: 'Validation failed for all rows',
        errors
      }, { status: 400 });
    }

    // Use Prisma createMany for bulk insert of valid rows
    const result = await prisma.question.createMany({
      data: validQuestions.map(q => ({
        question_text: q.questionText,
        type: q.type,
        options_json: q.optionsJson || {},
        correct_answer: q.correctAnswer,
        time_limit_seconds: q.timeLimitSeconds,
        points: q.points,
        explanation: q.explanation,
        weight: q.weight,
        expected_duration: q.expectedDuration,
        is_required: q.isRequired,
        display_order: q.displayOrder,
        section: canonicalizeCategory(q.section) || q.section,
        section_order: q.sectionOrder,
        question_order: q.questionOrder,
        is_published: q.isPublished || false,
        created_by: decoded.userId,
      }))
    });

    return NextResponse.json({ 
      success: true,
      imported: result.count,
      failed: errors.length > 0 ? rows.length - result.count : 0,
      message: `Successfully imported ${result.count} questions${errors.length > 0 ? `, skipped ${rows.length - result.count} invalid rows` : ''}`,
      errors: errors.length > 0 ? errors : undefined
    }, { status: errors.length > 0 ? 207 : 201 }); // 207 Multi-Status if partial success
  } catch (error: any) {
    console.error('[Bulk Create Question Error]', error);
    return NextResponse.json(
      { message: error.message || 'Failed to bulk import questions' },
      { status: 500 }
    );
  }
}

