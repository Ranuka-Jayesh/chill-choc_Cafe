import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  X,
  Sparkles,
} from 'lucide-react';

export interface CustomDatePickerProps {
  value: string; // 'YYYY-MM-DD'
  onChange: (newValue: string) => void;
  minDate?: string;
  maxDate?: string;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  required?: boolean;
  showPresets?: boolean;
  align?: 'left' | 'right';
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const MONTH_SHORT_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
  value,
  onChange,
  minDate,
  maxDate,
  placeholder = 'Select date',
  className = '',
  inputClassName = '',
  disabled = false,
  required = false,
  showPresets = true,
  align = 'left',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'DAYS' | 'MONTHS' | 'YEARS'>('DAYS');

  // Parse current value
  const parsedValue = useMemo(() => {
    if (!value) return null;
    const parts = value.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      return new Date(y, m, d);
    }
    const dt = new Date(value);
    return isNaN(dt.getTime()) ? null : dt;
  }, [value]);

  const [browsingDate, setBrowsingDate] = useState<Date>(() => {
    return parsedValue || new Date();
  });

  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverCoords, setPopoverCoords] = useState<{ top: number; left: number; width: number } | null>(null);

  // Sync browsing date when value changes externally
  useEffect(() => {
    if (parsedValue) {
      setBrowsingDate(parsedValue);
    }
  }, [value]);

  // Recalculate popover positioning on open or resize/scroll
  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = Math.min(290, window.innerWidth - 24);
    const popoverHeight = showPresets ? 340 : 280;

    let top = rect.bottom + 6;
    let left = align === 'right' ? rect.right - popoverWidth : rect.left;

    // Check if overflowing viewport bottom
    if (rect.bottom + popoverHeight > window.innerHeight - 12) {
      if (rect.top - popoverHeight - 6 >= 12) {
        // Position above the trigger input
        top = rect.top - popoverHeight - 6;
      } else {
        // Clamp inside the visible screen viewport
        top = Math.max(12, window.innerHeight - popoverHeight - 12);
      }
    }

    // Clamp horizontal viewport bounds
    if (left + popoverWidth > window.innerWidth - 12) {
      left = window.innerWidth - popoverWidth - 12;
    }
    if (left < 12) left = 12;

    setPopoverCoords({ top, left, width: popoverWidth });
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
    }
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setIsOpen(false);
        setViewMode('DAYS');
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const browsingYear = browsingDate.getFullYear();
  const browsingMonth = browsingDate.getMonth();

  // Calendar math for days grid
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(browsingYear, browsingMonth, 1).getDay();
    const daysInMonth = new Date(browsingYear, browsingMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(browsingYear, browsingMonth, 0).getDate();

    const days: Array<{
      day: number;
      month: number;
      year: number;
      isCurrentMonth: boolean;
      dateStr: string;
      isToday: boolean;
      isSelected: boolean;
      isDisabled: boolean;
    }> = [];

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
      today.getDate()
    ).padStart(2, '0')}`;

    // Previous month filler days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const m = browsingMonth === 0 ? 11 : browsingMonth - 1;
      const y = browsingMonth === 0 ? browsingYear - 1 : browsingYear;
      const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        day: d,
        month: m,
        year: y,
        isCurrentMonth: false,
        dateStr,
        isToday: dateStr === todayStr,
        isSelected: dateStr === value,
        isDisabled: Boolean((minDate && dateStr < minDate) || (maxDate && dateStr > maxDate)),
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${browsingYear}-${String(browsingMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        day: d,
        month: browsingMonth,
        year: browsingYear,
        isCurrentMonth: true,
        dateStr,
        isToday: dateStr === todayStr,
        isSelected: dateStr === value,
        isDisabled: Boolean((minDate && dateStr < minDate) || (maxDate && dateStr > maxDate)),
      });
    }

    // Next month filler days (to make total rows uniform e.g. 35 or 42)
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const m = browsingMonth === 11 ? 0 : browsingMonth + 1;
      const y = browsingMonth === 11 ? browsingYear + 1 : browsingYear;
      const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        day: d,
        month: m,
        year: y,
        isCurrentMonth: false,
        dateStr,
        isToday: dateStr === todayStr,
        isSelected: dateStr === value,
        isDisabled: Boolean((minDate && dateStr < minDate) || (maxDate && dateStr > maxDate)),
      });
    }

    return days;
  }, [browsingYear, browsingMonth, value, minDate, maxDate]);

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setBrowsingDate(new Date(browsingYear, browsingMonth - 1, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setBrowsingDate(new Date(browsingYear, browsingMonth + 1, 1));
  };

  const handleSelectDate = (dateStr: string) => {
    onChange(dateStr);
    setIsOpen(false);
    setViewMode('DAYS');
  };

  const handleSetPreset = (daysOffset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    onChange(dateStr);
    setBrowsingDate(d);
    setIsOpen(false);
    setViewMode('DAYS');
  };

  // Formatted trigger label
  const formattedDisplay = useMemo(() => {
    if (!parsedValue) return '';
    const d = parsedValue;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }, [parsedValue]);

  // Relative days calculation (e.g. "in 30 days" or "today")
  const relativeText = useMemo(() => {
    if (!parsedValue) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(parsedValue);
    target.setHours(0, 0, 0, 0);
    const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 0) return `in ${diffDays}d`;
    return `${Math.abs(diffDays)}d ago`;
  }, [parsedValue]);

  return (
    <div className={`relative ${className}`}>
      {/* 1. Trigger Input Container */}
      <div
        ref={triggerRef}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full p-2 bg-[#FAF7F2] hover:bg-cream-50 border border-[#E0D7CC] hover:border-brand-teal rounded-xl text-xs font-bold text-brand-brown-dark flex items-center justify-between cursor-pointer transition-all shadow-2xs select-none ${
          isOpen ? 'ring-2 ring-brand-teal/20 border-brand-teal bg-white' : ''
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${inputClassName}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <CalendarIcon className="w-3.5 h-3.5 text-amber-700 shrink-0" />
          <span className={`truncate font-mono ${value ? 'text-brand-brown-dark font-bold' : 'text-text-muted font-normal'}`}>
            {formattedDisplay || placeholder}
          </span>
          {relativeText && (
            <span className="px-1.5 py-0.2 rounded-md bg-cream-200/80 text-[10px] font-extrabold text-brand-brown border border-[#E0D7CC] hidden sm:inline-block">
              {relativeText}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 text-text-muted">
          {value && !required && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="p-0.5 hover:text-rose-600 rounded-md transition-colors cursor-pointer"
              title="Clear Date"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Custom Styled Popover Calendar via Portal */}
      {isOpen &&
        popoverCoords &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: 'fixed',
              top: `${popoverCoords.top}px`,
              left: `${popoverCoords.left}px`,
              width: `${popoverCoords.width}px`,
              maxHeight: 'calc(100vh - 24px)',
              zIndex: 999999,
            }}
            className="bg-white rounded-2xl border border-[#E9E0D5] shadow-2xl p-3 text-xs select-none animate-in fade-in zoom-in-95 duration-150 space-y-2.5 overflow-y-auto"
          >
            {/* Quick Presets Bar for Cheques / Invoices */}
            {showPresets && (
              <div className="pb-2 border-b border-[#F0EAE2] space-y-1">
                <div className="text-[9px] font-extrabold uppercase text-text-muted tracking-wider flex items-center justify-between">
                  <span>Quick Due Presets</span>
                  <Sparkles className="w-3 h-3 text-[#E99343]" />
                </div>
                <div className="grid grid-cols-4 gap-1">
                  <button
                    type="button"
                    onClick={() => handleSetPreset(0)}
                    className="py-1 px-1 rounded-lg text-[10px] font-bold bg-[#FAF7F2] hover:bg-cream-200 text-brand-brown border border-[#E0D7CC] transition-all cursor-pointer text-center"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetPreset(14)}
                    className="py-1 px-1 rounded-lg text-[10px] font-bold bg-[#FAF7F2] hover:bg-cream-200 text-brand-brown border border-[#E0D7CC] transition-all cursor-pointer text-center"
                  >
                    +14d
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetPreset(30)}
                    className="py-1 px-1 rounded-lg text-[10px] font-bold bg-[#FAF7F2] hover:bg-cream-200 text-brand-brown border border-[#E0D7CC] transition-all cursor-pointer text-center"
                  >
                    +30d
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetPreset(60)}
                    className="py-1 px-1 rounded-lg text-[10px] font-bold bg-[#FAF7F2] hover:bg-cream-200 text-brand-brown border border-[#E0D7CC] transition-all cursor-pointer text-center"
                  >
                    +60d
                  </button>
                </div>
              </div>
            )}

            {/* Header: Month & Year Navigator */}
            <div className="flex items-center justify-between px-0.5">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="w-6 h-6 rounded-lg bg-[#FAF7F2] hover:bg-cream-200 border border-[#E0D7CC] flex items-center justify-center text-brand-brown transition-colors cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setViewMode(viewMode === 'MONTHS' ? 'DAYS' : 'MONTHS')}
                  className="px-2 py-0.5 rounded-lg font-black text-xs text-brand-brown-dark hover:bg-[#FAF7F2] transition-colors cursor-pointer"
                >
                  {MONTH_NAMES[browsingMonth]}
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode(viewMode === 'YEARS' ? 'DAYS' : 'YEARS')}
                  className="px-2 py-0.5 rounded-lg font-black text-xs text-brand-teal hover:bg-[#FAF7F2] transition-colors cursor-pointer font-mono"
                >
                  {browsingYear}
                </button>
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                className="w-6 h-6 rounded-lg bg-[#FAF7F2] hover:bg-cream-200 border border-[#E0D7CC] flex items-center justify-center text-brand-brown transition-colors cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* View Mode 1: Standard Days Grid */}
            {viewMode === 'DAYS' && (
              <div className="space-y-1">
                {/* Days of Week Header */}
                <div className="grid grid-cols-7 gap-1 text-center font-bold text-[9px] text-text-muted uppercase">
                  {DAYS_OF_WEEK.map((d, i) => (
                    <div key={i} className="py-0.5">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((item, idx) => {
                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={item.isDisabled}
                        onClick={() => handleSelectDate(item.dateStr)}
                        className={`h-7 w-full rounded-lg text-xs font-bold transition-all flex flex-col items-center justify-center relative cursor-pointer ${
                          item.isSelected
                            ? 'bg-brand-teal text-white font-black shadow-teal scale-102 z-10'
                            : item.isCurrentMonth
                            ? 'text-brand-brown-dark hover:bg-[#FAF7F2] hover:text-brand-teal'
                            : 'text-text-muted/40 hover:bg-[#FAF7F2] hover:text-text-muted'
                        } ${item.isDisabled ? 'opacity-20 cursor-not-allowed pointer-events-none' : ''}`}
                      >
                        <span>{item.day}</span>
                        {item.isToday && !item.isSelected && (
                          <span className="w-1 h-1 rounded-full bg-[#E99343] absolute bottom-0.5" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* View Mode 2: Month Grid Selector */}
            {viewMode === 'MONTHS' && (
              <div className="grid grid-cols-3 gap-1.5 py-1">
                {MONTH_SHORT_NAMES.map((name, mIdx) => {
                  const isSelected = browsingMonth === mIdx;
                  return (
                    <button
                      key={mIdx}
                      type="button"
                      onClick={() => {
                        setBrowsingDate(new Date(browsingYear, mIdx, 1));
                        setViewMode('DAYS');
                      }}
                      className={`py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-brand-teal text-white font-black shadow-teal'
                          : 'bg-[#FAF7F2] text-brand-brown-dark hover:bg-cream-200'
                      }`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            )}

            {/* View Mode 3: Year Selector */}
            {viewMode === 'YEARS' && (
              <div className="grid grid-cols-3 gap-1.5 max-h-[180px] overflow-y-auto py-1 pr-1">
                {Array.from({ length: 12 }, (_, i) => browsingYear - 4 + i).map((y) => {
                  const isSelected = browsingYear === y;
                  return (
                    <button
                      key={y}
                      type="button"
                      onClick={() => {
                        setBrowsingDate(new Date(y, browsingMonth, 1));
                        setViewMode('DAYS');
                      }}
                      className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer font-mono ${
                        isSelected
                          ? 'bg-brand-teal text-white font-black shadow-teal'
                          : 'bg-[#FAF7F2] text-brand-brown-dark hover:bg-cream-200'
                      }`}
                    >
                      {y}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Footer Actions */}
            <div className="pt-2 border-t border-[#F0EAE2] flex items-center justify-between text-[11px]">
              <button
                type="button"
                onClick={() => handleSetPreset(0)}
                className="font-bold text-brand-teal hover:underline cursor-pointer"
              >
                Set Today
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1 rounded-xl bg-[#251814] hover:bg-[#382620] text-white font-extrabold text-[10px] transition-all cursor-pointer shadow-xs active:scale-95"
              >
                Close
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
