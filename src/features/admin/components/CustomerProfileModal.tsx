import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Customer, Order } from '@/types';
import { customerService } from '@/services/customerService';
import { formatLKR, formatDateTime } from '@/utils/format';
import { ThermalReceiptModal } from '@/components/brand/ThermalReceiptModal';
import {
  X,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Award,
  Coins,
  ShoppingBag,
  TrendingUp,
  Receipt,
  Plus,
  Minus,
  Sparkles,
  Gift,
  Clock,
  ChevronRight,
  Edit2,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';

interface CustomerProfileModalProps {
  customer: Customer;
  onClose: () => void;
  onCustomerUpdated?: (updated: Customer) => void;
  onSelectOrder?: (order: Order) => void;
}

export const CustomerProfileModal: React.FC<CustomerProfileModalProps> = ({
  customer: initialCustomer,
  onClose,
  onCustomerUpdated,
  onSelectOrder,
}) => {
  const [customer, setCustomer] = useState<Customer>(initialCustomer);
  const [activeTab, setActiveTab] = useState<'orders' | 'points' | 'details'>('orders');
  const [viewingReceiptOrder, setViewingReceiptOrder] = useState<Order | null>(null);

  // Quick adjust points modal state
  const [showAdjustPoints, setShowAdjustPoints] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState<string>('50');
  const [adjustType, setAdjustType] = useState<'ADD' | 'DEDUCT'>('ADD');
  const [adjustReason, setAdjustReason] = useState<string>('Customer goodwill bonus reward');

  const customerOrders = customerService.getCustomerOrders(customer);

  const tierColors: Record<Customer['tier'], { bg: string; text: string; border: string }> = {
    PLATINUM: { bg: 'bg-purple-50 text-purple-700', border: 'border-purple-200', text: 'text-purple-700' },
    GOLD: { bg: 'bg-amber-50 text-amber-700', border: 'border-amber-200', text: 'text-amber-700' },
    SILVER: { bg: 'bg-slate-100 text-slate-700', border: 'border-slate-300', text: 'text-slate-700' },
    BRONZE: { bg: 'bg-orange-50 text-orange-700', border: 'border-orange-200', text: 'text-orange-700' },
  };

  const currentTier = tierColors[customer.tier] || tierColors.BRONZE;

  const handleAdjustPointsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pts = parseInt(adjustAmount) || 0;
    if (pts <= 0) {
      toast.error('Please enter a valid points amount');
      return;
    }

    let updated: Customer | undefined;
    if (adjustType === 'ADD') {
      updated = customerService.addPoints(
        customer.id,
        pts,
        adjustReason.trim() || 'Manual points adjustment'
      );
      toast.success(`Successfully added ${pts} points to ${customer.name}`);
    } else {
      if (customer.points < pts) {
        toast.error(`Customer only has ${customer.points} points`);
        return;
      }
      updated = customerService.redeemPoints(
        customer.id,
        pts,
        adjustReason.trim() || 'Manual points deduction'
      );
      toast.success(`Successfully deducted ${pts} points from ${customer.name}`);
    }

    if (updated) {
      setCustomer(updated);
      if (onCustomerUpdated) onCustomerUpdated(updated);
    }
    setShowAdjustPoints(false);
    setAdjustAmount('50');
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#FAF7F2] rounded-3xl border border-[#E9E0D5] shadow-2xl w-full max-w-4xl h-[90vh] max-h-[820px] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* 1. Header Banner with Profile Details */}
        <div className="bg-white px-6 py-5 border-b border-[#E9E0D5] flex-shrink-0 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg font-black text-brand-brown-dark truncate">
                  {customer.name}
                </h2>
                <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#FAF7F2] border border-[#E0D7CC] text-brand-teal">
                  {customer.customerId}
                </span>
              </div>

              <div className="flex items-center gap-4 mt-1.5 text-xs text-text-secondary flex-wrap">
                <span className="flex items-center gap-1 font-bold text-brand-brown-dark">
                  <Phone className="w-3.5 h-3.5 text-brand-teal" />
                  {customer.phone}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-text-muted" />
                  Member since {new Date(customer.createdAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowAdjustPoints(true)}
              className="px-3.5 py-1.5 bg-brand-teal hover:bg-brand-teal-dark text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Coins className="w-3.5 h-3.5" />
              Adjust Points
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-text-muted hover:text-brand-brown-dark hover:bg-[#FAF7F2] rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. Top Metric KPI Summary Cards (4 Cards) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-3.5 bg-white border-b border-[#E9E0D5] flex-shrink-0">
          {/* Card 1: Points Balance */}
          <div className="p-3 bg-[#FAF7F2] rounded-2xl border border-[#E0D7CC]/80">
            <div className="flex items-center justify-between text-text-secondary text-[11px] font-bold">
              <span>Points Balance</span>
              <Award className="w-3.5 h-3.5 text-brand-teal" />
            </div>
            <div className="text-xl font-black text-brand-teal mt-0.5 tabular-nums">
              {customer.points.toLocaleString()} <span className="text-xs font-bold">pts</span>
            </div>
            <div className="text-[10px] text-text-muted mt-0.5">
              ≈ {formatLKR(customer.points * 100)} discount
            </div>
          </div>

          {/* Card 2: Total Spent */}
          <div className="p-3 bg-[#FAF7F2] rounded-2xl border border-[#E0D7CC]/80">
            <div className="flex items-center justify-between text-text-secondary text-[11px] font-bold">
              <span>Total Spent</span>
              <TrendingUp className="w-3.5 h-3.5 text-brand-brown" />
            </div>
            <div className="text-base sm:text-lg font-black text-brand-brown-dark mt-0.5 tabular-nums">
              {formatLKR(customer.totalSpentCents)}
            </div>
            <div className="text-[10px] text-text-muted mt-0.5">
              Lifetime café sales
            </div>
          </div>

          {/* Card 3: Total Orders */}
          <div className="p-3 bg-[#FAF7F2] rounded-2xl border border-[#E0D7CC]/80">
            <div className="flex items-center justify-between text-text-secondary text-[11px] font-bold">
              <span>Orders Placed</span>
              <ShoppingBag className="w-3.5 h-3.5 text-brand-brown" />
            </div>
            <div className="text-xl font-black text-brand-brown-dark mt-0.5 tabular-nums">
              {customer.totalOrders || customerOrders.length}
            </div>
            <div className="text-[10px] text-text-muted mt-0.5">
              Avg: {formatLKR(customer.totalOrders ? Math.round(customer.totalSpentCents / customer.totalOrders) : 0)}
            </div>
          </div>

          {/* Card 4: Last Visit */}
          <div className="p-3 bg-[#FAF7F2] rounded-2xl border border-[#E0D7CC]/80">
            <div className="flex items-center justify-between text-text-secondary text-[11px] font-bold">
              <span>Last Visit</span>
              <Clock className="w-3.5 h-3.5 text-brand-brown" />
            </div>
            <div className="text-xs sm:text-[13px] font-black text-brand-brown-dark mt-1 truncate">
              {formatDateTime(customer.lastVisit)}
            </div>
            <div className="text-[10px] text-brand-teal font-bold mt-0.5">
              Verified Order
            </div>
          </div>
        </div>

        {/* 3. Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 pt-3 bg-[#FAF7F2] border-b border-[#E9E0D5] flex-shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`flex items-center gap-2 pb-2.5 px-3 border-b-2 text-xs font-black transition-colors ${
              activeTab === 'orders'
                ? 'border-brand-teal text-brand-teal'
                : 'border-transparent text-text-secondary hover:text-brand-brown-dark'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            Order History ({customerOrders.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('points')}
            className={`flex items-center gap-2 pb-2.5 px-3 border-b-2 text-xs font-black transition-colors ${
              activeTab === 'points'
                ? 'border-brand-teal text-brand-teal'
                : 'border-transparent text-text-secondary hover:text-brand-brown-dark'
            }`}
          >
            <Coins className="w-4 h-4" />
            Points Ledger & Activity ({customer.pointHistory?.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`flex items-center gap-2 pb-2.5 px-3 border-b-2 text-xs font-black transition-colors ${
              activeTab === 'details'
                ? 'border-brand-teal text-brand-teal'
                : 'border-transparent text-text-secondary hover:text-brand-brown-dark'
            }`}
          >
            <User className="w-4 h-4" />
            Profile Details & Preferences
          </button>
        </div>

        {/* 4. Tab Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 scrollbar-thin">
          {/* TAB 1: ORDER HISTORY */}
          {activeTab === 'orders' && (
            <div className="space-y-3">
              {customerOrders.length === 0 ? (
                <div className="text-center py-16 text-text-muted bg-white rounded-2xl border border-[#E9E0D5]">
                  <ShoppingBag className="w-10 h-10 mx-auto mb-2 text-text-muted/40" />
                  <div className="font-bold text-sm text-brand-brown-dark">No orders found for this customer</div>
                  <p className="text-xs text-text-secondary mt-1">Orders with matching name or phone number will automatically display here.</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-[#E9E0D5] overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF7F2] border-b border-[#E9E0D5] text-[10.5px] font-extrabold uppercase text-text-muted">
                      <tr>
                        <th className="py-3 px-4">Order #</th>
                        <th className="py-3 px-4">Date / Time</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Items Summary</th>
                        <th className="py-3 px-4">Payment</th>
                        <th className="py-3 px-4 text-right">Total</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-right">Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F2ECE4]">
                      {customerOrders.map((ord) => (
                        <tr key={ord.id} className="hover:bg-[#FAF7F2]/60 transition-colors">
                          <td className="py-3 px-4 font-black text-brand-brown-dark">{ord.orderNumber}</td>
                          <td className="py-3 px-4 text-text-secondary whitespace-nowrap">{formatDateTime(ord.createdAt)}</td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-full bg-[#FAF7F2] border border-[#E0D7CC] text-[10px] font-bold text-brand-brown">
                              {ord.orderType === 'DINE_IN' ? `Table ${ord.tableNumber || '01'}` : 'Takeaway'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-text-secondary truncate max-w-[200px]">
                            {ord.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-md font-extrabold text-[10px] uppercase bg-brand-teal/10 text-brand-teal">
                              {ord.paymentMethod}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-black text-brand-brown-dark tabular-nums whitespace-nowrap">
                            {formatLKR(ord.totalCents)}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-full font-extrabold text-[10px] uppercase ${
                                ord.status === 'REFUNDED'
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
                                type="button"
                                onClick={() => setViewingReceiptOrder(ord)}
                                className="px-2.5 py-1 bg-[#FAF7F2] hover:bg-brand-teal hover:text-white rounded-lg text-brand-brown font-bold text-[11px] transition-colors border border-[#E0D7CC] flex items-center gap-1"
                              >
                                <Receipt className="w-3 h-3" />
                                Receipt
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: POINTS LEDGER & ACTIVITY */}
          {activeTab === 'points' && (
            <div className="space-y-3">
              <div className="bg-white rounded-2xl border border-[#E9E0D5] p-4 flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-black text-brand-brown-dark uppercase tracking-wider">
                    Loyalty Rewards Points Ledger
                  </h4>
                  <p className="text-[11px] text-text-secondary mt-0.5">
                    Complete history of points earned on orders, bonus promotions, and discounts redeemed
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-brand-teal/10 border border-brand-teal/20 text-brand-teal rounded-xl text-xs font-black">
                    Current Balance: {customer.points} pts
                  </span>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-[#E9E0D5] overflow-hidden shadow-2xs divide-y divide-[#F2ECE4]">
                {(customer.pointHistory || []).length === 0 ? (
                  <div className="text-center py-12 text-text-muted">
                    <Coins className="w-8 h-8 mx-auto mb-2 text-text-muted/40" />
                    <div>No points history recorded yet</div>
                  </div>
                ) : (
                  (customer.pointHistory || []).map((entry) => {
                    const isPositive = entry.points > 0;
                    return (
                      <div
                        key={entry.id}
                        className="p-4 flex items-center justify-between gap-4 hover:bg-[#FAF7F2]/60 transition-colors text-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              isPositive
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                : 'bg-rose-50 text-rose-600 border border-rose-200'
                            }`}
                          >
                            {isPositive ? (
                              <ArrowUpRight className="w-4 h-4" />
                            ) : (
                              <ArrowDownRight className="w-4 h-4" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-brand-brown-dark">
                                {entry.note || (isPositive ? 'Points Earned' : 'Points Redeemed')}
                              </span>
                              {entry.orderNumber && (
                                <span className="font-mono text-[10.5px] font-bold px-2 py-0.2 bg-[#FAF7F2] border border-[#E0D7CC] rounded text-brand-brown">
                                  {entry.orderNumber}
                                </span>
                              )}
                              <span className="text-[10px] font-extrabold uppercase px-2 py-0.2 rounded bg-slate-100 text-slate-700">
                                {entry.type.replace('_', ' ')}
                              </span>
                            </div>
                            <div className="text-[11px] text-text-muted mt-0.5">
                              {formatDateTime(entry.createdAt)}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div
                            className={`text-sm font-black tabular-nums ${
                              isPositive ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {isPositive ? `+${entry.points}` : entry.points} pts
                          </div>
                          <div className="text-[10.5px] text-text-muted mt-0.5">
                            Balance: <strong className="font-bold">{entry.balanceAfter} pts</strong>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 3: CUSTOMER DETAILS & PREFERENCES */}
          {activeTab === 'details' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-[#E9E0D5] p-5 space-y-4">
                <h4 className="text-xs font-black text-brand-brown-dark uppercase tracking-wider pb-2 border-b border-[#F2ECE4]">
                  Contact & Identification
                </h4>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-[11px] font-extrabold text-text-muted uppercase">Full Name</label>
                    <div className="font-black text-brand-brown-dark mt-0.5">{customer.name}</div>
                  </div>

                  <div>
                    <label className="text-[11px] font-extrabold text-text-muted uppercase">Customer ID</label>
                    <div className="font-mono font-bold text-brand-teal mt-0.5">{customer.customerId}</div>
                  </div>

                  <div>
                    <label className="text-[11px] font-extrabold text-text-muted uppercase">Phone Number</label>
                    <div className="font-bold text-brand-brown-dark mt-0.5">{customer.phone}</div>
                  </div>

                  <div>
                    <label className="text-[11px] font-extrabold text-text-muted uppercase">Residential Address</label>
                    <div className="font-medium text-text-secondary mt-0.5">{customer.address || 'Not provided'}</div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-[#E9E0D5] p-5 space-y-4">
                <h4 className="text-xs font-black text-brand-brown-dark uppercase tracking-wider pb-2 border-b border-[#F2ECE4]">
                  Loyalty & Special Notes
                </h4>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-[11px] font-extrabold text-text-muted uppercase">Birthday Celebration</label>
                    <div className="font-bold text-brand-brown-dark mt-0.5 flex items-center gap-1.5">
                      <Gift className="w-4 h-4 text-brand-teal" />
                      {customer.birthday || 'Not set'}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-extrabold text-text-muted uppercase">Café & Dietary Notes</label>
                    <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#E0D7CC] text-text-secondary mt-1 text-xs">
                      {customer.notes || 'No specific preferences or dietary notes entered yet.'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Adjust Points Sub-Modal */}
      {showAdjustPoints && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl border border-[#E0D7CC] p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#F2ECE4]">
              <h3 className="text-sm font-black text-brand-brown-dark flex items-center gap-2">
                <Coins className="w-4 h-4 text-brand-teal" />
                Adjust Loyalty Points: {customer.name}
              </h3>
              <button
                type="button"
                onClick={() => setShowAdjustPoints(false)}
                className="text-text-muted hover:text-brand-brown-dark"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdjustPointsSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="font-extrabold text-brand-brown-dark block mb-1.5">Action</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('ADD')}
                    className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 border transition-all ${
                      adjustType === 'ADD'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-[#FAF7F2] border-[#E0D7CC] text-text-secondary'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Bonus Points
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('DEDUCT')}
                    className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 border transition-all ${
                      adjustType === 'DEDUCT'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-[#FAF7F2] border-[#E0D7CC] text-text-secondary'
                    }`}
                  >
                    <Minus className="w-3.5 h-3.5" />
                    Deduct Points
                  </button>
                </div>
              </div>

              <div>
                <label className="font-extrabold text-brand-brown-dark block mb-1">Points Amount</label>
                <input
                  type="number"
                  min="1"
                  step="5"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#FAF7F2] border border-[#E0D7CC] rounded-xl font-black text-brand-brown-dark text-sm"
                  required
                />
              </div>

              <div>
                <label className="font-extrabold text-brand-brown-dark block mb-1">Reason / Note</label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. VIP promotion reward, goodwill correction..."
                  className="w-full px-4 py-2.5 bg-[#FAF7F2] border border-[#E0D7CC] rounded-xl font-bold text-text-primary text-xs"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F2ECE4]">
                <button
                  type="button"
                  onClick={() => setShowAdjustPoints(false)}
                  className="px-4 py-2 rounded-xl border border-[#E0D7CC] text-text-secondary font-bold hover:bg-[#FAF7F2]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-brand-teal hover:bg-brand-teal-dark text-white font-black shadow-xs"
                >
                  Confirm Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Thermal Receipt Preview Modal */}
      {viewingReceiptOrder && (
        <ThermalReceiptModal
          order={viewingReceiptOrder}
          isOpen={true}
          onClose={() => setViewingReceiptOrder(null)}
        />
      )}
    </div>
  );

  return createPortal(modalContent, document.body);
};
