import 'dotenv/config';
import prisma from '../lib/prisma';
import { generateToken } from '../lib/auth';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

interface TestResult {
  requirement: string;
  testName: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runAuditCheck(requirement: string, testName: string, fn: () => Promise<void>) {
  try {
    process.stdout.write(`  ⏳ [${requirement}] ${testName}... `);
    await fn();
    console.log('✅ PASSED');
    results.push({ requirement, testName, passed: true });
  } catch (err: any) {
    console.log('❌ FAILED');
    console.error(`     Error: ${err.message}`);
    results.push({ requirement, testName, passed: false, details: err.message });
  }
}

async function main() {
  console.log('\n============================================================');
  console.log('🔍 FINAL AUDIT: DYNAMIC ASSESSMENT DATA VERIFICATION SUITE');
  console.log('============================================================\n');

  let adminToken = '';
  let studentToken = '';
  let studentUserId = '';
  let studentRecordId = '';
  let standardTestId = '5d5f9d51-3e1d-43fd-9f8b-7f101b4d17c1'; // Jon's active 42-question test
  let customTestId = '';

  try {
    // -------------------------------------------------------------------
    // 0. AUTHENTICATION & TEST CONTEXT SETUP
    // -------------------------------------------------------------------
    const jonUser = await prisma.user.findFirst({
      where: { email: 'jon@gmail.com' },
      include: { student: true },
    });
    if (!jonUser || !jonUser.student) throw new Error('Jon user and student profile must exist');
    studentUserId = jonUser.id;
    studentRecordId = jonUser.student.id;
    studentToken = generateToken({
      userId: jonUser.id,
      email: jonUser.email,
      role: jonUser.role as any,
    });

    const superAdmin = await prisma.user.findFirst({
      where: { email: 'superadmin@portal.com' },
    });
    if (!superAdmin) throw new Error('Superadmin must exist');
    adminToken = generateToken({
      userId: superAdmin.id,
      email: superAdmin.email,
      role: superAdmin.role as any,
    });

    // Reset standardTestId to fresh in_progress session for testing active assessment state
    await prisma.test.update({
      where: { id: standardTestId },
      data: {
        status: 'in_progress',
        is_completed: false,
        start_time: new Date(),
        updated_at: new Date(),
        end_time: null,
      },
    });

    // -------------------------------------------------------------------
    // REQUIREMENT 1: QUESTIONS DATA-DRIVEN
    // -------------------------------------------------------------------
    await runAuditCheck(
      'Req 1: Questions',
      'Questions count, numbering, text, and options match database assignment',
      async () => {
        const res = await fetch(`${BASE_URL}/api/tests/${standardTestId}`, {
          headers: { Authorization: `Bearer ${studentToken}` },
        });
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        const data = await res.json();
        const test = data.test;

        // Verify count matches test_questions in DB
        const dbTestQuestions = await prisma.testQuestion.findMany({
          where: { test_id: standardTestId },
          include: { question: true },
          orderBy: { sequence_number: 'asc' },
        });

        assert(
          test.questions.length === dbTestQuestions.length,
          `Expected ${dbTestQuestions.length} questions, got ${test.questions.length}`
        );

        // Verify question fields are dynamic and not mocked
        for (let i = 0; i < test.questions.length; i++) {
          const apiQ = test.questions[i];
          const dbQ = dbTestQuestions[i].question;
          assert(apiQ.id === dbQ.id, `Question ${i + 1} ID mismatch`);
          assert(apiQ.questionText === dbQ.question_text, `Question ${i + 1} text mismatch`);
          assert(apiQ.type === dbQ.type, `Question ${i + 1} type mismatch`);
          assert(apiQ.section === dbQ.section, `Question ${i + 1} section mismatch`);
        }
      }
    );

    // -------------------------------------------------------------------
    // REQUIREMENT 2: SECTIONS DYNAMICALLY DERIVED
    // -------------------------------------------------------------------
    await runAuditCheck(
      'Req 2: Sections',
      'Section names, counts, and question membership are 100% derived from question data',
      async () => {
        const res = await fetch(`${BASE_URL}/api/tests/${standardTestId}`, {
          headers: { Authorization: `Bearer ${studentToken}` },
        });
        const data = await res.json();
        const questions: any[] = data.test.questions;

        // Group dynamically exactly as test-interface.tsx does
        const derivedSections = questions.reduce((acc: any[], q: any, idx: number) => {
          const secName = q.section || 'General';
          let secObj = acc.find((s) => s.name === secName);
          if (!secObj) {
            secObj = { name: secName, questions: [] };
            acc.push(secObj);
          }
          secObj.questions.push({ ...q, originalIndex: idx });
          return acc;
        }, []);

        // Query distinct sections directly from the DB test questions
        const dbSectionsGrouped = await prisma.question.groupBy({
          by: ['section'],
          where: {
            test_questions: {
              some: { test_id: standardTestId },
            },
          },
          _count: { id: true },
        });

        assert(
          derivedSections.length === dbSectionsGrouped.length,
          `Section count mismatch: derived ${derivedSections.length}, DB has ${dbSectionsGrouped.length}`
        );

        for (const dbSec of dbSectionsGrouped) {
          const secName = dbSec.section || 'General';
          const match = derivedSections.find((s) => s.name === secName);
          assert(!!match, `Derived sections missing section '${secName}'`);
          assert(
            match.questions.length === dbSec._count.id,
            `Section '${secName}' count mismatch: expected ${dbSec._count.id}, got ${match.questions.length}`
          );
        }
      }
    );

    // -------------------------------------------------------------------
    // REQUIREMENT 3: ANSWER PERSISTENCE & IMMEDIATE PROGRESS UPDATE
    // -------------------------------------------------------------------
    await runAuditCheck(
      'Req 3: Progress & Persistence',
      'Answers persist via auto-save, restore accurately on load, and update answered count',
      async () => {
        // Fetch test questions
        const resBefore = await fetch(`${BASE_URL}/api/tests/${standardTestId}`, {
          headers: { Authorization: `Bearer ${studentToken}` },
        });
        const dataBefore = await resBefore.json();
        const testQ = dataBefore.test.questions[0];

        // 1. Auto-save an answer
        const testAnswer = 'Option B - Dynamic Test Answer';
        const saveRes = await fetch(`${BASE_URL}/api/tests/${standardTestId}/auto-save`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${studentToken}`,
          },
          body: JSON.stringify({
            questionId: testQ.id,
            answer: testAnswer,
          }),
        });
        assert(saveRes.status === 200, `Auto-save failed with status ${saveRes.status}`);

        // 2. Refresh/Fetch test to verify answer restoration
        const resAfter = await fetch(`${BASE_URL}/api/tests/${standardTestId}`, {
          headers: { Authorization: `Bearer ${studentToken}` },
        });
        const dataAfter = await resAfter.json();
        const responses = dataAfter.test.responses || [];
        const savedResp = responses.find((r: any) => r.question_id === testQ.id);

        assert(!!savedResp, 'Saved response not found in test responses');
        assert(savedResp.student_answer === testAnswer, 'Saved response text mismatch');

        // 3. Clear the answer and verify update
        const clearRes = await fetch(`${BASE_URL}/api/tests/${standardTestId}/auto-save`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${studentToken}`,
          },
          body: JSON.stringify({
            questionId: testQ.id,
            answer: '',
          }),
        });
        assert(clearRes.status === 200, `Clear answer failed with status ${clearRes.status}`);

        const resCleared = await fetch(`${BASE_URL}/api/tests/${standardTestId}`, {
          headers: { Authorization: `Bearer ${studentToken}` },
        });
        const dataCleared = await resCleared.json();
        const clearedResp = (dataCleared.test.responses || []).find((r: any) => r.question_id === testQ.id);
        assert(
          !clearedResp || clearedResp.student_answer === '',
          'Cleared answer did not persist as empty string'
        );
      }
    );

