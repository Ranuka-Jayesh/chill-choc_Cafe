import React, { useState, useEffect, useMemo } from 'react';
import { settingsService } from '@/services/settingsService';
import { SystemSettings } from '@/types';
import { db } from '@/services/storage/db';
import { realtimeSocketService } from '@/services/realtimeSocketService';
import { rupeesToCents, centsToRupees } from '@/utils/format';
import {
  Store,
  DollarSign,
  Coins,
  Database,
  Save,
  CheckCircle2,
  Wifi,
  HardDrive,
  Activity,
  Zap,
  ShieldCheck,
  Building2,
  Receipt,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';

type SettingsTabKey = 'brand' | 'financials' | 'drawer' | 'database';

export const AdminSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings>(() => settingsService.getSettings());
  const [savedSettings, setSavedSettings] = useState<SystemSettings>(() => settingsService.getSettings());
  const [activeTab, setActiveTab] = useState<SettingsTabKey>('brand');
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const unsub = db.subscribe(() => {
      const current = settingsService.getSettings();
      setSettings(current);
      setSavedSettings(current);
    });

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsub();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(settings) !== JSON.stringify(savedSettings);
  }, [settings, savedSettings]);

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    settingsService.updateSettings(settings);
    setSavedSettings(settings);
    toast.success('System settings saved successfully.');
  };

  const tabs: { id: SettingsTabKey; label: string; icon: React.ReactNode }[] = [
    { id: 'brand', label: 'Café Brand', icon: <Store className="w-4 h-4" /> },
    { id: 'financials', label: 'Taxes & Charges', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'drawer', label: 'Cash Drawer', icon: <Coins className="w-4 h-4" /> },
    { id: 'database', label: 'Database & Sync', icon: <Database className="w-4 h-4" /> },
  ];

  // Live Database Storage Stats
  const storageStats = useMemo(() => {
    const snapshot = db.getSnapshot();
    const products = snapshot.products || [];
    const orders = snapshot.orders || [];
    const ingredients = snapshot.ingredients || [];
    const shifts = snapshot.shifts || [];
    const auditLogs = snapshot.auditLogs || [];
    return {
      productsCount: products.length,
      ordersCount: orders.length,
      ingredientsCount: ingredients.length,
      shiftsCount: shifts.length,
      auditLogsCount: auditLogs.length,
    };
  }, [settings]);

  return (
    <div className="flex flex-col h-full space-y-3 w-full pb-20 animate-in fade-in min-h-0">
      {/* 1. TOP TAB NAVIGATION (Fixed at top with active underline) */}
      <div className="flex-shrink-0 border-b border-[#E9E0D5] px-2 flex items-center gap-1 sm:gap-6 overflow-x-auto scrollbar-none">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`relative pb-3 pt-2 px-3 text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'text-brand-brown-dark'
                  : 'text-text-secondary hover:text-brand-brown'
              }`}
            >
              <span className={isActive ? 'text-brand-teal' : 'text-text-muted'}>
                {tab.icon}
              </span>
              <span>{tab.label}</span>

              {/* Active Tab Underline Indicator */}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-teal rounded-full animate-in fade-in" />
              )}
            </button>
          );
        })}
      </div>

      {/* 2. TAB CONTENT CARD (Only settings inside card scroll) */}
      <form
        id="settings-form"
        onSubmit={handleSave}
        className="bg-white rounded-3xl border border-[#E9E0D5] p-6 sm:p-8 shadow-xs flex-1 flex flex-col min-h-0 overflow-y-auto scrollbar-thin"
      >
        {/* TAB 1: CAFÉ BRAND PROFILE */}
        {activeTab === 'brand' && (
          <div className="space-y-1 animate-in fade-in duration-150 flex-1">
            {/* Row 1: Business Name */}
            <div className="pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-6">
              <div className="sm:w-1/3">
                <label className="text-xs font-black text-brand-brown-dark">Business Name</label>
                <p className="text-[11px] text-text-secondary mt-0.5">Official café / restaurant trading name</p>
              </div>
              <div className="sm:w-2/3">
                <input
                  type="text"
                  value={settings.businessName}
                  onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
                  placeholder="Chill & Choc"
                  className="w-full px-4 py-3 bg-[#FAF7F2] border border-[#E0D7CC] rounded-2xl text-xs font-bold text-brand-brown-dark focus:outline-none focus:border-brand-teal transition-colors shadow-2xs"
                  required
                />
              </div>
            </div>

            {/* Row 2: Tagline */}
            <div className="py-5 border-t border-[#F2ECE4] flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-6">
              <div className="sm:w-1/3">
                <label className="text-xs font-black text-brand-brown-dark">Brand Tagline</label>
                <p className="text-[11px] text-text-secondary mt-0.5">Marketing slogan or motto</p>
              </div>
              <div className="sm:w-2/3">
                <input
                  type="text"
                  value={settings.tagline}
                  onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                  placeholder="Cool Vibes, Sweet Bites"
                  className="w-full px-4 py-3 bg-[#FAF7F2] border border-[#E0D7CC] rounded-2xl text-xs font-bold text-brand-brown-dark focus:outline-none focus:border-brand-teal transition-colors shadow-2xs"
                />
              </div>
            </div>

            {/* Row 3: Phone Number */}
            <div className="py-5 border-t border-[#F2ECE4] flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-6">
              <div className="sm:w-1/3">
                <label className="text-xs font-black text-brand-brown-dark">Phone Number</label>
                <p className="text-[11px] text-text-secondary mt-0.5">Contact hotline for customer inquiries</p>
              </div>
              <div className="sm:w-2/3">
                <input
                  type="text"
                  value={settings.phone}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  placeholder="+94 11 234 5678"
                  className="w-full px-4 py-3 bg-[#FAF7F2] border border-[#E0D7CC] rounded-2xl text-xs font-bold font-mono text-brand-brown-dark focus:outline-none focus:border-brand-teal transition-colors shadow-2xs"
                />
              </div>
            </div>

            {/* Row 4: Email Address */}
            <div className="py-5 border-t border-[#F2ECE4] flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-6">
              <div className="sm:w-1/3">
                <label className="text-xs font-black text-brand-brown-dark">Email Address</label>
                <p className="text-[11px] text-text-secondary mt-0.5">Official customer support email</p>
              </div>
              <div className="sm:w-2/3">
                <input
                  type="email"
                  value={settings.email}
                  onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                  placeholder="hello@chillandchoc.lk"
                  className="w-full px-4 py-3 bg-[#FAF7F2] border border-[#E0D7CC] rounded-2xl text-xs font-bold text-brand-brown-dark focus:outline-none focus:border-brand-teal transition-colors shadow-2xs"
                />
              </div>
            </div>

            {/* Row 5: Store Address */}
            <div className="py-5 border-t border-[#F2ECE4] flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-6">
              <div className="sm:w-1/3">
                <label className="text-xs font-black text-brand-brown-dark">Physical Store Address</label>
                <p className="text-[11px] text-text-secondary mt-0.5">Outlet location details</p>
              </div>
              <div className="sm:w-2/3">
                <input
                  type="text"
                  value={settings.address}
                  onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                  placeholder="No. 42, Galle Road, Colombo 03, Sri Lanka"
                  className="w-full px-4 py-3 bg-[#FAF7F2] border border-[#E0D7CC] rounded-2xl text-xs font-bold text-brand-brown-dark focus:outline-none focus:border-brand-teal transition-colors shadow-2xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TAXES & CHARGES */}
        {activeTab === 'financials' && (
          <div className="space-y-1 animate-in fade-in duration-150 flex-1">
            {/* Row 1: Sales Tax / VAT */}
            <div className="pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-6">
              <div className="sm:w-1/3">
                <label className="text-xs font-black text-brand-brown-dark">Sales Tax / VAT Rate (%)</label>
                <p className="text-[11px] text-text-secondary mt-0.5">Default percentage added to taxable sales</p>
              </div>
              <div className="sm:w-2/3">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={settings.taxRatePercent}
                  onChange={(e) =>
                    setSettings({ ...settings, taxRatePercent: Number(e.target.value) })
                  }
                  className="w-48 px-4 py-3 bg-[#FAF7F2] border border-[#E0D7CC] rounded-2xl text-xs font-black text-brand-brown-dark focus:outline-none focus:border-brand-teal transition-colors shadow-2xs"
                />
              </div>
            </div>

            {/* Row 2: Service Charge */}
            <div className="py-5 border-t border-[#F2ECE4] flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-6">
              <div className="sm:w-1/3">
                <label className="text-xs font-black text-brand-brown-dark">Service Charge (%)</label>
                <p className="text-[11px] text-text-secondary mt-0.5">Dine-in / table service surcharge</p>
              </div>
              <div className="sm:w-2/3">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={settings.serviceChargePercent}
                  onChange={(e) =>
                    setSettings({ ...settings, serviceChargePercent: Number(e.target.value) })
                  }
                  className="w-48 px-4 py-3 bg-[#FAF7F2] border border-[#E0D7CC] rounded-2xl text-xs font-black text-brand-brown-dark focus:outline-none focus:border-brand-teal transition-colors shadow-2xs"
                />
              </div>
            </div>

            {/* Row 3: Currency */}
            <div className="py-5 border-t border-[#F2ECE4] flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-6">
              <div className="sm:w-1/3">
                <label className="text-xs font-black text-brand-brown-dark">Store Currency</label>
                <p className="text-[11px] text-text-secondary mt-0.5">Default currency code & symbol</p>
              </div>
              <div className="sm:w-2/3">
                <div className="px-4 py-3 bg-[#FAF7F2] border border-[#E0D7CC] rounded-2xl text-xs font-black font-mono text-brand-brown-dark inline-block shadow-2xs">
                  {settings.currencyCode} ({settings.currencySymbol} - Sri Lankan Rupee)
                </div>
              </div>
            </div>

            {/* Row 4: Decimal Places */}
            <div className="py-5 border-t border-[#F2ECE4] flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-6">
              <div className="sm:w-1/3">
                <label className="text-xs font-black text-brand-brown-dark">Decimal Precision</label>
                <p className="text-[11px] text-text-secondary mt-0.5">Formatting precision for monetary totals</p>
              </div>
              <div className="sm:w-2/3">
                <div className="px-4 py-3 bg-[#FAF7F2] border border-[#E0D7CC] rounded-2xl text-xs font-black font-mono text-brand-brown-dark inline-block shadow-2xs">
                  {settings.decimalPlaces} Decimal Places (0.00)
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CASH DRAWER & SHIFTS */}
        {activeTab === 'drawer' && (
          <div className="space-y-1 animate-in fade-in duration-150 flex-1">
            {/* Policy 1: Require Opening Cash */}
            <div className="pb-5 flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-black text-brand-brown-dark">Require Starting Float Cash</div>
                <div className="text-[11px] text-text-secondary mt-0.5">
                  Cashier must count and enter opening drawer float before accessing the POS register
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setSettings({
                    ...settings,
                    requireOpeningCash: !settings.requireOpeningCash,
                  })
                }
                className={`w-12 h-6.5 rounded-full transition-colors relative cursor-pointer shadow-2xs ${
                  settings.requireOpeningCash ? 'bg-brand-teal' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`block w-5 h-5 bg-white rounded-full transition-transform shadow-xs absolute top-0.5 ${
                    settings.requireOpeningCash ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Policy 2: Blind Shift Close */}
            <div className="py-5 border-t border-[#F2ECE4] flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-black text-brand-brown-dark">Blind Shift Reconciliation</div>
                <div className="text-[11px] text-text-secondary mt-0.5">
                  Hide expected system cash total until cashier counts and submits physical cash
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setSettings({ ...settings, blindShiftClose: !settings.blindShiftClose })
                }
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  settings.blindShiftClose ? 'bg-brand-teal' : 'bg-zinc-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    settings.blindShiftClose ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Policy 3: Mandatory Reason */}
            <div className="py-4 border-t border-[#F2ECE4] flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold text-brand-brown-dark">Mandatory Cash Out Reason</div>
                <div className="text-[11px] text-text-secondary mt-0.5">
                  Requires clear reason explanation for all drawer pay-outs and petty cash withdrawals
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setSettings({
                    ...settings,
                    requireReasonForCashOut: !settings.requireReasonForCashOut,
                  })
                }
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  settings.requireReasonForCashOut ? 'bg-brand-teal' : 'bg-zinc-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    settings.requireReasonForCashOut ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Policy 4: Automatic Drawer Kick */}
            <div className="py-4 border-t border-[#F2ECE4] flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold text-brand-brown-dark">Automatic Drawer Kick</div>
                <div className="text-[11px] text-text-secondary mt-0.5">
                  Send printer solenoid pulse automatically upon cash transaction completion
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setSettings({
                    ...settings,
                    openDrawerAfterCashSale: !settings.openDrawerAfterCashSale,
                  })
                }
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  settings.openDrawerAfterCashSale ? 'bg-brand-teal' : 'bg-zinc-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    settings.openDrawerAfterCashSale ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Policy 5: Variance Threshold */}
            <div className="py-4 border-t border-[#F2ECE4] flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-6">
              <div className="sm:w-1/2">
                <label className="text-xs font-bold text-brand-brown-dark">
                  Variance Explanation Threshold (Rs.)
                </label>
                <p className="text-[11px] text-text-secondary mt-0.5">
                  Cashier must provide an explanation if shift cash difference exceeds this amount
                </p>
              </div>
              <div className="sm:w-1/2 flex justify-start sm:justify-end">
                <input
                  type="number"
                  value={centsToRupees(settings.varianceReasonThresholdCents || 10000)}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      varianceReasonThresholdCents: rupeesToCents(Number(e.target.value)),
                    })
                  }
                  className="w-44 px-3.5 py-2.5 bg-[#FAF7F2] border border-[#E0D7CC] rounded-xl text-xs font-black tabular-nums text-brand-brown-dark focus:outline-none focus:border-brand-teal transition-colors"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: DATABASE & LIVE SYNC STATUS */}
        {activeTab === 'database' && (
          <div className="space-y-7 animate-in fade-in duration-150 py-1">
            {/* Connection Health Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Card 1: Storage Engine */}
              <div className="p-5 sm:p-6 rounded-3xl bg-[#FAF7F2] border border-[#E0D7CC] space-y-3 min-h-[125px] flex flex-col justify-between shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-text-muted">Storage Engine</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <div>
                  <div className="text-sm font-black text-brand-brown-dark flex items-center gap-2">
                    <HardDrive className="w-4.5 h-4.5 text-brand-teal" />
                    IndexedDB Gateway
                  </div>
                  <div className="text-xs text-emerald-700 font-bold mt-1">
                    Connected • Local Persistent
                  </div>
                </div>
              </div>

              {/* Card 2: Real-time Multi-Tab Sync */}
              <div className="p-5 sm:p-6 rounded-3xl bg-[#FAF7F2] border border-[#E0D7CC] space-y-3 min-h-[125px] flex flex-col justify-between shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-text-muted">Broadcast Cluster</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <div>
                  <div className="text-sm font-black text-brand-brown-dark flex items-center gap-2">
                    <Zap className="w-4.5 h-4.5 text-amber-500" />
                    Realtime WebSocket Mesh
                  </div>
                  <div className="text-xs text-emerald-700 font-bold mt-1">
                    Active • {realtimeSocketService.getLatency()}ms Latency
                  </div>
                </div>
              </div>

              {/* Card 3: Network & Connectivity */}
              <div className="p-5 sm:p-6 rounded-3xl bg-[#FAF7F2] border border-[#E0D7CC] space-y-3 min-h-[125px] flex flex-col justify-between shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-text-muted">Connected Terminals</span>
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      isOnline ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  />
                </div>
                <div>
                  <div className="text-sm font-black text-brand-brown-dark flex items-center gap-2">
                    <Wifi className="w-4.5 h-4.5 text-brand-teal" />
                    {isOnline ? '3 POS & Admin Nodes' : 'Offline Mode Active'}
                  </div>
                  <div className="text-xs text-text-secondary font-medium mt-1">
                    {isOnline ? 'Zero-latency cross-node sync' : 'Transactions stored locally'}
                  </div>
                </div>
              </div>
            </div>

            {/* Collection Breakdown */}
            <div className="pt-2">
              <div className="text-xs font-black text-brand-brown-dark mb-3.5 flex items-center gap-2">
                <Activity className="w-4.5 h-4.5 text-brand-teal" />
                <span>Live Storage Collection Breakdown</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
                <div className="py-5 px-3.5 sm:py-6 sm:px-4 rounded-3xl bg-[#FAF7F2] border border-[#E0D7CC] text-center shadow-2xs flex flex-col justify-center">
                  <div className="text-xl sm:text-2xl font-black text-brand-brown-dark tabular-nums">
                    {storageStats.productsCount}
                  </div>
                  <div className="text-[10.5px] font-extrabold text-text-secondary uppercase tracking-wider mt-1">
                    Menu Items
                  </div>
                </div>

                <div className="py-5 px-3.5 sm:py-6 sm:px-4 rounded-3xl bg-[#FAF7F2] border border-[#E0D7CC] text-center shadow-2xs flex flex-col justify-center">
                  <div className="text-xl sm:text-2xl font-black text-brand-brown-dark tabular-nums">
                    {storageStats.ordersCount}
                  </div>
                  <div className="text-[10.5px] font-extrabold text-text-secondary uppercase tracking-wider mt-1">
                    Total Orders
                  </div>
                </div>

                <div className="py-5 px-3.5 sm:py-6 sm:px-4 rounded-3xl bg-[#FAF7F2] border border-[#E0D7CC] text-center shadow-2xs flex flex-col justify-center">
                  <div className="text-xl sm:text-2xl font-black text-brand-brown-dark tabular-nums">
                    {storageStats.ingredientsCount}
                  </div>
                  <div className="text-[10.5px] font-extrabold text-text-secondary uppercase tracking-wider mt-1">
                    Ingredients
                  </div>
                </div>

                <div className="py-5 px-3.5 sm:py-6 sm:px-4 rounded-3xl bg-[#FAF7F2] border border-[#E0D7CC] text-center shadow-2xs flex flex-col justify-center">
                  <div className="text-xl sm:text-2xl font-black text-brand-brown-dark tabular-nums">
                    {storageStats.shiftsCount}
                  </div>
                  <div className="text-[10.5px] font-extrabold text-text-secondary uppercase tracking-wider mt-1">
                    Shift Logs
                  </div>
                </div>

                <div className="py-5 px-3.5 sm:py-6 sm:px-4 rounded-3xl bg-[#FAF7F2] border border-[#E0D7CC] text-center col-span-2 sm:col-span-1 shadow-2xs flex flex-col justify-center">
                  <div className="text-xl sm:text-2xl font-black text-brand-brown-dark tabular-nums">
                    {storageStats.auditLogsCount}
                  </div>
                  <div className="text-[10.5px] font-extrabold text-text-secondary uppercase tracking-wider mt-1">
                    Audit Events
                  </div>
                </div>
              </div>
            </div>

            {/* Offline Safeguard Note */}
            <div className="p-5 bg-emerald-50/90 border border-emerald-200 rounded-3xl flex items-center gap-3.5 shadow-2xs">
              <ShieldCheck className="w-6 h-6 text-emerald-700 shrink-0" />
              <div className="text-xs sm:text-sm text-emerald-950 leading-relaxed font-medium">
                <strong>Zero Downtime Offline Architecture:</strong> All menu data, shifts, active tables, and sales history are persistently stored directly inside the browser storage. No internet connection is needed for day-to-day point of sale operations.
              </div>
            </div>
          </div>
        )}
      </form>

      {/* 3. FLOATING BOTTOM-CENTER SAVE BUTTON */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center pointer-events-none select-none">
        <button
          type="submit"
          form="settings-form"
          className="bg-[#1E1917]/95 text-white backdrop-blur-xl border border-white/10 shadow-2xl rounded-full p-1.5 pl-5 pr-1.5 flex items-center gap-3 active:scale-95 transition-all cursor-pointer pointer-events-auto group hover:border-brand-teal/40"
          title="Save Configuration"
        >
          <span className="text-xs font-bold text-white tracking-wide">
            {hasUnsavedChanges ? 'Save Changes' : 'Save Configuration'}
          </span>
          <div className="w-10 h-10 rounded-full bg-brand-teal group-hover:bg-brand-teal-dark text-white flex items-center justify-center shadow-lg shadow-brand-teal/30 active:scale-95 transition-all shrink-0">
            <Save className="w-5 h-5 stroke-[2.2]" />
          </div>
        </button>
      </div>
    </div>
  );
};
