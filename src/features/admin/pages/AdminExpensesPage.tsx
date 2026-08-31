import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { catalogService } from '@/services/catalogService';
import { cashDrawerService } from '@/services/cashDrawerService';
import { shiftService } from '@/services/shiftService';
import { Expense } from '@/types';
import { db } from '@/services/storage/db';
import { formatLKR, formatDateTime, rupeesToCents, formatCommaInput } from '@/utils/format';
import {
  Receipt,
  Plus,
  Coins,
  X,
  Search,
  SlidersHorizontal,
  DollarSign,
  Wallet,
  CreditCard,
  Building2,
  Trash2,
  Pencil,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Tag,
} from 'lucide-react';
import { CustomSelect, SelectOption } from '@/components/ui/CustomSelect';
import { MonthYearPicker, MonthYearValue } from '@/components/ui/MonthYearPicker';
import { useAuthStore } from '@/store/useAuthStore';
import { confirmDialog } from '@/store/useConfirmStore';
import { toast } from 'sonner';

type ExpenseCategoryType =
  | 'CLEANING'
  | 'EMERGENCY_MILK'
  | 'DELIVERY'
  | 'PETTY_CASH'
  | 'MAINTENANCE'
  | 'UTILITIES'
  | 'OTHER';

const CATEGORY_OPTIONS: SelectOption[] = [
  { value: 'ALL', label: 'All Categories' },
  { value: 'CLEANING', label: 'Cleaning & Janitorial' },
  { value: 'EMERGENCY_MILK', label: 'Emergency Dairy / Milk' },
  { value: 'DELIVERY', label: 'Ice / Gas Delivery' },
  { value: 'PETTY_CASH', label: 'Petty Cash / Supplies' },
  { value: 'MAINTENANCE', label: 'Equipment Maintenance' },
  { value: 'UTILITIES', label: 'Utilities & Bills' },
  { value: 'OTHER', label: 'Other Expenses' },
];

