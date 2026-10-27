'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { 
  Loader2, 
  ArrowLeft, 
  Clock, 
  Calendar, 
  GraduationCap, 
  Shield,
  Brain,
  Code,
  ClipboardList,
  Users,
  Settings,
  MessageSquare,
  Bot,
  UserCheck,
  Award,
  AlertTriangle
} from 'lucide-react';
import { BrandLogo } from '@/components/common/BrandLogo';
import { AIEvaluationCard } from './ai-evaluation-card';
import { 
  canonicalizeCategory, 
  isEligibilityCategory, 
  isPersonalityCategory,
  getCategoryLabel 
} from '@/lib/categories';

const getSectionIcon = (sectionName: string) => {
  const canonical = canonicalizeCategory(sectionName);
  switch (canonical) {
    case 'APTITUDE':
      return <Brain className="w-3.5 h-3.5 text-blue-600" />;
    case 'CODING':
      return <Code className="w-3.5 h-3.5 text-blue-600" />;
    case 'ELIGIBILITY':
      return <ClipboardList className="w-3.5 h-3.5 text-slate-600" />;
    case 'ATTITUDE_AND_OWNERSHIP':
      return <Users className="w-3.5 h-3.5 text-purple-600" />;
    case 'LEARNING_APTITUDE':
      return <GraduationCap className="w-3.5 h-3.5 text-teal-600" />;
    case 'PROBLEM_SOLVING':
      return <Settings className="w-3.5 h-3.5 text-amber-600" />;
    case 'EXECUTION_AND_RELIABILITY':
      return <Settings className="w-3.5 h-3.5 text-orange-600" />;
    case 'COMMUNICATION_AND_TEAMWORK':
      return <MessageSquare className="w-3.5 h-3.5 text-sky-600" />;
    case 'INTEGRITY':
      return <Shield className="w-3.5 h-3.5 text-emerald-600" />;
    case 'AI_LITERACY':
      return <Bot className="w-3.5 h-3.5 text-purple-600" />;
    case 'PERSONALITY':
      return <UserCheck className="w-3.5 h-3.5 text-indigo-600" />;
    default:
      return <Shield className="w-3.5 h-3.5 text-blue-600" />;
  }
};

