'use client';

import React, { useState } from 'react';
import { 
  UserCheck, 
  Sparkles, 
  HelpCircle, 
  Compass, 
  ShieldAlert, 
  ChevronDown, 
  ChevronUp, 
  Info,
  Users,
  MessageSquare,
  Repeat,
  GraduationCap,
  Briefcase,
  Shield,
  Lightbulb
} from 'lucide-react';
import { WorkStyleDimensionId, PersonalityOverviewPayload } from '@/lib/evaluation/personality-evaluation';

interface PersonalityOverviewBoxProps {
  overview: PersonalityOverviewPayload | null;
  isLoading?: boolean;
}

const DIMENSION_ICONS: Record<WorkStyleDimensionId, React.ReactNode> = {
  OWNERSHIP_AND_INITIATIVE: <UserCheck className="w-4 h-4 text-purple-600" />,
  COLLABORATION: <Users className="w-4 h-4 text-blue-600" />,
  COMMUNICATION: <MessageSquare className="w-4 h-4 text-sky-600" />,
  ADAPTABILITY: <Repeat className="w-4 h-4 text-teal-600" />,
  LEARNING_ORIENTATION: <GraduationCap className="w-4 h-4 text-emerald-600" />,
  SELF_MANAGEMENT: <Briefcase className="w-4 h-4 text-amber-600" />,
  JUDGMENT_AND_INTEGRITY: <Shield className="w-4 h-4 text-rose-600" />
};

