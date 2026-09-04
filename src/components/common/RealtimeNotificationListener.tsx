import React, { useEffect } from 'react';
import { toast } from 'sonner';
import { realtimeSocketService, RealtimeMessage } from '@/services/realtimeSocketService';
import { useAuthStore } from '@/store/useAuthStore';
import { CashDrawerTransaction, StockRequest } from '@/types';
import { formatLKR } from '@/utils/format';
import { playNotificationChime } from '@/utils/soundAlert';
import { router } from '@/app/router';

/**
 * Global Realtime WebSocket Notification Listener
 * Handles live bi-directional alerts between Cashier and Admin:
 * 1. Cashier -> Admin: Real-time alert when Cashier requests stock or cash drawer movement.
 * 2. Admin -> Cashier: Real-time alert when Admin approves or rejects cashier requests.
 */
export const RealtimeNotificationListener: React.FC = () => {
  useEffect(() => {
    // 1. CASHIER -> ADMIN: Cash Drawer Request Pending
    const unsubDrawerPending = realtimeSocketService.on(
      'DRAWER_REQUEST_PENDING',
      (msg: RealtimeMessage<{ transaction?: CashDrawerTransaction }>) => {
        const tx = msg.payload?.transaction;
        if (!tx) return;

        const path = typeof window !== 'undefined' ? window.location.pathname : '';
        const session = useAuthStore.getState().session;
        const isAdmin = path.startsWith('/admin') || session?.user?.role === 'ADMIN';

        // Only alert Admin users
        if (isAdmin) {
          playNotificationChime('request');
          const typeLabel = tx.type.replace(/_/g, ' ');
          const amountStr = formatLKR(Math.abs(tx.amount));

          toast.warning(
            `💰 New Cash Request: ${typeLabel}`,
            {
              description: `${tx.cashierName} requested ${amountStr} (${tx.reason || 'General register movement'}).`,
              duration: 7500,
              action: {
                label: 'Review',
                onClick: () => {
                  try {
                    router.navigate('/admin/cash-drawers?tab=requests');
                  } catch {
                    window.location.href = '/admin/cash-drawers?tab=requests';
                  }
                },
              },
            }
          );
        }
      }
    );

    // 2. CASHIER -> ADMIN: Stock Request Pending (Adjustment or Goods Delivery)
    const unsubStockPending = realtimeSocketService.on(
      'STOCK_REQUEST_PENDING',
      (msg: RealtimeMessage<{ stockRequest?: StockRequest }>) => {
        const req = msg.payload?.stockRequest;
        if (!req) return;

        const path = typeof window !== 'undefined' ? window.location.pathname : '';
        const session = useAuthStore.getState().session;
        const isAdmin = path.startsWith('/admin') || session?.user?.role === 'ADMIN';

        // Only alert Admin users
        if (isAdmin) {
          playNotificationChime('request');
          const isDelivery = req.type === 'STOCK_DELIVERY';
          const title = isDelivery ? '📦 New Goods Delivery Request' : '📦 New Stock Adjustment Request';
          const details = isDelivery
            ? `${req.ingredientName} from ${req.supplierName || 'Supplier'} (Requested by ${req.requestedByUserName}).`
            : `${req.ingredientName} (${req.quantityChange > 0 ? `+${req.quantityChange}` : req.quantityChange} ${req.unit || 'units'}) requested by ${req.requestedByUserName}.`;

          toast.info(title, {
            description: details,
            duration: 7500,
            action: {
              label: 'Review',
              onClick: () => {
                try {
                  router.navigate('/admin/inventory?tab=requests');
                } catch {
                  window.location.href = '/admin/inventory?tab=requests';
                }
              },
            },
          });
        }
      }
    );

    // 3. ADMIN -> CASHIER: Cash Drawer Request Approved
    const unsubDrawerApproved = realtimeSocketService.on(
      'DRAWER_REQUEST_APPROVED',
      (msg: RealtimeMessage<{ transaction?: CashDrawerTransaction }>) => {
        const tx = msg.payload?.transaction;
        if (!tx) return;

        const path = typeof window !== 'undefined' ? window.location.pathname : '';
        const session = useAuthStore.getState().session;
        const isPos = path.startsWith('/pos') || session?.user?.role === 'CASHIER';

        // Only alert Cashier users on POS
        if (isPos) {
          playNotificationChime('approved');
          const typeLabel = tx.type.replace(/_/g, ' ');
          const amountStr = formatLKR(Math.abs(tx.amount));
          const adminName = tx.approvedByUserName || 'Administrator';

          toast.success(
            `Cash Request Approved! 🎉`,
            {
              description: `Your ${typeLabel} of ${amountStr} was approved by ${adminName}.`,
              duration: 6500,
            }
          );
        }
      }
    );

    // 4. ADMIN -> CASHIER: Cash Drawer Request Rejected
    const unsubDrawerRejected = realtimeSocketService.on(
      'DRAWER_REQUEST_REJECTED',
      (msg: RealtimeMessage<{ transaction?: CashDrawerTransaction }>) => {
        const tx = msg.payload?.transaction;
        if (!tx) return;

        const path = typeof window !== 'undefined' ? window.location.pathname : '';
        const session = useAuthStore.getState().session;
        const isPos = path.startsWith('/pos') || session?.user?.role === 'CASHIER';

        // Only alert Cashier users on POS
        if (isPos) {
          playNotificationChime('rejected');
          const typeLabel = tx.type.replace(/_/g, ' ');
          const amountStr = formatLKR(Math.abs(tx.amount));
          const reasonStr = tx.rejectedReason || 'Declined by administrator';

          toast.error(
            `Cash Request Declined`,
            {
              description: `Your ${typeLabel} of ${amountStr} was declined: "${reasonStr}".`,
              duration: 7500,
            }
          );
        }
      }
    );

    // 5. ADMIN -> CASHIER: Stock Request Approved
    const unsubStockApproved = realtimeSocketService.on(
      'STOCK_REQUEST_APPROVED',
      (msg: RealtimeMessage<{ stockRequest?: StockRequest }>) => {
        const req = msg.payload?.stockRequest;
        if (!req) return;

        const path = typeof window !== 'undefined' ? window.location.pathname : '';
        const session = useAuthStore.getState().session;
        const isPos = path.startsWith('/pos') || session?.user?.role === 'CASHIER';

        // Only alert Cashier users on POS
        if (isPos) {
          playNotificationChime('approved');
          const reqType = req.type === 'STOCK_DELIVERY' ? 'Goods Delivery' : 'Stock Adjustment';
          const adminName = req.resolvedByUserName || 'Administrator';

          toast.success(
            `Stock Request Approved! 🎉`,
            {
              description: `${reqType} for ${req.ingredientName} has been approved by ${adminName}.`,
              duration: 6500,
            }
          );
        }
      }
    );

    // 6. ADMIN -> CASHIER: Stock Request Rejected
    const unsubStockRejected = realtimeSocketService.on(
      'STOCK_REQUEST_REJECTED',
      (msg: RealtimeMessage<{ stockRequest?: StockRequest }>) => {
        const req = msg.payload?.stockRequest;
        if (!req) return;

        const path = typeof window !== 'undefined' ? window.location.pathname : '';
        const session = useAuthStore.getState().session;
        const isPos = path.startsWith('/pos') || session?.user?.role === 'CASHIER';

        // Only alert Cashier users on POS
        if (isPos) {
          playNotificationChime('rejected');
          const reqType = req.type === 'STOCK_DELIVERY' ? 'Goods Delivery' : 'Stock Adjustment';
          const reasonStr = req.rejectionReason || 'Declined by administrator';

          toast.error(
            `Stock Request Declined`,
            {
              description: `${reqType} for ${req.ingredientName} was declined: "${reasonStr}".`,
              duration: 7500,
            }
          );
        }
      }
    );

    return () => {
      unsubDrawerPending();
      unsubStockPending();
      unsubDrawerApproved();
      unsubDrawerRejected();
      unsubStockApproved();
      unsubStockRejected();
    };
  }, []);

  return null;
};
