import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { cashDrawerService } from '@/services/cashDrawerService';
import { shiftService } from '@/services/shiftService';
import { realtimeSocketService } from '@/services/realtimeSocketService';
import { CashDrawerTransaction, CashDrawerTransactionType, CashierShift } from '@/types';
import { db } from '@/services/storage/db';
import { formatLKR, formatDateTime, rupeesToCents, formatCommaInput } from '@/utils/format';
import { toLocalYMD } from '@/services/reportService';
import { promptDialog, confirmDialog } from '@/store/useConfirmStore';
import { catalogService } from '@/services/catalogService';
import {
  Coins,
  ArrowDownRight,
  ArrowUpRight,
  Search,
  X,
  Plus,
  Minus,
  SlidersHorizontal,
  DollarSign,
  Wallet,
  Building2,
  Receipt,
  CheckCircle2,
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Clock,
  Sparkles,
  Check,
  LogOut,
} from 'lucide-react';
import { CustomSelect, SelectOption } from '@/components/ui/CustomSelect';
import { DayDatePicker } from '@/components/ui/DayDatePicker';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from 'sonner';

const TYPE_FILTER_OPTIONS: SelectOption[] = [
  { value: 'ALL', label: 'All Movements' },
  { value: 'PENDING_APPROVAL', label: 'Pending Requests' },
  { value: 'CASH_SALE', label: 'POS Cash Sales' },
  { value: 'OPENING_CASH', label: 'Opening Float' },
  { value: 'CASH_IN', label: 'Cash In (Add)' },
  { value: 'CASH_OUT', label: 'Expenses' },
  { value: 'SHIFT_CLOSE', label: 'Shift Close (Cashout)' },
  { value: 'CASH_REFUND', label: 'Cash Refunds' },
  { value: 'CASH_DROP', label: 'Cash Drop to Safe' },
  { value: 'CLOSING_ADJUSTMENT', label: 'Closing Audit' },
];

