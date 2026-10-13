import { TestInterface } from '@/components/test/test-interface';

export const metadata = {
  title: 'Assessment Instructions - EllipHire Aptitude Screening',
  description: 'Review assessment instructions and proctoring rules before starting your screening test',
};

export default async function TestPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  return <TestInterface testId={resolvedParams.id} />;
}
