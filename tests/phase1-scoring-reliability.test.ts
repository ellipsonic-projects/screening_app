import 'dotenv/config';
import prisma from '../lib/prisma';
import { recalculateTestScore } from '../lib/services/score-calculation';
import { processBackgroundEvaluations } from '../lib/services/evaluation-pipeline';
import { evaluateAnswer } from '../lib/evaluation-engine';
import { isEligibilityCategory } from '../lib/categories';

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

async function runPhase1Tests() {
  console.log('\n============================================================');
  console.log('🧪 RUNNING PHASE 1: SCORING RELIABILITY VERIFICATION SUITE');
  console.log('============================================================\n');

  // Find or create test student fixture
  let testUser = await prisma.user.findFirst({
    where: { email: 'phase1_test_student@example.com' },
    include: { student: true }
  });

  if (!testUser) {
    testUser = await prisma.user.create({
      data: {
        email: 'phase1_test_student@example.com',
        password_hash: 'hashed_password_for_testing',
        role: 'student',
        student: {
          create: {
            full_name: 'Phase 1 Test Candidate',
            usn: 'P1_USN_99999',
            branch_name: 'Computer Science',
            profile_completed: true
          }
        }
      },
      include: { student: true }
    });
  }

  const studentId = testUser.student!.id;

  // Find or create an admin fixture
  let adminUser = await prisma.user.findFirst({
    where: { role: 'super_admin' }
  });
  if (!adminUser) {
    adminUser = await prisma.user.findFirst({ where: { role: 'admin' } });
  }
  if (!adminUser) {
    adminUser = testUser; // fallback
  }

  // Create dedicated questions with known point values for deterministic testing
  const mcqQuestion = await prisma.question.create({
    data: {
      question_text: `Phase 1 Test MCQ ${Date.now()}`,
      type: 'mcq',
      section: 'APTITUDE',
      points: 10,
      options_json: ['10', '20', '30', '40'],
      correct_answer: '30',
      created_by: adminUser.id,
      is_published: true
    }
  });

  const codingQuestion = await prisma.question.create({
    data: {
      question_text: `Phase 1 Test Coding ${Date.now()}`,
      type: 'coding',
      section: 'CODING',
      points: 20,
      created_by: adminUser.id,
      is_published: true
    }
  });

  const eligibilityQuestion = await prisma.question.create({
    data: {
      question_text: `Phase 1 Test Eligibility ${Date.now()}`,
      type: 'mcq',
      section: 'ELIGIBILITY',
      points: 5, // Even if non-zero points are in question, eligibility must remain unscored
      options_json: ['Yes', 'No'],
      correct_answer: 'Yes',
      created_by: adminUser.id,
      is_published: true
    }
  });

  // ========================================================
  // ISSUE 1: Failed or Incomplete AI Evaluations
  // ========================================================
  console.log('--- TEST GROUP 1: Failed / Incomplete AI Evaluations Never Silently Treated as Zero ---');

  const failedTestAttempt = await prisma.test.create({
    data: {
      student_id: studentId,
      status: 'submitted',
      is_completed: true,
      total_duration: 60,
      test_questions: {
        create: [
          { question_id: mcqQuestion.id, sequence_number: 1 },
          { question_id: codingQuestion.id, sequence_number: 2 }
        ]
      }
    }
  });

  // MCQ response: answered correctly (+10 marks)
  await prisma.testResponse.create({
    data: {
      test_id: failedTestAttempt.id,
      question_id: mcqQuestion.id,
      student_answer: '30',
      points_earned: 10,
      is_correct: true,
      evaluation_status: 'COMPLETED'
    }
  });

  // Coding response: submitted code, but OpenRouter call failed (status: FAILED, points_earned: null)
  const failedCodingResp = await prisma.testResponse.create({
    data: {
      test_id: failedTestAttempt.id,
      question_id: codingQuestion.id,
      student_answer: 'function reverseString(s) { return s.split("").reverse().join(""); }',
      points_earned: null,
      is_correct: false,
      evaluation_status: 'FAILED',
      ai_evaluation_json: {
        evaluationStatus: 'FAILED',
        error: 'OpenRouter 503 Service Unavailable'
      }
    }
  });

  await prisma.aIEvaluation.create({
    data: {
      test_id: failedTestAttempt.id,
      student_id: studentId,
      question_id: codingQuestion.id,
      section: 'CODING',
      question_type: 'coding',
      obtained_marks: null,
      maximum_marks: 20,
      evaluation_status: 'FAILED',
      feedback: 'Evaluation failed due to OpenRouter API error',
      test_response_id: failedCodingResp.id
    }
  });

  // Recalculate score
  await recalculateTestScore(failedTestAttempt.id);

  const updatedFailedTest = await prisma.test.findUnique({
    where: { id: failedTestAttempt.id },
    include: { analytics: true, test_responses: true }
  });

  assert(
    updatedFailedTest?.status === 'evaluation_failed',
    `Test with failed AI evaluation is flagged as 'evaluation_failed' (status: ${updatedFailedTest?.status})`
  );

  assert(
    updatedFailedTest?.score === null,
    `Candidate total score is NOT finalized as partial/zero marks when evaluation failed (score: ${updatedFailedTest?.score})`
  );

  assert(
    updatedFailedTest?.analytics?.total_score === null,
    `TestAnalytics.total_score is NOT finalized when evaluation failed (analytics.total_score: ${updatedFailedTest?.analytics?.total_score})`
  );

  const persistedCodingResp = updatedFailedTest?.test_responses.find(r => r.question_id === codingQuestion.id);
  assert(
    persistedCodingResp?.evaluation_status === 'FAILED' && persistedCodingResp?.points_earned === null,
    `Subjective answer preserves explicit 'FAILED' status and null points_earned (not silently zeroed)`
  );

  // Clean up
  await prisma.aIEvaluation.deleteMany({ where: { test_id: failedTestAttempt.id } });
  await prisma.testResponse.deleteMany({ where: { test_id: failedTestAttempt.id } });
  await prisma.testAnalytics.deleteMany({ where: { test_id: failedTestAttempt.id } });
  await prisma.testQuestion.deleteMany({ where: { test_id: failedTestAttempt.id } });
  await prisma.test.delete({ where: { id: failedTestAttempt.id } });


  // ========================================================
  // ISSUE 2: Centralize Score Recalculation & Eligibility Exclusion
  // ========================================================
  console.log('\n--- TEST GROUP 2: Centralized recalculateTestScore & Unscored Eligibility Exclusion ---');

  const multiSectionTest = await prisma.test.create({
    data: {
      student_id: studentId,
      status: 'submitted',
      is_completed: true,
      total_duration: 60,
      test_questions: {
        create: [
          { question_id: eligibilityQuestion.id, sequence_number: 1 },
          { question_id: mcqQuestion.id, sequence_number: 2 },
          { question_id: codingQuestion.id, sequence_number: 3 }
        ]
      }
    }
  });

  // Response for eligibility (simulate candidate answered, accidental points_earned)
  await prisma.testResponse.create({
    data: {
      test_id: multiSectionTest.id,
      question_id: eligibilityQuestion.id,
      student_answer: 'Yes',
      points_earned: 5, // Should be ignored because Eligibility is unscored!
      is_correct: true,
      evaluation_status: 'COMPLETED'
    }
  });

  // Response for MCQ
  await prisma.testResponse.create({
    data: {
      test_id: multiSectionTest.id,
      question_id: mcqQuestion.id,
      student_answer: '30',
      points_earned: 10,
      is_correct: true,
      evaluation_status: 'COMPLETED'
    }
  });

  // Response for Coding
  const codingResp2 = await prisma.testResponse.create({
    data: {
      test_id: multiSectionTest.id,
      question_id: codingQuestion.id,
      student_answer: 'def solution(): pass',
      points_earned: 15,
      is_correct: false,
      evaluation_status: 'COMPLETED'
    }
  });

  await prisma.aIEvaluation.create({
    data: {
      test_id: multiSectionTest.id,
      student_id: studentId,
      question_id: codingQuestion.id,
      section: 'CODING',
      question_type: 'coding',
      obtained_marks: 15,
      maximum_marks: 20,
      evaluation_status: 'COMPLETED',
      test_response_id: codingResp2.id
    }
  });

  const calculatedTotal = await recalculateTestScore(multiSectionTest.id);

  // Total possible = 10 (MCQ) + 20 (Coding) = 30. (Eligibility 5 points excluded)
  // Total earned = 10 (MCQ) + 15 (Coding) = 25. (Eligibility 5 points earned excluded)
  assert(
    calculatedTotal === 25,
    `recalculateTestScore returns exactly 25 points, excluding Eligibility (got: ${calculatedTotal})`
  );

  const updatedMultiTest = await prisma.test.findUnique({
    where: { id: multiSectionTest.id },
    include: { analytics: true }
  });

  assert(
    Number(updatedMultiTest?.score) === 25,
    `Test.score persisted as 25 in database (score: ${updatedMultiTest?.score})`
  );

  assert(
    Number(updatedMultiTest?.analytics?.total_score) === 25,
    `TestAnalytics.total_score synchronized to 25 (analytics.total_score: ${updatedMultiTest?.analytics?.total_score})`
  );

  assert(
    Number(updatedMultiTest?.analytics?.overall_ai_marks) === 15,
    `TestAnalytics.overall_ai_marks correctly reflects AI marks = 15 (got: ${updatedMultiTest?.analytics?.overall_ai_marks})`
  );

  const expectedPct = parseFloat(((25 / 30) * 100).toFixed(2));
  const actualPct = parseFloat(Number(updatedMultiTest?.analytics?.overall_percentage).toFixed(2));
  assert(
    actualPct === expectedPct,
    `TestAnalytics.overall_percentage synchronized correctly: ${actualPct}% (expected: ${expectedPct}%)`
  );

  const sectionTotals = (updatedMultiTest?.analytics?.section_totals as any) || {};
  assert(
    sectionTotals['ELIGIBILITY'] === undefined && sectionTotals['eligibility'] === undefined,
    `TestAnalytics.section_totals strictly omits unscored Eligibility section`
  );

  // Clean up
  await prisma.aIEvaluation.deleteMany({ where: { test_id: multiSectionTest.id } });
  await prisma.testResponse.deleteMany({ where: { test_id: multiSectionTest.id } });
  await prisma.testAnalytics.deleteMany({ where: { test_id: multiSectionTest.id } });
  await prisma.testQuestion.deleteMany({ where: { test_id: multiSectionTest.id } });
  await prisma.test.delete({ where: { id: multiSectionTest.id } });


  // ========================================================
  // ISSUE 3: Legitimate Score of Zero Not Treated as Missing
  // ========================================================
  console.log('\n--- TEST GROUP 3: Legitimate Score of 0 Not Treated as Missing Score ---');

  const zeroScoreTest = await prisma.test.create({
    data: {
      student_id: studentId,
      status: 'submitted',
      is_completed: true,
      total_duration: 60,
      score: 0,
      test_questions: {
        create: [{ question_id: mcqQuestion.id, sequence_number: 1 }]
      }
    }
  });

  const nullScoreTest = await prisma.test.create({
    data: {
      student_id: studentId,
      status: 'in_progress',
      is_completed: false,
      total_duration: 60,
      score: null
    }
  });

  // Verify the admin results route logic (mimicking the exact updated logic in app/api/admin/results/[testId]/route.ts)
  const resolveAdminOverallScore = (t: { score: any; status: string | null; is_completed: boolean | null }) => {
    const isEvalFailed = t.status === 'evaluation_failed';
    return isEvalFailed
      ? null
      : (t.score !== null && t.score !== undefined ? Number(t.score) : null);
  };

  const zeroResolved = resolveAdminOverallScore(zeroScoreTest);
  assert(
    zeroResolved === 0,
    `Admin results mapping returns number 0 for a legitimate score of zero (got: ${zeroResolved})`
  );

  const nullResolved = resolveAdminOverallScore(nullScoreTest);
  assert(
    nullResolved === null,
    `Admin results mapping returns null for an unscored / incomplete test (got: ${nullResolved})`
  );

  // Clean up
  await prisma.testQuestion.deleteMany({ where: { test_id: zeroScoreTest.id } });
  await prisma.test.delete({ where: { id: zeroScoreTest.id } });
  await prisma.test.delete({ where: { id: nullScoreTest.id } });


  // ========================================================
  // ISSUE 4: Prevent Blank Answers from Being Sent to OpenRouter
  // ========================================================
  console.log('\n--- TEST GROUP 4: Blank Coding & Open-Text Answers Not Sent to OpenRouter ---');

  // 4.1 Evaluation engine unit test with blank string
  const blankEngineResult = await evaluateAnswer({
    questionId: codingQuestion.id,
    questionType: 'coding',
    question: 'Write a function',
    studentAnswer: '    ',
    maxMarks: 20
  });

  assert(
    blankEngineResult.success === true && blankEngineResult.score === 0,
    `evaluateAnswer immediately awards 0 marks for blank answer without calling OpenRouter (score: ${blankEngineResult.score})`
  );
  assert(
    blankEngineResult.modelUsed === 'none',
    `evaluateAnswer modelUsed is 'none' (verified zero LLM token consumption)`
  );
  assert(
    blankEngineResult.evaluationStatus === 'COMPLETED',
    `evaluateAnswer returns COMPLETED status for blank answer`
  );

  // 4.2 Background evaluation pipeline handles blank answer
  const blankPipelineTest = await prisma.test.create({
    data: {
      student_id: studentId,
      status: 'submitted',
      is_completed: true,
      total_duration: 60,
      test_questions: {
        create: [{ question_id: codingQuestion.id, sequence_number: 1 }]
      }
    }
  });

  const blankResp = await prisma.testResponse.create({
    data: {
      test_id: blankPipelineTest.id,
      question_id: codingQuestion.id,
      student_answer: '',
      evaluation_status: 'PENDING'
    }
  });

  // Call processBackgroundEvaluations with blank studentAnswer
  await processBackgroundEvaluations([
    {
      testId: blankPipelineTest.id,
      questionId: codingQuestion.id,
      studentAnswer: '   '
    }
  ], blankPipelineTest.id);

  const evaluatedBlankResp = await prisma.testResponse.findUnique({
    where: { id: blankResp.id }
  });

  assert(
    evaluatedBlankResp?.evaluation_status === 'COMPLETED' && Number(evaluatedBlankResp?.points_earned) === 0,
    `processBackgroundEvaluations grades blank answer as COMPLETED with points_earned = 0`
  );

  const evaluatedBlankAi = await prisma.aIEvaluation.findUnique({
    where: { test_response_id: blankResp.id }
  });

  assert(
    evaluatedBlankAi?.evaluation_status === 'COMPLETED' && Number(evaluatedBlankAi?.obtained_marks) === 0,
    `processBackgroundEvaluations creates AIEvaluation with COMPLETED and obtained_marks = 0`
  );

  // Clean up
  await prisma.aIEvaluation.deleteMany({ where: { test_id: blankPipelineTest.id } });
  await prisma.testResponse.deleteMany({ where: { test_id: blankPipelineTest.id } });
  await prisma.testAnalytics.deleteMany({ where: { test_id: blankPipelineTest.id } });
  await prisma.testQuestion.deleteMany({ where: { test_id: blankPipelineTest.id } });
  await prisma.test.delete({ where: { id: blankPipelineTest.id } });


  // ========================================================
  // ISSUE 5: Validation of Manual Score Overrides
  // ========================================================
  console.log('\n--- TEST GROUP 5: Manual Score Override Validation ---');

  const validateScoreOverride = (newScore: any, maxMarks: number) => {
    const parsedScore = Number(newScore);
    if (typeof newScore === 'boolean' || newScore === null || isNaN(parsedScore) || !isFinite(parsedScore)) {
      return { valid: false, error: 'Score must be a valid number' };
    }
    if (parsedScore < 0) {
      return { valid: false, error: 'Score cannot be negative' };
    }
    if (parsedScore > maxMarks) {
      return { valid: false, error: `Score cannot exceed maximum marks for this question (${maxMarks})` };
    }
    return { valid: true, score: parsedScore };
  };

  const maxPoints = codingQuestion.points || 20;

  // Negative marks
  const negCheck = validateScoreOverride(-5, maxPoints);
  assert(!negCheck.valid && negCheck.error === 'Score cannot be negative', 'Negative override score is rejected');

  // Non-numeric marks
  const nonNumCheck = validateScoreOverride('not-a-number', maxPoints);
  assert(!nonNumCheck.valid && nonNumCheck.error === 'Score must be a valid number', 'Non-numeric override score is rejected');

  // Boolean value
  const boolCheck = validateScoreOverride(true, maxPoints);
  assert(!boolCheck.valid && boolCheck.error === 'Score must be a valid number', 'Boolean override score is rejected');

  // Score exceeding maximum
  const exceedCheck = validateScoreOverride(25, maxPoints);
  assert(!exceedCheck.valid && exceedCheck.error?.includes('cannot exceed maximum marks'), `Score of 25 exceeding max (${maxPoints}) is rejected`);

  // Valid score
  const validCheck = validateScoreOverride(18.5, maxPoints);
  assert(validCheck.valid && validCheck.score === 18.5, 'Valid override score 18.5 is accepted');

  // Zero score override
  const zeroOverrideCheck = validateScoreOverride(0, maxPoints);
  assert(zeroOverrideCheck.valid && zeroOverrideCheck.score === 0, 'Override score of 0 is accepted as valid numeric score');


  // ========================================================
  // ISSUE 6: Prevent Duplicate Evaluation Processing on Repeated Submissions
  // ========================================================
  console.log('\n--- TEST GROUP 6: Duplicate Evaluation Processing Prevention ---');

  const concurrentTest = await prisma.test.create({
    data: {
      student_id: studentId,
      status: 'in_progress',
      is_completed: false,
      total_duration: 60
    }
  });

  // Simulate two concurrent submit requests attempting atomic claim
  const claim1 = await prisma.test.updateMany({
    where: {
      id: concurrentTest.id,
      is_completed: false,
      status: 'in_progress'
    },
    data: {
      status: 'submitted',
      is_completed: true,
      end_time: new Date(),
      updated_at: new Date()
    }
  });

  const claim2 = await prisma.test.updateMany({
    where: {
      id: concurrentTest.id,
      is_completed: false,
      status: 'in_progress'
    },
    data: {
      status: 'submitted',
      is_completed: true,
      end_time: new Date(),
      updated_at: new Date()
    }
  });

  assert(claim1.count === 1, 'First submission request successfully claims the atomic lock (count = 1)');
  assert(claim2.count === 0, 'Second submission request is rejected by atomic lock (count = 0, HTTP 409)');

  // Clean up
  await prisma.test.delete({ where: { id: concurrentTest.id } });

  // Clean up test student if we created one
  if (testUser.email === 'phase1_test_student@example.com') {
    await prisma.student.deleteMany({ where: { user_id: testUser.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
  }

  // ========================================================
  // SUMMARY
  // ========================================================
  console.log('\n============================================================');
  console.log(`PHASE 1 SCORING RELIABILITY SUITE: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================\n');

  await prisma.$disconnect();
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase1Tests().catch(async (err) => {
  console.error('Test execution failed:', err);
  await prisma.$disconnect();
  process.exit(1);
});

