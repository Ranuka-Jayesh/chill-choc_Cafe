import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { confirmDialog } from '@/store/useConfirmStore';
import { realtimeSocketService } from '@/services/realtimeSocketService';
import { db } from '@/services/storage/db';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { BrandFooter } from '@/components/brand/BrandFooter';
import { toast } from 'sonner';
import {
  LayoutDashboard,
  ShoppingBag,
  UtensilsCrossed,
  Layers,
  SlidersHorizontal,
  Boxes,
  ChefHat,
  History,
  Truck,
  Building2,
  Coins,
  Receipt,
  BarChart3,
  Calculator,
  Users,
  ShieldCheck,
  Settings,
  Printer,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Clock,
  Calendar,
  Database,
} from 'lucide-react';

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  badgeCount?: number;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, logout } = useAuthStore();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('admin_sidebar_collapsed') === 'true';
  });

  // Real-time live date and time state
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Pending Cashier Stock Requests & Cash Drawer Requests Counts
  const [pendingStockCount, setPendingStockCount] = useState<number>(() => {
    return (db.getSnapshot().stockRequests || []).filter((r) => r.status === 'PENDING_APPROVAL').length;
  });

  const [pendingDrawerCount, setPendingDrawerCount] = useState<number>(() => {
    return (db.getSnapshot().drawerTransactions || []).filter((t) => t.status === 'PENDING_APPROVAL').length;
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    const updatePendingCounts = () => {
      const snap = db.getSnapshot();
      const sCount = (snap.stockRequests || []).filter((r) => r.status === 'PENDING_APPROVAL').length;
      const dCount = (snap.drawerTransactions || []).filter((t) => t.status === 'PENDING_APPROVAL').length;
      setPendingStockCount(sCount);
      setPendingDrawerCount(dCount);
    };

    const unsubDb = db.subscribe(updatePendingCounts);
    const unsubStockPending = realtimeSocketService.on('STOCK_REQUEST_PENDING', updatePendingCounts);
    const unsubStockApproved = realtimeSocketService.on('STOCK_REQUEST_APPROVED', updatePendingCounts);
    const unsubStockRejected = realtimeSocketService.on('STOCK_REQUEST_REJECTED', updatePendingCounts);
    const unsubDrawerPending = realtimeSocketService.on('DRAWER_REQUEST_PENDING', updatePendingCounts);
    const unsubDrawerApproved = realtimeSocketService.on('DRAWER_REQUEST_APPROVED', updatePendingCounts);
    const unsubDrawerRejected = realtimeSocketService.on('DRAWER_REQUEST_REJECTED', updatePendingCounts);

    const handleStorage = (e: StorageEvent) => {
      if (e.key?.includes('cafemm') || e.key?.includes('stock') || e.key?.includes('drawer')) {
        updatePendingCounts();
      }
    };
    window.addEventListener('storage', handleStorage);

    const unsubOrder = realtimeSocketService.on('ORDER_CREATED', (msg) => {
      const order = msg.payload?.order;
      if (order) {
        toast.success(
          `New Order #${order.numericOrderNum || order.orderNumber} (Rs. ${(order.totalCents / 100).toFixed(2)}) placed by ${order.cashierName || 'Cashier'}`,
          { duration: 4500 }
        );
      }
    });

    return () => {
      clearInterval(timer);
      unsubDb();
      unsubStockPending();
      unsubStockApproved();
      unsubStockRejected();
      unsubDrawerPending();
      unsubDrawerApproved();
      unsubDrawerRejected();
      window.removeEventListener('storage', handleStorage);
      unsubOrder();
    };
  }, []);

  if (!session) {
    return <Navigate to="/admin/login" replace />;
  }

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('admin_sidebar_collapsed', String(next));
      return next;
    });
  };

  const handleLogout = async () => {
    const confirmed = await confirmDialog({
      title: 'Sign Out Administrator?',
      message: 'Are you sure you want to end your administrator session and return to the login screen?',
      confirmText: 'Sign Out',
      cancelText: 'Stay Signed In',
      variant: 'danger',
    });

    if (confirmed) {
      await logout();
      navigate('/admin/login');
    }
  };

  const navSections: NavSection[] = [
    {
      title: 'Overview',
      items: [
        { label: 'Dashboard', to: '/admin/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
        { label: 'Orders Management', to: '/admin/orders', icon: <ShoppingBag className="w-4 h-4" /> },
      ],
    },
    {
      title: 'Catalog',
      items: [
        { label: 'Products & Menu', to: '/admin/products', icon: <UtensilsCrossed className="w-4 h-4" /> },
      ],
    },
    {
      title: 'Inventory',
      items: [
        {
          label: 'Stock & Purchases',
          to: '/admin/inventory',
          icon: <Boxes className="w-4 h-4" />,
          badgeCount: pendingStockCount,
        },
      ],
    },
    {
      title: 'Finance',
      items: [
        {
          label: 'Cash Drawers',
          to: '/admin/cash-drawers',
          icon: <Coins className="w-4 h-4" />,
          badgeCount: pendingDrawerCount,
        },
        { label: 'Accounting', to: '/admin/accounting', icon: <Calculator className="w-4 h-4" /> },
        { label: 'Reports & Analytics', to: '/admin/reports', icon: <BarChart3 className="w-4 h-4" /> },
      ],
    },
    {
      title: 'System & Config',
      items: [
        { label: 'Receipt Studio', to: '/admin/receipt-customizer', icon: <Printer className="w-4 h-4" /> },
        { label: 'Staff & Users', to: '/admin/users', icon: <Users className="w-4 h-4" /> },
        { label: 'System Settings', to: '/admin/settings', icon: <Settings className="w-4 h-4" /> },
      ],
    },
  ];

  const allNavItems = navSections.flatMap((s) => s.items);
  const currentItem = allNavItems.find((item) => location.pathname.startsWith(item.to));
  const currentPageTitle = currentItem?.label || 'Administration';

  const timeString = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const dateString = currentTime.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="h-full h-[100dvh] w-full max-w-full flex bg-[#FAF7F2] text-text-primary overflow-hidden select-none">
      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden transition-opacity"
        />
      )}

      {/* Modern Minimalist Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-[#251814] text-cream-100 flex flex-col transition-all duration-300 ease-in-out lg:static ${
          isCollapsed ? 'lg:w-[72px]' : 'lg:w-[240px]'
        } ${isMobileMenuOpen ? 'w-[260px] translate-x-0' : '-translate-x-full lg:translate-x-0'} shadow-2xl lg:shadow-none border-r border-[#382620]`}
      >
        {/* Sidebar Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-[#382620] flex-shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="shrink-0">
              <BrandLogo variant="icon" size="sm" />
            </div>
            {(!isCollapsed || isMobileMenuOpen) && (
              <div className="truncate animate-in fade-in duration-200">
                <div className="font-extrabold text-sm text-white leading-tight tracking-tight">Chill & Choc</div>
                <div className="text-[9px] uppercase font-bold text-[#E99343] tracking-widest">
                  Admin Console
                </div>
              </div>
            )}
          </div>

          {/* Mobile Close Button */}
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden p-1.5 text-cream-200 hover:text-white rounded-lg hover:bg-white/5"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items with min-h-0 */}
        <nav className="flex-1 min-h-0 overflow-y-auto px-2.5 py-3 space-y-4 no-scrollbar">
          {navSections.map((section, sIdx) => (
            <div key={sIdx} className="space-y-1">
              {(!isCollapsed || isMobileMenuOpen) && (
                <div className="px-2.5 pt-1.5 pb-1 text-[9px] font-extrabold uppercase tracking-widest text-[#A89488]">
                  {section.title}
                </div>
              )}
              {isCollapsed && !isMobileMenuOpen && sIdx > 0 && (
                <div className="my-2 border-t border-white/10 mx-2" />
              )}
              {section.items.map((item, iIdx) => {
                const count = item.badgeCount || 0;
                const hasBadge = count > 0;

                return (
                  <NavLink
                    key={iIdx}
                    to={item.to}
                    onClick={() => setIsMobileMenuOpen(false)}
                    title={isCollapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      `group relative flex items-center ${
                        isCollapsed && !isMobileMenuOpen ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2'
                      } rounded-xl text-xs font-semibold transition-all duration-150 ${
                        isActive
                          ? 'bg-[#1FB5AE] text-white font-bold shadow-md shadow-[#1FB5AE]/20'
                          : 'text-[#D3C7BF] hover:bg-white/8 hover:text-white'
                      }`
                    }
                  >
                    <span className="shrink-0 relative flex items-center justify-center">
                      {item.icon}
                      {/* Collapsed view badge indicator (perfect circle, no blinking) */}
                      {isCollapsed && !isMobileMenuOpen && hasBadge && (
                        <span
                          className={`absolute -top-1.5 -right-2 ${
                            count > 9 ? 'min-w-[16px] h-4 px-1 rounded-full' : 'w-4 h-4 rounded-full'
                          } text-[9px] font-black bg-[#E99343] text-[#251814] flex items-center justify-center shadow-xs leading-none`}
                        >
                          {count}
                        </span>
                      )}
                    </span>
                    {(!isCollapsed || isMobileMenuOpen) && (
                      <>
                        <span className="truncate flex-1">{item.label}</span>
                        {hasBadge && (
                          <span
                            className={`ml-auto ${
                              count > 9 ? 'min-w-[20px] h-5 px-1.5 rounded-full' : 'w-5 h-5 rounded-full'
                            } text-[10px] font-black bg-[#E99343] text-[#251814] flex items-center justify-center shadow-xs shrink-0 leading-none`}
                          >
                            {count}
                          </span>
                        )}
                      </>
                    )}

                    {/* Floating tooltip for collapsed view */}
                    {isCollapsed && !isMobileMenuOpen && (
                      <div className="fixed left-[76px] hidden group-hover:flex items-center gap-1.5 px-2.5 py-1 bg-[#1A100C] text-white text-[11px] font-bold rounded-md shadow-xl border border-white/10 whitespace-nowrap z-50 pointer-events-none">
                        <span>{item.label}</span>
                        {hasBadge && (
                          <span
                            className={`${
                              count > 9 ? 'min-w-[16px] h-4 px-1 rounded-full' : 'w-4 h-4 rounded-full'
                            } text-[9px] font-black bg-[#E99343] text-[#251814] flex items-center justify-center leading-none`}
                          >
                            {count}
                          </span>
                        )}
                      </div>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer: User Profile & Collapse Toggle */}
        <div className="p-2.5 border-t border-[#382620] space-y-1 bg-[#1E130F] flex-shrink-0">
          <div
            className={`flex items-center ${
              isCollapsed && !isMobileMenuOpen ? 'justify-center' : 'justify-between px-2'
            } py-1.5`}
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-xl bg-[#F3B33D] text-[#3D2319] font-black text-xs flex items-center justify-center shrink-0 shadow-inner">
                {session.user.name.charAt(0)}
              </div>
              {(!isCollapsed || isMobileMenuOpen) && (
                <div className="truncate">
                  <div className="font-bold text-white text-xs truncate leading-tight">{session.user.name}</div>
                  <div className="text-[9px] text-[#1FB5AE] uppercase font-extrabold tracking-wider">
                    {session.user.role}
                  </div>
                </div>
              )}
            </div>

            {(!isCollapsed || isMobileMenuOpen) && (
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-[#C8B8AE] hover:text-[#D6534D] hover:bg-white/5 transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Desktop Sidebar Collapse Toggle */}
          <div className="hidden lg:flex justify-end pt-1 border-t border-white/5">
            <button
              onClick={toggleCollapse}
              className="w-full py-1.5 flex items-center justify-center text-[#A89488] hover:text-white hover:bg-white/5 rounded-lg text-[11px] font-medium transition-colors"
              title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-[#B6A59A]">
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Collapse Menu</span>
                </div>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-[#FAF7F2]">
        {/* Clean & Minimal Top Header */}
        <header className="h-16 bg-white/95 backdrop-blur-md border-b border-[#E9E0D5] px-4 sm:px-6 flex items-center justify-between flex-shrink-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 text-text-secondary hover:bg-cream-100 rounded-xl transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Clean Breadcrumb Title */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-text-muted hidden sm:inline">Admin</span>
              <span className="text-xs text-text-muted hidden sm:inline">/</span>
              <h1 className="font-extrabold text-sm sm:text-base text-brand-brown-dark tracking-tight">
                {currentPageTitle}
              </h1>
            </div>
          </div>

          {/* Top Bar Right: Clock */}
          <div className="flex items-center gap-2.5 sm:gap-3 select-none">
            <span className="text-xs sm:text-sm font-bold text-text-secondary whitespace-nowrap">
              {dateString}
            </span>
            <span className="text-[#D6C7B7] text-xs font-light">|</span>
            <span className="text-base sm:text-lg lg:text-xl font-black text-brand-brown-deep tracking-tight tabular-nums whitespace-nowrap">
              {timeString}
            </span>
          </div>
        </header>

        {/* Main Workspace Area */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-5 flex flex-col min-h-0 relative">
          <div className="flex-1 flex flex-col min-h-0 relative">
            <Outlet />
          </div>
        </main>

        {/* Minimal Global Footer */}
        <BrandFooter />
      </div>
    </div>
  );
};



