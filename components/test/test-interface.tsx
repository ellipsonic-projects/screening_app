'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import Editor from '@monaco-editor/react';
import { toast } from 'react-hot-toast';
import { seededShuffle } from '@/lib/shuffle';
import { DecorativeBackground } from '@/components/common/DecorativeBackground';
import { StudentHeader } from '@/components/student/student-header';
import { 
  XCircle, AlertTriangle, Flag, CheckCircle, Clock, Bookmark, 
  Puzzle, Shield, Sparkles, Users, Briefcase, Code, BookOpen, 
  UserCheck, LayoutGrid, Check, ArrowLeft, ArrowRight,
  Award, Star, Code2, Terminal, ShieldCheck, Camera, Mic, Monitor, FileText, Send, CheckCircle2, AlertCircle, Circle, CircleDashed, Loader2,
  ChevronDown, ChevronUp, Menu, X, Info
} from 'lucide-react';
import { getCategoryLabel, canonicalizeCategory } from '@/lib/categories';

interface Question {
  id: string;
  questionText: string;
  type: 'mcq' | 'coding';
  optionsJson?: any;
  points: number;
  timeLimitSeconds: number;
  section?: string;
}

interface TestData {
  id: string;
  totalDuration: number;
  questions: Question[];
  status: string;
  isCompleted?: boolean;
}

const calculateWordCount = (type: string, answerStr: string): number => {
  if (!answerStr) return 0;
  if (['open_text', 'prompt_writing', 'code_review'].includes(type)) {
     return answerStr.trim() ? answerStr.trim().split(/\s+/).length : 0;
  }
  if (type === 'structured_response') {
     try {
       const parsed = JSON.parse(answerStr);
       return Object.values(parsed).reduce((acc: number, val: any) => {
         const strVal = String(val);
         return acc + (strVal.trim() ? strVal.trim().split(/\s+/).length : 0);
       }, 0);
     } catch {
       return 0;
     }
  }
  return 0;
};

