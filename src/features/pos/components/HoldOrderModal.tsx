import React, { useState, useEffect } from 'react';
import { usePosCartStore } from '@/store/usePosCartStore';
import { useAuthStore } from '@/store/useAuthStore';
import { orderService } from '@/services/orderService';
import { formatLKR } from '@/utils/format';
import { PauseCircle, X, Check, Clock, User, Tag } from 'lucide-react';
import { toast } from 'sonner';

interface HoldOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HoldOrderModal: React.FC<HoldOrderModalProps> = ({ isOpen, onClose }) => {
  const { session } = useAuthStore();
  const user = session?.user;
  const terminalId = session?.terminalId || 'term_01';

  const {
    items,
    orderType,
    tableNumber,
    customerName,
    customerPhone,
    discountPercent,
    discountFixedCents,
    discountReason,
    getSubtotalCents,
    getDiscountCents,
    getServiceChargeCents,
    getTaxCents,
    getTotalCents,
    clearCart,
  } = usePosCartStore();

  const defaultLabel =
    orderType === 'DINE_IN'
      ? (tableNumber ? `Table ${tableNumber}` : 'Dine In Order')
      : customerName
      ? `Takeaway - ${customerName}`
      : 'Takeaway Customer';

  const [label, setLabel] = useState(defaultLabel);

  // Close with Escape key
  React.useEffect(() => {
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

  if (!isOpen || items.length === 0) return null;

  const totalCents = getTotalCents();
  const subtotalCents = getSubtotalCents();
  const discountCents = getDiscountCents();
  const serviceChargeCents = getServiceChargeCents();
  const taxCents = getTaxCents();

  const handleConfirmHold = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const held = orderService.holdOrder({
      items,
      orderType,
      tableNumber,
      customerName,
      customerPhone,
      subtotalCents,
      discountCents,
      discountPercent,
      discountReason,
      serviceChargeCents,
      taxCents,
      totalCents,
      cashierId: user.id,
      cashierName: user.name,
      terminalId,
      holdLabel: label.trim() || defaultLabel,
    });

    toast.success(`Order parked as "${held.holdLabel}". Cart cleared for next customer!`);

    clearCart();
    onClose();
  };

  const quickPresets = [
    orderType === 'DINE_IN' ? (tableNumber ? `Table ${tableNumber}` : 'Dine In Order') : 'Counter Takeaway',
    'Customer stepping to ATM',
    'Waiting for companion',
    'Phone order / Pickup later',
  ];

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
              <PauseCircle className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="font-black text-base text-brand-brown-dark tracking-tight">Park / Hold Order</h3>
              <p className="text-xs text-text-secondary">
                Temporarily suspend active cart to serve the next customer
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center text-text-secondary hover:bg-cream-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleConfirmHold} className="p-6 space-y-4">
          {/* Order Summary Box */}
          <div className="p-4 bg-cream-50/80 rounded-2xl border border-border/80 space-y-2 shadow-xs">
            <div className="flex items-center justify-between text-xs">
              <span className="font-extrabold text-text-secondary">
                {items.length} items ({orderType === 'DINE_IN' ? (tableNumber ? `Dine In • Table ${tableNumber}` : 'Dine In') : 'Takeaway'})
              </span>
              <span className="font-black text-brand-brown-deep text-sm sm:text-base tabular-nums">
                {formatLKR(totalCents)}
              </span>
            </div>
            <div className="text-[11px] font-medium text-text-secondary truncate">
              {items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
            </div>
          </div>

          {/* Label Input */}
          <div>
            <label className="text-xs font-black uppercase text-text-secondary block mb-1.5">
              Hold Identification Label / Note
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Table 05 or Customer in blue shirt"
              className="w-full px-4 py-3 bg-cream-50 border border-border focus:border-brand-teal focus:bg-white rounded-2xl text-xs font-bold text-brand-brown-dark transition-all outline-none"
              autoFocus
              required
            />
          </div>

          {/* Quick Presets */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-text-secondary">
              Quick Label Suggestions
            </label>
            <div className="flex flex-wrap gap-1.5">
              {quickPresets.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setLabel(preset)}
                  className="px-3 py-1.5 bg-cream-100 hover:bg-cream-200 text-brand-brown-dark font-extrabold text-[11px] rounded-xl transition-all active:scale-95"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-cream-100 hover:bg-cream-200 text-brand-brown-dark font-black text-xs rounded-2xl transition-all active:scale-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-[2] py-3 bg-brand-orange hover:bg-brand-orange-dark text-white font-black text-xs rounded-2xl shadow-soft transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <PauseCircle className="w-4 h-4 stroke-[2.5]" />
              Hold & Clear Cart
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
