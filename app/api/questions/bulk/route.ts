import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { QuestionSchema } from '@/lib/validators';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { canonicalizeCategory } from '@/lib/categories';

const BulkInputSchema = z.array(z.any()).min(1, 'At least one question is required');

/** Extract the personality question code from an optionsJson object or direct fields (mirrors resolvePersonalityQuestionCode logic). */
function extractPersonalityCode(optionsJson: any): string | null {
  if (!optionsJson) return null;
  let raw = '';
  if (typeof optionsJson === 'string') {
    try {
      const parsed = JSON.parse(optionsJson);
      return extractPersonalityCode(parsed);
    } catch {
      raw = optionsJson;
    }
  } else if (typeof optionsJson === 'object') {
    raw = (optionsJson.code || optionsJson.questionCode || optionsJson.id || '').toString();
  }
  raw = raw.trim().toUpperCase();
  if (/^P(0?[1-9]|[12][0-9]|3[0-3])$/i.test(raw)) {
    return raw.length === 2 ? `P0${raw.slice(1)}` : raw;
  }
  return null;
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

    // ── Personality duplicate-code pre-flight ──────────────────────────────────
    // 1. Collect P-codes from the incoming batch (detect within-batch duplicates).
    // 2. Query existing DB questions for already-used P-codes.
    // Any collision is turned into a row-level error; those rows are skipped.
    const batchCodesSeen = new Map<string, number>(); // code → first rowIndex seen
    const batchCodeErrors = new Set<number>();         // rowIndexes to skip

    for (let i = 0; i < rows.length; i++) {
      const rowIndex = rows[i]._rowIndex || (i + 2);
      const rowSection = canonicalizeCategory(String(rows[i].section || rows[i]['Section'] || ''));
      if (rowSection !== 'PERSONALITY') continue;

      let code = extractPersonalityCode(rows[i].optionsJson || rows[i]['optionsJson']);
      if (!code) {
        code = extractPersonalityCode({ code: rows[i].code || rows[i]['Question Code'] || rows[i]['Code'] });
      }
      if (!code) continue; // schema validation will catch missing/invalid codes later

      if (batchCodesSeen.has(code)) {
        const firstRow = batchCodesSeen.get(code)!;
        errors.push({
          row: rowIndex,
          field: 'optionsJson.code',
          reason: `Duplicate Personality question code "${code}" in this upload (first seen at row ${firstRow}). Each P-code may only appear once.`
        });
        batchCodeErrors.add(rowIndex);
        // Also mark the first occurrence as a duplicate
        if (!batchCodeErrors.has(firstRow)) {
          errors.push({
            row: firstRow,
            field: 'optionsJson.code',
            reason: `Duplicate Personality question code "${code}" in this upload (also appears at row ${rowIndex}). Each P-code may only appear once.`
          });
          batchCodeErrors.add(firstRow);
        }
      } else {
        batchCodesSeen.set(code, rowIndex);
      }
    }

    // Fetch codes that already exist in the database
    if (batchCodesSeen.size > 0) {
      const candidateCodes = Array.from(batchCodesSeen.keys());
      const existingQuestions = await prisma.question.findMany({
        where: { section: 'PERSONALITY' },
        select: { options_json: true, question_text: true }
      });

      const existingCodes = new Set<string>();
      for (const q of existingQuestions) {
        let code = extractPersonalityCode(q.options_json);
        if (!code && q.question_text) {
          const match = String(q.question_text).match(/^\s*\[?(P0?[1-9]|P[12][0-9]|P3[0-3])\]?[:\s.-]/i);
          if (match && match[1]) {
            const m = match[1].toUpperCase();
            code = m.length === 2 ? `P0${m.slice(1)}` : m;
          }
        }
        if (code) existingCodes.add(code);
      }

      for (const code of candidateCodes) {
        if (existingCodes.has(code)) {
          const rowIndex = batchCodesSeen.get(code)!;
          if (!batchCodeErrors.has(rowIndex)) {
            errors.push({
              row: rowIndex,
              field: 'optionsJson.code',
              reason: `Personality question code "${code}" already exists in the database. Remove or update the existing question before re-uploading this code.`
            });
            batchCodeErrors.add(rowIndex);
          }
        }
      }
    }
    // ── End Personality duplicate-code pre-flight ──────────────────────────────

    // Row-by-row validation
    for (let i = 0; i < rows.length; i++) {
      // row mapping includes 1-based index (header is row 1, data starts row 2 usually, but we use the index provided by the frontend if available, else i+2)
      const rowIndex = rows[i]._rowIndex || (i + 2);
      
      // Skip rows that failed the Personality duplicate-code pre-flight check
      if (batchCodeErrors.has(rowIndex)) continue;

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
        points: (canonicalizeCategory(q.section) || q.section) === 'PERSONALITY' ? 0 : q.points,
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

