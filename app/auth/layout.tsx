import React from 'react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen relative flex items-center justify-center bg-[#F0F6FD] overflow-x-hidden overflow-y-auto px-4 py-8 sm:py-12 selection:bg-blue-100 selection:text-blue-900 font-sans-ui">
      {/* Background Soft Organic Curves & Layered Waves Matching Reference */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
        {/* Base Canvas Soft Radial Glow */}
        <div 
          className="absolute inset-0" 
          style={{
            background: 'radial-gradient(circle at 50% 45%, #F7FAFE 0%, #EEF5FD 60%, #E6F1FC 100%)'
          }}
        />

        {/* Unified Full-Viewport Decorative SVG Curves & Waves */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 1440 900"
          fill="none"
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Top Right Main Curved Shape Gradient */}
            <linearGradient id="topRightGrad" x1="1440" y1="0" x2="820" y2="420" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#BCDDFC" stopOpacity="0.82" />
              <stop offset="45%" stopColor="#D2E8FD" stopOpacity="0.55" />
              <stop offset="85%" stopColor="#E8F4FE" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#F0F6FD" stopOpacity="0" />
            </linearGradient>

            {/* Top Right Secondary Concentric Arc */}
            <linearGradient id="topRightInnerGrad" x1="1440" y1="0" x2="1040" y2="280" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#A9D3FB" stopOpacity="0.5" />
              <stop offset="60%" stopColor="#C9E3FD" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#E2F1FE" stopOpacity="0" />
            </linearGradient>

            {/* Left Edge Sweeping Contour */}
            <linearGradient id="leftArcGrad" x1="0" y1="200" x2="420" y2="520" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#CCE4FD" stopOpacity="0.65" />
              <stop offset="55%" stopColor="#DEEFFE" stopOpacity="0.38" />
              <stop offset="100%" stopColor="#F0F6FD" stopOpacity="0" />
            </linearGradient>

            {/* Bottom Wave 1 (Upper / Back Wave) */}
            <linearGradient id="bottomWave1" x1="0" y1="580" x2="1440" y2="700" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#D5EAFF" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#C4E1FE" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#DBEDFE" stopOpacity="0.5" />
            </linearGradient>

            {/* Bottom Wave 2 (Middle Crossing Wave) */}
            <linearGradient id="bottomWave2" x1="0" y1="680" x2="1440" y2="780" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#B7DCFC" stopOpacity="0.72" />
              <stop offset="55%" stopColor="#C9E5FD" stopOpacity="0.62" />
              <stop offset="100%" stopColor="#DFEFFE" stopOpacity="0.4" />
            </linearGradient>

            {/* Bottom Wave 3 (Foreground Sweeping Wave) */}
            <linearGradient id="bottomWave3" x1="0" y1="780" x2="1440" y2="880" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#A8D4FC" stopOpacity="0.78" />
              <stop offset="50%" stopColor="#BEDFFD" stopOpacity="0.68" />
              <stop offset="100%" stopColor="#D7EBFE" stopOpacity="0.5" />
            </linearGradient>

            {/* Bottom Right Soft Swoop Accent */}
            <linearGradient id="bottomCorner" x1="880" y1="900" x2="1440" y2="760" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#9FCFFB" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#CAE5FE" stopOpacity="0.25" />
            </linearGradient>
          </defs>

          {/* 1. Top-Right Main Large Arc: swoops smoothly from top edge down to right edge */}
          <path
            d="M1440 0 L 860 0 C 860 210, 1020 390, 1440 440 Z"
            fill="url(#topRightGrad)"
          />

          {/* 2. Top-Right Inner Concentric Arc */}
          <path
            d="M1440 0 L 1060 0 C 1060 150, 1190 280, 1440 300 Z"
            fill="url(#topRightInnerGrad)"
          />

          {/* 3. Left Edge Soft Organic Arc */}
          <path
            d="M0 140 C 230 200, 340 350, 260 550 C 190 670, 90 710, 0 750 Z"
            fill="url(#leftArcGrad)"
          />

          {/* 4. Layered Bottom Waves */}
          {/* Layer 1 (Upper/Back wave): sweeps gracefully from mid-left, crests on right */}
          <path
            d="M0 620 C 310 670, 670 610, 1030 530 C 1210 490, 1360 550, 1440 590 L 1440 900 L 0 900 Z"
            fill="url(#bottomWave1)"
          />

          {/* Layer 2 (Middle wave): intersecting crossing wave */}
          <path
            d="M0 710 C 280 750, 540 690, 800 610 C 1100 520, 1310 610, 1440 670 L 1440 900 L 0 900 Z"
            fill="url(#bottomWave2)"
          />

          {/* Layer 3 (Foreground wave): front sweeping curve */}
          <path
            d="M0 790 C 330 810, 670 770, 990 700 C 1210 650, 1350 680, 1440 720 L 1440 900 L 0 900 Z"
            fill="url(#bottomWave3)"
          />

          {/* Layer 4 (Bottom-Right accent swoop) */}
          <path
            d="M860 900 C 1050 840, 1270 770, 1440 800 L 1440 900 Z"
            fill="url(#bottomCorner)"
          />
        </svg>
      </div>

      {/* Main Content Card Container */}
      <div className="relative z-10 w-full flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}
