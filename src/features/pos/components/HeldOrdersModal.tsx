import React, { useState, useEffect } from 'react';
import { usePosCartStore } from '@/store/usePosCartStore';
import { useAuthStore } from '@/store/useAuthStore';
import { orderService } from '@/services/orderService';
import { realtimeSocketService } from '@/services/realtimeSocketService';
import { HeldOrder } from '@/types';
import { db } from '@/services/storage/db';
import { confirmDialog } from '@/store/useConfirmStore';
import { formatLKR, formatTime } from '@/utils/format';
import { PauseCircle, PlayCircle, Trash2, X, Clock, ShoppingBag, AlertCircle, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

interface HeldOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HeldOrdersModal: React.FC<HeldOrdersModalProps> = ({ isOpen, onClose }) => {
  const { session } = useAuthStore();
  const user = session?.user;
  const terminalId = session?.terminalId || 'term_01';

  const { items: activeCartItems, restoreCartFromHeldOrder } = usePosCartStore();
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>(orderService.getHeldOrders());
  const [orderToConfirmResume, setOrderToConfirmResume] = useState<HeldOrder | null>(null);

  useEffect(() => {
    const refreshHeld = () => setHeldOrders(orderService.getHeldOrders());
    const unsubDb = db.subscribe(refreshHeld);
    const unsubHeld = realtimeSocketService.on('ORDER_HELD', refreshHeld);
    const unsubResumed = realtimeSocketService.on('ORDER_RESUMED', refreshHeld);

    return () => {
      unsubDb();
      unsubHeld();
      unsubResumed();
    };
  }, []);

  // Close with Escape key
  useEffect(() => {
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

  if (!isOpen) return null;

  const handleResume = (held: HeldOrder) => {
    if (activeCartItems.length > 0) {
      setOrderToConfirmResume(held);
      return;
    }

    doResume(held);
  };

  const doResume = (held: HeldOrder) => {
    if (!user) return;
    restoreCartFromHeldOrder(held);
    orderService.deleteHeldOrder(held.id, user.id, user.name, terminalId);

    // Audit resume
    db.update('auditLogs', (logs) => [
      {
        id: `aud_${Date.now()}`,
        userId: user.id,
        userName: user.name,
        action: 'ORDER_RESUME',
        entity: 'HeldOrder',
        entityId: held.id,
        details: `Resumed held order #${held.holdNumber} (${held.holdLabel}) into active cart`,
        terminalId,
        timestamp: new Date().toISOString(),
      },
      ...logs,
    ]);

    toast.success(`Resumed "${held.holdLabel}" into cart!`);
    setOrderToConfirmResume(null);
    onClose();
  };

  const handleVoid = async (held: HeldOrder) => {
    if (!user) return;
    const confirmed = await confirmDialog({
      title: `Discard Held Order #${held.holdNumber}?`,
      message: `Are you sure you want to discard and void "${held.holdLabel}" (${held.items.length} items, ${formatLKR(held.totalCents)})?`,
      confirmText: 'Discard Order',
      cancelText: 'Keep Held',
      variant: 'danger',
    });

    if (confirmed) {
      orderService.deleteHeldOrder(held.id, user.id, user.name, terminalId);
      toast.info(`Held order #${held.holdNumber} discarded.`);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-brand-brown-deep/70 backdrop-blur-md animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-white rounded-3xl sm:rounded-[32px] shadow-2xl border border-border/80 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 sm:py-5 bg-gradient-to-r from-cream-50 to-white border-b border-border/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-yellow-light text-brand-orange border border-brand-yellow/30 flex items-center justify-center font-bold shadow-xs">
              <PauseCircle className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base sm:text-lg text-brand-brown-dark tracking-tight">
                  Parked / Held Orders
                </h3>
                <span className="px-2.5 py-0.5 bg-brand-orange text-white text-[10px] font-black rounded-full shadow-xs">
                  {heldOrders.length} active
                </span>
              </div>
              <p className="text-xs text-text-secondary">
                Select an order to resume it into the cashier cart or discard
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
        <div className="p-5 sm:p-7 flex-1 overflow-y-auto space-y-4 bg-cream-50/30">
          {heldOrders.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-cream-100 text-brand-brown/40 flex items-center justify-center mx-auto shadow-inner">
                <ShoppingBag className="w-8 h-8 stroke-[1.8]" />
              </div>
              <div>
                <h4 className="font-black text-sm text-brand-brown-dark">No orders currently on hold</h4>
                <p className="text-xs text-text-secondary mt-1 max-w-xs mx-auto leading-relaxed">
                  When a customer needs time to decide, click <strong>"Hold Order"</strong> in the cart to park their items and serve the next person.
                </p>
              </div>
            </div>
          ) : (
            heldOrders.map((held) => (
              <div
                key={held.id}
                className="bg-white rounded-3xl border-2 border-border/80 hover:border-brand-teal/50 shadow-soft p-5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-2.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full bg-brand-yellow-light text-brand-orange border border-brand-yellow/40 font-black text-xs">
                      #{held.holdNumber}
                    </span>
                    <h4 className="font-black text-sm text-brand-brown-dark">{held.holdLabel}</h4>
                    <span className="text-[11px] text-text-secondary flex items-center gap-1 font-bold ml-auto sm:ml-0 bg-cream-100 px-2 py-0.5 rounded-lg">
                      <Clock className="w-3 h-3" />
                      {formatTime(held.heldAt)}
                    </span>
                  </div>

                  {/* Items summary list */}
                  <div className="space-y-1 text-xs bg-cream-50/70 p-3 rounded-2xl border border-cream-100">
                    {held.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between text-text-secondary">
                        <span className="font-medium text-text-primary">
                          <span className="font-black text-brand-teal">{it.quantity}x</span> {it.name}
                          {it.modifiers.length > 0 && (
                            <span className="text-[11px] text-text-secondary/80 ml-1">
                              ({it.modifiers.map((m) => m.optionName).join(', ')})
                            </span>
                          )}
                        </span>
                        <span className="font-extrabold tabular-nums text-brand-brown-dark">
                          {formatLKR(it.itemTotalCents)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-cream-100 text-xs">
                    <span className="text-text-secondary text-[11px]">
                      Cashier: <strong className="text-text-primary font-bold">{held.heldByCashierName}</strong>
                    </span>
                    <div className="text-right">
                      <span className="text-xs text-text-secondary mr-1.5 font-bold">Total:</span>
                      <span className="font-black text-base text-brand-brown-deep tabular-nums">
                        {formatLKR(held.totalCents)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex sm:flex-col gap-2 shrink-0 justify-end">
                  <button
                    onClick={() => handleResume(held)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-teal hover:bg-brand-teal-dark text-white rounded-xl font-black text-xs shadow-teal active:scale-95 transition-all"
                  >
                    <PlayCircle className="w-4 h-4 stroke-[2.2]" />
                    Resume Order
                  </button>
                  <button
                    onClick={() => handleVoid(held)}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 text-text-secondary hover:text-rose-600 hover:bg-rose-50 rounded-xl font-extrabold text-xs transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Discard
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-cream-50 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-brand-brown-dark hover:bg-brand-brown-deep text-white font-black text-xs rounded-xl shadow-soft transition-all"
          >
            Close
          </button>
        </div>
      </div>

      {/* Overwrite Confirmation Submodal */}
      {orderToConfirmResume && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-brand-brown-deep/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-border space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h4 className="font-black text-base text-brand-brown-dark">Active Cart Not Empty</h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                Your current cart contains {activeCartItems.length} item(s). Resuming "{orderToConfirmResume.holdLabel}" will replace the active cart items.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={() => doResume(orderToConfirmResume)}
                className="w-full py-3 bg-brand-teal hover:bg-brand-teal-dark text-white font-black text-xs rounded-2xl shadow-teal active:scale-95 transition-all"
              >
                Replace Active Cart & Resume
              </button>
              <button
                onClick={() => setOrderToConfirmResume(null)}
                className="w-full py-2.5 bg-cream-100 text-brand-brown font-bold text-xs rounded-2xl hover:bg-cream-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
