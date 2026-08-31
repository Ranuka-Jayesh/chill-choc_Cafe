import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';

interface TableModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTable: string;
  onSelectTable: (table: string) => void;
}

export const TableModal: React.FC<TableModalProps> = ({
  isOpen,
  onClose,
  currentTable,
  onSelectTable,
}) => {
  const [customTable, setCustomTable] = useState(currentTable || '');

  // Close with Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const quickTables = [
    '01', '02', '03', '04', '05',
    '06', '07', '08', '09', '10',
    '11', '12', '14', '15', 'Patio 1',
    'Patio 2', 'VIP 1', 'VIP 2', 'Bar 1', 'Bar 2',
  ];

  const handlePick = (t: string) => {
    onSelectTable(t);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-brand-brown-deep/75 backdrop-blur-md animate-in fade-in"
    >
      {/* Modal Container with Separate Floating Close Icon */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl sm:max-w-4xl bg-white rounded-3xl sm:rounded-[36px] shadow-2xl border border-[#E0D7CC] flex flex-col md:flex-row items-center"
      >
        {/* Separate External Floating Close Button */}
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 sm:-right-3 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-all cursor-pointer backdrop-blur-md active:scale-90 border border-white/20 shadow-lg"
          title="Close (Esc)"
        >
          <X className="w-5 h-5 stroke-[2.5]" />
        </button>

        {/* Left: Extra-Large Logo without Background Color */}
        <div className="w-full md:w-1/2 p-4 sm:p-6 lg:p-8 flex items-center justify-center select-none shrink-0">
          <img
            src="/logobg.webp"
            alt="Chill & Choc Logo"
            className="w-72 sm:w-80 md:w-96 lg:w-[420px] max-w-full h-auto object-contain"
          />
        </div>

        {/* Right: Table Selection Grid & Custom Input */}
        <div className="w-full md:w-1/2 p-5 sm:p-6 lg:p-7 flex flex-col justify-between">
          {/* Quick Table Grid */}
          <div>
            <div className="grid grid-cols-4 gap-2 sm:gap-2.5">
              {quickTables.map((t) => {
                const isSelected = currentTable === t;
                return (
                  <button
                    key={t}
                    onClick={() => handlePick(t)}
                    className={`py-3 rounded-xl sm:rounded-2xl border text-xs font-black transition-all cursor-pointer active:scale-95 flex flex-col items-center justify-center gap-0.5 ${
                      isSelected
                        ? 'bg-brand-teal text-white border-brand-teal shadow-teal ring-2 ring-brand-teal/30'
                        : 'bg-[#FAF7F2] border-[#E0D7CC] hover:bg-cream-100 text-brand-brown-dark shadow-2xs'
                    }`}
                  >
                    <span>{t}</span>
                    {isSelected && <Check className="w-3 h-3 stroke-[3] text-white" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Custom Table / Seat Input */}
          <div className="pt-4 mt-4 border-t border-[#F0E8DF] flex items-center gap-2">
            <input
              type="text"
              placeholder="Custom Table / Seat #"
              value={customTable}
              onChange={(e) => setCustomTable(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customTable.trim()) {
                  handlePick(customTable.trim());
                }
              }}
              className="flex-1 px-3.5 py-2.5 bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl text-xs font-bold text-brand-brown-dark placeholder:text-text-muted/60 focus:outline-none focus:border-brand-teal focus:bg-white transition-colors"
            />
            <button
              onClick={() => handlePick(customTable.trim() || '01')}
              className="px-5 py-2.5 bg-brand-teal text-white font-extrabold text-xs rounded-xl shadow-teal hover:bg-brand-teal-dark active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            >
              Set Table
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
