import React, { useState, useEffect } from 'react';
import { formatLKR, rupeesToCents, formatCommaInput } from '@/utils/format';
import { X, Tag, Percent, Banknote } from 'lucide-react';
import { CustomSelect } from '@/components/ui/CustomSelect';

interface DiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
  subtotalCents: number;
  onApply: (params: { percent?: number; fixedCents?: number; reason: string }) => void;
  onClear: () => void;
}

export const DiscountModal: React.FC<DiscountModalProps> = ({
  isOpen,
  onClose,
  subtotalCents,
  onApply,
  onClear,
}) => {
  const [mode, setMode] = useState<'percent' | 'fixed'>('percent');
  const [percentVal, setPercentVal] = useState<number>(10);
  const [fixedRupees, setFixedRupees] = useState<string>('250');
  const [reason, setReason] = useState<string>('Promotional discount');

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

  const percentPresets = [5, 10, 15, 20, 25, 50];
  const rupeePresets = [100, 250, 500, 1000];

  const handleApply = () => {
    if (mode === 'percent') {
      onApply({ percent: Number(percentVal) || 0, reason });
    } else {
      const fixedCents = rupeesToCents(fixedRupees);
      onApply({ fixedCents, reason });
    }
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-brand-brown-deep/70 backdrop-blur-md animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-3xl sm:rounded-[32px] shadow-2xl border border-border/80 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 sm:py-5 bg-gradient-to-r from-cream-50 to-white border-b border-border/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-teal-light text-brand-teal border border-brand-teal/20 flex items-center justify-center shadow-xs">
              <Tag className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="font-black text-base text-brand-brown-dark tracking-tight">Apply Order Discount</h3>
              <p className="text-xs text-text-secondary mt-0.5">Order Subtotal: {formatLKR(subtotalCents)}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl text-text-secondary hover:bg-cream-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 bg-white">
          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-cream-100/80 rounded-2xl border border-cream-200">
            <button
              onClick={() => setMode('percent')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-xs transition-all active:scale-95 ${
                mode === 'percent'
                  ? 'bg-brand-teal text-white shadow-teal'
                  : 'text-text-secondary hover:text-brand-brown-dark'
              }`}
            >
              <Percent className="w-4 h-4 stroke-[2.5]" />
              Percentage (%)
            </button>
            <button
              onClick={() => setMode('fixed')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-xs transition-all active:scale-95 ${
                mode === 'fixed'
                  ? 'bg-brand-teal text-white shadow-teal'
                  : 'text-text-secondary hover:text-brand-brown-dark'
              }`}
            >
              <Banknote className="w-4 h-4 stroke-[2.2]" />
              Fixed (LKR)
            </button>
          </div>

          {/* Presets & Input */}
          {mode === 'percent' ? (
            <div className="space-y-3">
              <label className="text-xs font-black text-text-secondary uppercase">Select Percentage</label>
              <div className="grid grid-cols-3 gap-2">
                {percentPresets.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPercentVal(p)}
                    className={`py-3 rounded-2xl border-2 text-xs font-black transition-all active:scale-95 ${
                      percentVal === p
                        ? 'bg-brand-teal-light/60 text-brand-teal-dark border-brand-teal shadow-xs'
                        : 'bg-cream-50/60 border-border/70 hover:bg-cream-100 text-brand-brown-dark'
                    }`}
                  >
                    {p}% OFF
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2.5 pt-1">
                <span className="text-xs font-extrabold text-text-secondary">Custom %:</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={percentVal}
                  onChange={(e) => setPercentVal(Number(e.target.value))}
                  className="w-24 px-3.5 py-2 bg-cream-50 border border-border rounded-xl text-xs font-black text-brand-brown-dark"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="text-xs font-black text-text-secondary uppercase">Select Amount</label>
              <div className="grid grid-cols-2 gap-2">
                {rupeePresets.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setFixedRupees(amt.toString())}
                    className={`py-3 rounded-2xl border-2 text-xs font-black transition-all active:scale-95 ${
                      fixedRupees === amt.toString()
                        ? 'bg-brand-teal-light/60 text-brand-teal-dark border-brand-teal shadow-xs'
                        : 'bg-cream-50/60 border-border/70 hover:bg-cream-100 text-brand-brown-dark'
                    }`}
                  >
                    Rs. {amt}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2.5 pt-1">
                <span className="text-xs font-extrabold text-text-secondary">Custom Amount:</span>
                <input
                  type="text"
                  value={formatCommaInput(fixedRupees)}
                  onChange={(e) => setFixedRupees(e.target.value.replace(/,/g, ''))}
                  className="flex-1 px-3.5 py-2 bg-cream-50 border border-border rounded-xl text-xs font-black text-brand-brown-dark"
                  placeholder="e.g. 350"
                />
              </div>
            </div>
          )}

          {/* Reason Input */}
          <div className="space-y-1.5 pt-1">
            <CustomSelect
              label="Discount Reason"
              value={reason}
              onChange={(val) => setReason(val)}
              placement="top"
              options={[
                'Promotional discount',
                'Staff meal discount',
                'Loyalty reward member',
                'House courtesy / apology',
                'Special corporate event',
              ]}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-cream-50 border-t border-border flex items-center justify-between gap-3">
          <button
            onClick={() => {
              onClear();
              onClose();
            }}
            className="px-4 py-2.5 rounded-xl border border-rose-200 text-xs font-black text-rose-600 hover:bg-rose-50 transition-colors"
          >
            Remove Discount
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-black text-text-secondary hover:bg-cream-200"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-6 py-2.5 rounded-2xl bg-brand-teal hover:bg-brand-teal-dark text-white font-black text-xs shadow-teal active:scale-95 transition-all"
            >
              Apply Discount
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
