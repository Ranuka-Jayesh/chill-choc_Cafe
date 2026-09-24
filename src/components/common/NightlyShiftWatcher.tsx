import React, { useEffect } from 'react';
import { autoShiftCloseService } from '@/services/autoShiftCloseService';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from 'sonner';

export const NightlyShiftWatcher: React.FC = () => {
  const { session, logout } = useAuthStore();

  useEffect(() => {
    // 1. Start continuous 10s watcher and window focus/visibility listeners
    const cleanupWatcher = autoShiftCloseService.startWatcher();

    // 2. Listen to global nightly-shift-auto-closed event
    const handleShiftAutoClosed = (e: any) => {
      const closedShift = e?.detail?.shift;
      if (session?.user?.role === 'CASHIER') {
        logout();
        toast.info(
          closedShift
            ? `Shift #${closedShift.shiftNumber} closed at 11:59 PM cutoff. Drawer cleared to Rs. 0.00.`
            : 'Nightly 11:59 PM Cutoff: Cash drawer cleared. Please sign in to start a new shift.',
          {
            id: 'nightly-shift-auto-closed-toast',
            duration: 6000,
          }
        );
      }
    };

    window.addEventListener('nightly-shift-auto-closed', handleShiftAutoClosed);

    return () => {
      cleanupWatcher();
      window.removeEventListener('nightly-shift-auto-closed', handleShiftAutoClosed);
    };
  }, [session, logout]);

  return null;
};
