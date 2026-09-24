import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

export interface DayDatePickerProps {
  value: string; // 'YYYY-MM-DD' or 'ALL'
  onChange: (newValue: string) => void;
  className?: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTHS_SHORT = [
  { value: 0, label: 'Jan', fullLabel: 'January' },
  { value: 1, label: 'Feb', fullLabel: 'February' },
  { value: 2, label: 'Mar', fullLabel: 'March' },
  { value: 3, label: 'Apr', fullLabel: 'April' },
  { value: 4, label: 'May', fullLabel: 'May' },
  { value: 5, label: 'Jun', fullLabel: 'June' },
  { value: 6, label: 'Jul', fullLabel: 'July' },
  { value: 7, label: 'Aug', fullLabel: 'August' },
  { value: 8, label: 'Sep', fullLabel: 'September' },
  { value: 9, label: 'Oct', fullLabel: 'October' },
  { value: 10, label: 'Nov', fullLabel: 'November' },
  { value: 11, label: 'Dec', fullLabel: 'December' },
];

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const AVAILABLE_YEARS = [2026, 2025, 2024, 2023];

function parseYMD(str: string): Date {
  if (!str || str === 'ALL') return new Date();
  const parts = str.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    return new Date(y, m, d);
  }
  const dt = new Date(str);
  return isNaN(dt.getTime()) ? new Date() : dt;
}

