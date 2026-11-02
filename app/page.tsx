'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { ArrowRight, Check } from 'lucide-react';
import { LandingHeader } from '@/components/landing/Header';
import { DashboardShowcase } from '@/components/landing/DashboardShowcase';
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { CandidateOrganizerSections } from '@/components/landing/CandidateOrganizerSections';
import { LandingFooter } from '@/components/landing/Footer';

export default function HomePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      if (user.role === 'admin' || user.role === 'super_admin') {
        window.location.href = '/admin/dashboard';
      } else {
        window.location.href = '/student/dashboard';
      }
    }
  }, [user, isLoading]);

  if (user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <div className="w-8 h-8 border-4 border-blue-900 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-medium font-sans-ui">Redirecting to your dashboard...</p>
      </div>
    );
  }

  const benefits = [
    'Aptitude & Coding',
    'Secure Proctoring',
    'Real-time Analytics',
    'Built for Scale',
  ];

  return (
    <div className="min-h-screen bg-[#fafbfc] flex flex-col text-slate-900 font-sans-ui selection:bg-blue-100 selection:text-blue-900">
      {/* 1. Header */}
      <LandingHeader />

      <main className="flex-1">
        {/* 2. Hero Section */}
        <section id="why-elliphire" className="relative w-full pt-8 pb-14 sm:pt-14 sm:pb-20 overflow-hidden">
          <div className="max-w-[1320px] mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
              {/* Left Column: Editorial Content */}
              <div className="lg:col-span-5 space-y-6 text-left">
                {/* Editorial Headline */}
                <h1 className="text-5xl sm:text-6xl lg:text-[64px] font-serif font-bold text-slate-950 leading-[1.08] tracking-tight font-editorial">
                  From assessments <br className="hidden sm:inline" />
                  to <span className="text-blue-600 font-editorial">opportunities.</span>
                </h1>

                {/* Supporting Text */}
                <p className="text-base sm:text-[17px] text-slate-600 leading-relaxed font-sans-ui max-w-lg">
                  A secure, scalable, and comprehensive platform for conducting aptitude and coding
                  assessments, tracking candidate performance, and simplifying the campus hiring
                  process.
                </p>

                {/* Primary & Secondary CTAs */}
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <Link
                    href="/auth/register"
                    className="inline-flex items-center gap-2 bg-[#0d2352] hover:bg-[#0a1a3d] text-white font-semibold text-sm sm:text-[15px] px-7 py-3.5 rounded-lg shadow-sm hover:shadow transition-all font-sans-ui"
                  >
                    <span>Get Started Now</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <a
                    href="#features"
                    className="inline-flex items-center justify-center bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm sm:text-[15px] px-7 py-3.5 rounded-lg border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all font-sans-ui"
                  >
                    Learn More
                  </a>
                </div>

                {/* Benefits Checklist */}
                <div className="pt-3">
                  <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-x-5 gap-y-2.5">
                    {benefits.map((benefit) => (
                      <div
                        key={benefit}
                        className="inline-flex items-center gap-1.5 text-xs sm:text-[13px] font-medium text-slate-700"
                      >
                        <span className="w-4 h-4 rounded-full bg-slate-200/70 text-slate-700 flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                        </span>
                        <span>{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Realistic Product Showcase */}
              <div className="lg:col-span-7 w-full flex items-center justify-center lg:justify-end">
                <DashboardShowcase />
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <FeaturesSection />

        {/* 5. For Candidates & For Organizers Split Editorial Sections */}
        <CandidateOrganizerSections />

        {/* 6. Pricing Section Anchor / Overview */}
        <section id="pricing" className="w-full bg-[#f8fafc] py-14 border-t border-slate-100 text-center">
          <div className="max-w-3xl mx-auto px-6 space-y-3">
            <span className="text-[11px] font-bold tracking-[0.2em] text-slate-500 uppercase font-sans-ui">
              TRANSPARENT PRICING
            </span>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-slate-900 font-editorial">
              Dedicated to university campus hiring.
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-sans-ui max-w-xl mx-auto">
              EllipHire is complimentary for eligible educational institutions participating in the
              2027 Placement Drive cycles. Need dedicated custom instances or private test vaults?
            </p>
            <div className="pt-2">
              <Link
                href="/auth/register"
                className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 font-sans-ui"
              >
                <span>Register for campus placement drive</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* 7. Footer */}
      <LandingFooter />
    </div>
  );
}
