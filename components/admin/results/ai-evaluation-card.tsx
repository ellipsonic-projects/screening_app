'use client';

import React, { useState } from 'react';
import axios from 'axios';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import { Button } from '@/components/ui/button';
import { 
  Loader2, 
  ChevronDown, 
  ChevronRight, 
  RefreshCcw, 
  Pencil, 
  Code, 
  Sparkles,
  Copy,
  Check,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { isEligibilityCategory, isPersonalityCategory } from '@/lib/categories';

export function AIEvaluationCard({ 
  evaluation, 
  testId, 
  idx, 
  onRefresh 
}: { 
  evaluation: any, 
  testId: string, 
  idx: number, 
  onRefresh?: () => void 
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAiBoxCollapsed, setIsAiBoxCollapsed] = useState(false);
  const [isOverriding, setIsOverriding] = useState(false);
  const [overrideScore, setOverrideScore] = useState<string>(
    evaluation.pointsEarned !== null ? evaluation.pointsEarned.toString() : ''
  );
  const [overrideFeedback, setOverrideFeedback] = useState(evaluation.feedback || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReevaluating, setIsReevaluating] = useState(false);
  const [copied, setCopied] = useState(false);

  React.useEffect(() => {
    setOverrideScore(evaluation.pointsEarned !== null ? evaluation.pointsEarned.toString() : '');
    setOverrideFeedback(evaluation.feedback || '');
  }, [evaluation]);

  const isPersonality = isPersonalityCategory(evaluation.section);
  const isEligibility = isEligibilityCategory(evaluation.section);
  const isUnscored = isPersonality || isEligibility;

  const getResultInfo = (evaluation: any) => {
    if (isPersonality) {
      return { text: 'Pending Evaluation (Unscored)', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' };
    }
    if (evaluation.status === 'FAILED') {
      return { text: 'Evaluation Failed', badgeClass: 'bg-[#FEE2E2] text-[#DC2626] border-[#FECACA]' };
    }
    if (evaluation.status === 'PROCESSING') {
      return { text: 'Processing', badgeClass: 'bg-[#FEF3C7] text-[#D97706] border-[#FDE68A]' };
    }
    if (evaluation.status === 'PENDING') {
      return { text: 'Pending Evaluation', badgeClass: 'bg-slate-100 text-slate-700 border-slate-200' };
    }

    const aiStatus = evaluation.rawResponse?.evaluationStatus || evaluation.rawResponse?.codingEvaluationStatus;
    if (aiStatus === 'Correct') {
      return { text: 'Correct', badgeClass: 'bg-[#E8FAF0] text-[#059669] border-[#A7F3D0]' };
    }
    if (aiStatus === 'Partially Correct') {
      return { text: 'Partially Correct', badgeClass: 'bg-[#FEF3C7] text-[#D97706] border-[#FDE68A]' };
    }
    if (aiStatus === 'Incorrect') {
      return { text: 'Incorrect', badgeClass: 'bg-[#FEE2E2] text-[#DC2626] border-[#FECACA]' };
    }
    
    // Fallback based on score or isCorrect
    if (evaluation.isCorrect) {
      return { text: 'Correct', badgeClass: 'bg-[#E8FAF0] text-[#059669] border-[#A7F3D0]' };
    }
    if (evaluation.pointsEarned !== null && evaluation.maxPoints && evaluation.pointsEarned > 0 && evaluation.pointsEarned < evaluation.maxPoints) {
      return { text: 'Partially Correct', badgeClass: 'bg-[#FEF3C7] text-[#D97706] border-[#FDE68A]' };
    }
    if (evaluation.pointsEarned === 0) {
      return { text: 'Incorrect', badgeClass: 'bg-[#FEE2E2] text-[#DC2626] border-[#FECACA]' };
    }
    return { text: 'Unscored', badgeClass: 'bg-slate-100 text-slate-700 border-slate-200' };
  };

  const handleCopyCode = () => {
    if (evaluation.studentAnswer) {
      navigator.clipboard?.writeText(evaluation.studentAnswer);
      setCopied(true);
      toast.success('Code copied to clipboard', { duration: 1500 });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReevaluate = async () => {
    if (isReevaluating) return;
    setIsReevaluating(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`/api/tests/${testId}/reevaluate`, {
        questionId: evaluation.questionId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Re-evaluation queued. Please refresh momentarily.');
      if (onRefresh) onRefresh();
    } catch (error) {
      toast.error('Failed to queue re-evaluation');
    } finally {
      setIsReevaluating(false);
    }
  };

  const handleOverride = async () => {
    if (overrideScore === '') return;
    const num = Number(overrideScore);
    if (isNaN(num) || num < 0) {
      toast.error('Marks must be a non-negative number');
      return;
    }
    if (evaluation.maxPoints && num > evaluation.maxPoints) {
      toast.error(`Marks cannot exceed maximum points (${evaluation.maxPoints})`);
      return;
    }
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`/api/admin/results/${testId}/override`, {
        questionId: evaluation.questionId,
        newScore: num,
        feedback: overrideFeedback
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsOverriding(false);
      toast.success('Score updated successfully');
      if (onRefresh) onRefresh();
    } catch (error: any) {
      const msg = error?.response?.data?.error || 'Failed to override score';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCoding = evaluation.type === 'coding';
  const studentAnswerText = evaluation.studentAnswer || '// No answer provided by candidate';
  const codeLines = studentAnswerText.split('\n');
  const feedbackSummary = evaluation.feedback || (evaluation.status === 'FAILED' ? 'Evaluation failed.' : 'No feedback recorded.');
  const criteriaScores = evaluation.criteriaScores || evaluation.rawResponse?.criteriaScores || evaluation.rawResponse?.criteria || [];
  const deductionReasons = evaluation.deductionReasons || evaluation.rawResponse?.deductionReasons || evaluation.mistakes || [];
  const resultInfo = getResultInfo(evaluation);

  return (
    <div className="border border-slate-200/80 rounded-2xl p-3.5 sm:p-4 bg-white shadow-2xs hover:border-slate-300 transition-colors">
      
      {/* 1. Compact Question Header Card Matching Mockup */}
      <div className="bg-slate-50/70 border border-slate-200/70 rounded-xl p-3 sm:p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3.5">
        {/* Left: Q Badge & Question Text */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[#EAF2FE] text-[#1760FF] flex items-center justify-center font-bold text-xs shrink-0 border border-blue-100 shadow-2xs">
            Q{idx + 1}
          </div>
          <div className="text-xs text-slate-800 font-medium leading-relaxed pt-0.5 flex-1">
            <MarkdownRenderer content={evaluation.question || 'Write a function to check if a given string is a palindrome. Implement the function in Python.'} />
          </div>
        </div>

        {/* Right: Points Awarded Box & Action Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          {isPersonality ? (
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl px-3 py-1.5 text-center shadow-2xs min-w-[95px]">
              <div className="text-xs font-bold text-amber-800 leading-none">
                Pending
              </div>
              <div className="text-[9px] font-bold uppercase text-amber-600 tracking-wider mt-1">
                Unevaluated
              </div>
            </div>
          ) : !isUnscored && (
            <div className="bg-white border border-slate-200/80 rounded-xl px-3.5 py-1.5 text-center shadow-2xs min-w-[95px]">
              <div className="text-sm font-black text-[#1760FF] leading-none">
                <span>{evaluation.pointsEarned !== null && evaluation.pointsEarned !== undefined ? evaluation.pointsEarned : (evaluation.status === 'FAILED' ? 'N/A' : (evaluation.status === 'PROCESSING' || evaluation.status === 'PENDING' ? 'Pending' : 0))}</span>
                <span className="text-xs font-bold text-slate-400"> / {evaluation.maxPoints || 0}</span>
              </div>
              <div className="text-[9px] font-bold uppercase text-slate-400 tracking-wider mt-0.5">
                Points Awarded
              </div>
            </div>
          )}

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-1">
            {!isUnscored && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsOverriding(!isOverriding)} 
                className="h-7 w-7 p-0 text-slate-500 hover:text-slate-800 border-slate-200 bg-white hover:bg-slate-50 rounded-lg cursor-pointer shadow-2xs" 
                title="Override Score / Feedback"
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            )}
            {!isUnscored && evaluation.status !== 'COMPLETED' && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleReevaluate} 
                disabled={isReevaluating} 
                className="h-7 w-7 p-0 text-slate-500 hover:text-slate-800 border-slate-200 bg-white hover:bg-slate-50 rounded-lg cursor-pointer shadow-2xs" 
                title="Re-evaluate with AI"
              >
                {isReevaluating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Manual Override Score Form (When Active) */}
      {isOverriding && (
        <div className="mb-3.5 p-3 bg-blue-50/50 border border-blue-100 rounded-xl flex flex-wrap sm:flex-nowrap items-end gap-2.5 text-xs animate-fade-in">
          <div className="w-24 shrink-0">
            <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">New Score</label>
            <input 
              type="number" 
              className="w-full bg-white text-slate-900 border border-slate-200 rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none font-bold" 
              value={overrideScore} 
              onChange={(e) => setOverrideScore(e.target.value)} 
              max={evaluation.maxPoints}
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Override Feedback</label>
            <input 
              type="text"
              className="w-full bg-white text-slate-900 placeholder:text-slate-400 border border-slate-200 rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none" 
              value={overrideFeedback} 
              onChange={(e) => setOverrideFeedback(e.target.value)} 
              placeholder="Add explanation for manual score override..."
            />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button 
              onClick={handleOverride} 
              disabled={isSubmitting || overrideScore === ''} 
              className="h-7 text-xs px-3 bg-[#1760FF] text-white hover:bg-blue-700 rounded-lg shadow-2xs"
            >
              {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null} Save
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setIsOverriding(false)} 
              className="h-7 text-xs px-2.5 rounded-lg border-slate-200 bg-white"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* 2. Side-by-Side Panels on Desktop (Stack on Mobile) Matching Mockup */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 items-start">
        
        {/* Left Panel: Student Answer */}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#10234E] mb-2">
            <Code className="w-3.5 h-3.5 text-[#1760FF]" />
            <span>Student Answer</span>
          </div>

          <div className="bg-[#0B1528] rounded-xl border border-slate-800 relative overflow-hidden text-xs font-mono min-h-[170px] shadow-inner flex flex-col min-w-0">
            {/* Copy button top right */}
            <button 
              onClick={handleCopyCode}
              className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer z-20 shadow-sm"
              title="Copy code"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            {/* Vertical Scrollable Container - Only vertical scrolling on the panel */}
            <div className="p-3 overflow-y-auto max-h-[240px] flex-1">
              <div className="flex min-w-0">
                {/* Line numbers: stays pinned on the left */}
                <div className="select-none pr-3 text-right text-slate-600 font-mono leading-relaxed border-r border-slate-800/80 mr-3 shrink-0">
                  {codeLines.map((_: string, i: number) => (
                    <div key={i}>{i + 1}</div>
                  ))}
                </div>

                {/* Code Content: overflow-x-auto applied ONLY to the actual code text */}
                <div className="flex-1 min-w-0 overflow-x-auto">
                  <pre className={`text-slate-100 font-mono leading-relaxed m-0 p-0 pr-8 font-normal ${
                    isCoding ? 'whitespace-pre' : 'whitespace-pre-wrap break-words'
                  }`}>
                    <code>{studentAnswerText}</code>
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: AI Evaluation & Feedback */}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center justify-between text-xs font-bold text-[#10234E] mb-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#1760FF]" />
              <span>AI Evaluation & Feedback</span>
            </div>
            <button 
              onClick={() => setIsAiBoxCollapsed(!isAiBoxCollapsed)}
              className="text-slate-400 hover:text-slate-600 transition cursor-pointer"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isAiBoxCollapsed ? '-rotate-90' : ''}`} />
            </button>
          </div>

          {!isAiBoxCollapsed && (
            isPersonality ? (
              <div className="border border-slate-200/80 rounded-xl p-3.5 bg-slate-50/50 flex flex-col justify-between shadow-2xs min-w-0">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${resultInfo.badgeClass}`}>
                      {resultInfo.text}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      Model: None
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed mt-2.5 break-words">
                    Personality responses are preserved unscored. AI evaluation is disabled until evaluation criteria are explicitly approved.
                  </p>
                </div>
              </div>
            ) : (
            <div className="border border-slate-200/80 rounded-xl p-3.5 bg-slate-50/50 flex flex-col justify-between shadow-2xs min-w-0">
              <div>
                {/* Meta Row: Status Pill & Model info */}
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${resultInfo.badgeClass}`}>
                    {resultInfo.text}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Model: {evaluation.modelUsed || 'gemini-1.5-pro'}
                  </span>
                </div>

                {/* Feedback summary paragraph */}
                <p className="text-xs text-slate-600 leading-relaxed mt-2.5 break-words">
                  {feedbackSummary}
                </p>
              </div>

              {/* View Detailed Feedback Collapsible Trigger */}
              <div className="mt-3 pt-2 border-t border-slate-200/60">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-xs font-bold text-[#1760FF] hover:underline flex items-center gap-1 cursor-pointer transition"
                >
                  <span>{isExpanded ? 'Hide Detailed Feedback' : 'View Detailed Feedback'}</span>
                  <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </button>

                {/* Detailed Feedback Breakdown (Expanded) */}
                {isExpanded && (
                  <div className="mt-2.5 space-y-2.5 pt-2 border-t border-slate-200/60 animate-fade-in text-xs min-w-0">
                    {/* Criterion-Level Mark Breakdown */}
                    {criteriaScores && criteriaScores.length > 0 && (
                      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2 min-w-0">
                        <span className="font-bold text-slate-800 text-[10px] uppercase tracking-wider block">
                          Predefined Criterion Breakdown
                        </span>
                        <div className="space-y-2">
                          {criteriaScores.map((c: any, i: number) => (
                            <div key={c.id || i} className="p-2.5 rounded-lg bg-slate-50/90 border border-slate-100 flex flex-col gap-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold text-slate-800 text-[11px] truncate">{c.name}</span>
                                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                                  {c.score} / {c.maxScore} marks
                                </span>
                              </div>
                              {c.explanation && (
                                <p className="text-[11px] text-slate-600 leading-normal break-words m-0">
                                  {c.explanation}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Strengths */}
                    {evaluation.strengths && evaluation.strengths.length > 0 && (
                      <div className="bg-emerald-50/70 p-2.5 rounded-lg border border-emerald-100 min-w-0">
                        <span className="font-bold text-emerald-800 text-[10px] uppercase tracking-wider block mb-1">
                          Strengths
                        </span>
                        <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-emerald-700 leading-tight break-words">
                          {evaluation.strengths.map((str: string, i: number) => (
                            <li key={i}>{str}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Mistakes / Deductions */}
                    {deductionReasons && deductionReasons.length > 0 && (
                      <div className="bg-rose-50/70 p-2.5 rounded-lg border border-rose-100 min-w-0">
                        <span className="font-bold text-rose-800 text-[10px] uppercase tracking-wider block mb-1">
                          Mistakes & Deductions
                        </span>
                        <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-rose-700 leading-tight break-words">
                          {deductionReasons.map((m: string, i: number) => (
                            <li key={i}>{m}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Suggestions */}
                    {((evaluation.suggestions && evaluation.suggestions.length > 0) || (evaluation.improvements && evaluation.improvements.length > 0)) && (
                      <div className="bg-amber-50/70 p-2.5 rounded-lg border border-amber-100 min-w-0">
                        <span className="font-bold text-amber-800 text-[10px] uppercase tracking-wider block mb-1">
                          Suggestions for Improvement
                        </span>
                        <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-amber-700 leading-tight break-words">
                          {(evaluation.suggestions || evaluation.improvements).map((s: string, i: number) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>
            )
          )}
        </div>
      </div>

      {/* Alert States for Processing / Failed */}
      {(evaluation.status === 'PENDING' || evaluation.status === 'PROCESSING') && !isUnscored && (
        <div className="mt-3 p-2.5 bg-amber-50/80 border border-amber-200 rounded-xl flex items-center gap-2 text-xs">
          <Loader2 className="w-3.5 h-3.5 text-amber-600 animate-spin shrink-0" />
          <span className="font-medium text-amber-900">
            {evaluation.status === 'PROCESSING' 
              ? 'AI evaluation is currently processing...' 
              : 'AI evaluation is pending. Click re-evaluate to queue.'}
          </span>
        </div>
      )}

      {evaluation.status === 'FAILED' && (
        <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs">
          <div className="font-bold text-[10px] text-rose-800 uppercase tracking-wider flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            Evaluation Failed
          </div>
          <p className="text-rose-700 font-mono text-[11px] break-all">
            {evaluation.rawResponse?.error || (typeof evaluation.rawResponse === 'string' ? evaluation.rawResponse : JSON.stringify(evaluation.rawResponse)) || 'Unknown error occurred during AI evaluation.'}
          </p>
        </div>
      )}
    </div>
  );
}
