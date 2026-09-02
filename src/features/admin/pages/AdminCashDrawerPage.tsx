import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { cashDrawerService } from '@/services/cashDrawerService';
import { shiftService } from '@/services/shiftService';
import { realtimeSocketService } from '@/services/realtimeSocketService';
import { CashDrawerTransaction, CashDrawerTransactionType, CashierShift } from '@/types';
import { db } from '@/services/storage/db';
import { formatLKR, formatDateTime, rupeesToCents, formatCommaInput } from '@/utils/format';
import { promptDialog } from '@/store/useConfirmStore';
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
} from 'lucide-react';
import { CustomSelect, SelectOption } from '@/components/ui/CustomSelect';
import { MonthYearPicker, MonthYearValue } from '@/components/ui/MonthYearPicker';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from 'sonner';

const TYPE_FILTER_OPTIONS: SelectOption[] = [
  { value: 'ALL', label: 'All Movements' },
  { value: 'PENDING_APPROVAL', label: '⚠️ Pending Requests' },
  { value: 'CASH_SALE', label: 'POS Cash Sales' },
  { value: 'OPENING_CASH', label: 'Opening Float' },
  { value: 'CASH_IN', label: 'Cash In (Add)' },
  { value: 'CASH_OUT', label: 'Cash Out (Expense)' },
  { value: 'CASH_REFUND', label: 'Cash Refunds' },
  { value: 'CASH_DROP', label: 'Cash Drop to Safe' },
  { value: 'CLOSING_ADJUSTMENT', label: 'Closing Audit' },
];