export function TestInterface({ testId }: { testId: string }) {
  const router = useRouter();
  const [test, setTest] = useState<TestData | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [violations, setViolations] = useState<string[]>([]);
  const [showWarning, setShowWarning] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [saveStatus, setSaveStatus] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [acceptedDisclaimer, setAcceptedDisclaimer] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // Security and execution state
  const submittingRef = useRef(false);
  const [selectedLanguages, setSelectedLanguages] = useState<Record<string, string>>({});
  const [isRunningCode, setIsRunningCode] = useState(false);
  const [runResults, setRunResults] = useState<Record<string, any>>({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showAutoSubmitModal, setShowAutoSubmitModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleClipboardEvent = (e: React.ClipboardEvent | React.DragEvent) => {
    e.preventDefault();
    setToastMessage("Copying and pasting is not allowed in text answers.");
    setTimeout(() => setToastMessage(null), 3000);
  };

  const renderWordLimitIndicator = (type: string, question: any) => {
    const minWords = question.optionsJson?.minWords;
    const maxWords = question.optionsJson?.maxWords;
    if (!minWords && !maxWords) return null;

    const currentWordCount = calculateWordCount(type, answers[question.id] || '');
    
    let counterColor = "text-slate-500";
    let counterText = `${currentWordCount} words`;
    
    if (minWords && currentWordCount < minWords) {
      counterText = `${currentWordCount} / ${minWords} min`;
      counterColor = "text-slate-500";
    } else if (minWords && currentWordCount >= minWords && (!maxWords || currentWordCount <= maxWords)) {
      counterText = `${currentWordCount} words ✓`;
      counterColor = "text-slate-500";
    }

    if (maxWords) {
      if (currentWordCount > maxWords) {
        counterText = `${currentWordCount} / ${maxWords} max (Exceeded)`;
        counterColor = "text-rose-600 font-medium";
      } else if (!minWords || currentWordCount >= minWords) {
        counterText = `${currentWordCount} / ${maxWords} max`;
      }
    }

    return (
      <div className="flex justify-between items-center text-xs mt-1.5">
        <div className={`font-medium ${counterColor}`}>
          {minWords && currentWordCount < minWords ? `Minimum ${minWords} words required` : ''}
        </div>
        <div className="flex items-center gap-3">
          <span className={`transition-colors font-medium ${counterColor}`}>{counterText}</span>
          <span className="text-slate-400 font-medium">
            {answers[question.id] ? answers[question.id].length : 0} chars
          </span>
        </div>
      </div>
    );
  };

  useEffect(() => {
    loadTest();
  }, [testId]);

  useEffect(() => {
    if (test && timeRemaining > 0 && !showInstructions) {
      const timer = setTimeout(() => setTimeRemaining(timeRemaining - 1), 1000);
      return () => clearTimeout(timer);
    } else if (test && timeRemaining === 0 && !showInstructions && (test.status === 'in_progress' || test.status === 'not_started')) {
      submitTest(true);
    }
  }, [timeRemaining, test, showInstructions]);

  // Save state to local storage when time or index changes
  useEffect(() => {
    if (test && test.status === 'in_progress') {
      localStorage.setItem(`testState_${testId}`, JSON.stringify({
        timeRemaining,
        currentQuestionIndex,
        flags
      }));
    }
  }, [timeRemaining, currentQuestionIndex, flags, test, testId]);

  // Ping heartbeat every 30 seconds to update updated_at on backend
  useEffect(() => {
    if (test && test.status === 'in_progress' && !showInstructions) {
      const interval = setInterval(() => {
        const token = localStorage.getItem('token');
        if (token) {
          axios.post(`/api/tests/${testId}/ping`, {}, {
            headers: { Authorization: `Bearer ${token}` }
          }).catch(err => console.error('[Heartbeat Error]', err));
        }
      }, 30000); // 30 seconds
      return () => clearInterval(interval);
    }
  }, [test?.status, showInstructions, testId]);

  // Monitor for cheating attempts
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        recordViolation('Tab switched away');
        setShowWarning(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
 
  // Auto-expand active section on navigation
  useEffect(() => {
    if (test && test.questions && test.questions[currentQuestionIndex]) {
      const activeSection = test.questions[currentQuestionIndex].section || 'General';
      setCollapsedSections((prev) => {
        if (prev[activeSection]) {
          const next = { ...prev };
          delete next[activeSection];
          return next;
        }
        return prev;
      });
    }
  }, [currentQuestionIndex, test]);

  const loadTest = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/tests/${testId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const t = response.data.test;
      setTest(t);
      
      const totalDurationMinutes = Number(t.total_duration || (t as any).totalDuration || 60);
      const totalDurationSeconds = totalDurationMinutes * 60;
      let calculatedTimeRemaining = totalDurationSeconds;

      if (t.start_time && t.status === 'in_progress') {
        const elapsedSeconds = Math.floor((Date.now() - new Date(t.start_time).getTime()) / 1000);
        calculatedTimeRemaining = Math.max(0, totalDurationSeconds - elapsedSeconds);
      }

      const savedStateStr = localStorage.getItem(`testState_${testId}`);
      if (t.status === 'in_progress') {
        if (savedStateStr) {
          try {
            const savedState = JSON.parse(savedStateStr);
            if (typeof savedState.timeRemaining === 'number' && savedState.timeRemaining > 0) {
              const remaining = t.start_time
                ? Math.min(savedState.timeRemaining, calculatedTimeRemaining)
                : savedState.timeRemaining;
              setTimeRemaining(remaining);
            } else {
              setTimeRemaining(calculatedTimeRemaining);
            }
            if (savedState.currentQuestionIndex !== undefined) {
              setCurrentQuestionIndex(savedState.currentQuestionIndex);
            }
            if (savedState.flags !== undefined) {
              setFlags(savedState.flags);
            }
          } catch (e) {
            setTimeRemaining(calculatedTimeRemaining);
          }
        } else {
          setTimeRemaining(calculatedTimeRemaining);
        }
      } else {
        setTimeRemaining(totalDurationSeconds);
      }

      if (t.responses) {
        const initialAnswers: Record<string, string> = {};
        t.responses.forEach((r: any) => {
          if (r.student_answer) {
            initialAnswers[r.question_id] = r.student_answer;
          }
        });
        setAnswers(initialAnswers);
      }

      if (t.status === 'submitted' || t.status === 'auto_submitted' || t.isCompleted || (t as any).is_completed) {
        setIsLoading(false);
        if (t.status === 'auto_submitted') {
          setShowInstructions(false);
          setShowAutoSubmitModal(true);
        } else {
          router.push('/student/success');
        }
        return;
      }

      if (t.status !== 'not_started') {
        setShowInstructions(false);
      }
    } catch (error: any) {
      console.error('[Test Load Error]', error);
      setErrorMsg(error.response?.data?.message || 'Failed to load assessment.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartTest = async () => {
    try {
      setIsInitializing(true);
      // Request camera & microphone
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach((track) => track.stop());

      // Update status to in_progress in database
      const token = localStorage.getItem('token');
      await axios.patch(`/api/tests/${testId}`, {
        status: 'in_progress'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setTest(prev => prev ? { ...prev, status: 'in_progress' } : null);
      setShowInstructions(false);
    } catch (err: any) {
      if (err.response?.status === 409) {
        toast.error('Assessment has already been completed.');
        router.push('/student/success');
        return;
      }
      toast.error('Camera and Microphone permissions are required to start this assessment. Please allow them in your browser settings.');
    } finally {
      setIsInitializing(false);
    }
  };

  const recordViolation = (type: string) => {
    setViolations((prev) => [...prev, type]);
  };

  const handleToggleFlag = (questionId: string) => {
    setFlags((prev) => ({ ...prev, [questionId]: !prev[questionId] }));
  };

  const handleAnswerChange = useCallback((questionId: string, answer: string) => {
    if (!test || test.status === 'submitted' || test.status === 'auto_submitted' || (test as any).isCompleted || (test as any).is_completed || submittingRef.current) {
      return;
    }

    setAnswers((prev) => ({
      ...prev,
      [questionId]: answer,
    }));

    setSaveStatus((prev) => ({ ...prev, [questionId]: 'Saving...' }));

    // Auto-save answer
    const token = localStorage.getItem('token');
    axios.post(
      `/api/tests/${testId}/auto-save`,
      { questionId, answer },
      { headers: { Authorization: `Bearer ${token}` } }
    ).then(() => {
      setSaveStatus((prev) => ({ ...prev, [questionId]: '✓ Saved just now' }));
    }).catch((error) => {
      if (error.response?.status === 409) {
        setTest((prev) => prev ? { ...prev, status: 'submitted', isCompleted: true } : null);
        setSaveStatus((prev) => ({ ...prev, [questionId]: 'Assessment submitted' }));
        toast.error('This assessment has already been submitted and cannot be modified.');
        router.push('/student/success');
        return;
      }
      console.error('[Auto-save Error]', error.response?.data?.message || error.message);
      setSaveStatus((prev) => ({ ...prev, [questionId]: 'failed' }));
    });
  }, [testId, test, router]);

  const handleClearAnswer = useCallback((questionId: string) => {
    if (!test || test.status === 'submitted' || test.status === 'auto_submitted' || (test as any).isCompleted || (test as any).is_completed || submittingRef.current) {
      return;
    }

    setAnswers((prev) => {
      const newAnswers = { ...prev };
      delete newAnswers[questionId];
      return newAnswers;
    });

    setSaveStatus((prev) => ({ ...prev, [questionId]: 'Saving...' }));

    const token = localStorage.getItem('token');
    axios.post(
      `/api/tests/${testId}/auto-save`,
      { questionId, answer: '' },
      { headers: { Authorization: `Bearer ${token}` } }
    ).then(() => {
      setSaveStatus((prev) => ({ ...prev, [questionId]: '✓ Saved just now' }));
    }).catch((error) => {
      if (error.response?.status === 409) {
        setTest((prev) => prev ? { ...prev, status: 'submitted', isCompleted: true } : null);
        setSaveStatus((prev) => ({ ...prev, [questionId]: 'Assessment submitted' }));
        toast.error('This assessment has already been submitted and cannot be modified.');
        router.push('/student/success');
        return;
      }
      console.error('[Auto-save Error]', error.response?.data?.message || error.message);
      setSaveStatus((prev) => ({ ...prev, [questionId]: 'failed' }));
    });
  }, [testId, test, router]);

  const handleRunCode = async () => {
    const currentQuestion = test?.questions[currentQuestionIndex];
    if (!currentQuestion) return;
    setIsRunningCode(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `/api/tests/${testId}/run-code`,
        {
          questionId: currentQuestion.id,
          code: answers[currentQuestion.id] || '',
          language: selectedLanguages[currentQuestion.id] || 'javascript',
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRunResults(prev => ({
        ...prev,
        [currentQuestion.id]: response.data
      }));
    } catch (error: any) {
      console.error('[Run Code Error]', error);
      setRunResults(prev => ({
        ...prev,
        [currentQuestion.id]: { error: error.response?.data?.message || 'Execution failed' }
      }));
    } finally {
      setIsRunningCode(false);
    }
  };



  const submitTest = async (isTimeout = false) => {
    if (!test || submittingRef.current) return;
    if (test.status === 'submitted' || test.status === 'auto_submitted' || (test as any).isCompleted || (test as any).is_completed) {
      if (isTimeout) {
        setShowAutoSubmitModal(true);
      } else {
        router.push('/student/success');
      }
      return;
    }
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const responsesPayload = Object.entries(answers)
        .filter(([qId]) => test.questions?.some(q => q.id === qId))
        .map(([qId, ans]) => {
          const qObj = test.questions.find((q: any) => q.id === qId);
          return {
            questionId: qId,
            section: qObj?.section || 'Uncategorized',
            questionType: qObj?.type || 'open_text',
            answer: typeof ans === 'string' ? ans : JSON.stringify(ans || '')
          };
        });

      await axios.post(
        `/api/tests/${testId}/submit`,
        {
          assessmentId: test.id || testId,
          studentId: (test as any).student?.id || (test as any).student_id || '',
          responses: responsesPayload,
          violations,
          submittedAt: new Date().toISOString(),
          status: isTimeout ? 'auto_submitted' : 'submitted'
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setTest((prev) => prev ? { ...prev, status: isTimeout ? 'auto_submitted' : 'submitted', isCompleted: true } : null);

      if (isTimeout) {
        setShowAutoSubmitModal(true);
      } else {
        setShowConfirmModal(false);
        router.push('/student/success');
      }
    } catch (error: any) {
      if (
        error.response?.status === 409 ||
        (error.response?.status === 400 && error.response?.data?.message?.includes('already submitted'))
      ) {
        setTest((prev) => prev ? { ...prev, status: 'submitted', isCompleted: true } : null);
        toast.success('Assessment successfully submitted.');
        if (isTimeout) {
          setShowAutoSubmitModal(true);
        } else {
          setShowConfirmModal(false);
          router.push('/student/success');
        }
        return;
      }
      const errorMsg = error.response?.data?.message || 'Failed to submit test. Please try again.';
      console.error('[Submit Test Error]', errorMsg);
      toast.error(errorMsg);
      submittingRef.current = false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const validateCurrentQuestion = () => {
    setValidationError(null);
    if (!test) return true;
    const currentQuestion = test.questions[currentQuestionIndex];
    if (!currentQuestion) return true;
    
    const type = currentQuestion.type as string;

    if (type === 'structured_response') {
      let fields = currentQuestion.optionsJson?.fields || currentQuestion.optionsJson?.labels || currentQuestion.optionsJson?.steps;
      if (!Array.isArray(fields) || fields.length === 0) {
        fields = [{ id: 1, label: 'Field 1' }];
      }

      let structuredAnswers: Record<string, string> = {};
      if (answers[currentQuestion.id]) {
        try { structuredAnswers = JSON.parse(answers[currentQuestion.id]); } catch {}
      }

      let hasEmptyField = false;
      for (const field of fields) {
        const isObj = typeof field === 'object' && field !== null;
        const label = isObj ? field.label : String(field);
        if (!structuredAnswers[label] || !structuredAnswers[label].trim()) {
          hasEmptyField = true;
          break;
        }
      }

      if (hasEmptyField) {
        return false;
      }
    }
    
    if (['open_text', 'structured_response', 'prompt_writing', 'code_review'].includes(type)) {
      const minWords = currentQuestion.optionsJson?.minWords;
      const maxWords = currentQuestion.optionsJson?.maxWords;
      if (minWords || maxWords) {
        const wordCount = calculateWordCount(type, answers[currentQuestion.id] || '');
        if (maxWords && wordCount > maxWords) {
          setValidationError(`Maximum word limit exceeded. Maximum allowed: ${maxWords} words. Current: ${wordCount} words.`);
          return false;
        }
      }
    }
    return true;
  };

  const handleNext = () => {
    setShowValidation(true);
    if (validateCurrentQuestion()) {
      setShowValidation(false);
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handleConfirmSubmit = () => {
    setShowValidation(true);
    if (validateCurrentQuestion()) {
      setShowConfirmModal(true);
    }
  };

  // Computed sections
  const sections = React.useMemo(() => {
    if (!test || !test.questions) return [];
    return test.questions.reduce((acc, q, idx) => {
      const sectionName = q.section || 'General';
      let sectionObj = acc.find((s) => s.name === sectionName);
      if (!sectionObj) {
        sectionObj = { name: sectionName, questions: [] };
        acc.push(sectionObj);
      }
      sectionObj.questions.push({ ...q, originalIndex: idx });
      return acc;
    }, [] as { name: string; questions: (Question & { originalIndex: number })[] }[]);
  }, [test]);

  // Total and answered counts
  const totalQuestionsCount = test?.questions?.length || 0;
  const answeredQuestionsCount = React.useMemo(() => {
    if (!test?.questions) return 0;
    return test.questions.filter(
      (q) => answers[q.id] && answers[q.id].trim().length > 0 && answers[q.id] !== '[]'
    ).length;
  }, [test, answers]);

  const progressPercent = totalQuestionsCount > 0 ? Math.round((answeredQuestionsCount / totalQuestionsCount) * 100) : 0;

  const isAllCollapsed = sections.length > 0 && sections.every((s) => collapsedSections[s.name]);

  const handleToggleAllSections = () => {
    if (isAllCollapsed) {
      setCollapsedSections({});
    } else {
      const allCollapsed: Record<string, boolean> = {};
      sections.forEach((s) => {
        allCollapsed[s.name] = true;
      });
      setCollapsedSections(allCollapsed);
    }
  };

  const toggleSection = (sectionName: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionName]: !prev[sectionName],
    }));
  };

  const formatSectionName = (name: string): string => {
    if (!name) return 'General';
    return getCategoryLabel(name);
  };

  const getSectionIcon = (sectionName: string) => {
    const canonical = canonicalizeCategory(sectionName);
    switch (canonical) {
      case 'PROBLEM_SOLVING':
        return Puzzle;
      case 'INTEGRITY':
        return Shield;
      case 'AI_LITERACY':
        return Sparkles;
      case 'COMMUNICATION_AND_TEAMWORK':
        return Users;
      case 'EXECUTION_AND_RELIABILITY':
        return Briefcase;
      case 'CODING':
        return Code2;
      case 'LEARNING_APTITUDE':
        return BookOpen;
      case 'ATTITUDE_AND_OWNERSHIP':
        return UserCheck;
      case 'ELIGIBILITY':
        return ShieldCheck;
      case 'APTITUDE':
        return BookOpen;
      default:
        return LayoutGrid;
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
          <div className="text-[#607797] font-bold text-xs tracking-widest uppercase">Loading Assessment...</div>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-slate-50 space-y-4">
        <div className="text-rose-500 mb-4"><AlertTriangle className="w-12 h-12 mx-auto" /></div>
        <h2 className="text-xl font-bold text-slate-800">Assessment Not Available</h2>
        <p className="text-slate-600">{errorMsg}</p>
        <button onClick={() => {
          if (window.history.length > 1) {
            router.back();
          } else {
            router.push('/student/dashboard');
          }
        }} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition">
          Return to Dashboard
        </button>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-slate-50 space-y-4">
        <div className="text-4xl">📭</div>
        <h2 className="text-xl font-bold text-slate-800">No Assessment Found</h2>
        <button onClick={() => {
          if (window.history.length > 1) {
            router.back();
          } else {
            router.push('/student/dashboard');
          }
        }} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition">
          Return to Dashboard
        </button>
      </div>
    );
  }

  if (!test.questions || test.questions.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-slate-50 space-y-4">
        <div className="text-4xl">📭</div>
        <h2 className="text-xl font-bold text-slate-800">No Questions Found</h2>
        <p className="text-slate-600">This assessment currently contains no questions. Please notify your administrator.</p>
        <button onClick={() => {
          if (window.history.length > 1) {
            router.back();
          } else {
            router.push('/student/dashboard');
          }
        }} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition">
          Return to Dashboard
        </button>
      </div>
    );
  }

  const currentQuestion = test.questions[currentQuestionIndex];
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;

  // Resolve branch name or fallback
  const studentBranch = (test as any).student?.branchName || 'General';

  if (showInstructions) {
    return (
      <div className="min-h-screen bg-[#F3F7FD] relative overflow-x-hidden text-[#10234E] font-sans selection:bg-blue-100 selection:text-blue-900 flex flex-col">
        {/* Decorative Background Curves */}
        <DecorativeBackground />

        {/* Candidate Portal Top Navigation Bar */}
        <StudentHeader
          variant="navbar"
          badge="CANDIDATE PORTAL"
          showProfile
          showEmail
          showLogout
        />

        {/* Main Content Area */}
        <main className="relative z-10 flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col justify-center">
          {/* Back to Dashboard Navigation Link */}
          <div className="mb-4">
            <Link
              href="/student/dashboard"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#607797] hover:text-[#10234E] transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-[#607797]" />
              <span>Back to Dashboard</span>
            </Link>
          </div>

          {/* Centered White Instructions Card */}
          <div className="bg-white border border-[#DCE5F0] rounded-2xl sm:rounded-[24px] shadow-[0_4px_25px_rgba(16,35,78,0.04)] p-6 sm:p-10 space-y-7 sm:space-y-8">
            {/* Header: Shield Icon + Title + Dynamic Subtitle */}
            <div className="flex items-start sm:items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#EEF5FF] text-[#1760FF] border border-[#BFDBFE]/60 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-[26px] font-bold text-[#10234E] tracking-tight">
                  Assessment Instructions
                </h1>
                <p className="text-sm sm:text-base text-[#607797] mt-0.5 font-normal">
                  Welcome to the EllipHire Assessment – {studentBranch} 2027.
                </p>
              </div>
            </div>

            {/* Assessment Information Grid: 2 Columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Duration */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]/70 flex items-center gap-4">
                <div className="w-11 h-11 rounded-full bg-[#EEF5FF] text-[#1760FF] flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-medium text-[#607797]">Duration</div>
                  <div className="text-base sm:text-lg font-bold text-[#10234E]">
                    {(test as any).totalDuration || (test as any).total_duration || 60} minutes
                  </div>
                </div>
              </div>

              {/* Questions */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]/70 flex items-center gap-4">
                <div className="w-11 h-11 rounded-full bg-[#EEF5FF] text-[#1760FF] flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-medium text-[#607797]">Questions</div>
                  <div className="text-base sm:text-lg font-bold text-[#10234E]">
                    {test.questions.length} total
                  </div>
                </div>
              </div>

              {/* Auto Save */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]/70 flex items-center gap-4">
                <div className="w-11 h-11 rounded-full bg-[#E8F8F0] text-[#10B981] flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <div className="text-base sm:text-lg font-bold text-[#10234E]">Auto Save</div>
                  <div className="text-xs sm:text-sm text-[#607797]">Answers save automatically</div>
                </div>
              </div>

              {/* Navigation */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]/70 flex items-center gap-4">
                <div className="w-11 h-11 rounded-full bg-[#EEF5FF] text-[#1760FF] flex items-center justify-center shrink-0">
                  <ArrowRight className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <div className="text-base sm:text-lg font-bold text-[#10234E]">Navigation</div>
                  <div className="text-xs sm:text-sm text-[#607797]">Freely switch between questions</div>
                </div>
              </div>
            </div>

            {/* Proctoring Rules: Pale-Amber Banner */}
            <div className="p-5 sm:p-6 rounded-2xl bg-[#FFFDF5] border border-[#FDE6BA] space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-full bg-[#F59E0B] text-white flex items-center justify-center font-black text-xs select-none">
                  !
                </div>
                <h2 className="text-base font-bold text-[#10234E]">Proctoring Rules</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-0 md:divide-x md:divide-[#FDE6BA]/80">
                {/* Rule 1: Camera required */}
                <div className="flex items-start gap-3 md:pr-4">
                  <Camera className="w-5 h-5 text-[#D97706] shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-[#B45309] text-sm">Camera required</div>
                    <p className="text-xs text-[#92400E] mt-0.5 leading-relaxed">
                      Keep your camera on throughout the test.
                    </p>
                  </div>
                </div>

                {/* Rule 2: Mic required */}
                <div className="flex items-start gap-3 md:px-4">
                  <Mic className="w-5 h-5 text-[#D97706] shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-[#B45309] text-sm">Mic required</div>
                    <p className="text-xs text-[#92400E] mt-0.5 leading-relaxed">
                      Keep your microphone on throughout the test.
                    </p>
                  </div>
                </div>

                {/* Rule 3: No tab switching */}
                <div className="flex items-start gap-3 md:pl-4">
                  <Monitor className="w-5 h-5 text-[#D97706] shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-[#B45309] text-sm">No tab switching</div>
                    <p className="text-xs text-[#92400E] mt-0.5 leading-relaxed">
                      Do not switch tabs or open other applications.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Acknowledgement Panel */}
            <label className="bg-[#F0F6FD] border border-[#DCE8F6] rounded-2xl p-4 sm:p-4.5 flex items-center gap-3.5 cursor-pointer select-none transition-colors hover:bg-[#EAF2FC]/80 group">
              <div
                className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors shrink-0 ${
                  acceptedDisclaimer
                    ? 'bg-[#1760FF] text-white shadow-sm'
                    : 'border-2 border-[#BFDBFE] bg-white group-hover:border-[#1760FF]'
                }`}
              >
                {acceptedDisclaimer && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>
              <input
                type="checkbox"
                checked={acceptedDisclaimer}
                onChange={(e) => setAcceptedDisclaimer(e.target.checked)}
                className="sr-only"
              />
              <span className="font-bold text-[#10234E] text-sm">
                I have read and understood the instructions and rules.
              </span>
            </label>

            {/* Footer with Divider and Start Assessment Button */}
            <div className="pt-4 border-t border-[#DCE5F0] flex justify-end">
              <button
                type="button"
                onClick={handleStartTest}
                disabled={isInitializing || !acceptedDisclaimer}
                className={`w-full sm:w-auto h-12 px-7 font-bold text-sm sm:text-base rounded-xl transition-all flex items-center justify-center gap-2.5 shadow-[0_2px_10px_rgba(23,96,255,0.2)] ${
                  isInitializing || !acceptedDisclaimer
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                    : 'bg-[#1760FF] hover:bg-[#1250DF] text-white cursor-pointer active:scale-[0.99]'
                }`}
              >
                {isInitializing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Requesting Permissions...</span>
                  </>
                ) : (
                  <>
                    <span>Start Assessment</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                  </>
                )}
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#F3F7FD] flex flex-col overflow-hidden text-[#10234E] font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Top Navbar Matching Reference Mockup */}
      <StudentHeader
        variant="navbar"
        badge="CANDIDATE PORTAL"
        showProfile
        showEmail
        showLogout
      />

      {/* Main Split Layout: Sidebar + Question Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-xl shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-4 font-bold text-sm flex items-center gap-3 border border-slate-700">
            <AlertTriangle className="w-4 h-4 text-rose-400" /> {toastMessage}
          </div>
        )}

        {/* Warning Modal */}
        {showWarning && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full border border-[#DCE5F0] shadow-xl">
              <h3 className="text-lg font-bold text-red-600 mb-2">Warning</h3>
              <p className="text-gray-700 mb-4 text-sm">You switched tabs. Multiple violations will result in test termination.</p>
              <button
                onClick={() => setShowWarning(false)}
                className="bg-[#1760FF] hover:bg-[#1250DF] text-white font-semibold py-2 px-4 rounded-xl w-full text-sm cursor-pointer"
              >
                I understand
              </button>
            </div>
          </div>
        )}

        {/* Mobile Backdrop */}
        {isMobileNavOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden" 
            onClick={() => setIsMobileNavOpen(false)}
          />
        )}

        {/* Left Sidebar - Question Navigator */}
        <aside className={`
          fixed inset-y-0 left-0 z-50 w-[350px] lg:w-[370px] bg-[#F3F7FD] border-r border-[#DCE5F0] flex flex-col h-full shrink-0 transition-transform duration-300
          ${isMobileNavOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
          md:relative md:translate-x-0 md:shadow-none
        `}>
          <div className="flex flex-col h-full p-4 space-y-3.5 overflow-hidden">
            {/* Mobile Header with close button */}
            <div className="flex md:hidden items-center justify-between pb-1">
              <span className="font-bold text-[#10234E] text-sm">Question Navigator</span>
              <button 
                type="button"
                onClick={() => setIsMobileNavOpen(false)} 
                className="p-1 text-[#607797] hover:text-[#10234E] rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* A. Test Progress Card */}
            <div className="bg-white rounded-2xl border border-[#DCE5F0] p-4 sm:p-5 shadow-[0_2px_10px_rgba(16,35,78,0.02)] shrink-0">
              <h3 className="font-bold text-[#10234E] text-sm sm:text-base">Test Progress</h3>
              <div className="mt-2">
                <div className="text-2xl font-black text-[#10234E]">
                  {answeredQuestionsCount} / {totalQuestionsCount}
                </div>
                <div className="text-xs font-medium text-[#607797] mt-0.5">
                  Questions Answered
                </div>
              </div>
              <div className="flex items-center gap-3 mt-3">
                <div className="flex-1 bg-[#E2E8F0]/70 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#1760FF] h-full rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-[#10234E] shrink-0 min-w-[28px] text-right">
                  {progressPercent}%
                </span>
              </div>
            </div>

            {/* B. Sections Heading & Global Expand/Collapse Toggle */}
            <div className="flex items-center justify-between px-1 text-xs font-bold text-[#607797] uppercase tracking-wider shrink-0">
              <span>SECTIONS ({sections.length})</span>
              <button
                type="button"
                onClick={handleToggleAllSections}
                className="p-1 text-[#607797] hover:text-[#10234E] transition-colors rounded hover:bg-white cursor-pointer"
                title={isAllCollapsed ? 'Expand all sections' : 'Collapse all sections'}
              >
                {isAllCollapsed ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronUp className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* C. Scrollable Section Cards */}
            <div className="flex-1 overflow-y-auto space-y-3 min-h-0 pr-1 pb-2 scrollbar-thin scrollbar-thumb-slate-200">
              {sections.map((section) => {
                const currentSec = currentQuestion?.section || 'General';
                const isSectionActive = section.name === currentSec;
                const isCollapsed = !!collapsedSections[section.name];
                const sectionAnswered = section.questions.filter(
                  (q) => answers[q.id] && answers[q.id].trim().length > 0 && answers[q.id] !== '[]'
                ).length;
                const sectionTotal = section.questions.length;
                const SectionIcon = getSectionIcon(section.name);
                const formattedName = formatSectionName(section.name);

                return (
                  <div
                    key={section.name}
                    className={`rounded-2xl transition-all duration-150 overflow-hidden ${
                      isSectionActive
                        ? 'bg-[#F0F6FD] border border-[#1760FF] shadow-sm'
                        : 'bg-white border border-[#DCE5F0] shadow-[0_1px_4px_rgba(16,35,78,0.02)]'
                    }`}
                  >
                    {/* Section Header Button */}
                    <button
                      type="button"
                      onClick={() => toggleSection(section.name)}
                      className="w-full flex items-center justify-between p-3.5 text-left transition-colors cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <SectionIcon className={`w-4 h-4 shrink-0 ${isSectionActive ? 'text-[#1760FF]' : 'text-[#607797]'}`} />
                        <span className="text-xs sm:text-sm font-bold truncate text-[#10234E]">
                          {formattedName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className={`text-xs font-bold ${isSectionActive ? 'text-[#1760FF]' : 'text-[#607797]'}`}>
                          {sectionAnswered} / {sectionTotal}
                        </span>
                        {isCollapsed ? (
                          <ChevronDown className={`w-4 h-4 ${isSectionActive ? 'text-[#1760FF]' : 'text-[#607797]'}`} />
                        ) : (
                          <ChevronUp className={`w-4 h-4 ${isSectionActive ? 'text-[#1760FF]' : 'text-[#607797]'}`} />
                        )}
                      </div>
                    </button>

                    {/* Questions List (when expanded) */}
                    {!isCollapsed && (
                      <div className="px-3.5 pb-3.5 pt-0">
                        <div className="flex flex-wrap gap-2">
                          {section.questions.map((q) => {
                            const idx = q.originalIndex;
                            const isSelected = currentQuestionIndex === idx;
                            const isAnswered = answers[q.id] && answers[q.id].trim().length > 0 && answers[q.id] !== '[]';
                            const isFlagged = flags[q.id];

                            let chipClasses = "bg-white border border-[#DCE5F0] text-[#607797] hover:border-[#1760FF] hover:text-[#1760FF]";
                            if (isSelected) {
                              chipClasses = "bg-[#1760FF] text-white border border-[#1760FF] shadow-sm font-bold";
                            } else if (isAnswered) {
                              chipClasses = "bg-[#10B981] text-white border border-[#10B981] shadow-sm font-bold";
                            } else if (isFlagged) {
                              chipClasses = "bg-[#F59E0B] text-white border border-[#F59E0B] shadow-sm font-bold";
                            }

                            return (
                              <button
                                key={q.id}
                                type="button"
                                onClick={() => {
                                  setShowValidation(false);
                                  setCurrentQuestionIndex(idx);
                                  setIsMobileNavOpen(false);
                                }}
                                className={`w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center relative transition-all duration-150 cursor-pointer ${chipClasses}`}
                              >
                                {idx + 1}
                                {/* If flagged and (answered or selected), display an amber dot badge */}
                                {isFlagged && (isAnswered || isSelected) && (
                                  <span
                                    className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#F59E0B] border-2 border-white ring-1 ring-[#F59E0B]/30"
                                    title="Flagged for review"
                                  />
                                )}
                                {/* If answered and selected, display a green dot badge on top-left */}
                                {isAnswered && isSelected && (
                                  <span
                                    className="absolute -top-0.5 -left-0.5 w-2.5 h-2.5 rounded-full bg-[#10B981] border-2 border-white ring-1 ring-[#10B981]/30"
                                    title="Answered"
                                  />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* D. Fixed Question Status Legend */}
            <div className="bg-white border border-[#DCE5F0] rounded-2xl p-3.5 sm:p-4 shadow-[0_2px_10px_rgba(16,35,78,0.02)] shrink-0">
              <h4 className="text-xs font-bold text-[#10234E] mb-2.5">Question Status</h4>
              <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-xs font-medium text-[#607797]">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#1760FF] shrink-0" />
                  <span>Current</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#10B981] shrink-0" />
                  <span>Answered</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#F59E0B] shrink-0" />
                  <span>Flagged</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-white border border-[#CBD5E1] shrink-0" />
                  <span>Not Answered</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#F3F7FD] h-full overflow-hidden">
          {/* Sub Header above Question Card */}
          <div className="px-4 sm:px-8 pt-4 sm:pt-6 pb-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <button 
                type="button"
                onClick={() => setIsMobileNavOpen(true)}
                className="md:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 focus:outline-none rounded-lg hover:bg-white cursor-pointer"
                title="Open question navigator"
              >
                <Menu className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-sm font-black text-[#10234E] tracking-wider uppercase">
                   {studentBranch} drive
                </h1>
                <div className="text-xs font-bold text-[#607797] uppercase tracking-wider mt-0.5">
                   Q {currentQuestionIndex + 1} of {test.questions.length} <span className="hidden sm:inline">• {formatSectionName(currentQuestion.section || 'General')}</span>
                </div>
              </div>
            </div>

            {/* Timer Pill */}
            <div className={`px-4 py-1.5 rounded-full border flex items-center gap-2 shadow-sm font-bold font-mono text-base ${
              timeRemaining < 300 
                ? 'text-rose-600 border-rose-200 bg-rose-50 animate-pulse' 
                : 'text-[#10234E] border-[#DCE5F0] bg-white'
            }`}>
              <Clock className={`w-4 h-4 ${timeRemaining < 300 ? 'text-rose-600' : 'text-rose-500'}`} />
              <span>{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</span>
            </div>
          </div>

          {/* Question Scroll Area */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-2">
            <div className="max-w-5xl mx-auto space-y-6 pb-6">
              <div className="bg-white rounded-2xl sm:rounded-[24px] border border-[#DCE5F0] shadow-[0_4px_25px_rgba(16,35,78,0.03)] p-6 sm:p-10 space-y-6">
              <div className="space-y-4 text-left">
                <div className="flex gap-3">
                  {/* Points hidden from student UI */}
                </div>
                <div className="text-2xl font-semibold text-slate-900 leading-relaxed prose prose-slate max-w-none">
                  <MarkdownRenderer content={currentQuestion.questionText} />
                </div>
              </div>

              {/* Answer Input */}
              <div className="pt-2 border-t border-slate-100">
              {validationError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> {validationError}
                </div>
              )}
              {(() => {
                const type = String(currentQuestion.type || '').toLowerCase().replace(/[\s-]/g, '_');
                
                // MCQ, Single Select, Multi Select, Yes/No
                if (['mcq', 'coding_mcq', 'single_select', 'multi_select', 'yes_no'].includes(type)) {
                  let optionsArray = Array.isArray(currentQuestion.optionsJson) 
                    ? currentQuestion.optionsJson 
                    : (currentQuestion.optionsJson?.options || []);
                    
                  optionsArray = seededShuffle([...optionsArray], test.id + currentQuestion.id);
                  
                  const isMultiSelect = type === 'multi_select';
                  let selectedAnswers: string[] = [];
                  if (isMultiSelect && answers[currentQuestion.id]) {
                    try {
                      selectedAnswers = JSON.parse(answers[currentQuestion.id]);
                    } catch {
                      selectedAnswers = [answers[currentQuestion.id]];
                    }
                  }

                  return (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                        <span className="text-sm font-bold text-slate-700">Select your answer:</span>
                        {answers[currentQuestion.id] && answers[currentQuestion.id] !== '[]' && (
                          <button
                            onClick={() => handleClearAnswer(currentQuestion.id)}
                            className="text-xs font-bold text-slate-400 hover:text-rose-600 transition underline underline-offset-4"
                          >
                            Clear Selection
                          </button>
                        )}
                      </div>
                      <div className="space-y-3">
                        {optionsArray.map((option: any, idx: number) => {
                          const optionVal = typeof option === 'object' && option !== null && 'text' in option ? option.text : String(option);
                          const isSelected = isMultiSelect 
                            ? selectedAnswers.includes(optionVal)
                            : answers[currentQuestion.id] === optionVal;

                          return (
                            <label 
                              key={idx} 
                              className={`flex items-center px-4 min-h-[48px] border rounded-xl transition-colors cursor-pointer ${
                                isSelected ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-blue-500 hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type={isMultiSelect ? "checkbox" : "radio"}
                                name={`question-${currentQuestion.id}`}
                                value={optionVal}
                                checked={isSelected}
                                onChange={() => {
                                  if (isMultiSelect) {
                                    const newArr = isSelected 
                                      ? selectedAnswers.filter((a: string) => a !== optionVal)
                                      : [...selectedAnswers, optionVal];
                                    handleAnswerChange(currentQuestion.id, JSON.stringify(newArr));
                                  } else {
                                    handleAnswerChange(currentQuestion.id, optionVal);
                                  }
                                }}
                                className={`mr-3 w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300 ${isMultiSelect ? 'rounded' : 'rounded-full'}`}
                              />
                              <span className={`text-sm font-medium ${isSelected ? 'text-blue-900' : 'text-slate-700'}`}>{optionVal}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                // Numeric Input
                if (['numeric', 'numerical'].includes(type)) {
                  return (
                    <div className="space-y-4">
                      <label className="text-sm font-bold text-slate-700">Enter your numeric answer:</label>
                      <Input
                        type="number"
                        value={answers[currentQuestion.id] || ''}
                        onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                        className="max-w-xs text-lg py-6 bg-slate-50 border-slate-200"
                        placeholder="0.00"
                      />
                    </div>
                  );
                }



                // Textareas (Open Text)
                if (type === 'open_text') {
                  const val = answers[currentQuestion.id] || '';
                  const wordCount = val.trim() ? val.trim().split(/\s+/).length : 0;
                  return (
                    <div className="space-y-4">
                      <label className="text-sm font-bold text-slate-700">Your Response:</label>
                      <Textarea
                        value={val}
                        onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                        onCopy={handleClipboardEvent}
                        onCut={handleClipboardEvent}
                        onPaste={handleClipboardEvent}
                        onDrop={handleClipboardEvent}
                        className="w-full h-[160px] p-4 bg-slate-50 focus:bg-white resize-none text-base rounded-xl border-slate-300 focus:ring-blue-500 shadow-sm transition-colors"
                        placeholder="Type your response here..."
                      />
                      {renderWordLimitIndicator(type, currentQuestion)}
                    </div>
                  );
                }

                // Ranking (Dropdown Selection)
                if (type === 'ranking') {
                  let optionsArray = Array.isArray(currentQuestion.optionsJson) 
                    ? currentQuestion.optionsJson 
                    : (currentQuestion.optionsJson?.options || []);
                  
                  // Keep options stable during the session
                  optionsArray = seededShuffle([...optionsArray], test.id + currentQuestion.id);
                  const optionTexts = optionsArray.map((o: any) => typeof o === 'object' && o !== null && 'text' in o ? o.text : String(o));
                  
                  // studentAnswer maps optionText -> rank (1, 2, 3...)
                  let studentAnswer: Record<string, number> = {};
                  if (answers[currentQuestion.id]) {
                    try { studentAnswer = JSON.parse(answers[currentQuestion.id]); } catch {}
                  }

                  const handleRankSelect = (item: string, rank: string) => {
                    const newAnswer = { ...studentAnswer };
                    if (!rank) {
                      delete newAnswer[item];
                    } else {
                      newAnswer[item] = Number(rank);
                    }
                    handleAnswerChange(currentQuestion.id, JSON.stringify(newAnswer));
                  };

                  const selectedRanks = Object.values(studentAnswer);

                  if (optionTexts.length === 0) {
                    return <div className="text-slate-400 italic">No ranking options provided for this question.</div>;
                  }

                  return (
                    <div className="space-y-4">
                      <p className="text-sm font-bold text-slate-700 mb-4">Assign a unique rank to each item (1 is highest):</p>
                      <div className="space-y-2">
                        {optionTexts.map((item: string, idx: number) => (
                          <div key={idx} className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200 shadow-sm">
                            <select
                              value={studentAnswer[item] ? String(studentAnswer[item]) : ''}
                              onChange={(e) => handleRankSelect(item, e.target.value)}
                              className="h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white font-bold text-slate-700 outline-none focus:border-blue-500 w-24"
                            >
                              <option value="">Rank ▼</option>
                              {optionTexts.map((_: any, i: number) => {
                                const rankVal = i + 1;
                                const isUsed = selectedRanks.includes(rankVal) && studentAnswer[item] !== rankVal;
                                return (
                                  <option key={rankVal} value={String(rankVal)} disabled={isUsed}>
                                    {rankVal}
                                  </option>
                                );
                              })}
                            </select>
                            <div className="flex-1 font-semibold text-slate-800">{item}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }

                // Structured Response
                if (type === 'structured_response') {
                  let optionsObj = currentQuestion.optionsJson;
                  if (typeof optionsObj === 'string') {
                    try { optionsObj = JSON.parse(optionsObj); } catch {}
                  }
                  let fields = optionsObj?.fields || optionsObj?.labels || optionsObj?.steps;
                  if (!Array.isArray(fields) || fields.length === 0) {
                    fields = ['Field 1'];
                  }

                  let structuredAnswers: Record<string, string> = {};
                  if (answers[currentQuestion.id]) {
                    try { structuredAnswers = JSON.parse(answers[currentQuestion.id]); } catch {}
                  }

                  const updateField = (fieldLabel: string, val: string) => {
                    const newAnswers = { ...structuredAnswers, [fieldLabel]: val };
                    handleAnswerChange(currentQuestion.id, JSON.stringify(newAnswers));
                  };

                  return (
                    <div className="space-y-4">
                      {fields.map((field: any, idx: number) => {
                        const isObj = typeof field === 'object' && field !== null;
                        const label = isObj ? field.label : String(field);
                        const isEmpty = showValidation && (!structuredAnswers[label] || !structuredAnswers[label].trim());

                        return (
                          <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                            <div className="px-4 py-3 bg-white border-b border-slate-100 flex items-center justify-between">
                              <label className="text-sm font-semibold text-slate-800">
                                {label}
                              </label>
                              {isEmpty && (
                                <span className="flex items-center gap-1.5 text-xs font-medium text-rose-500">
                                  <AlertCircle className="w-3.5 h-3.5" /> Required
                                </span>
                              )}
                            </div>
                            <div className="p-3">
                              <Textarea
                                value={structuredAnswers[label] || ''}
                                onChange={(e) => {
                                  updateField(label, e.target.value);
                                  setShowValidation(false);
                                }}
                                onCopy={handleClipboardEvent}
                                onCut={handleClipboardEvent}
                                onPaste={handleClipboardEvent}
                                onDrop={handleClipboardEvent}
                                className={`w-full h-[120px] p-3 bg-white focus:bg-white resize-none text-sm border-slate-200 focus:ring-blue-500 rounded-lg ${isEmpty ? 'border-rose-300' : ''}`}
                                placeholder={`Enter ${label}...`}
                              />
                            </div>
                          </div>
                        );
                      })}
                      {renderWordLimitIndicator(type, currentQuestion)}
                    </div>
                  );
                }

                // Coding
                if (type === 'coding') {
                  return (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                          <Code2 className="w-4 h-4 text-blue-600" />
                          🧑‍💻 Code Editor
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex gap-2">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 border border-slate-200 text-xs font-medium text-slate-600">Auto Save: On</span>
                          </div>
                          {answers[currentQuestion.id] && (
                            <button
                              onClick={() => handleClearAnswer(currentQuestion.id)}
                              className="text-xs font-medium text-slate-400 hover:text-rose-600 transition"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="h-[340px] border border-slate-200 rounded-xl overflow-hidden shadow-inner bg-[#1e1e1e]">
                        <Editor
                          height="100%"
                          defaultLanguage="javascript"
                          theme="vs-dark"
                          value={answers[currentQuestion.id] || ''}
                          onChange={(value) => handleAnswerChange(currentQuestion.id, value || '')}
                          options={{
                            minimap: { enabled: false },
                            fontSize: 14,
                            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                            wordWrap: 'on',
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                            tabSize: 2,
                            contextmenu: false,
                            dragAndDrop: false,
                            padding: { top: 16, bottom: 16 }
                          }}
                          onMount={(editor, monaco) => {
                            const preventAction = () => {
                              setToastMessage("Copying and pasting is not allowed in text answers.");
                              setTimeout(() => setToastMessage(null), 3000);
                              recordViolation('Copy/Paste attempted in editor');
                            };

                            const domNode = editor.getDomNode();
                            if (domNode) {
                              const handleProhibited = (e: Event) => {
                                e.preventDefault();
                                preventAction();
                              };
                              domNode.addEventListener('copy', handleProhibited);
                              domNode.addEventListener('paste', handleProhibited);
                              domNode.addEventListener('cut', handleProhibited);
                              
                              domNode.addEventListener('contextmenu', (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              });
                              
                              editor.onKeyDown((e) => {
                                if (e.ctrlKey || e.metaKey) {
                                  const key = e.browserEvent.key.toLowerCase();
                                  if (key === 'c' || key === 'v' || key === 'x' || key === 'a') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    preventAction();
                                  }
                                }
                              });
                            }
                          }}
                        />
                      </div>
                    </div>
                  );
                }

                // Fallback for unknown types
                return (
                  <div className="text-center py-10 text-slate-400 font-bold">
                    Unsupported question type ({type}). Please contact your administrator.
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

        {/* Navigation */}
        <div className="bg-white/95 backdrop-blur-sm border-t border-[#DCE5F0] px-4 sm:px-8 py-3.5 flex justify-between items-center shrink-0 z-20">
          <div className="flex gap-2 sm:gap-3">
            <button
              onClick={() => {
                setShowValidation(false);
                setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1));
              }}
              disabled={currentQuestionIndex === 0}
              className="h-10 sm:h-11 px-4 sm:px-5 inline-flex items-center justify-center gap-2 rounded-xl bg-white border border-[#DCE5F0] hover:bg-slate-50 disabled:opacity-40 text-[#10234E] font-semibold text-sm transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-[#607797]" />
              <span className="hidden sm:inline">Previous</span>
            </button>
            <button
              onClick={() => handleToggleFlag(currentQuestion.id)}
              className={`h-10 sm:h-11 px-4 sm:px-5 inline-flex items-center justify-center gap-2 rounded-xl font-semibold border transition-colors text-sm cursor-pointer ${
                flags[currentQuestion.id] 
                  ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                  : 'bg-white border-[#DCE5F0] text-[#10234E] hover:bg-slate-50'
              }`}
            >
              <Flag className={`w-4 h-4 ${flags[currentQuestion.id] ? 'text-amber-600 fill-amber-600' : 'text-[#607797]'}`} /> 
              <span className="hidden sm:inline">{flags[currentQuestion.id] ? 'Flagged' : 'Flag for Review'}</span>
            </button>
          </div>

          <div className="flex items-center">
            {currentQuestionIndex < test.questions.length - 1 ? (
              <button
                onClick={handleNext}
                className="h-10 sm:h-11 px-6 sm:px-7 inline-flex items-center justify-center gap-2 rounded-xl bg-[#1760FF] hover:bg-[#1250DF] text-white font-semibold transition-all shadow-[0_2px_10px_rgba(23,96,255,0.2)] text-sm cursor-pointer"
              >
                <span>Next</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleConfirmSubmit}
                disabled={isSubmitting}
                className="h-10 sm:h-11 px-6 sm:px-7 inline-flex items-center justify-center gap-2 rounded-xl bg-[#1760FF] hover:bg-[#1250DF] disabled:opacity-50 text-white font-semibold transition-all shadow-[0_2px_10px_rgba(23,96,255,0.2)] text-sm cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">{isSubmitting ? 'Submitting...' : 'Submit Assessment'}</span>
                <span className="sm:hidden">{isSubmitting ? '...' : 'Submit'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>

      {/* Confirm Submission Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-[24px] sm:rounded-[28px] max-w-lg w-full shadow-[0_20px_50px_rgba(16,35,78,0.18)] border border-[#DCE5F0] overflow-hidden flex flex-col relative animate-in fade-in zoom-in-95 duration-150">
            {/* Header: Warning Icon + Title + Subtitle + Close Button */}
            <div className="p-6 sm:p-7 pb-4 sm:pb-5 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-full bg-[#EAF2FE] text-[#1760FF] flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-[#10234E] tracking-tight">Confirm Submission</h3>
                  <p className="text-xs sm:text-sm text-[#607797] font-normal mt-0.5">Please review your progress before completing.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="w-8 h-8 rounded-lg border border-[#DCE5F0] text-[#607797] hover:text-[#10234E] hover:bg-[#F3F7FD] flex items-center justify-center transition-colors cursor-pointer shrink-0 mt-0.5"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {/* Middle Section: Summary Metric Cards + Advisory Banner */}
            <div className="px-6 sm:px-7 py-4 space-y-3.5 bg-[#F6F9FD]">
              {/* Row 1: Answered & Remaining Metric Cards */}
              <div className="grid grid-cols-2 gap-3.5">
                {/* Card 1: Answered */}
                <div className="bg-white p-4 rounded-2xl border border-[#DCE5F0] shadow-[0_2px_8px_rgba(16,35,78,0.02)] flex items-center gap-3.5">
                  <CheckCircle2 className="w-7 h-7 text-[#10B981] stroke-[2.2] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-[#607797] uppercase tracking-wider">Answered</div>
                    <div className="text-xl sm:text-2xl font-black text-[#10234E] mt-0.5 truncate">
                      {answeredQuestionsCount} / {test.questions.length}
                    </div>
                  </div>
                </div>
                
                {/* Card 2: Remaining */}
                <div className="bg-white p-4 rounded-2xl border border-[#DCE5F0] shadow-[0_2px_8px_rgba(16,35,78,0.02)] flex items-center gap-3.5">
                  <CircleDashed className="w-7 h-7 text-[#F59E0B] stroke-[2.2] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-[#607797] uppercase tracking-wider">Remaining</div>
                    <div className="text-xl sm:text-2xl font-black text-[#10234E] mt-0.5 truncate">
                      {test.questions.length - answeredQuestionsCount}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Row 2: Full-width Time Left Metric Card */}
              <div className="bg-white p-4 rounded-2xl border border-[#DCE5F0] shadow-[0_2px_8px_rgba(16,35,78,0.02)] flex items-center gap-3.5">
                <Clock className="w-7 h-7 text-[#1760FF] stroke-[2.2] shrink-0" />
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-[#607797] uppercase tracking-wider">Time Left</div>
                  <div className="text-xl sm:text-2xl font-black text-[#10234E] mt-0.5 font-mono">
                    {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                  </div>
                </div>
              </div>
              
              {/* Row 3: Advisory Info Notice */}
              <div className="bg-[#EEF5FF] border border-[#BFDBFE]/60 p-4 rounded-2xl flex items-start gap-3">
                <Info className="w-5 h-5 text-[#1760FF] shrink-0 mt-0.5 stroke-[2.2]" />
                <div className="text-xs sm:text-[13px] font-medium text-[#1760FF] leading-relaxed">
                  <p>After submission, your answers cannot be changed.</p>
                  <p>Ensure you have reviewed all flagged questions.</p>
                </div>
              </div>
            </div>
            
            {/* Footer Actions: Cancel and Submit Assessment */}
            <div className="p-5 sm:p-6 bg-white flex items-center justify-center gap-3">
              <button 
                type="button"
                className="h-11 sm:h-12 px-6 sm:px-8 text-sm sm:text-base font-bold rounded-xl sm:rounded-2xl border border-[#DCE5F0] bg-white text-[#10234E] hover:bg-[#F3F7FD] transition-colors cursor-pointer min-w-[110px]" 
                onClick={() => setShowConfirmModal(false)}
              >
                Cancel
              </button>
              <button 
                type="button"
                className="h-11 sm:h-12 px-6 sm:px-8 text-sm sm:text-base font-bold rounded-xl sm:rounded-2xl bg-[#1760FF] hover:bg-[#1250DF] text-white flex items-center justify-center gap-2.5 transition-all shadow-[0_4px_16px_rgba(23,96,255,0.25)] disabled:opacity-50 cursor-pointer" 
                onClick={() => submitTest(false)} 
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 stroke-[2.2]" />
                )}
                <span>{isSubmitting ? 'Submitting...' : 'Submit Assessment'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-Submit Modal (Timer Expired) */}
      {showAutoSubmitModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 text-2xl font-bold">!</div>
            <h3 className="text-xl font-bold text-slate-900">Time Limit Reached</h3>
            <p className="text-sm text-slate-500">Your assessment has been automatically submitted because the allotted time has ended.</p>
            <div className="bg-slate-50 rounded-xl p-4 text-left text-xs space-y-2 text-slate-650">
              <p><strong>Test Name:</strong> EllipHire Assessment – {studentBranch} 2027</p>
              <p>Total Questions: <strong className="text-slate-900">{test.questions.length}</strong></p>
              <p>Answered: <strong className="text-emerald-600">{Object.keys(answers).filter(qId => answers[qId]?.trim().length > 0).length}</strong></p>
              <p>Unanswered: <strong className="text-rose-600">{test.questions.length - Object.keys(answers).filter(qId => answers[qId]?.trim().length > 0).length}</strong></p>
            </div>
            <div className="pt-2">
              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold" onClick={() => router.push('/student/success')}>
                Continue
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
