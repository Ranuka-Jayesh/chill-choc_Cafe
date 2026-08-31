import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { catalogService } from '@/services/catalogService';
import { cashDrawerService } from '@/services/cashDrawerService';
import { CashierShift, User, Expense } from '@/types';
import { db } from '@/services/storage/db';
import { formatLKR, formatDateTime, rupeesToCents, formatCommaInput } from '@/utils/format';
import {
  Receipt,
  X,
  Plus,
  Search,
  Trash2,
  Pencil,
  Info,
} from 'lucide-react';
import { confirmDialog } from '@/store/useConfirmStore';
import { toast } from 'sonner';

type ExpenseCategoryType =
  | 'EMERGENCY_MILK'
  | 'CLEANING'
  | 'DELIVERY'
  | 'PETTY_CASH'
  | 'MAINTENANCE'
  | 'OTHER';

interface PosExpensesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  shift: CashierShift | null;
  user: User;
}

const CATEGORIES: { id: ExpenseCategoryType; label: string }[] = [
  { id: 'EMERGENCY_MILK', label: 'Emergency Milk / Dairy' },
  { id: 'CLEANING', label: 'Cleaning & Janitorial' },
  { id: 'DELIVERY', label: 'Gas / Ice Delivery' },
  { id: 'PETTY_CASH', label: 'Petty Cash Supplies' },
  { id: 'MAINTENANCE', label: 'Equipment Repair' },
  { id: 'OTHER', label: 'Other Expense' },
];

