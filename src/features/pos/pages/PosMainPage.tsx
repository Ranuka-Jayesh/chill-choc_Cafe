import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { usePosCartStore } from '@/store/usePosCartStore';
import { authService } from '@/services/authService';
import { shiftService } from '@/services/shiftService';
import { catalogService } from '@/services/catalogService';
import { realtimeSocketService } from '@/services/realtimeSocketService';
import { soundService } from '@/services/soundService';
import { db } from '@/services/storage/db';
import { Product, Order, CashierShift } from '@/types';
import { toast } from 'sonner';

import { PosHeader } from '../components/PosHeader';
import { CategoryList } from '../components/CategoryList';
import { ProductCard } from '../components/ProductCard';
import { ModifierModal } from '../components/ModifierModal';
import { CartPanel } from '../components/CartPanel';
import { PaymentModal } from '../components/PaymentModal';
import { CashInOutModal } from '../components/CashInOutModal';
import { PosPrinterSettingsModal } from '../components/PosPrinterSettingsModal';
import { OrdersHistoryDrawer } from '../components/OrdersHistoryDrawer';
import { PosExpensesDrawer } from '../components/PosExpensesDrawer';
import { PosStockDrawer } from '../components/PosStockDrawer';
import { HeldOrdersModal } from '../components/HeldOrdersModal';
import { ThermalReceiptModal } from '@/components/brand/ThermalReceiptModal';
import { KOTPreviewModal } from '@/components/brand/KOTPreviewModal';
import { OpenShiftModal } from './OpenShiftModal';
import { BrandFooter } from '@/components/brand/BrandFooter';
import { Sparkles, ShoppingBag, ArrowRight, X, ChevronUp, Layers } from 'lucide-react';
import { formatLKR } from '@/utils/format';

