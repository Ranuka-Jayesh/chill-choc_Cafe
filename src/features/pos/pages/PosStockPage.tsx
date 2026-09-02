import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { db } from '@/services/storage/db';
import { inventoryService } from '@/services/inventoryService';
import { catalogService } from '@/services/catalogService';
import { authService } from '@/services/authService';
import { shiftService } from '@/services/shiftService';
import { realtimeSocketService } from '@/services/realtimeSocketService';
import {
  Ingredient,
  InventoryMovement,
  Purchase,
  PurchaseItem,
  Supplier,
  StockRequest,
  PurchasePaymentSplit,
  PurchasePaymentMethod,
  PurchasePaymentStatus,
} from '@/types';
import { formatLKR, formatDateTime } from '@/utils/format';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { CustomSelect, SelectOption } from '@/components/ui/CustomSelect';
import { MonthYearPicker, MonthYearValue } from '@/components/ui/MonthYearPicker';
import { CustomDatePicker } from '@/components/ui/CustomDatePicker';
import {
  Boxes,
  Truck,
  Plus,
  Minus,
  SlidersHorizontal,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  Search,
  Building2,
  Calendar,
  Layers,
  ArrowUpDown,
  History,
  Package,
  Wallet,
  CreditCard,
  Banknote,
  FileText,
  Check,
  X,
  Trash2,
  Eye,
  Landmark,
  RotateCcw,
  Copy,
} from 'lucide-react';

type PosStockTab = 'stock' | 'movements' | 'purchases' | 'requests';
type StockStatusFilter = 'ALL' | 'OPTIMAL' | 'LOW' | 'NEAR_EXPIRY' | 'OUT';

const STOCK_STATUS_OPTIONS: SelectOption[] = [
  { value: 'ALL', label: 'All Stock Levels' },
  { value: 'NEAR_EXPIRY', label: 'Near Expiry (≤7d)' },
  { value: 'OPTIMAL', label: 'Optimal Stock' },
  { value: 'LOW', label: 'Low Stock (< Reorder)' },
  { value: 'OUT', label: 'Out of Stock (0)' },
];

