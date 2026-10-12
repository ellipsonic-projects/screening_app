'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function CandidateOrganizerSections() {
  return (
    <section className="w-full bg-white py-16 sm:py-24">
      <div className="max-w-[1320px] mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-14">
          {/* Candidate Card */}
          <div id="candidates" className="flex flex-col group">
            {/* Image Container */}
            <div className="relative w-full aspect-[16/10] sm:aspect-[4/3] rounded-2xl overflow-hidden shadow-xs border border-slate-200/60 bg-slate-100">
              <Image
                src="/images/candidate-student.jpg"
                alt="Student coding and studying in campus library"
                fill
                className="object-cover object-center group-hover:scale-[1.02] transition-transform duration-500 ease-out"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>

            {/* Content Block */}
            <div className="pt-6 space-y-2.5 text-left">
              <p className="text-[11px] font-bold tracking-[0.2em] text-slate-500 uppercase font-sans-ui">
                FOR CANDIDATES
              </p>
              <h3 className="text-2xl sm:text-3xl font-serif font-bold text-slate-900 leading-snug font-editorial">
                Showcase your skills. Build your future.
              </h3>
              <p className="text-xs sm:text-[13px] text-slate-600 font-sans-ui leading-relaxed max-w-lg">
                Take timed evaluations, choose preferred languages in coding tests, track your
                progress, and stay ready for upcoming drives.
              </p>
              <div className="pt-2">
                <Link
                  href="/auth/register"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 transition font-sans-ui"
                >
                  <span>Learn more</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>

          {/* Organizer Card */}
          <div id="organizers" className="flex flex-col group">
            {/* Image Container */}
            <div className="relative w-full aspect-[16/10] sm:aspect-[4/3] rounded-2xl overflow-hidden shadow-xs border border-slate-200/60 bg-slate-100">
              <Image
                src="/images/organizer-team.jpg"
                alt="Recruitment placement officers evaluating candidate results"
                fill
                className="object-cover object-center group-hover:scale-[1.02] transition-transform duration-500 ease-out"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>

            {/* Content Block */}
            <div className="pt-6 space-y-2.5 text-left">
              <p className="text-[11px] font-bold tracking-[0.2em] text-slate-500 uppercase font-sans-ui">
                FOR ORGANIZERS
              </p>
              <h3 className="text-2xl sm:text-3xl font-serif font-bold text-slate-900 leading-snug font-editorial">
                Assess. Analyze. Hire with confidence.
              </h3>
              <p className="text-xs sm:text-[13px] text-slate-600 font-sans-ui leading-relaxed max-w-lg">
                Manage drives, configure tests, track candidate performance, and make data-driven
                decisions — all in one place.
              </p>
              <div className="pt-2">
                <Link
                  href="/auth/login"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 transition font-sans-ui"
                >
                  <span>Learn more</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
