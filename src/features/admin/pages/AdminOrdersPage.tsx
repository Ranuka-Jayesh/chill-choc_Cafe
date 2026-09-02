import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { orderService } from '@/services/orderService';
import { customerService } from '@/services/customerService';
import { realtimeSocketService } from '@/services/realtimeSocketService';
import { promptDialog } from '@/store/useConfirmStore';
import { Order, Customer } from '@/types';
import { db } from '@/services/storage/db';
import { formatLKR, formatDateTime, formatTime } from '@/utils/format';
import { CustomSelect, SelectOption } from '@/components/ui/CustomSelect';
import { MonthYearPicker, MonthYearValue } from '@/components/ui/MonthYearPicker';
import { ThermalReceiptModal } from '@/components/brand/ThermalReceiptModal';
import { KOTPreviewModal } from '@/components/brand/KOTPreviewModal';
import { CustomerProfileModal } from '@/features/admin/components/CustomerProfileModal';
import { CustomerDetailView } from '@/features/admin/components/CustomerDetailView';
import {
  ShoppingBag,
  Users,
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
  Phone,
  Award,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

const PAYMENT_OPTIONS: SelectOption[] = [
  { value: 'ALL', label: 'All Payment Methods' },
  { value: 'CASH', label: 'Cash Only' },
  { value: 'CARD', label: 'Card Payment' },
  { value: 'SPLIT', label: 'Split Payment' },
];

const TIER_OPTIONS: SelectOption[] = [
  { value: 'ALL', label: 'All Tiers' },
  { value: 'PLATINUM', label: 'Platinum Members' },
  { value: 'GOLD', label: 'Gold Members' },
  { value: 'SILVER', label: 'Silver Members' },
  { value: 'BRONZE', label: 'Bronze Members' },
];

export const AdminOrdersPage: React.FC = () => {
  const [viewMode, setViewMode] = useState<'orders' | 'customers'>('orders');
  const [orders, setOrders] = useState<Order[]>(orderService.getOrders());
  const [customers, setCustomers] = useState<Customer[]>(() => customerService.getCustomers());
  const [search, setSearch] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Real-time synchronization
  useEffect(() => {
    const syncAll = () => {
      setOrders(orderService.getOrders());
      setCustomers(customerService.getCustomers());
    };
    const unsub = db.subscribe(syncAll);
    const handleStorage = (e: StorageEvent) => {
      if (e.key?.includes('cafemm') || e.key?.includes('order')) {
        syncAll();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      unsub();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

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
  const [tierFilter, setTierFilter] = useState<string>('ALL');

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Keep selectedOrder in sync with real-time updates
  useEffect(() => {
    if (selectedOrder) {
      const refreshed = orders.find((o) => o.id === selectedOrder.id);
      if (refreshed && JSON.stringify(refreshed) !== JSON.stringify(selectedOrder)) {
        setSelectedOrder(refreshed);
      }
    }
  }, [orders, selectedOrder]);

  const pendingRefundCount = useMemo(() => {
    return orders.filter(
      (o) => o.status === 'REFUND_PENDING' || o.refundStatus === 'PENDING_APPROVAL'
    ).length;
  }, [orders]);

  const STATUS_OPTIONS: SelectOption[] = useMemo(
    () => [
      { value: 'ALL', label: 'All Statuses' },
      {
        value: 'REFUND_PENDING',
        label: pendingRefundCount > 0 ? `⚠️ Refund Requests (${pendingRefundCount})` : 'Refund Requests',
      },
      { value: 'COMPLETED', label: 'Completed' },
      { value: 'REFUNDED', label: 'Refunded' },
      { value: 'CANCELLED', label: 'Cancelled' },
    ],
    [pendingRefundCount]
  );

  // Modals for printing
  const [viewingReceipt, setViewingReceipt] = useState<Order | null>(null);
  const [viewingKOT, setViewingKOT] = useState<Order | null>(null);

  // Filter orders based on Date Range, Status, Payment and Search
  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      // Date Range Filter
      if (dateRange.year !== 'ALL' || dateRange.month !== 'ALL') {
        const orderDate = new Date(ord.createdAt);
        const orderYear = String(orderDate.getFullYear());
        const orderMonth = String(orderDate.getMonth() + 1);

        if (dateRange.year !== 'ALL' && orderYear !== dateRange.year) {
          return false;
        }
        if (dateRange.month !== 'ALL' && orderMonth !== dateRange.month) {
          return false;
        }
      }

      // Status Filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'REFUND_PENDING') {
          if (ord.status !== 'REFUND_PENDING' && ord.refundStatus !== 'PENDING_APPROVAL') {
            return false;
          }
        } else if (ord.status !== statusFilter) {
          return false;
        }
      }

      // Payment Filter
      if (paymentFilter !== 'ALL') {
        if (paymentFilter === 'SPLIT' && ord.paymentMethod !== 'SPLIT') {
          return false;
        }
        if (paymentFilter !== 'SPLIT' && ord.paymentMethod !== paymentFilter) {
          return false;
        }
      }

      // Search Query
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchNumber = ord.orderNumber.toLowerCase().includes(q);
        const matchCashier = ord.cashierName.toLowerCase().includes(q);
        const matchTable = ord.tableNumber ? ord.tableNumber.toLowerCase().includes(q) : false;
        const matchItems = ord.items.some((i) => i.name.toLowerCase().includes(q));

        return matchNumber || matchCashier || matchTable || matchItems;
      }

      return true;
    });
  }, [orders, dateRange, statusFilter, paymentFilter, search]);

  // Filter customers based on Date Range and Search
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      // Date Range Filter (by last visit, registration, or orders in period)
      if (dateRange.year !== 'ALL' || dateRange.month !== 'ALL') {
        const visitDate = new Date(c.lastVisit || c.createdAt);
        const visitYear = String(visitDate.getFullYear());
        const visitMonth = String(visitDate.getMonth() + 1);

        if (dateRange.year !== 'ALL' && visitYear !== dateRange.year) {
          const custOrders = customerService.getCustomerOrders(c);
          const hasOrderInYear = custOrders.some(
            (o) => String(new Date(o.createdAt).getFullYear()) === dateRange.year
          );
          if (!hasOrderInYear) return false;
        }

        if (dateRange.month !== 'ALL') {
          const custOrders = customerService.getCustomerOrders(c);
          const hasOrderInMonth = custOrders.some((o) => {
            const d = new Date(o.createdAt);
            const yr = String(d.getFullYear());
            const mo = String(d.getMonth() + 1);
            return (dateRange.year === 'ALL' || yr === dateRange.year) && mo === dateRange.month;
          });
          if (!hasOrderInMonth && visitMonth !== dateRange.month) return false;
        }
      }

      if (search.trim()) {
        const q = search.toLowerCase().trim();
        return (
          c.name.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          c.customerId.toLowerCase().includes(q) ||
          (c.notes && c.notes.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [customers, dateRange, search]);

  const handleApproveRefund = async (order: Order) => {
    const reason = await promptDialog({
      title: `Approve Refund for Order ${order.orderNumber}?`,
      message: `Confirm approving refund of ${formatLKR(
        order.refundedAmountCents || order.refundRequest?.amountCents || order.totalCents
      )} requested by ${order.refundRequest?.requestedByUserName || 'Cashier'}?\n\nReason: "${
        order.refundReason || order.refundRequest?.reason || 'Customer returned item'
      }"\n\nThis will record the cash refund in the drawer and return items to stock.`,
      defaultValue: order.refundReason || order.refundRequest?.reason || 'Approved by Admin',
      placeholder: 'Enter approval notes (optional)...',
      confirmText: 'Confirm & Approve Refund',
      variant: 'danger',
    });
    if (reason === null) return;

    try {
      const updated = await orderService.approveRefund({
        orderId: order.id,
        adminId: 'usr_admin',
        adminName: 'Admin Chaminda',
        notes: reason.trim(),
      });
      toast.success(`Refund for Order ${order.orderNumber} approved and recorded.`);
      setSelectedOrder(updated);
    } catch (err: any) {
      toast.error(err.message || 'Refund approval failed');
    }
  };

  const handleRejectRefund = async (order: Order) => {
    const reason = await promptDialog({
      title: `Reject Refund Request for Order ${order.orderNumber}`,
      message: 'Enter reason for rejecting this refund request:',
      defaultValue: 'Refund criteria not met',
      placeholder: 'e.g. Receipt missing, items already consumed...',
      confirmText: 'Reject Request',
      variant: 'danger',
    });
    if (reason === null) return;

    try {
      const updated = await orderService.rejectRefund({
        orderId: order.id,
        adminId: 'usr_admin',
        adminName: 'Admin Chaminda',
        rejectionReason: reason.trim(),
      });
      toast.success(`Refund request for Order ${order.orderNumber} rejected.`);
      setSelectedOrder(updated);
    } catch (err: any) {
      toast.error(err.message || 'Refund rejection failed');
    }
  };

  const handleDirectRefund = async (order: Order) => {
    const reason = await promptDialog({
      title: `Direct Refund for Order ${order.orderNumber}`,
      message: 'Enter reason for processing direct admin refund:',
      defaultValue: 'Customer requested cancellation',
      placeholder: 'e.g. Customer requested cancellation...',
      confirmText: 'Process Refund',
      variant: 'danger',
    });
    if (!reason || !reason.trim()) return;

    try {
      const updated = await orderService.refundOrder({
        orderId: order.id,
        reason: reason.trim(),
        userId: 'usr_admin',
        userName: 'Admin Chaminda',
      });
      toast.success(`Order ${order.orderNumber} refunded successfully.`);
      setSelectedOrder(updated);
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

  // If a customer is selected, render the dedicated Customer Details Page View
  if (selectedCustomer) {
    return (
      <div className="h-full flex-1 flex flex-col min-h-0 space-y-3 w-full animate-in fade-in">
        <CustomerDetailView
          customer={selectedCustomer}
          onBack={() => setSelectedCustomer(null)}
          onCustomerUpdated={(updated) => {
            setCustomers(customerService.getCustomers());
            setSelectedCustomer(updated);
          }}
          onViewReceipt={(ord) => setViewingReceipt(ord)}
        />

        {/* Thermal Receipt Preview Modal */}
        {viewingReceipt && (
          <ThermalReceiptModal
            isOpen={!!viewingReceipt}
            order={viewingReceipt}
            onClose={() => setViewingReceipt(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex-1 flex flex-col min-h-0 space-y-3 w-full animate-in fade-in">
      {/* Top Filter Toolbar (Toggle on Left, Filters on Right) */}
      <div className="flex items-center justify-between gap-3 shrink-0 w-full relative z-30 flex-wrap sm:flex-nowrap">
        {/* Left: View Mode Toggle (Orders vs Customers) */}
        <div className="flex items-center bg-[#FAF7F2] p-1 rounded-full border border-[#E0D7CC] shadow-xs shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('orders')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer ${
              viewMode === 'orders'
                ? 'bg-brand-brown-dark text-white shadow-xs'
                : 'text-text-muted hover:text-brand-brown-dark'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            Orders
            <span
              className={`px-1.5 py-0.2 text-[10px] rounded-full font-bold ${
                viewMode === 'orders'
                  ? 'bg-white/20 text-white'
                  : 'bg-[#EAE3DA] text-brand-brown'
              }`}
            >
              {orders.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('customers')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer ${
              viewMode === 'customers'
                ? 'bg-brand-brown-dark text-white shadow-xs'
                : 'text-text-muted hover:text-brand-brown-dark'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Customers
            <span
              className={`px-1.5 py-0.2 text-[10px] rounded-full font-bold ${
                viewMode === 'customers'
                  ? 'bg-white/20 text-white'
                  : 'bg-[#EAE3DA] text-brand-brown'
              }`}
            >
              {customers.length}
            </span>
          </button>
        </div>

        {/* Right: Dynamic Filters */}
        <div className="flex items-center justify-end gap-2 shrink-0">
          {viewMode === 'orders' && (
            <>
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
            </>
          )}

          <div className="shrink-0 relative z-30">
            <MonthYearPicker
              value={dateRange}
              onChange={(newVal) => setDateRange(newVal)}
            />
          </div>
        </div>
      </div>

      {/* 2. Main Table Area (Orders or Customers) */}
      <div className="flex-1 min-h-0 bg-white rounded-2xl border border-[#E9E0D5] shadow-sm overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto min-h-0">
          {viewMode === 'customers' ? (
            /* CUSTOMERS TABLE */
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-[#FAF7F2] z-10 shadow-xs">
                <tr className="border-b border-[#EAE3DA] text-text-muted font-extrabold uppercase text-[10px]">
                  <th className="py-3 px-4 bg-[#FAF7F2]">Customer ID</th>
                  <th className="py-3 px-4 bg-[#FAF7F2]">Customer Name</th>
                  <th className="py-3 px-4 bg-[#FAF7F2]">Phone Number</th>
                  <th className="py-3 px-4 text-right bg-[#FAF7F2]">Total Spent</th>
                  <th className="py-3 px-4 text-right bg-[#FAF7F2]">Points</th>
                  <th className="py-3 px-4 text-right bg-[#FAF7F2]">Point Value</th>
                  <th className="py-3 px-4 text-right bg-[#FAF7F2]">Point Expire Days</th>
                  <th className="py-3 px-4 bg-[#FAF7F2]">Last Visit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2ECE4] font-medium">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-16 text-text-muted">
                      <Users className="w-8 h-8 mx-auto mb-2 text-text-muted/50" />
                      <div>No customers found matching the selected period or search filter.</div>
                      <button
                        onClick={handleResetFilters}
                        className="mt-3 px-3 py-1 text-xs font-bold text-brand-teal hover:underline"
                      >
                        Reset filters
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((cust) => {
                    const settings = db.getSnapshot().settings;
                    const redemptionValueCents = settings.loyaltyPointRedemptionValueCents ?? 100;
                    const pointValueCents = cust.points * redemptionValueCents;
                    const expiryDaysSetting = settings.loyaltyPointsExpiryDays ?? 365;

                    let expiryDaysDisplay = 'Never';
                    if (cust.points > 0 && expiryDaysSetting > 0) {
                      const lastActivity = new Date(cust.lastVisit || cust.createdAt || Date.now()).getTime();
                      const expiryTimestamp = lastActivity + expiryDaysSetting * 24 * 60 * 60 * 1000;
                      const diffMs = expiryTimestamp - Date.now();
                      const daysLeft = Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
                      expiryDaysDisplay = `${daysLeft} Days`;
                    } else if (cust.points === 0) {
                      expiryDaysDisplay = '0 Days';
                    }

                    return (
                      <tr
                        key={cust.id}
                        onClick={() => setSelectedCustomer(cust)}
                        className="hover:bg-[#FAF7F2]/80 transition-colors cursor-pointer"
                      >
                        <td className="py-3 px-4 font-black text-brand-brown-dark">{cust.customerId}</td>
                        <td className="py-3 px-4 text-text-primary whitespace-nowrap">{cust.name}</td>
                        <td className="py-3 px-4 text-text-secondary whitespace-nowrap">{cust.phone}</td>
                        <td className="py-3 px-4 text-right font-black text-brand-brown-deep tabular-nums whitespace-nowrap">
                          {formatLKR(cust.totalSpentCents)}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-brand-teal tabular-nums whitespace-nowrap">
                          {cust.points.toLocaleString()} Points
                        </td>
                        <td className="py-3 px-4 text-right font-black text-brand-brown-deep tabular-nums whitespace-nowrap">
                          {formatLKR(pointValueCents)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-amber-800 tabular-nums whitespace-nowrap">
                          {expiryDaysDisplay}
                        </td>
                        <td className="py-3 px-4 text-text-secondary whitespace-nowrap">{formatDateTime(cust.lastVisit)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            /* ORDERS TABLE */
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
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2ECE4] font-medium">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-16 text-text-muted">
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
                    const isRefunded = ord.status === 'REFUNDED' || ord.status === 'PARTIALLY_REFUNDED' || ord.refundStatus === 'APPROVED';
                    const isRefundPending = ord.status === 'REFUND_PENDING' || ord.refundStatus === 'PENDING_APPROVAL';

                    return (
                      <tr
                        key={ord.id}
                        onClick={() => setSelectedOrder(ord)}
                        className={`hover:bg-[#FAF7F2]/80 transition-colors cursor-pointer ${
                          isRefundPending ? 'bg-amber-50/40' : ''
                        }`}
                      >
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
                          {isRefundPending ? (
                            <span className="px-2.5 py-0.5 rounded-full font-extrabold text-[10px] uppercase bg-amber-500 text-white shadow-xs animate-pulse inline-flex items-center gap-1 justify-center">
                              <Clock className="w-2.5 h-2.5" />
                              PENDING REFUND
                            </span>
                          ) : isRefunded ? (
                            <span className="px-2.5 py-0.5 rounded-full font-extrabold text-[10px] uppercase bg-status-danger-bg text-status-danger">
                              REFUNDED
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full font-extrabold text-[10px] uppercase bg-status-success-bg text-status-success">
                              {ord.status}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 3. Floating Bottom Pop-Up Search Bar */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center pointer-events-none select-none">
        <div className="bg-[#1E1917]/95 text-white backdrop-blur-xl border border-white/10 shadow-2xl rounded-full h-[52px] px-4 flex items-center gap-2 transition-all duration-300 pointer-events-auto">
          <Search className="w-4 h-4 text-white/50 shrink-0 pointer-events-none" />
          <input
            type="text"
            placeholder={
              viewMode === 'orders'
                ? 'Search orders by #, cashier, table, items...'
                : 'Search customers by name, phone, ID...'
            }
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
              className="p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 4. Order Details Modal */}
      {selectedOrder &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-brand-brown-deep/60 backdrop-blur-sm animate-in fade-in"
            onClick={() => setSelectedOrder(null)}
          >
            <div
              className="bg-white rounded-3xl w-full max-w-lg overflow-hidden border border-[#EAE3DA] shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-5 sm:px-6 py-4 bg-white border-b border-[#EAE3DA] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-brand-teal-light text-brand-teal-dark flex items-center justify-center shadow-2xs font-extrabold text-xs">
                    <ShoppingBag className="w-4 h-4 text-brand-teal" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-base text-brand-brown-dark">
                        Order Details {selectedOrder.orderNumber}
                      </h3>
                      {selectedOrder.status === 'REFUND_PENDING' || selectedOrder.refundStatus === 'PENDING_APPROVAL' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500 text-white shadow-xs animate-pulse">
                          Refund Pending
                        </span>
                      ) : selectedOrder.status === 'REFUNDED' || selectedOrder.refundStatus === 'APPROVED' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-status-danger-bg text-status-danger">
                          Refunded
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-status-success-bg text-status-success">
                          {selectedOrder.status}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="p-1.5 rounded-full text-text-muted hover:bg-cream-100 hover:text-brand-brown-dark transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
                {/* Pending Refund Alert Card for Admin Approval */}
                {(selectedOrder.status === 'REFUND_PENDING' || selectedOrder.refundStatus === 'PENDING_APPROVAL') && (
                  <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-300 text-xs space-y-2 text-amber-950 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-xs uppercase text-amber-900">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Refund Request (Awaiting Admin Confirmation)</span>
                      </div>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500 text-white">
                        Action Required
                      </span>
                    </div>

                    <div className="space-y-1 text-xs text-amber-900 pt-1 border-t border-amber-200/80">
                      <div className="flex justify-between">
                        <span>Requested By:</span>
                        <strong className="text-brand-brown-dark">{selectedOrder.refundRequest?.requestedByUserName || selectedOrder.cashierName || 'Cashier'}</strong>
                      </div>
                      {selectedOrder.refundRequest?.requestedAt && (
                        <div className="flex justify-between text-[11px] text-text-secondary">
                          <span>Requested At:</span>
                          <span>{formatDateTime(selectedOrder.refundRequest.requestedAt)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Reason:</span>
                        <strong className="text-amber-900">{selectedOrder.refundReason || selectedOrder.refundRequest?.reason || 'Customer returned item'}</strong>
                      </div>
                      <div className="flex justify-between pt-1 font-bold">
                        <span>Refund Amount:</span>
                        <strong className="text-rose-700 font-black text-sm">
                          {formatLKR(selectedOrder.refundedAmountCents || selectedOrder.refundRequest?.amountCents || selectedOrder.totalCents)}
                        </strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* Minimal Order Meta Header Row */}
                <div className="flex items-center justify-between pb-3 border-b border-zinc-200 text-xs text-text-secondary">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-brand-brown-dark text-xs">
                      {selectedOrder.orderType === 'DINE_IN'
                        ? `Table #${selectedOrder.tableNumber || '01'}`
                        : 'Takeaway'}
                    </span>
                    <span className="text-zinc-300">|</span>
                    <span className="font-extrabold text-brand-teal uppercase text-[11px]">
                      {selectedOrder.paymentMethod}
                    </span>
                  </div>
                  <div className="text-right text-[11px] text-text-muted">
                    <span>{formatDateTime(selectedOrder.createdAt)}</span>
                    <span className="mx-1 text-zinc-300">•</span>
                    <span>Staff: <strong className="text-brand-brown-dark font-bold">{selectedOrder.cashierName}</strong></span>
                  </div>
                </div>

                {/* Ordered Items Section - Clean Rows with Bottom Borders */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-text-secondary pb-1">
                    <span>Items & Customizations</span>
                    <span className="text-[10px] text-text-muted font-bold">
                      {selectedOrder.items?.reduce((s, i) => s + (i.quantity || 1), 0) || 0} Total Units
                    </span>
                  </div>

                  <div className="divide-y divide-zinc-200/80">
                    {selectedOrder.items && selectedOrder.items.length > 0 ? (
                      selectedOrder.items.map((item, idx) => (
                        <div key={idx} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                          <div className="flex-1 space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-brand-brown-dark text-xs">{item.quantity}x</span>
                              <span className="font-bold text-brand-brown-dark text-xs">{item.name}</span>
                            </div>

                            {/* Modifiers List */}
                            {item.modifiers && item.modifiers.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pl-5 pt-0.5">
                                {item.modifiers.map((m, mIdx) => (
                                  <span
                                    key={mIdx}
                                    className="text-[10px] text-text-secondary font-medium"
                                  >
                                    + {m.optionName}{' '}
                                    {m.priceCents > 0 && (
                                      <span className="text-brand-teal font-bold">({formatLKR(m.priceCents)})</span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Notes */}
                            {item.notes && (
                              <div className="text-[10px] text-amber-800 italic pl-5">
                                Note: {item.notes}
                              </div>
                            )}
                          </div>

                          <span className="font-black text-brand-brown-deep tabular-nums text-xs whitespace-nowrap">
                            {formatLKR(item.itemTotalCents)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="py-3 text-center text-text-muted text-xs">No items in order</div>
                    )}
                  </div>
                </div>

                {/* Billing Summary - Clean Rows with Bottom Borders */}
                <div className="pt-2 border-t-2 border-zinc-200 space-y-1.5 text-xs">
                  <div className="flex justify-between text-text-secondary">
                    <span>Subtotal:</span>
                    <span className="tabular-nums font-semibold">{formatLKR(selectedOrder.subtotalCents)}</span>
                  </div>

                  {selectedOrder.discountCents > 0 && (
                    <div className="flex justify-between text-emerald-700 font-semibold">
                      <span>Discount ({selectedOrder.discountReason || 'Promo'}):</span>
                      <span className="tabular-nums">-{formatLKR(selectedOrder.discountCents)}</span>
                    </div>
                  )}

                  {selectedOrder.serviceChargeCents > 0 && (
                    <div className="flex justify-between text-text-secondary">
                      <span>Service Charge:</span>
                      <span className="tabular-nums font-semibold">{formatLKR(selectedOrder.serviceChargeCents)}</span>
                    </div>
                  )}

                  {selectedOrder.taxCents > 0 && (
                    <div className="flex justify-between text-text-secondary">
                      <span>Tax:</span>
                      <span className="tabular-nums font-semibold">{formatLKR(selectedOrder.taxCents)}</span>
                    </div>
                  )}

                  <div className="pt-2.5 border-t border-zinc-200 flex justify-between items-baseline font-black text-brand-brown-dark">
                    <span className="text-xs uppercase tracking-wider">Total Paid:</span>
                    <span className="text-lg text-brand-teal font-black tabular-nums">
                      {formatLKR(selectedOrder.totalCents)}
                    </span>
                  </div>
                </div>

                {/* Refund Record Notice (if refunded) */}
                {(selectedOrder.status === 'REFUNDED' || selectedOrder.refundStatus === 'APPROVED') && (
                  <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200 text-xs space-y-1 text-rose-800">
                    <div className="flex items-center gap-1.5 font-extrabold text-[10px] uppercase text-rose-700">
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Order Refunded</span>
                    </div>
                    <p className="text-xs font-medium">
                      Reason: <strong>{selectedOrder.refundReason || selectedOrder.refundRequest?.reason || 'Customer requested refund'}</strong>
                    </p>
                    {selectedOrder.refundApproval?.approvedByUserName && (
                      <p className="text-[11px] text-rose-900">
                        Approved by: <strong>{selectedOrder.refundApproval.approvedByUserName}</strong>
                        {selectedOrder.refundApproval.approvedAt && (
                          <span className="text-rose-700 ml-1">({formatDateTime(selectedOrder.refundApproval.approvedAt)})</span>
                        )}
                      </p>
                    )}
                    {selectedOrder.refundedAmountCents ? (
                      <p className="text-[11px] text-rose-700 font-black pt-0.5">
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
                  {selectedOrder.status === 'REFUND_PENDING' || selectedOrder.refundStatus === 'PENDING_APPROVAL' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleApproveRefund(selectedOrder)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black shadow-md transition-all active:scale-95 cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        <span>Confirm & Approve Refund</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRejectRefund(selectedOrder)}
                        className="flex items-center gap-1 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-2xl text-xs font-bold transition-all cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </>
                  ) : selectedOrder.status !== 'REFUNDED' && selectedOrder.refundStatus !== 'APPROVED' ? (
                    <button
                      type="button"
                      onClick={() => handleDirectRefund(selectedOrder)}
                      className="flex items-center gap-1 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-2xl text-xs font-bold transition-all cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Direct Refund</span>
                    </button>
                  ) : null}

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

