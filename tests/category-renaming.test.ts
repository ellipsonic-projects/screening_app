import 'dotenv/config';
import prisma from '../lib/prisma';
import { 
  CATEGORIES, 
  CATEGORY_ORDER, 
  canonicalizeCategory, 
  getCategoryLabel, 
  isEligibilityCategory, 
  isValidCategory, 
  SUPPORTED_DISPLAY_LABELS,
  CanonicalCategoryId
} from '../lib/categories';
import { mapQuestionPayload } from '../lib/questionMapper';
import { recalculateTestScore } from '../lib/services/score-calculation';

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

async function runTests() {
  console.log('\n======================================================');
  console.log('   RUNNING CATEGORY RENAMING & NORMALIZATION TESTS   ');
  console.log('======================================================\n');

  // ========================================================
  // REQUIREMENT 1: All 10 Categories Display Exact New Names
  // ========================================================
  console.log('--- TEST GROUP 1: Exact Category Display Names ---');
  
  const expectedLabels: Record<CanonicalCategoryId, string> = {
    APTITUDE: 'Quantitative & Logical Reasoning',
    CODING: 'Coding & Debugging',
    ELIGIBILITY: 'Eligibility & Logistics (Unscored)',
    ATTITUDE_AND_OWNERSHIP: 'Ownership & Initiative',
    LEARNING_APTITUDE: 'Learning Agility',
    PROBLEM_SOLVING: 'Problem Solving & System Design',
    EXECUTION_AND_RELIABILITY: 'Delivery & Dependability',
    COMMUNICATION_AND_TEAMWORK: 'Written Communication & Collaboration',
    INTEGRITY: 'Ethics & Judgment',
    AI_LITERACY: 'AI Literacy & Responsible Use',
    PERSONALITY: 'Personality'
  };

  for (const [id, expectedLabel] of Object.entries(expectedLabels)) {
    const actualLabel = CATEGORIES[id as CanonicalCategoryId].label;
    assert(
      actualLabel === expectedLabel,
      `Category ${id} matches exact new display name "${expectedLabel}"`
    );
  }

  // ========================================================
  // REQUIREMENT 2: Admin & Student Interfaces Use Same Labels
  // ========================================================
  console.log('\n--- TEST GROUP 2: Admin and Student Interface Consistency ---');

  for (const [id, expectedLabel] of Object.entries(expectedLabels)) {
    const fromGetLabel = getCategoryLabel(id);
    const fromCategories = CATEGORIES[id as CanonicalCategoryId].label;
    assert(
      fromGetLabel === expectedLabel && fromGetLabel === fromCategories,
      `getCategoryLabel("${id}") produces "${expectedLabel}" consistently for both admin and student views`
    );
  }

  // ========================================================
  // REQUIREMENT 3: Old and New Names Resolve to Same Canonical IDs
  // ========================================================
  console.log('\n--- TEST GROUP 3: Canonical ID Resolution (Legacy & New) ---');

  const namePairs: Array<[string, string, CanonicalCategoryId]> = [
    ['Aptitude', 'Quantitative & Logical Reasoning', 'APTITUDE'],
    ['Coding', 'Coding & Debugging', 'CODING'],
    ['Eligibility', 'Eligibility & Logistics (Unscored)', 'ELIGIBILITY'],
    ['Attitude & Ownership', 'Ownership & Initiative', 'ATTITUDE_AND_OWNERSHIP'],
    ['Learning Aptitude', 'Learning Agility', 'LEARNING_APTITUDE'],
    ['Problem Solving', 'Problem Solving & System Design', 'PROBLEM_SOLVING'],
    ['Execution & Reliability', 'Delivery & Dependability', 'EXECUTION_AND_RELIABILITY'],
    ['Communication & Teamwork', 'Written Communication & Collaboration', 'COMMUNICATION_AND_TEAMWORK'],
    ['Integrity', 'Ethics & Judgment', 'INTEGRITY'],
    ['AI Literacy', 'AI Literacy & Responsible Use', 'AI_LITERACY']
  ];

  for (const [oldName, newName, canonicalId] of namePairs) {
    const oldResolved = canonicalizeCategory(oldName);
    const newResolved = canonicalizeCategory(newName);
    assert(
      oldResolved === canonicalId && newResolved === canonicalId,
      `Both "${oldName}" and "${newName}" resolve to canonical ID: ${canonicalId}`
    );
  }

  // Test aliases with '&' vs 'and', whitespace, and casing
  assert(
    canonicalizeCategory('attitude and ownership') === 'ATTITUDE_AND_OWNERSHIP',
    'Normalization handles "attitude and ownership" with "and"'
  );
  assert(
    canonicalizeCategory('  Delivery & Dependability  ') === 'EXECUTION_AND_RELIABILITY',
    'Normalization handles extra whitespace'
  );
  assert(
    canonicalizeCategory('ETHICS & JUDGMENT') === 'INTEGRITY',
    'Normalization handles uppercase new display name'
  );
  assert(
    canonicalizeCategory('ATTITUDE') === 'ATTITUDE_AND_OWNERSHIP',
    'Legacy abbreviation "ATTITUDE" resolves to ATTITUDE_AND_OWNERSHIP'
  );

  // ========================================================
  // REQUIREMENT 4: Ampersand-Containing Categories Import Correctly
  // ========================================================
  console.log('\n--- TEST GROUP 4: Ampersand-Containing Categories Import ---');

  const testAmpersandRow1 = {
    'Section': 'Attitude & Ownership',
    'Question Text': 'How do you handle project setbacks?',
    'Question Type': 'open_text',
    'Points': '10'
  };
  const payload1 = mapQuestionPayload(testAmpersandRow1);
  assert(
    payload1.section === 'ATTITUDE_AND_OWNERSHIP',
    `Legacy "Attitude & Ownership" maps to canonical "ATTITUDE_AND_OWNERSHIP" (never Aptitude fallback!)`
  );

  const testAmpersandRow2 = {
    'Section': 'Ownership & Initiative',
    'Question Text': 'Describe a time you showed initiative.',
    'Question Type': 'open_text',
    'Points': '10'
  };
  const payload2 = mapQuestionPayload(testAmpersandRow2);
  assert(
    payload2.section === 'ATTITUDE_AND_OWNERSHIP',
    `New "Ownership & Initiative" maps to canonical "ATTITUDE_AND_OWNERSHIP"`
  );

  const testAmpersandRow3 = {
    'Section': 'Execution & Reliability',
    'Question Text': 'How do you ensure task deadlines are met?',
    'Question Type': 'open_text',
    'Points': '10'
  };
  const payload3 = mapQuestionPayload(testAmpersandRow3);
  assert(
    payload3.section === 'EXECUTION_AND_RELIABILITY',
    `Legacy "Execution & Reliability" maps to canonical "EXECUTION_AND_RELIABILITY" (never Aptitude fallback!)`
  );

  const testAmpersandRow4 = {
    'Section': 'Delivery & Dependability',
    'Question Text': 'How do you prioritize deliverables?',
    'Question Type': 'open_text',
    'Points': '10'
  };
  const payload4 = mapQuestionPayload(testAmpersandRow4);
  assert(
    payload4.section === 'EXECUTION_AND_RELIABILITY',
    `New "Delivery & Dependability" maps to canonical "EXECUTION_AND_RELIABILITY"`
  );

  const testAmpersandRow5 = {
    'Section': 'Written Communication & Collaboration',
    'Question Text': 'Explain a complex technical concept to a non-technical peer.',
    'Question Type': 'open_text',
    'Points': '10'
  };
  const payload5 = mapQuestionPayload(testAmpersandRow5);
  assert(
    payload5.section === 'COMMUNICATION_AND_TEAMWORK',
    `New "Written Communication & Collaboration" maps to canonical "COMMUNICATION_AND_TEAMWORK"`
  );

  // ========================================================
  // REQUIREMENT 5: Unknown Category Names Produce Validation Errors
  // ========================================================
  console.log('\n--- TEST GROUP 5: Unknown Category Validation Errors ---');

  assert(
    canonicalizeCategory('UnknownCategory123') === null,
    'canonicalizeCategory returns null for unrecognized category'
  );
  assert(
    canonicalizeCategory('Random Section') === null,
    'canonicalizeCategory returns null for "Random Section"'
  );
  assert(
    isValidCategory('Invalid_Category') === false,
    'isValidCategory returns false for invalid category'
  );

  let threwError = false;
  try {
    mapQuestionPayload({
      'Section': 'NonExistentCategory',
      'Question Text': 'Invalid question',
      'Question Type': 'mcq'
    });
  } catch (err: any) {
    threwError = true;
    assert(
      err.message.includes('Invalid or unrecognized category/section'),
      `mapQuestionPayload throws descriptive validation error for unknown category: "${err.message}"`
    );
  }
  assert(threwError, 'mapQuestionPayload rejected unknown category instead of silently defaulting to Aptitude');

  // ========================================================
  // REQUIREMENT 6: Test Generation and Resumption Preserve Category Ordering
  // ========================================================
  console.log('\n--- TEST GROUP 6: Category Ordering ---');

  assert(
    CATEGORY_ORDER[0] === 'ELIGIBILITY',
    'First section in CATEGORY_ORDER is ELIGIBILITY'
  );
  assert(
    CATEGORY_ORDER[1] === 'APTITUDE',
    'Second section in CATEGORY_ORDER is APTITUDE'
  );
  assert(
    CATEGORY_ORDER[2] === 'CODING',
    'Third section in CATEGORY_ORDER is CODING'
  );
  assert(
    CATEGORY_ORDER.length === 11,
    `CATEGORY_ORDER contains 11 canonical sections (found ${CATEGORY_ORDER.length})`
  );

  // Test question sorting logic
  const mockQuestions = [
    { id: 'q1', section: 'Coding & Debugging' },
    { id: 'q2', section: 'Eligibility' },
    { id: 'q3', section: 'Quantitative & Logical Reasoning' },
    { id: 'q4', section: 'AI Literacy & Responsible Use' },
    { id: 'q5', section: 'Ownership & Initiative' }
  ];

  // Group by canonical category
  const grouped: Record<string, any[]> = {};
  mockQuestions.forEach(q => {
    const canonical = canonicalizeCategory(q.section);
    if (canonical) {
      if (!grouped[canonical]) grouped[canonical] = [];
      grouped[canonical].push(q);
    }
  });

  const sorted: any[] = [];
  CATEGORY_ORDER.forEach(orderedCat => {
    if (grouped[orderedCat]) {
      sorted.push(...grouped[orderedCat]);
    }
  });

  assert(
    sorted[0].id === 'q2', // Eligibility
    'Sorted questions start with Eligibility question (q2)'
  );
  assert(
    sorted[1].id === 'q3', // Quantitative & Logical Reasoning (APTITUDE)
    'Sorted questions second item is Quantitative & Logical Reasoning (q3)'
  );
  assert(
    sorted[2].id === 'q1', // Coding & Debugging (CODING)
    'Sorted questions third item is Coding & Debugging (q1)'
  );
  assert(
    sorted[3].id === 'q5', // Ownership & Initiative (ATTITUDE_AND_OWNERSHIP)
    'Sorted questions fourth item is Ownership & Initiative (q5)'
  );
  assert(
    sorted[4].id === 'q4', // AI Literacy & Responsible Use (AI_LITERACY)
    'Sorted questions fifth item is AI Literacy & Responsible Use (q4)'
  );

  // ========================================================
  // REQUIREMENT 7: Eligibility Questions Remain Unscored
  // ========================================================
  console.log('\n--- TEST GROUP 7: Eligibility Unscored Enforcement ---');

  assert(
    isEligibilityCategory('ELIGIBILITY') === true,
    'isEligibilityCategory("ELIGIBILITY") is true'
  );
  assert(
    isEligibilityCategory('Eligibility & Logistics (Unscored)') === true,
    'isEligibilityCategory("Eligibility & Logistics (Unscored)") is true'
  );
  assert(
    isEligibilityCategory('Eligibility') === true,
    'isEligibilityCategory("Eligibility") is true'
  );
  assert(
    isEligibilityCategory('APTITUDE') === false,
    'isEligibilityCategory("APTITUDE") is false'
  );
  assert(
    isEligibilityCategory('Quantitative & Logical Reasoning') === false,
    'isEligibilityCategory("Quantitative & Logical Reasoning") is false'
  );

  const eligibilityPayload = mapQuestionPayload({
    'Section': 'Eligibility & Logistics (Unscored)',
    'Question Text': 'Are you available to work full-time?',
    'Question Type': 'single_select',
    'Points': '10'
  });
  assert(
    eligibilityPayload.points === 0,
    `Eligibility question is always forced to 0 points during mapping (points=${eligibilityPayload.points})`
  );

  // ========================================================
  // REQUIREMENT 8 & 9: Database Compatibility & Analytics Consistency
  // ========================================================
  console.log('\n--- TEST GROUP 8 & 9: DB Compatibility & Analytics Consistency ---');

  // Verify that any existing database questions can be labeled correctly
  const sampleDbQuestions = await prisma.question.findMany({
    take: 10,
    select: { id: true, section: true, question_text: true }
  });

  for (const q of sampleDbQuestions) {
    const label = getCategoryLabel(q.section);
    assert(
      typeof label === 'string' && label.length > 0,
      `Existing DB question [${q.id}] with section "${q.section}" cleanly renders display label: "${label}"`
    );
  }

  // Verify that SUPPORTED_DISPLAY_LABELS contains all 11 display labels
  assert(
    SUPPORTED_DISPLAY_LABELS.length === 11,
    `SUPPORTED_DISPLAY_LABELS has exactly 11 entries (count=${SUPPORTED_DISPLAY_LABELS.length})`
  );

  // ========================================================
  // SUMMARY
  // ========================================================
  console.log('\n======================================================');
  console.log(`CATEGORY RENAMING TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('======================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
