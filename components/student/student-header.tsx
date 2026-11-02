'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, User, LogOut } from 'lucide-react';
import { BrandLogo } from '@/components/common/BrandLogo';
import { useAuth } from '@/context/auth-context';

interface StudentHeaderProps {
  badge?: string;
  showBackToDashboard?: boolean;
  showProfile?: boolean;
  showLogout?: boolean;
  showEmail?: boolean;
  variant?: 'card' | 'navbar';
}

export function StudentHeader({
  badge = 'STUDENT PORTAL',
  showBackToDashboard = false,
  showProfile = false,
  showLogout = false,
  showEmail = false,
  variant = 'card',
}: StudentHeaderProps) {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      window.location.href = '/auth/login';
    } catch (e) {
      console.error('Logout error', e);
    }
  };

  if (variant === 'navbar') {
    return (
      <header className="w-full bg-white border-b border-slate-200/80 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 h-16 flex items-center justify-between">
          {/* Left: Brand Logo, Divider, and CANDIDATE PORTAL Pill Badge */}
          <div className="flex items-center gap-3">
            <Link href="/student/dashboard" className="flex items-center gap-2 hover:opacity-95 transition-opacity">
              <BrandLogo size="md" className="flex-row items-center" />
            </Link>
            <span className="text-slate-300 font-light select-none">|</span>
            <span className="px-3 py-0.5 rounded-full bg-[#EEF5FF] text-[#1760FF] text-[11px] font-bold tracking-wider uppercase border border-[#BFDBFE]/60">
              {badge}
            </span>
          </div>

          {/* Right: My Profile, Email, Sign out */}
          <div className="flex items-center gap-5 sm:gap-7">
            {showProfile && (
              <Link
                href="/student/profile"
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#1760FF] transition-colors"
              >
                <User className="w-4 h-4 text-slate-500" />
                <span>My Profile</span>
              </Link>
            )}

            {showEmail && user?.email && (
              <span className="text-xs font-medium text-slate-600 hidden sm:inline-block">
                {user.email}
              </span>
            )}

            {showLogout && (
              <button
                onClick={handleLogout}
                className="text-xs font-semibold text-slate-600 hover:text-[#1760FF] transition-colors cursor-pointer"
              >
                Sign out
              </button>
            )}

            {showBackToDashboard && (
              <Link
                href="/student/dashboard"
                className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-full border border-[#DCE5F0] text-xs font-semibold text-[#10234E] hover:bg-slate-50 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-[#10234E]" />
                <span>Dashboard</span>
              </Link>
            )}
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="w-full bg-white rounded-2xl sm:rounded-[22px] border border-[#DCE5F0] shadow-[0_2px_12px_rgba(16,35,78,0.03)] px-5 sm:px-8 py-3.5 sm:py-4 flex items-center justify-between min-h-[68px]">
      {/* Left: Brand Logo & Pill Badge */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        <Link href="/student/dashboard" className="flex items-center gap-2 hover:opacity-95 transition-opacity">
          <BrandLogo size="md" className="flex-row items-center" />
        </Link>
        <span className="px-2.5 py-0.5 rounded-full bg-[#EEF5FF] text-[#1760FF] text-[11px] font-bold tracking-wider uppercase border border-[#BFDBFE]/60">
          {badge}
        </span>
      </div>

      {/* Right: Status Pill & Action Buttons */}
      <div className="flex items-center gap-3 sm:gap-4">
        <span className="hidden sm:inline-flex items-center px-3.5 py-1 rounded-full bg-[#EEF5FF]/80 border border-[#BFDBFE] text-[#1760FF] text-[11px] font-bold tracking-wide uppercase">
          CANDIDATE
        </span>

        {showBackToDashboard && (
          <Link
            href="/student/dashboard"
            className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-full border border-[#DCE5F0] text-xs font-semibold text-[#10234E] hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#10234E]" />
            <span>Dashboard</span>
          </Link>
        )}

        {showProfile && (
          <Link
            href="/student/profile"
            className="flex items-center gap-1.5 text-xs font-semibold text-[#10234E] hover:text-[#1760FF] transition-colors"
          >
            <User className="w-4 h-4 text-[#10234E]" />
            <span>Profile</span>
          </Link>
        )}

        {showLogout && (
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-full border border-[#DCE5F0] text-xs font-semibold text-[#10234E] hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <span>Logout</span>
            <LogOut className="w-3.5 h-3.5 text-[#10234E]" />
          </button>
        )}
      </div>
    </header>
  );
}
