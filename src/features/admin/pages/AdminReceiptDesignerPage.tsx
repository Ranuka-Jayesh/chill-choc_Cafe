import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/services/storage/db';
import { settingsService } from '@/services/settingsService';
import { ReceiptCustomizationSettings, KotCustomizationSettings, SystemSettings } from '@/types';
import { receiptSocketService } from '@/services/receiptSocketService';
import { formatLKR, formatDateTime } from '@/utils/format';
import {
  Printer,
  RefreshCw,
  Save,
  Loader2,
  Image as ImageIcon,
  Sliders,
  Type,
  Receipt,
  Share2,
  Upload,
  Store,
  DollarSign,
  Eye,
  Info,
  Check,
  Utensils,
  ChefHat,
  Tag,
  Clock,
  Sparkles,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { printThermalElement } from '@/utils/printThermal';

// Sample mock orders for live preview
const SAMPLE_ORDERS = [
  {
    id: 'ord_sample_01',
    orderNumber: '#1050',
    orderType: 'DINE_IN',
    tableNumber: '05',
    createdAt: new Date().toISOString(),
    cashierName: 'Nimal Perera',
    customerName: 'Kasun Mendis',
    items: [
      {
        quantity: 2,
        name: 'Chocolate Waffle',
        itemTotalCents: 250000,
        unitPriceCents: 125000,
        modifiers: [
          { groupName: 'Toppings', optionName: 'Belgian Choc Drizzle', priceCents: 15000 },
          { groupName: 'Extras', optionName: 'Vanilla Gelato Scoop', priceCents: 20000 },
        ],
        notes: 'Extra chocolate dust on top please',
      },
      {
        quantity: 1,
        name: 'Cafe Latte',
        itemTotalCents: 90000,
        unitPriceCents: 90000,
        modifiers: [
          { groupName: 'Size', optionName: 'Regular (8oz)', priceCents: 0 },
          { groupName: 'Milk', optionName: 'Fresh Cow Milk', priceCents: 0 },
        ],
        notes: '',
      },
    ],
    subtotalCents: 340000,
    discountCents: 34000,
    serviceChargeCents: 30600,
    taxCents: 0,
    totalCents: 336600,
    paymentMethod: 'CASH',
    cashReceivedCents: 350000,
    changeGivenCents: 13400,
    cardReference: '',
  },
  {
    id: 'ord_sample_02',
    orderNumber: '#1051',
    orderType: 'TAKEAWAY',
    tableNumber: '',
    createdAt: new Date().toISOString(),
    cashierName: 'Chaminda Silva',
    items: [
      {
        quantity: 1,
        name: 'Crispy Chicken Burger',
        itemTotalCents: 165000,
        unitPriceCents: 165000,
        modifiers: [{ groupName: 'Cheese', optionName: 'Extra Cheddar', priceCents: 25000 }],
        notes: 'Pack in eco box',
      },
      {
        quantity: 1,
        name: 'French Fries (Large)',
        itemTotalCents: 85000,
        unitPriceCents: 85000,
        modifiers: [],
        notes: '',
      },
      {
        quantity: 2,
        name: 'Iced Caramel Macchiato',
        itemTotalCents: 230000,
        unitPriceCents: 115000,
        modifiers: [{ groupName: 'Milk', optionName: 'Oat Milk (+150)', priceCents: 15000 }],
        notes: 'Less ice',
      },
    ],
    subtotalCents: 480000,
    discountCents: 0,
    serviceChargeCents: 0,
    taxCents: 0,
    totalCents: 480000,
    paymentMethod: 'CARD',
    cashReceivedCents: 0,
    changeGivenCents: 0,
    cardReference: 'AUTH-VISA-9921',
  },
];

type ReceiptTabKey = 'branding' | 'metadata' | 'items' | 'financials' | 'payments' | 'footer';
type KotTabKey = 'kot_header' | 'kot_meta' | 'kot_items' | 'kot_routing';

export const AdminReceiptDesignerPage: React.FC = () => {
  const [documentMode, setDocumentMode] = useState<'receipt' | 'kot'>('receipt');
  const [receiptTab, setReceiptTab] = useState<ReceiptTabKey>('branding');
  const [kotTab, setKotTab] = useState<KotTabKey>('kot_header');
  const [mobileView, setMobileView] = useState<'editor' | 'preview'>('editor');
  const [selectedSampleIndex, setSelectedSampleIndex] = useState(0);

  // Load initial settings
  const systemSettings: SystemSettings = db.getSnapshot().settings;

  const defaultReceiptCustomization: ReceiptCustomizationSettings = useMemo(() => ({
    showLogo: true,
    logoUrl: '/logobg.webp',
    logoWidthPx: 95,
    logoAlignment: 'center',
    logoOffsetYPx: 0,
    logoMarginTopPx: 0,
    logoMarginBottomPx: 10,
    businessName: systemSettings.businessName || 'Chill & Choc',
    tagline: systemSettings.tagline || 'Cool Vibes, Sweet Bites',
    address: systemSettings.address || 'No. 42, Galle Road, Colombo 03, Sri Lanka',
    phone: systemSettings.phone || '+94 11 234 5678',
    email: systemSettings.email || 'hello@chillandchoc.lk',
    website: '',
    taxNumber: 'VAT-LK-10928374',
    headerAlignment: 'center',
    dividerStyle: 'dashed',
    paperWidthMm: 80,
    fontFamily: 'mono',
    fontSize: 'normal',
    heading1Size: 'large',
    heading1Bold: true,
    heading2Size: 'normal',
    heading2Bold: true,
    heading3Size: 'normal',
    heading3Bold: true,
    bodyBold: false,
    showOrderNumber: true,
    orderNumberPrefix: 'Order: #',
    showOrderType: true,
    showTableNumber: true,
    showCashierName: false,
    showDateTime: true,
    timeFormat: '12h',
    showCustomerInfo: false,
    itemSpacing: 'normal',
    showModifiers: true,
    showModifierPrices: true,
    showItemNotes: true,
    showUnitPrice: false,
    showSubtotal: true,
    showDiscount: true,
    showServiceCharge: true,
    serviceChargeLabel: 'Service Charge (10%)',
    showTax: false,
    taxLabel: 'VAT (0%)',
    currencySymbol: 'Rs.',
    showPaymentMethod: true,
    showCashBreakdown: true,
    showCardReference: true,
    receiptFooter: systemSettings.receiptFooter || 'Thank you for chilling with us!\nPlease visit us again.\nFollow @chillandchoc.lk',
    showSocialHandle: true,
    socialHandle: '@chillandchoc.lk',
    showWifiInfo: false,
    wifiSsid: 'ChillAndChoc_Guest',
    wifiPassword: 'sweetbites2026',
    showDeveloperCredit: true,
    developerCreditText: 'DEVELOPED BY OGO TECHNOLOGY',
    developerContact: 'www.ogotechnology.net • +94 75 930 7059',
  }), [systemSettings]);

  const defaultKotCustomization: KotCustomizationSettings = useMemo(() => ({
    ticketTitle: 'KITCHEN ORDER TICKET',
    showBrandName: true,
    brandName: systemSettings.businessName || 'CHILL & CHOC',
    showOrderType: true,
    showTableNumber: true,
    tableNumberStyle: 'prominent',
    showOrderNumber: true,
    orderNumberPrefix: '#',
    showCashierName: true,
    cashierLabel: 'Staff',
    showDateTime: true,
    timeFormat: '12h',
    showModifiers: true,
    showItemNotes: true,
    highlightNotes: true,
    fontSize: 'normal',
    paperWidthMm: 80,
    dividerStyle: 'dashed',
    showStationRouting: true,
    stationRoutingText: 'Station Routing: BAR / KITCHEN / DESSERT',
    customNote: '',
  }), [systemSettings]);

  // Form states with merged defaults so newly added fields like logoOffsetYPx persist reliably
  const initialReceiptSettings = useMemo<ReceiptCustomizationSettings>(() => {
    const fromDb = systemSettings.receiptCustomization;
    return {
      ...defaultReceiptCustomization,
      ...(fromDb || {}),
    };
  }, [systemSettings, defaultReceiptCustomization]);

  const initialKotSettings = useMemo<KotCustomizationSettings>(() => {
    const fromDb = systemSettings.kotCustomization;
    return {
      ...defaultKotCustomization,
      ...(fromDb || {}),
    };
  }, [systemSettings, defaultKotCustomization]);

  const [receiptForm, setReceiptForm] = useState<ReceiptCustomizationSettings>(initialReceiptSettings);
  const [savedReceiptForm, setSavedReceiptForm] = useState<ReceiptCustomizationSettings>(initialReceiptSettings);

  const [kotForm, setKotForm] = useState<KotCustomizationSettings>(initialKotSettings);
  const [savedKotForm, setSavedKotForm] = useState<KotCustomizationSettings>(initialKotSettings);
  const [isSaving, setIsSaving] = useState(false);

  const hasUnsavedChanges = useMemo(() => {
    if (documentMode === 'receipt') {
      return JSON.stringify(receiptForm) !== JSON.stringify(savedReceiptForm);
    }
    return JSON.stringify(kotForm) !== JSON.stringify(savedKotForm);
  }, [documentMode, receiptForm, savedReceiptForm, kotForm, savedKotForm]);

  // Keep a ref of dirty state so background DB fetches do NOT wipe out an admin's draft
  const isDirtyRef = React.useRef(false);
  isDirtyRef.current = hasUnsavedChanges;

  // Auto-save draft to local database if user refreshes the page so it's never lost
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isDirtyRef.current) {
        db.update('settings', (prev) => ({
          ...prev,
          receiptCustomization: receiptForm,
          kotCustomization: kotForm,
        }));
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [receiptForm, kotForm]);

  // Sync state on remote DB load if user has not started modifying
  useEffect(() => {
    const unsub = db.subscribe(() => {
      if (isDirtyRef.current) return;
      const snap = db.getSnapshot().settings;
      if (snap.receiptCustomization) {
        const merged = {
          ...defaultReceiptCustomization,
          ...snap.receiptCustomization,
        };
        setReceiptForm(merged);
        setSavedReceiptForm(merged);
      }
      if (snap.kotCustomization) {
        const mergedKot = {
          ...defaultKotCustomization,
          ...snap.kotCustomization,
        };
        setKotForm(mergedKot);
        setSavedKotForm(mergedKot);
      }
    });
    return () => unsub();
  }, [defaultReceiptCustomization, defaultKotCustomization]);

  // Update local receipt form draft (updates preview instantly, does NOT push to DB until Save is clicked)
  const updateReceiptForm = (changes: Partial<ReceiptCustomizationSettings>) => {
    setReceiptForm((prev) => ({ ...prev, ...changes }));
  };

  // Update local KOT form draft (updates preview instantly, does NOT push to DB until Save is clicked)
  const updateKotForm = (changes: Partial<KotCustomizationSettings>) => {
    setKotForm((prev) => ({ ...prev, ...changes }));
  };

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const rawData = reader.result;
        const img = new Image();
        img.onload = () => {
          const maxDim = 400;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const optimizedBase64 = canvas.toDataURL('image/png', 0.9);
            updateReceiptForm({ logoUrl: optimizedBase64 });
            toast.success('Custom café logo uploaded and optimized for thermal printing');
          } else {
            updateReceiptForm({ logoUrl: rawData });
            toast.success('Custom café logo uploaded successfully');
          }
        };
        img.src = rawData;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetDefaults = () => {
    if (documentMode === 'receipt') {
      updateReceiptForm(defaultReceiptCustomization);
      toast.info('Customer receipt template reset to default design.');
    } else {
      updateKotForm(defaultKotCustomization);
      toast.info('KOT template reset to default kitchen design.');
    }
  };

  const handleManualSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (documentMode === 'receipt') {
        const result = await settingsService.saveReceiptCustomization(receiptForm);
        if (!result.success) {
          toast.error(`Database save error: ${result.error || 'Could not save receipt'}`);
          return;
        }
        setSavedReceiptForm(receiptForm);
        toast.success('Receipt template saved to database & synced to Cashier in real-time!', {
          icon: '🖨️',
        });
      } else {
        const result = await settingsService.saveKotCustomization(kotForm);
        if (!result.success) {
          toast.error(`Database save error: ${result.error || 'Could not save KOT'}`);
          return;
        }
        setSavedKotForm(kotForm);
        toast.success('KOT template saved to database & synced to Kitchen in real-time!', {
          icon: '👨‍🍳',
        });
      }
    } catch (err: any) {
      toast.error(`Failed to save: ${err?.message || 'Database error occurred'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestPrint = () => {
    const targetId = documentMode === 'receipt' ? 'printable-receipt' : 'printable-kot';
    printThermalElement(targetId);
    toast.success(`Dispatched test ${documentMode === 'receipt' ? 'customer receipt' : 'KOT ticket'} slip.`);
  };

  const sampleOrder = SAMPLE_ORDERS[selectedSampleIndex];

  // Helper for divider lines in Receipt
  const getReceiptDivider = () => {
    switch (receiptForm.dividerStyle) {
      case 'double':
        return 'border-b-2 border-zinc-900';
      case 'dotted':
        return 'border-b border-dotted border-zinc-400';
      case 'solid':
        return 'border-b border-zinc-400';
      case 'dashed':
      default:
        return 'border-b border-dashed border-zinc-400';
    }
  };

  // Heading 1 (Store Name) Size & Bold
  const getHeading1Class = () => {
    const size =
      receiptForm.heading1Size === 'small'
        ? 'text-sm sm:text-base'
        : receiptForm.heading1Size === 'large'
        ? 'text-lg sm:text-xl'
        : receiptForm.heading1Size === 'xlarge'
        ? 'text-xl sm:text-2xl'
        : 'text-base sm:text-lg';
    const weight = receiptForm.heading1Bold !== false ? 'font-black' : 'font-normal';
    return `${size} ${weight}`;
  };

  // Heading 2 (Order # & Section Headers: Items, Totals, Payment) Size & Bold
  const getHeading2Class = () => {
    const size =
      receiptForm.heading2Size === 'small'
        ? 'text-[11px]'
        : receiptForm.heading2Size === 'large'
        ? 'text-sm'
        : 'text-xs';
    const weight = receiptForm.heading2Bold !== false ? 'font-black' : 'font-normal';
    return `${size} ${weight}`;
  };

  // Heading 3 (Line Item Names & Table #) Size & Bold
  const getHeading3Class = () => {
    const size =
      receiptForm.heading3Size === 'small'
        ? 'text-[11px]'
        : receiptForm.heading3Size === 'large'
        ? 'text-[13px]'
        : 'text-xs';
    const weight = receiptForm.heading3Bold !== false ? 'font-bold' : 'font-normal';
    return `${size} ${weight}`;
  };

  // Body weight (item notes, modifier prices, meta info)
  const getBodyWeightClass = () => {
    return receiptForm.bodyBold ? 'font-bold' : 'font-normal';
  };

  // Helper for divider lines in KOT
  const getKotDivider = () => {
    switch (kotForm.dividerStyle) {
      case 'double':
        return 'border-b-2 border-zinc-900';
      case 'dotted':
        return 'border-b-2 border-dotted border-zinc-400';
      case 'solid':
        return 'border-b-2 border-zinc-400';
      case 'dashed':
      default:
        return 'border-b-2 border-dashed border-zinc-400';
    }
  };

  const receiptTabs: { id: ReceiptTabKey; label: string; icon: React.ReactNode }[] = [
    { id: 'branding', label: 'Branding & Logo', icon: <Store className="w-4 h-4" /> },
    { id: 'metadata', label: 'Order Meta', icon: <Info className="w-4 h-4" /> },
    { id: 'items', label: 'Layout & Font', icon: <Type className="w-4 h-4" /> },
    { id: 'financials', label: 'Taxes & Totals', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'payments', label: 'Payments', icon: <Receipt className="w-4 h-4" /> },
    { id: 'footer', label: 'Footer & Wi-Fi', icon: <Share2 className="w-4 h-4" /> },
  ];

  const kotTabs: { id: KotTabKey; label: string; icon: React.ReactNode }[] = [
    { id: 'kot_header', label: 'Header & Title', icon: <ChefHat className="w-4 h-4" /> },
    { id: 'kot_meta', label: 'Order Identifiers', icon: <Tag className="w-4 h-4" /> },
    { id: 'kot_items', label: 'Items & Notes', icon: <Utensils className="w-4 h-4" /> },
    { id: 'kot_routing', label: 'Routing & Footer', icon: <Sliders className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-4 w-full pb-28 px-1 sm:px-3 animate-in fade-in">
      {/* 1. Top Document Mode Switcher (Customer Receipt vs KOT) */}
      <div className="flex items-center justify-between gap-3 flex-wrap bg-white p-2 sm:p-2.5 rounded-2xl border border-border shadow-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDocumentMode('receipt')}
            className={`flex items-center gap-2 px-4 sm:px-5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              documentMode === 'receipt'
                ? 'bg-brand-brown-dark text-white shadow-xs'
                : 'text-text-secondary hover:text-brand-brown-dark hover:bg-cream-100'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Customer Receipt (80mm)</span>
          </button>

          <button
            type="button"
            onClick={() => setDocumentMode('kot')}
            className={`flex items-center gap-2 px-4 sm:px-5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              documentMode === 'kot'
                ? 'bg-brand-teal text-white shadow-xs'
                : 'text-text-secondary hover:text-brand-teal hover:bg-brand-teal/10'
            }`}
          >
            <ChefHat className="w-4 h-4" />
            <span>Kitchen Order Ticket (KOT)</span>
          </button>
        </div>
      </div>

      {/* Mobile Mode Switcher (Visible only on screens below lg) */}
      <div className="flex lg:hidden bg-white p-1.5 rounded-2xl border border-border shadow-xs">
        <button
          type="button"
          onClick={() => setMobileView('editor')}
          className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            mobileView === 'editor'
              ? 'bg-brand-brown-dark text-white shadow-xs'
              : 'text-text-secondary hover:bg-cream-100'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Editor Settings</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileView('preview')}
          className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            mobileView === 'preview'
              ? 'bg-brand-brown-dark text-white shadow-xs'
              : 'text-text-secondary hover:bg-cream-100'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Live Slip Preview</span>
        </button>
      </div>

      {/* 2. Main Studio Grid (Responsive 2-Column on LG+, Tabbed on Mobile) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
        {/* LEFT COLUMN: Customizer Controls (7 cols on lg, full on mobile if editor view) */}
        <div className={`lg:col-span-7 space-y-4 ${mobileView === 'preview' ? 'hidden lg:block' : 'block'}`}>
          {/* ========================================================================= */}
          {/* MODE A: CUSTOMER RECEIPT CONTROLS                                         */}
          {/* ========================================================================= */}
          {documentMode === 'receipt' && (
            <>
              {/* Receipt Navigation Category Tabs */}
              <div className="bg-white p-2 rounded-2xl border border-border shadow-xs grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {receiptTabs.map((tab) => {
                  const isActive = receiptTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setReceiptTab(tab.id)}
                      className={`py-2.5 px-2 rounded-xl text-[11.5px] font-black transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer text-center ${
                        isActive
                          ? 'bg-brand-brown-dark text-white shadow-xs'
                          : 'text-text-secondary hover:bg-cream-100 hover:text-brand-brown-dark'
                      }`}
                    >
                      {tab.icon}
                      <span className="truncate">{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* RECEIPT TAB 1: BRANDING & LOGO */}
              {receiptTab === 'branding' && (
                <div className="bg-white p-5 sm:p-7 rounded-3xl border border-border shadow-soft space-y-5 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="font-black text-sm text-brand-brown-dark flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-brand-teal" />
                      <span>Logo & Brand Header Details</span>
                    </div>
                  </div>

                  {/* Logo Controls */}
                  <div className="space-y-4 p-4 sm:p-5 rounded-2xl bg-cream-50/80 border border-border">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={receiptForm.showLogo}
                          onChange={(e) => updateReceiptForm({ showLogo: e.target.checked })}
                          className="w-4 h-4 rounded text-brand-teal cursor-pointer accent-brand-teal"
                        />
                        <div>
                          <div className="text-xs font-black text-brand-brown-dark">Display Business Logo on Receipt</div>
                          <div className="text-[10.5px] text-text-secondary">Prints high-contrast café logo at top of slip</div>
                        </div>
                      </label>

                      {receiptForm.showLogo && (
                        <div className="w-12 h-12 rounded-xl bg-white border border-border p-1 flex items-center justify-center shadow-xs">
                          <img src={receiptForm.logoUrl || '/logobg.webp'} alt="Logo" className="max-h-full max-w-full object-contain" />
                        </div>
                      )}
                    </div>

                    {receiptForm.showLogo && (
                      <div className="space-y-3.5 pt-3 border-t border-border/80">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <div className="flex justify-between items-center text-[11px] font-bold uppercase text-text-secondary">
                              <span>Logo Width</span>
                              <div className="flex items-center gap-1 font-mono text-brand-teal">
                                <input
                                  type="number"
                                  min="40"
                                  max="300"
                                  value={receiptForm.logoWidthPx}
                                  onChange={(e) =>
                                    updateReceiptForm({
                                      logoWidthPx: Math.min(300, Math.max(30, Number(e.target.value) || 40)),
                                    })
                                  }
                                  className="w-16 px-1.5 py-0.5 text-right font-mono font-bold text-xs bg-cream-50 border border-border rounded-lg text-brand-brown-dark"
                                />
                                <span className="text-[10px] text-text-muted">px</span>
                              </div>
                            </div>
                            <input
                              type="range"
                              min="40"
                              max="280"
                              step="5"
                              value={receiptForm.logoWidthPx}
                              onChange={(e) => updateReceiptForm({ logoWidthPx: Number(e.target.value) })}
                              className="w-full mt-2 accent-brand-teal cursor-pointer"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-bold uppercase text-text-secondary">Logo Alignment</label>
                            <div className="grid grid-cols-2 gap-2 mt-1.5">
                              <button
                                type="button"
                                onClick={() => updateReceiptForm({ logoAlignment: 'center' })}
                                className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                                  receiptForm.logoAlignment === 'center' ? 'bg-brand-teal text-white border-brand-teal shadow-xs' : 'bg-white border-border text-text-secondary'
                                }`}
                              >
                                Center
                              </button>
                              <button
                                type="button"
                                onClick={() => updateReceiptForm({ logoAlignment: 'left' })}
                                className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                                  receiptForm.logoAlignment === 'left' ? 'bg-brand-teal text-white border-brand-teal shadow-xs' : 'bg-white border-border text-text-secondary'
                                }`}
                              >
                                Left
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Single-Line Center-Origin Logo Up/Down Slider */}
                        <div className="pt-2 border-t border-border/70 space-y-1.5">
                          <div className="flex justify-between items-center text-[11px] font-bold uppercase text-text-secondary">
                            <span className="flex items-center gap-1.5">
                              <span>Logo Position (Up / Down)</span>
                              <span className="text-[10px] text-text-muted lowercase font-normal">(center is default)</span>
                            </span>
                            <div className="flex items-center gap-2">
                              {(receiptForm.logoOffsetYPx ?? 0) !== 0 && (
                                <button
                                  type="button"
                                  onClick={() => updateReceiptForm({ logoOffsetYPx: 0 })}
                                  className="text-[10.5px] font-bold text-brand-teal hover:underline cursor-pointer"
                                  title="Reset logo to center default position"
                                >
                                  Reset Center
                                </button>
                              )}
                              <div className="flex items-center gap-1 font-mono text-brand-teal bg-cream-50 px-2.5 py-0.5 rounded-lg border border-border">
                                <span className="font-extrabold text-xs">
                                  {(receiptForm.logoOffsetYPx ?? 0) > 0
                                    ? `+${receiptForm.logoOffsetYPx} px (Up)`
                                    : (receiptForm.logoOffsetYPx ?? 0) < 0
                                    ? `${receiptForm.logoOffsetYPx} px (Down)`
                                    : '0 px (Center)'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="relative py-1">
                            {/* Center Guideline Indicator */}
                            <div
                              className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-1 h-3.5 bg-zinc-400/80 rounded-full pointer-events-none z-10"
                              title="Center (0px Default)"
                            />
                            <input
                              type="range"
                              min="-40"
                              max="40"
                              step="2"
                              value={receiptForm.logoOffsetYPx ?? 0}
                              onChange={(e) => updateReceiptForm({ logoOffsetYPx: Number(e.target.value) })}
                              className="w-full accent-brand-teal cursor-pointer"
                            />
                          </div>

                          <div className="flex justify-between items-center text-[10px] font-bold mt-0.5 px-0.5">
                            <span className="text-amber-700">← Move Down (Left)</span>
                            <span className="text-zinc-500 font-extrabold">● Center (0px)</span>
                            <span className="text-brand-teal">Move Up (Right) →</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <label className="px-3.5 py-2 bg-white border border-border rounded-xl text-xs font-bold text-brand-brown-dark hover:bg-cream-100 transition-all cursor-pointer flex items-center gap-2 shadow-xs">
                            <Upload className="w-3.5 h-3.5" />
                            <span>Upload Custom Logo</span>
                            <input type="file" accept="image/*" onChange={handleLogoFileUpload} className="hidden" />
                          </label>
                          <button
                            type="button"
                            onClick={() => updateReceiptForm({ logoUrl: '/logobg.webp' })}
                            className="px-3 py-2 text-xs font-bold text-text-secondary hover:text-brand-brown-dark cursor-pointer"
                          >
                            Reset Default Logo
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Brand Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold uppercase text-text-secondary">Business Name</label>
                      <input
                        type="text"
                        value={receiptForm.businessName}
                        onChange={(e) => updateReceiptForm({ businessName: e.target.value })}
                        className="w-full mt-1.5 px-3.5 py-2.5 bg-cream-50 border border-border rounded-xl text-xs font-bold text-brand-brown-dark focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase text-text-secondary">Tagline / Slogan</label>
                      <input
                        type="text"
                        value={receiptForm.tagline}
                        onChange={(e) => updateReceiptForm({ tagline: e.target.value })}
                        className="w-full mt-1.5 px-3.5 py-2.5 bg-cream-50 border border-border rounded-xl text-xs font-bold text-brand-brown-dark focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold uppercase text-text-secondary">Contact Phone</label>
                      <input
                        type="text"
                        value={receiptForm.phone}
                        onChange={(e) => updateReceiptForm({ phone: e.target.value })}
                        className="w-full mt-1.5 px-3.5 py-2.5 bg-cream-50 border border-border rounded-xl text-xs font-bold text-brand-brown-dark focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase text-text-secondary">Store Address</label>
                      <input
                        type="text"
                        value={receiptForm.address}
                        onChange={(e) => updateReceiptForm({ address: e.target.value })}
                        className="w-full mt-1.5 px-3.5 py-2.5 bg-cream-50 border border-border rounded-xl text-xs font-bold text-brand-brown-dark focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 transition-all"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* RECEIPT TAB 2: ORDER METADATA */}
              {receiptTab === 'metadata' && (
                <div className="bg-white p-5 sm:p-7 rounded-3xl border border-border shadow-soft space-y-4 animate-in fade-in duration-150">
                  <div className="font-black text-sm text-brand-brown-dark border-b border-border pb-3 flex items-center gap-2">
                    <Info className="w-4 h-4 text-brand-teal" />
                    <span>Order Meta & Header Information</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="p-3.5 rounded-2xl bg-cream-50/80 border border-border flex items-center gap-3 cursor-pointer hover:bg-cream-100 transition-all">
                      <input
                        type="checkbox"
                        checked={receiptForm.showOrderNumber}
                        onChange={(e) => updateReceiptForm({ showOrderNumber: e.target.checked })}
                        className="w-4 h-4 rounded text-brand-teal accent-brand-teal cursor-pointer"
                      />
                      <div>
                        <div className="text-xs font-black text-brand-brown-dark">Print Order Number</div>
                        <div className="text-[10px] text-text-secondary">e.g. Order: #1050</div>
                      </div>
                    </label>

                    <label className="p-3.5 rounded-2xl bg-cream-50/80 border border-border flex items-center gap-3 cursor-pointer hover:bg-cream-100 transition-all">
                      <input
                        type="checkbox"
                        checked={receiptForm.showOrderType}
                        onChange={(e) => updateReceiptForm({ showOrderType: e.target.checked })}
                        className="w-4 h-4 rounded text-brand-teal accent-brand-teal cursor-pointer"
                      />
                      <div>
                        <div className="text-xs font-black text-brand-brown-dark">Print Order Type</div>
                        <div className="text-[10px] text-text-secondary">Dine In / Takeaway badge</div>
                      </div>
                    </label>

                    <label className="p-3.5 rounded-2xl bg-cream-50/80 border border-border flex items-center gap-3 cursor-pointer hover:bg-cream-100 transition-all">
                      <input
                        type="checkbox"
                        checked={receiptForm.showTableNumber}
                        onChange={(e) => updateReceiptForm({ showTableNumber: e.target.checked })}
                        className="w-4 h-4 rounded text-brand-teal accent-brand-teal cursor-pointer"
                      />
                      <div>
                        <div className="text-xs font-black text-brand-brown-dark">Print Table Number</div>
                        <div className="text-[10px] text-text-secondary">For Dine In table orders</div>
                      </div>
                    </label>

                    <label className="p-3.5 rounded-2xl bg-cream-50/80 border border-border flex items-center gap-3 cursor-pointer hover:bg-cream-100 transition-all">
                      <input
                        type="checkbox"
                        checked={receiptForm.showDateTime}
                        onChange={(e) => updateReceiptForm({ showDateTime: e.target.checked })}
                        className="w-4 h-4 rounded text-brand-teal accent-brand-teal cursor-pointer"
                      />
                      <div>
                        <div className="text-xs font-black text-brand-brown-dark">Print Date & Time</div>
                        <div className="text-[10px] text-text-secondary">Timestamp of order creation</div>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* RECEIPT TAB 3: LAYOUT & FONT */}
              {receiptTab === 'items' && (
                <div className="bg-white p-5 sm:p-7 rounded-3xl border border-border shadow-soft space-y-6 animate-in fade-in duration-150">
                  <div className="font-black text-sm text-brand-brown-dark border-b border-border pb-3 flex items-center gap-2">
                    <Type className="w-4 h-4 text-brand-teal" />
                    <span>Receipt Paper & Typography Layout</span>
                  </div>

                  {/* 1. Paper Width & Divider Style */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold uppercase text-text-secondary">Paper Width</label>
                      <div className="grid grid-cols-2 gap-2 mt-1.5">
                        <button
                          type="button"
                          onClick={() => updateReceiptForm({ paperWidthMm: 80 })}
                          className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                            receiptForm.paperWidthMm === 80
                              ? 'bg-brand-teal text-white border-brand-teal shadow-xs'
                              : 'bg-cream-50 border-border text-text-secondary hover:bg-cream-100'
                          }`}
                        >
                          80mm (Standard)
                        </button>
                        <button
                          type="button"
                          onClick={() => updateReceiptForm({ paperWidthMm: 58 })}
                          className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                            receiptForm.paperWidthMm === 58
                              ? 'bg-brand-teal text-white border-brand-teal shadow-xs'
                              : 'bg-cream-50 border-border text-text-secondary hover:bg-cream-100'
                          }`}
                        >
                          58mm (Narrow)
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold uppercase text-text-secondary">Divider Line Style</label>
                      <select
                        value={receiptForm.dividerStyle}
                        onChange={(e) => updateReceiptForm({ dividerStyle: e.target.value as any })}
                        className="w-full mt-1.5 px-3.5 py-2.5 bg-cream-50 border border-border rounded-xl text-xs font-bold text-brand-brown-dark cursor-pointer shadow-xs"
                      >
                        <option value="dashed">Dashed Line (-----)</option>
                        <option value="dotted">Dotted Line (.....)</option>
                        <option value="solid">Solid Thin Line</option>
                        <option value="double">Double Solid Line</option>
                      </select>
                    </div>
                  </div>

                  {/* 2. Font Family (Typeface) */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-cream-50/80 border border-border space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-brand-brown-dark">Bill Font Style (Typeface)</label>
                      <span className="text-[10.5px] font-mono text-brand-teal font-bold uppercase">
                        {receiptForm.fontFamily === 'courier' ? 'Courier New' : receiptForm.fontFamily === 'sans' ? 'Modern Sans' : 'Thermal Monospace'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2.5">
                      <button
                        type="button"
                        onClick={() => updateReceiptForm({ fontFamily: 'mono' })}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                          receiptForm.fontFamily === 'mono'
                            ? 'bg-brand-teal text-white border-brand-teal shadow-xs'
                            : 'bg-white border-border text-text-secondary hover:bg-cream-100'
                        }`}
                      >
                        <div className="text-xs font-mono font-bold">Monospace</div>
                        <div className="text-[9.5px] opacity-80 mt-0.5">Classic Thermal</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => updateReceiptForm({ fontFamily: 'courier' })}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                          receiptForm.fontFamily === 'courier'
                            ? 'bg-brand-teal text-white border-brand-teal shadow-xs'
                            : 'bg-white border-border text-text-secondary hover:bg-cream-100'
                        }`}
                      >
                        <div className="text-xs font-serif font-bold">Courier</div>
                        <div className="text-[9.5px] opacity-80 mt-0.5">Retro Typewriter</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => updateReceiptForm({ fontFamily: 'sans' })}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                          receiptForm.fontFamily === 'sans'
                            ? 'bg-brand-teal text-white border-brand-teal shadow-xs'
                            : 'bg-white border-border text-text-secondary hover:bg-cream-100'
                        }`}
                      >
                        <div className="text-xs font-sans font-bold">Sans-Serif</div>
                        <div className="text-[9.5px] opacity-80 mt-0.5">Modern Crisp</div>
                      </button>
                    </div>
                  </div>

                  {/* 3. Heading 1 (Store Name) Size & Bold Controls */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-cream-50/80 border border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-black text-brand-brown-dark">Heading 1: Store / Café Name</div>
                        <div className="text-[10px] text-text-secondary">Main branding header at top of bill</div>
                      </div>
                      {/* Bold / Not Bold Toggle */}
                      <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-border">
                        <button
                          type="button"
                          onClick={() => updateReceiptForm({ heading1Bold: true })}
                          className={`px-3 py-1 text-xs font-black rounded-lg transition-all cursor-pointer ${
                            receiptForm.heading1Bold !== false
                              ? 'bg-brand-brown-dark text-white shadow-xs'
                              : 'text-text-secondary hover:text-brand-brown-dark'
                          }`}
                        >
                          Bold
                        </button>
                        <button
                          type="button"
                          onClick={() => updateReceiptForm({ heading1Bold: false })}
                          className={`px-3 py-1 text-xs font-normal rounded-lg transition-all cursor-pointer ${
                            receiptForm.heading1Bold === false
                              ? 'bg-brand-brown-dark text-white shadow-xs'
                              : 'text-text-secondary hover:text-brand-brown-dark'
                          }`}
                        >
                          Not Bold
                        </button>
                      </div>
                    </div>

                    {/* Size Selector */}
                    <div className="grid grid-cols-4 gap-2">
                      {(['small', 'normal', 'large', 'xlarge'] as const).map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => updateReceiptForm({ heading1Size: sz })}
                          className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center capitalize ${
                            (receiptForm.heading1Size || 'large') === sz
                              ? 'bg-brand-teal text-white border-brand-teal shadow-xs'
                              : 'bg-white border-border text-text-secondary hover:bg-cream-100'
                          }`}
                        >
                          {sz === 'xlarge' ? 'XL (22px)' : sz === 'large' ? 'Large (18px)' : sz === 'normal' ? 'Normal (16px)' : 'Small (14px)'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 4. Heading 2 (Order # & Section Titles) Size & Bold Controls */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-cream-50/80 border border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-black text-brand-brown-dark">Heading 2: Order # & Section Titles</div>
                        <div className="text-[10px] text-text-secondary">Order reference, ITEM header, and summary titles</div>
                      </div>
                      {/* Bold / Not Bold Toggle */}
                      <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-border">
                        <button
                          type="button"
                          onClick={() => updateReceiptForm({ heading2Bold: true })}
                          className={`px-3 py-1 text-xs font-black rounded-lg transition-all cursor-pointer ${
                            receiptForm.heading2Bold !== false
                              ? 'bg-brand-brown-dark text-white shadow-xs'
                              : 'text-text-secondary hover:text-brand-brown-dark'
                          }`}
                        >
                          Bold
                        </button>
                        <button
                          type="button"
                          onClick={() => updateReceiptForm({ heading2Bold: false })}
                          className={`px-3 py-1 text-xs font-normal rounded-lg transition-all cursor-pointer ${
                            receiptForm.heading2Bold === false
                              ? 'bg-brand-brown-dark text-white shadow-xs'
                              : 'text-text-secondary hover:text-brand-brown-dark'
                          }`}
                        >
                          Not Bold
                        </button>
                      </div>
                    </div>

                    {/* Size Selector */}
                    <div className="grid grid-cols-3 gap-2">
                      {(['small', 'normal', 'large'] as const).map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => updateReceiptForm({ heading2Size: sz })}
                          className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center capitalize ${
                            (receiptForm.heading2Size || 'normal') === sz
                              ? 'bg-brand-teal text-white border-brand-teal shadow-xs'
                              : 'bg-white border-border text-text-secondary hover:bg-cream-100'
                          }`}
                        >
                          {sz === 'large' ? 'Large (15px)' : sz === 'normal' ? 'Normal (13px)' : 'Small (11px)'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 5. Heading 3 (Line Item Names & Table Number) Size & Bold Controls */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-cream-50/80 border border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-black text-brand-brown-dark">Heading 3: Item Names & Table Number</div>
                        <div className="text-[10px] text-text-secondary">Purchased item labels and table indicators</div>
                      </div>
                      {/* Bold / Not Bold Toggle */}
                      <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-border">
                        <button
                          type="button"
                          onClick={() => updateReceiptForm({ heading3Bold: true })}
                          className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                            receiptForm.heading3Bold !== false
                              ? 'bg-brand-brown-dark text-white shadow-xs'
                              : 'text-text-secondary hover:text-brand-brown-dark'
                          }`}
                        >
                          Bold
                        </button>
                        <button
                          type="button"
                          onClick={() => updateReceiptForm({ heading3Bold: false })}
                          className={`px-3 py-1 text-xs font-normal rounded-lg transition-all cursor-pointer ${
                            receiptForm.heading3Bold === false
                              ? 'bg-brand-brown-dark text-white shadow-xs'
                              : 'text-text-secondary hover:text-brand-brown-dark'
                          }`}
                        >
                          Not Bold
                        </button>
                      </div>
                    </div>

                    {/* Size Selector */}
                    <div className="grid grid-cols-3 gap-2">
                      {(['small', 'normal', 'large'] as const).map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => updateReceiptForm({ heading3Size: sz })}
                          className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center capitalize ${
                            (receiptForm.heading3Size || 'normal') === sz
                              ? 'bg-brand-teal text-white border-brand-teal shadow-xs'
                              : 'bg-white border-border text-text-secondary hover:bg-cream-100'
                          }`}
                        >
                          {sz === 'large' ? 'Large (14px)' : sz === 'normal' ? 'Normal (12px)' : 'Small (11px)'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 6. Body & Item Details Weight Toggle */}
                  <div className="p-4 rounded-2xl bg-cream-50/80 border border-border flex items-center justify-between">
                    <div>
                      <div className="text-xs font-black text-brand-brown-dark">Prices & Details Text Weight</div>
                      <div className="text-[10px] text-text-secondary">Item notes, unit prices, and payment breakdown</div>
                    </div>
                    <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-border">
                      <button
                        type="button"
                        onClick={() => updateReceiptForm({ bodyBold: true })}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          receiptForm.bodyBold
                            ? 'bg-brand-brown-dark text-white shadow-xs'
                            : 'text-text-secondary hover:text-brand-brown-dark'
                        }`}
                      >
                        Bold
                      </button>
                      <button
                        type="button"
                        onClick={() => updateReceiptForm({ bodyBold: false })}
                        className={`px-3 py-1 text-xs font-normal rounded-lg transition-all cursor-pointer ${
                          !receiptForm.bodyBold
                            ? 'bg-brand-brown-dark text-white shadow-xs'
                            : 'text-text-secondary hover:text-brand-brown-dark'
                        }`}
                      >
                        Not Bold
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* RECEIPT TAB 4: TAXES & TOTALS */}
              {receiptTab === 'financials' && (
                <div className="bg-white p-5 sm:p-7 rounded-3xl border border-border shadow-soft space-y-4 animate-in fade-in duration-150">
                  <div className="font-black text-sm text-brand-brown-dark border-b border-border pb-3 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-brand-teal" />
                    <span>Financial Breakdown & Tax Visibility</span>
                  </div>

                  <div className="space-y-3">
                    <label className="p-3.5 rounded-2xl bg-cream-50/80 border border-border flex items-center gap-3 cursor-pointer hover:bg-cream-100 transition-all">
                      <input
                        type="checkbox"
                        checked={receiptForm.showSubtotal}
                        onChange={(e) => updateReceiptForm({ showSubtotal: e.target.checked })}
                        className="w-4 h-4 rounded text-brand-teal accent-brand-teal cursor-pointer"
                      />
                      <div>
                        <div className="text-xs font-black text-brand-brown-dark">Display Subtotal</div>
                        <div className="text-[10px] text-text-secondary">Subtotal before discount & taxes</div>
                      </div>
                    </label>

                    <label className="p-3.5 rounded-2xl bg-cream-50/80 border border-border flex items-center gap-3 cursor-pointer hover:bg-cream-100 transition-all">
                      <input
                        type="checkbox"
                        checked={receiptForm.showDiscount}
                        onChange={(e) => updateReceiptForm({ showDiscount: e.target.checked })}
                        className="w-4 h-4 rounded text-brand-teal accent-brand-teal cursor-pointer"
                      />
                      <div>
                        <div className="text-xs font-black text-brand-brown-dark">Display Discounts / Points Deductions</div>
                        <div className="text-[10px] text-text-secondary">Shows discount line if applied</div>
                      </div>
                    </label>

                    <label className="p-3.5 rounded-2xl bg-cream-50/80 border border-border flex items-center gap-3 cursor-pointer hover:bg-cream-100 transition-all">
                      <input
                        type="checkbox"
                        checked={receiptForm.showServiceCharge}
                        onChange={(e) => updateReceiptForm({ showServiceCharge: e.target.checked })}
                        className="w-4 h-4 rounded text-brand-teal accent-brand-teal cursor-pointer"
                      />
                      <div>
                        <div className="text-xs font-black text-brand-brown-dark">Display Service Charge</div>
                        <div className="text-[10px] text-text-secondary">
                          Rate ({systemSettings.serviceChargePercent}%) automatically syncs in real-time from Admin Settings
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* RECEIPT TAB 5: PAYMENTS */}
              {receiptTab === 'payments' && (
                <div className="bg-white p-5 sm:p-7 rounded-3xl border border-border shadow-soft space-y-4 animate-in fade-in duration-150">
                  <div className="font-black text-sm text-brand-brown-dark border-b border-border pb-3 flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-brand-teal" />
                    <span>Payment Method & Cash Breakdown</span>
                  </div>

                  <div className="space-y-3">
                    <label className="p-3.5 rounded-2xl bg-cream-50/80 border border-border flex items-center gap-3 cursor-pointer hover:bg-cream-100 transition-all">
                      <input
                        type="checkbox"
                        checked={receiptForm.showPaymentMethod}
                        onChange={(e) => updateReceiptForm({ showPaymentMethod: e.target.checked })}
                        className="w-4 h-4 rounded text-brand-teal accent-brand-teal cursor-pointer"
                      />
                      <div>
                        <div className="text-xs font-black text-brand-brown-dark">Show Payment Method Badge</div>
                        <div className="text-[10px] text-text-secondary">e.g. CASH / CARD / SPLIT</div>
                      </div>
                    </label>

                    <label className="p-3.5 rounded-2xl bg-cream-50/80 border border-border flex items-center gap-3 cursor-pointer hover:bg-cream-100 transition-all">
                      <input
                        type="checkbox"
                        checked={receiptForm.showCashBreakdown}
                        onChange={(e) => updateReceiptForm({ showCashBreakdown: e.target.checked })}
                        className="w-4 h-4 rounded text-brand-teal accent-brand-teal cursor-pointer"
                      />
                      <div>
                        <div className="text-xs font-black text-brand-brown-dark">Show Cash Received & Change Given</div>
                        <div className="text-[10px] text-text-secondary">Tender breakdown for cash transactions</div>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* RECEIPT TAB 6: FOOTER & WI-FI */}
              {receiptTab === 'footer' && (
                <div className="bg-white p-5 sm:p-7 rounded-3xl border border-border shadow-soft space-y-4 animate-in fade-in duration-150">
                  <div className="font-black text-sm text-brand-brown-dark border-b border-border pb-3 flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-brand-teal" />
                    <span>Footer Message & Wi-Fi Details</span>
                  </div>

                  <label className="p-3.5 rounded-2xl bg-cream-50/80 border border-border flex items-center gap-3 cursor-pointer hover:bg-cream-100 transition-all">
                    <input
                      type="checkbox"
                      checked={receiptForm.showCustomerInfo}
                      onChange={(e) => updateReceiptForm({ showCustomerInfo: e.target.checked })}
                      className="w-4 h-4 rounded text-brand-teal accent-brand-teal cursor-pointer"
                    />
                    <div>
                      <div className="text-xs font-black text-brand-brown-dark">Print Customer Name on Footer (If Available)</div>
                      <div className="text-[10px] text-text-secondary">Shows customer name in the footer section when attached to order</div>
                    </div>
                  </label>

                  <div>
                    <label className="text-xs font-bold uppercase text-text-secondary">Custom Receipt Footer Message</label>
                    <textarea
                      rows={3}
                      value={receiptForm.receiptFooter}
                      onChange={(e) => updateReceiptForm({ receiptFooter: e.target.value })}
                      className="w-full mt-1.5 p-3.5 bg-cream-50 border border-border rounded-xl text-xs font-bold text-brand-brown-dark focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 transition-all"
                    />
                  </div>

                  {/* Wi-Fi with Checkbox */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-cream-50/80 border border-border space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={receiptForm.showWifiInfo}
                        onChange={(e) => updateReceiptForm({ showWifiInfo: e.target.checked })}
                        className="w-4 h-4 rounded text-brand-teal accent-brand-teal cursor-pointer"
                      />
                      <div>
                        <div className="text-xs font-black text-brand-brown-dark">Print Guest Wi-Fi Details on Receipt</div>
                        <div className="text-[10px] text-text-secondary">Prints Wi-Fi Network Name & Password at bottom</div>
                      </div>
                    </label>

                    {receiptForm.showWifiInfo && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-3 border-t border-border/80">
                        <div>
                          <label className="text-[11px] font-bold uppercase text-text-secondary">Wi-Fi Network Name (SSID)</label>
                          <input
                            type="text"
                            value={receiptForm.wifiSsid}
                            onChange={(e) => updateReceiptForm({ wifiSsid: e.target.value })}
                            placeholder="ChillAndChoc_Guest"
                            className="w-full mt-1.5 px-3.5 py-2.5 bg-white border border-border rounded-xl text-xs font-bold text-brand-brown-dark focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 transition-all"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold uppercase text-text-secondary">Wi-Fi Password</label>
                          <input
                            type="text"
                            value={receiptForm.wifiPassword || ''}
                            onChange={(e) => updateReceiptForm({ wifiPassword: e.target.value })}
                            placeholder="sweetbites2026"
                            className="w-full mt-1.5 px-3.5 py-2.5 bg-white border border-border rounded-xl text-xs font-bold text-brand-brown-dark focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 transition-all"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ========================================================================= */}
          {/* MODE B: KITCHEN ORDER TICKET (KOT) CONTROLS                               */}
          {/* ========================================================================= */}
          {documentMode === 'kot' && (
            <>
              {/* KOT Navigation Category Tabs */}
              <div className="bg-white p-2 rounded-2xl border border-border shadow-xs grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {kotTabs.map((tab) => {
                  const isActive = kotTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setKotTab(tab.id)}
                      className={`py-2.5 px-2 rounded-xl text-[11.5px] font-black transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer text-center ${
                        isActive
                          ? 'bg-brand-teal text-white shadow-xs'
                          : 'text-text-secondary hover:bg-cream-100 hover:text-brand-teal'
                      }`}
                    >
                      {tab.icon}
                      <span className="truncate">{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* KOT TAB 1: HEADER & TITLE */}
              {kotTab === 'kot_header' && (
                <div className="bg-white p-5 sm:p-7 rounded-3xl border border-border shadow-soft space-y-5 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="font-black text-sm text-brand-brown-dark flex items-center gap-2">
                      <ChefHat className="w-4 h-4 text-brand-teal" />
                      <span>KOT Header & Ticket Title Settings</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold uppercase text-text-secondary">Ticket Title Badge</label>
                      <input
                        type="text"
                        value={kotForm.ticketTitle}
                        onChange={(e) => updateKotForm({ ticketTitle: e.target.value })}
                        placeholder="KITCHEN ORDER TICKET"
                        className="w-full mt-1.5 px-3.5 py-2.5 bg-cream-50 border border-border rounded-xl text-xs font-bold text-brand-brown-dark focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 transition-all font-mono uppercase"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold uppercase text-text-secondary">Brand Name on Ticket</label>
                      <input
                        type="text"
                        value={kotForm.brandName}
                        onChange={(e) => updateKotForm({ brandName: e.target.value })}
                        placeholder="CHILL & CHOC"
                        className="w-full mt-1.5 px-3.5 py-2.5 bg-cream-50 border border-border rounded-xl text-xs font-bold text-brand-brown-dark focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 transition-all font-mono uppercase"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold uppercase text-text-secondary">Divider Line Style</label>
                      <select
                        value={kotForm.dividerStyle}
                        onChange={(e) => updateKotForm({ dividerStyle: e.target.value as any })}
                        className="w-full mt-1.5 px-3.5 py-2.5 bg-cream-50 border border-border rounded-xl text-xs font-bold text-brand-brown-dark cursor-pointer shadow-xs"
                      >
                        <option value="dashed">Dashed Line (-----)</option>
                        <option value="dotted">Dotted Line (.....)</option>
                        <option value="solid">Solid Line</option>
                        <option value="double">Double Solid Line</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold uppercase text-text-secondary">KOT Paper Width</label>
                      <div className="grid grid-cols-2 gap-2 mt-1.5">
                        <button
                          type="button"
                          onClick={() => updateKotForm({ paperWidthMm: 80 })}
                          className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                            kotForm.paperWidthMm === 80 ? 'bg-brand-teal text-white border-brand-teal shadow-xs' : 'bg-cream-50 border-border text-text-secondary'
                          }`}
                        >
                          80mm (Standard)
                        </button>
                        <button
                          type="button"
                          onClick={() => updateKotForm({ paperWidthMm: 58 })}
                          className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                            kotForm.paperWidthMm === 58 ? 'bg-brand-teal text-white border-brand-teal shadow-xs' : 'bg-cream-50 border-border text-text-secondary'
                          }`}
                        >
                          58mm (Narrow)
                        </button>
                      </div>
                    </div>
                  </div>

                  <label className="p-3.5 rounded-2xl bg-cream-50/80 border border-border flex items-center gap-3 cursor-pointer hover:bg-cream-100 transition-all">
                    <input
                      type="checkbox"
                      checked={kotForm.showBrandName}
                      onChange={(e) => updateKotForm({ showBrandName: e.target.checked })}
                      className="w-4 h-4 rounded text-brand-teal accent-brand-teal cursor-pointer"
                    />
                    <div>
                      <div className="text-xs font-black text-brand-brown-dark">Display Café Brand Name on Ticket</div>
                      <div className="text-[10.5px] text-text-secondary">Prints '{kotForm.brandName}' above ticket title</div>
                    </div>
                  </label>
                </div>
              )}

              {/* KOT TAB 2: ORDER IDENTIFIERS */}
              {kotTab === 'kot_meta' && (
                <div className="bg-white p-5 sm:p-7 rounded-3xl border border-border shadow-soft space-y-4 animate-in fade-in duration-150">
                  <div className="font-black text-sm text-brand-brown-dark border-b border-border pb-3 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-brand-teal" />
                    <span>Order Identifiers & Table Number Display</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold uppercase text-text-secondary">Order # Prefix</label>
                      <input
                        type="text"
                        value={kotForm.orderNumberPrefix}
                        onChange={(e) => updateKotForm({ orderNumberPrefix: e.target.value })}
                        placeholder="#"
                        className="w-full mt-1.5 px-3.5 py-2.5 bg-cream-50 border border-border rounded-xl text-xs font-bold text-brand-brown-dark focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 transition-all font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold uppercase text-text-secondary">Staff / Cashier Label</label>
                      <input
                        type="text"
                        value={kotForm.cashierLabel}
                        onChange={(e) => updateKotForm({ cashierLabel: e.target.value })}
                        placeholder="Staff"
                        className="w-full mt-1.5 px-3.5 py-2.5 bg-cream-50 border border-border rounded-xl text-xs font-bold text-brand-brown-dark focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 transition-all"
                      />
                    </div>
                  </div>

                  {/* Table Number Style */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-cream-50/80 border border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-black text-brand-brown-dark">Table Number Layout</div>
                        <div className="text-[10.5px] text-text-secondary">Choose how dine-in tables are highlighted for kitchen staff</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => updateKotForm({ tableNumberStyle: 'prominent' })}
                        className={`p-3 text-left rounded-xl border transition-all cursor-pointer ${
                          kotForm.tableNumberStyle === 'prominent'
                            ? 'bg-brand-teal text-white border-brand-teal shadow-xs'
                            : 'bg-white border-border text-text-secondary hover:bg-cream-100'
                        }`}
                      >
                        <div className="text-xs font-black">Prominent Large Banner</div>
                        <div className="text-[10px] opacity-80 mt-0.5">Extra-large box for instant recognition</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => updateKotForm({ tableNumberStyle: 'standard' })}
                        className={`p-3 text-left rounded-xl border transition-all cursor-pointer ${
                          kotForm.tableNumberStyle === 'standard'
                            ? 'bg-brand-teal text-white border-brand-teal shadow-xs'
                            : 'bg-white border-border text-text-secondary hover:bg-cream-100'
                        }`}
                      >
                        <div className="text-xs font-black">Standard Inline Row</div>
                        <div className="text-[10px] opacity-80 mt-0.5">Compact single-line table text</div>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="p-3.5 rounded-2xl bg-cream-50/80 border border-border flex items-center gap-3 cursor-pointer hover:bg-cream-100 transition-all">
                      <input
                        type="checkbox"
                        checked={kotForm.showOrderType}
                        onChange={(e) => updateKotForm({ showOrderType: e.target.checked })}
                        className="w-4 h-4 rounded text-brand-teal accent-brand-teal cursor-pointer"
                      />
                      <div>
                        <div className="text-xs font-black text-brand-brown-dark">Show Order Type (Dine In / Takeaway)</div>
                        <div className="text-[10px] text-text-secondary">Distinctive badge for kitchen packing</div>
                      </div>
                    </label>

                    <label className="p-3.5 rounded-2xl bg-cream-50/80 border border-border flex items-center gap-3 cursor-pointer hover:bg-cream-100 transition-all">
                      <input
                        type="checkbox"
                        checked={kotForm.showDateTime}
                        onChange={(e) => updateKotForm({ showDateTime: e.target.checked })}
                        className="w-4 h-4 rounded text-brand-teal accent-brand-teal cursor-pointer"
                      />
                      <div>
                        <div className="text-xs font-black text-brand-brown-dark">Show Order Timestamp</div>
                        <div className="text-[10px] text-text-secondary">Helps kitchen track preparation time</div>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* KOT TAB 3: ITEMS & NOTES */}
              {kotTab === 'kot_items' && (
                <div className="bg-white p-5 sm:p-7 rounded-3xl border border-border shadow-soft space-y-4 animate-in fade-in duration-150">
                  <div className="font-black text-sm text-brand-brown-dark border-b border-border pb-3 flex items-center gap-2">
                    <Utensils className="w-4 h-4 text-brand-teal" />
                    <span>Kitchen Items, Modifiers & Allergy Notes</span>
                  </div>

                  <div className="space-y-3">
                    <label className="p-3.5 rounded-2xl bg-cream-50/80 border border-border flex items-center gap-3 cursor-pointer hover:bg-cream-100 transition-all">
                      <input
                        type="checkbox"
                        checked={kotForm.showModifiers}
                        onChange={(e) => updateKotForm({ showModifiers: e.target.checked })}
                        className="w-4 h-4 rounded text-brand-teal accent-brand-teal cursor-pointer"
                      />
                      <div>
                        <div className="text-xs font-black text-brand-brown-dark">Print Item Modifiers & Customizations</div>
                        <div className="text-[10px] text-text-secondary">e.g. * Toppings: Belgian Choc Drizzle, * Milk: Oat Milk</div>
                      </div>
                    </label>

                    <label className="p-3.5 rounded-2xl bg-cream-50/80 border border-border flex items-center gap-3 cursor-pointer hover:bg-cream-100 transition-all">
                      <input
                        type="checkbox"
                        checked={kotForm.showItemNotes}
                        onChange={(e) => updateKotForm({ showItemNotes: e.target.checked })}
                        className="w-4 h-4 rounded text-brand-teal accent-brand-teal cursor-pointer"
                      />
                      <div>
                        <div className="text-xs font-black text-brand-brown-dark">Print Special Customer Notes</div>
                        <div className="text-[10px] text-text-secondary">Prints custom preparation requests on ticket</div>
                      </div>
                    </label>

                    <label className="p-3.5 rounded-2xl bg-cream-50/80 border border-border flex items-center gap-3 cursor-pointer hover:bg-cream-100 transition-all">
                      <input
                        type="checkbox"
                        checked={kotForm.highlightNotes}
                        onChange={(e) => updateKotForm({ highlightNotes: e.target.checked })}
                        className="w-4 h-4 rounded text-brand-teal accent-brand-teal cursor-pointer"
                      />
                      <div>
                        <div className="text-xs font-black text-brand-brown-dark">Highlight Special Notes with Red Alert Box</div>
                        <div className="text-[10px] text-text-secondary">High visibility for allergies and urgent customer requests</div>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* KOT TAB 4: ROUTING & FOOTER */}
              {kotTab === 'kot_routing' && (
                <div className="bg-white p-5 sm:p-7 rounded-3xl border border-border shadow-soft space-y-4 animate-in fade-in duration-150">
                  <div className="font-black text-sm text-brand-brown-dark border-b border-border pb-3 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-brand-teal" />
                    <span>Station Routing & Kitchen Footer</span>
                  </div>

                  <div className="space-y-4">
                    <label className="p-3.5 rounded-2xl bg-cream-50/80 border border-border flex items-center gap-3 cursor-pointer hover:bg-cream-100 transition-all">
                      <input
                        type="checkbox"
                        checked={kotForm.showStationRouting}
                        onChange={(e) => updateKotForm({ showStationRouting: e.target.checked })}
                        className="w-4 h-4 rounded text-brand-teal accent-brand-teal cursor-pointer"
                      />
                      <div>
                        <div className="text-xs font-black text-brand-brown-dark">Print Station Routing Line at Bottom</div>
                        <div className="text-[10px] text-text-secondary">Indicates which stations process this ticket</div>
                      </div>
                    </label>

                    {kotForm.showStationRouting && (
                      <div>
                        <label className="text-xs font-bold uppercase text-text-secondary">Station Routing Text</label>
                        <input
                          type="text"
                          value={kotForm.stationRoutingText}
                          onChange={(e) => updateKotForm({ stationRoutingText: e.target.value })}
                          placeholder="Station Routing: BAR / KITCHEN / DESSERT"
                          className="w-full mt-1.5 px-3.5 py-2.5 bg-cream-50 border border-border rounded-xl text-xs font-bold text-brand-brown-dark focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 transition-all font-mono uppercase"
                        />
                      </div>
                    )}

                    <div>
                      <label className="text-xs font-bold uppercase text-text-secondary">Custom Kitchen Footer Note (Optional)</label>
                      <input
                        type="text"
                        value={kotForm.customNote || ''}
                        onChange={(e) => updateKotForm({ customNote: e.target.value })}
                        placeholder="e.g. Urgent Orders First • Serve Fresh"
                        className="w-full mt-1.5 px-3.5 py-2.5 bg-cream-50 border border-border rounded-xl text-xs font-bold text-brand-brown-dark focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 transition-all"
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* RIGHT COLUMN: Realtime Live Sticky Slip Preview (5 cols on lg, full on mobile if preview view) */}
        <div className={`lg:col-span-5 lg:sticky lg:top-6 space-y-4 ${mobileView === 'editor' ? 'hidden lg:block' : 'block'}`}>
          <div className="bg-white p-5 rounded-3xl border border-border shadow-soft space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-black text-brand-brown-dark uppercase tracking-wider">
                  {documentMode === 'receipt' ? 'Live Receipt Preview' : 'Live KOT Ticket Preview'}
                </span>
              </div>

              {/* Sample Order Switcher */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-[10.5px] text-text-secondary font-bold">Sample:</span>
                <select
                  value={selectedSampleIndex}
                  onChange={(e) => setSelectedSampleIndex(Number(e.target.value))}
                  className="px-2.5 py-1 bg-cream-50 border border-border rounded-xl text-xs font-bold text-brand-brown-dark cursor-pointer shadow-xs"
                >
                  <option value={0}>#1050 (Dine In)</option>
                  <option value={1}>#1051 (Takeaway)</option>
                </select>
              </div>
            </div>

            {/* Scrollable Container with separated space from receipt */}
            <div className="w-full max-h-[72vh] overflow-y-auto pr-2 sm:pr-3 pl-1 py-1 flex flex-col items-center custom-scrollbar bg-cream-100/50 rounded-2xl p-3 sm:p-4 border border-dashed border-border/80">
              {/* =================================================================== */}
              {/* LIVE PREVIEW A: CUSTOMER THERMAL RECEIPT SLIP                      */}
              {/* =================================================================== */}
              {documentMode === 'receipt' && (
                <div
                  id="printable-receipt"
                  style={{
                    maxWidth: receiptForm.paperWidthMm === 58 ? '270px' : '340px',
                    fontFamily:
                      receiptForm.fontFamily === 'courier'
                        ? 'Courier New, monospace'
                        : receiptForm.fontFamily === 'sans'
                        ? 'Inter, system-ui, sans-serif'
                        : 'JetBrains Mono, monospace',
                  }}
                  className="w-full bg-white rounded-2xl shadow-xl p-5 font-mono text-xs leading-relaxed text-zinc-900 selection:bg-zinc-200 border border-zinc-200/80 select-text shrink-0 transition-all duration-200"
                >
                  {/* 1. Logo Header */}
                  {receiptForm.showLogo && receiptForm.logoUrl && (
                    <div
                      style={{
                        position: 'relative',
                        top: `${-(receiptForm.logoOffsetYPx ?? 0)}px`,
                        paddingBottom: '8px',
                      }}
                      className={`flex transition-transform duration-150 ${receiptForm.logoAlignment === 'left' ? 'justify-start' : 'justify-center'}`}
                    >
                      <img
                        src={receiptForm.logoUrl}
                        alt="Logo"
                        style={{ width: `${receiptForm.logoWidthPx}px` }}
                        className="object-contain max-h-48 h-auto"
                      />
                    </div>
                  )}

                  {/* 2. Brand Header */}
                  <div
                    className={`pb-3 ${getReceiptDivider()} ${
                      receiptForm.headerAlignment === 'left' ? 'text-left' : 'text-center'
                    }`}
                  >
                    {receiptForm.businessName && receiptForm.businessName.trim() !== '' && (
                      <h2 className={`tracking-wider text-zinc-950 ${getHeading1Class()}`}>
                        {receiptForm.businessName.toUpperCase()}
                      </h2>
                    )}
                    {receiptForm.tagline && receiptForm.tagline.trim() !== '' && (
                      <p className="text-[10px] text-zinc-600 uppercase font-semibold mt-0.5">{receiptForm.tagline}</p>
                    )}
                    {receiptForm.address && (
                      <p className="text-[10px] text-zinc-500 mt-1">{receiptForm.address}</p>
                    )}
                    {receiptForm.phone && (
                      <p className="text-[10px] text-zinc-500">Tel: {receiptForm.phone}</p>
                    )}
                  </div>

                  {/* 3. Order Meta Info */}
                  <div className={`py-2.5 ${getReceiptDivider()} text-[11px] space-y-0.5`}>
                    <div className="flex justify-between items-center">
                      {receiptForm.showOrderNumber && (
                        <span className={`text-zinc-950 ${getHeading2Class()}`}>
                          {receiptForm.orderNumberPrefix} {sampleOrder.orderNumber.replace('#', '')}
                        </span>
                      )}
                      {receiptForm.showOrderType && (
                        <span className="uppercase font-extrabold text-[10px] bg-zinc-100 text-zinc-800 px-1.5 py-0.5 rounded">
                          {sampleOrder.orderType === 'DINE_IN' ? 'Dine In' : 'Takeaway'}
                        </span>
                      )}
                    </div>

                    {receiptForm.showTableNumber && sampleOrder.tableNumber && (
                      <div className="flex justify-between text-zinc-700">
                        <span>Table Number:</span>
                        <span className={`text-zinc-950 ${getHeading3Class()}`}>Table {sampleOrder.tableNumber}</span>
                      </div>
                    )}

                    {receiptForm.showDateTime && (
                      <div className="flex justify-between text-zinc-600 text-[10px]">
                        <span>Date:</span>
                        <span>{formatDateTime(sampleOrder.createdAt)}</span>
                      </div>
                    )}
                  </div>

                  {/* 4. Purchased Line Items */}
                  <div className={`py-2.5 ${getReceiptDivider()} space-y-2 text-xs`}>
                    <div className={`flex justify-between uppercase tracking-wider pb-1 border-b border-zinc-200 text-zinc-500 ${getHeading2Class()}`}>
                      <span>ITEM</span>
                      <span>TOTAL (Rs)</span>
                    </div>

                    {sampleOrder.items.map((item, idx) => (
                      <div key={idx} className="space-y-0.5">
                        <div className={`flex justify-between items-start gap-2 text-zinc-950 ${getHeading3Class()}`}>
                          <span className="flex-1">
                            {item.quantity}x {item.name}
                          </span>
                          <span className={`tabular-nums whitespace-nowrap text-right shrink-0 ${receiptForm.bodyBold ? 'font-bold' : 'font-semibold'}`}>
                            {(item.itemTotalCents / 100).toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>

                        {receiptForm.showModifiers &&
                          item.modifiers.map((mod, mIdx) => (
                            <div key={mIdx} className="text-[10px] text-zinc-600 pl-3 flex justify-between gap-2">
                              <span>+ {mod.optionName}</span>
                              {receiptForm.showModifierPrices && mod.priceCents > 0 && (
                                <span className="tabular-nums whitespace-nowrap shrink-0 text-zinc-500">
                                  {(mod.priceCents / 100).toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </span>
                              )}
                            </div>
                          ))}

                        {receiptForm.showItemNotes && item.notes && (
                          <div className="text-[10px] italic text-zinc-500 pl-3">Note: {item.notes}</div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* 5. Financial Summary */}
                  <div className={`py-2.5 ${getReceiptDivider()} space-y-1 text-[11px]`}>
                    {receiptForm.showSubtotal && (
                      <div className="flex justify-between text-zinc-600">
                        <span>Subtotal:</span>
                        <span className="tabular-nums">{formatLKR(sampleOrder.subtotalCents)}</span>
                      </div>
                    )}

                    {receiptForm.showDiscount && sampleOrder.discountCents > 0 && (
                      <div className="flex justify-between text-zinc-600">
                        <span>Discount:</span>
                        <span className="tabular-nums">-{formatLKR(sampleOrder.discountCents)}</span>
                      </div>
                    )}

                    {receiptForm.showServiceCharge && sampleOrder.serviceChargeCents > 0 && (
                      <div className="flex justify-between text-zinc-600">
                        <span>Service Charge{systemSettings.serviceChargePercent ? ` (${systemSettings.serviceChargePercent}%)` : ''}:</span>
                        <span className="tabular-nums">+{formatLKR(sampleOrder.serviceChargeCents)}</span>
                      </div>
                    )}

                    {receiptForm.showTax && sampleOrder.taxCents > 0 && (
                      <div className="flex justify-between text-zinc-600">
                        <span>{receiptForm.taxLabel}:</span>
                        <span className="tabular-nums">+{formatLKR(sampleOrder.taxCents)}</span>
                      </div>
                    )}

                    <div className="flex justify-between font-black text-sm pt-1.5 border-t border-dashed border-zinc-400 text-zinc-950">
                      <span>TOTAL:</span>
                      <span className="tabular-nums">{formatLKR(sampleOrder.totalCents)}</span>
                    </div>
                  </div>

                  {/* 6. Payment Details */}
                  <div className={`py-2 ${getReceiptDivider()} text-[10px] space-y-0.5`}>
                    {receiptForm.showPaymentMethod && (
                      <div className="flex justify-between">
                        <span>Payment Method:</span>
                        <span className="font-bold uppercase text-zinc-900">{sampleOrder.paymentMethod}</span>
                      </div>
                    )}

                    {receiptForm.showCashBreakdown && sampleOrder.paymentMethod === 'CASH' && (
                      <>
                        <div className="flex justify-between">
                          <span>Cash Received:</span>
                          <span className="tabular-nums font-semibold">{formatLKR(sampleOrder.cashReceivedCents)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-zinc-900">
                          <span>Change Returned:</span>
                          <span className="tabular-nums">{formatLKR(sampleOrder.changeGivenCents || 0)}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* 7. Customer Name in Footer */}
                  {receiptForm.showCustomerInfo && (sampleOrder as any).customerName && (
                    <div className="pt-2 text-center text-[11px] text-zinc-800">
                      <span className="text-[10px] text-zinc-500 uppercase font-semibold">Customer: </span>
                      <span className="font-black text-zinc-950">{(sampleOrder as any).customerName}</span>
                    </div>
                  )}

                  {/* 8. Footer Message */}
                  {receiptForm.receiptFooter && (
                    <div className="pt-1.5 pb-1 text-center text-[10px] text-zinc-600 whitespace-pre-line leading-normal">
                      {receiptForm.receiptFooter}
                    </div>
                  )}

                  {/* 8. Wi-Fi Info */}
                  {receiptForm.showWifiInfo && receiptForm.wifiSsid && (
                    <div className="pt-1 text-center text-[9px] text-zinc-500 font-mono">
                      Wi-Fi: <span className="font-bold text-zinc-700">{receiptForm.wifiSsid}</span>
                      {receiptForm.wifiPassword && ` | Pass: ${receiptForm.wifiPassword}`}
                    </div>
                  )}

                  {/* Built-in Developer Credits on Bottom of Slip */}
                  <div className="mt-3.5 pt-2.5 border-t border-dashed border-zinc-900 text-center select-text thermal-dev-footer">
                    <div className="text-[11px] font-mono font-black text-black uppercase tracking-wider">
                      DEVELOPED BY OGO TECHNOLOGY
                    </div>
                    <div className="text-[10px] font-mono font-bold text-black mt-0.5 tracking-tight flex items-center justify-center gap-1.5">
                      <span>www.ogotechnology.net</span>
                      <span>•</span>
                      <span>+94 75 930 7059</span>
                    </div>
                  </div>
                </div>
              )}

              {/* =================================================================== */}
              {/* LIVE PREVIEW B: KITCHEN ORDER TICKET (KOT) SLIP                    */}
              {/* =================================================================== */}
              {documentMode === 'kot' && (
                <div
                  id="printable-kot"
                  style={{
                    maxWidth: kotForm.paperWidthMm === 58 ? '270px' : '340px',
                  }}
                  className="w-full bg-white rounded-2xl shadow-xl p-5 font-mono text-xs leading-relaxed text-zinc-950 selection:bg-zinc-200 border border-zinc-200/80 select-text shrink-0 transition-all duration-200"
                >
                  {/* Header */}
                  <div className={`text-center pb-3 ${getKotDivider()}`}>
                    {kotForm.showBrandName && (
                      <h2 className="font-black text-base tracking-[0.14em] text-zinc-950">
                        {(kotForm.brandName || 'CHILL & CHOC').toUpperCase()}
                      </h2>
                    )}
                    <div className="font-black text-xs uppercase bg-zinc-900 text-white px-3 py-1 mt-1 inline-block rounded-xl tracking-wider">
                      {kotForm.ticketTitle || 'KITCHEN ORDER TICKET'}
                    </div>
                  </div>

                  {/* Order Identifiers */}
                  <div className={`py-3 ${getKotDivider()} space-y-1.5`}>
                    <div className="flex justify-between items-baseline">
                      {kotForm.showOrderNumber && (
                        <span className="font-black text-2xl tracking-tight text-zinc-950">
                          {kotForm.orderNumberPrefix || '#'}
                          {sampleOrder.orderNumber.replace('#', '')}
                        </span>
                      )}
                      {kotForm.showOrderType && (
                        <span className="font-black text-xs uppercase px-2.5 py-1 rounded-xl bg-zinc-200 text-zinc-900 tracking-wider">
                          {sampleOrder.orderType === 'DINE_IN' ? 'DINE IN' : 'TAKEAWAY'}
                        </span>
                      )}
                    </div>

                    {/* Table Number Display */}
                    {kotForm.showTableNumber && sampleOrder.tableNumber && (
                      kotForm.tableNumberStyle === 'prominent' ? (
                        <div className="text-center py-1.5 bg-zinc-100 rounded-xl font-black text-base mt-1 text-zinc-950 border border-zinc-200">
                          TABLE {sampleOrder.tableNumber}
                        </div>
                      ) : (
                        <div className="flex justify-between text-zinc-800 text-xs font-bold pt-0.5">
                          <span>Table:</span>
                          <span>Table {sampleOrder.tableNumber}</span>
                        </div>
                      )
                    )}

                    <div className="space-y-0.5 text-[10.5px] text-zinc-600 pt-1">
                      {kotForm.showDateTime && (
                        <div className="flex justify-between items-center">
                          <span>Time:</span>
                          <span className="font-bold text-zinc-900">{formatDateTime(sampleOrder.createdAt)}</span>
                        </div>
                      )}
                      {kotForm.showCashierName && (
                        <div className="flex justify-between items-center">
                          <span>{kotForm.cashierLabel || 'Staff'}:</span>
                          <span className="font-bold text-zinc-900">{sampleOrder.cashierName}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Item List with prominent Quantities & Modifiers */}
                  <div className={`py-3 ${getKotDivider()} space-y-3`}>
                    {sampleOrder.items.map((item, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-baseline gap-2 font-black text-sm text-zinc-950">
                          <span className="bg-zinc-900 text-white w-6 h-6 flex items-center justify-center rounded text-xs flex-shrink-0">
                            {item.quantity}
                          </span>
                          <span>{item.name.toUpperCase()}</span>
                        </div>

                        {kotForm.showModifiers &&
                          item.modifiers.map((mod, mIdx) => (
                            <div key={mIdx} className="text-xs font-bold text-zinc-800 pl-8">
                              * {mod.groupName}: {mod.optionName}
                            </div>
                          ))}

                        {kotForm.showItemNotes && item.notes && (
                          <div
                            className={
                              kotForm.highlightNotes
                                ? 'text-xs font-bold text-red-600 bg-red-50 p-1.5 rounded-lg pl-2 ml-8 border border-red-200'
                                : 'text-xs italic text-zinc-700 pl-8'
                            }
                          >
                            NOTE: {item.notes.toUpperCase()}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Station Routing */}
                  {kotForm.showStationRouting && (
                    <div className="pt-3 text-center text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider">
                      {kotForm.stationRoutingText || 'Station Routing: BAR / KITCHEN / DESSERT'}
                    </div>
                  )}

                  {/* Custom Kitchen Note */}
                  {kotForm.customNote && (
                    <div className="pt-2 text-center text-[10px] font-bold text-zinc-600 italic">
                      {kotForm.customNote}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Bottom-Center Action Capsule */}
      <div className="fixed bottom-5 sm:bottom-7 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center pointer-events-none select-none px-3 max-w-[96vw]">
        <div className="bg-[#1E1917]/95 text-white backdrop-blur-xl border border-white/10 shadow-2xl rounded-full p-2 pl-3.5 pr-3.5 sm:pl-4 sm:pr-4 flex items-center gap-2 sm:gap-3 pointer-events-auto transition-all duration-300 shrink-0">
          {/* Reset Button */}
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3 sm:px-3.5 py-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 text-xs font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap active:scale-95 shrink-0"
            title={`Reset ${documentMode === 'receipt' ? 'receipt' : 'KOT'} to defaults`}
          >
            <RefreshCw className="w-3.5 h-3.5 shrink-0" />
            <span>Reset</span>
          </button>

          <div className="h-5 w-px bg-white/15 shrink-0" />

          {/* Test Print Button */}
          <button
            type="button"
            onClick={handleTestPrint}
            className="px-3 sm:px-3.5 py-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 text-xs font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap active:scale-95 shrink-0"
            title={`Test print ${documentMode === 'receipt' ? 'customer receipt' : 'KOT ticket'}`}
          >
            <Printer className="w-3.5 h-3.5 shrink-0" />
            <span>Test Print</span>
          </button>

          <div className="h-5 w-px bg-white/15 shrink-0" />

          {/* Save Template Button - Prominently indicates dirty/saved state */}
          <button
            type="button"
            disabled={isSaving || !hasUnsavedChanges}
            onClick={() => handleManualSave()}
            className={`px-4.5 sm:px-5 py-2 rounded-full text-xs font-black transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap shrink-0 ${
              hasUnsavedChanges
                ? 'bg-brand-teal hover:bg-brand-teal-dark text-white shadow-teal cursor-pointer ring-2 ring-brand-teal/60 shadow-lg animate-pulse'
                : 'bg-white/10 text-white/40 cursor-default'
            } ${isSaving ? 'opacity-75 cursor-wait' : ''}`}
            title={hasUnsavedChanges ? "Save changes to Supabase database & broadcast via WebSockets" : "All changes saved to database"}
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
            ) : hasUnsavedChanges ? (
              <Save className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <Check className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
            )}
            <span>
              {isSaving
                ? 'Saving to Database...'
                : hasUnsavedChanges
                ? `Save ${documentMode === 'receipt' ? 'Receipt' : 'KOT'} ●`
                : 'All Saved'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
