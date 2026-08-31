import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { orderService } from '@/services/orderService';
import { realtimeSocketService } from '@/services/realtimeSocketService';
import { promptDialog } from '@/store/useConfirmStore';
import { Order } from '@/types';
import { db } from '@/services/storage/db';
import { formatLKR, formatDateTime, formatTime } from '@/utils/format';
import { CustomSelect, SelectOption } from '@/components/ui/CustomSelect';
import { MonthYearPicker, MonthYearValue } from '@/components/ui/MonthYearPicker';
import { ThermalReceiptModal } from '@/components/brand/ThermalReceiptModal';
import { KOTPreviewModal } from '@/components/brand/KOTPreviewModal';
import {
  ShoppingBag,
  Search,
  Printer,
  Utensils,
  RotateCcw,
  Eye,
  X,
  CheckCircle2,
  Calendar,
  Filter,
  DollarSign,
  TrendingUp,
  CreditCard,
  QrCode,
  Coins,
  ArrowUpDown,
  RefreshCw,
  Clock,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'REFUNDED', label: 'Refunded' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const PAYMENT_OPTIONS: SelectOption[] = [
  { value: 'ALL', label: 'All Payment Methods' },
  { value: 'CASH', label: 'Cash Only' },
  { value: 'CARD', label: 'Card Payment' },
  { value: 'SPLIT', label: 'Split Payment' },
];

export const AdminOrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>(orderService.getOrders());
  const [search, setSearch] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Default to current year and current month
  const now = new Date();
  const currentYearStr = String(now.getFullYear());
  const currentMonthStr = String(now.getMonth() + 1);

  const [dateRange, setDateRange] = useState<MonthYearValue>({
    year: currentYearStr,
    month: currentMonthStr,
  });

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<string>('ALL');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Modals for printing
  const [viewingReceipt, setViewingReceipt] = useState<Order | null>(null);
  const [viewingKOT, setViewingKOT] = useState<Order | null>(null);

  useEffect(() => {
    const refreshOrders = () => setOrders(orderService.getOrders());
    const unsubDb = db.subscribe(refreshOrders);
    const unsubCreated = realtimeSocketService.on('ORDER_CREATED', refreshOrders);
    const unsubRefunded = realtimeSocketService.on('ORDER_REFUNDED', refreshOrders);
    const unsubUpdated = realtimeSocketService.on('ORDER_UPDATED', refreshOrders);

    return () => {
      unsubDb();
      unsubCreated();
      unsubRefunded();
      unsubUpdated();
    };
  }, []);

  // Filter orders based on Year, Month, Status, Payment, Search
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const orderDate = new Date(o.createdAt);
      const orderYear = String(orderDate.getFullYear());
      const orderMonth = String(orderDate.getMonth() + 1);

      // Year filter
      if (dateRange.year !== 'ALL' && orderYear !== dateRange.year) return false;

      // Month filter
      if (dateRange.month !== 'ALL' && orderMonth !== dateRange.month) return false;

      // Status filter
      if (statusFilter !== 'ALL' && o.status !== statusFilter) return false;

      // Payment method filter
      if (paymentFilter !== 'ALL' && o.paymentMethod !== paymentFilter) return false;

      // Text search
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          o.orderNumber.toLowerCase().includes(q) ||
          o.cashierName.toLowerCase().includes(q) ||
          (o.tableNumber && o.tableNumber.includes(q)) ||
          (o.customerName && o.customerName.toLowerCase().includes(q)) ||
          o.items.some((i) => i.name.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [orders, dateRange, statusFilter, paymentFilter, search]);

  const handleRefund = async (order: Order) => {
    const reason = await promptDialog({
      title: `Refund Order ${order.orderNumber}?`,
      message: 'Enter reason for processing this order refund:',
      defaultValue: 'Customer requested cancellation',
      placeholder: 'e.g. Customer requested cancellation...',
      confirmText: 'Process Refund',
      variant: 'danger',
    });
    if (!reason || !reason.trim()) return;

    try {
      await orderService.refundOrder({
        orderId: order.id,
        reason: reason.trim(),
        userId: 'usr_admin',
        userName: 'Admin Chaminda',
      });
      toast.success(`Order ${order.orderNumber} refunded successfully.`);
      if (selectedOrder?.id === order.id) {
        setSelectedOrder(orderService.getOrderById(order.id) || null);
      }
    } catch (err: any) {
      toast.error(err.message || 'Refund failed');
    }
  };

  const handleResetFilters = () => {
    setDateRange({
      year: currentYearStr,
      month: currentMonthStr,
    });
    setStatusFilter('ALL');
    setPaymentFilter('ALL');
    setSearch('');
  };

  const MONTH_NAMES: { [key: string]: string } = {
    '1': 'January', '2': 'February', '3': 'March', '4': 'April',
    '5': 'May', '6': 'June', '7': 'July', '8': 'August',
    '9': 'September', '10': 'October', '11': 'November', '12': 'December',
  };

  const currentPeriodLabel =
    dateRange.year === 'ALL' && dateRange.month === 'ALL'
      ? 'All Time'
      : dateRange.month === 'ALL'
      ? `All Months ${dateRange.year}`
      : `${MONTH_NAMES[dateRange.month] || ''} ${dateRange.year}`;

  return (
    <div className="h-full flex-1 flex flex-col min-h-0 space-y-3 w-full animate-in fade-in">
      {/* Top Filter Toolbar (3 Buttons on a Single Clean Row) */}
      <div className="flex items-center justify-end gap-2 shrink-0 w-full relative z-30">
        <div className="w-[130px] sm:w-[155px] shrink-0 relative z-30">
          <CustomSelect
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            options={STATUS_OPTIONS}
            buttonClassName="h-9 !py-0 px-3 bg-[#FAF7F2] hover:bg-cream-100 border-[#E0D7CC] rounded-full text-xs font-bold text-brand-brown-dark shadow-xs"
          />
        </div>

        <div className="w-[145px] sm:w-[175px] shrink-0 relative z-30">
          <CustomSelect
            value={paymentFilter}
            onChange={(val) => setPaymentFilter(val)}
            options={PAYMENT_OPTIONS}
            buttonClassName="h-9 !py-0 px-3 bg-[#FAF7F2] hover:bg-cream-100 border-[#E0D7CC] rounded-full text-xs font-bold text-brand-brown-dark shadow-xs"
          />
        </div>

        <div className="shrink-0 relative z-30">
          <MonthYearPicker
            value={dateRange}
            onChange={(newVal) => setDateRange(newVal)}
          />
        </div>
      </div>

      {/* 2. Orders Table (Internal Scroll Only with Sticky Header) */}
      <div className="flex-1 min-h-0 bg-white rounded-2xl border border-[#E9E0D5] shadow-sm overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto min-h-0">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-[#FAF7F2] z-10 shadow-xs">
              <tr className="border-b border-[#EAE3DA] text-text-muted font-extrabold uppercase text-[10px]">
                <th className="py-3 px-4 bg-[#FAF7F2]">Order #</th>
                <th className="py-3 px-4 bg-[#FAF7F2]">Date / Time</th>
                <th className="py-3 px-4 bg-[#FAF7F2]">Type</th>
                <th className="py-3 px-4 bg-[#FAF7F2]">Cashier</th>
                <th className="py-3 px-4 bg-[#FAF7F2]">Items Summary</th>
                <th className="py-3 px-4 bg-[#FAF7F2]">Payment</th>
                <th className="py-3 px-4 text-right bg-[#FAF7F2]">Total</th>
                <th className="py-3 px-4 text-center bg-[#FAF7F2]">Status</th>
                <th className="py-3 px-4 text-right bg-[#FAF7F2]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2ECE4] font-medium">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-16 text-text-muted">
                    <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-text-muted/50" />
                    <div>No orders found matching the selected year, month, or search filters.</div>
                    <button
                      onClick={handleResetFilters}
                      className="mt-3 px-3 py-1 text-xs font-bold text-brand-teal hover:underline"
                    >
                      Reset filters
                    </button>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((ord) => {
                  const isRefunded = ord.status === 'REFUNDED' || ord.status === 'PARTIALLY_REFUNDED';

                  return (
                    <tr key={ord.id} className="hover:bg-[#FAF7F2]/80 transition-colors">
                      <td className="py-3 px-4 font-black text-brand-brown-dark">{ord.orderNumber}</td>
                      <td className="py-3 px-4 text-text-secondary whitespace-nowrap">{formatDateTime(ord.createdAt)}</td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="px-2.5 py-0.5 rounded-full bg-[#FAF7F2] border border-[#E0D7CC] text-[10px] font-bold text-brand-brown">
                          {ord.orderType === 'DINE_IN' ? `Table ${ord.tableNumber || '01'}` : 'Takeaway'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-text-primary whitespace-nowrap">{ord.cashierName}</td>
                      <td className="py-3 px-4 text-text-secondary truncate max-w-[220px]">
                        {ord.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md font-extrabold text-[10px] uppercase bg-brand-teal/10 text-brand-teal">
                          {ord.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-brand-brown-deep tabular-nums whitespace-nowrap">
                        {formatLKR(ord.totalCents)}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-extrabold text-[10px] uppercase ${
                            isRefunded
                              ? 'bg-status-danger-bg text-status-danger'
                              : 'bg-status-success-bg text-status-success'
                          }`}
                        >
                          {ord.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedOrder(ord)}
                            className="px-2.5 py-1 bg-[#FAF7F2] hover:bg-brand-teal hover:text-white rounded-lg text-brand-brown font-bold text-xs transition-colors border border-[#E0D7CC]"
                          >
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Floating Bottom Pop-Up Search Bar (Exact Same Height & Width as Products Studio) */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center pointer-events-none select-none">
        <div className="bg-[#1E1917]/95 text-white backdrop-blur-xl border border-white/10 shadow-2xl rounded-full h-[52px] px-4 flex items-center gap-2 transition-all duration-300 pointer-events-auto">
          <Search className="w-4 h-4 text-white/50 shrink-0 pointer-events-none" />
          <input
            type="text"
            placeholder="Search orders..."
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
              onClick={() => setSearch('')}
              className="p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 4. Single-Window Order Details Modal */}
      {selectedOrder &&
        createPortal(
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedOrder(null);
            }}
            className="fixed inset-0 z-[99999] w-full h-full bg-black/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in select-none"
          >
            <div className="w-full max-w-[500px] sm:max-w-[520px] bg-white rounded-3xl shadow-2xl border border-[#E9E0D5] overflow-hidden flex flex-col my-auto animate-in zoom-in-95 duration-200 select-text">
              {/* Card Top Header */}
              <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-[#FAF7F2] border-b border-[#EAE3DA] shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-brand-teal/10 text-brand-teal flex items-center justify-center shrink-0">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-base text-brand-brown-dark">
                        Order Details {selectedOrder.orderNumber}
                      </h3>
                      <span
                        className={`text-[9.5px] font-extrabold px-2.5 py-0.5 rounded-full border uppercase ${
                          selectedOrder.status === 'REFUNDED'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-teal-50 text-brand-teal border-teal-200'
                        }`}
                      >
                        {selectedOrder.status}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="p-1.5 rounded-xl text-text-secondary hover:bg-cream-100 hover:text-brand-brown-dark transition-colors cursor-pointer"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Card Body */}
              <div className="p-5 sm:p-6 space-y-4 max-h-[66vh] overflow-y-auto custom-scrollbar">
                {/* Service & Staff Audit Banner */}
                <div className="p-3.5 bg-[#FAF7F2] rounded-2xl border border-[#E2D8CC] flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-xl bg-brand-brown-deep text-white font-extrabold text-[10px] uppercase shadow-xs">
                      {selectedOrder.orderType === 'DINE_IN'
                        ? `Dine In (Table #${selectedOrder.tableNumber || '01'})`
                        : 'Takeaway'}
                    </span>
                    <span className="px-2 py-1 rounded-xl bg-white border border-[#E0D7CC] text-brand-teal font-extrabold text-[10px] uppercase shadow-2xs">
                      {selectedOrder.paymentMethod}
                    </span>
                  </div>
                  <div className="text-right text-[11px] text-text-secondary">
                    <div className="font-semibold">{formatDateTime(selectedOrder.createdAt)}</div>
                    <div className="text-[10px] text-text-muted">Staff: <strong className="text-brand-brown-dark">{selectedOrder.cashierName}</strong></div>
                  </div>
                </div>

                {/* Ordered Items Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-text-secondary">
                    <span>Items & Customizations</span>
                    <span className="text-[10px] text-text-muted font-bold">
                      {selectedOrder.items.reduce((s, i) => s + i.quantity, 0)} Total Units
                    </span>
                  </div>

                  <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-1 custom-scrollbar">
                    {selectedOrder.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-[#FAF7F2] p-3 rounded-2xl border border-[#EAE3DA] space-y-1.5 hover:border-brand-teal/40 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-md bg-[#251814] text-white font-extrabold text-[10px] flex items-center justify-center shrink-0">
                              {item.quantity}
                            </span>
                            <span className="font-bold text-xs text-brand-brown-dark">{item.name}</span>
                          </div>
                          <span className="font-black text-xs text-brand-brown-deep tabular-nums shrink-0">
                            {formatLKR(item.itemTotalCents)}
                          </span>
                        </div>

                        {/* Modifiers List */}
                        {item.modifiers && item.modifiers.length > 0 && (
                          <div className="flex flex-wrap gap-1 pl-7">
                            {item.modifiers.map((m, mIdx) => (
                              <span
                                key={mIdx}
                                className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-md bg-white border border-[#E0D7CC] text-text-secondary"
                              >
                                + {m.optionName}{' '}
                                {m.priceCents > 0 && (
                                  <strong className="text-brand-teal font-extrabold">({formatLKR(m.priceCents)})</strong>
                                )}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Prep Notes */}
                        {item.notes && (
                          <div className="text-[9.5px] font-bold text-amber-800 bg-amber-50/80 px-2 py-0.5 rounded border border-amber-200/80 ml-7">
                            Note: {item.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Billing Settlement Card */}
                <div className="p-4 bg-[#FAF7F2] rounded-2xl border border-[#E2D8CC] space-y-1.5 text-xs">
                  <div className="flex justify-between text-text-secondary text-xs">
                    <span>Subtotal:</span>
                    <span className="tabular-nums font-semibold">{formatLKR(selectedOrder.subtotalCents)}</span>
                  </div>

                  {selectedOrder.discountCents > 0 && (
                    <div className="flex justify-between text-status-success font-semibold text-xs">
                      <span>Discount ({selectedOrder.discountReason || 'Promo'}):</span>
                      <span className="tabular-nums">-{formatLKR(selectedOrder.discountCents)}</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-[#EAE3DA] flex justify-between items-baseline font-black text-brand-brown-dark">
                    <span className="text-xs uppercase tracking-wider">Total Paid:</span>
                    <span className="text-xl text-brand-teal-dark tabular-nums">
                      {formatLKR(selectedOrder.totalCents)}
                    </span>
                  </div>
                </div>

                {/* Refund Record Notice (if refunded) */}
                {selectedOrder.status === 'REFUNDED' && (
                  <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200 text-xs space-y-0.5 text-rose-800">
                    <div className="flex items-center gap-1.5 font-extrabold text-[10px] uppercase text-rose-700">
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Order Refunded</span>
                    </div>
                    <p className="text-xs font-medium">
                      Reason: <strong>{selectedOrder.refundReason || 'Customer requested refund'}</strong>
                    </p>
                    {selectedOrder.refundedAmountCents ? (
                      <p className="text-[10px] text-rose-600 font-bold">
                        Refunded Amount: {formatLKR(selectedOrder.refundedAmountCents)}
                      </p>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Bottom Card Footer with Actions */}
              <div className="px-5 sm:px-6 py-3.5 bg-[#FAF7F2] border-t border-[#EAE3DA] flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setViewingKOT(selectedOrder)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#E0D7CC] hover:bg-cream-100 rounded-2xl text-xs font-bold text-brand-brown shadow-xs transition-all cursor-pointer"
                  >
                    <Utensils className="w-3.5 h-3.5 text-[#E99343]" />
                    <span>KOT Ticket</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setViewingReceipt(selectedOrder)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-brand-teal hover:bg-brand-teal-dark text-white rounded-2xl text-xs font-extrabold shadow-teal transition-all active:scale-95 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Receipt</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {selectedOrder.status !== 'REFUNDED' && (
                    <button
                      type="button"
                      onClick={() => handleRefund(selectedOrder)}
                      className="flex items-center gap-1 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-2xl text-xs font-bold transition-all cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Refund</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedOrder(null)}
                    className="px-4 py-2 rounded-2xl border border-[#E0D7CC] bg-white hover:bg-cream-100 text-text-primary text-xs font-bold transition-all cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Modals for thermal print preview */}
      <ThermalReceiptModal
        order={viewingReceipt}
        isOpen={Boolean(viewingReceipt)}
        onClose={() => setViewingReceipt(null)}
      />

      <KOTPreviewModal
        order={viewingKOT}
        isOpen={Boolean(viewingKOT)}
        onClose={() => setViewingKOT(null)}
      />
    </div>
  );
};

