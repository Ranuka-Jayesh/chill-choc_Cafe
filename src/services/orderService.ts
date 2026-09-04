import { db } from './storage/db';
import { cashDrawerService } from './cashDrawerService';
import { inventoryService } from './inventoryService';
import { printerService } from './printerService';
import { realtimeSocketService } from './realtimeSocketService';
import { customerService } from './customerService';
import { directPrintService } from './directPrintService';
import { Order, OrderItem, PaymentMethod, PaymentSplit, OrderType, HeldOrder } from '@/types';
import { formatOrderNumber } from '@/utils/format';

export interface CreateOrderInput {
  shiftId: string;
  cashierId: string;
  cashierName: string;
  terminalId: string;
  orderType: OrderType;
  tableNumber?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  loyaltyPointsEarned?: number;
  loyaltyPointsRedeemed?: number;
  loyaltyDiscountCents?: number;
  items: OrderItem[];
  subtotalCents: number;
  discountCents: number;
  discountPercent?: number;
  discountReason?: string;
  serviceChargeCents: number;
  taxCents: number;
  totalCents: number;
  paymentMethod: PaymentMethod;
  paymentSplits?: PaymentSplit[];
  cashReceivedCents?: number;
  changeGivenCents?: number;
  cardReference?: string;
  qrReference?: string;
}

