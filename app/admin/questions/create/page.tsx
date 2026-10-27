'use client';

import React, { useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { LatexEditor } from '@/components/ui/latex-editor';
import { mapQuestionPayload } from '@/lib/questionMapper';
import { toast } from 'react-hot-toast';
import { BrandLogo } from '@/components/common/BrandLogo';
import { 
  Brain, 
  Code, 
  ClipboardList, 
  Users, 
  GraduationCap, 
  Settings, 
  MessageSquare, 
  Shield, 
  Bot,
  UserCheck,
  ArrowLeft,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';

// --- Configuration Data ---
const ASSESSMENTS = [
  { id: 'APTITUDE', title: 'Quantitative & Logical Reasoning', desc: 'Quantitative Ability, Logical Reasoning, Verbal Ability.', icon: <Brain className="w-4 h-4" /> },
  { id: 'CODING', title: 'Coding & Debugging', desc: 'Programming Challenges and Coding MCQs.', icon: <Code className="w-4 h-4" /> },
  { id: 'ELIGIBILITY', title: 'Eligibility & Logistics (Unscored)', desc: 'Screening questions to determine candidate eligibility.', icon: <ClipboardList className="w-4 h-4" /> },
  { id: 'ATTITUDE_AND_OWNERSHIP', title: 'Ownership & Initiative', desc: 'Evaluate candidate ownership and attitude.', icon: <Users className="w-4 h-4" /> },
  { id: 'LEARNING_APTITUDE', title: 'Learning Agility', desc: 'Evaluate learning agility and comprehension.', icon: <GraduationCap className="w-4 h-4" /> },
  { id: 'PROBLEM_SOLVING', title: 'Problem Solving & System Design', desc: 'Assess problem solving strategies and logic.', icon: <Brain className="w-4 h-4" /> },
  { id: 'EXECUTION_AND_RELIABILITY', title: 'Delivery & Dependability', desc: 'Evaluate task execution and planning.', icon: <Settings className="w-4 h-4" /> },
  { id: 'COMMUNICATION_AND_TEAMWORK', title: 'Written Communication & Collaboration', desc: 'Assess written communication and teamwork.', icon: <MessageSquare className="w-4 h-4" /> },
  { id: 'INTEGRITY', title: 'Ethics & Judgment', desc: 'Evaluate ethical behavior and integrity.', icon: <Shield className="w-4 h-4" /> },
  { id: 'AI_LITERACY', title: 'AI Literacy & Responsible Use', desc: 'Assess prompt engineering and AI tool proficiency.', icon: <Bot className="w-4 h-4" /> },
  { id: 'PERSONALITY', title: 'Personality (Unscored)', desc: 'Open-text personality assessment questions.', icon: <UserCheck className="w-4 h-4" /> }
];

const QUESTION_TYPES: Record<string, Array<{ id: string, label: string }>> = {
  APTITUDE: [
    { id: 'mcq', label: 'Multiple Choice (MCQ)' }
  ],
  CODING: [
    { id: 'coding', label: 'Coding Challenge' },
    { id: 'coding_mcq', label: 'Coding MCQ' }
  ],
  ELIGIBILITY: [
    { id: 'single_select', label: 'Single Select' },
    { id: 'open_text', label: 'Open Text' }
  ],
  ATTITUDE_AND_OWNERSHIP: [
    { id: 'mcq', label: 'Multiple Choice (MCQ)' },
    { id: 'open_text', label: 'Open Text' },
    { id: 'ranking', label: 'Ranking' }
  ],
  LEARNING_APTITUDE: [
    { id: 'open_text', label: 'Open Text' },
    { id: 'structured_response', label: 'Structured Response' }
  ],
  PROBLEM_SOLVING: [
    { id: 'structured_response', label: 'Structured Response' },
    { id: 'open_text', label: 'Open Text' }
  ],
  EXECUTION_AND_RELIABILITY: [
    { id: 'structured_response', label: 'Structured Response' },
    { id: 'open_text', label: 'Open Text' }
  ],
  COMMUNICATION_AND_TEAMWORK: [
    { id: 'open_text', label: 'Open Text' }
  ],
  INTEGRITY: [
    { id: 'mcq', label: 'Multiple Choice (MCQ)' },
    { id: 'open_text', label: 'Open Text' }
  ],
  AI_LITERACY: [
    { id: 'multi_select', label: 'Multi Select' },
    { id: 'open_text', label: 'Open Text' }
  ],
  PERSONALITY: [
    { id: 'open_text', label: 'Open Text' }
  ]
};

export default function CreateQuestionPage() {
  const router = useRouter();
  
  // Wizard State
  const [step, setStep] = useState(1);
  const [isSaved, setIsSaved] = useState(false);
  
  // Data State
  const [section, setSection] = useState('');
  const [type, setType] = useState('');
  
  // Question Fields
  const [questionText, setQuestionText] = useState('');
  const [points, setPoints] = useState(10);
  const [options, setOptions] = useState<any[]>([{ text: '' }, { text: '' }]);
  const [correctAnswer, setCorrectAnswer] = useState('0');
  
  // Descriptive / Behaviour / Eligibility specifics
  const [isRequired, setIsRequired] = useState(true);
  const [expectedDuration, setExpectedDuration] = useState(5);
  const [expectedAnswerLength, setExpectedAnswerLength] = useState(150);
  const [weight, setWeight] = useState(1);
  const [scenario, setScenario] = useState('');
  
  const [minCharacters, setMinCharacters] = useState(50);
  const [maxCharacters, setMaxCharacters] = useState(0);

  // Case Study specifics
  const [caseStudyTitle, setCaseStudyTitle] = useState('');
  const [caseStudyBackground, setCaseStudyBackground] = useState('');
  const [caseStudyContext, setCaseStudyContext] = useState('');
  const [caseStudyProblemStatement, setCaseStudyProblemStatement] = useState('');
  const [caseStudySupportingInfo, setCaseStudySupportingInfo] = useState('');
  
  // Coding specifics
  const [constraints, setConstraints] = useState('');
  const [sampleInput, setSampleInput] = useState('');
  const [sampleOutput, setSampleOutput] = useState('');
  
  // Structured Response Specifics
  const [structuredFields, setStructuredFields] = useState([{ id: 1, label: '' }, { id: 2, label: '' }, { id: 3, label: '' }]);
  
  // Structured Plan Specifics
  const [planMode, setPlanMode] = useState('day');
  const [planDays, setPlanDays] = useState(5);
  const [planLabels, setPlanLabels] = useState(['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5']);

  // Word Limits Specifics
  const [minWords, setMinWords] = useState('');
  const [maxWords, setMaxWords] = useState('');

  // Ranking Specifics
  const [allowPartialMarks, setAllowPartialMarks] = useState(false);

  // Resets state when starting over
  const resetForm = () => {
    setStep(1);
    setIsSaved(false);
    setSection('');
    setType('');
    setQuestionText('');
    setPoints(10);
    setOptions([{ text: '' }, { text: '' }]);
    setCorrectAnswer('0');
    setExpectedDuration(5);
    setExpectedAnswerLength(150);
    setWeight(1);
    setScenario('');
    setMinCharacters(50);
    setMaxCharacters(0);
    setCaseStudyTitle('');
    setCaseStudyBackground('');
    setCaseStudyContext('');
    setCaseStudyProblemStatement('');
    setCaseStudySupportingInfo('');
    setConstraints('');
    setSampleInput('');
    setSampleOutput('');
    setStructuredFields([{ id: 1, label: '' }, { id: 2, label: '' }, { id: 3, label: '' }]);
    setPlanMode('day');
    setPlanDays(5);
    setPlanLabels(['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5']);
    setMinWords('');
    setMaxWords('');
    setAllowPartialMarks(false);
  };

  const handleNext = () => setStep(prev => prev + 1);
  const handleBack = () => setStep(prev => prev - 1);

  // Logic flags
  const requiresLatex = (section === 'APTITUDE' || section === 'CODING');
  const showsMarks = (section === 'APTITUDE' || section === 'CODING');

  // Save Function
  const handleSave = async (status: 'published' | 'draft') => {
    try {
      const token = localStorage.getItem('token');
      
      if (section === 'PERSONALITY' && type !== 'open_text') {
        toast.error('Personality category only supports open-text questions.');
        return;
      }

      const rawData: any = {
        type,
        section,
        questionText,
        points: section === 'PERSONALITY' ? 0 : points,
        weight,
        isPublished: status === 'published'
      };

      if (['mcq', 'yes_no', 'single_select', 'multi_select', 'coding_mcq', 'ranking'].includes(type)) {
        rawData.options = options;
        if (type !== 'ranking') {
          if (type === 'multi_select') {
            try {
              const parsed = JSON.parse(correctAnswer);
              if (!Array.isArray(parsed) || parsed.length === 0) {
                toast.error('At least one correct answer must be selected for Multi Select.');
                return;
              }
            } catch {
              toast.error('At least one correct answer must be selected for Multi Select.');
              return;
            }
          }
          rawData.correctAnswer = correctAnswer;
        }
        if (type === 'ranking') {
           rawData.allowPartialMarks = allowPartialMarks;
           const ranks = options.map(o => o.rank).filter(Boolean);
           const uniqueRanks = new Set(ranks);
           if (ranks.length !== options.length || uniqueRanks.size !== options.length) {
              toast.error('Every option must have a unique rank before saving.');
              return;
           }
           const expectedRanks = Array.from({length: options.length}, (_, i) => String(i + 1));
           const sortedRanks = [...ranks].sort((a: any, b: any) => Number(a) - Number(b));
           if (JSON.stringify(sortedRanks) !== JSON.stringify(expectedRanks)) {
              toast.error('Ranks must be exactly 1 to ' + options.length);
              return;
           }
        }
      }

      if (type === 'coding') {
        rawData.constraints = constraints;
        rawData.sampleInput = sampleInput;
        rawData.sampleOutput = sampleOutput;
        rawData.starterCode = '';
        rawData.language = 'javascript';
      }

      if (['scenario', 'ai_scenario'].includes(type)) {
        rawData.scenario = scenario;
      }

      if (['case_study', 'ai_scenario'].includes(type)) {
        rawData.caseStudyTitle = caseStudyTitle;
        rawData.caseStudyBackground = caseStudyBackground;
        rawData.caseStudyContext = caseStudyContext;
        rawData.caseStudyProblemStatement = caseStudyProblemStatement;
        rawData.caseStudySupportingInfo = caseStudySupportingInfo;
      }

      if (['scenario', 'case_study', 'ai_scenario', 'open_text', 'structured_response', 'ranking'].includes(type)) {
        rawData.minCharacters = minCharacters;
        rawData.maxCharacters = maxCharacters;
        rawData.expectedDuration = expectedDuration;
        rawData.expectedAnswerLength = expectedAnswerLength;
        rawData.isRequired = isRequired;
      }

      if (type === 'structured_response') {
        rawData.fields = structuredFields;
      }

      if (['open_text', 'structured_response'].includes(type)) {
        rawData.minWords = minWords;
        rawData.maxWords = maxWords;
      }

      const payload: any = mapQuestionPayload(rawData);
      
      // Clean undefined/null fields
      Object.keys(payload).forEach(key => {
        if (payload[key] === undefined || payload[key] === null) {
          delete payload[key];
        }
      });

      await axios.post('/api/questions', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Question saved successfully');
      setIsSaved(true);
    } catch (e: any) {
      console.error(e);
      const errorMsg = e.response?.data?.message || 'Failed to save question';
      if (e.response?.data?.errors) {
        const validationErrors = e.response.data.errors.map((err: any) => err.message).join('\n');
        toast.error(`Validation Error: ${validationErrors}`);
      } else {
        toast.error(errorMsg);
      }
    }
  };

  // --- RENDERING HELPERS ---
  const currentSectionMeta = ASSESSMENTS.find(a => a.id === section);

  // Post-save UI
  if (isSaved) {
    return (
      <div className="min-h-screen bg-[#F0F6FD] relative overflow-x-hidden text-[#10234E] font-sans flex flex-col justify-center items-center p-4">
        {/* Subtle Decorative Curves */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
          <div 
            className="absolute inset-0" 
            style={{
              background: 'radial-gradient(circle at 50% 40%, #F8FBFE 0%, #EEF5FD 60%, #E6F1FC 100%)'
            }}
          />
        </div>

        <div className="relative z-10 max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200/80 p-6 sm:p-8 text-center space-y-5 animate-fade-in">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto border border-emerald-100 shadow-2xs">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-[#10234E] tracking-tight">Question Saved Successfully</h2>
            <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">The question has been added to your universal assessment repository.</p>
          </div>
          <div className="flex flex-col gap-2.5 pt-2">
            <Button onClick={resetForm} className="bg-[#1760FF] hover:bg-blue-700 text-white font-semibold h-9 rounded-xl shadow-xs text-xs">
              Create Another Question
            </Button>
            <Button variant="outline" onClick={() => router.push('/admin/questions')} className="h-9 rounded-xl text-xs font-semibold border-slate-200 text-slate-700 hover:bg-slate-50">
              Go to Question Bank
            </Button>
            <Button variant="ghost" onClick={() => setIsSaved(false)} className="text-slate-500 hover:bg-slate-100 h-8 text-xs">
              Preview Saved Question
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0F6FD] relative overflow-x-hidden text-[#10234E] font-sans selection:bg-blue-100 selection:text-blue-900 flex flex-col">
      {/* Decorative Background Curves & Soft Waves */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
        <div 
          className="absolute inset-0" 
          style={{
            background: 'radial-gradient(circle at 50% 40%, #F8FBFE 0%, #EEF5FD 60%, #E6F1FC 100%)'
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
            <linearGradient id="cqTopRightGrad" x1="1440" y1="0" x2="900" y2="400" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#BCDDFC" stopOpacity="0.75" />
              <stop offset="50%" stopColor="#D4E9FE" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#F0F6FD" stopOpacity="0" />
            </linearGradient>

            <linearGradient id="cqBottomLeftGrad" x1="0" y1="900" x2="600" y2="500" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#A8D4FC" stopOpacity="0.65" />
              <stop offset="55%" stopColor="#CCE3FD" stopOpacity="0.38" />
              <stop offset="100%" stopColor="#F0F6FD" stopOpacity="0" />
            </linearGradient>

            <linearGradient id="cqBottomWaveGrad" x1="0" y1="850" x2="1440" y2="750" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#BDDCFC" stopOpacity="0.5" />
              <stop offset="50%" stopColor="#D0E6FD" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#E4F1FE" stopOpacity="0.2" />
            </linearGradient>
          </defs>

          <path d="M1440 0 L 980 0 C 980 160, 1120 320, 1440 370 Z" fill="url(#cqTopRightGrad)" />
          <path d="M0 900 L 0 540 C 220 540, 440 680, 560 900 Z" fill="url(#cqBottomLeftGrad)" />
          <path d="M0 760 C 350 780, 720 730, 1080 670 C 1240 645, 1370 675, 1440 705 L 1440 900 L 0 900 Z" fill="url(#cqBottomWaveGrad)" />
        </svg>
      </div>

      {/* Sticky Top Navigation Bar */}
      <nav className="bg-white/95 backdrop-blur-xs border-b border-slate-200/80 sticky top-0 z-40 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BrandLogo size="md" className="items-start flex-row items-center" />
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold uppercase tracking-wider hidden sm:inline-block border border-slate-200/60">
              Console
            </span>
          </div>
          <div>
            <Button 
              variant="outline"
              onClick={() => router.push('/admin/questions')}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-lg transition flex items-center border-none shadow-2xs cursor-pointer h-8"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Questions
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="relative z-10 max-w-5xl w-full mx-auto px-4 sm:px-6 py-4 sm:py-5 flex-1 space-y-4">
        
        {/* Compact Breadcrumb & Page Title */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <span className="cursor-pointer hover:text-slate-700 transition-colors" onClick={() => router.push('/admin/questions')}>Question Bank</span>
            <span>›</span>
            <span className={step === 1 ? 'text-[#1760FF] font-bold' : 'cursor-pointer hover:text-slate-700 transition-colors'} onClick={() => setStep(1)}>Create Question</span>
            {section && (
              <>
                <span>›</span>
                <span className={step === 2 ? 'text-[#1760FF] font-bold' : 'cursor-pointer hover:text-slate-700 transition-colors'} onClick={() => setStep(2)}>{currentSectionMeta?.title}</span>
              </>
            )}
            {type && (
              <>
                <span>›</span>
                <span className="text-[#1760FF] font-bold">{QUESTION_TYPES[section]?.find(t => t.id === type)?.label}</span>
              </>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#10234E] tracking-tight">Create Question</h1>
        </div>

        {/* Compact Persistent Progress Indicator */}
        <div className="max-w-xl mx-auto mb-2 px-2">
          <div className="flex items-center justify-between relative">
            {/* Background connecting bar */}
            <div className="absolute left-6 right-6 top-3 h-[2px] bg-slate-200 -z-0" />
            <div 
              className="absolute left-6 top-3 h-[2px] bg-[#1760FF] -z-0 transition-all duration-300"
              style={{ width: `${((step - 1) / 3) * 100}%`, maxWidth: 'calc(100% - 48px)' }}
            />

            {[
              { num: 1, label: 'Assessment' },
              { num: 2, label: 'Question Type' },
              { num: 3, label: 'Details' },
              { num: 4, label: 'Review & Save' }
            ].map((s) => (
              <div 
                key={s.num} 
                className="flex flex-col items-center gap-1 z-10 cursor-pointer"
                onClick={() => {
                  if (s.num < step) setStep(s.num);
                }}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all shadow-2xs ${
                  step > s.num ? 'bg-[#1760FF] text-white' : 
                  step === s.num ? 'bg-[#1760FF] text-white ring-3 ring-blue-100 font-extrabold' : 'bg-white border border-slate-300 text-slate-400'
                }`}>
                  {step > s.num ? '✓' : s.num}
                </div>
                <span className={`text-[10px] uppercase tracking-wider font-bold transition-colors ${
                  step === s.num ? 'text-[#1760FF]' : step > s.num ? 'text-slate-700' : 'text-slate-400'
                }`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* STEP 1: Assessment Section Selection (Compact 3-Column Grid) */}
        {step === 1 && (
          <div className="space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#10234E]">Select Assessment Section</h2>
                <p className="text-xs text-slate-500">Choose the primary category for this question.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {ASSESSMENTS.map(item => {
                const isSelected = section === item.id;
                return (
                  <div 
                    key={item.id}
                    onClick={() => {
                      setSection(item.id);
                      setType('');
                      handleNext();
                    }}
                    className={`p-3 rounded-xl border transition-all cursor-pointer bg-white shadow-2xs hover:border-blue-400 hover:shadow-xs group flex flex-col justify-between ${
                      isSelected ? 'border-[#1760FF] bg-blue-50/40 ring-1 ring-[#1760FF]' : 'border-slate-200/80 hover:bg-blue-50/10'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                          isSelected ? 'bg-[#1760FF] text-white shadow-2xs' : 'bg-blue-50 text-[#1760FF]'
                        }`}>
                          {item.icon}
                        </div>
                        {isSelected ? (
                          <span className="w-4.5 h-4.5 rounded-full bg-[#1760FF] text-white flex items-center justify-center text-[10px] font-bold">✓</span>
                        ) : (
                          <span className="w-4.5 h-4.5 rounded-full border border-slate-200 text-transparent group-hover:border-blue-300 flex items-center justify-center text-[10px]">✓</span>
                        )}
                      </div>
                      <h3 className={`text-xs sm:text-sm font-bold transition-colors ${
                        isSelected ? 'text-[#10234E]' : 'text-slate-800 group-hover:text-[#1760FF]'
                      }`}>
                        {item.title}
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-1 leading-snug line-clamp-2">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 2: Question Type Selection (Compact Cards) */}
        {step === 2 && (
          <div className="space-y-3.5 max-w-3xl mx-auto animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#10234E]">Select Question Type</h2>
                <p className="text-xs text-slate-500">Choose the format for {currentSectionMeta?.title}.</p>
              </div>
            </div>
            
            {/* Contextual Guidance */}
            <div className="bg-blue-50/70 border border-blue-200/70 p-3 rounded-xl text-blue-900 text-xs flex items-center gap-2">
              <span className="font-bold uppercase tracking-wider text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">Guidance</span>
              <span>{currentSectionMeta?.desc}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {QUESTION_TYPES[section]?.map(t => {
                const isSelected = type === t.id;
                return (
                  <div 
                    key={t.id}
                    onClick={() => {
                      setType(t.id);
                      handleNext();
                    }}
                    className={`border p-3.5 rounded-xl cursor-pointer transition-all flex items-center justify-between bg-white shadow-2xs hover:border-blue-400 hover:shadow-xs group ${
                      isSelected ? 'bg-blue-50/50 border-[#1760FF] ring-1 ring-[#1760FF]' : 'border-slate-200/80 hover:bg-blue-50/20'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-[#1760FF]' : 'bg-slate-300 group-hover:bg-blue-400'}`} />
                      <span className={`text-xs sm:text-sm font-semibold ${isSelected ? 'text-[#10234E] font-bold' : 'text-slate-800'}`}>
                        {t.label}
                      </span>
                    </div>
                    <ArrowRight className={`w-4 h-4 transition-transform group-hover:translate-x-0.5 ${isSelected ? 'text-[#1760FF]' : 'text-slate-400'}`} />
                  </div>
                );
              })}
            </div>

            <div className="pt-2 flex justify-start">
              <Button 
                variant="outline" 
                onClick={handleBack} 
                className="h-8 px-3 text-xs text-slate-700 border-slate-200 bg-white hover:bg-slate-50 rounded-lg cursor-pointer flex items-center"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Sections
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Question Details Form (Compact Layout) */}
        {step === 3 && (
          <div className="space-y-3.5 max-w-4xl mx-auto animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#10234E]">Question Details</h2>
                <p className="text-xs text-slate-500">Configure prompt, answer choices, and scoring rules.</p>
              </div>
            </div>

            <Card className="border border-slate-200/80 rounded-xl shadow-2xs bg-white overflow-hidden">
              <CardContent className="p-4 sm:p-5 space-y-4">
                
                {/* Question / Problem Statement Field */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {type === 'coding' ? 'Problem Statement (Supports Markdown & LaTeX)' : 'Question Prompt (Supports Markdown & LaTeX)'}
                  </label>
                  {requiresLatex ? (
                    <LatexEditor 
                      value={questionText} 
                      onChange={setQuestionText} 
                      placeholder="Write your content here (LaTeX supported via $...$)"
                      rows={5}
                    />
                  ) : (
                    <Textarea 
                      value={questionText}
                      onChange={(e) => setQuestionText(e.target.value)}
                      className="w-full min-h-[120px] p-3 bg-slate-50/70 focus:bg-white resize-y text-xs rounded-lg border-slate-200 leading-relaxed"
                      placeholder="Type your question prompt here..."
                    />
                  )}
                </div>

                {/* Eligibility / Descriptive toggles */}
                {['yes_no', 'numeric', 'scenario', 'case_study', 'ai_scenario', 'practical_prompt', 'practical_task', 'open_text', 'structured_response', 'ranking'].includes(type) && (
                  <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/70 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-xs text-slate-800">Required Question</h4>
                      <p className="text-[11px] text-slate-500">Must the candidate provide an answer to proceed?</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)} />
                      <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#1760FF]"></div>
                    </label>
                  </div>
                )}

                {/* MCQ Options */}
                {['mcq', 'coding_mcq', 'single_select', 'multi_select'].includes(type) && (
                  <div className="space-y-3 pt-1 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-slate-800 text-xs">
                        Options & Correct Answer
                      </h3>
                      <span className="text-[11px] text-slate-400">
                        {type === 'multi_select' ? 'Select all options that apply' : 'Select the single correct answer radio'}
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {options.map((opt, i) => (
                        <div key={i} className="flex gap-2.5 items-center">
                          {(type === 'multi_select') ? (
                            <input 
                              type="checkbox" 
                              checked={(() => {
                                try {
                                  const parsed = JSON.parse(correctAnswer);
                                  return Array.isArray(parsed) && parsed.includes(String(i));
                                } catch {
                                  return false;
                                }
                              })()}
                              onChange={(e) => {
                                try {
                                  const parsed = JSON.parse(correctAnswer);
                                  const arr = Array.isArray(parsed) ? parsed : [];
                                  let newArr;
                                  if (e.target.checked) {
                                    newArr = [...arr, String(i)];
                                  } else {
                                    newArr = arr.filter(v => v !== String(i));
                                  }
                                  setCorrectAnswer(JSON.stringify(newArr));
                                } catch {
                                  setCorrectAnswer(JSON.stringify([String(i)]));
                                }
                              }}
                              className="h-4 w-4 text-[#1760FF] focus:ring-blue-500 border-slate-300 rounded cursor-pointer shrink-0"
                              title="Mark as correct answer"
                            />
                          ) : (
                            <input 
                              type="radio" 
                              name="correct" 
                              checked={correctAnswer === String(i)}
                              onChange={() => setCorrectAnswer(String(i))}
                              className="h-4 w-4 text-[#1760FF] focus:ring-blue-500 border-slate-300 cursor-pointer shrink-0"
                              title="Mark as correct answer"
                            />
                          )}
                          {requiresLatex ? (
                            <div className="flex-1">
                              <LatexEditor 
                                value={opt.text} 
                                onChange={(val) => {
                                  const newOpts = [...options];
                                  newOpts[i].text = val;
                                  setOptions(newOpts);
                                }} 
                                placeholder={`Option ${i + 1}`}
                                rows={2}
                              />
                            </div>
                          ) : (
                            <Input 
                              value={opt.text} 
                              onChange={(e) => {
                                const newOpts = [...options];
                                newOpts[i].text = e.target.value;
                                setOptions(newOpts);
                              }} 
                              placeholder={`Option ${i + 1}`}
                              className="bg-slate-50/70 border-slate-200 flex-1 h-8.5 text-xs rounded-lg"
                            />
                          )}
                          {options.length > 2 && (
                            <button 
                              type="button" 
                              onClick={() => setOptions(options.filter((_, idx) => idx !== i))}
                              className="text-slate-400 hover:text-rose-500 transition-colors p-1 cursor-pointer"
                              title="Remove option"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setOptions([...options, { text: '' }])} 
                      className="border-slate-200 text-slate-700 bg-white h-7 px-2.5 text-xs rounded-md shadow-2xs hover:bg-slate-50 cursor-pointer"
                    >
                      + Add Option
                    </Button>
                  </div>
                )}

                {/* Ranking Options */}
                {type === 'ranking' && (
                  <div className="space-y-3 pt-1 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-slate-800 text-xs">Options & Correct Rank</h3>
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                         <input type="checkbox" checked={allowPartialMarks} onChange={e => setAllowPartialMarks(e.target.checked)} className="h-3.5 w-3.5 rounded border-slate-300 text-[#1760FF]" />
                         <span className="font-semibold text-slate-700 text-[11px]">Allow Partial Marks</span>
                      </label>
                    </div>
                    <div className="space-y-2.5">
                      {options.map((opt, i) => (
                        <div key={i} className="flex gap-2.5 items-center">
                          <select 
                            value={opt.rank || ''} 
                            onChange={(e) => {
                              const newOpts = [...options];
                              newOpts[i].rank = e.target.value;
                              setOptions(newOpts);
                            }}
                            className="h-8.5 px-2 border border-slate-200 rounded-lg text-xs bg-white min-w-[90px] outline-none focus:border-blue-500 cursor-pointer"
                          >
                            <option value="">Rank ▼</option>
                            {options.map((_, idx) => (
                              <option key={idx + 1} value={String(idx + 1)}>{idx + 1}</option>
                            ))}
                          </select>
                          <div className="flex-1">
                             <Input 
                                value={opt.text} 
                                onChange={(e) => {
                                  const newOpts = [...options];
                                  newOpts[i].text = e.target.value;
                                  setOptions(newOpts);
                                }} 
                                placeholder={`Option ${i + 1}`}
                                className="bg-white border-slate-200 h-8.5 text-xs rounded-lg"
                             />
                          </div>
                          {options.length > 2 && (
                            <button type="button" onClick={() => setOptions(options.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-rose-500 font-bold px-1.5 cursor-pointer">×</button>
                          )}
                        </div>
                      ))}
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => setOptions([...options, { text: '', rank: '' }])} className="border-slate-200 text-slate-700 bg-white h-7 px-2.5 text-xs rounded-md shadow-2xs hover:bg-slate-50 cursor-pointer">
                      + Add Option
                    </Button>
                  </div>
                )}

                {/* Structured Response Fields */}
                {type === 'structured_response' && (
                  <div className="space-y-3 pt-1 border-t border-slate-100">
                    <h3 className="font-bold text-slate-800 text-xs">Response Fields</h3>
                    <div className="space-y-2.5">
                      {structuredFields.map((field, i) => (
                        <div key={field.id}>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">Field {i + 1} Label</label>
                          <Input 
                            value={field.label} 
                            onChange={(e) => {
                              const newFields = [...structuredFields];
                              newFields[i].label = e.target.value;
                              setStructuredFields(newFields);
                            }} 
                            placeholder={`e.g. Field ${i + 1}`}
                            className="bg-white border-slate-200 max-w-sm h-8.5 text-xs rounded-lg"
                          />
                        </div>
                      ))}
                      <div className="flex gap-2 pt-1">
                        {structuredFields.length < 6 && (
                          <Button type="button" variant="outline" size="sm" onClick={() => setStructuredFields([...structuredFields, { id: structuredFields.length + 1, label: '' }])} className="text-slate-600 bg-slate-50 hover:bg-slate-100 h-7 text-xs rounded-md">
                            + Add Field
                          </Button>
                        )}
                        {structuredFields.length > 2 && (
                          <Button type="button" variant="outline" size="sm" onClick={() => setStructuredFields(structuredFields.slice(0, -1))} className="text-slate-600 bg-slate-50 hover:bg-rose-50 hover:text-rose-600 h-7 text-xs rounded-md">
                            - Remove Last Field
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Coding Specific Fields */}
                {type === 'coding' && (
                  <div className="space-y-4 pt-1 border-t border-slate-100">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Constraints</label>
                      <LatexEditor value={constraints} onChange={setConstraints} placeholder="Time limits, memory limits, variable bounds..." rows={2} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Sample Input</label>
                        <LatexEditor value={sampleInput} onChange={setSampleInput} placeholder="Example input data" rows={2} />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Sample Output</label>
                        <LatexEditor value={sampleOutput} onChange={setSampleOutput} placeholder="Expected output" rows={2} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Behaviour / Scenario Fields */}
                {type === 'scenario' && (
                  <div className="pt-1 border-t border-slate-100">
                    <label className="block text-xs font-bold text-slate-700 mb-1">Scenario Context (Optional)</label>
                    <Textarea 
                      value={scenario}
                      onChange={(e) => setScenario(e.target.value)}
                      className="w-full min-h-[80px] p-3 bg-slate-50 text-xs rounded-lg focus:bg-white border-slate-200"
                      placeholder="Provide background context for the situation..."
                    />
                  </div>
                )}

                {/* Case Study / AI Scenario Fields */}
                {(type === 'case_study' || type === 'ai_scenario') && (
                  <div className="space-y-3 pt-1 border-t border-slate-100">
                    <h3 className="font-bold text-slate-800 text-xs border-b border-slate-100 pb-1.5">{type === 'case_study' ? 'Case Study Details' : 'Scenario Details'}</h3>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">{type === 'case_study' ? 'Case Study Title' : 'Scenario Title'}</label>
                      <Input value={caseStudyTitle} onChange={(e) => setCaseStudyTitle(e.target.value)} placeholder="e.g. Acme Corp Customer Retention" className="h-8.5 text-xs rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Background</label>
                      <LatexEditor value={caseStudyBackground} onChange={setCaseStudyBackground} placeholder="Background details..." rows={2} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Context</label>
                      <LatexEditor value={caseStudyContext} onChange={setCaseStudyContext} placeholder="Specific situation..." rows={2} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Problem Statement</label>
                      <LatexEditor value={caseStudyProblemStatement} onChange={setCaseStudyProblemStatement} placeholder="The core issue..." rows={2} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Supporting Information (Optional)</label>
                      <LatexEditor value={caseStudySupportingInfo} onChange={setCaseStudySupportingInfo} placeholder="Data, tables, references..." rows={2} />
                    </div>
                  </div>
                )}

                {/* Word Limits & Scoring Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
                  
                  {/* Word Limits */}
                  {['open_text', 'structured_response'].includes(type) && (
                    <div className="space-y-2">
                      <h3 className="font-bold text-slate-800 text-xs">Word Limits</h3>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">Min Words (Optional)</label>
                          <Input 
                            type="number"
                            min="0"
                            value={minWords} 
                            onChange={(e) => setMinWords(e.target.value)} 
                            className="bg-white border-slate-200 h-8.5 text-xs rounded-lg" 
                            placeholder="e.g. 100"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">Max Words (Optional)</label>
                          <Input 
                            type="number"
                            min="0"
                            value={maxWords} 
                            onChange={(e) => setMaxWords(e.target.value)} 
                            className="bg-white border-slate-200 h-8.5 text-xs rounded-lg" 
                            placeholder="e.g. 500"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Marks & Weight Section */}
                  <div className="space-y-2">
                    {(showsMarks || ['scenario', 'case_study', 'ai_scenario', 'open_text', 'structured_response', 'code_review', 'prompt_writing', 'ranking', 'date', 'open_response', 'essay'].includes(type)) && (
                      <h3 className="font-bold text-slate-800 text-xs">Scoring</h3>
                    )}
                    <div className="grid grid-cols-2 gap-2.5">
                      {showsMarks && (
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">Marks</label>
                          <Input type="number" min="1" value={points} onChange={(e) => setPoints(Number(e.target.value))} className="bg-slate-50/70 font-bold text-xs h-8.5 border-slate-200 rounded-lg" />
                        </div>
                      )}
                      {['scenario', 'case_study', 'ai_scenario', 'open_text', 'structured_response', 'code_review', 'prompt_writing', 'ranking', 'date', 'open_response', 'essay'].includes(type) && (
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">Weight</label>
                          <Input type="number" min="1" value={weight} onChange={(e) => setWeight(Number(e.target.value))} className="bg-slate-50/70 font-bold text-xs h-8.5 border-slate-200 rounded-lg" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between items-center pt-2">
              <Button variant="outline" onClick={handleBack} className="h-8.5 px-3 text-xs text-slate-700 border-slate-200 bg-white hover:bg-slate-50 rounded-lg cursor-pointer">
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
              </Button>
              <Button onClick={handleNext} className="bg-[#1760FF] hover:bg-blue-700 text-white font-semibold h-8.5 px-4 text-xs rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center">
                Continue to Review <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: Review & Save (Compact Review Card) */}
        {step === 4 && (
          <div className="space-y-3.5 max-w-4xl mx-auto animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#10234E]">Review & Save</h2>
                <p className="text-xs text-slate-500">Confirm question settings before saving to the repository.</p>
              </div>
            </div>
            
            <Card className="border border-slate-200/80 rounded-xl shadow-2xs bg-white overflow-hidden">
              <CardContent className="p-0">
                {/* Header Meta */}
                <div className="bg-slate-50/80 border-b border-slate-200/80 p-3.5 sm:p-4 flex flex-wrap gap-5 text-xs">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Assessment</span>
                    <span className="font-semibold text-slate-800">{currentSectionMeta?.title}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Question Type</span>
                    <span className="font-semibold text-slate-800">{QUESTION_TYPES[section]?.find(t => t.id === type)?.label}</span>
                  </div>
                  {showsMarks && (
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Marks</span>
                      <span className="font-bold text-[#1760FF]">{points} Pts</span>
                    </div>
                  )}
                  {['yes_no', 'numeric', 'scenario', 'case_study', 'ai_scenario'].includes(type) && (
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Requirement</span>
                      <span className={`font-semibold ${isRequired ? 'text-rose-600' : 'text-slate-500'}`}>{isRequired ? 'Required' : 'Optional'}</span>
                    </div>
                  )}
                </div>

                {/* Content Preview */}
                <div className="p-4 sm:p-5 space-y-4">
                  <div>
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Question Preview</h3>
                    <div className="text-slate-800 text-xs sm:text-sm leading-relaxed bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/70 whitespace-pre-wrap font-medium">
                      {questionText || <span className="text-slate-400 italic font-normal">No question text provided.</span>}
                    </div>
                  </div>

                  {['mcq', 'coding_mcq', 'single_select', 'multi_select', 'multiple_select'].includes(type) && (
                    <div>
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Options</h3>
                      <div className="space-y-1.5">
                        {options.map((opt, i) => {
                          let isCorrect = false;
                          if (type === 'multi_select' || type === 'multiple_select') {
                            try {
                              const parsed = JSON.parse(correctAnswer);
                              isCorrect = Array.isArray(parsed) && parsed.includes(String(i));
                            } catch {}
                          } else {
                            isCorrect = correctAnswer === String(i);
                          }
                          return (
                            <div key={i} className={`p-2.5 rounded-lg border text-xs ${isCorrect ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900' : 'bg-slate-50/60 border-slate-200/70 text-slate-700'}`}>
                              <div className="flex items-center gap-2.5">
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                                  {String.fromCharCode(65 + i)}
                                </span>
                                <span className="font-medium flex-1">{opt.text || <span className="italic opacity-50 font-normal">Empty option</span>}</span>
                                {isCorrect && <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider bg-emerald-100/70 px-1.5 py-0.5 rounded">Correct Answer</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {type === 'yes_no' && (
                     <div>
                       <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Options</h3>
                       <div className="flex gap-3">
                         <div className="px-4 py-2 rounded-lg border bg-emerald-50 border-emerald-200 text-emerald-900 font-bold text-xs">Yes (Correct)</div>
                         <div className="px-4 py-2 rounded-lg border bg-slate-50 border-slate-200 text-slate-700 font-bold text-xs">No</div>
                       </div>
                     </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Action Bar */}
            <div className="flex justify-between items-center pt-2 pb-8">
              <Button variant="outline" onClick={handleBack} className="h-8.5 px-3.5 text-xs text-slate-700 border-slate-200 bg-white hover:bg-slate-50 rounded-lg cursor-pointer">
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Edit
              </Button>
              <div className="flex items-center gap-2.5">
                <Button 
                  variant="outline" 
                  onClick={() => handleSave('draft')} 
                  className="h-8.5 px-4 text-xs font-semibold rounded-lg border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer"
                >
                  Save as Draft
                </Button>
                <Button 
                  onClick={() => handleSave('published')} 
                  className="h-8.5 px-4 text-xs font-semibold rounded-lg bg-[#1760FF] hover:bg-blue-700 text-white shadow-2xs transition cursor-pointer"
                >
                  Publish & Save Question
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
