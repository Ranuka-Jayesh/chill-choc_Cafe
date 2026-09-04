import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { inventoryService, getSupplierAvailableIngredients } from '@/services/inventoryService';
import { catalogService } from '@/services/catalogService';
import {
  InventoryMovement,
  Purchase,
  PurchaseItem,
  Ingredient,
  Supplier,
  PurchasePaymentSplit,
  PurchasePaymentMethod,
  PurchasePaymentStatus,
  StockRequest,
} from '@/types';
import { db } from '@/services/storage/db';
import { authService } from '@/services/authService';
import { realtimeSocketService } from '@/services/realtimeSocketService';
import { formatLKR, formatDateTime } from '@/utils/format';
import {
  History,
  Truck,
  Plus,
  Minus,
  Search,
  CheckCircle2,
  XCircle,
  X,
  Boxes,
  ArrowDownRight,
  ArrowUpRight,
  Filter,
  Eye,
  Calendar,
  Layers,
  ShoppingBag,
  SlidersHorizontal,
  RotateCcw,
  AlertTriangle,
  Receipt,
  Building2,
  Check,
  Edit2,
  Trash2,
  Sparkles,
  Package,
  Banknote,
  CreditCard,
  FileText,
  Landmark,
  Wallet,
  Clock,
  Printer,
  Copy,
} from 'lucide-react';
import { confirmDialog, promptDialog } from '@/store/useConfirmStore';
import { CustomDatePicker } from '@/components/ui/CustomDatePicker';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { CustomSelect, SelectOption } from '@/components/ui/CustomSelect';
import { MonthYearPicker, MonthYearValue } from '@/components/ui/MonthYearPicker';

type ActiveTab = 'stock' | 'movements' | 'purchases' | 'requests';
type StockStatusFilter = 'ALL' | 'EXPIRED' | 'EXPIRING_SOON' | 'OPTIMAL' | 'LOW' | 'OUT';
type MovementFilter = 'ALL' | 'PURCHASE' | 'SALE_CONSUMPTION' | 'RETURN' | 'ADJUSTMENT' | 'WASTE';
type RequestStatusFilter = 'ALL' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

const STOCK_STATUS_OPTIONS: SelectOption[] = [
  { value: 'ALL', label: 'All Stock Levels' },
  { value: 'EXPIRED', label: 'Expired Items' },
  { value: 'EXPIRING_SOON', label: 'Expiring Soon (≤7d)' },
  { value: 'OPTIMAL', label: 'Optimal Stock' },
  { value: 'LOW', label: 'Low Stock (< Reorder)' },
  { value: 'OUT', label: 'Out of Stock (0)' },
];

const MOVEMENT_FILTER_OPTIONS: SelectOption[] = [
  { value: 'ALL', label: 'All Movements' },
  { value: 'PURCHASE', label: 'Purchases (PO)' },
  { value: 'SALE_CONSUMPTION', label: 'POS Sales' },
  { value: 'RETURN', label: 'Refund Returns' },
  { value: 'ADJUSTMENT', label: 'Adjustments' },
  { value: 'WASTE', label: 'Waste / Spoilage' },
];

const REQUEST_STATUS_OPTIONS: SelectOption[] = [
  { value: 'ALL', label: 'All Requests' },
  { value: 'PENDING_APPROVAL', label: 'Pending Review' },
  { value: 'APPROVED', label: 'Approved Requests' },
  { value: 'REJECTED', label: 'Rejected Requests' },
];

