import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/services/storage/db';
import { ReceiptCustomizationSettings, SystemSettings } from '@/types';
import { receiptSocketService } from '@/services/receiptSocketService';
import { formatLKR, formatDateTime } from '@/utils/format';
import {
  Printer,
  RefreshCw,
  Save,
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
  Smartphone,
  Monitor,
} from 'lucide-react';
import { toast } from 'sonner';

// Sample mock orders for live preview
const SAMPLE_ORDERS = [
  {
    id: 'ord_sample_01',
    orderNumber: '#1050',
    orderType: 'DINE_IN',
    tableNumber: '05',
    createdAt: new Date().toISOString(),
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

type TabKey = 'branding' | 'metadata' | 'items' | 'financials' | 'payments' | 'footer';

export const AdminReceiptDesignerPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('branding');
  const [mobileView, setMobileView] = useState<'editor' | 'preview'>('editor');
  const [selectedSampleIndex, setSelectedSampleIndex] = useState(0);

  // Load initial settings
  const systemSettings: SystemSettings = db.getSnapshot().settings;
  const defaultCustomization: ReceiptCustomizationSettings = useMemo(() => ({
    showLogo: true,
    logoUrl: '/logobg.webp',
    logoWidthPx: 95,
    logoAlignment: 'center',
    businessName: systemSettings.businessName || 'Chill & Choc',
    tagline: systemSettings.tagline || 'Cool Vibes, Sweet Bites',
    address: systemSettings.address || 'No. 42, Galle Road, Colombo 03, Sri Lanka',
    phone: systemSettings.phone || '+94 11 234 5678',
    email: systemSettings.email || 'hello@chillandchoc.lk',
    website: 'www.chillandchoc.lk',
    taxNumber: 'VAT-LK-10928374',
    headerAlignment: 'center',
    dividerStyle: 'dashed',
    paperWidthMm: 80,
    fontFamily: 'mono',
    fontSize: 'normal',
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

  const [savedForm, setSavedForm] = useState<ReceiptCustomizationSettings>(
    () => systemSettings.receiptCustomization || defaultCustomization
  );
  const [form, setForm] = useState<ReceiptCustomizationSettings>(
    () => systemSettings.receiptCustomization || defaultCustomization
  );

  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(form) !== JSON.stringify(savedForm);
  }, [form, savedForm]);

  // Real-time broadcast whenever form changes
  const updateForm = (changes: Partial<ReceiptCustomizationSettings>) => {
    const updated = { ...form, ...changes };
    setForm(updated);
    // Broadcast in real-time over simulated WebSocket / BroadcastChannel
    receiptSocketService.broadcastReceiptUpdate(updated, 'Admin Receipt Studio');
  };

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        updateForm({ logoUrl: reader.result, showLogo: true });
        toast.success('Custom logo uploaded & applied to receipt preview!');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetDefaults = () => {
    updateForm(defaultCustomization);
    toast.info('Receipt template reset to Chill & Choc default design.');
  };

  const handleManualSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    receiptSocketService.broadcastReceiptUpdate(form, 'Admin Manual Save');
    setSavedForm(form);
    toast.success('Receipt template saved successfully!');
  };

  const handleTestPrint = () => {
    window.print();
    toast.success('Dispatched test thermal receipt slip.');
  };

  const sampleOrder = SAMPLE_ORDERS[selectedSampleIndex];

  // Helper for divider lines
  const getDivider = () => {
    switch (form.dividerStyle) {
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

  const tabs: { id: TabKey; label: string; icon: React.ReactNode }[] = [
    { id: 'branding', label: 'Branding & Logo', icon: <Store className="w-4 h-4" /> },
    { id: 'metadata', label: 'Order Meta', icon: <Info className="w-4 h-4" /> },
    { id: 'items', label: 'Layout & Font', icon: <Type className="w-4 h-4" /> },
    { id: 'financials', label: 'Taxes & Totals', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'payments', label: 'Payments', icon: <Receipt className="w-4 h-4" /> },
    { id: 'footer', label: 'Footer & Wi-Fi', icon: <Share2 className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-4 w-full pb-28 px-1 sm:px-3 animate-in fade-in">

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
          {/* Navigation Category Tabs */}
          <div className="bg-white p-2 rounded-2xl border border-border shadow-xs grid grid-cols-3 sm:grid-cols-6 gap-1.5">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
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

          {/* TAB 1: BRANDING & LOGO */}
          {activeTab === 'branding' && (
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
                      checked={form.showLogo}
                      onChange={(e) => updateForm({ showLogo: e.target.checked })}
                      className="w-4 h-4 rounded text-brand-teal cursor-pointer accent-brand-teal"
                    />
                    <div>
                      <div className="text-xs font-black text-brand-brown-dark">Display Business Logo on Receipt</div>
                      <div className="text-[10.5px] text-text-secondary">Prints high-contrast café logo at top of slip</div>
                    </div>
                  </label>

                  {form.showLogo && (
                    <div className="w-12 h-12 rounded-xl bg-white border border-border p-1 flex items-center justify-center shadow-xs">
                      <img src={form.logoUrl || '/logobg.webp'} alt="Logo" className="max-h-full max-w-full object-contain" />
                    </div>
                  )}
                </div>

                {form.showLogo && (
                  <div className="space-y-3.5 pt-3 border-t border-border/80">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <div className="flex justify-between items-center text-[11px] font-bold uppercase text-text-secondary">
                          <span>Logo Width</span>
                          <span className="font-mono text-brand-teal">{form.logoWidthPx}px</span>
                        </div>
                        <input
                          type="range"
                          min="50"
                          max="160"
                          step="5"
                          value={form.logoWidthPx}
                          onChange={(e) => updateForm({ logoWidthPx: Number(e.target.value) })}
                          className="w-full mt-2 accent-brand-teal cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold uppercase text-text-secondary">Logo Alignment</label>
                        <div className="grid grid-cols-2 gap-2 mt-1.5">
                          <button
                            type="button"
                            onClick={() => updateForm({ logoAlignment: 'center' })}
                            className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                              form.logoAlignment === 'center' ? 'bg-brand-teal text-white border-brand-teal shadow-xs' : 'bg-white border-border text-text-secondary'
                            }`}
                          >
                            Center
                          </button>
                          <button
                            type="button"
                            onClick={() => updateForm({ logoAlignment: 'left' })}
                            className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                              form.logoAlignment === 'left' ? 'bg-brand-teal text-white border-brand-teal shadow-xs' : 'bg-white border-border text-text-secondary'
                            }`}
                          >
                            Left
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-1 flex-wrap">
                      <label className="px-3.5 py-2 bg-white hover:bg-cream-100 border border-border text-xs font-bold text-brand-brown-dark rounded-xl cursor-pointer shadow-xs flex items-center gap-1.5 transition-all">
                        <Upload className="w-3.5 h-3.5 text-brand-teal" />
                        <span>Upload Custom Logo</span>
                        <input type="file" accept="image/*" onChange={handleLogoFileUpload} className="hidden" />
                      </label>

                      <button
                        type="button"
                        onClick={() => updateForm({ logoUrl: '/logobg.webp' })}
                        className="px-3.5 py-2 bg-white hover:bg-cream-100 border border-border text-xs font-bold text-text-secondary rounded-xl cursor-pointer transition-all"
                      >
                        Reset Default Logo
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Text Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase text-text-secondary">Business Name</label>
                  <input
                    type="text"
                    value={form.businessName}
                    onChange={(e) => updateForm({ businessName: e.target.value })}
                    className="w-full mt-1.5 px-3.5 py-2.5 bg-cream-50 border border-border rounded-xl text-xs font-bold text-brand-brown-dark focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-text-secondary">Tagline / Slogan</label>
                  <input
                    type="text"
                    value={form.tagline}
                    onChange={(e) => updateForm({ tagline: e.target.value })}
                    className="w-full mt-1.5 px-3.5 py-2.5 bg-cream-50 border border-border rounded-xl text-xs font-bold text-brand-brown-dark focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase text-text-secondary">Contact Phone</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => updateForm({ phone: e.target.value })}
                    className="w-full mt-1.5 px-3.5 py-2.5 bg-cream-50 border border-border rounded-xl text-xs font-bold text-brand-brown-dark focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-text-secondary">Website / Email</label>
                  <input
                    type="text"
                    value={form.website || ''}
                    onChange={(e) => updateForm({ website: e.target.value })}
                    placeholder="www.chillandchoc.lk"
                    className="w-full mt-1.5 px-3.5 py-2.5 bg-cream-50 border border-border rounded-xl text-xs font-bold text-brand-brown-dark focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-text-secondary">Store Address</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => updateForm({ address: e.target.value })}
                  className="w-full mt-1.5 px-3.5 py-2.5 bg-cream-50 border border-border rounded-xl text-xs font-bold text-brand-brown-dark focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 transition-all"
                />
              </div>
            </div>
          )}

          {/* TAB 2: ORDER METADATA */}
          {activeTab === 'metadata' && (
            <div className="bg-white p-5 sm:p-7 rounded-3xl border border-border shadow-soft space-y-5 animate-in fade-in duration-150">
              <div className="font-black text-sm text-brand-brown-dark border-b border-border pb-3 flex items-center gap-2">
                <Info className="w-4 h-4 text-brand-orange" />
                <span>Order Identifiers & Header Metadata</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <label className="flex items-center gap-3 p-3.5 bg-cream-50/80 rounded-2xl border border-border text-xs font-bold cursor-pointer hover:bg-cream-100/60 transition-all">
                  <input
                    type="checkbox"
                    checked={form.showOrderNumber}
                    onChange={(e) => updateForm({ showOrderNumber: e.target.checked })}
                    className="w-4 h-4 rounded text-brand-teal accent-brand-teal cursor-pointer"
                  />
                  <div>
                    <div className="text-brand-brown-dark">Show Order Number</div>
                    <div className="text-[10px] text-text-secondary font-normal">Prints bold order token #</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3.5 bg-cream-50/80 rounded-2xl border border-border text-xs font-bold cursor-pointer hover:bg-cream-100/60 transition-all">
                  <input
                    type="checkbox"
                    checked={form.showOrderType}
                    onChange={(e) => updateForm({ showOrderType: e.target.checked })}
                    className="w-4 h-4 rounded text-brand-teal accent-brand-teal cursor-pointer"
                  />
                  <div>
                    <div className="text-brand-brown-dark">Show Dine-In / Takeaway Badge</div>
                    <div className="text-[10px] text-text-secondary font-normal">Identifies fulfillment mode</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3.5 bg-cream-50/80 rounded-2xl border border-border text-xs font-bold cursor-pointer hover:bg-cream-100/60 transition-all">
                  <input
                    type="checkbox"
                    checked={form.showTableNumber}
                    onChange={(e) => updateForm({ showTableNumber: e.target.checked })}
                    className="w-4 h-4 rounded text-brand-teal accent-brand-teal cursor-pointer"
                  />
                  <div>
                    <div className="text-brand-brown-dark">Show Table Number</div>
                    <div className="text-[10px] text-text-secondary font-normal">Prints table for Dine-In orders</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3.5 bg-cream-50/80 rounded-2xl border border-border text-xs font-bold cursor-pointer hover:bg-cream-100/60 transition-all">
                  <input
                    type="checkbox"
                    checked={form.showDateTime}
                    onChange={(e) => updateForm({ showDateTime: e.target.checked })}
                    className="w-4 h-4 rounded text-brand-teal accent-brand-teal cursor-pointer"
                  />
                  <div>
                    <div className="text-brand-brown-dark">Show Date & Timestamp</div>
                    <div className="text-[10px] text-text-secondary font-normal">Prints full timestamp</div>
                  </div>
                </label>
              </div>

              <div className="pt-2">
                <label className="text-xs font-bold uppercase text-text-secondary">Order Prefix Label</label>
                <input
                  type="text"
                  value={form.orderNumberPrefix}
                  onChange={(e) => updateForm({ orderNumberPrefix: e.target.value })}
                  placeholder="Order: #"
                  className="w-full sm:w-56 mt-1.5 px-3.5 py-2.5 bg-cream-50 border border-border rounded-xl text-xs font-bold text-brand-brown-dark focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 transition-all"
                />
              </div>
            </div>
          )}

          {/* TAB 3: LAYOUT & FONT */}
          {activeTab === 'items' && (
            <div className="bg-white p-5 sm:p-7 rounded-3xl border border-border shadow-soft space-y-5 animate-in fade-in duration-150">
              <div className="font-black text-sm text-brand-brown-dark border-b border-border pb-3 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-brand-teal" />
                <span>Paper Width, Typography & Item Listing</span>
              </div>

              {/* Paper Width Selector */}
              <div>
                <label className="text-xs font-bold uppercase text-text-secondary">Thermal Roll Paper Width</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1.5">
                  <button
                    type="button"
                    onClick={() => updateForm({ paperWidthMm: 80 })}
                    className={`p-4 rounded-2xl border text-left cursor-pointer transition-all ${
                      form.paperWidthMm === 80
                        ? 'bg-brand-teal/10 border-brand-teal text-brand-teal shadow-xs'
                        : 'bg-cream-50 border-border text-text-secondary'
                    }`}
                  >
                    <div className="font-black text-sm">80mm Standard POS</div>
                    <div className="text-[10.5px] opacity-80 mt-0.5">Wide receipt format (48 columns)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateForm({ paperWidthMm: 58 })}
                    className={`p-4 rounded-2xl border text-left cursor-pointer transition-all ${
                      form.paperWidthMm === 58
                        ? 'bg-brand-teal/10 border-brand-teal text-brand-teal shadow-xs'
                        : 'bg-cream-50 border-border text-text-secondary'
                    }`}
                  >
                    <div className="font-black text-sm">58mm Compact Portable</div>
                    <div className="text-[10.5px] opacity-80 mt-0.5">Narrow mobile format (32 columns)</div>
                  </button>
                </div>
              </div>

              {/* Font Family & Divider Style */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase text-text-secondary">Thermal Font Style</label>
                  <select
                    value={form.fontFamily}
                    onChange={(e) => updateForm({ fontFamily: e.target.value as any })}
                    className="w-full mt-1.5 px-3.5 py-2.5 bg-cream-50 border border-border rounded-xl text-xs font-bold text-brand-brown-dark cursor-pointer"
                  >
                    <option value="mono">Clean JetBrains Monospace</option>
                    <option value="courier">Classic Thermal Courier POS</option>
                    <option value="sans">Modern Clean Sans-Serif</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-text-secondary">Divider Line Style</label>
                  <select
                    value={form.dividerStyle}
                    onChange={(e) => updateForm({ dividerStyle: e.target.value as any })}
                    className="w-full mt-1.5 px-3.5 py-2.5 bg-cream-50 border border-border rounded-xl text-xs font-bold text-brand-brown-dark cursor-pointer"
                  >
                    <option value="dashed">Dashed Lines (- - - - - -)</option>
                    <option value="double">Double Line (======)</option>
                    <option value="dotted">Dotted Line (......)</option>
                    <option value="solid">Minimal Solid (──────)</option>
                  </select>
                </div>
              </div>

              {/* Item Modifiers & Notes Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                <label className="flex items-center gap-3 p-3.5 bg-cream-50/80 rounded-2xl border border-border text-xs font-bold cursor-pointer hover:bg-cream-100/60 transition-all">
                  <input
                    type="checkbox"
                    checked={form.showModifiers}
                    onChange={(e) => updateForm({ showModifiers: e.target.checked })}
                    className="w-4 h-4 rounded text-brand-teal accent-brand-teal cursor-pointer"
                  />
                  <div>
                    <div className="text-brand-brown-dark">Show Item Modifiers</div>
                    <div className="text-[10px] text-text-secondary font-normal">Lists add-ons & milk choices</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3.5 bg-cream-50/80 rounded-2xl border border-border text-xs font-bold cursor-pointer hover:bg-cream-100/60 transition-all">
                  <input
                    type="checkbox"
                    checked={form.showModifierPrices}
                    onChange={(e) => updateForm({ showModifierPrices: e.target.checked })}
                    className="w-4 h-4 rounded text-brand-teal accent-brand-teal cursor-pointer"
                  />
                  <div>
                    <div className="text-brand-brown-dark">Show Modifier Price Tags</div>
                    <div className="text-[10px] text-text-secondary font-normal">Prints (+Rs. 150.00) next to choices</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3.5 bg-cream-50/80 rounded-2xl border border-border text-xs font-bold cursor-pointer hover:bg-cream-100/60 transition-all">
                  <input
                    type="checkbox"
                    checked={form.showItemNotes}
                    onChange={(e) => updateForm({ showItemNotes: e.target.checked })}
                    className="w-4 h-4 rounded text-brand-teal accent-brand-teal cursor-pointer"
                  />
                  <div>
                    <div className="text-brand-brown-dark">Show Item Special Notes</div>
                    <div className="text-[10px] text-text-secondary font-normal">Prints special customer instructions</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3.5 bg-cream-50/80 rounded-2xl border border-border text-xs font-bold cursor-pointer hover:bg-cream-100/60 transition-all">
                  <input
                    type="checkbox"
                    checked={form.showUnitPrice}
                    onChange={(e) => updateForm({ showUnitPrice: e.target.checked })}
                    className="w-4 h-4 rounded text-brand-teal accent-brand-teal cursor-pointer"
                  />
                  <div>
                    <div className="text-brand-brown-dark">Show Unit Price Details</div>
                    <div className="text-[10px] text-text-secondary font-normal">Prints @ Rs. 1,250.00 each</div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* TAB 4: FINANCIALS & TAXES */}
          {activeTab === 'financials' && (
            <div className="bg-white p-5 sm:p-7 rounded-3xl border border-border shadow-soft space-y-5 animate-in fade-in duration-150">
              <div className="font-black text-sm text-brand-brown-dark border-b border-border pb-3 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-brand-teal" />
                <span>Financial Totals, Service Charge & Taxes</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <label className="flex items-center gap-3 p-3.5 bg-cream-50/80 rounded-2xl border border-border text-xs font-bold cursor-pointer hover:bg-cream-100/60 transition-all">
                  <input
                    type="checkbox"
                    checked={form.showSubtotal}
                    onChange={(e) => updateForm({ showSubtotal: e.target.checked })}
                    className="w-4 h-4 rounded text-brand-teal accent-brand-teal cursor-pointer"
                  />
                  <div>
                    <div className="text-brand-brown-dark">Show Subtotal Line</div>
                    <div className="text-[10px] text-text-secondary font-normal">Before discounts and surcharges</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3.5 bg-cream-50/80 rounded-2xl border border-border text-xs font-bold cursor-pointer hover:bg-cream-100/60 transition-all">
                  <input
                    type="checkbox"
                    checked={form.showDiscount}
                    onChange={(e) => updateForm({ showDiscount: e.target.checked })}
                    className="w-4 h-4 rounded text-brand-teal accent-brand-teal cursor-pointer"
                  />
                  <div>
                    <div className="text-brand-brown-dark">Show Discount Line</div>
                    <div className="text-[10px] text-text-secondary font-normal">Displays item & order discounts</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3.5 bg-cream-50/80 rounded-2xl border border-border text-xs font-bold cursor-pointer hover:bg-cream-100/60 transition-all">
                  <input
                    type="checkbox"
                    checked={form.showServiceCharge}
                    onChange={(e) => updateForm({ showServiceCharge: e.target.checked })}
                    className="w-4 h-4 rounded text-brand-teal accent-brand-teal cursor-pointer"
                  />
                  <div>
                    <div className="text-brand-brown-dark">Show Service Charge</div>
                    <div className="text-[10px] text-text-secondary font-normal">Prints service charge breakdown</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3.5 bg-cream-50/80 rounded-2xl border border-border text-xs font-bold cursor-pointer hover:bg-cream-100/60 transition-all">
                  <input
                    type="checkbox"
                    checked={form.showTax}
                    onChange={(e) => updateForm({ showTax: e.target.checked })}
                    className="w-4 h-4 rounded text-brand-teal accent-brand-teal cursor-pointer"
                  />
                  <div>
                    <div className="text-brand-brown-dark">Show VAT / Tax Line</div>
                    <div className="text-[10px] text-text-secondary font-normal">Government VAT line item</div>
                  </div>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="text-xs font-bold uppercase text-text-secondary">Service Charge Custom Label</label>
                  <input
                    type="text"
                    value={form.serviceChargeLabel}
                    onChange={(e) => updateForm({ serviceChargeLabel: e.target.value })}
                    className="w-full mt-1.5 px-3.5 py-2.5 bg-cream-50 border border-border rounded-xl text-xs font-bold text-brand-brown-dark focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-text-secondary">Currency Symbol</label>
                  <input
                    type="text"
                    value={form.currencySymbol}
                    onChange={(e) => updateForm({ currencySymbol: e.target.value })}
                    className="w-full mt-1.5 px-3.5 py-2.5 bg-cream-50 border border-border rounded-xl text-xs font-bold text-brand-brown-dark font-mono focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: PAYMENTS */}
          {activeTab === 'payments' && (
            <div className="bg-white p-5 sm:p-7 rounded-3xl border border-border shadow-soft space-y-5 animate-in fade-in duration-150">
              <div className="font-black text-sm text-brand-brown-dark border-b border-border pb-3 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-brand-teal" />
                <span>Payment Settlement Details</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <label className="flex items-center gap-3 p-3.5 bg-cream-50/80 rounded-2xl border border-border text-xs font-bold cursor-pointer hover:bg-cream-100/60 transition-all">
                  <input
                    type="checkbox"
                    checked={form.showPaymentMethod}
                    onChange={(e) => updateForm({ showPaymentMethod: e.target.checked })}
                    className="w-4 h-4 rounded text-brand-teal accent-brand-teal cursor-pointer"
                  />
                  <div>
                    <div className="text-brand-brown-dark">Show Payment Method</div>
                    <div className="text-[10px] text-text-secondary font-normal">CASH, CARD, or SPLIT</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3.5 bg-cream-50/80 rounded-2xl border border-border text-xs font-bold cursor-pointer hover:bg-cream-100/60 transition-all">
                  <input
                    type="checkbox"
                    checked={form.showCashBreakdown}
                    onChange={(e) => updateForm({ showCashBreakdown: e.target.checked })}
                    className="w-4 h-4 rounded text-brand-teal accent-brand-teal cursor-pointer"
                  />
                  <div>
                    <div className="text-brand-brown-dark">Show Cash Received & Change</div>
                    <div className="text-[10px] text-text-secondary font-normal">For physical cash settlements</div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* TAB 6: FOOTER & WI-FI */}
          {activeTab === 'footer' && (
            <div className="bg-white p-5 sm:p-7 rounded-3xl border border-border shadow-soft space-y-5 animate-in fade-in duration-150">
              <div className="font-black text-sm text-brand-brown-dark border-b border-border pb-3 flex items-center gap-2">
                <Share2 className="w-4 h-4 text-brand-orange" />
                <span>Custom Farewell Note & Guest Wi-Fi Access</span>
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-text-secondary">Receipt Farewell Note</label>
                <textarea
                  rows={3}
                  value={form.receiptFooter}
                  onChange={(e) => updateForm({ receiptFooter: e.target.value })}
                  placeholder="Thank you for chilling with us!..."
                  className="w-full mt-1.5 px-3.5 py-2.5 bg-cream-50 border border-border rounded-xl text-xs font-mono text-brand-brown-dark focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-text-secondary">Social Media Handle (Optional)</label>
                <input
                  type="text"
                  value={form.socialHandle}
                  onChange={(e) => updateForm({ socialHandle: e.target.value })}
                  placeholder="@chillandchoc.lk"
                  className="w-full mt-1.5 px-3.5 py-2.5 bg-cream-50 border border-border rounded-xl text-xs font-bold text-brand-brown-dark focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 transition-all"
                />
              </div>

              {/* Wi-Fi with Checkbox / Tick Toggle */}
              <div className="p-4 sm:p-5 rounded-2xl bg-cream-50/80 border border-border space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.showWifiInfo}
                    onChange={(e) => updateForm({ showWifiInfo: e.target.checked })}
                    className="w-4 h-4 rounded text-brand-teal accent-brand-teal cursor-pointer"
                  />
                  <div>
                    <div className="text-xs font-black text-brand-brown-dark">Print Guest Wi-Fi Details on Receipt</div>
                    <div className="text-[10px] text-text-secondary">Prints Wi-Fi Network Name & Password at bottom</div>
                  </div>
                </label>

                {form.showWifiInfo && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-3 border-t border-border/80">
                    <div>
                      <label className="text-[11px] font-bold uppercase text-text-secondary">Wi-Fi Network Name (SSID)</label>
                      <input
                        type="text"
                        value={form.wifiSsid}
                        onChange={(e) => updateForm({ wifiSsid: e.target.value })}
                        placeholder="ChillAndChoc_Guest"
                        className="w-full mt-1.5 px-3.5 py-2.5 bg-white border border-border rounded-xl text-xs font-bold text-brand-brown-dark focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 transition-all"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold uppercase text-text-secondary">Wi-Fi Password</label>
                      <input
                        type="text"
                        value={form.wifiPassword || ''}
                        onChange={(e) => updateForm({ wifiPassword: e.target.value })}
                        placeholder="sweetbites2026"
                        className="w-full mt-1.5 px-3.5 py-2.5 bg-white border border-border rounded-xl text-xs font-bold text-brand-brown-dark focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 transition-all"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Realtime Live Sticky Receipt Preview (5 cols on lg, full on mobile if preview view) */}
        <div className={`lg:col-span-5 lg:sticky lg:top-6 space-y-4 ${mobileView === 'editor' ? 'hidden lg:block' : 'block'}`}>
          <div className="bg-white p-5 rounded-3xl border border-border shadow-soft space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-black text-brand-brown-dark uppercase tracking-wider">
                  Live Thermal Slip Preview
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
              {/* Dynamic Width Thermal Slip Card */}
              <div
                style={{
                  maxWidth: form.paperWidthMm === 58 ? '270px' : '340px',
                  fontFamily:
                    form.fontFamily === 'courier'
                      ? 'Courier New, monospace'
                      : form.fontFamily === 'sans'
                      ? 'Inter, system-ui, sans-serif'
                      : 'JetBrains Mono, monospace',
                }}
                className={`w-full bg-white rounded-2xl shadow-xl p-5 font-mono text-xs leading-relaxed text-zinc-900 selection:bg-zinc-200 border border-zinc-200/80 select-text shrink-0 transition-all duration-200`}
              >
                {/* 1. Logo Header */}
                {form.showLogo && form.logoUrl && (
                  <div className={`pb-2.5 flex ${form.logoAlignment === 'left' ? 'justify-start' : 'justify-center'}`}>
                    <img
                      src={form.logoUrl}
                      alt="Logo"
                      style={{ width: `${form.logoWidthPx}px` }}
                      className="object-contain max-h-24"
                    />
                  </div>
                )}

                {/* 2. Brand Header */}
                <div
                  className={`pb-3 ${getDivider()} ${
                    form.headerAlignment === 'left' ? 'text-left' : 'text-center'
                  }`}
                >
                  <h2 className="font-black text-base tracking-wider text-zinc-950">
                    {form.businessName.toUpperCase()}
                  </h2>
                  {form.tagline && (
                    <p className="text-[10px] text-zinc-600 uppercase font-semibold mt-0.5">{form.tagline}</p>
                  )}
                  {form.address && (
                    <p className="text-[10px] text-zinc-500 mt-1">{form.address}</p>
                  )}
                  {form.phone && (
                    <p className="text-[10px] text-zinc-500">Tel: {form.phone}</p>
                  )}
                </div>

                {/* 3. Order Meta Info */}
                <div className={`py-2.5 ${getDivider()} text-[11px] space-y-0.5`}>
                  <div className="flex justify-between items-center">
                    {form.showOrderNumber && (
                      <span className="font-black text-zinc-950">
                        {form.orderNumberPrefix} {sampleOrder.orderNumber.replace('#', '')}
                      </span>
                    )}
                    {form.showOrderType && (
                      <span className="uppercase font-extrabold text-[10px] bg-zinc-100 text-zinc-800 px-1.5 py-0.5 rounded">
                        {sampleOrder.orderType === 'DINE_IN' ? 'Dine In' : 'Takeaway'}
                      </span>
                    )}
                  </div>

                  {form.showTableNumber && sampleOrder.tableNumber && (
                    <div className="flex justify-between text-zinc-700">
                      <span>Table Number:</span>
                      <span className="font-black">Table {sampleOrder.tableNumber}</span>
                    </div>
                  )}

                  {form.showDateTime && (
                    <div className="flex justify-between text-zinc-600 text-[10px]">
                      <span>Date:</span>
                      <span>{formatDateTime(sampleOrder.createdAt)}</span>
                    </div>
                  )}
                </div>

                {/* 4. Purchased Line Items */}
                <div className={`py-2.5 ${getDivider()} space-y-2 text-xs`}>
                  <div className="flex justify-between font-black text-[10px] text-zinc-500 uppercase tracking-wider pb-1 border-b border-zinc-200">
                    <span>Item</span>
                    <span>Total</span>
                  </div>

                  {sampleOrder.items.map((item, idx) => (
                    <div key={idx} className="space-y-0.5">
                      <div className="flex justify-between font-bold text-zinc-950">
                        <span>
                          {item.quantity}x {item.name}
                        </span>
                        <span className="tabular-nums">{formatLKR(item.itemTotalCents)}</span>
                      </div>

                      {form.showModifiers &&
                        item.modifiers.map((mod, mIdx) => (
                          <div key={mIdx} className="text-[10px] text-zinc-600 pl-3">
                            + {mod.optionName}{' '}
                            {form.showModifierPrices &&
                              mod.priceCents > 0 &&
                              `(+${formatLKR(mod.priceCents)})`}
                          </div>
                        ))}

                      {form.showItemNotes && item.notes && (
                        <div className="text-[10px] italic text-zinc-500 pl-3">Note: {item.notes}</div>
                      )}
                    </div>
                  ))}
                </div>

                {/* 5. Financial Summary */}
                <div className={`py-2.5 ${getDivider()} space-y-1 text-[11px]`}>
                  {form.showSubtotal && (
                    <div className="flex justify-between text-zinc-600">
                      <span>Subtotal:</span>
                      <span className="tabular-nums">{formatLKR(sampleOrder.subtotalCents)}</span>
                    </div>
                  )}

                  {form.showDiscount && sampleOrder.discountCents > 0 && (
                    <div className="flex justify-between text-zinc-600">
                      <span>Discount:</span>
                      <span className="tabular-nums">-{formatLKR(sampleOrder.discountCents)}</span>
                    </div>
                  )}

                  {form.showServiceCharge && sampleOrder.serviceChargeCents > 0 && (
                    <div className="flex justify-between text-zinc-600">
                      <span>{form.serviceChargeLabel}:</span>
                      <span className="tabular-nums">+{formatLKR(sampleOrder.serviceChargeCents)}</span>
                    </div>
                  )}

                  {form.showTax && sampleOrder.taxCents > 0 && (
                    <div className="flex justify-between text-zinc-600">
                      <span>{form.taxLabel}:</span>
                      <span className="tabular-nums">+{formatLKR(sampleOrder.taxCents)}</span>
                    </div>
                  )}

                  <div className="flex justify-between font-black text-sm pt-1.5 border-t border-dashed border-zinc-400 text-zinc-950">
                    <span>TOTAL:</span>
                    <span className="tabular-nums">{formatLKR(sampleOrder.totalCents)}</span>
                  </div>
                </div>

                {/* 6. Payment Details */}
                <div className={`py-2 ${getDivider()} text-[10px] space-y-0.5`}>
                  {form.showPaymentMethod && (
                    <div className="flex justify-between">
                      <span>Payment Method:</span>
                      <span className="font-bold uppercase text-zinc-900">{sampleOrder.paymentMethod}</span>
                    </div>
                  )}

                  {form.showCashBreakdown && sampleOrder.paymentMethod === 'CASH' && (
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

                {/* 7. Footer Message */}
                {form.receiptFooter && (
                  <div className="pt-3 pb-1 text-center text-[10px] text-zinc-600 whitespace-pre-line leading-normal">
                    {form.receiptFooter}
                  </div>
                )}

                {/* 8. Wi-Fi Info */}
                {form.showWifiInfo && form.wifiSsid && (
                  <div className="pt-1 text-center text-[9px] text-zinc-500 font-mono">
                    Wi-Fi: <span className="font-bold text-zinc-700">{form.wifiSsid}</span>
                    {form.wifiPassword && ` | Pass: ${form.wifiPassword}`}
                  </div>
                )}

                {/* 9. Built-in Permanent Developer Credit Imprint */}
                <div className="mt-3 pt-2.5 border-t border-dashed border-zinc-200 text-center select-text">
                  <div className="text-[9px] font-sans tracking-wide text-zinc-400 uppercase">
                    Developed by <span className="font-bold text-zinc-700 tracking-wider">OGO TECHNOLOGY</span>
                  </div>
                  <div className="text-[8.5px] text-zinc-400 mt-0.5 tracking-tight font-mono flex items-center justify-center gap-1.5 opacity-85">
                    <span>www.ogotechnology.net</span>
                    <span className="opacity-40">•</span>
                    <span>+94 75 930 7059</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Bottom-Center Action Capsule */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center pointer-events-none select-none px-4 max-w-full">
        <div className="bg-[#1E1917]/95 text-white backdrop-blur-xl border border-white/10 shadow-2xl rounded-full p-1.5 px-3 flex items-center gap-2.5 pointer-events-auto transition-all duration-300 shrink-0">
          {/* Reset Button */}
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3.5 py-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 text-xs font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap active:scale-95"
            title="Reset to default template"
          >
            <RefreshCw className="w-3.5 h-3.5 shrink-0" />
            <span>Reset</span>
          </button>

          <div className="h-5 w-px bg-white/15 shrink-0" />

          {/* Test Print Button */}
          <button
            type="button"
            onClick={handleTestPrint}
            className="px-3.5 py-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 text-xs font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap active:scale-95"
            title="Test thermal print slip"
          >
            <Printer className="w-3.5 h-3.5 shrink-0" />
            <span>Test Print</span>
          </button>

          {/* Save Template Button - ONLY appears if hasUnsavedChanges is true */}
          {hasUnsavedChanges && (
            <>
              <div className="h-5 w-px bg-white/15 shrink-0" />
              <button
                type="button"
                onClick={() => handleManualSave()}
                className="px-4.5 py-2 rounded-full bg-brand-teal hover:bg-brand-teal-dark text-white text-xs font-extrabold shadow-teal transition-all active:scale-95 cursor-pointer flex items-center gap-2 whitespace-nowrap animate-in fade-in zoom-in-95"
                title="Save changes to receipt template"
              >
                <Save className="w-3.5 h-3.5 shrink-0" />
                <span>Save Template</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
