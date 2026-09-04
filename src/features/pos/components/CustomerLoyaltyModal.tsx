import React, { useState, useMemo, useEffect } from 'react';
import { Customer, SystemSettings } from '@/types';
import { customerService } from '@/services/customerService';
import { db } from '@/services/storage/db';
import {
  X,
  Phone,
  Coins,
  UserCheck,
  UserPlus,
  Gift,
  RefreshCw,
  CornerDownLeft,
} from 'lucide-react';
import { toast } from 'sonner';

export const LoyaltyExchangeIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Left Coin (Star) */}
    <circle cx="18" cy="24" r="12" stroke="#B45309" strokeWidth="2.2" fill="#FEF3C7" />
    <path
      d="M18 17L19.8 20.8L24 21.3L21 24.2L21.7 28.5L18 26.3L14.3 28.5L15 24.2L12 21.3L16.2 20.8L18 17Z"
      fill="#D97706"
      stroke="#B45309"
      strokeWidth="1"
      strokeLinejoin="round"
    />

    {/* Right Coin (Currency / Rs) */}
    <circle cx="30" cy="24" r="12" stroke="#047857" strokeWidth="2.2" fill="#DCFCE7" />
    <text
      x="30"
      y="28"
      textAnchor="middle"
      fontSize="12"
      fontWeight="900"
      fill="#047857"
      fontFamily="sans-serif"
    >
      Rs
    </text>

    {/* Top Curved Arrow */}
    <path
      d="M16 9C21 6 27 6 32 9"
      stroke="#D97706"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
    <path
      d="M32 5.5V9.5H28"
      stroke="#D97706"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />

    {/* Bottom Curved Arrow */}
    <path
      d="M32 39C27 42 21 42 16 39"
      stroke="#047857"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
    <path
      d="M16 42.5V38.5H20"
      stroke="#047857"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

interface CustomerLoyaltyModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderTotalCents: number;
  subtotalCents: number;
  currentCustomer?: {
    id?: string;
    name: string;
    phone: string;
    pointsRedeemed?: number;
    discountCents?: number;
  } | null;
  onSelectCustomer: (customer: Customer, pointsToRedeem?: number, discountCents?: number) => void;
  onRemoveCustomer?: () => void;
}