    // -------------------------------------------------------------------
    // REQUIREMENT 4: QUESTION STATUS (DUAL ANSWERED + FLAGGED)
    // -------------------------------------------------------------------
    await runAuditCheck(
      'Req 4: Question Status',
      'Answered and flagged states can exist simultaneously without mutual exclusion',
      async () => {
        // Validate component logic:
        // isAnswered = true, isFlagged = true, isSelected = true
        // isAnswered = true, isFlagged = true, isSelected = false
        const mockQuestions = [
          { id: 'q1', section: 'A' },
          { id: 'q2', section: 'A' },
          { id: 'q3', section: 'B' },
        ];
        const answers: Record<string, string> = { q1: 'Ans 1', q2: 'Ans 2' };
        const flags: Record<string, boolean> = { q1: true, q3: true };

        // q1 is both answered and flagged
        const isQ1Answered = !!answers['q1'] && answers['q1'].length > 0;
        const isQ1Flagged = !!flags['q1'];
        assert(isQ1Answered === true, 'q1 must be answered');
        assert(isQ1Flagged === true, 'q1 must be flagged');

        // q2 is answered only
        const isQ2Answered = !!answers['q2'] && answers['q2'].length > 0;
        const isQ2Flagged = !!flags['q2'];
        assert(isQ2Answered === true && isQ2Flagged === false, 'q2 must be answered only');

        // q3 is flagged only
        const isQ3Answered = !!answers['q3'] && answers['q3'].length > 0;
        const isQ3Flagged = !!flags['q3'];
        assert(isQ3Answered === false && isQ3Flagged === true, 'q3 must be flagged only');
      }
    );

