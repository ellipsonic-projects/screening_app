'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { useAuth } from '@/context/auth-context';
import { Users, ClipboardList, Target, BookOpen, Settings, ArrowRight, User, LogOut } from 'lucide-react';
import { BrandLogo } from '@/components/common/BrandLogo';

export function AdminDashboard() {
  const { user, logout } = useAuth();
  const [analytics, setAnalytics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/admin/analytics', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAnalytics(response.data.analytics);
    } catch (error) {
      console.error('[Analytics Load Error]', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = '/auth/login';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F3F7FD] flex justify-center items-center">
        <div className="flex items-center gap-3 text-[#10234E] font-medium text-sm">
          <div className="w-5 h-5 border-2 border-[#1760FF] border-t-transparent rounded-full animate-spin" />
          <span>Loading Console Dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F3F7FD] relative overflow-x-hidden text-[#10234E] font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Decorative Background Waves & Curves Matching Reference Screenshot */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
        {/* Base Canvas Soft Radial Glow */}
        <div 
          className="absolute inset-0" 
          style={{
            background: 'radial-gradient(circle at 50% 45%, #F7FAFE 0%, #EEF5FD 60%, #E6F1FC 100%)'
          }}
        />

        {/* Unified Full-Viewport Decorative SVG Curves & Waves */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 1440 900"
          fill="none"
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="topRightGrad" x1="1440" y1="0" x2="820" y2="420" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#BCDDFC" stopOpacity="0.82" />
              <stop offset="45%" stopColor="#D2E8FD" stopOpacity="0.55" />
              <stop offset="85%" stopColor="#E8F4FE" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#F0F6FD" stopOpacity="0" />
            </linearGradient>

            <linearGradient id="topRightInnerGrad" x1="1440" y1="0" x2="1040" y2="280" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#A9D3FB" stopOpacity="0.5" />
              <stop offset="60%" stopColor="#C9E3FD" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#E2F1FE" stopOpacity="0" />
            </linearGradient>

            <linearGradient id="leftArcGrad" x1="0" y1="200" x2="420" y2="520" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#CCE4FD" stopOpacity="0.65" />
              <stop offset="55%" stopColor="#DEEFFE" stopOpacity="0.38" />
              <stop offset="100%" stopColor="#F0F6FD" stopOpacity="0" />
            </linearGradient>

            <linearGradient id="bottomWave1" x1="0" y1="580" x2="1440" y2="700" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#D5EAFF" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#C4E1FE" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#DBEDFE" stopOpacity="0.5" />
            </linearGradient>

            <linearGradient id="bottomWave2" x1="0" y1="680" x2="1440" y2="780" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#B7DCFC" stopOpacity="0.72" />
              <stop offset="55%" stopColor="#C9E5FD" stopOpacity="0.62" />
              <stop offset="100%" stopColor="#DFEFFE" stopOpacity="0.4" />
            </linearGradient>

            <linearGradient id="bottomWave3" x1="0" y1="780" x2="1440" y2="880" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#A8D4FC" stopOpacity="0.78" />
              <stop offset="50%" stopColor="#BEDFFD" stopOpacity="0.68" />
              <stop offset="100%" stopColor="#D7EBFE" stopOpacity="0.5" />
            </linearGradient>

            <linearGradient id="bottomCorner" x1="880" y1="900" x2="1440" y2="760" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#9FCFFB" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#CAE5FE" stopOpacity="0.25" />
            </linearGradient>
          </defs>

          <path
            d="M1440 0 L 860 0 C 860 210, 1020 390, 1440 440 Z"
            fill="url(#topRightGrad)"
          />
          <path
            d="M1440 0 L 1060 0 C 1060 150, 1190 280, 1440 300 Z"
            fill="url(#topRightInnerGrad)"
          />
          <path
            d="M0 140 C 230 200, 340 350, 260 550 C 190 670, 90 710, 0 750 Z"
            fill="url(#leftArcGrad)"
          />
          <path
            d="M0 620 C 310 670, 670 610, 1030 530 C 1210 490, 1360 550, 1440 590 L 1440 900 L 0 900 Z"
            fill="url(#bottomWave1)"
          />
          <path
            d="M0 710 C 280 750, 540 690, 800 610 C 1100 520, 1310 610, 1440 670 L 1440 900 L 0 900 Z"
            fill="url(#bottomWave2)"
          />
          <path
            d="M0 790 C 330 810, 670 770, 990 700 C 1210 650, 1350 680, 1440 720 L 1440 900 L 0 900 Z"
            fill="url(#bottomWave3)"
          />
          <path
            d="M860 900 C 1050 840, 1270 770, 1440 800 L 1440 900 Z"
            fill="url(#bottomCorner)"
          />
        </svg>
      </div>

      {/* Main Foreground Container */}
      <div className="relative z-10 w-full max-w-[1340px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-16 flex flex-col">
        {/* Header Bar */}
        <header className="w-full bg-white rounded-2xl sm:rounded-[22px] border border-[#DCE5F0] shadow-[0_2px_12px_rgba(16,35,78,0.03)] px-5 sm:px-8 py-3.5 sm:py-4 flex items-center justify-between min-h-[68px]">
          {/* Left: Brand Logo & CONSOLE badge */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <BrandLogo size="md" className="flex-row items-center" />
            <span className="px-2.5 py-0.5 rounded-full bg-[#EEF5FF] text-[#1760FF] text-[11px] font-bold tracking-wider uppercase">
              CONSOLE
            </span>
          </div>

          {/* Right: ADMIN MODE, Profile, Logout */}
          <div className="flex items-center gap-3 sm:gap-5">
            <span className="hidden sm:inline-flex items-center px-3.5 py-1 rounded-full bg-[#EEF5FF]/80 border border-[#BFDBFE] text-[#1760FF] text-[11px] font-bold tracking-wide uppercase">
              ADMIN MODE
            </span>

            <Link
              href="/admin/profile"
              className="flex items-center gap-1.5 text-xs font-semibold text-[#10234E] hover:text-[#1760FF] transition-colors"
            >
              <User className="w-4 h-4 text-[#10234E]" />
              <span>Profile</span>
            </Link>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-full border border-[#DCE5F0] text-xs font-semibold text-[#10234E] hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <span>Logout</span>
              <LogOut className="w-3.5 h-3.5 text-[#10234E]" />
            </button>
          </div>
        </header>

        {/* Dashboard Introduction */}
        <section className="mt-8 sm:mt-10 mb-6 sm:mb-7 text-left">
          <h1 className="text-[26px] sm:text-[28px] font-bold text-[#10234E] tracking-tight">
            Console Dashboard
          </h1>
          <p className="text-sm font-normal text-[#607797] mt-1">
            Welcome back, {user?.email || 'superadmin@portal.com'}
          </p>
        </section>

        {/* Statistics Cards Row */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {/* Card 1: TOTAL STUDENTS */}
          <div className="bg-white rounded-[22px] border border-[#DCE5F0] p-6 flex items-center gap-5 shadow-[0_2px_8px_rgba(16,35,78,0.02)] min-h-[140px] text-left">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-[18px] bg-[#EAF2FE] text-[#1760FF] flex items-center justify-center flex-shrink-0">
              <Users className="w-7 h-7" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#607797]">
                TOTAL STUDENTS
              </p>
              <p className="text-2xl sm:text-[28px] font-bold text-[#10234E] leading-tight mt-1">
                {analytics?.totalStudents ?? 0}
              </p>
            </div>
          </div>

          {/* Card 2: TOTAL TESTS */}
          <div className="bg-white rounded-[22px] border border-[#DCE5F0] p-6 flex items-center gap-5 shadow-[0_2px_8px_rgba(16,35,78,0.02)] min-h-[140px] text-left">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-[18px] bg-[#E8FAF6] text-[#0D9488] flex items-center justify-center flex-shrink-0">
              <ClipboardList className="w-7 h-7" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#607797]">
                TOTAL TESTS
              </p>
              <p className="text-2xl sm:text-[28px] font-bold text-[#10234E] leading-tight mt-1">
                {analytics?.totalTests ?? 0}
              </p>
            </div>
          </div>

          {/* Card 3: AVERAGE SCORE */}
          <div className="bg-white rounded-[22px] border border-[#DCE5F0] p-6 flex items-center gap-5 shadow-[0_2px_8px_rgba(16,35,78,0.02)] min-h-[140px] text-left sm:col-span-2 lg:col-span-1">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-[18px] bg-[#F2EFFE] text-[#7C3AED] flex items-center justify-center flex-shrink-0">
              <Target className="w-7 h-7" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#607797]">
                AVERAGE SCORE
              </p>
              <p className="text-2xl sm:text-[28px] font-bold text-[#10234E] leading-tight mt-1">
                {analytics?.averageScore ?? 0} Pts
              </p>
            </div>
          </div>
        </section>

        {/* Management Workspaces Section */}
        <section className="mt-9 sm:mt-11">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#607797] mb-4 text-left">
            MANAGEMENT WORKSPACES
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {/* Workspace 1: Question Bank */}
            <Link href="/admin/questions" className="block group">
              <div className="bg-white rounded-[20px] border border-[#DCE5F0] p-6 sm:p-7 flex flex-col justify-between min-h-[250px] sm:h-[255px] shadow-[0_2px_8px_rgba(16,35,78,0.02)] hover:border-[#BFDBFE] hover:shadow-md transition-all duration-200 cursor-pointer text-left">
                <div className="flex items-center justify-between">
                  <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-[#EAF2FE] text-[#1760FF] flex items-center justify-center">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div className="w-9 h-9 rounded-full bg-[#F3F7FD] flex items-center justify-center text-[#607797] group-hover:bg-[#EEF5FF] group-hover:text-[#1760FF] transition-all">
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
                <div className="mt-6">
                  <h3 className="text-xl font-bold text-[#10234E]">
                    Question Bank
                  </h3>
                  <p className="text-[13px] sm:text-sm text-[#607797] leading-relaxed mt-2">
                    Central Question repository to create, edit, and import MCQ or coding questions.
                  </p>
                </div>
              </div>
            </Link>

            {/* Workspace 2: Test Settings */}
            <Link href="/admin/test-settings" className="block group">
              <div className="bg-white rounded-[20px] border border-[#DCE5F0] p-6 sm:p-7 flex flex-col justify-between min-h-[250px] sm:h-[255px] shadow-[0_2px_8px_rgba(16,35,78,0.02)] hover:border-[#BFDBFE] hover:shadow-md transition-all duration-200 cursor-pointer text-left">
                <div className="flex items-center justify-between">
                  <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-[#F2EFFE] text-[#7C3AED] flex items-center justify-center">
                    <Settings className="w-6 h-6" />
                  </div>
                  <div className="w-9 h-9 rounded-full bg-[#F3F7FD] flex items-center justify-center text-[#607797] group-hover:bg-[#EEF5FF] group-hover:text-[#1760FF] transition-all">
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
                <div className="mt-6">
                  <h3 className="text-xl font-bold text-[#10234E]">
                    Test Settings
                  </h3>
                  <p className="text-[13px] sm:text-sm text-[#607797] leading-relaxed mt-2">
                    Configure the master aptitude test duration and limits.
                  </p>
                </div>
              </div>
            </Link>

            {/* Workspace 3: Student Directory */}
            <Link href="/admin/students" className="block group sm:col-span-2 lg:col-span-1">
              <div className="bg-white rounded-[20px] border border-[#DCE5F0] p-6 sm:p-7 flex flex-col justify-between min-h-[250px] sm:h-[255px] shadow-[0_2px_8px_rgba(16,35,78,0.02)] hover:border-[#BFDBFE] hover:shadow-md transition-all duration-200 cursor-pointer text-left">
                <div className="flex items-center justify-between">
                  <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-[#E8FAF6] text-[#0D9488] flex items-center justify-center">
                    <Users className="w-6 h-6" />
                  </div>
                  <div className="w-9 h-9 rounded-full bg-[#F3F7FD] flex items-center justify-center text-[#607797] group-hover:bg-[#EEF5FF] group-hover:text-[#1760FF] transition-all">
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
                <div className="mt-6">
                  <h3 className="text-xl font-bold text-[#10234E]">
                    Student Directory
                  </h3>
                  <p className="text-[13px] sm:text-sm text-[#607797] leading-relaxed mt-2">
                    Monitor candidate registrations, live test attempts, scorecard logs, and violations.
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
