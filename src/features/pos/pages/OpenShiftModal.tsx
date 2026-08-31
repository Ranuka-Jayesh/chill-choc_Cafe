import React, { useState } from 'react';
import { shiftService } from '@/services/shiftService';
import { soundService } from '@/services/soundService';
import { User, CashierShift } from '@/types';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { formatLKR, rupeesToCents, formatCommaInput } from '@/utils/format';
import { format } from 'date-fns';
import { Coins, Sparkles, ShieldCheck, ArrowRight, LogOut } from 'lucide-react';
import { toast } from 'sonner';

interface OpenShiftModalProps {
  user: User;
  onShiftOpened: (shift: CashierShift) => void;
  onLogout: () => void;
}

export const OpenShiftModal: React.FC<OpenShiftModalProps> = ({
  user,
  onShiftOpened,
  onLogout,
}) => {
  const [openingRupees, setOpeningRupees] = useState<string>('10000');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const presets = [5000, 10000, 15000, 20000, 25000];

  const handleStartShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const openingCashCents = rupeesToCents(openingRupees);

    if (openingCashCents < 0) {
      toast.error('Opening cash cannot be negative.');
      return;
    }

    setIsSubmitting(true);
    try {
      const newShift = await shiftService.openShift({
        cashierId: user.id,
        cashierName: user.name,
        terminalId: 'term_01',
        terminalName: 'Main Counter POS-01',
        openingCashCents,
      });

      // Play automated welcome sound
      soundService.playWelcome();

      toast.success(`Shift #${newShift.shiftNumber} opened successfully!`);
      onShiftOpened(newShift);
    } catch (err: any) {
      toast.error(err.message || 'Failed to open shift');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickStartZeroFloat = async () => {
    setIsSubmitting(true);
    try {
      const newShift = await shiftService.openShift({
        cashierId: user.id,
        cashierName: user.name,
        terminalId: 'term_01',
        terminalName: 'Main Counter POS-01',
        openingCashCents: 0,
      });
      soundService.playWelcome();
      toast.success('POS ready! Shift started with Rs. 0 float.');
      onShiftOpened(newShift);
    } catch (err: any) {
      toast.error(err.message || 'Failed to start shift');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-cream-100/90 backdrop-blur-md">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-elevated border border-border p-6 sm:p-8 space-y-5 sm:space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Brand Banner */}
        <div className="flex flex-col items-center text-center">
          <img src="/logobg.webp" alt="Chill & Choc" className="w-18 sm:w-20 h-auto object-contain drop-shadow-sm" />
          <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-2.5 rounded-full bg-brand-teal-light text-brand-teal text-xs font-black">
            <Coins className="w-3.5 h-3.5" />
            <span>Open Register Float</span>
          </div>
          <h2 className="text-lg sm:text-xl font-black text-brand-brown-dark mt-1.5">
            Good Day, {user.name}
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Count drawer starting cash, or skip to start taking orders immediately.
          </p>
        </div>

        {/* Terminal & Date Card */}
        <div className="grid grid-cols-2 gap-3 p-3.5 bg-cream-50 rounded-2xl border border-border text-xs">
          <div>
            <span className="text-text-secondary uppercase font-bold text-[10px]">POS Terminal</span>
            <div className="font-extrabold text-brand-brown-dark text-xs sm:text-sm mt-0.5">POS-01 (Ground Floor)</div>
          </div>
          <div className="text-right">
            <span className="text-text-secondary uppercase font-bold text-[10px]">Business Date</span>
            <div className="font-extrabold text-brand-brown-dark text-xs sm:text-sm mt-0.5">
              {format(new Date(), 'dd MMM yyyy')}
            </div>
          </div>
        </div>

        {/* Float Input Form */}
        <form onSubmit={handleStartShift} className="space-y-4 sm:space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-text-secondary flex items-center justify-between">
              <span>Opening Cash / Starting Float</span>
              <span className="text-brand-teal font-extrabold text-[11px]">Press Enter ↵ to Start</span>
            </label>

            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-brand-brown text-lg">
                Rs.
              </div>
              <input
                id="opening-cash-input"
                type="text"
                placeholder="10,000"
                value={formatCommaInput(openingRupees)}
                onChange={(e) => setOpeningRupees(e.target.value.replace(/,/g, ''))}
                onFocus={(e) => e.target.select()}
                className="w-full pl-14 pr-4 py-3.5 bg-cream-50 border-2 border-brand-teal rounded-2xl text-xl sm:text-2xl font-black tabular-nums text-brand-brown-deep focus:outline-none focus:ring-4 focus:ring-brand-teal/20"
                autoFocus
                required
              />
            </div>
          </div>

          {/* Quick Presets */}
          <div className="space-y-1.5">
            <span className="text-[10px] sm:text-[11px] font-bold text-text-secondary uppercase">Quick Bill Presets:</span>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 sm:gap-2">
              {presets.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setOpeningRupees(amt.toString())}
                  className={`py-1.5 sm:py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    openingRupees.replace(/,/g, '') === amt.toString()
                      ? 'bg-brand-teal text-white shadow-teal ring-2 ring-brand-teal'
                      : 'bg-cream-100 hover:bg-cream-200 border border-cream-200 text-brand-brown'
                  }`}
                >
                  Rs. {amt.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons: Open with Float, Skip (Rs. 0 Float), or Sign Out */}
          <div className="space-y-2 pt-1">
            <button
              id="open-shift-button"
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-brand-teal hover:bg-brand-teal-dark text-white font-extrabold text-xs sm:text-sm shadow-teal transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              <Coins className="w-4 h-4" />
              <span>Start Shift with Rs. {formatCommaInput(openingRupees || '0')} Float</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleQuickStartZeroFloat}
                disabled={isSubmitting}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl sm:rounded-2xl bg-cream-100 hover:bg-cream-200 text-brand-brown-dark font-extrabold text-xs border border-cream-200 transition-all active:scale-95 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-brand-orange" />
                <span>Skip Float & Start (Rs. 0)</span>
              </button>

              <button
                type="button"
                onClick={onLogout}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl sm:rounded-2xl border border-border text-xs font-bold text-text-secondary hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                title="Sign out back to login screen"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