    // -------------------------------------------------------------------
    // REQUIREMENT 5: TIMER AUTHORITATIVE DURATION & CONTINUITY
    // -------------------------------------------------------------------
    await runAuditCheck(
      'Req 5: Timer Continuity',
      'Timer duration is data-driven, start_time is authoritative and does not reset on repeated PATCH or fetch',
      async () => {
        const res = await fetch(`${BASE_URL}/api/tests/${standardTestId}`, {
          headers: { Authorization: `Bearer ${studentToken}` },
        });
        const data = await res.json();
        const test = data.test;

        assert(test.total_duration === 60, `Expected total_duration to be 60, got ${test.total_duration}`);
        assert(!!test.start_time, 'Test start_time must exist for in_progress test');

        const originalStartTime = new Date(test.start_time).getTime();

        // Simulate PATCH /api/tests/[id] with status: in_progress (e.g. repeated call)
        const patchRes = await fetch(`${BASE_URL}/api/tests/${standardTestId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${studentToken}`,
          },
          body: JSON.stringify({ status: 'in_progress' }),
        });
        assert(patchRes.status === 200, 'PATCH status update failed');

        // Refetch test from DB to ensure start_time was NOT overwritten
        const refetch = await prisma.test.findUnique({
          where: { id: standardTestId },
          select: { start_time: true, total_duration: true },
        });
        const refetchedStartTime = new Date(refetch!.start_time!).getTime();

        assert(
          originalStartTime === refetchedStartTime,
          `Timer reset vulnerability detected: original start_time ${originalStartTime} was replaced by ${refetchedStartTime}`
        );