export const PosStockPage: React.FC = () => {
  const navigate = useNavigate();
  const session = authService.getCurrentSession();
  const currentCashier = session?.user;
  const activeShift = shiftService.getActiveShift();

  const [ingredients, setIngredients] = useState<Ingredient[]>(inventoryService.getIngredients());
  const [movements, setMovements] = useState<InventoryMovement[]>(inventoryService.getMovements());
  const [purchases, setPurchases] = useState<Purchase[]>(catalogService.getPurchases());
  const [suppliers, setSuppliers] = useState<Supplier[]>(catalogService.getSuppliers());
  const [stockRequests, setStockRequests] = useState<StockRequest[]>(inventoryService.getStockRequests());

  const [activeTab, setActiveTab] = useState<PosStockTab>('stock');
  const [search, setSearch] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [stockStatusFilter, setStockStatusFilter] = useState<StockStatusFilter>('ALL');

  const now = new Date();
  const [dateRange, setDateRange] = useState<MonthYearValue>({
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1),
  });

  // Live Clock
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Modals state
  const [editingIngredient, setEditingIngredient] = useState<Partial<Ingredient> | null>(null);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [isSpecificIngredientAdjust, setIsSpecificIngredientAdjust] = useState(false);
  const [adjustIngredientId, setAdjustIngredientId] = useState<string>('');
  const [adjustType, setAdjustType] = useState<'ADD' | 'DEDUCT' | 'EXACT'>('ADD');
  const [adjustQuantity, setAdjustQuantity] = useState<number>(1);
  const [adjustReason, setAdjustReason] = useState<string>('Physical stock inventory audit');

  const selectedAdjustIng = useMemo(
    () => ingredients.find((i) => i.id === adjustIngredientId) || ingredients[0],
    [ingredients, adjustIngredientId]
  );

  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [vendorName, setVendorName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${Date.now().toString().slice(-4)}`);
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [purchaseNotes, setPurchaseNotes] = useState<string>('');

  // Payment Breakdown in Receive Modal
  const [cashAmount, setCashAmount] = useState<string>('');
  const [cardAmount, setCardAmount] = useState<string>('');
  const [chequeAmount, setChequeAmount] = useState<string>('');
  const [chequeNumber, setChequeNumber] = useState<string>('');
  const [chequeBank, setChequeBank] = useState<string>('');
  const [chequeDate, setChequeDate] = useState<string>('');
  const [duePaymentDate, setDuePaymentDate] = useState<string>('');

  // Floating Search inside Receive Stock modal
  const [modalSearch, setModalSearch] = useState<string>('');
  const [isModalSearchFocused, setIsModalSearchFocused] = useState<boolean>(false);

  // View Purchase modal
  const [viewingPurchase, setViewingPurchase] = useState<Purchase | null>(null);
  // View Request Details modal
  const [viewingRequest, setViewingRequest] = useState<StockRequest | null>(null);

  // Active Suppliers Memo
  const activeSuppliers = useMemo(() => suppliers.filter((s) => s.active !== false), [suppliers]);

  // Ingredients available according to selected supplier
  const availableIngredients = useMemo(() => {
    if (!selectedSupplierId) return ingredients;
    const sup = suppliers.find((s) => s.id === selectedSupplierId);
    if (!sup) return ingredients;

    const linkedIngs = ingredients.filter((i) => i.supplierId === sup.id);
    return linkedIngs.length > 0 ? linkedIngs : ingredients;
  }, [selectedSupplierId, suppliers, ingredients]);

  // Sync with database updates & realtime socket events
  useEffect(() => {
    const unsubscribe = db.subscribe(() => {
      setIngredients(inventoryService.getIngredients());
      setMovements(inventoryService.getMovements());
      setPurchases(catalogService.getPurchases());
      setSuppliers(catalogService.getSuppliers());
      setStockRequests(inventoryService.getStockRequests());
    });

    const handleRealtime = () => {
      setIngredients(inventoryService.getIngredients());
      setMovements(inventoryService.getMovements());
      setPurchases(catalogService.getPurchases());
      setSuppliers(catalogService.getSuppliers());
      setStockRequests(inventoryService.getStockRequests());
    };

    const unsub1 = realtimeSocketService.on('STOCK_CHANGED', handleRealtime);
    const unsub2 = realtimeSocketService.on('STOCK_REQUEST_PENDING', handleRealtime);
    const unsub3 = realtimeSocketService.on('STOCK_REQUEST_APPROVED', handleRealtime);
    const unsub4 = realtimeSocketService.on('STOCK_REQUEST_REJECTED', handleRealtime);

    return () => {
      unsubscribe();
      unsub1();
      unsub2();
      unsub3();
      unsub4();
    };
  }, []);

  // Status helper
  const getIngredientStatus = (ing: Ingredient) => {
    if (ing.currentStock <= 0) return { label: 'OUT OF STOCK', style: 'bg-rose-100 text-rose-800 border-rose-300' };
    if (ing.currentStock <= ing.reorderLevel) return { label: 'LOW STOCK', style: 'bg-amber-100 text-amber-800 border-amber-300' };

    if (ing.expiryDate) {
      const exp = new Date(ing.expiryDate);
      const now = new Date();
      const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 7 && diffDays >= 0) return { label: 'NEAR EXPIRY', style: 'bg-amber-50 text-amber-800 border-amber-300' };
    }

    return { label: 'IN STOCK', style: 'bg-teal-50 text-brand-teal-dark border-teal-200' };
  };

  // Filtered ingredients
  const filteredIngredients = useMemo(() => {
    return ingredients.filter((ing) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = ing.name.toLowerCase().includes(q);
        const matchSku = ing.sku.toLowerCase().includes(q);
        if (!matchName && !matchSku) return false;
      }

      if (stockStatusFilter !== 'ALL') {
        const status = getIngredientStatus(ing);
        if (stockStatusFilter === 'OUT' && status.label !== 'OUT OF STOCK') return false;
        if (stockStatusFilter === 'LOW' && status.label !== 'LOW STOCK') return false;
        if (stockStatusFilter === 'NEAR_EXPIRY' && status.label !== 'NEAR EXPIRY') return false;
        if (stockStatusFilter === 'OPTIMAL' && status.label !== 'IN STOCK') return false;
      }

      return true;
    });
  }, [ingredients, search, stockStatusFilter]);

  // Filtered Movements
  const filteredMovements = useMemo(() => {
    return movements.filter((mov) => {
      if (dateRange.year !== 'ALL') {
        const mDate = new Date(mov.timestamp);
        if (String(mDate.getFullYear()) !== dateRange.year) return false;
        if (dateRange.month !== 'ALL' && String(mDate.getMonth() + 1) !== dateRange.month) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchIng = mov.ingredientName.toLowerCase().includes(q);
        const matchReason = mov.reason?.toLowerCase().includes(q);
        if (!matchIng && !matchReason) return false;
      }
      return true;
    });
  }, [movements, search, dateRange]);

  // Filtered Purchases
  const filteredPurchases = useMemo(() => {
    return purchases.filter((po) => {
      if (dateRange.year !== 'ALL') {
        const pDate = new Date(po.purchaseDate);
        if (String(pDate.getFullYear()) !== dateRange.year) return false;
        if (dateRange.month !== 'ALL' && String(pDate.getMonth() + 1) !== dateRange.month) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchSup = po.supplierName.toLowerCase().includes(q);
        const matchPo = po.purchaseNumber.toLowerCase().includes(q);
        const matchInv = po.invoiceNumber.toLowerCase().includes(q);
        if (!matchSup && !matchPo && !matchInv) return false;
      }
      return true;
    });
  }, [purchases, search, dateRange]);

  // Filtered Requests
  const filteredRequests = useMemo(() => {
    return stockRequests.filter((req) => {
      if (dateRange.year !== 'ALL') {
        const rDate = new Date(req.createdAt);
        if (String(rDate.getFullYear()) !== dateRange.year) return false;
        if (dateRange.month !== 'ALL' && String(rDate.getMonth() + 1) !== dateRange.month) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchIng = req.ingredientName.toLowerCase().includes(q);
        const matchReq = req.requestNumber.toLowerCase().includes(q);
        const matchReason = req.reason.toLowerCase().includes(q);
        if (!matchIng && !matchReq && !matchReason) return false;
      }
      return true;
    });
  }, [stockRequests, search, dateRange]);

  // Search Results for Receive Modal Floating Search
  const modalSearchResults = useMemo(() => {
    if (!modalSearch.trim()) return [];
    const q = modalSearch.toLowerCase();
    const list = availableIngredients.length > 0 ? availableIngredients : ingredients;
    return list
      .filter((ing) => ing.name.toLowerCase().includes(q) || ing.sku.toLowerCase().includes(q))
      .slice(0, 8);
  }, [modalSearch, availableIngredients, ingredients]);

  // Metrics
  const lowStockCount = useMemo(() => {
    return ingredients.filter((i) => i.currentStock > 0 && i.currentStock <= i.reorderLevel).length;
  }, [ingredients]);

  const nearExpiryCount = useMemo(() => {
    const now = new Date();
    return ingredients.filter((i) => {
      if (!i.expiryDate) return false;
      const exp = new Date(i.expiryDate);
      const diff = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return diff <= 7 && diff >= 0;
    }).length;
  }, [ingredients]);

  const pendingRequestsCount = useMemo(() => {
    return stockRequests.filter((r) => r.status === 'PENDING_APPROVAL').length;
  }, [stockRequests]);

  // Handlers for Add / Edit Ingredient
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

    toast.success(`Ingredient "${editingIngredient.name}" created successfully.`);
    setEditingIngredient(null);
    setIngredients(inventoryService.getIngredients());
  };

  // Handlers for Stock Adjustment
  const handleOpenAdjust = (ing?: Ingredient) => {
    if (ing) {
      setAdjustIngredientId(ing.id);
      setIsSpecificIngredientAdjust(true);
    } else {
      setAdjustIngredientId(ingredients[0]?.id || '');
      setIsSpecificIngredientAdjust(false);
    }
    setAdjustType('ADD');
    setAdjustQuantity(1);
    setAdjustReason('Physical stock inventory audit');
    setIsAdjustModalOpen(true);
  };

  const handleSubmitAdjust = (e: React.FormEvent) => {
    e.preventDefault();
    const targetIng = ingredients.find((i) => i.id === adjustIngredientId) || selectedAdjustIng;
    if (!targetIng) {
      toast.error('Please select an ingredient to adjust.');
      return;
    }

    if (isNaN(adjustQuantity) || adjustQuantity <= 0) {
      toast.error('Please enter a valid adjustment quantity.');
      return;
    }

    let finalNewStock = targetIng.currentStock;
    if (adjustType === 'ADD') {
      finalNewStock = Number((targetIng.currentStock + adjustQuantity).toFixed(2));
    } else if (adjustType === 'DEDUCT') {
      finalNewStock = Math.max(0, Number((targetIng.currentStock - adjustQuantity).toFixed(2)));
    } else {
      finalNewStock = Number(adjustQuantity.toFixed(2));
    }

    const actionText =
      adjustType === 'ADD'
        ? `(+${adjustQuantity} ${targetIng.unit})`
        : adjustType === 'DEDUCT'
        ? `(-${adjustQuantity} ${targetIng.unit})`
        : `(Count = ${adjustQuantity} ${targetIng.unit})`;

    try {
      inventoryService.requestStockAdjustment({
        ingredientId: targetIng.id,
        ingredientName: targetIng.name,
        currentStock: targetIng.currentStock,
        requestedStock: finalNewStock,
        unit: targetIng.unit,
        reason: `${adjustReason.trim() || 'Physical inventory audit'} ${actionText}`,
        userId: currentCashier?.id || 'cashier',
        userName: currentCashier?.name || 'Cashier',
      });

      toast.success(
        `Adjustment request for "${targetIng.name}" sent to Admin for authorization!`,
        { duration: 4000 }
      );
      setIsAdjustModalOpen(false);
      setActiveTab('requests');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit adjustment request');
    }
  };

  // Handlers for Receive Stock / Purchase
  const handleOpenReceiveModal = () => {
    setSuppliers(catalogService.getSuppliers());
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
    setModalSearch('');
    setIsReceiveModalOpen(true);
  };

  const handleAddPurchaseItem = () => {
    const list = availableIngredients.length > 0 ? availableIngredients : ingredients;
    const first = list[0];
    if (!first) {
      toast.error('No ingredients available.');
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

  const handleAddSearchedModalItem = (ing: Ingredient) => {
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
    setModalSearch('');
    setIsModalSearchFocused(false);
    toast.success(`Added "${ing.name}" to received items.`);
  };

  const handleUpdatePurchaseItem = (index: number, updates: Partial<PurchaseItem>) => {
    setPurchaseItems((prev) => {
      const next = [...prev];
      const item = { ...next[index], ...updates };

      if (updates.ingredientId) {
        const list = availableIngredients.length > 0 ? availableIngredients : ingredients;
        const found = list.find((i) => i.id === updates.ingredientId);
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

  const totalInvoicedCents = useMemo(() => {
    return purchaseItems.reduce((sum, item) => sum + item.totalCents, 0);
  }, [purchaseItems]);

  const numCash = parseFloat(cashAmount) || 0;
  const numCard = parseFloat(cardAmount) || 0;
  const numCheque = parseFloat(chequeAmount) || 0;
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
    const totalAmount = totalInvoicedCents / 100;
    if (method === 'UNPAID') {
      setCashAmount('');
      setCardAmount('');
      setChequeAmount('');
      setChequeNumber('');
      setChequeBank('');
      setChequeDate('');
      return;
    }
    if (method === 'CASH') {
      setCashAmount(totalAmount > 0 ? String(totalAmount) : '');
      setCardAmount('');
      setChequeAmount('');
    } else if (method === 'CARD') {
      setCardAmount(totalAmount > 0 ? String(totalAmount) : '');
      setCashAmount('');
      setChequeAmount('');
    } else if (method === 'CHEQUE') {
      setChequeAmount(totalAmount > 0 ? String(totalAmount) : '');
      setCashAmount('');
      setCardAmount('');
      if (!chequeDate) {
        const defaultRealization = new Date();
        defaultRealization.setDate(defaultRealization.getDate() + 30);
        setChequeDate(defaultRealization.toISOString().split('T')[0]);
      }
    }
  };

  // Submit Goods Inward as Request to Admin
  const handleSavePurchaseRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (purchaseItems.length === 0) {
      toast.error('Please add at least one line item to receive.');
      return;
    }

    if (numCheque > 0) {
      if (!chequeNumber.trim()) {
        toast.error('Please provide Cheque Reference / Number.');
        return;
      }
      if (!chequeBank.trim()) {
        toast.error('Please provide Bank Name for Cheque.');
        return;
      }
      if (!chequeDate) {
        toast.error('Please select Cheque Realization Date.');
        return;
      }
    }

    if (balanceDueCents > 0 && totalInvoicedCents > 0 && !duePaymentDate) {
      toast.error('Please select a Settlement Due Date for remaining credit balance.');
      return;
    }

    const sup = suppliers.find((s) => s.id === selectedSupplierId);
    const supplierName = sup ? sup.name : vendorName.trim() || 'Direct Supplier';

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
        chequeDate,
        timestamp: nowISO,
      });
    }

    try {
      inventoryService.requestStockDelivery({
        supplierId: selectedSupplierId || undefined,
        supplierName,
        invoiceNumber: invoiceNumber.trim() || `INV-${Date.now().toString().slice(-4)}`,
        items: purchaseItems,
        totalCents: totalInvoicedCents,
        paidCents: totalPaidCents,
        dueCents: balanceDueCents,
        paymentStatus,
        payments,
        duePaymentDate: balanceDueCents > 0 ? duePaymentDate : undefined,
        notes: purchaseNotes.trim() || undefined,
        reason: purchaseNotes.trim() || `Goods Inward Intake (${purchaseItems.length} lines from ${supplierName})`,
        userId: currentCashier?.id || 'cashier',
        userName: currentCashier?.name || 'Cashier',
      });

      toast.success(
        `Delivery intake request (${purchaseItems.length} items - ${formatLKR(totalInvoicedCents)}) submitted for Admin approval!`,
        { duration: 4500 }
      );
      setIsReceiveModalOpen(false);
      setActiveTab('requests');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit delivery intake request');
    }
  };

  return (
    <div className="h-screen w-screen bg-[#FAF7F2] text-brand-brown-deep flex flex-col overflow-hidden font-sans select-none relative">
      {/* 1. TOP HEADER BAR */}
      <header className="h-16 px-4 sm:px-6 bg-white border-b border-[#E9E0D5] flex items-center justify-between shrink-0 shadow-2xs z-20">
        <div className="flex items-center gap-2.5">
          <BrandLogo size="sm" />
          <div className="hidden md:flex flex-col">
            <span className="text-xs font-black text-brand-brown-deep tracking-tight">Stock & Purchases</span>
            <span className="text-[10px] text-text-muted font-bold">Cashier Goods Intake & Audit Portal</span>
          </div>
        </div>

        {/* Center Live Clock */}
        <div className="hidden lg:flex items-center gap-2 text-xs font-bold text-text-secondary bg-cream-50 px-3.5 py-1.5 rounded-full border border-[#E0D7CC]/60">
          <Clock className="w-3.5 h-3.5 text-brand-teal" />
          <span>{format(currentTime, 'EEE, dd MMM yyyy • hh:mm:ss a')}</span>
        </div>

        {/* Right Cashier Info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-cream-50 px-3 py-1.5 rounded-xl border border-[#E0D7CC]">
            <div className="w-6 h-6 rounded-full bg-brand-teal/20 text-brand-teal font-black text-xs flex items-center justify-center">
              {currentCashier?.name?.charAt(0) || 'C'}
            </div>
            <div className="flex flex-col text-left">
              <span className="text-[11px] font-black text-brand-brown-deep leading-tight">
                {currentCashier?.name || 'Cashier'}
              </span>
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-brand-teal">
                {activeShift ? `Shift #${activeShift.shiftNumber}` : 'POS Terminal'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* 2. SUB-HEADER METRIC TILES */}
      <div className="px-4 sm:px-6 py-3 bg-white/70 border-b border-[#E9E0D5]/80 shrink-0">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          {/* Card 1: Total Stock */}
          <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-[#E9E0D5] shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted block">
                Total Ingredients
              </span>
              <span className="text-lg sm:text-xl font-black text-brand-brown-deep tabular-nums">
                {ingredients.length} items
              </span>
            </div>
            <div className="w-8 h-8 rounded-xl bg-cream-100 flex items-center justify-center text-brand-brown shrink-0">
              <Boxes className="w-4 h-4" />
            </div>
          </div>

          {/* Card 2: Low Stock */}
          <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-[#E9E0D5] shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted block">
                Low Stock
              </span>
              <span
                className={`text-lg sm:text-xl font-black tabular-nums ${
                  lowStockCount > 0 ? 'text-amber-800' : 'text-brand-teal'
                }`}
              >
                {lowStockCount} items
              </span>
            </div>
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                lowStockCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-teal-50 text-brand-teal'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>

          {/* Card 3: Near Expiry */}
          <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-[#E9E0D5] shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted block">
                Near Expiry (7d)
              </span>
              <span
                className={`text-lg sm:text-xl font-black tabular-nums ${
                  nearExpiryCount > 0 ? 'text-amber-800' : 'text-brand-brown-deep'
                }`}
              >
                {nearExpiryCount} items
              </span>
            </div>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
          </div>

          {/* Card 4: Pending Approval */}
          <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-[#E9E0D5] shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted block">
                Pending Approval
              </span>
              <span
                className={`text-lg sm:text-xl font-black tabular-nums ${
                  pendingRequestsCount > 0 ? 'text-amber-800 animate-pulse' : 'text-text-muted'
                }`}
              >
                {pendingRequestsCount} requests
              </span>
            </div>
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                pendingRequestsCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-cream-100 text-text-muted'
              }`}
            >
              <Clock className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* 3. UNIFIED TAB BAR & FILTERS */}
      <div className="px-4 sm:px-6 pt-3 pb-1 flex flex-wrap items-center justify-between gap-3 shrink-0">
        {/* Unified Tab Bar */}
        <div className="inline-flex items-center p-1 h-11 bg-white border border-[#E0D7CC] rounded-full shadow-xs overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => {
              setActiveTab('stock');
              setSearch('');
            }}
            className={`h-full flex items-center gap-2.5 px-4 py-2 rounded-full text-xs sm:text-[13px] font-black transition-all cursor-pointer select-none whitespace-nowrap ${
              activeTab === 'stock'
                ? 'bg-brand-teal text-white shadow-xs'
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
              {ingredients.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('movements');
              setSearch('');
            }}
            className={`h-full flex items-center gap-2.5 px-4 py-2 rounded-full text-xs sm:text-[13px] font-black transition-all cursor-pointer select-none whitespace-nowrap ${
              activeTab === 'movements'
                ? 'bg-brand-teal text-white shadow-xs'
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
            onClick={() => {
              setActiveTab('purchases');
              setSearch('');
            }}
            className={`h-full flex items-center gap-2.5 px-4 py-2 rounded-full text-xs sm:text-[13px] font-black transition-all cursor-pointer select-none whitespace-nowrap ${
              activeTab === 'purchases'
                ? 'bg-brand-teal text-white shadow-xs'
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
              {purchases.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('requests');
              setSearch('');
            }}
            className={`h-full flex items-center gap-2.5 px-4 py-2 rounded-full text-xs sm:text-[13px] font-black transition-all cursor-pointer select-none whitespace-nowrap ${
              activeTab === 'requests'
                ? 'bg-brand-teal text-white shadow-xs'
                : 'text-brand-brown hover:text-brand-brown-deep hover:bg-cream-50'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>My Requests</span>
            {pendingRequestsCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-600 text-white text-[10px] font-black">
                {pendingRequestsCount}
              </span>
            )}
          </button>
        </div>

        {/* Right Action / Filter Bar */}
        <div className="flex items-center gap-2">
          {activeTab === 'stock' && (
            <div className="w-auto min-w-[165px] sm:min-w-[185px]">
              <CustomSelect
                value={stockStatusFilter}
                onChange={(val) => setStockStatusFilter(val as StockStatusFilter)}
                options={STOCK_STATUS_OPTIONS}
                align="right"
                buttonClassName="h-9 !py-0 px-3.5 bg-[#FAF7F2] hover:bg-cream-100 border-[#E0D7CC] rounded-full text-xs font-bold text-brand-brown-dark shadow-xs"
              />
            </div>
          )}

          {(activeTab === 'movements' || activeTab === 'purchases' || activeTab === 'requests') && (
            <MonthYearPicker value={dateRange} onChange={(newVal) => setDateRange(newVal)} />
          )}
        </div>
      </div>

      {/* 4. MAIN DATA TABLE AREA */}
      <div className="flex-1 min-h-0 px-4 sm:px-6 pb-2 pt-1 flex flex-col">
        {/* TAB 1: INGREDIENTS & STOCK */}
        {activeTab === 'stock' && (
          <div className="flex-1 min-h-0 bg-white rounded-2xl border border-[#E9E0D5] shadow-xs overflow-hidden flex flex-col mb-1">
            <div className="flex-1 overflow-auto min-h-0 pb-20">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-[#FAF7F2]/95 backdrop-blur-xs z-10 shadow-2xs">
                  <tr className="border-b border-[#EAE3DA] text-text-muted font-black uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Ingredient Name</th>
                    <th className="py-3 px-4">SKU Code</th>
                    <th className="py-3 px-4">Expire Date</th>
                    <th className="py-3 px-4">Current Stock</th>
                    <th className="py-3 px-4">Reorder Level</th>
                    <th className="py-3 px-4">Avg Cost</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
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
                      const status = getIngredientStatus(ing);
                      return (
                        <tr key={ing.id} className="hover:bg-[#FAF7F2]/60 transition-colors">
                          <td className="py-3 px-4 font-black text-brand-brown-deep">{ing.name}</td>
                          <td className="py-3 px-4 text-text-secondary font-mono text-[11px]">{ing.sku}</td>
                          <td className="py-3 px-4 text-text-secondary">
                            {ing.expiryDate ? (
                              <span
                                className={`px-2 py-0.5 rounded-md text-[11px] font-mono border ${
                                  status.label === 'NEAR EXPIRY'
                                    ? 'bg-amber-50 text-amber-900 border-amber-300 font-bold'
                                    : 'bg-cream-50 border-[#E0D7CC]/60'
                                }`}
                              >
                                {ing.expiryDate}
                              </span>
                            ) : (
                              <span className="text-text-muted text-[11px]">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-black text-sm text-brand-brown-deep tabular-nums">
                            {ing.currentStock} <span className="text-[11px] font-bold text-text-muted">{ing.unit}</span>
                          </td>
                          <td className="py-3 px-4 text-text-secondary font-semibold tabular-nums">
                            {ing.reorderLevel} {ing.unit}
                          </td>
                          <td className="py-3 px-4 text-brand-brown-dark font-bold tabular-nums">
                            {formatLKR(ing.averageCostCents || 0)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2.5 py-0.5 rounded-full font-black text-[9px] uppercase border inline-flex items-center gap-1 ${status.style}`}
                            >
                              {status.label}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleOpenAdjust(ing)}
                              className="px-3 py-1 rounded-xl bg-cream-50 hover:bg-cream-100 hover:text-brand-teal border border-[#E0D7CC] text-brand-brown-dark font-black text-xs transition-all active:scale-95 cursor-pointer inline-flex items-center gap-1.5"
                              title="Request Stock Adjustment"
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5 text-brand-teal" />
                              <span>Adjust</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: STOCK MOVEMENTS */}
        {activeTab === 'movements' && (
          <div className="flex-1 min-h-0 bg-white rounded-2xl border border-[#E9E0D5] shadow-xs overflow-hidden flex flex-col mb-1">
            <div className="flex-1 overflow-auto min-h-0 pb-20">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-[#FAF7F2]/95 backdrop-blur-xs z-10 shadow-2xs">
                  <tr className="border-b border-[#EAE3DA] text-text-muted font-black uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Ingredient</th>
                    <th className="py-3 px-4 text-right">Quantity</th>
                    <th className="py-3 px-4 text-right">Cost (LKR)</th>
                    <th className="py-3 px-4">Reason / Notes</th>
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
                    filteredMovements.map((mov) => {
                      const isPositive = mov.quantity > 0;
                      return (
                        <tr key={mov.id} className="hover:bg-[#FAF7F2]/60 transition-colors">
                          <td className="py-3 px-4 text-text-secondary whitespace-nowrap">
                            {formatDateTime(mov.timestamp)}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full font-black text-[10px] uppercase border bg-cream-50 text-brand-brown-dark border-[#E0D7CC]">
                              {mov.type.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-black text-brand-brown-deep">{mov.ingredientName}</td>
                          <td
                            className={`py-3 px-4 text-right font-black tabular-nums ${
                              isPositive ? 'text-status-success' : 'text-status-danger'
                            }`}
                          >
                            {isPositive ? `+${mov.quantity}` : mov.quantity} {mov.unit}
                          </td>
                          <td className="py-3 px-4 text-right text-brand-brown-dark font-bold tabular-nums">
                            {formatLKR(mov.costCents || 0)}
                          </td>
                          <td className="py-3 px-4 text-text-secondary max-w-sm truncate">{mov.reason || '—'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: PURCHASES (PO) */}
        {activeTab === 'purchases' && (
          <div className="flex-1 min-h-0 bg-white rounded-2xl border border-[#E9E0D5] shadow-xs overflow-hidden flex flex-col mb-1">
            <div className="flex-1 overflow-auto min-h-0 pb-20">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-[#FAF7F2]/95 backdrop-blur-xs z-10 shadow-2xs">
                  <tr className="border-b border-[#EAE3DA] text-text-muted font-black uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">PO #</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-center">Items</th>
                    <th className="py-3 px-4 text-right">Total (LKR)</th>
                    <th className="py-3 px-4 text-center">Payment Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2ECE4] font-medium">
                  {filteredPurchases.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-20 text-text-muted">
                        <Truck className="w-9 h-9 mx-auto mb-2 text-text-muted/40" />
                        <div className="font-semibold text-xs text-text-secondary">No purchase orders found.</div>
                      </td>
                    </tr>
                  ) : (
                    filteredPurchases.map((po) => {
                      const isPaid = po.paymentStatus === 'PAID';
                      return (
                        <tr key={po.id} className="hover:bg-[#FAF7F2]/60 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-brand-teal">{po.purchaseNumber}</td>
                          <td className="py-3 px-4 font-black text-brand-brown-deep">{po.supplierName}</td>
                          <td className="py-3 px-4 font-mono text-text-secondary">{po.invoiceNumber}</td>
                          <td className="py-3 px-4 text-text-secondary whitespace-nowrap">
                            {formatDateTime(po.purchaseDate)}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-brand-brown-dark">
                            {po.items.length} lines
                          </td>
                          <td className="py-3 px-4 text-right font-black text-brand-brown-deep tabular-nums">
                            {formatLKR(po.totalCents)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase border ${
                                isPaid
                                  ? 'bg-status-success-bg text-status-success border-status-success/30'
                                  : 'bg-amber-100 text-amber-800 border-amber-300'
                              }`}
                            >
                              {po.paymentStatus}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => setViewingPurchase(po)}
                              className="px-3 py-1 rounded-xl bg-cream-50 hover:bg-cream-100 border border-[#E0D7CC] text-brand-brown-dark font-black text-xs transition-all active:scale-95 cursor-pointer inline-flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5 text-brand-teal" />
                              <span>View</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: MY REQUESTS & STATUS */}
        {activeTab === 'requests' && (
          <div className="flex-1 min-h-0 bg-white rounded-2xl border border-[#E9E0D5] shadow-xs overflow-hidden flex flex-col mb-1">
            <div className="flex-1 overflow-auto min-h-0 pb-20">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-[#FAF7F2]/95 backdrop-blur-xs z-10 shadow-2xs">
                  <tr className="border-b border-[#EAE3DA] text-text-muted font-black uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Request #</th>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Ingredient</th>
                    <th className="py-3 px-4">Proposed Quantity</th>
                    <th className="py-3 px-4">Details / Justification</th>
                    <th className="py-3 px-4 text-center">Approval Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2ECE4] font-medium">
                  {filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-20 text-text-muted">
                        <Truck className="w-9 h-9 mx-auto mb-2 text-text-muted/40" />
                        <div className="font-semibold text-xs text-text-secondary">No stock requests found.</div>
                      </td>
                    </tr>
                  ) : (
                    filteredRequests.map((req) => {
                      const isPending = req.status === 'PENDING_APPROVAL';
                      const isApproved = req.status === 'APPROVED';
                      const isRejected = req.status === 'REJECTED';

                      return (
                        <tr
                          key={req.id}
                          onClick={() => setViewingRequest(req)}
                          className={`hover:bg-[#FAF7F2]/90 transition-colors cursor-pointer group ${isPending ? 'bg-amber-50/40' : ''}`}
                        >
                          <td className="py-3 px-4 font-mono font-bold text-brand-teal group-hover:underline">{req.requestNumber}</td>
                          <td className="py-3 px-4 text-text-secondary whitespace-nowrap">
                            {format(new Date(req.createdAt), 'dd MMM yyyy, hh:mm a')}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                                req.type === 'STOCK_DELIVERY'
                                  ? 'bg-amber-50 text-amber-900 border-amber-200'
                                  : 'bg-teal-50 text-brand-teal-dark border-teal-200'
                              }`}
                            >
                              {req.type === 'STOCK_DELIVERY' ? 'DELIVERY INTAKE' : 'ADJUSTMENT'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-black text-brand-brown-deep">{req.ingredientName}</td>
                          <td className="py-3 px-4 font-black tabular-nums">
                            {req.type === 'STOCK_ADJUSTMENT' ? (
                              <span>
                                {req.requestedStock} {req.unit}{' '}
                                <span className="text-[10px] font-bold text-text-muted">
                                  ({req.quantityChange >= 0 ? `+${req.quantityChange}` : req.quantityChange} {req.unit})
                                </span>
                              </span>
                            ) : (
                              <span className="text-status-success font-black">
                                +{req.quantityChange} {req.unit}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-text-secondary max-w-xs">
                            <div className="truncate font-medium">{req.reason}</div>
                            {req.supplierName && (
                              <div className="text-[10px] text-text-muted">
                                Supplier: {req.supplierName} • Inv: {req.invoiceNumber || 'N/A'}
                              </div>
                            )}
                            {req.rejectionReason && (
                              <div className="text-[10px] text-rose-600 font-bold mt-0.5">
                                Reason: {req.rejectionReason}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {isPending && (
                              <span className="px-2.5 py-1 rounded-full font-black text-[10px] uppercase bg-amber-100 text-amber-800 border border-amber-300 inline-flex items-center gap-1.5 animate-pulse">
                                <Clock className="w-3 h-3" />
                                <span>Waiting for Admin</span>
                              </span>
                            )}
                            {isApproved && (
                              <span className="px-2.5 py-1 rounded-full font-black text-[10px] uppercase bg-teal-50 text-brand-teal-dark border border-teal-200 inline-flex items-center gap-1.5">
                                <CheckCircle2 className="w-3 h-3 text-status-success" />
                                <span>Approved</span>
                              </span>
                            )}
                            {isRejected && (
                              <span className="px-2.5 py-1 rounded-full font-black text-[10px] uppercase bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1.5">
                                <XCircle className="w-3 h-3 text-rose-600" />
                                <span>Rejected</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewingRequest(req);
                              }}
                              className="px-3 py-1 bg-cream-50 hover:bg-cream-200 border border-[#E0D7CC] rounded-full text-[11px] font-bold text-brand-brown-dark inline-flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 cursor-pointer"
                            >
                              <Eye className="w-3 h-3 text-brand-teal" />
                              <span>View</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 5. FLOATING SEARCH & ACTION CAPSULE (Centered in Workspace) */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center pointer-events-none select-none max-w-[calc(100%-2rem)]">
        <div className="bg-[#1E1917]/95 text-white backdrop-blur-xl border border-white/10 shadow-2xl rounded-full p-1.5 pl-4 pr-1.5 flex items-center gap-2 transition-all duration-300 pointer-events-auto">
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
                  ? 'Search POs, suppliers...'
                  : 'Search my requests...'
              }
              value={search}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              onChange={(e) => setSearch(e.target.value)}
              className={`bg-transparent border-0 border-none outline-none focus:outline-none focus:ring-0 text-xs font-semibold text-white placeholder:text-white/40 shadow-none transition-all duration-300 ease-out ${
                isSearchFocused || search ? 'w-48 sm:w-64 md:w-80' : 'w-32 sm:w-44'
              }`}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Primary Action Button */}
          <button
            type="button"
            onClick={() => {
              if (activeTab === 'stock') {
                handleOpenAddIngredient();
              } else if (activeTab === 'purchases') {
                handleOpenReceiveModal();
              } else if (activeTab === 'movements') {
                handleOpenAdjust();
              } else {
                handleOpenReceiveModal();
              }
            }}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#E99343] hover:bg-[#DE7E29] text-white flex items-center justify-center shadow-lg shadow-[#E99343]/30 active:scale-95 transition-all shrink-0 cursor-pointer group"
            title={
              activeTab === 'stock'
                ? 'Add New Raw Ingredient'
                : activeTab === 'movements'
                ? 'Record Stock Adjustment'
                : 'Receive Delivery (PO)'
            }
          >
            <Plus className="w-5 h-5 stroke-[2.5] group-hover:rotate-90 transition-transform duration-200" />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5.1 MODAL: ADD / EDIT INGREDIENT (SAME AS ADMIN SIDE DESIGN)              */}
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
      {/* 6. MODAL: RECORD STOCK ADJUSTMENT (SAME DESIGN AS ADMIN SIDE)             */}
      {/* ========================================================================= */}
      {isAdjustModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[99999] w-full h-full bg-black/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-hidden animate-in fade-in">
            <div className="w-full max-w-lg sm:max-w-xl flex flex-col max-h-[92vh]">
              {/* Separate Header */}
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
                    form="pos-adjust-form"
                    className="px-5 py-2 rounded-full bg-brand-teal hover:bg-brand-teal-dark text-white font-extrabold text-xs shadow-teal transition-all active:scale-95 whitespace-nowrap cursor-pointer"
                  >
                    Save Adjustment
                  </button>
                </div>
              </div>

              <div className="w-full bg-white rounded-3xl shadow-2xl border border-[#E9E0D5] overflow-y-auto">
                <form id="pos-adjust-form" onSubmit={handleSubmitAdjust} className="p-5 sm:p-6 space-y-4">
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
                        onChange={(e) => setAdjustIngredientId(e.target.value)}
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
                        className={`py-2 rounded-xl text-xs font-extrabold transition-all border cursor-pointer ${
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
                        className={`py-2 rounded-xl text-xs font-extrabold transition-all border cursor-pointer ${
                          adjustType === 'DEDUCT'
                            ? 'bg-[#251814] text-white border-[#251814] shadow-xs'
                            : 'bg-[#FAF7F2] text-text-secondary hover:bg-cream-100 border-[#E0D7CC]'
                        }`}
                      >
                        – Deduct / Waste
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdjustType('EXACT')}
                        className={`py-2 rounded-xl text-xs font-extrabold transition-all border cursor-pointer ${
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
                    <label className="text-[11px] font-bold uppercase text-text-secondary block mb-1">
                      Audit Reason / Note <span className="text-status-danger">*</span>
                    </label>
                    <input
                      type="text"
                      value={adjustReason}
                      onChange={(e) => setAdjustReason(e.target.value)}
                      placeholder="e.g. Physical stock inventory audit, Spoilage"
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

      {/* 7. FULL 3-CARD GOODS INWARD STUDIO (RECEIVE STOCK / PURCHASE ORDER) */}
      {isReceiveModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[99999] w-full h-full bg-black/60 backdrop-blur-md flex items-center justify-center p-2 sm:p-3 lg:p-4 overflow-hidden animate-in fade-in">
            <div className="w-full max-w-[98vw] 2xl:max-w-[1700px] h-[94vh] max-h-[94vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between gap-3 mb-3 px-1 shrink-0">
                <div className="min-w-0 flex-1 flex items-center gap-2">
                  <h3 className="font-extrabold text-base sm:text-lg text-white drop-shadow-xs truncate">
                    Receive Stock / Purchase Order
                  </h3>
                  <span className="text-[11px] font-bold text-white/70 bg-white/10 px-2.5 py-0.5 rounded-full backdrop-blur-xs hidden sm:inline-block shrink-0">
                    Staff Goods Inward Studio
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
                    form="pos-receive-form"
                    className="px-5 py-2 rounded-full bg-brand-teal hover:bg-brand-teal-dark text-white font-extrabold text-xs shadow-teal transition-all active:scale-95 whitespace-nowrap cursor-pointer"
                  >
                    Submit Request for Admin Approval
                  </button>
                </div>
              </div>

              {/* 3-Card Grid */}
              <form
                id="pos-receive-form"
                onSubmit={handleSavePurchaseRequest}
                className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 flex-1 min-h-0 overflow-hidden"
              >
                {/* 1. LEFT CARD: SUPPLIER & INVOICE */}
                <div className="lg:col-span-3 xl:col-span-3 flex flex-col h-full min-h-0 bg-white rounded-3xl shadow-sm border border-[#E9E0D5] p-4 sm:p-5 overflow-y-auto space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-[#EAE3DA] shrink-0">
                    <div className="w-7 h-7 rounded-xl bg-brand-brown/10 text-brand-brown flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-extrabold uppercase text-brand-brown-dark tracking-wider block leading-tight">
                      Supplier & Invoice Details
                    </span>
                  </div>

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
                        }}
                        className="w-full p-2 bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl text-xs font-bold text-brand-brown-dark focus:outline-none focus:border-brand-teal cursor-pointer"
                      >
                        <option value="">-- Direct Store / Custom Supplier --</option>
                        {activeSuppliers.map((sup) => (
                          <option key={sup.id} value={sup.id}>
                            {sup.name}
                          </option>
                        ))}
                      </select>
                      {!selectedSupplierId && (
                        <input
                          type="text"
                          value={vendorName}
                          onChange={(e) => setVendorName(e.target.value)}
                          placeholder="Type supplier name..."
                          className="w-full p-2 mt-1.5 bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl text-xs font-medium text-brand-brown-dark focus:outline-none focus:border-brand-teal"
                        />
                      )}
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
                        className="w-full pb-1.5 pt-0.5 bg-transparent border-0 border-b border-[#E2D8CC] text-xs font-bold text-brand-brown-dark focus:outline-none focus:border-brand-teal rounded-none font-mono"
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
                        placeholder="e.g. Received via chilled transport..."
                        className="w-full p-2 bg-[#FAF7F2] border border-[#E0D7CC] rounded-xl text-xs font-medium text-brand-brown-dark focus:outline-none focus:border-brand-teal resize-none"
                      />
                    </div>

                    {/* Logo */}
                    <div className="flex flex-col items-center justify-center py-4 my-auto select-none pointer-events-none">
                      <img src="/logobg.webp" alt="Café Logo" className="w-36 sm:w-44 h-auto object-contain drop-shadow-xs" />
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-[#FAF7F2] border border-[#E2D8CC] space-y-1.5 shrink-0 text-[11px]">
                    <div className="flex justify-between text-text-muted">
                      <span>Receiving Date:</span>
                      <span className="font-bold text-brand-brown-dark">{new Date().toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between text-text-muted">
                      <span>Staff Cashier:</span>
                      <span className="font-bold text-brand-teal">{currentCashier?.name || 'Cashier'}</span>
                    </div>
                    <div className="flex justify-between text-text-muted">
                      <span>Total Items:</span>
                      <span className="font-bold text-brand-brown-dark">{purchaseItems.length} lines</span>
                    </div>
                  </div>
                </div>

                {/* 2. MIDDLE CARD: RECEIVED LINE ITEMS */}
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

                  {/* Line Items Table */}
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
                            <tr key={idx} className="border-b border-[#F0E8DF] hover:bg-[#FAF7F2]/60 transition-colors">
                              <td className="py-2.5 px-2 text-center font-mono font-bold text-[11px] text-text-muted">
                                {idx + 1}
                              </td>
                              <td className="py-2.5 px-2">
                                <select
                                  value={item.ingredientId}
                                  onChange={(e) => handleUpdatePurchaseItem(idx, { ingredientId: e.target.value })}
                                  className="w-full p-2 bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl text-xs font-bold text-brand-brown-dark outline-none focus:border-brand-teal focus:bg-white cursor-pointer"
                                >
                                  {availableIngredients.map((ing) => (
                                    <option key={ing.id} value={ing.id}>
                                      {ing.name} ({ing.unit})
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-2.5 px-2">
                                <div className="flex items-center bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl overflow-hidden focus-within:border-brand-teal focus-within:bg-white">
                                  <input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={item.quantity}
                                    onChange={(e) =>
                                      handleUpdatePurchaseItem(idx, { quantity: Number(e.target.value) })
                                    }
                                    placeholder="1"
                                    className="w-full py-2 px-1.5 bg-transparent text-xs font-bold text-center text-brand-brown-dark outline-none"
                                    required
                                  />
                                  <span className="px-1.5 py-2 bg-[#F2ECE4] border-l border-[#E2D8CC] text-[10px] font-extrabold text-brand-brown-dark select-none shrink-0">
                                    {item.unit}
                                  </span>
                                </div>
                              </td>
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
                                  className="w-full p-2 bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl text-xs font-bold text-right text-brand-brown-dark outline-none focus:border-brand-teal focus:bg-white"
                                  required
                                />
                              </td>
                              <td className="py-2.5 px-2">
                                <input
                                  type="date"
                                  value={item.expiryDate || ''}
                                  onChange={(e) => handleUpdatePurchaseItem(idx, { expiryDate: e.target.value })}
                                  className="w-full p-2 bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl text-xs font-mono font-bold text-brand-brown-dark outline-none focus:border-brand-teal focus:bg-white cursor-pointer"
                                />
                              </td>
                              <td className="py-2.5 px-2 text-right">
                                <span className="font-black text-xs text-brand-brown-dark font-mono block whitespace-nowrap">
                                  {formatLKR(item.totalCents)}
                                </span>
                              </td>
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

                    {/* Dedicated Scheduled Due Date Card (Appears if Partial or Unpaid Balance Due) */}
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
      {/* 8. MODAL: VIEW PURCHASE DETAILS (3-COLUMN STUDIO CARD PATTERN)            */}
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
                    onClick={() => setViewingPurchase(null)}
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
                  </div>

                  {/* Paid Records Section */}
                  <div className="flex-1 overflow-y-auto space-y-3 min-h-0 pr-1">
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
                            const dateStr = pDate.toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'numeric',
                              day: 'numeric',
                            });
                            const timeStr = pDate.toLocaleTimeString(undefined, {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,
                            });

                            return (
                              <div key={idx} className="py-2 flex items-center justify-between gap-2 text-xs">
                                <div>
                                  <div className="flex items-center gap-1.5 font-bold text-brand-brown-dark">
                                    {p.method === 'CASH' && <Banknote className="w-3.5 h-3.5 text-emerald-600" />}
                                    {p.method === 'CARD' && <CreditCard className="w-3.5 h-3.5 text-blue-600" />}
                                    {p.method === 'CHEQUE' && <FileText className="w-3.5 h-3.5 text-amber-600" />}
                                    <span>
                                      {p.method === 'CASH' ? 'Cash' : p.method === 'CARD' ? 'Card / Bank' : 'Cheque'}
                                    </span>
                                    {p.method === 'CHEQUE' && p.chequeNumber && (
                                      <span className="text-[10px] text-text-muted font-mono">
                                        #{p.chequeNumber}
                                      </span>
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
                      <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2 shrink-0 animate-in fade-in">
                        <div className="flex items-center gap-1.5 text-xs font-black text-amber-900">
                          <Landmark className="w-3.5 h-3.5 text-amber-700" />
                          <span>Cheque Realization Details</span>
                        </div>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-text-secondary uppercase font-bold">Cheque Ref:</span>
                            <span className="font-mono font-bold text-brand-brown-dark">{chequePayment.chequeNumber || 'N/A'}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-text-secondary uppercase font-bold">Bank Name:</span>
                            <span className="font-bold text-brand-brown-dark">{chequePayment.bankName || 'N/A'}</span>
                          </div>
                          {chequePayment.chequeDate && (
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] text-text-secondary uppercase font-bold">Realization Date:</span>
                              <span className="font-bold text-amber-900">{chequePayment.chequeDate}</span>
                            </div>
                          )}
                        </div>
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
      {/* 9. MODAL: VIEW STOCK REQUEST DETAILS (3-COLUMN STUDIO CARD PATTERN)        */}
      {/* ========================================================================= */}
      {viewingRequest && (() => {
        const isDelivery = viewingRequest.type === 'STOCK_DELIVERY';
        const totalCostCents = viewingRequest.totalCents ?? viewingRequest.costCents ?? 0;
        const effectivePaidCents = viewingRequest.paidCents ?? (viewingRequest.paymentStatus === 'PAID' ? totalCostCents : 0);
        const effectiveDueCents = viewingRequest.dueCents ?? Math.max(0, totalCostCents - effectivePaidCents);
        const effectiveOverpaidCents = Math.max(0, effectivePaidCents - totalCostCents);
        const effectivePaymentStatus: PurchasePaymentStatus =
          viewingRequest.paymentStatus ||
          (effectivePaidCents >= totalCostCents && totalCostCents > 0
            ? 'PAID'
            : effectivePaidCents > 0
            ? 'PARTIAL'
            : 'UNPAID');

        const isPaid = effectivePaymentStatus === 'PAID';

        // Extract payment breakdown amounts
        const cashPaidCents =
          viewingRequest.payments?.filter((p) => p.method === 'CASH').reduce((s, p) => s + p.amountCents, 0) ||
          (isPaid && (!viewingRequest.payments || viewingRequest.payments.length === 0) ? totalCostCents : 0);
        const cardPaidCents =
          viewingRequest.payments?.filter((p) => p.method === 'CARD').reduce((s, p) => s + p.amountCents, 0) || 0;
        const chequePaidCents =
          viewingRequest.payments?.filter((p) => p.method === 'CHEQUE').reduce((s, p) => s + p.amountCents, 0) || 0;
        const chequePayment = viewingRequest.payments?.find((p) => p.method === 'CHEQUE');

        const itemsList: PurchaseItem[] =
          viewingRequest.items && viewingRequest.items.length > 0
            ? viewingRequest.items
            : [
                {
                  ingredientId: viewingRequest.ingredientId || '',
                  ingredientName: viewingRequest.ingredientName,
                  quantity: viewingRequest.quantityChange || 1,
                  unit: viewingRequest.unit,
                  unitPriceCents: Math.round((viewingRequest.costCents || 0) / (viewingRequest.quantityChange || 1)),
                  totalCents: viewingRequest.costCents || 0,
                  expiryDate: viewingRequest.expiryDate,
                },
              ];

        return createPortal(
          <div className="fixed inset-0 z-[99999] w-full h-full bg-black/60 backdrop-blur-md flex items-center justify-center p-2 sm:p-3 lg:p-4 overflow-hidden animate-in fade-in">
            <div className="w-full max-w-[98vw] 2xl:max-w-[1700px] h-[94vh] max-h-[94vh] flex flex-col">
              {/* 1. Top Header Row above cards */}
              <div className="flex items-center justify-between gap-3 mb-3 px-1 shrink-0">
                <div className="min-w-0 flex-1 flex items-center gap-2">
                  <h3 className="font-extrabold text-base sm:text-lg text-white drop-shadow-xs truncate">
                    Request {viewingRequest.requestNumber}
                  </h3>
                  <span className="text-[11px] font-bold text-white/70 bg-white/10 px-2.5 py-0.5 rounded-full backdrop-blur-xs hidden sm:inline-block shrink-0">
                    {isDelivery ? 'Goods Inward Voucher' : 'Stock Adjustment Voucher'}
                  </span>
                  <span
                    className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border shadow-xs ${
                      viewingRequest.status === 'PENDING_APPROVAL'
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : viewingRequest.status === 'APPROVED'
                        ? 'bg-status-success-bg text-status-success border-status-success/30'
                        : 'bg-rose-100 text-rose-900 border-rose-300'
                    }`}
                  >
                    {viewingRequest.status === 'PENDING_APPROVAL'
                      ? 'Waiting for Admin'
                      : viewingRequest.status === 'APPROVED'
                      ? 'Approved'
                      : 'Rejected'}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setViewingRequest(null)}
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
                        {isDelivery ? 'Supplier & Invoice Details' : 'Adjustment Request Details'}
                      </span>
                      <span className="text-[10px] text-text-muted leading-none">
                        {isDelivery ? 'Vendor information & bill reference' : 'Inventory audit request reference'}
                      </span>
                    </div>
                  </div>

                  {/* Form Fields */}
                  <div className="space-y-3.5 flex-1">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1">
                        {isDelivery ? 'Supplier / Vendor Name' : 'Audit Target Item'}
                      </label>
                      <div className="w-full pb-1.5 pt-0.5 border-b border-[#E2D8CC] text-xs font-bold text-brand-brown-dark">
                        {isDelivery ? viewingRequest.supplierName || 'General Supplier' : viewingRequest.ingredientName}
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1">
                        {isDelivery ? 'Invoice / Bill Ref #' : 'Request Reference #'}
                      </label>
                      <div className="flex items-center justify-between border-b border-[#E2D8CC] pb-1.5 pt-0.5">
                        <span className="text-xs font-mono font-bold text-brand-brown-dark">
                          {isDelivery ? viewingRequest.invoiceNumber || 'N/A' : viewingRequest.requestNumber}
                        </span>
                        {viewingRequest.invoiceNumber && (
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(viewingRequest.invoiceNumber || '');
                              toast.success(`Copied "${viewingRequest.invoiceNumber}"`);
                            }}
                            className="p-1 text-text-muted hover:text-brand-teal transition-colors cursor-pointer"
                            title="Copy Invoice Ref"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1">
                        {isDelivery ? 'Delivery / PO Notes' : 'Cashier Audit Reason'}
                      </label>
                      <div className="w-full min-h-[64px] p-2.5 bg-cream-50/50 rounded-2xl border border-[#E8DFC8] text-xs text-brand-brown-dark font-medium italic">
                        {viewingRequest.notes || viewingRequest.reason || 'No notes recorded.'}
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
                      <span>Request Date:</span>
                      <span className="font-bold text-brand-brown-dark">
                        {new Date(viewingRequest.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'numeric',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-text-secondary">
                      <span>Submitted By:</span>
                      <span className="font-bold text-brand-teal">{viewingRequest.requestedByUserName}</span>
                    </div>
                    {viewingRequest.resolvedByUserName && (
                      <div className="flex justify-between items-center text-text-secondary">
                        <span>Reviewed By:</span>
                        <span className="font-bold text-brand-brown-dark">{viewingRequest.resolvedByUserName}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-text-secondary">
                      <span>Total Items:</span>
                      <span className="font-bold text-brand-brown-dark">{itemsList.length} lines</span>
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
                          {isDelivery ? 'Received Line Items' : 'Adjustment Stock Items'}
                        </span>
                        <span className="text-[10px] text-text-muted leading-none">
                          {isDelivery ? 'Raw ingredients delivered to storage' : 'Stock level modification request'}
                        </span>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded-xl text-[10px] font-extrabold bg-cream-100 border border-[#E0D7CC] text-brand-brown">
                      {itemsList.length} items
                    </span>
                  </div>

                  {/* Items List */}
                  <div className="flex-1 overflow-y-auto space-y-2.5 min-h-0 pr-1">
                    {isDelivery ? (
                      itemsList.map((it, idx) => (
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
                            {it.expiryDate && (
                              <div className="text-[10px] text-text-muted font-mono mt-0.5">
                                Expiry: {it.expiryDate}
                              </div>
                            )}
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
                      ))
                    ) : (
                      <div className="p-4 bg-[#FAF7F2] rounded-2xl border border-[#E2D8CC] space-y-3 text-xs">
                        <div className="font-bold text-brand-brown-dark text-sm truncate">
                          {viewingRequest.ingredientName}
                        </div>
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#EAE3DA]">
                          <div>
                            <span className="text-[10px] font-bold text-text-muted uppercase block">Previous Stock</span>
                            <span className="font-bold text-text-secondary">{viewingRequest.currentStock} {viewingRequest.unit}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-text-muted uppercase block">Proposed Stock</span>
                            <span className="font-black text-brand-brown-deep">{viewingRequest.requestedStock} {viewingRequest.unit}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-text-muted uppercase block">Net Change</span>
                            <span className={`font-black ${viewingRequest.quantityChange >= 0 ? 'text-status-success' : 'text-status-danger'}`}>
                              {viewingRequest.quantityChange >= 0 ? `+${viewingRequest.quantityChange}` : viewingRequest.quantityChange} {viewingRequest.unit}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
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
                  </div>

                  {/* Paid Records Section */}
                  <div className="flex-1 overflow-y-auto space-y-3 min-h-0 pr-1">
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
                          {(viewingRequest.payments && viewingRequest.payments.length > 0
                            ? viewingRequest.payments.filter((p) => p.amountCents > 0)
                            : [
                                ...(cashPaidCents > 0 ? [{ method: 'CASH' as const, amountCents: cashPaidCents }] : []),
                                ...(cardPaidCents > 0 ? [{ method: 'CARD' as const, amountCents: cardPaidCents }] : []),
                                ...(chequePaidCents > 0
                                  ? [{ method: 'CHEQUE' as const, amountCents: chequePaidCents, chequeNumber: chequePayment?.chequeNumber }]
                                  : []),
                              ]
                          ).map((p, idx) => {
                            const pDate = p.timestamp ? new Date(p.timestamp) : new Date(viewingRequest.createdAt);
                            const dateStr = pDate.toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'numeric',
                              day: 'numeric',
                            });
                            const timeStr = pDate.toLocaleTimeString(undefined, {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,
                            });

                            return (
                              <div key={idx} className="py-2 flex items-center justify-between gap-2 text-xs">
                                <div>
                                  <div className="flex items-center gap-1.5 font-bold text-brand-brown-dark">
                                    {p.method === 'CASH' && <Banknote className="w-3.5 h-3.5 text-emerald-600" />}
                                    {p.method === 'CARD' && <CreditCard className="w-3.5 h-3.5 text-blue-600" />}
                                    {p.method === 'CHEQUE' && <FileText className="w-3.5 h-3.5 text-amber-600" />}
                                    <span>
                                      {p.method === 'CASH' ? 'Cash' : p.method === 'CARD' ? 'Card / Bank' : 'Cheque'}
                                    </span>
                                    {p.method === 'CHEQUE' && p.chequeNumber && (
                                      <span className="text-[10px] text-text-muted font-mono">
                                        #{p.chequeNumber}
                                      </span>
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
                      <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2 shrink-0 animate-in fade-in">
                        <div className="flex items-center gap-1.5 text-xs font-black text-amber-900">
                          <Landmark className="w-3.5 h-3.5 text-amber-700" />
                          <span>Cheque Realization Details</span>
                        </div>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-text-secondary uppercase font-bold">Cheque Ref:</span>
                            <span className="font-mono font-bold text-brand-brown-dark">{chequePayment.chequeNumber || 'N/A'}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-text-secondary uppercase font-bold">Bank Name:</span>
                            <span className="font-bold text-brand-brown-dark">{chequePayment.bankName || 'N/A'}</span>
                          </div>
                          {chequePayment.chequeDate && (
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] text-text-secondary uppercase font-bold">Realization Date:</span>
                              <span className="font-bold text-amber-900">{chequePayment.chequeDate}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Pinned Bottom Financial Settlement Summary Card */}
                  <div className="p-3.5 bg-[#FAF7F2] rounded-2xl border border-[#E2D8CC] space-y-2 shrink-0 text-xs mt-auto">
                    <div className="flex justify-between items-center text-text-secondary">
                      <span>Total Invoiced:</span>
                      <span className="font-mono font-bold text-brand-brown-dark">{formatLKR(totalCostCents)}</span>
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
                            {viewingRequest.duePaymentDate || 'Pending Schedule'}
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
    </div>
  );
};
