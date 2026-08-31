import React, { useState, useEffect, useCallback } from 'react';
import { usePosCartStore } from '@/store/usePosCartStore';
import { orderService } from '@/services/orderService';
import { soundService } from '@/services/soundService';
import { CashierShift, Order, PaymentMethod, PaymentSplit, User } from '@/types';
import { formatLKR, rupeesToCents, centsToRupees, formatCommaInput } from '@/utils/format';
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
    customerName,
    customerPhone,
    discountPercent,
    discountReason,
    getSubtotalCents,
    getDiscountCents,
    getServiceChargeCents,
    getTaxCents,
    getTotalCents,
    clearCart,
  } = usePosCartStore();

  const totalCents = getTotalCents();
  const subtotalCents = getSubtotalCents();
  const discountCents = getDiscountCents();
  const serviceChargeCents = getServiceChargeCents();
  const taxCents = getTaxCents();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');

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
        customerName,
        customerPhone,
        items,
        subtotalCents,
        discountCents,
        discountPercent,
        discountReason,
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
    customerName,
    customerPhone,
    items,
    subtotalCents,
    discountCents,
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
    if (!isOpen) return;

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
        } else if (e.key === 'Backspace') {
          e.preventDefault();
          handleNumpad('BACKSPACE');
        } else if (e.key === 'Delete' || e.key.toLowerCase() === 'c') {
          e.preventDefault();
          handleNumpad('CLEAR');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, paymentMethod, handleNumpad, handleCompletePayment, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-brand-brown-deep/70 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl sm:rounded-[32px] shadow-2xl border border-border/80 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 sm:py-5 bg-gradient-to-r from-cream-50 to-white border-b border-border/70">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="font-black text-lg sm:text-xl text-brand-brown-dark tracking-tight">
                Tender & Settlement
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-brand-teal-light text-brand-teal text-[11px] font-extrabold uppercase tracking-wide border border-brand-teal/20">
                {orderType === 'DINE_IN' ? (tableNumber ? `Dine In • Table ${tableNumber}` : 'Dine In') : 'Takeaway Counter'}
              </span>
            </div>
            <p className="text-xs text-text-secondary mt-0.5">
              Cashier: {user.name} • Terminal: {shift.terminalName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-text-secondary hover:bg-cream-100 hover:text-brand-brown-dark transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Big Total Banner */}
        <div className="bg-brand-brown-deep text-white px-6 sm:px-8 py-4 sm:py-5 flex items-center justify-between shadow-inner">
          <div>
            <div className="text-[11px] uppercase font-black tracking-widest text-brand-yellow">
              TOTAL DUE
            </div>
            <div className="text-3xl sm:text-4xl font-black tracking-tight tabular-nums mt-0.5">
              {formatLKR(totalCents)}
            </div>
          </div>
          <div className="text-right text-xs text-cream-200 space-y-0.5 font-medium">
            <div>Subtotal: {formatLKR(subtotalCents)}</div>
            {discountCents > 0 && (
              <div className="text-brand-yellow font-bold">Discount: -{formatLKR(discountCents)}</div>
            )}
            <div>{items.reduce((a, i) => a + i.quantity, 0)} items in order</div>
          </div>
        </div>

        {/* Payment Method Selector Tabs (3 Clean Tabs: Cash, Card, Split) */}
        <div className="p-3 bg-cream-50/80 border-b border-border/70">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <button
              onClick={() => setPaymentMethod('CASH')}
              className={`flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-xs sm:text-sm transition-all active:scale-95 ${
                paymentMethod === 'CASH'
                  ? 'bg-brand-teal text-white shadow-teal ring-2 ring-brand-teal'
                  : 'bg-white text-text-primary hover:bg-cream-100/80 border border-border shadow-xs'
              }`}
            >
              <Banknote className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
              <span>Cash</span>
            </button>

            <button
              onClick={() => setPaymentMethod('CARD')}
              className={`flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-xs sm:text-sm transition-all active:scale-95 ${
                paymentMethod === 'CARD'
                  ? 'bg-brand-teal text-white shadow-teal ring-2 ring-brand-teal'
                  : 'bg-white text-text-primary hover:bg-cream-100/80 border border-border shadow-xs'
              }`}
            >
              <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
              <span>Card</span>
            </button>

            <button
              onClick={() => {
                setPaymentMethod('SPLIT');
                selectSplitField('cash');
              }}
              className={`flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-xs sm:text-sm transition-all active:scale-95 ${
                paymentMethod === 'SPLIT'
                  ? 'bg-brand-teal text-white shadow-teal ring-2 ring-brand-teal'
                  : 'bg-white text-text-primary hover:bg-cream-100/80 border border-border shadow-xs'
              }`}
            >
              <Split className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
              <span>Split Tender</span>
            </button>
          </div>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 bg-white">
          {/* 1. CASH PAYMENT SCREEN */}
          {paymentMethod === 'CASH' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
              {/* Left: Quick Bill Presets & Change Calculation */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-extrabold uppercase tracking-wider text-text-secondary">
                    Cash Received
                  </label>
                  <div className="mt-1 relative flex items-center bg-cream-50/80 border-2 border-brand-teal rounded-2xl shadow-inner focus-within:ring-4 focus-within:ring-brand-teal/20 transition-all">
                    <span className="pl-4 font-black text-brand-brown-dark text-base">Rs.</span>
                    <input
                      id="cash-received-input"
                      type="text"
                      placeholder="0.00"
                      value={formatCommaInput(cashReceivedInput)}
                      onChange={(e) => setCashReceivedInput(e.target.value.replace(/,/g, ''))}
                      className="w-full pl-2 pr-4 py-3 bg-transparent text-right font-black text-2xl sm:text-3xl text-text-primary tabular-nums focus:outline-none"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Quick Bills Buttons */}
                <div>
                  <label className="text-xs font-extrabold uppercase tracking-wider text-text-secondary">
                    Quick Cash Presets
                  </label>
                  <div className="grid grid-cols-3 gap-2 mt-1.5">
                    <button
                      type="button"
                      onClick={() => setCashQuickPreset(centsToRupees(totalCents))}
                      className="py-2.5 rounded-xl border border-brand-teal/40 bg-brand-teal-light hover:bg-brand-teal hover:text-white text-xs font-black text-brand-teal transition-colors"
                    >
                      Exact
                    </button>
                    <button
                      type="button"
                      onClick={() => setCashQuickPreset(1000)}
                      className="py-2.5 rounded-xl border border-border bg-cream-50 hover:bg-cream-100 text-xs font-bold text-brand-brown-dark transition-colors"
                    >
                      Rs. 1,000
                    </button>
                    <button
                      type="button"
                      onClick={() => setCashQuickPreset(2000)}
                      className="py-2.5 rounded-xl border border-border bg-cream-50 hover:bg-cream-100 text-xs font-bold text-brand-brown-dark transition-colors"
                    >
                      Rs. 2,000
                    </button>
                    <button
                      type="button"
                      onClick={() => setCashQuickPreset(3000)}
                      className="py-2.5 rounded-xl border border-border bg-cream-50 hover:bg-cream-100 text-xs font-bold text-brand-brown-dark transition-colors"
                    >
                      Rs. 3,000
                    </button>
                    <button
                      type="button"
                      onClick={() => setCashQuickPreset(5000)}
                      className="py-2.5 rounded-xl border border-border bg-cream-50 hover:bg-cream-100 text-xs font-bold text-brand-brown-dark transition-colors"
                    >
                      Rs. 5,000
                    </button>
                    <button
                      type="button"
                      onClick={() => setCashQuickPreset(10000)}
                      className="py-2.5 rounded-xl border border-border bg-cream-50 hover:bg-cream-100 text-xs font-bold text-brand-brown-dark transition-colors"
                    >
                      Rs. 10,000
                    </button>
                  </div>
                </div>

                {/* Change Due Display */}
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between shadow-xs">
                  <div>
                    <div className="text-[11px] font-black uppercase text-emerald-800 tracking-wider">
                      CHANGE DUE
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-emerald-700 tabular-nums mt-0.5">
                      {formatLKR(changeCents)}
                    </div>
                  </div>
                  <CheckCircle2 className="w-8 h-8 text-emerald-600/60" />
                </div>
              </div>

              {/* Right: Tactile Touch Numpad & USB Physical Keypad Support */}
              <div className="bg-cream-50/80 p-4 rounded-3xl border border-border flex flex-col justify-between gap-2.5">
                <div className="grid grid-cols-3 gap-2">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleNumpad(num)}
                      className="h-12 bg-white rounded-2xl border border-border/80 shadow-xs font-black text-xl text-brand-brown-dark hover:bg-cream-100 active:scale-95 transition-all"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleNumpad('00')}
                    className="h-12 bg-white rounded-2xl border border-border/80 shadow-xs font-black text-base text-brand-brown-dark hover:bg-cream-100 active:scale-95 transition-all"
                  >
                    00
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNumpad('0')}
                    className="h-12 bg-white rounded-2xl border border-border/80 shadow-xs font-black text-xl text-brand-brown-dark hover:bg-cream-100 active:scale-95 transition-all"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNumpad('.')}
                    className="h-12 bg-white rounded-2xl border border-border/80 shadow-xs font-black text-xl text-brand-brown-dark hover:bg-cream-100 active:scale-95 transition-all"
                  >
                    .
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleNumpad('BACKSPACE')}
                    className="h-11 bg-cream-200 hover:bg-cream-300 rounded-xl border border-cream-300 flex items-center justify-center gap-1.5 text-xs font-black text-brand-brown active:scale-95 transition-all"
                  >
                    <Delete className="w-4 h-4" />
                    <span>Backspace</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNumpad('CLEAR')}
                    className="h-11 bg-white hover:bg-rose-50 rounded-xl border border-rose-200 text-xs font-black text-rose-600 active:scale-95 transition-all"
                  >
                    Clear Amount
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2. CARD PAYMENT SCREEN */}
          {paymentMethod === 'CARD' && (
            <div className="max-w-md mx-auto space-y-5 text-center py-6">
              <div className="w-18 h-18 rounded-3xl bg-brand-teal-light text-brand-teal flex items-center justify-center mx-auto shadow-sm">
                <CreditCard className="w-9 h-9 stroke-[2]" />
              </div>
              <div>
                <h3 className="font-black text-base sm:text-lg text-brand-brown-dark">
                  Swipe / Tap Card on POS Terminal
                </h3>
                <p className="text-xs text-text-secondary mt-1">
                  Card payments are tracked digitally and do not affect the physical cash drawer float.
                </p>
              </div>
              <div className="text-left space-y-1.5 pt-2">
                <label className="text-xs font-extrabold uppercase text-text-secondary">
                  Optional Card Auth / Slip Reference #
                </label>
                <input
                  type="text"
                  placeholder="e.g. VISA-9842"
                  value={cardRef}
                  onChange={(e) => setCardRef(e.target.value)}
                  className="w-full px-4 py-2.5 bg-cream-50 border border-border rounded-xl font-mono text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand-teal/40"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* 3. SPLIT PAYMENT SCREEN */}
          {paymentMethod === 'SPLIT' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
              {/* Left Column: Selectable Split Input Cards & Helpers */}
              <div className="space-y-3.5">
                {/* Cash Split Field Card */}
                <div
                  onClick={() => selectSplitField('cash')}
                  className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                    activeSplitField === 'cash'
                      ? 'border-brand-teal bg-white shadow-sm ring-2 ring-brand-teal/20'
                      : 'border-border bg-cream-50/70 hover:bg-cream-100/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                      <Banknote className="w-4 h-4 text-brand-teal" /> Cash Tender
                    </span>
                    {activeSplitField === 'cash' && (
                      <span className="text-[10px] font-black uppercase text-brand-teal bg-brand-teal-light px-2 py-0.5 rounded-md">
                        Active Editing
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-sm font-bold text-text-secondary">Rs.</span>
                    <input
                      id="split-cash-input"
                      type="text"
                      placeholder="0.00"
                      value={formatCommaInput(splitCashRupees)}
                      onChange={(e) => setSplitCashRupees(e.target.value.replace(/,/g, ''))}
                      onFocus={() => setActiveSplitField('cash')}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      className="w-full text-right font-black text-2xl text-brand-brown-dark bg-transparent tabular-nums focus:outline-none"
                    />
                  </div>
                </div>

                {/* Card Split Field Card */}
                <div
                  onClick={() => selectSplitField('card')}
                  className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                    activeSplitField === 'card'
                      ? 'border-brand-teal bg-white shadow-sm ring-2 ring-brand-teal/20'
                      : 'border-border bg-cream-50/70 hover:bg-cream-100/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-brand-orange" /> Card Tender
                    </span>
                    {activeSplitField === 'card' && (
                      <span className="text-[10px] font-black uppercase text-brand-teal bg-brand-teal-light px-2 py-0.5 rounded-md">
                        Active Editing
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-sm font-bold text-text-secondary">Rs.</span>
                    <input
                      id="split-card-input"
                      type="text"
                      placeholder="0.00"
                      value={formatCommaInput(splitCardRupees)}
                      onChange={(e) => setSplitCardRupees(e.target.value.replace(/,/g, ''))}
                      onFocus={() => setActiveSplitField('card')}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      className="w-full text-right font-black text-2xl text-brand-brown-dark bg-transparent tabular-nums focus:outline-none"
                    />
                  </div>
                </div>

                {/* Quick Split Helpers */}
                <div>
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-text-secondary">
                    Quick Split Actions
                  </label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button
                      type="button"
                      onClick={handleSplit5050}
                      className="py-2.5 px-3 rounded-xl border border-brand-teal/40 bg-brand-teal-light hover:bg-brand-teal hover:text-white text-xs font-black text-brand-teal transition-all active:scale-95 text-center shadow-xs"
                    >
                      50 / 50 Split
                    </button>
                    <button
                      type="button"
                      onClick={handleFillSplitBalance}
                      className="py-2.5 px-3 rounded-xl border border-border bg-cream-50 hover:bg-cream-100 text-xs font-bold text-brand-brown-dark transition-all active:scale-95 text-center shadow-xs"
                    >
                      {activeSplitField === 'card' ? 'Fill Balance to Card' : 'Fill Balance to Cash'}
                    </button>
                  </div>
                </div>

                {/* Split Balance Summary */}
                {(() => {
                  const c = rupeesToCents(splitCashRupees || '0');
                  const cr = rupeesToCents(splitCardRupees || '0');
                  const sum = c + cr;
                  const remaining = totalCents - sum;

                  return (
                    <div
                      className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between shadow-xs ${
                        remaining === 0
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : remaining > 0
                          ? 'bg-amber-50 border-amber-200 text-amber-800'
                          : 'bg-rose-50 border-rose-200 text-rose-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {remaining === 0 && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                        <span>
                          {remaining === 0
                            ? 'Exact Match Allocated'
                            : remaining > 0
                            ? 'Remaining to allocate:'
                            : 'Over allocated:'}
                        </span>
                      </div>
                      <span className="tabular-nums font-black text-sm sm:text-base">
                        {formatLKR(Math.abs(remaining))}
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* Right Column: Interactive Numpad */}
              <div className="p-4 bg-cream-50/70 rounded-3xl border border-border/80 flex flex-col justify-between space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleNumpad(num.toString())}
                      className="h-12 bg-white rounded-2xl border border-border/80 shadow-xs font-black text-xl text-brand-brown-dark hover:bg-cream-100 active:scale-95 transition-all"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleNumpad('00')}
                    className="h-12 bg-white rounded-2xl border border-border/80 shadow-xs font-black text-base text-brand-brown-dark hover:bg-cream-100 active:scale-95 transition-all"
                  >
                    00
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNumpad('0')}
                    className="h-12 bg-white rounded-2xl border border-border/80 shadow-xs font-black text-xl text-brand-brown-dark hover:bg-cream-100 active:scale-95 transition-all"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNumpad('.')}
                    className="h-12 bg-white rounded-2xl border border-border/80 shadow-xs font-black text-xl text-brand-brown-dark hover:bg-cream-100 active:scale-95 transition-all"
                  >
                    .
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleNumpad('BACKSPACE')}
                    className="h-11 bg-cream-200 hover:bg-cream-300 rounded-xl border border-cream-300 flex items-center justify-center gap-1.5 text-xs font-black text-brand-brown active:scale-95 transition-all"
                  >
                    <Delete className="w-4 h-4" />
                    <span>Backspace</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNumpad('CLEAR')}
                    className="h-11 bg-white hover:bg-rose-50 rounded-xl border border-rose-200 text-xs font-black text-rose-600 active:scale-95 transition-all"
                  >
                    Clear Amount
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-cream-50 border-t border-border/80 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-5 py-3 rounded-2xl border border-border text-xs font-black text-text-secondary hover:bg-cream-200 transition-colors"
          >
            Back to Order
          </button>

          <button
            id="complete-payment-button"
            onClick={handleCompletePayment}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-brand-teal hover:bg-brand-teal-dark text-white font-black text-sm sm:text-base shadow-teal transition-all active:scale-[0.98]"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>COMPLETE PAYMENT</span>
            <span className="opacity-60">•</span>
            <span className="tabular-nums">{formatLKR(totalCents)}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
