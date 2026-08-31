import React, { useState, useEffect } from 'react';
import { usePosCartStore } from '@/store/usePosCartStore';
import { formatLKR } from '@/utils/format';
import { DiscountModal } from './DiscountModal';
import { TableModal } from './TableModal';
import { HoldOrderModal } from './HoldOrderModal';
import { HeldOrdersModal } from './HeldOrdersModal';
import { db } from '@/services/storage/db';
import { confirmDialog } from '@/store/useConfirmStore';
import {
  Utensils,
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  Tag,
  CreditCard,
  User,
  Phone,
  Sparkles,
  MapPin,
  PauseCircle,
  PlayCircle,
  Clock,
  ArrowRight,
} from 'lucide-react';

interface CartPanelProps {
  onOpenPayment: () => void;
}

export const CartPanel: React.FC<CartPanelProps> = ({ onOpenPayment }) => {
  const {
    items,
    orderType,
    tableNumber,
    discountPercent,
    discountFixedCents,
    discountReason,
    setOrderType,
    setTableNumber,
    updateQuantity,
    removeItem,
    clearCart,
    setDiscount,
    clearDiscount,
    getSubtotalCents,
    getDiscountCents,
    getServiceChargeCents,
    getTaxCents,
    getTotalCents,
    getItemCount,
  } = usePosCartStore();

  const [isDiscountOpen, setIsDiscountOpen] = useState(false);
  const [isTableOpen, setIsTableOpen] = useState(false);
  const [isHoldOpen, setIsHoldOpen] = useState(false);
  const [isHeldListOpen, setIsHeldListOpen] = useState(false);
  const [heldOrdersCount, setHeldOrdersCount] = useState(
    db.getSnapshot().heldOrders?.length || 0
  );

  useEffect(() => {
    const unsub = db.subscribe(() => {
      setHeldOrdersCount(db.getSnapshot().heldOrders?.length || 0);
    });

    const handleCustomHold = () => {
      if (items.length > 0) {
        setIsHoldOpen(true);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5') {
        e.preventDefault();
        if (items.length > 0) {
          setIsHoldOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pos-hold-order-f5', handleCustomHold);

    return () => {
      unsub();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pos-hold-order-f5', handleCustomHold);
    };
  }, [items.length]);

  const subtotal = getSubtotalCents();
  const discount = getDiscountCents();
  const serviceCharge = getServiceChargeCents();
  const tax = getTaxCents();
  const total = getTotalCents();
  const itemCount = getItemCount();

  return (
    <aside className="w-full h-full bg-white border-l border-border/80 flex flex-col shadow-soft overflow-hidden">
      {/* 1. Header: Order Type (DINE IN / TAKEAWAY) & Table Selector */}
      <div className="p-3 sm:p-3.5 bg-gradient-to-b from-cream-50 to-white border-b border-border/70 space-y-2 sm:space-y-2.5 flex-shrink-0">
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-cream-200/70 rounded-xl sm:rounded-2xl border border-cream-200">
          <button
            onClick={() => setOrderType('DINE_IN')}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg sm:rounded-xl text-xs font-black transition-all active:scale-95 cursor-pointer ${
              orderType === 'DINE_IN'
                ? 'bg-brand-teal text-white shadow-teal'
                : 'text-text-secondary hover:text-brand-brown-dark'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            DINE IN
          </button>
          <button
            onClick={() => setOrderType('TAKEAWAY')}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg sm:rounded-xl text-xs font-black transition-all active:scale-95 cursor-pointer ${
              orderType === 'TAKEAWAY'
                ? 'bg-brand-teal text-white shadow-teal'
                : 'text-text-secondary hover:text-brand-brown-dark'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            TAKEAWAY
          </button>
        </div>

        {/* Table Selector & Item Count Info */}
        <div className="flex items-center justify-between text-xs font-bold px-1">
          {orderType === 'DINE_IN' ? (
            <button
              onClick={() => setIsTableOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg sm:rounded-xl bg-white border border-border shadow-xs text-brand-brown-dark hover:border-brand-teal hover:shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <MapPin className="w-3.5 h-3.5 text-brand-orange" />
              {tableNumber ? (
                <>
                  <span className="font-extrabold text-xs">Table: {tableNumber}</span>
                  <span className="text-[10px] text-brand-teal uppercase font-black tracking-wider ml-0.5 bg-brand-teal-light px-1.5 py-0.5 rounded">
                    Edit
                  </span>
                </>
              ) : (
                <>
                  <span className="font-extrabold text-xs text-brand-brown-dark">Select Table</span>
                  <span className="text-[10px] text-brand-orange uppercase font-black tracking-wider ml-0.5 bg-brand-yellow-light px-1.5 py-0.5 rounded">
                    Choose
                  </span>
                </>
              )}
            </button>
          ) : (
            <span className="text-text-secondary font-semibold text-xs flex items-center gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5 text-brand-teal" />
              Takeaway Counter
            </span>
          )}

          <div className="flex items-center gap-2">
            {heldOrdersCount > 0 && (
              <button
                onClick={() => setIsHeldListOpen(true)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-brand-yellow-light text-brand-orange text-[10px] font-black border border-brand-orange/30 hover:bg-brand-yellow/30 transition-all active:scale-95 cursor-pointer"
              >
                <PauseCircle className="w-3 h-3" />
                <span>{heldOrdersCount} Held</span>
              </button>
            )}

            <span className="text-text-secondary font-extrabold text-xs">
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Scrollable Items List with min-h-0 Flex Containment */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5 divide-y divide-cream-100 scrollbar-thin">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-text-secondary space-y-2.5">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-cream-100/80 text-brand-brown/40 flex items-center justify-center shadow-inner">
              <ShoppingBag className="w-7 h-7 sm:w-8 sm:h-8 stroke-[1.8]" />
            </div>
            <div>
              <h4 className="font-black text-brand-brown-dark text-xs sm:text-sm">Cart is empty</h4>
              <p className="text-[11px] sm:text-xs text-text-secondary mt-0.5 max-w-[180px] leading-relaxed">
                Tap any menu item to start active order.
              </p>
            </div>

            {heldOrdersCount > 0 && (
              <button
                onClick={() => setIsHeldListOpen(true)}
                className="mt-1 flex items-center gap-1.5 px-4 py-2 bg-brand-yellow-light text-brand-orange border border-brand-orange/40 rounded-xl text-xs font-black shadow-xs hover:scale-105 transition-all cursor-pointer"
              >
                <PlayCircle className="w-3.5 h-3.5" />
                <span>Resume Held ({heldOrdersCount})</span>
              </button>
            )}
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="p-2.5 sm:p-3 bg-white hover:bg-cream-50/70 rounded-xl sm:rounded-2xl border border-cream-200/90 shadow-xs space-y-2 transition-all"
            >
              {/* Item Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="font-black text-xs sm:text-sm text-brand-brown-dark leading-tight truncate">
                    {item.name}
                  </h4>
                  {item.modifiers.length > 0 && (
                    <p className="text-[10px] text-text-secondary font-medium mt-0.5 line-clamp-1">
                      {item.modifiers.map((m) => m.optionName).join(' • ')}
                    </p>
                  )}
                  {item.notes && (
                    <span className="text-[9px] font-bold text-amber-900 bg-amber-100/70 border border-amber-200/80 px-1.5 py-0.5 rounded inline-block mt-0.5">
                      Note: {item.notes}
                    </span>
                  )}
                </div>

                <div className="text-right flex-shrink-0">
                  <div className="font-mono font-black text-xs sm:text-sm text-brand-brown-deep tabular-nums">
                    {formatLKR(item.itemTotalCents)}
                  </div>
                  {item.quantity > 1 && (
                    <div className="text-[9px] text-text-secondary font-semibold tabular-nums mt-0.5">
                      @{formatLKR(item.basePriceCents + item.modifiers.reduce((a, m) => a + m.priceCents, 0))}
                    </div>
                  )}
                </div>
              </div>

              {/* Stepper & Minimal Trash Action */}
              <div className="flex items-center justify-between pt-0.5">
                <div className="flex items-center gap-1 bg-cream-50 px-1.5 py-0.5 rounded-lg border border-cream-200/80">
                  <button
                    onClick={() => updateQuantity(item.id, -1)}
                    className="w-5 h-5 rounded bg-white shadow-xs flex items-center justify-center text-brand-brown-dark hover:bg-cream-100 active:scale-95 transition-all cursor-pointer"
                    title="Decrease quantity"
                  >
                    <Minus className="w-2.5 h-2.5 stroke-[2.5]" />
                  </button>
                  <span className="font-mono font-black text-xs w-5 text-center text-brand-brown-deep tabular-nums">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.id, 1)}
                    className="w-5 h-5 rounded bg-white shadow-xs flex items-center justify-center text-brand-brown-dark hover:bg-cream-100 active:scale-95 transition-all cursor-pointer"
                    title="Increase quantity"
                  >
                    <Plus className="w-2.5 h-2.5 stroke-[2.5]" />
                  </button>
                </div>

                <button
                  onClick={() => removeItem(item.id)}
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-text-secondary/60 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all active:scale-95 cursor-pointer"
                  title="Remove item"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 3. Footer Summary, Actions & PAY Button */}
      <div className="p-3 sm:p-3.5 bg-gradient-to-t from-cream-50 to-white border-t border-border/80 space-y-2 sm:space-y-2.5 flex-shrink-0 shadow-lg">
        {/* Cost Lines */}
        <div className="space-y-1 text-xs">
          <div className="flex justify-between text-text-secondary font-semibold">
            <span>Subtotal</span>
            <span className="tabular-nums font-bold text-text-primary">{formatLKR(subtotal)}</span>
          </div>

          {/* Discount Row */}
          <div className="flex justify-between items-center text-text-secondary">
            <button
              onClick={() => setIsDiscountOpen(true)}
              className="flex items-center gap-1 text-brand-teal hover:underline font-extrabold cursor-pointer"
            >
              <Tag className="w-3 h-3" />
              <span>
                {discount > 0
                  ? `Discount (${discountPercent ? `${discountPercent}%` : 'Fixed'})`
                  : '+ Add Discount'}
              </span>
            </button>
            {discount > 0 ? (
              <span className="tabular-nums font-black text-status-success">-{formatLKR(discount)}</span>
            ) : (
              <span className="tabular-nums font-semibold text-text-secondary">{formatLKR(0)}</span>
            )}
          </div>

          {serviceCharge > 0 && (
            <div className="flex justify-between text-text-secondary font-semibold">
              <span>Service Charge</span>
              <span className="tabular-nums font-bold text-text-primary">{formatLKR(serviceCharge)}</span>
            </div>
          )}

          {tax > 0 && (
            <div className="flex justify-between text-text-secondary font-semibold">
              <span>Tax</span>
              <span className="tabular-nums font-bold text-text-primary">{formatLKR(tax)}</span>
            </div>
          )}
        </div>

        {/* Big Total Row */}
        <div className="pt-1.5 border-t border-cream-200 flex items-baseline justify-between">
          <span className="font-black text-xs sm:text-sm uppercase tracking-wider text-brand-brown-dark">
            TOTAL DUE
          </span>
          <span className="font-black text-xl sm:text-2xl text-brand-brown-deep tracking-tight tabular-nums">
            {formatLKR(total)}
          </span>
        </div>

        {/* Secondary Cart Actions: Hold Order & Clear Cart */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={items.length === 0}
            onClick={() => setIsHoldOpen(true)}
            className="flex items-center justify-center gap-1.5 py-2 bg-brand-yellow-light hover:bg-brand-yellow/30 border border-brand-yellow/60 text-amber-900 disabled:opacity-30 disabled:cursor-not-allowed font-extrabold text-xs rounded-xl transition-all active:scale-95 shadow-xs cursor-pointer"
            title="Hold and park current order (F5)"
          >
            <PauseCircle className="w-3.5 h-3.5 text-brand-orange" />
            <span>Hold Order</span>
            <span className="text-[9px] font-mono bg-white text-brand-orange px-1 py-0.2 rounded font-black shadow-xs">
              F5
            </span>
          </button>

          <button
            type="button"
            disabled={items.length === 0}
            onClick={async () => {
              const confirmed = await confirmDialog({
                title: 'Clear Active Cart?',
                message: 'Are you sure you want to remove all selected items and choices from the current order?',
                confirmText: 'Clear Cart',
                cancelText: 'Keep Items',
                variant: 'danger',
              });
              if (confirmed) {
                clearCart();
              }
            }}
            className="flex items-center justify-center gap-1.5 py-2 bg-cream-100 hover:bg-rose-50 hover:text-rose-600 border border-border text-text-secondary disabled:opacity-30 disabled:cursor-not-allowed font-extrabold text-xs rounded-xl transition-all active:scale-95 shadow-xs cursor-pointer"
            title="Clear all cart items"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear Cart</span>
          </button>
        </div>

        {/* Giant PAY Button (F4 shortcut) */}
        <button
          id="pay-button"
          disabled={items.length === 0}
          onClick={onOpenPayment}
          className="w-full h-12 sm:h-13 rounded-xl sm:rounded-2xl bg-brand-teal hover:bg-brand-teal-dark disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm sm:text-base shadow-teal flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] cursor-pointer"
        >
          <CreditCard className="w-5 h-5 stroke-[2.5]" />
          <span>PAY</span>
          <span className="opacity-60">•</span>
          <span className="tabular-nums">{formatLKR(total)}</span>
          <span className="text-[10px] font-mono bg-white text-brand-teal px-1.5 py-0.5 rounded uppercase tracking-wider font-black shadow-xs">
            F4
          </span>
        </button>
      </div>

      {/* Modals */}
      <DiscountModal
        isOpen={isDiscountOpen}
        onClose={() => setIsDiscountOpen(false)}
        subtotalCents={subtotal}
        onApply={setDiscount}
        onClear={clearDiscount}
      />

      <TableModal
        isOpen={isTableOpen}
        onClose={() => setIsTableOpen(false)}
        currentTable={tableNumber}
        onSelectTable={setTableNumber}
      />

      <HoldOrderModal
        isOpen={isHoldOpen}
        onClose={() => setIsHoldOpen(false)}
      />

      <HeldOrdersModal
        isOpen={isHeldListOpen}
        onClose={() => setIsHeldListOpen(false)}
      />
    </aside>
  );
};
