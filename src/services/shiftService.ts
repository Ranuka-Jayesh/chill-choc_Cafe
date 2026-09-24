import { db } from './storage/db';
import { cashDrawerService } from './cashDrawerService';
import { realtimeSocketService } from './realtimeSocketService';
import { CashierShift } from '@/types';
import { formatLKR, getSriLankaNowISO } from '@/utils/format';

import { toLocalYMD } from './reportService';
import { autoShiftCloseService } from './autoShiftCloseService';

function getLocalBusinessDate(date: Date = new Date()): string {
  return toLocalYMD(date);
}

export const shiftService = {
  getActiveShift: (cashierId?: string, terminalId?: string): CashierShift | null => {
    const data = db.getSnapshot();

    // 1. Check if data.activeShift is OPEN and matches criteria
    if (data.activeShift && data.activeShift.status === 'OPEN') {
      if (autoShiftCloseService.shouldShiftAutoClose(data.activeShift)) {
        setTimeout(() => autoShiftCloseService.checkAndAutoClose(), 0);
        return null;
      }
      const matchesCashier = !cashierId || data.activeShift.cashierId === cashierId;
      const matchesTerminal = !terminalId || data.activeShift.terminalId === terminalId;
      if (matchesCashier && matchesTerminal) {
        return data.activeShift;
      }
    }

    // 2. Look in shifts list for a currently OPEN shift strictly matching this cashier (and terminal)
    const matchingOpen = data.shifts.find(
      (s) =>
        s.status === 'OPEN' &&
        (!cashierId || s.cashierId === cashierId) &&
        (!terminalId || s.terminalId === terminalId)
    );

    if (matchingOpen) {
      if (autoShiftCloseService.shouldShiftAutoClose(matchingOpen)) {
        setTimeout(() => autoShiftCloseService.checkAndAutoClose(), 0);
        return null;
      }
      return matchingOpen;
    }

    return null;
  },

  getOrCreateActiveShift: (params: {
    cashierId: string;
    cashierName: string;
    terminalId?: string;
    terminalName?: string;
    openingCashCents?: number;
  }): CashierShift => {
    const existing = shiftService.getActiveShift(params.cashierId, params.terminalId);
    if (existing) return existing;

    const now = new Date();
    const shiftCount = db.getSnapshot().shifts.length + 1;
    const shiftId = `sh_${Date.now()}`;
    const businessDate = getLocalBusinessDate(now);
    const openingCash = params.openingCashCents || 0;

    const newShift: CashierShift = {
      id: shiftId,
      shiftNumber: 100 + shiftCount,
      cashierId: params.cashierId,
      cashierName: params.cashierName,
      terminalId: params.terminalId || 'term_01',
      terminalName: params.terminalName || 'Main Counter POS-01',
      businessDate,
      openedAt: getSriLankaNowISO(now),
      openingCash,
      cashSales: 0,
      cardSales: 0,
      qrSales: 0,
      cashIn: 0,
      cashOut: 0,
      cashRefunds: 0,
      cashDrops: 0,
      status: 'OPEN',
    };

    db.update('shifts', (shifts) => [newShift, ...shifts]);
    db.update('activeShift', () => newShift);

    if (openingCash > 0) {
      cashDrawerService.addTransaction({
        shiftId: newShift.id,
        terminalId: newShift.terminalId,
        cashierId: params.cashierId,
        cashierName: params.cashierName,
        type: 'OPENING_CASH',
        amount: openingCash,
        reason: 'Shift opening float',
      });
    }

    realtimeSocketService.emitShiftChanged(newShift);
    return newShift;
  },

  getAllShifts: (): CashierShift[] => {
    return db.getSnapshot().shifts;
  },

  getShiftById: (id: string): CashierShift | undefined => {
    return db.getSnapshot().shifts.find((s) => s.id === id);
  },

  openShift: async (params: {
    cashierId: string;
    cashierName: string;
    terminalId: string;
    terminalName: string;
    openingCashCents: number;
  }): Promise<CashierShift> => {
    const now = new Date();
    const shiftCount = db.getSnapshot().shifts.length + 1;
    const shiftId = `sh_${Date.now()}`;
    const businessDate = getLocalBusinessDate(now);

    const newShift: CashierShift = {
      id: shiftId,
      shiftNumber: 100 + shiftCount,
      cashierId: params.cashierId,
      cashierName: params.cashierName,
      terminalId: params.terminalId,
      terminalName: params.terminalName,
      businessDate,
      openedAt: getSriLankaNowISO(now),
      openingCash: params.openingCashCents,
      cashSales: 0,
      cardSales: 0,
      qrSales: 0,
      cashIn: 0,
      cashOut: 0,
      cashRefunds: 0,
      cashDrops: 0,
      status: 'OPEN',
    };

    // Close any previous lingering OPEN shift for this cashier or terminal first to keep database clean
    db.update('shifts', (shifts) => [
      newShift,
      ...shifts.map((s) => {
        if (
          s.status === 'OPEN' &&
          (s.cashierId === params.cashierId || s.terminalId === params.terminalId)
        ) {
          return {
            ...s,
            status: 'CLOSED' as const,
            closedAt: getSriLankaNowISO(now),
            closingNotes: 'Auto-closed on opening new shift',
          };
        }
        return s;
      }),
    ]);
    db.update('activeShift', () => newShift);

    // Record OPENING_CASH in cash drawer ledger
    if (params.openingCashCents > 0) {
      cashDrawerService.addTransaction({
        shiftId: newShift.id,
        terminalId: params.terminalId,
        cashierId: params.cashierId,
        cashierName: params.cashierName,
        type: 'OPENING_CASH',
        amount: params.openingCashCents,
        reason: 'Shift opening float',
      });
    }

    // Log audit
    db.update('auditLogs', (logs) => [
      {
        id: `aud_${Date.now()}`,
        userId: params.cashierId,
        userName: params.cashierName,
        action: 'SHIFT_OPEN',
        entity: 'CashierShift',
        entityId: newShift.id,
        details: `Shift #${newShift.shiftNumber} opened with Rs. ${(params.openingCashCents / 100).toFixed(2)} float`,
        terminalId: params.terminalId,
        timestamp: getSriLankaNowISO(now),
      },
      ...logs,
    ]);

    realtimeSocketService.emitShiftChanged(newShift);

    return newShift;
  },

  calculateExpectedCash: (shift: CashierShift): number => {
    return (
      (shift.openingCash || 0) +
      (shift.cashSales || 0) +
      (shift.cashIn || 0) -
      (shift.cashRefunds || 0) -
      (shift.cashOut || 0) -
      (shift.cashDrops || 0)
    );
  },

  closeShift: async (params: {
    shiftId?: string;
    closingCashEnteredCents?: number;
    closingNotes?: string;
    closedByUserId: string;
    closedByUserName: string;
  }): Promise<CashierShift> => {
    let shift = params.shiftId ? shiftService.getShiftById(params.shiftId) : null;
    if (!shift) {
      shift = shiftService.getActiveShift(params.closedByUserId);
    }
    if (!shift) {
      shift = shiftService.getOrCreateActiveShift({
        cashierId: params.closedByUserId,
        cashierName: params.closedByUserName,
      });
    }

    const expectedCash = shiftService.calculateExpectedCash(shift);
    const closingCashEnteredCents =
      params.closingCashEnteredCents !== undefined
        ? params.closingCashEnteredCents
        : expectedCash;
    const variance = closingCashEnteredCents - expectedCash;
    let varianceStatus: 'BALANCED' | 'SHORT' | 'OVER' = 'BALANCED';
    if (variance < 0) varianceStatus = 'SHORT';
    if (variance > 0) varianceStatus = 'OVER';

    const closedShift: CashierShift = {
      ...shift,
      closedAt: getSriLankaNowISO(),
      closingCashEntered: closingCashEnteredCents,
      expectedClosingCash: expectedCash,
      variance,
      varianceStatus,
      closingNotes: params.closingNotes || 'Cashier signed out',
      status: 'CLOSED',
    };

    // Update shift in database, auto-close any other lingering OPEN shifts for this user/terminal, and clear activeShift
    const targetShiftId = shift.id;
    db.update('shifts', (shifts) =>
      shifts.map((s) => {
        if (s.id === targetShiftId) return closedShift;
        if (
          s.status === 'OPEN' &&
          (s.cashierId === params.closedByUserId || (shift?.terminalId && s.terminalId === shift.terminalId))
        ) {
          return {
            ...s,
            status: 'CLOSED' as const,
            closedAt: closedShift.closedAt,
            closingNotes: 'Auto-closed with session end',
          };
        }
        return s;
      })
    );
    db.update('activeShift', () => null);

    // If there is a variance adjustment, create a ledger record
    if (variance !== 0) {
      cashDrawerService.addTransaction({
        shiftId: shift.id,
        terminalId: shift.terminalId,
        cashierId: params.closedByUserId,
        cashierName: params.closedByUserName,
        type: 'CLOSING_ADJUSTMENT',
        amount: variance,
        reason: `Reconciliation variance: ${varianceStatus} by Rs. ${Math.abs(variance / 100).toFixed(2)}${params.closingNotes ? ` (${params.closingNotes})` : ''}`,
      });
    }

    // Record the Shift Close Cashout movement in cash drawer ledger
    const cashoutCents = closingCashEnteredCents;
    if (cashoutCents > 0) {
      cashDrawerService.addTransaction({
        shiftId: shift.id,
        terminalId: shift.terminalId || 'POS-01',
        cashierId: params.closedByUserId,
        cashierName: params.closedByUserName,
        type: 'SHIFT_CLOSE',
        amount: -cashoutCents,
        reason: `Shift #${closedShift.shiftNumber} Cashout & Register Close (Counted: ${formatLKR(cashoutCents)})${params.closingNotes ? ` • ${params.closingNotes}` : ''}${variance !== 0 ? ` • ${varianceStatus} by ${formatLKR(Math.abs(variance))}` : ' • Balanced'}`,
        status: 'APPROVED',
      });
    }

    // Log audit
    db.update('auditLogs', (logs) => [
      {
        id: `aud_${Date.now()}`,
        userId: params.closedByUserId,
        userName: params.closedByUserName,
        action: 'SHIFT_CLOSE',
        entity: 'CashierShift',
        entityId: closedShift.id,
        details: `Shift #${closedShift.shiftNumber} closed. Expected: Rs. ${(expectedCash / 100).toFixed(2)}, Actual: Rs. ${(closingCashEnteredCents / 100).toFixed(2)}, Variance: Rs. ${(variance / 100).toFixed(2)} (${varianceStatus})`,
        terminalId: closedShift.terminalId,
        timestamp: getSriLankaNowISO(),
      },
      ...logs,
    ]);

    realtimeSocketService.emitShiftChanged(closedShift);

    return closedShift;
  },
};