export function PersonalityOverviewBox({ overview }: PersonalityOverviewBoxProps) {
  const [expandedDimensions, setExpandedDimensions] = useState<Record<string, boolean>>({});

  if (!overview) {
    return null;
  }

  const toggleDimension = (id: string) => {
    setExpandedDimensions(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const hasInterests = overview.selfReportedInterests?.details?.length > 0 || overview.selfReportedInterests?.summary;
  const hasStrengths = overview.demonstratedStrengths?.length > 0;
  const hasGrowth = overview.potentialDevelopmentAreas?.length > 0;
  const hasFollowUps = overview.recommendedFollowUpQuestions?.length > 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs space-y-5">
      {/* Box Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shrink-0">
            <UserCheck className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-[#10234E] tracking-tight">
                Personality
              </h2>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                Work-Style Overview
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Evidence-based qualitative synthesis • Human interviewer review only
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/60 self-start sm:self-auto">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>Unscored • Non-Diagnostic • No Automatic Ranking</span>
        </div>
      </div>

      {/* Warning for unmapped questions if any */}
      {overview.unmappedQuestionsCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-2.5 text-amber-900 text-xs">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Notice regarding Question ID mapping:</span> {overview.unmappedQuestionsCount} response(s) could not be mapped to standard items P01–P33. These have been kept separate from dimension scoring to prevent ungrounded attribution.
          </div>
        </div>
      )}

      {/* 1. Candidate Overview Narrative */}
      <div className="bg-[#F8FAFD] rounded-xl p-4 border border-slate-200/60 space-y-1.5">
        <div className="flex items-center gap-2 text-xs font-bold text-[#10234E] uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <span>Candidate Overview</span>
        </div>
        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal">
          {overview.candidateOverview}
        </p>
      </div>

      {/* 2. Self-Reported Interests & Context (P01–P06) */}
      {hasInterests && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#10234E] uppercase tracking-wider flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-slate-400" />
              <span>Self-Reported Interests & Context (P01–P06)</span>
            </h3>
            <span className="text-[10px] text-slate-400 italic font-medium">
              Context only; no competence inferred
            </span>
          </div>

          <div className="bg-slate-50/70 rounded-xl p-3.5 border border-slate-200/50 space-y-2">
            <p className="text-xs text-slate-600 leading-normal">
              {overview.selfReportedInterests.summary}
            </p>
            {overview.selfReportedInterests.details?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {overview.selfReportedInterests.details.map((item, idx) => (
                  <span 
                    key={idx}
                    className="text-[11px] font-medium text-slate-700 bg-white border border-slate-200/80 px-2.5 py-1 rounded-lg shadow-2xs"
                  >
                    {item}
                  </span>
                ))}
              </div>
            )}
            <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-200/40">
              ℹ️ {overview.selfReportedInterests.disclaimer}
            </div>
          </div>
        </div>
      )}

      {/* 3. Strengths & Development Areas Grid */}
      {(hasStrengths || hasGrowth) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* Demonstrated Evidence Strengths */}
          <div className="p-4 rounded-xl bg-emerald-50/40 border border-emerald-100 space-y-2.5">
            <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Demonstrated Evidence & Strengths</span>
            </h4>
            <div className="space-y-2">
              {overview.demonstratedStrengths?.map((item, idx) => (
                <div key={idx} className="text-xs text-emerald-950 flex items-start gap-2">
                  <span className="text-emerald-500 font-bold">•</span>
                  <div className="flex-1">
                    <span>{item.statement}</span>
                    {item.referencedQuestions?.length > 0 && (
                      <span className="ml-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded border border-emerald-200">
                        {item.referencedQuestions.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Development / Attention Areas */}
          <div className="p-4 rounded-xl bg-amber-50/40 border border-amber-100 space-y-2.5">
            <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Areas for Probing & Growth</span>
            </h4>
            <div className="space-y-2">
              {overview.potentialDevelopmentAreas?.map((item, idx) => (
                <div key={idx} className="text-xs text-amber-950 flex items-start gap-2">
                  <span className="text-amber-500 font-bold">•</span>
                  <div className="flex-1">
                    <span>{item.statement}</span>
                    {item.referencedQuestions?.length > 0 && (
                      <span className="ml-1.5 text-[10px] font-bold text-amber-800 bg-amber-100/70 px-1.5 py-0.5 rounded border border-amber-200">
                        {item.referencedQuestions.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. Work-Style Dimensions Breakdown */}
      {overview.dimensionObservations && Object.keys(overview.dimensionObservations).length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#10234E] uppercase tracking-wider">
              Work-Style Dimensions (7 Dimensions)
            </h3>
            <span className="text-[10px] text-slate-400 font-medium">Click to expand observations</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {Object.entries(overview.dimensionObservations).map(([dimKey, dim]) => {
              const isExpanded = expandedDimensions[dimKey];
              const levelLabel = dim.qualitativeLevel.replace(/_/g, ' ');
              const isInsufficient = dim.evidenceStatus === 'INSUFFICIENT' || dim.qualitativeLevel === 'INSUFFICIENT_EVIDENCE';

              return (
                <div 
                  key={dimKey}
                  className="rounded-xl border border-slate-200/80 bg-white p-3 hover:border-slate-300 transition-colors shadow-2xs space-y-2"
                >
                  <div 
                    onClick={() => toggleDimension(dimKey)}
                    className="flex items-center justify-between cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100">
                        {DIMENSION_ICONS[dimKey as WorkStyleDimensionId] || <UserCheck className="w-3.5 h-3.5 text-slate-600" />}
                      </div>
                      <span className="text-xs font-bold text-[#10234E]">{dim.dimensionName}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        isInsufficient 
                          ? 'bg-slate-100 text-slate-500 border-slate-200' 
                          : 'bg-blue-50 text-[#1760FF] border-blue-100'
                      }`}>
                        {levelLabel}
                      </span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-normal">
                    {dim.summary}
                  </p>

                  {dim.referencedQuestionCodes?.length > 0 && (
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                      <span>Referenced:</span>
                      <span className="font-bold text-slate-600">{dim.referencedQuestionCodes.join(', ')}</span>
                    </div>
                  )}

                  {isExpanded && dim.supportingObservations?.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 space-y-1">
                      {dim.supportingObservations.map((obs, idx) => (
                        <div key={idx} className="text-[11px] text-slate-600 flex items-start gap-1.5">
                          <span className="text-indigo-400">•</span>
                          <span>{obs}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Recommended Follow-Up Questions for Human Interviewers */}
      {hasFollowUps && (
        <div className="space-y-2 pt-1">
          <h3 className="text-xs font-bold text-[#10234E] uppercase tracking-wider flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-indigo-600" />
            <span>Recommended Interview Follow-Up Questions</span>
          </h3>

          <div className="space-y-2">
            {overview.recommendedFollowUpQuestions.map((fu, idx) => (
              <div 
                key={idx}
                className="bg-indigo-50/40 border border-indigo-100/80 rounded-xl p-3 text-xs text-indigo-950 flex items-start gap-2.5"
              >
                <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                  {idx + 1}
                </div>
                <div className="flex-1 space-y-0.5">
                  <div className="font-bold text-slate-900">
                    &ldquo;{fu.question}&rdquo;
                  </div>
                  {fu.context && (
                    <div className="text-[11px] text-slate-500">
                      Context: {fu.context} {fu.questionCodeRef && <span className="font-semibold text-indigo-600">[{fu.questionCodeRef}]</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Insufficient Evidence Notes */}
      {overview.insufficientEvidenceNotes?.length > 0 && (
        <div className="text-[11px] text-slate-400 italic bg-slate-50 p-2.5 rounded-lg border border-slate-200/40 flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <div>
            <span>Evidence Note: </span>
            {overview.insufficientEvidenceNotes.join(' • ')}
          </div>
        </div>
      )}
    </div>
  );
}