const REQUEST_STATUS_OPTIONS: SelectOption[] = [
  { value: 'ALL', label: 'All Requests' },
  { value: 'PENDING_APPROVAL', label: 'Waiting for Admin' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

export const AdminCashDrawerPage: React.FC = () => {
  const { session } = useAuthStore();
  const [transactions, setTransactions] = useState(cashDrawerService.getTransactions());
  const [activeShift, setActiveShift] = useState(shiftService.getActiveShift());

  // Date Filter (defaults to current date YYYY-MM-DD in Sri Lanka)
  const getTodayStr = () => toLocalYMD(new Date());

  const [selectedDate, setSelectedDate] = useState<string>(getTodayStr);

  // Search and Filter State
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Tab Switcher State: 'movements' | 'requests'
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as 'movements' | 'requests') || 'movements';
  const handleTabChange = (tab: 'movements' | 'requests') => {
    setSearchParams({ tab });
  };

  // Cashier Requests Status Filter & Review Modal State
  const [requestStatusFilter, setRequestStatusFilter] = useState('ALL');
  const [reviewingTx, setReviewingTx] = useState<CashDrawerTransaction | null>(null);

  // Modal State for Manual Cash In / Out
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [movementType, setMovementType] = useState<'CASH_IN' | 'CASH_OUT' | 'CASH_DROP'>('CASH_OUT');
  const [amountRupees, setAmountRupees] = useState('');
  const [movementReason, setMovementReason] = useState('Emergency ingredient / grocery purchase');
  const [expenseCategory, setExpenseCategory] = useState<'EMERGENCY_MILK' | 'CLEANING' | 'DELIVERY' | 'PETTY_CASH' | 'OTHER'>('EMERGENCY_MILK');

  useEffect(() => {
    const refreshDrawer = () => {
      setTransactions(cashDrawerService.getTransactions());
      setActiveShift(shiftService.getActiveShift());
    };

    const unsubDb = db.subscribe(refreshDrawer);
    const unsubTx = realtimeSocketService.on('DRAWER_TRANSACTION', refreshDrawer);
    const unsubReqPending = realtimeSocketService.on('DRAWER_REQUEST_PENDING', refreshDrawer);
    const unsubReqApprove = realtimeSocketService.on('DRAWER_REQUEST_APPROVED', refreshDrawer);
    const unsubReqReject = realtimeSocketService.on('DRAWER_REQUEST_REJECTED', refreshDrawer);
    const unsubShift = realtimeSocketService.on('SHIFT_CHANGED', refreshDrawer);
    const unsubOrder = realtimeSocketService.on('ORDER_CREATED', refreshDrawer);
    const unsubRefund = realtimeSocketService.on('ORDER_REFUNDED', refreshDrawer);

    const handleStorage = (e: StorageEvent) => {
      if (e.key?.includes('cafemm') || e.key?.includes('drawer') || e.key?.includes('shift')) {
        refreshDrawer();
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      unsubDb();
      unsubTx();
      unsubReqPending();
      unsubReqApprove();
      unsubReqReject();
      unsubShift();
      unsubOrder();
      unsubRefund();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Pending Cash Requests (Awaiting Admin Approval)
  const pendingRequests = useMemo(() => {
    return transactions.filter((t) => t.status === 'PENDING_APPROVAL');
  }, [transactions]);

  // Dismissed notification banner state (stays dismissed until new requests arrive)
  const [dismissedAtCount, setDismissedAtCount] = useState<number | null>(null);
  const isReminderDismissed = dismissedAtCount !== null && pendingRequests.length <= dismissedAtCount;

  useEffect(() => {
    if (pendingRequests.length === 0 && dismissedAtCount !== null) {
      setDismissedAtCount(null);
    }
  }, [pendingRequests.length, dismissedAtCount]);

  const allShifts = db.getSnapshot().shifts || [];
  const latestShift = allShifts[0] || null;
  const displayShift = activeShift || latestShift;

  // Current Live Drawer Balance & Shift KPI Totals
  const currentBalance = activeShift ? cashDrawerService.getCurrentDrawerBalance(activeShift.id) : 0;
  const shiftCashSales = displayShift ? displayShift.cashSales : 0;
  const shiftFloat = displayShift ? displayShift.openingCash : 0;
  const shiftCashIn = displayShift ? (displayShift.cashIn || 0) : 0;
  const shiftCashOut = displayShift ? displayShift.cashOut : 0;
  const shiftRefunds = displayShift ? displayShift.cashRefunds : 0;
  const shiftCashDrops = displayShift ? (displayShift.cashDrops || 0) : 0;

  // Filtered Transactions for Movements Tab
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      // Type Filter
      if (typeFilter === 'PENDING_APPROVAL') {
        if (t.status !== 'PENDING_APPROVAL') return false;
      } else if (typeFilter !== 'ALL' && t.type !== typeFilter) {
        return false;
      }

      // Date Filter (YYYY-MM-DD in Sri Lanka)
      if (selectedDate !== 'ALL') {
        const txDateStr = toLocalYMD(t.createdAt || t.timestamp);
        if (txDateStr !== selectedDate) return false;
      }

      // Search Filter
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          t.cashierName.toLowerCase().includes(q) ||
          (t.orderNumber && t.orderNumber.toLowerCase().includes(q)) ||
          (t.reason && t.reason.toLowerCase().includes(q)) ||
          t.type.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [transactions, typeFilter, selectedDate, search]);

  // Cashier Requests (All staff-submitted cash requests, drops, or non-order register requests)
  const cashierRequests = useMemo(() => {
    return transactions.filter(
      (t) =>
        t.status === 'PENDING_APPROVAL' ||
        Boolean(t.approvedByUserId) ||
        Boolean(t.rejectedReason) ||
        (t.type === 'CASH_OUT' && !t.orderId) ||
        t.type === 'CASH_DROP' ||
        t.type === 'CASH_IN'
    );
  }, [transactions]);

  // Filtered Cashier Requests for Requests Tab
  const filteredCashierRequests = useMemo(() => {
    return cashierRequests.filter((req) => {
      // Date Filter (YYYY-MM-DD in Sri Lanka)
      if (selectedDate !== 'ALL') {
        const txDateStr = toLocalYMD(req.createdAt || req.timestamp);
        if (txDateStr !== selectedDate) return false;
      }

      // Status Filter
      if (requestStatusFilter !== 'ALL') {
        if (req.status !== requestStatusFilter) return false;
      }

      // Search Filter
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          req.cashierName.toLowerCase().includes(q) ||
          (req.reason && req.reason.toLowerCase().includes(q)) ||
          req.type.toLowerCase().includes(q) ||
          formatLKR(Math.abs(req.amount)).toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [cashierRequests, selectedDate, requestStatusFilter, search]);

  const reqPendingCount = useMemo(() => {
    return cashierRequests.filter((r) => r.status === 'PENDING_APPROVAL').length;
  }, [cashierRequests]);

  const reqApprovedCount = useMemo(() => {
    return cashierRequests.filter((r) => r.status === 'APPROVED').length;
  }, [cashierRequests]);

  const reqRejectedCount = useMemo(() => {
    return cashierRequests.filter((r) => r.status === 'REJECTED').length;
  }, [cashierRequests]);

  // Inflow, Outflow & Safe Drop totals in filtered view
  const filteredTotalIn = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.amount > 0 && t.status !== 'REJECTED' && t.status !== 'PENDING_APPROVAL')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [filteredTransactions]);

  const filteredTotalOut = useMemo(() => {
    return Math.abs(
      filteredTransactions
        .filter((t) => (t.type === 'CASH_OUT' || t.type === 'CASH_REFUND') && t.status !== 'REJECTED' && t.status !== 'PENDING_APPROVAL')
        .reduce((sum, t) => sum + t.amount, 0)
    );
  }, [filteredTransactions]);

  const filteredTotalDrops = useMemo(() => {
    return Math.abs(
      filteredTransactions
        .filter((t) => t.type === 'CASH_DROP' && t.status !== 'REJECTED' && t.status !== 'PENDING_APPROVAL')
        .reduce((sum, t) => sum + t.amount, 0)
    );
  }, [filteredTransactions]);

  // Handle Admin Approving Cash Request
  const handleApproveRequest = (tx: CashDrawerTransaction) => {
    try {
      cashDrawerService.approveCashMovement({
        transactionId: tx.id,
        adminId: session?.user?.id || 'admin-user',
        adminName: session?.user?.name || 'Administrator',
      });
      toast.success(
        `Approved ${tx.type.replace(/_/g, ' ')} of ${formatLKR(Math.abs(tx.amount))} for ${tx.cashierName}.`
      );
      setReviewingTx(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve request.');
    }
  };

  // Handle Admin Rejecting Cash Request
  const handleRejectRequest = async (tx: CashDrawerTransaction) => {
    const reason = await promptDialog({
      title: `Reject ${tx.type.replace(/_/g, ' ')} Request`,
      message: `Enter rejection reason for ${tx.cashierName}'s ${formatLKR(Math.abs(tx.amount))} request:`,
      defaultValue: 'Not authorized by administrator',
      confirmText: 'Reject Request',
      variant: 'danger',
    });

    if (reason === null) return; // cancelled

    try {
      cashDrawerService.rejectCashMovement({
        transactionId: tx.id,
        adminId: session?.user?.id || 'admin-user',
        adminName: session?.user?.name || 'Administrator',
        reason: reason || 'Rejected by administrator',
      });
      toast.info(`Rejected ${tx.type.replace(/_/g, ' ')} request.`);
      setReviewingTx(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject request.');
    }
  };

  // Handle Manual Drawer Movement Submit
  const handleRecordMovement = (e: React.FormEvent) => {
    e.preventDefault();
    const amountCents = rupeesToCents(amountRupees);
    if (amountCents <= 0) {
      toast.error('Please enter a valid positive amount.');
      return;
    }

    if (!activeShift) {
      toast.error('Cannot record transaction without an active shift. Please open a shift on POS.');
      return;
    }

    if ((movementType === 'CASH_OUT' || movementType === 'CASH_DROP') && amountCents > currentBalance) {
      toast.error(`Cannot withdraw ${formatLKR(amountCents)} from drawer balance of ${formatLKR(currentBalance)}.`);
      return;
    }

    const recordedAmount = movementType === 'CASH_IN' ? amountCents : -amountCents;
    const cashierName = session?.user?.name || 'Administrator';
    const cashierId = session?.user?.id || 'admin-user';

    cashDrawerService.addTransaction({
      shiftId: activeShift.id,
      terminalId: activeShift.terminalId || 'POS-01',
      cashierId,
      cashierName,
      type: movementType,
      amount: recordedAmount,
      reason: movementReason.trim() || 'Manual drawer entry',
      expenseCategory: movementType === 'CASH_OUT' ? expenseCategory : undefined,
      status: 'APPROVED',
    });

    if (movementType === 'CASH_OUT') {
      catalogService.addExpense({
        title: movementReason.trim() || 'Manual drawer expense',
        category: expenseCategory,
        amountCents,
        paidViaDrawer: true,
        shiftId: activeShift.id,
        cashierId,
        cashierName,
      });
    }

    toast.success(
      movementType === 'CASH_IN'
        ? `Added ${formatLKR(amountCents)} to cash drawer`
        : movementType === 'CASH_DROP'
        ? `Transferred ${formatLKR(amountCents)} from cash drawer to safe deposit`
        : `Recorded expense of ${formatLKR(amountCents)} from cash drawer`
    );

    setIsMovementModalOpen(false);
    setAmountRupees('');
  };

  // Handle Admin Manually Closing Active Shift & Clearing Drawer
  const handleAdminCloseShift = async () => {
    if (!activeShift) return;
    const ok = await confirmDialog({
      title: `Close Shift #${activeShift.shiftNumber} & Clear Drawer?`,
      message: `Are you sure you want to close this shift for ${activeShift.cashierName} and cash out the drawer balance of ${formatLKR(currentBalance)}? The drawer will be cashed out to Rs. 0.00 and cashier will be signed out to log in fresh.`,
      confirmText: 'Yes, Close & Cash Out',
      cancelText: 'Cancel',
      variant: 'warning',
    });
    if (!ok) return;

    try {
      await shiftService.closeShift({
        shiftId: activeShift.id,
        closedByUserId: session?.user?.id || 'admin',
        closedByUserName: session?.user?.name || 'Administrator',
        closingCashEnteredCents: currentBalance,
        closingNotes: 'Manually closed and cashed out by Administrator',
      });
      toast.success(`Shift #${activeShift.shiftNumber} closed and drawer cleared to Rs. 0.00.`);
      setActiveShift(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to close shift');
    }
  };

  return (
    <div className="h-full flex-1 flex flex-col min-h-0 space-y-3 w-full animate-in fade-in">
      {/* 1. TOP STATS CARDS ROW (4 Metric Cards including Cash Drops) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        {/* Card 1: Live Drawer Cash / Closed Status */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E9E0D5] shadow-xs flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted">
                {activeShift ? 'POS-01 Live Drawer Cash' : 'POS-01 Drawer Status'}
              </span>
              <span
                className={`w-2 h-2 rounded-full ${
                  activeShift ? 'bg-status-success animate-pulse' : 'bg-amber-500'
                }`}
                title={activeShift ? 'Active Shift Open' : 'Register Closed / Cashed Out'}
              />
              <span className="text-[9.5px] font-extrabold text-amber-800 bg-amber-50 border border-amber-200/70 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                <Clock className="w-2.5 h-2.5 text-amber-600" />
                Auto-close 11:59 PM
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-brand-brown-deep tabular-nums">
              {formatLKR(currentBalance)}
            </div>
            <div className="text-[11px] text-text-secondary mt-1 font-semibold truncate">
              {activeShift
                ? `Shift #${activeShift.shiftNumber} (${activeShift.cashierName})`
                : latestShift
                ? `Shift #${latestShift.shiftNumber} Closed (${latestShift.cashierName}) • Cashed Out: ${formatLKR(latestShift.closingCashEntered || latestShift.expectedClosingCash || 0)}`
                : 'No active cashier shift • Drawer cleared'}
            </div>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-cream-100 border border-[#E0D7CC] flex items-center justify-center text-brand-brown shrink-0 shadow-xs">
            <Coins className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Shift Cash Inflows */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E9E0D5] shadow-xs flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted">
                {activeShift ? 'Shift Cash Sales' : 'Last Shift Cash Sales'}
              </span>
              <span className="w-2 h-2 rounded-full bg-brand-teal shrink-0" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-brand-teal-dark tabular-nums">
              {formatLKR(shiftCashSales)}
            </div>
            <div className="text-[11px] text-text-secondary mt-1 font-semibold">
              Float: <span className="font-bold text-brand-brown-dark">{formatLKR(shiftFloat)}</span>
              {shiftCashIn > 0 && <span> • In: {formatLKR(shiftCashIn)}</span>}
              {!activeShift && latestShift && <span className="text-text-muted"> (Shift #{latestShift.shiftNumber})</span>}
            </div>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200/50 flex items-center justify-center text-brand-teal shrink-0 shadow-xs">
            <ArrowDownRight className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Payouts & Refunds */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E9E0D5] shadow-xs flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted">
                {activeShift ? 'Drawer Expenses & Refunds' : 'Last Shift Expenses & Refunds'}
              </span>
              <span className="w-2 h-2 rounded-full bg-status-danger shrink-0" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-status-danger tabular-nums">
              {formatLKR(shiftCashOut + shiftRefunds)}
            </div>
            <div className="text-[11px] text-text-secondary mt-1 font-semibold">
              Expenses: {formatLKR(shiftCashOut)} • Refunds: {formatLKR(shiftRefunds)}
            </div>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200/60 flex items-center justify-center text-status-danger shrink-0 shadow-xs">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Safe Drops to Vault / Total Cashout */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E9E0D5] shadow-xs flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted">
                {activeShift ? 'Safe Drops (Vault)' : 'Last Shift Cashout (Total)'}
              </span>
              <span className="w-2 h-2 rounded-full bg-amber-600 shrink-0" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-900 tabular-nums">
              {formatLKR(
                activeShift
                  ? shiftCashDrops
                  : (latestShift?.closingCashEntered || latestShift?.expectedClosingCash || 0)
              )}
            </div>
            <div className="text-[11px] text-text-secondary mt-1 font-semibold">
              {activeShift ? (
                <>
                  Shift Safe Drops: <span className="font-bold text-amber-950">{formatLKR(shiftCashDrops)}</span>
                </>
              ) : (
                <>
                  Drawer Cashed Out: <span className="font-bold text-amber-950">{formatLKR(latestShift?.closingCashEntered || 0)}</span>
                </>
              )}
            </div>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200/70 flex items-center justify-center text-amber-800 shrink-0 shadow-xs">
            <Building2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 2. UNIFIED TAB SWITCHER & CONTEXTUAL CONTROLS */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0 border-b border-[#EAE3DA] pb-2">
        {/* Single Unified Tab Bar Container */}
        <div className="inline-flex items-center p-1 h-11 bg-white border border-[#E0D7CC] rounded-full shadow-xs overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => handleTabChange('movements')}
            className={`h-full flex items-center gap-2.5 px-4 py-2 rounded-full text-xs sm:text-[13px] font-black transition-all cursor-pointer select-none active:scale-98 whitespace-nowrap ${
              activeTab === 'movements'
                ? 'bg-brand-teal text-white shadow-teal'
                : 'text-brand-brown hover:text-brand-brown-deep hover:bg-cream-50'
            }`}
          >
            <Coins className="w-4 h-4" />
            <span>Drawer Movements</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold tabular-nums ${
                activeTab === 'movements' ? 'bg-white/20 text-white' : 'bg-cream-100 text-brand-brown-dark'
              }`}
            >
              {filteredTransactions.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('requests')}
            className={`h-full flex items-center gap-2.5 px-4 py-2 rounded-full text-xs sm:text-[13px] font-black transition-all cursor-pointer select-none active:scale-98 whitespace-nowrap ${
              activeTab === 'requests'
                ? 'bg-brand-teal text-white shadow-teal'
                : 'text-brand-brown hover:text-brand-brown-deep hover:bg-cream-50'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Cashier Requests</span>
            {pendingRequests.length > 0 ? (
              <span className="w-5 h-5 min-w-[20px] rounded-full text-[10px] font-black bg-[#E99343] text-[#251814] flex items-center justify-center leading-none shadow-xs">
                {pendingRequests.length}
              </span>
            ) : (
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold tabular-nums ${
                  activeTab === 'requests' ? 'bg-white/20 text-white' : 'bg-cream-100 text-brand-brown-dark'
                }`}
              >
                {cashierRequests.length}
              </span>
            )}
          </button>
        </div>

        {/* Right side controls based on active tab */}
        <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
          {activeTab === 'movements' && (
            <>
              {activeShift && (
                <button
                  type="button"
                  onClick={handleAdminCloseShift}
                  className="h-9 px-3.5 rounded-full bg-cream-100 hover:bg-rose-50 text-rose-700 border border-rose-200/80 font-extrabold text-xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-2xs"
                  title={`Close Shift #${activeShift.shiftNumber} and cash out drawer`}
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-600" />
                  <span>Close & Clear Drawer</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsMovementModalOpen(true)}
                className="h-9 px-4 rounded-full bg-brand-teal hover:bg-brand-teal-dark text-white font-extrabold text-xs shadow-teal transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Record Movement</span>
              </button>

              <div className="w-[170px] sm:w-[185px]">
                <CustomSelect
                  value={typeFilter}
                  onChange={(val) => setTypeFilter(val)}
                  options={TYPE_FILTER_OPTIONS}
                  buttonClassName="h-9 !py-0 px-3.5 bg-[#FAF7F2] hover:bg-cream-100 border-[#E0D7CC] rounded-full text-xs font-bold text-brand-brown-dark shadow-xs"
                />
              </div>

              <DayDatePicker
                value={selectedDate}
                onChange={(newVal) => setSelectedDate(newVal)}
              />
            </>
          )}

          {activeTab === 'requests' && (
            <>
              <div className="w-[170px] sm:w-[185px]">
                <CustomSelect
                  value={requestStatusFilter}
                  onChange={(val) => setRequestStatusFilter(val)}
                  options={REQUEST_STATUS_OPTIONS}
                  buttonClassName="h-9 !py-0 px-3.5 bg-[#FAF7F2] hover:bg-cream-100 border-[#E0D7CC] rounded-full text-xs font-bold text-brand-brown-dark shadow-xs"
                />
              </div>

              <DayDatePicker
                value={selectedDate}
                onChange={(newVal) => setSelectedDate(newVal)}
              />
            </>
          )}
        </div>
      </div>

      {/* PENDING STAFF CASH MOVEMENT REQUESTS REMINDER NOTIFICATION BANNER */}
      {pendingRequests.length > 0 && activeTab !== 'requests' && !isReminderDismissed && (
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl px-4 py-2.5 mb-2 shrink-0 shadow-xs flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <Clock className="w-4 h-4 text-amber-700 shrink-0" />
            <span className="text-xs font-black text-brand-brown-deep tracking-wider uppercase truncate">
              Pending Cash Movement Requests ({pendingRequests.length} waiting authorization)
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => handleTabChange('requests')}
              className="text-[11px] sm:text-xs font-bold text-amber-800 hover:text-amber-950 hover:underline flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>Manage all in Requests tab</span>
              <span>→</span>
            </button>
            <div className="w-[1px] h-3.5 bg-amber-300/80" />
            <button
              type="button"
              onClick={() => setDismissedAtCount(pendingRequests.length)}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-amber-800 hover:text-amber-950 hover:bg-amber-200/50 text-[11px] font-semibold transition-colors cursor-pointer"
              title="Dismiss notification"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Dismiss</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. SUB-HEADER BAR: Live Stats */}
      {activeTab === 'movements' ? (
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs select-none shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-brand-teal shrink-0" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted">Total:</span>
            <span className="font-black text-xs text-brand-brown-dark tabular-nums">{filteredTransactions.length}</span>
            <span className="text-[10px] text-text-muted font-medium">movements</span>
          </div>
          <div className="flex items-center gap-1.5 border-l border-[#EAE3DA] pl-3">
            <span className="w-2 h-2 rounded-full bg-status-success shrink-0" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted">Inflow:</span>
            <span className="font-black text-xs text-status-success tabular-nums">{formatLKR(filteredTotalIn)}</span>
          </div>
          <div className="flex items-center gap-1.5 border-l border-[#EAE3DA] pl-3">
            <span className="w-2 h-2 rounded-full bg-status-danger shrink-0" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted">Expenses:</span>
            <span className="font-black text-xs text-status-danger tabular-nums">{formatLKR(filteredTotalOut)}</span>
          </div>
          <div className="flex items-center gap-1.5 border-l border-[#EAE3DA] pl-3">
            <span className="w-2 h-2 rounded-full bg-amber-600 shrink-0" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted">Safe Drops:</span>
            <span className="font-black text-xs text-amber-900 tabular-nums">{formatLKR(filteredTotalDrops)}</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs select-none shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-brand-teal shrink-0" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted">Total Requests:</span>
            <span className="font-black text-xs text-brand-brown-dark tabular-nums">{filteredCashierRequests.length}</span>
          </div>
          {reqPendingCount > 0 && (
            <div className="flex items-center gap-1.5 border-l border-[#EAE3DA] pl-3">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-900">Waiting for Admin:</span>
              <span className="font-black text-xs text-amber-900 tabular-nums">{reqPendingCount}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 border-l border-[#EAE3DA] pl-3">
            <span className="w-2 h-2 rounded-full bg-status-success shrink-0" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted">Approved:</span>
            <span className="font-black text-xs text-status-success tabular-nums">{reqApprovedCount}</span>
          </div>
          {reqRejectedCount > 0 && (
            <div className="flex items-center gap-1.5 border-l border-[#EAE3DA] pl-3">
              <span className="w-2 h-2 rounded-full bg-status-danger shrink-0" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-status-danger">Rejected:</span>
              <span className="font-black text-xs text-status-danger tabular-nums">{reqRejectedCount}</span>
            </div>
          )}
        </div>
      )}

      {/* 4. MAIN DATA TABLE AREA */}
      {activeTab === 'movements' ? (
        <div className="flex-1 min-h-0 bg-white rounded-2xl border border-[#E9E0D5] shadow-xs overflow-hidden flex flex-col mb-1">
          <div className="flex-1 overflow-auto min-h-0 pb-32">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-[#FAF7F2]/95 backdrop-blur-xs z-10 shadow-xs">
                <tr className="border-b border-[#EAE3DA] text-text-muted font-black uppercase text-[10px] tracking-wider">
                  <th className="py-3.5 px-4 bg-[#FAF7F2]/95">Timestamp</th>
                  <th className="py-3.5 px-4 bg-[#FAF7F2]/95">Movement Type</th>
                  <th className="py-3.5 px-4 bg-[#FAF7F2]/95">Cashier / Staff</th>
                  <th className="py-3.5 px-4 bg-[#FAF7F2]/95">Details / Reason</th>
                  <th className="py-3.5 px-4 text-center bg-[#FAF7F2]/95">Status</th>
                  <th className="py-3.5 px-4 text-right bg-[#FAF7F2]/95">Movement (LKR)</th>
                  <th className="py-3.5 px-4 text-right bg-[#FAF7F2]/95">Balance After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2ECE4] font-medium">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-20 text-text-muted">
                      <Coins className="w-9 h-9 mx-auto mb-2 text-text-muted/40" />
                      <div className="font-semibold text-xs text-text-secondary">
                        No cash drawer transactions recorded for this period.
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSearch('');
                          setTypeFilter('ALL');
                        }}
                        className="mt-3 px-3.5 py-1 text-xs font-black text-brand-teal hover:underline cursor-pointer"
                      >
                        Reset filters
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => {
                    const isPositive = tx.amount >= 0;
                    const isSale = tx.type === 'CASH_SALE';
                    const isOpening = tx.type === 'OPENING_CASH';
                    const isIn = tx.type === 'CASH_IN';
                    const isRefund = tx.type === 'CASH_REFUND';
                    const isDrop = tx.type === 'CASH_DROP';
                    const isOut = tx.type === 'CASH_OUT';
                    const isShiftClose = tx.type === 'SHIFT_CLOSE';
                    const isPending = tx.status === 'PENDING_APPROVAL';
                    const isRejected = tx.status === 'REJECTED';

                    return (
                      <tr
                        key={tx.id}
                        onClick={isPending ? () => setReviewingTx(tx) : undefined}
                        className={`hover:bg-[#FAF7F2]/70 transition-colors group ${
                          isPending ? 'bg-amber-50/40 cursor-pointer' : ''
                        }`}
                        title={isPending ? 'Click to review and authorize request' : undefined}
                      >
                        <td className="py-3.5 px-4 text-text-secondary whitespace-nowrap">
                          {formatDateTime(tx.createdAt || tx.timestamp)}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase border inline-flex items-center gap-1.5 ${
                              isShiftClose
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : isSale || isOpening || isIn
                                ? 'bg-status-success-bg text-status-success border-status-success/30'
                                : isRefund || isOut
                                ? 'bg-status-danger-bg text-status-danger border-status-danger/30'
                                : isDrop
                                ? 'bg-amber-50 text-amber-900 border-amber-300'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            {isShiftClose ? (
                              <LogOut className="w-3 h-3 text-purple-700 shrink-0" />
                            ) : isDrop ? (
                              <Building2 className="w-3 h-3 text-amber-800 shrink-0" />
                            ) : isPositive ? (
                              <ArrowDownRight className="w-3 h-3 text-status-success shrink-0" />
                            ) : (
                              <ArrowUpRight className="w-3 h-3 text-status-danger shrink-0" />
                            )}
                            <span>{isShiftClose ? 'SHIFT CLOSE' : isDrop ? 'CASH DROP' : isOut ? 'EXPENSES' : tx.type.replace(/_/g, ' ')}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-black text-brand-brown-dark">
                          {tx.cashierName}
                        </td>
                        <td className="py-3.5 px-4 text-text-secondary max-w-[280px]">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {tx.orderNumber && (
                              <span className="px-2 py-0.2 rounded-md bg-teal-50 border border-teal-200 text-brand-teal font-black text-[10px] shrink-0">
                                {tx.orderNumber}
                              </span>
                            )}
                            <span className="truncate">{tx.reason || 'General register movement'}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {isPending ? (
                            <span className="px-2.5 py-0.5 rounded-full font-extrabold text-[9.5px] uppercase bg-amber-500 text-white shadow-2xs inline-flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              PENDING
                            </span>
                          ) : isRejected ? (
                            <span className="px-2.5 py-0.5 rounded-full font-black text-[9.5px] uppercase bg-rose-50 text-rose-700 border border-rose-200">
                              REJECTED
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full font-black text-[9.5px] uppercase bg-status-success-bg text-status-success border border-status-success/30">
                              APPROVED
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span
                            className={`font-black text-xs tabular-nums ${
                              isRejected
                                ? 'text-text-muted line-through'
                                : isShiftClose
                                ? 'text-purple-700 font-extrabold'
                                : isPositive
                                ? 'text-status-success'
                                : 'text-status-danger'
                            }`}
                          >
                            {isShiftClose
                              ? formatLKR(Math.abs(tx.amount))
                              : isPositive
                              ? `+${formatLKR(tx.amount)}`
                              : formatLKR(tx.amount)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-black text-brand-brown-deep tabular-nums">
                          {formatLKR(tx.balanceAfter)}
                        </td>
                      </tr>
                    );
                  })
                )}
                {filteredTransactions.length > 0 && (
                  <tr aria-hidden="true" className="border-0 pointer-events-none select-none">
                    <td colSpan={7} className="h-24 bg-transparent border-0" />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 bg-white rounded-2xl border border-[#E9E0D5] shadow-xs overflow-hidden flex flex-col mb-1">
          <div className="flex-1 overflow-auto min-h-0 pb-32">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-[#FAF7F2]/95 backdrop-blur-xs z-10 shadow-xs">
                <tr className="border-b border-[#EAE3DA] text-text-muted font-black uppercase text-[10px] tracking-wider">
                  <th className="py-3.5 px-4 bg-[#FAF7F2]/95">Timestamp</th>
                  <th className="py-3.5 px-4 bg-[#FAF7F2]/95">Request Type</th>
                  <th className="py-3.5 px-4 bg-[#FAF7F2]/95">Staff / Cashier</th>
                  <th className="py-3.5 px-4 bg-[#FAF7F2]/95">Reason / Justification</th>
                  <th className="py-3.5 px-4 text-center bg-[#FAF7F2]/95">Approval Status</th>
                  <th className="py-3.5 px-4 text-right bg-[#FAF7F2]/95">Requested Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2ECE4] font-medium">
                {filteredCashierRequests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-20 text-text-muted">
                      <Clock className="w-9 h-9 mx-auto mb-2 text-text-muted/40" />
                      <div className="font-semibold text-xs text-text-secondary">
                        No cashier requests recorded for this period.
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSearch('');
                          setRequestStatusFilter('ALL');
                        }}
                        className="mt-3 px-3.5 py-1 text-xs font-black text-brand-teal hover:underline cursor-pointer"
                      >
                        Reset filters
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredCashierRequests.map((req) => {
                    const isPending = req.status === 'PENDING_APPROVAL';
                    const isApproved = req.status === 'APPROVED';
                    const isRejected = req.status === 'REJECTED';

                    return (
                      <tr
                        key={req.id}
                        onClick={() => setReviewingTx(req)}
                        className={`hover:bg-[#FAF7F2]/80 transition-colors group cursor-pointer ${
                          isPending ? 'bg-amber-50/40' : ''
                        }`}
                        title="Click to view details and review request"
                      >
                        <td className="py-3.5 px-4 text-text-secondary whitespace-nowrap">
                          {formatDateTime(req.createdAt || req.timestamp)}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase border inline-flex items-center gap-1.5 ${
                              req.type === 'CASH_OUT'
                                ? 'bg-status-danger-bg text-status-danger border-status-danger/30'
                                : req.type === 'CASH_DROP'
                                ? 'bg-amber-50 text-amber-900 border-amber-300'
                                : 'bg-status-success-bg text-status-success border-status-success/30'
                            }`}
                          >
                            {req.type === 'CASH_OUT' ? 'EXPENSES' : req.type.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-brand-brown-dark">
                          {req.cashierName}
                        </td>
                        <td className="py-3.5 px-4 text-text-secondary max-w-xs truncate">
                          {req.reason || 'General expense'}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase border ${
                              isPending
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : isApproved
                                ? 'bg-status-success-bg text-status-success border-status-success/30'
                                : 'bg-rose-100 text-rose-900 border-rose-300'
                            }`}
                          >
                            {isPending
                              ? 'Waiting for Admin'
                              : isApproved
                              ? 'Approved'
                              : 'Rejected'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-black text-rose-700 text-sm tabular-nums">
                          {formatLKR(Math.abs(req.amount))}
                        </td>
                      </tr>
                    );
                  })
                )}
                {filteredCashierRequests.length > 0 && (
                  <tr aria-hidden="true" className="border-0 pointer-events-none select-none">
                    <td colSpan={6} className="h-24 bg-transparent border-0" />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. FLOATING BOTTOM POP-UP SEARCH & ACTION PILL */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center pointer-events-none select-none">
        <div className="bg-[#1E1917]/95 text-white backdrop-blur-xl border border-white/10 shadow-2xl rounded-full p-1.5 pl-4 pr-1.5 flex items-center gap-2 transition-all duration-300 pointer-events-auto">
          {/* Search Input */}
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-white/50 shrink-0 pointer-events-none" />
            <input
              type="text"
              placeholder="Search cashier, order, reason..."
              value={search}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              onChange={(e) => setSearch(e.target.value)}
              className={`bg-transparent border-0 border-none outline-none focus:outline-none focus:ring-0 text-xs font-semibold text-white placeholder:text-white/40 shadow-none transition-all duration-300 ease-out ${
                isSearchFocused || search ? 'w-56 sm:w-72 md:w-80' : 'w-28 sm:w-36'
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
              setAmountRupees('');
              setMovementReason('Cash drawer top up / adjustment');
              setIsMovementModalOpen(true);
            }}
            className="w-10 h-10 rounded-full bg-[#E99343] hover:bg-[#DE7E29] text-white flex items-center justify-center shadow-lg shadow-[#E99343]/30 active:scale-95 transition-all shrink-0 cursor-pointer group"
            title="Record Manual Cash In / Out"
          >
            <Plus className="w-5 h-5 stroke-[2.5] group-hover:rotate-90 transition-transform duration-200" />
          </button>
        </div>
      </div>

      {/* 5. MODAL: RECORD MANUAL CASH DRAWER MOVEMENT (STANDARDIZED PATTERN) */}
      {isMovementModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[99999] w-full h-full bg-black/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-hidden animate-in fade-in">
            <div className="w-full max-w-lg sm:max-w-xl flex flex-col max-h-[92vh]">
              {/* Separate Header Above Form: Title on left, Cancel & Save on right */}
              <div className="flex items-center justify-between gap-3 mb-3 px-1 shrink-0">
                <div className="min-w-0 flex-1">
                  <h3 className="font-extrabold text-base sm:text-lg text-white drop-shadow-xs truncate">
                    Record Drawer Movement
                  </h3>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsMovementModalOpen(false)}
                    className="px-4 py-2 rounded-full border border-white/30 text-white hover:bg-white/10 text-xs font-bold transition-all whitespace-nowrap cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="drawer-movement-form"
                    className="px-5 py-2 rounded-full bg-brand-teal hover:bg-brand-teal-dark text-white font-extrabold text-xs shadow-teal transition-all active:scale-95 whitespace-nowrap cursor-pointer"
                  >
                    Save Movement
                  </button>
                </div>
              </div>

              {/* Modal Card Content */}
              <div className="w-full bg-white rounded-3xl shadow-2xl border border-[#E9E0D5] overflow-y-auto">
                <form id="drawer-movement-form" onSubmit={handleRecordMovement} className="p-5 sm:p-6 space-y-5">
                  {/* Current Balance Banner */}
                  <div className="p-3.5 bg-[#FAF7F2] rounded-2xl border border-[#E2D8CC] flex items-center justify-between">
                    <span className="text-xs font-bold text-text-secondary">Current Drawer Cash:</span>
                    <span className="font-black text-base text-brand-brown-deep tabular-nums">
                      {formatLKR(currentBalance)}
                    </span>
                  </div>

                  {/* Movement Action Type */}
                  <div>
                    <label className="text-[11px] font-bold uppercase text-text-secondary block mb-2">
                      Movement Type
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'CASH_IN', label: '+ Cash In (Add)' },
                        { id: 'CASH_OUT', label: '- Expenses (Payout)' },
                        { id: 'CASH_DROP', label: 'Safe Cash Drop' },
                      ].map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setMovementType(t.id as any)}
                          className={`py-2 px-2.5 rounded-2xl text-xs font-bold border transition-all cursor-pointer ${
                            movementType === t.id
                              ? 'bg-[#251814] text-white border-[#251814] shadow-xs'
                              : 'bg-[#FAF7F2] text-brand-brown border-[#E0D7CC] hover:bg-cream-100'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Amount Input */}
                  <div>
                    <label className="text-[11px] font-bold uppercase text-text-secondary block mb-1">
                      Cash Amount (LKR) <span className="text-status-danger">*</span>
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
                        autoFocus
                      />
                    </div>
                    {/* Quick Amount Pills */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {[500, 1000, 2000, 5000].map((preset) => (
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

                  {/* Reason Input */}
                  <div>
                    <label className="text-[11px] font-bold uppercase text-text-secondary block mb-1">
                      Reason / Note <span className="text-status-danger">*</span>
                    </label>
                    <input
                      type="text"
                      value={movementReason}
                      onChange={(e) => setMovementReason(e.target.value)}
                      placeholder="e.g. Milk purchase, Float top-up, Safe drop"
                      className="w-full pb-2 pt-1 bg-transparent border-0 border-b border-[#E2D8CC] text-xs font-bold text-brand-brown-dark focus:outline-none focus:border-brand-teal rounded-none transition-colors"
                      required
                    />
                  </div>
                </form>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* 6. MODAL: REVIEW CASH MOVEMENT REQUEST (MATCHING STOCK RECORD ADJUSTMENT PATTERN) */}
      {reviewingTx &&
        createPortal(
          <div className="fixed inset-0 z-[99999] w-full h-full bg-black/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-hidden animate-in fade-in">
            <div className="w-full max-w-lg sm:max-w-xl flex flex-col max-h-[92vh]">
              {/* Header above card on dark backdrop */}
              <div className="flex items-center justify-between gap-3 mb-3 px-1 shrink-0">
                <div className="min-w-0 flex-1">
                  <h3 className="font-extrabold text-base sm:text-lg text-white drop-shadow-xs truncate">
                    Cash Movement Request
                  </h3>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setReviewingTx(null)}
                    className="px-4 py-2 rounded-full border border-white/30 text-white hover:bg-white/10 text-xs font-bold transition-all whitespace-nowrap cursor-pointer"
                  >
                    Close
                  </button>
                  {reviewingTx.status === 'PENDING_APPROVAL' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleRejectRequest(reviewingTx)}
                        className="px-4 py-2 rounded-full border border-rose-400 bg-rose-500/80 hover:bg-rose-600 text-white text-xs font-bold transition-all whitespace-nowrap cursor-pointer"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApproveRequest(reviewingTx)}
                        className="px-5 py-2 rounded-full bg-brand-teal hover:bg-brand-teal-dark text-white font-extrabold text-xs shadow-teal transition-all active:scale-95 whitespace-nowrap cursor-pointer"
                      >
                        Approve Movement
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* White rounded-3xl card */}
              <div className="w-full bg-white rounded-3xl shadow-2xl border border-[#E9E0D5] overflow-y-auto">
                <div className="p-5 sm:p-6 space-y-4">
                  {/* Field 1: Movement Type */}
                  <div>
                    <label className="text-[11px] font-bold uppercase text-text-secondary block mb-1">
                      Movement Type
                    </label>
                    <div className="w-full pb-2 pt-1 bg-transparent border-0 border-b border-[#E2D8CC] text-sm font-bold text-brand-brown-dark flex items-center justify-between">
                      <span className="font-extrabold">{reviewingTx.type === 'CASH_OUT' ? 'EXPENSES' : reviewingTx.type.replace(/_/g, ' ')}</span>
                      <span className="text-xs font-bold text-brand-teal">
                        Shift: #{reviewingTx.shiftId ? reviewingTx.shiftId.slice(-4) : '104'} ({reviewingTx.terminalId || 'POS-01'})
                      </span>
                    </div>
                  </div>

                  {/* Field 2: Requested Amount */}
                  <div>
                    <label className="text-[11px] font-bold uppercase text-text-secondary block mb-1">
                      Requested Amount
                    </label>
                    <div className="h-12 px-4 bg-cream-50/70 border border-[#E2D8CC] rounded-2xl flex items-center justify-between">
                      <span className="text-xs font-bold text-text-muted">Total Movement:</span>
                      <span className="text-xl font-black text-rose-700 font-mono">
                        {formatLKR(Math.abs(reviewingTx.amount))}
                      </span>
                    </div>
                  </div>

                  {/* Field 3: Cashier / Staff */}
                  <div>
                    <label className="text-[11px] font-bold uppercase text-text-secondary block mb-1">
                      Requested By Staff
                    </label>
                    <div className="w-full pb-2 pt-1 bg-transparent border-0 border-b border-[#E2D8CC] text-sm font-bold text-brand-brown-dark flex items-center justify-between">
                      <span>{reviewingTx.cashierName}</span>
                      <span className="text-xs font-mono text-text-muted">
                        ID: {reviewingTx.cashierId}
                      </span>
                    </div>
                  </div>

                  {/* Field 4: Reason / Note */}
                  <div>
                    <label className="text-[11px] font-bold uppercase text-text-secondary block mb-1">
                      Reason / Justification Note <span className="text-status-danger">*</span>
                    </label>
                    <div className="w-full pb-2 pt-1 bg-transparent border-0 border-b border-[#E2D8CC] text-xs font-bold text-brand-brown-dark">
                      {reviewingTx.reason || 'No specific justification note provided.'}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-text-muted pt-2 px-0.5">
                      <span>
                        Ref: <strong className="font-mono text-brand-brown-dark">{reviewingTx.id}</strong>
                      </span>
                      <span>
                        Submitted: {formatDateTime(reviewingTx.createdAt || reviewingTx.timestamp)}
                      </span>
                    </div>
                  </div>

                  {/* Field 5: Approved/Rejected Details */}
                  {reviewingTx.status === 'APPROVED' && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900">
                      <div className="font-bold text-[11px] uppercase tracking-wider mb-0.5 text-emerald-950">
                        Approved By Administrator
                      </div>
                      <div>
                        {reviewingTx.approvedByUserName || 'Administrator'}{' '}
                        {reviewingTx.approvedAt && `at ${formatDateTime(reviewingTx.approvedAt)}`}
                      </div>
                    </div>
                  )}

                  {reviewingTx.rejectedReason && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800">
                      <div className="font-bold text-[11px] uppercase tracking-wider mb-0.5 text-rose-900">
                        Declined By Administrator
                      </div>
                      <div>{reviewingTx.rejectedReason}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
