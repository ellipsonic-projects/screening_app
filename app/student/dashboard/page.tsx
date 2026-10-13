import { StudentDashboard } from '@/components/student/dashboard';

export const metadata = {
  title: 'Candidate Dashboard - EllipHire Aptitude Screening',
  description: 'View your screening assessments and current candidate progress',
};

export default function DashboardPage() {
  return <StudentDashboard />;
}
