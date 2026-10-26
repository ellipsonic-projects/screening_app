import 'dotenv/config';
import prisma from './lib/prisma';
import bcryptjs from 'bcryptjs';

async function main() {
  console.log('Resetting database...');

  // Delete all existing data in order to avoid foreign key violations
  await prisma.testAnalytics.deleteMany({});
  await prisma.violation.deleteMany({});
  await prisma.testResponse.deleteMany({});
  await prisma.testQuestion.deleteMany({});
  await prisma.test.deleteMany({});
  await prisma.question.deleteMany({});
  await prisma.student.deleteMany({});
  await prisma.admin.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.testTemplate.deleteMany({});

  console.log('Seeding Super Admin...');
  const passwordHash = await bcryptjs.hash('superadminpassword', 10);
  
  const superAdminUser = await prisma.user.create({
    data: {
      email: 'superadmin@portal.com',
      password_hash: passwordHash,
      role: 'super_admin',
    },
  });

  await prisma.admin.create({
    data: {
      user_id: superAdminUser.id,
      full_name: 'Super Admin',
      department: 'Recruitment',
    },
  });

  console.log('Database successfully reset and seeded!');
  console.log('Initial Super Admin: superadmin@portal.com / superadminpassword');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
