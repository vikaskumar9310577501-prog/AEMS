import { useEffect, useState } from 'react';
import { APP_NAME, LOGO_SRC } from '../lib/constants';

const SPLASH_KEY = 'ams_splash_shown_v1';

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 400);
    const t2 = setTimeout(() => setPhase('out'), 2200);
    const t3 = setTimeout(() => {
      try {
        sessionStorage.setItem(SPLASH_KEY, '1');
      } catch {
        /* ignore */
      }
      onComplete();
    }, 2800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 transition-opacity duration-500 ${
        phase === 'out' ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div
        className={`flex flex-col items-center gap-6 transition-all duration-700 ${
          phase === 'in' ? 'scale-75 opacity-0' : phase === 'out' ? 'scale-110 opacity-0' : 'scale-100 opacity-100'
        }`}
      >
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-blue-500/30 blur-3xl animate-pulse scale-150" />
          <img
            src={LOGO_SRC}
            alt={APP_NAME}
            className="relative w-32 h-32 sm:w-40 sm:h-40 object-contain drop-shadow-2xl animate-splash-logo"
          />
        </div>
        <div className="text-center px-6">
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight animate-fade-up">
            {APP_NAME}
          </h1>
          <p className="text-blue-200/90 text-xs sm:text-sm font-bold uppercase tracking-[0.25em] mt-3 animate-fade-up-delay">
            Enterprise Asset Tracking
          </p>
        </div>
        <div className="flex gap-2 mt-4">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

export function shouldShowSplash(): boolean {
  try {
    return sessionStorage.getItem(SPLASH_KEY) !== '1';
  } catch {
    return true;
  }
}
