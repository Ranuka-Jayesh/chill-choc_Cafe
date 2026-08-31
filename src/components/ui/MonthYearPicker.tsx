import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface MonthYearValue {
  year: string; // 'ALL' | '2026' | '2025' etc.
  month: string; // 'ALL' | '1' .. '12'
}

interface MonthYearPickerProps {
  value: MonthYearValue;
  onChange: (newValue: MonthYearValue) => void;
  className?: string;
}

const MONTHS_SHORT = [
  { value: '1', label: 'Jan', fullLabel: 'January' },
  { value: '2', label: 'Feb', fullLabel: 'February' },
  { value: '3', label: 'Mar', fullLabel: 'March' },
  { value: '4', label: 'Apr', fullLabel: 'April' },
  { value: '5', label: 'May', fullLabel: 'May' },
  { value: '6', label: 'Jun', fullLabel: 'June' },
  { value: '7', label: 'Jul', fullLabel: 'July' },
  { value: '8', label: 'Aug', fullLabel: 'August' },
  { value: '9', label: 'Sep', fullLabel: 'September' },
  { value: '10', label: 'Oct', fullLabel: 'October' },
  { value: '11', label: 'Nov', fullLabel: 'November' },
  { value: '12', label: 'Dec', fullLabel: 'December' },
];

const AVAILABLE_YEARS = ['2026', '2025', '2024', '2023'];

