'use client';

import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BrandLogo } from '@/components/common/BrandLogo';
import { 
  ArrowLeft,
  Search, 
  FileSpreadsheet, 
  RotateCw, 
  ArrowUpDown, 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  Users,
  X
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'react-hot-toast';
import { getCategoryLabel, CATEGORIES, CATEGORY_ORDER } from '@/lib/categories';

interface Student {
  id: string;
  fullName: string;
  usn: string;
  branch: string;
  college: string;
  email: string;
  test_count: number;
  avg_score: number;
  eligibility_status?: string;
  eligibility_reason?: string;
}

interface TestAttempt {
  id: string;
  fullName: string;
  usn: string;
  branch: string;
  email: string;
  status: string;
  score: number | null;
  violations: number;
  createdAt: string;
  submittedAt: string | null;
  results_published: boolean;
}

export function StudentsViewer() {
  const router = useRouter();

  // Active Tab: 'students' | 'attempts'
  const [activeTab, setActiveTab] = useState<'students' | 'attempts'>('students');

  // Data State
  const [students, setStudents] = useState<Student[]>([]);
  const [attempts, setAttempts] = useState<TestAttempt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [branches, setBranches] = useState<any[]>([]);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('all');

  // Sorting State
  const [sortField, setSortField] = useState<string>('fullName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Pagination State (Fixed 10 per page)
  const PAGE_SIZE = 10;
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Selection State (for Registered Students)
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  // UI Modals
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedStudentHistory, setSelectedStudentHistory] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  
  // Round 2 Publish Modal State
  const [isRound2ModalOpen, setIsRound2ModalOpen] = useState(false);
  const [availableQuestions, setAvailableQuestions] = useState<any[]>([]);
  const [selectedRound2QuestionIds, setSelectedRound2QuestionIds] = useState<Set<string>>(new Set());
  const [round2Duration, setRound2Duration] = useState(60);
  const [isQuestionsLoading, setIsQuestionsLoading] = useState(false);
  const [questionSearchQuery, setQuestionSearchQuery] = useState('');
  const [selectedQuestionSection, setSelectedQuestionSection] = useState('all');
  const [isPublishing, setIsPublishing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchBranches();
    loadData();
  }, []);

  // Reset to page 1 whenever filters or tab change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedBranch, activeTab]);

  const fetchBranches = async () => {
    try {
      const response = await axios.get('/api/branches');
      setBranches(response.data.branches || []);
    } catch (error) {
      console.error('Failed to load branches', error);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      const [studentsRes, evaluationRes] = await Promise.all([
        axios.get('/api/admin/students?limit=1000', {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => ({ data: { students: [] } })),
        axios.get('/api/admin/evaluation', {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => ({ data: { tests: [] } }))
      ]);

      setStudents(studentsRes.data.students || []);
      setAttempts(evaluationRes.data.tests || []);
      toast.success('Directory updated', { id: 'feed-refreshed', duration: 1500 });
    } catch (error) {
      console.error('[Load Dashboard Data Error]', error);
      toast.error('Failed to load students directory');
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewCodingAnswers = (testId: string) => {
    router.push(`/admin/results/${testId}`);
  };

  const handleOpenHistory = async (student: Student) => {
    setSelectedStudent(student);
    setIsHistoryLoading(true);
    try {
      const token = localStorage.getItem('token');
      const evaluationRes = await axios.get('/api/admin/evaluation', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const allAttempts = evaluationRes.data.tests || [];
      const studentHistory = allAttempts.filter(
        (a: any) => a.usn === student.usn || a.email === student.email
      );
      setSelectedStudentHistory(studentHistory);
    } catch (e) {
      console.error('Failed to load student history', e);
      toast.error('Could not load student test history');
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      const token = localStorage.getItem('token');
      toast.loading('Preparing Excel...', { id: 'export-excel' });
      
      const response = await axios.get('/api/admin/export/excel', {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      toast.success('Downloaded Student Directory Excel', { id: 'export-excel' });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Student_Assessment_Results_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed', error);
      toast.error('Failed to export data to Excel.', { id: 'export-excel' });
    } finally {
      setIsExporting(false);
    }
  };

  // Helper to determine single student's status text & latest attempt
  const getStudentStatusInfo = (student: Student) => {
    const latestAttempt = attempts.find(a => a.usn === student.usn || a.email === student.email);
    let statusKey = 'NOT_STARTED';
    let statusLabel = 'NOT STARTED';
    let badgeClass = 'bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]';

    if (latestAttempt) {
      const s = (latestAttempt.status || '').toLowerCase();
      if (s === 'submitted' || s === 'evaluated') {
        statusKey = 'COMPLETED';
        statusLabel = 'COMPLETED';
        badgeClass = 'bg-[#D1FAE5] text-[#065F46] border-[#A7F3D0]';
      } else if (s === 'auto_submitted') {
        statusKey = 'AUTO_SUBMITTED';
        statusLabel = 'AUTO SUBMITTED';
        badgeClass = 'bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]';
      } else if (s === 'in_progress') {
        statusKey = 'IN_PROGRESS';
        statusLabel = 'IN PROGRESS';
        badgeClass = 'bg-[#DBEAFE] text-[#1E40AF] border-[#BFDBFE]';
      } else {
        statusKey = s.toUpperCase();
        statusLabel = s.toUpperCase().replace(/_/g, ' ');
        badgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
      }
    }

    return {
      latestAttempt,
      statusKey,
      statusLabel,
      badgeClass,
      score: latestAttempt && latestAttempt.score !== null ? latestAttempt.score : null
    };
  };

  // Helper to get formatted status for an attempt record
  const getAttemptStatusInfo = (attempt: TestAttempt) => {
    const s = (attempt.status || '').toLowerCase();
    if (s === 'submitted' || s === 'evaluated') {
      return {
        label: 'COMPLETED',
        badgeClass: 'bg-[#D1FAE5] text-[#065F46] border-[#A7F3D0]'
      };
    } else if (s === 'auto_submitted') {
      return {
        label: 'AUTO SUBMITTED',
        badgeClass: 'bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]'
      };
    } else if (s === 'in_progress') {
      return {
        label: 'IN PROGRESS',
        badgeClass: 'bg-[#DBEAFE] text-[#1E40AF] border-[#BFDBFE]'
      };
    } else {
      return {
        label: s.toUpperCase().replace(/_/g, ' '),
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200'
      };
    }
  };

  // Filtering Logic: Registered Students
  const filteredStudents = useMemo(() => {
    const searchLower = searchQuery.toLowerCase().trim();

    return students.filter(student => {
      const matchesSearch = !searchLower || 
        (student.fullName || '').toLowerCase().includes(searchLower) ||
        (student.usn || '').toLowerCase().includes(searchLower) ||
        (student.email || '').toLowerCase().includes(searchLower) ||
        (student.college || '').toLowerCase().includes(searchLower);

      const matchesBranch = selectedBranch === 'all' || student.branch === selectedBranch;

      return matchesSearch && matchesBranch;
    });
  }, [students, searchQuery, selectedBranch]);

  // Filtering Logic: Attempts & Submissions
  const filteredAttempts = useMemo(() => {
    const searchLower = searchQuery.toLowerCase().trim();

    return attempts.filter(attempt => {
      const matchesSearch = !searchLower ||
        (attempt.fullName || '').toLowerCase().includes(searchLower) || 
        (attempt.usn || '').toLowerCase().includes(searchLower) ||
        (attempt.email || '').toLowerCase().includes(searchLower);

      const matchesBranch = selectedBranch === 'all' || attempt.branch === selectedBranch;

      return matchesSearch && matchesBranch;
    });
  }, [attempts, searchQuery, selectedBranch]);

  // Sorting Logic: Registered Students
  const sortedStudents = useMemo(() => {
    const sorted = [...filteredStudents];
    sorted.sort((a, b) => {
      let aVal: any = '';
      let bVal: any = '';

      if (sortField === 'fullName') {
        aVal = a.fullName || '';
        bVal = b.fullName || '';
      } else if (sortField === 'usn') {
        aVal = a.usn || '';
        bVal = b.usn || '';
      } else if (sortField === 'branch') {
        aVal = a.branch || '';
        bVal = b.branch || '';
      } else if (sortField === 'email') {
        aVal = a.email || '';
        bVal = b.email || '';
      } else if (sortField === 'college') {
        aVal = a.college || '';
        bVal = b.college || '';
      } else if (sortField === 'status') {
        aVal = getStudentStatusInfo(a).statusKey;
        bVal = getStudentStatusInfo(b).statusKey;
      } else if (sortField === 'score') {
        aVal = getStudentStatusInfo(a).score ?? -1;
        bVal = getStudentStatusInfo(b).score ?? -1;
      }

      if (typeof aVal === 'string') {
        const cmp = aVal.localeCompare(bVal);
        return sortDirection === 'asc' ? cmp : -cmp;
      } else {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
    });
    return sorted;
  }, [filteredStudents, attempts, sortField, sortDirection]);

  // Sorting Logic: Attempts & Submissions
  const sortedAttempts = useMemo(() => {
    const sorted = [...filteredAttempts];
    sorted.sort((a, b) => {
      let aVal: any = '';
      let bVal: any = '';

      if (sortField === 'fullName') {
        aVal = a.fullName || '';
        bVal = b.fullName || '';
      } else if (sortField === 'branch') {
        aVal = a.branch || '';
        bVal = b.branch || '';
      } else if (sortField === 'score') {
        aVal = a.score ?? -1;
        bVal = b.score ?? -1;
      } else if (sortField === 'createdAt') {
        aVal = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        bVal = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      } else if (sortField === 'submittedAt') {
        aVal = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
        bVal = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      } else if (sortField === 'status') {
        aVal = a.status || '';
        bVal = b.status || '';
      }

      if (typeof aVal === 'string') {
        const cmp = aVal.localeCompare(bVal);
        return sortDirection === 'asc' ? cmp : -cmp;
      } else {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
    });
    return sorted;
  }, [filteredAttempts, sortField, sortDirection]);

  // Active dataset based on selected tab
  const totalFilteredCount = activeTab === 'students' ? sortedStudents.length : sortedAttempts.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredCount / PAGE_SIZE));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalFilteredCount);

  const paginatedStudents = useMemo(() => {
    return sortedStudents.slice(startIndex, endIndex);
  }, [sortedStudents, startIndex, endIndex]);

  const paginatedAttempts = useMemo(() => {
    return sortedAttempts.slice(startIndex, endIndex);
  }, [sortedAttempts, startIndex, endIndex]);

  // Current Page Select All logic for Registered Students
  const isCurrentPageAllSelected = 
    paginatedStudents.length > 0 && 
    paginatedStudents.every(s => selectedStudentIds.has(s.id));

  const toggleStudentSelection = (id: string, e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    const newSelection = new Set(selectedStudentIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedStudentIds(newSelection);
  };

  const togglePageSelection = () => {
    const newSelection = new Set(selectedStudentIds);
    if (isCurrentPageAllSelected) {
      paginatedStudents.forEach(s => newSelection.delete(s.id));
    } else {
      paginatedStudents.forEach(s => newSelection.add(s.id));
    }
    setSelectedStudentIds(newSelection);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getPageNumbers = (current: number, total: number): (number | '...')[] => {
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const pages: (number | '...')[] = [];
    if (current <= 4) {
      pages.push(1, 2, 3, 4, 5, '...', total);
    } else if (current >= total - 3) {
      pages.push(1, '...', total - 4, total - 3, total - 2, total - 1, total);
    } else {
      pages.push(1, '...', current - 1, current, current + 1, '...', total);
    }
    return pages;
  };

  // Round 2 Modal Handlers
  const openRound2Modal = async () => {
    if (selectedStudentIds.size === 0) return;
    setIsRound2ModalOpen(true);
    setIsQuestionsLoading(true);
    setSelectedRound2QuestionIds(new Set());
    setRound2Duration(60);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/questions?limit=1000', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAvailableQuestions(res.data.questions || []);
    } catch (e) {
      console.error('Failed to load questions', e);
      toast.error('Failed to load available questions.');
    } finally {
      setIsQuestionsLoading(false);
    }
  };

  const toggleRound2Question = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const newSelection = new Set(selectedRound2QuestionIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedRound2QuestionIds(newSelection);
  };

  const toggleAllRound2Questions = () => {
    if (selectedRound2QuestionIds.size === filteredQuestions.length && filteredQuestions.length > 0) {
      setSelectedRound2QuestionIds(new Set());
    } else {
      setSelectedRound2QuestionIds(new Set(filteredQuestions.map(q => q.id)));
    }
  };

  const submitRound2Publish = async () => {
    if (selectedRound2QuestionIds.size === 0) {
      toast.error('Please select at least 1 question.');
      return;
    }
    try {
      setIsPublishing(true);
      const token = localStorage.getItem('token');
      const payload = {
        studentIds: Array.from(selectedStudentIds),
        questionIds: Array.from(selectedRound2QuestionIds),
        totalDuration: round2Duration,
        durationMinutes: round2Duration,
        testTitle: 'Round 2 Technical Interview Assessment'
      };

      await axios.post('/api/admin/tests/publish-round-2', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success(`Successfully published Round 2 to ${selectedStudentIds.size} student(s)!`);
      setIsRound2ModalOpen(false);
      setSelectedStudentIds(new Set());
      loadData();
    } catch (err: any) {
      console.error('Publish error', err);
      toast.error(err.response?.data?.message || 'Failed to publish Round 2 assessment.');
    } finally {
      setIsPublishing(false);
    }
  };

  const filteredQuestions = availableQuestions.filter(q => 
    q.question_text?.toLowerCase().includes(questionSearchQuery.toLowerCase()) &&
    (selectedQuestionSection === 'all' || q.section === selectedQuestionSection)
  );

  return (
    <div className="min-h-screen bg-[#F3F7FD] relative overflow-x-hidden text-[#10234E] flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
      
      {/* Decorative SVG Curves Canvas */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
        <div 
          className="absolute inset-0" 
          style={{
            background: 'radial-gradient(circle at 50% 40%, #F7FAFE 0%, #EEF5FD 55%, #E6F1FC 100%)'
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
            <linearGradient id="sdTopRightGrad" x1="1440" y1="0" x2="880" y2="400" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#BCDDFC" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#D2E8FD" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#EAF3FD" stopOpacity="0" />
            </linearGradient>

            <linearGradient id="sdBottomLeftGrad" x1="0" y1="500" x2="600" y2="900" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#CCE4FD" stopOpacity="0.6" />
              <stop offset="60%" stopColor="#E2F0FE" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#F3F8FD" stopOpacity="0" />
            </linearGradient>

            <linearGradient id="sdBottomWaveGrad" x1="0" y1="700" x2="1440" y2="850" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#BDDCFC" stopOpacity="0.5" />
              <stop offset="50%" stopColor="#D0E6FD" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#E4F1FE" stopOpacity="0.2" />
            </linearGradient>
          </defs>

          <path d="M1440 0 L 980 0 C 980 160, 1120 320, 1440 370 Z" fill="url(#sdTopRightGrad)" />
          <path d="M0 900 L 0 540 C 220 540, 440 680, 560 900 Z" fill="url(#sdBottomLeftGrad)" />
          <path d="M0 760 C 350 780, 720 730, 1080 670 C 1240 645, 1370 675, 1440 705 L 1440 900 L 0 900 Z" fill="url(#sdBottomWaveGrad)" />
        </svg>
      </div>

      {/* Top Header Bar Matching Reference UI */}
      <header className="bg-white/95 backdrop-blur-xs border-b border-slate-200/80 sticky top-0 z-40 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between w-full">
          {/* Left: Brand Logo & DIRECTORY Pill Badge */}
          <div className="flex items-center gap-2.5">
            <Link href="/admin/dashboard" className="flex items-center gap-2 hover:opacity-90 transition">
              <BrandLogo size="md" className="items-start flex-row items-center" />
            </Link>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold uppercase tracking-wider hidden sm:inline-block border border-slate-200/60">
              DIRECTORY
            </span>
          </div>

          {/* Right: Dashboard Navigation Button */}
          <div>
            <Link href="/admin/dashboard">
              <Button 
                variant="outline" 
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3.5 py-1.5 rounded-lg transition flex items-center border-none shadow-2xs cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Full-Width Content Container (No Sidebar, expanded to full width) */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-4 w-full flex-1 relative z-10">
        
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200/80">
          <button
            onClick={() => setActiveTab('students')}
            className={`py-3 px-5 font-bold border-b-2 text-xs uppercase tracking-wider transition cursor-pointer ${
              activeTab === 'students' 
                ? 'border-[#1760FF] text-[#1760FF]' 
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            REGISTERED STUDENTS ({filteredStudents.length})
          </button>
          <button
            onClick={() => setActiveTab('attempts')}
            className={`py-3 px-5 font-bold border-b-2 text-xs uppercase tracking-wider transition cursor-pointer ${
              activeTab === 'attempts' 
                ? 'border-[#1760FF] text-[#1760FF]' 
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            ATTEMPTS & SUBMISSIONS ({filteredAttempts.length})
          </button>
        </div>

        {/* Search and Filter Toolbar */}
        <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center md:justify-between gap-2.5">
          {/* Left Controls: Search + Branch Filter */}
          <div className="flex flex-1 flex-wrap items-center gap-2.5">
            {/* Search by name, USN, or college */}
            <div className="relative w-full sm:w-80">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                placeholder="Search by student name or USN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8.5 h-8.5 bg-slate-50/70 border-slate-200 rounded-lg text-xs focus:bg-white focus:border-blue-500 transition"
              />
            </div>

            {/* Branch Filter */}
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="h-8.5 px-3 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50/70 text-slate-700 font-medium focus:bg-white focus:border-blue-500 transition outline-none cursor-pointer"
            >
              <option value="all">All Branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Right Controls: Actions */}
          <div className="flex flex-wrap items-center gap-2 pt-1 md:pt-0 border-t md:border-t-0 border-slate-100">
            {activeTab === 'students' && selectedStudentIds.size > 0 && (
              <Button 
                className="bg-[#1760FF] hover:bg-blue-700 text-white font-bold h-8.5 px-3 rounded-lg text-xs shadow-2xs transition cursor-pointer"
                onClick={openRound2Modal}
              >
                Configure Round 2 ({selectedStudentIds.size})
              </Button>
            )}

            <Button 
              variant="outline" 
              className="h-8.5 border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold px-3 rounded-lg text-xs transition cursor-pointer flex items-center gap-1.5 shadow-2xs" 
              onClick={handleExportExcel}
              disabled={isExporting}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#1760FF]" />
              <span>{isExporting ? 'Exporting...' : 'Export to Excel'}</span>
            </Button>

            <Button 
              variant="outline" 
              className="h-8.5 border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold px-3 rounded-lg text-xs transition cursor-pointer flex items-center gap-1.5 shadow-2xs" 
              onClick={loadData}
              disabled={isLoading}
            >
              <RotateCw className={`w-3.5 h-3.5 text-[#1760FF] ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Feed</span>
            </Button>
          </div>
        </div>

        {/* Tab 1: Registered Students Table */}
        {activeTab === 'students' && (
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/80 border-b border-slate-200/80">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10 text-center py-2 px-2">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer h-3.5 w-3.5"
                        checked={isCurrentPageAllSelected}
                        onChange={togglePageSelection}
                        aria-label="Select all students on current page"
                      />
                    </TableHead>
                    <TableHead 
                      className="font-bold text-[11px] uppercase tracking-wider text-slate-600 py-2 px-3 cursor-pointer select-none"
                      onClick={() => handleSort('fullName')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Student Name</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-bold text-[11px] uppercase tracking-wider text-slate-600 py-2 px-3 w-32 cursor-pointer select-none"
                      onClick={() => handleSort('usn')}
                    >
                      <div className="flex items-center gap-1">
                        <span>USN</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-bold text-[11px] uppercase tracking-wider text-slate-600 py-2 px-3 w-24 cursor-pointer select-none"
                      onClick={() => handleSort('branch')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Branch</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-bold text-[11px] uppercase tracking-wider text-slate-600 py-2 px-3 cursor-pointer select-none"
                      onClick={() => handleSort('email')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Email</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-bold text-[11px] uppercase tracking-wider text-slate-600 py-2 px-3 max-w-[180px] cursor-pointer select-none"
                      onClick={() => handleSort('college')}
                    >
                      <div className="flex items-center gap-1">
                        <span>College</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-bold text-[11px] uppercase tracking-wider text-slate-600 py-2 px-3 w-36 text-center cursor-pointer select-none"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Test Status</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-bold text-[11px] uppercase tracking-wider text-slate-600 py-2 px-3 w-28 text-center cursor-pointer select-none"
                      onClick={() => handleSort('score')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Score</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </TableHead>
                    <TableHead className="font-bold text-[11px] uppercase tracking-wider text-slate-600 py-2 px-3 w-28 text-center">
                      Answer
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12 text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Loader2 className="w-5 h-5 animate-spin text-[#1760FF]" />
                          <p className="text-xs font-medium">Loading student directory...</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : paginatedStudents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12 text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <Users className="w-7 h-7 text-slate-300 mb-1" />
                          <p className="text-sm font-semibold text-slate-700">No students found</p>
                          <p className="text-xs text-slate-400">
                            {searchQuery || selectedBranch !== 'all'
                              ? 'No records match your active search and filter criteria.'
                              : 'No students registered in the directory yet.'}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedStudents.map(student => {
                      const { latestAttempt, statusLabel, badgeClass, score } = getStudentStatusInfo(student);
                      const isSelected = selectedStudentIds.has(student.id);

                      return (
                        <TableRow 
                          key={student.id} 
                          onClick={() => handleOpenHistory(student)}
                          className={`transition border-b border-slate-100 last:border-b-0 cursor-pointer ${
                            isSelected ? 'bg-blue-50/40 hover:bg-blue-50/60' : 'hover:bg-slate-50/60'
                          }`}
                        >
                          {/* Checkbox selection */}
                          <TableCell className="text-center py-2.5 px-2" onClick={(e) => e.stopPropagation()}>
                            <input 
                              type="checkbox" 
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer h-3.5 w-3.5"
                              checked={isSelected}
                              onChange={(e) => toggleStudentSelection(student.id, e)}
                            />
                          </TableCell>

                          {/* Student Name */}
                          <TableCell className="py-2.5 px-3 font-bold text-[#10234E] text-xs">
                            {student.fullName}
                          </TableCell>

                          {/* USN */}
                          <TableCell className="w-32 py-2.5 px-3 font-mono text-slate-600 text-xs">
                            {student.usn}
                          </TableCell>

                          {/* Branch */}
                          <TableCell className="w-24 py-2.5 px-3 text-slate-700 font-semibold text-xs uppercase">
                            {student.branch}
                          </TableCell>

                          {/* Email */}
                          <TableCell className="py-2.5 px-3 text-slate-600 text-xs">
                            {student.email}
                          </TableCell>

                          {/* College */}
                          <TableCell className="py-2.5 px-3 text-slate-600 text-xs max-w-[180px] truncate" title={student.college}>
                            {student.college || '—'}
                          </TableCell>

                          {/* Test Status Badge */}
                          <TableCell className="w-36 py-2.5 px-3 text-center">
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badgeClass}`}>
                              {statusLabel}
                            </span>
                          </TableCell>

                          {/* Score */}
                          <TableCell className="w-28 py-2.5 px-3 text-center font-mono">
                            {score !== null ? (
                              <span className="text-[#1760FF] font-bold text-xs">{score} Pts</span>
                            ) : (
                              <span className="text-slate-400 font-semibold text-xs">--</span>
                            )}
                          </TableCell>

                          {/* View Answer CTA */}
                          <TableCell className="w-28 py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                            {latestAttempt ? (
                              <button
                                onClick={() => handleViewCodingAnswers(latestAttempt.id)}
                                className="h-7 px-3 text-[11px] font-bold rounded-lg border border-blue-200 bg-blue-50/60 hover:bg-blue-100 text-[#1760FF] transition cursor-pointer shadow-2xs"
                              >
                                View Answer
                              </button>
                            ) : (
                              <button
                                onClick={() => handleOpenHistory(student)}
                                className="h-7 px-3 text-[11px] font-medium rounded-lg text-slate-400 hover:text-slate-600 transition"
                              >
                                View Details
                              </button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls & Range Footer */}
            <div className="px-4 py-2.5 bg-slate-50/80 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-slate-600">
              <div className="flex items-center gap-2 font-medium text-xs">
                <span>
                  {totalFilteredCount === 0 ? (
                    `Showing 0 of ${students.length} students`
                  ) : (
                    `Showing ${startIndex + 1} – ${endIndex} of ${totalFilteredCount} students`
                  )}
                </span>
                {selectedStudentIds.size > 0 && (
                  <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 text-[11px]">
                    {selectedStudentIds.size} selected
                  </span>
                )}
              </div>

              {/* Navigation Buttons */}
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="h-7 px-2.5 text-xs border-slate-200 rounded-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white cursor-pointer"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-3.5 h-3.5 mr-0.5" /> Previous
                </Button>

                <div className="flex items-center gap-1">
                  {getPageNumbers(safeCurrentPage, totalPages).map((p, idx) => (
                    p === '...' ? (
                      <span key={`ellipsis-${idx}`} className="px-1 text-slate-400 select-none text-xs">…</span>
                    ) : (
                      <button
                        key={`page-${p}`}
                        onClick={() => setCurrentPage(Number(p))}
                        className={`h-7 min-w-[28px] px-2 rounded-md font-semibold text-xs transition cursor-pointer ${
                          safeCurrentPage === p 
                            ? 'bg-[#1760FF] text-white shadow-2xs font-bold' 
                            : 'text-slate-600 hover:bg-slate-200/70'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={safeCurrentPage >= totalPages || totalFilteredCount === 0}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="h-7 px-2.5 text-xs border-slate-200 rounded-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white cursor-pointer"
                  aria-label="Next page"
                >
                  Next <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Attempts & Submissions Table */}
        {activeTab === 'attempts' && (
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/80 border-b border-slate-200/80">
                  <TableRow className="hover:bg-transparent">
                    <TableHead 
                      className="font-bold text-[11px] uppercase tracking-wider text-slate-600 py-2 px-3 cursor-pointer select-none"
                      onClick={() => handleSort('fullName')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Candidate Name</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-bold text-[11px] uppercase tracking-wider text-slate-600 py-2 px-3 w-28 cursor-pointer select-none"
                      onClick={() => handleSort('branch')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Branch</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </TableHead>
                    <TableHead className="font-bold text-[11px] uppercase tracking-wider text-slate-600 py-2 px-3">
                      Assessment
                    </TableHead>
                    <TableHead 
                      className="font-bold text-[11px] uppercase tracking-wider text-slate-600 py-2 px-3 w-28 text-center cursor-pointer select-none"
                      onClick={() => handleSort('score')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Score</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-bold text-[11px] uppercase tracking-wider text-slate-600 py-2 px-3 w-36 cursor-pointer select-none"
                      onClick={() => handleSort('createdAt')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Start Time</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-bold text-[11px] uppercase tracking-wider text-slate-600 py-2 px-3 w-36 cursor-pointer select-none"
                      onClick={() => handleSort('submittedAt')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Submission Time</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </TableHead>
                    <TableHead className="font-bold text-[11px] uppercase tracking-wider text-slate-600 py-2 px-3 w-28 text-center">
                      Time Taken
                    </TableHead>
                    <TableHead 
                      className="font-bold text-[11px] uppercase tracking-wider text-slate-600 py-2 px-3 w-36 text-center cursor-pointer select-none"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Status</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </TableHead>
                    <TableHead className="font-bold text-[11px] uppercase tracking-wider text-slate-600 py-2 px-3 w-28 text-center">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12 text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Loader2 className="w-5 h-5 animate-spin text-[#1760FF]" />
                          <p className="text-xs font-medium">Loading attempts feed...</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : paginatedAttempts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12 text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <Users className="w-7 h-7 text-slate-300 mb-1" />
                          <p className="text-sm font-semibold text-slate-700">No test attempts recorded yet</p>
                          <p className="text-xs text-slate-400">
                            {searchQuery || selectedBranch !== 'all'
                              ? 'No attempts match your active search and filter criteria.'
                              : 'No test attempts have been started yet.'}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedAttempts.map(attempt => {
                      const testName = `Recruitment Assessment – ${attempt.branch || 'General'}`;
                      let timeTakenText = 'N/A';
                      if (attempt.submittedAt) {
                        const start = attempt.createdAt ? new Date(attempt.createdAt).getTime() : 0;
                        const end = new Date(attempt.submittedAt).getTime();
                        if (start > 0) {
                          const diffMins = Math.round((end - start) / 60000);
                          timeTakenText = `${diffMins} min(s)`;
                        }
                      }

                      const { label: statusLabel, badgeClass } = getAttemptStatusInfo(attempt);
                      const isFinished = attempt.status === 'submitted' || attempt.status === 'evaluated' || attempt.status === 'auto_submitted';

                      return (
                        <TableRow 
                          key={attempt.id} 
                          className="hover:bg-slate-50/60 transition border-b border-slate-100 last:border-b-0 text-xs"
                        >
                          <TableCell className="py-2.5 px-3 font-bold text-[#10234E]">
                            {attempt.fullName || 'Candidate'}
                          </TableCell>
                          <TableCell className="w-28 py-2.5 px-3 text-slate-700 font-semibold uppercase">
                            {attempt.branch}
                          </TableCell>
                          <TableCell className="py-2.5 px-3 text-slate-600">
                            {testName}
                          </TableCell>
                          <TableCell className="w-28 py-2.5 px-3 text-center font-mono font-bold text-[#1760FF]">
                            {attempt.score !== null ? `${attempt.score} Pts` : '--'}
                          </TableCell>
                          <TableCell className="w-36 py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                            {attempt.createdAt ? new Date(attempt.createdAt).toLocaleDateString() : 'N/A'}
                          </TableCell>
                          <TableCell className="w-36 py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                            {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleDateString() : 'N/A'}
                          </TableCell>
                          <TableCell className="w-28 py-2.5 px-3 text-center text-slate-600 font-mono">
                            {timeTakenText}
                          </TableCell>
                          <TableCell className="w-36 py-2.5 px-3 text-center">
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badgeClass}`}>
                              {statusLabel}
                            </span>
                          </TableCell>
                          <TableCell className="w-28 py-2.5 px-3 text-center">
                            {isFinished ? (
                              <button
                                onClick={() => handleViewCodingAnswers(attempt.id)}
                                className="h-7 px-3 text-[11px] font-bold rounded-lg border border-blue-200 bg-blue-50/60 hover:bg-blue-100 text-[#1760FF] transition cursor-pointer shadow-2xs"
                              >
                                View Answer
                              </button>
                            ) : (
                              <span className="text-slate-400 font-medium text-xs">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls & Range Footer for Attempts */}
            <div className="px-4 py-2.5 bg-slate-50/80 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-slate-600">
              <div className="flex items-center gap-2 font-medium text-xs">
                <span>
                  {totalFilteredCount === 0 ? (
                    `Showing 0 of ${attempts.length} attempts`
                  ) : (
                    `Showing ${startIndex + 1} – ${endIndex} of ${totalFilteredCount} attempts`
                  )}
                </span>
              </div>

              {/* Navigation Buttons */}
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="h-7 px-2.5 text-xs border-slate-200 rounded-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white cursor-pointer"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-3.5 h-3.5 mr-0.5" /> Previous
                </Button>

                <div className="flex items-center gap-1">
                  {getPageNumbers(safeCurrentPage, totalPages).map((p, idx) => (
                    p === '...' ? (
                      <span key={`ellipsis-${idx}`} className="px-1 text-slate-400 select-none text-xs">…</span>
                    ) : (
                      <button
                        key={`page-${p}`}
                        onClick={() => setCurrentPage(Number(p))}
                        className={`h-7 min-w-[28px] px-2 rounded-md font-semibold text-xs transition cursor-pointer ${
                          safeCurrentPage === p 
                            ? 'bg-[#1760FF] text-white shadow-2xs font-bold' 
                            : 'text-slate-600 hover:bg-slate-200/70'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={safeCurrentPage >= totalPages || totalFilteredCount === 0}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="h-7 px-2.5 text-xs border-slate-200 rounded-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white cursor-pointer"
                  aria-label="Next page"
                >
                  Next <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Student History Details Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-[#10234E]">{selectedStudent.fullName}</h2>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  USN: {selectedStudent.usn} | {selectedStudent.branch} | {selectedStudent.college}
                </p>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-slate-50/50 space-y-3.5">
              <h3 className="font-bold text-[#10234E] text-xs uppercase tracking-wider">
                Assigned Tests & Submission History
              </h3>

              <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
                <div className="w-full overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50/80 border-b border-slate-100">
                      <TableRow>
                        <TableHead className="font-bold text-[11px] text-slate-600">Test Name</TableHead>
                        <TableHead className="w-36 font-bold text-[11px] text-slate-600">Assigned Date</TableHead>
                        <TableHead className="w-36 font-bold text-[11px] text-slate-600">Submission Date</TableHead>
                        <TableHead className="w-24 text-center font-bold text-[11px] text-slate-600">Score</TableHead>
                        <TableHead className="w-32 text-center font-bold text-[11px] text-slate-600">Status</TableHead>
                        <TableHead className="w-28 text-center font-bold text-[11px] text-slate-600">Answer</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isHistoryLoading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                            <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#1760FF]" />
                          </TableCell>
                        </TableRow>
                      ) : selectedStudentHistory.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-slate-400 text-xs">
                            No test history recorded for this student.
                          </TableCell>
                        </TableRow>
                      ) : (
                        selectedStudentHistory.map(history => {
                          const testName = `Recruitment Assessment – ${history.branch || 'General'}`;
                          const isFinished = history.status === 'submitted' || history.status === 'evaluated' || history.status === 'auto_submitted';
                          
                          return (
                            <TableRow key={history.id} className="hover:bg-slate-50/50 border-b border-slate-100 last:border-b-0 text-xs">
                              <TableCell className="font-bold text-[#10234E]">{testName}</TableCell>
                              <TableCell className="w-36 text-slate-500 font-mono text-[11px]">
                                {new Date(history.createdAt).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="w-36 text-slate-500 font-mono text-[11px]">
                                {history.submittedAt ? new Date(history.submittedAt).toLocaleDateString() : 'N/A'}
                              </TableCell>
                              <TableCell className="w-24 text-center font-bold text-[#1760FF] font-mono">
                                {history.score !== null ? `${history.score} Pts` : '--'}
                              </TableCell>
                              <TableCell className="w-32 text-center">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                  isFinished ? 'bg-[#D1FAE5] text-[#065F46] border-[#A7F3D0]' : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}>
                                  {isFinished ? 'Completed' : history.status}
                                </span>
                              </TableCell>
                              <TableCell className="w-28 text-center">
                                {isFinished ? (
                                  <button
                                    type="button"
                                    onClick={() => handleViewCodingAnswers(history.id)}
                                    className="h-6 px-2 text-[10px] font-bold rounded border border-blue-200 bg-blue-50 text-[#1760FF] hover:bg-blue-100 transition cursor-pointer"
                                  >
                                    View Answer
                                  </button>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Round 2 Question Selection Modal */}
      {isRound2ModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-[#10234E]">Configure Round 2 Test</h2>
                <p className="text-xs text-slate-500">
                  Assigning test to <strong className="text-[#1760FF]">{selectedStudentIds.size} student(s)</strong>
                </p>
              </div>
              <button 
                onClick={() => setIsRound2ModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 flex flex-col sm:flex-row gap-3 bg-slate-50/80 border-b border-slate-100">
              <div className="flex-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Search Questions</label>
                <Input
                  placeholder="Search by question text..."
                  value={questionSearchQuery}
                  onChange={(e) => setQuestionSearchQuery(e.target.value)}
                  className="bg-white border-slate-200 h-8.5 text-xs rounded-lg"
                />
              </div>
              <div className="w-full sm:w-56">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Section</label>
                <select
                  value={selectedQuestionSection}
                  onChange={(e) => setSelectedQuestionSection(e.target.value)}
                  className="w-full h-8.5 px-3 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
                >
                  <option value="all">All Sections</option>
                  {CATEGORY_ORDER.map((catId) => (
                    <option key={catId} value={catId}>
                      {CATEGORIES[catId].label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-28">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Duration (mins)</label>
                <Input
                  type="number"
                  min="5"
                  value={round2Duration}
                  onChange={(e) => setRound2Duration(parseInt(e.target.value) || 60)}
                  className="bg-white border-slate-200 h-8.5 text-xs font-mono rounded-lg"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-0 bg-white">
              <div className="w-full overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/80 border-b border-slate-100 sticky top-0 z-10 shadow-2xs">
                    <TableRow>
                      <TableHead className="w-10 text-center py-2 px-2">
                        <input 
                          type="checkbox" 
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer h-3.5 w-3.5"
                          checked={filteredQuestions.length > 0 && selectedRound2QuestionIds.size === filteredQuestions.length}
                          onChange={toggleAllRound2Questions}
                        />
                      </TableHead>
                      <TableHead className="font-bold text-[11px] uppercase tracking-wider text-slate-600 py-2 px-3">Question Content</TableHead>
                      <TableHead className="font-bold text-[11px] uppercase tracking-wider text-slate-600 py-2 px-3 w-36">Section</TableHead>
                      <TableHead className="font-bold text-[11px] uppercase tracking-wider text-slate-600 py-2 px-3 w-20 text-center">Marks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isQuestionsLoading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-10 text-slate-400">
                          <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#1760FF]" />
                        </TableCell>
                      </TableRow>
                    ) : filteredQuestions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-10 text-slate-400 text-xs">
                          No questions match filter.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredQuestions.map(q => (
                        <TableRow key={q.id} className="hover:bg-slate-50/60 transition border-b border-slate-100 text-xs">
                          <TableCell className="text-center py-2 px-2">
                            <input 
                              type="checkbox" 
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer h-3.5 w-3.5"
                              checked={selectedRound2QuestionIds.has(q.id)}
                              onChange={(e) => toggleRound2Question(q.id, e)}
                            />
                          </TableCell>
                          <TableCell className="py-2 px-3 font-medium text-slate-800 max-w-lg">
                            <div className="truncate text-xs" title={q.question_text}>{q.question_text}</div>
                          </TableCell>
                          <TableCell className="w-36 py-2 px-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-[#1760FF] border border-blue-100">
                              {getCategoryLabel(q.section)}
                            </span>
                          </TableCell>
                          <TableCell className="w-20 text-center py-2 px-3 text-slate-700 font-bold text-xs">
                            {q.points || 10}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
            
            <div className="p-3.5 border-t border-slate-100 bg-slate-50/80 flex justify-between items-center">
              <div className="text-xs font-bold text-slate-600">
                Selected <span className="text-[#1760FF]">{selectedRound2QuestionIds.size}</span> questions
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsRound2ModalOpen(false)} 
                  className="h-8.5 px-3.5 text-xs rounded-xl"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={submitRound2Publish}
                  disabled={isPublishing || selectedRound2QuestionIds.size === 0}
                  className="bg-[#1760FF] hover:bg-blue-700 text-white font-bold h-8.5 rounded-xl px-5 text-xs shadow-2xs"
                >
                  {isPublishing ? 'Publishing...' : 'Publish Test Now'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
