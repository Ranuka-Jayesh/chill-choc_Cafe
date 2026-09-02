import React, { useState, useEffect, useCallback } from 'react';
import { usePosCartStore } from '@/store/usePosCartStore';
import { orderService } from '@/services/orderService';
import { soundService } from '@/services/soundService';
import { CashierShift, Order, PaymentMethod, PaymentSplit, User, Customer } from '@/types';
import { formatLKR, rupeesToCents, centsToRupees, formatCommaInput } from '@/utils/format';
import { CustomerLoyaltyModal, LoyaltyExchangeIcon } from './CustomerLoyaltyModal';
import {
  Banknote,
  CreditCard,
  Split,
  X,
  CheckCircle2,
  Delete,
  Printer,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Receipt,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: CashierShift;
  user: User;
  onOrderSuccess: (order: Order) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  shift,
  user,
  onOrderSuccess,
}) => {
  const {
    items,
    orderType,
    tableNumber,
    customerId,
    customerName,
    customerPhone,
    discountPercent,
    discountReason,
    loyaltyPointsRedeemed,
    loyaltyDiscountCents,
    setCustomerInfo,
    setLoyaltyRedemption,
    clearLoyaltyRedemption,
    getSubtotalCents,
    getDiscountCents,
    getServiceChargeCents,
    getTaxCents,
    getTotalCents,
    clearCart,
  } = usePosCartStore();

  const totalCents = getTotalCents();
  const subtotalCents = getSubtotalCents();
  const totalDiscountCents = getDiscountCents();
  const manualDiscountCents = Math.max(0, totalDiscountCents - (loyaltyDiscountCents || 0));
  const serviceChargeCents = getServiceChargeCents();
  const taxCents = getTaxCents();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [isLoyaltyModalOpen, setIsLoyaltyModalOpen] = useState<boolean>(false);

  // Cash state
  const [cashReceivedInput, setCashReceivedInput] = useState<string>('');
  const cashReceivedCents = cashReceivedInput ? rupeesToCents(cashReceivedInput) : totalCents;
  const changeCents = Math.max(0, cashReceivedCents - totalCents);

  // Card state
  const [cardRef, setCardRef] = useState<string>('');

  // Split state
  const [splitCashRupees, setSplitCashRupees] = useState<string>('');
  const [splitCardRupees, setSplitCardRupees] = useState<string>('');
  const [activeSplitField, setActiveSplitField] = useState<'cash' | 'card'>('cash');

  // Reset values when modal opens
  useEffect(() => {
    if (isOpen) {
      setPaymentMethod('CASH');
      setCashReceivedInput((totalCents / 100).toString());
      setCardRef('');
      setSplitCashRupees('');
      setSplitCardRupees('');
      setActiveSplitField('cash');
    }
  }, [isOpen, totalCents]);

  // Numpad button click for cash & split inputs
  const handleNumpad = useCallback(
    (char: string) => {
      if (paymentMethod === 'CASH') {
        if (char === 'CLEAR') {
          setCashReceivedInput('');
        } else if (char === 'BACKSPACE') {
          setCashReceivedInput((prev) => prev.slice(0, -1));
        } else if (char === '.') {
          setCashReceivedInput((prev) => {
            if (!prev) return '0.';
            if (prev.includes('.')) return prev;
            return `${prev}.`;
          });
        } else if (char === '00') {
          setCashReceivedInput((prev) => (prev ? `${prev}00` : '0'));
        } else {
          setCashReceivedInput((prev) => `${prev}${char}`);
        }
      } else if (paymentMethod === 'SPLIT') {
        const setter = activeSplitField === 'cash' ? setSplitCashRupees : setSplitCardRupees;
        if (char === 'CLEAR') {
          setter('');
        } else if (char === 'BACKSPACE') {
          setter((prev) => prev.slice(0, -1));
        } else if (char === '.') {
          setter((prev) => {
            if (!prev) return '0.';
            if (prev.includes('.')) return prev;
            return `${prev}.`;
          });
        } else if (char === '00') {
          setter((prev) => (prev ? `${prev}00` : '0'));
        } else {
          setter((prev) => `${prev}${char}`);
        }
      }
    },
    [paymentMethod, activeSplitField]
  );

  const setCashQuickPreset = (amountRupees: number) => {
    setCashReceivedInput(amountRupees.toString());
  };

  const selectSplitField = (field: 'cash' | 'card') => {
    setActiveSplitField(field);
    setTimeout(() => {
      const inputEl = document.getElementById(`split-${field}-input`) as HTMLInputElement | null;
      if (inputEl) {
        inputEl.focus();
        inputEl.select();
      }
    }, 10);
  };

  const handleSplit5050 = () => {
    const totalRupees = centsToRupees(totalCents);
    const half = Math.floor(totalRupees / 2);
    setSplitCashRupees(half.toString());
    setSplitCardRupees((totalRupees - half).toString());
  };

  const handleFillSplitBalance = () => {
    const totalRupees = centsToRupees(totalCents);
    if (activeSplitField === 'card') {
      const cashVal = Number(splitCashRupees.replace(/,/g, '')) || 0;
      const rem = Math.max(0, totalRupees - cashVal);
      setSplitCardRupees(rem.toString());
    } else {
      const cardVal = Number(splitCardRupees.replace(/,/g, '')) || 0;
      const rem = Math.max(0, totalRupees - cardVal);
      setSplitCashRupees(rem.toString());
    }
  };

  const handleCompletePayment = useCallback(async () => {
    try {
      let splits: PaymentSplit[] | undefined = undefined;

      if (paymentMethod === 'CASH') {
        if (cashReceivedCents < totalCents) {
          toast.error(`Cash received (${formatLKR(cashReceivedCents)}) is less than total (${formatLKR(totalCents)})`);
          return;
        }
      } else if (paymentMethod === 'SPLIT') {
        const cashCents = rupeesToCents(splitCashRupees || '0');
        const cardCents = rupeesToCents(splitCardRupees || '0');
        const splitSum = cashCents + cardCents;

        if (splitSum !== totalCents) {
          toast.error(`Split sum (${formatLKR(splitSum)}) does not match order total (${formatLKR(totalCents)})`);
          return;
        }

        splits = [];
        if (cashCents > 0) splits.push({ method: 'CASH', amountCents: cashCents });
        if (cardCents > 0) splits.push({ method: 'CARD', amountCents: cardCents, reference: cardRef });
      }

      const order = await orderService.createOrder({
        shiftId: shift.id,
        cashierId: user.id,
        cashierName: user.name,
        terminalId: shift.terminalId,
        orderType,
        tableNumber: orderType === 'DINE_IN' ? tableNumber : undefined,
        customerId: customerId || undefined,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        loyaltyPointsRedeemed: loyaltyPointsRedeemed || undefined,
        loyaltyDiscountCents: loyaltyDiscountCents || undefined,
        items,
        subtotalCents,
        discountCents: manualDiscountCents,
        discountPercent,
        discountReason: loyaltyDiscountCents > 0
          ? (discountReason ? `${discountReason} + Loyalty Redemption (${loyaltyPointsRedeemed} Pts)` : `Loyalty Redemption (${loyaltyPointsRedeemed} Pts)`)
          : discountReason,
        serviceChargeCents,
        taxCents,
        totalCents,
        paymentMethod,
        paymentSplits: splits,
        cashReceivedCents: paymentMethod === 'CASH' ? cashReceivedCents : undefined,
        changeGivenCents: paymentMethod === 'CASH' ? changeCents : undefined,
        cardReference: cardRef || undefined,
      });

      // Confetti celebration
      try {
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.7 },
          colors: ['#1FB5AE', '#F3B33D', '#E99343', '#875136'],
        });
      } catch {}

      // Play automated order success audio
      soundService.playOrderSuccess();

      toast.success(`Order ${order.orderNumber} completed! Kitchen ticket printed.`);
      clearCart();
      onOrderSuccess(order);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Payment processing failed');
    }
  }, [
    paymentMethod,
    cashReceivedCents,
    totalCents,
    splitCashRupees,
    splitCardRupees,
    cardRef,
    shift,
    user,
    orderType,
    tableNumber,
    customerId,
    customerName,
    customerPhone,
    loyaltyPointsRedeemed,
    loyaltyDiscountCents,
    items,
    subtotalCents,
    manualDiscountCents,
    discountPercent,
    discountReason,
    serviceChargeCents,
    taxCents,
    changeCents,
    clearCart,
    onOrderSuccess,
    onClose,
  ]);

  // Physical Keyboard listener for Numpad, Enter, Escape, Backspace
  useEffect(() => {
    if (!isOpen || isLoyaltyModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // If typing inside an input other than cash or split number inputs, handle Enter only
      const targetId = (e.target as HTMLElement)?.id;
      const isNumberInput =
        targetId === 'cash-received-input' ||
        targetId === 'split-cash-input' ||
        targetId === 'split-card-input';

      if (
        (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) &&
        !isNumberInput
      ) {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleCompletePayment();
        }
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        handleCompletePayment();
        return;
      }

      // If in Cash or Split mode and focus is not directly typing in input
      if (paymentMethod === 'CASH' || paymentMethod === 'SPLIT') {
        if (e.target instanceof HTMLInputElement && isNumberInput) {
          return; // standard input onChange handles this
        }

        if (e.key >= '0' && e.key <= '9') {
          e.preventDefault();
          handleNumpad(e.key);
        } else if (e.key === '.') {
          e.preventDefault();
          handleNumpad('.');
        }
      } else if (e.key === 'Backspace') {
        const activeTag = (document.activeElement?.tagName || '').toLowerCase();
        if (activeTag !== 'input') {
          handleNumpad('BACKSPACE');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoyaltyModalOpen, handleNumpad, handleCompletePayment, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 lg:p-8 bg-brand-brown-deep/80 backdrop-blur-md overflow-y-auto animate-in fade-in">
      <div className="relative w-full max-w-[1360px] my-auto">
        <div className="flex items-center justify-between gap-3 mb-4 text-white shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white drop-shadow-sm">
              Tender & Settlement
            </h1>
            <span className="px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-md text-xs sm:text-sm font-bold text-cream-100 border border-white/25 uppercase tracking-wide">
              {orderType === 'DINE_IN' ? (tableNumber ? `Dine In • Table ${tableNumber}` : 'Dine In') : 'Takeaway Counter'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-md text-white text-xs sm:text-sm font-bold transition-all border border-white/20 cursor-pointer active:scale-95 shadow-sm"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Close</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-stretch">
          {/* ========================================================================= */}
          {/* CARD 1 (LEFT - 5 Cols): ORDER ITEMS & FINANCIAL SUMMARY                   */}
          {/* ========================================================================= */}
          <div className="lg:col-span-5 flex flex-col justify-between bg-white rounded-2xl sm:rounded-[28px] shadow-2xl border border-[#E9E0D5] overflow-hidden min-h-[560px] lg:min-h-[660px]">
            {/* 1. Header Banner: Total Due & Loyalty Icon */}
            <div className="p-5 sm:p-6 bg-[#FAF7F2] border-b border-[#EAE3DA]">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-brand-teal" />
                  Order Summary
                </span>

                {/* Loyalty / Member Rewards Button with Star-Coins Exchange Icon */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsLoyaltyModalOpen(true)}
                    className={`px-3 py-1.5 rounded-full text-xs font-black transition-all flex items-center gap-2 cursor-pointer active:scale-95 shadow-xs border ${
                      customerName
                        ? 'bg-amber-100 hover:bg-amber-200/90 text-amber-900 border-amber-300 ring-2 ring-amber-400/30'
                        : 'bg-white hover:bg-amber-50 text-brand-brown-dark border-[#E0D7CC] hover:border-amber-300'
                    }`}
                    title="Link customer to earn & redeem loyalty points"
                  >
                    <LoyaltyExchangeIcon className="w-5 h-5 shrink-0" />
                    <span>
                      {customerName ? customerName : 'Add Member / Points'}
                    </span>
                    {loyaltyPointsRedeemed > 0 && (
                      <span className="bg-amber-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                        -{loyaltyPointsRedeemed} Pts
                      </span>
                    )}
                  </button>

                  {customerName && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerInfo('', '', '');
                        clearLoyaltyRedemption();
                        toast.info('Customer unlinked');
                      }}
                      className="w-7 h-7 rounded-full bg-cream-100 hover:bg-red-50 text-text-muted hover:text-red-600 border border-[#D5C7B8] flex items-center justify-center text-xs font-bold cursor-pointer transition-colors"
                      title="Unlink customer from order"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-baseline justify-between gap-2 mt-3">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-base sm:text-lg font-black text-brand-teal">Rs.</span>
                  <span className="font-extrabold text-3xl sm:text-4xl lg:text-5xl text-brand-brown-dark tracking-tight">
                    {(totalCents / 100).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <span className="text-xs sm:text-sm text-text-muted font-bold shrink-0">Total Due</span>
              </div>
            </div>

            {/* 2. Middle Scrollable: Itemized Order List */}
            <div className="flex-1 p-5 sm:p-6 overflow-y-auto max-h-[340px] sm:max-h-[420px] space-y-1.5 text-xs sm:text-sm scrollbar-thin">
              <div className="pb-2 border-b border-[#EAE3DA] flex items-center justify-between font-black uppercase text-xs text-text-muted tracking-wider">
                <span>Items & Modifiers</span>
                <span>Amount</span>
              </div>

              <div className="divide-y divide-[#F0EAE1]">
                {items.map((item, idx) => (
                  <div key={idx} className="py-2.5 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-brand-brown-dark text-sm sm:text-base truncate">
                        <span className="font-extrabold text-brand-teal mr-1.5">{item.quantity}x</span>
                        <span>{item.name}</span>
                      </div>
                      {item.modifiers && item.modifiers.length > 0 && (
                        <p className="text-xs text-text-muted truncate mt-0.5 font-medium pl-4">
                          {item.modifiers.map((m) => m.optionName).join(', ')}
                        </p>
                      )}
                    </div>
                    <span className="font-bold text-brand-brown-dark shrink-0 text-sm sm:text-base">
                      {formatLKR(item.itemTotalCents)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Bottom Financial Breakdown */}
            <div className="p-5 sm:p-6 bg-[#FAF7F2] border-t border-[#EAE3DA] space-y-1.5 text-xs sm:text-sm">
              <div className="flex items-center justify-between pb-1.5 border-b border-[#F0EAE1] text-text-secondary font-medium">
                <span>Subtotal</span>
                <span>{formatLKR(subtotalCents)}</span>
              </div>

              {manualDiscountCents > 0 && (
                <div className="flex items-center justify-between pb-1.5 border-b border-[#F0EAE1] text-amber-800 font-medium">
                  <span>Discount {discountPercent ? `(${discountPercent}%)` : ''}</span>
                  <span>-{formatLKR(manualDiscountCents)}</span>
                </div>
              )}

              {loyaltyDiscountCents > 0 && (
                <div className="flex items-center justify-between pb-1.5 border-b border-[#F0EAE1] text-emerald-800 font-medium">
                  <span>Loyalty Points ({loyaltyPointsRedeemed} Pts)</span>
                  <span className="font-bold">-{formatLKR(loyaltyDiscountCents)}</span>
                </div>
              )}

              {serviceChargeCents > 0 && (
                <div className="flex items-center justify-between pb-1.5 border-b border-[#F0EAE1] text-text-secondary font-medium">
                  <span>Service Charge</span>
                  <span>+{formatLKR(serviceChargeCents)}</span>
                </div>
              )}

              {taxCents > 0 && (
                <div className="flex items-center justify-between pb-1.5 border-b border-[#F0EAE1] text-text-secondary font-medium">
                  <span>Taxes & VAT</span>
                  <span>+{formatLKR(taxCents)}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1.5 font-black text-brand-brown-dark text-base sm:text-lg lg:text-xl">
                <span>Final Settlement</span>
                <span className="text-brand-teal font-black">{formatLKR(totalCents)}</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 flex flex-col justify-between bg-white rounded-2xl sm:rounded-[28px] shadow-2xl border border-[#E9E0D5] overflow-hidden min-h-[560px] lg:min-h-[660px]">
            {/* 1. Payment Method Selector Tabs */}
            <div className="p-4 sm:p-5 bg-[#FAF7F2] border-b border-[#EAE3DA] shrink-0">
              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH')}
                  className={`flex items-center justify-center gap-2.5 py-3.5 sm:py-4 rounded-2xl font-black text-sm sm:text-base transition-all active:scale-95 cursor-pointer ${
                    paymentMethod === 'CASH'
                      ? 'bg-brand-teal text-white shadow-teal ring-2 ring-brand-teal'
                      : 'bg-white text-brand-brown-dark border border-[#E0D7CC] hover:bg-cream-100'
                  }`}
                >
                  <Banknote className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
                  <span>Cash</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('CARD')}
                  className={`flex items-center justify-center gap-2.5 py-3.5 sm:py-4 rounded-2xl font-black text-sm sm:text-base transition-all active:scale-95 cursor-pointer ${
                    paymentMethod === 'CARD'
                      ? 'bg-brand-teal text-white shadow-teal ring-2 ring-brand-teal'
                      : 'bg-white text-brand-brown-dark border border-[#E0D7CC] hover:bg-cream-100'
                  }`}
                >
                  <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
                  <span>Card</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('SPLIT');
                    selectSplitField('cash');
                  }}
                  className={`flex items-center justify-center gap-2.5 py-3.5 sm:py-4 rounded-2xl font-black text-sm sm:text-base transition-all active:scale-95 cursor-pointer ${
                    paymentMethod === 'SPLIT'
                      ? 'bg-brand-teal text-white shadow-teal ring-2 ring-brand-teal'
                      : 'bg-white text-brand-brown-dark border border-[#E0D7CC] hover:bg-cream-100'
                  }`}
                >
                  <Split className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
                  <span>Split Tender</span>
                </button>
              </div>
            </div>

            {/* 2. Tender Method Body */}
            <div className="p-5 sm:p-7 flex-1 flex flex-col justify-center">
              {/* TAB 1: CASH PAYMENT */}
              {paymentMethod === 'CASH' && (
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 sm:gap-7 items-center">
                  {/* Left Column: Cash Input, Presets, Change */}
                  <div className="sm:col-span-6 space-y-4">
                    {/* Cash Received Field */}
                    <div className="space-y-1.5 pb-3 border-b border-[#EAE3DA]">
                      <label className="text-xs font-black uppercase tracking-wider text-text-muted block">
                        Cash Received
                      </label>
                      <div className="relative flex items-center bg-white border-2 border-[#E0D7CC] rounded-2xl focus-within:border-brand-teal focus-within:ring-4 focus-within:ring-brand-teal/15 transition-all">
                        <span className="pl-4 font-black text-brand-brown-dark text-lg sm:text-xl">Rs.</span>
                        <input
                          id="cash-received-input"
                          type="text"
                          placeholder="0.00"
                          value={formatCommaInput(cashReceivedInput)}
                          onChange={(e) => setCashReceivedInput(e.target.value.replace(/,/g, ''))}
                          className="w-full pl-2 pr-4 py-3.5 sm:py-4 bg-transparent text-right font-mono font-black text-2xl sm:text-3xl lg:text-4xl text-brand-brown-dark tabular-nums focus:outline-none"
                          autoFocus
                        />
                      </div>
                    </div>

                    {/* Quick Cash Presets */}
                    <div className="space-y-2 pb-3 border-b border-[#EAE3DA]">
                      <label className="text-xs font-black uppercase tracking-wider text-text-muted block">
                        Quick Cash Presets
                      </label>
                      <div className="grid grid-cols-3 gap-2.5">
                        <button
                          type="button"
                          onClick={() => setCashQuickPreset(centsToRupees(totalCents))}
                          className="py-3 sm:py-3.5 rounded-xl border border-[#E0D7CC] bg-[#FAF7F2] hover:bg-cream-100 text-xs sm:text-sm font-black text-brand-teal transition-colors cursor-pointer active:scale-95 shadow-2xs"
                        >
                          Exact
                        </button>
                        <button
                          type="button"
                          onClick={() => setCashQuickPreset(1000)}
                          className="py-3 sm:py-3.5 rounded-xl border border-[#E0D7CC] bg-[#FAF7F2] hover:bg-cream-100 text-xs sm:text-sm font-bold text-brand-brown-dark transition-colors cursor-pointer active:scale-95 shadow-2xs"
                        >
                          Rs. 1,000
                        </button>
                        <button
                          type="button"
                          onClick={() => setCashQuickPreset(2000)}
                          className="py-3 sm:py-3.5 rounded-xl border border-[#E0D7CC] bg-[#FAF7F2] hover:bg-cream-100 text-xs sm:text-sm font-bold text-brand-brown-dark transition-colors cursor-pointer active:scale-95 shadow-2xs"
                        >
                          Rs. 2,000
                        </button>
                        <button
                          type="button"
                          onClick={() => setCashQuickPreset(3000)}
                          className="py-3 sm:py-3.5 rounded-xl border border-[#E0D7CC] bg-[#FAF7F2] hover:bg-cream-100 text-xs sm:text-sm font-bold text-brand-brown-dark transition-colors cursor-pointer active:scale-95 shadow-2xs"
                        >
                          Rs. 3,000
                        </button>
                        <button
                          type="button"
                          onClick={() => setCashQuickPreset(5000)}
                          className="py-3 sm:py-3.5 rounded-xl border border-[#E0D7CC] bg-[#FAF7F2] hover:bg-cream-100 text-xs sm:text-sm font-bold text-brand-brown-dark transition-colors cursor-pointer active:scale-95 shadow-2xs"
                        >
                          Rs. 5,000
                        </button>
                        <button
                          type="button"
                          onClick={() => setCashQuickPreset(10000)}
                          className="py-3 sm:py-3.5 rounded-xl border border-[#E0D7CC] bg-[#FAF7F2] hover:bg-cream-100 text-xs sm:text-sm font-bold text-brand-brown-dark transition-colors cursor-pointer active:scale-95 shadow-2xs"
                        >
                          Rs. 10,000
                        </button>
                      </div>
                    </div>

                    {/* Change Due (Bottom border only, clean single line) */}
                    <div className="pt-1.5 flex items-center justify-between gap-3">
                      <span className="text-xs font-black uppercase text-text-muted tracking-wider block">
                        Change Due
                      </span>
                      <span className="font-mono font-black text-xl sm:text-2xl text-brand-brown-dark tabular-nums whitespace-nowrap">
                        {formatLKR(changeCents)}
                      </span>
                    </div>
                  </div>

                  {/* Right Column: Tactile Numpad (No container bg/border, larger keys) */}
                  <div className="sm:col-span-6 p-1 sm:p-2 space-y-3.5 flex flex-col justify-center">
                    <div className="grid grid-cols-3 gap-3 sm:gap-4 place-items-center">
                      {['7', '8', '9', '4', '5', '6', '1', '2', '3'].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleNumpad(num)}
                          className="w-15 h-15 sm:w-16 sm:h-16 rounded-full bg-white border border-[#E0D7CC] shadow-2xs font-mono font-black text-2xl sm:text-3xl text-brand-brown-dark hover:bg-cream-100 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                        >
                          {num}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => handleNumpad('CLEAR')}
                        className="w-15 h-15 sm:w-16 sm:h-16 rounded-full bg-white border border-rose-200 shadow-2xs font-bold text-xs sm:text-sm text-rose-700 hover:bg-rose-50 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNumpad('0')}
                        className="w-15 h-15 sm:w-16 sm:h-16 rounded-full bg-white border border-[#E0D7CC] shadow-2xs font-mono font-black text-2xl sm:text-3xl text-brand-brown-dark hover:bg-cream-100 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                      >
                        0
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNumpad('.')}
                        className="w-15 h-15 sm:w-16 sm:h-16 rounded-full bg-white border border-[#E0D7CC] shadow-2xs font-mono font-black text-2xl sm:text-3xl text-brand-brown-dark hover:bg-cream-100 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                      >
                        .
                      </button>
                    </div>

                    <div className="pt-2.5 border-t border-[#EAE3DA]">
                      <button
                        type="button"
                        onClick={() => handleNumpad('BACKSPACE')}
                        className="w-full h-12 sm:h-13 bg-white hover:bg-cream-100 rounded-full border border-[#E0D7CC] flex items-center justify-center gap-2 text-xs sm:text-sm font-black text-brand-brown-dark active:scale-95 transition-all cursor-pointer shadow-2xs"
                      >
                        <Delete className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span>Backspace</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: CARD PAYMENT */}
              {paymentMethod === 'CARD' && (
                <div className="max-w-lg mx-auto space-y-6 text-center py-10">
                  <div className="w-20 h-20 rounded-3xl bg-[#FAF7F2] border border-[#EAE3DA] text-brand-teal flex items-center justify-center mx-auto shadow-xs">
                    <CreditCard className="w-10 h-10 stroke-[2]" />
                  </div>
                  <div>
                    <h3 className="font-black text-lg sm:text-xl text-brand-brown-dark">
                      Process Card on POS Card Terminal
                    </h3>
                    <p className="text-xs sm:text-sm text-text-secondary mt-1">
                      Digital card transaction does not affect physical drawer float.
                    </p>
                  </div>
                  <div className="text-left space-y-2 pt-3 pb-3 border-b border-[#EAE3DA]">
                    <label className="text-xs font-black uppercase text-text-muted block">
                      Optional Card Auth / Slip Reference #
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. VISA-9842"
                      value={cardRef}
                      onChange={(e) => setCardRef(e.target.value)}
                      className="w-full px-4 py-3 bg-white border-2 border-[#E0D7CC] rounded-2xl font-mono text-sm font-bold text-brand-brown-dark focus:outline-none focus:border-brand-teal"
                      autoFocus
                    />
                  </div>
                </div>
              )}

              {/* TAB 3: SPLIT PAYMENT */}
              {paymentMethod === 'SPLIT' && (
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 sm:gap-6 items-center">
                  {/* Left Column: Split Allocations */}
                  <div className="sm:col-span-6 space-y-3.5">
                    {/* Cash Split Field */}
                    <div
                      onClick={() => selectSplitField('cash')}
                      className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                        activeSplitField === 'cash'
                          ? 'border-brand-teal bg-[#FAF7F2] ring-2 ring-brand-teal/20'
                          : 'border-[#E0D7CC] bg-white hover:bg-[#FAF7F2]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-text-secondary flex items-center gap-2">
                          <Banknote className="w-4 h-4 text-brand-teal" /> Cash Tender
                        </span>
                        {activeSplitField === 'cash' && (
                          <span className="text-[10px] font-black uppercase text-brand-teal bg-white px-2 py-0.5 rounded-md border border-brand-teal/30">
                            Editing
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex items-baseline justify-between">
                        <span className="text-base font-bold text-text-secondary">Rs.</span>
                        <input
                          id="split-cash-input"
                          type="text"
                          placeholder="0.00"
                          value={formatCommaInput(splitCashRupees)}
                          onChange={(e) => setSplitCashRupees(e.target.value.replace(/,/g, ''))}
                          onFocus={() => setActiveSplitField('cash')}
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                          className="w-full text-right font-mono font-black text-2xl text-brand-brown-dark bg-transparent tabular-nums focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Card Split Field */}
                    <div
                      onClick={() => selectSplitField('card')}
                      className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                        activeSplitField === 'card'
                          ? 'border-brand-teal bg-[#FAF7F2] ring-2 ring-brand-teal/20'
                          : 'border-[#E0D7CC] bg-white hover:bg-[#FAF7F2]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-text-secondary flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-brand-orange" /> Card Tender
                        </span>
                        {activeSplitField === 'card' && (
                          <span className="text-[10px] font-black uppercase text-brand-teal bg-white px-2 py-0.5 rounded-md border border-brand-teal/30">
                            Editing
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex items-baseline justify-between">
                        <span className="text-base font-bold text-text-secondary">Rs.</span>
                        <input
                          id="split-card-input"
                          type="text"
                          placeholder="0.00"
                          value={formatCommaInput(splitCardRupees)}
                          onChange={(e) => setSplitCardRupees(e.target.value.replace(/,/g, ''))}
                          onFocus={() => setActiveSplitField('card')}
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                          className="w-full text-right font-mono font-black text-2xl text-brand-brown-dark bg-transparent tabular-nums focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Quick Split Helpers */}
                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={handleSplit5050}
                        className="py-2.5 px-3.5 rounded-xl border border-[#E0D7CC] bg-[#FAF7F2] hover:bg-cream-100 text-xs sm:text-sm font-black text-brand-teal transition-all active:scale-95 text-center cursor-pointer shadow-2xs"
                      >
                        50 / 50 Split
                      </button>
                      <button
                        type="button"
                        onClick={handleFillSplitBalance}
                        className="py-2.5 px-3.5 rounded-xl border border-[#E0D7CC] bg-[#FAF7F2] hover:bg-cream-100 text-xs sm:text-sm font-bold text-brand-brown-dark transition-all active:scale-95 text-center cursor-pointer shadow-2xs"
                      >
                        Fill Balance
                      </button>
                    </div>

                    {/* Split Balance Summary */}
                    {(() => {
                      const c = rupeesToCents(splitCashRupees || '0');
                      const cr = rupeesToCents(splitCardRupees || '0');
                      const sum = c + cr;
                      const remaining = totalCents - sum;

                      return (
                        <div className="pt-2.5 border-t border-[#EAE3DA] flex items-center justify-between text-xs sm:text-sm font-bold">
                          <span className="text-text-muted">
                            {remaining === 0
                              ? 'Allocation Complete'
                              : remaining > 0
                              ? 'Remaining to Allocate:'
                              : 'Over Allocated:'}
                          </span>
                          <span
                            className={`font-mono font-black text-base sm:text-lg tabular-nums ${
                              remaining === 0
                                ? 'text-emerald-700'
                                : remaining > 0
                                ? 'text-amber-800'
                                : 'text-rose-700'
                            }`}
                          >
                            {formatLKR(Math.abs(remaining))}
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Right Column: Tactile Numpad (No container bg/border, larger keys) */}
                  <div className="sm:col-span-6 p-1 sm:p-2 space-y-3.5 flex flex-col justify-center">
                    <div className="grid grid-cols-3 gap-3 sm:gap-4 place-items-center">
                      {['7', '8', '9', '4', '5', '6', '1', '2', '3'].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleNumpad(num)}
                          className="w-15 h-15 sm:w-16 sm:h-16 rounded-full bg-white border border-[#E0D7CC] shadow-2xs font-mono font-black text-2xl sm:text-3xl text-brand-brown-dark hover:bg-cream-100 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                        >
                          {num}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => handleNumpad('CLEAR')}
                        className="w-15 h-15 sm:w-16 sm:h-16 rounded-full bg-white border border-rose-200 shadow-2xs font-bold text-xs sm:text-sm text-rose-700 hover:bg-rose-50 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNumpad('0')}
                        className="w-15 h-15 sm:w-16 sm:h-16 rounded-full bg-white border border-[#E0D7CC] shadow-2xs font-mono font-black text-2xl sm:text-3xl text-brand-brown-dark hover:bg-cream-100 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                      >
                        0
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNumpad('.')}
                        className="w-15 h-15 sm:w-16 sm:h-16 rounded-full bg-white border border-[#E0D7CC] shadow-2xs font-mono font-black text-2xl sm:text-3xl text-brand-brown-dark hover:bg-cream-100 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                      >
                        .
                      </button>
                    </div>

                    <div className="pt-2.5 border-t border-[#EAE3DA]">
                      <button
                        type="button"
                        onClick={() => handleNumpad('BACKSPACE')}
                        className="w-full h-12 sm:h-13 bg-white hover:bg-cream-100 rounded-full border border-[#E0D7CC] flex items-center justify-center gap-2 text-xs sm:text-sm font-black text-brand-brown-dark active:scale-95 transition-all cursor-pointer shadow-2xs"
                      >
                        <Delete className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span>Backspace</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Bottom Pinned Footer: Back to Order & Complete Payment (Equal Sizing) */}
            <div className="p-4 sm:p-5 bg-[#FAF7F2] border-t border-[#EAE3DA] grid grid-cols-2 gap-3 sm:gap-4 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="w-full h-14 sm:h-16 rounded-2xl border-2 border-[#E0D7CC] bg-white text-sm sm:text-base font-black text-brand-brown-dark hover:bg-cream-100 transition-all cursor-pointer active:scale-95 shadow-2xs flex items-center justify-center"
              >
                Back to Order
              </button>

              <button
                type="button"
                id="complete-payment-button"
                onClick={handleCompletePayment}
                className="w-full h-14 sm:h-16 rounded-2xl bg-brand-teal hover:bg-brand-teal-dark text-white font-black text-sm sm:text-base shadow-teal transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                <span>COMPLETE PAYMENT</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Loyalty & Points Redemption Modal */}
      <CustomerLoyaltyModal
        isOpen={isLoyaltyModalOpen}
        onClose={() => setIsLoyaltyModalOpen(false)}
        orderTotalCents={subtotalCents}
        subtotalCents={subtotalCents}
        currentCustomer={
          customerName
            ? {
                id: customerId,
                name: customerName,
                phone: customerPhone,
                pointsRedeemed: loyaltyPointsRedeemed,
                discountCents: loyaltyDiscountCents,
              }
            : null
        }
        onSelectCustomer={(cust: Customer, pointsToRedeem = 0, discount = 0) => {
          setCustomerInfo(cust.name, cust.phone, cust.id);
          if (pointsToRedeem > 0) {
            setLoyaltyRedemption(pointsToRedeem, discount);
          } else {
            clearLoyaltyRedemption();
          }
        }}
        onRemoveCustomer={() => {
          setCustomerInfo('', '', '');
          clearLoyaltyRedemption();
          toast.info('Customer detached from order');
        }}
      />
    </div>
  );
};
