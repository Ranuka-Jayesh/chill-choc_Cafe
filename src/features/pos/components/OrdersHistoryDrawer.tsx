import React, { useState, useEffect } from 'react';
import { orderService } from '@/services/orderService';
import { promptDialog } from '@/store/useConfirmStore';
import { Order } from '@/types';
import { db } from '@/services/storage/db';
import { realtimeSocketService } from '@/services/realtimeSocketService';
import { formatLKR, formatDateTime } from '@/utils/format';
import { History, X, Printer, Utensils, RotateCcw, Search, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface OrdersHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onViewReceipt: (order: Order) => void;
  onViewKOT: (order: Order) => void;
  userId: string;
  userName: string;
}

export const OrdersHistoryDrawer: React.FC<OrdersHistoryDrawerProps> = ({
  isOpen,
  onClose,
  onViewReceipt,
  onViewKOT,
  userId,
  userName,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [orders, setOrders] = useState<Order[]>(() => orderService.getOrders());

  // Real-time synchronization whenever drawer is open
  useEffect(() => {
    if (!isOpen) return;

    const syncOrders = () => {
      setOrders(orderService.getOrders());
    };

    syncOrders();
    const unsubDb = db.subscribe(syncOrders);
    const unsubRefundReq = realtimeSocketService.on('ORDER_REFUND_REQUESTED', syncOrders);
    const unsubRefunded = realtimeSocketService.on('ORDER_REFUNDED', syncOrders);
    const unsubUpdated = realtimeSocketService.on('ORDER_UPDATED', syncOrders);

    const handleStorage = (e: StorageEvent) => {
      if (e.key?.includes('cafemm') || e.key?.includes('order')) {
        syncOrders();
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      unsubDb();
      unsubRefundReq();
      unsubRefunded();
      unsubUpdated();
      window.removeEventListener('storage', handleStorage);
    };
  }, [isOpen]);

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

  const today = new Date();
  const isToday = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return (
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate()
      );
    } catch {
      return false;
    }
  };

  const todayOrders = orders.filter((o) => isToday(o.createdAt));
  const filtered = todayOrders.filter(
    (o) =>
      o.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.items.some((i) => i.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleRefund = async (order: Order) => {
    const reason = await promptDialog({
      title: `Request Refund for Order ${order.orderNumber}`,
      message: 'Enter reason for this refund request (sent to Admin for confirmation):',
      defaultValue: 'Customer change of mind',
      placeholder: 'e.g. Customer change of mind, wrong order, food issue...',
      confirmText: 'Submit Request to Admin',
      variant: 'warning',
    });
    if (!reason || !reason.trim()) return;
    try {
      const updated = await orderService.requestRefund({
        orderId: order.id,
        reason: reason.trim(),
        userId,
        userName,
      });
      setOrders(orderService.getOrders());
      toast.success(`Refund request for ${order.orderNumber} submitted to Admin.`);
    } catch (err: any) {
      toast.error(err.message || 'Refund request failed');
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex justify-end bg-brand-brown-deep/50 backdrop-blur-sm animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-border animate-in slide-in-from-right duration-200"
      >
        {/* Header */}
        <div className="p-4 bg-cream-50 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-brand-teal" />
            <h3 className="font-extrabold text-sm text-brand-brown-dark">Recent Orders</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-text-secondary hover:bg-cream-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-border bg-white">
          <div className="relative">
            <Search className="w-4 h-4 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by order # or item name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-cream-50 border border-border rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-teal/40"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-text-secondary">
              <History className="w-8 h-8 mx-auto text-zinc-300 mb-2" />
              <p className="font-bold text-xs">No matching orders found.</p>
            </div>
          ) : (
            filtered.map((order) => {
              const isRefunded = order.status === 'REFUNDED' || order.status === 'PARTIALLY_REFUNDED' || order.refundStatus === 'APPROVED';
              const isRefundPending = order.status === 'REFUND_PENDING' || order.refundStatus === 'PENDING_APPROVAL';

              return (
                <div
                  key={order.id}
                  className="p-3.5 bg-cream-50/50 rounded-2xl border border-border space-y-2 hover:border-brand-teal/40 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-brand-brown-dark">{order.orderNumber}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cream-200 text-brand-brown uppercase">
                          {order.orderType === 'DINE_IN' ? `Table ${order.tableNumber || '01'}` : 'Takeaway'}
                        </span>
                        {isRefundPending && (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500 text-white uppercase flex items-center gap-1 shadow-xs animate-pulse">
                            <Clock className="w-2.5 h-2.5" />
                            Pending Admin Approval
                          </span>
                        )}
                        {isRefunded && (
                          <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-status-danger text-white uppercase">
                            Refunded
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-text-secondary mt-0.5">{formatDateTime(order.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <div className="font-extrabold text-sm text-text-primary tabular-nums">
                        {formatLKR(order.totalCents)}
                      </div>
                      <div className="text-[10px] uppercase font-bold text-brand-teal">{order.paymentMethod}</div>
                    </div>
                  </div>

                  <div className="text-xs text-text-secondary border-t border-cream-100 pt-1.5 space-y-0.5">
                    {order.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>{it.quantity}x {it.name}</span>
                        <span className="tabular-nums">{formatLKR(it.itemTotalCents)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-cream-200">
                    <button
                      onClick={() => onViewKOT(order)}
                      className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-brand-brown bg-white border border-border rounded-lg hover:bg-cream-100"
                    >
                      <Utensils className="w-3 h-3 text-brand-orange" />
                      KOT
                    </button>
                    <button
                      onClick={() => onViewReceipt(order)}
                      className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-brand-teal-dark bg-brand-teal-light border border-brand-teal/30 rounded-lg hover:bg-brand-teal hover:text-white transition-colors"
                    >
                      <Printer className="w-3 h-3" />
                      Receipt
                    </button>
                    {isRefundPending ? (
                      <span className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-amber-800 bg-amber-100/70 border border-amber-300/80 rounded-lg cursor-not-allowed">
                        <Clock className="w-3 h-3 text-amber-600 animate-spin" />
                        Pending Approval
                      </span>
                    ) : !isRefunded ? (
                      <button
                        onClick={() => handleRefund(order)}
                        className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-status-danger bg-white border border-status-danger/30 rounded-lg hover:bg-status-danger-bg transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Refund
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