export const PosExpensesDrawer: React.FC<PosExpensesDrawerProps> = ({
  isOpen,
  onClose,
  shift,
  user,
}) => {
  const [expenses, setExpenses] = useState<Expense[]>(catalogService.getExpenses());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const [title, setTitle] = useState('');
  const [amountRupees, setAmountRupees] = useState('');
  const [category, setCategory] = useState<ExpenseCategoryType>('EMERGENCY_MILK');
  const [search, setSearch] = useState('');
  const [drawerBalanceCents, setDrawerBalanceCents] = useState<number>(0);

  // Close with Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isAddModalOpen) {
          e.preventDefault();
          setIsAddModalOpen(false);
          setEditingExpense(null);
        } else {
          e.preventDefault();
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isAddModalOpen, onClose]);

  // Sync state with storage and active shift
  useEffect(() => {
    const update = () => {
      setExpenses(catalogService.getExpenses());
      if (shift) {
        setDrawerBalanceCents(cashDrawerService.getCurrentDrawerBalance(shift.id));
      } else {
        setDrawerBalanceCents(0);
      }
    };

    update();
    const unsub = db.subscribe(update);
    return unsub;
  }, [shift, isOpen]);

  // Filter shift expenses
  const shiftExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      // If we have a shift start timestamp, only show expenses during this shift
      if (shift) {
        const expTime = new Date(exp.createdAt).getTime();
        const shiftStart = new Date(shift.openedAt).getTime();
        if (expTime < shiftStart) return false;
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          exp.title.toLowerCase().includes(q) ||
          exp.category.toLowerCase().includes(q) ||
          (exp.cashierName && exp.cashierName.toLowerCase().includes(q))
        );
      }

      return true;
    });
  }, [expenses, shift, search]);

  const totalShiftExpenseCents = useMemo(() => {
    return shiftExpenses.reduce((sum, e) => sum + (e.amountCents || 0), 0);
  }, [shiftExpenses]);

  if (!isOpen) return null;

  // Open modal for new expense
  const handleOpenNew = () => {
    setEditingExpense(null);
    setTitle('');
    setAmountRupees('');
    setCategory('EMERGENCY_MILK');
    setIsAddModalOpen(true);
  };

  // Open modal for editing expense
  const handleStartEdit = (exp: Expense) => {
    setEditingExpense(exp);
    setTitle(exp.title);
    setAmountRupees((exp.amountCents / 100).toLocaleString());
    setCategory(exp.category as ExpenseCategoryType);
    setIsAddModalOpen(true);
  };

  // Handle Save (Create or Update) Expense
  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amountCents = rupeesToCents(amountRupees);
    if (amountCents <= 0) {
      toast.error('Please enter a valid positive expense amount.');
      return;
    }

    if (!title.trim()) {
      toast.error('Please enter an expense title or description.');
      return;
    }

    if (!shift) {
      toast.error('No active cashier shift found. Please open shift first.');
      return;
    }

    if (editingExpense) {
      // Edit existing expense
      const oldAmountCents = editingExpense.amountCents;
      const diff = amountCents - oldAmountCents;

      // If amount increased, check drawer cash
      if (editingExpense.paidViaDrawer && diff > 0 && diff > drawerBalanceCents) {
        toast.error(`Cannot withdraw additional ${formatLKR(diff)}. Live drawer cash is only ${formatLKR(drawerBalanceCents)}.`);
        return;
      }

      // Record drawer adjustment if paid via drawer and difference != 0
      if (editingExpense.paidViaDrawer && diff !== 0) {
        if (diff > 0) {
          cashDrawerService.addTransaction({
            shiftId: shift.id,
            terminalId: shift.terminalId || 'POS-01',
            cashierId: user.id,
            cashierName: user.name,
            type: 'CASH_OUT',
            amount: -diff,
            reason: `Adjusted expense increase: ${title.trim()}`,
            expenseCategory: category,
          });
        } else {
          cashDrawerService.addTransaction({
            shiftId: shift.id,
            terminalId: shift.terminalId || 'POS-01',
            cashierId: user.id,
            cashierName: user.name,
            type: 'CASH_IN',
            amount: Math.abs(diff),
            reason: `Adjusted expense refund: ${title.trim()}`,
            expenseCategory: category,
          });
        }
      }

      catalogService.updateExpense(editingExpense.id, {
        title: title.trim(),
        category,
        amountCents,
      });

      toast.success(`Expense "${title.trim()}" updated successfully.`);
    } else {
      // Create new expense
      if (amountCents > drawerBalanceCents) {
        toast.error(`Cannot withdraw ${formatLKR(amountCents)}. Live drawer cash is only ${formatLKR(drawerBalanceCents)}.`);
        return;
      }

      // 1. Add Expense record
      catalogService.addExpense({
        title: title.trim(),
        category,
        amountCents,
        paidViaDrawer: true,
        cashierName: user.name,
      });

      // 2. Record Cash Out transaction in Cash Drawer
      cashDrawerService.addTransaction({
        shiftId: shift.id,
        terminalId: shift.terminalId || 'POS-01',
        cashierId: user.id,
        cashierName: user.name,
        type: 'CASH_OUT',
        amount: -amountCents,
        reason: title.trim(),
        expenseCategory: category,
      });

      toast.success(`Expense of ${formatLKR(amountCents)} recorded and deducted from cash drawer.`);
    }

    setTitle('');
    setAmountRupees('');
    setCategory('EMERGENCY_MILK');
    setEditingExpense(null);
    setIsAddModalOpen(false);
  };

  // Handle Void Expense with Interactive Confirmation Modal
  const handleVoidExpense = async (exp: Expense) => {
    const confirmed = await confirmDialog({
      title: 'Void Operating Expense',
      message: `Are you sure you want to void expense "${exp.title}" (${formatLKR(exp.amountCents)}) and refund the cash back into the drawer?`,
      confirmText: 'Void & Refund',
      variant: 'danger',
    });
    if (!confirmed) return;

    // Remove from expenses list
    catalogService.deleteExpense(exp.id);

    // If it was paid via drawer and we have an active shift, add back cash
    if (exp.paidViaDrawer && shift) {
      cashDrawerService.addTransaction({
        shiftId: shift.id,
        terminalId: shift.terminalId || 'POS-01',
        cashierId: user.id,
        cashierName: user.name,
        type: 'CASH_IN',
        amount: exp.amountCents,
        reason: `Voided expense: ${exp.title}`,
        expenseCategory: exp.category,
      });
    }

    toast.success(`Expense voided. ${formatLKR(exp.amountCents)} returned to cash drawer.`);
  };

  return (
    <>
      {/* 1. SIDE DRAWER LIST VIEW (MATCHING RECENT ORDERS COMPONENT SIZE & DESIGN) */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 flex justify-end bg-brand-brown-deep/50 backdrop-blur-sm animate-in fade-in"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-border animate-in slide-in-from-right duration-200"
        >
          {/* Header */}
          <div className="p-4 bg-cream-50 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-brand-orange" />
              <h3 className="font-extrabold text-sm text-brand-brown-dark">Operating Expenses</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenNew}
                className="flex items-center gap-1 px-3 py-1.5 bg-brand-teal hover:bg-brand-teal-dark text-white font-extrabold text-xs rounded-xl shadow-teal transition-all active:scale-95 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Add</span>
              </button>
              <button onClick={onClose} className="p-1.5 rounded-lg text-text-secondary hover:bg-cream-100 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="p-3 border-b border-border bg-white">
            <div className="relative">
              <Search className="w-4 h-4 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search expenses by title or category..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-cream-50 border border-border rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-teal/40"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {shiftExpenses.length === 0 ? (
              <div className="text-center py-10 text-text-secondary">
                <Receipt className="w-8 h-8 mx-auto text-zinc-300 mb-2" />
                <p className="font-bold text-xs">No matching expenses recorded.</p>
              </div>
            ) : (
              shiftExpenses.map((exp) => (
                <div
                  key={exp.id}
                  className="p-3.5 bg-cream-50/50 rounded-2xl border border-border space-y-2 hover:border-brand-teal/40 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-brand-brown-dark">{exp.title}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cream-200 text-brand-brown uppercase">
                          {exp.category.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-[11px] text-text-secondary mt-0.5">
                        {formatDateTime(exp.createdAt)} • By {exp.cashierName || 'Cashier'}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="font-extrabold text-sm text-status-danger tabular-nums">
                        -{formatLKR(exp.amountCents)}
                      </div>
                      <div className="text-[10px] uppercase font-bold text-brand-orange">
                        {exp.paidViaDrawer ? 'Drawer Cash' : 'Direct'}
                      </div>
                    </div>
                  </div>

                  {/* Actions: Edit & Void */}
                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-cream-200">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(exp)}
                      className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-brand-teal-dark bg-brand-teal-light border border-brand-teal/30 rounded-lg hover:bg-brand-teal hover:text-white transition-colors cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVoidExpense(exp)}
                      className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-status-danger bg-white border border-status-danger/30 rounded-lg hover:bg-status-danger-bg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      Void
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Summary */}
          <div className="p-3.5 bg-cream-50 border-t border-border flex items-center justify-between text-xs font-bold">
            <span className="text-text-secondary">Shift Expenses Total</span>
            <span className="font-black text-sm text-status-danger tabular-nums">
              {formatLKR(totalShiftExpenseCents)}
            </span>
          </div>
        </div>
      </div>

      {/* 2. CENTERED POP-UP MODAL: RECORD / EDIT CASH EXPENSE */}
      {isAddModalOpen &&
        createPortal(
          <div
            onClick={() => {
              setIsAddModalOpen(false);
              setEditingExpense(null);
            }}
            className="fixed inset-0 z-[999999] w-full h-full bg-black/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-hidden animate-in fade-in"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md sm:max-w-lg flex flex-col max-h-[92vh]"
            >
              {/* Header Above Card: Title on left, Cancel & Save on right */}
              <div className="flex items-center justify-between gap-3 mb-3 px-1 shrink-0">
                <div className="min-w-0 flex-1">
                  <h3 className="font-extrabold text-base sm:text-lg text-white drop-shadow-xs truncate">
                    {editingExpense ? 'Edit Operating Expense' : 'Record Cash Expense'}
                  </h3>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddModalOpen(false);
                      setEditingExpense(null);
                    }}
                    className="px-4 py-2 rounded-full border border-white/30 text-white hover:bg-white/10 text-xs font-bold transition-all whitespace-nowrap cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="pos-expense-form"
                    className="px-5 py-2 rounded-full bg-brand-teal hover:bg-brand-teal-dark text-white font-extrabold text-xs shadow-teal transition-all active:scale-95 whitespace-nowrap cursor-pointer"
                  >
                    {editingExpense ? 'Update Expense' : 'Deduct & Save'}
                  </button>
                </div>
              </div>

              {/* Centered Modal Card Content */}
              <div className="w-full bg-white rounded-3xl shadow-2xl border border-[#E9E0D5] overflow-y-auto">
                <form id="pos-expense-form" onSubmit={handleSaveExpense} className="p-5 sm:p-6 space-y-4">
                  {/* Expense Description */}
                  <div>
                    <label className="text-[11px] font-bold uppercase text-text-secondary block mb-1">
                      Expense Description <span className="text-status-danger">*</span>
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Fresh milk 2L, Cleaning liquid, Mint leaves"
                      className="w-full pb-2 pt-1 bg-transparent border-0 border-b border-[#E2D8CC] text-sm font-bold text-brand-brown-dark focus:outline-none focus:border-brand-teal rounded-none transition-colors"
                      required
                      autoFocus
                    />
                  </div>

                  {/* Category Selector */}
                  <div>
                    <label className="text-[11px] font-bold uppercase text-text-secondary block mb-1">
                      Expense Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as ExpenseCategoryType)}
                      className="w-full pb-2 pt-1 bg-transparent border-0 border-b border-[#E2D8CC] text-sm font-bold text-brand-brown-dark focus:outline-none focus:border-brand-teal rounded-none transition-colors cursor-pointer"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Amount (Rs.) Input */}
                  <div>
                    <label className="text-[11px] font-bold uppercase text-text-secondary block mb-1">
                      Amount (LKR) <span className="text-status-danger">*</span>
                    </label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-brand-brown-deep">
                        Rs.
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={amountRupees}
                        onChange={(e) => setAmountRupees(formatCommaInput(e.target.value))}
                        placeholder="0.00"
                        className="w-full pl-10 pr-3 pb-2 pt-1 bg-transparent border-0 border-b border-[#E2D8CC] text-base font-black text-brand-brown-dark focus:outline-none focus:border-brand-teal rounded-none transition-colors"
                        required
                      />
                    </div>

                    {/* Quick Amount Preset Buttons */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {[100, 250, 500, 1000, 2000].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setAmountRupees(preset.toLocaleString())}
                          className="px-2.5 py-1 rounded-lg bg-cream-100 hover:bg-cream-200 border border-[#E0D7CC] text-[10px] font-extrabold text-brand-brown transition-colors cursor-pointer"
                        >
                          +Rs. {preset.toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Cash Out Notice */}
                  <div className="pt-2 text-[11px] text-text-secondary font-medium flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-brand-teal shrink-0" />
                    <span>{editingExpense ? 'Adjusts difference automatically in the cash drawer.' : 'This expense will immediately deduct from the cashier active drawer balance.'}</span>
                  </div>
                </form>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
