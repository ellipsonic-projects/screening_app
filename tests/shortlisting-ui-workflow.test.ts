import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { GET as getAssessments } from '../app/api/admin/shortlist/assessments/route';
import { GET as getSettings, POST as saveSettings } from '../app/api/admin/shortlist/settings/route';
import { POST as previewShortlist } from '../app/api/admin/shortlist/preview/route';
import { POST as publishShortlist } from '../app/api/admin/shortlist/publish/route';
import { GET as getPublishedShortlist } from '../app/api/admin/shortlist/route';
import { GET as exportShortlist } from '../app/api/admin/shortlist/export/route';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

function createToken(role: string, userId: string = '00000000-0000-0000-0000-000000000001'): string {
  return jwt.sign({ userId, role, email: 'admin@portal.com' }, JWT_SECRET, { expiresIn: '1h' });
}

async function runUIWorkflowTests() {
  console.log('\n============================================================');
  console.log('🧪 RUNNING DYNAMIC SHORTLISTING ADMIN UI WORKFLOW INTEGRATION TESTS');
  console.log('============================================================\n');

  let adminUser = await prisma.user.findFirst({
    where: { role: { in: ['admin', 'super_admin'] } }
  });
  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        email: `ui_test_admin_${Date.now()}@portal.com`,
        password_hash: 'hash',
        role: 'admin'
      }
    });
  }

  const adminToken = createToken(adminUser.role, adminUser.id);
  const studentToken = createToken('student', '00000000-0000-0000-0000-000000000002');

  const testStudentEmailPrefix = 'ui_test_shortlist_';
  const createdQuestionIds: string[] = [];

  // Cleanup any lingering artifacts from previous runs
  await prisma.publishedShortlist.deleteMany({ where: { round: 999 } });
  await prisma.shortlistSetting.deleteMany({ where: { round: 999 } });
  await prisma.test.deleteMany({ where: { round: 999 } });
  await prisma.user.deleteMany({ where: { email: { startsWith: testStudentEmailPrefix } } });

  try {
    // -------------------------------------------------------------
    // Step 1: Assessments & Rounds Metadata Endpoint (for UI Dropdowns)
    // -------------------------------------------------------------
    console.log('--- Step 1: Assessments & Rounds Metadata for Dropdowns ---');
    {
      const req = new NextRequest('http://localhost:3000/api/admin/shortlist/assessments', {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const res = await getAssessments(req);
      assert.equal(res.status, 200, 'GET /api/admin/shortlist/assessments must return 200');
      const data = await res.json();
      assert.ok(Array.isArray(data.templates), 'Must return templates array');
      assert.ok(Array.isArray(data.rounds), 'Must return rounds array');
      assert.ok(data.rounds.includes(1), 'Rounds must include Round 1');
      assert.ok(data.rounds.includes(2), 'Rounds must include Round 2');
      console.log('  ✅ PASSED: Assessments and rounds dropdown metadata retrieved successfully');
    }

    // -------------------------------------------------------------
    // Step 2: Settings Initial Load (Default Settings Fallback)
    // -------------------------------------------------------------
    console.log('\n--- Step 2: Settings Initial Load & Default Fallback ---');
    {
      const req = new NextRequest('http://localhost:3000/api/admin/shortlist/settings?round=999', {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const res = await getSettings(req);
      assert.equal(res.status, 200, 'GET /api/admin/shortlist/settings must return 200');
      const data = await res.json();
      assert.equal(data.isDefault, true, 'Brand new round must report isDefault: true');
      assert.equal(data.settings.shortlistSize, 10, 'Default shortlist size must be 10');
      assert.equal(data.settings.overallWeight, 50, 'Default overall weight must be 50%');
      assert.equal(data.settings.sectionWeight, 50, 'Default section weight must be 50%');
      assert.equal(data.settings.overallCutoffEnabled, false, 'Overall cutoff must be disabled by default');
      console.log('  ✅ PASSED: Initial settings load correctly returns defaults when not configured');
    }

    // -------------------------------------------------------------
    // Step 3: Configure Settings, Save & Verify Server Persistence
    // -------------------------------------------------------------
    console.log('\n--- Step 3: Save Settings (Configure & Persist) ---');
    {
      const saveReq = new NextRequest('http://localhost:3000/api/admin/shortlist/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          round: 999,
          templateId: null,
          shortlistSize: 20,
          overallCutoffEnabled: true,
          overallCutoffPercentage: 65,
          sectionCutoffs: {
            CODING: 50,
            APTITUDE: 40
          },
          overallWeight: 40,
          sectionWeight: 60,
          categoryWeights: {
            CODING: 70,
            APTITUDE: 30
          }
        })
      });
      const saveRes = await saveSettings(saveReq);
      assert.equal(saveRes.status, 200, 'POST /api/admin/shortlist/settings must return 200');
      const saveData = await saveRes.json();
      assert.equal(saveData.settings.shortlistSize, 20);
      assert.equal(saveData.settings.overallCutoffEnabled, true);
      assert.equal(saveData.settings.overallCutoffPercentage, 65);
      assert.equal(saveData.settings.overallWeight, 40);
      assert.equal(saveData.settings.sectionWeight, 60);

      // Verify GET returns persisted settings
      const getReq = new NextRequest('http://localhost:3000/api/admin/shortlist/settings?round=999', {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const getRes = await getSettings(getReq);
      const getData = await getRes.json();
      assert.equal(getData.isDefault, false, 'Must report isDefault: false once configured');
      assert.equal(getData.settings.shortlistSize, 20);
      assert.equal(getData.settings.overallWeight, 40);
      assert.equal(getData.settings.sectionWeight, 60);
      console.log('  ✅ PASSED: Shortlisting settings persisted and retrieved successfully');
    }

    // -------------------------------------------------------------
    // Step 4: Seed Test Candidates & Attempt Data for Round 999
    // -------------------------------------------------------------
    console.log('\n--- Step 4: Seed Candidate Test Data for Workflow Testing ---');
    // Questions: 1 Aptitude (50 pts), 1 Coding (50 pts)
    const qApt = await prisma.question.create({
      data: {
        question_text: `UI Test Aptitude Question ${Date.now()}`,
        type: 'mcq',
        points: 50,
        section: 'APTITUDE',
        created_by: adminUser.id,
        is_published: true
      }
    });
    createdQuestionIds.push(qApt.id);

    const qCode = await prisma.question.create({
      data: {
        question_text: `UI Test Coding Question ${Date.now()}`,
        type: 'coding',
        points: 50,
        section: 'CODING',
        created_by: adminUser.id,
        is_published: true
      }
    });
    createdQuestionIds.push(qCode.id);

    async function createStudent(name: string, usn: string, email: string) {
      const u = await prisma.user.create({
        data: {
          email,
          password_hash: 'hash',
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
      return u.student!;
    }

    const sA = await createStudent('Test Candidate A (High Performer)', '1RV26CS901', `${testStudentEmailPrefix}a@test.com`);
    const sB = await createStudent('Test Candidate B (Moderate Performer)', '1RV26CS902', `${testStudentEmailPrefix}b@test.com`);
    const sC = await createStudent('Test Candidate C (Section Cutoff Failed)', '1RV26CS903', `${testStudentEmailPrefix}c@test.com`);
    const sD = await createStudent('Test Candidate D (Pending Evaluation)', '1RV26CS904', `${testStudentEmailPrefix}d@test.com`);

    async function createTestAttempt(
      studentId: string, 
      aptMarks: number, 
      codeMarks: number, 
      status: string, 
      evalStatus: 'COMPLETED' | 'PENDING' | 'FAILED' = 'COMPLETED'
    ) {
      const test = await prisma.test.create({
        data: {
          student_id: studentId,
          round: 999,
          title: 'Round 999 Test Attempt',
          status,
          score: status === 'evaluated' ? (aptMarks + codeMarks) : null,
          total_duration: 60,
          start_time: new Date(Date.now() - 30 * 60000),
          end_time: status !== 'in_progress' ? new Date() : null,
          violations_count: 0,
          test_questions: {
            create: [
              { question_id: qApt.id, sequence_number: 1 },
              { question_id: qCode.id, sequence_number: 2 }
            ]
          }
        }
      });

      if (status !== 'in_progress') {
        await prisma.testResponse.create({
          data: {
            test_id: test.id,
            question_id: qApt.id,
            student_answer: 'Option A',
            is_correct: aptMarks === 50,
            points_earned: aptMarks,
            evaluation_status: 'COMPLETED'
          }
        });

        await prisma.testResponse.create({
          data: {
            test_id: test.id,
            question_id: qCode.id,
            student_answer: 'code',
            is_correct: codeMarks === 50,
            points_earned: codeMarks,
            evaluation_status: evalStatus
          }
        });
      }

      return test;
    }

    // Candidate A: 45/50 Aptitude (90%), 45/50 Coding (90%) -> Overall 90%
    await createTestAttempt(sA.id, 45, 45, 'evaluated');
    // Candidate B: 35/50 Aptitude (70%), 35/50 Coding (70%) -> Overall 70%
    await createTestAttempt(sB.id, 35, 35, 'evaluated');
    // Candidate C: 48/50 Aptitude (96%), 20/50 Coding (40%) -> Coding fails 50% cutoff!
    await createTestAttempt(sC.id, 48, 20, 'evaluated');
    // Candidate D: in_progress
    const testD = await createTestAttempt(sD.id, 0, 0, 'in_progress');

    console.log('  ✅ PASSED: Test fixture candidates and scorecard records created');

    // -------------------------------------------------------------
    // Step 5: Preview Ranking Execution
    // -------------------------------------------------------------
    console.log('\n--- Step 5: Preview Ranking & UI Metrics ---');
    {
      const prevReq = new NextRequest('http://localhost:3000/api/admin/shortlist/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          round: 999,
          templateId: null
        })
      });
      const prevRes = await previewShortlist(prevReq);
      assert.equal(prevRes.status, 200, 'POST /api/admin/shortlist/preview must return 200');
      const prevData = await prevRes.json();
      const result = prevData.result;

      assert.equal(result.summary.totalUniqueCandidates, 4, 'Must evaluate 4 unique candidates');
      assert.equal(result.summary.qualifiedCount, 2, 'Candidates A and B must qualify');
      assert.equal(result.summary.disqualifiedCount, 1, 'Candidate C must be disqualified (failed Coding cutoff)');
      assert.equal(result.summary.pendingReviewCount, 1, 'Candidate D must be pending review (evaluating status)');

      // Verify Candidate A details
      const candA = result.candidates.find((c: any) => c.fullName.includes('Candidate A'));
      assert.ok(candA, 'Candidate A must be present in rankings');
      assert.equal(candA.rank, 1, 'Candidate A must be Rank 1');
      assert.equal(candA.shortlistStatus, 'shortlisted');

      // Verify Candidate C disqualification details
      const candC = result.candidates.find((c: any) => c.fullName.includes('Candidate C'));
      assert.ok(candC, 'Candidate C must be present');
      assert.equal(candC.shortlistStatus, 'disqualified');
      assert.equal(candC.rank, null, 'Disqualified candidate must have null rank');
      assert.ok(candC.exclusionReasons.some((r: string) => r.includes('Coding & Debugging')), 'Exclusion reason must name Coding & Debugging');

      // Verify Candidate D pending review details
      const candD = result.candidates.find((c: any) => c.fullName.includes('Candidate D'));
      assert.ok(candD, 'Candidate D must be present');
      assert.equal(candD.shortlistStatus, 'pending_review');
      assert.equal(candD.needsReview, true);
      console.log('  ✅ PASSED: Preview correctly ranks candidates, checks cutoffs, and flags pending evaluations');
    }

    // -------------------------------------------------------------
    // Step 6: Dynamic Recalculation (What-If In-Memory Settings)
    // -------------------------------------------------------------
    console.log('\n--- Step 6: Dynamic In-Memory Recalculation ---');
    {
      // Admin adjusts settings in memory: relaxes Coding cutoff to 35%
      const prevReq = new NextRequest('http://localhost:3000/api/admin/shortlist/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          round: 999,
          config: {
            shortlistSize: 20,
            overallCutoffEnabled: true,
            overallCutoffPercentage: 65,
            sectionCutoffs: {
              CODING: 35 // Relaxed from 50% to 35%
            },
            overallWeight: 50,
            sectionWeight: 50,
            categoryWeights: { CODING: 50, APTITUDE: 50 }
          }
        })
      });
      const prevRes = await previewShortlist(prevReq);
      const prevData = await prevRes.json();
      const result = prevData.result;

      // With relaxed Coding cutoff (35%), Candidate C (Coding 40%) now qualifies!
      assert.equal(result.summary.qualifiedCount, 3, 'Candidate C must now qualify with relaxed cutoff');
      const candC = result.candidates.find((c: any) => c.fullName.includes('Candidate C'));
      assert.equal(candC.shortlistStatus, 'shortlisted', 'Candidate C is now shortlisted');
      assert.ok(candC.rank !== null, 'Candidate C now has a valid rank');
      console.log('  ✅ PASSED: In-memory dynamic recalculation instantly updates rankings before saving or publishing');
    }

    // -------------------------------------------------------------
    // Step 7: Review & Publish Shortlist
    // -------------------------------------------------------------
    console.log('\n--- Step 7: Review & Publish Shortlist ---');
    let publishedId: string;
    {
      const pubReq = new NextRequest('http://localhost:3000/api/admin/shortlist/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          round: 999,
          templateId: null
        })
      });
      const pubRes = await publishShortlist(pubReq);
      assert.equal(pubRes.status, 200, 'POST /api/admin/shortlist/publish must return 200');
      const pubData = await pubRes.json();
      assert.ok(pubData.publishedId, 'Must return generated publishedId');
      publishedId = pubData.publishedId;
      assert.equal(pubData.shortlistedCandidatesCount, 2, 'Must publish 2 shortlisted candidates');
      console.log('  ✅ PASSED: Candidate shortlist published successfully');
    }

    // -------------------------------------------------------------
    // Step 8: View Published Shortlist & Verify Initial Staleness
    // -------------------------------------------------------------
    console.log('\n--- Step 8: View Published Shortlist ---');
    {
      const getReq = new NextRequest('http://localhost:3000/api/admin/shortlist?round=999', {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const getRes = await getPublishedShortlist(getReq);
      assert.equal(getRes.status, 200, 'GET /api/admin/shortlist must return 200');
      const getData = await getRes.json();
      assert.equal(getData.isPublished, true);
      assert.equal(getData.isStale, false, 'Newly published shortlist must not be stale');
      assert.equal(getData.shortlist.id, publishedId);
      assert.equal(getData.shortlist.candidates.length, 4);
      assert.equal(getData.shortlist.shortlistedCount, 2);
      console.log('  ✅ PASSED: Published shortlist snapshot retrieved accurately');
    }

    // -------------------------------------------------------------
    // Step 9: Staleness Detection (Source Attempt Updated Post-Publish)
    // -------------------------------------------------------------
    console.log('\n--- Step 9: Staleness Detection Verification ---');
    {
      // Wait 100ms so timestamp is strictly greater, then update Candidate D's test
      await new Promise(r => setTimeout(r, 100));
      await prisma.test.update({
        where: { id: testD.id },
        data: {
          status: 'evaluated',
          score: 85,
          updated_at: new Date()
        }
      });

      const getReq = new NextRequest('http://localhost:3000/api/admin/shortlist?round=999', {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const getRes = await getPublishedShortlist(getReq);
      const getData = await getRes.json();
      assert.equal(getData.isStale, true, 'Shortlist must report isStale: true when source tests update');
      assert.ok(getData.staleReason, 'Must provide actionable stale reason');
      console.log('  ✅ PASSED: Data staleness correctly detected and flagged for re-publication');
    }

    // -------------------------------------------------------------
    // Step 10: Excel Export Integration
    // -------------------------------------------------------------
    console.log('\n--- Step 10: Excel Workbook Export ---');
    {
      const exportReq = new NextRequest('http://localhost:3000/api/admin/shortlist/export?round=999', {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const exportRes = await exportShortlist(exportReq);
      assert.equal(exportRes.status, 200, 'GET /api/admin/shortlist/export must return 200');
      const contentType = exportRes.headers.get('content-type');
      assert.ok(contentType?.includes('spreadsheetml'), 'Content type must be Excel spreadsheet');
      console.log('  ✅ PASSED: Excel export generates downloadable candidate ranking spreadsheet');
    }

    // -------------------------------------------------------------
    // Step 11: Authorization & Student Protection Safeguards
    // -------------------------------------------------------------
    console.log('\n--- Step 11: Security & Student Safeguards ---');
    {
      // Unauthenticated
      const unauthReq = new NextRequest('http://localhost:3000/api/admin/shortlist?round=999');
      const unauthRes = await getPublishedShortlist(unauthReq);
      assert.equal(unauthRes.status, 401, 'Unauthenticated request must be rejected with 401');

      // Student token access
      const studentReq = new NextRequest('http://localhost:3000/api/admin/shortlist?round=999', {
        headers: { Authorization: `Bearer ${studentToken}` }
      });
      const studentRes = await getPublishedShortlist(studentReq);
      assert.equal(studentRes.status, 403, 'Student token must be rejected with 403 Forbidden');
      console.log('  ✅ PASSED: Unauthorized and student access blocked server-side');
    }

  } finally {
    // CLEANUP
    console.log('\n--- Cleaning up UI test fixtures ---');
    await prisma.publishedShortlist.deleteMany({ where: { round: 999 } });
    await prisma.shortlistSetting.deleteMany({ where: { round: 999 } });
    await prisma.test.deleteMany({ where: { round: 999 } });
    if (createdQuestionIds.length > 0) {
      await prisma.testQuestion.deleteMany({ where: { question_id: { in: createdQuestionIds } } });
      await prisma.testResponse.deleteMany({ where: { question_id: { in: createdQuestionIds } } });
      await prisma.question.deleteMany({ where: { id: { in: createdQuestionIds } } });
    }
    await prisma.user.deleteMany({ where: { email: { startsWith: testStudentEmailPrefix } } });
    console.log('  Cleaned up all UI test fixtures cleanly.\n');
  }

  console.log('============================================================');
  console.log('📊 ALL ADMIN UI WORKFLOW INTEGRATION TESTS PASSED!');
  console.log('============================================================\n');
}

runUIWorkflowTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
