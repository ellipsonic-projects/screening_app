import { Metadata } from 'next';
import { ShortlistManager } from '@/components/admin/shortlist-manager';

export const metadata: Metadata = {
  title: 'Candidate Shortlisting & Ranking - EllipHire Console',
  description: 'Approach B Dynamic Candidate Shortlisting, Ranking Weights, and Official Publication',
};

export default function ShortlistPage() {
  return <ShortlistManager />;
}
