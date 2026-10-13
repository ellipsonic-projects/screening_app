import 'dotenv/config';
import axios from 'axios';
import prisma from '../lib/prisma';
import { generateToken } from '../lib/auth';

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASSED: ${message}`);
    testsPassed++;
  } else {
    console.error(`  ❌ FAILED: ${message}`);
    testsFailed++;
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('   RUNNING VERIFICATION SUITE FOR SCORING DEFECT FIXES');
  console.log('======================================================\n');

  // Setup Admin and Student fixtures
  let adminUser = await prisma.user.findFirst({
    where: { role: 'super_admin' }
  });
  if (!adminUser) {
    adminUser = await prisma.user.findFirst({ where: { role: 'admin' } });
  }
  if (!adminUser) throw new Error('No admin user found in database');

  const adminToken = generateToken({
    userId: adminUser.id,
    email: adminUser.email,
    role: adminUser.role as any
  });
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };

  const studentUser = await prisma.user.findFirst({
    where: { role: 'student' },
    include: { student: true }
  });
  if (!studentUser || !studentUser.student) throw new Error('No student found in database');

  const studentToken = generateToken({
    userId: studentUser.id,
    email: studentUser.email,
    role: 'student'
  });
  const studentHeaders = { Authorization: `Bearer ${studentToken}` };

  // Fetch or create sample MCQ & Coding questions
  let mcqQuestion = await prisma.question.findFirst({
    where: { type: 'mcq' }
  });
  if (!mcqQuestion) {
    mcqQuestion = await prisma.question.create({
      data: {
        question_text: 'What is 2 + 2?',
        type: 'mcq',
        points: 10,
        options_json: ['1', '2', '3', '4'],
        correct_answer: '4',
        created_by: adminUser.id,
        is_published: true
      }
    });
  }

  let codingQuestion = await prisma.question.findFirst({
    where: { type: 'coding' }
  });
  if (!codingQuestion) {
    codingQuestion = await prisma.question.create({
      data: {
        question_text: 'Write a function to return true',
        type: 'coding',
        points: 20,
        created_by: adminUser.id,
        is_published: true
      }
    });
  }

  // ========================================================
  // TEST GROUP 1: Fix 2 — Admin Evaluation Score Mapping (0, null, number)
  // ========================================================
  console.log('--- TEST GROUP 1: Fix 2 (Admin Evaluation Zero Score Mapping) ---');

  // 1.1 Test with score = 0
  const zeroTest = await prisma.test.create({
    data: {
      student_id: studentUser.student.id,
      status: 'submitted',
      is_completed: true,
      total_duration: 60,
      score: 0,
      end_time: new Date()
    }
  });

  // 1.2 Test with score = null
  const nullScoreTest = await prisma.test.create({
    data: {
      student_id: studentUser.student.id,
      status: 'auto_submitted',
      is_completed: true,
      total_duration: 60,
      score: null,
      end_time: new Date()
    }
  });

  // 1.3 Test with positive score = 75.5
  const positiveScoreTest = await prisma.test.create({
    data: {
      student_id: studentUser.student.id,
      status: 'submitted',
      is_completed: true,
      total_duration: 60,
      score: 75.5,
      end_time: new Date()
    }
  });

  try {
    const evalRes = await axios.get('http://localhost:3000/api/admin/evaluation', {
      headers: adminHeaders
    });

    const testsFromApi = evalRes.data.tests as any[];

    const apiZeroTest = testsFromApi.find(t => t.id === zeroTest.id);
    assert(
      apiZeroTest !== undefined && apiZeroTest.score === 0,
      `Score of 0 is strictly returned as number 0 (not null): received ${apiZeroTest?.score}`
    );

    const apiNullTest = testsFromApi.find(t => t.id === nullScoreTest.id);
    assert(
      apiNullTest !== undefined && apiNullTest.score === null,
      `Genuinely missing score is returned as null: received ${apiNullTest?.score}`
    );

    const apiPositiveTest = testsFromApi.find(t => t.id === positiveScoreTest.id);
    assert(
      apiPositiveTest !== undefined && apiPositiveTest.score === 75.5,
      `Positive score 75.5 is preserved accurately: received ${apiPositiveTest?.score}`
    );
  } finally {
    await prisma.test.deleteMany({
      where: { id: { in: [zeroTest.id, nullScoreTest.id, positiveScoreTest.id] } }
    });
  }

  // ========================================================
  // TEST GROUP 2: Inactivity Resume Rule (< 3 minutes preserved)
  // ========================================================
  console.log('\n--- TEST GROUP 2: Inactivity Rule (< 3 minutes preserved) ---');

  const activeTest = await prisma.test.create({
    data: {
      student_id: studentUser.student.id,
      status: 'in_progress',
      is_completed: false,
      total_duration: 60,
      start_time: new Date(),
      updated_at: new Date(Date.now() - 60000), // 1 minute ago
      test_questions: {
        create: [{ question_id: mcqQuestion.id, sequence_number: 1 }]
      }
    }
  });

  try {
    const fetchActiveRes = await axios.get(`http://localhost:3000/api/tests/${activeTest.id}`, {
      headers: studentHeaders
    });
    assert(
      fetchActiveRes.data.test.status === 'in_progress',
      `Assessment within 3 minutes remains in_progress: ${fetchActiveRes.data.test.status}`
    );
    assert(
      fetchActiveRes.data.test.is_completed === false,
      `Assessment within 3 minutes is not completed: is_completed = ${fetchActiveRes.data.test.is_completed}`
    );
  } finally {
    await prisma.testQuestion.deleteMany({ where: { test_id: activeTest.id } });
    await prisma.test.delete({ where: { id: activeTest.id } });
  }

  // ========================================================
  // TEST GROUP 3: Fix 1 — Inactivity Auto-Submission Grades Persisted MCQ & Subjective Answers
  // ========================================================
  console.log('\n--- TEST GROUP 3: Fix 1 (Inactivity Auto-Submission Grades Persisted Answers) ---');

  // Backdate updated_at by 4 minutes (> 180000 ms)
  const fourMinutesAgo = new Date(Date.now() - 240000);

  const timedOutTest = await prisma.test.create({
    data: {
      student_id: studentUser.student.id,
      status: 'in_progress',
      is_completed: false,
      total_duration: 60,
      start_time: new Date(Date.now() - 600000),
      updated_at: fourMinutesAgo,
      test_questions: {
        create: [
          { question_id: mcqQuestion.id, sequence_number: 1 },
          { question_id: codingQuestion.id, sequence_number: 2 }
        ]
      }
    }
  });

  // Determine correct answer text for MCQ
  let mcqCorrectText = mcqQuestion.correct_answer || '';
  if (Array.isArray(mcqQuestion.options_json)) {
    const idx = parseInt(mcqQuestion.correct_answer || '', 10);
    if (!isNaN(idx) && idx >= 0 && idx < mcqQuestion.options_json.length) {
      mcqCorrectText = String(mcqQuestion.options_json[idx]);
    }
  }

  // Create persisted auto-saved answers
  await prisma.testResponse.create({
    data: {
      test_id: timedOutTest.id,
      question_id: mcqQuestion.id,
      student_answer: mcqCorrectText,
      auto_saved_at: new Date(Date.now() - 250000),
      evaluation_status: 'PENDING'
    }
  });

  await prisma.testResponse.create({
    data: {
      test_id: timedOutTest.id,
      question_id: codingQuestion.id,
      student_answer: 'function solution() { return true; }',
      auto_saved_at: new Date(Date.now() - 245000),
      evaluation_status: 'PENDING'
    }
  });

  try {
    // Student resumes / re-fetches test after timeout
    const resumeRes = await axios.get(`http://localhost:3000/api/tests/${timedOutTest.id}`, {
      headers: studentHeaders
    });

    assert(
      resumeRes.data.test?.status === 'auto_submitted',
      `Test status automatically transitioned to auto_submitted: received ${resumeRes.data.test?.status}`
    );
    assert(
      resumeRes.data.test?.is_completed === true,
      `Test is_completed is true: received ${resumeRes.data.test?.is_completed}`
    );

    // Verify database state directly
    const dbTest = await prisma.test.findUnique({
      where: { id: timedOutTest.id },
      include: { test_responses: true }
    });

    assert(
      dbTest?.status === 'auto_submitted' && dbTest?.is_completed === true,
      'Database record status and is_completed are updated in DB'
    );

    // Verify MCQ was evaluated immediately
    const mcqResp = dbTest?.test_responses.find(r => r.question_id === mcqQuestion.id);
    assert(
      mcqResp !== undefined && mcqResp.is_correct === true && Number(mcqResp.points_earned) === (mcqQuestion.points || 10),
      `Persisted MCQ response was graded immediately: points_earned=${mcqResp?.points_earned}, is_correct=${mcqResp?.is_correct}`
    );

    // Verify Subjective/Coding was queued for evaluation
    const codingResp = dbTest?.test_responses.find(r => r.question_id === codingQuestion.id);
    assert(
      codingResp !== undefined && (codingResp.evaluation_status === 'PENDING' || codingResp.evaluation_status === 'PROCESSING' || codingResp.evaluation_status === 'COMPLETED'),
      `Persisted Coding response status transitioned to PENDING/EVALUATING: status=${codingResp?.evaluation_status}`
    );

    // Verify Score is persisted in DB and not null
    assert(
      dbTest?.score !== null && dbTest?.score !== undefined && Number(dbTest.score) >= (mcqQuestion.points || 10),
      `Overall test score recalculated and persisted in DB: score=${dbTest?.score}`
    );

    // Verify Idempotency: Calling GET again does not re-evaluate or fail
    const secondFetchRes = await axios.get(`http://localhost:3000/api/tests/${timedOutTest.id}`, {
      headers: studentHeaders
    });
    assert(
      secondFetchRes.data.test?.status === 'auto_submitted',
      'Subsequent GET requests are idempotent and preserve auto_submitted status'
    );

  } finally {
    await prisma.testResponse.deleteMany({ where: { test_id: timedOutTest.id } });
    await prisma.aIEvaluation.deleteMany({ where: { test_id: timedOutTest.id } });
    await prisma.testAnalytics.deleteMany({ where: { test_id: timedOutTest.id } });
    await prisma.testQuestion.deleteMany({ where: { test_id: timedOutTest.id } });
    await prisma.test.delete({ where: { id: timedOutTest.id } });
  }

  // ========================================================
  // TEST GROUP 4: Inactivity Auto-Submission with 0 Persisted Answers
  // ========================================================
  console.log('\n--- TEST GROUP 4: Inactivity Auto-Submission with 0 Persisted Answers ---');

  const emptyTimedOutTest = await prisma.test.create({
    data: {
      student_id: studentUser.student.id,
      status: 'in_progress',
      is_completed: false,
      total_duration: 60,
      start_time: new Date(Date.now() - 600000),
      updated_at: fourMinutesAgo,
      test_questions: {
        create: [{ question_id: mcqQuestion.id, sequence_number: 1 }]
      }
    }
  });

  try {
    const emptyResumeRes = await axios.get(`http://localhost:3000/api/tests/${emptyTimedOutTest.id}`, {
      headers: studentHeaders
    });

    assert(
      emptyResumeRes.data.test?.status === 'auto_submitted',
      `Empty test transitions to auto_submitted: received ${emptyResumeRes.data.test?.status}`
    );

    const dbEmptyTest = await prisma.test.findUnique({
      where: { id: emptyTimedOutTest.id }
    });
    assert(
      dbEmptyTest?.score !== null && Number(dbEmptyTest?.score) === 0,
      `Empty auto-submitted test has score calculated and persisted as 0 (not null): score=${dbEmptyTest?.score}`
    );
  } finally {
    await prisma.testQuestion.deleteMany({ where: { test_id: emptyTimedOutTest.id } });
    await prisma.test.delete({ where: { id: emptyTimedOutTest.id } });
  }

  // ========================================================
  // TEST SUMMARY
  // ========================================================
  console.log('\n======================================================');
  console.log(`SCORING FIXES TEST SUMMARY: ${testsPassed} PASSED, ${testsFailed} FAILED`);
  console.log('======================================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