export const AdminCashDrawerPage: React.FC = () => {
  const { session } = useAuthStore();
  const [transactions, setTransactions] = useState(cashDrawerService.getTransactions());
  const [activeShift, setActiveShift] = useState(shiftService.getActiveShift());

  // Date Range (defaults to current year/month)
  const now = new Date();
  const currentMonthStr = String(now.getMonth() + 1);
  const currentYearStr = String(now.getFullYear());

  const [dateRange, setDateRange] = useState<MonthYearValue>({
    year: currentYearStr,
    month: currentMonthStr,
  });

  // Search and Filter State
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

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

  // Current Live Drawer Balance
  const currentBalance = activeShift ? cashDrawerService.getCurrentDrawerBalance(activeShift.id) : 0;
  const shiftCashSales = activeShift ? activeShift.cashSales : 0;
  const shiftFloat = activeShift ? activeShift.openingCash : 0;
  const shiftCashIn = activeShift ? (activeShift.cashIn || 0) : 0;
  const shiftCashOut = activeShift ? activeShift.cashOut : 0;
  const shiftRefunds = activeShift ? activeShift.cashRefunds : 0;
  const shiftCashDrops = activeShift ? (activeShift.cashDrops || 0) : 0;

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      // Type Filter
      if (typeFilter === 'PENDING_APPROVAL') {
        if (t.status !== 'PENDING_APPROVAL') return false;
      } else if (typeFilter !== 'ALL' && t.type !== typeFilter) {
        return false;
      }

      // Month & Year Filter
      if (dateRange.year !== 'ALL') {
        const txDate = new Date(t.timestamp);
        if (String(txDate.getFullYear()) !== dateRange.year) return false;
        if (dateRange.month !== 'ALL' && String(txDate.getMonth() + 1) !== dateRange.month) return false;
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
  }, [transactions, typeFilter, dateRange, search]);

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

    toast.success(
      movementType === 'CASH_IN'
        ? `Added ${formatLKR(amountCents)} to cash drawer`
        : movementType === 'CASH_DROP'
        ? `Transferred ${formatLKR(amountCents)} from cash drawer to safe deposit`
        : `Withdrew ${formatLKR(amountCents)} from cash drawer`
    );

    setIsMovementModalOpen(false);
    setAmountRupees('');
  };

  return (
    <div className="h-full flex-1 flex flex-col min-h-0 space-y-3 w-full animate-in fade-in">
      {/* 1. TOP STATS CARDS ROW (4 Metric Cards including Cash Drops) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        {/* Card 1: Live Drawer Cash */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E9E0D5] shadow-xs flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted">
                POS-01 Live Drawer Cash
              </span>
              <span
                className={`w-2 h-2 rounded-full ${
                  activeShift ? 'bg-status-success animate-pulse' : 'bg-text-muted/40'
                }`}
                title={activeShift ? 'Active Shift Open' : 'No active shift'}
              />
            </div>
            <div className="text-xl sm:text-2xl font-black text-brand-brown-deep tabular-nums">
              {formatLKR(currentBalance)}
            </div>
            <div className="text-[11px] text-text-secondary mt-1 font-semibold truncate">
              {activeShift
                ? `Shift #${activeShift.shiftNumber} (${activeShift.cashierName})`
                : 'No active cashier shift'}
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
                Shift Cash Sales
              </span>
              <span className="w-2 h-2 rounded-full bg-brand-teal shrink-0" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-brand-teal-dark tabular-nums">
              {formatLKR(shiftCashSales)}
            </div>
            <div className="text-[11px] text-text-secondary mt-1 font-semibold">
              Float: <span className="font-bold text-brand-brown-dark">{formatLKR(shiftFloat)}</span>
              {shiftCashIn > 0 && <span> • In: {formatLKR(shiftCashIn)}</span>}
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
                Drawer Payouts & Refunds
              </span>
              <span className="w-2 h-2 rounded-full bg-status-danger shrink-0" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-status-danger tabular-nums">
              {formatLKR(shiftCashOut + shiftRefunds)}
            </div>
            <div className="text-[11px] text-text-secondary mt-1 font-semibold">
              Out: {formatLKR(shiftCashOut)} • Refunds: {formatLKR(shiftRefunds)}
            </div>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200/60 flex items-center justify-center text-status-danger shrink-0 shadow-xs">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Safe Drops to Vault */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E9E0D5] shadow-xs flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted">
                Safe Drops (Vault)
              </span>
              <span className="w-2 h-2 rounded-full bg-amber-600 shrink-0" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-900 tabular-nums">
              {formatLKR(shiftCashDrops)}
            </div>
            <div className="text-[11px] text-text-secondary mt-1 font-semibold">
              Shift Safe Drops: <span className="font-bold text-amber-950">{formatLKR(shiftCashDrops)}</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200/70 flex items-center justify-center text-amber-800 shrink-0 shadow-xs">
            <Building2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 2. PENDING REQUESTS REVIEW BANNER (IF ANY) */}
      {pendingRequests.length > 0 && (
        <div className="bg-amber-50/90 border-2 border-amber-300 rounded-2xl p-4 shadow-2xs space-y-3 shrink-0 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <h4 className="text-xs font-black uppercase text-amber-950 tracking-wider">
                Pending Cash Movement Requests ({pendingRequests.length})
              </h4>
            </div>
            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-500 text-white shadow-2xs">
              Action Required
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="bg-white rounded-2xl p-3.5 border border-amber-200 shadow-2xs space-y-2 flex flex-col justify-between"
              >
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-2 py-0.5 rounded-full font-black text-[9.5px] uppercase ${
                        req.type === 'CASH_OUT'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-brand-brown/10 text-brand-brown-dark border border-brand-brown/20'
                      }`}
                    >
                      {req.type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-sm font-black text-rose-700 tabular-nums">
                      {formatLKR(Math.abs(req.amount))}
                    </span>
                  </div>

                  <div className="font-bold text-brand-brown-dark pt-1">
                    Staff: <span className="font-extrabold">{req.cashierName}</span>
                  </div>
                  <div className="text-text-secondary text-[11px]">
                    Reason: <strong className="text-amber-950">{req.reason || 'General expense'}</strong>
                  </div>
                  <div className="text-[10px] text-text-muted">
                    {formatDateTime(req.timestamp)}
                  </div>
                </div>

                <div className="pt-2 border-t border-amber-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleRejectRequest(req)}
                    className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all cursor-pointer"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApproveRequest(req)}
                    className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-2xs transition-all active:scale-95 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. SUB-HEADER BAR: Live Stats on Left, Custom Dropdown & Month Year Picker on Right */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shrink-0">
        {/* Left: Live Statistics with Color Dots */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs select-none">
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
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted">Outflow:</span>
            <span className="font-black text-xs text-status-danger tabular-nums">{formatLKR(filteredTotalOut)}</span>
          </div>

          <div className="flex items-center gap-1.5 border-l border-[#EAE3DA] pl-3">
            <span className="w-2 h-2 rounded-full bg-amber-600 shrink-0" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted">Safe Drops:</span>
            <span className="font-black text-xs text-amber-900 tabular-nums">{formatLKR(filteredTotalDrops)}</span>
          </div>
        </div>

        {/* Right: Custom Designed Dropdown & Month Year Picker */}
        <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
          <div className="w-[170px] sm:w-[185px]">
            <CustomSelect
              value={typeFilter}
              onChange={(val) => setTypeFilter(val)}
              options={TYPE_FILTER_OPTIONS}
              buttonClassName="h-9 !py-0 px-3.5 bg-[#FAF7F2] hover:bg-cream-100 border-[#E0D7CC] rounded-full text-xs font-bold text-brand-brown-dark shadow-xs"
            />
          </div>

          <MonthYearPicker
            value={dateRange}
            onChange={(newVal) => setDateRange(newVal)}
          />
        </div>
      </div>

      {/* 4. MAIN DATA TABLE AREA */}
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
                  const isPending = tx.status === 'PENDING_APPROVAL';
                  const isRejected = tx.status === 'REJECTED';

                  return (
                    <tr
                      key={tx.id}
                      className={`hover:bg-[#FAF7F2]/70 transition-colors group ${
                        isPending ? 'bg-amber-50/40' : ''
                      }`}
                    >
                      {/* Timestamp */}
                      <td className="py-3.5 px-4 text-text-secondary whitespace-nowrap">
                        {formatDateTime(tx.timestamp)}
                      </td>

                      {/* Movement Type Badge */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase border inline-flex items-center gap-1.5 ${
                            isSale || isOpening || isIn
                              ? 'bg-status-success-bg text-status-success border-status-success/30'
                              : isRefund || isOut
                              ? 'bg-status-danger-bg text-status-danger border-status-danger/30'
                              : isDrop
                              ? 'bg-amber-50 text-amber-900 border-amber-300'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {isDrop ? (
                            <Building2 className="w-3 h-3 text-amber-800 shrink-0" />
                          ) : isPositive ? (
                            <ArrowDownRight className="w-3 h-3 text-status-success shrink-0" />
                          ) : (
                            <ArrowUpRight className="w-3 h-3 text-status-danger shrink-0" />
                          )}
                          <span>{isDrop ? 'CASH DROP' : tx.type.replace(/_/g, ' ')}</span>
                        </span>
                      </td>

                      {/* Cashier Name */}
                      <td className="py-3.5 px-4 font-black text-brand-brown-dark">
                        {tx.cashierName}
                      </td>

                      {/* Details / Reason */}
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

                      {/* Status Column with Inline Actions */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {isPending ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="px-2.5 py-0.5 rounded-full font-extrabold text-[9.5px] uppercase bg-amber-500 text-white shadow-2xs animate-pulse inline-flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              PENDING
                            </span>
                            <button
                              type="button"
                              onClick={() => handleApproveRequest(tx)}
                              className="p-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-all active:scale-95 cursor-pointer"
                              title="Approve request"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectRequest(tx)}
                              className="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all cursor-pointer"
                              title="Reject request"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
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

                      {/* Movement Amount */}
                      <td className="py-3.5 px-4 text-right">
                        <span
                          className={`font-black text-xs tabular-nums ${
                            isRejected
                              ? 'text-text-muted line-through'
                              : isPositive
                              ? 'text-status-success'
                              : 'text-status-danger'
                          }`}
                        >
                          {isPositive ? `+${formatLKR(tx.amount)}` : formatLKR(tx.amount)}
                        </span>
                      </td>

                      {/* Balance After */}
                      <td className="py-3.5 px-4 text-right font-black text-brand-brown-deep tabular-nums">
                        {formatLKR(tx.balanceAfter)}
                      </td>
                    </tr>
                  );
                })
              )}

              {/* Bottom Spacer Row to Ensure Last Record is Never Hidden by Floating Capsule */}
              {filteredTransactions.length > 0 && (
                <tr aria-hidden="true" className="border-0 pointer-events-none select-none">
                  <td colSpan={7} className="h-24 bg-transparent border-0" />
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
                        { id: 'CASH_OUT', label: '- Cash Out (Payout)' },
                        { id: 'CASH_DROP', label: '⬇ Safe Cash Drop' },
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
    </div>
  );
};
