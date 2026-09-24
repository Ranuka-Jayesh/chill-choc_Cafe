import { db } from './storage/db';
import { Order, CashierShift } from '@/types';

/**
 * Convert any ISO timestamp or Date input into Sri Lankan local YYYY-MM-DD.
 * Strictly pinned to Asia/Colombo so server/client timezone differences never skew dates.
 */
export const toLocalYMD = (dateInput?: string | number | Date | null): string => {
  if (!dateInput) return '';
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return dateInput;
  }
  const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (!d || isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
};

export interface DailyReportSummary {
  date: string;
  grossSalesCents: number;
  discountCents: number;
  refundsCents: number;
  netSalesCents: number;
  cashSalesCents: number;
  cardSalesCents: number;
  qrSalesCents: number;
  orderCount: number;
  avgOrderValueCents: number;
  openingFloatCents: number;
  cashInCents: number;
  cashOutCents: number;
  cashRefundsCents: number;
  expectedClosingCents: number;
  actualClosingCents: number;
  varianceCents: number;
  closedAuditedCount: number;
  liveDrawerBalanceCents: number;
}

export const reportService = {
  getDailyReport: (targetDateStr?: string): DailyReportSummary => {
    const todayLocal = toLocalYMD(new Date());
    const targetDate = targetDateStr ? toLocalYMD(targetDateStr) : todayLocal;
    return reportService.getReportForDateRange(targetDate, targetDate);
  },

  getCategorySales: (startDateStr?: string, endDateStr?: string): { categoryName: string; revenueCents: number; itemsCount: number }[] => {
    const data = db.getSnapshot();
    const categoryMap = new Map<string, { categoryName: string; revenueCents: number; itemsCount: number }>();

    data.categories.forEach((cat) => {
      categoryMap.set(cat.id, { categoryName: cat.name, revenueCents: 0, itemsCount: 0 });
    });

    data.orders.forEach((ord) => {
      if (ord.status === 'CANCELLED') return;
      if (startDateStr && endDateStr) {
        const orderDate = toLocalYMD(ord.createdAt);
        if (orderDate < startDateStr || orderDate > endDateStr) return;
      }
      ord.items.forEach((it) => {
        const prod = data.products.find((p) => p.id === it.productId);
        const catId = prod?.categoryId || 'cat_coffee';
        const entry = categoryMap.get(catId) || { categoryName: 'Other', revenueCents: 0, itemsCount: 0 };
        entry.revenueCents += it.itemTotalCents;
        entry.itemsCount += it.quantity;
        categoryMap.set(catId, entry);
      });
    });

    return Array.from(categoryMap.values()).filter((c) => c.itemsCount > 0);
  },

  getReportForDateRange: (startDateStr: string, endDateStr: string): DailyReportSummary => {
    const data = db.getSnapshot();

    const rangeOrders = data.orders.filter((o) => {
      const orderDate = toLocalYMD(o.createdAt);
      return orderDate >= startDateStr && orderDate <= endDateStr;
    });
    const completedOrders = rangeOrders.filter((o) => o.status === 'COMPLETED');
    const refundedOrders = rangeOrders.filter((o) => o.status === 'REFUNDED' || o.status === 'PARTIALLY_REFUNDED');

    let grossSalesCents = 0;
    let discountCents = 0;
    let grossCashSalesCents = 0;
    let grossCardSalesCents = 0;
    let grossQrSalesCents = 0;

    for (const order of rangeOrders) {
      if (order.status === 'CANCELLED') continue;

      grossSalesCents += order.subtotalCents;
      discountCents += order.discountCents;

      if (order.paymentMethod === 'CASH') {
        grossCashSalesCents += order.totalCents;
      } else if (order.paymentMethod === 'CARD') {
        grossCardSalesCents += order.totalCents;
      } else if (order.paymentMethod === 'QR') {
        grossQrSalesCents += order.totalCents;
      } else if (order.paymentMethod === 'SPLIT' && order.paymentSplits) {
        order.paymentSplits.forEach((sp) => {
          if (sp.method === 'CASH') grossCashSalesCents += sp.amountCents;
          if (sp.method === 'CARD') grossCardSalesCents += sp.amountCents;
          if (sp.method === 'QR') grossQrSalesCents += sp.amountCents;
        });
      }
    }

    let refundsCents = 0;
    let cashRefundsCents = 0;
    let cardRefundsCents = 0;
    let qrRefundsCents = 0;

    refundedOrders.forEach((o) => {
      const refAmt = o.refundedAmountCents || o.totalCents;
      refundsCents += refAmt;

      if (o.paymentMethod === 'CASH') {
        cashRefundsCents += refAmt;
      } else if (o.paymentMethod === 'CARD') {
        cardRefundsCents += refAmt;
      } else if (o.paymentMethod === 'QR') {
        qrRefundsCents += refAmt;
      } else if (o.paymentMethod === 'SPLIT' && o.paymentSplits && o.totalCents > 0) {
        const ratio = Math.min(1, refAmt / o.totalCents);
        o.paymentSplits.forEach((sp) => {
          if (sp.method === 'CASH') cashRefundsCents += Math.round(sp.amountCents * ratio);
          if (sp.method === 'CARD') cardRefundsCents += Math.round(sp.amountCents * ratio);
          if (sp.method === 'QR') qrRefundsCents += Math.round(sp.amountCents * ratio);
        });
      } else {
        cashRefundsCents += refAmt;
      }
    });

    const netSalesCents = Math.max(0, grossSalesCents - discountCents - refundsCents);
    const cashSalesCents = Math.max(0, grossCashSalesCents - cashRefundsCents);
    const cardSalesCents = Math.max(0, grossCardSalesCents - cardRefundsCents);
    const qrSalesCents = Math.max(0, grossQrSalesCents - qrRefundsCents);

    const orderCount = completedOrders.length;
    const avgOrderValueCents = orderCount > 0 ? Math.round(netSalesCents / orderCount) : 0;

    // Shift figures for range
    const rangeShifts = data.shifts.filter((s) => {
      const shiftDate = s.businessDate || toLocalYMD(s.openedAt);
      return shiftDate >= startDateStr && shiftDate <= endDateStr;
    });
    let openingFloatCents = 0;
    let cashInCents = 0;
    let cashOutCents = 0;
    let shiftCashRefunds = 0;
    let actualClosingCents = 0;
    let expectedClosingCents = 0;
    let varianceCents = 0;
    let closedAuditedCount = 0;

    rangeShifts.forEach((s) => {
      openingFloatCents += s.openingCash || 0;
      cashInCents += s.cashIn || 0;
      cashOutCents += s.cashOut || 0;
      shiftCashRefunds += s.cashRefunds || 0;

      // Only count closing cash and variance for shifts that were actually closed and counted
      if (s.status === 'CLOSED' && s.closingCashEntered !== null && s.closingCashEntered !== undefined) {
        actualClosingCents += s.closingCashEntered;
        const expected = s.expectedClosingCash !== null && s.expectedClosingCash !== undefined
          ? s.expectedClosingCash
          : ((s.openingCash || 0) + (s.cashSales || 0) + (s.cashIn || 0) - (s.cashRefunds || 0) - (s.cashOut || 0));
        expectedClosingCents += expected;
        varianceCents += (s.closingCashEntered - expected);
        closedAuditedCount += 1;
      }
    });

    const activeShift = data.activeShift || rangeShifts.find((s) => s.status === 'OPEN');
    const liveDrawerBalanceCents = activeShift
      ? ((activeShift.openingCash || 0) + (activeShift.cashSales || 0) + (activeShift.cashIn || 0) - (activeShift.cashRefunds || 0) - (activeShift.cashOut || 0))
      : 0;

    return {
      date: startDateStr === endDateStr ? startDateStr : `${startDateStr} to ${endDateStr}`,
      grossSalesCents,
      discountCents,
      refundsCents,
      netSalesCents,
      cashSalesCents,
      cardSalesCents,
      qrSalesCents,
      orderCount,
      avgOrderValueCents,
      openingFloatCents,
      cashInCents,
      cashOutCents,
      cashRefundsCents: shiftCashRefunds || cashRefundsCents,
      expectedClosingCents,
      actualClosingCents,
      varianceCents,
      closedAuditedCount,
      liveDrawerBalanceCents,
    };
  },

  getHourlySalesForRange: (startDateStr?: string, endDateStr?: string): { hour: string; salesCents: number; orders: number }[] => {
    const data = db.getSnapshot();
    const hours = ['08 AM', '09 AM', '10 AM', '11 AM', '12 PM', '01 PM', '02 PM', '03 PM', '04 PM', '05 PM', '06 PM', '07 PM', '08 PM', '09 PM'];
    
    const map = new Map<string, { salesCents: number; orders: number }>();
    hours.forEach((h) => map.set(h, { salesCents: 0, orders: 0 }));

    data.orders.forEach((ord) => {
      if (ord.status === 'CANCELLED') return;
      if (startDateStr && endDateStr) {
        const orderDate = toLocalYMD(ord.createdAt);
        if (orderDate < startDateStr || orderDate > endDateStr) return;
      }
      try {
        const d = new Date(ord.createdAt);
        const hourStr = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Colombo',
          hour: 'numeric',
          hourCycle: 'h23',
        }).format(d);
        const h = parseInt(hourStr, 10);
        let hourLabel = '08 AM';
        if (h <= 8) hourLabel = '08 AM';
        else if (h === 9) hourLabel = '09 AM';
        else if (h === 10) hourLabel = '10 AM';
        else if (h === 11) hourLabel = '11 AM';
        else if (h === 12) hourLabel = '12 PM';
        else if (h === 13) hourLabel = '01 PM';
        else if (h === 14) hourLabel = '02 PM';
        else if (h === 15) hourLabel = '03 PM';
        else if (h === 16) hourLabel = '04 PM';
        else if (h === 17) hourLabel = '05 PM';
        else if (h === 18) hourLabel = '06 PM';
        else if (h === 19) hourLabel = '07 PM';
        else if (h === 20) hourLabel = '08 PM';
        else if (h >= 21) hourLabel = '09 PM';

        const curr = map.get(hourLabel) || { salesCents: 0, orders: 0 };
        curr.salesCents += ord.totalCents;
        curr.orders += 1;
        map.set(hourLabel, curr);
      } catch {}
    });

    return hours.map((h) => {
      const entry = map.get(h) || { salesCents: 0, orders: 0 };
      return { hour: h, salesCents: entry.salesCents, orders: entry.orders };
    });
  },

  getHourlySales: (targetDateStr?: string): { hour: string; salesCents: number; orders: number }[] => {
    const todayLocal = toLocalYMD(new Date());
    const targetDate = targetDateStr ? toLocalYMD(targetDateStr) : todayLocal;
    return reportService.getHourlySalesForRange(targetDate, targetDate);
  },
};
