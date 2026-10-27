'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { LatexEditor } from '@/components/ui/latex-editor';
import { mapQuestionPayload } from '@/lib/questionMapper';
import { toast } from 'react-hot-toast';
import { BrandLogo } from '@/components/common/BrandLogo';
import { 
  canonicalizeCategory, 
  CATEGORIES, 
  CATEGORY_ORDER 
} from '@/lib/categories';

export default function EditQuestionPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [type, setType] = useState('mcq');
  const [section, setSection] = useState('APTITUDE');
  const [questionText, setQuestionText] = useState('');
  const [points, setPoints] = useState(10);

  // Descriptive Specific State
  const [assessmentDimension, setAssessmentDimension] = useState('ATTITUDE');
  const [weight, setWeight] = useState(1);
  const [expectedDuration, setExpectedDuration] = useState(5);
  const [expectedAnswerLength, setExpectedAnswerLength] = useState(150);
  const [isRequired, setIsRequired] = useState(true);
  const [displayOrder, setDisplayOrder] = useState(0);

  // MCQ Specific State
  const [options, setOptions] = useState<any[]>([{ text: '' }, { text: '' }]);
  const [correctAnswer, setCorrectAnswer] = useState('0');

  // Structured Response Specific State
  const [structuredFields, setStructuredFields] = useState([{ id: 1, label: '' }, { id: 2, label: '' }, { id: 3, label: '' }]);

  // Structured Plan Specific State
  const [planMode, setPlanMode] = useState('day');
  const [planDays, setPlanDays] = useState(5);
  const [planLabels, setPlanLabels] = useState(['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5']);

  // Word Limits Specifics
  const [minWords, setMinWords] = useState('');
  const [maxWords, setMaxWords] = useState('');
  const [minCharacters, setMinCharacters] = useState('');
  const [maxCharacters, setMaxCharacters] = useState('');

  // Ranking Specific State
  const [allowPartialMarks, setAllowPartialMarks] = useState(false);

  // Scenario Specifics
  const [scenario, setScenario] = useState('');
  const [caseStudyTitle, setCaseStudyTitle] = useState('');
  const [caseStudyBackground, setCaseStudyBackground] = useState('');
  const [caseStudyContext, setCaseStudyContext] = useState('');
  const [caseStudyProblemStatement, setCaseStudyProblemStatement] = useState('');
  const [caseStudySupportingInfo, setCaseStudySupportingInfo] = useState('');

  // Coding Specific State
  const [constraints, setConstraints] = useState('');
  const [inputFormat, setInputFormat] = useState('');
  const [outputFormat, setOutputFormat] = useState('');
  const [sampleInput, setSampleInput] = useState('');
  const [sampleOutput, setSampleOutput] = useState('');
  const [testCases, setTestCases] = useState<Array<{ input: string; expectedOutput: string; isPublic: boolean }>>([]);
  const [supportedLanguages, setSupportedLanguages] = useState<string[]>(['javascript', 'python', 'cpp', 'java']);

  const handleAddTestCase = () => {
    setTestCases([...testCases, { input: '', expectedOutput: '', isPublic: false }]);
  };

  const handleUpdateTestCase = (index: number, field: 'input' | 'expectedOutput' | 'isPublic', value: any) => {
    const updated = [...testCases];
    updated[index] = { ...updated[index], [field]: value };
    setTestCases(updated);
  };

  const handleDuplicateTestCase = (index: number) => {
    const target = testCases[index];
    setTestCases([...testCases, { ...target }]);
  };

  const handleDeleteTestCase = (index: number) => {
    setTestCases(testCases.filter((_, idx) => idx !== index));
  };

  useEffect(() => {
    if (id) {
      fetchQuestion();
    }
  }, [id]);

  const fetchQuestion = async () => {
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get(`/api/questions/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const q = data.question;

      setType(q.type || 'mcq');
      setSection(canonicalizeCategory(q.section) || 'APTITUDE');
      setQuestionText(q.question_text || '');
      setPoints(q.points || 10);
      setAssessmentDimension(q.assessment_dimension || 'ATTITUDE');
      setWeight(q.weight || 1);
      setExpectedDuration(q.expected_duration || 5);
      setExpectedAnswerLength(q.expected_answer_length || 150);
      setIsRequired(q.is_required !== false);
      setDisplayOrder(q.display_order || 0);

      if (['mcq', 'yes_no', 'single_select', 'multi_select', 'coding_mcq', 'ranking'].includes(q.type)) {
        let parsedOptions = [{ text: '' }, { text: '' }];
        const optionsArray = Array.isArray(q.options_json) 
          ? q.options_json 
          : (q.options_json?.options || null);

        if (Array.isArray(optionsArray)) {
          if (q.type === 'ranking') {
            const correctOrder = q.correct_answer ? JSON.parse(q.correct_answer) : [];
            parsedOptions = optionsArray.map((opt: any) => {
              const text = typeof opt === 'object' && opt !== null && 'text' in opt ? opt.text : String(opt);
              const rank = correctOrder.indexOf(text) !== -1 ? String(correctOrder.indexOf(text) + 1) : '';
              return { text, rank };
            });
            setAllowPartialMarks(!!q.options_json?.allowPartialMarks);
          } else {
            parsedOptions = optionsArray.map((opt: any) => 
              typeof opt === 'object' && opt !== null && 'text' in opt ? opt : { text: String(opt) }
            );
          }
        }
        setOptions(parsedOptions);
        setCorrectAnswer(q.correct_answer || '0');
      } else if (q.type === 'structured_response') {
        const opts = q.options_json || {};
        setStructuredFields(Array.isArray(opts.fields) && opts.fields.length > 0 ? opts.fields : [{ id: 1, label: '' }, { id: 2, label: '' }, { id: 3, label: '' }]);
      } else if (q.type === 'coding') {
        const opts = q.options_json || {};
        setConstraints(opts.constraints || '');
        setInputFormat(opts.inputFormat || '');
        setOutputFormat(opts.outputFormat || '');
        setSampleInput(opts.sampleInput || '');
        setSampleOutput(opts.sampleOutput || '');
        
        const publics = (opts.publicTestCases || []).map((tc: any) => ({ ...tc, isPublic: true }));
        const hiddens = (opts.hiddenTestCases || []).map((tc: any) => ({ ...tc, isPublic: false }));
        setTestCases([...publics, ...hiddens]);
        
        setSupportedLanguages(opts.supportedLanguages || ['javascript', 'python', 'cpp', 'java']);
      }

      if (['open_text', 'structured_response'].includes(q.type)) {
        const opts = q.options_json || {};
        setMinWords(opts.minWords || '');
        setMaxWords(opts.maxWords || '');
      }
    } catch (e) {
      console.error('Failed to fetch question', e);
      toast.error('Failed to load question details.');
    } finally {
      setIsLoading(false);
    }
  };

  const addOption = () => {
    setOptions([...options, { text: '' }]);
  };

  const updateOption = (index: number, val: string) => {
    const newOpts = [...options];
    newOpts[index].text = val;
    setOptions(newOpts);
  };

  const handleToggleLanguage = (lang: string) => {
    if (supportedLanguages.includes(lang)) {
      setSupportedLanguages(supportedLanguages.filter(l => l !== lang));
    } else {
      setSupportedLanguages([...supportedLanguages, lang]);
    }
  };

  const handleSave = async (status: 'published' | 'draft' = 'published') => {
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
        rawData.expectedDuration = expectedDuration;
        rawData.expectedAnswerLength = expectedAnswerLength;
        rawData.assessmentDimension = assessmentDimension;
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

      await axios.put(`/api/questions/${id}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Question updated successfully');
      router.push('/admin/questions');
    } catch (e: any) {
      console.error(e);
      const errorMsg = e.response?.data?.message || 'Failed to update question';
      if (e.response?.data?.errors) {
        const validationErrors = e.response.data.errors.map((err: any) => err.message).join('\n');
        toast.error(`Validation Error: ${validationErrors}`);
      } else {
        toast.error(errorMsg);
      }
    }
  };

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
            <linearGradient id="eqTopRightGrad" x1="1440" y1="0" x2="900" y2="400" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#BCDDFC" stopOpacity="0.75" />
              <stop offset="50%" stopColor="#D4E9FE" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#F0F6FD" stopOpacity="0" />
            </linearGradient>

            <linearGradient id="eqBottomLeftGrad" x1="0" y1="900" x2="600" y2="500" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#A8D4FC" stopOpacity="0.65" />
              <stop offset="55%" stopColor="#CCE3FD" stopOpacity="0.38" />
              <stop offset="100%" stopColor="#F0F6FD" stopOpacity="0" />
            </linearGradient>

            <linearGradient id="eqBottomWaveGrad" x1="0" y1="850" x2="1440" y2="750" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#BDDCFC" stopOpacity="0.5" />
              <stop offset="50%" stopColor="#D0E6FD" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#E4F1FE" stopOpacity="0.2" />
            </linearGradient>
          </defs>

          <path d="M1440 0 L 980 0 C 980 160, 1120 320, 1440 370 Z" fill="url(#eqTopRightGrad)" />
          <path d="M0 900 L 0 540 C 220 540, 440 680, 560 900 Z" fill="url(#eqBottomLeftGrad)" />
          <path d="M0 760 C 350 780, 720 730, 1080 670 C 1240 645, 1370 675, 1440 705 L 1440 900 L 0 900 Z" fill="url(#eqBottomWaveGrad)" />
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
      <main className="relative z-10 max-w-4xl w-full mx-auto px-4 sm:px-6 py-4 sm:py-5 flex-1 space-y-3.5">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <span className="cursor-pointer hover:text-slate-700 transition-colors" onClick={() => router.push('/admin/questions')}>Question Bank</span>
            <span>›</span>
            <span className="text-[#1760FF] font-bold">Edit Question</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#10234E] tracking-tight">Edit Question</h1>
          <p className="text-xs text-slate-500">Modify properties of this global repository assessment question.</p>
        </div>

        {isLoading ? (
          <Card className="border border-slate-200/80 rounded-xl shadow-2xs bg-white p-12 text-center text-slate-500">
            <div className="flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-[#1760FF]" />
              <p className="text-xs font-medium">Loading question details...</p>
            </div>
          </Card>
        ) : (
          <Card className="border border-slate-200/80 rounded-xl shadow-2xs overflow-hidden bg-white">
            <CardContent className="p-4 sm:p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Assessment Section</label>
                  <select
                    value={section}
                    onChange={(e) => {
                      const newSec = e.target.value;
                      setSection(newSec);
                      if (newSec === 'PERSONALITY') {
                        setType('open_text');
                      }
                    }}
                    className="w-full h-8.5 px-3 py-1 border border-slate-200 rounded-lg text-xs bg-slate-50/70 focus:bg-white text-slate-800 font-medium outline-none transition cursor-pointer"
                  >
                    {CATEGORY_ORDER.map((catId) => (
                      <option key={catId} value={catId}>
                        {CATEGORIES[catId].label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Question Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full h-8.5 px-3 py-1 border border-slate-200 rounded-lg text-xs bg-slate-50/70 focus:bg-white text-slate-800 font-medium outline-none transition cursor-pointer"
                  >
                    {section === 'PERSONALITY' ? (
                      <option value="open_text">Open Text</option>
                    ) : (
                      <>
                        <option value="mcq">Multiple Choice (MCQ)</option>
                        {section === 'ELIGIBILITY' && <option value="single_select">Single Select</option>}
                        <option value="open_text">Open Text</option>
                        <option value="multi_select">Multi Select</option>
                        <option value="coding">Coding Challenge</option>
                        <option value="ranking">Ranking</option>
                        <option value="structured_response">Structured Response</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-blue-50/60 border border-blue-100 text-[11px] text-blue-900 flex items-center gap-2">
                <span className="font-bold text-[10px] uppercase tracking-wider bg-blue-100 px-1.5 py-0.5 rounded text-blue-800">Notice</span>
                <span>Universal Repository Question: Stored globally and unassigned. Modifying will affect future test launches.</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {type === 'coding' ? 'Problem Statement (Supports Markdown & LaTeX)' : 'Question Prompt (Supports Markdown & LaTeX)'}
                </label>
                <LatexEditor 
                  value={questionText} 
                  onChange={setQuestionText} 
                  placeholder={type === 'coding' ? 'Write the coding problem statement here...' : 'Write your question here using Markdown or LaTeX ($...$)...'}
                  rows={5}
                />
              </div>

              {/* MCQ & SELECT OPTIONS SECTION */}
              {['mcq', 'single_select', 'multi_select'].includes(type) && (
                <div className="p-3.5 border border-slate-200/80 rounded-xl bg-slate-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 text-xs">
                      Options & Correct Answer Configuration
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
                          />
                        ) : (
                          <input 
                            type="radio" 
                            name="correct" 
                            checked={correctAnswer === String(i)}
                            onChange={() => setCorrectAnswer(String(i))}
                            className="h-4 w-4 text-[#1760FF] focus:ring-blue-500 border-slate-300 cursor-pointer shrink-0"
                          />
                        )}
                        <Input 
                          value={opt.text} 
                          onChange={(e) => updateOption(i, e.target.value)} 
                          placeholder={`Option ${i + 1}`}
                          className="bg-white border-slate-200 h-8.5 text-xs rounded-lg flex-1"
                        />
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={addOption} className="border-slate-200 text-slate-700 bg-white h-7 px-2.5 text-xs rounded-md shadow-2xs hover:bg-slate-50 cursor-pointer">
                      + Add Option
                    </Button>
                  </div>
                </div>
              )}

              {/* RANKING SECTION */}
              {type === 'ranking' && (
                <div className="p-3.5 border border-slate-200/80 rounded-xl bg-slate-50/50 space-y-3">
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
                        <Input 
                          value={opt.text} 
                          onChange={(e) => updateOption(i, e.target.value)} 
                          placeholder={`Option ${i + 1}`}
                          className="bg-white border-slate-200 h-8.5 text-xs rounded-lg flex-1"
                        />
                        {options.length > 2 && (
                          <button type="button" onClick={() => setOptions(options.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-rose-500 font-bold px-1.5 cursor-pointer">×</button>
                        )}
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={addOption} className="border-slate-200 text-slate-700 bg-white h-7 px-2.5 text-xs rounded-md shadow-2xs hover:bg-slate-50 cursor-pointer">
                      + Add Option
                    </Button>
                  </div>
                </div>
              )}

              {/* STRUCTURED RESPONSE SECTION */}
              {type === 'structured_response' && (
                <div className="p-3.5 border border-slate-200/80 rounded-xl bg-slate-50/50 space-y-3">
                  <h3 className="font-bold text-slate-800 text-xs">Response Fields</h3>
                  <div className="space-y-2.5">
                    {structuredFields.map((field, i) => (
                      <div key={i}>
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
                        <Button type="button" variant="outline" size="sm" onClick={() => setStructuredFields([...structuredFields, { id: structuredFields.length + 1, label: '' }])} className="border-slate-200 text-slate-700 bg-white hover:bg-slate-50 h-7 text-xs rounded-md shadow-2xs">
                          + Add Field
                        </Button>
                      )}
                      {structuredFields.length > 2 && (
                        <Button type="button" variant="outline" size="sm" onClick={() => setStructuredFields(structuredFields.slice(0, -1))} className="border-slate-200 text-slate-700 bg-white hover:bg-rose-50 hover:text-rose-600 h-7 text-xs rounded-md shadow-2xs">
                          - Remove Last Field
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* OPEN TEXT SETTINGS SECTION */}
              {type === 'open_text' && (
                <div className="p-3.5 border border-slate-200/80 rounded-xl bg-slate-50/50 space-y-3">
                  <h3 className="font-bold text-slate-800 text-xs">Descriptive Settings</h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Assessment Dimension</label>
                      <select
                        value={assessmentDimension}
                        onChange={(e) => setAssessmentDimension(e.target.value)}
                        className="w-full h-8.5 px-3 py-1 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 outline-none cursor-pointer"
                      >
                        <option value="ATTITUDE">Ownership & Initiative</option>
                        <option value="LEARNING">Learning Agility</option>
                        <option value="PROBLEM_SOLVING">Problem Solving & System Design</option>
                        <option value="EXECUTION">Delivery & Dependability</option>
                        <option value="COMMUNICATION">Written Communication & Collaboration</option>
                        <option value="INTEGRITY">Ethics & Judgment</option>
                        <option value="AI_LITERACY">AI Literacy & Responsible Use</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Weight</label>
                      <Input 
                        type="number" min="1" max="100"
                        value={weight} onChange={(e) => setWeight(Number(e.target.value))}
                        className="bg-white border-slate-200 h-8.5 text-xs rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Expected Duration (mins)</label>
                      <Input 
                        type="number" min="1" max="120"
                        value={expectedDuration} onChange={(e) => setExpectedDuration(Number(e.target.value))}
                        className="bg-white border-slate-200 h-8.5 text-xs rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Expected Answer Length (words)</label>
                      <Input 
                        type="number" min="10" max="2000"
                        value={expectedAnswerLength} onChange={(e) => setExpectedAnswerLength(Number(e.target.value))}
                        className="bg-white border-slate-200 h-8.5 text-xs rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Display Order</label>
                      <Input 
                        type="number" min="0" max="100"
                        value={displayOrder} onChange={(e) => setDisplayOrder(Number(e.target.value))}
                        className="bg-white border-slate-200 h-8.5 text-xs rounded-lg"
                      />
                    </div>
                    <div className="flex items-center pt-5">
                      <input 
                        type="checkbox" 
                        id="isRequired"
                        checked={isRequired}
                        onChange={(e) => setIsRequired(e.target.checked)}
                        className="h-3.5 w-3.5 text-[#1760FF] focus:ring-blue-500 border-slate-300 rounded mr-2 cursor-pointer"
                      />
                      <label htmlFor="isRequired" className="text-xs font-semibold text-slate-700 cursor-pointer">Required Question</label>
                    </div>
                  </div>
                </div>
              )}

              {/* Word Limits Section */}
              {['open_text', 'structured_response'].includes(type) && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <h3 className="font-bold text-slate-800 text-xs">Word Limits</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Minimum Words (Optional)</label>
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
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Maximum Words (Optional)</label>
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

              {/* Marks Section */}
              {!['ELIGIBILITY', 'PERSONALITY'].includes(section) && (
                <div className="pt-2 border-t border-slate-100">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Marks</label>
                  <Input 
                    type="number" 
                    min="0"
                    max="100"
                    value={points} 
                    onChange={(e) => setPoints(parseInt(e.target.value) || 0)} 
                    className="w-32 bg-slate-50/70 border-slate-200 h-8.5 text-xs font-bold rounded-lg"
                  />
                </div>
              )}

              <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                <Button 
                  onClick={() => handleSave('published')} 
                  className="bg-[#1760FF] hover:bg-blue-700 text-white font-semibold h-8.5 px-4 rounded-lg shadow-2xs text-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Update Question</span>
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => router.push('/admin/questions')}
                  className="h-8.5 px-3.5 rounded-lg text-xs font-semibold border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
