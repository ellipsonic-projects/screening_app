import prisma from '../lib/prisma';
import { 
  validateShortlistConfig, 
  normalizeCategoryWeights, 
  selectAuthoritativeAttempt, 
  calculateShortlist,
  publishShortlistSnapshot,
  ShortlistConfig 
} from '../lib/services/shortlisting-engine';
import { GET as getSettingsRoute, POST as postSettingsRoute } from '../app/api/admin/shortlist/settings/route';
import { POST as previewShortlistRoute, GET as getPreviewRoute } from '../app/api/admin/shortlist/preview/route';
import { POST as publishShortlistRoute } from '../app/api/admin/shortlist/publish/route';
import { GET as getShortlistRoute } from '../app/api/admin/shortlist/route';
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

async function runDynamicShortlistingTests() {
  console.log('\n============================================================');
  console.log('🧪 RUNNING APPROACH B DYNAMIC SHORTLISTING & RANKING TEST SUITE');
  console.log('============================================================\n');

  // Track created fixtures for cleanup
  const createdTestIds: string[] = [];
  const createdTemplateIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdQuestionIds: string[] = [];
  const createdPublishedIds: string[] = [];

  try {
    // -------------------------------------------------------------
    // Setup Admin and Student Fixtures
    // -------------------------------------------------------------
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

    const studentUser = await prisma.user.create({
      data: {
        email: `shortlist_test_student_${Date.now()}@example.com`,
        password_hash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
        role: 'student',
        student: {
          create: {
            full_name: 'Shortlist Student',
            usn: `SHORTLIST_USN_${Date.now()}`,
            branch_name: 'Computer Science',
            profile_completed: true
          }
        }
      },
      include: { student: true }
    });
    createdUserIds.push(studentUser.id);
    const studentToken = generateToken({
      userId: studentUser.id,
      email: studentUser.email,
      role: 'student'
    });

    // =============================================================
    // TEST SECTION 1: Config Validation & Normalization
    // =============================================================
    console.log('--- Test Section 1: Config Validation & Normalization ---');

    // 1.1 Weight sum validation
    let threwWeightMismatch = false;
    try {
      validateShortlistConfig({
        shortlistSize: 10,
        overallWeight: 60,
        sectionWeight: 50 // sum = 110
      });
    } catch (e: any) {
      threwWeightMismatch = true;
    }
    assert(threwWeightMismatch, 'Config validation rejects weights not summing to 100%');

    // 1.2 Valid config accepted
    const validConfig = validateShortlistConfig({
      shortlistSize: 20,
      overallWeight: 40,
      sectionWeight: 60,
      categoryWeights: {
        CODING: 30,
        APTITUDE: 10
      }
    });
    assert(validConfig.shortlistSize === 20, 'Config validation accepts valid shortlist size');
    assert(validConfig.overallWeight === 40 && validConfig.sectionWeight === 60, 'Config validation accepts valid weights');

    // 1.3 Normalization of category weights
    const normalized = normalizeCategoryWeights({
      CODING: 75,
      APTITUDE: 25
    });
    assert(normalized.CODING === 0.75, 'CODING relative weight normalized correctly to 0.75');
    assert(normalized.APTITUDE === 0.25, 'APTITUDE relative weight normalized correctly to 0.25');
    assert(Math.abs(normalized.CODING + normalized.APTITUDE - 1.0) < 0.0001, 'Normalized category weights sum to 1.0');

    // Arbitrary scale normalization (e.g. 3 and 1)
    const normalizedScale = normalizeCategoryWeights({
      CODING: 3,
      APTITUDE: 1
    });
    assert(normalizedScale.CODING === 0.75 && normalizedScale.APTITUDE === 0.25, 'Arbitrary scale (3 and 1) normalizes to 0.75 and 0.25');

    // 1.4 Invalid shortlist size
    let threwInvalidSize = false;
    try {
      validateShortlistConfig({ shortlistSize: 0 });
    } catch {
      threwInvalidSize = true;
    }
    assert(threwInvalidSize, 'Config validation rejects shortlistSize <= 0');

    // 1.5 Missing category weights when sectionWeight > 0
    let threwMissingCatWeights = false;
    try {
      validateShortlistConfig({
        shortlistSize: 10,
        overallWeight: 50,
        sectionWeight: 50,
        categoryWeights: {}
      });
    } catch {
      threwMissingCatWeights = true;
    }
    assert(threwMissingCatWeights, 'Config validation requires at least one positive category weight when sectionWeight > 0');

    // =============================================================
    // TEST SECTION 2: Authoritative Attempt Precedence (Multi-Attempt)
    // =============================================================
    console.log('\n--- Test Section 2: Authoritative Attempt Selection (No Duplicates) ---');

    const earlierEvaluated = {
      id: 'test-attempt-1',
      status: 'evaluated',
      score: 70,
      end_time: new Date('2026-10-01T10:00:00Z'),
      created_at: new Date('2026-10-01T09:00:00Z')
    };

    const laterEvaluatedHigherScore = {
      id: 'test-attempt-2',
      status: 'evaluated',
      score: 85,
      end_time: new Date('2026-10-02T10:00:00Z'),
      created_at: new Date('2026-10-02T09:00:00Z')
    };

    const abandonedInProgress = {
      id: 'test-attempt-3',
      status: 'in_progress',
      score: null,
      end_time: null,
      created_at: new Date('2026-10-03T09:00:00Z')
    };

    const ineligibleAttempt = {
      id: 'test-attempt-4',
      status: 'ineligible_attempt',
      score: null,
      end_time: new Date('2026-10-04T10:00:00Z'),
      created_at: new Date('2026-10-04T09:00:00Z')
    };

    // Evaluated attempt beats later abandoned attempt
    const auth1 = selectAuthoritativeAttempt([earlierEvaluated, abandonedInProgress]);
    assert(auth1.id === 'test-attempt-1', 'Evaluated attempt takes precedence over later in_progress attempt');

    // Higher score evaluated attempt beats lower score evaluated attempt
    const auth2 = selectAuthoritativeAttempt([earlierEvaluated, laterEvaluatedHigherScore]);
    assert(auth2.id === 'test-attempt-2', 'Evaluated attempt with higher score takes precedence');

    // Evaluated attempt beats later ineligible attempt
    const auth3 = selectAuthoritativeAttempt([earlierEvaluated, ineligibleAttempt]);
    assert(auth3.id === 'test-attempt-1', 'Evaluated attempt takes precedence over later ineligible attempt');

    // =============================================================
    // TEST SECTION 3: Database Integration & Approach B Calculation
    // =============================================================
    console.log('\n--- Test Section 3: Database Integration & Approach B Engine ---');

    // Setup Test Template
    const template = await prisma.testTemplate.create({
      data: {
        name: `Shortlisting Test Template ${Date.now()}`,
        description: 'Template for Shortlisting Engine Test',
        total_questions: 3,
        total_duration: 60,
        created_by: adminUser.id,
        is_active: true
      }
    });
    createdTemplateIds.push(template.id);

    // Setup Questions: 1 Aptitude (10 pts), 1 Coding (20 pts), 1 Eligibility (0 pts)
    const qApt = await prisma.question.create({
      data: {
        question_text: `Quantitative Problem ${Date.now()}`,
        type: 'mcq',
        points: 10,
        section: 'APTITUDE',
        created_by: adminUser.id,
        is_published: true
      }
    });
    createdQuestionIds.push(qApt.id);

    const qCode = await prisma.question.create({
      data: {
        question_text: `Coding Problem ${Date.now()}`,
        type: 'coding',
        points: 20,
        section: 'CODING',
        created_by: adminUser.id,
        is_published: true
      }
    });
    createdQuestionIds.push(qCode.id);

    const qElig = await prisma.question.create({
      data: {
        question_text: `Are you available for 6-month internship?`,
        type: 'mcq',
        points: 0,
        section: 'ELIGIBILITY',
        created_by: adminUser.id,
        is_published: true
      }
    });
    createdQuestionIds.push(qElig.id);

    // Setup 5 Candidates with diverse score profiles:
    // Candidate 1 (Alice): Aptitude 10/10 (100%), Coding 20/20 (100%) -> Overall 30/30 (100%)
    // Candidate 2 (Bob):   Aptitude 10/10 (100%), Coding 10/20 (50%)  -> Overall 20/30 (66.67%)
    // Candidate 3 (Carol): Aptitude 5/10 (50%),   Coding 15/20 (75%)  -> Overall 20/30 (66.67%)
    // Candidate 4 (Dave):  Ineligible attempt (did not meet 60% minimum attempts)
    // Candidate 5 (Eve):   Pending AI evaluation (status = evaluating)

    // Helper to create candidate test
    async function createCandidate(name: string, usn: string, email: string) {
      const u = await prisma.user.create({
        data: {
          email,
          password_hash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
          role: 'student',
          student: {
            create: {
              full_name: name,
              usn,
              branch_name: 'Computer Science',
              profile_completed: true
            }
          }
        },
        include: { student: true }
      });
      createdUserIds.push(u.id);
      return u.student!;
    }

    const cAlice = await createCandidate('Alice Smith', `USN_ALICE_${Date.now()}`, `alice_${Date.now()}@test.com`);
    const cBob = await createCandidate('Bob Jones', `USN_BOB_${Date.now()}`, `bob_${Date.now()}@test.com`);
    const cCarol = await createCandidate('Carol White', `USN_CAROL_${Date.now()}`, `carol_${Date.now()}@test.com`);
    const cDave = await createCandidate('Dave Miller', `USN_DAVE_${Date.now()}`, `dave_${Date.now()}@test.com`);
    const cEve = await createCandidate('Eve Davis', `USN_EVE_${Date.now()}`, `eve_${Date.now()}@test.com`);

    async function setupTestWithResponses(studentId: string, options: {
      status: string;
      aptitudeMarks: number | null;
      codingMarks: number | null;
      codingEvalStatus?: 'COMPLETED' | 'PENDING' | 'FAILED';
      timeTakenMins: number;
      violationsCount: number;
    }) {
      const startTime = new Date(Date.now() - options.timeTakenMins * 60000);
      const endTime = options.status !== 'not_started' ? new Date() : null;

      const totalEarned = (options.aptitudeMarks || 0) + (options.codingMarks || 0);

      const test = await prisma.test.create({
        data: {
          student_id: studentId,
          template_id: template.id,
          round: 1,
          title: 'Campus Recruitment Screening',
          status: options.status,
          score: options.status === 'evaluated' ? totalEarned : null,
          total_duration: 60,
          start_time: startTime,
          end_time: endTime,
          violations_count: options.violationsCount,
          test_questions: {
            create: [
              { question_id: qApt.id, sequence_number: 1 },
              { question_id: qCode.id, sequence_number: 2 },
              { question_id: qElig.id, sequence_number: 3 }
            ]
          }
        }
      });
      createdTestIds.push(test.id);

      // Create responses
      if (options.status !== 'ineligible_attempt' && options.status !== 'not_started') {
        // Aptitude response
        await prisma.testResponse.create({
          data: {
            test_id: test.id,
            question_id: qApt.id,
            student_answer: 'Option A',
            is_correct: options.aptitudeMarks === 10,
            points_earned: options.aptitudeMarks,
            evaluation_status: 'COMPLETED'
          }
        });

        // Coding response
        const respCode = await prisma.testResponse.create({
          data: {
            test_id: test.id,
            question_id: qCode.id,
            student_answer: 'function solution() { return true; }',
            is_correct: options.codingMarks === 20,
            points_earned: options.codingEvalStatus === 'COMPLETED' ? options.codingMarks : null,
            evaluation_status: options.codingEvalStatus || 'COMPLETED'
          }
        });

        // AI evaluation for coding
        await prisma.aIEvaluation.create({
          data: {
            test_id: test.id,
            student_id: studentId,
            question_id: qCode.id,
            test_response_id: respCode.id,
            section: 'CODING',
            question_type: 'coding',
            obtained_marks: options.codingEvalStatus === 'COMPLETED' ? options.codingMarks : null,
            maximum_marks: 20,
            evaluation_status: options.codingEvalStatus || 'COMPLETED',
            feedback: 'Code evaluated'
          }
        });
      }

      return test;
    }

    // 1. Alice: 10/10 Aptitude, 20/20 Coding (100% overall), 30 mins, 0 violations
    await setupTestWithResponses(cAlice.id, {
      status: 'evaluated',
      aptitudeMarks: 10,
      codingMarks: 20,
      codingEvalStatus: 'COMPLETED',
      timeTakenMins: 30,
      violationsCount: 0
    });

    // 2. Bob: 10/10 Aptitude (100%), 10/20 Coding (50%) -> Overall 20/30 (66.67%), 35 mins, 0 violations
    await setupTestWithResponses(cBob.id, {
      status: 'evaluated',
      aptitudeMarks: 10,
      codingMarks: 10,
      codingEvalStatus: 'COMPLETED',
      timeTakenMins: 35,
      violationsCount: 0
    });

    // 3. Carol: 5/10 Aptitude (50%), 15/20 Coding (75%) -> Overall 20/30 (66.67%), 40 mins, 1 violation
    await setupTestWithResponses(cCarol.id, {
      status: 'evaluated',
      aptitudeMarks: 5,
      codingMarks: 15,
      codingEvalStatus: 'COMPLETED',
      timeTakenMins: 40,
      violationsCount: 1
    });

    // 4. Dave: Ineligible attempt
    await setupTestWithResponses(cDave.id, {
      status: 'ineligible_attempt',
      aptitudeMarks: null,
      codingMarks: null,
      timeTakenMins: 10,
      violationsCount: 0
    });

    // 5. Eve: Evaluating / Pending
    await setupTestWithResponses(cEve.id, {
      status: 'evaluating',
      aptitudeMarks: 10,
      codingMarks: null,
      codingEvalStatus: 'PENDING',
      timeTakenMins: 25,
      violationsCount: 0
    });

    // =============================================================
    // TEST RUN A: Approach B Formula Verification & Shortlisting
    // Overall Weight = 50%, Section Weight = 50%
    // Category Weights: CODING = 70, APTITUDE = 30 (normalized: 0.70 and 0.30)
    // =============================================================
    console.log('\n--- Test Run A: Approach B Formula & Ranking Weights ---');

    const configA: ShortlistConfig = {
      shortlistSize: 2, // Top 2
      overallCutoffEnabled: false,
      overallCutoffPercentage: 60,
      sectionCutoffs: {},
      overallWeight: 50,
      sectionWeight: 50,
      categoryWeights: {
        CODING: 70,
        APTITUDE: 30
      }
    };

    const resA = await calculateShortlist({
      round: 1,
      templateId: template.id,
      config: configA
    });

    assert(resA.summary.totalUniqueCandidates === 5, 'Evaluated all 5 unique candidates');
    assert(resA.summary.qualifiedCount === 3, 'Exactly 3 candidates qualified (Alice, Bob, Carol)');
    assert(resA.summary.shortlistedCount === 2, 'Top 2 candidates shortlisted');
    assert(resA.summary.notShortlistedCount === 1, '1 qualified candidate not shortlisted (rank 3)');
    assert(resA.summary.disqualifiedCount === 1, 'Dave disqualified (ineligible attempt)');
    assert(resA.summary.pendingReviewCount === 1, 'Eve flagged pending_review (evaluating status)');

    // Alice:
    // Overall: 100%
    // Section: (100% * 0.70) + (100% * 0.30) = 100%
    // Ranking Score = (100 * 0.50) + (100 * 0.50) = 100.000
    const aliceRank = resA.candidates.find(c => c.studentId === cAlice.id);
    assert(aliceRank?.rank === 1, 'Alice is Rank 1');
    assert(aliceRank?.shortlistStatus === 'shortlisted', 'Alice is Shortlisted');
    assert(aliceRank?.rankingScore === 100, `Alice Ranking Score is 100 (got: ${aliceRank?.rankingScore})`);

    // Carol vs Bob comparison:
    // Both have Overall Percentage = 66.67% (20/30)
    // Bob:   Aptitude 100%, Coding 50%  -> Section: (50 * 0.70) + (100 * 0.30) = 35 + 30 = 65%
    //        Ranking Score = (66.67 * 0.50) + (65 * 0.50) = 33.335 + 32.5 = 65.835
    // Carol: Aptitude 50%, Coding 75%   -> Section: (75 * 0.70) + (50 * 0.30)  = 52.5 + 15 = 67.5%
    //        Ranking Score = (66.67 * 0.50) + (67.5 * 0.50) = 33.335 + 33.75 = 67.085
    // Because CODING has 70% weight, Carol must rank HIGHER than Bob despite identical overall marks!
    const carolRank = resA.candidates.find(c => c.studentId === cCarol.id);
    const bobRank = resA.candidates.find(c => c.studentId === cBob.id);

    assert(carolRank?.rank === 2, `Carol is Rank 2 (Ranking Score: ${carolRank?.rankingScore})`);
    assert(carolRank?.shortlistStatus === 'shortlisted', 'Carol is Shortlisted (in Top 2)');
    assert(bobRank?.rank === 3, `Bob is Rank 3 (Ranking Score: ${bobRank?.rankingScore})`);
    assert(bobRank?.shortlistStatus === 'not_shortlisted', 'Bob is Not Shortlisted (rank 3 > Top 2)');
    assert(Number(carolRank?.rankingScore) > Number(bobRank?.rankingScore), 
      'Approach B successfully prioritizes higher coding performer due to relative section weighting');

    // Dave disqualified:
    const daveRank = resA.candidates.find(c => c.studentId === cDave.id);
    assert(daveRank?.shortlistStatus === 'disqualified', 'Ineligible candidate Dave is disqualified');
    assert(daveRank?.rank === null, 'Disqualified candidate has null rank');
    assert(Boolean(daveRank?.exclusionReasons.some(r => r.includes('60%'))), 'Dave has clear exclusion reason mentioning 60% threshold');

    // Eve pending review:
    const eveRank = resA.candidates.find(c => c.studentId === cEve.id);
    assert(eveRank?.shortlistStatus === 'pending_review', 'Pending evaluation candidate Eve is pending_review');
    assert(eveRank?.rank === null, 'Pending review candidate has null rank');
    assert(eveRank?.needsReview === true, 'Eve is flagged with needsReview = true');

    // =============================================================
    // TEST RUN B: Cutoff Filtering (Overall Cutoff & Section Cutoff)
    // =============================================================
    console.log('\n--- Test Run B: Cutoffs (Overall & Section Minimums) ---');

    // Setting overall cutoff to 70%: Carol and Bob (66.67%) will both be disqualified
    const configB: ShortlistConfig = {
      shortlistSize: 5,
      overallCutoffEnabled: true,
      overallCutoffPercentage: 70, // 70% cutoff
      sectionCutoffs: {},
      overallWeight: 50,
      sectionWeight: 50,
      categoryWeights: { CODING: 50, APTITUDE: 50 }
    };

    const resB = await calculateShortlist({
      round: 1,
      templateId: template.id,
      config: configB
    });

    const bobB = resB.candidates.find(c => c.studentId === cBob.id);
    const carolB = resB.candidates.find(c => c.studentId === cCarol.id);
    assert(bobB?.shortlistStatus === 'disqualified', 'Bob disqualified when overall score is below overall cutoff');
    assert(carolB?.shortlistStatus === 'disqualified', 'Carol disqualified when overall score is below overall cutoff');
    assert(Boolean(bobB?.exclusionReasons.some(r => r.includes('overall cutoff of 70%'))), 'Bob exclusion reason details overall cutoff failure');

    // Setting section cutoff: CODING minimum 60%
    // Bob has 50% in Coding -> Should be disqualified by section cutoff!
    // Carol has 75% in Coding -> Passes section cutoff!
    const configC: ShortlistConfig = {
      shortlistSize: 5,
      overallCutoffEnabled: false,
      overallCutoffPercentage: 60,
      sectionCutoffs: {
        CODING: 60 // 60% coding minimum
      },
      overallWeight: 50,
      sectionWeight: 50,
      categoryWeights: { CODING: 50, APTITUDE: 50 }
    };

    const resC = await calculateShortlist({
      round: 1,
      templateId: template.id,
      config: configC
    });

    const bobC = resC.candidates.find(c => c.studentId === cBob.id);
    const carolC = resC.candidates.find(c => c.studentId === cCarol.id);
    assert(bobC?.shortlistStatus === 'disqualified', 'Bob disqualified because Coding score (50%) is below 60% section cutoff');
    assert(Boolean(bobC?.exclusionReasons.some(r => r.includes('Coding & Debugging'))), 'Exclusion reason specifically identifies Coding & Debugging section');
    assert(carolC?.shortlistStatus === 'shortlisted', 'Carol qualifies and is shortlisted because Coding score (75%) meets 60% section cutoff');

    // =============================================================
    // TEST RUN C: Deterministic Tie-Breaker
    // =============================================================
    console.log('\n--- Test Run C: Deterministic Tie-Breaker ---');

    // Setup two candidates with IDENTICAL scores:
    // Candidate Tie A: 10/10 Apt, 20/20 Code, 25 mins taken
    // Candidate Tie B: 10/10 Apt, 20/20 Code, 40 mins taken
    const cTieA = await createCandidate('Tie Alpha', `USN_TIE_A_${Date.now()}`, `tie_a_${Date.now()}@test.com`);
    const cTieB = await createCandidate('Tie Beta', `USN_TIE_B_${Date.now()}`, `tie_b_${Date.now()}@test.com`);

    await setupTestWithResponses(cTieA.id, {
      status: 'evaluated',
      aptitudeMarks: 10,
      codingMarks: 20,
      codingEvalStatus: 'COMPLETED',
      timeTakenMins: 25, // FASTER
      violationsCount: 0
    });

    await setupTestWithResponses(cTieB.id, {
      status: 'evaluated',
      aptitudeMarks: 10,
      codingMarks: 20,
      codingEvalStatus: 'COMPLETED',
      timeTakenMins: 40, // SLOWER
      violationsCount: 0
    });

    const resTie = await calculateShortlist({
      round: 1,
      templateId: template.id,
      config: configA
    });

    const tieARank = resTie.candidates.find(c => c.studentId === cTieA.id);
    const tieBRank = resTie.candidates.find(c => c.studentId === cTieB.id);

    assert(tieARank?.rankingScore === tieBRank?.rankingScore, 'Both tie candidates have identical ranking score');
    assert(Boolean(tieARank && tieBRank && tieARank.rank !== null && tieBRank.rank !== null && tieARank.rank < tieBRank.rank), 
      'Tie candidate with faster test completion time is deterministically ranked higher');

    // =============================================================
    // TEST RUN D: Zero Maximum Marks & Missing Category Safety
    // =============================================================
    console.log('\n--- Test Run D: Missing / Zero Maximum Marks Safeguard ---');

    // Configure a category that has 0 questions in this test (e.g. AI_LITERACY)
    const configZeroMax: ShortlistConfig = {
      shortlistSize: 10,
      overallCutoffEnabled: false,
      overallCutoffPercentage: 60,
      sectionCutoffs: {
        AI_LITERACY: 50 // Category with 0 questions in test
      },
      overallWeight: 50,
      sectionWeight: 50,
      categoryWeights: {
        CODING: 50,
        AI_LITERACY: 50
      }
    };

    // Must not crash or produce NaN
    const resZero = await calculateShortlist({
      round: 1,
      templateId: template.id,
      config: configZeroMax
    });
    assert(!isNaN(resZero.candidates[0]?.rankingScore), 'Calculation with 0 max points category produces valid number, not NaN');

    // =============================================================
    // TEST RUN E: APIs & Workflow (Settings, Preview, Publish, Invalidation)
    // =============================================================
    console.log('\n--- Test Run E: APIs & Workflow ---');

    // 1. Save Settings via POST /api/admin/shortlist/settings
    const saveSettingsReq = new NextRequest('http://localhost:3000/api/admin/shortlist/settings', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        round: 1,
        templateId: template.id,
        shortlistSize: 15,
        overallCutoffEnabled: true,
        overallCutoffPercentage: 65,
        sectionCutoffs: { CODING: 40 },
        overallWeight: 40,
        sectionWeight: 60,
        categoryWeights: { CODING: 80, APTITUDE: 20 }
      })
    });
    const saveSettingsRes = await postSettingsRoute(saveSettingsReq);
    assert(saveSettingsRes.status === 200, 'POST /api/admin/shortlist/settings returns 200');
    const saveSettingsData = await saveSettingsRes.json();
    assert(saveSettingsData.settings.shortlistSize === 15, 'Saved settings reflects shortlistSize = 15');

    // 2. Retrieve Settings via GET /api/admin/shortlist/settings
    const getSettingsReq = new NextRequest(
      `http://localhost:3000/api/admin/shortlist/settings?round=1&templateId=${template.id}`,
      { headers: { authorization: `Bearer ${adminToken}` } }
    );
    const getSettingsRes = await getSettingsRoute(getSettingsReq);
    assert(getSettingsRes.status === 200, 'GET /api/admin/shortlist/settings returns 200');
    const getSettingsData = await getSettingsRes.json();
    assert(getSettingsData.settings.overallWeight === 40, 'GET settings returns saved overallWeight (40%)');
    assert(getSettingsData.settings.sectionWeight === 60, 'GET settings returns saved sectionWeight (60%)');

    // 3. Preview Shortlist via POST /api/admin/shortlist/preview
    const previewReq = new NextRequest('http://localhost:3000/api/admin/shortlist/preview', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        round: 1,
        templateId: template.id
      })
    });
    const previewRes = await previewShortlistRoute(previewReq);
    assert(previewRes.status === 200, 'POST /api/admin/shortlist/preview returns 200');
    const previewData = await previewRes.json();
    assert(Array.isArray(previewData.result.candidates), 'Preview returns ranked candidates array');

    // 4. Publish Shortlist via POST /api/admin/shortlist/publish
    const publishReq = new NextRequest('http://localhost:3000/api/admin/shortlist/publish', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        round: 1,
        templateId: template.id
      })
    });
    const publishRes = await publishShortlistRoute(publishReq);
    assert(publishRes.status === 200, 'POST /api/admin/shortlist/publish returns 200');
    const publishData = await publishRes.json();
    assert(publishData.publishedId !== undefined, 'Publish returns generated publishedId');
    createdPublishedIds.push(publishData.publishedId);

    // 5. Retrieve Published Shortlist via GET /api/admin/shortlist
    const getPublishedReq = new NextRequest(
      `http://localhost:3000/api/admin/shortlist?round=1&templateId=${template.id}`,
      { headers: { authorization: `Bearer ${adminToken}` } }
    );
    const getPublishedRes = await getShortlistRoute(getPublishedReq);
    assert(getPublishedRes.status === 200, 'GET /api/admin/shortlist returns 200');
    const getPublishedData = await getPublishedRes.json();
    assert(getPublishedData.isPublished === true, 'GET shortlist reports isPublished: true');
    assert(getPublishedData.isStale === false, 'Initially published shortlist is not stale');
    assert(getPublishedData.shortlist.candidates.length > 0, 'Published shortlist contains persisted candidates');

    // 6. Test Data Invalidation & Staleness Detection:
    // Update one candidate test record (simulate re-evaluation or test update)
    await prisma.test.update({
      where: { id: createdTestIds[0] },
      data: { updated_at: new Date(Date.now() + 5000) }
    });

    const getStaleReq = new NextRequest(
      `http://localhost:3000/api/admin/shortlist?round=1&templateId=${template.id}`,
      { headers: { authorization: `Bearer ${adminToken}` } }
    );
    const getStaleRes = await getShortlistRoute(getStaleReq);
    const getStaleData = await getStaleRes.json();
    assert(getStaleData.isStale === true, 'Shortlist endpoint detects stale data when source test is updated');
    assert(getStaleData.staleReason !== null, 'Shortlist endpoint provides actionable staleReason message');

    // =============================================================
    // TEST RUN F: Security & Authorization Safeguards
    // =============================================================
    console.log('\n--- Test Run F: Security & Authorization Safeguards ---');

    // 1. Unauthenticated request rejected
    const unauthReq = new NextRequest('http://localhost:3000/api/admin/shortlist/settings');
    const unauthRes = await getSettingsRoute(unauthReq);
    assert(unauthRes.status === 401, 'Settings endpoint rejects unauthenticated request with 401');

    // 2. Student role rejected
    const studentReq = new NextRequest('http://localhost:3000/api/admin/shortlist/settings', {
      headers: { authorization: `Bearer ${studentToken}` }
    });
    const studentRes = await getSettingsRoute(studentReq);
    assert(studentRes.status === 403, 'Settings endpoint rejects student token with 403');

    const studentPubReq = new NextRequest('http://localhost:3000/api/admin/shortlist/publish', {
      method: 'POST',
      headers: { authorization: `Bearer ${studentToken}` }
    });
    const studentPubRes = await publishShortlistRoute(studentPubReq);
    assert(studentPubRes.status === 403, 'Publish endpoint rejects student token with 403');

  } catch (error) {
    console.error('❌ Test execution encountered an unhandled exception:', error);
    failed++;
  } finally {
    // -------------------------------------------------------------
    // Cleanup Test Fixtures
    // -------------------------------------------------------------
    console.log('\n--- Cleaning up test fixtures ---');
    try {
      if (createdPublishedIds.length > 0) {
        await prisma.shortlistCandidate.deleteMany({
          where: { shortlist_id: { in: createdPublishedIds } }
        });
        await prisma.publishedShortlist.deleteMany({
          where: { id: { in: createdPublishedIds } }
        });
      }

      await prisma.shortlistSetting.deleteMany({
        where: {
          template_id: { in: createdTemplateIds }
        }
      });

      if (createdTestIds.length > 0) {
        await prisma.shortlistCandidate.deleteMany({
          where: { test_id: { in: createdTestIds } }
        });
        await prisma.aIEvaluation.deleteMany({
          where: { test_id: { in: createdTestIds } }
        });
        await prisma.testResponse.deleteMany({
          where: { test_id: { in: createdTestIds } }
        });
        await prisma.testQuestion.deleteMany({
          where: { test_id: { in: createdTestIds } }
        });
        await prisma.testAnalytics.deleteMany({
          where: { test_id: { in: createdTestIds } }
        });
        await prisma.test.deleteMany({
          where: { id: { in: createdTestIds } }
        });
      }

      if (createdQuestionIds.length > 0) {
        await prisma.question.deleteMany({
          where: { id: { in: createdQuestionIds } }
        });
      }

      if (createdTemplateIds.length > 0) {
        await prisma.testTemplate.deleteMany({
          where: { id: { in: createdTemplateIds } }
        });
      }

      if (createdUserIds.length > 0) {
        await prisma.student.deleteMany({
          where: { user_id: { in: createdUserIds } }
        });
        await prisma.user.deleteMany({
          where: { id: { in: createdUserIds } }
        });
      }
      console.log('  Cleaned up all shortlisting test fixtures cleanly.');
    } catch (cleanupErr) {
      console.warn('  Fixture cleanup warning:', cleanupErr);
    }
  }

  console.log('\n============================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runDynamicShortlistingTests()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