export const AdminExpensesPage: React.FC = () => {
  const { session } = useAuthStore();
  const [expenses, setExpenses] = useState(catalogService.getExpenses());
  const [activeShift, setActiveShift] = useState(shiftService.getActiveShift());

  // Date Range (defaults to current year/month)
  const now = new Date();
  const currentMonthStr = String(now.getMonth() + 1);
  const currentYearStr = String(now.getFullYear());

  const [dateRange, setDateRange] = useState<MonthYearValue>({
    year: currentYearStr,
    month: currentMonthStr,
  });

  // Search & Filters
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Modal State
  const [isCreating, setIsCreating] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [title, setTitle] = useState('');
  const [amountRupees, setAmountRupees] = useState('');
  const [category, setCategory] = useState<ExpenseCategoryType>('CLEANING');
  const [paidViaDrawer, setPaidViaDrawer] = useState(false);

  useEffect(() => {
    const unsub = db.subscribe(() => {
      setExpenses(catalogService.getExpenses());
      setActiveShift(shiftService.getActiveShift());
    });
    return unsub;
  }, []);

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      // Category Filter
      if (categoryFilter !== 'ALL' && exp.category !== categoryFilter) return false;

      // Month & Year Filter
      if (dateRange.year !== 'ALL') {
        const expDate = new Date(exp.createdAt);
        if (String(expDate.getFullYear()) !== dateRange.year) return false;
        if (dateRange.month !== 'ALL' && String(expDate.getMonth() + 1) !== dateRange.month) return false;
      }

      // Text Search
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
  }, [expenses, categoryFilter, dateRange, search]);

  // Overall & Filtered KPI stats
  const totalFilteredExpenseCents = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + (e.amountCents || 0), 0);
  }, [filteredExpenses]);

  const totalDrawerExpenseCents = useMemo(() => {
    return filteredExpenses.filter((e) => e.paidViaDrawer).reduce((sum, e) => sum + (e.amountCents || 0), 0);
  }, [filteredExpenses]);

  const totalDirectExpenseCents = useMemo(() => {
    return filteredExpenses.filter((e) => !e.paidViaDrawer).reduce((sum, e) => sum + (e.amountCents || 0), 0);
  }, [filteredExpenses]);

  const avgExpenseCents = filteredExpenses.length > 0
    ? Math.round(totalFilteredExpenseCents / filteredExpenses.length)
    : 0;

  // Open Edit Modal
  const handleStartEdit = (exp: Expense) => {
    setEditingExpense(exp);
    setTitle(exp.title);
    setAmountRupees((exp.amountCents / 100).toLocaleString());
    setCategory(exp.category as ExpenseCategoryType);
    setPaidViaDrawer(Boolean(exp.paidViaDrawer));
    setIsCreating(true);
  };

  // Handle Create / Update Expense
  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const amountCents = rupeesToCents(amountRupees);
    if (amountCents <= 0 || !title.trim()) {
      toast.error('Please enter a valid expense description and positive amount.');
      return;
    }

    if (editingExpense) {
      // Edit existing expense
      const oldAmountCents = editingExpense.amountCents;
      const diff = amountCents - oldAmountCents;

      // If drawer payout and difference != 0 and active shift
      if (editingExpense.paidViaDrawer && diff !== 0 && activeShift) {
        if (diff > 0) {
          const drawerBalance = cashDrawerService.getCurrentDrawerBalance(activeShift.id);
          if (diff > drawerBalance) {
            toast.error(`Cannot withdraw additional ${formatLKR(diff)}. Live drawer cash is only ${formatLKR(drawerBalance)}.`);
            return;
          }
          cashDrawerService.addTransaction({
            shiftId: activeShift.id,
            terminalId: activeShift.terminalId || 'POS-01',
            cashierId: session?.user?.id || 'admin-user',
            cashierName: session?.user?.name || 'Administrator',
            type: 'CASH_OUT',
            amount: -diff,
            reason: `Adjusted expense increase: ${title.trim()}`,
            expenseCategory: category,
          });
        } else {
          cashDrawerService.addTransaction({
            shiftId: activeShift.id,
            terminalId: activeShift.terminalId || 'POS-01',
            cashierId: session?.user?.id || 'admin-user',
            cashierName: session?.user?.name || 'Administrator',
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
        paidViaDrawer,
      });

      toast.success(`Expense "${title.trim()}" updated successfully.`);
    } else {
      // Create new expense
      if (paidViaDrawer && !activeShift) {
        toast.error('Cannot record drawer payout without an active cashier shift.');
        return;
      }

      // If paid via drawer, check balance and add drawer transaction
      if (paidViaDrawer && activeShift) {
        const drawerBalance = cashDrawerService.getCurrentDrawerBalance(activeShift.id);
        if (amountCents > drawerBalance) {
          toast.error(`Drawer only has ${formatLKR(drawerBalance)}. Cannot withdraw ${formatLKR(amountCents)}.`);
          return;
        }

        cashDrawerService.addTransaction({
          shiftId: activeShift.id,
          terminalId: activeShift.terminalId || 'POS-01',
          cashierId: session?.user?.id || 'admin-user',
          cashierName: session?.user?.name || 'Administrator',
          type: 'CASH_OUT',
          amount: -amountCents,
          reason: title.trim(),
          expenseCategory: category,
        });
      }

      catalogService.addExpense({
        title: title.trim(),
        category,
        amountCents,
        paidViaDrawer,
        cashierName: paidViaDrawer ? (session?.user?.name || 'Administrator') : undefined,
      });

      toast.success(`Expense of ${formatLKR(amountCents)} recorded successfully.`);
    }

    setIsCreating(false);
    setEditingExpense(null);
    setTitle('');
    setAmountRupees('');
    setPaidViaDrawer(false);
  };

  // Handle Delete Expense
  const handleDelete = async (exp: Expense) => {
    const confirmed = await confirmDialog({
      title: 'Delete Expense Record',
      message: `Are you sure you want to remove the expense record for "${exp.title}" (${formatLKR(exp.amountCents)})?`,
      confirmText: 'Delete Expense',
      variant: 'danger',
    });

    if (!confirmed) return;

    catalogService.deleteExpense(exp.id);
    toast.success('Expense record deleted.');
  };

  return (
    <div className="h-full flex-1 flex flex-col min-h-0 space-y-3 w-full animate-in fade-in">
      {/* 1. TOP KPI SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 shrink-0">
        {/* Card 1: Total Operating Expenses */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E9E0D5] shadow-xs flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted">
                Operating Expenses
              </span>
              <span className="w-2 h-2 rounded-full bg-status-danger shrink-0" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-status-danger tabular-nums">
              {formatLKR(totalFilteredExpenseCents)}
            </div>
            <div className="text-[11px] text-text-secondary mt-1 font-semibold">
              {filteredExpenses.length} recorded expense transactions
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-200/60 flex items-center justify-center text-status-danger shrink-0 shadow-xs">
            <Receipt className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Paid via POS Drawer Cash */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E9E0D5] shadow-xs flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted">
                Paid Via POS Drawer
              </span>
              <span className="w-2 h-2 rounded-full bg-[#E99343] shrink-0" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-brand-brown-deep tabular-nums">
              {formatLKR(totalDrawerExpenseCents)}
            </div>
            <div className="text-[11px] text-text-secondary mt-1 font-semibold">
              Drawer payouts recorded in shift ledger
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-700 shrink-0 shadow-xs">
            <Coins className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Accounts Payable & Direct Invoices */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E9E0D5] shadow-xs flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted">
                Direct / Accounts Payable
              </span>
              <span className="w-2 h-2 rounded-full bg-brand-teal shrink-0" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-brand-teal-dark tabular-nums">
              {formatLKR(totalDirectExpenseCents)}
            </div>
            <div className="text-[11px] text-text-secondary mt-1 font-semibold">
              Store supplies, utilities & maintenance
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-teal-50 border border-teal-200/50 flex items-center justify-center text-brand-teal shrink-0 shadow-xs">
            <Wallet className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 2. SUB-HEADER BAR: Live Stats on Left, Custom Dropdown & Month Year Picker on Right */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shrink-0">
        {/* Left: Live Statistics with Color Dots */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs select-none">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-brand-teal shrink-0" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted">Total:</span>
            <span className="font-black text-xs text-brand-brown-dark tabular-nums">{filteredExpenses.length}</span>
            <span className="text-[10px] text-text-muted font-medium">expenses</span>
          </div>

          <div className="flex items-center gap-1.5 border-l border-[#EAE3DA] pl-3">
            <span className="w-2 h-2 rounded-full bg-status-danger shrink-0" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted">Sum:</span>
            <span className="font-black text-xs text-status-danger tabular-nums">{formatLKR(totalFilteredExpenseCents)}</span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 border-l border-[#EAE3DA] pl-3">
            <span className="w-2 h-2 rounded-full bg-[#E99343] shrink-0" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted">Avg Ticket:</span>
            <span className="font-black text-xs text-brand-brown-dark tabular-nums">{formatLKR(avgExpenseCents)}</span>
          </div>
        </div>

        {/* Right: Custom Designed Dropdown & Month Year Picker */}
        <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
          <div className="w-[160px] sm:w-[175px]">
            <CustomSelect
              value={categoryFilter}
              onChange={(val) => setCategoryFilter(val)}
              options={CATEGORY_OPTIONS}
              buttonClassName="h-9 !py-0 px-3.5 bg-[#FAF7F2] hover:bg-cream-100 border-[#E0D7CC] rounded-full text-xs font-bold text-brand-brown-dark shadow-xs"
            />
          </div>

          <MonthYearPicker
            value={dateRange}
            onChange={(newVal) => setDateRange(newVal)}
          />
        </div>
      </div>

      {/* 3. MAIN DATA TABLE AREA */}
      <div className="flex-1 min-h-0 bg-white rounded-2xl border border-[#E9E0D5] shadow-xs overflow-hidden flex flex-col mb-1">
        <div className="flex-1 overflow-auto min-h-0 pb-32">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-[#FAF7F2]/95 backdrop-blur-xs z-10 shadow-xs">
              <tr className="border-b border-[#EAE3DA] text-text-muted font-black uppercase text-[10px] tracking-wider">
                <th className="py-3.5 px-4 bg-[#FAF7F2]/95">Date / Time</th>
                <th className="py-3.5 px-4 bg-[#FAF7F2]/95">Expense Title</th>
                <th className="py-3.5 px-4 bg-[#FAF7F2]/95">Category</th>
                <th className="py-3.5 px-4 bg-[#FAF7F2]/95">Payment Method</th>
                <th className="py-3.5 px-4 text-right bg-[#FAF7F2]/95">Amount (LKR)</th>
                <th className="py-3.5 px-4 text-right bg-[#FAF7F2]/95">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2ECE4] font-medium">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-20 text-text-muted">
                    <Receipt className="w-9 h-9 mx-auto mb-2 text-text-muted/40" />
                    <div className="font-semibold text-xs text-text-secondary">
                      No operating expenses recorded for this period.
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSearch('');
                        setCategoryFilter('ALL');
                      }}
                      className="mt-3 px-3.5 py-1 text-xs font-black text-brand-teal hover:underline cursor-pointer"
                    >
                      Reset filters
                    </button>
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-[#FAF7F2]/70 transition-colors group">
                    {/* Date / Time */}
                    <td className="py-3.5 px-4 text-text-secondary whitespace-nowrap">
                      {formatDateTime(exp.createdAt)}
                    </td>

                    {/* Expense Title */}
                    <td className="py-3.5 px-4 font-black text-brand-brown-dark">
                      {exp.title}
                    </td>

                    {/* Category Pill */}
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 rounded-full bg-cream-100/80 border border-[#E0D7CC] font-bold text-[10px] text-brand-brown uppercase">
                        {exp.category.replace(/_/g, ' ')}
                      </span>
                    </td>

                    {/* Payment Method */}
                    <td className="py-3.5 px-4">
                      {exp.paidViaDrawer ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                          <Coins className="w-3 h-3 text-amber-600" />
                          Drawer Out ({exp.cashierName || 'Cashier'})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold text-brand-teal bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full">
                          <Wallet className="w-3 h-3 text-brand-teal" />
                          Accounts Payable
                        </span>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="py-3.5 px-4 text-right font-black text-status-danger tabular-nums text-xs whitespace-nowrap">
                      {formatLKR(exp.amountCents)}
                    </td>

                    {/* Actions: Edit & Delete */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 ml-auto">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(exp)}
                          className="w-7 h-7 bg-[#FAF7F2] border border-[#E0D7CC] hover:bg-cream-100 hover:border-brand-teal/40 hover:text-brand-teal rounded-full text-text-muted flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
                          title="Edit Expense Record"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(exp)}
                          className="w-7 h-7 bg-[#FAF7F2] border border-[#E0D7CC] hover:bg-rose-50 hover:border-rose-200 hover:text-status-danger rounded-full text-text-muted flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
                          title="Delete Expense Record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}

              {/* Bottom Spacer Row to Ensure Last Record is Never Hidden by Floating Capsule */}
              {filteredExpenses.length > 0 && (
                <tr aria-hidden="true" className="border-0 pointer-events-none select-none">
                  <td colSpan={6} className="h-24 bg-transparent border-0" />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. FLOATING BOTTOM POP-UP SEARCH & ACTION PILL */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center pointer-events-none select-none">
        <div className="bg-[#1E1917]/95 text-white backdrop-blur-xl border border-white/10 shadow-2xl rounded-full p-1.5 pl-4 pr-1.5 flex items-center gap-2 transition-all duration-300 pointer-events-auto">
          {/* Search Input */}
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-white/50 shrink-0 pointer-events-none" />
            <input
              type="text"
              placeholder="Search expenses..."
              value={search}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              onChange={(e) => setSearch(e.target.value)}
              className={`bg-transparent border-0 border-none outline-none focus:outline-none focus:ring-0 text-xs font-semibold text-white placeholder:text-white/40 shadow-none transition-all duration-300 ease-out ${
                isSearchFocused || search ? 'w-56 sm:w-72 md:w-80' : 'w-24 sm:w-32'
              }`}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Primary Circular Action Button (+) */}
          <button
            type="button"
            onClick={() => {
              setEditingExpense(null);
              setTitle('');
              setAmountRupees('');
              setCategory('CLEANING');
              setPaidViaDrawer(false);
              setIsCreating(true);
            }}
            className="w-10 h-10 rounded-full bg-[#E99343] hover:bg-[#DE7E29] text-white flex items-center justify-center shadow-lg shadow-[#E99343]/30 active:scale-95 transition-all shrink-0 cursor-pointer group"
            title="Record New Expense"
          >
            <Plus className="w-5 h-5 stroke-[2.5] group-hover:rotate-90 transition-transform duration-200" />
          </button>
        </div>
      </div>

      {/* 5. MODAL: RECORD / EDIT OPERATING EXPENSE (STANDARDIZED PATTERN) */}
      {isCreating &&
        createPortal(
          <div className="fixed inset-0 z-[99999] w-full h-full bg-black/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-hidden animate-in fade-in">
            <div className="w-full max-w-lg sm:max-w-xl flex flex-col max-h-[92vh]">
              {/* Separate Header Above Form: Title on left, Cancel & Save on right */}
              <div className="flex items-center justify-between gap-3 mb-3 px-1 shrink-0">
                <div className="min-w-0 flex-1">
                  <h3 className="font-extrabold text-base sm:text-lg text-white drop-shadow-xs truncate">
                    {editingExpense ? 'Edit Operating Expense' : 'Record Operating Expense'}
                  </h3>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreating(false);
                      setEditingExpense(null);
                    }}
                    className="px-4 py-2 rounded-full border border-white/30 text-white hover:bg-white/10 text-xs font-bold transition-all whitespace-nowrap cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="expense-form"
                    className="px-5 py-2 rounded-full bg-brand-teal hover:bg-brand-teal-dark text-white font-extrabold text-xs shadow-teal transition-all active:scale-95 whitespace-nowrap cursor-pointer"
                  >
                    {editingExpense ? 'Update Expense' : 'Save Expense'}
                  </button>
                </div>
              </div>

              {/* Modal Card Content */}
              <div className="w-full bg-white rounded-3xl shadow-2xl border border-[#E9E0D5] overflow-y-auto">
                <form id="expense-form" onSubmit={handleCreate} className="p-5 sm:p-6 space-y-5">
                  {/* Expense Description Title */}
                  <div>
                    <label className="text-[11px] font-bold uppercase text-text-secondary block mb-1">
                      Expense Description <span className="text-status-danger">*</span>
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Dishwashing liquid & cleaning sponges, Fresh mint leaves"
                      className="w-full pb-2 pt-1 bg-transparent border-0 border-b border-[#E2D8CC] text-sm font-bold text-brand-brown-dark focus:outline-none focus:border-brand-teal rounded-none transition-colors"
                      required
                      autoFocus
                    />
                  </div>

                  {/* Category Selection */}
                  <div>
                    <label className="text-[11px] font-bold uppercase text-text-secondary block mb-1">
                      Expense Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as any)}
                      className="w-full pb-2 pt-1 bg-transparent border-0 border-b border-[#E2D8CC] text-sm font-bold text-brand-brown-dark focus:outline-none focus:border-brand-teal rounded-none transition-colors cursor-pointer"
                    >
                      <option value="CLEANING">Cleaning & Janitorial Supplies</option>
                      <option value="EMERGENCY_MILK">Emergency Dairy / Milk Run</option>
                      <option value="DELIVERY">Ice / Gas Delivery Fees</option>
                      <option value="PETTY_CASH">Petty Cash & Store Items</option>
                      <option value="MAINTENANCE">Equipment Maintenance & Repairs</option>
                      <option value="UTILITIES">Utilities, Water & Internet</option>
                      <option value="OTHER">Other Operating Expense</option>
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
                    {/* Quick Amount Pills */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {[500, 1000, 2500, 5000, 10000].map((preset) => (
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

                  {/* Payment Source Toggle */}
                  <div className="pt-2 border-t border-[#EAE3DA]">
                    <label className="text-[11px] font-bold uppercase text-text-secondary block mb-2">
                      Payment Source
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaidViaDrawer(false)}
                        className={`py-2.5 px-3 rounded-2xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          !paidViaDrawer
                            ? 'bg-[#251814] text-white border-[#251814] shadow-xs'
                            : 'bg-[#FAF7F2] text-brand-brown border-[#E0D7CC] hover:bg-cream-100'
                        }`}
                      >
                        <Wallet className="w-3.5 h-3.5" />
                        <span>Accounts Payable</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaidViaDrawer(true)}
                        className={`py-2.5 px-3 rounded-2xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          paidViaDrawer
                            ? 'bg-[#251814] text-white border-[#251814] shadow-xs'
                            : 'bg-[#FAF7F2] text-brand-brown border-[#E0D7CC] hover:bg-cream-100'
                        }`}
                      >
                        <Coins className="w-3.5 h-3.5 text-amber-500" />
                        <span>POS Drawer Cash Out</span>
                      </button>
                    </div>

                    {paidViaDrawer && (
                      <div className="mt-2.5 p-3 bg-amber-50/70 rounded-xl border border-amber-200/80 flex items-center justify-between text-xs">
                        <span className="text-[11px] font-semibold text-amber-900 flex items-center gap-1.5">
                          {activeShift ? (
                            `Deducts from Shift #${activeShift.shiftNumber} (${activeShift.cashierName})`
                          ) : (
                            <>
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                              <span>No active shift open on POS terminal.</span>
                            </>
                          )}
                        </span>
                        {activeShift && (
                          <span className="text-[10px] font-black text-amber-800 tabular-nums">
                            Bal: {formatLKR(cashDrawerService.getCurrentDrawerBalance(activeShift.id))}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
