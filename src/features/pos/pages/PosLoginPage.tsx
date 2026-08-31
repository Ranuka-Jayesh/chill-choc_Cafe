import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { BrandFooter } from '@/components/brand/BrandFooter';
import { Delete } from 'lucide-react';
import { toast } from 'sonner';

export const PosLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { loginByPin, isLoading } = useAuthStore();

  const [pin, setPin] = useState<string>('');
  const [errorShake, setErrorShake] = useState(false);

  const attemptLogin = useCallback(async (pinCode: string) => {
    try {
      await loginByPin(pinCode, undefined, 'term_01');
      toast.success('Signed in to POS terminal.');
      navigate('/pos');
    } catch (err: any) {
      setErrorShake(true);
      setTimeout(() => setErrorShake(false), 500);
      toast.error(err.message || 'Invalid PIN code');
      setPin('');
    }
  }, [loginByPin, navigate]);

  const handleDigit = useCallback((digit: string) => {
    if (isLoading) return;
    setPin((prev) => {
      if (prev.length >= 4) return prev;
      const nextPin = prev + digit;
      if (nextPin.length === 4) {
        attemptLogin(nextPin);
      }
      return nextPin;
    });
  }, [isLoading, attemptLogin]);

  const handleDelete = useCallback(() => {
    if (isLoading) return;
    setPin((prev) => prev.slice(0, -1));
  }, [isLoading]);

  const handleClear = useCallback(() => {
    if (isLoading) return;
    setPin('');
  }, [isLoading]);

  // Global physical keyboard and numpad event listener (single source of truth)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is holding modifier keys (Ctrl+R, Alt+Tab, etc.)
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleDelete();
      } else if (e.key === 'Escape' || e.key === 'Delete') {
        e.preventDefault();
        handleClear();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleDigit, handleDelete, handleClear]);

  return (
    <div className="h-full h-[100dvh] w-full relative flex justify-end overflow-hidden select-none bg-neutral-900">
      {/* 1. Fullscreen Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/login.webp')" }}
      />
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[0.5px]" />

      {/* 2. Full-Height Right-Aligned White PIN Panel */}
      <div className="relative z-10 w-full sm:w-[420px] md:w-[450px] lg:w-[480px] h-full bg-white flex flex-col justify-between p-5 sm:p-7 lg:p-8 pb-10 shadow-2xl overflow-y-auto scrollbar-none">
        <div className="my-auto space-y-4 text-center">
          {/* Logo */}
          <img
            src="/logobg.webp"
            alt="Chill & Choc"
            className="w-20 sm:w-24 h-auto mx-auto object-contain drop-shadow-xs"
          />

          <div>
            <h2 className="text-lg sm:text-xl font-black text-brand-brown-dark tracking-tight">
              Cashier POS Terminal
            </h2>
            <p className="text-xs text-text-secondary font-medium mt-0.5">
              Enter 4-digit PIN to access register
            </p>
          </div>

          {/* Interactive PIN Dots */}
          <div
            className={`flex items-center justify-center gap-3.5 py-2 ${
              errorShake ? 'animate-shake' : ''
            }`}
          >
            {[0, 1, 2, 3].map((idx) => {
              const isFilled = pin.length > idx;
              return (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-full transition-all duration-200 ${
                    isFilled
                      ? 'bg-brand-teal scale-110 shadow-md shadow-brand-teal/40'
                      : 'bg-[#FAF7F2] border-2 border-[#D5C9BC]'
                  }`}
                />
              );
            })}
          </div>

          {/* 3x4 On-Screen Number Pad */}
          <div className="grid grid-cols-3 gap-2.5 max-w-[320px] mx-auto pt-1">
            {[
              { num: '1', sub: '' },
              { num: '2', sub: 'ABC' },
              { num: '3', sub: 'DEF' },
              { num: '4', sub: 'GHI' },
              { num: '5', sub: 'JKL' },
              { num: '6', sub: 'MNO' },
              { num: '7', sub: 'PQRS' },
              { num: '8', sub: 'TUV' },
              { num: '9', sub: 'WXYZ' },
            ].map(({ num, sub }) => (
              <button
                key={num}
                type="button"
                onClick={() => handleDigit(num)}
                className="h-13 sm:h-14 rounded-2xl bg-[#FAF7F2] hover:bg-cream-100/90 active:bg-brand-teal active:text-white border border-[#E0D7CC] flex flex-col items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xs group"
              >
                <span className="text-lg sm:text-xl font-black text-brand-brown-dark group-active:text-white leading-none">
                  {num}
                </span>
                {sub && (
                  <span className="text-[8.5px] font-extrabold text-text-muted group-active:text-white/80 uppercase tracking-widest mt-0.5">
                    {sub}
                  </span>
                )}
              </button>
            ))}

            {/* Clear Button */}
            <button
              type="button"
              onClick={handleClear}
              className="h-13 sm:h-14 rounded-2xl bg-[#FAF7F2] hover:bg-rose-50 text-status-danger border border-[#E0D7CC] flex items-center justify-center text-xs font-black transition-all cursor-pointer active:scale-95 uppercase tracking-wider"
            >
              Clear
            </button>

            {/* 0 Button */}
            <button
              type="button"
              onClick={() => handleDigit('0')}
              className="h-13 sm:h-14 rounded-2xl bg-[#FAF7F2] hover:bg-cream-100/90 active:bg-brand-teal active:text-white border border-[#E0D7CC] flex flex-col items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xs group"
            >
              <span className="text-lg sm:text-xl font-black text-brand-brown-dark group-active:text-white leading-none">
                0
              </span>
            </button>

            {/* Backspace Button */}
            <button
              type="button"
              onClick={handleDelete}
              className="h-13 sm:h-14 rounded-2xl bg-[#FAF7F2] hover:bg-cream-100 text-brand-brown-dark border border-[#E0D7CC] flex items-center justify-center transition-all cursor-pointer active:scale-95"
            >
              <Delete className="w-5 h-5 stroke-[2.2]" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Full-Width Bottom Bar Across Entire Screen */}
      <BrandFooter className="absolute bottom-0 inset-x-0 w-full z-20 bg-white/95 border-t border-border/80 shadow-xs" />
    </div>
  );
};
