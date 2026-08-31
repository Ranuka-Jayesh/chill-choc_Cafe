import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Order } from '@/types';
import { db } from '@/services/storage/db';
import { formatLKR, formatDateTime } from '@/utils/format';
import { Printer, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface ThermalReceiptModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ThermalReceiptModal: React.FC<ThermalReceiptModalProps> = ({
  order,
  isOpen,
  onClose,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !order || typeof document === 'undefined') return null;

  const settings = db.getSnapshot().settings;

  const handlePrint = () => {
    window.print();
    toast.success('Sent receipt to thermal printer.');
  };

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

  const custom = settings.receiptCustomization;
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
  const paperWidthClass = custom?.paperWidthMm === 58 ? 'max-w-[280px]' : 'max-w-[350px] sm:max-w-[360px]';

  return createPortal(
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[999999] w-full h-full flex flex-col items-center justify-center p-3 sm:p-5 bg-black/65 backdrop-blur-md animate-in fade-in"
    >
      {/* Scroll Container with breathing room / space between scrollbar and receipt */}
      <div className="w-full max-w-[420px] max-h-[82vh] sm:max-h-[85vh] overflow-y-auto pr-3.5 pl-1.5 py-2 flex flex-col items-center custom-scrollbar">
        {/* Dynamic Thermal Paper Slip */}
        <div
          id="printable-receipt"
          className={`w-full ${paperWidthClass} bg-white rounded-3xl shadow-2xl p-6 sm:p-7 font-mono text-xs leading-relaxed text-zinc-900 tracking-[0.04em] sm:tracking-[0.06em] selection:bg-zinc-200 border border-white/30 select-text shrink-0`}
        >
          {/* Logo Header */}
          {showLogo && logoUrl && (
            <div className={`pb-3 flex ${logoAlignment === 'left' ? 'justify-start' : 'justify-center'}`}>
              <img
                src={logoUrl}
                alt="Logo"
                style={{ width: `${logoWidthPx}px` }}
                className="object-contain max-h-24"
              />
            </div>
          )}

          {/* Receipt Brand Header */}
          <div className={`pb-3 ${dividerClass} ${headerAlignment === 'left' ? 'text-left' : 'text-center'}`}>
            <h2 className="font-black text-base sm:text-lg tracking-wider text-zinc-950">
              {(custom?.businessName || settings.businessName).toUpperCase()}
            </h2>
            {(custom?.tagline || settings.tagline) && (
              <p className="text-[10px] text-zinc-600 uppercase font-semibold mt-0.5">
                {custom?.tagline || settings.tagline}
              </p>
            )}
            {(custom?.address || settings.address) && (
              <p className="text-[10px] text-zinc-500 mt-1">{custom?.address || settings.address}</p>
            )}
            {(custom?.phone || settings.phone) && (
              <p className="text-[10px] text-zinc-500">Tel: {custom?.phone || settings.phone}</p>
            )}
          </div>

          {/* Order Meta Info */}
          <div className={`py-2.5 ${dividerClass} text-[11px] space-y-0.5`}>
            <div className="flex justify-between items-center">
              <span className="font-black text-zinc-950">
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
                <span className="font-black">Table {order.tableNumber}</span>
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
            <div className="flex justify-between font-black text-[10px] text-zinc-500 uppercase tracking-wider pb-1 border-b border-zinc-200">
              <span>Item</span>
              <span>Total</span>
            </div>
            {order.items.map((item, idx) => (
              <div key={idx} className="space-y-0.5">
                <div className="flex justify-between font-bold text-zinc-950">
                  <span>
                    {item.quantity}x {item.name}
                  </span>
                  <span className="tabular-nums">{formatLKR(item.itemTotalCents)}</span>
                </div>
                {(custom?.showModifiers ?? true) &&
                  item.modifiers.map((mod, mIdx) => (
                    <div key={mIdx} className="text-[10px] text-zinc-600 pl-3">
                      + {mod.optionName}{' '}
                      {(custom?.showModifierPrices ?? true) &&
                        mod.priceCents > 0 &&
                        `(${formatLKR(mod.priceCents)})`}
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
            {(custom?.showDiscount ?? true) && order.discountCents > 0 && (
              <div className="flex justify-between text-zinc-600">
                <span>Discount:</span>
                <span className="tabular-nums">-{formatLKR(order.discountCents)}</span>
              </div>
            )}
            {(custom?.showServiceCharge ?? true) && order.serviceChargeCents > 0 && (
              <div className="flex justify-between text-zinc-600">
                <span>{custom?.serviceChargeLabel || 'Service Charge'}:</span>
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

          {/* Footer Message */}
          <div className="pt-3 pb-1 text-center text-[10px] text-zinc-600 whitespace-pre-line leading-normal">
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
          <div className="mt-3 pt-2.5 border-t border-dashed border-zinc-200 text-center select-text">
            <div className="text-[9px] font-sans tracking-wide text-zinc-400 uppercase">
              Developed by <span className="font-bold text-zinc-700 tracking-wider">OGO TECHNOLOGY</span>
            </div>
            <div className="text-[8.5px] text-zinc-400 mt-0.5 tracking-tight font-mono flex items-center justify-center gap-1.5 opacity-85">
              <span>www.ogotechnology.net</span>
              <span className="opacity-40">•</span>
              <span>+94 75 930 7059</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Action Buttons Below Slip (No box/container background) */}
      <div className="flex items-center justify-center gap-2.5 sm:gap-3 mt-3.5 sm:mt-4 flex-wrap z-10">
        <button
          onClick={onClose}
          className="px-6 py-2.5 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-md text-xs sm:text-sm font-bold transition-all active:scale-95 border border-white/20 shadow-lg cursor-pointer"
        >
          Done
        </button>

        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-brand-teal hover:bg-brand-teal-dark text-white text-xs sm:text-sm font-black shadow-teal transition-all active:scale-95 border border-brand-teal-light/20 cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>Print Receipt (80mm)</span>
        </button>
      </div>
    </div>,
    document.body
  );
};
