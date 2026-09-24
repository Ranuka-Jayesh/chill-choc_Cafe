import { db } from './storage/db';
import { shiftService } from './shiftService';
import { cashDrawerService } from './cashDrawerService';
import { realtimeSocketService } from './realtimeSocketService';
import { toLocalYMD } from './reportService';
import { formatLKR, getSriLankaNowISO } from '@/utils/format';
import { authService } from './authService';
import { CashierShift } from '@/types';

/**
 * Extracts wall-clock components strictly in Sri Lanka Standard Time (Asia/Colombo, UTC+05:30).
 * Completely immune to client OS/machine timezone differences.
 */
export function getSriLankaDateTimeParts(date: Date = new Date()): {
  ymd: string;
  hours: number;
  minutes: number;
  seconds: number;
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  }).formatToParts(date);

  const m: Record<string, string> = {};
  parts.forEach((p) => {
    m[p.type] = p.value;
  });

  return {
    ymd: `${m.year}-${m.month}-${m.day}`,
    hours: parseInt(m.hour, 10),
    minutes: parseInt(m.minute, 10),
    seconds: parseInt(m.second, 10),
  };
}

let isProcessing = false;

export const autoShiftCloseService = {
  /**
   * Determine if a shift is overdue or has reached the 11:59 PM nightly cutoff.
   */
  shouldShiftAutoClose: (shift: CashierShift, now: Date = new Date()): boolean => {
    if (shift.status !== 'OPEN') return false;

    const shiftDate = shift.businessDate || toLocalYMD(shift.openedAt);
    const { ymd: todayYMD, hours, minutes } = getSriLankaDateTimeParts(now);

    // Case 1: Shift is from yesterday or earlier
    if (shiftDate < todayYMD) {
      return true;
    }

    // Case 2: Shift is from today and Sri Lanka time is 23:59:00 or later
    if (shiftDate === todayYMD) {
      if (hours > 23 || (hours === 23 && minutes >= 59)) {
        return true;
      }
    }

    return false;
  },

  /**
   * Auto-closes a single open shift, clears the cash drawer, and syncs data.
   */
  autoCloseShift: async (shift: CashierShift, now: Date = new Date()): Promise<CashierShift> => {
    const shiftDate = shift.businessDate || toLocalYMD(shift.openedAt);
    const { ymd: todayYMD } = getSriLankaDateTimeParts(now);

    const expectedCash = shiftService.calculateExpectedCash(shift);
    const closingCashEnteredCents = expectedCash; // Balanced on nightly automated close
    const variance = 0;
    const varianceStatus = 'BALANCED' as const;

    // Use 23:59:59 of the shift's business date if from yesterday, or current Sri Lanka time
    const closedAt =
      shiftDate < todayYMD
        ? `${shiftDate}T23:59:59.000+05:30`
        : getSriLankaNowISO(now);

    const closedShift: CashierShift = {
      ...shift,
      status: 'CLOSED',
      closedAt,
      closingCashEntered: closingCashEnteredCents,
      expectedClosingCash: expectedCash,
      variance,
      varianceStatus,
      closingNotes: 'Nightly 11:59 PM Auto-Close & Drawer Cleared (Automated EOD Cutoff)',
    };

    // 1. Update shift record in database
    db.update('shifts', (shifts) =>
      shifts.map((s) => (s.id === shift.id ? closedShift : s))
    );

    // 2. Clear activeShift if it points to this shift
    db.update('activeShift', (active) => {
      if (active?.id === shift.id) return null;
      return active;
    });

    // 3. Clear Cash Drawer: Record SHIFT_CLOSE cashout movement so register balance becomes 0
    if (closingCashEnteredCents > 0) {
      cashDrawerService.addTransaction({
        shiftId: shift.id,
        terminalId: shift.terminalId || 'POS-01',
        cashierId: shift.cashierId || 'system',
        cashierName: shift.cashierName || 'System Auto-Close',
        type: 'SHIFT_CLOSE',
        amount: -closingCashEnteredCents,
        reason: `Nightly 11:59 PM Auto-Close Cashout & Register Cleared - Shift #${shift.shiftNumber} (Counted: ${formatLKR(closingCashEnteredCents)}) • Balanced`,
        status: 'APPROVED',
      });
    }

    // 4. Ensure ledger balance repair sets closed shift balance to 0
    cashDrawerService.repairLedgerBalances();

    // 5. Record System Audit Log
    db.update('auditLogs', (logs) => [
      {
        id: `aud_${Date.now()}_autoclose_${shift.id}`,
        userId: shift.cashierId || 'system',
        userName: shift.cashierName || 'Automated Shift Scheduler',
        action: 'SHIFT_CLOSE',
        entity: 'CashierShift',
        entityId: shift.id,
        details: `Nightly 11:59 PM Auto-Close: Shift #${shift.shiftNumber} (${shift.cashierName}) automatically closed and cash drawer cleared (${formatLKR(closingCashEnteredCents)} cashed out to Rs. 0.00).`,
        terminalId: shift.terminalId || 'POS-01',
        timestamp: getSriLankaNowISO(now),
      },
      ...logs,
    ]);

    // 6. Broadcast Realtime WebSocket Events
    realtimeSocketService.emitShiftChanged(closedShift);
    realtimeSocketService.emitDatabaseSync();

    // 7. Handle Cashier Session: If currently signed in as a cashier on POS, log out to fresh login screen
    const session = authService.getCurrentSession();
    if (session && session.user.role === 'CASHIER') {
      if (session.user.id === shift.cashierId || shiftDate < todayYMD) {
        await authService.logout();
      }
    }

    // Dispatch global event for active components/tabs
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('nightly-shift-auto-closed', {
          detail: { shift: closedShift },
        })
      );
    }

    return closedShift;
  },

  /**
   * Scans all shifts and automatically closes any open shifts that are past 11:59 PM or from a previous day.
   */
  checkAndAutoClose: async (now: Date = new Date()): Promise<number> => {
    if (isProcessing) return 0;
    isProcessing = true;

    try {
      const data = db.getSnapshot();
      const settings = data.settings;

      // Allow disabling via system settings if explicitly set to false
      if (settings.autoCloseNightlyShifts === false) {
        return 0;
      }

      const openShifts = (data.shifts || []).filter((s) => s.status === 'OPEN');
      const overdueShifts = openShifts.filter((s) =>
        autoShiftCloseService.shouldShiftAutoClose(s, now)
      );

      let closedCount = 0;
      for (const shift of overdueShifts) {
        await autoShiftCloseService.autoCloseShift(shift, now);
        closedCount++;
      }

      // Also ensure cashier session expiry on day change / 11:59 PM cutoff
      const session = authService.getCurrentSession();
      if (session && session.user.role === 'CASHIER') {
        const { ymd: todayYMD, hours, minutes } = getSriLankaDateTimeParts(now);
        const loginDate = session.loginDate || toLocalYMD(session.loggedInAt || session.user.lastLoginAt);

        const isExpired =
          (loginDate && loginDate < todayYMD) ||
          (loginDate === todayYMD && (hours > 23 || (hours === 23 && minutes >= 59)));

        if (isExpired) {
          await authService.logout();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('nightly-shift-auto-closed'));
          }
        }
      }

      return closedCount;
    } catch (err) {
      console.error('Error during automated nightly shift close check:', err);
      return 0;
    } finally {
      isProcessing = false;
    }
  },

  /**
   * Initializes background polling and event listeners to trigger auto-close at 11:59 PM
   * or when the application is opened / focused the next day.
   */
  startWatcher: (): (() => void) => {
    if (typeof window === 'undefined') return () => {};

    // 1. Initial check immediately on start
    autoShiftCloseService.checkAndAutoClose();

    // 2. Poll every 10 seconds to catch 23:59:00 in real time
    const interval = setInterval(() => {
      autoShiftCloseService.checkAndAutoClose();
    }, 10000);

    // 3. Re-check on tab focus / wake from sleep / date rollover
    const handleFocus = () => {
      autoShiftCloseService.checkAndAutoClose();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        autoShiftCloseService.checkAndAutoClose();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  },
};
