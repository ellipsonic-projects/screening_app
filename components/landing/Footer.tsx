'use client';

import React from 'react';
import Link from 'next/link';
import { BrandLogo } from '@/components/common/BrandLogo';

export function LandingFooter() {
  return (
    <footer className="w-full bg-slate-50/80 border-t border-slate-200/80 py-12 sm:py-16 text-slate-600 font-sans-ui">
      <div className="max-w-[1320px] mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 pb-10 border-b border-slate-200/70">
          {/* Left: Brand & Statement */}
          <div className="space-y-3 max-w-md text-left">
            <BrandLogo size="md" className="items-start" />
            <p className="text-xs text-slate-500 leading-relaxed font-sans-ui">
              A secure, scalable campus recruitment and assessment workspace for conducting aptitude
              and coding drives, proctoring students, and analyzing candidate scorecards.
            </p>
          </div>

          {/* Right: Quick Links */}
          <div className="flex flex-wrap gap-8 sm:gap-12 text-xs font-medium text-slate-600">
            <div className="flex flex-col space-y-2.5 text-left">
              <span className="text-[11px] font-bold tracking-wider text-slate-900 uppercase">
                Platform
              </span>
              <a href="#features" className="hover:text-blue-700 transition">
                Key Features
              </a>
              <a href="#candidates" className="hover:text-blue-700 transition">
                For Candidates
              </a>
              <a href="#organizers" className="hover:text-blue-700 transition">
                For Organizers
              </a>
              <a href="#pricing" className="hover:text-blue-700 transition">
                Pricing
              </a>
            </div>

            <div className="flex flex-col space-y-2.5 text-left">
              <span className="text-[11px] font-bold tracking-wider text-slate-900 uppercase">
                Access
              </span>
              <Link href="/auth/login" className="hover:text-blue-700 transition">
                Candidate Sign In
              </Link>
              <Link href="/auth/register" className="hover:text-blue-700 transition">
                Candidate Registration
              </Link>
              <Link href="/auth/login" className="hover:text-blue-700 transition">
                Organizer Console
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© 2027 EllipHire. All rights reserved.</p>
          <div className="flex items-center gap-6 text-xs text-slate-500">
            <span className="hover:text-slate-800 transition cursor-pointer">About</span>
            <span className="hover:text-slate-800 transition cursor-pointer">Privacy</span>
            <span className="hover:text-slate-800 transition cursor-pointer">Terms</span>
            <span className="hover:text-slate-800 transition cursor-pointer">Contact</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