export const CustomerLoyaltyModal: React.FC<CustomerLoyaltyModalProps> = ({
  isOpen,
  onClose,
  orderTotalCents,
  subtotalCents,
  currentCustomer,
  onSelectCustomer,
  onRemoveCustomer,
}) => {
  const [settings, setSettings] = useState<SystemSettings>(() => db.getSnapshot().settings);
  const [searchPhone, setSearchPhone] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  // Quick Register Form State
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [regName, setRegName] = useState<string>('');
  const [regPhone, setRegPhone] = useState<string>('');
  const [regEmail, setRegEmail] = useState<string>('');
  const [regBirthday, setRegBirthday] = useState<string>('');

  // Sync settings when modal opens
  useEffect(() => {
    if (isOpen) {
      const snap = db.getSnapshot();
      setSettings(snap.settings);

      if (currentCustomer?.phone) {
        const found = customerService.getCustomerByPhone(currentCustomer.phone);
        if (found) {
          setSelectedCustomer(found);
          setSearchPhone(found.phone);
          setHasSearched(true);
        } else {
          setSearchPhone(currentCustomer.phone);
          setHasSearched(true);
        }
      } else {
        setSelectedCustomer(null);
        setSearchPhone('');
        setHasSearched(false);
        setIsRegistering(false);
      }
    }
  }, [isOpen, currentCustomer]);

  // Search STRICTLY by Phone Number
  const exactCustomer = useMemo(() => {
    const raw = searchPhone.trim();
    if (!raw || raw.length < 3) return null;
    const clean = raw.replace(/\D/g, '');
    const all = db.getSnapshot().customers || [];
    return (
      all.find((c) => {
        const cClean = c.phone.replace(/\D/g, '');
        if (!cClean) return false;
        return (
          cClean === clean ||
          c.phone === raw ||
          (clean.length >= 7 && (cClean.endsWith(clean) || clean.endsWith(cClean)))
        );
      }) || null
    );
  }, [searchPhone]);

  // Active customer in focus
  const activeCustomer = selectedCustomer || exactCustomer;

  // Loyalty Settings Calculations
  const pointValueCents = settings.loyaltyPointRedemptionValueCents || 100; // 100 cents = Rs 1.00
  const minPointsToRedeem = settings.loyaltyMinPointsToRedeem || 50;
  const maxRedeemPercent = settings.loyaltyMaxRedemptionPercentPerOrder || 50;
  const spendPerPt = settings.loyaltySpendPerPointCents || 10000;
  const minSpendToEarn = settings.loyaltyMinSpendToEarnCents || 0;

  // Max points eligible to redeem on this specific order
  const maxRedeemableDiscountCents = Math.floor(orderTotalCents * (maxRedeemPercent / 100));
  const maxPointsByBill = Math.floor(maxRedeemableDiscountCents / (pointValueCents || 100));
  const maxRedeemablePoints = activeCustomer
    ? Math.min(activeCustomer.points, maxPointsByBill)
    : 0;

  const canRedeem =
    (settings.loyaltyProgramEnabled ?? true) &&
    activeCustomer &&
    activeCustomer.points >= minPointsToRedeem &&
    maxRedeemablePoints > 0;

  // Estimated points earned on this order
  const estimatedEarnedPoints = useMemo(() => {
    if (!(settings.loyaltyProgramEnabled ?? true)) return 0;
    if (orderTotalCents < minSpendToEarn) return 0;
    if (spendPerPt <= 0) return 0;
    return Math.floor(orderTotalCents / spendPerPt);
  }, [orderTotalCents, settings, spendPerPt, minSpendToEarn]);

  // Direct 1-Click: Redeem Max Points & Link
  const handleDirectRedeem = (cust: Customer) => {
    const redeemPts = maxRedeemablePoints;
    const discCents = redeemPts * pointValueCents;
    onSelectCustomer(cust, redeemPts, discCents);
    toast.success(`Redeemed ${redeemPts} points (-Rs. ${(discCents / 100).toFixed(2)}) for ${cust.name}!`);
    onClose();
  };

  // Direct 1-Click: Continue Without Redeeming & Link
  const handleDirectContinue = (cust: Customer) => {
    onSelectCustomer(cust, 0, 0);
    toast.success(`Linked ${cust.name} to earn +${estimatedEarnedPoints} points!`);
    onClose();
  };

  // Handle Quick Registration
  const handleRegisterCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim()) {
      toast.error('Customer name is required');
      return;
    }
    if (!regPhone.trim()) {
      toast.error('Customer phone number is required');
      return;
    }

    const welcomeBonus = settings.loyaltySignupBonusPoints ?? 25;
    const newCust = customerService.saveCustomer({
      name: regName.trim(),
      phone: regPhone.trim(),
      email: regEmail.trim(),
      birthday: regBirthday,
      tier: 'BRONZE',
      points: welcomeBonus,
      notes: 'Registered at POS Counter during checkout',
    });

    toast.success(`Profile created! +${welcomeBonus} Welcome Points credited to ${newCust.name}!`);
    setSelectedCustomer(newCust);
    setIsRegistering(false);
    onSelectCustomer(newCust, 0, 0);
    onClose();
  };

  // Handle Enter Search
  const handlePerformSearch = () => {
    setHasSearched(true);
    if (!searchPhone.trim()) {
      toast.error('Please enter a phone number');
      return;
    }
    if (exactCustomer) {
      setSelectedCustomer(exactCustomer);
      setIsRegistering(false);
      toast.success(`Found member: ${exactCustomer.name}`);
    } else {
      setSelectedCustomer(null);
      toast.info(`No customer found for ${searchPhone}. You can quick-register below.`);
    }
  };

  // Standard Numpad Handler
  const handleNumpad = (char: string) => {
    if (char === 'CLEAR') {
      setSearchPhone('');
      setSelectedCustomer(null);
      setIsRegistering(false);
      setHasSearched(false);
    } else if (char === 'BACKSPACE') {
      setSearchPhone((prev) => prev.slice(0, -1));
      setSelectedCustomer(null);
      setIsRegistering(false);
    } else if (char === 'ENTER') {
      handlePerformSearch();
    } else {
      setSearchPhone((prev) => `${prev}${char}`);
      setSelectedCustomer(null);
      setIsRegistering(false);
    }
  };

  // Isolated Keyboard listener for Loyalty Modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();

        if (isRegistering) {
          if (regName.trim() && regPhone.trim()) {
            handleRegisterCustomer({ preventDefault: () => {} } as React.FormEvent);
          }
          return;
        }

        if (activeCustomer) {
          // If customer is found and shown, Enter triggers Continue and closes loyalty popup only
          handleDirectContinue(activeCustomer);
        } else {
          // Otherwise performs lookup
          handlePerformSearch();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [
    isOpen,
    isRegistering,
    activeCustomer,
    regName,
    regPhone,
    handleDirectContinue,
    handlePerformSearch,
    handleRegisterCustomer,
    onClose,
  ]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-brand-brown-deep/80 backdrop-blur-sm overflow-y-auto animate-in fade-in">
      <div className="relative w-full max-w-3xl lg:max-w-4xl my-auto animate-in zoom-in-95">
        {/* Top Floating Title & Close Button Bar */}
        <div className="flex items-center justify-between gap-4 mb-3 sm:mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white drop-shadow-sm">
              Customer Loyalty &amp; Rewards
            </h1>
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

        {/* Modal Card (Pure White Surface with NO internal header) */}
        <div className="bg-white rounded-3xl sm:rounded-[32px] shadow-2xl border border-[#E9E0D5] p-6 sm:p-8 lg:p-9 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-7 sm:gap-9 items-stretch">
            {/* ========================================================================= */}
            {/* LEFT COLUMN: Large Brand Logo / Customer Profile Card / Register Form     */}
            {/* ========================================================================= */}
            <div className="md:col-span-6 flex flex-col justify-between items-center min-h-[360px] sm:min-h-[420px]">
              {/* STATE A: NO RECORD FOUND / WAITING -> LARGE CLEAN BRAND LOGO */}
              {!activeCustomer && !isRegistering && (!hasSearched || searchPhone.trim().length < 3) && (
                <div className="flex-1 flex flex-col items-center justify-center py-4 animate-in fade-in my-auto">
                  <img
                    src="/logobg.webp"
                    alt="Chill & Choc"
                    className="w-48 h-48 sm:w-60 sm:h-60 lg:w-64 lg:h-64 object-contain opacity-90 select-none pointer-events-none drop-shadow-sm"
                  />
                  <p className="text-xs text-text-muted font-bold mt-2 text-center">
                    Enter customer phone number &amp; press Enter
                  </p>
                </div>
              )}

              {/* STATE B: CUSTOMER FOUND -> PROFILE CARD & REDEEM / CONTINUE BUTTONS */}
              {activeCustomer && (
                <div className="w-full flex flex-col justify-between h-full animate-in fade-in zoom-in-95">
                  {/* Profile Card at Top */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF7F2] border border-[#E0D7CC] space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-base sm:text-lg text-brand-brown-dark">
                            {activeCustomer.name}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-[#EAE3DA] text-brand-brown-dark text-[11px] font-black uppercase tracking-wide">
                            {activeCustomer.tier}
                          </span>
                        </div>
                        <div className="text-xs sm:text-sm text-text-muted font-mono mt-0.5">{activeCustomer.phone}</div>
                      </div>

                      <div className="text-right">
                        <div className="text-lg sm:text-xl font-black text-brand-brown-dark font-mono">
                          {activeCustomer.points}{' '}
                          <span className="text-xs font-bold text-text-muted">pts</span>
                        </div>
                        <div className="text-xs text-text-muted font-medium">
                          (Rs. {(activeCustomer.points * (pointValueCents / 100)).toFixed(2)})
                        </div>
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-[#EAE3DA] flex items-center justify-between text-xs sm:text-sm">
                      <span className="text-text-muted">Points to earn (if continuing):</span>
                      <span className="font-black text-brand-brown-dark font-mono">
                        +{estimatedEarnedPoints} Points
                      </span>
                    </div>

                    {canRedeem && (
                      <div className="pt-2 border-t border-[#EAE3DA] flex items-center justify-between text-xs sm:text-sm">
                        <span className="text-emerald-800 font-bold">Eligible discount:</span>
                        <span className="font-black text-emerald-700 font-mono">
                          -Rs. {(maxRedeemableDiscountCents / 100).toFixed(2)} ({maxRedeemablePoints} pts)
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 1-CLICK ACTION BUTTONS PINNED TO BOTTOM */}
                  <div className="space-y-2.5 mt-auto pt-4">
                    {/* 1. REDEEM BUTTON */}
                    <button
                      type="button"
                      disabled={!canRedeem}
                      onClick={() => {
                        if (canRedeem) {
                          handleDirectRedeem(activeCustomer);
                        } else {
                          toast.error(`Customer needs at least ${minPointsToRedeem} points to redeem (Current: ${activeCustomer.points} pts)`);
                        }
                      }}
                      className={`w-full h-13 sm:h-14 rounded-2xl font-black text-sm sm:text-base transition-all flex items-center justify-center gap-2.5 active:scale-95 shadow-sm ${
                        canRedeem
                          ? 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer shadow-emerald ring-2 ring-emerald-500/20'
                          : 'bg-[#F5F2EC] text-zinc-400 border border-[#E0D7CC] cursor-not-allowed opacity-70'
                      }`}
                    >
                      <Coins className="w-5 h-5 shrink-0" />
                      <span>Redeem</span>
                    </button>

                    {/* 2. CONTINUE BUTTON */}
                    <button
                      type="button"
                      onClick={() => handleDirectContinue(activeCustomer)}
                      className="w-full h-13 sm:h-14 rounded-2xl bg-brand-brown-dark hover:bg-brand-brown text-white font-black text-sm sm:text-base transition-all flex items-center justify-center gap-2.5 cursor-pointer active:scale-95 shadow-sm"
                    >
                      <UserCheck className="w-5 h-5 shrink-0" />
                      <span>Continue</span>
                    </button>
                  </div>
                </div>
              )}

              {/* STATE C: CUSTOMER NOT FOUND -> OPTION TO REGISTER */}
              {!activeCustomer && searchPhone.trim().length >= 3 && hasSearched && !isRegistering && (
                <div className="w-full flex flex-col justify-between h-full animate-in fade-in py-2">
                  <div className="text-center space-y-2 my-auto">
                    <div className="text-base sm:text-lg font-black text-brand-brown-dark">
                      No member found for &ldquo;{searchPhone}&rdquo;
                    </div>
                    <p className="text-xs sm:text-sm text-text-muted">
                      Register this customer to accumulate loyalty points
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegistering(true);
                      setRegPhone(searchPhone.trim());
                    }}
                    className="w-full h-13 sm:h-14 rounded-2xl bg-brand-teal hover:bg-brand-teal-dark text-white text-sm sm:text-base font-black shadow-teal transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2 mt-auto"
                  >
                    <UserPlus className="w-5 h-5" />
                    <span>Quick Register Customer</span>
                  </button>
                </div>
              )}

              {/* STATE D: QUICK PROFILE CREATION FORM (Seamless, No Background, No Outer Border) */}
              {isRegistering && (
                <form
                  onSubmit={handleRegisterCustomer}
                  className="w-full flex flex-col justify-between h-full animate-in fade-in"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-1 border-b border-[#EAE3DA]">
                      <span className="font-black text-sm sm:text-base text-brand-brown-dark flex items-center gap-2">
                        <UserPlus className="w-4 h-4 text-brand-teal" />
                        <span>Quick Registration</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsRegistering(false)}
                        className="text-xs text-text-muted hover:text-brand-brown-dark font-bold cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-black uppercase tracking-wider text-text-muted block mb-1">
                          Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={regName}
                          onChange={(e) => setRegName(e.target.value)}
                          placeholder="e.g. Kasun Mendis"
                          className="w-full px-4 py-3 bg-white border-2 border-[#E0D7CC] rounded-2xl text-sm sm:text-base font-bold text-brand-brown-dark focus:border-brand-teal focus:ring-4 focus:ring-brand-teal/15 focus:outline-none transition-all"
                          autoFocus
                        />
                      </div>

                      <div>
                        <label className="text-xs font-black uppercase tracking-wider text-text-muted block mb-1">
                          Mobile Number *
                        </label>
                        <input
                          type="tel"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          required
                          value={regPhone}
                          onChange={(e) => setRegPhone(e.target.value.replace(/\D/g, ''))}
                          placeholder="077 123 4567"
                          className="w-full px-4 py-3 bg-white border-2 border-[#E0D7CC] rounded-2xl text-sm sm:text-base font-bold text-brand-brown-dark focus:border-brand-teal focus:ring-4 focus:ring-brand-teal/15 focus:outline-none transition-all font-mono"
                        />
                      </div>

                      <div className="p-3 rounded-2xl bg-[#FAF7F2] border border-[#EAE3DA] text-xs text-amber-900 font-medium flex items-center gap-2">
                        <Gift className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          +{settings.loyaltySignupBonusPoints || 25} Welcome Bonus Points credited!
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* BUTTONS PINNED TO BOTTOM */}
                  <div className="grid grid-cols-2 gap-3 mt-auto pt-4">
                    <button
                      type="button"
                      onClick={() => setIsRegistering(false)}
                      className="h-12 sm:h-13 rounded-2xl border border-[#D5C7B8] hover:bg-cream-100 text-brand-brown-dark font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      className="h-12 sm:h-13 rounded-2xl bg-brand-teal hover:bg-brand-teal-dark text-white font-black text-xs sm:text-sm shadow-teal transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Create &amp; Link</span>
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* ========================================================================= */}
            {/* RIGHT COLUMN: Phone Number Input on Top + Tactile Circular Number Pad    */}
            {/* ========================================================================= */}
            <div className="md:col-span-6 space-y-4 flex flex-col justify-center items-center">
              {/* Phone Number Input on Top of Number Pad */}
              <div className="w-full max-w-[260px] sm:max-w-[300px]">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-black uppercase text-text-muted tracking-wider block">
                    Phone Number
                  </label>

                  {activeCustomer && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(null);
                        setSearchPhone('');
                        setHasSearched(false);
                      }}
                      className="text-xs text-brand-teal font-black hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Change</span>
                    </button>
                  )}
                </div>

                <div className="relative flex items-center bg-white border-2 border-[#E0D7CC] rounded-2xl focus-within:border-brand-teal focus-within:ring-4 focus-within:ring-brand-teal/15 transition-all shadow-2xs">
                  <span className="pl-3.5 text-text-muted">
                    <Phone className="w-4 h-4 sm:w-5 sm:h-5" />
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={searchPhone}
                    onChange={(e) => {
                      const cleanDigits = e.target.value.replace(/\D/g, '');
                      setSearchPhone(cleanDigits);
                      setSelectedCustomer(null);
                      setIsRegistering(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        handlePerformSearch();
                        return;
                      }
                      // Allow navigation & control keys
                      if (
                        [
                          'Backspace',
                          'Delete',
                          'ArrowLeft',
                          'ArrowRight',
                          'Tab',
                          'Escape',
                        ].includes(e.key) ||
                        e.ctrlKey ||
                        e.metaKey
                      ) {
                        return;
                      }
                      // Block non-digit characters
                      if (!/^[0-9]$/.test(e.key)) {
                        e.preventDefault();
                      }
                    }}
                    placeholder="Enter phone..."
                    className="w-full pl-2.5 pr-14 py-3 sm:py-3.5 bg-transparent font-mono font-black text-xl sm:text-2xl text-brand-brown-dark placeholder:text-text-muted/60 focus:outline-none"
                    autoFocus
                  />
                  {searchPhone && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchPhone('');
                        setSelectedCustomer(null);
                        setIsRegistering(false);
                        setHasSearched(false);
                      }}
                      className="absolute inset-y-0 right-3.5 flex items-center text-text-muted hover:text-brand-brown-dark text-xs font-bold cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Circular 3x4 Grid (7 8 9 / 4 5 6 / 1 2 3 / Clear 0 Enter) */}
              <div className="grid grid-cols-3 gap-3 sm:gap-4 justify-items-center">
                {['7', '8', '9', '4', '5', '6', '1', '2', '3', 'Clear', '0', 'Enter'].map((key) => {
                  const isClear = key === 'Clear';
                  const isEnter = key === 'Enter';

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleNumpad(isClear ? 'CLEAR' : isEnter ? 'ENTER' : key)}
                      className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center font-bold transition-all active:scale-95 cursor-pointer shadow-2xs ${
                        isEnter
                          ? 'bg-brand-teal text-white hover:bg-brand-teal-dark shadow-teal text-xs sm:text-sm font-black flex flex-col gap-0.5'
                          : isClear
                          ? 'border border-[#D5C7B8] bg-white text-red-700 text-xs sm:text-sm font-black hover:bg-red-50'
                          : 'border border-[#D5C7B8] bg-white text-2xl sm:text-3xl text-brand-brown-dark hover:bg-cream-100'
                      }`}
                    >
                      {isEnter ? (
                        <>
                          <CornerDownLeft className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                          <span>Enter</span>
                        </>
                      ) : (
                        key
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Backspace Pill Button */}
              <div className="w-full max-w-[240px] sm:max-w-[280px] pt-0.5">
                <button
                  type="button"
                  onClick={() => handleNumpad('BACKSPACE')}
                  className="w-full h-12 sm:h-13 rounded-full border border-[#D5C7B8] bg-white text-xs sm:text-sm font-bold text-brand-brown-dark hover:bg-cream-100 active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                >
                  <span>⌫</span>
                  <span>Backspace</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