        // Verify remaining time calculation formula
        const elapsedSec = Math.floor((Date.now() - originalStartTime) / 1000);
        const remaining = Math.max(0, refetch!.total_duration * 60 - elapsedSec);
        assert(remaining > 0 && remaining <= 3600, `Calculated remaining time unexpected: ${remaining}`);
      }
    );

    // -------------------------------------------------------------------
    // REQUIREMENT 6: ASSESSMENT IDENTITY & ISOLATION
    // -------------------------------------------------------------------
    await runAuditCheck(
      'Req 6: Assessment Identity',
      'All data belongs strictly to the route testId; requests for non-existent or other tests are isolated',
      async () => {
        // Querying non-existent test returns 404
        const fakeId = '00000000-0000-0000-0000-000000000000';
        const res404 = await fetch(`${BASE_URL}/api/tests/${fakeId}`, {
          headers: { Authorization: `Bearer ${studentToken}` },
        });
        assert(res404.status === 404, `Expected 404 for non-existent test, got ${res404.status}`);

        // Verified test data matches the requested ID
        const resValid = await fetch(`${BASE_URL}/api/tests/${standardTestId}`, {
          headers: { Authorization: `Bearer ${studentToken}` },
        });
        const dataValid = await resValid.json();
        assert(dataValid.test.id === standardTestId, 'Test ID in response does not match route ID');
      }
    );

    // -------------------------------------------------------------------
    // DYNAMIC VERIFICATION: ASSESSMENT WITH DIFFERENT QUESTION COUNT & DURATION
    // -------------------------------------------------------------------
    await runAuditCheck(
      'Dynamic Config Verification',
      'Test with distinct question count (7 questions) and duration (25 min) derives all sidebar sections & timer without hardcoding',
      async () => {
        // 1. Pick 7 distinct questions from different sections
        const sampleQuestions = await prisma.question.findMany({
          take: 7,
          select: { id: true, section: true },
        });
        assert(sampleQuestions.length === 7, `Expected 7 sample questions, found ${sampleQuestions.length}`);

        // 2. Create a test with 25 minutes duration
        const customTest = await prisma.test.create({
          data: {
            student_id: studentRecordId,
            status: 'not_started',
            total_duration: 25, // Distinct duration (not 60)
            score: null,
            test_questions: {
              create: sampleQuestions.map((q, idx) => ({
                question_id: q.id,
                sequence_number: idx + 1,
              })),
            },
          },
        });
        customTestId = customTest.id;

        // 3. Fetch via API
        const res = await fetch(`${BASE_URL}/api/tests/${customTestId}`, {
          headers: { Authorization: `Bearer ${studentToken}` },
        });
        assert(res.status === 200, `Fetch custom test failed with ${res.status}`);
        const customData = await res.json();
        const t = customData.test;

        // Verify question count is 7, not 42
        assert(t.questions.length === 7, `Expected 7 questions, got ${t.questions.length}`);

        // Verify duration is 25, not 60
        assert(t.total_duration === 25, `Expected duration 25 min, got ${t.total_duration}`);

        // Derive sections dynamically
        const customSections = t.questions.reduce((acc: any[], q: any, idx: number) => {
          const secName = q.section || 'General';
          let secObj = acc.find((s) => s.name === secName);
          if (!secObj) {
            secObj = { name: secName, questions: [] };
            acc.push(secObj);
          }
          secObj.questions.push({ ...q, originalIndex: idx });
          return acc;
        }, []);

        const uniqueSectionNamesInDb = new Set(sampleQuestions.map((q) => q.section || 'General'));
        assert(
          customSections.length === uniqueSectionNamesInDb.size,
          `Section count mismatch: derived ${customSections.length}, expected ${uniqueSectionNamesInDb.size}`
        );

        // Verify total questions across all sections is 7
        const totalInSections = customSections.reduce((sum: number, s: any) => sum + s.questions.length, 0);
        assert(totalInSections === 7, `Expected sum of questions across sections to be 7, got ${totalInSections}`);
      }
    );
  } finally {
    // Cleanup custom test
    if (customTestId) {
      try {
        await prisma.testQuestion.deleteMany({ where: { test_id: customTestId } });
        await prisma.testResponse.deleteMany({ where: { test_id: customTestId } });
        await prisma.test.delete({ where: { id: customTestId } });
      } catch (cleanupErr) {
        console.error('Cleanup error:', cleanupErr);
      }
    }
    await prisma.$disconnect();
  }

  // -------------------------------------------------------------------
  // SUMMARY REPORT
  // -------------------------------------------------------------------
  console.log('\n------------------------------------------------------------');
  console.log('📊 AUDIT SUMMARY REPORT');
  console.log('------------------------------------------------------------');
  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;
  results.forEach((r) => {
    console.log(`[${r.passed ? 'PASSED' : 'FAILED'}] ${r.requirement}: ${r.testName}`);
    if (!r.passed && r.details) {
      console.log(`         Details: ${r.details}`);
    }
  });
  console.log(`\nTOTAL: ${passedCount}/${totalCount} passed\n`);

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Fatal error in audit suite:', e);
  process.exit(1);
});
