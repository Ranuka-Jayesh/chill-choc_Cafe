import { db } from './storage/db';
import { Order, CashierShift } from '@/types';

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
}

export const reportService = {
  getDailyReport: (targetDateStr?: string): DailyReportSummary => {
    const data = db.getSnapshot();
    const today = new Date();
    const todayIso = today.toISOString().split('T')[0];
    const targetDate = targetDateStr || todayIso;

    const dayOrders = data.orders.filter((o) => {
      if (targetDateStr) {
        return o.createdAt.startsWith(targetDateStr);
      }
      const ordDate = new Date(o.createdAt);
      const isSameDay =
        ordDate.getFullYear() === today.getFullYear() &&
        ordDate.getMonth() === today.getMonth() &&
        ordDate.getDate() === today.getDate();
      return isSameDay || o.createdAt.startsWith(todayIso);
    });
    const completedOrders = dayOrders.filter((o) => o.status === 'COMPLETED');
    const refundedOrders = dayOrders.filter((o) => o.status === 'REFUNDED' || o.status === 'PARTIALLY_REFUNDED');

    let grossSalesCents = 0;
    let discountCents = 0;
    let cashSalesCents = 0;
    let cardSalesCents = 0;
    let qrSalesCents = 0;

    for (const order of dayOrders) {
      grossSalesCents += order.subtotalCents;
      discountCents += order.discountCents;

      if (order.status !== 'CANCELLED') {
        if (order.paymentMethod === 'CASH') {
          cashSalesCents += order.totalCents;
        } else if (order.paymentMethod === 'CARD') {
          cardSalesCents += order.totalCents;
        } else if (order.paymentMethod === 'QR') {
          qrSalesCents += order.totalCents;
        } else if (order.paymentMethod === 'SPLIT' && order.paymentSplits) {
          order.paymentSplits.forEach((sp) => {
            if (sp.method === 'CASH') cashSalesCents += sp.amountCents;
            if (sp.method === 'CARD') cardSalesCents += sp.amountCents;
            if (sp.method === 'QR') qrSalesCents += sp.amountCents;
          });
        }
      }
    }

    let refundsCents = 0;
    refundedOrders.forEach((o) => {
      refundsCents += o.refundedAmountCents || o.totalCents;
    });

    const netSalesCents = Math.max(0, grossSalesCents - discountCents - refundsCents);
    const orderCount = completedOrders.length;
    const avgOrderValueCents = orderCount > 0 ? Math.round(netSalesCents / orderCount) : 0;

    // Shift figures for today
    const dayShifts = data.shifts.filter((s) => s.businessDate === targetDate);
    let openingFloatCents = 0;
    let cashInCents = 0;
    let cashOutCents = 0;
    let cashRefundsCents = 0;
    let actualClosingCents = 0;
    let expectedClosingCents = 0;

    dayShifts.forEach((s) => {
      openingFloatCents += s.openingCash;
      cashInCents += s.cashIn;
      cashOutCents += s.cashOut;
      cashRefundsCents += s.cashRefunds;
      actualClosingCents += s.closingCashEntered || 0;
      expectedClosingCents += s.expectedClosingCash || (s.openingCash + s.cashSales + s.cashIn - s.cashRefunds - s.cashOut);
    });

    const varianceCents = actualClosingCents - expectedClosingCents;

    return {
      date: targetDate,
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
      cashRefundsCents,
      expectedClosingCents,
      actualClosingCents,
      varianceCents,
    };
  },

  getCategorySales: (): { categoryName: string; revenueCents: number; itemsCount: number }[] => {
    const data = db.getSnapshot();
    const categoryMap = new Map<string, { categoryName: string; revenueCents: number; itemsCount: number }>();

    data.categories.forEach((cat) => {
      categoryMap.set(cat.id, { categoryName: cat.name, revenueCents: 0, itemsCount: 0 });
    });

    data.orders.forEach((ord) => {
      if (ord.status === 'CANCELLED') return;
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
      const orderDate = o.createdAt.split('T')[0];
      return orderDate >= startDateStr && orderDate <= endDateStr;
    });
    const completedOrders = rangeOrders.filter((o) => o.status === 'COMPLETED');
    const refundedOrders = rangeOrders.filter((o) => o.status === 'REFUNDED' || o.status === 'PARTIALLY_REFUNDED');

    let grossSalesCents = 0;
    let discountCents = 0;
    let cashSalesCents = 0;
    let cardSalesCents = 0;
    let qrSalesCents = 0;

    for (const order of rangeOrders) {
      grossSalesCents += order.subtotalCents;
      discountCents += order.discountCents;

      if (order.status !== 'CANCELLED') {
        if (order.paymentMethod === 'CASH') {
          cashSalesCents += order.totalCents;
        } else if (order.paymentMethod === 'CARD') {
          cardSalesCents += order.totalCents;
        } else if (order.paymentMethod === 'QR') {
          qrSalesCents += order.totalCents;
        } else if (order.paymentMethod === 'SPLIT' && order.paymentSplits) {
          order.paymentSplits.forEach((sp) => {
            if (sp.method === 'CASH') cashSalesCents += sp.amountCents;
            if (sp.method === 'CARD') cardSalesCents += sp.amountCents;
            if (sp.method === 'QR') qrSalesCents += sp.amountCents;
          });
        }
      }
    }

    let refundsCents = 0;
    refundedOrders.forEach((o) => {
      refundsCents += o.refundedAmountCents || o.totalCents;
    });

    const netSalesCents = Math.max(0, grossSalesCents - discountCents - refundsCents);
    const orderCount = completedOrders.length;
    const avgOrderValueCents = orderCount > 0 ? Math.round(netSalesCents / orderCount) : 0;

    // Shift figures for range
    const rangeShifts = data.shifts.filter((s) => {
      const shiftDate = s.businessDate || s.openedAt.split('T')[0];
      return shiftDate >= startDateStr && shiftDate <= endDateStr;
    });
    let openingFloatCents = 0;
    let cashInCents = 0;
    let cashOutCents = 0;
    let cashRefundsCents = 0;
    let actualClosingCents = 0;
    let expectedClosingCents = 0;

    rangeShifts.forEach((s) => {
      openingFloatCents += s.openingCash;
      cashInCents += s.cashIn;
      cashOutCents += s.cashOut;
      cashRefundsCents += s.cashRefunds;
      actualClosingCents += s.closingCashEntered || 0;
      expectedClosingCents += s.expectedClosingCash || (s.openingCash + s.cashSales + s.cashIn - s.cashRefunds - s.cashOut);
    });

    const varianceCents = actualClosingCents - expectedClosingCents;

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
      cashRefundsCents,
      expectedClosingCents,
      actualClosingCents,
      varianceCents,
    };
  },

  getHourlySalesForRange: (startDateStr?: string, endDateStr?: string): { hour: string; salesCents: number; orders: number }[] => {
    const data = db.getSnapshot();
    const hours = ['08 AM', '09 AM', '10 AM', '11 AM', '12 PM', '01 PM', '02 PM', '03 PM', '04 PM', '05 PM', '06 PM', '07 PM', '08 PM', '09 PM'];
    
    const map = new Map<string, { salesCents: number; orders: number }>();
    hours.forEach((h) => map.set(h, { salesCents: 0, orders: 0 }));

    data.orders.forEach((ord) => {
      if (startDateStr && endDateStr) {
        const orderDate = ord.createdAt.split('T')[0];
        if (orderDate < startDateStr || orderDate > endDateStr) return;
      }
      try {
        const d = new Date(ord.createdAt);
        const h = d.getHours();
        let hourLabel = '08 AM';
        if (h === 8) hourLabel = '08 AM';
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

  getHourlySales: (): { hour: string; salesCents: number; orders: number }[] => {
    return reportService.getHourlySalesForRange();
  },
};
