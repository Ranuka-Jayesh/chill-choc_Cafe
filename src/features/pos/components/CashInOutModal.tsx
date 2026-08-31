import React, { useState, useEffect } from 'react';
import { cashDrawerService } from '@/services/cashDrawerService';
import { catalogService } from '@/services/catalogService';
import { CashierShift, User } from '@/types';
import { formatLKR, rupeesToCents, formatCommaInput } from '@/utils/format';
import { X, ArrowDownRight, ArrowUpRight, ShieldAlert, Coins } from 'lucide-react';
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
  const [tab, setTab] = useState<'CASH_IN' | 'CASH_OUT' | 'CASH_DROP'>('CASH_OUT');
  const [amountRupees, setAmountRupees] = useState('');
  const [reason, setReason] = useState('Emergency fresh milk purchase');
  const [expenseCategory, setExpenseCategory] = useState<'EMERGENCY_MILK' | 'CLEANING' | 'DELIVERY' | 'PETTY_CASH' | 'OTHER'>('EMERGENCY_MILK');

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

  const currentBalance = cashDrawerService.getCurrentDrawerBalance(shift.id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountCents = rupeesToCents(amountRupees);
    if (amountCents <= 0) {
      toast.error('Please enter a valid positive cash amount.');
      return;
    }

    if (tab === 'CASH_OUT' || tab === 'CASH_DROP') {
      if (amountCents > currentBalance) {
        toast.error(`Cannot withdraw ${formatLKR(amountCents)} from drawer with balance ${formatLKR(currentBalance)}.`);
        return;
      }
      if (!reason.trim()) {
        toast.error('A clear reason is required for Cash Out.');
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
        reason: reason || 'Cash in / Float top-up',
      });
      toast.success(`Cash In of ${formatLKR(amountCents)} recorded.`);
    } else if (tab === 'CASH_OUT') {
      cashDrawerService.addTransaction({
        shiftId: shift.id,
        terminalId: shift.terminalId,
        cashierId: user.id,
        cashierName: user.name,
        type: 'CASH_OUT',
        amount: -amountCents,
        reason,
        expenseCategory,
      });

      // Also record in expenses table
      catalogService.addExpense({
        category: expenseCategory,
        title: reason,
        amountCents,
        paidViaDrawer: true,
        shiftId: shift.id,
        cashierId: user.id,
        cashierName: user.name,
      });

      toast.success(`Cash Out of ${formatLKR(amountCents)} recorded.`);
    } else if (tab === 'CASH_DROP') {
      cashDrawerService.addTransaction({
        shiftId: shift.id,
        terminalId: shift.terminalId,
        cashierId: user.id,
        cashierName: user.name,
        type: 'CASH_DROP',
        amount: -amountCents,
        reason: reason || 'Transfer to safe deposit',
      });
      toast.success(`Cash Drop of ${formatLKR(amountCents)} transferred to safe.`);
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
            <div className="w-10 h-10 rounded-2xl bg-brand-yellow-light text-brand-orange border border-brand-yellow/30 flex items-center justify-center shadow-xs">
              <Coins className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="font-black text-base text-brand-brown-dark tracking-tight">Cash Drawer Operations</h3>
              <p className="text-xs text-text-secondary mt-0.5">Current Balance: {formatLKR(currentBalance)}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl text-text-secondary hover:bg-cream-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-3 gap-1.5 p-2 bg-cream-50/80 border-b border-border/70">
          <button
            onClick={() => {
              setTab('CASH_OUT');
              setReason('Emergency fresh milk purchase');
            }}
            className={`py-2.5 rounded-xl text-xs font-black transition-all active:scale-95 ${
              tab === 'CASH_OUT'
                ? 'bg-status-danger text-white shadow-sm'
                : 'text-text-secondary hover:text-brand-brown-dark'
            }`}
          >
            Cash Out
          </button>
          <button
            onClick={() => {
              setTab('CASH_IN');
              setReason('Float top-up');
            }}
            className={`py-2.5 rounded-xl text-xs font-black transition-all active:scale-95 ${
              tab === 'CASH_IN'
                ? 'bg-status-success text-white shadow-sm'
                : 'text-text-secondary hover:text-brand-brown-dark'
            }`}
          >
            Cash In
          </button>
          <button
            onClick={() => {
              setTab('CASH_DROP');
              setReason('Transfer to safe deposit');
            }}
            className={`py-2.5 rounded-xl text-xs font-black transition-all active:scale-95 ${
              tab === 'CASH_DROP'
                ? 'bg-brand-brown text-white shadow-sm'
                : 'text-text-secondary hover:text-brand-brown-dark'
            }`}
          >
            Cash Drop
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 bg-white">
          <div>
            <label className="text-xs font-black uppercase text-text-secondary">
              Amount (Rs.)
            </label>
            <input
              type="text"
              placeholder="e.g. 2,500"
              value={formatCommaInput(amountRupees)}
              onChange={(e) => setAmountRupees(e.target.value.replace(/,/g, ''))}
              className="w-full mt-1 px-4 py-3 bg-cream-50 border border-border rounded-2xl text-xl font-black text-brand-brown-deep tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-teal/40"
              autoFocus
              required
            />
          </div>

          {tab === 'CASH_OUT' && (
            <div>
              <CustomSelect
                label="Expense Category"
                value={expenseCategory}
                onChange={(val) => setExpenseCategory(val as any)}
                options={[
                  { value: 'EMERGENCY_MILK', label: 'Emergency Milk / Dairy' },
                  { value: 'CLEANING', label: 'Cleaning & Sanitization' },
                  { value: 'DELIVERY', label: 'Ice / Gas Delivery' },
                  { value: 'PETTY_CASH', label: 'Petty Cash / Supplies' },
                  { value: 'OTHER', label: 'Other Expense' },
                ]}
              />
            </div>
          )}

          <div>
            <label className="text-xs font-black uppercase text-text-secondary">
              Reason / Justification Note
            </label>
            <input
              type="text"
              placeholder="Detailed reason..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full mt-1 px-4 py-3 bg-cream-50 border border-border rounded-2xl text-xs font-bold text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-teal/40"
              required
            />
          </div>

          <div className="p-3.5 bg-cream-50/90 rounded-2xl border border-border text-[11px] text-text-secondary flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-brand-orange flex-shrink-0 mt-0.5" />
            <span className="leading-snug">
              This cash movement will be permanently recorded in the immutable shift ledger and linked to cashier <strong>{user.name}</strong>.
            </span>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 rounded-2xl border border-border text-xs font-black text-text-secondary hover:bg-cream-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-7 py-3 rounded-2xl bg-brand-teal hover:bg-brand-teal-dark text-white font-black text-xs shadow-teal active:scale-95 transition-all"
            >
              Confirm Transaction
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
