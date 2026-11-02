import { ProfileForm } from '@/components/student/profile-form';
import { DecorativeBackground } from '@/components/common/DecorativeBackground';
import { StudentHeader } from '@/components/student/student-header';

export const metadata = {
  title: 'Candidate Profile - EllipHire Aptitude Screening',
  description: 'View and update your candidate profile information',
};

export default function ProfilePage() {
  return (
    <div className="min-h-screen bg-[#F3F7FD] relative overflow-x-hidden text-[#10234E] font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Decorative Background Waves & Curves Matching Admin Portal */}
      <DecorativeBackground />

      {/* Main Foreground Container */}
      <div className="relative z-10 w-full max-w-[1340px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-16 flex flex-col">
        {/* Top Header Bar */}
        <StudentHeader badge="STUDENT PORTAL" showBackToDashboard />

        {/* Profile Content */}
        <main className="mt-8 sm:mt-10">
          <ProfileForm />
        </main>
      </div>
    </div>
  );
}
