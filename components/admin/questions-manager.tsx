'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ArrowLeft, 
  Library, 
  BookOpen, 
  Download, 
  FileSpreadsheet, 
  FileCode2, 
  FileText, 
  LayoutTemplate, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Upload, 
  Loader2,
  X,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import * as XLSX from 'xlsx';
import * as ExcelJS from 'exceljs';
import { toast } from 'react-hot-toast';
import { BrandLogo } from '@/components/common/BrandLogo';
import { 
  canonicalizeCategory, 
  getCategoryLabel, 
  SUPPORTED_IMPORT_SECTIONS, 
  SUPPORTED_DISPLAY_LABELS,
  CATEGORIES,
  CATEGORY_ORDER
} from '@/lib/categories';

export function QuestionsManager() {
  const { logout } = useAuth();
  const router = useRouter();

  // Data state
  const [questions, setQuestions] = useState<any[]>([]);
  const [totalQuestions, setTotalQuestions] = useState<number>(0);
  const [questionTypes, setQuestionTypes] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Selection State
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());

  // Filtering and Searching
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSection, setSelectedSection] = useState('all');

  // Pagination State (Fixed 10 questions per page)
  const PAGE_SIZE = 10;
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Reset to page 1 whenever search query or section filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedSection]);

  // Upload Modal State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [templateType, setTemplateType] = useState<'mcq' | 'coding' | 'open_text' | 'structured_response'>('mcq');
  const [importSummary, setImportSummary] = useState<{ imported: number, duplicates: number, invalidSection: number, missingFields: number, total: number, skippedDetails: {row: number, reason: string}[] } | null>(null);

  const SUPPORTED_SECTIONS = SUPPORTED_IMPORT_SECTIONS;

  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    try {
      const token = localStorage.getItem('token');

      const [statsRes, questionsRes] = await Promise.all([
        axios.get('/api/questions/stats', { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
        axios.get('/api/questions?limit=100', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (statsRes && statsRes.data) {
        setTotalQuestions(statsRes.data.total || 0);
        setQuestionTypes(statsRes.data.types || {});
      }

      const fetchedQuestions = questionsRes?.data?.questions || [];
      setQuestions(fetchedQuestions);
    } catch (error) {
      console.error('[Load Questions Error]', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/questions/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadQuestions();
      toast.success('Question deleted successfully');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to delete question');
    }
  };

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedQuestionIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedQuestionIds(newSelection);
  };

  const handleBulkDelete = async () => {
    if (selectedQuestionIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedQuestionIds.size} selected question(s)?`)) return;
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/questions/bulk-delete',
        { ids: Array.from(selectedQuestionIds) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSelectedQuestionIds(new Set());
      loadQuestions();
      toast.success('Selected questions deleted successfully');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to delete questions');
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('WARNING: Are you sure you want to delete ALL questions in the universal bank? This action cannot be undone!')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/questions/bulk-delete',
        { deleteAll: true },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSelectedQuestionIds(new Set());
      loadQuestions();
      toast.success('All questions deleted successfully');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to delete all questions');
    }
  };

  const triggerDownload = async (workbook: ExcelJS.Workbook, filename: string) => {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generateMCQTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('MCQ Questions');
    sheet.columns = [
      { header: 'Section', key: 'section', width: 25 },
      { header: 'Question', key: 'question', width: 40 },
      { header: 'Option A', key: 'optionA', width: 20 },
      { header: 'Option B', key: 'optionB', width: 20 },
      { header: 'Option C', key: 'optionC', width: 20 },
      { header: 'Option D', key: 'optionD', width: 20 },
      { header: 'Correct Answer', key: 'correct', width: 15 },
      { header: 'Marks', key: 'marks', width: 10 }
    ];
    sheet.addRow({ section: 'Quantitative & Logical Reasoning', question: 'What is 2+2?', optionA: '2', optionB: '3', optionC: '4', optionD: '5', correct: 'C', marks: '10' });
    await triggerDownload(workbook, 'mcq-template.xlsx');
  };

  const generateCodingTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Coding Questions');
    sheet.columns = [
      { header: 'Section', key: 'section', width: 25 },
      { header: 'Question', key: 'question', width: 40 },
      { header: 'Marks', key: 'marks', width: 10 }
    ];
    sheet.addRow({ section: 'Coding & Debugging', question: 'Write a program to reverse a string', marks: '15' });
    await triggerDownload(workbook, 'coding-template.xlsx');
  };

  const generateOpenTextTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Open Text Questions');
    sheet.columns = [
      { header: 'Section', key: 'section', width: 30 },
      { header: 'Question Type', key: 'questionType', width: 15 },
      { header: 'Question Code', key: 'questionCode', width: 15 },
      { header: 'Question Text', key: 'question', width: 50 },
      { header: 'Minimum Words', key: 'minWords', width: 15 },
      { header: 'Maximum Words', key: 'maxWords', width: 15 },
      { header: 'Marks', key: 'marks', width: 10 }
    ];
    // Sample non-Personality row - Question Code left blank
    sheet.addRow({ section: 'Written Communication & Collaboration', questionType: 'open_text', questionCode: '', question: 'Describe your leadership experience.', minWords: '100', maxWords: '300', marks: '5' });
    // Sample Personality row - Question Code required (P01-P33)
    sheet.addRow({ section: 'Personality', questionType: 'open_text', questionCode: 'P01', question: 'Tell us about a hobby or interest you enjoy outside of work.', minWords: '50', maxWords: '250', marks: '0' });
    await triggerDownload(workbook, 'open-text-template.xlsx');
  };

  const generateStructuredTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Structured Responses');
    sheet.columns = [
      { header: 'Section', key: 'section', width: 30 },
      { header: 'Question', key: 'question', width: 40 },
      { header: 'Field 1 Label', key: 'field1', width: 20 },
      { header: 'Field 2 Label', key: 'field2', width: 20 },
      { header: 'Field 3 Label', key: 'field3', width: 20 },
      { header: 'Marks', key: 'marks', width: 10 }
    ];
    sheet.addRow({ section: 'Delivery & Dependability', question: 'How would you complete this project in three days?', field1: 'Day 1', field2: 'Day 2', field3: 'Day 3', marks: '15' });
    await triggerDownload(workbook, 'structured-template.xlsx');
  };

  const handleUploadSubmit = async () => {
    if (!uploadFile) return;
    setIsUploading(true);
    setImportSummary(null);

    try {
      let parsedQuestions: any[] = [];
      let skippedDetails: {row: number, reason: string}[] = [];
      let invalidSectionCount = 0;
      let missingFieldsCount = 0;
      let duplicatesCount = 0;
      let totalProcessed = 0;
      
      const extension = uploadFile.name.split('.').pop()?.toLowerCase();
      const token = localStorage.getItem('token');

      if (extension === 'pdf') {
        const formData = new FormData();
        formData.append('file', uploadFile);

        const res = await axios.post('/api/questions/parse-pdf', formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        });
        parsedQuestions = res.data.questions;
        totalProcessed = parsedQuestions.length;
      } else if (extension === 'xlsx' || extension === 'csv') {
        const data = await uploadFile.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Header validation
        const jsonWithHeaders = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        if (jsonWithHeaders.length === 0) throw new Error('File is empty.');
        
        const headers = (jsonWithHeaders[0] || []).map(h => String(h).trim());
        
        const hasHeader = (...candidates: string[]) =>
          candidates.some(cand => headers.some(h => h.toLowerCase() === cand.toLowerCase()));

        let missing: string[] = [];
        if (templateType === 'mcq') {
          if (!hasHeader('Question', 'Question Text', 'QuestionText')) missing.push('Question Text');
          ['Option A', 'Option B', 'Option C', 'Option D', 'Correct Answer'].forEach(req => {
            if (!hasHeader(req)) missing.push(req);
          });
          if (!hasHeader('Marks', 'Points')) missing.push('Marks');
        } else if (templateType === 'coding' || templateType === 'open_text') {
          if (!hasHeader('Question', 'Question Text', 'QuestionText')) missing.push('Question Text');
          if (!hasHeader('Marks', 'Points')) missing.push('Marks');
        } else if (templateType === 'structured_response') {
          if (!hasHeader('Question', 'Question Text', 'QuestionText')) missing.push('Question Text');
          if (!hasHeader('Field 1 Label')) missing.push('Field 1 Label');
          if (!hasHeader('Marks', 'Points')) missing.push('Marks');
        }

        if (missing.length > 0) {
          throw new Error(`Invalid Template\nMissing Columns:\n${missing.join('\n')}`);
        }

        const json = XLSX.utils.sheet_to_json(worksheet) as any[];
        totalProcessed = json.length;
        const seenPersonalityCodes = new Set<string>();

        json.forEach((row, idx) => {
          const rowIndex = idx + 2;
          
          const sectionVal = row['Section'] || row['section'] || '';
          const formattedSection = String(sectionVal).trim();
          
          let sectionMap = 'APTITUDE';
          if (formattedSection) {
            const canonical = canonicalizeCategory(formattedSection);
            if (!canonical) {
              invalidSectionCount++;
              skippedDetails.push({ 
                row: rowIndex, 
                reason: `Invalid Section\nSection: ${formattedSection}\nExpected:\nQuantitative & Logical Reasoning\nCoding & Debugging\nEligibility & Logistics (Unscored)\n...` 
              });
              return;
            }
            sectionMap = canonical;
          }

          if (sectionMap === 'PERSONALITY' && templateType !== 'open_text') {
            missingFieldsCount++;
            skippedDetails.push({ 
              row: rowIndex, 
              reason: 'Personality category only supports open-text questions.' 
            });
            return;
          }

          const questionText = row['Question'] || row['Question Text'] || row['QuestionText'] || row['Question 1'] || '';
          const points = Number(row['Points'] || row['Marks']) || 10;

          if (!questionText || String(questionText).trim().length < 3) {
             missingFieldsCount++;
             skippedDetails.push({ row: rowIndex, reason: 'Missing or too short Question Text.' });
             return;
          }

          if (templateType === 'mcq') {
            const optA = row['Option A'] || row['Option 1'] || row['OptionA'] || '';
            const optB = row['Option B'] || row['Option 2'] || row['OptionB'] || '';
            const optC = row['Option C'] || row['Option 3'] || row['OptionC'] || '';
            const optD = row['Option D'] || row['Option 4'] || row['OptionD'] || '';

            if (!optA || !optB || !optC || !optD || !row['Correct Answer']) {
               missingFieldsCount++;
               skippedDetails.push({ row: rowIndex, reason: 'Missing Options or Correct Answer.' });
               return;
            }

            const optionsJson = [];
            if (optA) optionsJson.push({ text: String(optA) });
            if (optB) optionsJson.push({ text: String(optB) });
            if (optC) optionsJson.push({ text: String(optC) });
            if (optD) optionsJson.push({ text: String(optD) });

            const rawCorrect = String(row['Correct Answer'] || row['Correct'] || '').trim().toUpperCase();
            let correctAnswer = '0';
            if (rawCorrect === 'A' || rawCorrect === '1') correctAnswer = '0';
            else if (rawCorrect === 'B' || rawCorrect === '2') correctAnswer = '1';
            else if (rawCorrect === 'C' || rawCorrect === '3') correctAnswer = '2';
            else if (rawCorrect === 'D' || rawCorrect === '4') correctAnswer = '3';
            else correctAnswer = rawCorrect;

            parsedQuestions.push({
              _rowIndex: rowIndex,
              questionText: String(questionText).trim(),
              type: 'mcq',
              section: sectionMap,
              points,
              optionsJson,
              correctAnswer,
              explanation: row['Explanation'] ? String(row['Explanation']) : '',
              isPublished: true
            });
          } else if (templateType === 'coding') {
            parsedQuestions.push({
              _rowIndex: rowIndex,
              questionText: String(questionText).trim(),
              type: 'coding',
              section: sectionMap,
              points,
              optionsJson: [],
              isPublished: true
            });
          } else if (templateType === 'open_text') {
            // Read and validate Question Code for Personality rows
            const rawCode = String(row['Question Code'] || row['Code'] || '').trim();
            let personalityCode: string | undefined = undefined;
            if (sectionMap === 'PERSONALITY') {
              if (!rawCode) {
                missingFieldsCount++;
                skippedDetails.push({ row: rowIndex, reason: 'Personality question is missing a Question Code (P01–P33). Add the code in the "Question Code" column.' });
                return;
              }
              if (!/^P(0?[1-9]|[12][0-9]|3[0-3])$/i.test(rawCode)) {
                missingFieldsCount++;
                skippedDetails.push({ row: rowIndex, reason: `Invalid Question Code "${rawCode}". Must be P01–P33 (e.g. P07, P12, P33).` });
                return;
              }
              let norm = rawCode.toUpperCase();
              if (norm.length === 2) norm = `P0${norm.slice(1)}`;
              if (seenPersonalityCodes.has(norm)) {
                missingFieldsCount++;
                skippedDetails.push({ row: rowIndex, reason: `Duplicate Personality question code "${norm}" in this upload. Each P-code may only appear once.` });
                return;
              }
              seenPersonalityCodes.add(norm);
              personalityCode = norm;
            }
            const minWords = row['Minimum Words'] || row['Min Words'];
            const maxWords = row['Maximum Words'] || row['Max Words'];
            const optionsJsonOpenText: any = {};
            if (minWords !== undefined && minWords !== null && minWords !== '') optionsJsonOpenText.minWords = Number(minWords);
            if (maxWords !== undefined && maxWords !== null && maxWords !== '') optionsJsonOpenText.maxWords = Number(maxWords);
            if (personalityCode) optionsJsonOpenText.code = personalityCode;
            parsedQuestions.push({
              _rowIndex: rowIndex,
              questionText: String(questionText).trim(),
              type: 'open_text',
              section: sectionMap,
              points: sectionMap === 'PERSONALITY' ? 0 : points,
              optionsJson: optionsJsonOpenText,
              isPublished: true
            });
          } else if (templateType === 'structured_response') {
            const field1 = row['Field 1 Label'];
            const field2 = row['Field 2 Label'];
            const field3 = row['Field 3 Label'];

            if (!field1) {
               missingFieldsCount++;
               skippedDetails.push({ row: rowIndex, reason: 'Missing Field 1 Label.' });
               return;
            }

            const optionsJson = [];
            if (field1) optionsJson.push({ label: String(field1) });
            if (field2) optionsJson.push({ label: String(field2) });
            if (field3) optionsJson.push({ label: String(field3) });

            parsedQuestions.push({
              _rowIndex: rowIndex,
              questionText: String(questionText).trim(),
              type: 'structured_response',
              section: sectionMap,
              points,
              optionsJson,
              isPublished: true
            });
          }
        });
      } else {
        throw new Error('Unsupported file format. Please upload PDF, Excel, or CSV.');
      }

      let imported = 0;
      if (parsedQuestions.length === 0 && skippedDetails.length === 0) throw new Error('No valid questions found in file.');

      if (parsedQuestions.length > 0) {
        const res = await axios.post('/api/questions/bulk', parsedQuestions, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        imported = res.data.imported || 0;
        duplicatesCount = res.data.failed || 0;
        
        if (res.data.errors && res.data.errors.length > 0) {
           res.data.errors.forEach((err: any) => {
              skippedDetails.push({ row: err.row, reason: `Backend Error: ${err.field} - ${err.reason}` });
           });
        }
      }

      setImportSummary({ 
        imported, 
        duplicates: duplicatesCount, 
        invalidSection: invalidSectionCount, 
        missingFields: missingFieldsCount, 
        total: totalProcessed,
        skippedDetails 
      });
      loadQuestions();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || e.response?.data?.message || 'Failed to upload and parse file');
    } finally {
      setIsUploading(false);
    }
  };

  const closeUploadModal = () => {
    setIsUploadOpen(false);
    setUploadFile(null);
    setImportSummary(null);
  };

  // Local filtering logic
  const filteredQuestions = questions.filter(q => {
    const matchesSearch = q.question_text?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSection = selectedSection === 'all' || q.section === selectedSection;
    return matchesSearch && matchesSection;
  });

  // Pagination Calculations
  const totalFilteredCount = filteredQuestions.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredCount / PAGE_SIZE));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalFilteredCount);
  const paginatedQuestions = filteredQuestions.slice(startIndex, endIndex);

  // Selection on Current Page Only
  const isCurrentPageAllSelected = 
    paginatedQuestions.length > 0 && 
    paginatedQuestions.every(q => selectedQuestionIds.has(q.id));

  const togglePageSelection = () => {
    const newSelection = new Set(selectedQuestionIds);
    if (isCurrentPageAllSelected) {
      // Deselect only questions on current page
      paginatedQuestions.forEach(q => newSelection.delete(q.id));
    } else {
      // Select all questions on current page (preserves selections on other pages)
      paginatedQuestions.forEach(q => newSelection.add(q.id));
    }
    setSelectedQuestionIds(newSelection);
  };

  const getPageNumbers = (current: number, total: number): (number | '...')[] => {
    if (total <= 5) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const pages: (number | '...')[] = [];
    if (current <= 3) {
      pages.push(1, 2, 3, 4, '...', total);
    } else if (current >= total - 2) {
      pages.push(1, '...', total - 3, total - 2, total - 1, total);
    } else {
      pages.push(1, '...', current - 1, current, current + 1, '...', total);
    }
    return pages;
  };

  const formatTypeLabel = (type: string) => {
    switch ((type || '').toLowerCase()) {
      case 'mcq': return 'MCQ';
      case 'coding': return 'Coding';
      case 'coding_mcq': return 'Coding MCQ';
      case 'single_select': return 'Single Select';
      case 'multi_select': return 'Multi Select';
      case 'open_text': return 'Open Text';
      case 'ranking': return 'Ranking';
      case 'structured_response': return 'Structured';
      default: return (type || 'MCQ').replace(/_/g, ' ');
    }
  };

  const getTypeBadgeStyle = (type: string) => {
    switch ((type || '').toLowerCase()) {
      case 'mcq':
      case 'coding_mcq':
        return 'bg-blue-50 text-blue-700 border-blue-200/80';
      case 'coding':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200/80';
      case 'open_text':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
      case 'structured_response':
        return 'bg-amber-50 text-amber-700 border-amber-200/80';
      case 'ranking':
        return 'bg-purple-50 text-purple-700 border-purple-200/80';
      case 'single_select':
      case 'multi_select':
        return 'bg-sky-50 text-sky-700 border-sky-200/80';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F6FD] relative overflow-x-hidden text-[#10234E] font-sans selection:bg-blue-100 selection:text-blue-900 flex flex-col">
      {/* Decorative Background Curves & Soft Waves Matching Test Settings / Admin Dashboard */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
        {/* Soft Radial Glow Canvas */}
        <div 
          className="absolute inset-0" 
          style={{
            background: 'radial-gradient(circle at 50% 40%, #F8FBFE 0%, #EEF5FD 60%, #E6F1FC 100%)'
          }}
        />

        {/* Decorative Background SVG Waves */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 1440 900"
          fill="none"
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="qbTopRightGrad" x1="1440" y1="0" x2="900" y2="400" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#BCDDFC" stopOpacity="0.75" />
              <stop offset="50%" stopColor="#D4E9FE" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#F0F6FD" stopOpacity="0" />
            </linearGradient>

            <linearGradient id="qbBottomLeftGrad" x1="0" y1="900" x2="600" y2="500" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#A8D4FC" stopOpacity="0.65" />
              <stop offset="55%" stopColor="#CCE3FD" stopOpacity="0.38" />
              <stop offset="100%" stopColor="#F0F6FD" stopOpacity="0" />
            </linearGradient>

            <linearGradient id="qbBottomWaveGrad" x1="0" y1="850" x2="1440" y2="750" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#BDDCFC" stopOpacity="0.5" />
              <stop offset="50%" stopColor="#D0E6FD" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#E4F1FE" stopOpacity="0.2" />
            </linearGradient>
          </defs>

          {/* Top-Right Soft Swoop Arc */}
          <path
            d="M1440 0 L 980 0 C 980 160, 1120 320, 1440 370 Z"
            fill="url(#qbTopRightGrad)"
          />

          {/* Bottom-Left Sweeping Arc */}
          <path
            d="M0 900 L 0 540 C 220 540, 440 680, 560 900 Z"
            fill="url(#qbBottomLeftGrad)"
          />

          {/* Bottom Sweeping Wave */}
          <path
            d="M0 760 C 350 780, 720 730, 1080 670 C 1240 645, 1370 675, 1440 705 L 1440 900 L 0 900 Z"
            fill="url(#qbBottomWaveGrad)"
          />
        </svg>
      </div>

      {/* Top Navbar */}
      <nav className="bg-white/95 backdrop-blur-xs border-b border-slate-200/80 sticky top-0 z-40 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BrandLogo size="md" className="items-start flex-row items-center" />
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold uppercase tracking-wider hidden sm:inline-block border border-slate-200/60">
              Console
            </span>
          </div>
          <div>
            <Link href="/admin/dashboard">
              <Button 
                variant="outline" 
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-lg transition flex items-center border-none shadow-2xs cursor-pointer h-8"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-6 py-4 sm:py-5 space-y-3.5 flex-1">
        
        {/* Compact Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#10234E] tracking-tight">Question Bank</h1>
            <p className="text-xs text-slate-500 mt-0.5">Manage, create and organize your assessment questions.</p>
          </div>
          <div className="flex items-center gap-2.5">
            <Button 
              onClick={() => router.push('/admin/questions/create')}
              className="bg-[#1760FF] hover:bg-blue-700 text-white font-semibold h-8.5 px-3.5 rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Question</span>
            </Button>
          </div>
        </div>

        {/* Compact Summary Cards — Single Horizontal Row on Desktop */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Prominent Total Questions Card */}
          <div className="md:col-span-4 lg:col-span-3.5 bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-[#1760FF] flex items-center justify-center border border-blue-100/60 shrink-0">
              <Library className="w-4.5 h-4.5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 leading-none">Total Questions</p>
              <p className="text-2xl font-black text-[#10234E] leading-tight tracking-tight mt-0.5">{totalQuestions}</p>
              <p className="text-[10px] text-slate-400 leading-none">Repository items loaded</p>
            </div>
          </div>

          {/* Breakdown by Type Card */}
          <div className="md:col-span-8 lg:col-span-8.5 bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col justify-center">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Breakdown by Type</p>
              <span className="text-[10px] text-slate-400 font-medium">{Object.keys(questionTypes).length} type{Object.keys(questionTypes).length === 1 ? '' : 's'} recorded</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {Object.keys(questionTypes).length === 0 ? (
                <span className="text-xs font-medium text-slate-400 py-0.5">No question type counts recorded yet</span>
              ) : (
                Object.entries(questionTypes).map(([type, count]) => (
                  <div 
                    key={type} 
                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-semibold shadow-2xs transition ${getTypeBadgeStyle(type)}`}
                  >
                    <span className="uppercase text-[9px] tracking-wider">{formatTypeLabel(type)}</span>
                    <span className="bg-white/95 text-slate-900 px-1 py-0.2 rounded text-[10px] font-bold shadow-2xs">
                      {count}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Compact Search & Action Toolbar */}
        <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                placeholder="Search questions by text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8.5 h-8.5 bg-slate-50/70 border-slate-200 rounded-lg text-xs focus:bg-white focus:border-blue-500 transition"
              />
            </div>

            {/* Section Filter Dropdown */}
            <div className="relative">
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="w-full sm:w-auto h-8.5 px-3 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50/70 text-slate-700 font-medium focus:bg-white focus:border-blue-500 transition outline-none cursor-pointer"
              >
                <option value="all">All Sections</option>
                {CATEGORY_ORDER.map((catId) => (
                  <option key={catId} value={catId}>
                    {CATEGORIES[catId].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100">
            {selectedQuestionIds.size > 0 && (
              <Button
                variant="outline"
                className="h-8.5 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100/80 font-bold px-3 rounded-lg text-xs shadow-2xs transition flex items-center gap-1 cursor-pointer"
                onClick={handleBulkDelete}
              >
                <Trash2 className="w-3 h-3 text-rose-600" />
                <span>Delete Selected ({selectedQuestionIds.size})</span>
              </Button>
            )}
            <Button 
              variant="outline" 
              className="h-8.5 border-rose-200/90 text-rose-600 hover:bg-rose-50 hover:text-rose-700 font-bold px-3 rounded-lg text-xs transition cursor-pointer flex items-center gap-1" 
              onClick={handleDeleteAll}
            >
              <Trash2 className="w-3 h-3" />
              <span>Delete All</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-8.5 border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-3 rounded-lg text-xs transition cursor-pointer flex items-center gap-1 shadow-2xs" 
              onClick={() => setIsUploadOpen(true)}
            >
              <Upload className="w-3 h-3 text-slate-500" />
              <span>Import Questions</span>
            </Button>
          </div>
        </div>

        {/* Questions Table — Tightened Row Spacing & Pagination */}
        <Card className="border border-slate-200/80 shadow-2xs rounded-xl overflow-hidden bg-white">
          <CardContent className="p-0">
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
                        aria-label="Select all questions on current page"
                      />
                    </TableHead>
                    <TableHead className="font-bold text-[11px] uppercase tracking-wider text-slate-600 py-2 px-3">Question Content</TableHead>
                    <TableHead className="font-bold text-[11px] uppercase tracking-wider text-slate-600 py-2 px-3 w-36">Type</TableHead>
                    <TableHead className="font-bold text-[11px] uppercase tracking-wider text-slate-600 py-2 px-3 w-44">Section</TableHead>
                    <TableHead className="font-bold text-[11px] uppercase tracking-wider text-slate-600 py-2 px-3 w-20 text-center">Marks</TableHead>
                    <TableHead className="font-bold text-[11px] uppercase tracking-wider text-slate-600 py-2 px-3 w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                          <p className="text-xs font-medium">Loading questions repository...</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : paginatedQuestions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <BookOpen className="w-7 h-7 text-slate-300 mb-0.5" />
                          <p className="text-sm font-semibold text-slate-700">No questions found</p>
                          <p className="text-xs text-slate-400 max-w-sm">
                            {searchQuery || selectedSection !== 'all' 
                              ? 'No questions match the active search query or section filter.' 
                              : 'Your question repository is currently empty. Click "Create Question" or "Import Questions" to begin.'}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedQuestions.map(q => {
                      const isSelected = selectedQuestionIds.has(q.id);
                      return (
                        <TableRow 
                          key={q.id} 
                          className={`transition border-b border-slate-100 last:border-b-0 ${
                            isSelected ? 'bg-blue-50/40 hover:bg-blue-50/60' : 'hover:bg-slate-50/60'
                          }`}
                        >
                          <TableCell className="text-center py-2.5 px-2">
                            <input
                              type="checkbox"
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer h-3.5 w-3.5"
                              checked={isSelected}
                              onChange={() => toggleSelection(q.id)}
                              aria-label={`Select question ${q.id}`}
                            />
                          </TableCell>
                          <TableCell className="py-2.5 px-3 max-w-md sm:max-w-lg lg:max-w-xl">
                            <div className="text-xs font-medium text-slate-800 line-clamp-2 leading-relaxed" title={q.question_text}>
                              {q.question_text || <span className="text-slate-400 italic">No question text</span>}
                            </div>
                          </TableCell>
                          <TableCell className="w-36 py-2.5 px-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getTypeBadgeStyle(q.type)}`}>
                              {formatTypeLabel(q.type)}
                            </span>
                          </TableCell>
                          <TableCell className="w-44 py-2.5 px-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200/80">
                              {getCategoryLabel(q.section)}
                            </span>
                          </TableCell>
                          <TableCell className="w-20 text-center py-2.5 px-3 text-slate-800 font-bold text-xs">
                            {q.points !== undefined && q.points !== null ? q.points : 10}
                          </TableCell>
                          <TableCell className="w-24 text-right py-2.5 px-3">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2.5 border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50/60 hover:text-blue-700 font-semibold text-[11px] rounded-md transition cursor-pointer"
                              onClick={() => router.push(`/admin/questions/edit/${q.id}`)}
                            >
                              <Edit2 className="w-3 h-3 mr-1 text-slate-500" /> Edit
                            </Button>
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
              {/* Range & Loaded Count info */}
              <div className="flex items-center gap-2 font-medium text-xs">
                <span>
                  {totalFilteredCount === 0 ? (
                    `Showing 0 of ${questions.length} loaded questions`
                  ) : (
                    `Showing ${startIndex + 1}–${endIndex} of ${questions.length} loaded questions`
                  )}
                  {totalFilteredCount !== questions.length && totalFilteredCount > 0 && (
                    <span className="text-slate-400 ml-1">({totalFilteredCount} match filter)</span>
                  )}
                </span>
                {selectedQuestionIds.size > 0 && (
                  <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 text-[11px]">
                    {selectedQuestionIds.size} selected
                  </span>
                )}
              </div>

              {/* Page Navigation Controls */}
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="h-7 px-2 text-xs border-slate-200 rounded-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white cursor-pointer"
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
                            ? 'bg-[#1760FF] text-white shadow-2xs' 
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
                  className="h-7 px-2 text-xs border-slate-200 rounded-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white cursor-pointer"
                  aria-label="Next page"
                >
                  Next <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Upload/Import Dialog */}
      {isUploadOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xl p-6 w-full max-w-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Import Questions</h2>
                <p className="text-xs text-slate-500 mt-0.5">Select a template type and upload your populated Excel, CSV or PDF file.</p>
              </div>
              <button 
                onClick={closeUploadModal}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {!importSummary ? (
              <>
                <div className="mb-6">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 block">1. Download Templates</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div onClick={generateMCQTemplate} className="group p-3 rounded-xl border border-slate-200 bg-white hover:border-blue-400 hover:shadow-xs cursor-pointer transition flex items-center gap-3">
                      <div className="w-8 h-8 shrink-0 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <FileSpreadsheet className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-slate-900 text-sm">MCQ</h4>
                        <p className="text-[10px] text-slate-500 leading-tight mt-0.5">Quantitative & Logical Reasoning, MCQs</p>
                      </div>
                      <Download className="w-4 h-4 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    <div onClick={generateCodingTemplate} className="group p-3 rounded-xl border border-slate-200 bg-white hover:border-indigo-400 hover:shadow-xs cursor-pointer transition flex items-center gap-3">
                      <div className="w-8 h-8 shrink-0 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <FileCode2 className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-slate-900 text-sm">Coding</h4>
                        <p className="text-[10px] text-slate-500 leading-tight mt-0.5">Coding & Debugging challenges</p>
                      </div>
                      <Download className="w-4 h-4 text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    <div onClick={generateOpenTextTemplate} className="group p-3 rounded-xl border border-slate-200 bg-white hover:border-emerald-400 hover:shadow-xs cursor-pointer transition flex items-center gap-3">
                      <div className="w-8 h-8 shrink-0 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-slate-900 text-sm">Open Text</h4>
                        <p className="text-[10px] text-slate-500 leading-tight mt-0.5">Personality, Communication, Ethics & AI Literacy</p>
                      </div>
                      <Download className="w-4 h-4 text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    <div onClick={generateStructuredTemplate} className="group p-3 rounded-xl border border-slate-200 bg-white hover:border-amber-400 hover:shadow-xs cursor-pointer transition flex items-center gap-3">
                      <div className="w-8 h-8 shrink-0 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <LayoutTemplate className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-slate-900 text-sm">Structured</h4>
                        <p className="text-[10px] text-slate-500 leading-tight mt-0.5">Multi-field questions</p>
                      </div>
                      <Download className="w-4 h-4 text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 block">2. Select Template Type</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Button 
                      type="button"
                      variant={templateType === 'mcq' ? 'default' : 'outline'} 
                      onClick={() => setTemplateType('mcq')}
                      className={`justify-start h-auto py-2.5 px-3.5 rounded-xl ${templateType === 'mcq' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'text-slate-700 border-slate-200'}`}
                    >
                      <span className="font-bold text-xs">MCQ</span>
                    </Button>
                    <Button 
                      type="button"
                      variant={templateType === 'coding' ? 'default' : 'outline'} 
                      onClick={() => setTemplateType('coding')}
                      className={`justify-start h-auto py-2.5 px-3.5 rounded-xl ${templateType === 'coding' ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'text-slate-700 border-slate-200'}`}
                    >
                      <span className="font-bold text-xs">Coding</span>
                    </Button>
                    <Button 
                      type="button"
                      variant={templateType === 'open_text' ? 'default' : 'outline'} 
                      onClick={() => setTemplateType('open_text')}
                      className={`justify-start h-auto py-2.5 px-3.5 rounded-xl ${templateType === 'open_text' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'text-slate-700 border-slate-200'}`}
                    >
                      <span className="font-bold text-xs">Open Text</span>
                    </Button>
                    <Button 
                      type="button"
                      variant={templateType === 'structured_response' ? 'default' : 'outline'} 
                      onClick={() => setTemplateType('structured_response')}
                      className={`justify-start h-auto py-2.5 px-3.5 rounded-xl ${templateType === 'structured_response' ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'text-slate-700 border-slate-200'}`}
                    >
                      <span className="font-bold text-xs">Structured Response</span>
                    </Button>
                  </div>
                </div>

                <div className="mb-2">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 block">3. Choose File</h3>
                </div>

                <input 
                  type="file" 
                  accept=".pdf,.xlsx,.xls,.csv"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-slate-600 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/70 hover:bg-slate-100/70 p-4 cursor-pointer focus:outline-none mb-6 transition"
                />

                <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                  <Button variant="outline" className="border-slate-200 rounded-xl" onClick={closeUploadModal}>Cancel</Button>
                  <Button onClick={handleUploadSubmit} disabled={!uploadFile || isUploading} className="bg-[#1760FF] text-white hover:bg-blue-700 rounded-xl">
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importing...
                      </>
                    ) : 'Upload & Parse'}
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 shadow-2xs">
                  <h3 className="text-slate-900 font-bold mb-3 text-base flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Import Complete
                  </h3>
                  <div className="space-y-2 text-sm">
                    <p className="text-emerald-700 font-semibold flex items-center gap-2">
                      <span className="w-4 font-bold">✓</span> Imported: {importSummary.imported}
                    </p>
                    {importSummary.duplicates > 0 && (
                      <p className="text-amber-700 font-medium flex items-center gap-2">
                        <span className="w-4 font-bold">⚠</span> Skipped (Duplicates/Rejected): {importSummary.duplicates}
                      </p>
                    )}
                    {importSummary.invalidSection > 0 && (
                      <p className="text-amber-700 font-medium flex items-center gap-2">
                        <span className="w-4 font-bold">⚠</span> Invalid Section: {importSummary.invalidSection}
                      </p>
                    )}
                    {importSummary.missingFields > 0 && (
                      <p className="text-rose-700 font-medium flex items-center gap-2">
                        <span className="w-4 font-bold">⚠</span> Missing Required Fields: {importSummary.missingFields}
                      </p>
                    )}
                    <div className="pt-2 mt-2 border-t border-slate-200 text-sm text-slate-800 font-bold">
                      Total Processed: {importSummary.total}
                    </div>
                  </div>
                </div>

                {importSummary.skippedDetails.length > 0 && (
                  <div className="border border-slate-200 rounded-xl p-4 max-h-48 overflow-y-auto bg-white">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Skipped Details</h4>
                    <table className="w-full text-xs text-left text-slate-600">
                      <tbody>
                        {importSummary.skippedDetails.map((skip, idx) => (
                          <tr key={idx} className="border-b border-slate-100 last:border-0">
                            <td className="py-2 pr-2 font-mono text-slate-900 font-medium w-16 align-top">Row {skip.row}</td>
                            <td className="py-2 whitespace-pre-line text-slate-600 align-top">{skip.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="flex justify-end pt-2 border-t border-slate-100">
                  <Button onClick={closeUploadModal} className="bg-[#1760FF] text-white hover:bg-blue-700 rounded-xl">
                    Close
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