const SectionScoreCard = ({
  sectionName, marksObtained, totalMarks, isCompleted
}: {
  sectionName: string, marksObtained: number | null, totalMarks: number | null, isCompleted: boolean
}) => {
  const isPersonality = isPersonalityCategory(sectionName);
  const isEligibility = isEligibilityCategory(sectionName) || (!isPersonality && totalMarks === null);
  const percentage = (!isEligibility && !isPersonality && totalMarks && totalMarks > 0 && marksObtained !== null) 
    ? Math.min(100, Math.max(0, (marksObtained / totalMarks) * 100)) 
    : 0;

  const displayLabel = getCategoryLabel(sectionName);

  return (
    <div className="p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs flex flex-col justify-between min-h-[72px] hover:border-blue-300 transition-colors">
      <div className="flex justify-between items-center gap-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100">
            {getSectionIcon(sectionName)}
          </div>
          <span className="text-xs font-bold text-[#10234E] truncate" title={displayLabel}>
            {displayLabel}
          </span>
        </div>
        {isCompleted && (
          <span className="text-[9px] uppercase font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 shrink-0">
            DONE
          </span>
        )}
      </div>

      <div className="mt-2.5">
        {isPersonality ? (
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-[10px] text-slate-400 font-medium">Evaluation</span>
            <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              Pending Criteria
            </span>
          </div>
        ) : isEligibility ? (
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-[10px] text-slate-400 font-medium">Screening</span>
            <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              Verified
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2.5">
            <Progress value={percentage} className="h-1.5 flex-1 bg-slate-100 [&>div]:bg-[#1760FF] rounded-full" />
            <div className="text-xs font-bold text-[#10234E] whitespace-nowrap">
              <span>{marksObtained ?? 0}</span>
              <span className="text-slate-400 font-semibold text-[10px]"> / {totalMarks ?? 0}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export function StudentReport() {
  const router = useRouter();
  const params = useParams();
  const testId = params.testId as string;

  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [openSection, setOpenSection] = useState<number>(0);

  useEffect(() => {
    if (testId) {
      fetchReport();
    }
  }, [testId]);

  const fetchReport = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/admin/results/${testId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(res.data.data);
    } catch (err) {
      console.error('Failed to load student report', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/admin/students');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F3F7FD] flex flex-col items-center justify-center p-6 text-slate-500 font-sans">
        <div className="flex flex-col items-center justify-center gap-2.5 bg-white p-8 rounded-2xl border border-slate-200/80 shadow-2xs">
          <Loader2 className="w-6 h-6 animate-spin text-[#1760FF]" />
          <p className="text-xs font-semibold text-slate-700">Loading candidate assessment report...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#F3F7FD] flex flex-col items-center justify-center p-6 text-slate-700 font-sans">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200/80 p-8 shadow-md text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto font-bold text-xl">
            ✕
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Student Report Not Found</h2>
            <p className="text-xs text-slate-500 mt-1">Unable to locate the submission records for this assessment.</p>
          </div>
          <Button onClick={handleBack} className="bg-[#1760FF] hover:bg-blue-700 text-white text-xs h-8.5 rounded-lg px-4">
            Return to Directory
          </Button>
        </div>
      </div>
    );
  }

  const statusStr = (data.status || 'SUBMITTED').toUpperCase();

  return (
    <div className="min-h-screen bg-[#F3F7FD] relative overflow-x-hidden text-[#10234E] font-sans selection:bg-blue-100 selection:text-blue-900 flex flex-col">
      {/* Decorative Background Curves & Soft Waves */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
        <div 
          className="absolute inset-0" 
          style={{
            background: 'radial-gradient(circle at 50% 40%, #F8FBFE 0%, #EEF5FD 55%, #E6F1FC 100%)'
          }}
        />

        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 1440 900"
          fill="none"
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="arTopRightGrad" x1="1440" y1="0" x2="900" y2="400" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#BCDDFC" stopOpacity="0.75" />
              <stop offset="50%" stopColor="#D4E9FE" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#F0F6FD" stopOpacity="0" />
            </linearGradient>

            <linearGradient id="arBottomLeftGrad" x1="0" y1="900" x2="600" y2="500" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#A8D4FC" stopOpacity="0.65" />
              <stop offset="55%" stopColor="#CCE3FD" stopOpacity="0.38" />
              <stop offset="100%" stopColor="#F0F6FD" stopOpacity="0" />
            </linearGradient>

            <linearGradient id="arBottomWaveGrad" x1="0" y1="850" x2="1440" y2="750" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#BDDCFC" stopOpacity="0.5" />
              <stop offset="50%" stopColor="#D0E6FD" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#E4F1FE" stopOpacity="0.2" />
            </linearGradient>
          </defs>

          <path d="M1440 0 L 980 0 C 980 160, 1120 320, 1440 370 Z" fill="url(#arTopRightGrad)" />
          <path d="M0 900 L 0 540 C 220 540, 440 680, 560 900 Z" fill="url(#arBottomLeftGrad)" />
          <path d="M0 760 C 350 780, 720 730, 1080 670 C 1240 645, 1370 675, 1440 705 L 1440 900 L 0 900 Z" fill="url(#arBottomWaveGrad)" />
        </svg>
      </div>

      {/* Sticky Top Navigation Bar */}
      <nav className="bg-white/95 backdrop-blur-xs border-b border-slate-200/80 sticky top-0 z-40 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BrandLogo size="md" className="items-start flex-row items-center" />
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold uppercase tracking-wider hidden sm:inline-block border border-slate-200/60">
              Assessment Review
            </span>
          </div>
          <div>
            <Button
              variant="outline"
              onClick={handleBack}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3.5 py-1.5 rounded-lg transition flex items-center border-none shadow-2xs cursor-pointer h-8"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-6 py-4 sm:py-5 flex-1 space-y-4">
        
        {/* 1. Candidate Summary Card Matching Mockup */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Left: Avatar, Candidate Name, Status & Metadata */}
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-full bg-[#EAF2FE] text-[#1760FF] flex items-center justify-center font-bold text-lg shrink-0 border border-blue-100 shadow-2xs">
              {data.studentName ? data.studentName.charAt(0).toUpperCase() : 'V'}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-base sm:text-lg font-black text-[#10234E] tracking-tight">
                  {data.studentName}
                </h1>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                  data.status === 'evaluation_failed'
                    ? 'bg-[#FEE2E2] text-[#DC2626] border-[#FECACA]'
                    : (data.status === 'in_progress' ? 'bg-[#DBEAFE] text-[#1E40AF] border-[#BFDBFE]' : 'bg-[#E8FAF0] text-[#059669] border-[#A7F3D0]')
                }`}>
                  {data.status === 'evaluation_failed' ? 'EVALUATION FAILED' : statusStr}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 mt-1 text-xs text-slate-500 font-medium">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{data.timeTaken ? `${data.timeTaken} min` : '61 min'}</span>
                </span>
                <span className="text-slate-300">•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {data.submissionTime 
                      ? new Date(data.submissionTime).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) 
                      : '12 Oct 2026, 13:02'}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Right: Overall Score Display with Ribbon Badge */}
          <div className="flex items-center gap-3.5 self-stretch sm:self-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
            <div className="text-left sm:text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                OVERALL SCORE
              </span>
              <div className="flex items-baseline sm:justify-end gap-1 mt-0.5">
                <span className="text-2xl sm:text-3xl font-black text-[#1760FF] tracking-tight leading-none">
                  {data.scores?.overallScore !== null && data.scores?.overallScore !== undefined 
                    ? data.scores.overallScore 
                    : (data.status === 'evaluation_failed' ? 'Failed' : '--')}
                </span>
                <span className="text-xs sm:text-sm font-bold text-slate-400">
                  / {data.scores?.overallTotalMarks ?? 0}
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#EAF2FE] text-[#1760FF] flex items-center justify-center border border-blue-100 shrink-0 shadow-2xs">
              <Award className="w-5 h-5 stroke-[2.2]" />
            </div>
          </div>
        </div>

        {/* Evaluation Failure Banner for Administrators */}
        {data.status === 'evaluation_failed' && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3 text-rose-900 shadow-2xs">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <span className="font-bold text-sm block">Automated AI Evaluation Incomplete or Failed</span>
              <p className="text-rose-700">
                One or more subjective questions failed automated grading. Their marks are not finalized or treated as zero.
                Please review the failed questions below to re-evaluate them with AI or apply a manual score override.
              </p>
            </div>
          </div>
        )}

        {/* 2. Section Performance (10 Cards in 5-Column Grid on Desktop) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-[#10234E] uppercase tracking-wider">
              SECTION PERFORMANCE ({data.scores?.sectionScores?.length || 10})
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
            {data.scores?.sectionScores?.map((sec: any, idx: number) => (
              <SectionScoreCard
                key={idx}
                sectionName={sec.sectionName}
                marksObtained={sec.marksObtained}
                totalMarks={sec.totalMarks}
                isCompleted={sec.isCompleted ?? true}
              />
            ))}
          </div>
        </div>

        {/* 3. Question Review & Evaluation Interface */}
        {data.aiEvaluationsBySection && data.aiEvaluationsBySection.length > 0 && (
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-[#10234E] uppercase tracking-wider">
                QUESTION REVIEW & EVALUATION
              </h2>
              <span className="text-xs text-slate-400 font-medium">
                {data.aiEvaluationsBySection.reduce((acc: number, s: any) => acc + (s.evaluations?.length || 0), 0)} Questions Evaluated
              </span>
            </div>

            <Accordion className="space-y-3">
              {data.aiEvaluationsBySection.map((section: any, secIdx: number) => {
                const avgScore = section.evaluations.length > 0 
                  ? (section.evaluations.reduce((acc: number, curr: any) => acc + (curr.pointsEarned || 0), 0) / section.evaluations.length).toFixed(1) 
                  : '0';

                const isOpen = openSection === secIdx;

                return (
                  <AccordionItem 
                    key={secIdx} 
                    className="border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-2xs"
                  >
                    <AccordionTrigger 
                      isOpen={isOpen} 
                      onClick={() => setOpenSection(isOpen ? -1 : secIdx)}
                      className="py-3 px-4 sm:px-5 hover:bg-slate-50/70 transition-colors"
                    >
                      <div className="flex flex-wrap items-center gap-2.5 text-[#10234E] text-xs sm:text-sm font-bold">
                        <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 border border-blue-100">
                          {getSectionIcon(section.sectionName)}
                        </div>
                        <span>{getCategoryLabel(section.sectionName)}</span>
                        <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60">
                          {section.evaluations.length} {section.evaluations.length === 1 ? 'Question' : 'Questions'}
                        </span>
                        {!isEligibilityCategory(section.sectionName) && (
                          <span className="text-[10px] font-bold text-[#1760FF] bg-[#EAF2FE] px-2 py-0.5 rounded-md border border-blue-100">
                            Avg: {avgScore} Pts
                          </span>
                        )}
                      </div>
                    </AccordionTrigger>
                    
                    <AccordionContent isOpen={isOpen} className="p-3 sm:p-4 bg-slate-50/30 border-t border-slate-100 space-y-3.5 min-w-0">
                      {section.evaluations.map((evaluation: any, idx: number) => (
                        <AIEvaluationCard 
                          key={`${evaluation.questionId}-${idx}`} 
                          idx={idx} 
                          evaluation={evaluation} 
                          testId={testId} 
                          onRefresh={fetchReport}
                        />
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        )}
      </main>
    </div>
  );
}
