import React, { useState, useEffect } from 'react';
import { orderService } from '@/services/orderService';
import { shiftService } from '@/services/shiftService';
import { promptDialog } from '@/store/useConfirmStore';
import { Order, CashierShift, Expense } from '@/types';
import { db } from '@/services/storage/db';
import { realtimeSocketService } from '@/services/realtimeSocketService';
import { formatLKR, formatDateTime } from '@/utils/format';
import {
  History,
  X,
  Printer,
  Utensils,
  RotateCcw,
  Search,
  Clock,
  Zap,
  Receipt,
  Banknote,
  CreditCard,
  QrCode,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';

export type OrderFilterScope = 'CURRENT_SHIFT' | 'TODAY' | 'ALL';

interface OrdersHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onViewReceipt: (order: Order) => void;
  onViewKOT: (order: Order) => void;
  userId: string;
  userName: string;
  shift?: CashierShift | null;
}

export const OrdersHistoryDrawer: React.FC<OrdersHistoryDrawerProps> = ({
  isOpen,
  onClose,
  onViewReceipt,
  onViewKOT,
  userId,
  userName,
  shift,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterScope, setFilterScope] = useState<OrderFilterScope>('CURRENT_SHIFT');
  const [orders, setOrders] = useState<Order[]>(() => orderService.getOrders());
  const [expenses, setExpenses] = useState<Expense[]>(() => db.getSnapshot().expenses || []);

  // Real-time synchronization whenever drawer is open
  useEffect(() => {
    if (!isOpen) return;

    const syncData = () => {
      setOrders(orderService.getOrders());
      setExpenses(db.getSnapshot().expenses || []);
    };

    syncData();
    const unsubDb = db.subscribe(syncData);
    const unsubRefundReq = realtimeSocketService.on('ORDER_REFUND_REQUESTED', syncData);
    const unsubRefunded = realtimeSocketService.on('ORDER_REFUNDED', syncData);
    const unsubUpdated = realtimeSocketService.on('ORDER_UPDATED', syncData);
    const unsubDrawerTx = realtimeSocketService.on('DRAWER_TRANSACTION', syncData);

    const handleStorage = (e: StorageEvent) => {
      if (
        e.key?.includes('cafemm') ||
        e.key?.includes('order') ||
        e.key?.includes('expense') ||
        e.key?.includes('drawer')
      ) {
        syncData();
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      unsubDb();
      unsubRefundReq();
      unsubRefunded();
      unsubUpdated();
      unsubDrawerTx();
      window.removeEventListener('storage', handleStorage);
    };
  }, [isOpen]);

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

  // Resolve current active shift
  const currentShift = shift || shiftService.getActiveShift(userId);

  const today = new Date();
  const isToday = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return (
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate()
      );
    } catch {
      return false;
    }
  };

  const isCurrentShiftOrder = (o: Order) => {
    if (!currentShift) return isToday(o.createdAt);
    if (o.shiftId && o.shiftId === currentShift.id) return true;
    if (currentShift.openedAt) {
      return new Date(o.createdAt).getTime() >= new Date(currentShift.openedAt).getTime();
    }
    return false;
  };

  const shiftOrders = orders.filter(isCurrentShiftOrder);
  const todayOrders = orders.filter((o) => isToday(o.createdAt));
  const allOrders = orders;

  const baseOrders =
    filterScope === 'CURRENT_SHIFT'
      ? shiftOrders
      : filterScope === 'TODAY'
      ? todayOrders
      : allOrders;

  const filtered = baseOrders.filter(
    (o) =>
      o.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.items.some((i) => i.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (o.tableNumber && o.tableNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (o.customerName && o.customerName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Compute sales summary directly (plain JS, zero hooks, perfectly safe)
  let cashSalesCents = 0;
  let cardSalesCents = 0;
  let qrSalesCents = 0;
  let cashOrdersCount = 0;
  let cardOrdersCount = 0;
  let qrOrdersCount = 0;
  let totalSalesCents = 0;
  let validOrdersCount = 0;
  let refundedOrdersCount = 0;
  let refundedAmountCents = 0;

  for (const o of baseOrders) {
    if (o.status === 'CANCELLED') continue;

    const isRefunded =
      o.status === 'REFUNDED' ||
      o.status === 'PARTIALLY_REFUNDED' ||
      o.refundStatus === 'APPROVED';

    if (isRefunded) {
      refundedOrdersCount++;
      refundedAmountCents += o.refundedAmountCents || o.totalCents;
      if (o.status === 'REFUNDED') continue;
    }

    validOrdersCount++;
    const amt = o.totalCents || 0;
    totalSalesCents += amt;

    if (o.paymentMethod === 'CASH') {
      cashSalesCents += amt;
      cashOrdersCount++;
    } else if (o.paymentMethod === 'CARD') {
      cardSalesCents += amt;
      cardOrdersCount++;
    } else if (o.paymentMethod === 'QR') {
      qrSalesCents += amt;
      qrOrdersCount++;
    } else if (o.paymentMethod === 'SPLIT' && o.paymentSplits) {
      let hasCash = false;
      let hasCard = false;
      let hasQr = false;
      o.paymentSplits.forEach((sp) => {
        if (sp.method === 'CASH' && sp.amountCents > 0) {
          cashSalesCents += sp.amountCents;
          hasCash = true;
        }
        if (sp.method === 'CARD' && sp.amountCents > 0) {
          cardSalesCents += sp.amountCents;
          hasCard = true;
        }
        if (sp.method === 'QR' && sp.amountCents > 0) {
          qrSalesCents += sp.amountCents;
          hasQr = true;
        }
      });
      if (hasCash) cashOrdersCount++;
      if (hasCard) cardOrdersCount++;
      if (hasQr) qrOrdersCount++;
    }
  }

  const salesSummary = {
    totalSalesCents,
    cashSalesCents,
    cardSalesCents,
    qrSalesCents,
    cashOrdersCount,
    cardOrdersCount,
    qrOrdersCount,
    totalOrdersCount: validOrdersCount,
    refundedOrdersCount,
    refundedAmountCents,
  };

  // Filter expenses according to selected scope (Current Shift vs Today vs All)
  const currentShiftExpenses = expenses.filter((e) => {
    if (!currentShift) return isToday(e.createdAt);
    if (e.shiftId && e.shiftId === currentShift.id) return true;
    if (currentShift.openedAt) {
      return new Date(e.createdAt).getTime() >= new Date(currentShift.openedAt).getTime();
    }
    return false;
  });
  const todayExpenses = expenses.filter((e) => isToday(e.createdAt));
  const allExpenses = expenses;

  const scopeExpenses =
    filterScope === 'CURRENT_SHIFT'
      ? currentShiftExpenses
      : filterScope === 'TODAY'
      ? todayExpenses
      : allExpenses;

  const totalExpensesCents = scopeExpenses.reduce((sum, e) => sum + (e.amountCents || 0), 0);
  const totalExpensesCount = scopeExpenses.length;

  const handleRefund = async (order: Order) => {
    const reason = await promptDialog({
      title: `Request Refund for Order ${order.orderNumber}`,
      message: 'Enter reason for this refund request (sent to Admin for confirmation):',
      defaultValue: 'Customer change of mind',
      placeholder: 'e.g. Customer change of mind, wrong order, food issue...',
      confirmText: 'Submit Request to Admin',
      variant: 'warning',
    });
    if (!reason || !reason.trim()) return;
    try {
      await orderService.requestRefund({
        orderId: order.id,
        reason: reason.trim(),
        userId,
        userName,
      });
      setOrders(orderService.getOrders());
      toast.success(`Refund request for ${order.orderNumber} submitted to Admin.`);
    } catch (err: any) {
      toast.error(err.message || 'Refund request failed');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex justify-end bg-brand-brown-deep/50 backdrop-blur-sm animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl sm:max-w-3xl lg:max-w-[760px] bg-white h-full shadow-2xl flex flex-col border-l border-border animate-in slide-in-from-right duration-200"
      >
        {/* Header */}
        <div className="p-4 bg-cream-50 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-teal/10 text-brand-teal">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-brand-brown-dark">Recent Orders</h3>
              {currentShift && filterScope === 'CURRENT_SHIFT' ? (
                <p className="text-[10.5px] text-brand-teal font-bold flex items-center gap-1">
                  <span>Shift #{currentShift.shiftNumber}</span>
                  <span>•</span>
                  <span>Started {formatDateTime(currentShift.openedAt)}</span>
                </p>
              ) : (
                <p className="text-[10.5px] text-text-secondary font-medium">
                  {filterScope === 'TODAY' ? "Showing all today's orders" : 'Showing all historical orders'}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-secondary hover:bg-cream-100 hover:text-brand-brown-dark cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Two-Column Drawer Body */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          {/* Left Column: Search, Toggle Tabs & Orders List */}
          <div className="flex-1 flex flex-col min-w-0 border-b md:border-b-0 md:border-r border-border">
            {/* Search & Toggle Tabs */}
            <div className="p-3 border-b border-border bg-white space-y-2.5">
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by order # or item name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-cream-50 border border-border rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-teal/40"
                />
              </div>

              {/* Scope Toggle Tabs */}
              <div className="grid grid-cols-2 p-1 bg-cream-100 rounded-2xl border border-border/80 gap-1.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setFilterScope('CURRENT_SHIFT')}
                  className={`py-2 px-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    filterScope === 'CURRENT_SHIFT'
                      ? 'bg-brand-teal text-white shadow-xs font-black'
                      : 'text-text-secondary hover:text-brand-brown-dark hover:bg-cream-200/60 font-bold'
                  }`}
                >
                  <Zap className={`w-3.5 h-3.5 shrink-0 ${filterScope === 'CURRENT_SHIFT' ? 'text-white' : 'text-brand-teal'}`} />
                  <span className="truncate">Current Shift {currentShift ? `(#${currentShift.shiftNumber})` : ''}</span>
                  <span
                    className={`ml-0.5 px-2 py-0.5 rounded-full text-[10.5px] shrink-0 font-extrabold transition-colors ${
                      filterScope === 'CURRENT_SHIFT'
                        ? 'bg-white/25 text-white'
                        : 'bg-white text-brand-brown-dark border border-border/70 shadow-2xs'
                    }`}
                  >
                    {shiftOrders.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterScope('TODAY')}
                  className={`py-2 px-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    filterScope === 'TODAY'
                      ? 'bg-brand-teal text-white shadow-xs font-black'
                      : 'text-text-secondary hover:text-brand-brown-dark hover:bg-cream-200/60 font-bold'
                  }`}
                >
                  <Clock className={`w-3.5 h-3.5 shrink-0 ${filterScope === 'TODAY' ? 'text-white' : 'text-brand-teal'}`} />
                  <span className="truncate">Today</span>
                  <span
                    className={`ml-0.5 px-2 py-0.5 rounded-full text-[10.5px] shrink-0 font-extrabold transition-colors ${
                      filterScope === 'TODAY'
                        ? 'bg-white/25 text-white'
                        : 'bg-white text-brand-brown-dark border border-border/70 shadow-2xs'
                    }`}
                  >
                    {todayOrders.length}
                  </span>
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
              {filtered.length === 0 ? (
                <div className="text-center py-12 text-text-secondary space-y-2">
                  <History className="w-9 h-9 mx-auto text-zinc-300 mb-1" />
                  <p className="font-bold text-xs text-brand-brown">
                    {filterScope === 'CURRENT_SHIFT'
                      ? 'No orders placed in this shift yet.'
                      : 'No matching orders found.'}
                  </p>
                  {filterScope === 'CURRENT_SHIFT' && todayOrders.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFilterScope('TODAY')}
                      className="text-xs font-bold text-brand-teal hover:underline cursor-pointer pt-1 inline-block"
                    >
                      View Today's Earlier Orders ({todayOrders.length})
                    </button>
                  )}
                </div>
              ) : (
                filtered.map((order) => {
                  const isRefunded = order.status === 'REFUNDED' || order.status === 'PARTIALLY_REFUNDED' || order.refundStatus === 'APPROVED';
                  const isRefundPending = order.status === 'REFUND_PENDING' || order.refundStatus === 'PENDING_APPROVAL';

                  return (
                    <div
                      key={order.id}
                      onClick={() => onViewReceipt(order)}
                      className="p-3.5 bg-cream-50/50 rounded-2xl border border-border space-y-2 hover:border-brand-teal/50 hover:bg-cream-100/30 transition-all cursor-pointer select-none"
                      title="Click to view receipt"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-sm text-brand-brown-dark">{order.orderNumber}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cream-200 text-brand-brown uppercase">
                              {order.orderType === 'DINE_IN' ? `Table ${order.tableNumber || '01'}` : 'Takeaway'}
                            </span>
                            {order.customerName && (
                              <span className="text-[10px] font-medium text-text-secondary">
                                • {order.customerName}
                              </span>
                            )}
                            {isRefunded && (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-status-danger/10 text-status-danger uppercase">
                                Refunded
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-text-secondary mt-0.5">{formatDateTime(order.createdAt)}</p>
                        </div>
                        <div className="text-right">
                          <div className="font-extrabold text-sm text-text-primary tabular-nums">
                            {formatLKR(order.totalCents)}
                          </div>
                          <div className="text-[10px] uppercase font-bold text-brand-teal">{order.paymentMethod}</div>
                        </div>
                      </div>

                      <div className="text-xs text-text-secondary border-t border-cream-100 pt-1.5 space-y-0.5">
                        {order.items.map((it, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span>{it.quantity}x {it.name}</span>
                            <span className="tabular-nums">{formatLKR(it.itemTotalCents)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-cream-200" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => onViewKOT(order)}
                          className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-brand-brown bg-white border border-border rounded-lg hover:bg-cream-100 cursor-pointer"
                        >
                          <Utensils className="w-3 h-3 text-brand-orange" />
                          KOT
                        </button>
                        <button
                          type="button"
                          onClick={() => onViewReceipt(order)}
                          className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-brand-teal-dark bg-brand-teal-light border border-brand-teal/30 rounded-lg hover:bg-brand-teal hover:text-white transition-colors cursor-pointer"
                          title="View receipt preview (print directly from preview)"
                        >
                          <Receipt className="w-3 h-3" />
                          Receipt
                        </button>
                        {isRefundPending ? (
                          <span className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-amber-800 bg-amber-100/70 border border-amber-300/80 rounded-lg cursor-not-allowed">
                            <Clock className="w-3 h-3 text-amber-600 animate-spin" />
                            Pending Approval
                          </span>
                        ) : !isRefunded ? (
                          <button
                            type="button"
                            onClick={() => handleRefund(order)}
                            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-status-danger bg-white border border-status-danger/30 rounded-lg hover:bg-status-danger-bg transition-colors cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Refund
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Vertical Sales Summary Panel */}
          <div className="w-full md:w-64 lg:w-72 bg-cream-50/70 shrink-0 flex flex-col border-t md:border-t-0 md:border-l border-border overflow-y-auto">
            <div className="p-4 space-y-3">
              {/* Panel Header */}
              <div className="flex items-center justify-between pb-1.5 border-b border-border/70">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-brand-teal" />
                  <span className="font-black text-xs text-brand-brown-dark tracking-wide uppercase">
                    {filterScope === 'CURRENT_SHIFT' ? 'Shift Sales' : "Today's Sales"}
                  </span>
                </div>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-brand-teal/10 text-brand-teal">
                  {salesSummary.totalOrdersCount} {salesSummary.totalOrdersCount === 1 ? 'Order' : 'Orders'}
                </span>
              </div>

              {/* 1. Total Net Sales Card */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-brand-brown-deep via-brand-brown to-brand-brown-dark text-white shadow-sm space-y-1.5">
                <div className="flex items-center justify-between text-cream-200/80">
                  <span className="text-[10px] font-extrabold tracking-wider uppercase">Total Sales</span>
                  <Receipt className="w-3.5 h-3.5 text-brand-yellow" />
                </div>
                <div className="text-xl font-black font-mono tracking-tight text-white tabular-nums">
                  {formatLKR(salesSummary.totalSalesCents)}
                </div>
                <div className="text-[10px] text-cream-200/70 font-semibold flex items-center justify-between pt-0.5">
                  <span>
                    {filterScope === 'CURRENT_SHIFT'
                      ? `Shift #${currentShift?.shiftNumber || '100+'}`
                      : "Today's Orders"}
                  </span>
                  {salesSummary.refundedOrdersCount > 0 && (
                    <span className="text-rose-300 font-bold">
                      {salesSummary.refundedOrdersCount} refunded
                    </span>
                  )}
                </div>
              </div>

              {/* 2. Cash Sales Card */}
              <div className="p-3 bg-white rounded-2xl border border-emerald-200/80 shadow-2xs space-y-1.5 hover:border-emerald-300 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Banknote className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[11px] font-extrabold text-emerald-950 uppercase tracking-wider">Cash Sales</span>
                  </div>
                  <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700">
                    {salesSummary.totalSalesCents > 0
                      ? `${Math.round((salesSummary.cashSalesCents / salesSummary.totalSalesCents) * 100)}%`
                      : '0%'}
                  </span>
                </div>

                <div className="text-base font-black font-mono text-emerald-700 tabular-nums">
                  {formatLKR(salesSummary.cashSalesCents)}
                </div>

                <div className="text-[10.5px] text-text-secondary font-semibold flex items-center justify-between pt-0.5 border-t border-emerald-50">
                  <span>{salesSummary.cashOrdersCount} {salesSummary.cashOrdersCount === 1 ? 'order' : 'orders'}</span>
                  <span className="text-[10px] font-bold text-emerald-600/80">Cash Drawer</span>
                </div>
              </div>

              {/* 3. Card Sales Card */}
              <div className="p-3 bg-white rounded-2xl border border-sky-200/80 shadow-2xs space-y-1.5 hover:border-sky-300 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                      <CreditCard className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[11px] font-extrabold text-sky-950 uppercase tracking-wider">Card Sales</span>
                  </div>
                  <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-700">
                    {salesSummary.totalSalesCents > 0
                      ? `${Math.round((salesSummary.cardSalesCents / salesSummary.totalSalesCents) * 100)}%`
                      : '0%'}
                  </span>
                </div>

                <div className="text-base font-black font-mono text-sky-700 tabular-nums">
                  {formatLKR(salesSummary.cardSalesCents)}
                </div>

                <div className="text-[10.5px] text-text-secondary font-semibold flex items-center justify-between pt-0.5 border-t border-sky-50">
                  <span>{salesSummary.cardOrdersCount} {salesSummary.cardOrdersCount === 1 ? 'order' : 'orders'}</span>
                  <span className="text-[10px] font-bold text-sky-600/80">POS Terminal</span>
                </div>
              </div>

              {/* 4. QR Sales Card (if any) */}
              {salesSummary.qrSalesCents > 0 && (
                <div className="p-3 bg-white rounded-2xl border border-purple-200/80 shadow-2xs space-y-1.5 hover:border-purple-300 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                        <QrCode className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[11px] font-extrabold text-purple-950 uppercase tracking-wider">QR Sales</span>
                    </div>
                    <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-700">
                      {salesSummary.totalSalesCents > 0
                        ? `${Math.round((salesSummary.qrSalesCents / salesSummary.totalSalesCents) * 100)}%`
                        : '0%'}
                    </span>
                  </div>

                  <div className="text-base font-black font-mono text-purple-700 tabular-nums">
                    {formatLKR(salesSummary.qrSalesCents)}
                  </div>

                  <div className="text-[10.5px] text-text-secondary font-semibold flex items-center justify-between pt-0.5 border-t border-purple-50">
                    <span>{salesSummary.qrOrdersCount} {salesSummary.qrOrdersCount === 1 ? 'order' : 'orders'}</span>
                    <span className="text-[10px] font-bold text-purple-600/80">Digital QR</span>
                  </div>
                </div>
              )}

              {/* 5. Total Expenses Card */}
              <div className="p-3 bg-white rounded-2xl border border-amber-200/80 shadow-2xs space-y-1.5 hover:border-amber-300 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                      <Wallet className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[11px] font-extrabold text-amber-950 uppercase tracking-wider">Total Expenses</span>
                  </div>
                  <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700">
                    {totalExpensesCount} {totalExpensesCount === 1 ? 'item' : 'items'}
                  </span>
                </div>

                <div className="text-base font-black font-mono text-amber-700 tabular-nums">
                  {formatLKR(totalExpensesCents)}
                </div>

                <div className="text-[10.5px] text-text-secondary font-semibold flex items-center justify-between pt-0.5 border-t border-amber-50">
                  <span>
                    {filterScope === 'CURRENT_SHIFT'
                      ? `Shift #${currentShift?.shiftNumber || 'Active'}`
                      : "Today's Total"}
                  </span>
                  <span className="text-[10px] font-bold text-amber-600/80">Outflow</span>
                </div>
              </div>

              {/* 6. Total Refunds Card */}
              {salesSummary.refundedAmountCents > 0 && (
                <div className="p-3 bg-white rounded-2xl border border-rose-200/80 shadow-2xs space-y-1.5 hover:border-rose-300 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                        <RotateCcw className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[11px] font-extrabold text-rose-950 uppercase tracking-wider">Total Refunds</span>
                    </div>
                    <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700">
                      {salesSummary.refundedOrdersCount} {salesSummary.refundedOrdersCount === 1 ? 'order' : 'orders'}
                    </span>
                  </div>

                  <div className="text-base font-black font-mono text-rose-700 tabular-nums">
                    -{formatLKR(salesSummary.refundedAmountCents)}
                  </div>

                  <div className="text-[10.5px] text-text-secondary font-semibold flex items-center justify-between pt-0.5 border-t border-rose-50">
                    <span>
                      {filterScope === 'CURRENT_SHIFT'
                        ? `Shift #${currentShift?.shiftNumber || 'Active'}`
                        : "Today's Total"}
                    </span>
                    <span className="text-[10px] font-bold text-rose-600/80">Returned</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
