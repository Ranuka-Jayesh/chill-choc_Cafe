import { db } from './storage/db';
import { realtimeSocketService } from './realtimeSocketService';
import { catalogService } from './catalogService';
import { CashDrawerTransaction, CashDrawerTransactionType } from '@/types';
import { formatLKR, getSriLankaNowISO } from '@/utils/format';

export const cashDrawerService = {
  ensureClosedShiftsRecorded: (): void => {
    const shifts = db.getSnapshot().shifts || [];
    const txs = db.getSnapshot().drawerTransactions || [];
    let modified = false;
    const updatedTxs = [...txs];

    for (const s of shifts) {
      if (s.status === 'CLOSED' && (s.closingCashEntered || s.expectedClosingCash)) {
        const hasExplicitClose = updatedTxs.some(
          (t) => t.shiftId === s.id && t.type === 'SHIFT_CLOSE'
        );
        if (!hasExplicitClose) {
          const cashoutCents = s.closingCashEntered || s.expectedClosingCash || 0;
          if (cashoutCents > 0) {
            const closeTx: CashDrawerTransaction = {
              id: `ctx_close_${s.id}`,
              shiftId: s.id,
              terminalId: s.terminalId || 'POS-01',
              cashierId: s.cashierId,
              cashierName: s.cashierName,
              type: 'SHIFT_CLOSE',
              amount: -cashoutCents,
              balanceAfter: 0,
              reason: `Shift #${s.shiftNumber} Cashout & Register Close (Counted: ${formatLKR(cashoutCents)})${s.closingNotes ? ` • ${s.closingNotes}` : ''}${s.variance ? ` • ${s.varianceStatus || 'Variance'}: ${formatLKR(Math.abs(s.variance))}` : ' • Balanced'}`,
              timestamp: s.closedAt || getSriLankaNowISO(),
              status: 'APPROVED',
            };
            updatedTxs.push(closeTx);
            modified = true;
          }
        }
      }
    }

    if (modified) {
      updatedTxs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      db.update('drawerTransactions', () => updatedTxs);
    }
  },

  repairLedgerBalances: (): void => {
    const txs = db.getSnapshot().drawerTransactions || [];
    const shifts = db.getSnapshot().shifts || [];
    if (!txs.length) return;

    let modified = false;
    const txsByShift: Record<string, CashDrawerTransaction[]> = {};
    for (const t of txs) {
      if (!txsByShift[t.shiftId]) txsByShift[t.shiftId] = [];
      txsByShift[t.shiftId].push(t);
    }

    const updatedTxs: CashDrawerTransaction[] = [];

    for (const [shiftId, shiftTxs] of Object.entries(txsByShift)) {
      const shift = shifts.find((s) => s.id === shiftId);
      // Sort oldest first
      const sorted = [...shiftTxs].sort(
        (a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()
      );

      let runningBalance = shift ? (shift.openingCash || 0) : 0;
      for (const t of sorted) {
        if (t.status === 'REJECTED') {
          updatedTxs.push(t);
          continue;
        }

        let correctBalanceAfter = t.balanceAfter;
        if (t.type === 'OPENING_CASH') {
          runningBalance = t.amount;
          correctBalanceAfter = runningBalance;
        } else if (t.type === 'SHIFT_CLOSE') {
          runningBalance = 0;
          correctBalanceAfter = 0;
        } else if (t.status === 'PENDING_APPROVAL') {
          correctBalanceAfter = runningBalance;
        } else {
          runningBalance += t.amount;
          correctBalanceAfter = runningBalance;
        }

        if (t.balanceAfter !== correctBalanceAfter) {
          modified = true;
          updatedTxs.push({ ...t, balanceAfter: correctBalanceAfter });
        } else {
          updatedTxs.push(t);
        }
      }
    }

    if (modified) {
      updatedTxs.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
      db.update('drawerTransactions', () => updatedTxs);
    }
  },

  getTransactions: (shiftId?: string): CashDrawerTransaction[] => {
    cashDrawerService.ensureClosedShiftsRecorded();
    cashDrawerService.repairLedgerBalances();
    const txs = db.getSnapshot().drawerTransactions;
    if (!shiftId) return txs;
    return txs.filter((t) => t.shiftId === shiftId);
  },

  getPendingRequests: (shiftId?: string): CashDrawerTransaction[] => {
    const txs = db.getSnapshot().drawerTransactions;
    return txs.filter(
      (t) => t.status === 'PENDING_APPROVAL' && (!shiftId || t.shiftId === shiftId)
    );
  },

  getCurrentDrawerBalance: (shiftId?: string): number => {
    if (!shiftId) return 0;
    const shift = db.getSnapshot().shifts.find((s) => s.id === shiftId);
    if (shift) {
      if (shift.status === 'CLOSED') return 0;
      return (
        (shift.openingCash || 0) +
        (shift.cashSales || 0) +
        (shift.cashIn || 0) -
        (shift.cashRefunds || 0) -
        (shift.cashOut || 0) -
        (shift.cashDrops || 0)
      );
    }
    const txs = cashDrawerService.getTransactions(shiftId);
    const approvedTxs = txs
      .filter((t) => t.status !== 'PENDING_APPROVAL' && t.status !== 'REJECTED')
      .sort((a, b) => new Date(b.timestamp || (b as any).createdAt || 0).getTime() - new Date(a.timestamp || (a as any).createdAt || 0).getTime());
    return approvedTxs[0]?.balanceAfter || 0;
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
    status?: 'APPROVED' | 'PENDING_APPROVAL' | 'REJECTED';
  }): CashDrawerTransaction => {
    const allTxs = db.getSnapshot().drawerTransactions;
    const shiftTxs = allTxs
      .filter((t) => t.shiftId === params.shiftId && t.status !== 'PENDING_APPROVAL' && t.status !== 'REJECTED')
      .sort((a, b) => new Date(b.timestamp || (b as any).createdAt || 0).getTime() - new Date(a.timestamp || (a as any).createdAt || 0).getTime());
    
    const shift = db.getSnapshot().shifts.find((s) => s.id === params.shiftId);

    // Balance after this transaction
    const isPending = params.status === 'PENDING_APPROVAL';
    let balanceAfter = 0;

    if (params.type === 'OPENING_CASH') {
      balanceAfter = params.amount;
    } else if (params.type === 'SHIFT_CLOSE') {
      balanceAfter = 0;
    } else {
      const previousBalance = shiftTxs.length > 0
        ? shiftTxs[0].balanceAfter
        : (shift?.openingCash || 0);
      balanceAfter = isPending ? previousBalance : previousBalance + params.amount;
    }

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
      timestamp: getSriLankaNowISO(),
      status: params.status || 'APPROVED',
    };

    // Prepend to transaction list (newest first)
    db.update('drawerTransactions', (txs) => [newTx, ...txs]);

    if (!isPending) {
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
        details: `${params.type} (${params.status || 'APPROVED'}): Rs. ${(params.amount / 100).toFixed(2)}${params.reason ? ` - ${params.reason}` : ''}`,
        terminalId: params.terminalId,
        timestamp: new Date().toISOString(),
      },
      ...logs,
    ]);

    return newTx;
  },

  // Cashier submits Cash Out or Cash Drop request to Admin
  requestCashMovement: (params: {
    shiftId: string;
    terminalId: string;
    cashierId: string;
    cashierName: string;
    type: 'CASH_OUT' | 'CASH_DROP';
    amount: number; // positive cents from UI input
    reason: string;
    expenseCategory?: string;
  }): CashDrawerTransaction => {
    const tx = cashDrawerService.addTransaction({
      shiftId: params.shiftId,
      terminalId: params.terminalId,
      cashierId: params.cashierId,
      cashierName: params.cashierName,
      type: params.type,
      amount: -Math.abs(params.amount),
      reason: params.reason,
      expenseCategory: params.expenseCategory,
      status: 'PENDING_APPROVAL',
    });

    realtimeSocketService.emitDrawerRequestPending(tx);
    return tx;
  },

  // Admin approves pending Cash Out or Cash Drop request
  approveCashMovement: (params: {
    transactionId: string;
    adminId: string;
    adminName: string;
  }): CashDrawerTransaction => {
    let approvedTx: CashDrawerTransaction | null = null;

    db.update('drawerTransactions', (txs) => {
      // Find target transaction
      const targetIndex = txs.findIndex((t) => t.id === params.transactionId);
      if (targetIndex === -1) return txs;

      const target = txs[targetIndex];
      const previousBalance = cashDrawerService.getCurrentDrawerBalance(target.shiftId);
      const balanceAfter = previousBalance + target.amount; // target.amount is already negative

      const updated: CashDrawerTransaction = {
        ...target,
        status: 'APPROVED',
        balanceAfter,
        approvedByUserId: params.adminId,
        approvedByUserName: params.adminName,
        approvedAt: getSriLankaNowISO(),
      };

      approvedTx = updated;
      const copy = [...txs];
      copy[targetIndex] = updated;
      return copy;
    });

    if (!approvedTx) {
      throw new Error('Transaction not found or could not be approved.');
    }

    const tx: CashDrawerTransaction = approvedTx;

    // Deduct from shift aggregates
    db.update('shifts', (shifts) =>
      shifts.map((s) => {
        if (s.id !== tx.shiftId) return s;
        const updated = { ...s };
        if (tx.type === 'CASH_OUT') {
          updated.cashOut += Math.abs(tx.amount);
        } else if (tx.type === 'CASH_DROP') {
          updated.cashDrops += Math.abs(tx.amount);
        }
        return updated;
      })
    );

    const active = db.getSnapshot().activeShift;
    if (active && active.id === tx.shiftId) {
      db.update('activeShift', (s) => {
        if (!s) return null;
        const updated = { ...s };
        if (tx.type === 'CASH_OUT') {
          updated.cashOut += Math.abs(tx.amount);
        } else if (tx.type === 'CASH_DROP') {
          updated.cashDrops += Math.abs(tx.amount);
        }
        return updated;
      });
    }

    // If Cash Out, record in expenses table
    if (tx.type === 'CASH_OUT') {
      catalogService.addExpense({
        category: (tx.expenseCategory as any) || 'OTHER',
        title: tx.reason || 'Cash Out Expense',
        amountCents: Math.abs(tx.amount),
        paidViaDrawer: true,
        shiftId: tx.shiftId,
        cashierId: tx.cashierId,
        cashierName: tx.cashierName,
      });
    }

    realtimeSocketService.emitDrawerRequestApproved(tx);

    // Audit log
    db.update('auditLogs', (logs) => [
      {
        id: `aud_${Date.now()}`,
        userId: params.adminId,
        userName: params.adminName,
        action: 'DRAWER_REQUEST_APPROVED' as any,
        entity: 'CashDrawer',
        entityId: tx.id,
        details: `Approved ${tx.type} request of Rs. ${(Math.abs(tx.amount) / 100).toFixed(2)} for ${tx.cashierName}`,
        terminalId: tx.terminalId,
        timestamp: getSriLankaNowISO(),
      },
      ...logs,
    ]);

    return tx;
  },

  // Admin rejects pending Cash Out or Cash Drop request
  rejectCashMovement: (params: {
    transactionId: string;
    adminId: string;
    adminName: string;
    reason?: string;
  }): CashDrawerTransaction => {
    let rejectedTx: CashDrawerTransaction | null = null;

    db.update('drawerTransactions', (txs) => {
      const targetIndex = txs.findIndex((t) => t.id === params.transactionId);
      if (targetIndex === -1) return txs;

      const updated: CashDrawerTransaction = {
        ...txs[targetIndex],
        status: 'REJECTED',
        rejectedReason: params.reason || 'Rejected by administrator',
      };

      rejectedTx = updated;
      const copy = [...txs];
      copy[targetIndex] = updated;
      return copy;
    });

    if (!rejectedTx) {
      throw new Error('Transaction not found or could not be rejected.');
    }

    const tx: CashDrawerTransaction = rejectedTx;
    realtimeSocketService.emitDrawerRequestRejected(tx);

    // Audit log
    db.update('auditLogs', (logs) => [
      {
        id: `aud_${Date.now()}`,
        userId: params.adminId,
        userName: params.adminName,
        action: 'DRAWER_REQUEST_REJECTED' as any,
        entity: 'CashDrawer',
        entityId: tx.id,
        details: `Rejected ${tx.type} request of Rs. ${(Math.abs(tx.amount) / 100).toFixed(2)} for ${tx.cashierName}${params.reason ? ` - ${params.reason}` : ''}`,
        terminalId: tx.terminalId,
        timestamp: getSriLankaNowISO(),
      },
      ...logs,
    ]);

    return tx;
  },
};

