import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Order, KotCustomizationSettings } from '@/types';
import { db } from '@/services/storage/db';
import { receiptSocketService } from '@/services/receiptSocketService';
import { formatDateTime } from '@/utils/format';
import { Printer, X, Utensils } from 'lucide-react';
import { toast } from 'sonner';
import { printThermalElement } from '@/utils/printThermal';

interface KOTPreviewModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_KOT_SETTINGS: KotCustomizationSettings = {
  ticketTitle: 'KITCHEN ORDER TICKET',
  showBrandName: true,
  brandName: 'CHILL & CHOC',
  showOrderType: true,
  showTableNumber: true,
  tableNumberStyle: 'prominent',
  showOrderNumber: true,
  orderNumberPrefix: '#',
  showCashierName: true,
  cashierLabel: 'Staff',
  showDateTime: true,
  timeFormat: '12h',
  showModifiers: true,
  showItemNotes: true,
  highlightNotes: true,
  fontSize: 'normal',
  paperWidthMm: 80,
  dividerStyle: 'dashed',
  showStationRouting: true,
  stationRoutingText: 'Station Routing: BAR / KITCHEN / DESSERT',
  customNote: '',
};

export const KOTPreviewModal: React.FC<KOTPreviewModalProps> = ({ order, isOpen, onClose }) => {
  const [kotSettings, setKotSettings] = useState<KotCustomizationSettings>(() => {
    return db.getSnapshot().settings.kotCustomization || DEFAULT_KOT_SETTINGS;
  });

  useEffect(() => {
    // Listen to real-time WebSocket updates for KOT template
    const unsubSocket = receiptSocketService.subscribe((msg) => {
      if (msg.type === 'KOT_TEMPLATE_UPDATED' && msg.payload) {
        setKotSettings(msg.payload);
      }
    });

    // Also listen to database changes
    const unsubDb = db.subscribe(() => {
      const current = db.getSnapshot().settings.kotCustomization;
      if (current) setKotSettings(current);
    });

    return () => {
      unsubSocket();
      unsubDb();
    };
  }, []);

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

  const handlePrint = () => {
    printThermalElement('printable-kot');
    toast.success(`KOT for ${order.orderNumber} dispatched to kitchen.`);
  };

  const getDivider = () => {
    switch (kotSettings.dividerStyle) {
      case 'double':
        return 'border-b-2 border-zinc-900';
      case 'dotted':
        return 'border-b-2 border-dotted border-zinc-400';
      case 'solid':
        return 'border-b-2 border-zinc-400';
      case 'dashed':
      default:
        return 'border-b-2 border-dashed border-zinc-400';
    }
  };

  const paperWidthClass = kotSettings.paperWidthMm === 58 ? 'max-w-[280px]' : 'max-w-[340px] sm:max-w-[360px]';

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
        title="Close (Esc)"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Centered Scrollable Wrapper */}
      <div className="w-full max-w-[380px] my-auto flex flex-col items-center">
        {/* Dynamic 80mm / 58mm KOT Pure Ticket Slip */}
        <div
          id="printable-kot"
          className={`w-full ${paperWidthClass} bg-white rounded-3xl shadow-2xl p-6 sm:p-7 font-mono text-xs text-zinc-950 leading-relaxed tracking-[0.04em] sm:tracking-[0.06em] border border-white/30 select-text shrink-0`}
        >
          {/* Header */}
          <div className={`text-center pb-3.5 ${getDivider()}`}>
            {kotSettings.showBrandName && (
              <h2 className="font-black text-lg tracking-[0.14em] text-zinc-950">
                {(kotSettings.brandName || 'CHILL & CHOC').toUpperCase()}
              </h2>
            )}
            <div className="font-black text-xs uppercase bg-zinc-900 text-white px-3 py-1 mt-1.5 inline-block rounded-xl tracking-wider">
              {kotSettings.ticketTitle || 'KITCHEN ORDER TICKET'}
            </div>
          </div>

          {/* Order Identifiers */}
          <div className={`py-3.5 ${getDivider()} space-y-1.5`}>
            <div className="flex justify-between items-baseline">
              {kotSettings.showOrderNumber && (
                <span className="font-black text-2xl tracking-tight text-zinc-950">
                  {kotSettings.orderNumberPrefix || '#'}
                  {order.orderNumber.replace('#', '')}
                </span>
              )}
              {kotSettings.showOrderType && (
                <span className="font-black text-xs uppercase px-2.5 py-1 rounded-xl bg-zinc-200 text-zinc-900 tracking-wider">
                  {order.orderType === 'DINE_IN' ? 'DINE IN' : 'TAKEAWAY'}
                </span>
              )}
            </div>

            {/* Table Number Display */}
            {kotSettings.showTableNumber && order.tableNumber && (
              kotSettings.tableNumberStyle === 'prominent' ? (
                <div className="text-center py-1.5 bg-zinc-100 rounded-xl font-black text-base mt-1 text-zinc-950 border border-zinc-200">
                  TABLE {order.tableNumber}
                </div>
              ) : (
                <div className="flex justify-between text-zinc-800 text-xs font-bold pt-0.5">
                  <span>Table:</span>
                  <span>Table {order.tableNumber}</span>
                </div>
              )
            )}

            <div className="space-y-0.5 text-[10.5px] text-zinc-600 pt-1">
              {(kotSettings.showCustomerName ?? true) && (order.customerName || (order as any).customer?.name) && (
                <div className="flex justify-between items-center text-[10.5px]">
                  <span>Customer:</span>
                  <span className="font-black text-zinc-950">{order.customerName || (order as any).customer?.name}</span>
                </div>
              )}
              {kotSettings.showDateTime && (
                <div className="flex justify-between items-center">
                  <span>Time:</span>
                  <span className="font-bold text-zinc-900">{formatDateTime(order.createdAt)}</span>
                </div>
              )}
              {kotSettings.showCashierName && (
                <div className="flex justify-between items-center">
                  <span>{kotSettings.cashierLabel || 'Staff'}:</span>
                  <span className="font-bold text-zinc-900">{order.cashierName}</span>
                </div>
              )}
            </div>
          </div>

          {/* Item List with prominent Quantities & Modifiers */}
          <div className={`py-3 ${getDivider()} space-y-3`}>
            {order.items.map((item, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-baseline gap-2 font-black text-sm text-zinc-950">
                  <span className="bg-zinc-900 text-white w-6 h-6 flex items-center justify-center rounded text-xs flex-shrink-0">
                    {item.quantity}
                  </span>
                  <span>{item.name.toUpperCase()}</span>
                </div>
                {kotSettings.showModifiers &&
                  item.modifiers.map((mod, mIdx) => (
                    <div key={mIdx} className="text-xs font-bold text-zinc-800 pl-8">
                      * {mod.groupName}: {mod.optionName}
                    </div>
                  ))}
                {kotSettings.showItemNotes && item.notes && (
                  <div
                    className={
                      kotSettings.highlightNotes
                        ? 'text-xs font-bold text-red-600 bg-red-50 p-1.5 rounded-lg pl-2 ml-8 border border-red-200'
                        : 'text-xs italic text-zinc-700 pl-8'
                    }
                  >
                    NOTE: {item.notes.toUpperCase()}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Station Routing */}
          {kotSettings.showStationRouting && (
            <div className="pt-3 text-center text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider">
              {kotSettings.stationRoutingText || 'Station Routing: BAR / KITCHEN / DESSERT'}
            </div>
          )}

          {/* Custom Kitchen Note */}
          {kotSettings.customNote && (
            <div className="pt-2 text-center text-[10px] font-bold text-zinc-600 italic">
              {kotSettings.customNote}
            </div>
          )}
        </div>

        {/* Floating Action Buttons Below Ticket */}
        <div className="flex items-center justify-center gap-2.5 sm:gap-3 mt-4 flex-wrap z-10 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-md text-xs font-bold transition-all active:scale-95 border border-white/20 shadow-lg cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-brand-orange hover:bg-brand-brown text-white text-xs sm:text-sm font-black shadow-lg transition-all active:scale-95 border border-brand-yellow-light/20 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Reprint KOT Ticket</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