export const PosMainPage: React.FC = () => {
  const navigate = useNavigate();
  const { session, logout } = useAuthStore();
  const cart = usePosCartStore();

  // Local state
  const [activeShift, setActiveShift] = useState<CashierShift | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [configuringProduct, setConfiguringProduct] = useState<Product | null>(null);

  // Modal / Drawer states
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isCashInOutOpen, setIsCashInOutOpen] = useState(false);
  const [isExpensesOpen, setIsExpensesOpen] = useState(false);
  const [isStockDrawerOpen, setIsStockDrawerOpen] = useState(false);
  const [isPrinterQueueOpen, setIsPrinterQueueOpen] = useState(false);
  const [isOrdersHistoryOpen, setIsOrdersHistoryOpen] = useState(false);
  const [isHeldOrdersOpen, setIsHeldOrdersOpen] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

  // Printable slip view states
  const [viewingReceiptOrder, setViewingReceiptOrder] = useState<Order | null>(null);
  const [viewingKOTOrder, setViewingKOTOrder] = useState<Order | null>(null);

  // Quick Tips toggle
  const [showDemoGuide, setShowDemoGuide] = useState(true);

  // Reactive shift & catalog states
  const [categories, setCategories] = useState(catalogService.getCategories());
  const [products, setProducts] = useState(catalogService.getProducts());

  useEffect(() => {
    if (!session) {
      navigate('/pos/login');
      return;
    }

    const refreshData = () => {
      setCategories(catalogService.getCategories());
      setProducts(catalogService.getProducts());
      const shift = shiftService.getActiveShift(session.user.id, session.terminalId);
      setActiveShift(shift);
    };

    refreshData();

    // 1. Subscribe to Local Database Updates
    const unsubDb = db.subscribe(() => {
      refreshData();
    });

    // 2. Subscribe to Realtime Cluster WebSocket Broadcasts
    const unsubCatalog = realtimeSocketService.on('CATALOG_CHANGED', (msg) => {
      db.syncFromStorage();
      const entity = msg.payload?.entity;
      const action = msg.payload?.action;
      const item = msg.payload?.item;

      // Always reload products immediately
      const freshProds = catalogService.getProducts();
      setProducts((prev) => {
        if (item && item.id) {
          return freshProds.map((p) => (p.id === item.id ? { ...p, isSoldOut: item.isSoldOut } : p));
        }
        return freshProds;
      });
      setCategories(catalogService.getCategories());

      if (action === 'UPDATE' && entity === 'product' && item) {
        if (item.isSoldOut) {
          toast.warning(`"${item.name || 'Menu item'}" is now OUT OF STOCK (marked by Admin)`, {
            duration: 4000,
          });
        } else {
          toast.success(`"${item.name || 'Menu item'}" is now IN STOCK (updated by Admin)`, {
            duration: 3000,
          });
        }
      } else if (action === 'CREATE' && entity === 'product') {
        toast.success(`New item added: "${item?.name || 'New Product'}"`, { duration: 3000 });
      } else if (action === 'DELETE' && entity === 'product') {
        toast.info('A menu item was removed from catalog', { duration: 2500 });
      }
    });

    const unsubStock = realtimeSocketService.on('STOCK_CHANGED', () => {
      db.syncFromStorage();
      refreshData();
    });

    const unsubShift = realtimeSocketService.on('SHIFT_CHANGED', (msg) => {
      if (msg.payload?.shift?.cashierId === session.user.id) {
        setActiveShift(msg.payload.shift);
      }
    });

    const unsubSettings = realtimeSocketService.on('SETTINGS_CHANGED', () => {
      refreshData();
    });

    return () => {
      unsubDb();
      unsubCatalog();
      unsubStock();
      unsubShift();
      unsubSettings();
    };
  }, [session, navigate]);

  // Keyboard Shortcuts (F2 Search, F4 Pay, F5 Hold, Esc Modal / Fullscreen)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        const searchInput = document.getElementById('product-search-input');
        searchInput?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (cart.items.length > 0) {
          setIsPaymentOpen(true);
        }
      } else if (e.key === 'F5') {
        e.preventDefault();
        if (cart.items.length > 0) {
          window.dispatchEvent(new CustomEvent('pos-hold-order-f5'));
        }
      } else if (e.key === 'Escape') {
        // 1. Close any open top-level modal/drawer in POS first
        if (configuringProduct) {
          e.preventDefault();
          e.stopPropagation();
          setConfiguringProduct(null);
          return;
        }
        if (isPaymentOpen) {
          e.preventDefault();
          e.stopPropagation();
          setIsPaymentOpen(false);
          return;
        }
        if (isCashInOutOpen) {
          e.preventDefault();
          e.stopPropagation();
          setIsCashInOutOpen(false);
          return;
        }
        if (isPrinterQueueOpen) {
          e.preventDefault();
          e.stopPropagation();
          setIsPrinterQueueOpen(false);
          return;
        }
        if (isOrdersHistoryOpen) {
          e.preventDefault();
          e.stopPropagation();
          setIsOrdersHistoryOpen(false);
          return;
        }
        if (isHeldOrdersOpen) {
          e.preventDefault();
          e.stopPropagation();
          setIsHeldOrdersOpen(false);
          return;
        }
        if (isMobileCartOpen) {
          e.preventDefault();
          e.stopPropagation();
          setIsMobileCartOpen(false);
          return;
        }
        if (viewingReceiptOrder) {
          e.preventDefault();
          e.stopPropagation();
          setViewingReceiptOrder(null);
          return;
        }
        if (viewingKOTOrder) {
          e.preventDefault();
          e.stopPropagation();
          setViewingKOTOrder(null);
          return;
        }

        // 2. If any child modal exists in DOM (e.g. TableModal, HoldOrderModal, DiscountModal, ConfirmModal)
        const openModalOverlay = document.querySelector('.fixed.inset-0');
        if (openModalOverlay) {
          return; // Let the modal's own Escape listener close it
        }

        // 3. If NO modal is open and in fullscreen -> exit fullscreen back to normal
        if (document.fullscreenElement) {
          e.preventDefault();
          document.exitFullscreen().catch(() => {});
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    cart.items.length,
    configuringProduct,
    isPaymentOpen,
    isCashInOutOpen,
    isPrinterQueueOpen,
    isOrdersHistoryOpen,
    isHeldOrdersOpen,
    isMobileCartOpen,
    viewingReceiptOrder,
    viewingKOTOrder,
  ]);

  if (!session) return null;

  // Filter products by category and search
  const filteredProducts = products.filter((p) => {
    if (selectedCategoryId && p.categoryId !== selectedCategoryId) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
    }
    return true;
  });

  const handleProductTap = (product: Product) => {
    const hasModifiers = product.modifierGroupIds && product.modifierGroupIds.length > 0;
    if (hasModifiers) {
      setConfiguringProduct(product);
    } else {
      cart.addItem(product, [], 1);
    }
  };

  const handleOrderCompleted = (completedOrder: Order) => {
    setViewingReceiptOrder(completedOrder);
    setIsMobileCartOpen(false);
  };

  if (!session) {
    return null;
  }

  const handleLogout = () => {
    if (activeShift && activeShift.status === 'OPEN') {
      navigate('/pos/close-shift');
    } else {
      soundService.playLogout();
      logout();
      navigate('/pos/login');
    }
  };

  const cartItemCount = cart.getItemCount();
  const cartTotal = cart.getTotalCents();

  return (
    <div className="h-full h-[100dvh] w-full max-w-full flex flex-col bg-bg overflow-hidden select-none">
      {/* 1. POS Top Header */}
      <PosHeader
        user={session.user}
        shift={activeShift}
        onOpenOrdersHistory={() => setIsOrdersHistoryOpen(true)}
        onOpenExpenses={() => setIsExpensesOpen(true)}
        onOpenStockDrawer={() => setIsStockDrawerOpen(true)}
        onOpenCashInOut={() => setIsCashInOutOpen(true)}
        onOpenPrinterManager={() => setIsPrinterQueueOpen(true)}
        onOpenHeldOrders={() => setIsHeldOrdersOpen(true)}
        onLogoutClick={handleLogout}
      />

      {/* 2. Main Touch POS Workspace */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative">
        {/* Left Category Navigation (Desktop sidebar) */}
        <div className="hidden md:flex w-[180px] lg:w-[210px] xl:w-[230px] flex-shrink-0 h-full flex-col min-h-0">
          <CategoryList
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={setSelectedCategoryId}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </div>

        {/* Center Product Catalog Grid */}
        <main className="flex-1 h-full min-h-0 overflow-hidden p-2.5 sm:p-4 bg-bg flex flex-col">
          {/* Mobile / Tablet Horizontal Category Scroll Strip */}
          <div className="md:hidden mb-2.5 space-y-2 flex-shrink-0">
            <div className="relative">
              <input
                type="text"
                placeholder="Search coffee, dessert... (F2)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-border rounded-xl text-xs font-bold shadow-xs"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              <button
                onClick={() => setSelectedCategoryId(null)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black whitespace-nowrap transition-all ${
                  selectedCategoryId === null
                    ? 'bg-brand-teal text-white shadow-teal'
                    : 'bg-white text-text-primary border border-border'
                }`}
              >
                All Menu
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black whitespace-nowrap transition-all ${
                    selectedCategoryId === cat.id
                      ? 'bg-brand-teal text-white shadow-teal'
                      : 'bg-white text-text-primary border border-border'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Active Category Header (Pinned / Non-scrolling) */}
          <div className="flex items-center justify-between mb-2 sm:mb-3 flex-shrink-0">
            <div>
              <h2 className="font-black text-sm sm:text-base lg:text-lg text-brand-brown-dark tracking-tight leading-tight">
                {selectedCategoryId
                  ? categories.find((c) => c.id === selectedCategoryId)?.name
                  : 'All Menu Offerings'}
              </h2>
              <p className="text-[11px] text-text-secondary mt-0.5">
                Showing {filteredProducts.length} items • Touch card to add or customize
              </p>
            </div>

            {/* Quick Demo Workflow Helper Pill */}
            {showDemoGuide && (
              <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-yellow-light border border-brand-yellow/40 text-amber-900 text-[11px] font-bold shadow-xs">
                <Sparkles className="w-3 h-3 text-brand-orange" />
                <span>Demo: Tap 2x Cappuccino + 1x Brownie → Hold / PAY Cash</span>
                <button
                  onClick={() => setShowDemoGuide(false)}
                  className="text-text-secondary hover:text-text-primary text-[10px] ml-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Product Cards Grid (Internal Scroll Only) */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 scrollbar-thin">
            {filteredProducts.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center text-text-secondary">
                <p className="font-bold text-sm">No menu products match your search.</p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategoryId(null);
                  }}
                  className="mt-2 text-xs font-bold text-brand-teal underline cursor-pointer"
                >
                  Reset filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3.5 pb-16 lg:pb-4">
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} onClick={handleProductTap} />
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Right Cart & Checkout Panel (Desktop fixed sidebar) */}
        <div className="hidden lg:flex w-[340px] xl:w-[380px] 2xl:w-[400px] flex-shrink-0 h-full flex-col min-h-0">
          <CartPanel onOpenPayment={() => setIsPaymentOpen(true)} />
        </div>
      </div>

      {/* POS Bottom Status & Version Line */}
      <BrandFooter />

      {/* Mobile / Tablet Floating Cart Bar (Appears when cart has items on < lg screens) */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 p-3 bg-white/95 backdrop-blur-md border-t border-border/80 shadow-2xl z-30 flex items-center justify-between gap-3">
        <button
          onClick={() => setIsMobileCartOpen(true)}
          className="flex items-center gap-3 px-3 py-2 rounded-2xl bg-cream-100/90 text-brand-brown-dark active:scale-95 transition-all text-left"
        >
          <div className="relative w-10 h-10 rounded-xl bg-brand-teal text-white flex items-center justify-center font-black">
            <ShoppingBag className="w-5 h-5" />
            {cartItemCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-brand-orange text-white text-[10px] font-black flex items-center justify-center ring-2 ring-white">
                {cartItemCount}
              </span>
            )}
          </div>
          <div>
            <div className="text-xs font-black text-brand-brown-dark">
              {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'}
            </div>
            <div className="text-sm font-black text-brand-teal tabular-nums">
              {formatLKR(cartTotal)}
            </div>
          </div>
        </button>

        <button
          disabled={cartItemCount === 0}
          onClick={() => setIsPaymentOpen(true)}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-brand-teal hover:bg-brand-teal-dark disabled:opacity-40 text-white font-black text-sm shadow-teal active:scale-95 transition-all"
        >
          <span>CHECKOUT</span>
          <ArrowRight className="w-4 h-4 stroke-[3]" />
        </button>
      </div>

      {/* Mobile Cart Drawer Modal */}
      {isMobileCartOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex flex-col justify-end bg-brand-brown-deep/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full bg-white rounded-t-[32px] shadow-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between px-5 py-3.5 bg-cream-50 border-b border-border">
              <h3 className="font-extrabold text-sm text-brand-brown-dark flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-brand-teal" />
                <span>Current Order Cart</span>
              </h3>
              <button
                onClick={() => setIsMobileCartOpen(false)}
                className="p-1.5 text-text-secondary hover:bg-cream-200 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <CartPanel
                onOpenPayment={() => {
                  setIsMobileCartOpen(false);
                  setIsPaymentOpen(true);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 3. Mandatory Shift Opening Modal if no active shift */}
      {(!activeShift || activeShift.status !== 'OPEN') && (
        <OpenShiftModal
          user={session.user}
          onShiftOpened={(sh) => setActiveShift(sh)}
          onLogout={handleLogout}
        />
      )}

      {/* 4. Product Modifier Customization Modal */}
      <ModifierModal
        product={configuringProduct}
        isOpen={Boolean(configuringProduct)}
        onClose={() => setConfiguringProduct(null)}
        onConfirm={(prod, mods, qty, notes) => cart.addItem(prod, mods, qty, notes)}
      />

      {/* 5. Payment Modal */}
      {activeShift && (
        <PaymentModal
          isOpen={isPaymentOpen}
          onClose={() => setIsPaymentOpen(false)}
          shift={activeShift}
          user={session.user}
          onOrderSuccess={handleOrderCompleted}
        />
      )}

      {/* 6. Cash In / Out Drawer Modal */}
      {activeShift && (
        <CashInOutModal
          isOpen={isCashInOutOpen}
          onClose={() => setIsCashInOutOpen(false)}
          shift={activeShift}
          user={session.user}
        />
      )}

      {/* 7. Comprehensive Printer Manager & Hardware Routing Modal */}
      <PosPrinterSettingsModal
        isOpen={isPrinterQueueOpen}
        onClose={() => setIsPrinterQueueOpen(false)}
      />

      {/* 8. Recent Orders Slide-over Drawer */}
      <OrdersHistoryDrawer
        isOpen={isOrdersHistoryOpen}
        onClose={() => setIsOrdersHistoryOpen(false)}
        onViewReceipt={(ord) => setViewingReceiptOrder(ord)}
        onViewKOT={(ord) => setViewingKOTOrder(ord)}
        userId={session.user.id}
        userName={session.user.name}
      />

      {/* 9. Cashier Shift Operating Expenses Slide-over Drawer */}
      <PosExpensesDrawer
        isOpen={isExpensesOpen}
        onClose={() => setIsExpensesOpen(false)}
        shift={activeShift}
        user={session.user}
      />

      {/* 10. Live Ingredients Stock & Expiry Slide-over Drawer */}
      <PosStockDrawer
        isOpen={isStockDrawerOpen}
        onClose={() => setIsStockDrawerOpen(false)}
      />

      {/* 10. Held Orders Modal */}
      <HeldOrdersModal
        isOpen={isHeldOrdersOpen}
        onClose={() => setIsHeldOrdersOpen(false)}
      />

      {/* 10. Thermal Receipt Printable Modal */}
      <ThermalReceiptModal
        order={viewingReceiptOrder}
        isOpen={Boolean(viewingReceiptOrder)}
        onClose={() => setViewingReceiptOrder(null)}
      />

      {/* 11. Kitchen Order Ticket (KOT) Modal */}
      <KOTPreviewModal
        order={viewingKOTOrder}
        isOpen={Boolean(viewingKOTOrder)}
        onClose={() => setViewingKOTOrder(null)}
      />
    </div>
  );
};