function toYMD(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export const DayDatePicker: React.FC<DayDatePickerProps> = ({
  value,
  onChange,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'DAYS' | 'MONTHS' | 'YEARS'>('DAYS');

  const todayStr = useMemo(() => toYMD(new Date()), []);
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toYMD(d);
  }, []);

  const [browsingDate, setBrowsingDate] = useState<Date>(() => parseYMD(value));

  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverCoords, setPopoverCoords] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  // Sync browsing date when external value changes
  useEffect(() => {
    if (value && value !== 'ALL') {
      setBrowsingDate(parseYMD(value));
    }
  }, [value]);

  // Viewport-aware responsive position calculation
  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    // Responsive width: max 300px, but always clamped inside visible screen
    const popoverWidth = Math.min(300, window.innerWidth - 24);
    const popoverHeight = 360;

    // Align with trigger right edge by default
    let left = rect.right - popoverWidth;

    // Clamp horizontal bounds so it never overflows screen edge
    if (left + popoverWidth > window.innerWidth - 12) {
      left = window.innerWidth - popoverWidth - 12;
    }
    if (left < 12) {
      left = 12;
    }

    // Vertical positioning: auto-flip above if not enough room below
    let top = rect.bottom + 8;
    if (rect.bottom + popoverHeight > window.innerHeight - 12) {
      if (rect.top - popoverHeight - 8 >= 12) {
        top = rect.top - popoverHeight - 8;
      } else {
        top = Math.max(12, window.innerHeight - popoverHeight - 12);
      }
    }

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

  // Step back 1 day
  const handlePrevDay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (value === 'ALL') {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      onChange(toYMD(d));
      return;
    }
    const curr = parseYMD(value);
    curr.setDate(curr.getDate() - 1);
    const newYMD = toYMD(curr);
    onChange(newYMD);
    setBrowsingDate(curr);
  };

  // Step forward 1 day
  const handleNextDay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (value === 'ALL') {
      onChange(todayStr);
      return;
    }
    const curr = parseYMD(value);
    curr.setDate(curr.getDate() + 1);
    const newYMD = toYMD(curr);
    onChange(newYMD);
    setBrowsingDate(curr);
  };

  // Label for trigger pill
  const getTriggerLabel = () => {
    if (!value || value === 'ALL') return 'All Dates';
    const date = parseYMD(value);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formatted = `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;

    if (value === todayStr) {
      return `Today, ${date.getDate()} ${months[date.getMonth()]}`;
    }
    if (value === yesterdayStr) {
      return `Yesterday, ${date.getDate()} ${months[date.getMonth()]}`;
    }
    return formatted;
  };

  // Calendar math for days grid
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(browsingYear, browsingMonth, 1).getDay();
    const daysInMonth = new Date(browsingYear, browsingMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(browsingYear, browsingMonth, 0).getDate();

    const days: Array<{
      day: number;
      isCurrentMonth: boolean;
      dateStr: string;
      isToday: boolean;
      isSelected: boolean;
    }> = [];

    // Previous month filler days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const m = browsingMonth === 0 ? 11 : browsingMonth - 1;
      const y = browsingMonth === 0 ? browsingYear - 1 : browsingYear;
      const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        day: d,
        isCurrentMonth: false,
        dateStr,
        isToday: dateStr === todayStr,
        isSelected: dateStr === value,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${browsingYear}-${String(browsingMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        day: d,
        isCurrentMonth: true,
        dateStr,
        isToday: dateStr === todayStr,
        isSelected: dateStr === value,
      });
    }

    // Next month filler days
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const m = browsingMonth === 11 ? 0 : browsingMonth + 1;
      const y = browsingMonth === 11 ? browsingYear + 1 : browsingYear;
      const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        day: d,
        isCurrentMonth: false,
        dateStr,
        isToday: dateStr === todayStr,
        isSelected: dateStr === value,
      });
    }

    return days;
  }, [browsingYear, browsingMonth, value, todayStr]);

  const handleSelectDate = (dateStr: string) => {
    onChange(dateStr);
    setBrowsingDate(parseYMD(dateStr));
    setIsOpen(false);
  };

  const handleSelectPreset = (preset: 'TODAY' | 'YESTERDAY' | 'ALL') => {
    if (preset === 'TODAY') {
      onChange(todayStr);
      setBrowsingDate(new Date());
    } else if (preset === 'YESTERDAY') {
      onChange(yesterdayStr);
      const yDate = new Date();
      yDate.setDate(yDate.getDate() - 1);
      setBrowsingDate(yDate);
    } else {
      onChange('ALL');
    }
    setIsOpen(false);
  };

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Trigger Pill */}
      <div
        ref={triggerRef}
        className="w-[195px] sm:w-[210px] h-9 flex items-center justify-between bg-[#251814] text-cream-100 rounded-2xl p-0.5 shadow-xs border border-[#382620] select-none"
      >
        <button
          type="button"
          onClick={handlePrevDay}
          className="p-1 text-cream-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors shrink-0 cursor-pointer"
          title="Previous Day"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => {
            setIsOpen(!isOpen);
            setViewMode('DAYS');
          }}
          className="flex-1 text-center px-1 font-bold text-xs text-white hover:text-[#E99343] transition-colors cursor-pointer truncate flex items-center justify-center gap-1.5"
        >
          <CalendarIcon className="w-3 h-3 text-[#E99343] shrink-0" />
          <span className="truncate">{getTriggerLabel()}</span>
        </button>

        <button
          type="button"
          onClick={handleNextDay}
          className="p-1 text-cream-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors shrink-0 cursor-pointer"
          title="Next Day"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Popover Dropdown Portal with Viewport Clamping */}
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
            className="bg-[#221612] text-cream-100 rounded-3xl border border-[#3D2821] shadow-2xl p-3.5 sm:p-4 text-xs select-none animate-in fade-in zoom-in-95 duration-150 space-y-3 overflow-y-auto"
          >
            {/* Quick Presets Bar */}
            <div className="grid grid-cols-3 gap-1.5 pb-2.5 border-b border-[#3D2821]">
              <button
                type="button"
                onClick={() => handleSelectPreset('TODAY')}
                className={`py-1.5 px-1 rounded-xl text-[11px] sm:text-xs font-bold transition-all border cursor-pointer text-center truncate ${
                  value === todayStr
                    ? 'bg-[#E56328] text-white border-[#E56328] shadow-md shadow-[#E56328]/30 font-black'
                    : 'bg-[#2E1E19] text-[#D3C7BF] border-[#3D2821] hover:bg-[#382620] hover:text-white'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handleSelectPreset('YESTERDAY')}
                className={`py-1.5 px-1 rounded-xl text-[11px] sm:text-xs font-bold transition-all border cursor-pointer text-center truncate ${
                  value === yesterdayStr
                    ? 'bg-[#E56328] text-white border-[#E56328] shadow-md shadow-[#E56328]/30 font-black'
                    : 'bg-[#2E1E19] text-[#D3C7BF] border-[#3D2821] hover:bg-[#382620] hover:text-white'
                }`}
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => handleSelectPreset('ALL')}
                className={`py-1.5 px-1 rounded-xl text-[11px] sm:text-xs font-bold transition-all border cursor-pointer text-center truncate ${
                  value === 'ALL'
                    ? 'bg-[#E56328] text-white border-[#E56328] shadow-md shadow-[#E56328]/30 font-black'
                    : 'bg-[#2E1E19] text-[#D3C7BF] border-[#3D2821] hover:bg-[#382620] hover:text-white'
                }`}
              >
                All Dates
              </button>
            </div>

            {viewMode === 'DAYS' ? (
              /* Day Calendar Mode */
              <div className="space-y-2.5">
                {/* Header with Month/Year Switcher */}
                <div className="flex items-center justify-between px-1">
                  <button
                    type="button"
                    onClick={() => setBrowsingDate(new Date(browsingYear, browsingMonth - 1, 1))}
                    className="w-7 h-7 flex items-center justify-center text-[#A89488] hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                    title="Previous Month"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setViewMode('MONTHS')}
                      className="font-extrabold text-sm text-white hover:text-[#E99343] transition-colors px-2 py-0.5 rounded-lg hover:bg-white/5 cursor-pointer"
                      title="Change Month"
                    >
                      {MONTH_NAMES[browsingMonth]}
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('YEARS')}
                      className="font-extrabold text-sm text-[#E99343] hover:text-white transition-colors px-2 py-0.5 rounded-lg hover:bg-white/5 cursor-pointer font-mono"
                      title="Change Year"
                    >
                      {browsingYear}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setBrowsingDate(new Date(browsingYear, browsingMonth + 1, 1))}
                    className="w-7 h-7 flex items-center justify-center text-[#A89488] hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                    title="Next Month"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Days of Week */}
                <div className="grid grid-cols-7 gap-1 text-center font-bold text-[10px] text-[#A89488] uppercase tracking-wider">
                  {DAYS_OF_WEEK.map((d, i) => (
                    <div key={i} className="py-0.5 flex items-center justify-center">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Days Grid - Uniform Square/Circular Targets */}
                <div className="grid grid-cols-7 gap-1 place-items-center">
                  {calendarDays.map((item, idx) => {
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectDate(item.dateStr)}
                        className={`w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center relative cursor-pointer ${
                          item.isSelected
                            ? 'bg-[#E56328] text-white font-black shadow-md shadow-[#E56328]/35 scale-105 z-10'
                            : item.isCurrentMonth
                            ? 'text-[#D3C7BF] hover:bg-white/10 hover:text-white'
                            : 'text-[#A89488]/30 hover:bg-white/5 hover:text-[#A89488]'
                        } ${
                          item.isToday && !item.isSelected
                            ? 'ring-1 ring-[#E56328]/60 text-[#E56328] font-bold'
                            : ''
                        }`}
                      >
                        <span>{item.day}</span>
                        {item.isToday && !item.isSelected && (
                          <span className="w-1 h-1 rounded-full bg-[#E56328] absolute bottom-1" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : viewMode === 'MONTHS' ? (
              /* Month Picker Grid */
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <button
                    type="button"
                    onClick={() => setViewMode('DAYS')}
                    className="p-1 text-[#A89488] hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                    title="Back to Calendar"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="font-extrabold text-sm text-white">Select Month ({browsingYear})</div>
                  <div className="w-6" />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {MONTHS_SHORT.map((m) => {
                    const isCurrentBrowsingMonth = browsingMonth === m.value;
                    return (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => {
                          setBrowsingDate(new Date(browsingYear, m.value, 1));
                          setViewMode('DAYS');
                        }}
                        className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isCurrentBrowsingMonth
                            ? 'bg-[#E56328] text-white font-black shadow-md shadow-[#E56328]/30'
                            : 'bg-[#2A1B16] text-[#D3C7BF] hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Year Picker Grid */
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <button
                    type="button"
                    onClick={() => setViewMode('DAYS')}
                    className="p-1 text-[#A89488] hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                    title="Back to Calendar"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="font-extrabold text-sm text-white">Select Year</div>
                  <div className="w-6" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {AVAILABLE_YEARS.map((yr) => {
                    const isSelectedYear = browsingYear === yr;
                    return (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => {
                          setBrowsingDate(new Date(yr, browsingMonth, 1));
                          setViewMode('DAYS');
                        }}
                        className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer font-mono ${
                          isSelectedYear
                            ? 'bg-[#E56328] text-white font-black shadow-md shadow-[#E56328]/30'
                            : 'bg-[#2A1B16] text-[#D3C7BF] hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {yr}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};
