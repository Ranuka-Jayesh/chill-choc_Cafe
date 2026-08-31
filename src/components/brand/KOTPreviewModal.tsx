import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Order } from '@/types';
import { formatDateTime } from '@/utils/format';
import { Printer, X, Utensils } from 'lucide-react';
import { toast } from 'sonner';

interface KOTPreviewModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
}

export const KOTPreviewModal: React.FC<KOTPreviewModalProps> = ({ order, isOpen, onClose }) => {
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
    window.print();
    toast.success(`KOT for ${order.orderNumber} dispatched to kitchen.`);
  };

  return createPortal(
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[999999] w-full h-full flex flex-col items-center justify-center p-3 sm:p-5 bg-black/65 backdrop-blur-md animate-in fade-in"
    >
      {/* Scroll Container with breathing room / space between scrollbar and ticket */}
      <div className="w-full max-w-[420px] max-h-[82vh] sm:max-h-[85vh] overflow-y-auto pr-3.5 pl-1.5 py-2 flex flex-col items-center custom-scrollbar">
        {/* 80mm KOT Pure Ticket Slip */}
        <div className="w-full max-w-[350px] sm:max-w-[360px] bg-white rounded-3xl shadow-2xl p-6 sm:p-7 font-mono text-xs text-zinc-950 leading-relaxed tracking-[0.04em] sm:tracking-[0.06em] border border-white/30 select-text shrink-0">
        {/* Header */}
        <div className="text-center pb-3.5 border-b-2 border-dashed border-zinc-400">
          <h2 className="font-black text-lg tracking-[0.14em] text-zinc-950">CHILL & CHOC</h2>
          <div className="font-black text-xs uppercase bg-zinc-900 text-white px-3 py-1 mt-1.5 inline-block rounded-xl tracking-wider">
            KITCHEN ORDER TICKET
          </div>
        </div>

        {/* Order Identifiers */}
        <div className="py-3.5 border-b-2 border-dashed border-zinc-400 space-y-1.5">
          <div className="flex justify-between items-baseline">
            <span className="font-black text-2xl tracking-tight text-zinc-950">{order.orderNumber}</span>
            <span className="font-black text-xs uppercase px-2.5 py-1 rounded-xl bg-zinc-200 text-zinc-900 tracking-wider">
              {order.orderType === 'DINE_IN' ? 'DINE IN' : 'TAKEAWAY'}
            </span>
          </div>
          {order.tableNumber && (
            <div className="text-center py-1.5 bg-zinc-100 rounded-xl font-black text-base mt-1 text-zinc-950">
              TABLE {order.tableNumber}
            </div>
          )}
          <div className="space-y-0.5 text-[10.5px] text-zinc-600 pt-1">
            <div className="flex justify-between items-center">
              <span>Time:</span>
              <span className="font-bold text-zinc-900">{formatDateTime(order.createdAt)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Staff:</span>
              <span className="font-bold text-zinc-900">{order.cashierName}</span>
            </div>
          </div>
        </div>

        {/* Item List with prominent Quantities & Modifiers */}
        <div className="py-3 border-b-2 border-dashed border-zinc-400 space-y-3">
          {order.items.map((item, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex items-baseline gap-2 font-black text-sm text-zinc-950">
                <span className="bg-zinc-900 text-white w-6 h-6 flex items-center justify-center rounded text-xs flex-shrink-0">
                  {item.quantity}
                </span>
                <span>{item.name.toUpperCase()}</span>
              </div>
              {item.modifiers.map((mod, mIdx) => (
                <div key={mIdx} className="text-xs font-bold text-zinc-800 pl-8">
                  * {mod.groupName}: {mod.optionName}
                </div>
              ))}
              {item.notes && (
                <div className="text-xs font-bold text-red-600 bg-red-50 p-1.5 rounded-lg pl-2 ml-8 border border-red-200">
                  NOTE: {item.notes.toUpperCase()}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="pt-3 text-center text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider">
          Station Routing: BAR / KITCHEN / DESSERT
        </div>
      </div>
    </div>

      {/* Floating Action Buttons Below Ticket */}
      <div className="flex items-center justify-center gap-2.5 sm:gap-3 mt-3.5 sm:mt-4 flex-wrap z-10">
        <button
          onClick={onClose}
          className="px-5 py-2.5 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-md text-xs font-bold transition-all active:scale-95 border border-white/20 shadow-lg"
        >
          Close
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-brand-orange hover:bg-brand-brown text-white text-xs sm:text-sm font-black shadow-lg transition-all active:scale-95 border border-brand-yellow-light/20"
        >
          <Printer className="w-4 h-4" />
          <span>Reprint KOT Ticket</span>
        </button>
      </div>
    </div>,
    document.body
  );
};