export const AdminInventoryPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const activeTab: ActiveTab =
    rawTab === 'movements' || rawTab === 'purchases' || rawTab === 'stock' || rawTab === 'requests'
      ? rawTab
      : 'stock';

  const now = new Date();
  const currentMonthStr = String(now.getMonth() + 1);
  const currentYearStr = String(now.getFullYear());

  const [dateRange, setDateRange] = useState<MonthYearValue>({
    year: currentYearStr,
    month: currentMonthStr,
  });

  const [ingredients, setIngredients] = useState<Ingredient[]>(inventoryService.getIngredients());
  const [movements, setMovements] = useState<InventoryMovement[]>(inventoryService.getMovements());
  const [purchases, setPurchases] = useState<Purchase[]>(catalogService.getPurchases());
  const [suppliers, setSuppliers] = useState<Supplier[]>(catalogService.getSuppliers());
  const [stockRequests, setStockRequests] = useState<StockRequest[]>(inventoryService.getStockRequests());

  // Unified Review & Edit Stock Request Modal State (Image 2/3 Pattern)
  const [reviewAction, setReviewAction] = useState<'ADD' | 'DEDUCT' | 'EXACT'>('ADD');
  const [reviewQty, setReviewQty] = useState<number>(1);
  const [reviewExpiry, setReviewExpiry] = useState<string>('');
  const [reviewCost, setReviewCost] = useState<string>('');
  const [reviewReason, setReviewReason] = useState<string>('');

  // Search & Filters
  const [search, setSearch] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [stockStatusFilter, setStockStatusFilter] = useState<StockStatusFilter>('ALL');
  const [movementFilter, setMovementFilter] = useState<MovementFilter>('ALL');
  const [ingredientFilter, setIngredientFilter] = useState<string>('ALL');
  const [requestStatusFilter, setRequestStatusFilter] = useState<RequestStatusFilter>('ALL');

  // Modals State
  const [editingIngredient, setEditingIngredient] = useState<Partial<Ingredient> | null>(null);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [viewingPurchase, setViewingPurchase] = useState<Purchase | null>(null);
  const [viewingRequest, setViewingRequest] = useState<StockRequest | null>(null);

  // New Purchase Form State
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [vendorName, setVendorName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${Date.now().toString().slice(-4)}`);
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [purchaseNotes, setPurchaseNotes] = useState<string>('');
  const [purchaseSearch, setPurchaseSearch] = useState<string>('');
  const [isPurchaseSearchFocused, setIsPurchaseSearchFocused] = useState<boolean>(false);

  // Active Suppliers Memo
  const activeSuppliers = useMemo(() => suppliers.filter((s) => s.active !== false), [suppliers]);

  // Ingredients available according to selected supplier
  const availableIngredients = useMemo(
    () => getSupplierAvailableIngredients(selectedSupplierId, suppliers, ingredients),
    [selectedSupplierId, suppliers, ingredients]
  );

  // Payment Breakdown State in Goods Inward
  const [cashAmount, setCashAmount] = useState<string>('');
  const [cardAmount, setCardAmount] = useState<string>('');
  const [chequeAmount, setChequeAmount] = useState<string>('');
  const [chequeNumber, setChequeNumber] = useState<string>('');
  const [chequeBank, setChequeBank] = useState<string>('');
  const [chequeDate, setChequeDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [duePaymentDate, setDuePaymentDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });

  // Interactive View Purchase Modal - Settle Payment State
  const [isAddingPayment, setIsAddingPayment] = useState(false);
  const [settleMethod, setSettleMethod] = useState<'CASH' | 'CARD' | 'CHEQUE'>('CASH');
  const [settleAmount, setSettleAmount] = useState<string>('');
  const [settleChequeNumber, setSettleChequeNumber] = useState<string>('');
  const [settleChequeBank, setSettleChequeBank] = useState<string>('');
  const [settleChequeDate, setSettleChequeDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });

  // Manual Stock Adjustment Form State
  const [isSpecificIngredientAdjust, setIsSpecificIngredientAdjust] = useState(false);
  const [adjustIngredientId, setAdjustIngredientId] = useState<string>('');
  const [adjustType, setAdjustType] = useState<'ADD' | 'DEDUCT' | 'EXACT'>('ADD');
  const [adjustQuantity, setAdjustQuantity] = useState<number>(1);
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [adjustExpiry, setAdjustExpiry] = useState<string>('');

  const handleRecordSettlementPayment = () => {
    if (!viewingPurchase) return;
    const numAmt = parseFloat(settleAmount) || 0;
    if (numAmt <= 0) {
      toast.error('Please enter a valid payment amount.');
      return;
    }

    if (settleMethod === 'CHEQUE' && (!settleChequeNumber.trim() || !settleChequeBank.trim())) {
      toast.error('Please enter Cheque Number and Bank Name.');
      return;
    }

    const paymentSplit: PurchasePaymentSplit = {
      method: settleMethod,
      amountCents: Math.round(numAmt * 100),
      timestamp: new Date().toISOString(),
      ...(settleMethod === 'CHEQUE'
        ? {
            chequeNumber: settleChequeNumber.trim(),
            bankName: settleChequeBank.trim(),
            chequeDate: settleChequeDate,
          }
        : {}),
    };

    const updated = inventoryService.addPurchasePayment(viewingPurchase.id, paymentSplit);
    if (updated) {
      setViewingPurchase(updated);
      setPurchases(catalogService.getPurchases());
      setIsAddingPayment(false);
      setSettleAmount('');
      setSettleChequeNumber('');
      setSettleChequeBank('');
      toast.success(
        `Payment of ${formatLKR(Math.round(numAmt * 100))} recorded! Status: ${
          updated.paymentStatus === 'PAID' ? 'Fully Settled' : 'Partial Paid'
        }`
      );
    }
  };

  const handleMarkChequeCleared = (purchaseId: string, chequeNumber?: string) => {
    const updated = inventoryService.clearPurchaseChequePayment({
      purchaseId,
      chequeNumber,
      clearedDate: new Date().toISOString(),
    });
    if (updated) {
      setViewingPurchase(updated);
      setPurchases(catalogService.getPurchases());
      toast.success(`Cheque ${chequeNumber ? `#${chequeNumber}` : ''} successfully marked as Cleared & Paid!`);
    } else {
      toast.error('Failed to update cheque status.');
    }
  };

  // ---------------------------------------------------------------------------
  // Lifecycle & Synchronization (DB & Realtime Sockets)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const unsub = db.subscribe(() => {
      setIngredients(inventoryService.getIngredients());
      setMovements(inventoryService.getMovements());
      setPurchases(catalogService.getPurchases());
      setStockRequests(inventoryService.getStockRequests());
    });

    const handleRealtime = () => {
      setIngredients(inventoryService.getIngredients());
      setMovements(inventoryService.getMovements());
      setPurchases(catalogService.getPurchases());
      setStockRequests(inventoryService.getStockRequests());
    };

    const unsub1 = realtimeSocketService.on('STOCK_CHANGED', handleRealtime);
    const unsub2 = realtimeSocketService.on('STOCK_REQUEST_PENDING', handleRealtime);
    const unsub3 = realtimeSocketService.on('STOCK_REQUEST_APPROVED', handleRealtime);
    const unsub4 = realtimeSocketService.on('STOCK_REQUEST_REJECTED', handleRealtime);

    return () => {
      unsub();
      unsub1();
      unsub2();
      unsub3();
      unsub4();
    };
  }, []);

  // Pending Cashier Stock Requests Memo
  const pendingStockRequests = useMemo(() => {
    return stockRequests.filter((r) => r.status === 'PENDING_APPROVAL');
  }, [stockRequests]);

  // Stock Request Authorization Handlers
  const handleApproveStockRequest = (req: StockRequest) => {
    const session = authService.getCurrentSession();
    const adminId = session?.user?.id || 'usr_admin';
    const adminName = session?.user?.name || 'Administrator';

    try {
      inventoryService.approveStockRequest({
        requestId: req.id,
        adminId,
        adminName,
      });
      toast.success(
        `Approved ${req.type === 'STOCK_DELIVERY' ? 'delivery intake' : 'stock adjustment'} for "${req.ingredientName}".`
      );
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve request');
    }
  };

  const handleRejectStockRequest = async (req: StockRequest) => {
    const reason = await promptDialog({
      title: `Reject ${req.type === 'STOCK_DELIVERY' ? 'Delivery Intake' : 'Stock Adjustment'} Request`,
      message: `Enter rejection reason for ${req.requestedByUserName}'s request on "${req.ingredientName}":`,
      defaultValue: 'Declined by administrator',
      confirmText: 'Reject Request',
      variant: 'danger',
    });

    if (reason === null) return;

    const session = authService.getCurrentSession();
    const adminId = session?.user?.id || 'usr_admin';
    const adminName = session?.user?.name || 'Administrator';

    try {
      inventoryService.rejectStockRequest({
        requestId: req.id,
        adminId,
        adminName,
        reason: reason || 'Declined by administrator',
      });
      toast.info(`Rejected request for "${req.ingredientName}".`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject request');
    }
  };

  const handleOpenRequestModal = (req: StockRequest) => {
    setViewingRequest(req);
    const isDelivery = req.type === 'STOCK_DELIVERY';
    if (isDelivery) {
      setReviewAction('ADD');
      setReviewQty(req.quantityChange || 1);
    } else {
      if (req.quantityChange > 0) {
        setReviewAction('ADD');
        setReviewQty(req.quantityChange);
      } else if (req.quantityChange < 0) {
        setReviewAction('DEDUCT');
        setReviewQty(Math.abs(req.quantityChange));
      } else {
        setReviewAction('EXACT');
        setReviewQty(req.requestedStock ?? req.currentStock);
      }
    }
    const ing = ingredients.find((i) => i.id === req.ingredientId);
    setReviewExpiry(req.expiryDate || ing?.expiryDate || '');
    setReviewCost(req.costCents ? String(req.costCents / 100) : '');
    setReviewReason(req.reason || '');
  };

  const handleApproveWithEdits = (reqToApprove?: StockRequest) => {
    const target = reqToApprove || viewingRequest;
    if (!target) return;

    const parsedQty = reviewQty;
    if (isNaN(parsedQty) || parsedQty < 0) {
      toast.error('Please enter a valid quantity.');
      return;
    }

    const cur = target.currentStock;
    let finalQty: number;
    if (target.type === 'STOCK_DELIVERY') {
      finalQty = reviewQty;
    } else {
      if (reviewAction === 'ADD') {
        finalQty = cur + reviewQty;
      } else if (reviewAction === 'DEDUCT') {
        finalQty = Math.max(0, cur - reviewQty);
      } else {
        finalQty = reviewQty;
      }
    }

    const parsedCost = reviewCost ? Math.round(parseFloat(reviewCost) * 100) : undefined;
    const session = authService.getCurrentSession();
    const adminId = session?.user?.id || 'usr_admin';
    const adminName = session?.user?.name || 'Administrator';

    try {
      inventoryService.approveStockRequest({
        requestId: target.id,
        adminId,
        adminName,
        modifiedQty: finalQty,
        modifiedCost: parsedCost,
        modifiedExpiry: reviewExpiry || undefined,
      });
      toast.success(
        `Approved ${target.type === 'STOCK_DELIVERY' ? 'delivery intake' : 'stock adjustment'} for "${target.ingredientName}".`
      );
      setViewingRequest(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve request');
    }
  };

  // Handle Escape key to close any open modal/form
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isAddingPayment) {
          setIsAddingPayment(false);
          return;
        }
        if (viewingPurchase) {
          setViewingPurchase(null);
          setIsAddingPayment(false);
          return;
        }
        if (viewingRequest) {
          setViewingRequest(null);
          return;
        }
        if (isReceiveModalOpen) {
          setIsReceiveModalOpen(false);
          return;
        }
        if (editingIngredient) {
          setEditingIngredient(null);
          return;
        }
        if (isAdjustModalOpen) {
          setIsAdjustModalOpen(false);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAddingPayment, viewingPurchase, viewingRequest, isReceiveModalOpen, editingIngredient, isAdjustModalOpen]);

  const handleTabChange = (tab: ActiveTab) => {
    setSearchParams({ tab });
    setSearch('');
  };

  // ---------------------------------------------------------------------------
  // Expiration Status Helper
  // ---------------------------------------------------------------------------
  const getExpiryStatus = (expiryDate?: string): {
    status: 'EXPIRED' | 'EXPIRING_SOON' | 'VALID' | 'NONE';
    daysLeft: number | null;
  } => {
    if (!expiryDate) return { status: 'NONE', daysLeft: null };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(expiryDate);
    exp.setHours(0, 0, 0, 0);
    if (isNaN(exp.getTime())) return { status: 'NONE', daysLeft: null };

    const diffDays = Math.round((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { status: 'EXPIRED', daysLeft: diffDays };
    if (diffDays <= 7) return { status: 'EXPIRING_SOON', daysLeft: diffDays };
    return { status: 'VALID', daysLeft: diffDays };
  };

  // ---------------------------------------------------------------------------
  // KPI Calculations
  // ---------------------------------------------------------------------------
  const totalIngredientsCount = ingredients.length;
  const expiredIngredientsCount = ingredients.filter((i) => getExpiryStatus(i.expiryDate).status === 'EXPIRED').length;
  const expiringSoonCount = ingredients.filter((i) => getExpiryStatus(i.expiryDate).status === 'EXPIRING_SOON').length;
  const outOfStockCount = ingredients.filter((i) => i.currentStock <= 0).length;
  const lowStockCount = ingredients.filter((i) => i.currentStock > 0 && i.currentStock <= i.reorderLevel).length;
  const optimalCount = ingredients.filter((i) => i.currentStock > i.reorderLevel && getExpiryStatus(i.expiryDate).status !== 'EXPIRED').length;
  const totalValuationCents = ingredients.reduce(
    (acc, i) => acc + i.currentStock * (i.averageCostCents || 0),
    0
  );

  const totalPurchaseSpendCents = useMemo(() => {
    return purchases.reduce((sum, p) => sum + (p.totalCents || 0), 0);
  }, [purchases]);

  // ---------------------------------------------------------------------------
  // Purchase Modal Payment Settlement Computed Values
  // ---------------------------------------------------------------------------
  const totalInvoicedCents = useMemo(() => {
    return purchaseItems.reduce((sum, item) => sum + item.totalCents, 0);
  }, [purchaseItems]);

  const numCash = Math.max(0, parseFloat(cashAmount) || 0);
  const numCard = Math.max(0, parseFloat(cardAmount) || 0);
  const numCheque = Math.max(0, parseFloat(chequeAmount) || 0);
  const totalPaidCents = Math.round((numCash + numCard + numCheque) * 100);
  const balanceDueCents = Math.max(0, totalInvoicedCents - totalPaidCents);
  const overpaidCents = Math.max(0, totalPaidCents - totalInvoicedCents);

  const paymentStatus: PurchasePaymentStatus =
    totalPaidCents >= totalInvoicedCents && totalInvoicedCents > 0
      ? 'PAID'
      : totalPaidCents > 0
      ? 'PARTIAL'
      : 'UNPAID';

  const handleSetFullPayment = (method: 'CASH' | 'CARD' | 'CHEQUE' | 'UNPAID') => {
    const totalRupees = totalInvoicedCents / 100;
    if (method === 'CASH') {
      setCashAmount(totalRupees > 0 ? String(totalRupees) : '');
      setCardAmount('');
      setChequeAmount('');
    } else if (method === 'CARD') {
      setCardAmount(totalRupees > 0 ? String(totalRupees) : '');
      setCashAmount('');
      setChequeAmount('');
    } else if (method === 'CHEQUE') {
      setChequeAmount(totalRupees > 0 ? String(totalRupees) : '');
      setCashAmount('');
      setCardAmount('');
      if (!chequeNumber) setChequeNumber(`CHQ-${Date.now().toString().slice(-4)}`);
      if (!chequeBank) setChequeBank('Commercial Bank');
    } else if (method === 'UNPAID') {
      setCashAmount('');
      setCardAmount('');
      setChequeAmount('');
    }
  };

  // ---------------------------------------------------------------------------
  // Filtering Ingredients (Stock Tab)
  // ---------------------------------------------------------------------------
  const filteredIngredients = useMemo(() => {
    return ingredients.filter((ing) => {
      const isOut = ing.currentStock <= 0;
      const isLow = !isOut && ing.currentStock <= ing.reorderLevel;
      const expiry = getExpiryStatus(ing.expiryDate);

      if (stockStatusFilter === 'EXPIRED' && expiry.status !== 'EXPIRED') return false;
      if (stockStatusFilter === 'EXPIRING_SOON' && expiry.status !== 'EXPIRING_SOON') return false;
      if (stockStatusFilter === 'OUT' && !isOut) return false;
      if (stockStatusFilter === 'LOW' && !isLow) return false;
      if (stockStatusFilter === 'OPTIMAL' && (isLow || isOut || expiry.status === 'EXPIRED')) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          ing.name.toLowerCase().includes(q) ||
          ing.sku.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [ingredients, stockStatusFilter, search]);

  // ---------------------------------------------------------------------------
  // Filtering Stock Movements (Movements Tab)
  // ---------------------------------------------------------------------------
  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      if (movementFilter === 'PURCHASE' && m.type !== 'PURCHASE') return false;
      if (movementFilter === 'SALE_CONSUMPTION' && m.type !== 'SALE_CONSUMPTION') return false;
      if (movementFilter === 'RETURN' && m.type !== 'RETURN') return false;
      if (movementFilter === 'ADJUSTMENT' && m.type !== 'ADJUSTMENT_IN' && m.type !== 'ADJUSTMENT_OUT') return false;
      if (movementFilter === 'WASTE' && m.type !== 'WASTE') return false;

      if (ingredientFilter !== 'ALL' && m.ingredientId !== ingredientFilter) return false;

      if (dateRange.year !== 'ALL') {
        const mDate = new Date(m.timestamp);
        if (String(mDate.getFullYear()) !== dateRange.year) return false;
        if (dateRange.month !== 'ALL' && String(mDate.getMonth() + 1) !== dateRange.month) return false;
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          m.ingredientName.toLowerCase().includes(q) ||
          (m.reason && m.reason.toLowerCase().includes(q)) ||
          (m.referenceId && m.referenceId.toLowerCase().includes(q)) ||
          m.type.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [movements, movementFilter, ingredientFilter, dateRange, search]);

  // ---------------------------------------------------------------------------
  // Filtering Purchases (Purchases Tab) - Rolls forward unpaid POs into next months until paid
  // ---------------------------------------------------------------------------
  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      if (dateRange.year !== 'ALL') {
        const pDate = new Date(p.purchaseDate);
        const pYear = pDate.getFullYear();
        const pMonth = pDate.getMonth() + 1;
        const targetYear = parseInt(dateRange.year, 10);
        const targetMonth = dateRange.month !== 'ALL' ? parseInt(dateRange.month, 10) : null;

        if (targetMonth === null) {
          // Whole year selected
          const isSameYear = pYear === targetYear;
          const isPriorYearUnpaid = pYear < targetYear && ((p.dueCents ?? 0) > 0 || p.paymentStatus !== 'PAID');
          if (!isSameYear && !isPriorYearUnpaid) return false;
        } else {
          // Specific Year & Month selected (e.g. September 2026)
          const isCreatedInSelectedMonth = pYear === targetYear && pMonth === targetMonth;
          const isPriorMonth = pYear < targetYear || (pYear === targetYear && pMonth < targetMonth);

          // 1. Unpaid / partially paid records roll forward into next months until marked paid!
          const hasOutstandingDue = (p.dueCents ?? 0) > 0 || p.paymentStatus !== 'PAID';

          // 2. Also show if paid during this selected month
          const wasPaidInSelectedMonth = (p.payments || []).some((pm) => {
            if (!pm.timestamp) return false;
            const pmDate = new Date(pm.timestamp);
            return pmDate.getFullYear() === targetYear && pmDate.getMonth() + 1 === targetMonth;
          });

          const shouldShow = isCreatedInSelectedMonth || (isPriorMonth && (hasOutstandingDue || wasPaidInSelectedMonth));
          if (!shouldShow) return false;
        }
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        const hasItem = p.items.some((i) => i.ingredientName.toLowerCase().includes(q));
        return (
          p.purchaseNumber.toLowerCase().includes(q) ||
          p.invoiceNumber.toLowerCase().includes(q) ||
          p.supplierName.toLowerCase().includes(q) ||
          hasItem
        );
      }
      return true;
    });
  }, [purchases, dateRange, search]);

  // ---------------------------------------------------------------------------
  // Filtering Cashier Requests (Requests Tab)
  // ---------------------------------------------------------------------------
  const filteredRequests = useMemo(() => {
    return stockRequests.filter((r) => {
      if (requestStatusFilter !== 'ALL' && r.status !== requestStatusFilter) return false;

      if (dateRange.year !== 'ALL') {
        const rDate = new Date(r.createdAt);
        if (String(rDate.getFullYear()) !== dateRange.year) return false;
        if (dateRange.month !== 'ALL' && String(rDate.getMonth() + 1) !== dateRange.month) return false;
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchIng = r.ingredientName.toLowerCase().includes(q);
        const matchReq = r.requestNumber.toLowerCase().includes(q);
        const matchReason = r.reason.toLowerCase().includes(q);
        const matchUser = r.requestedByUserName.toLowerCase().includes(q);
        const matchSupplier = r.supplierName?.toLowerCase().includes(q);
        const matchInv = r.invoiceNumber?.toLowerCase().includes(q);
        const matchItems = r.items?.some((it) => it.ingredientName.toLowerCase().includes(q));
        if (!matchIng && !matchReq && !matchReason && !matchUser && !matchSupplier && !matchInv && !matchItems) return false;
      }
      return true;
    });
  }, [stockRequests, requestStatusFilter, dateRange, search]);

  // ---------------------------------------------------------------------------
  // Handlers for Ingredients
  // ---------------------------------------------------------------------------
  const handleOpenAddIngredient = () => {
    setEditingIngredient({
      name: '',
      sku: `ING-${Date.now().toString().slice(-4)}`,
      unit: 'kg',
      currentStock: 10,
      reorderLevel: 3,
      averageCostCents: 50000,
      active: true,
    });
  };

  const handleSaveIngredient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIngredient?.name || !editingIngredient.unit) {
      toast.error('Please fill in ingredient name and unit.');
      return;
    }

    inventoryService.saveIngredient({
      ...editingIngredient,
      name: editingIngredient.name,
      unit: editingIngredient.unit as any,
      currentStock: Number(editingIngredient.currentStock) || 0,
      reorderLevel: Number(editingIngredient.reorderLevel) || 0,
      averageCostCents: Number(editingIngredient.averageCostCents) || 0,
      supplierId: editingIngredient.supplierId,
      expiryDate: editingIngredient.expiryDate,
    });

    toast.success(`Ingredient "${editingIngredient.name}" saved successfully.`);
    setEditingIngredient(null);
    setIngredients(inventoryService.getIngredients());
  };

  const handleRequestEditIngredient = async (ing: Ingredient) => {
    const confirmed = await confirmDialog({
      title: 'Edit Ingredient',
      message: `Edit details for "${ing.name}"?`,
      confirmText: 'Edit Ingredient',
      variant: 'primary',
    });
    if (confirmed) {
      setEditingIngredient(ing);
    }
  };

  const handleDeleteIngredient = async (ing: Ingredient) => {
    const confirmed = await confirmDialog({
      title: 'Delete Ingredient',
      message: `Permanently delete "${ing.name}"?`,
      confirmText: 'Delete Ingredient',
      variant: 'danger',
    });
    if (confirmed) {
      inventoryService.deleteIngredient(ing.id);
      setIngredients(inventoryService.getIngredients());
      toast.success(`"${ing.name}" was deleted successfully.`);
    }
  };

  // ---------------------------------------------------------------------------
  // Handlers for Goods Received Note / Purchase
  // ---------------------------------------------------------------------------
  const handleOpenReceiveModal = () => {
    const currentSuppliers = catalogService.getSuppliers();
    setSuppliers(currentSuppliers);
    setIngredients(inventoryService.getIngredients());
    setSelectedSupplierId('');
    setVendorName('');
    setInvoiceNumber(`INV-${Date.now().toString().slice(-4)}`);
    setPurchaseNotes('');
    setPurchaseItems([]);
    setCashAmount('');
    setCardAmount('');
    setChequeAmount('');
    setChequeNumber('');
    setChequeBank('');
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setChequeDate(d.toISOString().split('T')[0]);
    const dueD = new Date();
    dueD.setDate(dueD.getDate() + 14);
    setDuePaymentDate(dueD.toISOString().split('T')[0]);
    setIsReceiveModalOpen(true);
  };

  const handleAddPurchaseItem = () => {
    const list = availableIngredients;
    const first = list[0];
    if (!first) {
      toast.error(
        selectedSupplierId
          ? 'No items registered for this supplier. Please configure supplied items in Suppliers & Payables.'
          : 'No ingredients available.'
      );
      return;
    }
    const newItemTotalCents = first.averageCostCents || 50000;
    setPurchaseItems((prev) => [
      ...prev,
      {
        ingredientId: first.id,
        ingredientName: first.name,
        quantity: 1,
        unit: first.unit,
        unitPriceCents: first.averageCostCents || 50000,
        totalCents: newItemTotalCents,
      },
    ]);
  };

  const filteredPurchaseSearchIngs = useMemo(() => {
    if (!purchaseSearch.trim()) return [];
    const q = purchaseSearch.toLowerCase();
    const list = availableIngredients.length > 0 ? availableIngredients : ingredients;
    return list
      .filter((ing) => ing.name.toLowerCase().includes(q) || ing.sku.toLowerCase().includes(q))
      .slice(0, 8);
  }, [purchaseSearch, availableIngredients, ingredients]);

  const handleAddSearchedPurchaseItem = (ing: Ingredient) => {
    setPurchaseItems((prev) => [
      ...prev,
      {
        ingredientId: ing.id,
        ingredientName: ing.name,
        quantity: 1,
        unit: ing.unit,
        unitPriceCents: ing.averageCostCents || 50000,
        totalCents: ing.averageCostCents || 50000,
      },
    ]);
    setPurchaseSearch('');
    setIsPurchaseSearchFocused(false);
    toast.success(`Added "${ing.name}" to received items.`);
  };

  const handleUpdatePurchaseItem = (index: number, updates: Partial<PurchaseItem>) => {
    setPurchaseItems((prev) => {
      const next = [...prev];
      const item = { ...next[index], ...updates };

      if (updates.ingredientId) {
        const list = availableIngredients.length > 0 ? availableIngredients : ingredients;
        const found =
          list.find((i) => i.id === updates.ingredientId) ||
          ingredients.find((i) => i.id === updates.ingredientId);
        if (found) {
          item.ingredientName = found.name;
          item.unit = found.unit;
          if (!updates.unitPriceCents) {
            item.unitPriceCents = found.averageCostCents || 50000;
          }
        }
      }

      item.totalCents = Math.round(item.quantity * item.unitPriceCents);
      next[index] = item;
      return next;
    });
  };

  const handleRemovePurchaseItem = (index: number) => {
    setPurchaseItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSavePurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorName.trim()) {
      toast.error('Please select a supplier / vendor.');
      return;
    }
    if (purchaseItems.length === 0) {
      toast.error('Please add at least one line item.');
      return;
    }

    if (numCheque > 0 && (!chequeNumber.trim() || !chequeBank.trim())) {
      toast.error('Please enter Cheque Number and Bank Name for cheque payment.');
      return;
    }

    const nowISO = new Date().toISOString();
    const payments: PurchasePaymentSplit[] = [];
    if (numCash > 0) {
      payments.push({
        method: 'CASH',
        amountCents: Math.round(numCash * 100),
        timestamp: nowISO,
      });
    }
    if (numCard > 0) {
      payments.push({
        method: 'CARD',
        amountCents: Math.round(numCard * 100),
        timestamp: nowISO,
      });
    }
    if (numCheque > 0) {
      payments.push({
        method: 'CHEQUE',
        amountCents: Math.round(numCheque * 100),
        chequeNumber: chequeNumber.trim(),
        bankName: chequeBank.trim(),
        chequeDate: chequeDate,
        timestamp: nowISO,
      });
    }

    inventoryService.recordPurchase({
      supplierId: selectedSupplierId || undefined,
      supplierName: vendorName,
      invoiceNumber: invoiceNumber.trim() || `INV-${Date.now().toString().slice(-4)}`,
      items: purchaseItems,
      totalCents: totalInvoicedCents,
      paidCents: totalPaidCents,
      dueCents: balanceDueCents,
      dueDate: balanceDueCents > 0 ? duePaymentDate : undefined,
      paymentStatus,
      payments,
      notes: purchaseNotes.trim() || undefined,
    });

    toast.success(
      `Purchase Order received! (${paymentStatus === 'PAID' ? 'Fully Settled' : paymentStatus === 'PARTIAL' ? 'Partially Paid' : 'Recorded as Unpaid'})`
    );
    setIsReceiveModalOpen(false);
    setPurchases(catalogService.getPurchases());
    setMovements(inventoryService.getMovements());
    setIngredients(inventoryService.getIngredients());
  };

  // ---------------------------------------------------------------------------
  // Handlers for Manual Stock Adjustment
  // ---------------------------------------------------------------------------
  const handleOpenAdjustModal = (preselectedIngId?: string) => {
    if (preselectedIngId) {
      setAdjustIngredientId(preselectedIngId);
      setIsSpecificIngredientAdjust(true);
      const ing = ingredients.find((i) => i.id === preselectedIngId);
      setAdjustExpiry(ing?.expiryDate || '');
    } else {
      const first = ingredients[0];
      setAdjustIngredientId(first ? first.id : '');
      setIsSpecificIngredientAdjust(false);
      setAdjustExpiry(first?.expiryDate || '');
    }
    setAdjustType('ADD');
    setAdjustQuantity(1);
    setAdjustReason('Physical stock inventory audit');
    setIsAdjustModalOpen(true);
  };

  const handleSaveAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    const targetIng = ingredients.find((i) => i.id === adjustIngredientId);
    if (!targetIng) {
      toast.error('Please select an ingredient.');
      return;
    }

    let calculatedNewStock = targetIng.currentStock;
    if (adjustType === 'ADD') {
      calculatedNewStock = Number((targetIng.currentStock + Number(adjustQuantity)).toFixed(2));
    } else if (adjustType === 'DEDUCT') {
      calculatedNewStock = Math.max(0, Number((targetIng.currentStock - Number(adjustQuantity)).toFixed(2)));
    } else if (adjustType === 'EXACT') {
      calculatedNewStock = Math.max(0, Number(Number(adjustQuantity).toFixed(2)));
    }

    const finalExpiry = adjustExpiry.trim() || targetIng.expiryDate;

    inventoryService.adjustStock({
      ingredientId: targetIng.id,
      newStock: calculatedNewStock,
      reason: adjustReason.trim() || 'Manual stock adjustment',
      userId: 'usr_admin',
      userName: 'Admin Manager',
      expiryDate: finalExpiry || undefined,
    });

    toast.success(`Updated "${targetIng.name}" stock to ${calculatedNewStock} ${targetIng.unit}.`);
    setIsAdjustModalOpen(false);
    setMovements(inventoryService.getMovements());
    setIngredients(inventoryService.getIngredients());
  };

  const selectedAdjustIng = ingredients.find((i) => i.id === adjustIngredientId);

  return (
    <div className="h-full flex-1 flex flex-col min-h-0 space-y-3 w-full animate-in fade-in relative">
      {/* 1. TOP HEADER: 3-in-1 Unified Tab Switcher & Contextual KPI Badges */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0 border-b border-[#EAE3DA] pb-2">
        {/* Single Unified Tab Bar Container */}
        <div className="inline-flex items-center p-1 h-11 bg-white border border-[#E0D7CC] rounded-full shadow-xs overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => handleTabChange('stock')}
            className={`h-full flex items-center gap-2.5 px-4 py-2 rounded-full text-xs sm:text-[13px] font-black transition-all cursor-pointer select-none active:scale-98 whitespace-nowrap ${
              activeTab === 'stock'
                ? 'bg-brand-teal text-white shadow-teal'
                : 'text-brand-brown hover:text-brand-brown-deep hover:bg-cream-50'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Ingredients & Stock</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold tabular-nums ${
                activeTab === 'stock' ? 'bg-white/20 text-white' : 'bg-cream-100 text-brand-brown-dark'
              }`}
            >
              {totalIngredientsCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('movements')}
            className={`h-full flex items-center gap-2.5 px-4 py-2 rounded-full text-xs sm:text-[13px] font-black transition-all cursor-pointer select-none active:scale-98 whitespace-nowrap ${
              activeTab === 'movements'
                ? 'bg-brand-teal text-white shadow-teal'
                : 'text-brand-brown hover:text-brand-brown-deep hover:bg-cream-50'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Stock Movements</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold tabular-nums ${
                activeTab === 'movements' ? 'bg-white/20 text-white' : 'bg-cream-100 text-brand-brown-dark'
              }`}
            >
              {movements.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('purchases')}
            className={`h-full flex items-center gap-2.5 px-4 py-2 rounded-full text-xs sm:text-[13px] font-black transition-all cursor-pointer select-none active:scale-98 whitespace-nowrap ${
              activeTab === 'purchases'
                ? 'bg-brand-teal text-white shadow-teal'
                : 'text-brand-brown hover:text-brand-brown-deep hover:bg-cream-50'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Purchases (PO)</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold tabular-nums ${
                activeTab === 'purchases' ? 'bg-white/20 text-white' : 'bg-cream-100 text-brand-brown-dark'
              }`}
            >
              {filteredPurchases.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('requests')}
            className={`h-full flex items-center gap-2.5 px-4 py-2 rounded-full text-xs sm:text-[13px] font-black transition-all cursor-pointer select-none active:scale-98 whitespace-nowrap ${
              activeTab === 'requests'
                ? 'bg-brand-teal text-white shadow-teal'
                : 'text-brand-brown hover:text-brand-brown-deep hover:bg-cream-50'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Cashier Requests</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold tabular-nums ${
                activeTab === 'requests'
                  ? 'bg-white/20 text-white'
                  : pendingStockRequests.length > 0
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-cream-100 text-brand-brown-dark'
              }`}
            >
              {pendingStockRequests.length > 0 ? pendingStockRequests.length : stockRequests.length}
            </span>
          </button>
        </div>

        {/* Right: Filters / KPIs based on Active Tab */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {activeTab === 'stock' && (
            <>
              {/* Stock KPI Badges */}
              <div className="hidden xl:flex items-center gap-3 text-xs select-none pr-2 border-r border-[#EAE3DA]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-status-success" />
                  <span className="text-[10px] font-bold uppercase text-text-muted">Optimal:</span>
                  <span className="font-black text-brand-brown-deep tabular-nums">{optimalCount}</span>
                </div>
                {lowStockCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-status-warning" />
                    <span className="text-[10px] font-bold uppercase text-status-warning">Low:</span>
                    <span className="font-black text-status-warning tabular-nums">{lowStockCount}</span>
                  </div>
                )}
                {outOfStockCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-status-danger animate-pulse" />
                    <span className="text-[10px] font-bold uppercase text-status-danger">Out:</span>
                    <span className="font-black text-status-danger tabular-nums">{outOfStockCount}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#E99343]" />
                  <span className="text-[10px] font-bold uppercase text-text-muted">Valuation:</span>
                  <span className="font-black text-brand-brown-dark tabular-nums">{formatLKR(totalValuationCents)}</span>
                </div>
              </div>

              {/* Status Filter */}
              <div className="w-auto min-w-[165px] sm:min-w-[185px]">
                <CustomSelect
                  value={stockStatusFilter}
                  onChange={(val) => setStockStatusFilter(val as StockStatusFilter)}
                  options={STOCK_STATUS_OPTIONS}
                  align="right"
                  buttonClassName="h-9 !py-0 px-3.5 bg-[#FAF7F2] hover:bg-cream-100 border-[#E0D7CC] rounded-full text-xs font-bold text-brand-brown-dark shadow-xs"
                />
              </div>
            </>
          )}

          {activeTab === 'movements' && (
            <>
              <div className="w-[140px] sm:w-[155px]">
                <CustomSelect
                  value={movementFilter}
                  onChange={(val) => setMovementFilter(val as MovementFilter)}
                  options={MOVEMENT_FILTER_OPTIONS}
                  buttonClassName="h-9 !py-0 px-3.5 bg-[#FAF7F2] hover:bg-cream-100 border-[#E0D7CC] rounded-full text-xs font-bold text-brand-brown-dark shadow-xs"
                />
              </div>

              <MonthYearPicker value={dateRange} onChange={(newVal) => setDateRange(newVal)} />
            </>
          )}

          {activeTab === 'purchases' && (
            <MonthYearPicker value={dateRange} onChange={(newVal) => setDateRange(newVal)} />
          )}

          {activeTab === 'requests' && (
            <>
              <div className="w-auto min-w-[150px] sm:min-w-[175px]">
                <CustomSelect
                  value={requestStatusFilter}
                  onChange={(val) => setRequestStatusFilter(val as RequestStatusFilter)}
                  options={REQUEST_STATUS_OPTIONS}
                  align="right"
                  buttonClassName="h-9 !py-0 px-3.5 bg-[#FAF7F2] hover:bg-cream-100 border-[#E0D7CC] rounded-full text-xs font-bold text-brand-brown-dark shadow-xs"
                />
              </div>

              <MonthYearPicker value={dateRange} onChange={(newVal) => setDateRange(newVal)} />
            </>
          )}
        </div>
      </div>

      {/* PENDING STAFF STOCK REQUESTS (IMAGE 2 TABLE DESIGN PATTERN) */}
      {pendingStockRequests.length > 0 && activeTab !== 'requests' && (
        <div className="bg-white rounded-2xl border border-[#E9E0D5] shadow-xs overflow-hidden flex flex-col mb-2 shrink-0 animate-in fade-in slide-in-from-top-1">
          {/* Table Header Strip */}
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-50/50 border-b border-[#EAE3DA]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-xs font-black text-brand-brown-deep tracking-wider uppercase flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-700" />
                <span>Pending Staff Stock Requests ({pendingStockRequests.length} waiting authorization)</span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSearchParams({ tab: 'requests' })}
              className="text-[11px] font-bold text-amber-800 hover:text-amber-950 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Manage all in Requests tab</span>
              <span>→</span>
            </button>
          </div>

          {/* Table matching Image 2 design */}
          <div className="overflow-x-auto max-h-56 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-[#FAF7F2]/95 backdrop-blur-xs z-10 shadow-2xs">
                <tr className="border-b border-[#EAE3DA] text-text-muted font-black uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3.5 bg-[#FAF7F2]/95">Type</th>
                  <th className="py-2.5 px-3 bg-[#FAF7F2]/95">Raw Ingredient</th>
                  <th className="py-2.5 px-3 bg-[#FAF7F2]/95">Submitted By & Note</th>
                  <th className="py-2.5 px-3 bg-[#FAF7F2]/95 text-center">Current Stock</th>
                  <th className="py-2.5 px-3 bg-[#FAF7F2]/95 text-center">Requested Stock</th>
                  <th className="py-2.5 px-3 bg-[#FAF7F2]/95 text-center">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EAE2]">
                {pendingStockRequests.map((req) => (
                  <tr
                    key={req.id}
                    onClick={() => handleOpenRequestModal(req)}
                    className="hover:bg-[#FAF7F2]/80 transition-colors group cursor-pointer"
                    title="Click to view and authorize request"
                  >
                    {/* Type Badge */}
                    <td className="py-2.5 px-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase border shadow-2xs ${
                          req.type === 'STOCK_DELIVERY'
                            ? 'bg-amber-50 text-amber-900 border-amber-300'
                            : 'bg-teal-50 text-brand-teal-dark border-teal-200'
                        }`}
                      >
                        {req.type === 'STOCK_DELIVERY' ? 'Goods Delivery' : 'Stock Adjustment'}
                      </span>
                    </td>

                    {/* Ingredient Name */}
                    <td className="py-2.5 px-3 font-black text-brand-brown-dark text-xs">
                      {req.ingredientName}
                    </td>

                    {/* Submitted by & Reason */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-brand-brown-dark text-xs">{req.requestedByUserName}:</span>
                        <span className="text-text-muted text-[11px] truncate max-w-xs">{req.reason}</span>
                      </div>
                    </td>

                    {/* Current Stock */}
                    <td className="py-2.5 px-3 text-center font-bold text-xs tabular-nums text-text-secondary">
                      {req.currentStock} {req.unit}
                    </td>

                    {/* Requested Stock + Delta */}
                    <td className="py-2.5 px-3 text-center tabular-nums">
                      {req.type === 'STOCK_ADJUSTMENT' ? (
                        <div className="inline-flex items-center gap-1.5 text-xs font-black text-brand-brown-deep">
                          <span>{req.requestedStock} {req.unit}</span>
                          <span className={`text-[11px] font-bold ${req.quantityChange >= 0 ? 'text-status-success' : 'text-status-danger'}`}>
                            ({req.quantityChange >= 0 ? `+${req.quantityChange}` : req.quantityChange}{req.unit})
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs font-black text-status-success">
                          +{req.quantityChange} {req.unit}
                        </span>
                      )}
                    </td>

                    {/* Time Pill matching Image 2 */}
                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono font-bold text-[11px] bg-cream-100/70 text-brand-brown border border-[#E0D7CC]">
                        <Clock className="w-3 h-3 text-amber-700 shrink-0" />
                        <span>{format(new Date(req.createdAt), 'hh:mm a')}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. TAB 1: INGREDIENTS & STOCK TABLE */}
      {activeTab === 'stock' && (
        <div className="flex-1 min-h-0 bg-white rounded-2xl border border-[#E9E0D5] shadow-xs overflow-hidden flex flex-col mb-1">
          <div className="flex-1 overflow-auto min-h-0 pb-24">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-[#FAF7F2]/95 backdrop-blur-xs z-10 shadow-xs">
                <tr className="border-b border-[#EAE3DA] text-text-muted font-black uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3.5 bg-[#FAF7F2]/95">Ingredient</th>
                  <th className="py-3 px-3 bg-[#FAF7F2]/95">SKU Code</th>
                  <th className="py-3 px-2.5 text-center bg-[#FAF7F2]/95">Expire Date</th>
                  <th className="py-3 px-3 bg-[#FAF7F2]/95">Current Stock</th>
                  <th className="py-3 px-3 bg-[#FAF7F2]/95">Reorder Level</th>
                  <th className="py-3 px-3 text-right bg-[#FAF7F2]/95">Avg Cost</th>
                  <th className="py-3 px-3 text-center bg-[#FAF7F2]/95">Status</th>
                  <th className="py-3 px-3 text-right bg-[#FAF7F2]/95">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2ECE4] font-medium">
                {filteredIngredients.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-20 text-text-muted">
                      <Boxes className="w-9 h-9 mx-auto mb-2 text-text-muted/40" />
                      <div className="font-semibold text-xs text-text-secondary">No ingredients found.</div>
                    </td>
                  </tr>
                ) : (
                  filteredIngredients.map((ing) => {
                    const isOut = ing.currentStock <= 0;
                    const isLow = !isOut && ing.currentStock <= ing.reorderLevel;
                    const expiry = getExpiryStatus(ing.expiryDate);
                    const isExpired = expiry.status === 'EXPIRED';
                    const isExpiringSoon = expiry.status === 'EXPIRING_SOON';

                    return (
                      <tr key={ing.id} className="hover:bg-[#FAF7F2]/70 transition-colors group">
                        <td className="py-2.5 px-3.5 font-black text-brand-brown-dark">{ing.name}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-text-muted">{ing.sku}</td>
                        <td className="py-2.5 px-2.5 text-center">
                          {ing.expiryDate ? (
                            isExpired ? (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono font-bold text-[11px] bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs"
                                title={`Expired ${Math.abs(expiry.daysLeft || 0)} days ago`}
                              >
                                <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                                <span>{ing.expiryDate}</span>
                              </span>
                            ) : isExpiringSoon ? (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono font-bold text-[11px] bg-amber-50 text-amber-900 border border-amber-200/90 shadow-2xs"
                                title={`Expires in ${expiry.daysLeft} days`}
                              >
                                <Clock className="w-3 h-3 text-amber-700 shrink-0" />
                                <span>{ing.expiryDate}</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md font-mono font-bold text-[11px] bg-cream-100/70 text-brand-brown border border-[#E0D7CC]">
                                {ing.expiryDate}
                              </span>
                            )
                          ) : (
                            <span className="text-text-muted/40 font-mono text-xs font-bold">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`font-black text-sm tabular-nums ${
                              isOut ? 'text-status-danger' : isLow ? 'text-status-warning' : 'text-brand-brown-deep'
                            }`}
                          >
                            {ing.currentStock} <span className="text-[11px] font-bold text-text-muted">{ing.unit}</span>
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-text-secondary text-xs">
                          {ing.reorderLevel} {ing.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-xs text-brand-brown-dark tabular-nums">
                          {formatLKR(ing.averageCostCents)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {isExpired ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase border bg-rose-100 text-rose-800 border-rose-300 shadow-2xs">
                              <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                              <span>Expired</span>
                            </span>
                          ) : isOut ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase border bg-status-danger-bg text-status-danger border-status-danger/30 shadow-2xs">
                              <span>Out of Stock</span>
                            </span>
                          ) : isLow ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase border bg-status-warning-bg text-status-warning border-status-warning/30 shadow-2xs">
                              <span>Low Stock</span>
                            </span>
                          ) : isExpiringSoon ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase border bg-amber-50 text-amber-800 border-amber-300 shadow-2xs">
                              <Clock className="w-3 h-3 text-amber-700 shrink-0" />
                              <span>Near Expiry</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase border bg-status-success-bg text-status-success border-status-success/30 shadow-2xs">
                              <span>In Stock</span>
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenAdjustModal(ing.id)}
                              className="w-7 h-7 bg-[#FAF7F2] border border-[#E0D7CC] hover:bg-cream-200 rounded-full text-text-secondary hover:text-brand-teal flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
                              title="Adjust Stock"
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleRequestEditIngredient(ing)}
                              className="w-7 h-7 bg-[#FAF7F2] border border-[#E0D7CC] hover:bg-cream-200 rounded-full text-text-secondary hover:text-brand-teal flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
                              title="Edit Ingredient"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteIngredient(ing)}
                              className="w-7 h-7 bg-[#FAF7F2] border border-[#E0D7CC] hover:bg-rose-50 hover:border-rose-200 hover:text-status-danger rounded-full text-text-muted flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
                              title="Delete Ingredient"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
                {filteredIngredients.length > 0 && (
                  <tr aria-hidden="true" className="border-0 pointer-events-none select-none">
                    <td colSpan={8} className="h-20 bg-transparent border-0" />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. TAB 2: STOCK MOVEMENTS TABLE */}
      {activeTab === 'movements' && (
        <div className="flex-1 min-h-0 bg-white rounded-2xl border border-[#E9E0D5] shadow-xs overflow-hidden flex flex-col mb-1">
          <div className="flex-1 overflow-auto min-h-0 pb-24">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-[#FAF7F2]/95 backdrop-blur-xs z-10 shadow-xs">
                <tr className="border-b border-[#EAE3DA] text-text-muted font-black uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3.5 bg-[#FAF7F2]/95">Timestamp</th>
                  <th className="py-3 px-3.5 bg-[#FAF7F2]/95">Ingredient</th>
                  <th className="py-3 px-3 text-center bg-[#FAF7F2]/95">Movement Type</th>
                  <th className="py-3 px-3 text-right bg-[#FAF7F2]/95">Quantity Change</th>
                  <th className="py-3 px-3 text-right bg-[#FAF7F2]/95">Est. Value (LKR)</th>
                  <th className="py-3 px-3.5 bg-[#FAF7F2]/95">Reason / Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2ECE4] font-medium">
                {filteredMovements.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-20 text-text-muted">
                      <History className="w-9 h-9 mx-auto mb-2 text-text-muted/40" />
                      <div className="font-semibold text-xs text-text-secondary">No stock movements found.</div>
                    </td>
                  </tr>
                ) : (
                  filteredMovements.map((m) => {
                    const isPositive = m.quantity > 0;
                    return (
                      <tr key={m.id} className="hover:bg-[#FAF7F2]/70 transition-colors">
                        <td className="py-2.5 px-3.5 text-text-secondary font-medium whitespace-nowrap">
                          {formatDateTime(m.timestamp)}
                        </td>
                        <td className="py-2.5 px-3.5 font-black text-brand-brown-dark">{m.ingredientName}</td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border bg-amber-50 text-amber-800 border-amber-200/80">
                            {m.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-xs whitespace-nowrap">
                          <span className={isPositive ? 'text-status-success' : 'text-rose-600'}>
                            {isPositive ? `+${m.quantity}` : m.quantity} {m.unit}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-xs text-brand-brown-dark tabular-nums whitespace-nowrap">
                          {m.costCents ? formatLKR(m.costCents) : '-'}
                        </td>
                        <td className="py-2.5 px-3.5 text-text-secondary max-w-[260px] truncate">
                          {m.reason || m.referenceId || '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
                {filteredMovements.length > 0 && (
                  <tr aria-hidden="true" className="border-0 pointer-events-none select-none">
                    <td colSpan={6} className="h-20 bg-transparent border-0" />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. TAB 3: PURCHASES (PO) TABLE */}
      {activeTab === 'purchases' && (
        <div className="flex-1 min-h-0 bg-white rounded-2xl border border-[#E9E0D5] shadow-xs overflow-hidden flex flex-col mb-1">
          <div className="flex-1 overflow-auto min-h-0 pb-24">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-[#FAF7F2]/95 backdrop-blur-xs z-10 shadow-xs">
                <tr className="border-b border-[#EAE3DA] text-text-muted font-black uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3 bg-[#FAF7F2]/95">Purchase / Invoice</th>
                  <th className="py-3 px-3 bg-[#FAF7F2]/95">Supplier / Vendor</th>
                  <th className="py-3 px-3 bg-[#FAF7F2]/95">Date / Time</th>
                  <th className="py-3 px-2 text-center bg-[#FAF7F2]/95">Items</th>
                  <th className="py-3 px-3 text-right bg-[#FAF7F2]/95">Total Invoiced</th>
                  <th className="py-3 px-3 text-right bg-[#FAF7F2]/95">Paid / Balance Due</th>
                  <th className="py-3 px-3 text-center bg-[#FAF7F2]/95">Payment Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2ECE4] font-medium">
                {filteredPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-20 text-text-muted">
                      <Truck className="w-9 h-9 mx-auto mb-2 text-text-muted/40" />
                      <div className="font-semibold text-xs text-text-secondary">No purchase records found.</div>
                    </td>
                  </tr>
                ) : (
                  filteredPurchases.map((p) => {
                    const effectivePaidCents = p.paidCents ?? p.totalCents;
                    const effectiveDueCents = p.dueCents ?? Math.max(0, p.totalCents - effectivePaidCents);
                    const isPaid =
                      p.paymentStatus === 'PAID' ||
                      (effectiveDueCents === 0 && effectivePaidCents >= p.totalCents && p.totalCents > 0);

                    // Compute days until scheduled payment
                    let daysDiff: number | null = null;
                    let targetDate: Date | null = null;
                    if (!isPaid) {
                      if (p.dueDate) {
                        targetDate = new Date(p.dueDate);
                      } else {
                        targetDate = new Date(p.purchaseDate);
                        targetDate.setDate(targetDate.getDate() + 14);
                      }
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const target = new Date(targetDate);
                      target.setHours(0, 0, 0, 0);
                      daysDiff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    }

                    return (
                      <tr
                        key={p.id}
                        onClick={() => setViewingPurchase(p)}
                        className="hover:bg-[#FAF7F2]/70 transition-colors cursor-pointer group"
                      >
                        <td className="py-2.5 px-3">
                          <div className="font-black text-brand-brown-dark text-xs group-hover:text-brand-teal transition-colors">
                            {p.purchaseNumber}
                          </div>
                          <div className="font-mono text-[10px] text-text-muted">{p.invoiceNumber}</div>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-brand-brown-deep max-w-[130px] truncate" title={p.supplierName}>
                          {p.supplierName}
                        </td>
                        <td className="py-2.5 px-3 text-text-secondary text-xs whitespace-nowrap">
                          <div className="font-medium leading-tight flex items-center gap-1.5">
                            <span>{new Date(p.purchaseDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            {dateRange.month !== 'ALL' &&
                              (new Date(p.purchaseDate).getMonth() + 1 !== parseInt(dateRange.month, 10) ||
                                new Date(p.purchaseDate).getFullYear() !== parseInt(dateRange.year, 10)) && (
                                <span
                                  className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-amber-50 text-amber-900 border border-amber-300"
                                  title="Unpaid balance carried forward from earlier month"
                                >
                                  Rolled Over
                                </span>
                              )}
                          </div>
                          <div className="text-[10px] text-text-muted font-mono">
                            {new Date(p.purchaseDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <span className="px-2 py-0.5 rounded-md bg-cream-100 border border-[#E0D7CC] font-bold text-[10px] text-brand-brown whitespace-nowrap">
                            {p.items.length} items
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-xs text-brand-brown-dark tabular-nums whitespace-nowrap">
                          {formatLKR(p.totalCents)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-xs tabular-nums whitespace-nowrap">
                          <div className="font-bold text-brand-teal">
                            Paid: {formatLKR(effectivePaidCents)}
                          </div>
                          {effectiveDueCents > 0 && (
                            <div className="text-[11px] font-bold text-rose-600">
                              {(p.payments || []).some((pm) => pm.method === 'CHEQUE' && pm.chequeStatus !== 'CLEARED') ? (
                                <span className="text-amber-800">Pending Chq: {formatLKR(effectiveDueCents)}</span>
                              ) : (
                                <span>Due: {formatLKR(effectiveDueCents)}</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {(() => {
                            const pendingChq = (p.payments || []).find((pm) => pm.method === 'CHEQUE' && pm.chequeStatus !== 'CLEARED');
                            if (pendingChq) {
                              return (
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase border bg-amber-50 text-amber-900 border-amber-300 shadow-2xs">
                                    <Landmark className="w-3 h-3 text-amber-700 shrink-0" />
                                    <span>Cheque Pending</span>
                                  </span>
                                  {pendingChq.chequeDate && (
                                    <span className="text-[10px] font-bold text-amber-800 font-mono">
                                      Due {new Date(pendingChq.chequeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </span>
                                  )}
                                </div>
                              );
                            }
                            if (isPaid) {
                              return (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full font-black text-[10px] uppercase border bg-emerald-50 text-status-success border-emerald-200/70 shadow-2xs">
                                  <Check className="w-3 h-3 text-status-success" />
                                  <span>Paid</span>
                                </span>
                              );
                            }
                            if (daysDiff !== null && daysDiff < 0) {
                              return (
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase border bg-rose-100 text-rose-800 border-rose-300 shadow-2xs">
                                    <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                                    <span>Overdue {Math.abs(daysDiff)}d</span>
                                  </span>
                                  {targetDate && (
                                    <span className="text-[10px] font-bold text-rose-700 font-mono">
                                      {targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </span>
                                  )}
                                </div>
                              );
                            }
                            if (daysDiff !== null && daysDiff <= 3) {
                              return (
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase border bg-amber-100 text-amber-900 border-amber-300 shadow-2xs animate-pulse">
                                    <Clock className="w-3 h-3 text-amber-700 shrink-0" />
                                    <span>{daysDiff === 0 ? 'Due Today' : `Due in ${daysDiff}d`}</span>
                                  </span>
                                  {targetDate && (
                                    <span className="text-[10px] font-bold text-amber-800 font-mono">
                                      {targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </span>
                                  )}
                                </div>
                              );
                            }
                            return (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-extrabold text-[10px] uppercase border bg-rose-50 text-rose-700 border-rose-200 shadow-2xs">
                                  <Clock className="w-3 h-3 text-rose-500 shrink-0" />
                                  <span>Due in {daysDiff}d</span>
                                </span>
                                {targetDate && (
                                  <span className="text-[10px] font-medium text-text-muted font-mono">
                                    {targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                      </tr>
                    );
                  })
                )}
                {filteredPurchases.length > 0 && (
                  <tr aria-hidden="true" className="border-0 pointer-events-none select-none">
                    <td colSpan={7} className="h-20 bg-transparent border-0" />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. TAB 4: CASHIER REQUESTS TABLE (COMPACT & RESPONSIVE - IMAGE 2 PATTERN) */}
      {activeTab === 'requests' && (
        <div className="flex-1 min-h-0 bg-white rounded-2xl border border-[#E9E0D5] shadow-xs overflow-hidden flex flex-col mb-1">
          <div className="flex-1 overflow-auto min-h-0 pb-24">
            <table className="w-full text-left text-xs border-collapse min-w-[780px]">
              <thead className="sticky top-0 bg-[#FAF7F2]/95 backdrop-blur-xs z-10 shadow-2xs">
                <tr className="border-b border-[#EAE3DA] text-text-muted font-black uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3.5 bg-[#FAF7F2]/95">Request / Date</th>
                  <th className="py-2.5 px-3 bg-[#FAF7F2]/95">Type</th>
                  <th className="py-2.5 px-3 bg-[#FAF7F2]/95">Ingredient / Items</th>
                  <th className="py-2.5 px-3 bg-[#FAF7F2]/95">Staff & Reason</th>
                  <th className="py-2.5 px-3 bg-[#FAF7F2]/95 text-center">Quantity</th>
                  <th className="py-2.5 px-3 text-center bg-[#FAF7F2]/95">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EAE2]">
                {filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-16 text-text-muted">
                      <Truck className="w-8 h-8 mx-auto mb-1.5 text-text-muted/40" />
                      <div className="font-bold text-xs text-brand-brown-dark">No cashier stock requests found.</div>
                    </td>
                  </tr>
                ) : (
                  filteredRequests.map((req) => {
                    const isPending = req.status === 'PENDING_APPROVAL';
                    const isApproved = req.status === 'APPROVED';
                    const isRejected = req.status === 'REJECTED';
                    const isDelivery = req.type === 'STOCK_DELIVERY';

                    return (
                      <tr
                        key={req.id}
                        onClick={() => handleOpenRequestModal(req)}
                        className={`hover:bg-[#FAF7F2]/80 transition-colors cursor-pointer group ${
                          isPending ? 'bg-amber-50/30' : ''
                        }`}
                        title="Click to view details and review"
                      >
                        {/* 1. Request Number & Timestamp Combined */}
                        <td className="py-2.5 px-3.5">
                          <div className="font-mono font-bold text-xs text-brand-teal group-hover:underline">
                            {req.requestNumber}
                          </div>
                          <div className="text-[10px] text-text-muted font-mono whitespace-nowrap">
                            {format(new Date(req.createdAt), 'dd MMM, hh:mm a')}
                          </div>
                        </td>

                        {/* 2. Type Badge */}
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-black text-[9px] uppercase border shadow-2xs ${
                              isDelivery
                                ? 'bg-amber-50 text-amber-900 border-amber-300'
                                : 'bg-teal-50 text-brand-teal-dark border-teal-200'
                            }`}
                          >
                            {isDelivery ? 'Delivery' : 'Adjustment'}
                          </span>
                        </td>

                        {/* 3. Ingredient / Items */}
                        <td className="py-2.5 px-3 font-black text-brand-brown-dark text-xs">
                          {isDelivery && req.items && req.items.length > 0 ? (
                            req.items.length === 1 ? (
                              <span className="truncate max-w-[190px] block font-bold text-xs">{req.items[0].ingredientName}</span>
                            ) : (
                              <div>
                                <div className="font-bold text-brand-brown-dark text-xs flex items-center gap-1.5">
                                  <span>{req.items[0].ingredientName}</span>
                                  <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-cream-100 text-brand-teal border border-teal-200/60">
                                    +{req.items.length - 1} more
                                  </span>
                                </div>
                                <div className="text-[10px] font-normal text-text-muted truncate max-w-[170px]" title={req.items.map((i) => i.ingredientName).join(', ')}>
                                  {req.items.map((i) => i.ingredientName).join(', ')}
                                </div>
                              </div>
                            )
                          ) : (
                            <span className="truncate max-w-[190px] block font-bold text-xs">{req.ingredientName}</span>
                          )}
                        </td>

                        {/* 4. Staff & Reason */}
                        <td className="py-2.5 px-3">
                          <div className="max-w-[220px]">
                            <span className="font-bold text-brand-brown-dark text-xs">{req.requestedByUserName}: </span>
                            <span className="text-text-muted text-[11px] truncate">
                              {req.reason.replace(/\(1 lines from /gi, '(1 item from ').replace(/\((\d+) lines from /gi, '($1 items from ')}
                            </span>
                          </div>
                          {req.supplierName && (
                            <div className="text-[10px] text-text-muted font-mono mt-0.5">
                              {req.supplierName} • {req.invoiceNumber || 'No Inv'}
                            </div>
                          )}
                          {req.rejectionReason && (
                            <div className="text-[10px] text-rose-600 font-bold mt-0.5">
                              Declined: {req.rejectionReason}
                            </div>
                          )}
                        </td>

                        {/* 5. Quantity / Valuation */}
                        <td className="py-2.5 px-3 text-center font-black text-xs tabular-nums">
                          {req.type === 'STOCK_ADJUSTMENT' ? (
                            <div>
                              <span>{req.requestedStock} {req.unit}</span>{' '}
                              <span
                                className={`text-[10px] font-bold ${
                                  req.quantityChange >= 0 ? 'text-status-success' : 'text-status-danger'
                                }`}
                              >
                                ({req.quantityChange >= 0 ? `+${req.quantityChange}` : req.quantityChange} {req.unit})
                              </span>
                            </div>
                          ) : (
                            <div>
                              <span className="text-status-success font-black">
                                +{req.quantityChange} {req.unit}
                              </span>
                              {(req.totalCents || req.costCents) && (
                                <div className="text-[10px] font-mono text-brand-brown-dark">
                                  {formatLKR(req.totalCents || req.costCents || 0)}
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* 6. Status Badge */}
                        <td className="py-2.5 px-3 text-center">
                          {isPending && (
                            <span className="px-2 py-0.5 rounded-full font-black text-[9px] uppercase bg-amber-50 text-amber-900 border border-amber-300 inline-flex items-center gap-1 shadow-2xs animate-pulse">
                              <Clock className="w-2.5 h-2.5 text-amber-700" />
                              <span>Waiting</span>
                            </span>
                          )}
                          {isApproved && (
                            <span className="px-2 py-0.5 rounded-full font-black text-[9px] uppercase bg-status-success-bg text-status-success border border-status-success/30 inline-flex items-center gap-1 shadow-2xs">
                              <Check className="w-2.5 h-2.5" />
                              <span>Approved</span>
                            </span>
                          )}
                          {isRejected && (
                            <span className="px-2 py-0.5 rounded-full font-black text-[9px] uppercase bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1 shadow-2xs">
                              <XCircle className="w-2.5 h-2.5" />
                              <span>Rejected</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
                {filteredRequests.length > 0 && (
                  <tr aria-hidden="true" className="border-0 pointer-events-none select-none">
                    <td colSpan={7} className="h-20 bg-transparent border-0" />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. FLOATING SEARCH & ACTION CAPSULE (Centered in Workspace, Above Footer) */}
      <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center pointer-events-none select-none max-w-[calc(100%-2rem)]">
        <div
          className={`bg-[#1E1917]/95 text-white backdrop-blur-xl border border-white/10 shadow-2xl rounded-full h-[52px] flex items-center gap-2.5 transition-all duration-300 pointer-events-auto ${
            activeTab === 'requests' ? 'px-4 sm:px-5' : 'p-1.5 pl-4 pr-1.5'
          }`}
        >
          {/* Search Bar */}
          <div className="flex items-center gap-2 min-w-0">
            <Search className="w-4 h-4 text-white/50 shrink-0 pointer-events-none" />
            <input
              type="text"
              placeholder={
                activeTab === 'stock'
                  ? 'Search ingredients, SKU...'
                  : activeTab === 'movements'
                  ? 'Search movements, reasons...'
                  : activeTab === 'purchases'
                  ? 'Search POs, vendors...'
                  : 'Search requests, cashiers, items...'
              }
              value={search}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              onChange={(e) => setSearch(e.target.value)}
              className={`bg-transparent border-0 border-none outline-none focus:outline-none focus:ring-0 text-xs font-semibold text-white placeholder:text-white/40 shadow-none transition-all duration-300 ease-out ${
                isSearchFocused || search
                  ? 'w-56 sm:w-72 md:w-80'
                  : activeTab === 'requests'
                  ? 'w-48 sm:w-56'
                  : 'w-36 sm:w-44'
              }`}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Primary Action Button */}
          {activeTab === 'stock' && (
            <button
              onClick={handleOpenAddIngredient}
              className="w-10 h-10 rounded-full bg-[#E99343] hover:bg-[#DE7E29] text-white flex items-center justify-center shadow-lg shadow-[#E99343]/30 active:scale-95 transition-all shrink-0 cursor-pointer group"
              title="Add New Ingredient"
            >
              <Plus className="w-5 h-5 stroke-[2.5] group-hover:rotate-90 transition-transform duration-200" />
            </button>
          )}

          {activeTab === 'movements' && (
            <button
              onClick={() => handleOpenAdjustModal()}
              className="w-10 h-10 rounded-full bg-[#E99343] hover:bg-[#DE7E29] text-white flex items-center justify-center shadow-lg shadow-[#E99343]/30 active:scale-95 transition-all shrink-0 cursor-pointer group"
              title="Record Stock Adjustment"
            >
              <Plus className="w-5 h-5 stroke-[2.5] group-hover:rotate-90 transition-transform duration-200" />
            </button>
          )}

          {activeTab === 'purchases' && (
            <button
              onClick={handleOpenReceiveModal}
              className="w-10 h-10 rounded-full bg-[#E99343] hover:bg-[#DE7E29] text-white flex items-center justify-center shadow-lg shadow-[#E99343]/30 active:scale-95 transition-all shrink-0 cursor-pointer group"
              title="Receive Stock / Purchase Order"
            >
              <Plus className="w-5 h-5 stroke-[2.5] group-hover:rotate-90 transition-transform duration-200" />
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 6. MODAL: ADD / EDIT INGREDIENT                                           */}
      {/* ========================================================================= */}
      {editingIngredient &&
        createPortal(
          <div className="fixed inset-0 z-[99999] w-full h-full bg-black/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-hidden animate-in fade-in">
            <div className="w-full max-w-lg sm:max-w-xl flex flex-col max-h-[92vh]">
              {/* Separate Header */}
              <div className="flex items-center justify-between gap-3 mb-3 px-1 shrink-0">
                <div className="min-w-0 flex-1">
                  <h3 className="font-extrabold text-base sm:text-lg text-white drop-shadow-xs truncate">
                    {editingIngredient.id ? 'Edit Ingredient' : 'New Raw Ingredient'}
                  </h3>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditingIngredient(null)}
                    className="px-4 py-2 rounded-full border border-white/30 text-white hover:bg-white/10 text-xs font-bold transition-all whitespace-nowrap cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="ingredient-form"
                    className="px-5 py-2 rounded-full bg-brand-teal hover:bg-brand-teal-dark text-white font-extrabold text-xs shadow-teal transition-all active:scale-95 whitespace-nowrap cursor-pointer"
                  >
                    Save Ingredient
                  </button>
                </div>
              </div>

              <div className="w-full bg-white rounded-3xl shadow-2xl border border-[#E9E0D5] overflow-y-auto">
                <form id="ingredient-form" onSubmit={handleSaveIngredient} className="p-5 sm:p-6 space-y-5">
                  <div>
                    <label className="text-[11px] font-bold uppercase text-text-secondary block mb-1">
                      Ingredient Name <span className="text-status-danger">*</span>
                    </label>
                    <input
                      type="text"
                      value={editingIngredient.name || ''}
                      onChange={(e) => setEditingIngredient({ ...editingIngredient, name: e.target.value })}
                      placeholder="e.g. Arabica Espresso Beans, Fresh Cow Milk..."
                      className="w-full pb-2 pt-1 bg-transparent border-0 border-b border-[#E2D8CC] text-sm font-bold text-brand-brown-dark focus:outline-none focus:border-brand-teal rounded-none transition-colors"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-bold uppercase text-text-secondary block mb-1">
                        Measurement Unit
                      </label>
                      <select
                        value={editingIngredient.unit || 'kg'}
                        onChange={(e) => setEditingIngredient({ ...editingIngredient, unit: e.target.value as any })}
                        className="w-full pb-2 pt-1 bg-transparent border-0 border-b border-[#E2D8CC] text-xs font-bold text-brand-brown-dark focus:outline-none focus:border-brand-teal rounded-none transition-colors cursor-pointer"
                      >
                        <option value="kg">kg (Kilograms)</option>
                        <option value="g">g (Grams)</option>
                        <option value="L">L (Liters)</option>
                        <option value="ml">ml (Milliliters)</option>
                        <option value="pcs">pcs (Pieces)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold uppercase text-text-secondary block mb-1">
                        SKU Code
                      </label>
                      <input
                        type="text"
                        value={editingIngredient.sku || ''}
                        onChange={(e) => setEditingIngredient({ ...editingIngredient, sku: e.target.value })}
                        placeholder="ING-1001"
                        className="w-full pb-2 pt-1 bg-transparent border-0 border-b border-[#E2D8CC] text-xs font-bold text-brand-brown-dark focus:outline-none focus:border-brand-teal rounded-none transition-colors font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-bold uppercase text-text-secondary block mb-1">
                        Initial Stock Count
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editingIngredient.currentStock ?? 0}
                        onChange={(e) => setEditingIngredient({ ...editingIngredient, currentStock: Number(e.target.value) })}
                        className="w-full pb-2 pt-1 bg-transparent border-0 border-b border-[#E2D8CC] text-xs font-bold text-brand-brown-dark focus:outline-none focus:border-brand-teal rounded-none transition-colors"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold uppercase text-text-secondary block mb-1">
                        Reorder Threshold
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editingIngredient.reorderLevel ?? 0}
                        onChange={(e) => setEditingIngredient({ ...editingIngredient, reorderLevel: Number(e.target.value) })}
                        className="w-full pb-2 pt-1 bg-transparent border-0 border-b border-[#E2D8CC] text-xs font-bold text-brand-brown-dark focus:outline-none focus:border-brand-teal rounded-none transition-colors"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-bold uppercase text-text-secondary block mb-1">
                        Average Unit Cost (Rs.)
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={(editingIngredient.averageCostCents || 0) / 100}
                        onChange={(e) => setEditingIngredient({ ...editingIngredient, averageCostCents: Math.round(Number(e.target.value) * 100) })}
                        placeholder="0.00"
                        className="w-full pb-2 pt-1 bg-transparent border-0 border-b border-[#E2D8CC] text-xs font-bold text-brand-brown-dark focus:outline-none focus:border-brand-teal rounded-none transition-colors"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold uppercase text-text-secondary block mb-1">
                        Expiry Date (Optional)
                      </label>
                      <input
                        type="date"
                        value={editingIngredient.expiryDate || ''}
                        onChange={(e) => setEditingIngredient({ ...editingIngredient, expiryDate: e.target.value || undefined })}
                        className="w-full pb-2 pt-1 bg-transparent border-0 border-b border-[#E2D8CC] text-xs font-bold font-mono text-brand-brown-dark focus:outline-none focus:border-brand-teal rounded-none transition-colors cursor-pointer"
                      />
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ========================================================================= */}
      {/* 7. MODAL: GOODS RECEIVED NOTE / PURCHASE ORDER (STUDIO CARD PATTERN)      */}
      {/* ========================================================================= */}
      {isReceiveModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[99999] w-full h-full bg-black/60 backdrop-blur-md flex items-center justify-center p-2 sm:p-3 lg:p-4 overflow-hidden animate-in fade-in">
            <div className="w-full max-w-[98vw] 2xl:max-w-[1700px] h-[94vh] max-h-[94vh] flex flex-col">
              {/* 1. Top Header Row above cards */}
              <div className="flex items-center justify-between gap-3 mb-3 px-1 shrink-0">
                <div className="min-w-0 flex-1 flex items-center gap-2">
                  <h3 className="font-extrabold text-base sm:text-lg text-white drop-shadow-xs truncate">
                    Receive Stock / Purchase Order
                  </h3>
                  <span className="text-[11px] font-bold text-white/70 bg-white/10 px-2.5 py-0.5 rounded-full backdrop-blur-xs hidden sm:inline-block shrink-0">
                    Goods Inward Studio
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsReceiveModalOpen(false)}
                    className="px-4 py-2 rounded-full border border-white/30 text-white hover:bg-white/10 text-xs font-bold transition-all whitespace-nowrap cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="receive-form"
                    className="px-5 py-2 rounded-full bg-brand-teal hover:bg-brand-teal-dark text-white font-extrabold text-xs shadow-teal transition-all active:scale-95 whitespace-nowrap cursor-pointer"
                  >
                    Confirm & Update Stock
                  </button>
                </div>
              </div>

              {/* 2. Main Studio Grid Container (3 Equal-Height Studio Cards Side-by-Side) */}
              <form
                id="receive-form"
                onSubmit={handleSavePurchase}
                className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 flex-1 min-h-0 overflow-hidden"
              >
                {/* ================================================================= */}
                {/* 1. LEFT CARD: SUPPLIER & INVOICE DETAILS (Col Span 3)             */}
                {/* ================================================================= */}
                <div className="lg:col-span-3 xl:col-span-3 flex flex-col h-full min-h-0 bg-white rounded-3xl shadow-sm border border-[#E9E0D5] p-4 sm:p-5 overflow-y-auto space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-[#EAE3DA] shrink-0">
                    <div className="w-7 h-7 rounded-xl bg-brand-brown/10 text-brand-brown flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-extrabold uppercase text-brand-brown-dark tracking-wider block leading-tight">
                      Supplier & Invoice Details
                    </span>
                  </div>

                  {/* Form Fields */}
                  <div className="space-y-3.5 flex-1">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1">
                        Supplier / Vendor <span className="text-status-danger">*</span>
                      </label>
                      <select
                        value={selectedSupplierId}
                        onChange={(e) => {
                          const supId = e.target.value;
                          setSelectedSupplierId(supId);
                          const sup = suppliers.find((s) => s.id === supId);
                          setVendorName(sup ? sup.name : '');
                          const newAvail = getSupplierAvailableIngredients(supId, suppliers, ingredients);
                          setPurchaseItems((prev) => {
                            if (prev.length === 0) return prev;
                            if (newAvail.length === 0) return [];
                            return prev.map((item) => {
                              const isValid = newAvail.some((ing) => ing.id === item.ingredientId);
                              if (!isValid) {
                                const first = newAvail[0];
                                return {
                                  ...item,
                                  ingredientId: first.id,
                                  ingredientName: first.name,
                                  unit: first.unit,
                                  unitPriceCents: first.averageCostCents || 50000,
                                  totalCents: Math.round(item.quantity * (first.averageCostCents || 50000)),
                                };
                              }
                              return item;
                            });
                          });
                        }}
                        required
                        className="w-full p-2 bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl text-xs font-bold text-brand-brown-dark focus:outline-none focus:border-brand-teal cursor-pointer transition-colors"
                      >
                        <option value="">-- Select Active Supplier --</option>
                        {activeSuppliers.map((sup) => (
                          <option key={sup.id} value={sup.id}>
                            {sup.name} {sup.contactPerson ? `(${sup.contactPerson})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1">
                        Invoice / Bill Ref #
                      </label>
                      <input
                        type="text"
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        placeholder="INV-9901"
                        className="w-full pb-1.5 pt-0.5 bg-transparent border-0 border-b border-[#E2D8CC] text-xs font-bold text-brand-brown-dark focus:outline-none focus:border-brand-teal rounded-none transition-colors font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1">
                        Delivery / PO Notes
                      </label>
                      <textarea
                        rows={2}
                        value={purchaseNotes}
                        onChange={(e) => setPurchaseNotes(e.target.value)}
                        placeholder="e.g. Batch #409, temperature check OK, received via cold truck..."
                        className="w-full p-2 bg-[#FAF7F2] border border-[#E0D7CC] rounded-xl text-xs font-medium text-brand-brown-dark focus:outline-none focus:border-brand-teal resize-none"
                      />
                    </div>

                    {/* Center Café Logo Showcase (Clean, No Background/Borders, Large) */}
                    <div className="flex flex-col items-center justify-center py-4 my-auto select-none pointer-events-none">
                      <img
                        src="/logobg.webp"
                        alt="Café Logo"
                        className="w-36 sm:w-44 h-auto object-contain drop-shadow-xs"
                      />
                    </div>
                  </div>

                  {/* Receiving Metadata Info Box */}
                  <div className="p-3 rounded-2xl bg-[#FAF7F2] border border-[#E2D8CC] space-y-1.5 shrink-0 text-[11px]">
                    <div className="flex justify-between text-text-muted">
                      <span>Receiving Date:</span>
                      <span className="font-bold text-brand-brown-dark">{new Date().toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between text-text-muted">
                      <span>Verified By:</span>
                      <span className="font-bold text-brand-teal">Store Manager</span>
                    </div>
                    <div className="flex justify-between text-text-muted">
                      <span>Total Items:</span>
                      <span className="font-bold text-brand-brown-dark">{purchaseItems.length} lines</span>
                    </div>
                  </div>
                </div>

                {/* ================================================================= */}
                {/* 2. MIDDLE CARD: RECEIVED LINE ITEMS (Col Span 6)                  */}
                {/* ================================================================= */}
                <div className="lg:col-span-6 xl:col-span-6 flex flex-col h-full min-h-0 bg-white rounded-3xl shadow-sm border border-[#E9E0D5] p-4 sm:p-5 overflow-hidden">
                  <div className="flex items-center justify-between pb-2 border-b border-[#EAE3DA] shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-brand-brown/10 text-brand-brown flex items-center justify-center shrink-0">
                        <Package className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-extrabold uppercase text-brand-brown-dark tracking-wider block leading-tight">
                        Received Line Items
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddPurchaseItem}
                      className="px-3.5 py-1.5 bg-[#FAF7F2] hover:bg-cream-200 border border-[#E0D7CC] rounded-xl text-xs font-extrabold text-brand-teal flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs active:scale-95 shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Item</span>
                    </button>
                  </div>

                  {/* Line Items Table (Scrollable with subtle bottom border per row) */}
                  <div className="flex-1 min-h-0 overflow-y-auto py-1 pr-1">
                    {purchaseItems.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center p-8 rounded-2xl bg-[#FAF7F2]/60 border border-dashed border-[#E2D8CC] text-center space-y-2 my-auto">
                        <Package className="w-10 h-10 text-text-muted/40" />
                        <div className="text-xs font-bold text-brand-brown-dark">No Items Added</div>
                        <p className="text-[11px] text-text-muted max-w-sm">
                          Click <strong className="text-brand-teal font-extrabold">"+ Add Item"</strong> above to select ingredients being received.
                        </p>
                      </div>
                    ) : (
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="sticky top-0 bg-white z-10">
                          <tr className="border-b border-[#EAE3DA] text-[10px] font-black uppercase text-text-secondary tracking-wider">
                            <th className="py-2 px-2 w-8 text-center">#</th>
                            <th className="py-2 px-2">Ingredient / Item *</th>
                            <th className="py-2 px-2 w-20 text-center">Qty</th>
                            <th className="py-2 px-2 w-24 text-right">Cost (Rs.)</th>
                            <th className="py-2 px-2 w-32">Expiry Date</th>
                            <th className="py-2 px-2 w-24 text-right">Line Total</th>
                            <th className="py-2 px-2 w-10 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F0E8DF]">
                          {purchaseItems.map((item, idx) => (
                            <tr
                              key={idx}
                              className="border-b border-[#F0E8DF] hover:bg-[#FAF7F2]/60 transition-colors"
                            >
                              {/* # Index */}
                              <td className="py-2.5 px-2 text-center font-mono font-bold text-[11px] text-text-muted">
                                {idx + 1}
                              </td>

                              {/* Ingredient Select */}
                              <td className="py-2.5 px-2">
                                <select
                                  value={item.ingredientId}
                                  onChange={(e) => handleUpdatePurchaseItem(idx, { ingredientId: e.target.value })}
                                  className="w-full p-2 bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl text-xs font-bold text-brand-brown-dark outline-none focus:border-brand-teal focus:bg-white cursor-pointer transition-colors"
                                >
                                  {availableIngredients.length === 0 ? (
                                    <option value="" disabled>
                                      -- No items registered for this supplier --
                                    </option>
                                  ) : (
                                    availableIngredients.map((ing) => (
                                      <option key={ing.id} value={ing.id}>
                                        {ing.name} ({ing.unit})
                                      </option>
                                    ))
                                  )}
                                </select>
                              </td>

                              {/* Qty Input with Unit badge */}
                              <td className="py-2.5 px-2">
                                <div className="flex items-center bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl overflow-hidden focus-within:border-brand-teal focus-within:bg-white transition-colors">
                                  <input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={item.quantity}
                                    onChange={(e) => handleUpdatePurchaseItem(idx, { quantity: Number(e.target.value) })}
                                    placeholder="1"
                                    className="w-full py-2 px-1.5 bg-transparent text-xs font-bold text-center text-brand-brown-dark outline-none"
                                    required
                                  />
                                  <span className="px-1.5 py-2 bg-[#F2ECE4] border-l border-[#E2D8CC] text-[10px] font-extrabold text-brand-brown-dark select-none shrink-0">
                                    {item.unit}
                                  </span>
                                </div>
                              </td>

                              {/* Cost (Rs.) Input */}
                              <td className="py-2.5 px-2 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={item.unitPriceCents / 100}
                                  onChange={(e) =>
                                    handleUpdatePurchaseItem(idx, {
                                      unitPriceCents: Math.round(Number(e.target.value) * 100),
                                    })
                                  }
                                  placeholder="0"
                                  className="w-full p-2 bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl text-xs font-bold text-right text-brand-brown-dark outline-none focus:border-brand-teal focus:bg-white transition-colors"
                                  required
                                />
                              </td>

                              {/* Expiry Date (Optional) */}
                              <td className="py-2.5 px-2">
                                <input
                                  type="date"
                                  value={item.expiryDate || ''}
                                  onChange={(e) => handleUpdatePurchaseItem(idx, { expiryDate: e.target.value })}
                                  className="w-full p-2 bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl text-xs font-mono font-bold text-brand-brown-dark outline-none focus:border-brand-teal focus:bg-white cursor-pointer transition-colors"
                                />
                              </td>

                              {/* Line Total */}
                              <td className="py-2.5 px-2 text-right">
                                <span className="font-black text-xs text-brand-brown-dark font-mono block whitespace-nowrap">
                                  {formatLKR(item.totalCents)}
                                </span>
                              </td>

                              {/* Action (Delete) */}
                              <td className="py-2.5 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemovePurchaseItem(idx)}
                                  className="w-7 h-7 rounded-full bg-[#FAF7F2] hover:bg-rose-50 border border-[#E0D7CC] hover:border-rose-200 text-text-muted hover:text-rose-600 flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95 mx-auto"
                                  title="Remove item"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                {/* ================================================================= */}
                {/* 3. RIGHT CARD: PAYMENT SETTLEMENT & SUMMARY (Col Span 3)          */}
                {/* ================================================================= */}
                <div className="lg:col-span-3 xl:col-span-3 flex flex-col h-full min-h-0 bg-white rounded-3xl shadow-sm border border-[#E9E0D5] p-4 sm:p-5 space-y-3">
                  {/* Card Header with Minimal Clear / Unpaid Action */}
                  <div className="flex items-center justify-between pb-2 border-b border-[#EAE3DA] shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-brand-brown/10 text-brand-brown flex items-center justify-center shrink-0">
                        <Wallet className="w-4 h-4 text-brand-teal" />
                      </div>
                      <span className="text-xs font-extrabold uppercase text-brand-brown-dark tracking-wider block leading-tight">
                        Payment Settlement
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSetFullPayment('UNPAID')}
                      className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-[#FAF7F2] hover:bg-rose-50 border border-[#E0D7CC] hover:border-rose-200 text-text-secondary hover:text-rose-700 flex items-center gap-1 transition-all shadow-2xs cursor-pointer active:scale-95"
                      title="Clear payments & record as unpaid supplier credit"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Unpaid (Credit)</span>
                    </button>
                  </div>

                  {/* Middle Scrollable Section */}
                  <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-0.5">
                    {/* Payment Method Breakdown with Creative Inline "Full" Markers */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-extrabold uppercase text-text-muted block">
                          Payment Method Breakdown (Rs.)
                        </label>
                        <span className="text-[10px] font-medium text-text-muted">Click "Full" to autofill</span>
                      </div>

                      {/* Cash Row with Inline Full Marker */}
                      <div className="flex items-center justify-between p-2.5 rounded-2xl bg-[#FAF7F2] border border-[#E2D8CC] hover:border-brand-teal/30 transition-colors">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-emerald-50 text-status-success flex items-center justify-center border border-emerald-200/60 shrink-0">
                            <Banknote className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-xs font-bold text-brand-brown-dark">Cash</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSetFullPayment('CASH')}
                            className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold border transition-all cursor-pointer select-none active:scale-95 shrink-0 ${
                              numCash > 0 && numCash === totalInvoicedCents / 100 && totalInvoicedCents > 0
                                ? 'bg-status-success text-white border-status-success shadow-2xs'
                                : 'bg-white hover:bg-cream-100 text-brand-brown border-[#E0D7CC]'
                            }`}
                            title="Fill 100% Invoice Amount via Cash"
                          >
                            {numCash > 0 && numCash === totalInvoicedCents / 100 && totalInvoicedCents > 0
                              ? '✓ Full'
                              : 'Full'}
                          </button>
                          <div className="w-28 sm:w-32">
                            <input
                              type="number"
                              step="1"
                              min="0"
                              value={cashAmount}
                              onChange={(e) => setCashAmount(e.target.value)}
                              placeholder="0.00"
                              className="w-full text-right font-black text-xs text-brand-brown-dark outline-none bg-white p-1.5 rounded-xl border border-[#E0D7CC] tabular-nums focus:border-brand-teal placeholder:text-text-muted/50 placeholder:font-bold"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Card / Bank Row with Inline Full Marker */}
                      <div className="flex items-center justify-between p-2.5 rounded-2xl bg-[#FAF7F2] border border-[#E2D8CC] hover:border-brand-teal/30 transition-colors">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-teal-50 text-brand-teal flex items-center justify-center border border-teal-200/60 shrink-0">
                            <CreditCard className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-xs font-bold text-brand-brown-dark">Card / Bank</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSetFullPayment('CARD')}
                            className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold border transition-all cursor-pointer select-none active:scale-95 shrink-0 ${
                              numCard > 0 && numCard === totalInvoicedCents / 100 && totalInvoicedCents > 0
                                ? 'bg-brand-teal text-white border-brand-teal shadow-2xs'
                                : 'bg-white hover:bg-cream-100 text-brand-brown border-[#E0D7CC]'
                            }`}
                            title="Fill 100% Invoice Amount via Card / Bank"
                          >
                            {numCard > 0 && numCard === totalInvoicedCents / 100 && totalInvoicedCents > 0
                              ? '✓ Full'
                              : 'Full'}
                          </button>
                          <div className="w-28 sm:w-32">
                            <input
                              type="number"
                              step="1"
                              min="0"
                              value={cardAmount}
                              onChange={(e) => setCardAmount(e.target.value)}
                              placeholder="0.00"
                              className="w-full text-right font-black text-xs text-brand-brown-dark outline-none bg-white p-1.5 rounded-xl border border-[#E0D7CC] tabular-nums focus:border-brand-teal placeholder:text-text-muted/50 placeholder:font-bold"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Cheque Row with Inline Full Marker */}
                      <div className="flex items-center justify-between p-2.5 rounded-2xl bg-[#FAF7F2] border border-[#E2D8CC] hover:border-brand-teal/30 transition-colors">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200/60 shrink-0">
                            <FileText className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-xs font-bold text-brand-brown-dark">Cheque</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSetFullPayment('CHEQUE')}
                            className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold border transition-all cursor-pointer select-none active:scale-95 shrink-0 ${
                              numCheque > 0 && numCheque === totalInvoicedCents / 100 && totalInvoicedCents > 0
                                ? 'bg-amber-700 text-white border-amber-700 shadow-2xs'
                                : 'bg-white hover:bg-cream-100 text-brand-brown border-[#E0D7CC]'
                            }`}
                            title="Fill 100% Invoice Amount via Cheque"
                          >
                            {numCheque > 0 && numCheque === totalInvoicedCents / 100 && totalInvoicedCents > 0
                              ? '✓ Full'
                              : 'Full'}
                          </button>
                          <div className="w-28 sm:w-32">
                            <input
                              type="number"
                              step="1"
                              min="0"
                              value={chequeAmount}
                              onChange={(e) => setChequeAmount(e.target.value)}
                              placeholder="0.00"
                              className="w-full text-right font-black text-xs text-brand-brown-dark outline-none bg-white p-1.5 rounded-xl border border-[#E0D7CC] tabular-nums focus:border-brand-teal placeholder:text-text-muted/50 placeholder:font-bold"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Dedicated Scheduled Due Date Card (Appears if Partial or Unpaid Balance Due) - Positioned First */}
                    {balanceDueCents > 0 && totalInvoicedCents > 0 && (
                      <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200/80 space-y-2.5 shrink-0 animate-in fade-in">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-black text-rose-900">
                            <Clock className="w-3.5 h-3.5 text-rose-600" />
                            <span>Balance Due Schedule</span>
                          </div>
                          <span className="text-[10px] font-extrabold text-rose-700 bg-rose-100/90 px-2 py-0.5 rounded-lg border border-rose-200">
                            {formatLKR(balanceDueCents)} Due
                          </span>
                        </div>

                        <div>
                          <label className="text-[9px] font-bold uppercase text-text-secondary block mb-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-rose-600" />
                            <span>Next Settlement Deadline <span className="text-status-danger">*</span></span>
                          </label>
                          <CustomDatePicker
                            value={duePaymentDate}
                            onChange={(val) => setDuePaymentDate(val)}
                            required
                            placeholder="Select Settlement Due Date"
                            inputClassName="bg-white border-rose-200"
                            align="right"
                          />
                        </div>
                      </div>
                    )}

                    {/* Dedicated Cheque Details Card (Appears if Cheque > 0) */}
                    {numCheque > 0 && (
                      <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2.5 shrink-0 animate-in fade-in">
                        <div className="flex items-center gap-1.5 text-xs font-black text-amber-900">
                          <Landmark className="w-3.5 h-3.5 text-amber-700" />
                          <span>Cheque Realization Details</span>
                        </div>

                        <div className="space-y-2 text-xs">
                          <div>
                            <label className="text-[9px] font-bold uppercase text-text-secondary block mb-0.5">
                              Cheque Ref / Number <span className="text-status-danger">*</span>
                            </label>
                            <input
                              type="text"
                              value={chequeNumber}
                              onChange={(e) => setChequeNumber(e.target.value)}
                              placeholder="e.g. CHQ-881902"
                              className="w-full p-1.5 bg-white border border-amber-200 rounded-xl font-mono font-bold text-xs text-brand-brown-dark outline-none focus:border-brand-teal"
                              required={numCheque > 0}
                            />
                          </div>

                          <div>
                            <label className="text-[9px] font-bold uppercase text-text-secondary block mb-0.5">
                              Bank Name <span className="text-status-danger">*</span>
                            </label>
                            <input
                              type="text"
                              value={chequeBank}
                              onChange={(e) => setChequeBank(e.target.value)}
                              placeholder="e.g. Commercial Bank, BOC, HNB"
                              className="w-full p-1.5 bg-white border border-amber-200 rounded-xl font-bold text-xs text-brand-brown-dark outline-none focus:border-brand-teal"
                              required={numCheque > 0}
                            />
                          </div>

                          <div>
                            <label className="text-[9px] font-bold uppercase text-text-secondary block mb-0.5 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-amber-700" />
                              <span>Cheque End / Realization Date <span className="text-status-danger">*</span></span>
                            </label>
                            <CustomDatePicker
                              value={chequeDate}
                              onChange={(val) => setChequeDate(val)}
                              required={numCheque > 0}
                              placeholder="Select Cheque Realization Date"
                              inputClassName="bg-white border-amber-200"
                              align="right"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Financial Settlement Summary Card Pinned firmly at the Bottom */}
                  <div className="p-3.5 bg-[#FAF7F2] rounded-2xl border border-[#E2D8CC] space-y-2 shrink-0 text-xs mt-auto">
                    <div className="flex justify-between items-center text-text-secondary">
                      <span>Total Invoiced:</span>
                      <span className="font-mono font-bold text-brand-brown-dark">{formatLKR(totalInvoicedCents)}</span>
                    </div>
                    <div className="flex justify-between items-center font-bold text-brand-teal">
                      <span>Total Paid:</span>
                      <span className="font-mono">{formatLKR(totalPaidCents)}</span>
                    </div>
                    {balanceDueCents > 0 && (
                      <div className="flex justify-between items-center font-bold text-rose-600 pt-1.5 border-t border-[#E0D7CC]">
                        <span>Remaining Due (Credit):</span>
                        <span className="font-mono text-sm">{formatLKR(balanceDueCents)}</span>
                      </div>
                    )}
                    {overpaidCents > 0 && totalInvoicedCents > 0 && (
                      <div className="flex justify-between items-center font-bold text-amber-900 bg-amber-100/90 border border-amber-300/80 px-2.5 py-1.5 rounded-xl text-[11px] animate-in fade-in">
                        <span className="flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                          <span>Overpaid Excess:</span>
                        </span>
                        <span className="font-mono text-xs font-black text-amber-900">
                          +{formatLKR(overpaidCents)}
                        </span>
                      </div>
                    )}

                    <div className="pt-1.5 text-center">
                      {purchaseItems.length === 0 || totalInvoicedCents === 0 ? (
                        <span className="inline-flex items-center justify-center w-full gap-1.5 py-1 rounded-xl font-extrabold text-[11px] uppercase border bg-cream-100/70 text-text-muted border-[#E0D7CC]">
                          <Package className="w-3.5 h-3.5 text-text-muted" />
                          <span>Add items to pay</span>
                        </span>
                      ) : overpaidCents > 0 ? (
                        <span className="inline-flex items-center justify-center w-full gap-1.5 py-1 rounded-xl font-black text-[11px] uppercase border bg-amber-100 text-amber-900 border-amber-300">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                          <span>Overpaid (+{formatLKR(overpaidCents)})</span>
                        </span>
                      ) : paymentStatus === 'PAID' ? (
                        <span className="inline-flex items-center justify-center w-full gap-1 py-1 rounded-xl font-black text-[11px] uppercase border bg-status-success-bg text-status-success border-status-success/30">
                          <Check className="w-3.5 h-3.5" />
                          <span>Fully Settled (Paid)</span>
                        </span>
                      ) : paymentStatus === 'PARTIAL' ? (
                        <span className="inline-flex items-center justify-center w-full gap-1 py-1 rounded-xl font-black text-[11px] uppercase border bg-status-warning-bg text-status-warning border-status-warning/30">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Partial Payment</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-full gap-1 py-1 rounded-xl font-black text-[11px] uppercase border bg-rose-50 text-rose-700 border-rose-200">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Unpaid (Supplier Credit)</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ========================================================================= */}
      {/* 8. MODAL: MANUAL STOCK ADJUSTMENT / SPOILAGE                              */}
      {/* ========================================================================= */}
      {isAdjustModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[99999] w-full h-full bg-black/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-hidden animate-in fade-in">
            <div className="w-full max-w-lg sm:max-w-xl flex flex-col max-h-[92vh]">
              <div className="flex items-center justify-between gap-3 mb-3 px-1 shrink-0">
                <div className="min-w-0 flex-1">
                  <h3 className="font-extrabold text-base sm:text-lg text-white drop-shadow-xs truncate">
                    Record Stock Adjustment
                  </h3>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsAdjustModalOpen(false)}
                    className="px-4 py-2 rounded-full border border-white/30 text-white hover:bg-white/10 text-xs font-bold transition-all whitespace-nowrap cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="adjust-form"
                    className="px-5 py-2 rounded-full bg-brand-teal hover:bg-brand-teal-dark text-white font-extrabold text-xs shadow-teal transition-all active:scale-95 whitespace-nowrap cursor-pointer"
                  >
                    Save Adjustment
                  </button>
                </div>
              </div>

              <div className="w-full bg-white rounded-3xl shadow-2xl border border-[#E9E0D5] overflow-y-auto">
                <form id="adjust-form" onSubmit={handleSaveAdjustment} className="p-5 sm:p-6 space-y-4">
                  <div>
                    <label className="text-[11px] font-bold uppercase text-text-secondary block mb-1">
                      Raw Ingredient <span className="text-status-danger">*</span>
                    </label>
                    {isSpecificIngredientAdjust && selectedAdjustIng ? (
                      <div className="w-full pb-2 pt-1 bg-transparent border-0 border-b border-[#E2D8CC] text-sm font-bold text-brand-brown-dark flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>{selectedAdjustIng.name}</span>
                          {selectedAdjustIng.sku && (
                            <span className="text-[10px] font-mono font-semibold text-text-muted bg-cream-100 px-1.5 py-0.5 rounded">
                              {selectedAdjustIng.sku}
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-bold text-brand-teal">
                          Current: {selectedAdjustIng.currentStock} {selectedAdjustIng.unit}
                        </span>
                      </div>
                    ) : (
                      <select
                        value={adjustIngredientId}
                        onChange={(e) => {
                          setAdjustIngredientId(e.target.value);
                          const chosen = ingredients.find((i) => i.id === e.target.value);
                          setAdjustExpiry(chosen?.expiryDate || '');
                        }}
                        className="w-full pb-2 pt-1 bg-transparent border-0 border-b border-[#E2D8CC] text-xs font-bold text-brand-brown-dark focus:outline-none focus:border-brand-teal rounded-none transition-colors cursor-pointer"
                        required
                      >
                        {ingredients.map((ing) => (
                          <option key={ing.id} value={ing.id}>
                            {ing.name} (Current: {ing.currentStock} {ing.unit})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase text-text-secondary block mb-1.5">
                      Adjustment Action
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setAdjustType('ADD')}
                        className={`py-2 rounded-xl text-xs font-extrabold transition-all border ${
                          adjustType === 'ADD'
                            ? 'bg-[#251814] text-white border-[#251814] shadow-xs'
                            : 'bg-[#FAF7F2] text-text-secondary hover:bg-cream-100 border-[#E0D7CC]'
                        }`}
                      >
                        + Add Stock
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdjustType('DEDUCT')}
                        className={`py-2 rounded-xl text-xs font-extrabold transition-all border ${
                          adjustType === 'DEDUCT'
                            ? 'bg-[#251814] text-white border-[#251814] shadow-xs'
                            : 'bg-[#FAF7F2] text-text-secondary hover:bg-cream-100 border-[#E0D7CC]'
                        }`}
                      >
                        - Deduct / Waste
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdjustType('EXACT')}
                        className={`py-2 rounded-xl text-xs font-extrabold transition-all border ${
                          adjustType === 'EXACT'
                            ? 'bg-[#251814] text-white border-[#251814] shadow-xs'
                            : 'bg-[#FAF7F2] text-text-secondary hover:bg-cream-100 border-[#E0D7CC]'
                        }`}
                      >
                        = Exact Count
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase text-text-secondary block mb-1">
                      Quantity to Adjust ({selectedAdjustIng?.unit || 'Units'})
                    </label>
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => setAdjustQuantity((prev) => Math.max(0.1, Number((prev - 1).toFixed(2))))}
                        className="w-10 h-10 rounded-2xl bg-[#FAF7F2] hover:bg-cream-200 border border-[#E0D7CC] flex items-center justify-center text-brand-brown-dark font-bold shrink-0 transition-colors cursor-pointer"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={adjustQuantity}
                        onChange={(e) => setAdjustQuantity(Number(e.target.value))}
                        className="flex-1 h-10 px-3 bg-white border border-[#E2D8CC] focus:border-brand-teal rounded-2xl text-center text-base font-black text-brand-brown-dark focus:outline-none"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setAdjustQuantity((prev) => Number((prev + 1).toFixed(2)))}
                        className="w-10 h-10 rounded-2xl bg-[#FAF7F2] hover:bg-cream-200 border border-[#E0D7CC] flex items-center justify-center text-brand-brown-dark font-bold shrink-0 transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold uppercase text-text-secondary block">
                        Expiry Date (Optional)
                      </label>
                      {selectedAdjustIng?.expiryDate && (
                        <span className="text-[10px] text-brand-teal font-mono font-bold">
                          Current: {selectedAdjustIng.expiryDate}
                        </span>
                      )}
                    </div>
                    <input
                      type="date"
                      value={adjustExpiry}
                      onChange={(e) => setAdjustExpiry(e.target.value)}
                      className="w-full pb-2 pt-1 bg-transparent border-0 border-b border-[#E2D8CC] text-xs font-mono font-bold text-brand-brown-dark focus:outline-none focus:border-brand-teal rounded-none transition-colors cursor-pointer"
                    />
                    <p className="text-[10px] text-text-muted mt-1">
                      Optional. If left blank, will keep current expiry date ({selectedAdjustIng?.expiryDate || 'None'}).
                    </p>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase text-text-secondary block mb-1">
                      Audit Reason / Note <span className="text-status-danger">*</span>
                    </label>
                    <input
                      type="text"
                      value={adjustReason}
                      onChange={(e) => setAdjustReason(e.target.value)}
                      placeholder="e.g. Spoilage, Physical inventory count, Calibration"
                      className="w-full pb-2 pt-1 bg-transparent border-0 border-b border-[#E2D8CC] text-xs font-bold text-brand-brown-dark focus:outline-none focus:border-brand-teal rounded-none transition-colors"
                      required
                    />
                  </div>
                </form>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ========================================================================= */}
      {/* 9. MODAL: VIEW PURCHASE DETAILS (3-COLUMN STUDIO CARD PATTERN)            */}
      {/* ========================================================================= */}
      {viewingPurchase && (() => {
        const effectivePaidCents = viewingPurchase.paidCents ?? viewingPurchase.totalCents;
        const effectiveDueCents = viewingPurchase.dueCents ?? Math.max(0, viewingPurchase.totalCents - effectivePaidCents);
        const effectiveOverpaidCents = Math.max(0, effectivePaidCents - viewingPurchase.totalCents);
        const effectivePaymentStatus: PurchasePaymentStatus =
          viewingPurchase.paymentStatus ||
          (effectivePaidCents >= viewingPurchase.totalCents && viewingPurchase.totalCents > 0
            ? 'PAID'
            : effectivePaidCents > 0
            ? 'PARTIAL'
            : 'UNPAID');

        const isPaid = effectivePaymentStatus === 'PAID';

        // Extract payment breakdown amounts
        const cashPaidCents =
          viewingPurchase.payments?.filter((p) => p.method === 'CASH').reduce((s, p) => s + p.amountCents, 0) ||
          (isPaid && (!viewingPurchase.payments || viewingPurchase.payments.length === 0) ? viewingPurchase.totalCents : 0);
        const cardPaidCents =
          viewingPurchase.payments?.filter((p) => p.method === 'CARD').reduce((s, p) => s + p.amountCents, 0) || 0;
        const chequePaidCents =
          viewingPurchase.payments?.filter((p) => p.method === 'CHEQUE').reduce((s, p) => s + p.amountCents, 0) || 0;
        const chequePayment = viewingPurchase.payments?.find((p) => p.method === 'CHEQUE');

        return createPortal(
          <div className="fixed inset-0 z-[99999] w-full h-full bg-black/60 backdrop-blur-md flex items-center justify-center p-2 sm:p-3 lg:p-4 overflow-hidden animate-in fade-in">
            <div className="w-full max-w-[98vw] 2xl:max-w-[1700px] h-[94vh] max-h-[94vh] flex flex-col">
              {/* 1. Top Header Row above cards */}
              <div className="flex items-center justify-between gap-3 mb-3 px-1 shrink-0">
                <div className="min-w-0 flex-1 flex items-center gap-2">
                  <h3 className="font-extrabold text-base sm:text-lg text-white drop-shadow-xs truncate">
                    Purchase Order {viewingPurchase.purchaseNumber}
                  </h3>
                  <span className="text-[11px] font-bold text-white/70 bg-white/10 px-2.5 py-0.5 rounded-full backdrop-blur-xs hidden sm:inline-block shrink-0">
                    Goods Inward Voucher
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setViewingPurchase(null);
                      setIsAddingPayment(false);
                    }}
                    className="px-5 py-2 rounded-full bg-brand-teal hover:bg-brand-teal-dark text-white font-extrabold text-xs shadow-teal transition-all active:scale-95 whitespace-nowrap cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* 2. Main Studio Grid (3 Equal-Height Cards Side-by-Side) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 flex-1 min-h-0 overflow-hidden">
                {/* ================================================================= */}
                {/* 1. LEFT CARD: SUPPLIER & INVOICE DETAILS (Col Span 3 / 25% width) */}
                {/* ================================================================= */}
                <div className="lg:col-span-3 xl:col-span-3 flex flex-col h-full min-h-0 bg-white rounded-3xl shadow-sm border border-[#E9E0D5] p-4 sm:p-5 overflow-y-auto space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-[#EAE3DA] shrink-0">
                    <div className="w-7 h-7 rounded-xl bg-brand-brown/10 text-brand-brown flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-extrabold uppercase text-brand-brown-dark tracking-wider block leading-tight">
                        Supplier & Invoice Details
                      </span>
                      <span className="text-[10px] text-text-muted leading-none">
                        Vendor information & bill reference
                      </span>
                    </div>
                  </div>

                  {/* Form Fields */}
                  <div className="space-y-3.5 flex-1">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1">
                        Supplier / Vendor Name
                      </label>
                      <div className="w-full pb-1.5 pt-0.5 border-b border-[#E2D8CC] text-xs font-bold text-brand-brown-dark">
                        {viewingPurchase.supplierName || 'General Supplier'}
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1">
                        Invoice / Bill Ref #
                      </label>
                      <div className="flex items-center justify-between border-b border-[#E2D8CC] pb-1.5 pt-0.5">
                        <span className="text-xs font-mono font-bold text-brand-brown-dark">
                          {viewingPurchase.invoiceNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(viewingPurchase.invoiceNumber);
                            toast.success(`Copied "${viewingPurchase.invoiceNumber}"`);
                          }}
                          className="p-1 text-text-muted hover:text-brand-teal transition-colors cursor-pointer"
                          title="Copy Invoice Ref"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1">
                        Delivery / PO Notes
                      </label>
                      <div className="w-full min-h-[64px] p-2.5 bg-cream-50/50 rounded-2xl border border-[#E8DFC8] text-xs text-brand-brown-dark font-medium italic">
                        {viewingPurchase.notes || 'No delivery notes recorded.'}
                      </div>
                    </div>

                    {/* Clean Borderless Large Logo in vertical center */}
                    <div className="flex items-center justify-center my-auto py-2">
                      <img
                        src="/logobg.webp"
                        alt="Chill & Choc Cafe"
                        className="w-36 sm:w-44 h-auto object-contain select-none pointer-events-none drop-shadow-sm"
                      />
                    </div>
                  </div>

                  {/* Pinned Bottom Metadata Card */}
                  <div className="p-3 rounded-2xl bg-[#FAF7F2] border border-[#E2D8CC] space-y-1.5 shrink-0 text-[11px]">
                    <div className="flex justify-between items-center text-text-secondary">
                      <span>Receiving Date:</span>
                      <span className="font-bold text-brand-brown-dark">
                        {new Date(viewingPurchase.purchaseDate).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'numeric',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-text-secondary">
                      <span>Verified By:</span>
                      <span className="font-bold text-brand-teal">Store Manager</span>
                    </div>
                    <div className="flex justify-between items-center text-text-secondary">
                      <span>Total Items:</span>
                      <span className="font-bold text-brand-brown-dark">{viewingPurchase.items.length} lines</span>
                    </div>
                  </div>
                </div>

                {/* ================================================================= */}
                {/* 2. MIDDLE CARD: RECEIVED LINE ITEMS (Col Span 5 / 42% width)      */}
                {/* ================================================================= */}
                <div className="lg:col-span-5 xl:col-span-5 flex flex-col h-full min-h-0 bg-white rounded-3xl shadow-sm border border-[#E9E0D5] p-4 sm:p-5 overflow-y-auto space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#EAE3DA] shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-brand-brown/10 text-brand-brown flex items-center justify-center shrink-0">
                        <Package className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-extrabold uppercase text-brand-brown-dark tracking-wider block leading-tight">
                          Received Line Items
                        </span>
                        <span className="text-[10px] text-text-muted leading-none">
                          Raw ingredients delivered to storage
                        </span>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded-xl text-[10px] font-extrabold bg-cream-100 border border-[#E0D7CC] text-brand-brown">
                      {viewingPurchase.items.length} items
                    </span>
                  </div>

                  {/* Items List */}
                  <div className="flex-1 overflow-y-auto space-y-2.5 min-h-0 pr-1">
                    {viewingPurchase.items.map((it, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-[#FAF7F2] rounded-2xl border border-[#E2D8CC] flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-brand-brown-dark text-xs truncate">
                            {it.ingredientName}
                          </div>
                          <div className="text-[11px] text-text-muted font-mono mt-0.5">
                            {it.quantity} {it.unit} @ {formatLKR(it.unitPriceCents)}/{it.unit}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="font-black text-brand-brown-dark font-mono text-sm">
                            {formatLKR(it.totalCents)}
                          </div>
                          <span className="text-[10px] font-bold text-brand-teal bg-teal-50 border border-teal-200/60 px-2 py-0.5 rounded-md inline-block mt-0.5">
                            {it.quantity} {it.unit}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ================================================================= */}
                {/* 3. RIGHT CARD: PAYMENT SETTLEMENT & SUMMARY (Col Span 4 / 33%)    */}
                {/* ================================================================= */}
                <div className="lg:col-span-4 xl:col-span-4 flex flex-col h-full min-h-0 bg-white rounded-3xl shadow-sm border border-[#E9E0D5] p-4 sm:p-5 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#EAE3DA] shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-brand-brown/10 text-brand-brown flex items-center justify-center shrink-0">
                        <Wallet className="w-4 h-4 text-brand-teal" />
                      </div>
                      <div>
                        <span className="text-xs font-extrabold uppercase text-brand-brown-dark tracking-wider block leading-tight">
                          Payment Settlement
                        </span>
                        <span className="text-[10px] text-text-muted leading-none">
                          Multi-method splits & credit terms
                        </span>
                      </div>
                    </div>

                    {effectiveDueCents > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingPayment(!isAddingPayment);
                          if (!isAddingPayment) {
                            setSettleAmount(String(effectiveDueCents / 100));
                          }
                        }}
                        className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs ${
                          isAddingPayment
                            ? 'bg-rose-50 border-rose-200 text-rose-700'
                            : 'bg-brand-teal text-white border-brand-teal hover:bg-brand-teal/90'
                        }`}
                      >
                        {isAddingPayment ? (
                          <>
                            <X className="w-3 h-3" />
                            <span>Cancel</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3 h-3" />
                            <span>Record Payment</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Middle Scrollable Section */}
                  <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-0.5">
                    {/* Interactive Payment Drawer if active */}
                    {isAddingPayment && effectiveDueCents > 0 && (
                      <div className="p-3.5 bg-[#FAF7F2] rounded-2xl border border-[#E2D8CC] space-y-3 animate-in fade-in duration-200 shadow-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-brand-brown-dark flex items-center gap-1.5">
                            <Wallet className="w-3.5 h-3.5 text-brand-teal" />
                            <span>Record Settlement Payment</span>
                          </span>
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200 font-mono">
                            {formatLKR(effectiveDueCents)} Due
                          </span>
                        </div>

                        {/* Method selector */}
                        <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-xl border border-[#E2D8CC]">
                          {(['CASH', 'CARD', 'CHEQUE'] as const).map((method) => (
                            <button
                              key={method}
                              type="button"
                              onClick={() => setSettleMethod(method)}
                              className={`py-1.5 px-2 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                settleMethod === method
                                  ? 'bg-[#2D2422] text-white shadow-xs'
                                  : 'text-text-secondary hover:text-brand-brown-dark hover:bg-cream-100/60'
                              }`}
                            >
                              {method === 'CASH' && <Banknote className="w-3.5 h-3.5" />}
                              {method === 'CARD' && <CreditCard className="w-3.5 h-3.5" />}
                              {method === 'CHEQUE' && <FileText className="w-3.5 h-3.5" />}
                              <span>{method === 'CASH' ? 'Cash' : method === 'CARD' ? 'Card' : 'Cheque'}</span>
                            </button>
                          ))}
                        </div>

                        {/* Amount */}
                        <div className="relative flex items-center bg-white border border-[#E2D8CC] rounded-xl focus-within:border-brand-teal focus-within:ring-1 focus-within:ring-brand-teal transition-all overflow-hidden">
                          <span className="pl-3 pr-1 text-xs font-bold text-text-muted select-none">Rs.</span>
                          <input
                            type="number"
                            step="1"
                            min="1"
                            max={effectiveDueCents / 100}
                            value={settleAmount}
                            onChange={(e) => setSettleAmount(e.target.value)}
                            placeholder="0.00"
                            className="flex-1 py-2 px-2 bg-transparent font-mono font-bold text-xs text-brand-brown-dark outline-none text-right"
                          />
                          <button
                            type="button"
                            onClick={() => setSettleAmount(String(effectiveDueCents / 100))}
                            className="mx-1.5 px-2.5 py-1 bg-cream-100 hover:bg-cream-200 border border-[#E0D7CC] rounded-lg text-[10px] font-black text-brand-teal transition-all cursor-pointer active:scale-95 select-none"
                          >
                            Full
                          </button>
                        </div>

                        {/* Cheque info */}
                        {settleMethod === 'CHEQUE' && (
                          <div className="space-y-2 pt-2 border-t border-[#EAE3DA] text-xs">
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                value={settleChequeNumber}
                                onChange={(e) => setSettleChequeNumber(e.target.value)}
                                placeholder="Cheque Ref #"
                                className="w-full py-1.5 px-2.5 bg-white border border-[#E2D8CC] rounded-xl font-mono font-bold text-xs text-brand-brown-dark outline-none focus:border-brand-teal"
                              />
                              <input
                                type="text"
                                value={settleChequeBank}
                                onChange={(e) => setSettleChequeBank(e.target.value)}
                                placeholder="Bank Name"
                                className="w-full py-1.5 px-2.5 bg-white border border-[#E2D8CC] rounded-xl font-bold text-xs text-brand-brown-dark outline-none focus:border-brand-teal"
                              />
                            </div>
                            <CustomDatePicker
                              value={settleChequeDate}
                              onChange={(v) => setSettleChequeDate(v)}
                              required
                              inputClassName="bg-white border-[#E2D8CC]"
                            />
                          </div>
                        )}

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setIsAddingPayment(false)}
                            className="px-3 py-1.5 rounded-xl border border-[#E2D8CC] bg-white text-text-secondary text-xs font-bold hover:bg-cream-100 transition-all cursor-pointer active:scale-95"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleRecordSettlementPayment}
                            className="px-4 py-1.5 rounded-xl bg-brand-teal hover:bg-brand-teal-dark text-white text-xs font-extrabold shadow-teal transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Confirm Payment</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Paid Records Section (Borderless Clean Line Items with Bottom Border) */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold uppercase text-text-muted tracking-wider block pb-1">
                        Paid Records
                      </label>

                      {effectivePaidCents === 0 ? (
                        <div className="py-2.5 text-center text-xs text-text-muted italic border-b border-[#EAE3DA]">
                          No payments recorded yet (Credit Purchase)
                        </div>
                      ) : (
                        <div className="divide-y divide-[#EAE3DA]">
                          {(viewingPurchase.payments && viewingPurchase.payments.length > 0
                            ? viewingPurchase.payments.filter((p) => p.amountCents > 0)
                            : [
                                ...(cashPaidCents > 0 ? [{ method: 'CASH' as const, amountCents: cashPaidCents }] : []),
                                ...(cardPaidCents > 0 ? [{ method: 'CARD' as const, amountCents: cardPaidCents }] : []),
                                ...(chequePaidCents > 0
                                  ? [{ method: 'CHEQUE' as const, amountCents: chequePaidCents, chequeNumber: chequePayment?.chequeNumber }]
                                  : []),
                              ]
                          ).map((p, idx) => {
                            const pDate = p.timestamp ? new Date(p.timestamp) : new Date(viewingPurchase.purchaseDate);
                            const dateStr = pDate.toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            });
                            const timeStr = pDate.toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,
                            });

                            return (
                              <div
                                key={idx}
                                className="flex items-center justify-between py-2 px-1 hover:bg-cream-50/50 transition-colors"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-xs text-brand-brown-dark">
                                      {p.method === 'CASH' ? 'Cash' : p.method === 'CARD' ? 'Card / Bank' : 'Cheque'}
                                    </span>
                                    {p.method === 'CHEQUE' && p.chequeNumber && (
                                      <span className="text-[10px] text-text-muted font-mono">
                                        #{p.chequeNumber}
                                      </span>
                                    )}
                                    {p.method === 'CHEQUE' && (
                                      p.chequeStatus === 'CLEARED' ? (
                                        <span className="text-[9px] font-black uppercase text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 py-0.2 rounded-full">
                                          Cleared
                                        </span>
                                      ) : (
                                        <span className="text-[9px] font-black uppercase text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded-full">
                                          Pending
                                        </span>
                                      )
                                    )}
                                  </div>
                                  <div className="text-[10px] text-text-muted font-mono mt-0.5">
                                    {dateStr} • {timeStr}
                                  </div>
                                </div>

                                <div className="font-mono font-black text-xs text-brand-brown-dark tabular-nums text-right shrink-0">
                                  {formatLKR(p.amountCents)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Cheque Realization Details if Cheque > 0 */}
                    {chequePayment && (
                      <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-300 space-y-2.5 shrink-0 animate-in fade-in">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-black text-amber-950">
                            <Landmark className="w-3.5 h-3.5 text-amber-700" />
                            <span>Cheque Realization Details</span>
                          </div>
                          {chequePayment.chequeStatus === 'CLEARED' ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-status-success border border-emerald-300 inline-flex items-center gap-1 shadow-2xs">
                              <Check className="w-2.5 h-2.5" />
                              <span>Cleared</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-200/80 text-amber-900 border border-amber-400 inline-flex items-center gap-1 shadow-2xs">
                              <Clock className="w-2.5 h-2.5 text-amber-800" />
                              <span>Pending Clearance</span>
                            </span>
                          )}
                        </div>

                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-text-secondary uppercase font-bold">Cheque Ref:</span>
                            <span className="font-mono font-bold text-brand-brown-dark">{chequePayment.chequeNumber || 'N/A'}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-text-secondary uppercase font-bold">Bank Name:</span>
                            <span className="font-bold text-brand-brown-dark">{chequePayment.bankName || 'N/A'}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-text-secondary uppercase font-bold">Cheque Amount:</span>
                            <span className="font-mono font-black text-brand-brown-dark">{formatLKR(chequePayment.amountCents)}</span>
                          </div>
                          {chequePayment.chequeDate && (
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] text-text-secondary uppercase font-bold">Maturity / Due Date:</span>
                              <span className="font-bold text-amber-900 font-mono">{chequePayment.chequeDate}</span>
                            </div>
                          )}
                          {chequePayment.clearedAt && (
                            <div className="flex justify-between items-center pt-1 border-t border-amber-200/70 text-emerald-800">
                              <span className="text-[10px] uppercase font-bold">Cleared Date:</span>
                              <span className="font-mono font-bold">
                                {new Date(chequePayment.clearedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Action Button: Mark Cheque as Paid / Cleared */}
                        {chequePayment.chequeStatus !== 'CLEARED' && (
                          <div className="pt-2 border-t border-amber-200/80">
                            <button
                              type="button"
                              onClick={() => handleMarkChequeCleared(viewingPurchase.id, chequePayment.chequeNumber)}
                              className="w-full py-2 px-3 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-extrabold text-xs shadow-xs transition-all active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Mark Cheque as Paid / Cleared</span>
                            </button>
                            <p className="text-[9px] text-amber-800 mt-1 text-center font-medium">
                              Click when supplier informs or bank debits money
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Pinned Bottom Financial Settlement Summary Card */}
                  <div className="p-3.5 bg-[#FAF7F2] rounded-2xl border border-[#E2D8CC] space-y-2 shrink-0 text-xs mt-auto">
                    <div className="flex justify-between items-center text-text-secondary">
                      <span>Total Invoiced:</span>
                      <span className="font-mono font-bold text-brand-brown-dark">{formatLKR(viewingPurchase.totalCents)}</span>
                    </div>
                    <div className="flex justify-between items-center font-bold text-brand-teal">
                      <span>Total Paid:</span>
                      <span className="font-mono">{formatLKR(effectivePaidCents)}</span>
                    </div>
                    {effectiveDueCents > 0 && (
                      <>
                        <div className="flex justify-between items-center font-bold text-rose-600 pt-1.5 border-t border-[#E0D7CC]">
                          <span>Remaining Due (Credit):</span>
                          <span className="font-mono text-sm">{formatLKR(effectiveDueCents)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[11px] text-text-secondary">
                          <span className="font-bold uppercase text-[10px] text-text-muted">Due Date / Deadline:</span>
                          <span className="font-mono font-bold text-rose-900 bg-white border border-[#E2D8CC] px-2 py-0.5 rounded-lg text-[11px]">
                            {viewingPurchase.dueDate || 'Pending Schedule'}
                          </span>
                        </div>
                      </>
                    )}
                    {effectiveOverpaidCents > 0 && (
                      <div className="flex justify-between items-center font-bold text-amber-900 bg-amber-100/90 border border-amber-300/80 px-2.5 py-1.5 rounded-xl text-[11px]">
                        <span className="flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                          <span>Overpaid Excess:</span>
                        </span>
                        <span className="font-mono text-xs font-black text-amber-900">
                          +{formatLKR(effectiveOverpaidCents)}
                        </span>
                      </div>
                    )}

                    <div className="pt-1.5 text-center">
                      <span
                        className={`inline-flex items-center justify-center w-full gap-1 py-1 rounded-xl font-black text-[11px] uppercase border ${
                          isPaid
                            ? 'bg-status-success-bg text-status-success border-status-success/30'
                            : effectivePaymentStatus === 'PARTIAL'
                            ? 'bg-status-warning-bg text-status-warning border-status-warning/30'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {isPaid ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Fully Settled (Paid)</span>
                          </>
                        ) : effectivePaymentStatus === 'PARTIAL' ? (
                          <>
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Partial Payment</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3.5 h-3.5" />
                            <span>Unpaid (Supplier Credit)</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* ========================================================================= */}
      {/* 10. MODAL: UNIFIED REVIEW & EDIT STOCK REQUEST (IMAGE 2/3 DESIGN PATTERN) */}
      {/* ========================================================================= */}
      {viewingRequest && (() => {
        const reqIng = ingredients.find(
          (i) => i.id === viewingRequest.ingredientId || i.name.toLowerCase() === viewingRequest.ingredientName.toLowerCase()
        );
        const isPending = viewingRequest.status === 'PENDING_APPROVAL';
        const isDelivery = viewingRequest.type === 'STOCK_DELIVERY';

        const curStock = viewingRequest.currentStock;
        const calculatedFinal = reviewAction === 'ADD'
          ? curStock + reviewQty
          : reviewAction === 'DEDUCT'
          ? Math.max(0, curStock - reviewQty)
          : reviewQty;
        const calculatedDiff = Number((calculatedFinal - curStock).toFixed(2));

        const totalCostCents = viewingRequest.totalCents || viewingRequest.costCents || 0;
        const itemsList: PurchaseItem[] =
          viewingRequest.items && viewingRequest.items.length > 0
            ? viewingRequest.items
            : [
                {
                  ingredientId: viewingRequest.ingredientId || '',
                  ingredientName: viewingRequest.ingredientName,
                  quantity: reviewQty,
                  unit: viewingRequest.unit,
                  unitPriceCents: Math.round((viewingRequest.costCents || 0) / (reviewQty || 1)),
                  totalCents: viewingRequest.costCents || 0,
                  expiryDate: reviewExpiry || viewingRequest.expiryDate,
                },
              ];

        return createPortal(
          <div className="fixed inset-0 z-[99999] w-full h-full bg-black/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-hidden animate-in fade-in">
            <div className="w-full max-w-lg sm:max-w-xl flex flex-col max-h-[92vh]">
              {/* Header above card on dark backdrop (Matching Image 2/3) */}
              <div className="flex items-center justify-between gap-3 mb-3 px-1 shrink-0">
                <div className="min-w-0 flex-1">
                  <h3 className="font-extrabold text-base sm:text-lg text-white drop-shadow-xs truncate">
                    {isDelivery ? 'Record Goods Delivery' : 'Record Stock Adjustment'}
                  </h3>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setViewingRequest(null)}
                    className="px-4 py-2 rounded-full border border-white/30 text-white hover:bg-white/10 text-xs font-bold transition-all whitespace-nowrap cursor-pointer"
                  >
                    Cancel
                  </button>
                  {isPending ? (
                    <button
                      type="button"
                      onClick={() => handleApproveWithEdits()}
                      className="px-5 py-2 rounded-full bg-brand-teal hover:bg-brand-teal-dark text-white font-extrabold text-xs shadow-teal transition-all active:scale-95 whitespace-nowrap cursor-pointer"
                    >
                      Save Adjustment
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setViewingRequest(null)}
                      className="px-5 py-2 rounded-full bg-brand-teal hover:bg-brand-teal-dark text-white font-extrabold text-xs shadow-teal transition-all active:scale-95 whitespace-nowrap cursor-pointer"
                    >
                      Done
                    </button>
                  )}
                </div>
              </div>

              {/* White rounded-3xl card (Matching Image 2/3) */}
              <div className="w-full bg-white rounded-3xl shadow-2xl border border-[#E9E0D5] overflow-y-auto">
                <div className="p-5 sm:p-6 space-y-4">
                  {/* Field 1: RAW INGREDIENT * */}
                  <div>
                    <label className="text-[11px] font-bold uppercase text-text-secondary block mb-1">
                      Raw Ingredient <span className="text-status-danger">*</span>
                    </label>
                    <div className="w-full pb-2 pt-1 bg-transparent border-0 border-b border-[#E2D8CC] text-sm font-bold text-brand-brown-dark flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{viewingRequest.ingredientName}</span>
                        {reqIng?.sku && (
                          <span className="text-[10px] font-mono font-semibold text-text-muted bg-cream-100 px-1.5 py-0.5 rounded">
                            {reqIng.sku}
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-bold text-brand-teal">
                        Current: {viewingRequest.currentStock} {viewingRequest.unit}
                      </span>
                    </div>
                  </div>

                  {/* Field 2: ADJUSTMENT ACTION (Interactive 3 pills matching Image 2/3) */}
                  <div>
                    <label className="text-[11px] font-bold uppercase text-text-secondary block mb-1.5">
                      Adjustment Action
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        disabled={!isPending}
                        onClick={() => setReviewAction('ADD')}
                        className={`py-2 rounded-xl text-xs font-extrabold text-center transition-all border cursor-pointer select-none ${
                          reviewAction === 'ADD'
                            ? 'bg-[#251814] text-white border-[#251814] shadow-xs'
                            : 'bg-[#FAF7F2] text-text-secondary border-[#E0D7CC] hover:bg-cream-100'
                        }`}
                      >
                        + Add Stock
                      </button>
                      <button
                        type="button"
                        disabled={!isPending}
                        onClick={() => setReviewAction('DEDUCT')}
                        className={`py-2 rounded-xl text-xs font-extrabold text-center transition-all border cursor-pointer select-none ${
                          reviewAction === 'DEDUCT'
                            ? 'bg-[#251814] text-white border-[#251814] shadow-xs'
                            : 'bg-[#FAF7F2] text-text-secondary border-[#E0D7CC] hover:bg-cream-100'
                        }`}
                      >
                        - Deduct / Waste
                      </button>
                      <button
                        type="button"
                        disabled={!isPending}
                        onClick={() => setReviewAction('EXACT')}
                        className={`py-2 rounded-xl text-xs font-extrabold text-center transition-all border cursor-pointer select-none ${
                          reviewAction === 'EXACT'
                            ? 'bg-[#251814] text-white border-[#251814] shadow-xs'
                            : 'bg-[#FAF7F2] text-text-secondary border-[#E0D7CC] hover:bg-cream-100'
                        }`}
                      >
                        = Exact Count
                      </button>
                    </div>
                  </div>

                  {/* Field 3: QUANTITY TO ADJUST (Interactive counter matching Image 2/3) */}
                  <div>
                    <label className="text-[11px] font-bold uppercase text-text-secondary block mb-1">
                      Quantity to Adjust ({viewingRequest.unit})
                    </label>
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        type="button"
                        disabled={!isPending}
                        onClick={() => setReviewQty((q) => Math.max(0.01, Number((q - 1).toFixed(2))))}
                        className="w-10 h-10 rounded-2xl bg-[#FAF7F2] hover:bg-cream-200 border border-[#E0D7CC] flex items-center justify-center text-text-muted hover:text-brand-brown-dark font-bold shrink-0 select-none cursor-pointer active:scale-95 transition-all disabled:opacity-50"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        disabled={!isPending}
                        value={reviewQty}
                        onChange={(e) => setReviewQty(parseFloat(e.target.value) || 0)}
                        className="flex-1 h-10 px-3 bg-white border border-[#E2D8CC] rounded-2xl text-center text-base font-black text-brand-brown-dark outline-none focus:border-brand-teal transition-colors disabled:bg-cream-50"
                      />
                      <button
                        type="button"
                        disabled={!isPending}
                        onClick={() => setReviewQty((q) => Number((q + 1).toFixed(2)))}
                        className="w-10 h-10 rounded-2xl bg-[#FAF7F2] hover:bg-cream-200 border border-[#E0D7CC] flex items-center justify-center text-text-muted hover:text-brand-brown-dark font-bold shrink-0 select-none cursor-pointer active:scale-95 transition-all disabled:opacity-50"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Stock Transition Details */}
                    <div className="flex items-center justify-between text-xs font-bold text-text-secondary pt-1.5 px-0.5">
                      <span>
                        Stock change: {curStock} {viewingRequest.unit} →{' '}
                        <strong className="text-brand-brown-deep font-black">
                          {calculatedFinal} {viewingRequest.unit}
                        </strong>
                      </span>
                      <span
                        className={
                          calculatedDiff >= 0
                            ? 'text-status-success font-black'
                            : 'text-status-danger font-black'
                        }
                      >
                        ({calculatedDiff >= 0 ? `+${calculatedDiff}` : calculatedDiff}{' '}
                        {viewingRequest.unit})
                      </span>
                    </div>
                  </div>

                  {/* Field 4: EXPIRY DATE (Directly Editable inside this modal) */}
                  <div>
                    <label className="text-[11px] font-bold uppercase text-text-secondary block mb-1">
                      Expiry Date (Optional)
                    </label>
                    <input
                      type="date"
                      disabled={!isPending}
                      value={reviewExpiry}
                      onChange={(e) => setReviewExpiry(e.target.value)}
                      className="w-full pb-2 pt-1 bg-transparent border-0 border-b border-[#E2D8CC] text-xs font-mono font-bold text-brand-brown-dark focus:outline-none focus:border-brand-teal rounded-none transition-colors cursor-pointer disabled:text-text-muted"
                    />
                  </div>

                  {/* Field 5 (If Delivery): Total Invoice Cost (Rs.) */}
                  {isDelivery && (
                    <div>
                      <label className="text-[11px] font-bold uppercase text-text-secondary block mb-1">
                        Total Invoice Cost (Rs.)
                      </label>
                      <input
                        type="number"
                        step="any"
                        disabled={!isPending}
                        value={reviewCost}
                        onChange={(e) => setReviewCost(e.target.value)}
                        placeholder="e.g. 5000.00"
                        className="w-full pb-2 pt-1 bg-transparent border-0 border-b border-[#E2D8CC] text-xs font-mono font-bold text-brand-brown-dark focus:outline-none focus:border-brand-teal rounded-none transition-colors disabled:text-text-muted"
                      />
                    </div>
                  )}

                  {/* Field 6: AUDIT REASON / NOTE * */}
                  <div>
                    <label className="text-[11px] font-bold uppercase text-text-secondary block mb-1">
                      Audit Reason / Note <span className="text-status-danger">*</span>
                    </label>
                    <input
                      type="text"
                      disabled={!isPending}
                      value={reviewReason}
                      onChange={(e) => setReviewReason(e.target.value)}
                      placeholder="Audit reason or note..."
                      className="w-full pb-2 pt-1 bg-transparent border-0 border-b border-[#E2D8CC] text-xs font-bold text-brand-brown-dark focus:outline-none focus:border-brand-teal rounded-none transition-colors disabled:text-text-muted"
                    />
                    <div className="flex items-center justify-between text-[11px] text-text-muted pt-1 px-0.5">
                      <span>
                        Submitted by: <strong className="text-brand-brown-dark">{viewingRequest.requestedByUserName}</strong>
                      </span>
                      <span className="font-mono">{format(new Date(viewingRequest.createdAt), 'hh:mm a • dd MMM yyyy')}</span>
                    </div>
                  </div>

                  {/* If Delivery Intake (Supplier / Invoice details) */}
                  {isDelivery && itemsList.length > 0 && (
                    <div className="p-3.5 bg-amber-50/60 rounded-2xl border border-amber-200/80 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-950 uppercase text-[10px] tracking-wider">
                          Delivery Line Items ({itemsList.length})
                        </span>
                        <span className="font-mono font-black text-brand-brown-deep">{formatLKR(totalCostCents)}</span>
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {itemsList.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between items-center text-[11px] bg-white/80 p-1.5 rounded-lg border border-amber-200/50"
                          >
                            <span className="font-bold text-brand-brown-dark">{item.ingredientName}</span>
                            <span className="font-mono">
                              {item.quantity} {item.unit} • {formatLKR(item.totalCents)}
                            </span>
                          </div>
                        ))}
                      </div>
                      {viewingRequest.supplierName && (
                        <div className="text-[11px] text-text-secondary pt-1 border-t border-amber-200/60 flex justify-between">
                          <span>
                            Supplier: <strong>{viewingRequest.supplierName}</strong>
                          </span>
                          {viewingRequest.invoiceNumber && (
                            <span>
                              Inv #: <strong>{viewingRequest.invoiceNumber}</strong>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Rejection Note if already rejected */}
                  {viewingRequest.rejectionReason && (
                    <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200 text-xs text-rose-800">
                      <span className="font-bold block mb-0.5">Rejection Reason:</span>
                      {viewingRequest.rejectionReason}
                    </div>
                  )}

                  {/* Bottom Action Footer inside card */}
                  <div className="pt-3 border-t border-[#EAE3DA] flex items-center justify-between gap-2">
                    {isPending ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            const r = viewingRequest;
                            setViewingRequest(null);
                            handleRejectStockRequest(r);
                          }}
                          className="px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all cursor-pointer"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApproveWithEdits()}
                          className="px-5 py-2 rounded-xl bg-brand-teal hover:bg-brand-teal-dark text-white font-black text-xs shadow-teal transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve Request</span>
                        </button>
                      </>
                    ) : (
                      <div className="w-full flex justify-end">
                        <button
                          type="button"
                          onClick={() => setViewingRequest(null)}
                          className="px-5 py-2 rounded-xl bg-brand-teal hover:bg-brand-teal-dark text-white font-black text-xs shadow-teal cursor-pointer"
                        >
                          Close
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}
    </div>
  );
};
