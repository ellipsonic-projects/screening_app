import Link from 'next/link';
import { BadgeCheck, FileCheck, Clock, ArrowRight, Info } from 'lucide-react';
import { BrandLogo } from '@/components/common/BrandLogo';
import { DecorativeBackground } from '@/components/common/DecorativeBackground';

export const metadata = {
  title: 'Assessment Submitted - EllipHire Aptitude Screening',
  description: 'Assessment completion success page',
};

function getFormattedSubmissionDate(): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return `${dateStr} at ${timeStr}`;
}

export default function SuccessPage() {
  const formattedDate = getFormattedSubmissionDate();

  return (
    <div className="min-h-screen bg-[#F3F7FD] relative overflow-x-hidden text-[#10234E] font-sans selection:bg-blue-100 selection:text-blue-900 flex flex-col items-center justify-center p-4 sm:p-6">
      {/* Decorative Background Curves matching Admin/Student portal design */}
      <DecorativeBackground />

      {/* Top Header / Branding Lockup */}
      <header className="w-full max-w-6xl mx-auto pt-6 px-4 sm:px-6 flex items-center justify-between absolute top-0 left-0 right-0 z-10 pointer-events-auto">
        <div className="flex items-center gap-3">
          <Link href="/auth/login" className="flex items-center gap-2 hover:opacity-95 transition-opacity">
            <BrandLogo size="md" className="flex-row items-center" />
          </Link>
          <span className="text-slate-300 font-light select-none">|</span>
          <span className="px-3 py-0.5 rounded-full bg-[#EEF5FF] text-[#1760FF] text-[11px] font-bold tracking-wider uppercase border border-[#BFDBFE]/60">
            CANDIDATE PORTAL
          </span>
        </div>
      </header>

      {/* Main Focus Container / Centered Success Card */}
      <main className="relative z-10 w-full max-w-[560px] my-auto py-16 sm:py-20">
        <div className="bg-white rounded-2xl sm:rounded-[28px] border border-[#DCE5F0] shadow-[0_10px_40px_rgba(16,35,78,0.05)] overflow-hidden flex flex-col">
          {/* Header Section */}
          <div className="p-8 sm:p-10 pb-6 sm:pb-7 text-center space-y-4">
            {/* Green Success Badge with Subtle Decorative Accent Dots */}
            <div className="relative inline-flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-[#E8F8F0] border border-[#A7F3D0]/60 flex items-center justify-center shadow-sm">
                <BadgeCheck className="w-10 h-10 text-[#10B981] stroke-[2.2]" />
              </div>
              {/* Subtle celebratory accent dots */}
              <span className="absolute -top-1 -left-2 w-1.5 h-1.5 rounded-full bg-[#10B981]/40" />
              <span className="absolute top-2 -right-3 w-2 h-2 rounded-full bg-[#10B981]/30" />
              <span className="absolute -bottom-1 -left-3 w-2 h-2 rounded-full bg-[#10B981]/30" />
              <span className="absolute -bottom-2 right-1 w-1.5 h-1.5 rounded-full bg-[#10B981]/40" />
            </div>

            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-[28px] font-bold text-[#10234E] tracking-tight">
                Assessment Submitted
              </h1>
              <p className="text-sm sm:text-base text-[#607797] font-normal leading-relaxed">
                Your responses have been recorded successfully.
              </p>
            </div>
          </div>

          {/* Submission Details Section on Soft Pale-Blue Background */}
          <div className="px-6 sm:px-8 py-5 sm:py-6 bg-[#F6F9FD] border-y border-[#DCE5F0]/60 space-y-3.5 flex-1">
            {/* SUBMISSION STATUS Card */}
            <div className="bg-white p-4 sm:p-4.5 rounded-2xl border border-[#DCE5F0] shadow-[0_2px_8px_rgba(16,35,78,0.02)] flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl sm:rounded-2xl bg-[#EEF5FF] text-[#1760FF] border border-[#BFDBFE]/50 flex items-center justify-center shrink-0">
                <FileCheck className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-[#607797] uppercase tracking-wider">
                  SUBMISSION STATUS
                </div>
                <div className="font-bold text-[#10234E] text-sm sm:text-base mt-0.5 truncate">
                  Completed & Secured
                </div>
              </div>
            </div>

            {/* DATE & TIME Card */}
            <div className="bg-white p-4 sm:p-4.5 rounded-2xl border border-[#DCE5F0] shadow-[0_2px_8px_rgba(16,35,78,0.02)] flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl sm:rounded-2xl bg-[#EEF5FF] text-[#1760FF] border border-[#BFDBFE]/50 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-[#607797] uppercase tracking-wider">
                  DATE & TIME
                </div>
                <div 
                  className="font-bold text-[#10234E] text-sm sm:text-base mt-0.5 truncate"
                  suppressHydrationWarning
                >
                  {formattedDate}
                </div>
              </div>
            </div>
          </div>

          {/* Footer with Advisory Note and Dark Navy Action Button */}
          <div className="p-6 sm:p-8 bg-white space-y-4">
            <div className="flex items-center justify-center gap-2 text-xs sm:text-sm font-medium text-[#607797] text-center">
              <Info className="w-4 h-4 text-[#1760FF] shrink-0 stroke-[2.2]" />
              <span>You may now safely close this window or return to the portal.</span>
            </div>

            <Link
              href="/auth/login"
              className="w-full h-12 sm:h-13 bg-[#10234E] hover:bg-[#0c1c3f] active:scale-[0.99] text-white font-bold text-sm sm:text-base rounded-xl sm:rounded-2xl transition-all shadow-[0_2px_10px_rgba(16,35,78,0.15)] flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Return to Login</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
