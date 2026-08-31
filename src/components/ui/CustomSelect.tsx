import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: (SelectOption | string)[];
  placeholder?: string;
  label?: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  align?: 'left' | 'right' | 'auto';
  disabled?: boolean;
  placement?: 'bottom' | 'top' | 'auto';
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select an option...',
  label,
  className = '',
  buttonClassName = '',
  menuClassName = '',
  align = 'right',
  disabled = false,
  placement = 'auto',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [computedPlacement, setComputedPlacement] = useState<'top' | 'bottom'>('bottom');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Normalize options array
  const normalizedOptions: SelectOption[] = options.map((opt) => {
    if (typeof opt === 'string') {
      return { value: opt, label: opt };
    }
    return opt;
  });

  const selectedOption = normalizedOptions.find((o) => o.value === value);

  // Determine direction (open up or down)
  useEffect(() => {
    if (!isOpen) return;

    if (placement === 'top') {
      setComputedPlacement('top');
      return;
    }
    if (placement === 'bottom') {
      setComputedPlacement('bottom');
      return;
    }

    // Auto calculate if closer to bottom of viewport/modal
    if (dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      if (spaceBelow < 220 && spaceAbove > spaceBelow) {
        setComputedPlacement('top');
      } else {
        setComputedPlacement('bottom');
      }
    }
  }, [isOpen, placement]);

  // Close when clicked outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-xs font-black uppercase tracking-wider text-text-secondary mb-1.5">
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 px-3.5 py-2 bg-cream-50 hover:bg-cream-100/90 border border-cream-200/90 rounded-2xl text-xs sm:text-sm font-bold text-brand-brown-dark shadow-xs transition-all active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-brand-teal/40 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
          isOpen ? 'ring-2 ring-brand-teal/40 border-brand-teal bg-white shadow-md' : ''
        } ${buttonClassName}`}
      >
        <div className="flex items-center gap-2 truncate">
          {selectedOption?.icon && (
            <span className="flex-shrink-0 text-brand-teal">{selectedOption.icon}</span>
          )}
          <span className={`truncate ${!selectedOption ? 'text-text-secondary/70 font-medium' : 'font-extrabold'}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>

        <div
          className={`w-5 h-5 rounded-md bg-cream-200/70 flex items-center justify-center text-brand-brown transition-transform duration-200 flex-shrink-0 ${
            isOpen ? 'rotate-180 bg-brand-teal-light text-brand-teal' : ''
          }`}
        >
          <ChevronDown className="w-3.5 h-3.5 stroke-[2.5]" />
        </div>
      </button>

      {/* Floating Popover Menu */}
      {isOpen && (
        <div
          className={`absolute z-50 min-w-[200px] w-max max-w-[320px] max-h-64 overflow-y-auto bg-white rounded-2xl border border-[#E9E0D5] shadow-2xl p-1.5 space-y-0.5 animate-in fade-in zoom-in-95 duration-150 ${
            align === 'left' ? 'left-0' : 'right-0'
          } ${
            computedPlacement === 'top'
              ? 'bottom-full mb-1.5 origin-bottom'
              : 'top-full mt-1.5 origin-top'
          } ${menuClassName}`}
        >
          {normalizedOptions.map((opt) => {
            const isSelected = opt.value === value;

            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-xs font-bold text-left transition-all cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? 'bg-brand-teal-light/80 text-brand-teal-dark font-black'
                    : 'text-brand-brown-dark hover:bg-cream-100/90'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {opt.icon && (
                    <span className={`flex-shrink-0 ${isSelected ? 'text-brand-teal' : 'text-text-secondary'}`}>
                      {opt.icon}
                    </span>
                  )}
                  <div>
                    <div className="leading-tight">{opt.label}</div>
                    {opt.description && (
                      <div className={`text-[10px] font-medium mt-0.5 ${isSelected ? 'text-brand-teal' : 'text-text-secondary'}`}>
                        {opt.description}
                      </div>
                    )}
                  </div>
                </div>

                {isSelected && (
                  <div className="w-4 h-4 rounded-full bg-brand-teal text-white flex items-center justify-center flex-shrink-0 shadow-2xs ml-2">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
