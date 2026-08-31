import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { shiftService } from '@/services/shiftService';
import { soundService } from '@/services/soundService';
import { useAuthStore } from '@/store/useAuthStore';
import { BrandFooter } from '@/components/brand/BrandFooter';
import { formatLKR, rupeesToCents, formatTime, formatCommaInput } from '@/utils/format';
import { db } from '@/services/storage/db';
import {
  Coins,
  CheckCircle2,
  AlertTriangle,
  Printer,
  ArrowRight,
  ShieldAlert,
  ArrowLeft,
  RotateCcw,
  Sparkles,
  TrendingUp,
  Wallet,
  CreditCard,
  ArrowDownRight,
  ArrowUpRight,
  User,
  Clock,
  Info,
  LogOut,
} from 'lucide-react';
import { toast } from 'sonner';

export const CloseShiftPage: React.FC = () => {
  const navigate = useNavigate();
  const { session, logout } = useAuthStore();
  const rawShift = shiftService.getActiveShift(session?.user.id, session?.terminalId);
  const shift =
    rawShift ||
    (session
      ? shiftService.getOrCreateActiveShift({
          cashierId: session.user.id,
          cashierName: session.user.name,
          terminalId: session.terminalId || 'term_01',
          terminalName: 'Main Counter POS-01',
        })
      : null);
  const settings = db.getSnapshot().settings;

  const [step, setStep] = useState<'COUNT' | 'RECONCILIATION'>('COUNT');
  const [actualRupees, setActualRupees] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isClosing, setIsClosing] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input on mount or when switching to COUNT
  useEffect(() => {
    if (step === 'COUNT') {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [step]);

  // Global Keyboard Navigation (Enter to close on RECONCILIATION, Esc to back)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (step === 'RECONCILIATION') {
          e.preventDefault();
          setStep('COUNT');
        } else {
          navigate('/pos');
        }
      } else if (e.key === 'Enter' && step === 'RECONCILIATION') {
        if ((e.target as HTMLElement)?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          handleCompleteClosing();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, actualRupees, notes, isClosing]);

  if (!session || !shift) {
    navigate('/pos/login');
    return null;
  }

  const expectedCashCents = shift
    ? (shift.openingCash || 0) +
      (shift.cashSales || 0) +
      (shift.cashIn || 0) -
      (shift.cashOut || 0) -
      (shift.cashRefunds || 0) -
      (shift.cashDrops || 0)
    : 0;

  const actualCents = actualRupees ? rupeesToCents(actualRupees) : expectedCashCents;
  const varianceCents = actualCents - expectedCashCents;
  const isVarianceExceeded =
    Math.abs(varianceCents) > (settings.varianceReasonThresholdCents || 10000);

  const handleStepCountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!actualRupees || parseFloat(actualRupees.replace(/,/g, '')) < 0) {
      // Auto fill with expected cash if left blank
      setActualRupees(formatCommaInput((expectedCashCents / 100).toString()));
    }
    setStep('RECONCILIATION');
  };

  const handleSkipAndLogout = async () => {
    if (isClosing) return;
    setIsClosing(true);
    try {
      if (session) {
        await shiftService.closeShift({
          shiftId: shift?.id,
          closedByUserId: session.user.id,
          closedByUserName: session.user.name,
          closingCashEnteredCents: expectedCashCents,
          closingNotes: 'Direct sign out (cashout skipped)',
        });
      }
      soundService.playLogout();
      toast.success('Signed out successfully.');
      await logout();
      navigate('/pos/login');
    } catch {
      await logout();
      navigate('/pos/login');
    } finally {
      setIsClosing(false);
    }
  };

  const handleCompleteClosing = async () => {
    if (isClosing) return;

    if (isVarianceExceeded && !notes.trim()) {
      toast.error('Please enter a note explaining the cash drawer variance.');
      return;
    }

    setIsClosing(true);
    try {
      await shiftService.closeShift({
        shiftId: shift?.id,
        closedByUserId: session.user.id,
        closedByUserName: session.user.name,
        closingCashEnteredCents: actualCents,
        closingNotes: notes,
      });

      // Play automated logout sound
      soundService.playLogout();

      toast.success(`Shift #${shift?.shiftNumber || 101} closed successfully.`);
      await logout();
      navigate('/pos/login');
    } catch (err: any) {
      toast.error(err.message || 'Failed to close shift');
      // Fallback: allow logout anyway
      await logout();
      navigate('/pos/login');
    } finally {
      setIsClosing(false);
    }
  };

  const handlePresetFill = (valInRupees: number) => {
    setActualRupees(formatCommaInput(valInRupees.toString()));
  };

  const handleAddAmount = (addRupees: number) => {
    const current = parseFloat(actualRupees.replace(/,/g, '')) || 0;
    setActualRupees(formatCommaInput((current + addRupees).toString()));
  };

  return (
    <div className="h-full h-[100dvh] w-full bg-cream-100/50 flex flex-col justify-between overflow-hidden select-none">
      {/* 1. Header Bar */}
      <header className="bg-white border-b border-border/80 px-4 sm:px-8 py-3 flex items-center justify-between shadow-xs flex-shrink-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/pos')}
            className="flex items-center gap-2 px-3.5 py-2 bg-cream-50 hover:bg-cream-100 border border-border rounded-xl text-xs font-black text-brand-brown-dark transition-all active:scale-95 cursor-pointer shadow-xs"
          >
            <ArrowLeft className="w-4 h-4 text-brand-teal" />
            <span className="hidden sm:inline">Back to POS</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <img src="/logobg.webp" alt="Chill & Choc" className="h-8 sm:h-9 w-auto object-contain" />
          <div className="text-left">
            <div className="text-xs sm:text-sm font-black text-brand-brown-dark leading-none">Chill & Choc Café</div>
            <div className="text-[10px] sm:text-[11px] font-bold text-text-secondary leading-tight mt-0.5">
              End of Shift Reconciliation
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {shift && (
            <div className="hidden md:flex px-3 py-1.5 bg-cream-50 rounded-xl border border-border text-right items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-status-success animate-pulse" />
              <div className="text-xs font-black text-brand-brown-dark">Shift #{shift.shiftNumber}</div>
            </div>
          )}

          {/* Direct Skip Cashout & Sign Out Button */}
          <button
            type="button"
            onClick={handleSkipAndLogout}
            disabled={isClosing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cream-100 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 border border-border text-xs font-extrabold text-brand-brown-dark transition-all active:scale-95 cursor-pointer shadow-xs"
            title="Skip counting and log out immediately"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Skip & Sign Out</span>
          </button>
        </div>
      </header>

      {/* 2. Main Step Content with min-h-0 and internal scroll */}
      <main className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 py-4 sm:py-6 max-w-6xl w-full mx-auto flex flex-col justify-center">
        {/* Step Indicator Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-teal/10 text-brand-teal text-xs font-black mb-1">
              <Wallet className="w-3.5 h-3.5" />
              <span>Step {step === 'COUNT' ? '1 of 2: Physical Cash Declaration' : '2 of 2: Cash Drawer Balancing'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-brand-brown-dark tracking-tight">
              {step === 'COUNT' ? 'Count Cash in Register' : 'Review & Finalize Shift Closure'}
            </h1>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-text-secondary bg-white px-3.5 py-2 rounded-2xl border border-border shadow-xs self-start sm:self-auto">
            <User className="w-3.5 h-3.5 text-brand-teal" />
            <span>{shift.cashierName}</span>
            <span className="text-border">•</span>
            <Clock className="w-3.5 h-3.5 text-brand-orange" />
            <span>Opened: {formatTime(shift.openedAt)}</span>
          </div>
        </div>

        {/* STEP 1: PHYSICAL CASH COUNT (RESPONSIVE 2-COLUMN EQUAL HEIGHT) */}
        {step === 'COUNT' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left Column: Shift Snapshot */}
            <div className="lg:col-span-5 flex flex-col h-full">
              <div className="bg-white rounded-[28px] p-6 sm:p-7 shadow-card border border-border h-full flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-text-secondary pb-3 border-b border-border/80 flex items-center justify-between">
                    <span>Shift Register Snapshot</span>
                    <span className="text-brand-teal font-extrabold">{shift.terminalName}</span>
                  </h3>

                  <div className="space-y-3 pt-3">
                    <div className="flex items-center justify-between p-3.5 rounded-2xl bg-cream-50 border border-border">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-brand-teal/15 text-brand-teal flex items-center justify-center font-black">
                          <Wallet className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                            Opening Float
                          </div>
                          <div className="text-xs font-bold text-text-primary">Drawer starting cash</div>
                        </div>
                      </div>
                      <div className="text-sm font-black text-brand-brown-dark font-mono">
                        {formatLKR(shift.openingCash)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3.5 rounded-2xl bg-cream-50 border border-border">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-status-success/15 text-status-success flex items-center justify-center font-black">
                          <TrendingUp className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                            Cash Sales
                          </div>
                          <div className="text-xs font-bold text-text-primary">Recorded during shift</div>
                        </div>
                      </div>
                      <div className="text-sm font-black text-status-success font-mono">
                        +{formatLKR(shift.cashSales)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3.5 rounded-2xl bg-cream-50 border border-border">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-brand-orange/15 text-brand-orange flex items-center justify-center font-black">
                          <CreditCard className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                            Card Sales (Terminal)
                          </div>
                          <div className="text-xs font-bold text-text-primary">Electronic payments</div>
                        </div>
                      </div>
                      <div className="text-sm font-black text-brand-brown-dark font-mono">
                        {formatLKR(shift.cardSales)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-text-secondary leading-relaxed bg-cream-50/70 p-3.5 rounded-2xl border border-dashed border-border mt-4 flex items-start gap-2">
                  <Info className="w-4 h-4 text-brand-teal shrink-0 mt-0.5" />
                  <span>Count all physical currency notes and coins in the drawer. Do not count card receipts or electronic payments.</span>
                </div>
              </div>
            </div>

            {/* Right Column: Active Count Entry Form */}
            <div className="lg:col-span-7 flex flex-col h-full">
              <form
                onSubmit={handleStepCountSubmit}
                className="bg-white rounded-[28px] p-6 sm:p-8 shadow-card border border-border h-full flex flex-col justify-between space-y-6"
              >
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black uppercase tracking-wider text-brand-brown-dark flex items-center gap-1.5">
                        <Coins className="w-4 h-4 text-brand-teal" />
                        Physical Cash Counted in Drawer (LKR)
                      </label>
                      <span className="text-[11px] font-extrabold text-brand-teal animate-pulse">
                        Press Enter ↵ to continue
                      </span>
                    </div>

                    {/* Clean Bottom-Border Only Large Numeric Input */}
                    <div className="relative py-2">
                      <span className="absolute left-1 top-1/2 -translate-y-1/2 font-black text-brand-brown-dark text-2xl sm:text-3xl">
                        Rs.
                      </span>
                      <input
                        ref={inputRef}
                        id="closing-cash-input"
                        type="text"
                        value={actualRupees}
                        onChange={(e) => setActualRupees(formatCommaInput(e.target.value))}
                        onFocus={(e) => e.target.select()}
                        placeholder="0.00"
                        className="w-full pl-14 pr-2 py-3 bg-transparent border-0 border-b-2 border-brand-teal/40 focus:border-brand-teal text-3xl sm:text-4xl font-black text-brand-brown-dark font-mono text-right placeholder:text-text-secondary/30 focus:outline-none transition-colors"
                        autoFocus
                        required
                      />
                    </div>
                    <p className="text-[11px] text-text-secondary font-medium">
                      Include opening float cash and all customer cash collected.
                    </p>
                  </div>

                  {/* Quick 1-Tap Presets */}
                  <div className="space-y-2 pt-2 border-t border-border/80">
                    <div className="text-[11px] font-extrabold text-text-secondary flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-brand-orange" />
                        Quick Count Presets:
                      </span>
                      {actualRupees && (
                        <button
                          type="button"
                          onClick={() => setActualRupees('')}
                          className="text-[10px] font-black text-rose-600 hover:underline cursor-pointer"
                        >
                          Clear Count
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <button
                        type="button"
                        onClick={() => handlePresetFill(expectedCashCents / 100)}
                        className="py-3 px-3 bg-cream-100 hover:bg-cream-200 border border-border text-xs font-black text-brand-brown-dark rounded-2xl transition-all active:scale-95 cursor-pointer shadow-xs"
                        title="Fill exact expected drawer cash"
                      >
                        Exact (Rs. {Math.round(expectedCashCents / 100).toLocaleString()})
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddAmount(1000)}
                        className="py-3 px-3 bg-cream-50 hover:bg-cream-100 border border-border text-xs font-black text-brand-brown-dark rounded-2xl transition-all active:scale-95 cursor-pointer"
                      >
                        +1,000
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddAmount(5000)}
                        className="py-3 px-3 bg-cream-50 hover:bg-cream-100 border border-border text-xs font-black text-brand-brown-dark rounded-2xl transition-all active:scale-95 cursor-pointer"
                      >
                        +5,000
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddAmount(10000)}
                        className="py-3 px-3 bg-cream-50 hover:bg-cream-100 border border-border text-xs font-black text-brand-brown-dark rounded-2xl transition-all active:scale-95 cursor-pointer"
                      >
                        +10,000
                      </button>
                    </div>
                  </div>
                </div>

                {/* Advance & Skip Action Buttons */}
                <div className="space-y-2.5 mt-4">
                  <button
                    id="reconcile-advance-button"
                    type="submit"
                    className="w-full py-3.5 sm:py-4 rounded-2xl bg-brand-teal hover:bg-brand-teal-dark text-white font-black text-xs sm:text-sm shadow-teal transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Compare & Reconcile Drawer (Enter ↵)</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                  </button>

                  <button
                    type="button"
                    onClick={handleSkipAndLogout}
                    disabled={isClosing}
                    className="w-full py-2.5 rounded-xl sm:rounded-2xl bg-cream-100 hover:bg-cream-200 text-brand-brown-dark font-extrabold text-xs border border-border/80 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5 text-text-secondary" />
                    <span>Skip Cashout & Sign Out Immediately</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* STEP 2: RECONCILIATION & CLOSING (RESPONSIVE 2-COLUMN EQUAL HEIGHT) */}
        {step === 'RECONCILIATION' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left Column: Full Cash Flow Summary */}
            <div className="lg:col-span-5 flex flex-col h-full">
              <div className="bg-white rounded-[28px] p-6 sm:p-7 shadow-card border border-border h-full flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-text-secondary pb-3 border-b border-border/80 flex items-center justify-between">
                    <span>Cash Flow Breakdown</span>
                    <span className="text-brand-teal font-extrabold font-mono">#{shift.shiftNumber}</span>
                  </h3>

                  <div className="space-y-3 pt-2 text-xs">
                    <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                      <span className="text-text-secondary">Opening Cash Float (+):</span>
                      <span className="font-mono font-bold text-text-primary">{formatLKR(shift.openingCash)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                      <span className="text-text-secondary">Cash Sales (+):</span>
                      <span className="font-mono font-bold text-status-success">+{formatLKR(shift.cashSales)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                      <span className="text-text-secondary">Card Sales (Terminal):</span>
                      <span className="font-mono font-bold text-text-primary">{formatLKR(shift.cardSales)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                      <span className="text-text-secondary">Cash In (+):</span>
                      <span className="font-mono font-bold text-text-primary">+{formatLKR(shift.cashIn)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                      <span className="text-text-secondary">Cash Out (-):</span>
                      <span className="font-mono font-bold text-rose-600">-{formatLKR(shift.cashOut)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                      <span className="text-text-secondary">Cash Refunds (-):</span>
                      <span className="font-mono font-bold text-rose-600">-{formatLKR(shift.cashRefunds)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center p-3.5 bg-cream-50 rounded-2xl border border-border font-black text-brand-brown-dark mt-4">
                  <span className="text-xs uppercase tracking-wider">Expected Drawer Total:</span>
                  <span className="font-mono text-base text-brand-brown-dark">{formatLKR(expectedCashCents)}</span>
                </div>
              </div>
            </div>

            {/* Right Column: Comparative Variance & Signoff */}
            <div className="lg:col-span-7 flex flex-col h-full">
              <div className="bg-white rounded-[28px] p-6 sm:p-7 shadow-card border border-border h-full flex flex-col justify-between space-y-5">
                <div className="space-y-4">
                  {/* Comparative Metric Cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-2xl bg-cream-50 border border-border/80">
                      <div className="text-[11px] font-extrabold uppercase tracking-wider text-text-secondary">
                        Expected Cash
                      </div>
                      <div className="text-xl sm:text-2xl font-black text-brand-brown-dark mt-1 font-mono">
                        {formatLKR(expectedCashCents)}
                      </div>
                      <div className="text-[10px] text-text-secondary mt-0.5">Calculated by register sales</div>
                    </div>

                    <div className="p-4 rounded-2xl bg-cream-50 border border-border/80">
                      <div className="text-[11px] font-extrabold uppercase tracking-wider text-text-secondary">
                        Actual Counted
                      </div>
                      <div className="text-xl sm:text-2xl font-black text-brand-teal mt-1 font-mono">
                        {formatLKR(actualCents)}
                      </div>
                      <div className="text-[10px] text-text-secondary mt-0.5">Entered physical cash</div>
                    </div>
                  </div>

                  {/* Variance Status Banner */}
                  <div
                    className={`p-4 sm:p-4.5 rounded-2xl border flex items-center justify-between shadow-xs ${
                      varianceCents === 0
                        ? 'bg-status-success/10 border-status-success/30 text-status-success'
                        : varianceCents > 0
                        ? 'bg-brand-yellow/20 border-brand-yellow/40 text-brand-brown-dark'
                        : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {varianceCents === 0 ? (
                        <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7 flex-shrink-0" />
                      ) : (
                        <AlertTriangle className="w-6 h-6 sm:w-7 sm:h-7 flex-shrink-0" />
                      )}
                      <div>
                        <div className="font-black text-xs sm:text-sm">
                          {varianceCents === 0
                            ? 'DRAWER IS BALANCED (Rs. 0.00)'
                            : varianceCents > 0
                            ? 'Cash Drawer Overage (Surplus)'
                            : 'Cash Drawer Shortage (Deficit)'}
                        </div>
                        <div className="text-[11px] opacity-80 mt-0.5">
                          {varianceCents === 0
                            ? 'Physical cash perfectly matches system sales ledger.'
                            : 'Variance between counted cash and recorded transactions.'}
                        </div>
                      </div>
                    </div>

                    <div className="text-base sm:text-xl font-black font-mono flex-shrink-0">
                      {varianceCents > 0 && '+'}
                      {formatLKR(varianceCents)}
                    </div>
                  </div>

                  {/* Notes & Variance Reason Input */}
                  {isVarianceExceeded && (
                    <div className="space-y-1.5 p-4 rounded-2xl bg-amber-50 border border-amber-200">
                      <label className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4 text-amber-600" />
                        Mandatory Variance Reason Note
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Enter reason for cash discrepancy..."
                        rows={2}
                        className="w-full p-3 bg-white border border-amber-300 rounded-xl text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                        required
                      />
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep('COUNT')}
                    className="w-full sm:w-1/3 py-4 bg-cream-100 hover:bg-cream-200 text-brand-brown-dark font-black text-xs sm:text-sm rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Re-count (Esc)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCompleteClosing}
                    disabled={isClosing}
                    className="w-full sm:w-2/3 py-4 bg-brand-brown-dark hover:bg-brand-brown-deep text-white font-black text-xs sm:text-sm rounded-2xl shadow-elevated transition-all active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    <Printer className="w-4 h-4 stroke-[2.5]" />
                    <span>{isClosing ? 'Closing Register...' : 'Close Shift & Logout (Enter ↵)'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 3. Global Full-Width Bottom Bar */}
      <BrandFooter className="w-full bg-white/95 border-t border-border/80 shadow-xs" />
    </div>
  );
};

