import React, { useState, useEffect, useMemo } from 'react';
import { cashDrawerService } from '@/services/cashDrawerService';
import { db } from '@/services/storage/db';
import { realtimeSocketService } from '@/services/realtimeSocketService';
import { CashierShift, CashDrawerTransaction, User } from '@/types';
import { formatLKR, rupeesToCents, formatCommaInput } from '@/utils/format';
import { format } from 'date-fns';
import {
  X,
  ArrowDownRight,
  ArrowUpRight,
  Delete,
  Clock,
  Check,
  Building2,
  History,
  Coins,
} from 'lucide-react';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { toast } from 'sonner';

interface CashInOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: CashierShift;
  user: User;
}

export const CashInOutModal: React.FC<CashInOutModalProps> = ({
  isOpen,
  onClose,
  shift,
  user,
}) => {
  const [tab, setTab] = useState<'CASH_OUT' | 'CASH_IN' | 'CASH_DROP'>('CASH_OUT');
  const [amountRupees, setAmountRupees] = useState('');
  const [reason, setReason] = useState('');
  const [expenseCategory, setExpenseCategory] = useState<
    'EMERGENCY_MILK' | 'CLEANING' | 'DELIVERY' | 'PETTY_CASH' | 'OTHER'
  >('EMERGENCY_MILK');

  const [currentBalance, setCurrentBalance] = useState<number>(() =>
    shift ? cashDrawerService.getCurrentDrawerBalance(shift.id) : 0
  );
  const [transactions, setTransactions] = useState<CashDrawerTransaction[]>(() =>
    shift ? cashDrawerService.getTransactions(shift.id) : []
  );

  // Real-time balance & transactions sync while modal is open
  useEffect(() => {
    if (!isOpen || !shift?.id) return;

    const syncDrawerState = () => {
      setCurrentBalance(cashDrawerService.getCurrentDrawerBalance(shift.id));
      setTransactions(cashDrawerService.getTransactions(shift.id));
    };

    syncDrawerState();
    const unsubDb = db.subscribe(syncDrawerState);
    const unsubTx = realtimeSocketService.on('DRAWER_TRANSACTION', syncDrawerState);
    const unsubApprove = realtimeSocketService.on('DRAWER_REQUEST_APPROVED', syncDrawerState);
    const unsubReject = realtimeSocketService.on('DRAWER_REQUEST_REJECTED', syncDrawerState);
    const unsubPending = realtimeSocketService.on('DRAWER_REQUEST_PENDING', syncDrawerState);

    const handleStorage = (e: StorageEvent) => {
      if (e.key?.includes('cafemm') || e.key?.includes('drawer')) {
        syncDrawerState();
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      unsubDb();
      unsubTx();
      unsubApprove();
      unsubReject();
      unsubPending();
      window.removeEventListener('storage', handleStorage);
    };
  }, [isOpen, shift?.id]);

  // Today's summary stats
  const summaryStats = useMemo(() => {
    const loginFloat = shift.openingCash || 0;
    let cashInTotal = 0;
    let cashOutApproved = 0;
    let cashOutPending = 0;
    let cashDropApproved = 0;
    let cashDropPending = 0;

    transactions.forEach((tx) => {
      if (tx.type === 'CASH_IN' && tx.status !== 'REJECTED') {
        cashInTotal += Math.abs(tx.amount);
      } else if (tx.type === 'CASH_OUT') {
        if (tx.status === 'APPROVED') cashOutApproved += Math.abs(tx.amount);
        if (tx.status === 'PENDING_APPROVAL') cashOutPending += Math.abs(tx.amount);
      } else if (tx.type === 'CASH_DROP') {
        if (tx.status === 'APPROVED') cashDropApproved += Math.abs(tx.amount);
        if (tx.status === 'PENDING_APPROVAL') cashDropPending += Math.abs(tx.amount);
      }
    });

    return {
      loginFloat,
      cashInTotal,
      cashOutApproved,
      cashOutPending,
      cashDropApproved,
      cashDropPending,
    };
  }, [shift, transactions]);

  // Numpad handler (strictly single entry)
  const handleNumpad = (char: string) => {
    if (char === 'CLEAR') {
      setAmountRupees('');
    } else if (char === 'BACKSPACE') {
      setAmountRupees((prev) => prev.slice(0, -1));
    } else if (char === '.') {
      setAmountRupees((prev) => {
        if (prev.includes('.')) return prev;
        return prev ? prev + '.' : '0.';
      });
    } else {
      setAmountRupees((prev) => {
        if (prev === '0') return char;
        if (prev.includes('.')) {
          const parts = prev.split('.');
          if (parts[1] && parts[1].length >= 2) return prev;
        }
        return prev + char;
      });
    }
  };

  const handlePresetAmount = (val: number) => {
    setAmountRupees(String(val));
  };

  // Keyboard handler with single-dispatch protection
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // If user is focused on reason input field, let them type text normally
      const activeEl = document.activeElement;
      const isTypingText =
        activeEl?.id === 'drawer-reason-input' || activeEl?.tagName === 'TEXTAREA';
      if (isTypingText) {
        if (e.key === 'Enter') {
          handleSubmit();
        }
        return;
      }

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleNumpad(e.key);
      } else if (e.key === '.') {
        e.preventDefault();
        handleNumpad('.');
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleNumpad('BACKSPACE');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, amountRupees, tab, reason, expenseCategory, onClose]);

  if (!isOpen) return null;

  const amountCents = rupeesToCents(amountRupees);

  // Projected balance calculation
  let projectedBalance = currentBalance;
  if (tab === 'CASH_IN') {
    projectedBalance = currentBalance + amountCents;
  } else {
    projectedBalance = Math.max(0, currentBalance - amountCents);
  }

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (amountCents <= 0) {
      toast.error('Please enter a valid positive cash amount.');
      return;
    }

    if (tab === 'CASH_OUT' || tab === 'CASH_DROP') {
      if (amountCents > currentBalance) {
        toast.error(
          `Cannot withdraw ${formatLKR(amountCents)} from drawer balance of ${formatLKR(
            currentBalance
          )}.`
        );
        return;
      }
      if (!reason.trim()) {
        toast.error('A clear justification reason is required.');
        return;
      }
    }

    if (tab === 'CASH_IN') {
      cashDrawerService.addTransaction({
        shiftId: shift.id,
        terminalId: shift.terminalId,
        cashierId: user.id,
        cashierName: user.name,
        type: 'CASH_IN',
        amount: amountCents,
        reason: reason || 'Float top-up',
        status: 'APPROVED',
      });
      toast.success(`Cash In of ${formatLKR(amountCents)} added to drawer.`);
    } else if (tab === 'CASH_OUT') {
      cashDrawerService.requestCashMovement({
        shiftId: shift.id,
        terminalId: shift.terminalId,
        cashierId: user.id,
        cashierName: user.name,
        type: 'CASH_OUT',
        amount: amountCents,
        reason: reason.trim(),
        expenseCategory,
      });
      toast.success(
        `Cash Out request of ${formatLKR(amountCents)} submitted to Admin for authorization.`
      );
    } else if (tab === 'CASH_DROP') {
      cashDrawerService.requestCashMovement({
        shiftId: shift.id,
        terminalId: shift.terminalId,
        cashierId: user.id,
        cashierName: user.name,
        type: 'CASH_DROP',
        amount: amountCents,
        reason: reason.trim() || 'Transfer to safe deposit',
      });
      toast.success(
        `Safe Drop request of ${formatLKR(amountCents)} submitted to Admin for authorization.`
      );
    }

    setAmountRupees('');
  };

  const quickReasonPresets = {
    CASH_OUT: [
      'Fresh Milk Purchase',
      'Ice Bags Bar',
      'Table Napkins',
      'Courier / Gas',
    ],
    CASH_DROP: [
      'Transfer to Safe',
      'Mid-day Cash Skim',
      'Large Notes Drop',
    ],
    CASH_IN: [
      'Float Top-up',
      'Small Notes Change',
      'Coins Addition',
    ],
  };

  // Filter relevant drawer movement records for display
  const movementRecords = transactions.filter(
    (t) =>
      t.type === 'OPENING_CASH' ||
      t.type === 'CASH_IN' ||
      t.type === 'CASH_OUT' ||
      t.type === 'CASH_DROP' ||
      t.type === 'CLOSING_ADJUSTMENT'
  );

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-md animate-in fade-in overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-6xl xl:max-w-7xl space-y-3 my-auto animate-in zoom-in-95 duration-200"
      >
        {/* Top Header Row (Outside Cards) */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Cash Drawer Operations
            </h2>
            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-white/20 text-white border border-white/20">
              Shift #{shift.shiftNumber || 101} • {shift.terminalId || 'POS-01'}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold transition-all cursor-pointer backdrop-blur-sm shadow-xs active:scale-95"
          >
            <X className="w-4 h-4" />
            <span>Close</span>
          </button>
        </div>

        {/* 2 Cards Layout (Left: 5 cols Entry & Keypad | Right: 7 cols Reason, Summary & Action) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* Card 1: Entry, Presets & Touchscreen Keypad (Left) */}
          <div className="lg:col-span-5 flex flex-col justify-between bg-white rounded-2xl sm:rounded-[28px] shadow-2xl border border-[#E9E0D5] overflow-hidden">
            {/* 1. Operation Selector Tabs */}
            <div className="p-3.5 sm:p-4 bg-[#FAF7F2] border-b border-[#EAE3DA]">
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setTab('CASH_OUT')}
                  className={`flex items-center justify-center gap-1.5 py-2.5 sm:py-3 rounded-2xl font-black text-xs sm:text-sm transition-all active:scale-95 cursor-pointer ${
                    tab === 'CASH_OUT'
                      ? 'bg-status-danger text-white shadow-sm ring-2 ring-status-danger'
                      : 'bg-white text-brand-brown-dark border border-[#E0D7CC] hover:bg-cream-100'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4 stroke-[2.2]" />
                  <span>Cash Out</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTab('CASH_IN')}
                  className={`flex items-center justify-center gap-1.5 py-2.5 sm:py-3 rounded-2xl font-black text-xs sm:text-sm transition-all active:scale-95 cursor-pointer ${
                    tab === 'CASH_IN'
                      ? 'bg-brand-teal text-white shadow-teal ring-2 ring-brand-teal'
                      : 'bg-white text-brand-brown-dark border border-[#E0D7CC] hover:bg-cream-100'
                  }`}
                >
                  <ArrowDownRight className="w-4 h-4 stroke-[2.2]" />
                  <span>Cash In</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTab('CASH_DROP')}
                  className={`flex items-center justify-center gap-1.5 py-2.5 sm:py-3 rounded-2xl font-black text-xs sm:text-sm transition-all active:scale-95 cursor-pointer ${
                    tab === 'CASH_DROP'
                      ? 'bg-brand-brown-dark text-white shadow-sm ring-2 ring-brand-brown-dark'
                      : 'bg-white text-brand-brown-dark border border-[#E0D7CC] hover:bg-cream-100'
                  }`}
                >
                  <Building2 className="w-4 h-4 stroke-[2.2]" />
                  <span>Cash Drop</span>
                </button>
              </div>
            </div>

            {/* 2. Balance Header Strip */}
            <div className="px-5 py-2.5 bg-white border-b border-[#EAE3DA] flex items-center justify-between">
              <div>
                <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-text-muted block">
                  Current Balance
                </span>
                <span className="text-base sm:text-lg font-black text-brand-brown-dark font-mono tabular-nums">
                  {formatLKR(currentBalance)}
                </span>
              </div>

              <div className="text-right">
                <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-text-muted block">
                  Projected Balance
                </span>
                <span className="text-base sm:text-lg font-black text-brand-teal font-mono tabular-nums">
                  {formatLKR(projectedBalance)}
                </span>
              </div>
            </div>

            {/* 3. Amount Field & Quick Presets */}
            <div className="p-4 sm:p-5 space-y-3 flex-1 flex flex-col justify-center">
              <div className="space-y-1">
                <label className="text-[11px] font-black uppercase tracking-wider text-text-muted block">
                  Amount (Rs.)
                </label>
                <div className="relative flex items-center bg-white border-2 border-brand-teal rounded-2xl shadow-xs px-4 py-2.5 sm:py-3">
                  <span className="font-black text-brand-brown-dark text-lg sm:text-xl">Rs.</span>
                  <div className="w-full text-right font-mono font-black text-2xl sm:text-3xl text-brand-brown-dark tabular-nums select-none">
                    {amountRupees ? formatCommaInput(amountRupees) : <span className="text-text-muted/40 font-medium">0.00</span>}
                  </div>
                </div>
              </div>

              {/* Quick Cash Presets */}
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => handlePresetAmount(currentBalance / 100)}
                  className="py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-xs font-black text-amber-900 transition-colors cursor-pointer active:scale-95 shadow-2xs"
                >
                  All Cash
                </button>
                {[500, 1000, 2000, 3000, 5000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handlePresetAmount(preset)}
                    className="py-2 rounded-xl border border-[#E0D7CC] bg-[#FAF7F2] hover:bg-cream-100 text-xs font-bold text-brand-brown-dark transition-colors cursor-pointer active:scale-95 shadow-2xs"
                  >
                    Rs. {preset.toLocaleString()}
                  </button>
                ))}
              </div>

              {/* Number Pad Grid */}
              <div className="pt-2 flex flex-col items-center justify-center space-y-2.5">
                <div className="grid grid-cols-3 gap-2.5 sm:gap-3 place-items-center w-full max-w-[280px] sm:max-w-[300px]">
                  {['7', '8', '9', '4', '5', '6', '1', '2', '3'].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleNumpad(num)}
                      className="w-14 h-14 sm:w-15 sm:h-15 aspect-square rounded-full bg-white border-2 border-[#E0D7CC] shadow-xs font-mono font-black text-xl sm:text-2xl text-brand-brown-dark hover:bg-cream-100 hover:border-brand-teal/50 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleNumpad('CLEAR')}
                    className="w-14 h-14 sm:w-15 sm:h-15 aspect-square rounded-full bg-white border-2 border-rose-200 shadow-xs font-bold text-xs text-rose-700 hover:bg-rose-50 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNumpad('0')}
                    className="w-14 h-14 sm:w-15 sm:h-15 aspect-square rounded-full bg-white border-2 border-[#E0D7CC] shadow-xs font-mono font-black text-xl sm:text-2xl text-brand-brown-dark hover:bg-cream-100 hover:border-brand-teal/50 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNumpad('.')}
                    className="w-14 h-14 sm:w-15 sm:h-15 aspect-square rounded-full bg-white border-2 border-[#E0D7CC] shadow-xs font-mono font-black text-xl sm:text-2xl text-brand-brown-dark hover:bg-cream-100 hover:border-brand-teal/50 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                  >
                    .
                  </button>
                </div>

                <div className="w-full max-w-[280px] sm:max-w-[300px]">
                  <button
                    type="button"
                    onClick={() => handleNumpad('BACKSPACE')}
                    className="w-full h-11 bg-white hover:bg-cream-100 rounded-full border-2 border-[#E0D7CC] flex items-center justify-center gap-2 text-xs sm:text-sm font-black text-brand-brown-dark active:scale-95 transition-all cursor-pointer shadow-xs"
                  >
                    <Delete className="w-4 h-4" />
                    <span>Backspace</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Reason, Today's Summary & Primary Action (Right) */}
          <div className="lg:col-span-7 flex flex-col justify-between bg-white rounded-2xl sm:rounded-[28px] p-5 sm:p-6 shadow-2xl border border-[#E9E0D5]">
            <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
              {/* Top Configuration & Reason */}
              <div className="space-y-3 pb-3 border-b border-[#EAE3DA]">
                {/* Expense Category (Only for Cash Out) */}
                {tab === 'CASH_OUT' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted block">
                      Expense Category
                    </label>
                    <CustomSelect
                      value={expenseCategory}
                      onChange={(val) => setExpenseCategory(val as any)}
                      options={[
                        { value: 'EMERGENCY_MILK', label: 'Emergency Milk / Dairy' },
                        { value: 'CLEANING', label: 'Cleaning & Sanitization' },
                        { value: 'DELIVERY', label: 'Ice / Gas Delivery' },
                        { value: 'PETTY_CASH', label: 'Petty Cash / Supplies' },
                        { value: 'OTHER', label: 'Other Expense' },
                      ]}
                      buttonClassName="bg-white border-[#E0D7CC] rounded-xl h-9 text-xs font-bold"
                    />
                  </div>
                )}

                {/* Reason / Justification Note */}
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted block">
                    Reason / Justification Note
                  </label>
                  <input
                    id="drawer-reason-input"
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Enter justification note..."
                    className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#E0D7CC] rounded-xl text-xs font-bold text-brand-brown-dark focus:outline-none focus:ring-2 focus:ring-brand-teal/40 transition-all"
                  />

                  {/* Quick Reason Chips */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {quickReasonPresets[tab].map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setReason(preset)}
                        className="text-xs font-bold px-3 py-1.5 sm:py-2 rounded-xl bg-[#FAF7F2] border border-[#E0D7CC] text-brand-brown-dark hover:bg-cream-100 hover:border-brand-teal transition-all cursor-pointer shadow-2xs active:scale-95"
                      >
                        + {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notice Pill */}
                <div>
                  {tab === 'CASH_IN' ? (
                    <div className="text-[11px] font-semibold text-emerald-800 flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Instant float addition to register drawer.</span>
                    </div>
                  ) : (
                    <div className="text-[11px] font-semibold text-amber-900 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Requires Admin authorization before funds are released.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Today's Summary Strip (Single Line Design) */}
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="p-2.5 bg-[#FAF7F2] rounded-xl border border-[#EAE3DA] space-y-0.5">
                  <span className="text-[9px] uppercase font-bold text-text-muted block truncate">
                    Login Float
                  </span>
                  <span className="font-mono font-black text-brand-brown-dark text-xs sm:text-sm truncate block">
                    {formatLKR(summaryStats.loginFloat)}
                  </span>
                </div>
                <div className="p-2.5 bg-[#FAF7F2] rounded-xl border border-[#EAE3DA] space-y-0.5">
                  <span className="text-[9px] uppercase font-bold text-emerald-800 block truncate">
                    Total Cash In
                  </span>
                  <span className="font-mono font-black text-emerald-800 text-xs sm:text-sm truncate block">
                    {formatLKR(summaryStats.cashInTotal)}
                  </span>
                </div>
                <div className="p-2.5 bg-[#FAF7F2] rounded-xl border border-[#EAE3DA] space-y-0.5">
                  <span className="text-[9px] uppercase font-bold text-rose-700 block truncate">
                    Cash Out {summaryStats.cashOutPending > 0 ? `(${formatLKR(summaryStats.cashOutPending)} pend)` : ''}
                  </span>
                  <span className="font-mono font-black text-rose-700 text-xs sm:text-sm truncate block">
                    {formatLKR(summaryStats.cashOutApproved)}
                  </span>
                </div>
                <div className="p-2.5 bg-[#FAF7F2] rounded-xl border border-[#EAE3DA] space-y-0.5">
                  <span className="text-[9px] uppercase font-bold text-brand-brown-dark block truncate">
                    Safe Drop {summaryStats.cashDropPending > 0 ? `(${formatLKR(summaryStats.cashDropPending)} pend)` : ''}
                  </span>
                  <span className="font-mono font-black text-brand-brown-dark text-xs sm:text-sm truncate block">
                    {formatLKR(summaryStats.cashDropApproved)}
                  </span>
                </div>
              </div>

              {/* Movement & Requests List with Minimal Bottom Borders Only */}
              <div className="flex-1 flex flex-col min-h-0 pt-1 overflow-hidden">
                <div className="text-[9.5px] font-extrabold uppercase tracking-wider text-text-muted pb-1 flex items-center justify-between">
                  <span>Shift Movement Logs</span>
                  <span>{movementRecords.length} records</span>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-[#EAE3DA] max-h-[230px] sm:max-h-[260px] pr-1">
                  {movementRecords.length === 0 ? (
                    <div className="py-8 text-center text-xs text-text-muted">
                      No cash movements recorded in this shift yet.
                    </div>
                  ) : (
                    movementRecords.map((item) => {
                      const isApproved = item.status === 'APPROVED' || !item.status;
                      const isPending = item.status === 'PENDING_APPROVAL';
                      const isRejected = item.status === 'REJECTED';

                      let typeLabel = item.type.replace(/_/g, ' ');
                      if (item.type === 'OPENING_CASH') typeLabel = 'Login Float';
                      if (item.type === 'CASH_OUT') typeLabel = 'Cash Out';
                      if (item.type === 'CASH_DROP') typeLabel = 'Safe Drop';
                      if (item.type === 'CASH_IN') typeLabel = 'Cash In';

                      return (
                        <div
                          key={item.id}
                          className="py-3 sm:py-3.5 flex items-center justify-between gap-3 border-b border-[#EAE3DA] text-xs hover:bg-[#FAF7F2]/60 transition-colors"
                        >
                          {/* Single Line Info (Type • Time • Reason) */}
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="font-extrabold text-brand-brown-dark text-xs sm:text-sm shrink-0">
                              {typeLabel}
                            </span>
                            <span className="text-[10.5px] sm:text-[11px] text-text-muted shrink-0">
                              {format(new Date(item.timestamp), 'hh:mm a')}
                            </span>
                            <span className="text-text-muted/40 shrink-0">•</span>
                            <span className="text-[11.5px] sm:text-xs text-text-secondary truncate">
                              {item.reason || (item.type === 'OPENING_CASH' ? 'Opening cash float' : '-')}
                            </span>
                          </div>

                          {/* Single Line Right (Amount + Status Badge) */}
                          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
                            <span className="font-mono font-black text-brand-brown-dark text-xs sm:text-sm tabular-nums">
                              {formatLKR(Math.abs(item.amount))}
                            </span>
                            {isPending && (
                              <span className="inline-flex items-center gap-1 text-[9.5px] font-black uppercase text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                <Clock className="w-2.5 h-2.5" />
                                <span>Pending</span>
                              </span>
                            )}
                            {isApproved && (
                              <span className="inline-flex items-center gap-1 text-[9.5px] font-black uppercase text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                <Check className="w-2.5 h-2.5" />
                                <span>Approved</span>
                              </span>
                            )}
                            {isRejected && (
                              <span className="inline-flex items-center gap-1 text-[9.5px] font-black uppercase text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                                <span>Rejected</span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Action Bar */}
            <div className="pt-3 border-t border-[#EAE3DA] mt-3">
              <button
                type="button"
                onClick={() => handleSubmit()}
                className={`w-full py-3.5 sm:py-4 rounded-2xl font-black text-xs sm:text-sm shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  tab === 'CASH_IN'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-teal'
                    : tab === 'CASH_OUT'
                    ? 'bg-status-danger hover:bg-status-danger/90 text-white'
                    : 'bg-brand-brown-dark hover:bg-brand-brown text-white'
                }`}
              >
                {tab === 'CASH_IN' ? (
                  <>
                    <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>Confirm Cash In</span>
                  </>
                ) : tab === 'CASH_OUT' ? (
                  <>
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>Submit Cash Out Request</span>
                  </>
                ) : (
                  <>
                    <Building2 className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>Submit Safe Drop Request</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