export const orderService = {
  getOrders: (): Order[] => {
    return db.getSnapshot().orders;
  },

  getOrderById: (id: string): Order | undefined => {
    return db.getSnapshot().orders.find((o) => o.id === id);
  },

  getHeldOrders: (): HeldOrder[] => {
    return db.getSnapshot().heldOrders || [];
  },

  holdOrder: (input: {
    items: OrderItem[];
    orderType: OrderType;
    tableNumber?: string;
    customerName?: string;
    customerPhone?: string;
    subtotalCents: number;
    discountCents: number;
    discountPercent?: number;
    discountReason?: string;
    serviceChargeCents: number;
    taxCents: number;
    totalCents: number;
    cashierId: string;
    cashierName: string;
    terminalId: string;
    holdLabel?: string;
  }): HeldOrder => {
    const nextHoldNum = db.getSnapshot().nextHoldNumber || 1;
    const holdLabel = input.holdLabel?.trim()
      ? input.holdLabel.trim()
      : `Hold #${nextHoldNum} • ${input.orderType === 'DINE_IN' ? `Table ${input.tableNumber || '01'}` : 'Takeaway'}`;

    const heldOrder: HeldOrder = {
      id: `hold_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      holdNumber: nextHoldNum,
      holdLabel,
      orderType: input.orderType,
      tableNumber: input.tableNumber,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      items: input.items,
      subtotalCents: input.subtotalCents,
      discountCents: input.discountCents,
      discountPercent: input.discountPercent,
      discountReason: input.discountReason,
      serviceChargeCents: input.serviceChargeCents,
      taxCents: input.taxCents,
      totalCents: input.totalCents,
      heldAt: new Date().toISOString(),
      heldByCashierId: input.cashierId,
      heldByCashierName: input.cashierName,
    };

    db.mutate((draft) => {
      draft.heldOrders = [heldOrder, ...(draft.heldOrders || [])];
      draft.nextHoldNumber = nextHoldNum + 1;
      draft.auditLogs.unshift({
        id: `aud_${Date.now()}`,
        userId: input.cashierId,
        userName: input.cashierName,
        action: 'ORDER_HOLD',
        entity: 'HeldOrder',
        entityId: heldOrder.id,
        details: `Held order #${heldOrder.holdNumber} (${heldOrder.items.length} items, Rs. ${(heldOrder.totalCents / 100).toFixed(2)}) - ${holdLabel}`,
        terminalId: input.terminalId,
        timestamp: new Date().toISOString(),
      });
    });

    realtimeSocketService.emitOrderHeld(heldOrder);

    return heldOrder;
  },

  deleteHeldOrder: (heldOrderId: string, userId: string, userName: string, terminalId: string): void => {
    const held = db.getSnapshot().heldOrders?.find((h) => h.id === heldOrderId);
    db.mutate((draft) => {
      draft.heldOrders = (draft.heldOrders || []).filter((h) => h.id !== heldOrderId);
      if (held) {
        draft.auditLogs.unshift({
          id: `aud_${Date.now()}`,
          userId,
          userName,
          action: 'ORDER_VOID',
          entity: 'HeldOrder',
          entityId: heldOrderId,
          details: `Voided held order #${held.holdNumber} (${held.holdLabel})`,
          terminalId,
          timestamp: new Date().toISOString(),
        });
      }
    });

    if (held) {
      realtimeSocketService.broadcast('ORDER_RESUMED', { heldOrderId });
    }
  },

  createOrder: async (input: CreateOrderInput): Promise<Order> => {
    const currentNum = db.getSnapshot().nextOrderNumber || 1045;
    const orderNumber = formatOrderNumber(currentNum);
    const orderId = `ord_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const now = new Date().toISOString();
    const settings = db.getSnapshot().settings;
    let earnedPoints = 0;
    const redeemedPoints = input.loyaltyPointsRedeemed || 0;

    const custPhone = input.customerPhone?.trim();
    const custId = input.customerId;

    const targetCustomer = custId
      ? customerService.getCustomerById(custId)
      : custPhone
      ? customerService.getCustomerByPhone(custPhone)
      : undefined;

    // Calculate earned points if customer attached, program active, AND NOT redeeming points
    // Points are only earned when cashier chooses Continue (no points redeemed on the order)
    if (
      targetCustomer &&
      redeemedPoints === 0 &&
      (settings.loyaltyProgramEnabled ?? true) &&
      input.totalCents >= (settings.loyaltyMinSpendToEarnCents || 0)
    ) {
      const spendPerPt = settings.loyaltySpendPerPointCents || 10000;
      if (spendPerPt > 0) {
        earnedPoints = Math.floor(input.totalCents / spendPerPt);
      }
    }

    const order: Order = {
      id: orderId,
      orderNumber,
      numericOrderNum: currentNum,
      shiftId: input.shiftId,
      cashierId: input.cashierId,
      cashierName: input.cashierName,
      terminalId: input.terminalId,
      orderType: input.orderType,
      tableNumber: input.tableNumber,
      customerId: targetCustomer?.id || input.customerId,
      customerName: targetCustomer?.name || input.customerName,
      customerPhone: targetCustomer?.phone || input.customerPhone,
      loyaltyPointsEarned: earnedPoints,
      loyaltyPointsRedeemed: redeemedPoints,
      loyaltyDiscountCents: input.loyaltyDiscountCents || 0,
      status: 'COMPLETED',
      items: input.items,
      subtotalCents: input.subtotalCents,
      discountCents: input.discountCents,
      discountPercent: input.discountPercent,
      discountReason: input.discountReason,
      serviceChargeCents: input.serviceChargeCents,
      taxCents: input.taxCents,
      totalCents: input.totalCents,
      paymentMethod: input.paymentMethod,
      paymentSplits: input.paymentSplits,
      cashReceivedCents: input.cashReceivedCents,
      changeGivenCents: input.changeGivenCents,
      cardReference: input.cardReference,
      qrReference: input.qrReference,
      isPaid: true,
      kotPrinted: true,
      receiptPrinted: true,
      createdAt: now,
      completedAt: now,
    };

    // Save order & increment nextOrderNumber
    db.mutate((draft) => {
      draft.orders.unshift(order);
      draft.nextOrderNumber = currentNum + 1;
    });

    // Execute Customer Ledger updates
    if (targetCustomer) {
      if (redeemedPoints > 0) {
        customerService.redeemPoints(
          targetCustomer.id,
          redeemedPoints,
          `Redeemed ${redeemedPoints} points for discount on ${orderNumber}`,
          orderId,
          orderNumber
        );
      }
      if (earnedPoints > 0) {
        customerService.addPoints(
          targetCustomer.id,
          earnedPoints,
          `Earned ${earnedPoints} points from order ${orderNumber}`,
          orderId,
          orderNumber
        );
      }

      // Update customer aggregates & last visit
      db.update('customers', (prev) =>
        (prev || []).map((c) =>
          c.id === targetCustomer!.id
            ? {
                ...c,
                totalSpentCents: (c.totalSpentCents || 0) + order.totalCents,
                totalOrders: (c.totalOrders || 0) + 1,
                lastVisit: now,
              }
            : c
        )
      );
    }

    // 1. Deduct ingredient stock based on recipes
    inventoryService.deductRecipeStockForOrder(order.items, order.orderNumber);

    // 2. Process Cash Drawer transaction if payment contains cash
    if (order.paymentMethod === 'CASH') {
      cashDrawerService.addTransaction({
        shiftId: order.shiftId,
        terminalId: order.terminalId,
        cashierId: order.cashierId,
        cashierName: order.cashierName,
        type: 'CASH_SALE',
        amount: order.totalCents,
        orderId: order.id,
        orderNumber: order.orderNumber,
        reason: `Cash Sale for ${order.orderNumber}`,
      });
      // Kick cash drawer
      printerService.openCashDrawer();
    } else if (order.paymentMethod === 'SPLIT' && order.paymentSplits) {
      const cashPortion = order.paymentSplits.find((s) => s.method === 'CASH');
      if (cashPortion && cashPortion.amountCents > 0) {
        cashDrawerService.addTransaction({
          shiftId: order.shiftId,
          terminalId: order.terminalId,
          cashierId: order.cashierId,
          cashierName: order.cashierName,
          type: 'CASH_SALE',
          amount: cashPortion.amountCents,
          orderId: order.id,
          orderNumber: order.orderNumber,
          reason: `Split Payment (Cash Portion) for ${order.orderNumber}`,
        });
        printerService.openCashDrawer();
      }
    }

    // 3. Update shift card/qr aggregates if paid digitally
    if (order.paymentMethod === 'CARD') {
      db.update('shifts', (shifts) =>
        shifts.map((s) => (s.id === order.shiftId ? { ...s, cardSales: s.cardSales + order.totalCents } : s))
      );
    } else if (order.paymentMethod === 'QR') {
      db.update('shifts', (shifts) =>
        shifts.map((s) => (s.id === order.shiftId ? { ...s, qrSales: s.qrSales + order.totalCents } : s))
      );
    } else if (order.paymentMethod === 'SPLIT' && order.paymentSplits) {
      const cardPortion = order.paymentSplits.find((s) => s.method === 'CARD');
      const qrPortion = order.paymentSplits.find((s) => s.method === 'QR');
      db.update('shifts', (shifts) =>
        shifts.map((s) => {
          if (s.id !== order.shiftId) return s;
          return {
            ...s,
            cardSales: s.cardSales + (cardPortion?.amountCents || 0),
            qrSales: s.qrSales + (qrPortion?.amountCents || 0),
          };
        })
      );
    }

    // 4. Automatically generate Kitchen Ticket (KOT)
    await printerService.printKitchenTicket(order);

    // 5. Automatically generate Customer Receipt
    await printerService.printCustomerReceipt(order);

    // 5b. Direct Silent Thermal Printing for XPrinter (via Windows Local Print Agent)
    if (directPrintService.isEnabled()) {
      if (settings.autoPrintReceipt ?? true) {
        directPrintService.printCustomerReceipt(order).catch((err) => {
          console.warn('[DirectPrint] Automatic receipt printing warning:', err);
        });
      }
      if (settings.autoPrintKOT ?? true) {
        directPrintService.printKitchenTicket(order).catch((err) => {
          console.warn('[DirectPrint] Automatic KOT printing warning:', err);
        });
      }
    }

    // 6. Log Audit
    db.update('auditLogs', (logs) => [
      {
        id: `aud_${Date.now()}`,
        userId: order.cashierId,
        userName: order.cashierName,
        action: 'ORDER_CREATE',
        entity: 'Order',
        entityId: order.id,
        details: `Created ${order.orderNumber} (${order.orderType}) Total: Rs. ${(order.totalCents / 100).toFixed(2)} [${order.paymentMethod}]`,
        terminalId: order.terminalId,
        timestamp: now,
      },
      ...logs,
    ]);

    // 7. Emit Realtime WebSocket Event across Cluster
    realtimeSocketService.emitOrderCreated(order);

    return order;
  },

  /**
   * Cashier submits a Refund Request to Admin for authorization.
   * Order status transitions to REFUND_PENDING and waits for Admin approval.
   */
  requestRefund: async (params: {
    orderId: string;
    reason: string;
    refundAmountCents?: number;
    userId: string;
    userName: string;
  }): Promise<Order> => {
    const order = orderService.getOrderById(params.orderId);
    if (!order) throw new Error('Order not found');

    const refundAmount = params.refundAmountCents || order.totalCents;

    const updatedOrder: Order = {
      ...order,
      status: 'REFUND_PENDING',
      refundStatus: 'PENDING_APPROVAL',
      refundReason: params.reason,
      refundedAmountCents: refundAmount,
      refundRequest: {
        requestedByUserId: params.userId,
        requestedByUserName: params.userName,
        requestedAt: new Date().toISOString(),
        reason: params.reason,
        amountCents: refundAmount,
      },
    };

    db.update('orders', (orders) =>
      orders.map((o) => (o.id === order.id ? updatedOrder : o))
    );

    // Log audit
    db.update('auditLogs', (logs) => [
      {
        id: `aud_${Date.now()}`,
        userId: params.userId,
        userName: params.userName,
        action: 'REFUND',
        entity: 'Order',
        entityId: order.id,
        details: `Cashier ${params.userName} submitted refund request for ${order.orderNumber} (Rs. ${(refundAmount / 100).toFixed(2)}). Reason: ${params.reason}`,
        terminalId: order.terminalId,
        timestamp: new Date().toISOString(),
      },
      ...logs,
    ]);

    // Emit Realtime WebSocket Events
    realtimeSocketService.emitOrderRefundRequested(updatedOrder);
    realtimeSocketService.emitOrderUpdated(updatedOrder);

    return updatedOrder;
  },

  /**
   * Admin approves and confirms the Refund Request.
   * Drawer transaction is recorded, stock returned, and order marked REFUNDED.
   */
  approveRefund: async (params: {
    orderId: string;
    adminId: string;
    adminName: string;
    notes?: string;
  }): Promise<Order> => {
    const order = orderService.getOrderById(params.orderId);
    if (!order) throw new Error('Order not found');

    const refundAmount = order.refundedAmountCents || order.refundRequest?.amountCents || order.totalCents;
    const isFullRefund = refundAmount >= order.totalCents;
    const newStatus = isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
    const reason = order.refundReason || order.refundRequest?.reason || 'Admin Approved Refund';

    const updatedOrder: Order = {
      ...order,
      status: newStatus,
      refundStatus: 'APPROVED',
      refundedAmountCents: refundAmount,
      refundReason: reason,
      refundApproval: {
        approvedByUserId: params.adminId,
        approvedByUserName: params.adminName,
        approvedAt: new Date().toISOString(),
        notes: params.notes,
      },
    };

    db.update('orders', (orders) =>
      orders.map((o) => (o.id === order.id ? updatedOrder : o))
    );

    // If order was paid by cash, record negative movement in cash drawer
    if (order.paymentMethod === 'CASH' || (order.paymentMethod === 'SPLIT' && order.paymentSplits?.some((p) => p.method === 'CASH'))) {
      cashDrawerService.addTransaction({
        shiftId: order.shiftId,
        terminalId: order.terminalId,
        cashierId: params.adminId,
        cashierName: params.adminName,
        type: 'CASH_REFUND',
        amount: -refundAmount,
        orderId: order.id,
        orderNumber: order.orderNumber,
        reason: `Approved Refund for ${order.orderNumber}: ${reason}`,
      });
    }

    // Return ingredients to inventory
    inventoryService.returnRecipeStockForRefund(order.items, order.orderNumber, reason);

    // Log audit
    db.update('auditLogs', (logs) => [
      {
        id: `aud_${Date.now()}`,
        userId: params.adminId,
        userName: params.adminName,
        action: 'REFUND',
        entity: 'Order',
        entityId: order.id,
        details: `Admin ${params.adminName} approved refund for ${order.orderNumber} (Rs. ${(refundAmount / 100).toFixed(2)}).`,
        terminalId: order.terminalId,
        timestamp: new Date().toISOString(),
      },
      ...logs,
    ]);

    // Emit Realtime WebSocket Events
    realtimeSocketService.emitOrderRefunded(updatedOrder);
    realtimeSocketService.emitOrderUpdated(updatedOrder);

    return updatedOrder;
  },

  /**
   * Admin rejects the Refund Request.
   * Order status is restored to COMPLETED.
   */
  rejectRefund: async (params: {
    orderId: string;
    adminId: string;
    adminName: string;
    rejectionReason?: string;
  }): Promise<Order> => {
    const order = orderService.getOrderById(params.orderId);
    if (!order) throw new Error('Order not found');

    const updatedOrder: Order = {
      ...order,
      status: 'COMPLETED',
      refundStatus: 'REJECTED',
      refundRejection: {
        rejectedByUserId: params.adminId,
        rejectedByUserName: params.adminName,
        rejectedAt: new Date().toISOString(),
        rejectionReason: params.rejectionReason,
      },
    };

    db.update('orders', (orders) =>
      orders.map((o) => (o.id === order.id ? updatedOrder : o))
    );

    // Log audit
    db.update('auditLogs', (logs) => [
      {
        id: `aud_${Date.now()}`,
        userId: params.adminId,
        userName: params.adminName,
        action: 'REFUND',
        entity: 'Order',
        entityId: order.id,
        details: `Admin ${params.adminName} rejected refund request for ${order.orderNumber}. Reason: ${params.rejectionReason || 'No reason provided'}`,
        terminalId: order.terminalId,
        timestamp: new Date().toISOString(),
      },
      ...logs,
    ]);

    // Emit Realtime WebSocket Events
    realtimeSocketService.emitOrderRefundRejected(updatedOrder);
    realtimeSocketService.emitOrderUpdated(updatedOrder);

    return updatedOrder;
  },

  refundOrder: async (params: {
    orderId: string;
    reason: string;
    refundAmountCents?: number;
    userId: string;
    userName: string;
  }): Promise<Order> => {
    const order = orderService.getOrderById(params.orderId);
    if (!order) throw new Error('Order not found');

    const refundAmount = params.refundAmountCents || order.totalCents;
    const isFullRefund = refundAmount >= order.totalCents;
    const newStatus = isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

    const updatedOrder: Order = {
      ...order,
      status: newStatus,
      refundStatus: 'APPROVED',
      refundedAmountCents: refundAmount,
      refundReason: params.reason,
      refundApproval: {
        approvedByUserId: params.userId,
        approvedByUserName: params.userName,
        approvedAt: new Date().toISOString(),
      },
    };

    db.update('orders', (orders) =>
      orders.map((o) => (o.id === order.id ? updatedOrder : o))
    );

    // If order was paid by cash, record negative movement in cash drawer
    if (order.paymentMethod === 'CASH' || (order.paymentMethod === 'SPLIT' && order.paymentSplits?.some((p) => p.method === 'CASH'))) {
      cashDrawerService.addTransaction({
        shiftId: order.shiftId,
        terminalId: order.terminalId,
        cashierId: params.userId,
        cashierName: params.userName,
        type: 'CASH_REFUND',
        amount: -refundAmount,
        orderId: order.id,
        orderNumber: order.orderNumber,
        reason: `Refund for ${order.orderNumber}: ${params.reason}`,
      });
    }

    // Return ingredients to inventory
    inventoryService.returnRecipeStockForRefund(order.items, order.orderNumber, params.reason);

    // Log audit
    db.update('auditLogs', (logs) => [
      {
        id: `aud_${Date.now()}`,
        userId: params.userId,
        userName: params.userName,
        action: 'REFUND',
        entity: 'Order',
        entityId: order.id,
        details: `Refunded Rs. ${(refundAmount / 100).toFixed(2)} on ${order.orderNumber}. Reason: ${params.reason}`,
        terminalId: order.terminalId,
        timestamp: new Date().toISOString(),
      },
      ...logs,
    ]);

    // Emit Realtime WebSocket Refund Event
    realtimeSocketService.emitOrderRefunded(updatedOrder);
    realtimeSocketService.emitOrderUpdated(updatedOrder);

    return updatedOrder;
  },
};
