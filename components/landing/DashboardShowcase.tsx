'use client';

import React from 'react';
import Image from 'next/image';
import {
  LayoutDashboard,
  ClipboardList,
  BookOpen,
  Users,
  BarChart3,
  Settings,
  MoreVertical,
  Calendar,
  ChevronDown,
  ArrowRight,
  Trophy,
  CheckCircle2,
} from 'lucide-react';
import { BrandLogo } from '@/components/common/BrandLogo';

export function DashboardShowcase() {
  const candidates = [
    {
      name: 'Aarav Sharma',
      branch: 'CSE',
      score: '88%',
      status: 'Shortlisted',
      statusClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    },
    {
      name: 'Neha Kulkarni',
      branch: 'ISE',
      score: '76%',
      status: 'Qualified',
      statusClass: 'bg-blue-50 text-blue-700 border-blue-200/80',
    },
    {
      name: 'Rohan Mehta',
      branch: 'ECE',
      score: '62%',
      status: 'Qualified',
      statusClass: 'bg-blue-50 text-blue-700 border-blue-200/80',
    },
    {
      name: 'Priya Nair',
      branch: 'CSE',
      score: '48%',
      status: 'Not Qualified',
      statusClass: 'bg-rose-50 text-rose-700 border-rose-200/80',
    },
  ];

  return (
    <div className="relative w-full max-w-[700px] mx-auto select-none">
      {/* Workspace Environmental Backdrop */}
      <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-slate-200/60 bg-gradient-to-tr from-slate-100 via-white to-slate-50">
        {/* Background Image layer with subtle soft blur */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/hero-workspace-backdrop.jpg"
            alt="Office workspace with daylight, window greenery and books"
            fill
            priority
            className="object-cover object-right opacity-90"
          />
          {/* Subtle gradient vignette to blend the scene with the page */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/10" />
        </div>

        {/* Laptop Frame Container with realistic perspective tilt */}
        <div className="relative z-10 p-3 sm:p-5 lg:p-6 flex items-center justify-center">
          <div className="w-full max-w-[590px] transition-transform duration-300 hover:scale-[1.01]">
            {/* Laptop Display (Top Lid) */}
            <div className="bg-[#1e2024] rounded-t-xl sm:rounded-t-2xl p-2 sm:p-2.5 pb-2 shadow-2xl border border-slate-700/60">
              {/* Webcam & Sensor Header Notch */}
              <div className="flex items-center justify-center pb-1.5 pt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-900 ring-1 ring-slate-700/80" />
              </div>

              {/* Laptop Screen Content (Actual Organizer Dashboard) */}
              <div className="bg-slate-50 rounded-lg overflow-hidden border border-slate-200/80 shadow-inner flex flex-col font-sans-ui text-slate-800 text-[10px] sm:text-[11px] leading-tight">
                {/* Top Nav inside dashboard */}
                <div className="h-8 bg-white border-b border-slate-200 px-3 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <BrandLogo size="sm" className="scale-75 origin-left" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                      Live Assessment
                    </span>
                  </div>
                </div>

                {/* Dashboard Body (Sidebar + Content) */}
                <div className="flex min-h-[300px] sm:min-h-[340px]">
                  {/* Sidebar */}
                  <div className="w-24 sm:w-28 bg-white border-r border-slate-200 p-2 flex flex-col justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-blue-50 text-blue-700 font-semibold text-[10px]">
                        <LayoutDashboard className="w-3.5 h-3.5" />
                        <span>Dashboard</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-slate-600 hover:bg-slate-50 text-[10px]">
                        <ClipboardList className="w-3.5 h-3.5" />
                        <span>Tests</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-slate-600 hover:bg-slate-50 text-[10px]">
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Question Bank</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-slate-600 hover:bg-slate-50 text-[10px]">
                        <Users className="w-3.5 h-3.5" />
                        <span>Candidates</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-slate-600 hover:bg-slate-50 text-[10px]">
                        <BarChart3 className="w-3.5 h-3.5" />
                        <span>Reports</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-slate-600 hover:bg-slate-50 text-[10px]">
                        <Settings className="w-3.5 h-3.5" />
                        <span>Settings</span>
                      </div>
                    </div>
                  </div>

                  {/* Main Dashboard Panel */}
                  <div className="flex-1 p-2.5 sm:p-3 space-y-2.5 bg-slate-50/60 overflow-hidden">
                    {/* Header Strip with Title & Filters */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-1">
                      <div>
                        <h4 className="font-bold text-slate-900 text-[11px] sm:text-xs">
                          Placement Drive 2027
                        </h4>
                        <p className="text-[9px] text-slate-500">
                          Manage assessments and track candidate performance
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[9px] text-slate-700 font-medium">
                          <span>Computer Science</span>
                          <ChevronDown className="w-2.5 h-2.5 text-slate-400" />
                        </div>
                        <div className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[9px] text-slate-700 font-medium">
                          <Calendar className="w-2.5 h-2.5 text-slate-400" />
                          <span>Jan 2027 - Apr 2027</span>
                        </div>
                      </div>
                    </div>

                    {/* 4 Stat Metric Cards */}
                    <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                      <div className="bg-white p-1.5 sm:p-2 rounded-md border border-slate-200/80 shadow-xs flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                          <Users className="w-3.5 h-3.5" />
                        </div>
                        <div className="truncate">
                          <p className="text-[8px] text-slate-500 truncate">Registered</p>
                          <p className="font-extrabold text-slate-900 text-[11px] sm:text-xs">532</p>
                        </div>
                      </div>

                      <div className="bg-white p-1.5 sm:p-2 rounded-md border border-slate-200/80 shadow-xs flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </div>
                        <div className="truncate">
                          <p className="text-[8px] text-slate-500 truncate">Completed</p>
                          <p className="font-extrabold text-slate-900 text-[11px] sm:text-xs">468</p>
                        </div>
                      </div>

                      <div className="bg-white p-1.5 sm:p-2 rounded-md border border-slate-200/80 shadow-xs flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                          <BarChart3 className="w-3.5 h-3.5" />
                        </div>
                        <div className="truncate">
                          <p className="text-[8px] text-slate-500 truncate">Avg Score</p>
                          <p className="font-extrabold text-slate-900 text-[11px] sm:text-xs">72%</p>
                        </div>
                      </div>

                      <div className="bg-white p-1.5 sm:p-2 rounded-md border border-slate-200/80 shadow-xs flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                          <Trophy className="w-3.5 h-3.5" />
                        </div>
                        <div className="truncate">
                          <p className="text-[8px] text-slate-500 truncate">Shortlisted</p>
                          <p className="font-extrabold text-slate-900 text-[11px] sm:text-xs">124</p>
                        </div>
                      </div>
                    </div>

                    {/* Recent Candidates Table */}
                    <div className="bg-white rounded-md border border-slate-200/80 shadow-xs overflow-hidden">
                      <div className="px-2.5 py-1.5 border-b border-slate-100 flex items-center justify-between">
                        <span className="font-bold text-[10px] text-slate-800">Recent Candidates</span>
                        <span className="text-[9px] font-semibold text-blue-600 flex items-center gap-0.5 hover:underline cursor-pointer">
                          View All <ArrowRight className="w-2.5 h-2.5" />
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-[9px]">
                          <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100">
                            <tr>
                              <th className="py-1 px-2 w-4">
                                <input type="checkbox" className="w-2.5 h-2.5 rounded text-blue-600 pointer-events-none" />
                              </th>
                              <th className="py-1 px-1.5">Name</th>
                              <th className="py-1 px-1.5">Branch</th>
                              <th className="py-1 px-1.5">Score</th>
                              <th className="py-1 px-1.5">Status</th>
                              <th className="py-1 px-1.5 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            {candidates.map((cand, i) => (
                              <tr key={i} className="hover:bg-slate-50/60">
                                <td className="py-1 px-2">
                                  <input type="checkbox" className="w-2.5 h-2.5 rounded text-blue-600 pointer-events-none" />
                                </td>
                                <td className="py-1 px-1.5 font-semibold text-slate-900">{cand.name}</td>
                                <td className="py-1 px-1.5 text-slate-600">{cand.branch}</td>
                                <td className="py-1 px-1.5 font-bold text-slate-900">{cand.score}</td>
                                <td className="py-1 px-1.5">
                                  <span
                                    className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-semibold border ${cand.statusClass}`}
                                  >
                                    {cand.status}
                                  </span>
                                </td>
                                <td className="py-1 px-1.5 text-right text-slate-400">
                                  <MoreVertical className="w-3 h-3 inline" />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Laptop Base / Deck Bottom Chassis */}
            <div className="relative">
              {/* Aluminum keyboard base edge with bevel */}
              <div className="h-3 sm:h-3.5 bg-gradient-to-b from-[#d1d5db] to-[#9ca3af] rounded-b-xl shadow-lg flex items-center justify-center">
                {/* Trackpad notch indentation */}
                <div className="w-16 sm:w-20 h-1 bg-[#4b5563]/30 rounded-b-md" />
              </div>
              {/* Metallic bottom shadow */}
              <div className="h-1 bg-black/40 blur-xs mx-4 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
