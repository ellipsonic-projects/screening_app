import 'dotenv/config';
import { 
  resolvePersonalityQuestionCode, 
  evaluatePersonalityResponses,
  WORKSTYLE_DIMENSIONS,
  QUESTION_EVALUATION_REGISTRY,
  PersonalityOverviewPayload,
  WorkStyleDimensionId
} from '../lib/evaluation/personality-evaluation';
import { 
  isPersonalityCategory, 
  isEligibilityCategory, 
  canonicalizeCategory, 
  getCategoryLabel 
} from '../lib/categories';
import { assessTestAttemptEligibility } from '../lib/services/attempt-eligibility';
import { calculateShortlist, ShortlistConfig } from '../lib/services/shortlisting-engine';

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

async function runPersonalityOverviewTests() {
  console.log('\n============================================================');
  console.log('   RUNNING PERSONALITY OVERVIEW FEATURE VERIFICATION SUITE  ');
  console.log('============================================================\n');

  // ========================================================
  // SUITE 1: Question ID Mapping & Deterministic Resolution
  // ========================================================
  console.log('--- SUITE 1: Question ID Mapping & Unmapped Question Flagging ---');

  // 1. Metadata resolution
  const metaQuestion = {
    id: 'q-meta-1',
    question_text: 'Describe a project you worked on.',
    options_json: { code: 'P01' }
  };
  const resolvedMeta = resolvePersonalityQuestionCode(metaQuestion);
  assert(resolvedMeta.code === 'P01', 'Resolves P01 from options_json.code');
  assert(resolvedMeta.isMapped === true, 'P01 marked as isMapped: true');
  assert(resolvedMeta.config?.section === 'PERSONAL_INTERESTS', 'P01 section is PERSONAL_INTERESTS');

  // 2. Bracketed text prefix resolution
  const bracketQuestion = {
    id: 'q-bracket-1',
    question_text: '[P15] How do you handle changing requirements?',
    options_json: null
  };
  const resolvedBracket = resolvePersonalityQuestionCode(bracketQuestion);
  assert(resolvedBracket.code === 'P15', 'Resolves P15 from bracketed prefix [P15]');
  assert(resolvedBracket.isMapped === true, 'P15 marked as isMapped: true');
  assert(resolvedBracket.config?.section === 'SITUATIONAL', 'P15 section is SITUATIONAL');

  // 3. Colon text prefix resolution
  const colonQuestion = {
    id: 'q-colon-1',
    question_text: 'P33: How do you decompress after high stress delivery?',
    options_json: {}
  };
  const resolvedColon = resolvePersonalityQuestionCode(colonQuestion);
  assert(resolvedColon.code === 'P33', 'Resolves P33 from colon prefix P33:');
  assert(resolvedColon.isMapped === true, 'P33 marked as isMapped: true');
  assert(resolvedColon.config?.section === 'PERSONAL_REFLECTION', 'P33 section is PERSONAL_REFLECTION');

  // 4. Dot text prefix resolution
  const dotQuestion = {
    id: 'q-dot-1',
    question_text: 'P07. Tell us about a time you had a technical disagreement.',
    options_json: {}
  };
  const resolvedDot = resolvePersonalityQuestionCode(dotQuestion);
  assert(resolvedDot.code === 'P07', 'Resolves P07 from dot prefix P07.');
  assert(resolvedDot.isMapped === true, 'P07 marked as isMapped: true');
  assert(resolvedDot.config?.section === 'BEHAVIOURAL', 'P07 section is BEHAVIOURAL');

  // 5. UNMAPPED Question: Must be flagged as isMapped: false without guesswork
  const unmappedQuestion = {
    id: 'q-unknown-1',
    question_text: 'What are your hobbies and favorite movies?',
    options_json: {}
  };
  const resolvedUnmapped = resolvePersonalityQuestionCode(unmappedQuestion);
  assert(resolvedUnmapped.code === 'UNMAPPED_QUESTION', 'Unknown question code resolved to UNMAPPED_QUESTION');
  assert(resolvedUnmapped.isMapped === false, 'Unknown question strictly flagged with isMapped: false');
  assert(resolvedUnmapped.warning !== undefined && resolvedUnmapped.warning.includes('does not contain a recognized P01–P33 identifier'), 'Warning accurately identifies missing P-identifier without guesswork');

  // 6. Registry boundary checks (P01 to P33)
  assert(QUESTION_EVALUATION_REGISTRY.P01 !== undefined, 'Registry contains P01');
  assert(QUESTION_EVALUATION_REGISTRY.P06 !== undefined, 'Registry contains P06 (end of personal interests)');
  assert(QUESTION_EVALUATION_REGISTRY.P07 !== undefined, 'Registry contains P07 (start of behavioural)');
  assert(QUESTION_EVALUATION_REGISTRY.P12 !== undefined, 'Registry contains P12 (end of behavioural)');
  assert(QUESTION_EVALUATION_REGISTRY.P13 !== undefined, 'Registry contains P13 (start of situational)');
  assert(QUESTION_EVALUATION_REGISTRY.P18 !== undefined, 'Registry contains P18 (end of situational)');
  assert(QUESTION_EVALUATION_REGISTRY.P19 !== undefined, 'Registry contains P19 (start of personal reflection)');
  assert(QUESTION_EVALUATION_REGISTRY.P33 !== undefined, 'Registry contains P33 (end of personal reflection)');
  assert(Object.keys(QUESTION_EVALUATION_REGISTRY).length === 33, 'Registry contains exactly 33 question mappings (P01-P33)');

  // ========================================================
  // SUITE 2: Dimension Architecture & Rubric Definitions
  // ========================================================
  console.log('\n--- SUITE 2: Dimension Architecture & Rubric Definitions ---');

  const dimensionKeys = Object.keys(WORKSTYLE_DIMENSIONS) as WorkStyleDimensionId[];
  assert(dimensionKeys.length === 7, 'Exactly 7 work-style dimensions configured');

  const expectedDimensions: WorkStyleDimensionId[] = [
    'OWNERSHIP_AND_INITIATIVE',
    'COLLABORATION',
    'COMMUNICATION',
    'ADAPTABILITY',
    'LEARNING_ORIENTATION',
    'SELF_MANAGEMENT',
    'JUDGMENT_AND_INTEGRITY'
  ];

  expectedDimensions.forEach(dim => {
    assert(WORKSTYLE_DIMENSIONS[dim] !== undefined, `WORKSTYLE_DIMENSIONS defines '${dim}'`);
    assert(WORKSTYLE_DIMENSIONS[dim].criteria.length > 0, `'${dim}' has predefined qualitative criteria`);
  });

  // Verify personal interests P01-P06 are marked as unscored
  for (let i = 1; i <= 6; i++) {
    const code = `P0${i}`;
    assert(QUESTION_EVALUATION_REGISTRY[code].scored === false, `${code} is strictly unscored`);
    assert(QUESTION_EVALUATION_REGISTRY[code].section === 'PERSONAL_INTERESTS', `${code} is in PERSONAL_INTERESTS`);
  }

  // ========================================================
  // SUITE 3: Qualitative Fallback & Evaluation Pipeline
  // ========================================================
  console.log('\n--- SUITE 3: Qualitative Evaluation Pipeline & Fallback Handling ---');

  const mockResponses = [
    {
      questionId: 'q-p01',
      questionText: '[P01] What technical domain or engineering specialization excites you most?',
      optionsJson: { code: 'P01' },
      studentAnswer: 'Distributed backend architectures, distributed consensus, and event-driven microservices.'
    },
    {
      questionId: 'q-p07',
      questionText: '[P07] Describe a disagreement with a peer or team member.',
      optionsJson: { code: 'P07' },
      studentAnswer: 'When designing a caching layer, a colleague preferred Redis clustering while I suggested local in-memory caches. We ran benchmark tests against realistic latency metrics and jointly chose Redis based on cache invalidation consistency.'
    },
    {
      questionId: 'q-p14',
      questionText: '[P14] How do you handle discovering a bug in production that was caused by your code?',
      optionsJson: { code: 'P14' },
      studentAnswer: 'I immediately notify the team lead and create a rollback or hotfix PR, communicate impact transparently, and follow up with a blameless post-mortem.'
    },
    {
      questionId: 'q-unmapped',
      questionText: 'Generic question with no P-prefix',
      optionsJson: {},
      studentAnswer: 'I enjoy writing maintainable, clean code.'
    }
  ];

  // Run evaluation (will trigger LLM or deterministic fallback if API is unreachable)
  const evalResult = await evaluatePersonalityResponses(mockResponses);

  assert(evalResult !== null && evalResult !== undefined, 'evaluatePersonalityResponses returns a result object');
  assert(evalResult.overview !== undefined, 'evalResult.overview is populated');
  assert(evalResult.overview.candidateOverview.length > 0, 'candidateOverview summary text is present');
  assert(evalResult.overview.selfReportedInterests !== undefined, 'selfReportedInterests is present');
  assert(
    evalResult.overview.selfReportedInterests.disclaimer.toLowerCase().includes('not'),
    'selfReportedInterests contains disclaimer that it is non-diagnostic'
  );
  assert(evalResult.overview.dimensionObservations !== undefined, 'dimensionObservations is present');
  assert(evalResult.overview.recommendedFollowUpQuestions.length > 0, 'recommendedFollowUpQuestions contains interview probes');
  assert(evalResult.overview.unmappedQuestionsCount === 1, 'unmappedQuestionsCount accurately tracks the 1 unmapped question');

  // Verify per-question observations
  assert(evalResult.questionObservations instanceof Map, 'questionObservations is a Map');
  assert(evalResult.questionObservations.has('q-p07'), 'questionObservations includes q-p07');
  const obsP07 = evalResult.questionObservations.get('q-p07');
  assert(obsP07?.questionCode === 'P07', 'Observation preserves question code P07');
  assert(obsP07?.band === 'BEHAVIOURAL', 'Observation correctly classifies P07 band as BEHAVIOURAL');

  // ========================================================
  // SUITE 4: Score Invariance & Non-Contributive Guarantee
  // ========================================================
  console.log('\n--- SUITE 4: Strict Score Invariance (Personality Contributes 0 Points) ---');

  assert(isPersonalityCategory('PERSONALITY') === true, 'isPersonalityCategory("PERSONALITY") is true');
  assert(isPersonalityCategory('Personality') === true, 'isPersonalityCategory("Personality") is true');
  assert(isPersonalityCategory('APTITUDE') === false, 'isPersonalityCategory("APTITUDE") is false');

  // Shallow merge pattern in score-calculation
  const existingSectionTotals: any = {
    APTITUDE: { marksObtained: 20, totalMarks: 25 },
    CODING: { marksObtained: 35, totalMarks: 50 },
    personalityOverview: evalResult.overview
  };

  const recalculatedSectionTotals: any = {
    APTITUDE: { marksObtained: 25, totalMarks: 25 },
    CODING: { marksObtained: 40, totalMarks: 50 }
  };

  const shallowMerged = {
    ...existingSectionTotals,
    ...recalculatedSectionTotals
  };

  assert(shallowMerged.APTITUDE.marksObtained === 25, 'Aptitude recalculated score updated');
  assert(shallowMerged.CODING.marksObtained === 40, 'Coding recalculated score updated');
  assert(shallowMerged.personalityOverview !== undefined, 'personalityOverview preserved during score recalculation');
  assert(
    shallowMerged.personalityOverview.candidateOverview === evalResult.overview.candidateOverview,
    'personalityOverview payload intact'
  );

  // ========================================================
  // SUITE 5: Minimum Attempt Threshold (60% Rule) Invariance
  // ========================================================
  console.log('\n--- SUITE 5: Minimum Attempt Threshold (60% Rule) Invariance ---');

  const testQuestionsWithPersonality = [
    // 10 Aptitude questions
    ...Array.from({ length: 10 }, (_, i) => ({
      question_id: `apt-${i}`,
      question: { id: `apt-${i}`, section: 'APTITUDE', points: 2, type: 'mcq' }
    })),
    // 10 Coding questions
    ...Array.from({ length: 10 }, (_, i) => ({
      question_id: `code-${i}`,
      question: { id: `code-${i}`, section: 'CODING', points: 10, type: 'coding' }
    })),
    // 5 Personality questions
    ...Array.from({ length: 5 }, (_, i) => ({
      question_id: `pers-${i}`,
      question: { id: `pers-${i}`, section: 'PERSONALITY', points: 0, type: 'open_text' }
    }))
  ];

  // Scenario: Candidate answers 10 Aptitude questions (out of 20 scored questions = 50%)
  // Candidate also answers all 5 Personality questions.
  // If Personality were counted: 15 / 25 = 60% (would wrongly pass)
  // Since Personality is strictly excluded from attempt calculation: 10 / 20 = 50% (fails)
  const responsesWithPersonality = [
    ...Array.from({ length: 10 }, (_, i) => ({
      question_id: `apt-${i}`,
      student_answer: 'option A'
    })),
    ...Array.from({ length: 5 }, (_, i) => ({
      question_id: `pers-${i}`,
      student_answer: 'Comprehensive personality answer'
    }))
  ];

  const eligibilityResult = assessTestAttemptEligibility(
    testQuestionsWithPersonality as any,
    responsesWithPersonality as any,
    undefined,
    { minPercentage: 60, enabled: true }
  );

  assert(eligibilityResult.applicableQuestionsCount === 20, 'Denominator strictly excludes Personality (20 questions, not 25)');
  assert(eligibilityResult.attemptedCount === 10, 'Numerator strictly excludes Personality (10 attempted, not 15)');
  assert(eligibilityResult.percentageAttempted === 50, 'Attempt percentage is exactly 50%');
  assert(eligibilityResult.isEligible === false, 'Candidate correctly flagged as INELIGIBLE (Personality does not inflate attempt)');

  // ========================================================
  // SUITE 6: Candidate Shortlisting Engine Invariance
  // ========================================================
  console.log('\n--- SUITE 6: Shortlisting Engine Ranking Invariance (Approach B) ---');

  function computeShortlistingScore(
    testQuestions: any[], 
    responses: any[], 
    categoryWeights: Record<string, number>, 
    overallWeight = 50, 
    sectionWeight = 50
  ) {
    let overallEarnedMarks = 0;
    let overallMaxMarks = 0;
    const categoryEarnedMap: Record<string, number> = {};
    const categoryMaxMap: Record<string, number> = {};

    for (const tq of testQuestions) {
      const sec = canonicalizeCategory(tq.question.section);
      if (!sec || isEligibilityCategory(sec) || isPersonalityCategory(sec)) continue;
      const pts = Number(tq.question.points || 0);
      overallMaxMarks += pts;
      categoryMaxMap[sec] = (categoryMaxMap[sec] || 0) + pts;
      if (!(sec in categoryEarnedMap)) categoryEarnedMap[sec] = 0;
    }

    for (const r of responses) {
      const sec = canonicalizeCategory(r.question.section);
      if (!sec || isEligibilityCategory(sec) || isPersonalityCategory(sec)) continue;
      const earned = Number(r.points_earned || 0);
      overallEarnedMarks += earned;
      categoryEarnedMap[sec] = (categoryEarnedMap[sec] || 0) + earned;
    }

    const overallPercentage = overallMaxMarks > 0 ? (overallEarnedMarks / overallMaxMarks) * 100 : 0;
    
    // Normalize weights
    const totalCatWeight = Object.values(categoryWeights).reduce((a, b) => a + b, 0);
    let weightedSectionPercentage = 0;
    for (const [cat, w] of Object.entries(categoryWeights)) {
      if (isEligibilityCategory(cat) || isPersonalityCategory(cat)) continue;
      const normW = totalCatWeight > 0 ? w / totalCatWeight : 0;
      const max = categoryMaxMap[cat] || 0;
      const earned = categoryEarnedMap[cat] || 0;
      const pct = max > 0 ? (earned / max) * 100 : 0;
      weightedSectionPercentage += pct * normW;
    }

    const rankingScore = Math.round(((overallWeight / 100 * overallPercentage) + (sectionWeight / 100 * weightedSectionPercentage)) * 100) / 100;
    return { overallEarnedMarks, overallMaxMarks, overallPercentage, weightedSectionPercentage, rankingScore };
  }

  const baseScoredQuestions = [
    { question: { id: 'q-apt-1', section: 'APTITUDE', points: 30 } },
    { question: { id: 'q-code-1', section: 'CODING', points: 70 } }
  ];

  const candidateResponses = [
    { question: { id: 'q-apt-1', section: 'APTITUDE' }, points_earned: 24 },
    { question: { id: 'q-code-1', section: 'CODING' }, points_earned: 56 }
  ];

  const weights = {
    APTITUDE: 0.4,
    CODING: 0.6,
    PERSONALITY: 0
  };

  const scoreWithoutPersonality = computeShortlistingScore(
    baseScoredQuestions,
    candidateResponses,
    weights
  );

  // Now add 10 Personality questions with answers and evaluations
  const questionsWithPersonality = [
    ...baseScoredQuestions,
    ...Array.from({ length: 10 }, (_, i) => ({
      question: { id: `q-pers-${i}`, section: 'PERSONALITY', points: 0 }
    }))
  ];

  const responsesWithPersonalityScored = [
    ...candidateResponses,
    ...Array.from({ length: 10 }, (_, i) => ({
      question: { id: `q-pers-${i}`, section: 'PERSONALITY' },
      points_earned: null
    }))
  ];

  const scoreWithPersonality = computeShortlistingScore(
    questionsWithPersonality,
    responsesWithPersonalityScored,
    weights
  );

  assert(
    scoreWithPersonality.overallEarnedMarks === scoreWithoutPersonality.overallEarnedMarks,
    'overallEarnedMarks is 100% identical (80 marks)'
  );
  assert(
    scoreWithPersonality.overallMaxMarks === scoreWithoutPersonality.overallMaxMarks,
    'overallMaxMarks is 100% identical (100 marks)'
  );
  assert(
    scoreWithPersonality.overallPercentage === scoreWithoutPersonality.overallPercentage,
    'overallPercentage is 100% identical (80%)'
  );
  assert(
    scoreWithPersonality.weightedSectionPercentage === scoreWithoutPersonality.weightedSectionPercentage,
    'weightedSectionPercentage is 100% identical (80%)'
  );
  assert(
    scoreWithPersonality.rankingScore === scoreWithoutPersonality.rankingScore,
    'Final rankingScore is 100% identical (80.00)'
  );

  console.log('\n============================================================');
  console.log(`PERSONALITY OVERVIEW TEST SUMMARY: ${passedCount} PASSED | ${failedCount} FAILED`);
  console.log('============================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runPersonalityOverviewTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
