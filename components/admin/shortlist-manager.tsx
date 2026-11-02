'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { BrandLogo } from '@/components/common/BrandLogo';
import { 
  Trophy, 
  Award, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Sliders, 
  Filter, 
  Sparkles, 
  Download, 
  RotateCw, 
  FileSpreadsheet, 
  ChevronDown, 
  ChevronUp, 
  Info, 
  Lock, 
  Check, 
  ArrowLeft, 
  Search, 
  Users, 
  Layers, 
  Settings2, 
  Save, 
  Send, 
  Eye, 
  X,
  BadgeCheck,
  Calendar,
  Clock
} from 'lucide-react';
import { 
  CATEGORIES, 
  CATEGORY_ORDER, 
  getCategoryLabel, 
  isEligibilityCategory,
  isPersonalityCategory,
  CanonicalCategoryId
} from '@/lib/categories';

// Types matching backend shortlisting-engine.ts
interface ShortlistConfig {
  shortlistSize: number;
  overallCutoffEnabled: boolean;
  overallCutoffPercentage: number;
  sectionCutoffs: Record<string, number>;
  overallWeight: number;
  sectionWeight: number;
  categoryWeights: Record<string, number>;
}

interface CandidateCategoryScore {
  category: string;
  categoryLabel: string;
  earnedMarks: number;
  maxMarks: number;
  percentage: number;
  configuredWeight: number;
  normalizedWeight: number;
  meetsCutoff: boolean;
  requiredCutoff: number | null;
}

interface RankedCandidate {
  studentId: string;
  fullName: string;
  usn: string;
  email: string;
  branch: string;
  testId: string;
  testTitle: string;
  round: number;
  templateId: string | null;
  attemptStatus: string;
  isAttemptEligible: boolean;
  timeTakenMinutes: number;
  violationsCount: number;
  submittedAt: string | null;

  overallEarnedMarks: number;
  overallMaxMarks: number;
  overallPercentage: number;
  categoryScores: Record<string, CandidateCategoryScore>;
  weightedSectionPercentage: number;
  rankingScore: number;

  meetsAttemptEligibility: boolean;
  meetsOverallCutoff: boolean;
  meetsSectionCutoffs: boolean;
  isQualified: boolean;

  shortlistStatus: 'shortlisted' | 'not_shortlisted' | 'disqualified' | 'pending_review';
  rank: number | null;
  exclusionReasons: string[];
  needsReview: boolean;
  reviewReason: string | null;
}

interface PreviewSummary {
  totalEvaluatedAttempts: number;
  totalUniqueCandidates: number;
  qualifiedCount: number;
  shortlistedCount: number;
  notShortlistedCount: number;
  disqualifiedCount: number;
  pendingReviewCount: number;
}

interface TestTemplate {
  id: string;
  name: string;
  description?: string;
  total_questions?: number;
  total_duration?: number;
}

interface PublishedShortlistData {
  id: string;
  round: number;
  templateId: string | null;
  templateName: string | null;
  shortlistSize: number;
  publishedAt: string;
  configSnapshot: ShortlistConfig;
  candidatesCount: number;
  shortlistedCount: number;
  candidates: Array<{
    id: string;
    rank: number | null;
    studentId: string;
    fullName: string;
    usn: string;
    email: string;
    branch: string;
    testId: string;
    testTitle: string;
    rankingScore: number | null;
    overallPercentage: number | null;
    sectionPercentages: Record<string, number> | null;
    status: string;
    exclusionReasons: string[];
  }>;
}

