import { db } from './storage/db';
import { realtimeSocketService } from './realtimeSocketService';
import { CashDrawerTransaction, CashDrawerTransactionType } from '@/types';

export const cashDrawerService = {
  getTransactions: (shiftId?: string): CashDrawerTransaction[] => {
    const txs = db.getSnapshot().drawerTransactions;
    if (!shiftId) return txs;
    return txs.filter((t) => t.shiftId === shiftId);
  },

  getCurrentDrawerBalance: (shiftId?: string): number => {
    const txs = cashDrawerService.getTransactions(shiftId);
    if (txs.length === 0) {
      if (shiftId) {
        const shift = db.getSnapshot().shifts.find((s) => s.id === shiftId);
        return shift?.openingCash || 0;
      }
      return 0;
    }
    return txs[0].balanceAfter; // latest transaction balance
  },

  addTransaction: (params: {
    shiftId: string;
    terminalId: string;
    cashierId: string;
    cashierName: string;
    type: CashDrawerTransactionType;
    amount: number; // in cents
    orderId?: string;
    orderNumber?: string;
    reason?: string;
    expenseCategory?: string;
  }): CashDrawerTransaction => {
    const allTxs = db.getSnapshot().drawerTransactions;
    const shiftTxs = allTxs.filter((t) => t.shiftId === params.shiftId);
    
    // Balance after this transaction
    const previousBalance = shiftTxs.length > 0 ? shiftTxs[0].balanceAfter : 0;
    const balanceAfter = previousBalance + params.amount;

    const newTx: CashDrawerTransaction = {
      id: `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      shiftId: params.shiftId,
      terminalId: params.terminalId,
      cashierId: params.cashierId,
      cashierName: params.cashierName,
      type: params.type,
      amount: params.amount,
      balanceAfter,
      orderId: params.orderId,
      orderNumber: params.orderNumber,
      reason: params.reason,
      expenseCategory: params.expenseCategory,
      timestamp: new Date().toISOString(),
    };

    // Prepend to transaction list (newest first)
    db.update('drawerTransactions', (txs) => [newTx, ...txs]);

    // Update active shift aggregate counters
    db.update('shifts', (shifts) =>
      shifts.map((s) => {
        if (s.id !== params.shiftId) return s;
        const updated = { ...s };
        if (params.type === 'CASH_SALE') {
          updated.cashSales += params.amount;
        } else if (params.type === 'CASH_IN') {
          updated.cashIn += params.amount;
        } else if (params.type === 'CASH_OUT') {
          updated.cashOut += Math.abs(params.amount);
        } else if (params.type === 'CASH_REFUND') {
          updated.cashRefunds += Math.abs(params.amount);
        } else if (params.type === 'CASH_DROP') {
          updated.cashDrops += Math.abs(params.amount);
        }
        return updated;
      })
    );

    // Also update activeShift in snapshot if matches
    const active = db.getSnapshot().activeShift;
    if (active && active.id === params.shiftId) {
      db.update('activeShift', (s) => {
        if (!s) return null;
        const updated = { ...s };
        if (params.type === 'CASH_SALE') {
          updated.cashSales += params.amount;
        } else if (params.type === 'CASH_IN') {
          updated.cashIn += params.amount;
        } else if (params.type === 'CASH_OUT') {
          updated.cashOut += Math.abs(params.amount);
        } else if (params.type === 'CASH_REFUND') {
          updated.cashRefunds += Math.abs(params.amount);
        } else if (params.type === 'CASH_DROP') {
          updated.cashDrops += Math.abs(params.amount);
        }
        return updated;
      });
    }

    realtimeSocketService.emitDrawerTransaction(newTx);

    // Log audit
    db.update('auditLogs', (logs) => [
      {
        id: `aud_${Date.now()}`,
        userId: params.cashierId,
        userName: params.cashierName,
        action: params.type as any,
        entity: 'CashDrawer',
        entityId: newTx.id,
        details: `${params.type}: Rs. ${(params.amount / 100).toFixed(2)}${params.reason ? ` - ${params.reason}` : ''}`,
        terminalId: params.terminalId,
        timestamp: new Date().toISOString(),
      },
      ...logs,
    ]);

    return newTx;
  },
};
