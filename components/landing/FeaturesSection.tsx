'use client';

import React from 'react';
import { BookOpen, ShieldCheck, BarChart3, Users } from 'lucide-react';

export function FeaturesSection() {
  const features = [
    {
      icon: BookOpen,
      title: 'Comprehensive Question Repository',
      description:
        'Create, manage, and organize aptitude and coding questions effortlessly.',
    },
    {
      icon: ShieldCheck,
      title: 'Secure Proctoring',
      description:
        'Tab-switch detection, media permissions, and real-time monitoring ensure fair assessments.',
    },
    {
      icon: BarChart3,
      title: 'Detailed Analytics',
      description:
        'Branch-wise performance, score distribution, and leaderboards provide meaningful insights.',
    },
    {
      icon: Users,
      title: 'Simple for Candidates',
      description:
        'Take tests, track progress, and access history — all in a clean and intuitive interface.',
    },
  ];

  return (
    <section id="features" className="w-full bg-[#f4f8fc] py-16 sm:py-24 border-b border-slate-100">
      <div className="max-w-[1320px] mx-auto px-6">
        {/* Section Header */}
        <div className="space-y-3 max-w-2xl text-left">
          <div className="inline-block">
            <span className="text-[11px] font-bold tracking-[0.2em] text-slate-500 bg-white/90 border border-slate-200/70 px-3.5 py-1.5 rounded-full uppercase font-sans-ui shadow-2xs">
              KEY FEATURES
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-[42px] font-serif leading-tight tracking-tight text-slate-900 font-editorial">
            Everything you need for{' '}
            <span className="text-blue-600 font-editorial">fair and efficient hiring.</span>
          </h2>
        </div>

        {/* 4 Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-12 sm:mt-14">
          {features.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div
                key={idx}
                className="bg-white rounded-xl p-6 border border-slate-200/70 shadow-xs hover:shadow-md hover:border-slate-300 transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  {/* Blue Rounded Square Icon Badge */}
                  <div className="w-11 h-11 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-5 shrink-0 border border-blue-100/50">
                    <Icon className="w-5 h-5 stroke-[1.8]" />
                  </div>

                  <h3 className="font-editorial text-lg sm:text-[19px] font-bold text-slate-900 leading-snug mb-2.5">
                    {feat.title}
                  </h3>

                  <p className="text-xs sm:text-[13px] text-slate-600 font-sans-ui leading-relaxed">
                    {feat.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
