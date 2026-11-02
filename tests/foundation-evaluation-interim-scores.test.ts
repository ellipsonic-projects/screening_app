import 'dotenv/config';
import prisma from '../lib/prisma';
import { recalculateTestScore } from '../lib/services/score-calculation';
import { GET as getEvaluationRoute } from '../app/api/admin/evaluation/route';
import { GET as getResultRoute } from '../app/api/admin/results/[testId]/route';
import { generateToken } from '../lib/auth';
import { NextRequest } from 'next/server';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASSED: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAILED: ${message}`);
    failed++;
  }
}

async function runFoundationEvaluationTests() {
  console.log('\n============================================================');
  console.log('🧪 RUNNING FOUNDATION EVALUATION & INTERIM SCORE TEST SUITE');
  console.log('============================================================\n');

  // 1. Setup Admin fixture
  let adminUser = await prisma.user.findFirst({
    where: { role: 'super_admin' }
  });
  if (!adminUser) {
    adminUser = await prisma.user.findFirst({ where: { role: 'admin' } });
  }
  if (!adminUser) throw new Error('No admin user found');

  const adminToken = generateToken({
    userId: adminUser.id,
    email: adminUser.email,
    role: adminUser.role as any
  });

  // 2. Setup Student fixture
  let studentUser = await prisma.user.findFirst({
    where: { email: 'foundation_test_student@example.com' },
    include: { student: true }
  });

  if (!studentUser || !studentUser.student) {
    studentUser = await prisma.user.create({
      data: {
        email: 'foundation_test_student@example.com',
        password_hash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
        role: 'student',
        student: {
          create: {
            full_name: 'Foundation Student',
            usn: 'FOUNDATION_USN_01',
            branch_name: 'Computer Science',
            profile_completed: true
          }
        }
      },
      include: { student: true }
    });
  }

  const studentId = studentUser.student!.id;

  // 3. Setup Questions: 1 MCQ (10 pts, Quantitative), 1 Coding (20 pts, Coding), 1 Eligibility (0 pts, Eligibility)
  let mcq = await prisma.question.create({
    data: {
      question_text: 'What is 5 * 5?',
      type: 'mcq',
      points: 10,
      section: 'APTITUDE',
      correct_answer: '25',
      created_by: adminUser.id,
      is_published: true
    }
  });

  let coding = await prisma.question.create({
    data: {
      question_text: 'Write a binary search function',
      type: 'coding',
      points: 20,
      section: 'CODING',
      created_by: adminUser.id,
      is_published: true
    }
  });

  let elig = await prisma.question.create({
    data: {
      question_text: 'Are you eligible for full-time work?',
      type: 'single_select',
      points: 0,
      section: 'ELIGIBILITY',
      created_by: adminUser.id,
      is_published: true
    }
  });

  // -------------------------------------------------------------
  // TEST GROUP 1: Pending Subjective Evaluations Never Leak Interim Scores
  // -------------------------------------------------------------
  console.log('--- TEST GROUP 1: Pending Subjective AI Evaluation Guardrails ---');

  const testAttempt = await prisma.test.create({
    data: {
      student_id: studentId,
      status: 'submitted',
      is_completed: true,
      total_duration: 60,
      score: null,
      test_questions: {
        create: [
          { question_id: mcq.id, sequence_number: 1 },
          { question_id: coding.id, sequence_number: 2 },
          { question_id: elig.id, sequence_number: 3 }
        ]
      }
    }
  });

  // MCQ is completed and scored 10 points
  const mcqResp = await prisma.testResponse.create({
    data: {
      test_id: testAttempt.id,
      question_id: mcq.id,
      student_answer: '25',
      points_earned: 10,
      is_correct: true,
      evaluation_status: 'COMPLETED'
    }
  });

  // Coding response is submitted with code, but background AI evaluation is PENDING
  const codingResp = await prisma.testResponse.create({
    data: {
      test_id: testAttempt.id,
      question_id: coding.id,
      student_answer: 'function binarySearch(arr, x) { return 0; }',
      points_earned: null,
      is_correct: null,
      evaluation_status: 'PENDING',
      ai_evaluation_json: { evaluationStatus: 'PENDING' }
    }
  });

  await prisma.aIEvaluation.create({
    data: {
      test_id: testAttempt.id,
      student_id: studentId,
      question_id: coding.id,
      section: 'CODING',
      question_type: 'coding',
      obtained_marks: null,
      maximum_marks: 20,
      evaluation_status: 'PENDING',
      test_response_id: codingResp.id
    }
  });

  // Eligibility response
  await prisma.testResponse.create({
    data: {
      test_id: testAttempt.id,
      question_id: elig.id,
      student_answer: 'Yes',
      points_earned: 0,
      is_correct: true,
      evaluation_status: 'COMPLETED'
    }
  });

  // Trigger recalculateTestScore while coding is PENDING
  const pendingScore = await recalculateTestScore(testAttempt.id);
  assert(pendingScore === 0, 'recalculateTestScore returns 0 while evaluations are pending');

  const refreshedTest = await prisma.test.findUnique({
    where: { id: testAttempt.id },
    include: { analytics: true }
  });

  assert(refreshedTest?.score === null, 'Test.score remains strictly NULL while subjective AI evaluations are pending');
  assert(refreshedTest?.status === 'evaluating', 'Test.status is marked as "evaluating"');
  assert(refreshedTest?.analytics?.total_score === null, 'TestAnalytics.total_score remains strictly NULL');
  assert(refreshedTest?.analytics?.overall_percentage === null, 'TestAnalytics.overall_percentage remains strictly NULL');

  // Verify Admin Evaluation API endpoint exposes evaluating status and null score
  const evalReq = new NextRequest('http://localhost:3000/api/admin/evaluation', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const evalRes = await getEvaluationRoute(evalReq);
  const evalJson = await evalRes.json();
  const evalItem = evalJson.tests?.find((t: any) => t.id === testAttempt.id);

  assert(evalItem?.status === 'evaluating', `Admin evaluation endpoint lists status as "evaluating" (got: ${evalItem?.status})`);
  assert(evalItem?.score === null, `Admin evaluation endpoint exposes score = null while evaluating (got: ${evalItem?.score})`);

  // Verify Admin Results API endpoint exposes evaluating status, null overallScore, and incomplete section score
  const resultReq = new NextRequest(`http://localhost:3000/api/admin/results/${testAttempt.id}`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const resultRes = await getResultRoute(resultReq, { params: Promise.resolve({ testId: testAttempt.id }) });
  const resultJson = await resultRes.json();
  const testData = resultJson.data || resultJson;

  assert(testData.status === 'evaluating', `Admin results endpoint reports status = "evaluating" (got: ${testData.status})`);
  assert(testData.scores?.overallScore === null, `Admin results overallScore is null while evaluating (got: ${testData.scores?.overallScore})`);

  const codingSection = testData.scores?.sectionScores?.find((s: any) => s.sectionName.includes('Coding'));
  assert(codingSection?.marksObtained === null, `Coding section marksObtained is null while pending evaluation (got: ${codingSection?.marksObtained})`);
  assert(codingSection?.isCompleted === false, `Coding section isCompleted is false while pending evaluation`);

  // -------------------------------------------------------------
  // TEST GROUP 2: Successful Completion Finalizes Absolute Score
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Finalization When Evaluation Completes ---');

  // Update coding response and AI evaluation to COMPLETED with 18 marks
  await prisma.testResponse.update({
    where: { id: codingResp.id },
    data: {
      points_earned: 18,
      is_correct: false,
      evaluation_status: 'COMPLETED'
    }
  });

  await prisma.aIEvaluation.update({
    where: { test_response_id: codingResp.id },
    data: {
      obtained_marks: 18,
      evaluation_status: 'COMPLETED',
      evaluated_at: new Date()
    }
  });

  // Re-run score recalculation
  const finalScore = await recalculateTestScore(testAttempt.id);
  assert(finalScore === 28, `recalculateTestScore returns 28 marks (10 MCQ + 18 Coding) upon completion (got: ${finalScore})`);

  const completedTest = await prisma.test.findUnique({
    where: { id: testAttempt.id },
    include: { analytics: true }
  });

  assert(Number(completedTest?.score) === 28, `Test.score persisted as 28 (got: ${completedTest?.score})`);
  assert(completedTest?.status === 'evaluated', `Test.status promoted to "evaluated" (got: ${completedTest?.status})`);
  assert(Number(completedTest?.analytics?.total_score) === 28, `TestAnalytics.total_score persisted as 28`);
  assert(Number(completedTest?.analytics?.overall_ai_marks) === 18, `TestAnalytics.overall_ai_marks persisted as 18`);

  const expectedPct = parseFloat(((28 / 30) * 100).toFixed(2));
  assert(Number(completedTest?.analytics?.overall_percentage) === expectedPct, `TestAnalytics.overall_percentage is ${expectedPct}%`);

  // Clean up
  await prisma.aIEvaluation.deleteMany({ where: { test_id: testAttempt.id } });
  await prisma.testResponse.deleteMany({ where: { test_id: testAttempt.id } });
  await prisma.testAnalytics.deleteMany({ where: { test_id: testAttempt.id } });
  await prisma.testQuestion.deleteMany({ where: { test_id: testAttempt.id } });
  await prisma.test.delete({ where: { id: testAttempt.id } });

  await prisma.question.delete({ where: { id: mcq.id } });
  await prisma.question.delete({ where: { id: coding.id } });
  await prisma.question.delete({ where: { id: elig.id } });

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log('\n============================================================');
  console.log(`FOUNDATION SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runFoundationEvaluationTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
