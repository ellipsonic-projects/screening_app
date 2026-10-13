import 'dotenv/config';

import { generateToken } from '../lib/auth';
import prisma from '../lib/prisma';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runTest(name: string, fn: () => Promise<void>) {
  try {
    process.stdout.write(`  ⏳ ${name}... `);
    await fn();
    console.log('✅ PASSED');
    results.push({ name, passed: true });
  } catch (err: any) {
    console.log('❌ FAILED');
    console.error(`     Error: ${err.message}`);
    results.push({ name, passed: false, error: err.message });
  }
}

async function main() {
  console.log('\n🚀 Running Aptitude Screening Portal Auth & Profile Test Suite...\n');
  const timestamp = Date.now();
  const testEmail1 = `test_audit_${timestamp}_1@example.com`;
  const testEmail2 = `test_audit_${timestamp}_2@example.com`;
  const testUsn1 = `USN_${timestamp}_1`;
  const testPassword = 'Password123!';

  let token1 = '';
  let user1Id = '';
  let token2 = '';
  let user2Id = '';

  try {
    // ----------------------------------------------------
    // TEST 1: Unauthorized access without token
    // ----------------------------------------------------
    await runTest('Unauthorized access returns 401', async () => {
      const resVerify = await fetch(`${BASE_URL}/api/auth/verify`);
      assert(resVerify.status === 401, `Verify expected 401, got ${resVerify.status}`);

      const resGetProfile = await fetch(`${BASE_URL}/api/students/profile`);
      assert(resGetProfile.status === 401, `GET Profile expected 401, got ${resGetProfile.status}`);

      const resPostProfile = await fetch(`${BASE_URL}/api/students/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert(resPostProfile.status === 401, `POST Profile expected 401, got ${resPostProfile.status}`);
    });

    // ----------------------------------------------------
    // TEST 2: Stale JWT (deleted or non-existent user)
    // ----------------------------------------------------
    await runTest('Stale JWT for non-existent/deleted account is rejected with 401', async () => {
      const nonExistentUserId = '00000000-0000-4000-a000-000000000099';
      const staleToken = generateToken({
        userId: nonExistentUserId,
        email: 'deleted_user@example.com',
        role: 'student',
      });

      // 1. /api/auth/verify must reject with 401
      const resVerify = await fetch(`${BASE_URL}/api/auth/verify`, {
        headers: { Authorization: `Bearer ${staleToken}` },
      });
      assert(resVerify.status === 401, `Verify with stale token expected 401, got ${resVerify.status}`);
      const bodyVerify = await resVerify.json();
      assert(bodyVerify.message.includes('not found') || bodyVerify.message.includes('deactivated'), `Unexpected message: ${bodyVerify.message}`);

      // 2. GET /api/students/profile must reject with 401 (not 404!)
      const resGet = await fetch(`${BASE_URL}/api/students/profile`, {
        headers: { Authorization: `Bearer ${staleToken}` },
      });
      assert(resGet.status === 401, `GET profile with stale token expected 401, got ${resGet.status}`);

      // 3. POST /api/students/profile must reject with 401 (not 400 or 500!)
      const resPost = await fetch(`${BASE_URL}/api/students/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staleToken}`,
        },
        body: JSON.stringify({
          email: 'deleted_user@example.com',
          fullName: 'Deleted User',
          phone: '9876543210',
          college: 'Test College',
          usn: 'STALE_USN',
          branchName: 'CSE',
        }),
      });
      assert(resPost.status === 401, `POST profile with stale token expected 401, got ${resPost.status}`);
    });

    // ----------------------------------------------------
    // TEST 3: New student registration
    // ----------------------------------------------------
    await runTest('Register new student account successfully', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail1,
          password: testPassword,
          confirmPassword: testPassword,
          role: 'student',
        }),
      });
      assert(res.status === 201, `Registration expected 201, got ${res.status}`);
      const data = await res.json();
      assert(data.success === true, 'Response success should be true');
      assert(data.data.token, 'Token must be present');
      assert(data.data.user.email === testEmail1.toLowerCase(), 'Email should match');
      token1 = data.data.token;
      user1Id = data.data.user.id;
    });

    // ----------------------------------------------------
    // TEST 4: Verify token of newly registered student
    // ----------------------------------------------------
    await runTest('Verify token returns 200 for active registered student', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/verify`, {
        headers: { Authorization: `Bearer ${token1}` },
      });
      assert(res.status === 200, `Verify expected 200, got ${res.status}`);
      const data = await res.json();
      assert(data.user.id === user1Id, 'User ID should match registered user');
      assert(data.user.email === testEmail1.toLowerCase(), 'User email should match');
      assert(data.user.role === 'student', 'User role should be student');
    });

    // ----------------------------------------------------
    // TEST 5: Profile retrieval for newly registered student
    // ----------------------------------------------------
    await runTest('GET /api/students/profile returns 200 with profileCompleted=false', async () => {
      const res = await fetch(`${BASE_URL}/api/students/profile`, {
        headers: { Authorization: `Bearer ${token1}` },
      });
      assert(res.status === 200, `GET profile expected 200, got ${res.status}`);
      const data = await res.json();
      assert(data.student, 'Student object must exist');
      assert(data.student.email === testEmail1.toLowerCase(), 'Email should match user email');
      assert(data.student.profileCompleted === false, 'profileCompleted should be false before completion');
    });

    // ----------------------------------------------------
    // TEST 6: Validation errors on profile update
    // ----------------------------------------------------
    await runTest('POST /api/students/profile rejects invalid phone format with 400', async () => {
      const res = await fetch(`${BASE_URL}/api/students/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token1}`,
        },
        body: JSON.stringify({
          email: testEmail1,
          fullName: 'Valid Name',
          phone: '12345', // Invalid: not 10 digits
          college: 'Engineering College',
          usn: testUsn1,
          branchName: 'CSE',
        }),
      });
      assert(res.status === 400, `Expected 400, got ${res.status}`);
      const data = await res.json();
      assert(data.message.includes('10 digits'), `Expected 10 digits error, got: ${data.message}`);
    });

    // ----------------------------------------------------
    // TEST 7: Valid profile update
    // ----------------------------------------------------
    await runTest('POST /api/students/profile successfully updates student profile', async () => {
      const res = await fetch(`${BASE_URL}/api/students/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token1}`,
        },
        body: JSON.stringify({
          email: testEmail1,
          fullName: 'Test Candidate',
          phone: '9876543210',
          college: 'Test Institute of Technology',
          usn: testUsn1,
          branchName: 'Computer Science',
          cameraPermission: true,
          microphonePermission: true,
        }),
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const data = await res.json();
      assert(data.student.full_name === 'Test Candidate', 'Full name should be updated');
      assert(data.student.usn === testUsn1, 'USN should be updated');
      assert(data.student.profile_completed === true, 'profile_completed should be true');

      // Verify persistence via GET
      const resGet = await fetch(`${BASE_URL}/api/students/profile`, {
        headers: { Authorization: `Bearer ${token1}` },
      });
      const dataGet = await resGet.json();
      assert(dataGet.student.fullName === 'Test Candidate', 'Fetched name matches');
      assert(dataGet.student.profileCompleted === true, 'profileCompleted persisted as true');
    });

    // ----------------------------------------------------
    // TEST 8: Duplicate USN conflict
    // ----------------------------------------------------
    await runTest('Duplicate USN across different students is rejected with 400', async () => {
      // Register second student
      const resReg = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail2,
          password: testPassword,
          confirmPassword: testPassword,
          role: 'student',
        }),
      });
      assert(resReg.status === 201, `Reg 2 expected 201, got ${resReg.status}`);
      const dataReg = await resReg.json();
      token2 = dataReg.data.token;
      user2Id = dataReg.data.user.id;

      // Attempt to use testUsn1 which belongs to student 1
      const resDup = await fetch(`${BASE_URL}/api/students/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token2}`,
        },
        body: JSON.stringify({
          email: testEmail2,
          fullName: 'Second Student',
          phone: '9876543211',
          college: 'Another College',
          usn: testUsn1, // Conflicting USN
          branchName: 'ECE',
        }),
      });
      assert(resDup.status === 400 || resDup.status === 409, `Expected 400/409, got ${resDup.status}`);
      const dataDup = await resDup.json();
      assert(dataDup.message.includes('already registered'), `Expected 'already registered', got: ${dataDup.message}`);
    });

    // ----------------------------------------------------
    // TEST 9: Deleting student and re-registering with same email
    // ----------------------------------------------------
    await runTest('Deleting user from database and re-registering with same email succeeds', async () => {
      // 1. Delete test student 1 from database directly (simulating developer/admin account reset)
      await prisma.user.delete({
        where: { id: user1Id }
      });

      // 2. Confirm old token1 is now immediately rejected by /api/auth/verify
      const resVerifyOld = await fetch(`${BASE_URL}/api/auth/verify`, {
        headers: { Authorization: `Bearer ${token1}` },
      });
      assert(resVerifyOld.status === 401, `Old token after deletion expected 401, got ${resVerifyOld.status}`);

      // 3. Confirm old token1 is rejected by /api/students/profile
      const resGetProfileOld = await fetch(`${BASE_URL}/api/students/profile`, {
        headers: { Authorization: `Bearer ${token1}` },
      });
      assert(resGetProfileOld.status === 401, `Old token profile fetch expected 401, got ${resGetProfileOld.status}`);

      // 4. Re-register with the same email
      const resReReg = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail1,
          password: testPassword,
          confirmPassword: testPassword,
          role: 'student',
        }),
      });
      assert(resReReg.status === 201, `Re-registration expected 201, got ${resReReg.status}`);
      const dataReReg = await resReReg.json();
      const newToken1 = dataReReg.data.token;
      const newUserId1 = dataReReg.data.user.id;
      assert(newUserId1 !== user1Id, 'New user should have a new unique UUID');

      // 5. Fetch profile with new token -> 200 OK
      const resNewGet = await fetch(`${BASE_URL}/api/students/profile`, {
        headers: { Authorization: `Bearer ${newToken1}` },
      });
      assert(resNewGet.status === 200, `New profile fetch expected 200, got ${resNewGet.status}`);

      // 6. Complete profile update with new token -> 200 OK
      const resNewPost = await fetch(`${BASE_URL}/api/students/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${newToken1}`,
        },
        body: JSON.stringify({
          email: testEmail1,
          fullName: 'Re-registered Candidate',
          phone: '9123456789',
          college: 'Fresh College',
          usn: `NEW_USN_${Date.now()}`,
          branchName: 'AIML',
        }),
      });
      assert(resNewPost.status === 200, `New profile save expected 200, got ${resNewPost.status}`);
      const dataNewPost = await resNewPost.json();
      assert(dataNewPost.student.profile_completed === true, 'Profile completed should be true');

      // Clean up re-registered user
      await prisma.user.delete({ where: { id: newUserId1 } });
    });

    // ----------------------------------------------------
    // TEST 10: Admin login with correct credentials
    // ----------------------------------------------------
    await runTest('Admin login with valid password succeeds with 200 and super_admin role', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'superadmin@portal.com',
          password: 'Admin@123',
        }),
      });
      assert(res.status === 200, `Admin login expected 200, got ${res.status}`);
      const data = await res.json();
      assert(data.success === true, 'Success should be true');
      assert(data.data.user.role === 'super_admin', 'Role should be super_admin');
      assert(data.data.token, 'Token should be present');
    });

    // ----------------------------------------------------
    // TEST 11: Admin login with whitespace in email
    // ----------------------------------------------------
    await runTest('Admin login with leading/trailing email whitespace normalizes and succeeds with 200', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: '   superadmin@portal.com   ',
          password: 'Admin@123',
        }),
      });
      assert(res.status === 200, `Admin login with whitespace expected 200, got ${res.status}`);
      const data = await res.json();
      assert(data.success === true, 'Success should be true');
      assert(data.data.user.email === 'superadmin@portal.com', 'Normalized email matches');
    });

    // ----------------------------------------------------
    // TEST 12: Admin login with incorrect password
    // ----------------------------------------------------
    await runTest('Admin login with incorrect password is rejected with 401', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'superadmin@portal.com',
          password: 'wrong_password_attempt',
        }),
      });
      assert(res.status === 401, `Admin login with wrong password expected 401, got ${res.status}`);
      const data = await res.json();
      assert(data.success === false, 'Success should be false');
      assert(data.error?.code === 'INVALID_CREDENTIALS', 'Error code should be INVALID_CREDENTIALS');
    });

    // ----------------------------------------------------
    // TEST 13: Student login verification
    // ----------------------------------------------------
    await runTest('Student login with valid credentials succeeds with 200', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail2,
          password: testPassword,
        }),
      });
      assert(res.status === 200, `Student login expected 200, got ${res.status}`);
      const data = await res.json();
      assert(data.data.user.role === 'student', 'Student role matches');
    });

  } finally {
    // Cleanup any lingering test users
    console.log('\n🧹 Cleaning up test users...');
    try {
      if (user2Id) {
        await prisma.user.deleteMany({ where: { id: user2Id } });
      }
    } catch (e) {
      // ignore cleanup errors
    }
    await prisma.$disconnect();
  }

  console.log('\n========================================');
  console.log('           TEST SUITE SUMMARY           ');
  console.log('========================================');
  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;
  console.log(`Passed: ${passedCount}/${totalCount}`);

  if (passedCount === totalCount) {
    console.log('🎉 ALL TESTS PASSED!\n');
    process.exit(0);
  } else {
    console.log('❌ SOME TESTS FAILED!\n');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
