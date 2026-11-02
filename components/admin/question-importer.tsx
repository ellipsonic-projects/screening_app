'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { QuestionSchema } from '@/lib/validators';
import { mapQuestionPayload } from '@/lib/questionMapper';
import { z } from 'zod';
import * as ExcelJS from 'exceljs';
import { 
  Download, 
  FileSpreadsheet, 
  FileCode2, 
  FileText, 
  LayoutTemplate, 
  ArrowLeft, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2,
  Upload
} from 'lucide-react';
import { BrandLogo } from '@/components/common/BrandLogo';

import { canonicalizeCategory, SUPPORTED_IMPORT_SECTIONS, SUPPORTED_DISPLAY_LABELS } from '@/lib/categories';

const SUPPORTED_SECTIONS = SUPPORTED_IMPORT_SECTIONS;

export function QuestionImporter() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<{row: number, field: string, reason: string}[]>([]);
  const [skippedRows, setSkippedRows] = useState<{row: number, reason: string}[]>([]);
  const [isValidated, setIsValidated] = useState(false);
  const [importResults, setImportResults] = useState<{ imported: number, failed: number } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setValidationErrors([]);
      setSkippedRows([]);
      setIsValidated(false);
      setParsedRows([]);
      setImportResults(null);
    }
  };

  const mapRowToPayload = (row: any, rowIndex: number) => {
    return mapQuestionPayload(row, rowIndex);
  };

  const validateExcel = async () => {
    if (!file) return;
    setIsProcessing(true);
    setValidationErrors([]);
    setSkippedRows([]);
    setImportResults(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(worksheet) as any[];

      if (json.length === 0) {
        setValidationErrors([{ row: 0, field: 'File', reason: 'The file is empty or missing headers.' }]);
        setIsProcessing(false);
        return;
      }

      const errors: {row: number, field: string, reason: string}[] = [];
      const skipped: {row: number, reason: string}[] = [];
      const mappedRows = [];

      for (let i = 0; i < json.length; i++) {
        const row = json[i];
        const rowIndex = i + 2; // Excel row number (1-based + 1 for header)
        
        try {
          // Validate Section
          const rawSectionVal = row['Section'] || row['section'] || '';
          const canonical = canonicalizeCategory(rawSectionVal);
          
          if (!canonical) {
            skipped.push({
              row: rowIndex,
              reason: `Invalid Section: "${rawSectionVal || 'Empty'}". Supported categories: ${SUPPORTED_DISPLAY_LABELS.join(', ')}`
            });
            continue;
          }

          const payload = mapRowToPayload(row, rowIndex);

          const rowData: any = { ...payload };
          delete rowData._rowIndex;

          const validation = QuestionSchema.safeParse(rowData);
          if (!validation.success) {
            validation.error.issues.forEach(err => {
              errors.push({
                row: rowIndex,
                field: err.path.join('.'),
                reason: err.message
              });
            });
          }
          
          mappedRows.push(payload);
        } catch (e: any) {
          errors.push({ row: rowIndex, field: 'Parsing', reason: e.message || 'Failed to parse row' });
        }
      }

      setSkippedRows(skipped);

      if (errors.length > 0) {
        setValidationErrors(errors);
        setIsValidated(false);
      } else {
        setParsedRows(mappedRows);
        setIsValidated(true);
      }
    } catch (e: any) {
      setValidationErrors([{ row: 0, field: 'File', reason: 'Failed to read Excel file. Please ensure it is a valid .xlsx file.' }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const importQuestions = async () => {
    if (!isValidated || parsedRows.length === 0) return;
    setIsProcessing(true);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/questions/bulk', parsedRows, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const { imported, failed, errors } = response.data;
      setImportResults({ imported, failed: failed + skippedRows.length });
      
      if (errors && errors.length > 0) {
        setValidationErrors(errors);
      } else {
        setTimeout(() => {
          router.push('/admin/questions');
        }, 2500);
      }
    } catch (e: any) {
      if (e.response?.data?.errors) {
        setValidationErrors(e.response.data.errors);
      } else {
        setValidationErrors([{ row: 0, field: 'Network', reason: e.response?.data?.message || 'Server error during import' }]);
      }
    } finally {
      setIsProcessing(false);
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
    sheet.addRow({
      section: 'Quantitative & Logical Reasoning',
      question: 'What is 2+2?',
      optionA: '2',
      optionB: '3',
      optionC: '4',
      optionD: '5',
      correct: 'C',
      marks: '1'
    });
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
    sheet.addRow({ section: 'Coding & Debugging', question: 'Write a program to reverse a string', marks: '5' });
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
    // Sample non-Personality row — Question Code left blank
    sheet.addRow({ section: 'Written Communication & Collaboration', questionType: 'open_text', questionCode: '', question: 'Describe your leadership experience.', minWords: '100', maxWords: '300', marks: '5' });
    // Sample Personality row — Question Code required (P01–P33)
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
    sheet.addRow({ section: 'Delivery & Dependability', question: 'How would you complete this project in three days?', field1: 'Day 1', field2: 'Day 2', field3: 'Day 3', marks: '5' });
    sheet.addRow({ section: 'AI Literacy & Responsible Use', question: 'Design an AI chatbot.', field1: 'Problem', field2: 'Solution', field3: 'Outcome', marks: '5' });
    await triggerDownload(workbook, 'structured-template.xlsx');
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
            <linearGradient id="iqTopRightGrad" x1="1440" y1="0" x2="900" y2="400" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#BCDDFC" stopOpacity="0.75" />
              <stop offset="50%" stopColor="#D4E9FE" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#F0F6FD" stopOpacity="0" />
            </linearGradient>

            <linearGradient id="iqBottomLeftGrad" x1="0" y1="900" x2="600" y2="500" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#A8D4FC" stopOpacity="0.65" />
              <stop offset="55%" stopColor="#CCE3FD" stopOpacity="0.38" />
              <stop offset="100%" stopColor="#F0F6FD" stopOpacity="0" />
            </linearGradient>

            <linearGradient id="iqBottomWaveGrad" x1="0" y1="850" x2="1440" y2="750" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#BDDCFC" stopOpacity="0.5" />
              <stop offset="50%" stopColor="#D0E6FD" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#E4F1FE" stopOpacity="0.2" />
            </linearGradient>
          </defs>

          <path d="M1440 0 L 980 0 C 980 160, 1120 320, 1440 370 Z" fill="url(#iqTopRightGrad)" />
          <path d="M0 900 L 0 540 C 220 540, 440 680, 560 900 Z" fill="url(#iqBottomLeftGrad)" />
          <path d="M0 760 C 350 780, 720 730, 1080 670 C 1240 645, 1370 675, 1440 705 L 1440 900 L 0 900 Z" fill="url(#iqBottomWaveGrad)" />
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
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <span className="cursor-pointer hover:text-slate-700 transition-colors" onClick={() => router.push('/admin/questions')}>Question Bank</span>
            <span>›</span>
            <span className="text-[#1760FF] font-bold">Import Questions</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#10234E] tracking-tight">Import Questions</h1>
          <p className="text-xs text-slate-500">Download formatted templates or upload your populated Excel/CSV spreadsheet.</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200/80 shadow-2xs space-y-5">
          {/* 1. Download Excel Templates (Compact Cards) */}
          <div>
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
              1. Download Excel Templates
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {/* MCQ Template */}
              <div 
                onClick={generateMCQTemplate} 
                className="group p-3 rounded-xl border border-slate-200/80 bg-white hover:border-blue-400 hover:shadow-2xs cursor-pointer transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-xs">MCQ Template</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">For Quantitative & Logical Reasoning, Problem Solving & all MCQs.</p>
                </div>
                <div className="mt-2.5 flex items-center text-[11px] font-semibold text-[#1760FF]">
                  <Download className="w-3 h-3 mr-1" /> Download
                </div>
              </div>

              {/* Coding Template */}
              <div 
                onClick={generateCodingTemplate} 
                className="group p-3 rounded-xl border border-slate-200/80 bg-white hover:border-indigo-400 hover:shadow-2xs cursor-pointer transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                    <FileCode2 className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-xs">Coding Template</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">For Coding & Debugging challenges.</p>
                </div>
                <div className="mt-2.5 flex items-center text-[11px] font-semibold text-indigo-600">
                  <Download className="w-3 h-3 mr-1" /> Download
                </div>
              </div>

              {/* Open Text Template */}
              <div 
                onClick={generateOpenTextTemplate} 
                className="group p-3 rounded-xl border border-slate-200/80 bg-white hover:border-emerald-400 hover:shadow-2xs cursor-pointer transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                    <FileText className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-xs">Open Text Template</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">For Personality, AI Literacy & Responsible Use, Collaboration & Ownership.</p>
                </div>
                <div className="mt-2.5 flex items-center text-[11px] font-semibold text-emerald-600">
                  <Download className="w-3 h-3 mr-1" /> Download
                </div>
              </div>

              {/* Structured Response Template */}
              <div 
                onClick={generateStructuredTemplate} 
                className="group p-3 rounded-xl border border-slate-200/80 bg-white hover:border-amber-400 hover:shadow-2xs cursor-pointer transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                    <LayoutTemplate className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-xs">Structured Template</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">For Delivery & Dependability and multi-field questions.</p>
                </div>
                <div className="mt-2.5 flex items-center text-[11px] font-semibold text-amber-600">
                  <Download className="w-3 h-3 mr-1" /> Download
                </div>
              </div>
            </div>
          </div>

          {/* 2. Choose Excel File */}
          <div className="pt-2 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
              2. Choose File
            </h3>
            
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-5 text-center bg-slate-50/70 transition hover:border-blue-400 hover:bg-slate-100/60">
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="block w-full text-xs text-slate-600
                  file:mr-3 file:py-1.5 file:px-3
                  file:rounded-lg file:border-0
                  file:text-xs file:font-semibold
                  file:bg-[#1760FF] file:text-white
                  hover:file:bg-blue-700
                  cursor-pointer mx-auto max-w-sm"
              />
              {file ? (
                <p className="text-xs text-slate-800 mt-2 font-medium">Selected: <span className="text-[#1760FF] font-bold">{file.name}</span></p>
              ) : (
                <p className="text-[11px] text-slate-500 mt-1.5">Supported formats: .xlsx, .xls, .csv</p>
              )}
            </div>
          </div>

          {/* Import Results */}
          {importResults && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200/80 shadow-2xs">
                <h3 className="text-emerald-900 font-bold mb-1 text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Import Complete
                </h3>
                <p className="text-xs text-emerald-700">Successfully imported <span className="font-bold">{importResults.imported}</span> questions.</p>
                {importResults.failed > 0 && (
                  <p className="text-[11px] text-amber-700 mt-0.5 font-medium">Skipped {importResults.failed} rows (duplicates or invalid sections).</p>
                )}
              </div>
              {skippedRows.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 shadow-2xs">
                  <h3 className="text-amber-900 font-bold mb-1 text-xs flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" /> Skipped Rows ({skippedRows.length})
                  </h3>
                  <p className="text-[11px] text-amber-700 mb-2">Rows skipped due to unrecognised section headers:</p>
                  <div className="max-h-48 overflow-y-auto border border-amber-200 rounded-lg bg-white">
                    <table className="w-full text-xs text-left text-slate-600">
                      <thead className="bg-amber-100/60 text-amber-900 sticky top-0">
                        <tr>
                          <th className="px-3 py-1.5 w-16">Row</th>
                          <th className="px-3 py-1.5">Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {skippedRows.map((skip, idx) => (
                          <tr key={idx} className="border-b border-amber-100 last:border-0 bg-white">
                            <td className="px-3 py-1.5 font-mono text-slate-900 font-medium">{skip.row}</td>
                            <td className="px-3 py-1.5 whitespace-pre-line text-amber-800 text-[11px]">{skip.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="shadow-2xs rounded-xl overflow-hidden border border-rose-200">
              <div className="bg-rose-50 p-3 border-b border-rose-200">
                <h3 className="text-rose-900 font-bold text-xs flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600" /> Validation Errors ({validationErrors.length})
                </h3>
                <p className="text-[11px] text-rose-700 mt-0.5">Please fix these errors in your spreadsheet and re-validate.</p>
              </div>
              <div className="max-h-48 overflow-y-auto bg-white">
                <table className="w-full text-xs text-left text-slate-600">
                  <thead className="bg-slate-50 text-slate-700 sticky top-0 border-b border-slate-100">
                    <tr>
                      <th className="px-3 py-2 w-16 font-bold">Row</th>
                      <th className="px-3 py-2 w-36 font-bold">Field</th>
                      <th className="px-3 py-2 font-bold">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validationErrors.map((err, idx) => (
                      <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono text-slate-900 font-medium">{err.row}</td>
                        <td className="px-3 py-2 font-medium text-slate-700">{err.field}</td>
                        <td className="px-3 py-2 text-rose-600 text-[11px]">{err.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Success Validation Alert */}
          {isValidated && validationErrors.length === 0 && !importResults && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl shadow-2xs flex items-center text-xs font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mr-2 shrink-0" />
              <span>Validation passed! Ready to import {parsedRows.length} questions.</span>
              {skippedRows.length > 0 && (
                <span className="text-amber-700 ml-1.5 font-semibold">({skippedRows.length} rows skipped with invalid sections)</span>
              )}
            </div>
          )}

          {/* Action Bar */}
          <div className="flex justify-between items-center border-t border-slate-100 pt-3">
            <Button
              type="button"
              onClick={() => router.push('/admin/questions')}
              variant="outline"
              className="h-8.5 px-3.5 rounded-lg text-xs font-semibold text-slate-700 border-slate-200 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </Button>
            {!isValidated ? (
              <Button
                onClick={validateExcel}
                disabled={!file || isProcessing}
                className="bg-[#10234E] hover:bg-slate-800 text-white h-8.5 px-4 rounded-lg text-xs font-semibold shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Validating...
                  </>
                ) : 'Validate Excel'}
              </Button>
            ) : (
              <Button
                onClick={importQuestions}
                disabled={isProcessing || importResults !== null}
                className="bg-[#1760FF] hover:bg-blue-700 text-white h-8.5 px-4 rounded-lg text-xs font-semibold shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" /> Upload & Parse
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
