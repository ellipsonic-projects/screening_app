'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/auth-context';
import { Clock, FileText, Layers, BadgeCheck, Play, CheckCircle, Loader2 } from 'lucide-react';
import { DecorativeBackground } from '@/components/common/DecorativeBackground';
import { StudentHeader } from '@/components/student/student-header';

interface Test {
  id: string;
  status: 'not_started' | 'in_progress' | 'submitted' | 'evaluated' | 'auto_submitted';
  totalDuration: number;
  score?: number;
  totalQuestions?: number;
  createdAt: string;
  results_published?: boolean;
  round?: number;
  title?: string;
  templateId?: string;
}

export function StudentDashboard() {
  const { user } = useAuth();
  const [tests, setTests] = useState<Test[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      
      try {
        const profileRes = await axios.get('/api/students/profile', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!profileRes.data.student?.profileCompleted) {
          window.location.href = '/student/profile';
          return;
        }
      } catch (err: any) {
        if (err.response?.status === 404) {
          window.location.href = '/student/profile';
          return;
        }
        throw err;
      }

      const testsRes = await axios.get('/api/tests', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (testsRes.data.tests && testsRes.data.tests.length > 0) {
        setTests(testsRes.data.tests);
      } else {
        // Automatically initialize assessment
        await axios.get('/api/tests/active', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const refetch = await axios.get('/api/tests', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setTests(refetch.data.tests || []);
      }
    } catch (error: any) {
      console.error('[Dashboard Load Error]', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F3F7FD] flex flex-col justify-center items-center font-sans">
        <DecorativeBackground />
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-12 h-12 rounded-2xl bg-[#EAF2FE] text-[#1760FF] flex items-center justify-center mb-4 shadow-sm">
            <Loader2 className="w-6 h-6 animate-spin text-[#1760FF]" />
          </div>
          <div className="text-[#607797] font-bold text-xs tracking-widest uppercase">Loading Portal...</div>
        </div>
      </div>
    );
  }

  const isCompleted = tests.length > 0 && ['submitted', 'evaluated', 'auto_submitted'].includes(tests[0].status);
  const isInProgress = tests.length > 0 && tests[0].status === 'in_progress';
  const currentTest = tests[0];

  return (
    <div className="min-h-screen bg-[#F3F7FD] relative overflow-x-hidden text-[#10234E] font-sans selection:bg-blue-100 selection:text-blue-900 flex flex-col">
      {/* Decorative Background Waves & Curves Matching Reference */}
      <DecorativeBackground />

      {/* Full-Width Candidate Portal Header */}
      <StudentHeader
        variant="navbar"
        badge="CANDIDATE PORTAL"
        showProfile
        showEmail
        showLogout
      />

      {/* Main Focus Container */}
      <main className="relative z-10 flex-1 max-w-4xl w-full mx-auto px-6 py-12 md:py-24 flex flex-col justify-center">
        {/* Eyebrow and Heading */}
        <div className="mb-8">
          <span className="text-xs font-bold uppercase tracking-widest text-[#7E92A9] block mb-2">
            CURRENT ASSESSMENT
          </span>
          <h1 className="text-3xl sm:text-4xl md:text-[44px] font-black text-[#10234E] tracking-tight leading-tight">
            {currentTest?.title || (currentTest?.round ? `Round ${currentTest.round} Assessment` : 'Round 1 Assessment')}
          </h1>
        </div>

        {/* Primary Assessment Card */}
        {!currentTest ? (
          <div className="bg-white border border-[#DCE5F0] rounded-2xl sm:rounded-[24px] shadow-[0_4px_25px_rgba(16,35,78,0.04)] p-12 text-center text-[#607797] font-medium">
            No assessment available at this time.
          </div>
        ) : (
          <div className="bg-white border border-[#DCE5F0] rounded-2xl sm:rounded-[24px] shadow-[0_4px_25px_rgba(16,35,78,0.04)] p-6 sm:p-8 md:p-10 space-y-8">
            {/* Meta Data 4-Column Grid with Subtle Dividers */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-0">
              {/* Metric 1: DURATION */}
              <div className="flex items-center gap-3.5 md:pr-6 md:border-r md:border-[#EEF3FA]">
                <div className="w-11 h-11 rounded-full bg-[#EBF3FE] text-[#1760FF] flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#7E92A9] block">
                    DURATION
                  </span>
                  <span className="text-[17px] sm:text-[18px] font-bold text-[#10234E]">
                    {currentTest.totalDuration || 60} Minutes
                  </span>
                </div>
              </div>

              {/* Metric 2: QUESTIONS */}
              <div className="flex items-center gap-3.5 md:px-6 md:border-r md:border-[#EEF3FA]">
                <div className="w-11 h-11 rounded-full bg-[#EBF3FE] text-[#1760FF] flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#7E92A9] block">
                    QUESTIONS
                  </span>
                  <span className="text-[17px] sm:text-[18px] font-bold text-[#10234E]">
                    {currentTest.totalQuestions ?? 42}
                  </span>
                </div>
              </div>

              {/* Metric 3: FORMAT */}
              <div className="flex items-center gap-3.5 md:px-6 md:border-r md:border-[#EEF3FA]">
                <div className="w-11 h-11 rounded-full bg-[#EBF3FE] text-[#1760FF] flex items-center justify-center shrink-0">
                  <Layers className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#7E92A9] block">
                    FORMAT
                  </span>
                  <span className="text-[17px] sm:text-[18px] font-bold text-[#10234E]">
                    Mixed Sections
                  </span>
                </div>
              </div>

              {/* Metric 4: STATUS */}
              <div className="flex items-center gap-3.5 md:pl-6">
                <div className="w-11 h-11 rounded-full bg-[#EBF3FE] text-[#1760FF] flex items-center justify-center shrink-0">
                  <BadgeCheck className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#7E92A9] block mb-1">
                    STATUS
                  </span>
                  <div>
                    {isCompleted ? (
                      <span className="inline-flex items-center px-3.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Completed
                      </span>
                    ) : isInProgress ? (
                      <span className="inline-flex items-center px-3.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        In Progress
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3.5 py-0.5 rounded-full text-xs font-bold bg-[#EEF5FF] text-[#1760FF] border border-[#BFDBFE]/60">
                        Available
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Button Area */}
            <div className="pt-2">
              {isCompleted ? (
                <div className="bg-[#F8FAFC] border border-[#E2ECF8] rounded-xl p-4 flex items-center gap-3 text-slate-700">
                  <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                  <p className="text-sm font-medium">
                    You have successfully submitted this assessment. The recruitment team will review your results.
                  </p>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setIsLoading(true);
                    window.location.href = `/student/test/${currentTest.id}`;
                  }}
                  className="h-[48px] px-6 bg-[#1760FF] hover:bg-[#1250DF] active:scale-[0.99] text-white font-bold text-[14px] sm:text-[15px] rounded-xl shadow-[0_4px_14px_rgba(23,96,255,0.25)] hover:shadow-[0_6px_20px_rgba(23,96,255,0.3)] transition-all flex items-center gap-2.5 cursor-pointer"
                >
                  <span>{isInProgress ? 'Resume Assessment' : 'Start Assessment'}</span>
                  <Play className="w-3.5 h-3.5 fill-white text-white" />
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
