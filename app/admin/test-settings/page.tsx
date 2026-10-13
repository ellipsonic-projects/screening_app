'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ArrowLeft, Database, Settings, Clock, FileText, Info, Save, AlertTriangle, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function TestSettingsPage() {
  const [duration, setDuration] = useState(60);
  const [questions, setQuestions] = useState(30);
  const [availableQuestions, setAvailableQuestions] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const token = localStorage.getItem('token');
      
      try {
        const configRes = await axios.get('/api/admin/test-settings', { headers: { Authorization: `Bearer ${token}` } });
        if (configRes.data.config) {
          setDuration(configRes.data.config.total_duration);
          setQuestions(configRes.data.config.total_questions);
        }
      } catch (err) {
        console.error('Failed to load config', err);
      }

      try {
        const statsRes = await axios.get('/api/questions/stats', { headers: { Authorization: `Bearer ${token}` } });
        if (statsRes.data) {
          setAvailableQuestions(statsRes.data.total || 0);
        }
      } catch (err) {
        console.error('Failed to load stats', err);
      }
    } catch (err) {
      console.error('Failed to load config', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (questions > availableQuestions) {
      setMessage('Cannot save: Requested questions exceed available questions in the bank.');
      return;
    }
    setIsSaving(true);
    setMessage('');
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        '/api/admin/test-settings', 
        { total_duration: duration, total_questions: questions },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage('Test Settings saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F0F6FD] flex justify-center items-center font-sans">
        <div className="flex items-center gap-3 text-[#10234E] font-medium text-sm">
          <div className="w-5 h-5 border-2 border-[#1760FF] border-t-transparent rounded-full animate-spin" />
          <span>Loading Test Settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0F6FD] relative overflow-x-hidden text-[#10234E] font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Decorative Background Curves & Soft Waves Matching Mockup */}
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
            <linearGradient id="settingsTopRightGrad" x1="1440" y1="0" x2="900" y2="400" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#BCDDFC" stopOpacity="0.75" />
              <stop offset="50%" stopColor="#D4E9FE" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#F0F6FD" stopOpacity="0" />
            </linearGradient>

            <linearGradient id="settingsBottomLeftGrad" x1="0" y1="900" x2="600" y2="500" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#A8D4FC" stopOpacity="0.65" />
              <stop offset="55%" stopColor="#CCE3FD" stopOpacity="0.38" />
              <stop offset="100%" stopColor="#F0F6FD" stopOpacity="0" />
            </linearGradient>

            <linearGradient id="settingsBottomWaveGrad" x1="0" y1="850" x2="1440" y2="750" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#BDDCFC" stopOpacity="0.5" />
              <stop offset="50%" stopColor="#D0E6FD" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#E4F1FE" stopOpacity="0.2" />
            </linearGradient>
          </defs>

          {/* Top-Right Soft Swoop Arc */}
          <path
            d="M1440 0 L 980 0 C 980 160, 1120 320, 1440 370 Z"
            fill="url(#settingsTopRightGrad)"
          />

          {/* Bottom-Left Sweeping Arc */}
          <path
            d="M0 900 L 0 540 C 220 540, 440 680, 560 900 Z"
            fill="url(#settingsBottomLeftGrad)"
          />

          {/* Bottom Sweeping Wave */}
          <path
            d="M0 760 C 350 780, 720 730, 1080 670 C 1240 645, 1370 675, 1440 705 L 1440 900 L 0 900 Z"
            fill="url(#settingsBottomWaveGrad)"
          />
        </svg>
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Top Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 mb-8 sm:mb-10">
          {/* Left Column: Back button + Title + Subtitle */}
          <div className="space-y-3">
            <div>
              <Link
                href="/admin/dashboard"
                className="inline-flex items-center gap-2 bg-[#E2ECF8]/80 hover:bg-[#D4E4F8] text-[#10234E] font-semibold text-[13px] px-4 py-1.5 rounded-full transition-all shadow-[0_1px_2px_rgba(16,35,78,0.04)] group"
              >
                <ArrowLeft className="w-4 h-4 text-[#10234E] group-hover:-translate-x-0.5 transition-transform stroke-[2.5]" />
                <span>Back</span>
              </Link>
            </div>

            <div>
              <h1 className="text-[28px] sm:text-[34px] font-bold text-[#10234E] tracking-tight leading-tight">
                Master Test Settings
              </h1>
              <p className="text-[14px] sm:text-[15px] text-[#607797] font-normal mt-1">
                Configure the global aptitude test duration and limits.
              </p>
            </div>
          </div>

          {/* Right Column: Available Questions Card */}
          <div className="bg-white rounded-[22px] border border-[#E2ECF8] p-5 sm:p-6 shadow-[0_8px_30px_rgba(16,35,78,0.04)] flex items-center gap-4.5 min-w-[280px] sm:min-w-[320px] relative overflow-hidden self-start">
            {/* Subtle internal corner glow accent */}
            <div 
              className="absolute -right-5 -bottom-5 w-28 h-28 rounded-full bg-gradient-to-tl from-[#EBF4FE] to-transparent pointer-events-none opacity-80"
            />

            <div className="w-14 h-14 rounded-2xl bg-[#EAF2FE] text-[#1760FF] flex items-center justify-center shrink-0 shadow-[0_2px_8px_rgba(23,96,255,0.08)]">
              <Database className="w-7 h-7 stroke-[2.2]" />
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#607797] mb-1">
                AVAILABLE QUESTIONS
              </p>
              <p className="text-[32px] sm:text-[36px] font-bold text-[#10234E] leading-none mb-1">
                {availableQuestions}
              </p>
              <p className="text-[12px] text-[#8396AE] font-normal leading-tight">
                Questions in the question bank
              </p>
            </div>
          </div>
        </div>

        {/* Main Test Configuration Card */}
        <div className="bg-white rounded-[24px] border border-[#E2ECF8] shadow-[0_12px_40px_rgba(16,35,78,0.05)] overflow-hidden">
          {/* Card Header */}
          <div className="p-6 sm:p-8 flex items-center gap-4.5 sm:gap-5 border-b border-[#EEF3FA]">
            <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-[#EAF2FE] text-[#1760FF] flex items-center justify-center shrink-0 shadow-[0_2px_8px_rgba(23,96,255,0.08)]">
              <Settings className="w-7 h-7 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-[20px] sm:text-[22px] font-bold text-[#10234E] tracking-tight">
                Test Configuration
              </h2>
              <p className="text-[13px] sm:text-[14px] text-[#607797] mt-1 font-normal leading-relaxed">
                These settings apply to every student who logs in and takes the assessment.
              </p>
            </div>
          </div>

          {/* Card Content & Form */}
          <form onSubmit={handleSave} className="p-6 sm:p-9 space-y-6 sm:space-y-8">
            {/* Action Feedback Message */}
            {message && (
              <div 
                className={`p-4 rounded-xl text-xs sm:text-[13px] font-medium flex items-center gap-2.5 transition-all ${
                  message.includes('success') 
                    ? 'bg-emerald-50 border border-emerald-200/80 text-emerald-800' 
                    : 'bg-rose-50 border border-rose-200/80 text-rose-800'
                }`}
              >
                {message.includes('success') ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{message}</span>
              </div>
            )}

            {/* Configuration Area: 2 Columns with Vertical Divider on Desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 relative">
              {/* Subtle Vertical Divider Line on Desktop */}
              <div className="hidden md:block absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[1px] bg-[#EEF3FA]" />

              {/* Left Column: Total Test Duration */}
              <div className="space-y-4">
                {/* Column Header */}
                <div className="flex items-center gap-3.5 mb-4">
                  <div className="w-10 h-10 rounded-full bg-[#EAF2FE] text-[#1760FF] flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <h3 className="text-[11px] sm:text-[12px] font-bold uppercase tracking-wider text-[#10234E] leading-tight">
                      TOTAL TEST DURATION
                    </h3>
                    <p className="text-[12px] sm:text-[13px] text-[#607797] leading-tight mt-0.5">
                      Duration of the aptitude test for each student.
                    </p>
                  </div>
                </div>

                {/* Input with Visually Integrated 'minutes' Suffix */}
                <div className="flex items-center h-[52px] rounded-xl border border-[#DCE5F0] bg-white overflow-hidden focus-within:border-[#1760FF] focus-within:ring-4 focus-within:ring-[#1760FF]/10 transition-all shadow-[0_1px_3px_rgba(16,35,78,0.02)]">
                  <input
                    type="number"
                    min="1"
                    required
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="flex-1 h-full px-4 text-[17px] font-semibold text-[#10234E] outline-none bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="px-5 h-full bg-[#F4F7FC]/70 border-l border-[#DCE5F0] text-[#607797] text-[14px] font-medium flex items-center select-none">
                    minutes
                  </span>
                </div>

                {/* Helper text with info icon */}
                <div className="flex items-center gap-2 pt-1 text-[12px] sm:text-[13px] text-[#607797]">
                  <Info className="w-4 h-4 text-[#8396AE] shrink-0 stroke-[2]" />
                  <span>The countdown timer starts as soon as the test begins.</span>
                </div>
              </div>

              {/* Right Column: Total Number of Questions */}
              <div className="space-y-4">
                {/* Column Header */}
                <div className="flex items-center gap-3.5 mb-4">
                  <div className="w-10 h-10 rounded-full bg-[#EAF2FE] text-[#1760FF] flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <h3 className="text-[11px] sm:text-[12px] font-bold uppercase tracking-wider text-[#10234E] leading-tight">
                      TOTAL NUMBER OF QUESTIONS
                    </h3>
                    <p className="text-[12px] sm:text-[13px] text-[#607797] leading-tight mt-0.5">
                      Number of questions in each aptitude test.
                    </p>
                  </div>
                </div>

                {/* Input with Visually Integrated 'questions' Suffix */}
                <div className={`flex items-center h-[52px] rounded-xl border ${
                  questions > availableQuestions 
                    ? 'border-rose-400 focus-within:border-rose-500 focus-within:ring-4 focus-within:ring-rose-500/10' 
                    : 'border-[#DCE5F0] focus-within:border-[#1760FF] focus-within:ring-4 focus-within:ring-[#1760FF]/10'
                } bg-white overflow-hidden transition-all shadow-[0_1px_3px_rgba(16,35,78,0.02)]`}>
                  <input
                    type="number"
                    min="1"
                    required
                    value={questions}
                    onChange={(e) => setQuestions(Number(e.target.value))}
                    className="flex-1 h-full px-4 text-[17px] font-semibold text-[#10234E] outline-none bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="px-5 h-full bg-[#F4F7FC]/70 border-l border-[#DCE5F0] text-[#607797] text-[14px] font-medium flex items-center select-none">
                    questions
                  </span>
                </div>

                {/* Selection Count Indicator with document icon */}
                <div className="flex items-center gap-2 pt-1 text-[12px] sm:text-[13px]">
                  <FileText className="w-4 h-4 text-[#1760FF] shrink-0 stroke-[2]" />
                  <span>
                    <strong className="font-bold text-[#1760FF]">{questions} / {availableQuestions}</strong>{' '}
                    <span className="text-[#607797]">questions selected</span>
                  </span>
                </div>

                {/* Warning message if questions exceed bank */}
                {questions > availableQuestions && (
                  <div className="flex items-start gap-2 text-xs font-medium text-rose-700 bg-rose-50 p-3 rounded-xl border border-rose-200">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>Not enough questions in the Question Bank. Please reduce the number or add more questions.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Section with Divider and Save Button */}
            <div className="pt-6 sm:pt-8 border-t border-[#EEF3FA] flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="h-[46px] sm:h-[48px] px-7 bg-[#1760FF] hover:bg-[#1250DF] active:scale-[0.99] text-white font-semibold text-[14px] sm:text-[15px] rounded-xl shadow-[0_4px_14px_rgba(23,96,255,0.3)] hover:shadow-[0_6px_20px_rgba(23,96,255,0.35)] transition-all flex items-center gap-2.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4 stroke-[2.2]" />
                <span>{isSaving ? 'Saving Settings...' : 'Save Settings'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
