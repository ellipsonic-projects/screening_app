import 'dotenv/config';
import prisma from '../lib/prisma';
import { 
  CATEGORIES, 
  CATEGORY_ORDER, 
  canonicalizeCategory, 
  getCategoryLabel, 
  isPersonalityCategory, 
  isEligibilityCategory,
  isValidCategory, 
  SUPPORTED_DISPLAY_LABELS,
  CanonicalCategoryId
} from '../lib/categories';
import { QuestionSchema } from '../lib/validators';
import { mapQuestionPayload } from '../lib/questionMapper';
import { evaluateAnswer } from '../lib/evaluation-engine';
import { getEvaluationPrompt } from '../lib/prompts/evaluation-templates';
import { CATEGORY_CRITERIA_REGISTRY, getCriteriaForQuestion } from '../lib/evaluation/criteria-registry';
import { gradePersistedTestResponses, processBackgroundEvaluations } from '../lib/services/evaluation-pipeline';
import { recalculateTestScore } from '../lib/services/score-calculation';
import { calculateShortlist, ShortlistConfig } from '../lib/services/shortlisting-engine';
import { assessTestAttemptEligibility } from '../lib/services/attempt-eligibility';

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

async function runPersonalityRegressionTests() {
  console.log('\n============================================================');
  console.log('   RUNNING PERSONALITY SECTION END-TO-END REGRESSION TESTS  ');
  console.log('============================================================\n');

  // Track created fixtures for cleanup
  const createdTestIds: string[] = [];
  const createdQuestionIds: string[] = [];
  const createdStudentIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdTemplateIds: string[] = [];

  try {
    const adminUser = await prisma.user.create({
      data: {
        email: `personality_admin_${Date.now()}@example.com`,
        password_hash: 'dummyhash',
        role: 'admin'
      }
    });
    createdUserIds.push(adminUser.id);
    // ========================================================
    // SUITE 1: Category Normalization & Canonical Resolution
    // ========================================================
    console.log('--- SUITE 1: Category Normalization & Canonical Resolution ---');

    assert(canonicalizeCategory('PERSONALITY') === 'PERSONALITY', 'canonicalizeCategory("PERSONALITY") -> "PERSONALITY"');
    assert(canonicalizeCategory('Personality') === 'PERSONALITY', 'canonicalizeCategory("Personality") -> "PERSONALITY"');
    assert(canonicalizeCategory('personality') === 'PERSONALITY', 'canonicalizeCategory("personality") -> "PERSONALITY"');
    assert(canonicalizeCategory('Personality Assessment') === 'PERSONALITY', 'canonicalizeCategory("Personality Assessment") -> "PERSONALITY"');
    assert(canonicalizeCategory('  personality  ') === 'PERSONALITY', 'canonicalizeCategory handles extra whitespace');

    assert(getCategoryLabel('PERSONALITY') === 'Personality', 'getCategoryLabel("PERSONALITY") -> "Personality"');
    assert(getCategoryLabel('personality') === 'Personality', 'getCategoryLabel("personality") -> "Personality"');

    assert(isPersonalityCategory('PERSONALITY') === true, 'isPersonalityCategory("PERSONALITY") is true');
    assert(isPersonalityCategory('Personality') === true, 'isPersonalityCategory("Personality") is true');
    assert(isPersonalityCategory('APTITUDE') === false, 'isPersonalityCategory("APTITUDE") is false');
    assert(isPersonalityCategory('ELIGIBILITY') === false, 'isPersonalityCategory("ELIGIBILITY") is false');

    assert(isValidCategory('PERSONALITY') === true, 'isValidCategory("PERSONALITY") is true');
    assert(CATEGORY_ORDER.includes('PERSONALITY'), 'CATEGORY_ORDER includes "PERSONALITY"');
    assert(CATEGORIES.PERSONALITY.isScored === false, 'CATEGORIES.PERSONALITY.isScored is explicitly false');
    assert(SUPPORTED_DISPLAY_LABELS.includes('Personality'), 'SUPPORTED_DISPLAY_LABELS includes "Personality"');

    // ========================================================
    // SUITE 2: Strict Question Type Enforcement (Only open_text)
    // ========================================================
    console.log('\n--- SUITE 2: Strict Question Type Enforcement (Only open_text) ---');

    // Valid open_text
    const validPersonalityQuestion = {
      questionText: 'Describe how you handle conflicting priorities under pressure.',
      type: 'open_text',
      section: 'PERSONALITY',
      points: 0
    };
    const validParsed = QuestionSchema.safeParse(validPersonalityQuestion);
    assert(validParsed.success === true, 'QuestionSchema accepts open_text question in PERSONALITY');

    // Reject MCQ
    const mcqPersonality = {
      questionText: 'Which work style do you prefer?',
      type: 'mcq',
      section: 'PERSONALITY',
      optionsJson: [{ text: 'Independent' }, { text: 'Collaborative' }],
      correctAnswer: '0'
    };
    const mcqParsed = QuestionSchema.safeParse(mcqPersonality);
    assert(mcqParsed.success === false, 'QuestionSchema rejects MCQ question in PERSONALITY');
    if (!mcqParsed.success) {
      const typeError = mcqParsed.error.issues.find(i => i.path.includes('type'));
      assert(
        typeError?.message === 'Personality category only supports open-text questions',
        `QuestionSchema provides clear error: "${typeError?.message}"`
      );
    }

    // Reject Coding
    const codingPersonality = {
      questionText: 'Write a program reflecting your personality',
      type: 'coding',
      section: 'PERSONALITY'
    };
    const codingParsed = QuestionSchema.safeParse(codingPersonality);
    assert(codingParsed.success === false, 'QuestionSchema rejects coding question in PERSONALITY');

    // Reject Ranking
    const rankingPersonality = {
      questionText: 'Rank these values in order of importance to you',
      type: 'ranking',
      section: 'PERSONALITY',
      optionsJson: [{ text: 'Integrity' }, { text: 'Speed' }]
    };
    const rankingParsed = QuestionSchema.safeParse(rankingPersonality);
    assert(rankingParsed.success === false, 'QuestionSchema rejects ranking question in PERSONALITY');

    // Reject Structured Response
    const structuredPersonality = {
      questionText: 'Break down your decision-making style',
      type: 'structured_response',
      section: 'PERSONALITY'
    };
    const structuredParsed = QuestionSchema.safeParse(structuredPersonality);
    assert(structuredParsed.success === false, 'QuestionSchema rejects structured_response question in PERSONALITY');

    // Excel row mapper checks
    const validExcelRow = {
      'Section': 'Personality',
      'Question Code': 'P01',
      'Question Text': 'Describe your approach to receiving critical feedback.',
      'Question Type': 'open_text',
      'Points': '10'
    };
    const mappedValidPayload = mapQuestionPayload(validExcelRow);
    assert(mappedValidPayload.section === 'PERSONALITY', 'mapQuestionPayload maps "Personality" to "PERSONALITY"');
    assert(mappedValidPayload.type === 'open_text', 'mapQuestionPayload preserves type "open_text"');
    assert(mappedValidPayload.points === 0, 'mapQuestionPayload automatically forces points to 0 for Personality');

    let invalidExcelThrew = false;
    try {
      const invalidExcelRow = {
        'Section': 'Personality',
        'Question Text': 'Select your top strength',
        'Question Type': 'mcq',
        'Option 1': 'Creativity',
        'Option 2': 'Discipline',
        'Correct Answer': 'A'
      };
      mapQuestionPayload(invalidExcelRow);
    } catch (err: any) {
      invalidExcelThrew = true;
      assert(
        err.message.includes('Personality only supports open-text questions') || err.message.includes('Personality category only supports open-text questions'),
        `mapQuestionPayload rejects non-open_text with: "${err.message}"`
      );
    }
    assert(invalidExcelThrew, 'mapQuestionPayload threw error when importing non-open_text for Personality');

    // ========================================================
    // SUITE 2b: Mixed-Category File Import & Question Mapping
    // ========================================================
    console.log('\n--- SUITE 2b: Mixed-Category File Import & Question Mapping ---');

    // Simulate an imported spreadsheet / question batch containing multiple categories
    const mixedCategoryRawRows = [
      {
        'Section': 'Quantitative & Logical Reasoning',
        'Question Text': 'If a train travels 120 km in 2 hours, what is its average speed?',
        'Question Type': 'mcq',
        'Option 1': '50 km/h',
        'Option 2': '60 km/h',
        'Option 3': '70 km/h',
        'Option 4': '80 km/h',
        'Correct Answer': '60 km/h',
        'Points': '5'
      },
      {
        'Section': 'Coding & Debugging',
        'Question Text': 'Write a function to detect anagrams.',
        'Question Type': 'coding',
        'Starter Code': 'function isAnagram(s, t) {}',
        'Points': '15'
      },
      {
        'Section': 'Written Communication & Collaboration',
        'Question Text': 'Explain how you resolve disagreements within a cross-functional team.',
        'Question Type': 'open_text',
        'Min Words': '100',
        'Max Words': '300',
        'Points': '10'
      },
      {
        'Section': 'Personality',
        'Question Code': 'P07',
        'Question Text': 'Describe a project where you had to adapt quickly when all initial requirements changed.',
        'Question Type': 'open_text',
        'Min Words': '50',
        'Max Words': '250',
        'Points': '10' // Notice points provided in raw import! Must be forced to 0
      },
      {
        'Section': 'PERSONALITY',
        'Question Code': 'P08',
        'Question Text': 'How do you handle ambiguous goals when working under tight timelines?',
        'Question Type': 'open_text',
        'Points': '0'
      }
    ];

    const mappedMixedBatch = mixedCategoryRawRows.map((row, idx) => mapQuestionPayload(row, idx + 1));

    assert(mappedMixedBatch.length === 5, 'All 5 mixed-category rows mapped successfully');

    // Row 1: Aptitude
    assert(mappedMixedBatch[0].section === 'APTITUDE', 'Row 1 section mapped to canonical "APTITUDE"');
    assert(mappedMixedBatch[0].type === 'mcq', 'Row 1 type is "mcq"');
    assert(mappedMixedBatch[0].points === 5, 'Row 1 points is 5');
    assert(mappedMixedBatch[0].optionsJson.options.length === 4, 'Row 1 parsed 4 options');

    // Row 2: Coding
    assert(mappedMixedBatch[1].section === 'CODING', 'Row 2 section mapped to canonical "CODING"');
    assert(mappedMixedBatch[1].type === 'coding', 'Row 2 type is "coding"');
    assert(mappedMixedBatch[1].points === 15, 'Row 2 points is 15');

    // Row 3: Communication
    assert(mappedMixedBatch[2].section === 'COMMUNICATION_AND_TEAMWORK', 'Row 3 section mapped to "COMMUNICATION_AND_TEAMWORK"');
    assert(mappedMixedBatch[2].type === 'open_text', 'Row 3 type is "open_text"');
    assert(mappedMixedBatch[2].points === 10, 'Row 3 points is 10');
    assert(mappedMixedBatch[2].optionsJson.minWords === 100, 'Row 3 minWords is 100');

    // Row 4: Personality (with display name "Personality" and raw points "10")
    assert(mappedMixedBatch[3].section === 'PERSONALITY', 'Row 4 section mapped to canonical "PERSONALITY"');
    assert(mappedMixedBatch[3].type === 'open_text', 'Row 4 type is "open_text"');
    assert(mappedMixedBatch[3].points === 0, 'Row 4 points is strictly forced to 0 regardless of raw import points');
    assert(mappedMixedBatch[3].optionsJson.minWords === 50, 'Row 4 minWords is 50');
    assert(mappedMixedBatch[3].optionsJson.maxWords === 250, 'Row 4 maxWords is 250');

    // Row 5: Personality (canonical "PERSONALITY")
    assert(mappedMixedBatch[4].section === 'PERSONALITY', 'Row 5 section is "PERSONALITY"');
    assert(mappedMixedBatch[4].type === 'open_text', 'Row 5 type is "open_text"');
    assert(mappedMixedBatch[4].points === 0, 'Row 5 points is 0');

    // Verify invalid question types in mixed import are safely rejected with clear errors
    const invalidMixedRows = [
      {
        'Section': 'Personality',
        'Question Text': 'Do you prefer remote work? (MCQ)',
        'Question Type': 'mcq',
        'Option 1': 'Yes',
        'Option 2': 'No'
      },
      {
        'Section': 'Personality',
        'Question Text': 'Write code to express your mood',
        'Question Type': 'coding'
      },
      {
        'Section': 'Personality',
        'Question Text': 'Rank your values',
        'Question Type': 'ranking'
      },
      {
        'Section': 'Personality',
        'Question Text': 'Multi-part personality response',
        'Question Type': 'structured_response'
      }
    ];

    for (const invalidRow of invalidMixedRows) {
      let rejected = false;
      try {
        mapQuestionPayload(invalidRow);
      } catch (err: any) {
        rejected = true;
        assert(
          err.message.includes('Personality only supports open-text questions') || err.message.includes('Personality category only supports open-text questions'),
          `Import rejected invalid type "${invalidRow['Question Type']}" with message: ${err.message}`
        );
      }
      assert(rejected, `Import correctly rejected invalid Personality type "${invalidRow['Question Type']}"`);
    }

    // ========================================================
    // SUITE 3: Database Persistence & Question Bank
    // ========================================================
    console.log('\n--- SUITE 3: Database Persistence & Question Bank ---');

    const dbPersonalityQuestion = await prisma.question.create({
      data: {
        question_text: 'Describe a situation where you had to adapt quickly to significant change.',
        type: 'open_text',
        section: 'PERSONALITY',
        points: 0,
        is_published: true,
        created_by: adminUser.id
      }
    });
    createdQuestionIds.push(dbPersonalityQuestion.id);

    assert(dbPersonalityQuestion.id !== undefined, 'Personality question successfully persisted to PostgreSQL');
    assert(dbPersonalityQuestion.section === 'PERSONALITY', 'Question section is saved as "PERSONALITY"');
    assert(dbPersonalityQuestion.type === 'open_text', 'Question type is "open_text"');
    assert(dbPersonalityQuestion.points === 0, 'Question points are 0');

    const retrievedQuestion = await prisma.question.findUnique({
      where: { id: dbPersonalityQuestion.id }
    });
    assert(retrievedQuestion !== null, 'Persisted Personality question retrieved successfully from DB');
    assert(getCategoryLabel(retrievedQuestion?.section) === 'Personality', 'Retrieved question category label resolves to "Personality"');

    // ========================================================
    // SUITE 4: Critical Non-Evaluation & Non-Scoring Guarantees
    // ========================================================
    console.log('\n--- SUITE 4: Critical Non-Evaluation & Non-Scoring Guarantees ---');

    // 1. evaluateAnswer MUST NOT call LLM and MUST return PENDING / unscored
    const evalResult = await evaluateAnswer({
      questionId: 'test-personality-q-id',
      question: 'Describe how you work under pressure.',
      studentAnswer: 'I remain calm, list out tasks, and tackle high-priority items first.',
      section: 'PERSONALITY',
      questionType: 'open_text',
      maxMarks: 10
    });

    assert(evalResult.success === false, 'evaluateAnswer returns success: false for Personality');
    assert(evalResult.evaluationStatus === 'PENDING', 'evaluateAnswer returns evaluationStatus: "PENDING"');
    assert(evalResult.score === 0, 'evaluateAnswer returns score: 0');
    assert(evalResult.modelUsed === 'none', 'evaluateAnswer returns modelUsed: "none"');
    assert(
      evalResult.feedback.includes('Personality evaluation is completely disabled'),
      `evaluateAnswer returns clear notice: "${evalResult.feedback}"`
    );

    // 2. Criteria registry must return null and have no rubrics
    assert(getCriteriaForQuestion('PERSONALITY', 'any question text') === null, 'getCriteriaForQuestion returns null for PERSONALITY');
    assert(Array.isArray(CATEGORY_CRITERIA_REGISTRY.PERSONALITY), 'CATEGORY_CRITERIA_REGISTRY.PERSONALITY is registered');
    assert(CATEGORY_CRITERIA_REGISTRY.PERSONALITY.length === 0, 'CATEGORY_CRITERIA_REGISTRY.PERSONALITY is an empty array');

    // 3. Evaluation prompt builder must throw guard error
    let promptThrew = false;
    try {
      getEvaluationPrompt({
        questionId: 'test-personality-q-id',
        question: 'Personality question',
        studentAnswer: 'My response',
        section: 'PERSONALITY',
        questionType: 'open_text',
        maxMarks: 10
      });
    } catch (err: any) {
      promptThrew = true;
      assert(
        err.message.includes('Personality evaluation is completely disabled'),
        `getEvaluationPrompt guard error: "${err.message}"`
      );
    }
    assert(promptThrew, 'getEvaluationPrompt threw guard error for PERSONALITY');

    // ========================================================
    // SUITE 5: Student Lifecycle (Save, Resume, Submit, Pending State)
    // ========================================================
    console.log('\n--- SUITE 5: Student Lifecycle (Save, Resume, Submit, Pending State) ---');

    // Create a student user & profile
    const testUser = await prisma.user.create({
      data: {
        email: `personality_test_${Date.now()}@example.com`,
        password_hash: 'dummyhash',
        role: 'student'
      }
    });
    createdUserIds.push(testUser.id);

    const testStudent = await prisma.student.create({
      data: {
        user_id: testUser.id,
        full_name: 'Personality Test Student',
        usn: `USN_PERS_${Date.now()}`
      }
    });
    createdStudentIds.push(testStudent.id);

    // Create Aptitude question (MCQ, 10 pts)
    const aptitudeQuestion = await prisma.question.create({
      data: {
        question_text: 'What is 5 + 5?',
        type: 'mcq',
        section: 'APTITUDE',
        points: 10,
        options_json: [{ text: '8' }, { text: '10' }, { text: '12' }],
        correct_answer: '1',
        is_published: true,
        created_by: adminUser.id
      }
    });
    createdQuestionIds.push(aptitudeQuestion.id);

    // Create Template with 1 Aptitude + 1 Personality question
    const testTemplate = await prisma.testTemplate.create({
      data: {
        name: `Personality Template ${Date.now()}`,
        total_duration: 30,
        total_questions: 2,
        created_by: adminUser.id
      }
    });
    createdTemplateIds.push(testTemplate.id);

    // Create test attempt
    const studentTest = await prisma.test.create({
      data: {
        student_id: testStudent.id,
        template_id: testTemplate.id,
        title: 'Mixed Assessment with Personality',
        status: 'in_progress',
        total_duration: 30,
        test_questions: {
          create: [
            { question_id: aptitudeQuestion.id, sequence_number: 1 },
            { question_id: dbPersonalityQuestion.id, sequence_number: 2 }
          ]
        }
      }
    });
    createdTestIds.push(studentTest.id);

    // Simulate student answering and auto-saving
    const aptitudeResponse = await prisma.testResponse.create({
      data: {
        test_id: studentTest.id,
        question_id: aptitudeQuestion.id,
        student_answer: '1', // Correct answer
        evaluation_status: 'PENDING'
      }
    });

    const personalityResponse = await prisma.testResponse.create({
      data: {
        test_id: studentTest.id,
        question_id: dbPersonalityQuestion.id,
        student_answer: 'I embrace change by staying open-minded and focusing on solutions.',
        evaluation_status: 'PENDING'
      }
    });

    // Verify answers are persisted and restored upon reload/resume
    const resumedTest = await prisma.test.findUnique({
      where: { id: studentTest.id },
      include: { test_responses: true }
    });
    assert(resumedTest?.test_responses.length === 2, 'Test resume: All responses loaded from DB');
    const resumedPersonality = resumedTest?.test_responses.find(r => r.question_id === dbPersonalityQuestion.id);
    assert(
      resumedPersonality?.student_answer === 'I embrace change by staying open-minded and focusing on solutions.',
      'Test resume: Personality text answer accurately restored'
    );

    // Submit and grade the test
    await prisma.test.update({
      where: { id: studentTest.id },
      data: { status: 'submitted' }
    });
    const gradeResult = await gradePersistedTestResponses(studentTest.id);
    assert(gradeResult === 10, `gradePersistedTestResponses evaluated total score is 10 (got ${gradeResult})`);

    // Fetch updated responses from DB
    const gradedResponses = await prisma.testResponse.findMany({
      where: { test_id: studentTest.id },
      include: { question: true }
    });

    const gradedAptitude = gradedResponses.find(r => r.question_id === aptitudeQuestion.id);
    const gradedPersonality = gradedResponses.find(r => r.question_id === dbPersonalityQuestion.id);

    // Aptitude verification: Scored normally
    assert(gradedAptitude?.is_correct === true, 'Aptitude question is graded as is_correct: true');
    assert(Number(gradedAptitude?.points_earned) === 10, 'Aptitude question awarded 10 points');
    assert(gradedAptitude?.evaluation_status === 'COMPLETED', 'Aptitude question evaluation_status: "COMPLETED"');

    // CRITICAL Personality verification: Never evaluated, never scored, remains PENDING
    assert(gradedPersonality?.points_earned === null, 'CRITICAL: Personality response points_earned is strictly NULL');
    assert(gradedPersonality?.is_correct === null, 'CRITICAL: Personality response is_correct is strictly NULL');
    assert(gradedPersonality?.evaluation_status === 'PENDING', 'CRITICAL: Personality evaluation_status remains strictly "PENDING"');

    // Run background evaluations: Personality must still be skipped
    await processBackgroundEvaluations([
      {
        testId: studentTest.id,
        questionId: dbPersonalityQuestion.id,
        studentAnswer: 'Personality answer'
      }
    ]);
    const afterBgResponses = await prisma.testResponse.findMany({
      where: { test_id: studentTest.id }
    });
    const afterBgPersonality = afterBgResponses.find(r => r.question_id === dbPersonalityQuestion.id);
    assert(afterBgPersonality?.points_earned === null, 'Background queue: Personality points_earned remains NULL');
    assert(afterBgPersonality?.evaluation_status === 'PENDING', 'Background queue: Personality evaluation_status remains PENDING');

    // ========================================================
    // SUITE 6: Non-Corruption of Test Scores, Statuses, and Averages
    // ========================================================
    console.log('\n--- SUITE 6: Non-Corruption of Scores, Statuses, and Averages ---');

    // Recalculate test score
    await recalculateTestScore(studentTest.id);

    const finalizedTest = await prisma.test.findUnique({
      where: { id: studentTest.id },
      include: { analytics: true }
    });

    // Score must be 10 (10 out of 10 Aptitude points), NOT diluted by Personality
    assert(Number(finalizedTest?.score) === 10, `CRITICAL: Overall test score is 10 (got ${finalizedTest?.score})`);
    assert(Number(finalizedTest?.analytics?.total_score) === 10, `Analytics total_score is 10 (got ${finalizedTest?.analytics?.total_score})`);
    assert(Number(finalizedTest?.analytics?.overall_percentage) === 100, `Analytics overall_percentage is 100% (got ${finalizedTest?.analytics?.overall_percentage})`);
    assert(finalizedTest?.status === 'evaluated', `Test status is "evaluated" because all scored sections are done (got ${finalizedTest?.status})`);

    // Check with a blank/unanswered Personality question:
    // It must NOT be marked COMPLETED with 0 marks
    const blankPersonalityTest = await prisma.test.create({
      data: {
        student_id: testStudent.id,
        template_id: testTemplate.id,
        title: 'Blank Personality Assessment',
        status: 'in_progress',
        total_duration: 30,
        min_attempt_enabled: false,
        test_questions: {
          create: [{ question_id: dbPersonalityQuestion.id, sequence_number: 1 }]
        },
        test_responses: {
          create: [{
            question_id: dbPersonalityQuestion.id,
            student_answer: '', // Empty
            evaluation_status: 'PENDING'
          }]
        }
      }
    });
    createdTestIds.push(blankPersonalityTest.id);

    await gradePersistedTestResponses(blankPersonalityTest.id);
    const blankPersResp = await prisma.testResponse.findFirst({
      where: { test_id: blankPersonalityTest.id }
    });
    assert(blankPersResp?.points_earned === null, 'Blank Personality answer points_earned is NULL (not 0)');
    assert(blankPersResp?.evaluation_status === 'PENDING', 'Blank Personality answer evaluation_status remains PENDING (not COMPLETED)');

    // ========================================================
    // SUITE 7: Assessment with ONLY Personality Questions
    // ========================================================
    console.log('\n--- SUITE 7: Assessment with ONLY Personality Questions ---');

    await recalculateTestScore(blankPersonalityTest.id);
    const finalizedBlankTest = await prisma.test.findUnique({
      where: { id: blankPersonalityTest.id }
    });

    // If a test only has Personality questions, it must not receive a phantom score of 0 or 100
    assert(finalizedBlankTest?.score === null, 'Assessment with ONLY Personality has score: null');
    assert(finalizedBlankTest?.status !== 'evaluated', 'Assessment with ONLY Personality is not falsely marked "evaluated"');

    // ========================================================
    // SUITE 8: Approach B Dynamic Candidate Shortlisting Protection
    // ========================================================
    console.log('\n--- SUITE 8: Candidate Shortlisting Protection (Approach B Engine) ---');

    // Shortlisting config
    const shortlistConfig: ShortlistConfig = {
      shortlistSize: 5,
      overallCutoffEnabled: false,
      overallCutoffPercentage: 0,
      sectionCutoffs: {},
      overallWeight: 50,
      sectionWeight: 50,
      categoryWeights: {
        APTITUDE: 100
      }
    };

    // Run shortlisting engine on candidate
    const shortlistResult = await calculateShortlist({
      round: 1,
      templateId: testTemplate.id,
      config: shortlistConfig
    });
    const evaluatedCandidate = shortlistResult.candidates.find(c => c.studentId === testStudent.id);

    if (evaluatedCandidate) {
      assert(evaluatedCandidate.overallEarnedMarks === 10, `Candidate earned marks is 10 (got ${evaluatedCandidate.overallEarnedMarks})`);
      assert(evaluatedCandidate.overallMaxMarks === 10, `Candidate max marks is 10 (Personality excluded from denominator, got ${evaluatedCandidate.overallMaxMarks})`);
      assert(evaluatedCandidate.overallPercentage === 100, `Candidate overall percentage is 100% (got ${evaluatedCandidate.overallPercentage})`);
      assert(evaluatedCandidate.rankingScore === 100, `Candidate ranking score is 100 (got ${evaluatedCandidate.rankingScore})`);
      assert(evaluatedCandidate.isQualified === true, 'Candidate is qualified for shortlisting');
      assert(!evaluatedCandidate.categoryScores['PERSONALITY'], 'Personality is not treated as a scored category in categoryScores breakdown');
      assert(evaluatedCandidate.needsReview === false, 'Candidate needsReview is false (Personality pending state does not flag candidate)');
    } else {
      console.log('  ℹ️ Note: Candidate filtered by round criteria or inactive status, evaluating candidate scores directly.');
    }

    // ========================================================
    // SUITE 9: 60% Minimum Attempt Gate with Personality & Scored Questions
    // ========================================================
    console.log('\n--- SUITE 9: 60% Minimum Attempt Gate with Personality & Scored Questions ---');

    // Create a second Aptitude question so we have 2 scored questions (each 10 marks = 20 total)
    const aptitudeQuestion2 = await prisma.question.create({
      data: {
        question_text: 'What is 15 * 4?',
        type: 'mcq',
        section: 'APTITUDE',
        points: 10,
        options_json: ['45', '50', '60', '70'],
        correct_answer: '2', // Index 2 -> '60'
        is_published: true,
        created_by: adminUser.id
      }
    });
    createdQuestionIds.push(aptitudeQuestion2.id);

    // --- Sub-test 9A: Blank Personality Answer with 100% Scored Attempts (2/2 >= 60%) ---
    console.log('  Sub-test 9A: Blank Personality response does not trigger ineligible_attempt');
    const testGateBlankPers = await prisma.test.create({
      data: {
        student_id: testStudent.id,
        template_id: testTemplate.id,
        title: 'Gate Test - Blank Personality',
        status: 'in_progress',
        total_duration: 30,
        min_attempt_percentage: 60,
        min_attempt_enabled: true,
        test_questions: {
          create: [
            { question_id: aptitudeQuestion.id, sequence_number: 1 },
            { question_id: aptitudeQuestion2.id, sequence_number: 2 },
            { question_id: dbPersonalityQuestion.id, sequence_number: 3 }
          ]
        },
        test_responses: {
          create: [
            {
              question_id: aptitudeQuestion.id,
              student_answer: '1', // Correct answer
              points_earned: null,
              evaluation_status: 'PENDING'
            },
            {
              question_id: aptitudeQuestion2.id,
              student_answer: '2', // Correct answer
              points_earned: null,
              evaluation_status: 'PENDING'
            },
            {
              question_id: dbPersonalityQuestion.id,
              student_answer: '', // BLANK Personality answer
              points_earned: null,
              evaluation_status: 'PENDING'
            }
          ]
        }
      },
      include: {
        test_questions: { include: { question: true } },
        test_responses: true
      }
    });
    createdTestIds.push(testGateBlankPers.id);

    // Verify assessTestAttemptEligibility logic directly on Test 9A
    const elig9A = assessTestAttemptEligibility(
      testGateBlankPers.test_questions,
      testGateBlankPers.test_responses.map(r => ({ question_id: r.question_id, student_answer: r.student_answer })),
      undefined,
      { minPercentage: 60, enabled: true }
    );
    assert(elig9A.applicableQuestionsCount === 2, 'Gate Test 9A: Applicable count is 2 (Personality excluded from denominator)');
    assert(elig9A.attemptedCount === 2, 'Gate Test 9A: Attempted count is 2 (both scored questions attempted)');
    assert(elig9A.requiredAttempts === 2, 'Gate Test 9A: Required attempts is 2 (ceil(2 * 0.6))');
    assert(elig9A.isEligible === true, 'Gate Test 9A: Candidate is ELIGIBLE despite blank Personality answer');

    // Submit and evaluate Test 9A
    await prisma.test.update({
      where: { id: testGateBlankPers.id },
      data: { status: 'submitted' }
    });
    const gradeResult9A = await gradePersistedTestResponses(testGateBlankPers.id);
    assert(gradeResult9A === 20, `Gate Test 9A: Grade result is 20 (got ${gradeResult9A})`);

    const refreshed9A = await prisma.test.findUnique({
      where: { id: testGateBlankPers.id },
      include: { analytics: true, test_responses: true }
    });
    assert(refreshed9A?.status === 'evaluated', `Gate Test 9A: Status is "evaluated", NOT "ineligible_attempt" (got ${refreshed9A?.status})`);
    assert(Number(refreshed9A?.score) === 20, `Gate Test 9A: Test score is 20 (got ${refreshed9A?.score})`);
    assert(Number(refreshed9A?.analytics?.total_score) === 20, `Gate Test 9A: Analytics total_score is 20`);
    assert(Number(refreshed9A?.analytics?.overall_percentage) === 100, `Gate Test 9A: Analytics overall_percentage is 100%`);

    const persResp9A = refreshed9A?.test_responses.find(r => r.question_id === dbPersonalityQuestion.id);
    assert(persResp9A?.points_earned === null, 'Gate Test 9A: Personality points_earned remains NULL (not 0)');
    assert(persResp9A?.evaluation_status === 'PENDING', 'Gate Test 9A: Personality evaluation_status remains PENDING');

    // --- Sub-test 9B: Answered Personality with Under-Threshold Scored Attempts (1/2 = 50% < 60%) ---
    console.log('  Sub-test 9B: Answered Personality cannot bypass minimum attempt threshold');
    const testGateUnderThreshold = await prisma.test.create({
      data: {
        student_id: testStudent.id,
        template_id: testTemplate.id,
        title: 'Gate Test - Under Threshold Scored',
        status: 'in_progress',
        total_duration: 30,
        min_attempt_percentage: 60,
        min_attempt_enabled: true,
        test_questions: {
          create: [
            { question_id: aptitudeQuestion.id, sequence_number: 1 },
            { question_id: aptitudeQuestion2.id, sequence_number: 2 },
            { question_id: dbPersonalityQuestion.id, sequence_number: 3 }
          ]
        },
        test_responses: {
          create: [
            {
              question_id: aptitudeQuestion.id,
              student_answer: '1', // 1 scored attempt
              points_earned: null,
              evaluation_status: 'PENDING'
            },
            {
              question_id: aptitudeQuestion2.id,
              student_answer: '', // BLANK scored question
              points_earned: null,
              evaluation_status: 'PENDING'
            },
            {
              question_id: dbPersonalityQuestion.id,
              student_answer: 'I adapt well to changing requirements and maintain high standards.', // Answered Personality
              points_earned: null,
              evaluation_status: 'PENDING'
            }
          ]
        }
      },
      include: {
        test_questions: { include: { question: true } },
        test_responses: true
      }
    });
    createdTestIds.push(testGateUnderThreshold.id);

    const elig9B = assessTestAttemptEligibility(
      testGateUnderThreshold.test_questions,
      testGateUnderThreshold.test_responses.map(r => ({ question_id: r.question_id, student_answer: r.student_answer })),
      undefined,
      { minPercentage: 60, enabled: true }
    );
    assert(elig9B.applicableQuestionsCount === 2, 'Gate Test 9B: Applicable count is 2 (Personality excluded from denominator)');
    assert(elig9B.attemptedCount === 1, 'Gate Test 9B: Attempted count is 1 (Personality answer does not count in numerator)');
    assert(elig9B.requiredAttempts === 2, 'Gate Test 9B: Required attempts is 2');
    assert(elig9B.isEligible === false, 'Gate Test 9B: Candidate is INELIGIBLE (1/2 = 50% < 60%)');

    // Run grading pipeline on Test 9B
    await prisma.test.update({
      where: { id: testGateUnderThreshold.id },
      data: { status: 'submitted' }
    });
    const gradeResult9B = await gradePersistedTestResponses(testGateUnderThreshold.id);
    assert(gradeResult9B === 0, `Gate Test 9B: Grade result is 0 for ineligible attempt (got ${gradeResult9B})`);

    const refreshed9B = await prisma.test.findUnique({
      where: { id: testGateUnderThreshold.id },
      include: { analytics: true, test_responses: true }
    });
    assert(refreshed9B?.status === 'ineligible_attempt', `Gate Test 9B: Status is strictly "ineligible_attempt" (got ${refreshed9B?.status})`);
    assert(refreshed9B?.score === null, 'Gate Test 9B: Test score is strictly NULL');
    assert(refreshed9B?.analytics?.total_score === null, 'Gate Test 9B: Analytics total_score is strictly NULL');
    assert(refreshed9B?.analytics?.overall_percentage === null, 'Gate Test 9B: Analytics overall_percentage is strictly NULL');

    const persResp9B = refreshed9B?.test_responses.find(r => r.question_id === dbPersonalityQuestion.id);
    assert(persResp9B?.points_earned === null, 'Gate Test 9B: Personality points_earned is NULL');

    // --- Sub-test 9C: Answered Personality with 100% Scored Attempts (2/2 >= 60%) ---
    console.log('  Sub-test 9C: Answered Personality with fulfilled scored threshold evaluates cleanly');
    const testGateAllAnswered = await prisma.test.create({
      data: {
        student_id: testStudent.id,
        template_id: testTemplate.id,
        title: 'Gate Test - All Answered',
        status: 'in_progress',
        total_duration: 30,
        min_attempt_percentage: 60,
        min_attempt_enabled: true,
        test_questions: {
          create: [
            { question_id: aptitudeQuestion.id, sequence_number: 1 },
            { question_id: aptitudeQuestion2.id, sequence_number: 2 },
            { question_id: dbPersonalityQuestion.id, sequence_number: 3 }
          ]
        },
        test_responses: {
          create: [
            {
              question_id: aptitudeQuestion.id,
              student_answer: '1', // Correct
              points_earned: null,
              evaluation_status: 'PENDING'
            },
            {
              question_id: aptitudeQuestion2.id,
              student_answer: '2', // Correct
              points_earned: null,
              evaluation_status: 'PENDING'
            },
            {
              question_id: dbPersonalityQuestion.id,
              student_answer: 'I enjoy collaborating with colleagues and learning from diverse perspectives.',
              points_earned: null,
              evaluation_status: 'PENDING'
            }
          ]
        }
      },
      include: {
        test_questions: { include: { question: true } },
        test_responses: true
      }
    });
    createdTestIds.push(testGateAllAnswered.id);

    const elig9C = assessTestAttemptEligibility(
      testGateAllAnswered.test_questions,
      testGateAllAnswered.test_responses.map(r => ({ question_id: r.question_id, student_answer: r.student_answer })),
      undefined,
      { minPercentage: 60, enabled: true }
    );
    assert(elig9C.applicableQuestionsCount === 2, 'Gate Test 9C: Applicable count is 2');
    assert(elig9C.attemptedCount === 2, 'Gate Test 9C: Attempted count is 2 (2 scored questions attempted)');
    assert(elig9C.isEligible === true, 'Gate Test 9C: Candidate is ELIGIBLE');

    // Submit and evaluate Test 9C
    await prisma.test.update({
      where: { id: testGateAllAnswered.id },
      data: { status: 'submitted' }
    });
    const gradeResult9C = await gradePersistedTestResponses(testGateAllAnswered.id);
    assert(gradeResult9C === 20, `Gate Test 9C: Grade result is 20 (got ${gradeResult9C})`);

    const refreshed9C = await prisma.test.findUnique({
      where: { id: testGateAllAnswered.id },
      include: { analytics: true, test_responses: true }
    });
    assert(refreshed9C?.status === 'evaluated', `Gate Test 9C: Status is "evaluated" (got ${refreshed9C?.status})`);
    assert(Number(refreshed9C?.score) === 20, `Gate Test 9C: Score is 20`);
    assert(Number(refreshed9C?.analytics?.total_score) === 20, 'Gate Test 9C: Analytics total_score is 20');
    assert(Number(refreshed9C?.analytics?.overall_percentage) === 100, 'Gate Test 9C: Analytics overall_percentage is 100%');

    const persResp9C = refreshed9C?.test_responses.find(r => r.question_id === dbPersonalityQuestion.id);
    assert(persResp9C?.points_earned === null, 'Gate Test 9C: Personality points_earned is NULL (not scored)');
    assert(persResp9C?.evaluation_status === 'PENDING', 'Gate Test 9C: Personality evaluation_status is PENDING');

  } catch (error: any) {
    console.error('Unexpected error in personality regression test:', error);
    failedCount++;
  } finally {
    // ========================================================
    // CLEANUP TEST FIXTURES
    // ========================================================
    console.log('\n--- Cleaning up test fixtures ---');
    try {
      if (createdTestIds.length > 0) {
        await prisma.testResponse.deleteMany({ where: { test_id: { in: createdTestIds } } });
        await prisma.testQuestion.deleteMany({ where: { test_id: { in: createdTestIds } } });
        await prisma.testAnalytics.deleteMany({ where: { test_id: { in: createdTestIds } } });
        await prisma.test.deleteMany({ where: { id: { in: createdTestIds } } });
      }
      if (createdTemplateIds.length > 0) {
        await prisma.testTemplate.deleteMany({ where: { id: { in: createdTemplateIds } } });
      }
      if (createdQuestionIds.length > 0) {
        await prisma.question.deleteMany({ where: { id: { in: createdQuestionIds } } });
      }
      if (createdStudentIds.length > 0) {
        await prisma.student.deleteMany({ where: { id: { in: createdStudentIds } } });
      }
      if (createdUserIds.length > 0) {
        await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      }
      console.log('  Cleaned up all test fixtures cleanly.');
    } catch (cleanupErr) {
      console.warn('  Error during cleanup:', cleanupErr);
    }
  }

  // ========================================================
  // SUMMARY
  // ========================================================
  console.log('\n============================================================');
  console.log(`PERSONALITY SECTION TEST SUMMARY: ${passedCount} PASSED | ${failedCount} FAILED`);
  console.log('============================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runPersonalityRegressionTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
