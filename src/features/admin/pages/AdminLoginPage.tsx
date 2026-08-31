import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { BrandFooter } from '@/components/brand/BrandFooter';
import { ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { loginByPin, isLoading } = useAuthStore();

  const [pin, setPin] = useState<string>('');
  const [errorShake, setErrorShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const attemptLogin = useCallback(
    async (pinCode: string) => {
      if (!pinCode || pinCode.length < 4) {
        toast.error('Please enter a 4-digit PIN');
        return;
      }
      try {
        await loginByPin(pinCode, 'ADMIN', 'BACKOFFICE');
        toast.success('Administrator authenticated successfully.');
        navigate('/admin/dashboard');
      } catch (err: any) {
        setErrorShake(true);
        setTimeout(() => setErrorShake(false), 500);
        toast.error(err.message || 'Invalid Administrator PIN');
        setPin('');
        inputRef.current?.focus();
      }
    },
    [loginByPin, navigate]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    setPin(val);
    if (val.length === 4) {
      attemptLogin(val);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length === 4) {
      attemptLogin(pin);
    }
  };

  return (
    <div
      className="h-full h-[100dvh] w-full relative flex items-center justify-center overflow-hidden select-none bg-neutral-950"
      onClick={() => inputRef.current?.focus()}
    >
      {/* 1. Fullscreen Cinematic Background */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-105 transition-transform duration-1000"
        style={{ backgroundImage: "url('/admin.webp')" }}
      />
      <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px]" />

      {/* 2. Centered Transparent Form with No Box Background */}
      <div
        className={`relative z-10 w-full max-w-sm px-6 py-8 flex flex-col items-center text-center space-y-6 animate-in fade-in zoom-in-95 duration-300 ${
          errorShake ? 'animate-shake' : ''
        }`}
      >
        {/* Brand Logo & Heading */}
        <div className="flex flex-col items-center">
          <img
            src="/logobg.webp"
            alt="Chill & Choc"
            className="w-24 sm:w-28 h-auto object-contain drop-shadow-2xl mb-3 hover:scale-105 transition-transform"
          />
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight drop-shadow-md">
            Management Portal
          </h1>
          <p className="text-xs text-white/70 font-semibold mt-1 drop-shadow-xs">
            Enter 4-digit PIN to unlock executive controls
          </p>
        </div>

        {/* Minimal Underlined PIN Field (Bottom border only, no box background) */}
        <form onSubmit={handleSubmit} className="w-full max-w-[280px] space-y-6">
          <div className="relative">
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={handleInputChange}
              disabled={isLoading}
              placeholder="••••"
              autoFocus
              className="w-full bg-transparent border-0 border-b-2 border-white/60 focus:border-white focus:outline-none focus:ring-0 text-center text-3xl sm:text-4xl font-mono font-black text-white tracking-[0.6em] pl-[0.6em] pb-3 placeholder:text-white/20 transition-all cursor-text caret-brand-teal"
            />
          </div>

          <button
            type="submit"
            disabled={pin.length < 4 || isLoading}
            className="w-full py-3.5 rounded-full bg-brand-teal hover:bg-brand-teal-dark disabled:opacity-30 disabled:hover:bg-brand-teal text-white font-extrabold text-xs sm:text-sm uppercase tracking-wider shadow-teal transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <span>Unlock Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* 3. Full-Width Bottom Bar Across Entire Screen */}
      <BrandFooter className="absolute bottom-0 inset-x-0 w-full z-20 bg-black/40 backdrop-blur-md border-t border-white/10 text-white/80 shadow-xs" />
    </div>
  );
};