export const MonthYearPicker: React.FC<MonthYearPickerProps> = ({
  value,
  onChange,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'MONTHS' | 'YEARS'>('MONTHS');
  const [browsingYear, setBrowsingYear] = useState<number>(() => {
    return value.year !== 'ALL' ? parseInt(value.year, 10) : new Date().getFullYear();
  });

  const popoverRef = useRef<HTMLDivElement>(null);

  // Sync browsing year when prop changes
  useEffect(() => {
    if (value.year !== 'ALL') {
      setBrowsingYear(parseInt(value.year, 10));
    }
  }, [value.year]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setViewMode('MONTHS');
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Navigate previous / next on trigger pill
  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (value.month === 'ALL') {
      // Step year down
      const currentY = value.year === 'ALL' ? new Date().getFullYear() : parseInt(value.year, 10);
      onChange({ year: String(currentY - 1), month: 'ALL' });
      return;
    }

    const currentM = parseInt(value.month, 10);
    const currentY = value.year === 'ALL' ? new Date().getFullYear() : parseInt(value.year, 10);

    if (currentM === 1) {
      onChange({ year: String(currentY - 1), month: '12' });
    } else {
      onChange({ year: String(currentY), month: String(currentM - 1) });
    }
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (value.month === 'ALL') {
      // Step year up
      const currentY = value.year === 'ALL' ? new Date().getFullYear() : parseInt(value.year, 10);
      onChange({ year: String(currentY + 1), month: 'ALL' });
      return;
    }

    const currentM = parseInt(value.month, 10);
    const currentY = value.year === 'ALL' ? new Date().getFullYear() : parseInt(value.year, 10);

    if (currentM === 12) {
      onChange({ year: String(currentY + 1), month: '1' });
    } else {
      onChange({ year: String(currentY), month: String(currentM + 1) });
    }
  };

  // Label for trigger pill
  const getTriggerLabel = () => {
    if (value.year === 'ALL' && value.month === 'ALL') return 'All Time';
    if (value.month === 'ALL') return `All Months ${value.year}`;

    const monthObj = MONTHS_SHORT.find((m) => m.value === value.month);
    const monthName = monthObj ? monthObj.fullLabel : '';
    const yearStr = value.year === 'ALL' ? '' : value.year;
    return `${monthName} ${yearStr}`.trim();
  };

  const handleSelectMonth = (mVal: string) => {
    onChange({
      year: String(browsingYear),
      month: mVal,
    });
    setIsOpen(false);
  };

  const handleSelectAllMonths = () => {
    onChange({
      year: String(browsingYear),
      month: 'ALL',
    });
    setIsOpen(false);
  };

  const handleSelectYear = (yVal: string) => {
    if (yVal === 'ALL') {
      onChange({
        year: 'ALL',
        month: 'ALL',
      });
      setIsOpen(false);
      setViewMode('MONTHS');
      return;
    }

    const newYearNum = parseInt(yVal, 10);
    setBrowsingYear(newYearNum);
    onChange({
      year: yVal,
      month: value.month,
    });
    setViewMode('MONTHS');
  };

  return (
    <div ref={popoverRef} className={`relative inline-block ${className}`}>
      {/* Trigger Pill with fixed width and height so it matches other filter pills */}
      <div className="w-[195px] h-9 flex items-center justify-between bg-[#251814] text-cream-100 rounded-2xl p-0.5 shadow-xs border border-[#382620] select-none">
        <button
          type="button"
          onClick={handlePrev}
          className="p-1 text-cream-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors shrink-0"
          title="Previous Month"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => {
            setIsOpen(!isOpen);
            setViewMode('MONTHS');
          }}
          className="flex-1 text-center px-1 font-bold text-xs text-white hover:text-[#E99343] transition-colors cursor-pointer truncate"
        >
          <span>{getTriggerLabel()}</span>
        </button>

        <button
          type="button"
          onClick={handleNext}
          className="p-1 text-cream-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors shrink-0"
          title="Next Month"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Popover Dropdown Card */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 z-50 w-[270px] bg-[#221612] text-cream-100 rounded-3xl border border-[#3D2821] shadow-2xl p-4 animate-in fade-in zoom-in-95 duration-150">
          {viewMode === 'MONTHS' ? (
            /* Month Picker Mode */
            <div className="space-y-3.5">
              {/* Header with Year Navigator */}
              <div className="flex items-center justify-between px-1">
                <button
                  type="button"
                  onClick={() => setBrowsingYear((prev) => prev - 1)}
                  className="p-1 text-[#A89488] hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode('YEARS')}
                  className="font-extrabold text-sm text-white hover:text-[#E99343] transition-colors px-2 py-0.5 rounded-lg hover:bg-white/5"
                  title="Click to select year"
                >
                  {browsingYear}
                </button>

                <button
                  type="button"
                  onClick={() => setBrowsingYear((prev) => prev + 1)}
                  className="p-1 text-[#A89488] hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* All Months Option */}
              <button
                type="button"
                onClick={handleSelectAllMonths}
                className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                  value.month === 'ALL' && value.year === String(browsingYear)
                    ? 'bg-[#E56328] text-white border-[#E56328] shadow-md'
                    : 'bg-[#2E1E19] text-[#D3C7BF] border-[#3D2821] hover:bg-[#382620] hover:text-white'
                }`}
              >
                All months
              </button>

              {/* 3x4 Month Grid */}
              <div className="grid grid-cols-3 gap-2">
                {MONTHS_SHORT.map((m) => {
                  const isSelected =
                    value.month === m.value && value.year === String(browsingYear);

                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => handleSelectMonth(m.value)}
                      className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all ${
                        isSelected
                          ? 'bg-[#E56328] text-white font-black shadow-md shadow-[#E56328]/30 scale-[1.02]'
                          : 'text-[#D3C7BF] hover:bg-white/8 hover:text-white'
                      }`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Year Picker Mode */
            <div className="space-y-3.5">
              {/* Header */}
              <div className="flex items-center justify-between px-1">
                <button
                  type="button"
                  onClick={() => setViewMode('MONTHS')}
                  className="p-1 text-[#A89488] hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                  title="Back to months"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="font-extrabold text-sm text-white">Select year</div>
                <div className="w-6" /> {/* spacer */}
              </div>

              {/* All Years Option */}
              <button
                type="button"
                onClick={() => handleSelectYear('ALL')}
                className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                  value.year === 'ALL'
                    ? 'bg-[#E56328] text-white border-[#E56328] shadow-md'
                    : 'bg-[#2E1E19] text-[#D3C7BF] border-[#3D2821] hover:bg-[#382620] hover:text-white'
                }`}
              >
                All years
              </button>

              {/* Years Grid */}
              <div className="grid grid-cols-2 gap-2">
                {AVAILABLE_YEARS.map((yr) => {
                  const isSelected = value.year === yr;

                  return (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => handleSelectYear(yr)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                        isSelected
                          ? 'bg-[#E56328] text-white font-black shadow-md shadow-[#E56328]/30'
                          : 'text-[#D3C7BF] hover:bg-white/8 hover:text-white bg-[#2A1B16]'
                      }`}
                    >
                      {yr}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
