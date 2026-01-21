
import React from 'react';

interface AxiomLogoProps {
  size?: number;
  glow?: boolean;
}

const AxiomLogo: React.FC<AxiomLogoProps> = ({ size = 32, glow = true }) => {
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      {glow && (
        <div 
          className="absolute inset-0 bg-[#4DA3FF] opacity-30 blur-xl rounded-full animate-pulse"
          style={{ width: size * 1.5, height: size * 1.5, left: -size * 0.25, top: -size * 0.25 }}
        ></div>
      )}
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 100 100" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10"
      >
        {/* Abstract Nexus 'A' */}
        <path 
          d="M50 15L15 85H30L50 45L70 85H85L50 15Z" 
          fill="url(#axiom_grad)" 
        />
        <path 
          d="M38 60L50 35L62 60H38Z" 
          fill="white" 
          fillOpacity="0.8"
        />
        <defs>
          <linearGradient id="axiom_grad" x1="50" y1="15" x2="50" y2="85" gradientUnits="userSpaceOnUse">
            <stop stopColor="#4DA3FF" />
            <stop offset="1" stopColor="#2563EB" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};

export default AxiomLogo;
