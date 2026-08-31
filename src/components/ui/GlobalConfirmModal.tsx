import React, { useEffect, useRef } from 'react';
import { useConfirmStore } from '@/store/useConfirmStore';

export const GlobalConfirmModal: React.FC = () => {
  const { isOpen, options, close, inputValue, setInputValue } = useConfirmStore();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Auto-focus and select text in input if it's a prompt
    if (options?.isPrompt) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close(false);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        close(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, options?.isPrompt, close]);

  if (!isOpen || !options) return null;

  const {
    title,
    message,
    confirmText = options.isPrompt ? 'Submit' : 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger',
    isPrompt = false,
    placeholder = 'Enter value...',
  } = options;

  const confirmBtnStyles = {
    danger: 'bg-status-danger hover:bg-red-700 text-white shadow-md shadow-red-500/20',
    warning: 'bg-status-warning hover:bg-amber-600 text-white shadow-md shadow-amber-500/20',
    primary: 'bg-brand-teal hover:bg-brand-teal-dark text-white shadow-teal',
  }[variant];

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-[360px] sm:max-w-[390px] bg-white rounded-2xl p-4 sm:p-5 shadow-2xl border border-[#E9E0D5] space-y-3.5 animate-in fade-in zoom-in-95 duration-150">
        {/* Content Row: Logo on Left, Title & Message on Right */}
        <div className="flex items-start gap-3.5">
          <img
            src="/logobg.webp"
            alt="Cafe MM"
            className="w-14 h-14 sm:w-16 sm:h-16 object-contain shrink-0 mt-0.5"
          />

          <div className="flex-1 min-w-0 space-y-1 text-left">
            <h3 className="font-extrabold text-sm sm:text-base text-brand-brown-dark tracking-tight leading-snug">
              {title}
            </h3>
            {message && (
              <p className="text-xs text-text-secondary leading-snug">
                {message}
              </p>
            )}
          </div>
        </div>

        {/* Prompt Input Field if prompt dialog */}
        {isPrompt && (
          <div className="space-y-1 pt-1">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={placeholder}
              className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#E0D7CC] focus:border-brand-teal focus:bg-white rounded-xl text-xs sm:text-sm font-bold text-brand-brown-dark outline-none transition-all shadow-inner placeholder:text-text-muted"
            />
          </div>
        )}

        {/* Modal Actions */}
        <div className="pt-2.5 flex items-center justify-end gap-2 border-t border-[#F2ECE4]">
          <button
            type="button"
            onClick={() => close(false)}
            className="px-4 py-1.5 rounded-xl border border-[#E0D7CC] text-xs font-bold text-brand-brown hover:bg-cream-100 transition-all active:scale-95 cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => close(true)}
            autoFocus={!isPrompt}
            className={`px-4 py-1.5 rounded-xl text-xs font-extrabold transition-all active:scale-95 cursor-pointer ${confirmBtnStyles}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
