'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.push('/auth/login');
      } else if (user && user.role !== 'student') {
        router.push('/admin/dashboard');
      }
    }
  }, [user, isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated || (user && user.role !== 'student')) {
    return <div className="flex justify-center items-center h-screen bg-slate-50 text-slate-600 font-medium text-sm">Checking permissions...</div>;
  }

  return children;
}
