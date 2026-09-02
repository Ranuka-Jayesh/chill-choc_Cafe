import React, { useState, useEffect } from 'react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { CashierShift, User } from '@/types';
import { db } from '@/services/storage/db';
import { cashDrawerService } from '@/services/cashDrawerService';
import { realtimeSocketService } from '@/services/realtimeSocketService';
import { formatLKR } from '@/utils/format';
import {
  Clock,
  History,
  Maximize,
  Minimize,
  LogOut,
  Printer,
  Coins,
  PauseCircle,
  Receipt,
  Boxes,
  UserCheck,
  Truck,
} from 'lucide-react';
import { format } from 'date-fns';

interface PosHeaderProps {
  user: User;
  shift: CashierShift | null;
  onOpenOrdersHistory: () => void;
  onOpenExpenses?: () => void;
  onOpenAttendance?: () => void;
  onOpenStockDrawer?: () => void;
  onOpenCashInOut: () => void;
  onOpenPrinterManager: () => void;
  onOpenHeldOrders: () => void;
  onLogoutClick: () => void;
  onOpenQuickDemoMenu?: () => void;
}

export const PosHeader: React.FC<PosHeaderProps> = ({
  user,
  shift,
  onOpenOrdersHistory,
  onOpenExpenses,
  onOpenAttendance,
  onOpenStockDrawer,
  onOpenCashInOut,
  onOpenPrinterManager,
  onOpenHeldOrders,
  onLogoutClick,
  onOpenQuickDemoMenu,
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [heldOrdersCount, setHeldOrdersCount] = useState(
    db.getSnapshot().heldOrders?.length || 0
  );
  const [failedPrintJobsCount, setFailedPrintJobsCount] = useState(
    (db.getSnapshot().printerJobs || []).filter((j) => j.status === 'FAILED').length
  );
  const [drawerBalanceCents, setDrawerBalanceCents] = useState<number>(() =>
    shift ? cashDrawerService.getCurrentDrawerBalance(shift.id) : 0
  );
  const [expiredIngredientsCount, setExpiredIngredientsCount] = useState<number>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return (db.getSnapshot().ingredients || []).filter((i) => {
      if (!i.expiryDate) return false;
      const exp = new Date(i.expiryDate);
      exp.setHours(0, 0, 0, 0);
      return !isNaN(exp.getTime()) && exp.getTime() < today.getTime();
    }).length;
  });
  const [lowStockCount, setLowStockCount] = useState<number>(() => {
    return (db.getSnapshot().ingredients || []).filter((i) => i.currentStock <= i.reorderLevel).length;
  });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    const updateLiveState = () => {
      const activeShiftId = shift?.id || db.getSnapshot().activeShift?.id;
      if (activeShiftId) {
        setDrawerBalanceCents(cashDrawerService.getCurrentDrawerBalance(activeShiftId));
      } else {
        setDrawerBalanceCents(0);
      }
      setHeldOrdersCount(db.getSnapshot().heldOrders?.length || 0);
      setFailedPrintJobsCount(
        (db.getSnapshot().printerJobs || []).filter((j) => j.status === 'FAILED').length
      );
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const allIngs = db.getSnapshot().ingredients || [];
      setExpiredIngredientsCount(
        allIngs.filter((i) => {
          if (!i.expiryDate) return false;
          const exp = new Date(i.expiryDate);
          exp.setHours(0, 0, 0, 0);
          return !isNaN(exp.getTime()) && exp.getTime() < today.getTime();
        }).length
      );
      setLowStockCount(allIngs.filter((i) => i.currentStock <= i.reorderLevel).length);
    };

    updateLiveState();
    const unsubDb = db.subscribe(updateLiveState);
    const unsubDrawerTx = realtimeSocketService.on('DRAWER_TRANSACTION', updateLiveState);
    const unsubDrawerApprove = realtimeSocketService.on('DRAWER_REQUEST_APPROVED', updateLiveState);
    const unsubDrawerReject = realtimeSocketService.on('DRAWER_REQUEST_REJECTED', updateLiveState);
    const unsubShift = realtimeSocketService.on('SHIFT_CHANGED', updateLiveState);
    const unsubOrder = realtimeSocketService.on('ORDER_CREATED', updateLiveState);
    const unsubRefund = realtimeSocketService.on('ORDER_REFUNDED', updateLiveState);

    const handleStorage = (e: StorageEvent) => {
      if (e.key?.includes('cafemm') || e.key?.includes('drawer') || e.key?.includes('shift')) {
        updateLiveState();
      }
    };
    window.addEventListener('storage', handleStorage);

    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);

      // Lock Escape in Chromium so the browser doesn't automatically close fullscreen before modal Escape handlers run
      if (isFull && 'keyboard' in navigator && (navigator as any).keyboard?.lock) {
        (navigator as any).keyboard.lock(['Escape']).catch(() => {});
      } else if (!isFull && 'keyboard' in navigator && (navigator as any).keyboard?.unlock) {
        (navigator as any).keyboard.unlock();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is holding modifier keys like Ctrl/Alt/Meta
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      // Ignore if user is currently typing in an input or textarea
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      const isInput =
        activeTag === 'input' ||
        activeTag === 'textarea' ||
        document.activeElement?.getAttribute('contenteditable') === 'true';
      if (isInput) return;

      // Single 'F' or 'f' key for Fullscreen Toggle
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearInterval(timer);
      unsubDb();
      unsubDrawerTx();
      unsubDrawerApprove();
      unsubDrawerReject();
      unsubShift();
      unsubOrder();
      unsubRefund();
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shift]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <header className="h-16 xl:h-[68px] bg-white border-b border-border/80 px-3 sm:px-5 flex items-center justify-between shadow-soft z-20 flex-shrink-0">
      {/* Left: Brand Logo */}
      <div className="flex items-center">
        <BrandLogo variant="compact" size="sm" />
      </div>

      {/* Center: Live Date & Time */}
      <div className="flex items-center gap-2 select-none">
        {/* Full date on large screens */}
        <span className="hidden xl:inline font-extrabold text-sm text-brand-brown-dark tracking-tight">
          {format(currentTime, 'EEE, dd MMM yyyy')}
        </span>
        {/* Compact date on medium screens */}
        <span className="hidden md:inline xl:hidden font-extrabold text-sm text-brand-brown-dark tracking-tight">
          {format(currentTime, 'dd MMM yyyy')}
        </span>
        
        <span className="hidden md:inline text-brand-brown/40 font-bold text-sm">•</span>
        
        {/* Live Monospace Time - Bold & Prominent */}
        <span className="font-mono font-black text-sm sm:text-base text-brand-brown-deep tracking-tight tabular-nums">
          {format(currentTime, 'hh:mm:ss a')}
        </span>
      </div>

      {/* Right: Operational Touch Action Buttons (Unified h-10 sm:h-11 Height) */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Real-time Cash Drawer Balance Button */}
        <button
          onClick={onOpenCashInOut}
          className="h-10 sm:h-11 flex items-center gap-2 px-2.5 sm:px-3.5 text-xs font-black text-brand-brown-dark bg-cream-50 hover:bg-cream-100 border border-cream-200/90 rounded-xl sm:rounded-2xl shadow-xs transition-all active:scale-95 cursor-pointer"
          title="Live Cash Drawer Balance (Click for Cash In / Cash Out / Safe Drop)"
        >
          <div className="w-6 h-6 rounded-lg sm:rounded-xl bg-brand-yellow-light text-brand-orange flex items-center justify-center flex-shrink-0 shadow-xs">
            <Coins className="w-3.5 h-3.5 stroke-[2.2]" />
          </div>
          <div className="flex items-center gap-1">
            <span className="hidden xl:inline text-text-secondary font-bold text-[11px]">Drawer:</span>
            <span className="font-mono font-black text-brand-brown-deep tabular-nums text-xs">
              {formatLKR(drawerBalanceCents)}
            </span>
          </div>
        </button>

        {/* Held Orders Button */}
        <button
          onClick={onOpenHeldOrders}
          className={`h-10 sm:h-11 flex items-center gap-1.5 px-2.5 sm:px-3 rounded-xl sm:rounded-2xl text-xs font-black transition-all active:scale-95 border shadow-xs cursor-pointer ${
            heldOrdersCount > 0
              ? 'bg-brand-yellow-light text-amber-900 border-brand-yellow/60 animate-pulse'
              : 'bg-white hover:bg-cream-50 text-text-primary border-border/80'
          }`}
          title="Parked / Held Orders"
        >
          <PauseCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-orange stroke-[2.2]" />
          <span className="hidden md:inline">Held</span>
          {heldOrdersCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-brand-orange text-white text-[10px] font-black tabular-nums shadow-xs">
              {heldOrdersCount}
            </span>
          )}
        </button>

        {/* Orders History Button */}
        <button
          onClick={onOpenOrdersHistory}
          className="h-10 sm:h-11 flex items-center gap-1.5 px-2.5 sm:px-3 text-xs font-black text-text-primary bg-white hover:bg-cream-50 border border-border/80 rounded-xl sm:rounded-2xl shadow-xs transition-all active:scale-95 cursor-pointer"
          title="Recent Orders"
        >
          <History className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-teal stroke-[2.2]" />
          <span className="hidden md:inline">Orders</span>
        </button>

        {/* Expenses Drawer Button */}
        {onOpenExpenses && (
          <button
            onClick={onOpenExpenses}
            className="h-10 sm:h-11 flex items-center gap-1.5 px-2.5 sm:px-3 text-xs font-black text-brand-brown-dark bg-white hover:bg-cream-50 border border-border/80 rounded-xl sm:rounded-2xl shadow-xs transition-all active:scale-95 cursor-pointer"
            title="Operating Expenses (Record & View Shift Expenses)"
          >
            <Receipt className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-orange stroke-[2.2]" />
            <span className="hidden lg:inline">Expenses</span>
          </button>
        )}

        {/* Staff Attendance & Digital Clock-In Button (Icon Only) */}
        {onOpenAttendance && (
          <button
            type="button"
            onClick={onOpenAttendance}
            className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl sm:rounded-2xl flex items-center justify-center border border-border/80 bg-white hover:bg-brand-teal-light/40 hover:border-brand-teal/40 text-brand-teal shadow-xs transition-all active:scale-95 cursor-pointer"
            title="Staff Attendance & Digital Clock-In"
          >
            <UserCheck className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-brand-teal stroke-[2.2]" />
          </button>
        )}

        {/* Stock / Ingredients Drawer Button */}
        {onOpenStockDrawer && (
          <button
            onClick={onOpenStockDrawer}
            className={`relative h-10 w-10 sm:h-11 sm:w-11 rounded-xl sm:rounded-2xl flex items-center justify-center border shadow-xs transition-all active:scale-95 cursor-pointer ${
              expiredIngredientsCount > 0
                ? 'bg-rose-50 text-rose-600 border-rose-200 animate-pulse'
                : lowStockCount > 0
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'text-text-secondary hover:text-brand-teal hover:bg-cream-100 border-border/80 bg-white'
            }`}
            title="Ingredients Stock & Expiration Details"
          >
            <Boxes className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2]" />
            {expiredIngredientsCount > 0 ? (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white animate-ping" />
            ) : lowStockCount > 0 ? (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full ring-2 ring-white" />
            ) : null}
          </button>
        )}

        {/* Stock / Deliveries Page (Opens in New Tab) */}
        <button
          type="button"
          onClick={() => window.open('/pos/stock', '_blank')}
          className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl sm:rounded-2xl flex items-center justify-center border border-border/80 bg-white hover:bg-cream-100 hover:text-brand-teal text-text-secondary shadow-xs transition-all active:scale-95 cursor-pointer"
          title="Cashier Stock & Deliveries Portal (Opens in new tab)"
        >
          <Truck className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.2]" />
        </button>

        {/* Printer Management Button */}
        <button
          onClick={onOpenPrinterManager}
          className={`relative h-10 w-10 sm:h-11 sm:w-11 rounded-xl sm:rounded-2xl flex items-center justify-center border shadow-xs transition-all active:scale-95 cursor-pointer ${
            failedPrintJobsCount > 0
              ? 'bg-rose-50 text-rose-600 border-rose-200 animate-pulse'
              : 'text-text-secondary hover:text-brand-teal hover:bg-cream-100 border-border/80'
          }`}
          title="Printer Configuration & Queue"
        >
          <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2]" />
          {failedPrintJobsCount > 0 && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white" />
          )}
        </button>

        {/* Fullscreen Toggle */}
        <button
          type="button"
          onClick={toggleFullscreen}
          className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl sm:rounded-2xl flex items-center justify-center text-text-secondary hover:text-brand-brown-dark hover:bg-cream-100 border border-border/80 shadow-xs transition-all active:scale-95 hidden sm:flex cursor-pointer"
          title={isFullscreen ? "Exit Fullscreen (Press 'F')" : "Enter Fullscreen (Press 'F')"}
        >
          {isFullscreen ? <Minimize className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Maximize className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
        </button>

        {/* Cashier Badge */}
        <div className="flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2 border-l border-border/80">
          <div className="h-10 sm:h-11 flex items-center gap-2 px-2.5 sm:px-3 rounded-xl sm:rounded-2xl bg-cream-50 border border-cream-200/80 shadow-xs">
            <div className="w-6 h-6 rounded-lg bg-brand-teal/20 text-brand-teal flex items-center justify-center font-black text-[11px]">
              {user.name.charAt(0)}
            </div>
            <div className="text-left leading-tight hidden lg:block">
              <div className="text-xs font-black text-brand-brown-dark truncate max-w-[90px]">
                {user.name}
              </div>
              <div className="text-[9px] uppercase font-extrabold text-brand-teal">
                {user.role}
              </div>
            </div>
          </div>

          {/* Close Shift / Cash Out Action */}
          <button
            onClick={onLogoutClick}
            className="h-10 sm:h-11 flex items-center gap-1.5 px-2.5 sm:px-3.5 text-xs font-black text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl sm:rounded-2xl shadow-xs transition-all active:scale-95 cursor-pointer"
            title="Close Shift, Cash Out & Logout"
          >
            <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.2]" />
            <span className="hidden sm:inline">Close Shift</span>
          </button>
        </div>
      </div>
    </header>
  );
};
