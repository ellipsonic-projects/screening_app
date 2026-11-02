'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';

export default function AdminLayout({
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
      } else if (user && user.role !== 'admin' && user.role !== 'super_admin') {
        router.push('/student/dashboard');
      }
    }
  }, [user, isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated || (user && user.role !== 'admin' && user.role !== 'super_admin')) {
    return <div className="flex justify-center items-center h-screen bg-slate-50 text-slate-600 font-medium text-sm">Checking permissions...</div>;
  }

  return children;
}
