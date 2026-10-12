'use client';

import React, { useState } from 'react';
import axios from 'axios';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ChevronDown, ChevronUp, RefreshCcw, Pencil, Code2, FileText, CheckCircle, Award } from 'lucide-react';

export function AIEvaluationCard({ evaluation, testId, idx, onRefresh }: { evaluation: any, testId: string, idx: number, onRefresh?: () => void }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOverriding, setIsOverriding] = useState(false);
  const [overrideScore, setOverrideScore] = useState<string>(evaluation.pointsEarned !== null ? evaluation.pointsEarned.toString() : '');
  const [overrideFeedback, setOverrideFeedback] = useState(evaluation.feedback || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReevaluating, setIsReevaluating] = useState(false);

  React.useEffect(() => {
    setOverrideScore(evaluation.pointsEarned !== null ? evaluation.pointsEarned.toString() : '');
    setOverrideFeedback(evaluation.feedback || '');
  }, [evaluation]);

  const getStatusColor = (status: string) => {
    if (status === 'COMPLETED') return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (status === 'FAILED') return 'text-rose-700 bg-rose-50 border-rose-200';
    if (status === 'RETRYING') return 'text-amber-700 bg-amber-50 border-amber-200';
    if (status === 'SCORED') return 'text-purple-700 bg-purple-50 border-purple-200';
    return 'text-blue-700 bg-blue-50 border-blue-200';
  };

  const getTypeIcon = (type: string) => {
    if (type === 'coding') return <Code2 className="w-3.5 h-3.5 mr-1" />;
    return <FileText className="w-3.5 h-3.5 mr-1" />;
  };

  const getTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      'coding': 'Coding',
      'structured_response': 'Structured',
      'open_text': 'Open Text'
    };
    return map[type] || type.replace('_', ' ');
  };

  const getResultInfo = (evaluation: any) => {
    const aiStatus = evaluation.rawResponse?.evaluationStatus || evaluation.rawResponse?.codingEvaluationStatus;
    if (aiStatus === 'Correct') {
      return { text: 'Correct', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    }
    if (aiStatus === 'Partially Correct') {
      return { text: 'Partially Correct', color: 'text-amber-700 bg-amber-50 border-amber-200' };
    }
    if (aiStatus === 'Incorrect') {
      return { text: 'Incorrect', color: 'text-rose-700 bg-rose-50 border-rose-200' };
    }
    
    // Fallback
    return evaluation.isCorrect 
      ? { text: 'Correct', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' }
      : { text: 'Incorrect', color: 'text-rose-700 bg-rose-50 border-rose-200' };
  };

  const handleReevaluate = async () => {
    setIsReevaluating(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`/api/tests/${testId}/reevaluate`, {
        questionId: evaluation.questionId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Re-evaluation queued successfully. Please refresh in a moment.');
    } catch (error) {
      alert('Failed to re-evaluate');
    } finally {
      setIsReevaluating(false);
    }
  };

  const handleOverride = async () => {
    if (!overrideScore) return;
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`/api/admin/results/${testId}/override`, {
        questionId: evaluation.questionId,
        newScore: Number(overrideScore),
        feedback: overrideFeedback
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsOverriding(false);
      if (onRefresh) onRefresh();
    } catch (error) {
      alert('Failed to override score');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCoding = evaluation.type === 'coding';

  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm">
      <div className="flex justify-between items-start mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="default" className="text-[10px] uppercase font-bold px-2 py-0.5">
            Q{idx + 1}
          </Badge>
          <Badge variant="outline" className="text-[10px] uppercase font-bold px-2 py-0.5 flex items-center border-slate-200 bg-slate-50 text-slate-600">
            {getTypeIcon(evaluation.type)} {getTypeLabel(evaluation.type)}
          </Badge>
          <Badge variant="outline" className={`text-[10px] uppercase font-bold px-2 py-0.5 ${getStatusColor(evaluation.status)}`}>
            {evaluation.status || 'PENDING'}
          </Badge>
          {evaluation.section !== 'ELIGIBILITY' && (
            <Badge variant="secondary" className="text-[10px] uppercase font-bold px-2 py-0.5 bg-blue-50 text-blue-700 border-blue-200 flex items-center">
              <Award className="w-3.5 h-3.5 mr-1 text-blue-500" />
              {evaluation.pointsEarned !== null ? evaluation.pointsEarned : '?'} / {evaluation.maxPoints} Marks
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 ml-2">
          {evaluation.section !== 'ELIGIBILITY' && (
            <Button variant="outline" size="sm" onClick={() => setIsOverriding(!isOverriding)} className="h-8 w-8 p-0 text-slate-500 hover:text-slate-700 border-slate-200 bg-white" title="Override">
              <Pencil className="w-4 h-4" />
            </Button>
          )}
          {evaluation.section !== 'ELIGIBILITY' && evaluation.status !== 'SCORED' && (
            <Button variant="outline" size="sm" onClick={handleReevaluate} disabled={isReevaluating} className="h-8 w-8 p-0 text-slate-500 hover:text-slate-700 border-slate-200 bg-white" title="Re-evaluate">
              {isReevaluating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
            </Button>
          )}
        </div>
      </div>

      {isOverriding && (
        <div className="mb-3 p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-end gap-3">
          <div className="w-24 shrink-0">
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">New Score</label>
            <input 
              type="number" 
              className="w-full bg-white text-slate-900 border border-slate-200 rounded p-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
              value={overrideScore} 
              onChange={(e) => setOverrideScore(e.target.value)} 
              max={evaluation.maxPoints}
            />
          </div>
          <div className="flex-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Feedback</label>
            <input 
              type="text"
              className="w-full bg-white text-slate-900 placeholder:text-slate-400 border border-slate-200 rounded p-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
              value={overrideFeedback} 
              onChange={(e) => setOverrideFeedback(e.target.value)} 
              placeholder="Edit feedback..."
            />
          </div>
          <Button onClick={handleOverride} disabled={isSubmitting || overrideScore === ''} className="h-8 text-xs px-3">
            {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null} Save
          </Button>
        </div>
      )}

      <div className="mb-3">
        <MarkdownRenderer content={evaluation.question || 'No question text available.'} />
      </div>

      <div className="mb-3">
        {evaluation.status === 'COMPLETED' && (
          <div className="flex gap-2 mb-2 items-center flex-wrap">
            {isCoding && (
              <Badge variant="outline" className="text-[10px] font-bold bg-slate-100 text-slate-700 border-slate-200">
                Language: <span className="ml-1 text-slate-900 font-mono">{evaluation.rawResponse?.detectedLanguage || 'Unknown'}</span>
              </Badge>
            )}
            <Badge variant="outline" className={`text-[10px] font-bold ${getResultInfo(evaluation).color}`}>
              Result: {getResultInfo(evaluation).text}
            </Badge>
          </div>
        )}
        <div className="text-[10px] font-bold text-slate-500 uppercase mb-1.5">Student's Answer</div>
        <ScrollArea className={`bg-slate-950 text-slate-100 p-3 rounded-lg text-sm font-mono whitespace-pre-wrap ${isCoding ? 'h-[160px]' : 'h-[100px]'}`}>
          {evaluation.studentAnswer || '// No answer provided'}
        </ScrollArea>
      </div>

      {evaluation.status === 'COMPLETED' && (
        <div className="mt-3 border border-indigo-100 rounded-lg overflow-hidden">
          <div 
            className="bg-indigo-50/60 p-2.5 flex justify-between items-center cursor-pointer hover:bg-indigo-100/50 transition-colors"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <h5 className="font-bold text-[11px] text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-indigo-500" />
              AI Feedback
            </h5>
            <div className="flex items-center gap-2">
              {evaluation.modelUsed && (
                <span className="text-[9px] bg-indigo-200/50 text-indigo-700 px-1.5 py-0.5 rounded-sm font-bold uppercase">
                  {evaluation.modelUsed}
                </span>
              )}
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-indigo-700" /> : <ChevronDown className="w-3.5 h-3.5 text-indigo-700" />}
            </div>
          </div>
          
          {isExpanded && (
            <div className="p-3 bg-white border-t border-indigo-100 space-y-3">
              <div>
                <span className="font-bold text-indigo-900 text-[10px] uppercase tracking-wider block mb-1">Feedback</span>
                <p className="text-slate-700 text-xs whitespace-pre-wrap">
                  {evaluation.feedback || 'No detailed feedback provided.'}
                </p>
              </div>

              {isCoding && ((evaluation.strengths && evaluation.strengths.length > 0) || (evaluation.mistakes && evaluation.mistakes.length > 0) || (evaluation.suggestions && evaluation.suggestions.length > 0)) ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {evaluation.strengths && evaluation.strengths.length > 0 && (
                    <div className="bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100">
                      <span className="font-bold text-emerald-800 text-[10px] uppercase tracking-wider block mb-1.5">Strengths</span>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {evaluation.strengths.map((str: string, i: number) => (
                          <li key={i} className="text-emerald-700 text-xs">{str}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {evaluation.mistakes && evaluation.mistakes.length > 0 && (
                    <div className="bg-rose-50/50 p-2.5 rounded-lg border border-rose-100">
                      <span className="font-bold text-rose-800 text-[10px] uppercase tracking-wider block mb-1.5">Mistakes</span>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {evaluation.mistakes.map((mistake: string, i: number) => (
                          <li key={i} className="text-rose-700 text-xs">{mistake}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {evaluation.suggestions && evaluation.suggestions.length > 0 && (
                    <div className="bg-amber-50/50 p-2.5 rounded-lg border border-amber-100">
                      <span className="font-bold text-amber-800 text-[10px] uppercase tracking-wider block mb-1.5">Suggestions</span>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {evaluation.suggestions.map((sug: string, i: number) => (
                          <li key={i} className="text-amber-700 text-xs">{sug}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : ((evaluation.strengths && evaluation.strengths.length > 0) || (evaluation.improvements && evaluation.improvements.length > 0) || (evaluation.rawResponse?.weaknesses && evaluation.rawResponse.weaknesses.length > 0) || (evaluation.rawResponse?.deductionReasons && evaluation.rawResponse.deductionReasons.length > 0)) ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {evaluation.strengths && evaluation.strengths.length > 0 && (
                    <div className="bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100">
                      <span className="font-bold text-emerald-800 text-[10px] uppercase tracking-wider block mb-1.5">Strengths</span>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {evaluation.strengths.map((str: string, i: number) => (
                          <li key={i} className="text-emerald-700 text-xs">{str}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {evaluation.rawResponse?.weaknesses && evaluation.rawResponse.weaknesses.length > 0 && (
                    <div className="bg-orange-50/50 p-2.5 rounded-lg border border-orange-100">
                      <span className="font-bold text-orange-800 text-[10px] uppercase tracking-wider block mb-1.5">Weaknesses</span>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {evaluation.rawResponse.weaknesses.map((weak: string, i: number) => (
                          <li key={i} className="text-orange-700 text-xs">{weak}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {evaluation.rawResponse?.deductionReasons && evaluation.rawResponse.deductionReasons.length > 0 && (
                    <div className="bg-rose-50/50 p-2.5 rounded-lg border border-rose-100">
                      <span className="font-bold text-rose-800 text-[10px] uppercase tracking-wider block mb-1.5">Deductions</span>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {evaluation.rawResponse.deductionReasons.map((reason: string, i: number) => (
                          <li key={i} className="text-rose-700 text-xs">{reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {evaluation.improvements && evaluation.improvements.length > 0 && (
                    <div className="bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100">
                      <span className="font-bold text-indigo-800 text-[10px] uppercase tracking-wider block mb-1.5">Suggestions</span>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {evaluation.improvements.map((imp: string, i: number) => (
                          <li key={i} className="text-indigo-700 text-xs">{imp}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      {evaluation.status === 'FAILED' && (
        <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg">
          <h5 className="font-bold text-[10px] text-rose-800 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            Evaluation Failed
          </h5>
          <p className="text-rose-700 text-[10px] font-mono break-all">{JSON.stringify(evaluation.rawResponse) || 'Unknown Error'}</p>
        </div>
      )}
    </div>
  );
}
