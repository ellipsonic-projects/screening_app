import { StudentReport } from '@/components/admin/results/student-report';

export const metadata = {
  title: 'Student Assessment Report - EllipHire Console',
  description: 'View detailed student assessment report, performance summary and candidate answer evaluations',
};

export default function StudentReportPage() {
  return <StudentReport />;
}
