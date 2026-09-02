import React, { useState } from 'react';
import { Customer, Order } from '@/types';
import { customerService } from '@/services/customerService';
import { db } from '@/services/storage/db';
import { formatLKR, formatDateTime } from '@/utils/format';
import {
  ArrowLeft,
  Coins,
  Receipt,
  ShoppingBag,
  Calendar,
  Phone,
  Clock,
  ChevronDown,
  ChevronUp,
  Printer,
  X,
  FileText,
  Plus,
  Minus,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

interface CustomerDetailViewProps {
  customer: Customer;
  onBack: () => void;
  onCustomerUpdated: (updated: Customer) => void;
  onViewReceipt: (order: Order) => void;
}

export const CustomerDetailView: React.FC<CustomerDetailViewProps> = ({
  customer: initialCustomer,
  onBack,
  onCustomerUpdated,
  onViewReceipt,
}) => {
  const [customer, setCustomer] = useState<Customer>(initialCustomer);
  const [activeTab, setActiveTab] = useState<'orders' | 'ledger' | 'notes'>('orders');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Adjust Points Modal State
  const [showAdjustPoints, setShowAdjustPoints] = useState(false);
  const [adjustType, setAdjustType] = useState<'ADD' | 'DEDUCT'>('ADD');
  const [adjustAmount, setAdjustAmount] = useState('50');
  const [adjustReason, setAdjustReason] = useState('');

  const orders = customerService.getCustomerOrders(customer);
  const pointHistory = customer.pointHistory || [];
  const settings = db.getSnapshot().settings;
  const redemptionValueCents = settings.loyaltyPointRedemptionValueCents ?? 100;
  const pointValueCents = customer.points * redemptionValueCents;
  const expiryDaysSetting = settings.loyaltyPointsExpiryDays ?? 365;

  let expiryDaysDisplay = 'Never';
  if (customer.points > 0 && expiryDaysSetting > 0) {
    const lastActivity = new Date(customer.lastVisit || customer.createdAt || Date.now()).getTime();
    const expiryTimestamp = lastActivity + expiryDaysSetting * 24 * 60 * 60 * 1000;
    const diffMs = expiryTimestamp - Date.now();
    const daysLeft = Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
    expiryDaysDisplay = `${daysLeft} Days`;
  } else if (customer.points === 0) {
    expiryDaysDisplay = '0 Days';
  }

  const handleApplyAdjustment = () => {
    const pts = parseInt(adjustAmount, 10);
    if (isNaN(pts) || pts <= 0) {
      toast.error('Please enter a valid points amount');
      return;
    }

    let updated: Customer | null = null;
    if (adjustType === 'ADD') {
      const res = customerService.addPoints(
        customer.id,
        pts,
        adjustReason.trim() || 'Manual points adjustment'
      );
      updated = res || null;
      toast.success(`Added ${pts} points to ${customer.name}`);
    } else {
      if (customer.points < pts) {
        toast.error(`Customer only has ${customer.points} points`);
        return;
      }
      const res = customerService.redeemPoints(
        customer.id,
        pts,
        adjustReason.trim() || 'Manual points deduction'
      );
      updated = res || null;
      toast.success(`Deducted ${pts} points from ${customer.name}`);
    }

    if (updated) {
      setCustomer(updated);
      onCustomerUpdated(updated);
    }
    setShowAdjustPoints(false);
    setAdjustAmount('50');
    setAdjustReason('');
  };

  return (
    <div className="h-full flex-1 flex flex-col min-h-0 space-y-3 w-full animate-in fade-in duration-200">
      {/* 1. Header Toolbar */}
      <div className="flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#FAF7F2] hover:bg-brand-brown-dark hover:text-white border border-[#E0D7CC] text-xs font-black text-brand-brown-dark transition-all cursor-pointer shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Customers
          </button>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-black text-brand-brown-dark">
              {customer.name}
            </h2>
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-[#FAF7F2] border border-[#E0D7CC] text-brand-teal">
              {customer.customerId}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAdjustPoints(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-brand-teal hover:bg-brand-teal-dark text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
        >
          <Coins className="w-3.5 h-3.5" />
          Adjust Points
        </button>
      </div>

      {/* 2. Clean Summary Details Bar (No colored boxes) */}
      <div className="bg-white rounded-2xl border border-[#E9E0D5] p-4 shadow-xs shrink-0">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-[#F2ECE4]">
          {/* Phone */}
          <div className="px-2 first:pl-0">
            <div className="text-[10px] font-extrabold text-text-muted uppercase tracking-wider">
              Phone Number
            </div>
            <div className="text-xs font-bold text-brand-brown-dark mt-1 flex items-center gap-1.5">
              <Phone className="w-3 h-3 text-brand-teal" />
              {customer.phone}
            </div>
          </div>

          {/* Member Since */}
          <div className="px-2 pt-2 sm:pt-0">
            <div className="text-[10px] font-extrabold text-text-muted uppercase tracking-wider">
              Member Since
            </div>
            <div className="text-xs font-bold text-brand-brown-dark mt-1 flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-brand-teal" />
              {new Date(customer.createdAt).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </div>
          </div>

          {/* Last Visit */}
          <div className="px-2 pt-2 sm:pt-0">
            <div className="text-[10px] font-extrabold text-text-muted uppercase tracking-wider">
              Last Visit
            </div>
            <div className="text-xs font-bold text-brand-brown-dark mt-1 flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-brand-teal" />
              {formatDateTime(customer.lastVisit)}
            </div>
          </div>

          {/* Total Spent */}
          <div className="px-2 pt-2 sm:pt-0">
            <div className="text-[10px] font-extrabold text-text-muted uppercase tracking-wider">
              Total Spent
            </div>
            <div className="text-xs font-black text-brand-brown-deep tabular-nums mt-1">
              {formatLKR(customer.totalSpentCents)}
            </div>
            <div className="text-[10px] text-text-muted">
              {customer.totalOrders} {customer.totalOrders === 1 ? 'order' : 'orders'}
            </div>
          </div>

          {/* Loyalty Points */}
          <div className="px-2 pt-2 sm:pt-0">
            <div className="text-[10px] font-extrabold text-text-muted uppercase tracking-wider">
              Loyalty Points
            </div>
            <div className="text-xs font-black text-brand-teal tabular-nums mt-1">
              {customer.points.toLocaleString()} Points
            </div>
            <div className="text-[10px] text-text-muted">
              Value: {formatLKR(pointValueCents)} &bull; Expires: {expiryDaysDisplay}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Tab Selectors */}
      <div className="flex items-center gap-2 border-b border-[#E9E0D5] pb-2 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer ${
            activeTab === 'orders'
              ? 'bg-brand-brown-dark text-white shadow-xs'
              : 'text-text-muted hover:text-brand-brown-dark bg-[#FAF7F2]'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          Order History
          <span
            className={`px-1.5 py-0.2 text-[10px] rounded-full font-bold ${
              activeTab === 'orders' ? 'bg-white/20 text-white' : 'bg-[#EAE3DA] text-brand-brown'
            }`}
          >
            {orders.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ledger')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer ${
            activeTab === 'ledger'
              ? 'bg-brand-brown-dark text-white shadow-xs'
              : 'text-text-muted hover:text-brand-brown-dark bg-[#FAF7F2]'
          }`}
        >
          <Coins className="w-3.5 h-3.5" />
          Points Ledger & Activity
          <span
            className={`px-1.5 py-0.2 text-[10px] rounded-full font-bold ${
              activeTab === 'ledger' ? 'bg-white/20 text-white' : 'bg-[#EAE3DA] text-brand-brown'
            }`}
          >
            {pointHistory.length}
          </span>
        </button>
      </div>

      {/* 4. Tab Contents Container */}
      <div className="flex-1 min-h-0 bg-white rounded-2xl border border-[#E9E0D5] shadow-sm overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto min-h-0">
          {/* TAB 1: ORDER HISTORY */}
          {activeTab === 'orders' && (
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
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-16 text-text-muted">
                      <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-text-muted/50" />
                      <div>No orders recorded for this customer yet.</div>
                    </td>
                  </tr>
                ) : (
                  orders.map((ord) => {
                    const isRefunded =
                      ord.status === 'REFUNDED' || ord.status === 'PARTIALLY_REFUNDED';

                    return (
                      <tr
                        key={ord.id}
                        onClick={() => onViewReceipt(ord)}
                        className="hover:bg-[#FAF7F2]/80 transition-colors cursor-pointer group"
                      >
                        {/* Order # */}
                        <td className="py-3 px-4 font-black text-brand-brown-dark group-hover:text-brand-teal transition-colors">
                          {ord.orderNumber}
                        </td>

                        {/* Date/Time */}
                        <td className="py-3 px-4 text-text-secondary whitespace-nowrap">
                          {formatDateTime(ord.createdAt)}
                        </td>

                        {/* Type */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="px-2.5 py-0.5 rounded-full bg-[#FAF7F2] border border-[#E0D7CC] text-[10px] font-bold text-brand-brown">
                            {ord.orderType === 'DINE_IN'
                              ? `Table ${ord.tableNumber || '01'}`
                              : 'Takeaway'}
                          </span>
                        </td>

                        {/* Cashier */}
                        <td className="py-3 px-4 text-text-primary whitespace-nowrap">
                          {ord.cashierName}
                        </td>

                        {/* Items Summary */}
                        <td className="py-3 px-4 text-text-secondary truncate max-w-[220px]">
                          {ord.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                        </td>

                        {/* Payment Method */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md font-extrabold text-[10px] uppercase bg-brand-teal/10 text-brand-teal">
                            {ord.paymentMethod}
                          </span>
                        </td>

                        {/* Total */}
                        <td className="py-3 px-4 text-right font-black text-brand-brown-deep tabular-nums whitespace-nowrap">
                          {formatLKR(ord.totalCents)}
                        </td>

                        {/* Status */}
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
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {/* TAB 2: POINTS LEDGER */}
          {activeTab === 'ledger' && (
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-[#FAF7F2] z-10 shadow-xs">
                <tr className="border-b border-[#EAE3DA] text-text-muted font-extrabold uppercase text-[10px]">
                  <th className="py-3 px-4 bg-[#FAF7F2]">Date / Time</th>
                  <th className="py-3 px-4 bg-[#FAF7F2]">Activity & Reason</th>
                  <th className="py-3 px-4 bg-[#FAF7F2]">Order #</th>
                  <th className="py-3 px-4 bg-[#FAF7F2]">Type</th>
                  <th className="py-3 px-4 text-right bg-[#FAF7F2]">Points Change</th>
                  <th className="py-3 px-4 text-right bg-[#FAF7F2]">Balance After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2ECE4] font-medium">
                {pointHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-16 text-text-muted">
                      <Coins className="w-8 h-8 mx-auto mb-2 text-text-muted/50" />
                      <div>No point transactions recorded yet.</div>
                    </td>
                  </tr>
                ) : (
                  pointHistory.map((entry) => {
                    const isPositive = entry.points > 0;
                    return (
                      <tr key={entry.id} className="hover:bg-[#FAF7F2]/80 transition-colors">
                        <td className="py-3 px-4 text-text-secondary whitespace-nowrap">
                          {formatDateTime(entry.createdAt)}
                        </td>
                        <td className="py-3 px-4 font-bold text-brand-brown-dark">
                          {entry.note || (isPositive ? 'Points Earned' : 'Points Redeemed')}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {entry.orderNumber ? (
                            <span className="font-mono text-[11px] font-bold text-brand-teal">
                              {entry.orderNumber}
                            </span>
                          ) : (
                            <span className="text-text-muted">&mdash;</span>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-[#FAF7F2] border border-[#E0D7CC] text-brand-brown">
                            {entry.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-black tabular-nums whitespace-nowrap">
                          <span
                            className={isPositive ? 'text-emerald-600' : 'text-rose-600'}
                          >
                            {isPositive ? `+${entry.points}` : entry.points} pts
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-black text-brand-brown-deep tabular-nums whitespace-nowrap">
                          {entry.balanceAfter.toLocaleString()} pts
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

      {/* Adjust Points Sub-Modal */}
      {showAdjustPoints && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl border border-[#E0D7CC] p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-[#F2ECE4]">
              <h3 className="text-sm font-black text-brand-brown-dark flex items-center gap-2">
                <Coins className="w-4 h-4 text-brand-teal" />
                Adjust Loyalty Points
              </h3>
              <button
                onClick={() => setShowAdjustPoints(false)}
                className="p-1 text-text-muted hover:text-brand-brown-dark cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-text-secondary">
              Adjusting points for <strong className="text-brand-brown-dark">{customer.name}</strong>. Current Balance:{' '}
              <strong className="text-brand-teal font-black">{customer.points} points</strong>.
            </div>

            {/* Adjustment Type Tabs */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-[#FAF7F2] rounded-xl border border-[#E0D7CC]">
              <button
                type="button"
                onClick={() => setAdjustType('ADD')}
                className={`py-1.5 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  adjustType === 'ADD'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-text-muted hover:text-brand-brown-dark'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                Add Bonus Points
              </button>
              <button
                type="button"
                onClick={() => setAdjustType('DEDUCT')}
                className={`py-1.5 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  adjustType === 'DEDUCT'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-text-muted hover:text-brand-brown-dark'
                }`}
              >
                <Minus className="w-3.5 h-3.5" />
                Deduct Points
              </button>
            </div>

            {/* Points Amount */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-extrabold text-brand-brown-dark uppercase">
                Points Amount
              </label>
              <input
                type="number"
                min="1"
                step="10"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-[#FAF7F2] border border-[#E0D7CC] text-xs font-bold text-brand-brown-dark focus:outline-none focus:border-brand-teal"
              />
            </div>

            {/* Adjustment Reason */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-extrabold text-brand-brown-dark uppercase">
                Reason / Note
              </label>
              <input
                type="text"
                placeholder="e.g. VIP appreciation bonus, Goodwill gesture..."
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-[#FAF7F2] border border-[#E0D7CC] text-xs font-medium text-brand-brown-dark focus:outline-none focus:border-brand-teal"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAdjustPoints(false)}
                className="px-4 py-2 rounded-xl bg-[#FAF7F2] hover:bg-[#F2ECE4] text-brand-brown text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyAdjustment}
                className="px-4 py-2 rounded-xl bg-brand-teal hover:bg-brand-teal-dark text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Apply Adjustment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
