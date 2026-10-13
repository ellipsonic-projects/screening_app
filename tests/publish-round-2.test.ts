import 'dotenv/config';
import prisma from '../lib/prisma';
import { generateToken } from '../lib/auth';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runTest(name: string, fn: () => Promise<void>) {
  try {
    process.stdout.write(`  ⏳ ${name}... `);
    await fn();
    console.log('✅ PASSED');
    results.push({ name, passed: true });
  } catch (err: any) {
    console.log('❌ FAILED');
    console.error(`     Error: ${err.message}`);
    results.push({ name, passed: false, error: err.message });
  }
}

async function main() {
  console.log('\n🚀 Running Round 2 Test Publishing Verification Suite...\n');

  let adminToken = '';
  let studentToken = '';
  let testStudentId = '';
  let testUserId = '';
  let all42QuestionIds: string[] = [];
  let createdRound2TestId = '';

  try {
    // ----------------------------------------------------
    // SETUP: Admin Token, Test Student, Fetch 42 Questions
    // ----------------------------------------------------
    // 1. Admin login to get genuine admin JWT
    const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'superadmin@portal.com',
        password: 'Admin@123',
      }),
    });
    assert(adminLoginRes.status === 200, `Admin login failed with ${adminLoginRes.status}`);
    const adminLoginData = await adminLoginRes.json();
    adminToken = adminLoginData.data.token;
    assert(!!adminToken, 'Admin token must be present');

    // 2. Create a temporary test student in DB
    const timestamp = Date.now();
    const testStudentUser = await prisma.user.create({
      data: {
        email: `test_r2_student_${timestamp}@example.com`,
        password_hash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
        role: 'student',
        is_active: true,
        student: {
          create: {
            full_name: 'Round2 Test Candidate',
            phone: '9876543299',
            college: 'Testing Institute',
            usn: `R2_USN_${timestamp}`,
            branch_name: 'Computer Science',
            profile_completed: true,
          }
        }
      },
      include: { student: true }
    });
    testUserId = testStudentUser.id;
    testStudentId = testStudentUser.student!.id;
    studentToken = generateToken({
      userId: testStudentUser.id,
      email: testStudentUser.email,
      role: 'student',
    });

    // 3. Fetch all 42 questions from DB
    const questionsInDb = await prisma.question.findMany({
      select: { id: true, section: true },
      take: 50,
    });
    all42QuestionIds = questionsInDb.map(q => q.id);
    assert(all42QuestionIds.length === 42, `Expected 42 questions in DB, found ${all42QuestionIds.length}`);

    // ----------------------------------------------------
    // TEST 1: Unauthorized access
    // ----------------------------------------------------
    await runTest('Unauthorized access without token returns 401', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/tests/publish-round-2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentIds: [testStudentId],
          questionIds: all42QuestionIds,
          durationMinutes: 60,
        }),
      });
      assert(res.status === 401, `Expected 401, got ${res.status}`);
    });

    await runTest('Forbidden access with student role token returns 403', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/tests/publish-round-2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`,
        },
        body: JSON.stringify({
          studentIds: [testStudentId],
          questionIds: all42QuestionIds,
          durationMinutes: 60,
        }),
      });
      assert(res.status === 403, `Expected 403, got ${res.status}`);
    });

    // ----------------------------------------------------
    // TEST 2: Validation errors for duration
    // ----------------------------------------------------
    await runTest('Missing or invalid duration returns 400', async () => {
      // Missing duration
      const res1 = await fetch(`${BASE_URL}/api/admin/tests/publish-round-2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          studentIds: [testStudentId],
          questionIds: all42QuestionIds,
        }),
      });
      assert(res1.status === 400, `Expected 400 for missing duration, got ${res1.status}`);

      // Negative duration
      const res2 = await fetch(`${BASE_URL}/api/admin/tests/publish-round-2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          studentIds: [testStudentId],
          questionIds: all42QuestionIds,
          durationMinutes: -10,
        }),
      });
      assert(res2.status === 400, `Expected 400 for negative duration, got ${res2.status}`);

      // Non-numeric duration
      const res3 = await fetch(`${BASE_URL}/api/admin/tests/publish-round-2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          studentIds: [testStudentId],
          questionIds: all42QuestionIds,
          durationMinutes: 'invalid_duration',
        }),
      });
      assert(res3.status === 400, `Expected 400 for non-numeric duration, got ${res3.status}`);
    });

    // ----------------------------------------------------
    // TEST 3: Validation errors for questions
    // ----------------------------------------------------
    await runTest('Empty or missing questionIds returns 400', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/tests/publish-round-2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          studentIds: [testStudentId],
          questionIds: [],
          durationMinutes: 60,
        }),
      });
      assert(res.status === 400, `Expected 400 for empty questionIds, got ${res.status}`);
    });

    await runTest('Non-existent questionIds returns 400', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/tests/publish-round-2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          studentIds: [testStudentId],
          questionIds: ['00000000-0000-0000-0000-000000000000'],
          durationMinutes: 60,
        }),
      });
      assert(res.status === 400, `Expected 400 for non-existent questionIds, got ${res.status}`);
      const data = await res.json();
      assert(data.message.includes('questions'), `Expected message about questions, got: ${data.message}`);
    });

    // ----------------------------------------------------
    // TEST 4: Validation errors for students
    // ----------------------------------------------------
    await runTest('Empty or non-existent studentIds returns 400', async () => {
      const resEmpty = await fetch(`${BASE_URL}/api/admin/tests/publish-round-2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          studentIds: [],
          questionIds: all42QuestionIds,
          durationMinutes: 60,
        }),
      });
      assert(resEmpty.status === 400, `Expected 400 for empty studentIds, got ${resEmpty.status}`);

      const resNonExistent = await fetch(`${BASE_URL}/api/admin/tests/publish-round-2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          studentIds: ['00000000-0000-0000-0000-000000000000'],
          questionIds: all42QuestionIds,
          durationMinutes: 60,
        }),
      });
      assert(resNonExistent.status === 400, `Expected 400 for non-existent studentId, got ${resNonExistent.status}`);
    });

    // ----------------------------------------------------
    // TEST 5: Successful Round 2 Publishing (1 Student, 42 Questions, 60 Mins)
    // ----------------------------------------------------
    await runTest('Publish Round 2 with 1 student, 42 questions, 60 minutes succeeds (with durationMinutes payload)', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/tests/publish-round-2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          studentIds: [testStudentId],
          questionIds: all42QuestionIds,
          durationMinutes: 60,
          testTitle: 'Round 2 Technical Interview Assessment',
        }),
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const data = await res.json();
      assert(data.publishedCount === 1, `Expected publishedCount = 1, got ${data.publishedCount}`);

      // Verify persistence in DB
      const createdTest = await prisma.test.findFirst({
        where: {
          student_id: testStudentId,
          status: 'not_started',
        },
        include: {
          test_questions: {
            include: { question: true },
            orderBy: { sequence_number: 'asc' },
          }
        }
      });

      assert(!!createdTest, 'Test must exist in database');
      createdRound2TestId = createdTest!.id;
      assert(createdTest!.total_duration === 60, `Expected duration 60, got ${createdTest!.total_duration}`);
      assert(createdTest!.status === 'not_started', `Expected status not_started, got ${createdTest!.status}`);
      assert(createdTest!.test_questions.length === 42, `Expected 42 questions linked, got ${createdTest!.test_questions.length}`);
      
      // Verify sequence numbering is 1 through 42 without gaps
      for (let i = 0; i < 42; i++) {
        assert(createdTest!.test_questions[i].sequence_number === i + 1, `Sequence number mismatch at index ${i}`);
      }
    });

    // ----------------------------------------------------
    // TEST 6: Student Portal visibility
    // ----------------------------------------------------
    await runTest('Published test appears in student GET /api/tests feed', async () => {
      const res = await fetch(`${BASE_URL}/api/tests`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const data = await res.json();
      assert(Array.isArray(data.tests) && data.tests.length > 0, 'Student should have tests');
      const latestTest = data.tests[0];
      assert(latestTest.id === createdRound2TestId, 'Latest test should be the Round 2 test');
      assert(latestTest.status === 'not_started', 'Status should be not_started');
      assert(latestTest.totalDuration === 60, 'Duration should be 60');
      assert(latestTest.totalQuestions === 42, 'Total questions should be 42');
    });

    // ----------------------------------------------------
    // TEST 7: Duplicate Assignment Prevention on Repeated Clicks
    // ----------------------------------------------------
    await runTest('Repeated clicks do not create duplicate assignments for the student', async () => {
      // Admin clicks "Publish Test Now" again with the same 42 questions
      const res = await fetch(`${BASE_URL}/api/admin/tests/publish-round-2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          studentIds: [testStudentId],
          questionIds: all42QuestionIds,
          durationMinutes: 60,
          testTitle: 'Round 2 Technical Interview Assessment',
        }),
      });
      assert(res.status === 200, `Repeated publish should succeed with 200, got ${res.status}`);
      const data = await res.json();
      assert(data.publishedCount === 0, `Duplicate publish should not create new tests, got publishedCount=${data.publishedCount}`);
      assert(data.alreadyAssignedCount === 1, `alreadyAssignedCount should be 1, got ${data.alreadyAssignedCount}`);

      // Verify DB still only has exactly 1 test for this student
      const testsInDb = await prisma.test.findMany({
        where: { student_id: testStudentId },
      });
      assert(testsInDb.length === 1, `Expected exactly 1 test in DB, found ${testsInDb.length}`);
    });

  } finally {
    // ----------------------------------------------------
    // CLEANUP: Clean up test student and tests
    // ----------------------------------------------------
    console.log('\n🧹 Cleaning up test artifacts...');
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
  }

  // ----------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------
  console.log('\n========================================');
  console.log('       ROUND 2 VERIFICATION SUMMARY     ');
  console.log('========================================');
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  console.log(`Passed: ${passed}/${total}`);

  if (passed === total) {
    console.log('🎉 ALL ROUND 2 PUBLISHING TESTS PASSED!\n');
  } else {
    console.error('❌ SOME TESTS FAILED!\n');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
