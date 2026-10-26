import prisma from '../lib/prisma';
import { GET as getEvaluationRoute } from '../app/api/admin/evaluation/route';
import { GET as getResultRoute } from '../app/api/admin/results/[testId]/route';
import { GET as getStudentsRoute } from '../app/api/admin/students/route';
import { GET as getExcelExportRoute } from '../app/api/admin/export/excel/route';
import { GET as getTestsRoute } from '../app/api/tests/route';
import { GET as getActiveTestRoute } from '../app/api/tests/active/route';
import { POST as publishRound2Route } from '../app/api/admin/tests/publish-round-2/route';
import { generateToken } from '../lib/auth';
import { NextRequest } from 'next/server';
import ExcelJS from 'exceljs';

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

async function runAssessmentRoundSeparationTests() {
  console.log('\n============================================================');
  console.log('🧪 RUNNING ASSESSMENT & ROUND SEPARATION TEST SUITE');
  console.log('============================================================\n');

  // Track created fixtures for cleanup
  const createdTestIds: string[] = [];
  const createdTemplateIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdQuestionIds: string[] = [];

  try {
    // -------------------------------------------------------------
    // 1. Setup Admin fixture
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

    // -------------------------------------------------------------
    // 2. Setup Student fixtures: Student Alpha and Student Beta
    // -------------------------------------------------------------
    const studentUserA = await prisma.user.create({
      data: {
        email: `sep_student_alpha_${Date.now()}@example.com`,
        password_hash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
        role: 'student',
        student: {
          create: {
            full_name: 'Separation Candidate Alpha',
            usn: `SEP_USN_ALPHA_${Date.now()}`,
            branch_name: 'Computer Science',
            profile_completed: true
          }
        }
      },
      include: { student: true }
    });
    createdUserIds.push(studentUserA.id);
    const studentA = studentUserA.student!;

    const tokenA = generateToken({
      userId: studentUserA.id,
      email: studentUserA.email,
      role: 'student'
    });

    const studentUserB = await prisma.user.create({
      data: {
        email: `sep_student_beta_${Date.now()}@example.com`,
        password_hash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
        role: 'student',
        student: {
          create: {
            full_name: 'Separation Candidate Beta',
            usn: `SEP_USN_BETA_${Date.now()}`,
            branch_name: 'Electronics',
            profile_completed: true
          }
        }
      },
      include: { student: true }
    });
    createdUserIds.push(studentUserB.id);
    const studentB = studentUserB.student!;

    const tokenB = generateToken({
      userId: studentUserB.id,
      email: studentUserB.email,
      role: 'student'
    });

    // -------------------------------------------------------------
    // 3. Setup Assessment Templates: Template 1 & Template 2
    // -------------------------------------------------------------
    const template1 = await prisma.testTemplate.create({
      data: {
        name: `Engineering Assessment Alpha ${Date.now()}`,
        description: 'Software Engineering Campus Screening',
        total_questions: 10,
        total_duration: 60,
        created_by: adminUser.id,
        is_active: true
      }
    });
    createdTemplateIds.push(template1.id);

    const template2 = await prisma.testTemplate.create({
      data: {
        name: `Hardware Assessment Beta ${Date.now()}`,
        description: 'Embedded Systems Hardware Screening',
        total_questions: 10,
        total_duration: 45,
        created_by: adminUser.id,
        is_active: true
      }
    });
    createdTemplateIds.push(template2.id);

    // Setup a Question for Round 2 publishing test
    const r2Question = await prisma.question.create({
      data: {
        question_text: `Technical Coding Challenge ${Date.now()}?`,
        type: 'coding',
        points: 25,
        section: 'CODING',
        created_by: adminUser.id,
        is_published: true
      }
    });
    createdQuestionIds.push(r2Question.id);

    // =============================================================
    // TEST SECTION A: Backward Compatibility & Schema Defaults
    // =============================================================
    console.log('--- Subtest A: Schema Defaults and Existing Record Compatibility ---');
    
    // Create a historical-like test attempt without explicit round or template_id
    const legacyTest = await prisma.test.create({
      data: {
        student_id: studentA.id,
        status: 'evaluated',
        score: 75.0,
        total_duration: 60,
        start_time: new Date(),
        end_time: new Date()
      }
    });
    createdTestIds.push(legacyTest.id);

    assert(legacyTest.round === 1, 'Default round for legacy test records is 1');
    assert(legacyTest.template_id === null, 'Default template_id for unlinked legacy tests is null');

    // =============================================================
    // TEST SECTION B: Isolation Between Different Assessments
    // =============================================================
    console.log('\n--- Subtest B: Isolation Between Different Assessments / Templates ---');

    // Student A takes Assessment Alpha (Template 1)
    const testA1 = await prisma.test.create({
      data: {
        student_id: studentA.id,
        template_id: template1.id,
        round: 1,
        title: 'Alpha Screening Round 1',
        status: 'evaluated',
        score: 85.0,
        total_duration: 60,
        start_time: new Date(Date.now() - 3600000),
        end_time: new Date()
      }
    });
    createdTestIds.push(testA1.id);

    // Student B takes Assessment Beta (Template 2)
    const testB1 = await prisma.test.create({
      data: {
        student_id: studentB.id,
        template_id: template2.id,
        round: 1,
        title: 'Beta Screening Round 1',
        status: 'evaluated',
        score: 92.0,
        total_duration: 45,
        start_time: new Date(Date.now() - 3600000),
        end_time: new Date()
      }
    });
    createdTestIds.push(testB1.id);

    // Query admin evaluations filtered by Template 1
    const evalTemplate1Req = new NextRequest(
      `http://localhost:3000/api/admin/evaluation?templateId=${template1.id}`,
      { headers: { authorization: `Bearer ${adminToken}` } }
    );
    const evalTemplate1Res = await getEvaluationRoute(evalTemplate1Req);
    const evalTemplate1Data = await evalTemplate1Res.json();

    assert(evalTemplate1Data.tests.some((t: any) => t.id === testA1.id), 'Evaluation filter includes test linked to Template 1');
    assert(!evalTemplate1Data.tests.some((t: any) => t.id === testB1.id), 'Evaluation filter excludes test linked to Template 2');

    // Query admin evaluations filtered by Template 2
    const evalTemplate2Req = new NextRequest(
      `http://localhost:3000/api/admin/evaluation?templateId=${template2.id}`,
      { headers: { authorization: `Bearer ${adminToken}` } }
    );
    const evalTemplate2Res = await getEvaluationRoute(evalTemplate2Req);
    const evalTemplate2Data = await evalTemplate2Res.json();

    assert(evalTemplate2Data.tests.some((t: any) => t.id === testB1.id), 'Evaluation filter includes test linked to Template 2');
    assert(!evalTemplate2Data.tests.some((t: any) => t.id === testA1.id), 'Evaluation filter excludes test linked to Template 1');

    // =============================================================
    // TEST SECTION C: Round 1 and Round 2 Separation for Same Candidate
    // =============================================================
    console.log('\n--- Subtest C: Round 1 and Round 2 Separation for Same Candidate ---');

    // Publish Round 2 Assessment for Student A using the publish API
    const publishR2Req = new NextRequest('http://localhost:3000/api/admin/tests/publish-round-2', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        selectedStudentIds: [studentA.id],
        selectedQuestionIds: [r2Question.id],
        duration: 90,
        testTitle: 'Round 2 Technical Deep Dive',
        templateId: template1.id
      })
    });
    const publishR2Res = await publishRound2Route(publishR2Req);
    const publishR2Data = await publishR2Res.json();

    assert(publishR2Res.status === 200, 'Round 2 published successfully via admin endpoint');
    assert(publishR2Data.publishedCount === 1, 'Exactly 1 Round 2 test created for candidate');

    // Find the newly created Round 2 test
    const r2Test = await prisma.test.findFirst({
      where: {
        student_id: studentA.id,
        round: 2
      }
    });
    assert(r2Test !== null, 'Round 2 test record exists in the database');
    if (r2Test) {
      createdTestIds.push(r2Test.id);
      assert(r2Test.round === 2, 'New test attempt is explicitly marked as round: 2');
      assert(r2Test.title === 'Round 2 Technical Deep Dive', 'Round 2 test has the configured title');
      assert(r2Test.template_id === template1.id, 'Round 2 test is associated with Template 1');
    }

    // Check that Student A's Round 1 test still exists untouched
    const r1TestAfter = await prisma.test.findUnique({
      where: { id: testA1.id }
    });
    assert(r1TestAfter !== null, 'Round 1 test record still exists');
    assert(r1TestAfter?.round === 1, 'Round 1 test remains round: 1');
    assert(Number(r1TestAfter?.score) === 85.0, 'Round 1 test score is completely preserved and not overwritten');

    // Candidate has at least 2 distinct test attempts now
    const allStudentATests = await prisma.test.findMany({
      where: { student_id: studentA.id },
      orderBy: { round: 'asc' }
    });
    assert(allStudentATests.length >= 2, 'Candidate has multiple distinct test records without collisions');

    // Test candidate active test retrieval for round 1 vs round 2
    const activeR1Req = new NextRequest('http://localhost:3000/api/tests/active?round=1', {
      headers: { authorization: `Bearer ${tokenA}` }
    });
    const activeR1Res = await getActiveTestRoute(activeR1Req);
    const activeR1Data = await activeR1Res.json();
    assert(activeR1Data.round === 1, 'Active test retrieval with ?round=1 returns round 1 test attempt');

    const activeR2Req = new NextRequest('http://localhost:3000/api/tests/active?round=2', {
      headers: { authorization: `Bearer ${tokenA}` }
    });
    const activeR2Res = await getActiveTestRoute(activeR2Req);
    const activeR2Data = await activeR2Res.json();
    assert(activeR2Data.round === 2, 'Active test retrieval with ?round=2 returns round 2 test attempt');
    assert(activeR2Data.testId === r2Test?.id, 'Active test retrieval returns the correct test ID for round 2');

    // =============================================================
    // TEST SECTION D: Scoped Result Retrieval and Round Breakdown
    // =============================================================
    console.log('\n--- Subtest D: Scoped Result Retrieval & Round Breakdown ---');

    // Query admin evaluations scoped to round 1
    const evalR1Req = new NextRequest('http://localhost:3000/api/admin/evaluation?round=1', {
      headers: { authorization: `Bearer ${adminToken}` }
    });
    const evalR1Res = await getEvaluationRoute(evalR1Req);
    const evalR1Data = await evalR1Res.json();

    assert(evalR1Data.tests.some((t: any) => t.id === testA1.id), 'Round 1 evaluation results include candidate Round 1 test');
    assert(!evalR1Data.tests.some((t: any) => t.id === r2Test?.id), 'Round 1 evaluation results strictly exclude Round 2 test');

    // Query admin evaluations scoped to round 2
    const evalR2Req = new NextRequest('http://localhost:3000/api/admin/evaluation?round=2', {
      headers: { authorization: `Bearer ${adminToken}` }
    });
    const evalR2Res = await getEvaluationRoute(evalR2Req);
    const evalR2Data = await evalR2Res.json();

    assert(evalR2Data.tests.some((t: any) => t.id === r2Test?.id), 'Round 2 evaluation results include candidate Round 2 test');
    assert(!evalR2Data.tests.some((t: any) => t.id === testA1.id), 'Round 2 evaluation results strictly exclude Round 1 test');

    // Query single test result endpoint for Round 1
    const resR1Req = new NextRequest(`http://localhost:3000/api/admin/results/${testA1.id}`, {
      headers: { authorization: `Bearer ${adminToken}` }
    });
    const resR1Res = await getResultRoute(resR1Req, { params: Promise.resolve({ testId: testA1.id }) });
    const resR1Data = await resR1Res.json();

    assert(resR1Data.data.round === 1, 'Single test result endpoint returns round: 1');
    assert(resR1Data.data.title === 'Alpha Screening Round 1', 'Single test result endpoint returns correct title');
    assert(resR1Data.data.templateId === template1.id, 'Single test result endpoint returns templateId');
    assert(resR1Data.data.templateName === template1.name, 'Single test result endpoint returns templateName');

    // Query single test result endpoint for Round 2
    if (r2Test) {
      const resR2Req = new NextRequest(`http://localhost:3000/api/admin/results/${r2Test.id}`, {
        headers: { authorization: `Bearer ${adminToken}` }
      });
      const resR2Res = await getResultRoute(resR2Req, { params: Promise.resolve({ testId: r2Test.id }) });
      const resR2Data = await resR2Res.json();

      assert(resR2Data.data.round === 2, 'Single test result endpoint returns round: 2');
      assert(resR2Data.data.title === 'Round 2 Technical Deep Dive', 'Single test result endpoint returns Round 2 title');
      assert(resR2Data.data.templateId === template1.id, 'Single test result endpoint returns Round 2 templateId');
    }

    // Query Admin Students API and check round breakdown
    const studentsReq = new NextRequest('http://localhost:3000/api/admin/students', {
      headers: { authorization: `Bearer ${adminToken}` }
    });
    const studentsRes = await getStudentsRoute(studentsReq);
    const studentsData = await studentsRes.json();

    const studentARecord = studentsData.students.find((s: any) => s.id === studentA.id);
    assert(studentARecord !== undefined, 'Admin students list includes Student A');
    assert(Array.isArray(studentARecord?.rounds), 'Student record contains rounds breakdown array');
    assert(studentARecord?.rounds.some((r: any) => r.round === 1), 'Student rounds breakdown contains round 1 attempt');
    assert(studentARecord?.rounds.some((r: any) => r.round === 2), 'Student rounds breakdown contains round 2 attempt');

    // =============================================================
    // TEST SECTION E: Excel Export Scoping and Multi-Attempt Integrity
    // =============================================================
    console.log('\n--- Subtest E: Excel Export Scoping & Multi-Attempt Integrity ---');

    // 1. Export filtered by round 1
    const excelR1Req = new NextRequest('http://localhost:3000/api/admin/export/excel?round=1', {
      headers: { authorization: `Bearer ${adminToken}` }
    });
    const excelR1Res = await getExcelExportRoute(excelR1Req);
    assert(excelR1Res.status === 200, 'Excel export for round 1 succeeded with status 200');
    const r1Buffer = await excelR1Res.arrayBuffer();
    const wb1 = new ExcelJS.Workbook();
    await wb1.xlsx.load(Buffer.from(r1Buffer) as any);
    const summarySheet1 = wb1.getWorksheet('Student Summary');
    assert(summarySheet1 !== undefined, 'Excel workbook contains Student Summary sheet');

    // Verify all rows in Sheet 1 have round === 1 (or 'N/A' for not started students)
    let foundR2InR1Sheet = false;
    summarySheet1?.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        const roundVal = row.getCell(5).value; // Column 5 is Round
        if (roundVal === 2) {
          foundR2InR1Sheet = true;
        }
      }
    });
    assert(!foundR2InR1Sheet, 'Round 1 Excel export strictly contains no Round 2 rows');

    // 2. Export filtered by round 2
    const excelR2Req = new NextRequest('http://localhost:3000/api/admin/export/excel?round=2', {
      headers: { authorization: `Bearer ${adminToken}` }
    });
    const excelR2Res = await getExcelExportRoute(excelR2Req);
    assert(excelR2Res.status === 200, 'Excel export for round 2 succeeded with status 200');
    const r2Buffer = await excelR2Res.arrayBuffer();
    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.load(Buffer.from(r2Buffer) as any);
    const summarySheet2 = wb2.getWorksheet('Student Summary');

    let foundR1InR2Sheet = false;
    summarySheet2?.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        const roundVal = row.getCell(5).value; // Column 5 is Round
        if (roundVal === 1) {
          foundR1InR2Sheet = true;
        }
      }
    });
    assert(!foundR1InR2Sheet, 'Round 2 Excel export strictly contains no Round 1 rows');

    // 3. Export unfiltered: candidate with multiple tests must have separate rows for each attempt
    const excelAllReq = new NextRequest('http://localhost:3000/api/admin/export/excel', {
      headers: { authorization: `Bearer ${adminToken}` }
    });
    const excelAllRes = await getExcelExportRoute(excelAllReq);
    const allBuffer = await excelAllRes.arrayBuffer();
    const wbAll = new ExcelJS.Workbook();
    await wbAll.xlsx.load(Buffer.from(allBuffer) as any);
    const summarySheetAll = wbAll.getWorksheet('Student Summary');

    let studentARoundsInSummary: number[] = [];
    summarySheetAll?.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        const usnVal = row.getCell(2).value;
        if (usnVal === studentA.usn) {
          studentARoundsInSummary.push(Number(row.getCell(5).value));
        }
      }
    });
    assert(studentARoundsInSummary.includes(1) && studentARoundsInSummary.includes(2), 
      'Unfiltered Excel export preserves both Round 1 and Round 2 rows without dropping or overwriting either');

    // =============================================================
    // TEST SECTION F: Authorization & Prevention of Cross-Assessment Data Leakage
    // =============================================================
    console.log('\n--- Subtest F: Authorization & Prevention of Cross-Assessment Leakage ---');

    // 1. Unauthenticated request to admin evaluation
    const noAuthReq = new NextRequest('http://localhost:3000/api/admin/evaluation');
    const noAuthRes = await getEvaluationRoute(noAuthReq);
    assert(noAuthRes.status === 401, 'Admin evaluation rejects request without auth token with 401');

    // 2. Student requesting admin evaluations
    const studentAsAdminReq = new NextRequest('http://localhost:3000/api/admin/evaluation', {
      headers: { authorization: `Bearer ${tokenA}` }
    });
    const studentAsAdminRes = await getEvaluationRoute(studentAsAdminReq);
    assert(studentAsAdminRes.status === 403, 'Admin evaluation rejects student token with 403');

    // 3. Candidate test list scoping: Student A should ONLY see Student A's tests
    const studentATestsReq = new NextRequest('http://localhost:3000/api/tests', {
      headers: { authorization: `Bearer ${tokenA}` }
    });
    const studentATestsRes = await getTestsRoute(studentATestsReq);
    const studentATestsData = await studentATestsRes.json();

    assert(studentATestsData.tests.some((t: any) => t.id === testA1.id), 'Candidate can view their own Round 1 test');
    if (r2Test) {
      assert(studentATestsData.tests.some((t: any) => t.id === r2Test.id), 'Candidate can view their own Round 2 test');
    }
    assert(!studentATestsData.tests.some((t: any) => t.id === testB1.id), 'Candidate CANNOT see tests belonging to another candidate (Zero cross-candidate leak)');

    // 4. Candidate B should ONLY see Candidate B's tests
    const studentBTestsReq = new NextRequest('http://localhost:3000/api/tests', {
      headers: { authorization: `Bearer ${tokenB}` }
    });
    const studentBTestsRes = await getTestsRoute(studentBTestsReq);
    const studentBTestsData = await studentBTestsRes.json();

    assert(studentBTestsData.tests.some((t: any) => t.id === testB1.id), 'Candidate B sees their own test');
    assert(!studentBTestsData.tests.some((t: any) => t.id === testA1.id), 'Candidate B CANNOT see Candidate A tests');

  } catch (error) {
    console.error('❌ Test execution encountered an unhandled exception:', error);
    failed++;
  } finally {
    // -------------------------------------------------------------
    // Cleanup Fixtures
    // -------------------------------------------------------------
    console.log('\n--- Cleaning up test fixtures ---');
    try {
      if (createdTestIds.length > 0) {
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
        await prisma.testResponse.deleteMany({
          where: { question_id: { in: createdQuestionIds } }
        });
        await prisma.testQuestion.deleteMany({
          where: { question_id: { in: createdQuestionIds } }
        });
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
      console.log('  Cleaned up all test fixtures cleanly.');
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

runAssessmentRoundSeparationTests()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
