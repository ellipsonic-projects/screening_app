import 'dotenv/config';
import { mapQuestionPayload } from '../lib/questionMapper';
import { QuestionSchema } from '../lib/validators';
import { canonicalizeCategory, isPersonalityCategory } from '../lib/categories';
import prisma from '../lib/prisma';

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASSED: ${message}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAILED: ${message}`);
    failedCount++;
  }
}

/** Helper extracted from bulk route for testing logic parity */
function extractPersonalityCode(obj: any): string | null {
  if (!obj) return null;
  let raw = '';
  if (typeof obj === 'string') {
    try {
      const parsed = JSON.parse(obj);
      return extractPersonalityCode(parsed);
    } catch {
      raw = obj;
    }
  } else if (typeof obj === 'object') {
    raw = (obj.code || obj.questionCode || obj.id || '').toString();
  }
  raw = raw.trim().toUpperCase();
  if (/^P(0?[1-9]|[12][0-9]|3[0-3])$/i.test(raw)) {
    return raw.length === 2 ? `P0${raw.slice(1)}` : raw;
  }
  return null;
}

/** Pre-flight duplicate code checker (mirrors app/api/questions/bulk/route.ts) */
async function runDuplicateCheckPreflight(rows: any[], mockExistingDbCodes: string[] = []) {
  const errors: { row: number; field: string; reason: string }[] = [];
  const batchCodesSeen = new Map<string, number>();
  const batchCodeErrors = new Set<number>();

  for (let i = 0; i < rows.length; i++) {
    const rowIndex = rows[i]._rowIndex || (i + 2);
    const rowSection = canonicalizeCategory(String(rows[i].section || rows[i]['Section'] || ''));
    if (rowSection !== 'PERSONALITY') continue;

    let code = extractPersonalityCode(rows[i].optionsJson || rows[i]['optionsJson']);
    if (!code) {
      code = extractPersonalityCode({ code: rows[i].code || rows[i]['Question Code'] || rows[i]['Code'] });
    }
    if (!code) continue;

    if (batchCodesSeen.has(code)) {
      const firstRow = batchCodesSeen.get(code)!;
      errors.push({
        row: rowIndex,
        field: 'optionsJson.code',
        reason: `Duplicate Personality question code "${code}" in this upload (first seen at row ${firstRow}). Each P-code may only appear once.`
      });
      batchCodeErrors.add(rowIndex);
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

  const existingCodes = new Set<string>(mockExistingDbCodes);
  for (const [code, rowIndex] of batchCodesSeen.entries()) {
    if (existingCodes.has(code)) {
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

  return { errors, batchCodeErrors, batchCodesSeen };
}

async function runQuestionImportPersonalityTests() {
  console.log('\n============================================================');
  console.log('   RUNNING PERSONALITY QUESTION IMPORT VERIFICATION SUITE   ');
  console.log('============================================================\n');

  // ========================================================
  // SUITE 1: Valid Personality Question Codes (P01–P33)
  // ========================================================
  console.log('--- SUITE 1: Valid Personality Question Codes (P01–P33) ---');
  {
    const validCodes = ['P01', 'P06', 'P07', 'P12', 'P13', 'P18', 'P19', 'P33'];
    for (const code of validCodes) {
      const row = {
        'Section': 'Personality',
        'Question Code': code,
        'Question Text': `Sample question for code ${code}`,
        'Minimum Words': 50,
        'Maximum Words': 200,
        'Marks': 10
      };
      const payload = mapQuestionPayload(row, 2);
      assert(payload.section === 'PERSONALITY', `Code ${code}: Section mapped to canonical PERSONALITY`);
      assert(payload.type === 'open_text', `Code ${code}: Type mapped to open_text`);
      assert(payload.optionsJson.code === code, `Code ${code}: optionsJson.code correctly stored as ${code}`);
      assert(payload.points === 0, `Code ${code}: Points strictly forced to 0 regardless of Marks column`);
      assert(payload.optionsJson.minWords === 50, `Code ${code}: minWords preserved as 50`);
      assert(payload.optionsJson.maxWords === 200, `Code ${code}: maxWords preserved as 200`);

      const parsed = QuestionSchema.safeParse(payload);
      assert(parsed.success === true, `Code ${code}: Passes QuestionSchema validation`);
    }
  }

  // ========================================================
  // SUITE 2: Lowercase & Single-Digit Normalization
  // ========================================================
  console.log('\n--- SUITE 2: Lowercase & Single-Digit Normalization ---');
  {
    // Lowercase p01 -> P01
    const lowerP01 = mapQuestionPayload({
      'Section': 'Personality',
      'Question Code': 'p01',
      'Question Text': 'Describe your hobby.'
    });
    assert(lowerP01.optionsJson.code === 'P01', 'Lowercase "p01" normalized to uppercase "P01"');

    // Lowercase p33 -> P33
    const lowerP33 = mapQuestionPayload({
      'Section': 'Personality',
      'Question Code': 'p33',
      'Question Text': 'Reflect on your personal growth.'
    });
    assert(lowerP33.optionsJson.code === 'P33', 'Lowercase "p33" normalized to uppercase "P33"');

    // Single-digit P7 -> P07
    const singleDigitP7 = mapQuestionPayload({
      'Section': 'Personality',
      'Question Code': 'P7',
      'Question Text': 'Describe an ambiguous situation.'
    });
    assert(singleDigitP7.optionsJson.code === 'P07', 'Single-digit "P7" normalized with leading zero to "P07"');

    // Lowercase single-digit p7 -> P07
    const lowerSingleDigit = mapQuestionPayload({
      'Section': 'Personality',
      'Question Code': 'p7',
      'Question Text': 'Describe another situation.'
    });
    assert(lowerSingleDigit.optionsJson.code === 'P07', 'Lowercase single-digit "p7" normalized to "P07"');

    // Single-digit P1 -> P01
    const singleDigitP1 = mapQuestionPayload({
      'Section': 'Personality',
      'Question Code': 'P1',
      'Question Text': 'Tell us about your interests.'
    });
    assert(singleDigitP1.optionsJson.code === 'P01', 'Single-digit "P1" normalized to "P01"');
  }

  // ========================================================
  // SUITE 3: Missing Question Code Rejection
  // ========================================================
  console.log('\n--- SUITE 3: Missing Question Code Rejection ---');
  {
    // Omitted column entirely
    let omittedThrew = false;
    let omittedMsg = '';
    try {
      mapQuestionPayload({
        'Section': 'Personality',
        'Question Text': 'What is your leadership style?'
      }, 5);
    } catch (e: any) {
      omittedThrew = true;
      omittedMsg = e.message;
    }
    assert(omittedThrew, 'Rejects Personality row missing Question Code column');
    assert(omittedMsg.includes('Row 5'), 'Error message specifies exact row number (Row 5)');
    assert(omittedMsg.includes('missing a Question Code'), 'Error explains that code is missing');

    // Empty string code
    let emptyThrew = false;
    try {
      mapQuestionPayload({
        'Section': 'Personality',
        'Question Code': '   ',
        'Question Text': 'What is your leadership style?'
      }, 8);
    } catch (e: any) {
      emptyThrew = true;
      assert(e.message.includes('Row 8'), 'Empty code specifies row 8');
    }
    assert(emptyThrew, 'Rejects Personality row with whitespace-only Question Code');
  }

  // ========================================================
  // SUITE 4: Invalid Question Code Rejection
  // ========================================================
  console.log('\n--- SUITE 4: Invalid Question Code Rejection ---');
  {
    const invalidCodes = [
      'P00',   // Below minimum (01 is min)
      'P0',    // Zero single digit
      'P34',   // Above maximum (33 is max)
      'P99',   // Way above maximum
      'P100',  // 3 digits
      'Q01',   // Wrong letter prefix
      '01',    // Missing P prefix
      'P',     // Letter only
      'INVALID', // Text string
      'P-01',  // Hyphenated
      'P001'   // Double zero
    ];

    for (const invalid of invalidCodes) {
      let threw = false;
      let errMsg = '';
      try {
        mapQuestionPayload({
          'Section': 'Personality',
          'Question Code': invalid,
          'Question Text': 'Sample text'
        }, 12);
      } catch (e: any) {
        threw = true;
        errMsg = e.message;
      }
      assert(threw, `Invalid code "${invalid}" is rejected`);
      assert(errMsg.includes('Invalid Question Code'), `Error for "${invalid}" specifies invalid code`);
    }
  }

  // ========================================================
  // SUITE 5: Zero Marks Enforcement (Unscored Safeguard)
  // ========================================================
  console.log('\n--- SUITE 5: Zero Marks Enforcement (Unscored Safeguard) ---');
  {
    const marksTests = [
      { Marks: 10 },
      { Marks: '15' },
      { Points: 20 },
      { Points: '100' },
      { marks: 5 },
      { points: 50 },
      { Marks: 0 }
    ];

    for (const testCase of marksTests) {
      const payload = mapQuestionPayload({
        'Section': 'Personality',
        'Question Code': 'P10',
        'Question Text': 'Describe a team conflict.',
        ...testCase
      });
      assert(payload.points === 0, `Points strictly forced to 0 with input ${JSON.stringify(testCase)}`);
    }
  }

  // ========================================================
  // SUITE 6: Column Header Aliases
  // ========================================================
  console.log('\n--- SUITE 6: Column Header Aliases ---');
  {
    // Question Text vs Question
    const p1 = mapQuestionPayload({
      'Section': 'Personality',
      'Question Code': 'P02',
      'Question Text': 'Alias test Question Text'
    });
    assert(p1.questionText === 'Alias test Question Text', 'Reads column "Question Text"');

    const p2 = mapQuestionPayload({
      'Section': 'Personality',
      'Question Code': 'P02',
      'Question': 'Alias test Question'
    });
    assert(p2.questionText === 'Alias test Question', 'Reads column "Question" as alias');

    // Marks vs Points
    const ordinary1 = mapQuestionPayload({
      'Section': 'Written Communication & Collaboration',
      'Question Text': 'Essay 1',
      'Marks': 15
    });
    assert(ordinary1.points === 15, 'Non-Personality reads column "Marks" as points');

    const ordinary2 = mapQuestionPayload({
      'Section': 'Written Communication & Collaboration',
      'Question Text': 'Essay 2',
      'Points': 25
    });
    assert(ordinary2.points === 25, 'Non-Personality reads column "Points" as points');

    // Minimum Words vs Min Words
    const wordTest1 = mapQuestionPayload({
      'Section': 'Personality',
      'Question Code': 'P03',
      'Question Text': 'Word limit test',
      'Minimum Words': 60,
      'Maximum Words': 180
    });
    assert(wordTest1.optionsJson.minWords === 60, 'Reads "Minimum Words"');
    assert(wordTest1.optionsJson.maxWords === 180, 'Reads "Maximum Words"');

    const wordTest2 = mapQuestionPayload({
      'Section': 'Personality',
      'Question Code': 'P03',
      'Question Text': 'Word limit test 2',
      'Min Words': 75,
      'Max Words': 225
    });
    assert(wordTest2.optionsJson.minWords === 75, 'Reads "Min Words" as alias');
    assert(wordTest2.optionsJson.maxWords === 225, 'Reads "Max Words" as alias');

    // Question Code vs Code
    const codeAliasTest = mapQuestionPayload({
      'Section': 'Personality',
      'Code': 'P15',
      'Question Text': 'Code column alias test'
    });
    assert(codeAliasTest.optionsJson.code === 'P15', 'Reads column "Code" as alias for "Question Code"');
  }

  // ========================================================
  // SUITE 7: Backward Compatibility for Non-Personality Open Text
  // ========================================================
  console.log('\n--- SUITE 7: Backward Compatibility for Non-Personality Open Text ---');
  {
    // Old spreadsheet without Question Code column
    const legacyRow = {
      'Section': 'Written Communication & Collaboration',
      'Question Text': 'Describe a complex project you managed and how you communicated progress to stakeholders.',
      'Minimum Words': 100,
      'Maximum Words': 500,
      'Marks': 10
    };
    const legacyPayload = mapQuestionPayload(legacyRow, 3);
    assert(legacyPayload.section === 'COMMUNICATION_AND_TEAMWORK', 'Non-Personality section canonicalized correctly');
    assert(legacyPayload.type === 'open_text', 'Non-Personality type remains open_text');
    assert(legacyPayload.points === 10, 'Non-Personality points preserved as 10 (not forced to 0)');
    assert(legacyPayload.optionsJson.minWords === 100, 'Non-Personality minWords preserved');
    assert(legacyPayload.optionsJson.maxWords === 500, 'Non-Personality maxWords preserved');
    assert(legacyPayload.optionsJson.code === undefined, 'Non-Personality optionsJson has no code attribute');

    const legacyParsed = QuestionSchema.safeParse(legacyPayload);
    assert(legacyParsed.success === true, 'Legacy row passes QuestionSchema validation');

    // Non-Personality row with empty Question Code column
    const emptyCodeNonPersonality = mapQuestionPayload({
      'Section': 'Problem Solving & System Design',
      'Question Code': '',
      'Question Text': 'Design a caching layer for high throughput.',
      'Marks': 20
    });
    assert(emptyCodeNonPersonality.section === 'PROBLEM_SOLVING', 'Problem Solving canonicalized');
    assert(emptyCodeNonPersonality.points === 20, 'Points preserved as 20');
    assert(emptyCodeNonPersonality.optionsJson.code === undefined, 'Code is undefined for non-Personality');

    // Non-Personality row with arbitrary text in Question Code column (ignored)
    const arbitraryCodeNonPersonality = mapQuestionPayload({
      'Section': 'Delivery & Dependability',
      'Question Code': 'TASK-01',
      'Question Text': 'How do you handle scope creep?',
      'Marks': 15
    });
    assert(arbitraryCodeNonPersonality.section === 'EXECUTION_AND_RELIABILITY', 'Execution & Reliability canonicalized');
    assert(arbitraryCodeNonPersonality.optionsJson.code === undefined, 'Arbitrary code ignored for non-Personality section');
  }

  // ========================================================
  // SUITE 8: Within-Batch Duplicate Code Detection
  // ========================================================
  console.log('\n--- SUITE 8: Within-Batch Duplicate Code Detection ---');
  {
    const batchWithDuplicates = [
      {
        _rowIndex: 2,
        Section: 'Personality',
        'Question Code': 'P07',
        'Question Text': 'First P07 question',
        Marks: 0
      },
      {
        _rowIndex: 3,
        Section: 'Written Communication & Collaboration',
        'Question Text': 'Non-personality question',
        Marks: 10
      },
      {
        _rowIndex: 4,
        Section: 'Personality',
        'Question Code': 'P12',
        'Question Text': 'Valid P12 question',
        Marks: 0
      },
      {
        _rowIndex: 5,
        Section: 'Personality',
        'Question Code': 'P07', // Duplicate of row 2!
        'Question Text': 'Second P07 question (duplicate)',
        Marks: 0
      }
    ];

    const result = await runDuplicateCheckPreflight(batchWithDuplicates);
    assert(result.batchCodeErrors.has(2), 'Flags first occurrence (row 2) as duplicate');
    assert(result.batchCodeErrors.has(5), 'Flags second occurrence (row 5) as duplicate');
    assert(!result.batchCodeErrors.has(3), 'Row 3 (non-personality) is NOT flagged');
    assert(!result.batchCodeErrors.has(4), 'Row 4 (P12, distinct) is NOT flagged');

    const row2Error = result.errors.find(e => e.row === 2);
    const row5Error = result.errors.find(e => e.row === 5);
    assert(row2Error !== undefined, 'Row 2 error is registered');
    assert(row5Error !== undefined, 'Row 5 error is registered');
    assert(row5Error!.reason.includes('Duplicate Personality question code "P07"'), 'Row 5 error specifies duplicate code P07');
    assert(row5Error!.reason.includes('first seen at row 2'), 'Row 5 error references row 2');

    // Case-insensitive duplicate check: P07 and p07
    const caseDuplicates = [
      { _rowIndex: 2, Section: 'Personality', 'Question Code': 'P07' },
      { _rowIndex: 3, Section: 'Personality', 'Question Code': 'p07' }
    ];
    const caseResult = await runDuplicateCheckPreflight(caseDuplicates);
    assert(caseResult.batchCodeErrors.has(2) && caseResult.batchCodeErrors.has(3), 'Detects case-insensitive duplicate "P07" vs "p07"');

    // Normalization duplicate check: P7 vs P07
    const normDuplicates = [
      { _rowIndex: 2, Section: 'Personality', 'Question Code': 'P7' },
      { _rowIndex: 3, Section: 'Personality', 'Question Code': 'P07' }
    ];
    const normResult = await runDuplicateCheckPreflight(normDuplicates);
    assert(normResult.batchCodeErrors.has(2) && normResult.batchCodeErrors.has(3), 'Detects normalized duplicate "P7" vs "P07"');
  }

  // ========================================================
  // SUITE 9: Database Duplicate Code Detection
  // ========================================================
  console.log('\n--- SUITE 9: Database Duplicate Code Detection ---');
  {
    // Simulate DB having P01 and P15
    const mockDbCodes = ['P01', 'P15'];

    const incomingBatch = [
      {
        _rowIndex: 2,
        Section: 'Personality',
        'Question Code': 'P01', // Exists in DB!
        'Question Text': 'Already in DB'
      },
      {
        _rowIndex: 3,
        Section: 'Personality',
        'Question Code': 'P09', // Fresh code!
        'Question Text': 'Fresh question'
      },
      {
        _rowIndex: 4,
        Section: 'Personality',
        'Question Code': 'p15', // Lowercase of DB code P15!
        'Question Text': 'Also already in DB'
      }
    ];

    const result = await runDuplicateCheckPreflight(incomingBatch, mockDbCodes);
    assert(result.batchCodeErrors.has(2), 'Flags row 2 (P01) as collision with existing DB question');
    assert(result.batchCodeErrors.has(4), 'Flags row 4 (p15) as collision with existing DB question');
    assert(!result.batchCodeErrors.has(3), 'Row 3 (P09, fresh) is NOT flagged');

    const dbCollisionError = result.errors.find(e => e.row === 2);
    assert(dbCollisionError !== undefined, 'Collision error present for row 2');
    assert(dbCollisionError!.reason.includes('already exists in the database'), 'Error clearly indicates code already exists in database');
    assert(dbCollisionError!.reason.includes('Remove or update the existing question before re-uploading'), 'Instructions provided on remediation');
  }

  // ========================================================
  // SUITE 10: Live DB Integration (Reading Personality questions)
  // ========================================================
  console.log('\n--- SUITE 10: Live DB Integration & Preservation ---');
  {
    const existingPersonalityInDb = await prisma.question.findMany({
      where: { section: 'PERSONALITY' },
      select: { id: true, question_text: true, options_json: true, points: true }
    });

    console.log(`  ℹ Found ${existingPersonalityInDb.length} existing Personality questions in the database.`);
    for (const q of existingPersonalityInDb) {
      assert(q.points === 0, `Existing DB question [${q.id.slice(0, 8)}] has points = 0`);
    }

    // Verify extractPersonalityCode works on live DB questions if any exist
    for (const q of existingPersonalityInDb) {
      const code = extractPersonalityCode(q.options_json);
      if (code) {
        assert(/^P(0[1-9]|[12][0-9]|3[0-3])$/.test(code), `DB question [${q.id.slice(0, 8)}] has valid normalized code: ${code}`);
      }
    }
  }

  // ========================================================
  // SUMMARY
  // ========================================================
  console.log('\n============================================================');
  console.log(`PERSONALITY IMPORT TEST SUMMARY: ${passedCount} PASSED | ${failedCount} FAILED`);
  console.log('============================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runQuestionImportPersonalityTests().catch(err => {
  console.error('Test runner encountered unexpected error:', err);
  process.exit(1);
});

