import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const routeThemes: Record<string, { gradient: string; shadow: string }> = {
  '/': {
    gradient: 'from-blue-500 via-blue-600 to-indigo-500',
    shadow: 'shadow-[0_0_10px_#3b82f6]',
  },
  '/produk': {
    gradient: 'from-orange-500 via-amber-600 to-yellow-500',
    shadow: 'shadow-[0_0_10px_#f97316]',
  },
  '/person': {
    gradient: 'from-cyan-500 via-teal-600 to-emerald-500',
    shadow: 'shadow-[0_0_10px_#06b6d4]',
  },
  '/cashflow': {
    gradient: 'from-emerald-500 via-green-600 to-teal-500',
    shadow: 'shadow-[0_0_10px_#10b981]',
  },
  '/report': {
    gradient: 'from-purple-500 via-violet-600 to-indigo-500',
    shadow: 'shadow-[0_0_10px_#a855f7]',
  },
  '/akun': {
    gradient: 'from-pink-500 via-rose-600 to-red-500',
    shadow: 'shadow-[0_0_10px_#ec4899]',
  },
  '/settings': {
    gradient: 'from-indigo-500 via-slate-600 to-gray-700',
    shadow: 'shadow-[0_0_10px_#6366f1]',
  },
};

export default function TopProgressBar() {
  const location = useLocation();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  const theme = routeThemes[location.pathname] || {
    gradient: 'from-red-500 via-red-600 to-rose-500',
    shadow: 'shadow-[0_0_10px_#dc2626]',
  };

  useEffect(() => {
    setVisible(true);
    setProgress(35);

    const timer1 = setTimeout(() => setProgress(75), 80);
    const timer2 = setTimeout(() => setProgress(100), 180);
    const timer3 = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 320);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [location.pathname]);

  if (!visible && progress === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none h-1 bg-transparent">
      <div
        className={`h-full bg-gradient-to-r ${theme.gradient} ${theme.shadow} transition-all duration-200 ease-out`}
        style={{ width: `${progress}%`, opacity: visible ? 1 : 0 }}
      />
    </div>
  );
}
