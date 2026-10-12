import React from 'react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen relative flex items-center justify-center bg-[#EDF5FF] overflow-x-hidden overflow-y-auto px-4 py-8 sm:py-12 selection:bg-blue-100 selection:text-blue-900 font-sans-ui">
      {/* Background Soft Organic Waves & Curves */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Top Right Organic SVG Wave */}
        <svg
          className="absolute -top-10 -right-10 w-[55vw] max-w-[750px] h-auto text-[#D6E8FC]/70 pointer-events-none"
          viewBox="0 0 700 500"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M700 0 C 480 30, 380 180, 350 300 C 310 440, 180 480, 0 500 L 700 500 Z"
            fill="url(#topWaveGrad)"
          />
          <defs>
            <linearGradient id="topWaveGrad" x1="700" y1="0" x2="150" y2="450" gradientUnits="userSpaceOnUse">
              <stop stopColor="#D9ECFE" stopOpacity="0.8" />
              <stop stopColor="#EDF5FF" stopOpacity="0.2" />
            </linearGradient>
          </defs>
        </svg>

        {/* Top Right Soft Glow */}
        <div className="absolute -top-[10%] -right-[5%] w-[550px] h-[550px] rounded-full bg-gradient-to-br from-[#D9EBFF] via-[#E4F1FF] to-transparent blur-3xl opacity-60" />

        {/* Bottom Left Sweeping Organic SVG Waves */}
        <svg
          className="absolute -bottom-10 -left-10 w-[65vw] max-w-[900px] h-auto text-[#D4E7FD]/75 pointer-events-none"
          viewBox="0 0 900 600"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M0 600 C 180 540, 320 460, 470 380 C 640 280, 780 320, 900 350 L 900 600 Z"
            fill="url(#bottomWaveGrad1)"
          />
          <path
            d="M0 600 C 240 570, 390 510, 540 430 C 690 350, 800 390, 900 430 L 900 600 Z"
            fill="url(#bottomWaveGrad2)"
            fillOpacity="0.65"
          />
          <defs>
            <linearGradient id="bottomWaveGrad1" x1="0" y1="600" x2="850" y2="300" gradientUnits="userSpaceOnUse">
              <stop stopColor="#D4E7FD" stopOpacity="0.75" />
              <stop stopColor="#EDF5FF" stopOpacity="0.15" />
            </linearGradient>
            <linearGradient id="bottomWaveGrad2" x1="0" y1="600" x2="900" y2="400" gradientUnits="userSpaceOnUse">
              <stop stopColor="#C8E2FD" stopOpacity="0.6" />
              <stop stopColor="#EDF5FF" stopOpacity="0.1" />
            </linearGradient>
          </defs>
        </svg>

        {/* Bottom Left Soft Glow */}
        <div className="absolute -bottom-[15%] -left-[5%] w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-[#CCE3FF] via-[#E0EFFF] to-transparent blur-3xl opacity-60" />

        {/* Ambient Center Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-to-b from-[#F2F8FF] to-transparent rounded-full blur-3xl pointer-events-none opacity-50" />
      </div>

      {/* Main Content Card Container */}
      <div className="relative z-10 w-full flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}
