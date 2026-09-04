import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Order, ReceiptCustomizationSettings, SystemSettings } from '@/types';
import { db } from '@/services/storage/db';
import { receiptSocketService } from '@/services/receiptSocketService';
import { formatLKR, formatDateTime } from '@/utils/format';
import { Printer, CheckCircle2, X, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { printThermalElement } from '@/utils/printThermal';
import { directPrintService } from '@/services/directPrintService';

interface ThermalReceiptModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  autoPrint?: boolean;
}

export const ThermalReceiptModal: React.FC<ThermalReceiptModalProps> = ({
  order,
  isOpen,
  onClose,
  autoPrint = false,
}) => {
  const [settings, setSettings] = useState<SystemSettings>(() => db.getSnapshot().settings);
  const [receiptCustom, setReceiptCustom] = useState<ReceiptCustomizationSettings | undefined>(
    () => db.getSnapshot().settings.receiptCustomization
  );

  useEffect(() => {
    // 1. Listen to real-time WebSocket receipt design updates
    const unsubSocket = receiptSocketService.subscribeReceiptUpdates((newCustom) => {
      setReceiptCustom(newCustom);
      setSettings((prev) => ({
        ...prev,
        businessName: newCustom.businessName !== undefined ? newCustom.businessName : prev.businessName,
        tagline: newCustom.tagline !== undefined ? newCustom.tagline : prev.tagline,
        address: newCustom.address !== undefined ? newCustom.address : prev.address,
        phone: newCustom.phone !== undefined ? newCustom.phone : prev.phone,
        receiptFooter: newCustom.receiptFooter !== undefined ? newCustom.receiptFooter : prev.receiptFooter,
        receiptCustomization: newCustom,
      }));
    });

    // 2. Listen to database changes synced via Supabase Realtime
    const unsubDb = db.subscribe(() => {
      const snap = db.getSnapshot().settings;
      setSettings(snap);
      if (snap.receiptCustomization) {
        setReceiptCustom(snap.receiptCustomization);
      }
    });

    return () => {
      unsubSocket();
      unsubDb();
    };
  }, []);

  // Whenever modal opens, immediately refresh latest settings from local storage & memory
  useEffect(() => {
    if (isOpen) {
      db.syncFromStorage();
      const snap = db.getSnapshot().settings;
      setSettings(snap);
      if (snap.receiptCustomization) {
        setReceiptCustom(snap.receiptCustomization);
      }
    }
  }, [isOpen]);

  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = async () => {
    if (isPrinting || !order) return;
    setIsPrinting(true);
    try {
      if (directPrintService.isEnabled()) {
        const res = await directPrintService.printCustomerReceipt(order, { forceReprint: true });
        if (res.success) {
          toast.success(`Printed directly to ${directPrintService.getSelectedPrinter()}!`, { icon: '🖨️' });
          return;
        }
        toast.info(`Direct printer unavailable (${res.message || 'offline'}). Opening standard print.`);
      }
      // Automatic fallback to browser print dialog
      printThermalElement('printable-receipt');
    } catch (err) {
      console.warn('Direct print error, falling back to browser print:', err);
      printThermalElement('printable-receipt');
    } finally {
      setIsPrinting(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handlePrint();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !order || !autoPrint) return;
    // Only auto-trigger browser iframe print if direct printing is DISABLED and autoPrint is explicitly requested
    if (settings.autoPrintReceipt && !settings.directPrintEnabled) {
      const t = setTimeout(() => {
        printThermalElement('printable-receipt');
      }, 400);
      return () => clearTimeout(t);
    }
  }, [isOpen, order, autoPrint, settings.autoPrintReceipt, settings.directPrintEnabled]);

  if (!isOpen || !order || typeof document === 'undefined') return null;

  const handleCopy = () => {
    const lines = [
      settings.businessName,
      settings.tagline,
      settings.address,
      `Order: ${order.orderNumber}`,
      `Date: ${formatDateTime(order.createdAt)}`,
      `Cashier: ${order.cashierName}`,
      '--------------------------------',
      ...order.items.map((i) => `${i.quantity}x ${i.name} - ${formatLKR(i.itemTotalCents)}`),
      '--------------------------------',
      `TOTAL: ${formatLKR(order.totalCents)}`,
      `Paid: ${order.paymentMethod}`,
    ].join('\n');

    navigator.clipboard.writeText(lines);
    toast.success('Receipt text copied to clipboard.');
  };

  const custom = receiptCustom || settings.receiptCustomization;
  const displayBusinessName =
    custom?.businessName !== undefined ? custom.businessName : settings.businessName;
  const displayTagline =
    custom?.tagline !== undefined ? custom.tagline : settings.tagline;
  const displayAddress =
    custom?.address !== undefined ? custom.address : settings.address;
  const displayPhone =
    custom?.phone !== undefined ? custom.phone : settings.phone;

  const showLogo = custom ? custom.showLogo : true;
  const logoUrl = custom?.logoUrl || '/logobg.webp';
  const logoWidthPx = custom?.logoWidthPx || 95;
  const logoAlignment = custom?.logoAlignment || 'center';
  const headerAlignment = custom?.headerAlignment || 'center';
  const dividerClass = custom?.dividerStyle === 'double'
    ? 'border-b-2 border-zinc-900'
    : custom?.dividerStyle === 'dotted'
    ? 'border-b border-dotted border-zinc-400'
    : custom?.dividerStyle === 'solid'
    ? 'border-b border-zinc-400'
    : 'border-b border-dashed border-zinc-400';
  const paperWidthClass = custom?.paperWidthMm === 58 ? 'max-w-[280px]' : 'max-w-[340px] sm:max-w-[360px]';

  const getHeading1Class = () => {
    const size =
      custom?.heading1Size === 'small'
        ? 'text-sm sm:text-base'
        : custom?.heading1Size === 'large'
        ? 'text-lg sm:text-xl'
        : custom?.heading1Size === 'xlarge'
        ? 'text-xl sm:text-2xl'
        : 'text-base sm:text-lg';
    const weight = custom?.heading1Bold !== false ? 'font-black' : 'font-normal';
    return `${size} ${weight}`;
  };

  const getHeading2Class = () => {
    const size =
      custom?.heading2Size === 'small'
        ? 'text-[11px]'
        : custom?.heading2Size === 'large'
        ? 'text-sm'
        : 'text-xs';
    const weight = custom?.heading2Bold !== false ? 'font-black' : 'font-normal';
    return `${size} ${weight}`;
  };

  const getHeading3Class = () => {
    const size =
      custom?.heading3Size === 'small'
        ? 'text-[11px]'
        : custom?.heading3Size === 'large'
        ? 'text-[13px]'
        : 'text-xs';
    const weight = custom?.heading3Bold !== false ? 'font-bold' : 'font-normal';
    return `${size} ${weight}`;
  };

  const fontStyle = {
    fontFamily:
      custom?.fontFamily === 'courier'
        ? 'Courier New, monospace'
        : custom?.fontFamily === 'sans'
        ? 'Inter, system-ui, sans-serif'
        : 'JetBrains Mono, monospace',
  };

  return createPortal(
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[999999] w-full h-full overflow-y-auto bg-black/75 backdrop-blur-md flex flex-col items-center justify-start p-4 py-8 sm:p-6 sm:py-10 animate-in fade-in"
    >
      {/* Floating Top-Right Close Button */}
      <button
        onClick={onClose}
        className="fixed top-3 right-3 sm:top-5 sm:right-5 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border border-white/20 shadow-lg transition-all active:scale-95 cursor-pointer z-50"
        title="Close Receipt (Esc)"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Centered Scrollable Wrapper */}
      <div className="w-full max-w-[380px] my-auto flex flex-col items-center">
        {/* Dynamic Thermal Paper Slip */}
        <div
          id="printable-receipt"
          style={fontStyle}
          className={`w-full ${paperWidthClass} bg-white rounded-3xl shadow-2xl p-6 sm:p-7 font-mono text-xs leading-relaxed text-zinc-900 tracking-[0.04em] sm:tracking-[0.06em] selection:bg-zinc-200 border border-white/30 select-text shrink-0`}
        >
          {/* Logo Header */}
          {showLogo && logoUrl && (
            <div
              style={{
                position: 'relative',
                top: `${-(custom?.logoOffsetYPx ?? 0)}px`,
                paddingBottom: '10px',
              }}
              className={`flex transition-transform duration-150 ${logoAlignment === 'left' ? 'justify-start' : 'justify-center'}`}
            >
              <img
                src={logoUrl}
                alt="Logo"
                style={{ width: `${logoWidthPx}px` }}
                className="object-contain max-h-48 h-auto"
              />
            </div>
          )}

          {/* Receipt Brand Header */}
          <div className={`pb-3 ${dividerClass} ${headerAlignment === 'left' ? 'text-left' : 'text-center'}`}>
            {displayBusinessName && displayBusinessName.trim() !== '' && (
              <h2 className={`tracking-wider text-zinc-950 ${getHeading1Class()}`}>
                {displayBusinessName.toUpperCase()}
              </h2>
            )}
            {displayTagline && displayTagline.trim() !== '' && (
              <p className="text-[10px] text-zinc-600 uppercase font-semibold mt-0.5">
                {displayTagline}
              </p>
            )}
            {displayAddress && displayAddress.trim() !== '' && (
              <p className="text-[10px] text-zinc-500 mt-1">{displayAddress}</p>
            )}
            {displayPhone && displayPhone.trim() !== '' && (
              <p className="text-[10px] text-zinc-500">Tel: {displayPhone}</p>
            )}
          </div>

          {/* Order Meta Info */}
          <div className={`py-2.5 ${dividerClass} text-[11px] space-y-0.5`}>
            <div className="flex justify-between items-center">
              <span className={`text-zinc-950 ${getHeading2Class()}`}>
                {custom?.orderNumberPrefix || 'Order: #'} {order.orderNumber.replace('#', '')}
              </span>
              {(custom?.showOrderType ?? true) && (
                <span className="uppercase font-extrabold text-[10px] bg-zinc-100 text-zinc-800 px-1.5 py-0.5 rounded">
                  {order.orderType === 'DINE_IN' ? 'Dine In' : 'Takeaway'}
                </span>
              )}
            </div>
            {(custom?.showTableNumber ?? true) && order.tableNumber && (
              <div className="flex justify-between text-zinc-700">
                <span>Table Number:</span>
                <span className={`text-zinc-950 ${getHeading3Class()}`}>Table {order.tableNumber}</span>
              </div>
            )}
            {(custom?.showDateTime ?? true) && (
              <div className="flex justify-between text-zinc-600 text-[10px]">
                <span>Date:</span>
                <span>{formatDateTime(order.createdAt)}</span>
              </div>
            )}
          </div>

          {/* Purchased Line Items */}
          <div className={`py-2.5 ${dividerClass} space-y-2 text-xs`}>
            <div className={`flex justify-between uppercase tracking-wider pb-1 border-b border-zinc-200 text-zinc-500 ${getHeading2Class()}`}>
              <span>ITEM</span>
              <span>TOTAL (Rs)</span>
            </div>
            {order.items.map((item, idx) => (
              <div key={idx} className="space-y-0.5">
                <div className={`flex justify-between items-start gap-2 text-zinc-950 ${getHeading3Class()}`}>
                  <span className="flex-1">
                    {item.quantity}x {item.name}
                  </span>
                  <span className={`tabular-nums whitespace-nowrap text-right shrink-0 ${custom?.bodyBold ? 'font-bold' : 'font-semibold'}`}>
                    {(item.itemTotalCents / 100).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                {(custom?.showModifiers ?? true) &&
                  item.modifiers.map((mod, mIdx) => (
                    <div key={mIdx} className="text-[10px] text-zinc-600 pl-3 flex justify-between gap-2">
                      <span>+ {mod.optionName}</span>
                      {(custom?.showModifierPrices ?? true) && mod.priceCents > 0 && (
                        <span className="tabular-nums whitespace-nowrap shrink-0 text-zinc-500">
                          {(mod.priceCents / 100).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      )}
                    </div>
                  ))}
                {(custom?.showItemNotes ?? true) && item.notes && (
                  <div className="text-[10px] italic text-zinc-500 pl-3">Note: {item.notes}</div>
                )}
              </div>
            ))}
          </div>

          {/* Financial Summary */}
          <div className={`py-2.5 ${custom?.dividerStyle === 'double' ? 'border-b-2 border-zinc-900' : dividerClass} space-y-1 text-[11px]`}>
            {(custom?.showSubtotal ?? true) && (
              <div className="flex justify-between text-zinc-600">
                <span>Subtotal:</span>
                <span className="tabular-nums">{formatLKR(order.subtotalCents)}</span>
              </div>
            )}
            {(() => {
              const loyaltyDisc = order.loyaltyDiscountCents || 0;
              const manualDisc = Math.max(0, (order.discountCents || 0) - loyaltyDisc);

              return (
                <>
                  {(custom?.showDiscount ?? true) && manualDisc > 0 && (
                    <div className="flex justify-between text-zinc-600">
                      <span>Discount:</span>
                      <span className="tabular-nums">-{formatLKR(manualDisc)}</span>
                    </div>
                  )}
                  {(custom?.showDiscount ?? true) && loyaltyDisc > 0 && (
                    <div className="flex justify-between text-zinc-600">
                      <span>Loyalty Discount:</span>
                      <span className="tabular-nums">-{formatLKR(loyaltyDisc)}</span>
                    </div>
                  )}
                </>
              );
            })()}
            {(custom?.showServiceCharge ?? true) && order.serviceChargeCents > 0 && (
              <div className="flex justify-between text-zinc-600">
                <span>Service Charge{settings?.serviceChargePercent ? ` (${settings.serviceChargePercent}%)` : ''}:</span>
                <span className="tabular-nums">+{formatLKR(order.serviceChargeCents)}</span>
              </div>
            )}
            {(custom?.showTax ?? true) && order.taxCents > 0 && (
              <div className="flex justify-between text-zinc-600">
                <span>{custom?.taxLabel || 'Tax'}:</span>
                <span className="tabular-nums">+{formatLKR(order.taxCents)}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-sm pt-1.5 border-t border-dashed border-zinc-400 text-zinc-950">
              <span>TOTAL:</span>
              <span className="tabular-nums">{formatLKR(order.totalCents)}</span>
            </div>
          </div>

          {/* Payment Details */}
          <div className={`py-2 ${dividerClass} text-[10px] space-y-0.5`}>
            {(custom?.showPaymentMethod ?? true) && (
              <div className="flex justify-between">
                <span>Payment Method:</span>
                <span className="font-bold uppercase text-zinc-900">{order.paymentMethod}</span>
              </div>
            )}
            {(custom?.showCashBreakdown ?? true) && order.paymentMethod === 'CASH' && order.cashReceivedCents && (
              <>
                <div className="flex justify-between">
                  <span>Cash Received:</span>
                  <span className="tabular-nums font-semibold">{formatLKR(order.cashReceivedCents)}</span>
                </div>
                <div className="flex justify-between font-bold text-zinc-900">
                  <span>Change Returned:</span>
                  <span className="tabular-nums">{formatLKR(order.changeGivenCents || 0)}</span>
                </div>
              </>
            )}
          </div>

          {/* Customer Name & Loyalty in Footer (Monochrome, No colors, Shows Total Points) */}
          {(custom?.showCustomerInfo ?? true) && (order.customerName || (order as any).customer?.name) && (() => {
            const cust = order.customerId
              ? db.getSnapshot().customers.find((c) => c.id === order.customerId)
              : order.customerPhone
              ? db.getSnapshot().customers.find((c) => c.phone === order.customerPhone)
              : order.customerName
              ? db.getSnapshot().customers.find((c) => c.name.toLowerCase() === order.customerName?.toLowerCase())
              : null;

            const hasRedeemed = !!(order.loyaltyPointsRedeemed && order.loyaltyPointsRedeemed > 0);
            const hasEarned = !!(order.loyaltyPointsEarned && order.loyaltyPointsEarned > 0);

            return (
              <div className="pt-2 text-center text-[10.5px] text-black font-mono space-y-0.5 select-text">
                <div>
                  <span className="uppercase font-semibold text-zinc-700">CUSTOMER: </span>
                  <span className="font-bold text-black">{order.customerName || (order as any).customer?.name}</span>
                </div>

                {hasRedeemed ? (
                  <div className="text-[10px] text-black font-mono font-medium">
                    <span>Redeemed: -{order.loyaltyPointsRedeemed} Pts</span>
                    {cust && <span> | Total Points: {cust.points} Pts</span>}
                  </div>
                ) : hasEarned ? (
                  <div className="text-[10px] text-black font-mono font-medium">
                    <span>Earned: +{order.loyaltyPointsEarned} Pts</span>
                    {cust && <span> | Total Points: {cust.points} Pts</span>}
                  </div>
                ) : cust ? (
                  <div className="text-[10px] text-black font-mono font-medium">
                    <span>Total Points: {cust.points} Pts</span>
                  </div>
                ) : null}
              </div>
            );
          })()}

          {/* Footer Message */}
          <div className="pt-1.5 pb-1 text-center text-[10px] text-zinc-600 whitespace-pre-line leading-normal">
            {custom?.receiptFooter || settings.receiptFooter}
          </div>

          {/* Wi-Fi Info */}
          {custom?.showWifiInfo && custom.wifiSsid && (
            <div className="pt-1 text-center text-[9px] text-zinc-500 font-mono">
              Wi-Fi: <span className="font-bold text-zinc-700">{custom.wifiSsid}</span>
              {custom.wifiPassword && ` | Pass: ${custom.wifiPassword}`}
            </div>
          )}

          {/* Built-in Developer Credits on Bottom of Receipt */}
          <div className="mt-3.5 pt-2.5 border-t border-dashed border-zinc-900 text-center select-text thermal-dev-footer">
            <div className="text-[11px] font-mono font-black text-black uppercase tracking-wider">
              DEVELOPED BY OGO TECHNOLOGY
            </div>
            <div className="text-[10px] font-mono font-bold text-black mt-0.5 tracking-tight flex items-center justify-center gap-1.5">
              <span>www.ogotechnology.net</span>
              <span>•</span>
              <span>+94 75 930 7059</span>
            </div>
          </div>
        </div>

        {/* Floating Action Buttons Below Slip */}
        <div className="flex items-center justify-center gap-3 mt-4 z-10 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-md text-xs sm:text-sm font-bold transition-all active:scale-95 border border-white/20 shadow-lg cursor-pointer"
          >
            Done
          </button>

          <button
            type="button"
            disabled={isPrinting}
            onClick={() => handlePrint()}
            className="flex items-center gap-2 px-7 py-2.5 rounded-full bg-brand-teal hover:bg-brand-teal-dark text-white text-xs sm:text-sm font-black shadow-teal transition-all active:scale-95 border border-brand-teal-light/20 cursor-pointer disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            <span>{isPrinting ? 'Printing...' : 'Print Receipt'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