export function ShortlistManager() {
  // Navigation & View State
  const [activeTab, setActiveTab] = useState<'configure' | 'published'>('configure');

  // Filter Selection
  const [templates, setTemplates] = useState<TestTemplate[]>([]);
  const [availableRounds, setAvailableRounds] = useState<number[]>([1, 2]);
  const [selectedRound, setSelectedRound] = useState<number>(1);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('all');

  // Configuration State
  const [shortlistSize, setShortlistSize] = useState<number>(10);
  const [customSizeInput, setCustomSizeInput] = useState<string>('10');
  const [overallCutoffEnabled, setOverallCutoffEnabled] = useState<boolean>(false);
  const [overallCutoffPercentage, setOverallCutoffPercentage] = useState<number>(60);
  const [overallWeight, setOverallWeight] = useState<number>(50);
  const [sectionWeight, setSectionWeight] = useState<number>(50);

  // Scored Categories Weight & Cutoffs
  const scoredCategories = useMemo(() => {
    return CATEGORY_ORDER.filter(id => !isEligibilityCategory(id) && !isPersonalityCategory(id));
  }, []);

  const [categoryWeights, setCategoryWeights] = useState<Record<string, number>>({
    APTITUDE: 50,
    CODING: 50
  });

  const [sectionCutoffs, setSectionCutoffs] = useState<Record<string, number>>({});
  const [activeSectionCutoffToggles, setActiveSectionCutoffToggles] = useState<Record<string, boolean>>({});

  // Calculation & Preview State
  const [isSettingsLoading, setIsSettingsLoading] = useState<boolean>(false);
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);
  const [isCalculatingPreview, setIsCalculatingPreview] = useState<boolean>(false);
  const [previewSummary, setPreviewSummary] = useState<PreviewSummary | null>(null);
  const [candidates, setCandidates] = useState<RankedCandidate[]>([]);
  const [calculatedAt, setCalculatedAt] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Published Shortlist State
  const [isPublishedLoading, setIsPublishedLoading] = useState<boolean>(false);
  const [publishedData, setPublishedData] = useState<PublishedShortlistData | null>(null);
  const [isStale, setIsStale] = useState<boolean>(false);
  const [staleReason, setStaleReason] = useState<string | null>(null);

  // Review & Confirmation Modal
  const [isPublishModalOpen, setIsPublishModalOpen] = useState<boolean>(false);
  const [publishConfirmationChecked, setPublishConfirmationChecked] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);

  // Detailed Candidate Breakdown Modal
  const [inspectCandidate, setInspectCandidate] = useState<RankedCandidate | null>(null);

  // Preview Filter & Search
  const [candidateFilterStatus, setCandidateFilterStatus] = useState<'all' | 'shortlisted' | 'qualified' | 'disqualified' | 'pending_review'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Compute live relative normalized category weights
  const normalizedCategoryWeights = useMemo(() => {
    const totalRel = Object.entries(categoryWeights).reduce((acc, [cat, w]) => {
      return (w > 0) ? acc + w : acc;
    }, 0);

    const norm: Record<string, { normalizedPct: number; effectivePct: number }> = {};
    for (const cat of scoredCategories) {
      const rel = categoryWeights[cat] || 0;
      if (totalRel > 0 && rel > 0) {
        const normPct = Math.round((rel / totalRel) * 1000) / 10;
        const effPct = Math.round((normPct * sectionWeight / 100) * 10) / 10;
        norm[cat] = { normalizedPct: normPct, effectivePct: effPct };
      } else {
        norm[cat] = { normalizedPct: 0, effectivePct: 0 };
      }
    }
    return { norm, totalRel };
  }, [categoryWeights, scoredCategories, sectionWeight]);

  // Load available templates and rounds on mount
  useEffect(() => {
    loadAssessmentsMeta();
  }, []);

  // When round or template changes, reload settings and published shortlist
  useEffect(() => {
    loadSavedSettings();
    loadPublishedShortlist();
  }, [selectedRound, selectedTemplateId]);

  const loadAssessmentsMeta = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/admin/shortlist/assessments', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.templates) setTemplates(res.data.templates);
      if (res.data.rounds) setAvailableRounds(res.data.rounds);
    } catch (err: any) {
      console.error('[Load Assessments Error]', err);
    }
  };

  const loadSavedSettings = async () => {
    setIsSettingsLoading(true);
    setPreviewError(null);
    try {
      const token = localStorage.getItem('token');
      const templateParam = selectedTemplateId !== 'all' ? `&templateId=${selectedTemplateId}` : '';
      const res = await axios.get(`/api/admin/shortlist/settings?round=${selectedRound}${templateParam}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const s = res.data.settings;
      if (s) {
        setShortlistSize(s.shortlistSize ?? 10);
        setCustomSizeInput(String(s.shortlistSize ?? 10));
        setOverallCutoffEnabled(Boolean(s.overallCutoffEnabled));
        setOverallCutoffPercentage(s.overallCutoffPercentage ?? 60);
        setOverallWeight(s.overallWeight ?? 50);
        setSectionWeight(s.sectionWeight ?? 50);

        if (s.categoryWeights && Object.keys(s.categoryWeights).length > 0) {
          setCategoryWeights(s.categoryWeights);
        } else {
          setCategoryWeights({ APTITUDE: 50, CODING: 50 });
        }

        if (s.sectionCutoffs) {
          setSectionCutoffs(s.sectionCutoffs);
          const toggles: Record<string, boolean> = {};
          for (const [k, v] of Object.entries(s.sectionCutoffs)) {
            if (Number(v) > 0) toggles[k] = true;
          }
          setActiveSectionCutoffToggles(toggles);
        }
      }

      // Automatically trigger initial preview calculation with loaded settings
      handleCalculatePreview(s);
    } catch (err: any) {
      console.error('[Load Settings Error]', err);
      toast.error('Failed to load shortlist settings');
    } finally {
      setIsSettingsLoading(false);
    }
  };

  const loadPublishedShortlist = async () => {
    setIsPublishedLoading(true);
    try {
      const token = localStorage.getItem('token');
      const templateParam = selectedTemplateId !== 'all' ? `&templateId=${selectedTemplateId}` : '';
      const res = await axios.get(`/api/admin/shortlist?round=${selectedRound}${templateParam}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.isPublished && res.data.shortlist) {
        setPublishedData(res.data.shortlist);
        setIsStale(Boolean(res.data.isStale));
        setStaleReason(res.data.staleReason || null);
      } else {
        setPublishedData(null);
        setIsStale(false);
        setStaleReason(null);
      }
    } catch (err: any) {
      console.error('[Load Published Shortlist Error]', err);
    } finally {
      setIsPublishedLoading(false);
    }
  };

  // Synchronized weight handler: ensures overallWeight + sectionWeight === 100
  const handleOverallWeightChange = (newOverall: number) => {
    const clampedOverall = Math.max(0, Math.min(100, Math.round(newOverall)));
    setOverallWeight(clampedOverall);
    setSectionWeight(100 - clampedOverall);
  };

  const handleSectionWeightChange = (newSection: number) => {
    const clampedSection = Math.max(0, Math.min(100, Math.round(newSection)));
    setSectionWeight(clampedSection);
    setOverallWeight(100 - clampedSection);
  };

  // Shortlist size quick select
  const handleSizePresetClick = (size: number) => {
    setShortlistSize(size);
    setCustomSizeInput(String(size));
  };

  const handleCustomSizeChange = (val: string) => {
    setCustomSizeInput(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setShortlistSize(parsed);
    }
  };

  // Category weight toggle and stepper
  const handleCategoryWeightToggle = (cat: string) => {
    setCategoryWeights(prev => {
      const next = { ...prev };
      if (next[cat] !== undefined && next[cat] > 0) {
        delete next[cat];
      } else {
        next[cat] = 50; // default weight when activated
      }
      return next;
    });
  };

  const handleCategoryWeightValueChange = (cat: string, val: number) => {
    const clamped = Math.max(1, Math.min(100, Math.round(val)));
    setCategoryWeights(prev => ({
      ...prev,
      [cat]: clamped
    }));
  };

  // Section cutoff toggle and percentage
  const handleSectionCutoffToggle = (cat: string) => {
    setActiveSectionCutoffToggles(prev => {
      const isCurrentlyActive = Boolean(prev[cat]);
      const nextState = { ...prev, [cat]: !isCurrentlyActive };
      setSectionCutoffs(currCutoffs => {
        const nextCutoffs = { ...currCutoffs };
        if (isCurrentlyActive) {
          delete nextCutoffs[cat];
        } else {
          nextCutoffs[cat] = 50; // default 50% cutoff
        }
        return nextCutoffs;
      });
      return nextState;
    });
  };

  const handleSectionCutoffValueChange = (cat: string, val: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(val)));
    setSectionCutoffs(prev => ({
      ...prev,
      [cat]: clamped
    }));
  };

  // Build current active config payload
  const buildCurrentConfig = (): ShortlistConfig => {
    // Clean up category weights for active categories only
    const cleanedWeights: Record<string, number> = {};
    for (const [k, v] of Object.entries(categoryWeights)) {
      if (v > 0) cleanedWeights[k] = v;
    }

    // Clean up section cutoffs for active toggles only
    const cleanedCutoffs: Record<string, number> = {};
    for (const [k, active] of Object.entries(activeSectionCutoffToggles)) {
      if (active && sectionCutoffs[k] > 0) {
        cleanedCutoffs[k] = sectionCutoffs[k];
      }
    }

    return {
      shortlistSize,
      overallCutoffEnabled,
      overallCutoffPercentage,
      sectionCutoffs: cleanedCutoffs,
      overallWeight,
      sectionWeight,
      categoryWeights: cleanedWeights
    };
  };

  // Calculate preview ranking
  const handleCalculatePreview = async (overrideConfig?: any) => {
    const configToUse = overrideConfig || buildCurrentConfig();

    // Client-side quick sanity check
    if (configToUse.sectionWeight > 0) {
      const catWeights = (configToUse.categoryWeights || {}) as Record<string, number>;
      const totalRel = Object.values(catWeights).reduce<number>((a, b) => a + (Number(b) || 0), 0);
      if (totalRel <= 0) {
        toast.error('When section weight is > 0, at least one scored category must have a relative weight > 0.');
        return;
      }
    }

    setIsCalculatingPreview(true);
    setPreviewError(null);
    try {
      const token = localStorage.getItem('token');
      const templateId = selectedTemplateId !== 'all' ? selectedTemplateId : null;

      const res = await axios.post('/api/admin/shortlist/preview', {
        round: selectedRound,
        templateId,
        config: configToUse
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.result) {
        setPreviewSummary(res.data.result.summary);
        setCandidates(res.data.result.candidates || []);
        setCalculatedAt(res.data.result.calculatedAt || new Date().toISOString());
        toast.success('Preview rankings updated', { id: 'preview-calc' });
      }
    } catch (err: any) {
      console.error('[Calculate Preview Error]', err);
      const errMsg = err.response?.data?.message || err.message || 'Failed to calculate shortlist preview';
      setPreviewError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsCalculatingPreview(false);
    }
  };

  // Save Settings to Backend Database
  const handleSaveSettings = async () => {
    const config = buildCurrentConfig();

    if (config.sectionWeight > 0) {
      const totalRel = Object.values(config.categoryWeights || {}).reduce<number>((a, b) => a + (Number(b) || 0), 0);
      if (totalRel <= 0) {
        toast.error('Select at least one category with a positive weight.');
        return;
      }
    }

    setIsSavingSettings(true);
    try {
      const token = localStorage.getItem('token');
      const templateId = selectedTemplateId !== 'all' ? selectedTemplateId : null;

      const res = await axios.post('/api/admin/shortlist/settings', {
        round: selectedRound,
        templateId,
        ...config
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Shortlisting settings saved successfully!');
      // Refresh preview to keep in sync
      handleCalculatePreview(res.data.settings);
    } catch (err: any) {
      console.error('[Save Settings Error]', err);
      const msg = err.response?.data?.message || 'Failed to save settings';
      toast.error(msg);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Publish Shortlist Handler
  const handlePublishShortlist = async () => {
    if (!publishConfirmationChecked) {
      toast.error('Please check the confirmation box to authorize publication.');
      return;
    }

    setIsPublishing(true);
    try {
      const token = localStorage.getItem('token');
      const templateId = selectedTemplateId !== 'all' ? selectedTemplateId : null;
      const config = buildCurrentConfig();

      const res = await axios.post('/api/admin/shortlist/publish', {
        round: selectedRound,
        templateId,
        config
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success(`Published shortlist successfully! ${res.data.shortlistedCandidatesCount} candidates shortlisted.`);
      setIsPublishModalOpen(false);
      setPublishConfirmationChecked(false);

      // Refresh published tab
      await loadPublishedShortlist();
      setActiveTab('published');
    } catch (err: any) {
      console.error('[Publish Shortlist Error]', err);
      const msg = err.response?.data?.message || 'Failed to publish shortlist';
      toast.error(msg);
    } finally {
      setIsPublishing(false);
    }
  };

  // Export Shortlist to Excel
  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const token = localStorage.getItem('token');
      const templateParam = selectedTemplateId !== 'all' ? `&templateId=${selectedTemplateId}` : '';
      
      const response = await axios.get(`/api/admin/shortlist/export?round=${selectedRound}${templateParam}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Candidate_Shortlist_Round_${selectedRound}_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Excel workbook downloaded successfully');
    } catch (err: any) {
      console.error('[Export Shortlist Error]', err);
      toast.error('Failed to export shortlist to Excel');
    } finally {
      setIsExporting(false);
    }
  };

  // Filter candidates list for table
  const distinctBranches = useMemo(() => {
    const branches = new Set<string>();
    candidates.forEach(c => {
      if (c.branch && c.branch.trim()) branches.add(c.branch.trim());
    });
    return Array.from(branches).sort();
  }, [candidates]);

  const filteredCandidates = useMemo(() => {
    return candidates.filter(c => {
      // Status filter
      if (candidateFilterStatus === 'shortlisted' && c.shortlistStatus !== 'shortlisted') return false;
      if (candidateFilterStatus === 'qualified' && !c.isQualified) return false;
      if (candidateFilterStatus === 'disqualified' && c.shortlistStatus !== 'disqualified') return false;
      if (candidateFilterStatus === 'pending_review' && c.shortlistStatus !== 'pending_review') return false;

      // Branch filter
      if (selectedBranch !== 'all' && c.branch !== selectedBranch) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = c.fullName.toLowerCase().includes(q);
        const matchesUsn = c.usn.toLowerCase().includes(q);
        const matchesEmail = c.email.toLowerCase().includes(q);
        const matchesBranch = c.branch.toLowerCase().includes(q);
        if (!matchesName && !matchesUsn && !matchesEmail && !matchesBranch) return false;
      }

      return true;
    });
  }, [candidates, candidateFilterStatus, selectedBranch, searchQuery]);

  return (
    <div className="min-h-screen bg-[#F3F7FD] relative overflow-x-hidden text-[#10234E] font-sans selection:bg-blue-100 selection:text-blue-900 pb-20">
      {/* Decorative Canvas Background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
        <div 
          className="absolute inset-0" 
          style={{
            background: 'radial-gradient(circle at 50% 35%, #F8FAFE 0%, #EEF5FD 55%, #E6F1FC 100%)'
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
            <linearGradient id="slTopGrad" x1="1440" y1="0" x2="880" y2="400" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#BCDDFC" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#D2E8FD" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#EAF3FD" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="slBottomGrad" x1="0" y1="600" x2="1440" y2="850" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#CCE4FD" stopOpacity="0.6" />
              <stop offset="50%" stopColor="#DEEFFE" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#F0F6FD" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          <path d="M1440 0 L 960 0 C 960 180, 1100 340, 1440 390 Z" fill="url(#slTopGrad)" />
          <path d="M0 640 C 320 680, 680 620, 1050 540 C 1220 500, 1370 560, 1440 600 L 1440 900 L 0 900 Z" fill="url(#slBottomGrad)" />
        </svg>
      </div>

      {/* Main Foreground Container */}
      <div className="relative z-10 w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        
        {/* Top Header Navigation */}
        <header className="w-full bg-white rounded-2xl sm:rounded-[22px] border border-[#DCE5F0] shadow-[0_2px_12px_rgba(16,35,78,0.03)] px-5 sm:px-8 py-3.5 sm:py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/admin/dashboard" className="flex items-center gap-2 hover:opacity-90 transition">
              <BrandLogo size="md" className="flex-row items-center" />
            </Link>
            <span className="px-3 py-1 rounded-full bg-[#EEF5FF] text-[#1760FF] text-[11px] font-bold tracking-wider uppercase border border-[#BFDBFE]">
              SHORTLIST & RANKING
            </span>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-4">
            <Link
              href="/admin/students"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[#DCE5F0] text-xs font-semibold text-[#10234E] hover:bg-slate-50 transition-colors"
            >
              <Users className="w-3.5 h-3.5 text-[#1760FF]" />
              <span>Student Directory</span>
            </Link>

            <Link
              href="/admin/dashboard"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#1760FF] text-white text-xs font-semibold hover:bg-blue-700 transition-colors shadow-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </Link>
          </div>
        </header>

        {/* Title & Primary Tab Switcher */}
        <section className="mt-8 mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-[28px] font-bold text-[#10234E] tracking-tight flex items-center gap-2.5">
              <Trophy className="w-7 h-7 text-[#1760FF]" />
              Dynamic Candidate Shortlisting
            </h1>
            <p className="text-sm font-normal text-[#607797] mt-1">
              Configure dynamic weights, overall & section cutoffs, preview candidate rankings, and publish official shortlists.
            </p>
          </div>

          {/* Primary View Toggle: Configure & Preview vs Published Shortlist */}
          <div className="bg-white p-1 rounded-xl border border-[#DCE5F0] flex items-center shadow-xs self-start md:self-auto">
            <button
              onClick={() => setActiveTab('configure')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'configure'
                  ? 'bg-[#1760FF] text-white shadow-xs'
                  : 'text-[#607797] hover:text-[#10234E] hover:bg-[#F3F7FD]'
              }`}
            >
              <Settings2 className="w-4 h-4" />
              <span>Configure & Preview</span>
            </button>

            <button
              onClick={() => setActiveTab('published')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer relative ${
                activeTab === 'published'
                  ? 'bg-[#1760FF] text-white shadow-xs'
                  : 'text-[#607797] hover:text-[#10234E] hover:bg-[#F3F7FD]'
              }`}
            >
              <Award className="w-4 h-4" />
              <span>Published Shortlist</span>
              {publishedData && (
                <span className={`w-2 h-2 rounded-full ${isStale ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
              )}
            </button>
          </div>
        </section>

        {/* Global Assessment & Round Filter Bar */}
        <div className="bg-white rounded-2xl border border-[#DCE5F0] p-4 sm:p-5 shadow-[0_2px_8px_rgba(16,35,78,0.02)] mb-7 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            {/* Assessment Selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#607797] whitespace-nowrap">
                Assessment:
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="bg-[#F8FAFD] border border-[#DCE5F0] text-[#10234E] text-xs font-semibold rounded-lg px-3 py-2 outline-none focus:border-[#1760FF] focus:ring-1 focus:ring-[#1760FF]"
              >
                <option value="all">All Assessments / Master Pool</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Round Selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#607797] whitespace-nowrap">
                Round:
              </label>
              <select
                value={selectedRound}
                onChange={(e) => setSelectedRound(Number(e.target.value))}
                className="bg-[#F8FAFD] border border-[#DCE5F0] text-[#10234E] text-xs font-semibold rounded-lg px-3 py-2 outline-none focus:border-[#1760FF] focus:ring-1 focus:ring-[#1760FF]"
              >
                {availableRounds.map(r => (
                  <option key={r} value={r}>Round {r} {r === 1 ? '(Aptitude Screening)' : r === 2 ? '(Technical Assessment)' : ''}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-[#607797]">
            {isSettingsLoading ? (
              <span className="flex items-center gap-1.5 text-blue-600 font-medium">
                <RotateCw className="w-3.5 h-3.5 animate-spin" /> Loading criteria...
              </span>
            ) : (
              <span className="flex items-center gap-1 text-slate-500">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                Settings synchronized for Round {selectedRound}
              </span>
            )}
          </div>
        </div>

        {/* TAB 1: CONFIGURE & PREVIEW */}
        {activeTab === 'configure' && (
          <div className="space-y-8">
            
            {/* Top Config Grid: Left Settings (2 Cols) | Right Live Summary Card */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Settings Controls (Span 2) */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Section 1: Shortlist Size (Top N) */}
                <div className="bg-white rounded-[20px] border border-[#DCE5F0] p-6 shadow-[0_2px_8px_rgba(16,35,78,0.02)]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#EAF2FE] text-[#1760FF] flex items-center justify-center font-bold text-sm">
                        1
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-[#10234E]">Shortlist Size</h3>
                        <p className="text-xs text-[#607797]">Select or enter how many top ranking candidates to shortlist.</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[#1760FF] bg-[#EEF5FF] px-2.5 py-1 rounded-full border border-[#BFDBFE]">
                      Top {shortlistSize}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                    {[10, 20, 30].map(size => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => handleSizePresetClick(size)}
                        className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                          shortlistSize === size && customSizeInput === String(size)
                            ? 'bg-[#1760FF] text-white border-[#1760FF] shadow-xs'
                            : 'bg-[#F8FAFD] text-[#10234E] border-[#DCE5F0] hover:bg-[#EEF5FF]'
                        }`}
                      >
                        Top {size}
                      </button>
                    ))}

                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        value={customSizeInput}
                        onChange={(e) => handleCustomSizeChange(e.target.value)}
                        placeholder="Custom N"
                        className="w-full py-2 px-3 text-xs font-bold rounded-xl border border-[#DCE5F0] bg-[#F8FAFD] text-[#10234E] focus:outline-none focus:border-[#1760FF] focus:ring-1 focus:ring-[#1760FF]"
                      />
                      <span className="absolute right-2.5 top-2.5 text-[10px] font-bold text-[#607797] uppercase">
                        Custom
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section 2: Weight Allocation (Sum must equal 100%) */}
                <div className="bg-white rounded-[20px] border border-[#DCE5F0] p-6 shadow-[0_2px_8px_rgba(16,35,78,0.02)]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#EAF2FE] text-[#1760FF] flex items-center justify-center font-bold text-sm">
                        2
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-[#10234E]">Performance Weight Allocation</h3>
                        <p className="text-xs text-[#607797]">
                          Balance overall score vs. section-specific performance. Weights strictly total 100%.
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      Total: {overallWeight + sectionWeight}%
                    </span>
                  </div>

                  {/* Synchronized Dual Slider Bar */}
                  <div className="mt-4 p-4 rounded-xl bg-[#F8FAFD] border border-[#E2E8F0]">
                    <div className="flex items-center justify-between text-xs font-bold mb-2">
                      <span className="text-[#1760FF] flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#1760FF]" />
                        Overall Performance: {overallWeight}%
                      </span>
                      <span className="text-[#7C3AED] flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#7C3AED]" />
                        Section Performance: {sectionWeight}%
                      </span>
                    </div>

                    {/* Visual Segmented Bar */}
                    <div className="w-full h-3 rounded-full bg-slate-200 overflow-hidden flex mb-4">
                      <div 
                        style={{ width: `${overallWeight}%` }} 
                        className="bg-[#1760FF] h-full transition-all duration-150"
                      />
                      <div 
                        style={{ width: `${sectionWeight}%` }} 
                        className="bg-[#7C3AED] h-full transition-all duration-150"
                      />
                    </div>

                    {/* Dual Sliders */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <label className="text-[#607797] font-semibold">Overall Weight (%)</label>
                          <span className="font-bold text-[#10234E]">{overallWeight}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="1"
                          value={overallWeight}
                          onChange={(e) => handleOverallWeightChange(Number(e.target.value))}
                          className="w-full accent-[#1760FF] cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <label className="text-[#607797] font-semibold">Section Weight (%)</label>
                          <span className="font-bold text-[#10234E]">{sectionWeight}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="1"
                          value={sectionWeight}
                          onChange={(e) => handleSectionWeightChange(Number(e.target.value))}
                          className="w-full accent-[#7C3AED] cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 3: Section Categories & Relative Weights */}
                <div className="bg-white rounded-[20px] border border-[#DCE5F0] p-6 shadow-[0_2px_8px_rgba(16,35,78,0.02)]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#EAF2FE] text-[#1760FF] flex items-center justify-center font-bold text-sm">
                        3
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-[#10234E]">Section Component Weights</h3>
                        <p className="text-xs text-[#607797]">
                          Select active categories and configure relative weights. Engine normalizes these into the {sectionWeight}% section component.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 divide-y divide-slate-100 border border-[#E2E8F0] rounded-xl overflow-hidden bg-white">
                    {scoredCategories.map(cat => {
                      const isActive = (categoryWeights[cat] !== undefined && categoryWeights[cat] > 0);
                      const currentWeight = categoryWeights[cat] || 0;
                      const normInfo = normalizedCategoryWeights.norm[cat] || { normalizedPct: 0, effectivePct: 0 };

                      return (
                        <div 
                          key={cat} 
                          className={`p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                            isActive ? 'bg-[#F9FBFE]' : 'bg-white opacity-70 hover:opacity-100'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              id={`cat-${cat}`}
                              checked={isActive}
                              onChange={() => handleCategoryWeightToggle(cat)}
                              className="w-4 h-4 rounded text-[#1760FF] focus:ring-[#1760FF] cursor-pointer"
                            />
                            <div>
                              <label htmlFor={`cat-${cat}`} className="text-xs font-bold text-[#10234E] cursor-pointer">
                                {getCategoryLabel(cat)}
                              </label>
                              <p className="text-[11px] text-[#607797]">{CATEGORIES[cat as CanonicalCategoryId]?.description}</p>
                            </div>
                          </div>

                          {isActive ? (
                            <div className="flex items-center gap-3 self-end sm:self-center">
                              <div className="flex items-center gap-1.5">
                                <label className="text-[11px] text-[#607797] font-semibold">Relative:</label>
                                <input
                                  type="number"
                                  min="1"
                                  max="100"
                                  value={currentWeight}
                                  onChange={(e) => handleCategoryWeightValueChange(cat, Number(e.target.value))}
                                  className="w-16 px-2 py-1 text-xs font-bold text-center border border-[#DCE5F0] rounded-lg bg-white focus:outline-none focus:border-[#1760FF]"
                                />
                              </div>

                              <div className="flex flex-col items-end min-w-[100px]">
                                <span className="text-xs font-bold text-[#1760FF]">
                                  {normInfo.normalizedPct}% within sec
                                </span>
                                <span className="text-[10px] text-[#607797]">
                                  {normInfo.effectivePct}% overall impact
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-[11px] font-semibold text-slate-400 self-end sm:self-center">
                              Not Weighted
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Section 4: Cutoffs & Disqualification Criteria */}
                <div className="bg-white rounded-[20px] border border-[#DCE5F0] p-6 shadow-[0_2px_8px_rgba(16,35,78,0.02)]">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-9 h-9 rounded-xl bg-[#EAF2FE] text-[#1760FF] flex items-center justify-center font-bold text-sm">
                      4
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#10234E]">Qualification Cutoffs</h3>
                      <p className="text-xs text-[#607797]">
                        Optional thresholds. Candidates below cutoffs are disqualified from ranking.
                      </p>
                    </div>
                  </div>

                  {/* Minimum Attempt Criterion Reminder */}
                  <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200/70 mb-4 flex items-center gap-3">
                    <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <p className="text-xs text-blue-900 leading-relaxed">
                      <strong className="font-semibold">Minimum Attempt Rule:</strong> All candidates must attempt at least <strong className="font-semibold">60% of test questions</strong> to be eligible for evaluation and ranking.
                    </p>
                  </div>

                  {/* Overall Marks Cutoff Toggle */}
                  <div className="p-4 rounded-xl bg-[#F8FAFD] border border-[#E2E8F0] mb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="overall-cutoff-toggle"
                          checked={overallCutoffEnabled}
                          onChange={(e) => setOverallCutoffEnabled(e.target.checked)}
                          className="w-4 h-4 rounded text-[#1760FF] focus:ring-[#1760FF] cursor-pointer"
                        />
                        <div>
                          <label htmlFor="overall-cutoff-toggle" className="text-xs font-bold text-[#10234E] cursor-pointer">
                            Overall Score Cutoff
                          </label>
                          <p className="text-[11px] text-[#607797]">Disqualify candidates whose overall score is below this percentage.</p>
                        </div>
                      </div>

                      {overallCutoffEnabled && (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={overallCutoffPercentage}
                            onChange={(e) => setOverallCutoffPercentage(Math.max(0, Math.min(100, Number(e.target.value))))}
                            className="w-16 px-2 py-1 text-xs font-bold text-center border border-[#DCE5F0] rounded-lg bg-white focus:outline-none focus:border-[#1760FF]"
                          />
                          <span className="text-xs font-bold text-[#10234E]">%</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Individual Category Cutoffs */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#607797] mb-2">
                      Individual Section Minimums
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {scoredCategories.map(cat => {
                        const isCutoffActive = Boolean(activeSectionCutoffToggles[cat]);
                        const currentCutoff = sectionCutoffs[cat] || 50;

                        return (
                          <div 
                            key={cat}
                            className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                              isCutoffActive ? 'bg-[#F9FBFE] border-[#BFDBFE]' : 'bg-white border-[#E2E8F0]'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id={`cutoff-${cat}`}
                                checked={isCutoffActive}
                                onChange={() => handleSectionCutoffToggle(cat)}
                                className="w-3.5 h-3.5 rounded text-[#1760FF] cursor-pointer"
                              />
                              <label htmlFor={`cutoff-${cat}`} className="font-semibold text-[#10234E] truncate max-w-[140px] cursor-pointer">
                                {getCategoryLabel(cat)}
                              </label>
                            </div>

                            {isCutoffActive ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={currentCutoff}
                                  onChange={(e) => handleSectionCutoffValueChange(cat, Number(e.target.value))}
                                  className="w-12 px-1.5 py-0.5 text-xs font-bold text-center border border-[#DCE5F0] rounded bg-white"
                                />
                                <span className="font-bold text-[#10234E]">%</span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400">None</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>

              </div>

              {/* Live Criteria Summary & Action Panel (Span 1) */}
              <div className="space-y-6">
                <div className="bg-white rounded-[20px] border border-[#DCE5F0] p-6 shadow-[0_2px_8px_rgba(16,35,78,0.02)] sticky top-6">
                  <h3 className="text-base font-bold text-[#10234E] mb-1 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#1760FF]" />
                    Configuration Summary
                  </h3>
                  <p className="text-xs text-[#607797] mb-5">
                    Live snapshot of active shortlisting rules.
                  </p>

                  <div className="space-y-3.5 text-xs">
                    <div className="flex justify-between pb-2 border-b border-slate-100">
                      <span className="text-[#607797]">Assessment:</span>
                      <span className="font-bold text-[#10234E] text-right truncate max-w-[160px]">
                        {selectedTemplateId === 'all' ? 'All Assessments' : (templates.find(t => t.id === selectedTemplateId)?.name || 'Selected')}
                      </span>
                    </div>

                    <div className="flex justify-between pb-2 border-b border-slate-100">
                      <span className="text-[#607797]">Round:</span>
                      <span className="font-bold text-[#10234E]">Round {selectedRound}</span>
                    </div>

                    <div className="flex justify-between pb-2 border-b border-slate-100">
                      <span className="text-[#607797]">Target Shortlist:</span>
                      <span className="font-bold text-[#1760FF] bg-[#EEF5FF] px-2 py-0.5 rounded">
                        Top {shortlistSize}
                      </span>
                    </div>

                    <div className="flex justify-between pb-2 border-b border-slate-100">
                      <span className="text-[#607797]">Overall Weight:</span>
                      <span className="font-bold text-[#10234E]">{overallWeight}%</span>
                    </div>

                    <div className="flex justify-between pb-2 border-b border-slate-100">
                      <span className="text-[#607797]">Section Weight:</span>
                      <span className="font-bold text-[#10234E]">{sectionWeight}%</span>
                    </div>

                    <div className="flex justify-between pb-2 border-b border-slate-100">
                      <span className="text-[#607797]">Overall Cutoff:</span>
                      <span className={`font-bold ${overallCutoffEnabled ? 'text-amber-600' : 'text-slate-400'}`}>
                        {overallCutoffEnabled ? `≥ ${overallCutoffPercentage}%` : 'Disabled'}
                      </span>
                    </div>

                    <div className="pb-2 border-b border-slate-100">
                      <span className="text-[#607797] block mb-1.5">Active Section Weights:</span>
                      <div className="space-y-1 pl-2">
                        {Object.entries(categoryWeights).filter(([_, w]) => w > 0).map(([cat, w]) => {
                          const n = normalizedCategoryWeights.norm[cat];
                          return (
                            <div key={cat} className="flex justify-between text-[11px]">
                              <span className="text-[#10234E] truncate max-w-[140px]">{getCategoryLabel(cat)}</span>
                              <span className="font-semibold text-[#1760FF]">{n?.normalizedPct}% ({n?.effectivePct}% eff)</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <span className="text-[#607797] block mb-1.5">Active Section Cutoffs:</span>
                      {Object.keys(sectionCutoffs).length > 0 ? (
                        <div className="space-y-1 pl-2">
                          {Object.entries(sectionCutoffs).map(([cat, cut]) => (
                            <div key={cat} className="flex justify-between text-[11px]">
                              <span className="text-[#10234E] truncate max-w-[140px]">{getCategoryLabel(cat)}</span>
                              <span className="font-semibold text-rose-600">≥ {cut}%</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 pl-2">None configured</span>
                      )}
                    </div>
                  </div>

                  {/* Primary Action Buttons */}
                  <div className="mt-6 space-y-2.5">
                    <button
                      type="button"
                      onClick={() => handleCalculatePreview()}
                      disabled={isCalculatingPreview}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#1760FF] text-white text-xs font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {isCalculatingPreview ? (
                        <>
                          <RotateCw className="w-3.5 h-3.5 animate-spin" /> Recalculating...
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" /> Recalculate Preview
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveSettings}
                      disabled={isSavingSettings}
                      className="w-full py-2.5 px-4 rounded-xl bg-white border border-[#DCE5F0] text-[#10234E] text-xs font-bold hover:bg-slate-50 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isSavingSettings ? (
                        <>
                          <RotateCw className="w-3.5 h-3.5 animate-spin text-[#1760FF]" /> Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5 text-[#1760FF]" /> Save Settings
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsPublishModalOpen(true)}
                      disabled={candidates.length === 0 || isCalculatingPreview}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#0D9488] text-white text-xs font-bold hover:bg-teal-700 transition flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" /> Review & Publish Shortlist
                    </button>
                  </div>
                </div>
              </div>

            </div>

            {/* PREVIEW RANKING SECTION */}
            <div className="bg-white rounded-[22px] border border-[#DCE5F0] p-6 sm:p-7 shadow-[0_2px_12px_rgba(16,35,78,0.03)]">
              
              {/* Section Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div>
                  <h2 className="text-xl font-bold text-[#10234E] flex items-center gap-2.5">
                    <Trophy className="w-5 h-5 text-amber-500" />
                    Shortlist Ranking Preview
                  </h2>
                  <p className="text-xs text-[#607797] mt-0.5">
                    Combined scores calculated using Approach B formula. Tied scores broken deterministically.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleExportExcel}
                    disabled={isExporting || candidates.length === 0}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#DCE5F0] text-xs font-bold text-[#10234E] hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>Export Excel</span>
                  </button>
                </div>
              </div>

              {/* KPI Summary Cards */}
              {previewSummary && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5 my-6">
                  <div className="p-3.5 rounded-xl bg-[#F8FAFD] border border-[#E2E8F0] text-left">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#607797]">Total Evaluated</p>
                    <p className="text-xl font-bold text-[#10234E] mt-1">{previewSummary.totalUniqueCandidates}</p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-left">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Qualified</p>
                    <p className="text-xl font-bold text-blue-900 mt-1">{previewSummary.qualifiedCount}</p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-left">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Shortlisted (Top {shortlistSize})</p>
                    <p className="text-xl font-bold text-emerald-900 mt-1">{previewSummary.shortlistedCount}</p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200 text-left">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Disqualified</p>
                    <p className="text-xl font-bold text-rose-900 mt-1">{previewSummary.disqualifiedCount}</p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-left col-span-2 sm:col-span-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Pending Review</p>
                    <p className="text-xl font-bold text-amber-900 mt-1">{previewSummary.pendingReviewCount}</p>
                  </div>
                </div>
              )}

              {/* Incomplete Evaluation Amber Warning */}
              {previewSummary && previewSummary.pendingReviewCount > 0 && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3 mb-6">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs leading-relaxed">
                    <p className="font-bold">Incomplete / Pending Evaluations Detected ({previewSummary.pendingReviewCount} candidates)</p>
                    <p className="mt-0.5 text-amber-800">
                      Some candidate answers are still being evaluated or have failed evaluation. Their ranks are held until grading completes. You may still publish the current qualified subset, or wait for evaluations to finish.
                    </p>
                  </div>
                </div>
              )}

              {/* Error Banner */}
              {previewError && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 flex items-start gap-3 mb-6">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-bold">Error Calculating Rankings</p>
                    <p className="mt-0.5 text-red-700">{previewError}</p>
                  </div>
                </div>
              )}

              {/* Filter Pills & Candidate Search */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => setCandidateFilterStatus('all')}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                      candidateFilterStatus === 'all'
                        ? 'bg-[#1760FF] text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All ({candidates.length})
                  </button>
                  <button
                    onClick={() => setCandidateFilterStatus('shortlisted')}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                      candidateFilterStatus === 'shortlisted'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    Shortlisted ({previewSummary?.shortlistedCount ?? 0})
                  </button>
                  <button
                    onClick={() => setCandidateFilterStatus('qualified')}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                      candidateFilterStatus === 'qualified'
                        ? 'bg-blue-600 text-white'
                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                    }`}
                  >
                    Qualified ({previewSummary?.qualifiedCount ?? 0})
                  </button>
                  <button
                    onClick={() => setCandidateFilterStatus('disqualified')}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                      candidateFilterStatus === 'disqualified'
                        ? 'bg-rose-600 text-white'
                        : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                    }`}
                  >
                    Disqualified ({previewSummary?.disqualifiedCount ?? 0})
                  </button>
                  <button
                    onClick={() => setCandidateFilterStatus('pending_review')}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                      candidateFilterStatus === 'pending_review'
                        ? 'bg-amber-600 text-white'
                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                    }`}
                  >
                    Pending ({previewSummary?.pendingReviewCount ?? 0})
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {/* Branch filter */}
                  {distinctBranches.length > 0 && (
                    <select
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value)}
                      className="text-xs bg-[#F8FAFD] border border-[#DCE5F0] rounded-lg px-2.5 py-1.5 font-medium text-[#10234E]"
                    >
                      <option value="all">All Branches</option>
                      {distinctBranches.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  )}

                  {/* Search input */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#607797] absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search name, USN..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#DCE5F0] bg-[#F8FAFD] text-[#10234E] focus:outline-none focus:border-[#1760FF] w-48 sm:w-56"
                    />
                  </div>
                </div>
              </div>

              {/* CANDIDATES TABLE */}
              <div className="overflow-x-auto rounded-xl border border-[#DCE5F0]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#F8FAFD] border-b border-[#DCE5F0] text-[#607797] uppercase tracking-wider font-bold">
                      <th className="py-3 px-4 w-16 text-center">Rank</th>
                      <th className="py-3 px-4">Candidate Details</th>
                      <th className="py-3 px-4 text-center">Ranking Score</th>
                      <th className="py-3 px-4 text-center">Overall %</th>
                      <th className="py-3 px-4 text-center">Section %</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4">Exclusion / Reason</th>
                      <th className="py-3 px-4 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EBF1F8] text-[#10234E]">
                    {isCalculatingPreview ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-500">
                          <RotateCw className="w-6 h-6 animate-spin text-[#1760FF] mx-auto mb-2" />
                          <span>Calculating Approach B candidate rankings...</span>
                        </td>
                      </tr>
                    ) : filteredCandidates.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-500">
                          <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <p className="font-semibold text-slate-700">No candidates match this filter.</p>
                          <p className="text-xs text-slate-400 mt-1">Try switching rounds, assessments, or clearing the search query.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredCandidates.map((c) => {
                        const isShortlisted = c.shortlistStatus === 'shortlisted';
                        const isDisqualified = c.shortlistStatus === 'disqualified';
                        const isPending = c.shortlistStatus === 'pending_review';

                        return (
                          <tr 
                            key={c.studentId}
                            className={`hover:bg-[#F9FBFE] transition-colors ${
                              isShortlisted ? 'bg-emerald-50/30' : ''
                            }`}
                          >
                            {/* Rank */}
                            <td className="py-3 px-4 text-center">
                              {c.rank !== null ? (
                                <span className={`inline-flex items-center justify-center font-bold px-2 py-0.5 rounded-full text-xs ${
                                  c.rank === 1 ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                                  c.rank === 2 ? 'bg-slate-200 text-slate-800 border border-slate-300' :
                                  c.rank === 3 ? 'bg-amber-50 text-amber-900 border border-amber-200' :
                                  isShortlisted ? 'bg-emerald-100 text-emerald-800' :
                                  'bg-slate-100 text-slate-600'
                                }`}>
                                  #{c.rank}
                                </span>
                              ) : (
                                <span className="text-slate-300 font-bold">—</span>
                              )}
                            </td>

                            {/* Candidate Info */}
                            <td className="py-3 px-4">
                              <p className="font-bold text-[#10234E] text-sm">{c.fullName}</p>
                              <div className="flex items-center gap-2 text-[11px] text-[#607797] mt-0.5">
                                <span className="font-semibold">{c.usn}</span>
                                {c.branch && (
                                  <>
                                    <span>•</span>
                                    <span>{c.branch}</span>
                                  </>
                                )}
                              </div>
                            </td>

                            {/* Ranking Score */}
                            <td className="py-3 px-4 text-center">
                              {c.rankingScore > 0 ? (
                                <span className="font-extrabold text-sm text-[#1760FF]">
                                  {c.rankingScore.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-slate-400 font-medium">0.00</span>
                              )}
                            </td>

                            {/* Overall % */}
                            <td className="py-3 px-4 text-center font-semibold">
                              <span className={c.meetsOverallCutoff ? 'text-slate-700' : 'text-rose-600 line-through'}>
                                {c.overallPercentage}%
                              </span>
                            </td>

                            {/* Weighted Section % */}
                            <td className="py-3 px-4 text-center font-semibold">
                              <span className={c.meetsSectionCutoffs ? 'text-[#7C3AED]' : 'text-rose-600'}>
                                {c.weightedSectionPercentage}%
                              </span>
                            </td>

                            {/* Status */}
                            <td className="py-3 px-4 text-center">
                              {isShortlisted && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  <Check className="w-3 h-3" /> SHORTLISTED
                                </span>
                              )}
                              {c.shortlistStatus === 'not_shortlisted' && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                  QUALIFIED
                                </span>
                              )}
                              {isDisqualified && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                  DISQUALIFIED
                                </span>
                              )}
                              {isPending && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                  <AlertTriangle className="w-3 h-3" /> PENDING
                                </span>
                              )}
                            </td>

                            {/* Exclusion Reason */}
                            <td className="py-3 px-4 text-slate-600 max-w-xs">
                              {c.exclusionReasons.length > 0 ? (
                                <div className="space-y-1">
                                  {c.exclusionReasons.map((r, i) => (
                                    <span key={i} className="inline-block text-[11px] text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 mr-1 mb-1">
                                      {r}
                                    </span>
                                  ))}
                                </div>
                              ) : c.reviewReason ? (
                                <span className="inline-block text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                  {c.reviewReason}
                                </span>
                              ) : (
                                <span className="text-[11px] text-emerald-600 font-medium">None (Qualified)</span>
                              )}
                            </td>

                            {/* Action to view inspect modal */}
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => setInspectCandidate(c)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-[#1760FF] hover:bg-[#EEF5FF] transition cursor-pointer"
                                title="View candidate section marks breakdown"
                              >
                                <Info className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

            </div>

          </div>
        )}

        {/* TAB 2: PUBLISHED SHORTLIST VIEW */}
        {activeTab === 'published' && (
          <div className="space-y-6">
            
            {/* Staleness Banner */}
            {isStale && (
              <div className="p-5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-bold text-amber-900">
                      Published Shortlist Data is Stale
                    </h3>
                    <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                      {staleReason || 'Candidate test attempts or evaluations were modified after this shortlist was published. Recalculating and republishing is recommended.'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('configure')}
                  className="px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 transition shadow-xs cursor-pointer whitespace-nowrap self-end sm:self-center"
                >
                  Configure & Republish
                </button>
              </div>
            )}

            {isPublishedLoading ? (
              <div className="bg-white rounded-[22px] border border-[#DCE5F0] p-16 text-center">
                <RotateCw className="w-8 h-8 animate-spin text-[#1760FF] mx-auto mb-3" />
                <p className="text-sm font-bold text-[#10234E]">Loading published shortlist...</p>
              </div>
            ) : !publishedData ? (
              <div className="bg-white rounded-[22px] border border-[#DCE5F0] p-16 text-center">
                <Award className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-[#10234E]">No Published Shortlist for Round {selectedRound}</h3>
                <p className="text-xs text-[#607797] mt-1 max-w-md mx-auto">
                  A shortlist has not been published yet for this round and assessment template. Use the Configure & Preview tab to configure criteria and publish.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('configure')}
                  className="mt-5 px-5 py-2.5 rounded-xl bg-[#1760FF] text-white text-xs font-bold hover:bg-blue-700 transition cursor-pointer"
                >
                  Go to Configure & Preview
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-[22px] border border-[#DCE5F0] p-6 sm:p-7 shadow-[0_2px_12px_rgba(16,35,78,0.03)]">
                
                {/* Published Metadata Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase tracking-wider">
                        OFFICIAL PUBLICATION
                      </span>
                      <span className="text-xs text-[#607797]">Snapshot ID: {publishedData.id.slice(0, 8)}...</span>
                    </div>
                    <h2 className="text-xl font-bold text-[#10234E]">
                      Round {publishedData.round} Shortlist Snapshot
                    </h2>
                    <p className="text-xs text-[#607797] mt-0.5 flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" /> Published: {new Date(publishedData.publishedAt).toLocaleString()}
                      </span>
                      <span>•</span>
                      <span>{publishedData.shortlistedCount} Shortlisted Candidates</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleExportExcel}
                      disabled={isExporting}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#DCE5F0] text-xs font-bold text-[#10234E] hover:bg-slate-50 transition cursor-pointer"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      <span>Download Excel</span>
                    </button>
                  </div>
                </div>

                {/* Published Criteria Snapshot Summary */}
                <div className="my-6 p-4 rounded-xl bg-[#F8FAFD] border border-[#E2E8F0] grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-[#607797] block">Shortlist Size:</span>
                    <span className="font-bold text-[#10234E] text-sm">Top {publishedData.shortlistSize}</span>
                  </div>
                  <div>
                    <span className="text-[#607797] block">Weights:</span>
                    <span className="font-bold text-[#10234E] text-sm">
                      {publishedData.configSnapshot.overallWeight}% Overall / {publishedData.configSnapshot.sectionWeight}% Section
                    </span>
                  </div>
                  <div>
                    <span className="text-[#607797] block">Overall Cutoff:</span>
                    <span className="font-bold text-[#10234E] text-sm">
                      {publishedData.configSnapshot.overallCutoffEnabled ? `≥ ${publishedData.configSnapshot.overallCutoffPercentage}%` : 'Disabled'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#607797] block">Section Minimums:</span>
                    <span className="font-bold text-[#10234E] text-sm">
                      {Object.keys(publishedData.configSnapshot.sectionCutoffs || {}).length} configured
                    </span>
                  </div>
                </div>

                {/* Published Candidates Table */}
                <div className="overflow-x-auto rounded-xl border border-[#DCE5F0]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#F8FAFD] border-b border-[#DCE5F0] text-[#607797] uppercase tracking-wider font-bold">
                        <th className="py-3 px-4 w-16 text-center">Rank</th>
                        <th className="py-3 px-4">Candidate</th>
                        <th className="py-3 px-4">Identifier / USN</th>
                        <th className="py-3 px-4">Branch</th>
                        <th className="py-3 px-4 text-center">Ranking Score</th>
                        <th className="py-3 px-4 text-center">Overall %</th>
                        <th className="py-3 px-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EBF1F8] text-[#10234E]">
                      {publishedData.candidates.map((c) => (
                        <tr 
                          key={c.id}
                          className={c.status === 'shortlisted' ? 'bg-emerald-50/30' : ''}
                        >
                          <td className="py-3 px-4 text-center">
                            {c.rank ? (
                              <span className={`inline-flex items-center justify-center font-bold px-2 py-0.5 rounded-full text-xs ${
                                c.rank === 1 ? 'bg-amber-100 text-amber-800' :
                                c.rank === 2 ? 'bg-slate-200 text-slate-800' :
                                c.rank === 3 ? 'bg-amber-50 text-amber-900' :
                                'bg-slate-100 text-slate-700'
                              }`}>
                                #{c.rank}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="py-3 px-4 font-bold text-sm text-[#10234E]">
                            {c.fullName}
                          </td>
                          <td className="py-3 px-4 text-slate-600 font-semibold">
                            {c.usn || c.email}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {c.branch || '—'}
                          </td>
                          <td className="py-3 px-4 text-center font-extrabold text-[#1760FF]">
                            {c.rankingScore !== null ? c.rankingScore.toFixed(2) : '—'}
                          </td>
                          <td className="py-3 px-4 text-center font-semibold text-slate-700">
                            {c.overallPercentage !== null ? `${c.overallPercentage}%` : '—'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {c.status === 'shortlisted' ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                SHORTLISTED
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600">
                                {c.status.toUpperCase()}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>
            )}

          </div>
        )}

      </div>

      {/* REVIEW & CONFIRM PUBLISH MODAL */}
      {isPublishModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 text-left animate-in fade-in zoom-in-95 duration-150">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center">
                  <Send className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-[#10234E]">
                  Review & Publish Shortlist
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPublishModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-3.5 text-xs text-[#10234E]">
              <p className="text-slate-600">
                You are about to publish the official candidate shortlist snapshot for this round:
              </p>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Assessment:</span>
                  <span className="font-bold">
                    {selectedTemplateId === 'all' ? 'All Assessments' : (templates.find(t => t.id === selectedTemplateId)?.name || 'Selected')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Round:</span>
                  <span className="font-bold">Round {selectedRound}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Target Shortlist Size:</span>
                  <span className="font-bold text-[#1760FF]">Top {shortlistSize} Candidates</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Candidates to be Shortlisted:</span>
                  <span className="font-bold text-emerald-600">{previewSummary?.shortlistedCount ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Overall / Section Weights:</span>
                  <span className="font-bold">{overallWeight}% / {sectionWeight}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Overall Cutoff:</span>
                  <span className="font-bold">{overallCutoffEnabled ? `≥ ${overallCutoffPercentage}%` : 'Disabled'}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                <strong className="font-bold block mb-0.5">Notice:</strong>
                Publication saves an immutable snapshot of candidate rankings and reasons. Any previously published shortlist for Round {selectedRound} will be superseded.
              </div>

              <div className="pt-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={publishConfirmationChecked}
                    onChange={(e) => setPublishConfirmationChecked(e.target.checked)}
                    className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 cursor-pointer mt-0.5"
                  />
                  <span className="text-xs font-semibold text-slate-800">
                    I have reviewed the criteria and ranking preview, and I confirm publication of this candidate shortlist.
                  </span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsPublishModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePublishShortlist}
                disabled={!publishConfirmationChecked || isPublishing}
                className="px-5 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {isPublishing ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" /> Publishing...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" /> Confirm & Publish
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* INSPECT CANDIDATE MODAL */}
      {inspectCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 text-left animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-[#10234E]">{inspectCandidate.fullName}</h3>
                <p className="text-xs text-slate-500">{inspectCandidate.usn} • {inspectCandidate.branch}</p>
              </div>
              <button
                type="button"
                onClick={() => setInspectCandidate(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-[#F8FAFD] border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Rank</span>
                  <span className="text-base font-bold text-[#10234E]">{inspectCandidate.rank ? `#${inspectCandidate.rank}` : '—'}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-200">
                  <span className="text-[10px] text-blue-700 uppercase font-bold block">Score</span>
                  <span className="text-base font-bold text-blue-900">{inspectCandidate.rankingScore.toFixed(2)}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-200">
                  <span className="text-[10px] text-purple-700 uppercase font-bold block">Overall %</span>
                  <span className="text-base font-bold text-purple-900">{inspectCandidate.overallPercentage}%</span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-[#10234E] mb-2 uppercase tracking-wider text-[11px]">
                  Section Component Breakdown
                </h4>
                <div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                  {Object.entries(inspectCandidate.categoryScores).map(([cat, score]) => (
                    <div key={cat} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-b-0">
                      <div>
                        <span className="font-semibold text-slate-800">{score.categoryLabel}</span>
                        <span className="text-[10px] text-slate-500 block">
                          Earned {score.earnedMarks} / {score.maxMarks} marks
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-[#10234E]">{score.percentage}%</span>
                        {score.requiredCutoff !== null && (
                          <span className={`text-[10px] block font-semibold ${score.meetsCutoff ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {score.meetsCutoff ? '✓ Cutoff met' : `✗ Failed (≥${score.requiredCutoff}%)`}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {inspectCandidate.exclusionReasons.length > 0 && (
                <div>
                  <h4 className="font-bold text-rose-700 mb-1 text-[11px] uppercase tracking-wider">
                    Exclusion Reasons
                  </h4>
                  <ul className="list-disc list-inside text-rose-600 space-y-0.5 text-xs">
                    {inspectCandidate.exclusionReasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setInspectCandidate(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
