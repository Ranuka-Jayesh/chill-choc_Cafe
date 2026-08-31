import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { reportService } from '@/services/reportService';
import { shiftService } from '@/services/shiftService';
import { cashDrawerService } from '@/services/cashDrawerService';
import { inventoryService } from '@/services/inventoryService';
import { orderService } from '@/services/orderService';
import { catalogService } from '@/services/catalogService';
import { realtimeSocketService } from '@/services/realtimeSocketService';
import { db } from '@/services/storage/db';
import { formatLKR, formatTime } from '@/utils/format';
import { differenceInDays, startOfDay, parseISO } from 'date-fns';
import { toast } from 'sonner';
import {
  TrendingUp,
  ShoppingBag,
  Coins,
  CreditCard,
  Boxes,
  Clock,
  CheckCircle2,
  ChevronRight,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

export const AdminDashboardPage: React.FC = () => {
  const [dailySummary, setDailySummary] = useState(reportService.getDailyReport());
  const [hourlySales, setHourlySales] = useState(reportService.getHourlySales());
  const [activeShift, setActiveShift] = useState(shiftService.getActiveShift());
  const [ingredients, setIngredients] = useState(inventoryService.getIngredients());
  const [recentOrders, setRecentOrders] = useState(orderService.getOrders().slice(0, 6));
  const [chartMetric, setChartMetric] = useState<'sales' | 'orders'>('sales');
  const [feedTab, setFeedTab] = useState<'orders' | 'top_products'>('orders');

  // Real-time Database Subscription
  useEffect(() => {
    // If database has 0 orders, populate rich demo dummy data automatically
    if (orderService.getOrders().length === 0) {
      db.seedDummyData();
    }

    const refreshAll = () => {
      setDailySummary(reportService.getDailyReport());
      setHourlySales(reportService.getHourlySales());
      setActiveShift(shiftService.getActiveShift());
      setIngredients(inventoryService.getIngredients());
      setRecentOrders(orderService.getOrders().slice(0, 6));
    };

    const unsubDb = db.subscribe(refreshAll);
    const unsubOrder = realtimeSocketService.on('ORDER_CREATED', refreshAll);
    const unsubRefund = realtimeSocketService.on('ORDER_REFUNDED', refreshAll);
    const unsubCatalog = realtimeSocketService.on('CATALOG_CHANGED', refreshAll);
    const unsubStock = realtimeSocketService.on('STOCK_CHANGED', refreshAll);
    const unsubShift = realtimeSocketService.on('SHIFT_CHANGED', refreshAll);
    const unsubDrawer = realtimeSocketService.on('DRAWER_TRANSACTION', refreshAll);

    return () => {
      unsubDb();
      unsubOrder();
      unsubRefund();
      unsubCatalog();
      unsubStock();
      unsubShift();
      unsubDrawer();
    };
  }, []);

  const handleSeedData = () => {
    db.seedDummyData();
    toast.success('Sample demo orders, shifts, and expenses loaded successfully!');
  };

  const stockAlerts = useMemo(() => {
    const today = startOfDay(new Date());

    return ingredients
      .map((ing) => {
        const isLow = ing.currentStock <= ing.reorderLevel;
        const isOut = ing.currentStock <= 0;

        let expiryStatus: 'expired' | 'near_expiry' | 'valid' | 'none' = 'none';
        let daysUntilExpiry: number | null = null;

        if (ing.expiryDate) {
          try {
            const exp = startOfDay(parseISO(ing.expiryDate));
            daysUntilExpiry = differenceInDays(exp, today);
            if (daysUntilExpiry < 0) expiryStatus = 'expired';
            else if (daysUntilExpiry <= 3) expiryStatus = 'near_expiry';
            else expiryStatus = 'valid';
          } catch {
            expiryStatus = 'none';
          }
        }

        const hasAlert = isLow || isOut || expiryStatus === 'expired' || expiryStatus === 'near_expiry';

        return {
          ...ing,
          isLow,
          isOut,
          expiryStatus,
          daysUntilExpiry,
          hasAlert,
        };
      })
      .filter((ing) => ing.hasAlert)
      .sort((a, b) => {
        const score = (x: any) => {
          if (x.expiryStatus === 'expired') return 4;
          if (x.isOut) return 3;
          if (x.expiryStatus === 'near_expiry') return 2;
          if (x.isLow) return 1;
          return 0;
        };
        return score(b) - score(a);
      });
  }, [ingredients]);

  const lowStockIngredients = useMemo(() => {
    return ingredients.filter((i) => i.currentStock <= i.reorderLevel);
  }, [ingredients]);

  const liveDrawerCash = useMemo(() => {
    if (activeShift) {
      return cashDrawerService.getCurrentDrawerBalance(activeShift.id);
    }
    return Math.max(
      0,
      dailySummary.openingFloatCents +
        dailySummary.cashSalesCents +
        dailySummary.cashInCents -
        dailySummary.cashRefundsCents -
        dailySummary.cashOutCents
    );
  }, [activeShift, dailySummary]);

  // Top Selling Items (All Time / Today)
  const topProducts = useMemo(() => {
    const map = new Map<string, { id: string; name: string; category: string; qty: number; revenueCents: number }>();
    const allProducts = catalogService.getProducts();
    const allOrders = orderService.getOrders();

    allOrders.forEach((o) => {
      if (o.status === 'CANCELLED') return;
      o.items.forEach((item) => {
        const prod = allProducts.find((p) => p.id === item.productId);
        const existing = map.get(item.productId) || {
          id: item.productId,
          name: item.name,
          category: prod?.categoryId || 'Menu Item',
          qty: 0,
          revenueCents: 0,
        };
        existing.qty += item.quantity;
        existing.revenueCents += item.itemTotalCents;
        map.set(item.productId, existing);
      });
    });

    return Array.from(map.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [recentOrders]);

  // Format chart data
  const chartData = useMemo(() => {
    return hourlySales.map((h: { hour: string; salesCents: number; orders: number }) => ({
      hour: h.hour,
      sales: Math.round(h.salesCents / 100),
      orders: h.orders,
    }));
  }, [hourlySales]);

  const hasSalesToday = dailySummary.grossSalesCents > 0;

  return (
    <div className="space-y-4 w-full pb-16 animate-in fade-in">
      {/* 1. TOP 4 ULTRA-MODERN KPI SUMMARY CARDS (FULL WIDTH) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Today's Net Sales */}
        <div className="bg-white p-4.5 sm:p-5 rounded-3xl border border-[#E9E0D5] shadow-xs hover:border-brand-teal/40 hover:shadow-md transition-all flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-text-muted">
              Today's Net Sales
            </span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-brand-teal border border-teal-100 flex items-center justify-center group-hover:scale-110 transition-transform">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-brand-teal-dark tabular-nums tracking-tight">
              {formatLKR(dailySummary.netSalesCents)}
            </div>
            <div className="flex items-center justify-between text-[11px] text-text-secondary mt-1.5 font-medium border-t border-[#F2ECE4] pt-1.5">
              <span>Gross: <strong>{formatLKR(dailySummary.grossSalesCents)}</strong></span>
              {dailySummary.discountCents > 0 && (
                <span className="text-amber-700 font-bold">-{formatLKR(dailySummary.discountCents)}</span>
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Total Orders */}
        <div className="bg-white p-4.5 sm:p-5 rounded-3xl border border-[#E9E0D5] shadow-xs hover:border-brand-orange/40 hover:shadow-md transition-all flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-text-muted">
              Orders Completed
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-brand-orange border border-amber-100 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-brand-brown-deep tabular-nums tracking-tight">
              {dailySummary.orderCount}
            </div>
            <div className="flex items-center justify-between text-[11px] text-text-secondary mt-1.5 font-medium border-t border-[#F2ECE4] pt-1.5">
              <span>Avg Basket:</span>
              <strong className="text-brand-brown-dark">{formatLKR(dailySummary.avgOrderValueCents)}</strong>
            </div>
          </div>
        </div>

        {/* Card 3: Cash in Drawer */}
        <div className="bg-white p-4.5 sm:p-5 rounded-3xl border border-[#E9E0D5] shadow-xs hover:border-emerald-500/40 hover:shadow-md transition-all flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-text-muted">
              Cash In Drawer
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Coins className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-emerald-800 tabular-nums tracking-tight">
              {formatLKR(liveDrawerCash)}
            </div>
            <div className="flex items-center justify-between text-[11px] text-text-secondary mt-1.5 font-medium border-t border-[#F2ECE4] pt-1.5">
              <span>Opening Float:</span>
              <strong className="text-brand-brown-dark">{formatLKR(activeShift?.openingCash ?? dailySummary.openingFloatCents)}</strong>
            </div>
          </div>
        </div>

        {/* Card 4: Digital Payments */}
        <div className="bg-white p-4.5 sm:p-5 rounded-3xl border border-[#E9E0D5] shadow-xs hover:border-indigo-500/40 hover:shadow-md transition-all flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-text-muted">
              Digital Payments
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center group-hover:scale-110 transition-transform">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-indigo-900 tabular-nums tracking-tight">
              {formatLKR(dailySummary.cardSalesCents + dailySummary.qrSalesCents)}
            </div>
            <div className="flex items-center justify-between text-[11px] text-text-secondary mt-1.5 font-medium border-t border-[#F2ECE4] pt-1.5">
              <span>Card: <strong>{formatLKR(dailySummary.cardSalesCents)}</strong></span>
              <span>QR: <strong>{formatLKR(dailySummary.qrSalesCents)}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. INTERACTIVE CHARTING HUB (FULL WIDTH GRID) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Chart: Hourly Sales & Order Flow (8 cols) */}
        <div className="lg:col-span-8 bg-white p-5 sm:p-6 rounded-3xl border border-[#E9E0D5] shadow-xs space-y-4 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-black text-sm text-brand-brown-dark tracking-tight flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-brand-teal" />
                Hourly Sales & Velocity Trend
              </h3>
              <p className="text-[11px] text-text-secondary mt-0.5">
                Real-time transaction density throughout the service day
              </p>
            </div>

            {/* Metric Switcher Toggle */}
            <div className="flex items-center bg-[#FAF7F2] p-1 rounded-full border border-[#E0D7CC] self-start sm:self-auto shadow-2xs">
              <button
                type="button"
                onClick={() => setChartMetric('sales')}
                className={`px-3 py-1 text-xs font-extrabold rounded-full transition-all cursor-pointer ${
                  chartMetric === 'sales'
                    ? 'bg-[#251814] text-white shadow-xs'
                    : 'text-brand-brown hover:bg-cream-100'
                }`}
              >
                Revenue (Rs.)
              </button>
              <button
                type="button"
                onClick={() => setChartMetric('orders')}
                className={`px-3 py-1 text-xs font-extrabold rounded-full transition-all cursor-pointer ${
                  chartMetric === 'orders'
                    ? 'bg-[#251814] text-white shadow-xs'
                    : 'text-brand-brown hover:bg-cream-100'
                }`}
              >
                Orders Count
              </button>
            </div>
          </div>

          {/* Area Chart Container */}
          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesTealGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1FB5AE" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#1FB5AE" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="ordersOrangeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E99343" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#E99343" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0EAE1" vertical={false} />
                <XAxis dataKey="hour" stroke="#9D8F87" fontSize={10} tickLine={false} />
                <YAxis stroke="#9D8F87" fontSize={10} tickLine={false} />
                <Tooltip
                  formatter={(val: any) => [
                    chartMetric === 'sales' ? `Rs. ${Number(val).toLocaleString('en-LK')}` : `${val} orders`,
                    chartMetric === 'sales' ? 'Revenue' : 'Volume',
                  ]}
                  contentStyle={{
                    backgroundColor: '#251814',
                    borderRadius: '16px',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.1)',
                    fontSize: '11px',
                    padding: '8px 12px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey={chartMetric === 'sales' ? 'sales' : 'orders'}
                  stroke={chartMetric === 'sales' ? '#1FB5AE' : '#E99343'}
                  strokeWidth={2.8}
                  fill={chartMetric === 'sales' ? 'url(#salesTealGrad)' : 'url(#ordersOrangeGrad)'}
                  activeDot={{ r: 5, fill: chartMetric === 'sales' ? '#1FB5AE' : '#E99343', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Card: Low Stock & Expiry Alerts (4 cols) */}
        <div className="lg:col-span-4 bg-white p-5 sm:p-6 rounded-3xl border border-[#E9E0D5] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="font-black text-sm text-brand-brown-dark tracking-tight flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                Stock & Expiry Alerts
              </h3>
              <p className="text-[11px] text-text-secondary mt-0.5">
                Low inventory levels & expiring ingredients
              </p>
            </div>
            {stockAlerts.length > 0 ? (
              <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-black shrink-0">
                {stockAlerts.length} Action{stockAlerts.length > 1 ? 's' : ''}
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-black shrink-0">
                Healthy
              </span>
            )}
          </div>

          {/* List of Alert Items */}
          <div className="my-3 flex-1 overflow-y-auto max-h-60 space-y-2 pr-1">
            {stockAlerts.length === 0 ? (
              <div className="h-44 flex flex-col items-center justify-center text-center p-4 rounded-2xl bg-[#FAF7F2] border border-[#EAE3DA]">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
                <span className="text-xs font-black text-brand-brown-dark">All Stock Levels Healthy</span>
                <p className="text-[11px] text-text-secondary mt-0.5">No expired or low-stock ingredients found.</p>
              </div>
            ) : (
              stockAlerts.map((item) => (
                <div
                  key={item.id}
                  className="p-2.5 rounded-2xl bg-[#FAF7F2] hover:bg-cream-100/80 border border-[#EAE3DA] flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-black text-xs text-brand-brown-dark truncate">
                        {item.name}
                      </span>
                      {item.expiryStatus === 'expired' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-rose-600 text-white">
                          Expired
                        </span>
                      )}
                      {item.expiryStatus === 'near_expiry' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-amber-500 text-white">
                          Near Expiry
                        </span>
                      )}
                      {item.isOut && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-rose-100 text-rose-700 border border-rose-300">
                          Out of Stock
                        </span>
                      )}
                      {!item.isOut && item.isLow && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-300">
                          Low Stock
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-text-secondary">
                      <span>Stock: <strong className="font-extrabold text-brand-brown-dark">{item.currentStock} {item.unit}</strong></span>
                      <span>•</span>
                      <span>Min: {item.reorderLevel} {item.unit}</span>
                      {item.expiryDate && (
                        <>
                          <span>•</span>
                          <span className={item.expiryStatus === 'expired' ? 'text-rose-600 font-bold' : item.expiryStatus === 'near_expiry' ? 'text-amber-700 font-bold' : ''}>
                            Exp: {item.expiryDate}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="pt-2 border-t border-[#EAE3DA] flex items-center justify-between text-xs">
            <span className="text-[11px] text-text-secondary font-semibold">
              Total Ingredients: {ingredients.length}
            </span>
            <Link
              to="/admin/inventory"
              className="text-xs font-black text-brand-teal hover:text-brand-teal-dark flex items-center gap-1 transition-colors"
            >
              <span>Manage Inventory</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* 3. RECENT ORDERS & LEADERBOARD (FULL WIDTH 12-COL BENTO) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left 8 Cols: Orders & Best Sellers Tab Card */}
        <div className="lg:col-span-8 bg-white p-5 sm:p-6 rounded-3xl border border-[#E9E0D5] shadow-xs space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            {/* Tab Switcher */}
            <div className="flex items-center gap-1.5 bg-[#FAF7F2] p-1 rounded-full border border-[#E0D7CC] shadow-2xs">
              <button
                type="button"
                onClick={() => setFeedTab('orders')}
                className={`px-3.5 py-1 text-xs font-black rounded-full transition-all cursor-pointer ${
                  feedTab === 'orders'
                    ? 'bg-[#251814] text-white shadow-xs'
                    : 'text-brand-brown hover:bg-cream-100'
                }`}
              >
                Recent Live Orders
              </button>
              <button
                type="button"
                onClick={() => setFeedTab('top_products')}
                className={`px-3.5 py-1 text-xs font-black rounded-full transition-all cursor-pointer ${
                  feedTab === 'top_products'
                    ? 'bg-[#251814] text-white shadow-xs'
                    : 'text-brand-brown hover:bg-cream-100'
                }`}
              >
                Top Selling Items
              </button>
            </div>

            <Link
              to="/admin/orders"
              className="text-[11px] font-extrabold text-brand-teal hover:text-brand-teal-dark flex items-center gap-1 transition-colors"
            >
              <span>View All Records</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* TAB 1: RECENT LIVE ORDERS */}
          {feedTab === 'orders' && (
            <div className="overflow-x-auto rounded-2xl border border-[#F0EAE1]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#EAE3DA] bg-[#FAF7F2] text-text-muted font-black uppercase text-[9.5px] tracking-wider">
                    <th className="py-2.5 px-3">Order</th>
                    <th className="py-2.5 px-3">Time</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Payment</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2ECE4]">
                  {recentOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-xs text-text-muted">
                        <ShoppingBag className="w-6 h-6 mx-auto mb-1.5 text-text-muted/40" />
                        No orders recorded yet today.
                      </td>
                    </tr>
                  ) : (
                    recentOrders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-[#FAF7F2]/90 transition-colors">
                        <td className="py-2.5 px-3 font-black text-brand-brown-dark">
                          {ord.orderNumber}
                        </td>
                        <td className="py-2.5 px-3 text-text-secondary text-[11px]">
                          {formatTime(ord.createdAt)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full bg-cream-100 border border-[#E0D7CC] font-bold text-[10px] text-brand-brown">
                            {ord.orderType === 'DINE_IN' ? `Table ${ord.tableNumber || '01'}` : 'Takeaway'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-extrabold text-brand-teal uppercase text-[10.5px]">
                          {ord.paymentMethod}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-brand-brown-deep tabular-nums">
                          {formatLKR(ord.totalCents)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-extrabold text-[9.5px]">
                            {ord.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: TOP SELLING ITEMS */}
          {feedTab === 'top_products' && (
            <div className="overflow-x-auto rounded-2xl border border-[#F0EAE1]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#EAE3DA] bg-[#FAF7F2] text-text-muted font-black uppercase text-[9.5px] tracking-wider">
                    <th className="py-2.5 px-3"># Rank</th>
                    <th className="py-2.5 px-3">Menu Item</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3 text-center">Sold Qty</th>
                    <th className="py-2.5 px-3 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2ECE4]">
                  {topProducts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-xs text-text-muted">
                        No product sales recorded yet.
                      </td>
                    </tr>
                  ) : (
                    topProducts.map((p, idx) => (
                      <tr key={p.id} className="hover:bg-[#FAF7F2]/90 transition-colors">
                        <td className="py-2.5 px-3 font-black text-brand-teal">
                          #{idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-brand-brown-dark">
                          {p.name}
                        </td>
                        <td className="py-2.5 px-3 text-text-secondary text-[11px]">
                          {p.category}
                        </td>
                        <td className="py-2.5 px-3 text-center font-black text-brand-brown-dark">
                          <span className="px-2 py-0.5 rounded-full bg-cream-100 border border-[#E0D7CC]">
                            {p.qty}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-brand-teal tabular-nums">
                          {formatLKR(p.revenueCents)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right 4 Cols: Operations & Station Health Widgets */}
        <div className="lg:col-span-4 space-y-3.5">
          {/* Card 1: Active Cashier Shift */}
          <div className="bg-white p-4.5 sm:p-5 rounded-3xl border border-[#E9E0D5] shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-xs text-brand-brown-dark flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-teal" />
                Live Cashier Shift Reconciler
              </h3>
              <Link
                to="/admin/drawer"
                className="text-[10px] font-bold text-brand-teal hover:underline flex items-center gap-0.5"
              >
                <span>Drawer</span>
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            {activeShift ? (
              <div className="p-3.5 bg-[#FAF7F2] rounded-2xl border border-[#E0D7CC] space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-text-muted">Operator:</span>
                  <span className="font-black text-brand-brown-dark">{activeShift.cashierName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-muted">Opened At:</span>
                  <span className="font-bold text-brand-brown-dark">{formatTime(activeShift.openedAt)}</span>
                </div>
                <div className="flex justify-between items-center pt-1.5 border-t border-[#EAE3DA]">
                  <span className="text-text-secondary font-bold">Shift Cash Collected:</span>
                  <span className="font-black text-emerald-700 tabular-nums">{formatLKR(activeShift.cashSales)}</span>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-[#FAF7F2] rounded-2xl border border-[#E0D7CC] text-center text-xs text-text-muted font-medium">
                No active shift open. Terminal ready for cashier login.
              </div>
            )}
          </div>

          {/* Card 2: Low Stock Ingredients */}
          <div className="bg-white p-4.5 sm:p-5 rounded-3xl border border-[#E9E0D5] shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-xs text-brand-brown-dark flex items-center gap-2">
                <Boxes className="w-4 h-4 text-brand-orange" />
                Inventory & Stock Health
              </h3>
              <Link
                to="/admin/inventory?tab=stock"
                className="text-[10px] font-bold text-brand-teal hover:underline flex items-center gap-0.5"
              >
                <span>Manage</span>
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="space-y-1.5">
              {lowStockIngredients.length === 0 ? (
                <div className="p-3.5 bg-[#FAF7F2] rounded-2xl border border-[#E0D7CC] text-center text-xs text-text-secondary font-medium flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>All ingredients within safe operating levels.</span>
                </div>
              ) : (
                lowStockIngredients.slice(0, 2).map((ing) => (
                  <div
                    key={ing.id}
                    className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-brand-brown-dark">{ing.name}</div>
                      <div className="text-[10px] text-text-muted">Reorder Alert: {ing.reorderLevel} {ing.unit}</div>
                    </div>
                    <span className="font-black text-amber-700 tabular-nums">
                      {ing.currentStock} {ing.unit}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
