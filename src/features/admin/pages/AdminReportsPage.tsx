import React, { useState, useMemo } from 'react';
import { reportService } from '@/services/reportService';
import { catalogService } from '@/services/catalogService';
import { orderService } from '@/services/orderService';
import { cashDrawerService } from '@/services/cashDrawerService';
import { accountingService } from '@/services/accountingService';
import { formatLKR, formatDate, formatDateTime } from '@/utils/format';
import { MonthYearPicker, MonthYearValue } from '@/components/ui/MonthYearPicker';
import {
  BarChart3,
  Printer,
  Calendar,
  FileText,
  Sparkles,
  TrendingUp,
  Coins,
  CreditCard,
  DollarSign,
  ShoppingBag,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Layers,
  ChevronRight,
  Award,
  Zap,
  Wallet,
  Building2,
  Package,
  Users,
  Truck,
  Boxes,
  UserCheck,
  CircleDollarSign,
  History,
  ShieldCheck,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { toast } from 'sonner';

const PAYMENT_COLORS = ['#00A896', '#E99343'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

type SubPeriod = 'TODAY' | 'THIS_WEEK' | 'LAST_WEEK' | 'MONTH';

export const AdminReportsPage: React.FC = () => {
  const now = new Date();
  const [monthYear, setMonthYear] = useState<MonthYearValue>({
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1),
  });
  const [subPeriod, setSubPeriod] = useState<SubPeriod>('TODAY');
  const [hourlyMetric, setHourlyMetric] = useState<'sales' | 'orders'>('sales');

  // Compute startDate, endDate, and human readable label
  const { startDate, endDate, periodLabel, selectedYear, selectedMonth } = useMemo(() => {
    const sYear = monthYear.year !== 'ALL' ? parseInt(monthYear.year, 10) : now.getFullYear();
    const sMonth = monthYear.month !== 'ALL' ? parseInt(monthYear.month, 10) : now.getMonth() + 1;
    const monthStr = String(sMonth).padStart(2, '0');
    const daysInMonth = new Date(sYear, sMonth, 0).getDate();
    const monthName = MONTH_NAMES[sMonth - 1] || 'August';

    const isCurrentMonth = sYear === now.getFullYear() && sMonth === now.getMonth() + 1;

    if (subPeriod === 'TODAY') {
      const dayNum = isCurrentMonth ? now.getDate() : Math.min(26, daysInMonth);
      const dayStr = String(dayNum).padStart(2, '0');
      const todayDate = `${sYear}-${monthStr}-${dayStr}`;
      return {
        startDate: todayDate,
        endDate: todayDate,
        periodLabel: isCurrentMonth
          ? `Today (${dayNum} ${monthName.slice(0, 3)} ${sYear})`
          : `${dayNum} ${monthName.slice(0, 3)} ${sYear}`,
        selectedYear: sYear,
        selectedMonth: sMonth,
      };
    }

    if (subPeriod === 'THIS_WEEK') {
      let startDay = 1;
      let endDay = Math.min(7, daysInMonth);
      if (isCurrentMonth) {
        const dayOfWeek = now.getDay() || 7;
        startDay = Math.max(1, now.getDate() - dayOfWeek + 1);
        endDay = Math.min(daysInMonth, startDay + 6);
      } else {
        startDay = Math.max(1, daysInMonth - 6);
        endDay = daysInMonth;
      }
      const start = `${sYear}-${monthStr}-${String(startDay).padStart(2, '0')}`;
      const end = `${sYear}-${monthStr}-${String(endDay).padStart(2, '0')}`;
      return {
        startDate: start,
        endDate: end,
        periodLabel: `This Week (${startDay} ${monthName.slice(0, 3)} - ${endDay} ${monthName.slice(0, 3)})`,
        selectedYear: sYear,
        selectedMonth: sMonth,
      };
    }

    if (subPeriod === 'LAST_WEEK') {
      let startDay = 1;
      let endDay = 7;
      if (isCurrentMonth) {
        const dayOfWeek = now.getDay() || 7;
        const thisMon = now.getDate() - dayOfWeek + 1;
        startDay = Math.max(1, thisMon - 7);
        endDay = Math.min(daysInMonth, startDay + 6);
      } else {
        startDay = Math.max(1, daysInMonth - 13);
        endDay = Math.max(7, daysInMonth - 7);
      }
      const start = `${sYear}-${monthStr}-${String(startDay).padStart(2, '0')}`;
      const end = `${sYear}-${monthStr}-${String(endDay).padStart(2, '0')}`;
      return {
        startDate: start,
        endDate: end,
        periodLabel: `Last Week (${startDay} ${monthName.slice(0, 3)} - ${endDay} ${monthName.slice(0, 3)})`,
        selectedYear: sYear,
        selectedMonth: sMonth,
      };
    }

    // Full Month
    const start = `${sYear}-${monthStr}-01`;
    const end = `${sYear}-${monthStr}-${String(daysInMonth).padStart(2, '0')}`;
    return {
      startDate: start,
      endDate: end,
      periodLabel: `${monthName} ${sYear} (Full Month)`,
      selectedYear: sYear,
      selectedMonth: sMonth,
    };
  }, [monthYear, subPeriod, now.getFullYear(), now.getMonth(), now.getDate()]);

  // Query aggregated data for this range
  const dailyReport = reportService.getReportForDateRange(startDate, endDate);
  const categorySales = reportService.getCategorySales();
  const hourlyData = reportService.getHourlySalesForRange(startDate, endDate);
  const products = catalogService.getProducts();
  const orders = orderService.getOrders();
  const allExpenses = catalogService.getExpenses();

  // Accounting & Operations Data
  const employees = accountingService.getEmployees();
  const allEmployeePayments = accountingService.getEmployeePayments();
  const suppliers = accountingService.getSuppliers();
  const allPurchases = catalogService.getPurchases();

  const financialSummary = useMemo(() => {
    return accountingService.getFinancialSummary(selectedYear, selectedMonth);
  }, [selectedYear, selectedMonth]);

  // Filter expenses for this range
  const dayExpenses = useMemo(() => {
    return allExpenses.filter((e) => {
      const d = e.createdAt.split('T')[0];
      return d >= startDate && d <= endDate;
    });
  }, [allExpenses, startDate, endDate]);

  const totalDayExpensesCents = useMemo(() => {
    return dayExpenses.reduce((sum, e) => sum + (e.amountCents || 0), 0);
  }, [dayExpenses]);

  // 1. Employee Payments Statistics for Selected Range
  const employeeStats = useMemo(() => {
    const rangePayments = allEmployeePayments.filter((p) => {
      const d = (p.date || p.createdAt || '').split('T')[0];
      return d >= startDate && d <= endDate;
    });

    const totalDisbursedCents = rangePayments.reduce((s, p) => s + (p.amountCents || 0), 0);
    const salaryCents = rangePayments
      .filter((p) => p.paymentType === 'SALARY')
      .reduce((s, p) => s + (p.amountCents || 0), 0);
    const advanceCents = rangePayments
      .filter((p) => p.paymentType === 'ADVANCE')
      .reduce((s, p) => s + (p.amountCents || 0), 0);
    const otherCents = rangePayments
      .filter((p) => p.paymentType !== 'SALARY' && p.paymentType !== 'ADVANCE')
      .reduce((s, p) => s + (p.amountCents || 0), 0);

    const cashDisbursedCents = rangePayments
      .filter((p) => p.method === 'CASH')
      .reduce((s, p) => s + (p.amountCents || 0), 0);
    const bankDisbursedCents = rangePayments
      .filter((p) => p.method !== 'CASH')
      .reduce((s, p) => s + (p.amountCents || 0), 0);

    const breakdown = employees.map((emp) => {
      const empPayments = rangePayments.filter((p) => p.employeeId === emp.id);
      const paidCents = empPayments.reduce((s, p) => s + (p.amountCents || 0), 0);
      const advancesPaid = empPayments
        .filter((p) => p.paymentType === 'ADVANCE')
        .reduce((s, p) => s + (p.amountCents || 0), 0);
      const salaryPaid = empPayments
        .filter((p) => p.paymentType === 'SALARY')
        .reduce((s, p) => s + (p.amountCents || 0), 0);

      return {
        employee: emp,
        paymentsCount: empPayments.length,
        totalPaidCents: paidCents,
        advancesPaidCents: advancesPaid,
        salaryPaidCents: salaryPaid,
        lastPayment: empPayments[0],
      };
    });

    return {
      payments: rangePayments,
      totalDisbursedCents,
      salaryCents,
      advanceCents,
      otherCents,
      cashDisbursedCents,
      bankDisbursedCents,
      breakdown,
      paidEmployeesCount: breakdown.filter((e) => e.totalPaidCents > 0).length,
    };
  }, [employees, allEmployeePayments, startDate, endDate]);

  // 2. Suppliers Statistics for Selected Range
  const supplierStats = useMemo(() => {
    const rangePurchases = allPurchases.filter((p) => {
      const d = (p.purchaseDate || '').split('T')[0];
      return d >= startDate && d <= endDate;
    });

    const totalInvoicedCents = rangePurchases.reduce((s, p) => s + (p.totalCents || 0), 0);
    const totalPaidCents = rangePurchases.reduce((s, p) => s + (p.paidCents ?? p.totalCents), 0);
    const totalDueCents = rangePurchases.reduce(
      (s, p) => s + (p.dueCents ?? Math.max(0, p.totalCents - (p.paidCents ?? p.totalCents))),
      0
    );

    const breakdown = suppliers.map((sup) => {
      const supPurchases = rangePurchases.filter(
        (p) => p.supplierId === sup.id || p.supplierName?.toLowerCase() === sup.name?.toLowerCase()
      );
      const invoicedCents = supPurchases.reduce((s, p) => s + (p.totalCents || 0), 0);
      const paidCents = supPurchases.reduce((s, p) => s + (p.paidCents ?? p.totalCents), 0);
      const dueCents = supPurchases.reduce(
        (s, p) => s + (p.dueCents ?? Math.max(0, p.totalCents - (p.paidCents ?? p.totalCents))),
        0
      );

      return {
        supplier: sup,
        purchasesCount: supPurchases.length,
        invoicedCents,
        paidCents,
        dueCents,
        purchases: supPurchases,
      };
    });

    return {
      purchases: rangePurchases,
      totalInvoicedCents,
      totalPaidCents,
      totalDueCents,
      breakdown,
      activeSuppliersCount: breakdown.filter((s) => s.invoicedCents > 0).length,
    };
  }, [suppliers, allPurchases, startDate, endDate]);

  // 3. Supply Products & Procurement Statistics (Raw Materials & Stock Items)
  const supplyProductStats = useMemo(() => {
    const rangePurchases = allPurchases.filter((p) => {
      const d = (p.purchaseDate || '').split('T')[0];
      return d >= startDate && d <= endDate;
    });

    const productMap = new Map<
      string,
      {
        ingredientId: string;
        name: string;
        unit: string;
        totalQuantity: number;
        totalCostCents: number;
        suppliers: Set<string>;
        purchaseCount: number;
      }
    >();

    let totalProcurementSpendCents = 0;
    let totalUnitsProcured = 0;

    rangePurchases.forEach((po) => {
      (po.items || []).forEach((item) => {
        const key = item.ingredientName || item.ingredientId;
        if (!key) return;

        const current = productMap.get(key) || {
          ingredientId: item.ingredientId,
          name: item.ingredientName || 'Stock Material',
          unit: item.unit || 'units',
          totalQuantity: 0,
          totalCostCents: 0,
          suppliers: new Set<string>(),
          purchaseCount: 0,
        };

        current.totalQuantity += Number(item.quantity) || 0;
        current.totalCostCents += Number(item.totalCents) || 0;
        if (po.supplierName) current.suppliers.add(po.supplierName);
        current.purchaseCount += 1;

        totalProcurementSpendCents += Number(item.totalCents) || 0;
        totalUnitsProcured += Number(item.quantity) || 0;

        productMap.set(key, current);
      });
    });

    const list = Array.from(productMap.values())
      .map((p) => ({
        ...p,
        averageUnitCostCents: p.totalQuantity > 0 ? Math.round(p.totalCostCents / p.totalQuantity) : 0,
        spendSharePercent:
          totalProcurementSpendCents > 0 ? Math.round((p.totalCostCents / totalProcurementSpendCents) * 100) : 0,
        supplierList: Array.from(p.suppliers).join(', ') || 'Direct Supplier',
      }))
      .sort((a, b) => b.totalCostCents - a.totalCostCents);

    return {
      list,
      totalProcurementSpendCents,
      totalUnitsProcured,
      uniqueProductCount: list.length,
    };
  }, [allPurchases, startDate, endDate]);

  // Compute product sales list for the range
  const productSalesList = useMemo(() => {
    const productSalesMap = new Map<
      string,
      { id: string; name: string; category: string; quantity: number; revenueCents: number }
    >();

    orders.forEach((ord) => {
      if (ord.status === 'CANCELLED') return;
      const orderDate = ord.createdAt.split('T')[0];
      if (orderDate < startDate || orderDate > endDate) return;

      ord.items.forEach((it) => {
        const prod = products.find((p) => p.id === it.productId);
        const existing = productSalesMap.get(it.productId) || {
          id: it.productId,
          name: it.name,
          category: prod?.categoryId || 'General',
          quantity: 0,
          revenueCents: 0,
        };
        existing.quantity += it.quantity;
        existing.revenueCents += it.itemTotalCents;
        productSalesMap.set(it.productId, existing);
      });
    });

    return Array.from(productSalesMap.values()).sort((a, b) => b.revenueCents - a.revenueCents);
  }, [orders, products, startDate, endDate]);

  // Insights Calculations
  const peakHour = useMemo(() => {
    let peak = { hour: '12 PM', salesCents: 0, orders: 0 };
    hourlyData.forEach((h) => {
      if (h.salesCents > peak.salesCents) {
        peak = h;
      }
    });
    return peak;
  }, [hourlyData]);

  const topProduct = productSalesList.length > 0 ? productSalesList[0] : null;

  // Tender breakdown data for Pie Chart (Cash & Card)
  const tenderChartData = useMemo(() => {
    const total = dailyReport.netSalesCents || 1;
    return [
      { name: 'Cash', value: dailyReport.cashSalesCents, percent: Math.round((dailyReport.cashSalesCents / total) * 100) },
      { name: 'Card', value: dailyReport.cardSalesCents, percent: Math.round((dailyReport.cardSalesCents / total) * 100) },
    ].filter((t) => t.value > 0);
  }, [dailyReport]);

  // Hourly formatted for chart
  const formattedHourlyData = useMemo(() => {
    return hourlyData.map((h) => ({
      hour: h.hour,
      sales: h.salesCents / 100,
      orders: h.orders,
      rawSales: h.salesCents,
    }));
  }, [hourlyData]);

  // Trigger Print to PDF
  const handlePrintPDF = () => {
    window.print();
  };

  return (
    <div className="flex flex-col h-full w-full pb-4 animate-in fade-in min-h-0 space-y-3">
      {/* 1. TOP HEADER & MODERN CAPSULE PERIOD FILTER BAR (Fixed at top) */}
      <div className="flex-shrink-0 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-[#E9E0D5] shadow-xs">
        <div>
          <h2 className="text-base sm:text-lg font-black text-brand-brown-dark tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-brand-teal" />
            Executive Reports & Analytics
          </h2>
          <p className="text-xs text-text-secondary mt-0.5 flex items-center gap-1.5 font-medium">
            <span>Active Range:</span>
            <span className="font-extrabold text-brand-teal-dark bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full text-[11px]">
              {periodLabel}
            </span>
          </p>
        </div>

        {/* Action Controls: Month Capsule & Sub-period Pill Strip */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
          {/* A. Month / Year Dark Capsule Navigator (Image 2 style) */}
          <MonthYearPicker
            value={monthYear}
            onChange={(val) => {
              setMonthYear(val);
              setSubPeriod('MONTH');
            }}
          />

          {/* B. Sub-Period Switcher (Today, This Week, Last Week, Month) */}
          <div className="flex items-center gap-1 bg-[#FAF7F2] p-1 rounded-full border border-[#E0D7CC] shadow-xs">
            <button
              type="button"
              onClick={() => setSubPeriod('TODAY')}
              className={`px-3 py-1 text-xs font-black rounded-full transition-all cursor-pointer ${
                subPeriod === 'TODAY'
                  ? 'bg-[#251814] text-white shadow-xs'
                  : 'text-brand-brown hover:bg-cream-100'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setSubPeriod('THIS_WEEK')}
              className={`px-3 py-1 text-xs font-black rounded-full transition-all cursor-pointer ${
                subPeriod === 'THIS_WEEK'
                  ? 'bg-[#251814] text-white shadow-xs'
                  : 'text-brand-brown hover:bg-cream-100'
              }`}
            >
              This Week
            </button>
            <button
              type="button"
              onClick={() => setSubPeriod('LAST_WEEK')}
              className={`px-3 py-1 text-xs font-black rounded-full transition-all cursor-pointer ${
                subPeriod === 'LAST_WEEK'
                  ? 'bg-[#251814] text-white shadow-xs'
                  : 'text-brand-brown hover:bg-cream-100'
              }`}
            >
              Last Week
            </button>
            <button
              type="button"
              onClick={() => setSubPeriod('MONTH')}
              className={`px-3 py-1 text-xs font-black rounded-full transition-all cursor-pointer ${
                subPeriod === 'MONTH'
                  ? 'bg-[#251814] text-white shadow-xs'
                  : 'text-brand-brown hover:bg-cream-100'
              }`}
            >
              Month
            </button>
          </div>
        </div>
      </div>

      {/* Internal Scrollable Content Body */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1 pb-20 scrollbar-thin">
        {/* 2. TOP 4 EXECUTIVE KPI SUMMARY CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Net Sales Revenue */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E9E0D5] shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-text-muted">
              Net Sales Revenue
            </span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-brand-teal flex items-center justify-center border border-teal-100">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl sm:text-3xl font-black text-brand-teal-dark tabular-nums">
              {formatLKR(dailyReport.netSalesCents)}
            </div>
            <div className="flex items-center gap-2 text-[11px] font-semibold text-text-secondary mt-1">
              <span>Gross: {formatLKR(dailyReport.grossSalesCents)}</span>
              {dailyReport.discountCents > 0 && (
                <span className="text-status-warning font-bold">
                  -{formatLKR(dailyReport.discountCents)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Total Orders & Avg Order Value */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E9E0D5] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-text-muted">
              Orders & Avg Ticket
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-100">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl sm:text-3xl font-black text-brand-brown-dark tabular-nums">
              {dailyReport.orderCount} <span className="text-sm font-bold text-text-muted">orders</span>
            </div>
            <div className="text-[11px] font-semibold text-text-secondary mt-1">
              Avg Ticket: <span className="font-bold text-brand-brown-deep">{formatLKR(dailyReport.avgOrderValueCents)}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Operating Expenses & Cash Out */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E9E0D5] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-text-muted">
              Operating Expenses
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-status-danger flex items-center justify-center border border-rose-100">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl sm:text-3xl font-black text-status-danger tabular-nums">
              {formatLKR(totalDayExpensesCents)}
            </div>
            <div className="text-[11px] font-semibold text-text-secondary mt-1">
              {dayExpenses.length} transactions in this period
            </div>
          </div>
        </div>

        {/* Card 4: Drawer Closing & Variance Status */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E9E0D5] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-text-muted">
              Drawer Balance & Status
            </span>
            <div className="w-8 h-8 rounded-xl bg-cream-100 text-brand-brown flex items-center justify-center border border-[#E0D7CC]">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl sm:text-3xl font-black text-brand-brown-deep tabular-nums">
              {formatLKR(dailyReport.actualClosingCents || dailyReport.expectedClosingCents)}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold mt-1">
              {dailyReport.varianceCents === 0 ? (
                <span className="text-brand-teal flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Balanced Register
                </span>
              ) : dailyReport.varianceCents > 0 ? (
                <span className="text-emerald-700">+{formatLKR(dailyReport.varianceCents)} (Over)</span>
              ) : (
                <span className="text-status-danger">{formatLKR(dailyReport.varianceCents)} (Shortage)</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. INTERACTIVE VISUAL CHARTS ROW (Using Recharts) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Chart 1: Hourly Sales & Traffic Curve (7 Columns) */}
        <div className="lg:col-span-7 bg-white p-4 sm:p-5 rounded-2xl border border-[#E9E0D5] shadow-xs flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="font-extrabold text-sm text-brand-brown-dark flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-brand-teal" />
                Hourly Sales Velocity & Traffic
              </h3>
              <p className="text-[11px] text-text-secondary">
                Turnover distribution across cafe operating windows
              </p>
            </div>

            {/* Metric Toggle */}
            <div className="flex items-center gap-1 bg-[#FAF7F2] p-1 rounded-xl border border-[#E0D7CC] self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setHourlyMetric('sales')}
                className={`px-3 py-1 text-[11px] font-black rounded-lg transition-all cursor-pointer ${
                  hourlyMetric === 'sales'
                    ? 'bg-brand-teal text-white shadow-xs'
                    : 'text-text-secondary hover:bg-cream-100'
                }`}
              >
                Revenue (LKR)
              </button>
              <button
                type="button"
                onClick={() => setHourlyMetric('orders')}
                className={`px-3 py-1 text-[11px] font-black rounded-lg transition-all cursor-pointer ${
                  hourlyMetric === 'orders'
                    ? 'bg-brand-teal text-white shadow-xs'
                    : 'text-text-secondary hover:bg-cream-100'
                }`}
              >
                Order Volume
              </button>
            </div>
          </div>

          {/* Area Chart Container */}
          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={formattedHourlyData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00A896" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#00A896" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="ordersGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E99343" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#E99343" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0EAE1" vertical={false} />
                <XAxis
                  dataKey="hour"
                  tickLine={false}
                  axisLine={{ stroke: '#EAE3DA' }}
                  tick={{ fontSize: 10, fill: '#74645B', fontWeight: 600 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: '#74645B', fontWeight: 600 }}
                  tickFormatter={(val) => (hourlyMetric === 'sales' ? `Rs.${val}` : `${val}`)}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-[#1E1917]/95 text-white p-3 rounded-2xl shadow-xl border border-white/10 text-xs backdrop-blur-md">
                          <div className="font-extrabold text-[11px] text-white/70 mb-1">{label} Period</div>
                          <div className="font-black text-sm text-brand-teal">
                            Revenue: {formatLKR(data.rawSales)}
                          </div>
                          <div className="font-semibold text-xs text-white/90 mt-0.5">
                            Orders: {data.orders} tickets
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {hourlyMetric === 'sales' ? (
                  <Area
                    type="monotone"
                    dataKey="sales"
                    stroke="#00A896"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#salesGradient)"
                  />
                ) : (
                  <Area
                    type="monotone"
                    dataKey="orders"
                    stroke="#E99343"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#ordersGradient)"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Payment Method Breakdown (5 Columns) */}
        <div className="lg:col-span-5 bg-white p-4 sm:p-5 rounded-2xl border border-[#E9E0D5] shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-sm text-brand-brown-dark flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-brand-orange" />
              Payment Method Distribution
            </h3>
            <p className="text-[11px] text-text-secondary">
              Revenue collection breakdown by tender type
            </p>
          </div>

          <div className="h-56 sm:h-60 w-full relative flex items-center justify-center my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={tenderChartData.length > 0 ? tenderChartData : [{ name: 'No Sales', value: 1, percent: 0 }]}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {tenderChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PAYMENT_COLORS[index % PAYMENT_COLORS.length]} />
                  ))}
                  {tenderChartData.length === 0 && <Cell fill="#EAE3DA" />}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0];
                      return (
                        <div className="bg-[#1E1917]/95 text-white p-2.5 rounded-xl shadow-xl border border-white/10 text-xs">
                          <span className="font-bold">{data.name}: </span>
                          <span className="font-black text-brand-teal">{formatLKR(data.value as number)}</span>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Centered Donut Total Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] font-bold uppercase text-text-muted">Total Net</span>
              <span className="text-xs sm:text-sm font-black text-brand-brown-dark tabular-nums">
                {formatLKR(dailyReport.netSalesCents)}
              </span>
            </div>
          </div>

          {/* Custom Tender Legend Strip */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#EAE3DA]">
            <div className="p-2 bg-cream-50 rounded-xl border border-[#E0D7CC] text-center">
              <span className="text-[10px] font-bold text-text-secondary block">Cash Tendered</span>
              <span className="text-xs font-black text-brand-brown-dark tabular-nums">
                {formatLKR(dailyReport.cashSalesCents)}
              </span>
            </div>
            <div className="p-2 bg-cream-50 rounded-xl border border-[#E0D7CC] text-center">
              <span className="text-[10px] font-bold text-text-secondary block">Credit / Debit Card</span>
              <span className="text-xs font-black text-brand-brown-dark tabular-nums">
                {formatLKR(dailyReport.cardSalesCents)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. STRATEGIC CAFE INSIGHTS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Insight 1: Peak Rush Window */}
        <div className="bg-[#FAF7F2] p-4 rounded-2xl border border-[#E0D7CC] shadow-xs space-y-1.5">
          <div className="flex items-center gap-2 text-brand-orange">
            <Zap className="w-4 h-4 stroke-[2.5]" />
            <span className="text-xs font-black uppercase tracking-wider">Peak Sales Window</span>
          </div>
          <div className="text-base font-black text-brand-brown-dark">
            {peakHour.hour} Rush
          </div>
          <p className="text-[11px] text-text-secondary font-medium">
            Generated {formatLKR(peakHour.salesCents)} across {peakHour.orders} orders.
          </p>
        </div>

        {/* Insight 2: Top Champion Product */}
        <div className="bg-[#FAF7F2] p-4 rounded-2xl border border-[#E0D7CC] shadow-xs space-y-1.5">
          <div className="flex items-center gap-2 text-brand-teal">
            <Award className="w-4 h-4 stroke-[2.5]" />
            <span className="text-xs font-black uppercase tracking-wider">Top Menu Champion</span>
          </div>
          <div className="text-base font-black text-brand-brown-dark truncate">
            {topProduct ? topProduct.name : 'No items yet'}
          </div>
          <p className="text-[11px] text-text-secondary font-medium">
            {topProduct
              ? `${topProduct.quantity} units sold (${formatLKR(topProduct.revenueCents)})`
              : 'Record orders to generate item insights'}
          </p>
        </div>

        {/* Insight 3: Tender Dominance */}
        <div className="bg-[#FAF7F2] p-4 rounded-2xl border border-[#E0D7CC] shadow-xs space-y-1.5">
          <div className="flex items-center gap-2 text-amber-700">
            <Coins className="w-4 h-4 stroke-[2.5]" />
            <span className="text-xs font-black uppercase tracking-wider">Tender Preference</span>
          </div>
          <div className="text-base font-black text-brand-brown-dark">
            {dailyReport.cashSalesCents >= dailyReport.cardSalesCents
              ? 'Cash Preferred'
              : 'Card Preferred'}
          </div>
          <p className="text-[11px] text-text-secondary font-medium">
            Cash tender accounts for{' '}
            {dailyReport.netSalesCents > 0
              ? `${Math.round((dailyReport.cashSalesCents / dailyReport.netSalesCents) * 100)}%`
              : '0%'}{' '}
            of total volume.
          </p>
        </div>

        {/* Insight 4: Operating Net Margin */}
        <div className="bg-[#FAF7F2] p-4 rounded-2xl border border-[#E0D7CC] shadow-xs space-y-1.5">
          <div className="flex items-center gap-2 text-brand-brown">
            <Sparkles className="w-4 h-4 stroke-[2.5]" />
            <span className="text-xs font-black uppercase tracking-wider">Net Operating Income</span>
          </div>
          <div className="text-base font-black text-brand-teal-dark tabular-nums">
            {formatLKR(Math.max(0, dailyReport.netSalesCents - totalDayExpensesCents))}
          </div>
          <p className="text-[11px] text-text-secondary font-medium">
            Net Turnover after deducting Rs. {(totalDayExpensesCents / 100).toLocaleString()} operating expenses.
          </p>
        </div>
      </div>

      {/* 5. EXECUTIVE FINANCIAL STATEMENT & CASH FLOW SECTION */}
      <div className="bg-white rounded-2xl border border-[#E9E0D5] shadow-xs overflow-hidden">
        <div className="p-4 bg-cream-50/80 border-b border-[#EAE3DA] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand-teal/10 text-brand-teal flex items-center justify-center">
              <TrendingUp className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-sm font-black text-brand-brown-dark">Financial Performance & Cash Flow</h3>
              <p className="text-[11px] text-text-secondary font-medium">Income statement, operating outflows, and cash flow analysis</p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Net Margin & Profit Banner */}
          <div className="bg-[#FAF7F2] rounded-2xl p-4 border border-[#E2D8CC] flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-black uppercase text-brand-brown tracking-wider block">
                Net Operating Profit / Surplus
              </span>
              <div className="flex items-baseline gap-3 mt-0.5">
                <span
                  className={`text-2xl sm:text-3xl font-black font-mono tabular-nums ${
                    financialSummary.netProfitCents >= 0 ? 'text-status-success' : 'text-status-danger'
                  }`}
                >
                  {formatLKR(financialSummary.netProfitCents)}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-black border ${
                    financialSummary.netMarginPercent >= 0
                      ? 'bg-emerald-50 text-status-success border-emerald-200'
                      : 'bg-rose-50 text-status-danger border-rose-200'
                  }`}
                >
                  {financialSummary.netMarginPercent.toFixed(1)}% Margin
                </span>
              </div>
            </div>

            <div className="flex items-center gap-6 text-xs border-t sm:border-t-0 sm:border-l border-[#E2D8CC] pt-2 sm:pt-0 sm:pl-6">
              <div>
                <span className="text-[10px] uppercase font-bold text-text-muted block">Gross POS Sales</span>
                <span className="font-mono font-bold text-brand-teal text-sm">
                  {formatLKR(financialSummary.grossRevenueCents)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-text-muted block">Total Outflows</span>
                <span className="font-mono font-bold text-rose-600 text-sm">
                  {formatLKR(financialSummary.totalOutflowCents)}
                </span>
              </div>
            </div>
          </div>

          {/* Financial Breakdown Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Cost & Outflow Breakdown */}
            <div className="p-4 bg-[#FAF7F2] rounded-2xl border border-[#E0D7CC] space-y-2.5 text-xs">
              <h4 className="font-black text-brand-brown-dark uppercase text-[11px] tracking-wider border-b border-[#EAE3DA] pb-2">
                Operating Outflows & COGS
              </h4>
              <div className="flex justify-between">
                <span className="text-text-secondary">COGS (Stock Purchases):</span>
                <span className="font-bold font-mono text-brand-brown-dark tabular-nums">
                  {formatLKR(financialSummary.cogsPurchasesCents)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Employee Payroll & Advances:</span>
                <span className="font-bold font-mono text-brand-brown-dark tabular-nums">
                  {formatLKR(financialSummary.payrollDisbursedCents)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Operating & Utility Expenses:</span>
                <span className="font-bold font-mono text-rose-700 tabular-nums">
                  {formatLKR(financialSummary.operatingExpensesCents)}
                </span>
              </div>
              <div className="pt-2 border-t border-[#EAE3DA] flex justify-between font-black">
                <span>Total Deductions:</span>
                <span className="font-mono text-rose-700 tabular-nums">
                  {formatLKR(financialSummary.totalOutflowCents)}
                </span>
              </div>
            </div>

            {/* Physical Cash Flow Analysis */}
            <div className="p-4 bg-[#FAF7F2] rounded-2xl border border-[#E0D7CC] space-y-2.5 text-xs">
              <h4 className="font-black text-brand-brown-dark uppercase text-[11px] tracking-wider border-b border-[#EAE3DA] pb-2">
                Physical Cash Flow Analysis
              </h4>
              <div className="flex justify-between">
                <span className="text-text-secondary">Cash Sales Collected (Inflow):</span>
                <span className="font-bold font-mono text-brand-teal tabular-nums">
                  +{formatLKR(financialSummary.cashFlow.cashInOrdersCents)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Cash Supplier Disbursements:</span>
                <span className="font-bold font-mono text-brand-brown-dark tabular-nums">
                  -{formatLKR(financialSummary.cashFlow.cashOutPurchasesCents)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Cash Payroll Disbursements:</span>
                <span className="font-bold font-mono text-brand-brown-dark tabular-nums">
                  -{formatLKR(financialSummary.cashFlow.cashOutPayrollCents)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Cash Drawer Expenses:</span>
                <span className="font-bold font-mono text-brand-brown-dark tabular-nums">
                  -{formatLKR(financialSummary.cashFlow.cashOutExpensesCents)}
                </span>
              </div>
              <div className="pt-2 border-t border-[#EAE3DA] flex justify-between font-black">
                <span>Net Physical Cash Flow:</span>
                <span
                  className={`font-mono tabular-nums ${
                    financialSummary.cashFlow.totalCashInCents >= financialSummary.cashFlow.totalCashOutCents
                      ? 'text-brand-teal'
                      : 'text-rose-700'
                  }`}
                >
                  {formatLKR(
                    financialSummary.cashFlow.totalCashInCents - financialSummary.cashFlow.totalCashOutCents
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 6. EMPLOYEE PAYROLL & STAFF COMPENSATION SECTION */}
      <div className="bg-white rounded-2xl border border-[#E9E0D5] shadow-xs overflow-hidden">
        <div className="p-4 bg-cream-50/80 border-b border-[#EAE3DA] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand-teal/10 text-brand-teal flex items-center justify-center">
              <Users className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-sm font-black text-brand-brown-dark">Employee Payroll & Staff Compensation</h3>
              <p className="text-[11px] text-text-secondary font-medium">Disbursed salaries, wage advances, and staff ledger</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-cream-100 border border-[#E0D7CC] font-extrabold text-[10px] text-brand-brown">
            {employeeStats.paidEmployeesCount} of {employees.length} Staff Paid
          </span>
        </div>

        <div className="p-5 space-y-5">
          {/* Quick KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#FAF7F2] p-3 rounded-xl border border-[#E2D8CC]">
              <span className="text-[10px] font-black uppercase text-brand-brown tracking-wider block">
                Total Disbursed
              </span>
              <span className="text-base font-black font-mono text-brand-teal tabular-nums">
                {formatLKR(employeeStats.totalDisbursedCents)}
              </span>
              <span className="text-[10px] text-text-muted block mt-0.5">
                {employeeStats.payments.length} payout vouchers
              </span>
            </div>
            <div className="bg-[#FAF7F2] p-3 rounded-xl border border-[#E2D8CC]">
              <span className="text-[10px] font-black uppercase text-brand-brown tracking-wider block">
                Base Salary Paid
              </span>
              <span className="text-base font-black font-mono text-brand-brown-dark tabular-nums">
                {formatLKR(employeeStats.salaryCents)}
              </span>
              <span className="text-[10px] text-text-muted block mt-0.5">Monthly payroll</span>
            </div>
            <div className="bg-[#FAF7F2] p-3 rounded-xl border border-[#E2D8CC]">
              <span className="text-[10px] font-black uppercase text-brand-brown tracking-wider block">
                Salary Advances
              </span>
              <span className="text-base font-black font-mono text-amber-700 tabular-nums">
                {formatLKR(employeeStats.advanceCents)}
              </span>
              <span className="text-[10px] text-text-muted block mt-0.5">Mid-month advances</span>
            </div>
            <div className="bg-[#FAF7F2] p-3 rounded-xl border border-[#E2D8CC]">
              <span className="text-[10px] font-black uppercase text-brand-brown tracking-wider block">
                Payment Channels
              </span>
              <span className="text-xs font-black font-mono text-brand-brown-dark block">
                Cash: {formatLKR(employeeStats.cashDisbursedCents)}
              </span>
              <span className="text-[10px] text-text-muted block mt-0.5 font-mono">
                Bank: {formatLKR(employeeStats.bankDisbursedCents)}
              </span>
            </div>
          </div>

          {/* Staff Compensation Table */}
          <div className="border border-[#E0D7CC] rounded-xl overflow-hidden">
            <div className="bg-[#FAF7F2] px-4 py-2.5 border-b border-[#E0D7CC] font-black text-xs text-brand-brown-dark uppercase tracking-wider flex items-center justify-between">
              <span>Staff Compensation & Disbursements Ledger</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#EAE3DA] bg-[#FAF7F2]/60 text-text-muted font-black uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-4">Employee</th>
                    <th className="py-2.5 px-4">Role</th>
                    <th className="py-2.5 px-4 text-right">Base Salary</th>
                    <th className="py-2.5 px-4 text-right">Advances in Period</th>
                    <th className="py-2.5 px-4 text-right">Salary in Period</th>
                    <th className="py-2.5 px-4 text-right">Total Disbursed</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2ECE4] font-medium">
                  {employeeStats.breakdown.map((row) => (
                    <tr key={row.employee.id} className="hover:bg-[#FAF7F2]/60 transition-colors">
                      <td className="py-3 px-4 font-black text-brand-brown-dark">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-brand-brown/10 text-brand-brown flex items-center justify-center font-black text-xs shrink-0">
                            {row.employee.name.charAt(0)}
                          </div>
                          <div>
                            <div>{row.employee.name}</div>
                            <div className="text-[10px] text-text-muted font-normal">
                              {row.employee.bankName || 'Direct Payout'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-text-secondary">{row.employee.role}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold tabular-nums">
                        {formatLKR(row.employee.baseSalaryCents)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-amber-700 tabular-nums">
                        {row.advancesPaidCents > 0 ? formatLKR(row.advancesPaidCents) : '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-brand-teal tabular-nums">
                        {row.salaryPaidCents > 0 ? formatLKR(row.salaryPaidCents) : '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-brand-brown-dark tabular-nums">
                        {formatLKR(row.totalPaidCents)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            row.totalPaidCents >= row.employee.baseSalaryCents
                              ? 'bg-emerald-100 text-status-success'
                              : row.totalPaidCents > 0
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-cream-100 text-text-muted'
                          }`}
                        >
                          {row.totalPaidCents >= row.employee.baseSalaryCents
                            ? 'Fully Disbursed'
                            : row.totalPaidCents > 0
                            ? 'Partial / Advance'
                            : 'No Payouts'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payroll Transaction Vouchers */}
          {employeeStats.payments.length > 0 && (
            <div className="border border-[#E0D7CC] rounded-xl overflow-hidden">
              <div className="bg-[#FAF7F2] px-4 py-2.5 border-b border-[#E0D7CC] font-black text-xs text-brand-brown-dark uppercase tracking-wider flex items-center justify-between">
                <span>Logged Payroll Vouchers ({employeeStats.payments.length})</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#EAE3DA] bg-[#FAF7F2]/60 text-text-muted font-black uppercase text-[10px] tracking-wider">
                      <th className="py-2 px-4">Voucher #</th>
                      <th className="py-2 px-4">Date</th>
                      <th className="py-2 px-4">Employee</th>
                      <th className="py-2 px-4 text-center">Type</th>
                      <th className="py-2 px-4 text-center">Channel</th>
                      <th className="py-2 px-4 text-right">Amount (LKR)</th>
                      <th className="py-2 px-4">Notes / Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2ECE4] font-medium text-[11px]">
                    {employeeStats.payments.map((p) => (
                      <tr key={p.id} className="hover:bg-[#FAF7F2]/60 transition-colors">
                        <td className="py-2.5 px-4 font-mono font-bold text-text-muted">{p.referenceNumber || p.id}</td>
                        <td className="py-2.5 px-4 text-text-secondary">{formatDate(p.date || p.createdAt)}</td>
                        <td className="py-2.5 px-4 font-bold text-brand-brown-dark">{p.employeeName}</td>
                        <td className="py-2.5 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase ${
                              p.paymentType === 'SALARY'
                                ? 'bg-teal-100 text-teal-800'
                                : p.paymentType === 'ADVANCE'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-cream-100 text-brand-brown'
                            }`}
                          >
                            {p.paymentType}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-md bg-cream-100 font-bold text-[9.5px] text-text-secondary">
                            {p.method}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-brand-brown-deep tabular-nums">
                          {formatLKR(p.amountCents)}
                        </td>
                        <td className="py-2.5 px-4 text-text-muted truncate max-w-xs">{p.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 7. SUPPLIERS & PROCUREMENT PAYABLES SECTION */}
      <div className="bg-white rounded-2xl border border-[#E9E0D5] shadow-xs overflow-hidden">
        <div className="p-4 bg-cream-50/80 border-b border-[#EAE3DA] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand-teal/10 text-brand-teal flex items-center justify-center">
              <Truck className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-sm font-black text-brand-brown-dark">Suppliers & Invoicing Payables Ledger</h3>
              <p className="text-[11px] text-text-secondary font-medium">Vendor procurement, settled balances, and pending credit</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-cream-100 border border-[#E0D7CC] font-extrabold text-[10px] text-brand-brown">
            {supplierStats.breakdown.length} Suppliers Listed
          </span>
        </div>

        <div className="p-5 space-y-5">
          {/* Quick KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#FAF7F2] p-3 rounded-xl border border-[#E2D8CC]">
              <span className="text-[10px] font-black uppercase text-brand-brown tracking-wider block">
                Total Purchases (COGS)
              </span>
              <span className="text-base font-black font-mono text-brand-brown-dark tabular-nums">
                {formatLKR(supplierStats.totalInvoicedCents)}
              </span>
              <span className="text-[10px] text-text-muted block mt-0.5">
                {supplierStats.purchases.length} Purchase Orders
              </span>
            </div>
            <div className="bg-[#FAF7F2] p-3 rounded-xl border border-[#E2D8CC]">
              <span className="text-[10px] font-black uppercase text-brand-brown tracking-wider block">
                Settled Payments
              </span>
              <span className="text-base font-black font-mono text-brand-teal tabular-nums">
                {formatLKR(supplierStats.totalPaidCents)}
              </span>
              <span className="text-[10px] text-text-muted block mt-0.5">Paid supplier bills</span>
            </div>
            <div className="bg-[#FAF7F2] p-3 rounded-xl border border-[#E2D8CC]">
              <span className="text-[10px] font-black uppercase text-brand-brown tracking-wider block">
                Outstanding Due
              </span>
              <span
                className={`text-base font-black font-mono tabular-nums ${
                  supplierStats.totalDueCents > 0 ? 'text-rose-600' : 'text-status-success'
                }`}
              >
                {formatLKR(supplierStats.totalDueCents)}
              </span>
              <span className="text-[10px] text-text-muted block mt-0.5">Pending credit payables</span>
            </div>
            <div className="bg-[#FAF7F2] p-3 rounded-xl border border-[#E2D8CC]">
              <span className="text-[10px] font-black uppercase text-brand-brown tracking-wider block">
                Active Partners
              </span>
              <span className="text-base font-black text-brand-brown-dark block">
                {supplierStats.activeSuppliersCount} of {suppliers.length}
              </span>
              <span className="text-[10px] text-text-muted block mt-0.5">Vendors in period</span>
            </div>
          </div>

          {/* Supplier Ledger Table */}
          <div className="border border-[#E0D7CC] rounded-xl overflow-hidden">
            <div className="bg-[#FAF7F2] px-4 py-2.5 border-b border-[#E0D7CC] font-black text-xs text-brand-brown-dark uppercase tracking-wider flex items-center justify-between">
              <span>Suppliers Procurement & Payables Ledger</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#EAE3DA] bg-[#FAF7F2]/60 text-text-muted font-black uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-4">Supplier Partner</th>
                    <th className="py-2.5 px-4">Contact Info</th>
                    <th className="py-2.5 px-4 text-center">POs in Period</th>
                    <th className="py-2.5 px-4 text-right">Invoiced (LKR)</th>
                    <th className="py-2.5 px-4 text-right">Settled (LKR)</th>
                    <th className="py-2.5 px-4 text-right">Due Balance</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2ECE4] font-medium">
                  {supplierStats.breakdown.map((row) => (
                    <tr key={row.supplier.id} className="hover:bg-[#FAF7F2]/60 transition-colors">
                      <td className="py-3 px-4 font-black text-brand-brown-dark">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-brand-teal/10 text-brand-teal flex items-center justify-center font-black text-xs shrink-0">
                            <Truck className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div>{row.supplier.name}</div>
                            <div className="text-[10px] text-text-muted font-normal">
                              {row.supplier.contactPerson || 'Vendor'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-text-secondary text-[11px]">
                        <div>{row.supplier.phone || '-'}</div>
                        <div className="text-[10px] text-text-muted">{row.supplier.email}</div>
                      </td>
                      <td className="py-3 px-4 text-center font-bold font-mono text-brand-brown-deep tabular-nums">
                        {row.purchasesCount}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold tabular-nums">
                        {formatLKR(row.invoicedCents)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-brand-teal tabular-nums">
                        {formatLKR(row.paidCents)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black tabular-nums">
                        <span className={row.dueCents > 0 ? 'text-rose-600' : 'text-text-muted'}>
                          {formatLKR(row.dueCents)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            row.invoicedCents === 0
                              ? 'bg-cream-100 text-text-muted'
                              : row.dueCents === 0
                              ? 'bg-emerald-100 text-status-success'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {row.invoicedCents === 0
                            ? 'No Orders'
                            : row.dueCents === 0
                            ? 'Fully Settled'
                            : 'Balance Due'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* 8. SUPPLY PRODUCTS & RAW MATERIALS INTAKE SECTION */}
      <div className="bg-white rounded-2xl border border-[#E9E0D5] shadow-xs overflow-hidden">
        <div className="p-4 bg-cream-50/80 border-b border-[#EAE3DA] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand-teal/10 text-brand-teal flex items-center justify-center">
              <Boxes className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-sm font-black text-brand-brown-dark">Supply Products & Raw Materials Intake</h3>
              <p className="text-[11px] text-text-secondary font-medium">Coffee beans, dairy, syrups, ingredients & packaging procurement</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-cream-100 border border-[#E0D7CC] font-extrabold text-[10px] text-brand-brown">
            {supplyProductStats.list.length} Material Items
          </span>
        </div>

        <div className="p-5 space-y-5">
          {/* Quick KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#FAF7F2] p-3 rounded-xl border border-[#E2D8CC]">
              <span className="text-[10px] font-black uppercase text-brand-brown tracking-wider block">
                Total Supply Spend
              </span>
              <span className="text-base font-black font-mono text-brand-brown-dark tabular-nums">
                {formatLKR(supplyProductStats.totalProcurementSpendCents)}
              </span>
              <span className="text-[10px] text-text-muted block mt-0.5">Raw materials & packaging</span>
            </div>
            <div className="bg-[#FAF7F2] p-3 rounded-xl border border-[#E2D8CC]">
              <span className="text-[10px] font-black uppercase text-brand-brown tracking-wider block">
                Units Received
              </span>
              <span className="text-base font-black font-mono text-brand-teal tabular-nums">
                {supplyProductStats.totalUnitsProcured.toLocaleString()} units
              </span>
              <span className="text-[10px] text-text-muted block mt-0.5">Total incoming stock</span>
            </div>
            <div className="bg-[#FAF7F2] p-3 rounded-xl border border-[#E2D8CC]">
              <span className="text-[10px] font-black uppercase text-brand-brown tracking-wider block">
                Unique Supply Items
              </span>
              <span className="text-base font-black text-brand-brown-dark block">
                {supplyProductStats.uniqueProductCount} materials
              </span>
              <span className="text-[10px] text-text-muted block mt-0.5">Procured SKU count</span>
            </div>
            <div className="bg-[#FAF7F2] p-3 rounded-xl border border-[#E2D8CC]">
              <span className="text-[10px] font-black uppercase text-brand-brown tracking-wider block">
                Top Cost Driver
              </span>
              <span className="text-xs font-black text-brand-brown-deep block truncate">
                {supplyProductStats.list[0]?.name || 'N/A'}
              </span>
              <span className="text-[10px] text-brand-teal font-bold block mt-0.5">
                {supplyProductStats.list[0]?.spendSharePercent || 0}% of procurement spend
              </span>
            </div>
          </div>

          {/* Supply Products Table */}
          <div className="border border-[#E0D7CC] rounded-xl overflow-hidden">
            <div className="bg-[#FAF7F2] px-4 py-2.5 border-b border-[#E0D7CC] font-black text-xs text-brand-brown-dark uppercase tracking-wider flex items-center justify-between">
              <span>Supply Products & Material Intake Ledger</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#EAE3DA] bg-[#FAF7F2]/60 text-text-muted font-black uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-4 w-12 text-center">#</th>
                    <th className="py-2.5 px-4">Supply Material / Product</th>
                    <th className="py-2.5 px-4 text-center">Unit</th>
                    <th className="py-2.5 px-4 text-center">Qty Received</th>
                    <th className="py-2.5 px-4 text-right">Avg Unit Cost</th>
                    <th className="py-2.5 px-4 text-right">Total Spent (LKR)</th>
                    <th className="py-2.5 px-4">Supplying Vendor</th>
                    <th className="py-2.5 px-4 text-right w-32">Spend Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2ECE4] font-medium">
                  {supplyProductStats.list.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-text-muted">
                        No supply purchases logged for {periodLabel}.
                      </td>
                    </tr>
                  ) : (
                    supplyProductStats.list.map((item, idx) => (
                      <tr key={item.ingredientId || idx} className="hover:bg-[#FAF7F2]/60 transition-colors">
                        <td className="py-3 px-4 text-center font-bold text-text-muted text-[10px]">#{idx + 1}</td>
                        <td className="py-3 px-4 font-black text-brand-brown-dark">{item.name}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded bg-cream-100 font-bold text-[10px] text-brand-brown uppercase">
                            {item.unit}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-black text-brand-brown-deep tabular-nums">
                          {item.totalQuantity}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-text-secondary tabular-nums">
                          {formatLKR(item.averageUnitCostCents)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-black text-brand-teal-dark tabular-nums">
                          {formatLKR(item.totalCostCents)}
                        </td>
                        <td className="py-3 px-4 text-text-secondary text-[11px] truncate max-w-xs">
                          {item.supplierList}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-14 h-2 bg-cream-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-brand-teal rounded-full"
                                style={{ width: `${Math.min(100, item.spendSharePercent)}%` }}
                              />
                            </div>
                            <span className="font-extrabold text-[10px] text-text-secondary tabular-nums w-7">
                              {item.spendSharePercent}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* 9. MENU OFFERINGS & CATEGORY SALES SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left 2 Cols: Top Selling Menu Offerings */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E9E0D5] shadow-xs overflow-hidden">
          <div className="p-4 bg-cream-50/80 border-b border-[#EAE3DA] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-brand-teal/10 text-brand-teal flex items-center justify-center">
                <Award className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-sm font-black text-brand-brown-dark">Top Selling Menu Items</h3>
                <p className="text-[11px] text-text-secondary font-medium">Ranked by revenue contribution</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-cream-100 border border-[#E0D7CC] font-extrabold text-[10px] text-brand-brown">
              {productSalesList.length} Items Sold
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#EAE3DA] bg-[#FAF7F2] text-text-muted font-black uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3 w-10 text-center">Rank</th>
                  <th className="py-2.5 px-3">Menu Item</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3 text-center">Qty</th>
                  <th className="py-2.5 px-3 text-right">Revenue</th>
                  <th className="py-2.5 px-3 text-right w-28">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2ECE4] font-medium">
                {productSalesList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-text-muted">
                      No product sales recorded for {periodLabel}.
                    </td>
                  </tr>
                ) : (
                  productSalesList.slice(0, 10).map((prod, idx) => {
                    const sharePercent =
                      dailyReport.grossSalesCents > 0
                        ? Math.round((prod.revenueCents / dailyReport.grossSalesCents) * 100)
                        : 0;

                    return (
                      <tr key={prod.id || idx} className="hover:bg-[#FAF7F2]/60 transition-colors">
                        <td className="py-2.5 px-3 text-center font-bold text-text-muted">
                          <span
                            className={`w-5 h-5 rounded-full inline-flex items-center justify-center text-[9.5px] font-black ${
                              idx === 0
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : idx === 1
                                ? 'bg-zinc-200 text-zinc-800'
                                : idx === 2
                                ? 'bg-amber-50 text-amber-800'
                                : 'text-text-secondary'
                            }`}
                          >
                            #{idx + 1}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-black text-brand-brown-dark truncate max-w-[140px]">{prod.name}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full bg-cream-100 border border-[#E0D7CC] font-bold text-[9px] text-brand-brown uppercase">
                            {prod.category.replace(/cat_/g, '')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-black text-brand-brown-deep tabular-nums">
                          {prod.quantity}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-brand-teal-dark tabular-nums">
                          {formatLKR(prod.revenueCents)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <div className="w-12 h-1.5 bg-cream-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-brand-teal rounded-full"
                                style={{ width: `${Math.min(100, sharePercent)}%` }}
                              />
                            </div>
                            <span className="font-extrabold text-[9.5px] text-text-secondary tabular-nums w-6">
                              {sharePercent}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right 1 Col: Category Sales */}
        <div className="bg-white rounded-2xl border border-[#E9E0D5] shadow-xs overflow-hidden">
          <div className="p-4 bg-cream-50/80 border-b border-[#EAE3DA] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-brand-teal/10 text-brand-teal flex items-center justify-center">
                <Layers className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-sm font-black text-brand-brown-dark">Category Sales</h3>
                <p className="text-[11px] text-text-secondary font-medium">Departmental sales</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#EAE3DA] bg-[#FAF7F2] text-text-muted font-black uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3 text-center">Items</th>
                  <th className="py-2.5 px-3 text-right">Gross Sales</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2ECE4] font-medium">
                {categorySales.map((cat, idx) => (
                  <tr key={idx} className="hover:bg-[#FAF7F2]/60 transition-colors">
                    <td className="py-3 px-3 font-black text-brand-brown-dark">{cat.categoryName}</td>
                    <td className="py-3 px-3 text-center font-bold tabular-nums">{cat.itemsCount}</td>
                    <td className="py-3 px-3 text-right font-black text-brand-teal-dark tabular-nums">
                      {formatLKR(cat.revenueCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 10. CASH DRAWER RECONCILIATION & FLOAT AUDIT SECTION */}
      <div className="bg-white rounded-2xl border border-[#E9E0D5] shadow-xs overflow-hidden pb-16">
        <div className="p-4 bg-cream-50/80 border-b border-[#EAE3DA] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand-teal/10 text-brand-teal flex items-center justify-center">
              <Wallet className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-sm font-black text-brand-brown-dark">Cash Drawer Flow & Reconciliation</h3>
              <p className="text-[11px] text-text-secondary font-medium">Shift opening float, drawer payables, and count audit</p>
            </div>
          </div>
          <span
            className={`px-3 py-1 rounded-full font-black text-[10px] ${
              dailyReport.varianceCents === 0
                ? 'bg-teal-100 text-teal-800 border border-teal-200'
                : dailyReport.varianceCents > 0
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-rose-100 text-status-danger'
            }`}
          >
            {dailyReport.varianceCents === 0
              ? 'Drawer Balanced'
              : `${formatLKR(dailyReport.varianceCents)} Variance`}
          </span>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-[#FAF7F2] rounded-2xl border border-[#E0D7CC] space-y-2.5 text-xs">
              <h4 className="font-black text-brand-brown-dark uppercase text-[11px] tracking-wider border-b border-[#EAE3DA] pb-2">
                Drawer Inflows & Outflows
              </h4>
              <div className="flex justify-between">
                <span className="text-text-secondary">Opening Cash Float:</span>
                <span className="font-bold tabular-nums">{formatLKR(dailyReport.openingFloatCents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Cash Sales Collected:</span>
                <span className="font-bold text-brand-teal tabular-nums">+{formatLKR(dailyReport.cashSalesCents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Cash In (Float Additions):</span>
                <span className="font-bold text-status-success tabular-nums">+{formatLKR(dailyReport.cashInCents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Cash Out (Drawer Operating Expenses):</span>
                <span className="font-bold text-status-danger tabular-nums">-{formatLKR(dailyReport.cashOutCents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Cash Refunds Returned:</span>
                <span className="font-bold text-status-danger tabular-nums">-{formatLKR(dailyReport.cashRefundsCents)}</span>
              </div>
            </div>

            <div className="p-4 bg-[#FAF7F2] rounded-2xl border border-[#E0D7CC] space-y-2.5 text-xs">
              <h4 className="font-black text-brand-brown-dark uppercase text-[11px] tracking-wider border-b border-[#EAE3DA] pb-2">
                Closing Cash Count & Variance
              </h4>
              <div className="flex justify-between">
                <span className="text-text-secondary">Expected Closing Cash:</span>
                <span className="font-extrabold text-sm text-brand-brown-dark tabular-nums">
                  {formatLKR(dailyReport.expectedClosingCents)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Actual Counted Cash:</span>
                <span className="font-extrabold text-sm text-brand-brown-deep tabular-nums">
                  {formatLKR(dailyReport.actualClosingCents)}
                </span>
              </div>
              <div className="pt-2 border-t border-[#EAE3DA] flex justify-between items-center font-black text-sm">
                <span className="text-brand-brown-dark">Net Variance:</span>
                <span
                  className={`tabular-nums px-2.5 py-0.5 rounded-full text-xs ${
                    dailyReport.varianceCents === 0
                      ? 'bg-teal-100 text-teal-800'
                      : dailyReport.varianceCents > 0
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-status-danger'
                  }`}
                >
                  {dailyReport.varianceCents === 0
                    ? 'Rs. 0.00 (Balanced)'
                    : `${formatLKR(dailyReport.varianceCents)} (${dailyReport.varianceCents > 0 ? 'Over' : 'Short'})`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* 6. FLOATING BOTTOM-CENTER PDF EXPORT BUTTON */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center pointer-events-none select-none">
        <button
          type="button"
          onClick={handlePrintPDF}
          className="bg-[#1E1917]/95 text-white backdrop-blur-xl border border-white/10 shadow-2xl rounded-full p-1.5 pl-5 pr-1.5 flex items-center gap-3 active:scale-95 transition-all cursor-pointer pointer-events-auto group hover:border-brand-teal/40"
          title="Download PDF or Print Executive Statement"
        >
          <span className="text-xs font-bold text-white tracking-wide">
            Download PDF Report
          </span>
          <div className="w-10 h-10 rounded-full bg-brand-teal group-hover:bg-brand-teal-dark text-white flex items-center justify-center shadow-lg shadow-brand-teal/30 active:scale-95 transition-all shrink-0">
            <Printer className="w-5 h-5 stroke-[2.2]" />
          </div>
        </button>
      </div>

      {/* 7. HIDDEN PRINTABLE EXECUTIVE REPORT FOR PDF DOWNLOAD & DIRECT PRINT */}
      <div id="printable-report" className="hidden">
        <div
          style={{
            fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
            color: '#251814',
            backgroundColor: '#ffffff',
            padding: '8px 12px',
            position: 'relative',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '272mm',
          }}
        >
          {/* Subtle Watermark Logo */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0.035,
              pointerEvents: 'none',
              zIndex: 0,
            }}
          >
            <img src="/logobg.webp" alt="" style={{ width: '420px', height: 'auto', objectFit: 'contain' }} />
          </div>

          {/* Top Document Content */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            {/* Top Executive Letterhead */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                borderBottom: '2px solid #5C3528',
                paddingBottom: '10px',
                marginBottom: '12px',
                gap: '14px',
              }}
            >
              {/* Left: Prominent Cafe Logo & Business Details */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '3px' }}>
                  <img
                    src="/logobg.webp"
                    alt="Chill & Choc Logo"
                    style={{ height: '44px', width: 'auto', objectFit: 'contain' }}
                  />
                  <div>
                    <div
                      style={{
                        fontSize: '18px',
                        fontWeight: '900',
                        color: '#392A25',
                        letterSpacing: '0.4px',
                        lineHeight: '1.1',
                      }}
                    >
                      CHILL & CHOC CAFÉ
                    </div>
                    <div
                      style={{
                        fontSize: '9.5px',
                        fontWeight: '800',
                        color: '#E99343',
                        textTransform: 'uppercase',
                        letterSpacing: '0.8px',
                        marginTop: '1.5px',
                      }}
                    >
                      COOL VIBES, SWEET BITES
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '8.5px', color: '#555', lineHeight: '1.35' }}>
                  No. 42, Galle Road, Colombo 03, Sri Lanka<br />
                  <strong>Tel:</strong> +94 11 234 5678 &bull; <strong>Email:</strong> hello@chillandchoc.lk &bull; <strong>Web:</strong> www.chillandchoc.lk<br />
                  <strong>Tax Registration (VAT):</strong> VAT-LK-10928374
                </div>
              </div>

              {/* Right: Statement Metadata Badge Box */}
              <div
                style={{
                  minWidth: '220px',
                  backgroundColor: '#F8F0DF',
                  border: '1px solid #E0D7CC',
                  borderRadius: '8px',
                  padding: '7px 11px',
                  textAlign: 'right',
                }}
              >
                <div
                  style={{
                    fontSize: '10.5px',
                    fontWeight: '900',
                    color: '#5C3528',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  EXECUTIVE RECONCILIATION
                </div>
                <div style={{ fontSize: '8.5px', fontWeight: '700', color: '#875136', marginBottom: '3px' }}>
                  OFFICIAL BUSINESS STATEMENT
                </div>
                <div style={{ fontSize: '8px', color: '#444', lineHeight: '1.35' }}>
                  <div>Period: <strong>{periodLabel}</strong></div>
                  <div>Date Range: <strong>{startDate}</strong> to <strong>{endDate}</strong></div>
                  <div>Run Timestamp: {formatDateTime(new Date().toISOString())}</div>
                  <div style={{ color: '#00A896', fontWeight: '800', marginTop: '1px' }}>Status: AUDITED & BALANCED</div>
                </div>
              </div>
            </div>

            {/* Top 4 KPI Metric Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '12px' }}>
              <div style={{ backgroundColor: '#FAF7F2', border: '1px solid #E0D7CC', borderRadius: '7px', padding: '7px 9px' }}>
                <div style={{ fontSize: '8px', fontWeight: '800', color: '#74645B', textTransform: 'uppercase' }}>GROSS SALES</div>
                <div style={{ fontSize: '14.5px', fontWeight: '900', color: '#392A25', marginTop: '1.5px' }}>{formatLKR(dailyReport.grossSalesCents)}</div>
                <div style={{ fontSize: '7.5px', color: '#888', marginTop: '1px' }}>{dailyReport.orderCount} Orders Completed</div>
              </div>
              <div style={{ backgroundColor: '#FAF7F2', border: '1px solid #E0D7CC', borderRadius: '7px', padding: '7px 9px' }}>
                <div style={{ fontSize: '8px', fontWeight: '800', color: '#74645B', textTransform: 'uppercase' }}>DISCOUNTS & REFUNDS</div>
                <div style={{ fontSize: '14.5px', fontWeight: '900', color: '#E99343', marginTop: '1.5px' }}>
                  -{formatLKR(dailyReport.discountCents + dailyReport.refundsCents)}
                </div>
                <div style={{ fontSize: '7.5px', color: '#888', marginTop: '1px' }}>Net Price Reductions</div>
              </div>
              <div style={{ backgroundColor: '#FAF7F2', border: '1px solid #E0D7CC', borderRadius: '7px', padding: '7px 9px' }}>
                <div style={{ fontSize: '8px', fontWeight: '800', color: '#74645B', textTransform: 'uppercase' }}>OPERATING EXPENSES</div>
                <div style={{ fontSize: '14.5px', fontWeight: '900', color: '#dc2626', marginTop: '1.5px' }}>
                  -{formatLKR(totalDayExpensesCents)}
                </div>
                <div style={{ fontSize: '7.5px', color: '#888', marginTop: '1px' }}>{dayExpenses.length} Shift & Store Payouts</div>
              </div>
              <div
                style={{
                  backgroundColor: '#E6F6F4',
                  border: '1px solid #A3E4DD',
                  borderRadius: '7px',
                  padding: '7px 9px',
                }}
              >
                <div
                  style={{
                    fontSize: '8px',
                    fontWeight: '900',
                    color: '#00A896',
                    textTransform: 'uppercase',
                  }}
                >
                  NET OPERATING MARGIN
                </div>
                <div
                  style={{
                    fontSize: '14.5px',
                    fontWeight: '900',
                    color: '#00A896',
                    marginTop: '1.5px',
                  }}
                >
                  {formatLKR(dailyReport.netSalesCents - totalDayExpensesCents)}
                </div>
                <div
                  style={{
                    fontSize: '7.5px',
                    color: '#00A896',
                    fontWeight: '700',
                    marginTop: '1px',
                  }}
                >
                  Net Revenue - Expenses
                </div>
              </div>
            </div>

            {/* 1. EXECUTIVE FINANCIAL PERFORMANCE STATEMENT */}
            <div style={{ marginBottom: '11px' }}>
              <div
                style={{
                  fontSize: '9.5px',
                  fontWeight: '900',
                  color: '#5C3528',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  paddingBottom: '3.5px',
                  borderBottom: '1px solid #5C3528',
                  marginBottom: '5px',
                }}
              >
                1. EXECUTIVE FINANCIAL PERFORMANCE STATEMENT
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.5px' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #EDE5D8' }}>
                    <td style={{ padding: '3px 6px', color: '#555', width: '28%' }}>Gross Sales Turnover:</td>
                    <td style={{ padding: '3px 6px', textAlign: 'right', fontWeight: '800', width: '22%' }}>{formatLKR(dailyReport.grossSalesCents)}</td>
                    <td style={{ padding: '3px 6px', color: '#555', width: '28%', paddingLeft: '14px' }}>Total Order Volume:</td>
                    <td style={{ padding: '3px 6px', textAlign: 'right', fontWeight: '800', width: '22%' }}>{dailyReport.orderCount} tickets</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #EDE5D8', backgroundColor: '#FAF7F2' }}>
                    <td style={{ padding: '3px 6px', color: '#555' }}>Discounts & Promotions:</td>
                    <td style={{ padding: '3px 6px', textAlign: 'right', color: '#d97706', fontWeight: '800' }}>-{formatLKR(dailyReport.discountCents)}</td>
                    <td style={{ padding: '3px 6px', color: '#555', paddingLeft: '14px' }}>Average Ticket Basket:</td>
                    <td style={{ padding: '3px 6px', textAlign: 'right', fontWeight: '800' }}>{formatLKR(dailyReport.avgOrderValueCents)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #EDE5D8' }}>
                    <td style={{ padding: '3px 6px', color: '#555' }}>Customer Returns & Refunds:</td>
                    <td style={{ padding: '3px 6px', textAlign: 'right', color: '#dc2626', fontWeight: '800' }}>-{formatLKR(dailyReport.refundsCents)}</td>
                    <td style={{ padding: '3px 6px', color: '#555', paddingLeft: '14px' }}>Operating Expenses:</td>
                    <td style={{ padding: '3px 6px', textAlign: 'right', color: '#dc2626', fontWeight: '800' }}>-{formatLKR(totalDayExpensesCents)}</td>
                  </tr>
                  <tr style={{ backgroundColor: '#F8F0DF', fontWeight: '900', borderTop: '1px solid #E0D7CC' }}>
                    <td style={{ padding: '4px 6px', color: '#392A25' }}>Net Sales Revenue:</td>
                    <td style={{ padding: '4px 6px', textAlign: 'right', color: '#00A896', fontSize: '9px' }}>{formatLKR(dailyReport.netSalesCents)}</td>
                    <td style={{ padding: '4px 6px', color: '#392A25', paddingLeft: '14px' }}>Estimated Net Margin:</td>
                    <td style={{ padding: '4px 6px', textAlign: 'right', color: '#00A896', fontSize: '9px' }}>
                      {formatLKR(dailyReport.netSalesCents - totalDayExpensesCents)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 2. PAYMENT TENDER DISTRIBUTION */}
            <div style={{ marginBottom: '11px' }}>
              <div
                style={{
                  fontSize: '9.5px',
                  fontWeight: '900',
                  color: '#5C3528',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  paddingBottom: '3.5px',
                  borderBottom: '1px solid #5C3528',
                  marginBottom: '5px',
                }}
              >
                2. PAYMENT TENDER DISTRIBUTION
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.5px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#FAF7F2', borderBottom: '1px solid #E0D7CC', color: '#74645B' }}>
                    <th style={{ padding: '3px 6px' }}>Payment Method</th>
                    <th style={{ padding: '3px 6px', textAlign: 'right' }}>Collected Amount (LKR)</th>
                    <th style={{ padding: '3px 6px', textAlign: 'right', width: '120px' }}>Revenue Share (%)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #EDE5D8' }}>
                    <td style={{ padding: '3px 6px', fontWeight: '700' }}>Cash Tendered</td>
                    <td style={{ padding: '3px 6px', textAlign: 'right', fontWeight: '800' }}>{formatLKR(dailyReport.cashSalesCents)}</td>
                    <td style={{ padding: '3px 6px', textAlign: 'right', color: '#666' }}>
                      {dailyReport.netSalesCents > 0
                        ? `${Math.round((dailyReport.cashSalesCents / dailyReport.netSalesCents) * 100)}%`
                        : '0%'}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #EDE5D8', backgroundColor: '#FAF7F2' }}>
                    <td style={{ padding: '3px 6px', fontWeight: '700' }}>Credit / Debit Card</td>
                    <td style={{ padding: '3px 6px', textAlign: 'right', fontWeight: '800' }}>{formatLKR(dailyReport.cardSalesCents)}</td>
                    <td style={{ padding: '3px 6px', textAlign: 'right', color: '#666' }}>
                      {dailyReport.netSalesCents > 0
                        ? `${Math.round((dailyReport.cardSalesCents / dailyReport.netSalesCents) * 100)}%`
                        : '0%'}
                    </td>
                  </tr>
                  <tr style={{ backgroundColor: '#F8F0DF', fontWeight: '900', borderTop: '1px solid #E0D7CC' }}>
                    <td style={{ padding: '3.5px 6px', color: '#392A25' }}>Total Collections</td>
                    <td style={{ padding: '3.5px 6px', textAlign: 'right', color: '#00A896', fontSize: '9px' }}>{formatLKR(dailyReport.netSalesCents)}</td>
                    <td style={{ padding: '3.5px 6px', textAlign: 'right' }}>100%</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 3. CASH DRAWER RECONCILIATION LEDGER */}
            <div style={{ marginBottom: '11px' }}>
              <div
                style={{
                  fontSize: '9.5px',
                  fontWeight: '900',
                  color: '#5C3528',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  paddingBottom: '3.5px',
                  borderBottom: '1px solid #5C3528',
                  marginBottom: '5px',
                }}
              >
                3. CASH DRAWER RECONCILIATION LEDGER
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.5px' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #EDE5D8' }}>
                    <td style={{ padding: '3px 6px', color: '#555', width: '28%' }}>Opening Cash Float:</td>
                    <td style={{ padding: '3px 6px', textAlign: 'right', fontWeight: '800', width: '22%' }}>{formatLKR(dailyReport.openingFloatCents)}</td>
                    <td style={{ padding: '3px 6px', color: '#555', width: '28%', paddingLeft: '14px' }}>Expected Closing Cash:</td>
                    <td style={{ padding: '3px 6px', textAlign: 'right', fontWeight: '800', width: '22%' }}>{formatLKR(dailyReport.expectedClosingCents)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #EDE5D8', backgroundColor: '#FAF7F2' }}>
                    <td style={{ padding: '3px 6px', color: '#555' }}>Cash Sales Inflow:</td>
                    <td style={{ padding: '3px 6px', textAlign: 'right', color: '#16a34a', fontWeight: '800' }}>+{formatLKR(dailyReport.cashSalesCents)}</td>
                    <td style={{ padding: '3px 6px', color: '#555', paddingLeft: '14px' }}>Actual Counted Cash:</td>
                    <td style={{ padding: '3px 6px', textAlign: 'right', fontWeight: '800' }}>{formatLKR(dailyReport.actualClosingCents)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #EDE5D8' }}>
                    <td style={{ padding: '3px 6px', color: '#555' }}>Cash In (Float Additions):</td>
                    <td style={{ padding: '3px 6px', textAlign: 'right', color: '#16a34a', fontWeight: '800' }}>+{formatLKR(dailyReport.cashInCents)}</td>
                    <td style={{ padding: '3px 6px', color: '#555', paddingLeft: '14px' }}>Net Drawer Variance:</td>
                    <td
                      style={{
                        padding: '3px 6px',
                        textAlign: 'right',
                        color: dailyReport.varianceCents === 0 ? '#16a34a' : '#dc2626',
                        fontWeight: '900',
                      }}
                    >
                      {dailyReport.varianceCents === 0
                        ? 'Rs. 0.00 (Balanced)'
                        : `${formatLKR(dailyReport.varianceCents)} (${dailyReport.varianceCents > 0 ? 'Over' : 'Short'})`}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #EDE5D8', backgroundColor: '#FAF7F2' }}>
                    <td style={{ padding: '3px 6px', color: '#555' }}>Cash Out (Drawer Expenses):</td>
                    <td style={{ padding: '3px 6px', textAlign: 'right', color: '#dc2626', fontWeight: '800' }}>-{formatLKR(dailyReport.cashOutCents)}</td>
                    <td style={{ padding: '3px 6px', color: '#555', paddingLeft: '14px' }}>Cash Refunds Returned:</td>
                    <td style={{ padding: '3px 6px', textAlign: 'right', color: '#dc2626', fontWeight: '800' }}>-{formatLKR(dailyReport.cashRefundsCents)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 4. TOP SELLING MENU OFFERINGS */}
            <div style={{ marginBottom: '11px' }}>
              <div
                style={{
                  fontSize: '9.5px',
                  fontWeight: '900',
                  color: '#5C3528',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  paddingBottom: '3.5px',
                  borderBottom: '1px solid #5C3528',
                  marginBottom: '5px',
                }}
              >
                4. TOP SELLING MENU OFFERINGS
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.5px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#FAF7F2', borderBottom: '1px solid #E0D7CC', color: '#74645B' }}>
                    <th style={{ padding: '3px 6px', width: '35px' }}>Rank</th>
                    <th style={{ padding: '3px 6px' }}>Item Description</th>
                    <th style={{ padding: '3px 6px' }}>Category</th>
                    <th style={{ padding: '3px 6px', textAlign: 'center', width: '70px' }}>Qty Sold</th>
                    <th style={{ padding: '3px 6px', textAlign: 'right', width: '130px' }}>Gross Revenue (LKR)</th>
                  </tr>
                </thead>
                <tbody>
                  {productSalesList.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '6px', textAlign: 'center', color: '#999' }}>
                        No menu item sales recorded in this period.
                      </td>
                    </tr>
                  ) : (
                    productSalesList.slice(0, 8).map((prod, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #EDE5D8', backgroundColor: idx % 2 === 1 ? '#FAF7F2' : '#FFF' }}>
                        <td style={{ padding: '3px 6px', fontWeight: '800', color: '#888' }}>#{idx + 1}</td>
                        <td style={{ padding: '3px 6px', fontWeight: '800', color: '#392A25' }}>{prod.name}</td>
                        <td style={{ padding: '3px 6px', color: '#666' }}>{prod.category}</td>
                        <td style={{ padding: '3px 6px', textAlign: 'center', fontWeight: '800' }}>{prod.quantity}</td>
                        <td style={{ padding: '3px 6px', textAlign: 'right', fontWeight: '800', color: '#392A25' }}>{formatLKR(prod.revenueCents)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* 5. ITEMIZED OPERATING EXPENSES */}
            <div style={{ marginBottom: '11px' }}>
              <div
                style={{
                  fontSize: '9.5px',
                  fontWeight: '900',
                  color: '#5C3528',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  paddingBottom: '3.5px',
                  borderBottom: '1px solid #5C3528',
                  marginBottom: '5px',
                }}
              >
                5. ITEMIZED OPERATING EXPENSES
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.5px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#FAF7F2', borderBottom: '1px solid #E0D7CC', color: '#74645B' }}>
                    <th style={{ padding: '3px 6px' }}>Description</th>
                    <th style={{ padding: '3px 6px' }}>Category</th>
                    <th style={{ padding: '3px 6px' }}>Payment Method</th>
                    <th style={{ padding: '3px 6px', textAlign: 'right', width: '130px' }}>Amount (LKR)</th>
                  </tr>
                </thead>
                <tbody>
                  {dayExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: '6px', textAlign: 'center', color: '#999' }}>
                        No itemized operating expenses recorded for this period.
                      </td>
                    </tr>
                  ) : (
                    dayExpenses.slice(0, 6).map((exp, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #EDE5D8', backgroundColor: idx % 2 === 1 ? '#FAF7F2' : '#FFF' }}>
                        <td style={{ padding: '3px 6px', fontWeight: '700', color: '#392A25' }}>{exp.title}</td>
                        <td style={{ padding: '3px 6px', color: '#666' }}>{exp.category}</td>
                        <td style={{ padding: '3px 6px', color: '#666' }}>{exp.paidViaDrawer ? 'POS Drawer Cash Out' : 'Direct Payout'}</td>
                        <td style={{ padding: '3px 6px', textAlign: 'right', fontWeight: '800', color: '#dc2626' }}>
                          {formatLKR(exp.amountCents)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Running Footer (Exact user specifications: www.ogotechnology.net • Trusted Technology Studio • +94 75 930 7059) */}
          <div
            style={{
              marginTop: 'auto',
              paddingTop: '8px',
              borderTop: '1.5px solid #5C3528',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '8px',
              color: '#555',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <div>
              <span style={{ fontWeight: '800', color: '#392A25' }}>CHILL & CHOC CAFÉ</span> &bull; No. 42, Galle Road, Colombo 03, Sri Lanka &bull; +94 11 234 5678 &bull; www.chillandchoc.lk
            </div>
            <div style={{ textAlign: 'right' }}>
              <span>System Powered & Developed by </span>
              <strong style={{ color: '#392A25' }}>OGOTECHNOLOGY (PVT) LTD</strong>
              {' '}&bull;{' '}
              <a
                href="https://www.ogotechnology.net"
                target="_blank"
                rel="noreferrer"
                style={{ color: '#E99343', textDecoration: 'none', fontWeight: '800' }}
              >
                www.ogotechnology.net
              </a>
              {' '}&bull;{' '}
              <span style={{ color: '#5C3528', fontWeight: '700' }}>Trusted Technology Studio</span>
              {' '}&bull;{' '}
              <strong style={{ color: '#392A25' }}>+94 75 930 7059</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
