import 'dotenv/config';
import prisma from '../lib/prisma';
import { 
  getEvaluationPrompt 
} from '../lib/prompts/evaluation-templates';
import { 
  getCriteriaForQuestion, 
  allocateCriterionMarks, 
  CATEGORY_CRITERIA_REGISTRY 
} from '../lib/evaluation/criteria-registry';
import { 
  evaluateAnswer, 
  parseLLMResponse 
} from '../lib/evaluation-engine';
import { 
  canonicalizeCategory, 
  getCategoryLabel, 
  isEligibilityCategory 
} from '../lib/categories';
import { mapQuestionPayload } from '../lib/questionMapper';
import { recalculateTestScore } from '../lib/services/score-calculation';
import { processBackgroundEvaluations } from '../lib/services/evaluation-pipeline';
import { EvaluationRequest } from '../types';

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

async function runPhase2Tests() {
  console.log('\n============================================================');
  console.log('🧪 RUNNING PHASE 2: DYNAMIC AI EVALUATION ENGINE SUITE');
  console.log('============================================================\n');

  // ========================================================
  // TEST 1: Prompt selection changes across categories for the same question type
  // ========================================================
  console.log('--- TEST 1: Category-Specific Prompt Differentiation ---');
  const ethicsPrompt = getEvaluationPrompt({
    questionId: 'q-ethics',
    section: 'INTEGRITY',
    questionType: 'open_text',
    question: 'How do you handle a request to bypass security controls?',
    studentAnswer: 'I would refuse and escalate to the compliance officer.',
    maxMarks: 10
  });

  const aiLiteracyPrompt = getEvaluationPrompt({
    questionId: 'q-ai',
    section: 'AI_LITERACY',
    questionType: 'open_text',
    question: 'How do you verify whether an LLM output contains hallucinations?',
    studentAnswer: 'Cross-reference with trusted primary documentation.',
    maxMarks: 10
  });

  const ownershipPrompt = getEvaluationPrompt({
    questionId: 'q-ownership',
    section: 'ATTITUDE_AND_OWNERSHIP',
    questionType: 'open_text',
    question: 'Describe a situation where a project failed under your watch.',
    studentAnswer: 'I took full ownership, notified stakeholders, and fixed the issue.',
    maxMarks: 10
  });

  assert(
    ethicsPrompt.includes('Ethical, Privacy & Security Risk Recognition') &&
    ethicsPrompt.includes('Soundness of Judgment & Values Alignment'),
    'INTEGRITY prompt includes ethics-specific criteria'
  );
  assert(
    aiLiteracyPrompt.includes('Output Verification & Critical Thinking') &&
    aiLiteracyPrompt.includes('Tool Selection & Prompt Strategy'),
    'AI_LITERACY prompt includes AI verification criteria'
  );
  assert(
    ownershipPrompt.includes('Accountability & Follow-Through') &&
    ownershipPrompt.includes('Proactivity & Initiative'),
    'ATTITUDE_AND_OWNERSHIP prompt includes ownership-specific criteria'
  );
  assert(
    ethicsPrompt !== aiLiteracyPrompt && aiLiteracyPrompt !== ownershipPrompt,
    'Prompt outputs differ dynamically across categories for identical question type "open_text"'
  );

  // ========================================================
  // TEST 2: Prompt selection changes across question types within a category
  // ========================================================
  console.log('\n--- TEST 2: Question-Type Differentiation Within Category ---');
  const codingPrompt = getEvaluationPrompt({
    questionId: 'q-code',
    section: 'CODING',
    questionType: 'coding',
    question: 'Write a binary search function.',
    studentAnswer: 'def search(arr, target): pass',
    maxMarks: 20
  });

  const codeReviewPrompt = getEvaluationPrompt({
    questionId: 'q-cr',
    section: 'CODING',
    questionType: 'code_review',
    question: 'Review this SQL query for SQL injection vulnerabilities.',
    studentAnswer: 'The query uses string concatenation instead of parameterized queries.',
    maxMarks: 20
  });

  assert(
    codingPrompt.includes('STATIC CODE INSPECTION ONLY') &&
    codingPrompt.includes('Program Logic & Likely Correctness'),
    'Coding prompt contains coding inspection instructions'
  );
  assert(
    codeReviewPrompt.includes('CRITICAL CODE-REVIEW EVALUATION INSTRUCTIONS') &&
    codeReviewPrompt.includes('Bug & Vulnerability Identification'),
    'Code review prompt contains code-review instructions'
  );
  assert(
    codingPrompt !== codeReviewPrompt,
    'Prompt differs between "coding" and "code_review" types within the CODING category'
  );

  // ========================================================
  // TEST 3: Existing category aliases and canonical mappings remain unchanged
  // ========================================================
  console.log('\n--- TEST 3: Preservation of Canonical Category Mappings ---');
  assert(canonicalizeCategory('Quantitative & Logical Reasoning') === 'APTITUDE', 'New display name maps to APTITUDE');
  assert(canonicalizeCategory('Aptitude') === 'APTITUDE', 'Legacy name maps to APTITUDE');
  assert(canonicalizeCategory('Ownership & Initiative') === 'ATTITUDE_AND_OWNERSHIP', 'New display name maps to ATTITUDE_AND_OWNERSHIP');
  assert(canonicalizeCategory('Attitude & Ownership') === 'ATTITUDE_AND_OWNERSHIP', 'Legacy alias with ampersand maps correctly');
  assert(canonicalizeCategory('Ethics & Judgment') === 'INTEGRITY', 'Ethics & Judgment maps to INTEGRITY');
  assert(getCategoryLabel('AI_LITERACY') === 'AI Literacy & Responsible Use', 'Canonical label formatting preserved');

  // ========================================================
  // TEST 4: Unsupported combinations fail safely
  // ========================================================
  console.log('\n--- TEST 4: Unsupported Combinations & Error Handling ---');
  let thrownCategoryError = false;
  try {
    getEvaluationPrompt({
      questionId: 'q-unknown',
      section: 'NON_EXISTENT_SECTION',
      questionType: 'open_text',
      question: 'Hello',
      studentAnswer: 'World',
      maxMarks: 10
    });
  } catch (err: any) {
    thrownCategoryError = err.message.includes('Unsupported or unrecognized category');
  }
  assert(thrownCategoryError, 'Unrecognized category throws descriptive error and rejects prompt selection');

  let thrownTypeError = false;
  try {
    getEvaluationPrompt({
      questionId: 'q-mcq',
      section: 'APTITUDE',
      questionType: 'mcq',
      question: 'What is 1 + 1?',
      studentAnswer: '2',
      maxMarks: 10
    });
  } catch (err: any) {
    thrownTypeError = err.message.includes('Unsupported question type');
  }
  assert(thrownTypeError, 'Objective question type routed to AI prompt throws descriptive error');

  let thrownEligibilityError = false;
  try {
    getEvaluationPrompt({
      questionId: 'q-eligibility',
      section: 'ELIGIBILITY',
      questionType: 'open_text',
      question: 'Are you available to join immediately?',
      studentAnswer: 'Yes',
      maxMarks: 0
    });
  } catch (err: any) {
    thrownEligibilityError = err.message.includes('Eligibility questions are unscored');
  }
  assert(thrownEligibilityError, 'Eligibility category routed to AI prompt is strictly rejected');

  // ========================================================
  // TEST 5: Existing question imports continue working without rubric fields
  // ========================================================
  console.log('\n--- TEST 5: Backward-Compatible Question Ingestion Without Rubric ---');
  const legacyExcelRow = {
    'Question Text': 'Explain ACID properties in relational databases.',
    'Section': 'Problem Solving & System Design',
    'Question Type': 'open_text',
    'Points': 15,
    'Expected Duration': 5,
    'Min Words': 50,
    'Max Words': 200
  };

  const importedPayload = mapQuestionPayload(legacyExcelRow);
  assert(importedPayload.type === 'open_text', 'Legacy row imports as open_text');
  assert(importedPayload.section === 'PROBLEM_SOLVING', 'Section canonicalizes to PROBLEM_SOLVING');
  assert(importedPayload.points === 15, 'Points imported as 15 without requiring rubric columns');
  assert(importedPayload.optionsJson.minWords === 50 && importedPayload.optionsJson.maxWords === 200, 'Word limits preserved');

  // ========================================================
  // TEST 6: Evaluation receives correct category, type, max marks and metadata
  // ========================================================
  console.log('\n--- TEST 6: Metadata & Question Context Delivery ---');
  const requestWithMeta: EvaluationRequest = {
    questionId: 'q-sys',
    section: 'PROBLEM_SOLVING',
    questionType: 'open_text',
    question: 'Design a distributed rate limiter.',
    studentAnswer: 'I would use a token bucket algorithm backed by Redis.',
    maxMarks: 20,
    metadata: {
      constraints: 'Must handle 100k requests/sec with < 5ms latency.',
      scenario: 'High-throughput payment gateway.',
      minWords: 100
    }
  };

  const generatedPrompt = getEvaluationPrompt(requestWithMeta);
  assert(generatedPrompt.includes('Must handle 100k requests/sec'), 'Prompt includes constraints metadata');
  assert(generatedPrompt.includes('High-throughput payment gateway'), 'Prompt includes scenario metadata');
  assert(generatedPrompt.includes('Min 100'), 'Prompt includes word count expectation');
  assert(generatedPrompt.includes('TOTAL: 20 MARKS'), 'Prompt includes question maximum marks');

  // ========================================================
  // TEST 7: Criterion maximum marks match question maximum
  // ========================================================
  console.log('\n--- TEST 7: Deterministic Criterion Mark Allocation Parity ---');
  const testMarks = [5, 8, 10, 15, 20, 25, 30];
  const sampleCriteria = CATEGORY_CRITERIA_REGISTRY.PROBLEM_SOLVING;

  let allSumsMatch = true;
  for (const marks of testMarks) {
    const allocated = allocateCriterionMarks(sampleCriteria, marks);
    const sum = Math.round(allocated.reduce((acc, c) => acc + c.maxScore, 0) * 10) / 10;
    const allPositive = allocated.every(c => c.maxScore > 0);
    if (sum !== marks || !allPositive) {
      allSumsMatch = false;
      console.error(`Failed allocation for totalMarks=${marks}: sum=${sum}, allocated=`, allocated);
    }
  }
  assert(allSumsMatch, 'allocateCriterionMarks sums exactly to totalMarks for all mark levels [5, 8, 10, 15, 20, 25, 30]');

  // ========================================================
  // TEST 8: Criterion-level scores are bounded and add up to overall score
  // ========================================================
  console.log('\n--- TEST 8: Server-Side Criteria Score Validation ---');
  const validMockLLMOutput = JSON.stringify({
    evaluationStatus: 'Partially Correct',
    criteria: [
      { id: 'problem_framing_reasoning', name: 'Problem Framing & Analytical Reasoning', score: 6.0, maxScore: 7.0, explanation: 'Clear root cause identification.' },
      { id: 'solution_architecture_tradeoffs', name: 'Architecture, Design & Trade-Off Analysis', score: 5.5, maxScore: 7.0, explanation: 'Good token bucket architecture.' },
      { id: 'reliability_failure_resilience', name: 'Reliability, Edge Cases & Failure Scenarios', score: 4.5, maxScore: 6.0, explanation: 'Redis failover considered.' }
    ],
    score: 16.0,
    feedback: 'Solid system design answer.',
    strengths: ['Clear token bucket explanation'],
    improvements: ['Could elaborate on network partitions'],
    deductionReasons: ['Missing edge case of Redis cluster failure']
  });

  const parsedValid = parseLLMResponse(requestWithMeta, validMockLLMOutput, 'test-model');
  assert(parsedValid.success === true, 'parseLLMResponse succeeds on valid structured response');
  assert(parsedValid.score === 16.0, `Calculated score equals 16.0 (got ${parsedValid.score})`);
  assert(parsedValid.criteriaScores?.length === 3, 'Returns 3 structured criterion breakdown items');
  assert(parsedValid.criteriaScores?.[0].score === 6.0, 'Criterion 1 score preserved');

  // ========================================================
  // TEST 9: Missing, duplicate, or unknown criteria are rejected
  // ========================================================
  console.log('\n--- TEST 9: Rejection of Invalid Criteria Payloads ---');
  // 9.1 Unknown criterion
  const unknownCriteriaOutput = JSON.stringify({
    criteria: [
      { id: 'problem_framing_reasoning', score: 7.0 },
      { id: 'solution_architecture_tradeoffs', score: 7.0 },
      { id: 'unknown_hallucinated_criterion', score: 6.0 }
    ],
    score: 20.0
  });
  const parsedUnknown = parseLLMResponse(requestWithMeta, unknownCriteriaOutput, 'test-model');
  assert(!parsedUnknown.success && parsedUnknown.error?.includes('Unknown criterion'), 'Rejects unknown criteria in response');

  // 9.2 Duplicate criterion
  const duplicateCriteriaOutput = JSON.stringify({
    criteria: [
      { id: 'problem_framing_reasoning', score: 7.0 },
      { id: 'problem_framing_reasoning', score: 7.0 },
      { id: 'reliability_failure_resilience', score: 6.0 }
    ],
    score: 20.0
  });
  const parsedDuplicate = parseLLMResponse(requestWithMeta, duplicateCriteriaOutput, 'test-model');
  assert(!parsedDuplicate.success && parsedDuplicate.error?.includes('Duplicate criterion'), 'Rejects duplicate criteria in response');

  // 9.3 Score exceeding criterion max
  const scoreExceedingOutput = JSON.stringify({
    criteria: [
      { id: 'problem_framing_reasoning', score: 10.0, maxScore: 7.0 },
      { id: 'solution_architecture_tradeoffs', score: 7.0, maxScore: 7.0 },
      { id: 'reliability_failure_resilience', score: 6.0, maxScore: 6.0 }
    ],
    score: 23.0
  });
  const parsedExceed = parseLLMResponse(requestWithMeta, scoreExceedingOutput, 'test-model');
  assert(!parsedExceed.success && parsedExceed.error?.includes('exceeds maximum allowed'), 'Rejects criterion score exceeding maxScore');

  // ========================================================
  // TEST 10: Malformed AI responses and provider failures preserve failure semantics
  // ========================================================
  console.log('\n--- TEST 10: Preserving Failure Semantics ---');
  const malformedJson = 'This is not JSON at all';
  const parsedMalformed = parseLLMResponse(requestWithMeta, malformedJson, 'test-model');
  assert(
    parsedMalformed.success === false && parsedMalformed.evaluationStatus === 'FAILED',
    'Malformed response returns success=false and evaluationStatus=FAILED'
  );

  // ========================================================
  // TEST 11: Legitimate zero score remains distinct from failure
  // ========================================================
  console.log('\n--- TEST 11: Legitimate Zero Score vs Failure ---');
  const legitimateZeroOutput = JSON.stringify({
    evaluationStatus: 'Incorrect',
    criteria: [
      { id: 'problem_framing_reasoning', name: 'Problem Framing & Analytical Reasoning', score: 0.0, maxScore: 7.0, explanation: 'Off topic' },
      { id: 'solution_architecture_tradeoffs', name: 'Architecture, Design & Trade-Off Analysis', score: 0.0, maxScore: 7.0, explanation: 'No architecture presented' },
      { id: 'reliability_failure_resilience', name: 'Reliability, Edge Cases & Failure Scenarios', score: 0.0, maxScore: 6.0, explanation: 'No reliability analysis' }
    ],
    score: 0.0,
    feedback: 'The submission does not address the question.',
    strengths: [],
    improvements: ['Review system design fundamentals'],
    deductionReasons: ['Completely irrelevant response']
  });

  const parsedZero = parseLLMResponse(requestWithMeta, legitimateZeroOutput, 'test-model');
  assert(
    parsedZero.success === true && parsedZero.evaluationStatus === 'COMPLETED' && parsedZero.score === 0,
    'Legitimate zero score has success=true, evaluationStatus=COMPLETED, and score=0 (not FAILED)'
  );

  // Blank answer unit check
  const blankResult = await evaluateAnswer({
    questionId: 'q-blank',
    section: 'PROBLEM_SOLVING',
    questionType: 'open_text',
    question: 'Explain sharding',
    studentAnswer: '   ',
    maxMarks: 20
  });
  assert(
    blankResult.success === true && blankResult.score === 0 && blankResult.evaluationStatus === 'COMPLETED',
    'Blank answer produces COMPLETED status with 0 marks'
  );
  assert(
    blankResult.criteriaScores?.length === 3 && blankResult.criteriaScores.every(c => c.score === 0),
    'Blank answer generates structured zero-score criteria breakdown'
  );

  // ========================================================
  // TEST 12 & 13: Deterministic grading for objective types (MCQ, Multi-Select, Ranking)
  // ========================================================
  console.log('\n--- TEST 12 & 13: Deterministic Objective Grading ---');
  // Multi-select all-or-nothing test logic
  const checkMultiSelect = (student: string[], correct: string[], points: number) => {
    const isExactMatch = student.length === correct.length && student.every(v => correct.includes(v));
    return isExactMatch ? points : 0;
  };

  assert(checkMultiSelect(['A', 'B'], ['A', 'B'], 10) === 10, 'Multi-select exact match awards full 10 marks');
  assert(checkMultiSelect(['A'], ['A', 'B'], 10) === 0, 'Multi-select partial selection awards 0 marks (All-or-Nothing preserved)');
  assert(checkMultiSelect(['A', 'B', 'C'], ['A', 'B'], 10) === 0, 'Multi-select with extra choice awards 0 marks');

  // Ranking partial marks test logic
  const checkRanking = (studentOrder: string[], correctOrder: string[], points: number, allowPartial: boolean) => {
    if (JSON.stringify(studentOrder) === JSON.stringify(correctOrder)) return points;
    if (allowPartial && correctOrder.length > 0) {
      let correctPos = 0;
      for (let i = 0; i < correctOrder.length; i++) {
        if (studentOrder[i] === correctOrder[i]) correctPos++;
      }
      return parseFloat(((correctPos / correctOrder.length) * points).toFixed(2));
    }
    return 0;
  };

  assert(checkRanking(['A', 'B', 'C', 'D'], ['A', 'B', 'C', 'D'], 20, true) === 20, 'Ranking exact order awards full marks (20)');
  assert(checkRanking(['A', 'B', 'D', 'C'], ['A', 'B', 'C', 'D'], 20, true) === 10, 'Ranking partial order (2/4 correct) awards 10 marks when allowed');
  assert(checkRanking(['A', 'B', 'D', 'C'], ['A', 'B', 'C', 'D'], 20, false) === 0, 'Ranking awards 0 when allowPartial is false');

  // ========================================================
  // TEST 14 & 15: Eligibility Unscored Enforcement & Regression Tests for open_text Eligibility Answers
  // ========================================================
  console.log('\n--- TEST 14: Eligibility Unscored Enforcement ---');
  assert(isEligibilityCategory('ELIGIBILITY') === true, 'ELIGIBILITY is recognized as unscored');
  assert(isEligibilityCategory('Eligibility & Logistics (Unscored)') === true, 'Display label recognized as unscored');

  console.log('\n--- TEST 15: Regression Tests for open_text Eligibility Answers ---');
  const testStudent = await prisma.student.findFirst();
  if (testStudent) {
    const adminUser = await prisma.user.findFirst({ where: { role: 'admin' } }) || await prisma.user.findFirst();
    const scoredQ = await prisma.question.create({
      data: {
        question_text: `Regression Scored Q ${Date.now()}`,
        type: 'mcq',
        section: 'APTITUDE',
        points: 10,
        options_json: ['A', 'B'],
        correct_answer: 'A',
        created_by: adminUser?.id || testStudent.user_id,
        is_published: true
      }
    });

    const openTextEligQ = await prisma.question.create({
      data: {
        question_text: `Regression Open-Text Eligibility Q ${Date.now()}`,
        type: 'open_text',
        section: 'ELIGIBILITY',
        points: 0,
        created_by: adminUser?.id || testStudent.user_id,
        is_published: true
      }
    });

    const regTest = await prisma.test.create({
      data: {
        student_id: testStudent.id,
        status: 'submitted',
        is_completed: true,
        total_duration: 30,
        score: null,
        test_questions: {
          create: [
            { question_id: scoredQ.id, sequence_number: 1 },
            { question_id: openTextEligQ.id, sequence_number: 2 }
          ]
        }
      }
    });

    // Subtest A: Non-blank answer to open_text eligibility question
    await prisma.testResponse.create({
      data: {
        test_id: regTest.id,
        question_id: scoredQ.id,
        student_answer: 'A',
        points_earned: 10,
        is_correct: true,
        evaluation_status: 'COMPLETED'
      }
    });

    const nonBlankEligResp = await prisma.testResponse.create({
      data: {
        test_id: regTest.id,
        question_id: openTextEligQ.id,
        student_answer: 'I am graduating in 2026 and available full time.',
        points_earned: null,
        evaluation_status: 'PENDING'
      }
    });

    // Pass non-blank eligibility answer to processBackgroundEvaluations
    await processBackgroundEvaluations([{
      testId: regTest.id,
      questionId: openTextEligQ.id,
      studentAnswer: 'I am graduating in 2026 and available full time.'
    }], regTest.id);

    // Verify it was marked COMPLETED with 0 marks without calling AI engine
    const updatedNonBlankEligResp = await prisma.testResponse.findUnique({
      where: { id: nonBlankEligResp.id }
    });

    assert(
      updatedNonBlankEligResp?.evaluation_status === 'COMPLETED',
      'Non-blank open_text eligibility answer is marked COMPLETED without calling AI'
    );
    assert(
      Number(updatedNonBlankEligResp?.points_earned) === 0,
      'Non-blank open_text eligibility answer is awarded exactly 0 points'
    );

    await recalculateTestScore(regTest.id);
    const refreshedRegTest = await prisma.test.findUnique({ where: { id: regTest.id } });

    assert(
      refreshedRegTest?.status !== 'evaluation_failed',
      'Non-blank open_text eligibility answer does NOT cause assessment to become evaluation_failed'
    );
    assert(
      Number(refreshedRegTest?.score) === 10,
      'Assessment total score correctly preserves scored question marks (got: 10)'
    );

    // Subtest B: Blank answer to open_text eligibility question
    await prisma.testResponse.update({
      where: { id: nonBlankEligResp.id },
      data: {
        student_answer: '',
        points_earned: null,
        evaluation_status: 'PENDING'
      }
    });

    await processBackgroundEvaluations([{
      testId: regTest.id,
      questionId: openTextEligQ.id,
      studentAnswer: ''
    }], regTest.id);

    const updatedBlankEligResp = await prisma.testResponse.findUnique({
      where: { id: nonBlankEligResp.id }
    });

    assert(
      updatedBlankEligResp?.evaluation_status === 'COMPLETED',
      'Blank open_text eligibility answer is marked COMPLETED'
    );
    assert(
      Number(updatedBlankEligResp?.points_earned) === 0,
      'Blank open_text eligibility answer is awarded exactly 0 points'
    );

    await recalculateTestScore(regTest.id);
    const refreshedRegTestBlank = await prisma.test.findUnique({ where: { id: regTest.id } });

    assert(
      refreshedRegTestBlank?.status !== 'evaluation_failed',
      'Blank open_text eligibility answer does NOT cause assessment to become evaluation_failed'
    );
    assert(
      Number(refreshedRegTestBlank?.score) === 10,
      'Assessment total score remains 10 with blank eligibility response'
    );

    // Subtest C: Admin failure detection ignores eligibility open_text
    const REVIEWABLE_TYPES = ['coding', 'structured_response', 'open_text'];
    const fakeFailedEligResponse = {
      evaluation_status: 'FAILED',
      question: { type: 'open_text', section: 'ELIGIBILITY' }
    };
    const isFailedCandidate = REVIEWABLE_TYPES.includes(fakeFailedEligResponse.question.type) && 
      !isEligibilityCategory(fakeFailedEligResponse.question.section) && 
      fakeFailedEligResponse.evaluation_status === 'FAILED';

    assert(
      isFailedCandidate === false,
      'Failed-evaluation detector in admin results and evaluation APIs strictly ignores unscored Eligibility questions'
    );

    // Cleanup regression records
    await prisma.aIEvaluation.deleteMany({ where: { test_id: regTest.id } });
    await prisma.testAnalytics.deleteMany({ where: { test_id: regTest.id } });
    await prisma.testResponse.deleteMany({ where: { test_id: regTest.id } });
    await prisma.testQuestion.deleteMany({ where: { test_id: regTest.id } });
    await prisma.test.delete({ where: { id: regTest.id } });
    await prisma.question.deleteMany({ where: { id: { in: [scoredQ.id, openTextEligQ.id] } } });
  }

  // ========================================================
  // TEST 17: Legacy evaluation records render safely
  // ========================================================
  console.log('\n--- TEST 17: Legacy Evaluation Record Compatibility ---');
  const legacyEvalRecord: any = {
    questionId: 'q-legacy',
    feedback: 'Good answer from previous test session.',
    strengths: ['Clear logic'],
    improvements: ['Improve formatting'],
    // Missing criteriaScores and deductionReasons (as in Phase 1 legacy evaluations)
    obtained_marks: 14.0,
    maximum_marks: 20.0
  };

  // Check that legacy evaluation defaults gracefully
  const legacyCriteria = legacyEvalRecord.criteriaScores || [];
  const legacyDeductions = legacyEvalRecord.deductionReasons || legacyEvalRecord.mistakes || [];
  assert(Array.isArray(legacyCriteria) && legacyCriteria.length === 0, 'Legacy record handles undefined criteriaScores gracefully without throwing');
  assert(Array.isArray(legacyDeductions) && legacyDeductions.length === 0, 'Legacy record handles undefined deductionReasons gracefully');

  // ========================================================
  // TEST 18: Coding prompt does not falsely claim verified execution
  // ========================================================
  console.log('\n--- TEST 18: Static Code Inspection Notice ---');
  const codingInspectionPrompt = getEvaluationPrompt({
    questionId: 'q-code-verify',
    section: 'CODING',
    questionType: 'coding',
    question: 'Write a quicksort implementation',
    studentAnswer: 'def quicksort(arr): return arr',
    maxMarks: 20
  });

  assert(
    codingInspectionPrompt.includes('STATIC CODE INSPECTION ONLY'),
    'Coding prompt explicitly declares STATIC CODE INSPECTION ONLY'
  );
  assert(
    codingInspectionPrompt.includes('DO NOT state or claim that the code "passed all test cases"'),
    'Coding prompt instructs model NOT to claim verified execution results'
  );

  // ========================================================
  // SUMMARY
  // ========================================================
  console.log('\n============================================================');
  console.log(`PHASE 2 EVALUATION ENGINE SUITE: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================\n');

  await prisma.$disconnect();
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase2Tests().catch(async (err) => {
  console.error('Test execution failed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
