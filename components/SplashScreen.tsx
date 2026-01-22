
import React, { useState, useEffect } from 'react';
import AxiomLogo from './AxiomLogo';

interface SplashScreenProps {
  onComplete: () => void;
}

const BOOT_LOGS = [
  "INITIALIZING KERNEL v2.5.0...",
  "LOADING VAULT PROTOCOLS...",
  "ESTABLISHING NEURAL LINK...",
  "CALIBRATING GROUNDED LOGIC...",
  "SYNCING INTELLIGENCE ASSETS...",
  "SYSTEM STATUS: OPTIMAL"
];

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [activeLogIndex, setActiveLogIndex] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    const duration = 3200; // 3.2 seconds total boot time
    const interval = 30; // 60FPS-ish update rate
    const steps = duration / interval;
    const increment = 100 / steps;

    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev + increment;
        if (next >= 100) {
          clearInterval(timer);
          setTimeout(() => setIsFadingOut(true), 400);
          setTimeout(onComplete, 1000); // Transition out delay
          return 100;
        }
        return next;
      });
    }, interval);

    // Update log messages progressively
    const logInterval = duration / BOOT_LOGS.length;
    const logTimer = setInterval(() => {
      setActiveLogIndex((prev) => Math.min(prev + 1, BOOT_LOGS.length - 1));
    }, logInterval);

    return () => {
      clearInterval(timer);
      clearInterval(logTimer);
    };
  }, [onComplete]);

  return (
    <div className={`fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-center transition-all duration-700 ease-in-out px-12 ${isFadingOut ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100'}`}>
      {/* Background Ambient Glow */}
      <div className="absolute inset-0 bg-radial-gradient from-[#4DA3FF]/5 to-transparent pointer-events-none"></div>

      {/* Main Composite Stack (Centered as a single unit) */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-sm">
        
        {/* Logo Section */}
        <div className="mb-8 transform transition-transform duration-1000 scale-110">
          <AxiomLogo size={120} glow={true} />
        </div>
        
        {/* Title Section */}
        <div className="flex flex-col items-center text-center mb-16">
          <h1 className="font-axiom text-4xl font-bold tracking-[0.4em] shimmer-text mb-2">AXIOM</h1>
          <span className="text-[10px] font-black uppercase tracking-[0.6em] text-zinc-500 opacity-60">Grounded Intelligence Studio</span>
        </div>

        {/* Progress & Logs Section (Now part of the main centered flow) */}
        <div className="w-full flex flex-col items-center">
          {/* Log Console */}
          <div className="w-full mb-6 flex flex-col h-12 overflow-hidden">
            {BOOT_LOGS.slice(0, activeLogIndex + 1).map((log, i) => (
              <div 
                key={i} 
                className={`text-[9px] font-tech font-bold uppercase tracking-widest transition-all duration-300 ${i === activeLogIndex ? 'text-[#4DA3FF] translate-y-0 opacity-100' : 'text-zinc-700 -translate-y-2 opacity-0 h-0'}`}
              >
                <span className="mr-3 opacity-30">[{i.toString().padStart(2, '0')}]</span>
                {log}
              </div>
            ))}
          </div>

          {/* Cinematic Progress Bar */}
          <div className="w-full h-[2px] bg-white/5 relative overflow-hidden rounded-full">
            {/* Active Progress */}
            <div 
              className="absolute top-0 left-0 h-full bg-[#4DA3FF] transition-all duration-100 shadow-[0_0_15px_rgba(77,163,255,0.8)]"
              style={{ width: `${progress}%` }}
            ></div>
            {/* Scanning Highlight */}
            <div className="absolute top-0 w-20 h-full bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[scan_2s_infinite]"></div>
          </div>
          
          <div className="mt-4 flex justify-between w-full">
             <span className="text-[8px] font-tech text-zinc-600 font-black tracking-tighter uppercase">Initializing Core Components</span>
             <span className="text-[8px] font-tech text-[#4DA3FF] font-black tracking-tighter">{Math.round(progress)}%</span>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scan {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(500%); }
        }
        .bg-radial-gradient {
          background: radial-gradient(circle at center, var(--tw-gradient-from), transparent 70%);
        }
      `}} />
    </div>
  );
};

export default SplashScreen;
