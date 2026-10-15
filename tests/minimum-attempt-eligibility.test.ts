import 'dotenv/config';
import prisma from '../lib/prisma';
import { 
  isQuestionAttempted, 
  calculateAttemptEligibility, 
  assessTestAttemptEligibility 
} from '../lib/services/attempt-eligibility';
import { recalculateTestScore } from '../lib/services/score-calculation';
import { processBackgroundEvaluations, gradePersistedTestResponses } from '../lib/services/evaluation-pipeline';
import { POST as submitActionRoute } from '../app/api/tests/[id]/[action]/route';
import { PATCH as patchTestRoute } from '../app/api/tests/[id]/route';
import { POST as overrideRoute } from '../app/api/admin/results/[testId]/override/route';
import { GET as getResultRoute } from '../app/api/admin/results/[testId]/route';
import { GET as getEvaluationRoute } from '../app/api/admin/evaluation/route';
import { GET as getSettingsRoute, POST as postSettingsRoute } from '../app/api/admin/test-settings/route';
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

async function runMinimumAttemptTests() {
  console.log('\n============================================================');
  console.log('🧪 RUNNING MINIMUM-ATTEMPT ELIGIBILITY GATE TEST SUITE');
  console.log('============================================================\n');

  // -------------------------------------------------------------
  // UNIT TESTS: isQuestionAttempted
  // -------------------------------------------------------------
  console.log('--- Suite 1: Question Attempt Detection ---');

  assert(!isQuestionAttempted(null), 'null answer is not attempted');
  assert(!isQuestionAttempted(undefined), 'undefined answer is not attempted');
  assert(!isQuestionAttempted(''), 'empty string is not attempted');
  assert(!isQuestionAttempted('   '), 'whitespace string is not attempted');
  assert(!isQuestionAttempted('\n\t  '), 'newlines/tabs string is not attempted');
  assert(!isQuestionAttempted('[]'), 'empty JSON array is not attempted');
  assert(!isQuestionAttempted('{}'), 'empty JSON object is not attempted');
  assert(!isQuestionAttempted('["", "   "]'), 'JSON array containing only whitespace is not attempted');

  assert(isQuestionAttempted('Hello world'), 'non-empty text is attempted');
  assert(isQuestionAttempted('0'), '"0" answer is attempted (e.g. option index 0)');
  assert(isQuestionAttempted('false'), '"false" answer is attempted');
  assert(isQuestionAttempted('["Option A"]'), 'JSON array with non-empty item is attempted');
  assert(isQuestionAttempted('{"1": "A", "2": "B"}'), 'JSON ranking object is attempted');
  assert(isQuestionAttempted('function test() { return 1; }'), 'code snippet is attempted');

  // -------------------------------------------------------------
  // UNIT TESTS: calculateAttemptEligibility (Ceiling Rounding)
  // -------------------------------------------------------------
  console.log('\n--- Suite 2: Ceiling Rounding & Threshold Calculation ---');

  // Requirement: 35 applicable questions at 60% requires Math.ceil(35 * 60 / 100) = 21 attempts
  const res35_below = calculateAttemptEligibility({ applicableQuestionsCount: 35, attemptedCount: 20, minPercentage: 60, enabled: true });
  assert(res35_below.requiredAttempts === 21, '35 questions @ 60% requires exactly 21 attempts (ceil(21.0))');
  assert(!res35_below.isEligible, '20 attempts on 35 questions @ 60% is INELIGIBLE (below-threshold)');

  const res35_exact = calculateAttemptEligibility({ applicableQuestionsCount: 35, attemptedCount: 21, minPercentage: 60, enabled: true });
  assert(res35_exact.isEligible, '21 attempts on 35 questions @ 60% is ELIGIBLE (exact-threshold)');

  const res35_above = calculateAttemptEligibility({ applicableQuestionsCount: 35, attemptedCount: 22, minPercentage: 60, enabled: true });
  assert(res35_above.isEligible, '22 attempts on 35 questions @ 60% is ELIGIBLE (above-threshold)');

  // 33 applicable questions at 60%: 33 * 0.6 = 19.8 -> ceil = 20
  const res33_19 = calculateAttemptEligibility({ applicableQuestionsCount: 33, attemptedCount: 19, minPercentage: 60, enabled: true });
  assert(res33_19.requiredAttempts === 20, '33 questions @ 60% requires 20 attempts (ceil(19.8))');
  assert(!res33_19.isEligible, '19 attempts on 33 questions @ 60% is INELIGIBLE');

  const res33_20 = calculateAttemptEligibility({ applicableQuestionsCount: 33, attemptedCount: 20, minPercentage: 60, enabled: true });
  assert(res33_20.isEligible, '20 attempts on 33 questions @ 60% is ELIGIBLE');

  // Disabled setting: always eligible
  const resDisabled = calculateAttemptEligibility({ applicableQuestionsCount: 35, attemptedCount: 2, minPercentage: 60, enabled: false });
  assert(resDisabled.isEligible, 'Disabled setting is always eligible even with 2 attempts');

  // Custom percentage: 75% on 20 questions = 15
  const resCustom = calculateAttemptEligibility({ applicableQuestionsCount: 20, attemptedCount: 14, minPercentage: 75, enabled: true });
  assert(resCustom.requiredAttempts === 15, '20 questions @ 75% requires 15 attempts');
  assert(!resCustom.isEligible, '14 attempts on 20 questions @ 75% is INELIGIBLE');

  // Zero applicable questions edge case
  const resZero = calculateAttemptEligibility({ applicableQuestionsCount: 0, attemptedCount: 0, minPercentage: 60, enabled: true });
  assert(resZero.isEligible, '0 applicable questions is treated as eligible');

  // -------------------------------------------------------------
  // UNIT TESTS: assessTestAttemptEligibility (Excluding Eligibility Questions)
  // -------------------------------------------------------------
  console.log('\n--- Suite 3: Eligibility & Logistics Category Exclusion ---');

  const mockQuestions = [
    { question: { id: 'q1', section: 'APTITUDE', type: 'mcq' } },
    { question: { id: 'q2', section: 'APTITUDE', type: 'mcq' } },
    { question: { id: 'q3', section: 'CODING', type: 'coding' } },
    { question: { id: 'q4', section: 'COMMUNICATION_AND_TEAMWORK', type: 'open_text' } },
    { question: { id: 'q5', section: 'PROBLEM_SOLVING', type: 'mcq' } },
    // 2 Eligibility questions
    { question: { id: 'el1', section: 'ELIGIBILITY', type: 'open_text' } },
    { question: { id: 'el2', section: 'ELIGIBILITY_AND_LOGISTICS', type: 'single_select' } },
  ];

  // 5 applicable questions, 2 eligibility questions.
  // 60% of 5 = ceil(3.0) = 3 attempts required.
  // Student attempts ONLY the 2 eligibility questions + 1 applicable question:
  const answersOnlyEligibility = [
    { questionId: 'el1', answer: 'Yes I agree' },
    { questionId: 'el2', answer: 'Bangalore' },
    { questionId: 'q1', answer: 'Option A' },
    { questionId: 'q2', answer: '   ' }, // blank
    { questionId: 'q3', answer: '' }, // blank
    { questionId: 'q4', answer: null }, // blank
    { questionId: 'q5', answer: undefined }, // blank
  ];

  const evalExcl = assessTestAttemptEligibility(mockQuestions, undefined, answersOnlyEligibility, { minPercentage: 60, enabled: true });
  assert(evalExcl.applicableQuestionsCount === 5, 'Applicable count is 5 (excludes 2 eligibility questions)');
  assert(evalExcl.attemptedCount === 1, 'Attempted count is 1 (eligibility answers are not counted in numerator)');
  assert(evalExcl.requiredAttempts === 3, 'Required attempts is 3 (ceil(5 * 0.6))');
  assert(!evalExcl.isEligible, 'Candidate is INELIGIBLE (1 attempt vs 3 required)');

  // Student attempts exactly 3 applicable questions:
  const answersExactThreshold = [
    { questionId: 'el1', answer: 'Yes I agree' },
    { questionId: 'q1', answer: 'Option A' },
    { questionId: 'q2', answer: 'Option B' },
    { questionId: 'q3', answer: 'const code = 1;' },
  ];
  const evalExact = assessTestAttemptEligibility(mockQuestions, undefined, answersExactThreshold, { minPercentage: 60, enabled: true });
  assert(evalExact.attemptedCount === 3, 'Attempted count is 3');
  assert(evalExact.isEligible, 'Candidate is ELIGIBLE with exact threshold (3/3)');

  // -------------------------------------------------------------
  // INTEGRATION TESTS: Database Submission & Guardrails
  // -------------------------------------------------------------
  console.log('\n--- Suite 4: Database Submission & System Guardrails ---');

  // Setup test user & candidate
  const testEmail = `attempt_gate_test_${Date.now()}@example.com`;
  const user = await prisma.user.create({
    data: {
      email: testEmail,
      password_hash: 'test_hash',
      role: 'student',
      student: {
        create: {
          full_name: 'Attempt Gate Test Student',
          usn: `TEST_USN_${Date.now()}`
        }
      }
    },
    include: { student: true }
  });

  const studentId = user.student!.id;

  // Setup test admin user
  const adminEmail = `attempt_gate_admin_${Date.now()}@example.com`;
  const adminUser = await prisma.user.create({
    data: {
      email: adminEmail,
      password_hash: 'test_hash',
      role: 'admin',
      admin: {
        create: {
          full_name: 'Attempt Gate Test Admin',
          department: 'Recruiting'
        }
      }
    }
  });

  const studentToken = generateToken({
    userId: user.id,
    email: user.email,
    role: 'student'
  });

  const adminToken = generateToken({
    userId: adminUser.id,
    email: adminUser.email,
    role: 'admin'
  });

  // Create 5 test questions (4 applicable, 1 eligibility)
  const qObj1 = await prisma.question.create({
    data: {
      question_text: 'What is 2 + 2?',
      type: 'mcq',
      section: 'APTITUDE',
      points: 10,
      correct_answer: '4',
      options_json: ['2', '3', '4', '5'],
      created_by: user.id
    }
  });

  const qObj2 = await prisma.question.create({
    data: {
      question_text: 'What is 3 * 3?',
      type: 'mcq',
      section: 'APTITUDE',
      points: 10,
      correct_answer: '9',
      options_json: ['6', '8', '9', '12'],
      created_by: user.id
    }
  });

  const qSubj1 = await prisma.question.create({
    data: {
      question_text: 'Explain Polymorphism in OOP.',
      type: 'open_text',
      section: 'PROBLEM_SOLVING',
      points: 10,
      created_by: user.id
    }
  });

  const qObj3 = await prisma.question.create({
    data: {
      question_text: 'Capital of France?',
      type: 'mcq',
      section: 'APTITUDE',
      points: 10,
      correct_answer: 'Paris',
      options_json: ['London', 'Berlin', 'Paris', 'Rome'],
      created_by: user.id
    }
  });

  const qElig = await prisma.question.create({
    data: {
      question_text: 'Are you available for full-time employment?',
      type: 'open_text',
      section: 'ELIGIBILITY',
      points: 0,
      created_by: user.id
    }
  });

  // Test Case A: Below-threshold attempt (1 out of 4 applicable = 25% < 60%)
  console.log('\n  Sub-test A: Below-threshold attempt submission & guardrails');
  const testA = await prisma.test.create({
    data: {
      student_id: studentId,
      total_duration: 30,
      status: 'in_progress',
      is_completed: false,
      min_attempt_percentage: 60,
      min_attempt_enabled: true,
      test_questions: {
        create: [
          { question_id: qObj1.id, sequence_number: 1 },
          { question_id: qObj2.id, sequence_number: 2 },
          { question_id: qSubj1.id, sequence_number: 3 },
          { question_id: qObj3.id, sequence_number: 4 },
          { question_id: qElig.id, sequence_number: 5 },
        ]
      }
    },
    include: { test_questions: { include: { question: true } } }
  });

  // Candidate answers qObj1 correctly (answer "4") and answers qElig ("Yes"), but leaves the rest blank
  const submittedResponsesA = [
    { questionId: qObj1.id, answer: '4' },
    { questionId: qElig.id, answer: 'Yes, full-time.' },
    { questionId: qObj2.id, answer: '' },
    { questionId: qSubj1.id, answer: '   ' },
    { questionId: qObj3.id, answer: '[]' }
  ];

  for (const r of submittedResponsesA) {
    await prisma.testResponse.create({
      data: {
        test_id: testA.id,
        question_id: r.questionId,
        student_answer: r.answer,
        points_earned: null,
        is_correct: null
      }
    });
  }

  // Assess eligibility
  const eligA = assessTestAttemptEligibility(
    testA.test_questions,
    submittedResponsesA.map(r => ({ question_id: r.questionId, student_answer: r.answer })),
    undefined,
    { minPercentage: 60, enabled: true }
  );

  assert(eligA.applicableQuestionsCount === 4, 'Test A applicable questions count is 4 (qElig excluded)');
  assert(eligA.attemptedCount === 1, 'Test A attempted count is 1 (only qObj1 answered)');
  assert(eligA.requiredAttempts === 3, 'Test A required attempts is 3 (ceil(4 * 0.6))');
  assert(!eligA.isEligible, 'Test A is below threshold and INELIGIBLE');

  // Trigger gradePersistedTestResponses
  const scoreResultA = await gradePersistedTestResponses(testA.id);
  assert(scoreResultA === 0, 'gradePersistedTestResponses returns 0 for ineligible attempt');

  // Verify DB state for Test A
  const refreshedTestA = await prisma.test.findUnique({
    where: { id: testA.id },
    include: { analytics: true, test_responses: true }
  });

  assert(refreshedTestA?.status === 'ineligible_attempt', 'Test status is strictly "ineligible_attempt"');
  assert(refreshedTestA?.score === null, 'Test score is strictly NULL (not 0, not evaluated)');
  assert(refreshedTestA?.analytics?.total_score === null, 'TestAnalytics.total_score is strictly NULL');
  assert(refreshedTestA?.analytics?.overall_percentage === null, 'TestAnalytics.overall_percentage is strictly NULL');

  // Verify responses were NOT awarded points even though qObj1 had the correct answer
  const qObj1Resp = refreshedTestA?.test_responses.find(r => r.question_id === qObj1.id);
  assert(qObj1Resp?.points_earned === null, 'Correct answer qObj1 has points_earned = null for ineligible attempt');
  assert(qObj1Resp?.is_correct === null, 'Correct answer qObj1 has is_correct = null for ineligible attempt');
  assert((qObj1Resp?.ai_evaluation_json as any)?.evaluationStatus === 'INELIGIBLE_ATTEMPT', 'Response stores INELIGIBLE_ATTEMPT state in ai_evaluation_json');

  // Guardrail 1: recalculateTestScore on ineligible attempt
  const recalcScoreA = await recalculateTestScore(testA.id);
  assert(recalcScoreA === 0, 'recalculateTestScore returns 0');
  const postRecalcA = await prisma.test.findUnique({ where: { id: testA.id } });
  assert(postRecalcA?.score === null, 'recalculateTestScore preserves score: null on ineligible attempt');

  // Guardrail 2: processBackgroundEvaluations on ineligible attempt
  await processBackgroundEvaluations([
    { testId: testA.id, questionId: qSubj1.id, studentAnswer: 'Polymorphism allows objects to take multiple forms.' }
  ]);
  const postAiA = await prisma.testResponse.findFirst({ where: { test_id: testA.id, question_id: qSubj1.id } });
  assert(postAiA?.points_earned === null, 'Background evaluation skipped ineligible attempt; points_earned remains null');

  // Test Case B: Exact-threshold attempt (3 out of 4 applicable = 75% >= 60%)
  console.log('\n  Sub-test B: Exact-threshold attempt submission & evaluation');
  const testB = await prisma.test.create({
    data: {
      student_id: studentId,
      total_duration: 30,
      status: 'in_progress',
      is_completed: false,
      min_attempt_percentage: 60,
      min_attempt_enabled: true,
      test_questions: {
        create: [
          { question_id: qObj1.id, sequence_number: 1 },
          { question_id: qObj2.id, sequence_number: 2 },
          { question_id: qSubj1.id, sequence_number: 3 },
          { question_id: qObj3.id, sequence_number: 4 },
        ]
      }
    },
    include: { test_questions: { include: { question: true } } }
  });

  // Candidate answers qObj1 ("4"), qObj2 ("9"), qObj3 ("Paris")
  const submittedResponsesB = [
    { questionId: qObj1.id, answer: '4' },
    { questionId: qObj2.id, answer: '9' },
    { questionId: qObj3.id, answer: 'Paris' },
    { questionId: qSubj1.id, answer: '' }
  ];

  for (const r of submittedResponsesB) {
    await prisma.testResponse.create({
      data: {
        test_id: testB.id,
        question_id: r.questionId,
        student_answer: r.answer,
        points_earned: null,
        is_correct: null
      }
    });
  }

  const eligB = assessTestAttemptEligibility(
    testB.test_questions,
    submittedResponsesB.map(r => ({ question_id: r.questionId, student_answer: r.answer })),
    undefined,
    { minPercentage: 60, enabled: true }
  );

  assert(eligB.isEligible, 'Test B is ELIGIBLE at exact threshold (3/3 required)');

  // Grade eligible test
  const scoreResultB = await gradePersistedTestResponses(testB.id);
  assert(scoreResultB === 30, 'Test B is graded normally: 3 objective correct answers = 30 points');

  const refreshedTestB = await prisma.test.findUnique({
    where: { id: testB.id },
    include: { analytics: true }
  });
  assert(Number(refreshedTestB?.score) === 30, 'Test B score is persisted as 30');
  assert(Number(refreshedTestB?.analytics?.total_score) === 30, 'Test B analytics total_score is 30');

  // Test Case C: Setting disabled preserves evaluation behavior
  console.log('\n  Sub-test C: Disabled setting preserves evaluation even below 60%');
  const testC = await prisma.test.create({
    data: {
      student_id: studentId,
      total_duration: 30,
      status: 'in_progress',
      is_completed: false,
      min_attempt_percentage: 60,
      min_attempt_enabled: false, // DISABLED
      test_questions: {
        create: [
          { question_id: qObj1.id, sequence_number: 1 },
          { question_id: qObj2.id, sequence_number: 2 },
        ]
      }
    },
    include: { test_questions: { include: { question: true } } }
  });

  // Candidate only attempts 1 question out of 2 (50% < 60%)
  await prisma.testResponse.create({
    data: {
      test_id: testC.id,
      question_id: qObj1.id,
      student_answer: '4'
    }
  });
  await prisma.testResponse.create({
    data: {
      test_id: testC.id,
      question_id: qObj2.id,
      student_answer: ''
    }
  });

  const eligC = assessTestAttemptEligibility(
    testC.test_questions,
    [
      { question_id: qObj1.id, student_answer: '4' },
      { question_id: qObj2.id, student_answer: '' }
    ],
    undefined,
    { minPercentage: 60, enabled: false }
  );
  assert(eligC.isEligible, 'Test C is ELIGIBLE because gate is disabled');

  const scoreResultC = await gradePersistedTestResponses(testC.id);
  assert(scoreResultC === 10, 'Test C is graded normally: 1 correct answer = 10 points');

  // -------------------------------------------------------------
  // Test Case D: HTTP Endpoint Execution & Route-level Guards
  // -------------------------------------------------------------
  console.log('\n--- Suite 5: HTTP Endpoint Execution & Guardrails ---');

  // Create fresh in-progress test for HTTP submission
  const testHttp = await prisma.test.create({
    data: {
      student_id: studentId,
      total_duration: 30,
      status: 'in_progress',
      is_completed: false,
      min_attempt_percentage: 60,
      min_attempt_enabled: true,
      test_questions: {
        create: [
          { question_id: qObj1.id, sequence_number: 1 },
          { question_id: qObj2.id, sequence_number: 2 },
          { question_id: qSubj1.id, sequence_number: 3 },
          { question_id: qObj3.id, sequence_number: 4 },
          { question_id: qElig.id, sequence_number: 5 },
        ]
      }
    }
  });

  // 1. Submit below threshold via HTTP POST /api/tests/[id]/submit
  const submitReq = new NextRequest(`http://localhost:3000/api/tests/${testHttp.id}/submit`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${studentToken}`
    },
    body: JSON.stringify({
      assessmentId: testHttp.id,
      status: 'submitted',
      responses: [
        { questionId: qObj1.id, answer: '4' }, // 1 applicable attempt (25% < 60%)
        { questionId: qElig.id, answer: 'Yes' }, // excluded
        { questionId: qObj2.id, answer: '' },
        { questionId: qSubj1.id, answer: '   ' },
        { questionId: qObj3.id, answer: '[]' }
      ]
    })
  });

  const submitRes = await submitActionRoute(submitReq, { params: Promise.resolve({ id: testHttp.id, action: 'submit' }) });
  const submitJson = await submitRes.json();

  assert(submitRes.status === 200, 'HTTP submit returned 200 OK');
  assert(submitJson.status === 'ineligible_attempt', 'HTTP submit returned status "ineligible_attempt"');
  assert(submitJson.isAttemptEligible === false, 'HTTP submit returned isAttemptEligible = false');

  const postSubmitTest = await prisma.test.findUnique({
    where: { id: testHttp.id },
    include: { test_responses: true, analytics: true }
  });
  assert(postSubmitTest?.status === 'ineligible_attempt', 'DB test status is "ineligible_attempt"');
  assert(postSubmitTest?.score === null, 'DB test score is strictly NULL');
  assert(postSubmitTest?.analytics?.total_score === null, 'DB TestAnalytics total_score is strictly NULL');

  // 2. Duplicate submission prevention
  const dupReq = new NextRequest(`http://localhost:3000/api/tests/${testHttp.id}/submit`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${studentToken}`
    },
    body: JSON.stringify({ assessmentId: testHttp.id, status: 'submitted' })
  });
  const dupRes = await submitActionRoute(dupReq, { params: Promise.resolve({ id: testHttp.id, action: 'submit' }) });
  assert(dupRes.status === 409, 'Duplicate submission blocked with HTTP 409 Conflict');

  // 3. Re-evaluation prevention on ineligible attempt
  const reevalReq = new NextRequest(`http://localhost:3000/api/tests/${testHttp.id}/reevaluate`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({ questionId: qSubj1.id })
  });
  const reevalRes = await submitActionRoute(reevalReq, { params: Promise.resolve({ id: testHttp.id, action: 'reevaluate' }) });
  assert(reevalRes.status === 400, 'Re-evaluation on ineligible attempt blocked with HTTP 400');

  // 4. Manual evaluation override via PATCH /api/tests/[id]
  const patchReq = new NextRequest(`http://localhost:3000/api/tests/${testHttp.id}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      evaluations: [{ questionId: qObj1.id, pointsEarned: 10, remarks: 'Overriding' }]
    })
  });
  const patchRes = await patchTestRoute(patchReq, { params: Promise.resolve({ id: testHttp.id }) });
  assert(patchRes.status === 400, 'PATCH manual evaluation on ineligible attempt blocked with HTTP 400');

  // 5. Score override via POST /api/admin/results/[testId]/override
  const overrideReq = new NextRequest(`http://localhost:3000/api/admin/results/${testHttp.id}/override`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({ questionId: qObj1.id, newScore: 10 })
  });
  const overrideRes = await overrideRoute(overrideReq, { params: Promise.resolve({ testId: testHttp.id }) });
  assert(overrideRes.status === 400, 'Admin score override on ineligible attempt blocked with HTTP 400');

  // 6. Admin Results API: GET /api/admin/results/[testId]
  const getResultReq = new NextRequest(`http://localhost:3000/api/admin/results/${testHttp.id}`, {
    method: 'GET',
    headers: { authorization: `Bearer ${adminToken}` }
  });
  const getResultRes = await getResultRoute(getResultReq, { params: Promise.resolve({ testId: testHttp.id }) });
  const getResultJson = await getResultRes.json();
  assert(getResultRes.status === 200, 'Admin results route returned 200 OK');
  assert(getResultJson.data?.status === 'ineligible_attempt', 'Admin results route returns status "ineligible_attempt"');
  assert(getResultJson.data?.scores?.overallScore === null, 'Admin results route returns overallScore = null (not 0)');
  assert(getResultJson.data?.attemptEligibility?.isEligible === false, 'Admin results route exposes attemptEligibility.isEligible = false');

  // 7. Admin Evaluations API: GET /api/admin/evaluation
  const getEvalReq = new NextRequest('http://localhost:3000/api/admin/evaluation', {
    method: 'GET',
    headers: { authorization: `Bearer ${adminToken}` }
  });
  const getEvalRes = await getEvaluationRoute(getEvalReq);
  const getEvalJson = await getEvalRes.json();
  assert(getEvalRes.status === 200, 'Admin evaluation route returned 200 OK');
  const listedAttempt = getEvalJson.tests?.find((t: any) => t.id === testHttp.id);
  assert(listedAttempt?.status === 'ineligible_attempt', 'Evaluation list exposes status "ineligible_attempt"');
  assert(listedAttempt?.score === null, 'Evaluation list exposes score = null (not 0)');

  // 8. Admin Test Settings API: GET & POST /api/admin/test-settings
  const postSettingsReq = new NextRequest('http://localhost:3000/api/admin/test-settings', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      total_duration: 45,
      total_questions: 25,
      min_attempt_percentage: 70,
      min_attempt_enabled: true
    })
  });
  const postSettingsRes = await postSettingsRoute(postSettingsReq);
  const postSettingsJson = await postSettingsRes.json();
  assert(postSettingsRes.status === 200, 'POST test-settings returned 200 OK');
  assert(postSettingsJson.config?.min_attempt_percentage === 70, 'min_attempt_percentage saved as 70');
  assert(postSettingsJson.config?.min_attempt_enabled === true, 'min_attempt_enabled saved as true');

  const getSettingsReq = new NextRequest('http://localhost:3000/api/admin/test-settings', {
    method: 'GET',
    headers: { authorization: `Bearer ${adminToken}` }
  });
  const getSettingsRes = await getSettingsRoute(getSettingsReq);
  const getSettingsJson = await getSettingsRes.json();
  assert(getSettingsJson.config?.min_attempt_percentage === 70, 'GET test-settings retrieves updated percentage');

  // Reset test settings back to default 60% enabled
  const resetSettingsReq = new NextRequest('http://localhost:3000/api/admin/test-settings', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      total_duration: 60,
      total_questions: 30,
      min_attempt_percentage: 60,
      min_attempt_enabled: true
    })
  });
  await postSettingsRoute(resetSettingsReq);

  // Clean up all test data
  await prisma.testResponse.deleteMany({ where: { test_id: { in: [testA.id, testB.id, testC.id, testHttp.id] } } });
  await prisma.testQuestion.deleteMany({ where: { test_id: { in: [testA.id, testB.id, testC.id, testHttp.id] } } });
  await prisma.testAnalytics.deleteMany({ where: { test_id: { in: [testA.id, testB.id, testC.id, testHttp.id] } } });
  await prisma.test.deleteMany({ where: { id: { in: [testA.id, testB.id, testC.id, testHttp.id] } } });
  await prisma.question.deleteMany({ where: { id: { in: [qObj1.id, qObj2.id, qObj3.id, qSubj1.id, qElig.id] } } });
  await prisma.student.deleteMany({ where: { id: studentId } });
  await prisma.user.deleteMany({ where: { id: user.id } });
  await prisma.admin.deleteMany({ where: { user_id: adminUser.id } });
  await prisma.user.deleteMany({ where: { id: adminUser.id } });

  console.log('\n============================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runMinimumAttemptTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
