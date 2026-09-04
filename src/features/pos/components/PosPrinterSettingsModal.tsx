import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { printerService, PrintResult } from '@/services/printerService';
import { settingsService } from '@/services/settingsService';
import { PrinterConfig, PrinterJob, SystemSettings, PreparationStation, Order } from '@/types';
import { db } from '@/services/storage/db';
import { formatDateTime } from '@/utils/format';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { CustomDatePicker } from '@/components/ui/CustomDatePicker';
import { confirmDialog } from '@/store/useConfirmStore';
import { ThermalReceiptModal } from '@/components/brand/ThermalReceiptModal';
import { KOTPreviewModal } from '@/components/brand/KOTPreviewModal';
import {
  Printer,
  Wifi,
  Usb,
  Bluetooth,
  Monitor,
  Play,
  RotateCw,
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  Coins,
  AlertCircle,
  CheckCircle2,
  FileText,
  Settings2,
  Sparkles,
  Scissors,
  Volume2,
  Layers,
  Calendar,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { printThermalElement } from '@/utils/printThermal';
import { directPrintService, AgentHealthStatus, AgentPrinterInfo } from '@/services/directPrintService';

const getTodayDateStr = () => new Date().toISOString().slice(0, 10);

interface PosPrinterSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PosPrinterSettingsModal: React.FC<PosPrinterSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'PRINTERS' | 'QUEUE' | 'SETTINGS'>('PRINTERS');
  const [printers, setPrinters] = useState<PrinterConfig[]>(printerService.getPrinters());
  const [jobs, setJobs] = useState<PrinterJob[]>(printerService.getJobs());
  const [settings, setSettings] = useState<SystemSettings>(settingsService.getSettings());
  const [stations, setStations] = useState<PreparationStation[]>(db.getSnapshot().stations || []);

  // Direct Thermal Printing (Windows Local Print Agent) states
  const [agentStatus, setAgentStatus] = useState<AgentHealthStatus | null>(null);
  const [detectedPrinters, setDetectedPrinters] = useState<AgentPrinterInfo[]>([]);
  const [isRefreshingAgent, setIsRefreshingAgent] = useState(false);
  const [isTestingDirectPrint, setIsTestingDirectPrint] = useState(false);
  const [isTestingDrawer, setIsTestingDrawer] = useState(false);

  const [editingPrinter, setEditingPrinter] = useState<Partial<PrinterConfig> | null>(null);
  const [viewingTestJob, setViewingTestJob] = useState<PrinterJob | null>(null);
  const [viewingReceiptOrder, setViewingReceiptOrder] = useState<Order | null>(null);
  const [viewingKOTOrder, setViewingKOTOrder] = useState<Order | null>(null);
  const [filterJobStatus, setFilterJobStatus] = useState('ALL');
  const [filterDate, setFilterDate] = useState<string>(getTodayDateStr);

  const handleViewSlip = (job: PrinterJob) => {
    const orders = db.getSnapshot().orders;
    const numToFind = (job.orderNumber || '').replace(/^#/, '');
    const foundOrder = orders.find(
      (o) =>
        o.id === job.orderId ||
        o.orderNumber === job.orderNumber ||
        o.orderNumber === numToFind ||
        `#${o.orderNumber}` === job.orderNumber
    );

    if (job.type === 'CUSTOMER_RECEIPT' && foundOrder) {
      setViewingReceiptOrder(foundOrder);
      return;
    }

    if (job.type === 'KOT' && foundOrder) {
      setViewingKOTOrder(foundOrder);
      return;
    }

    setViewingTestJob(job);
  };

  useEffect(() => {
    const unsub = db.subscribe(() => {
      setPrinters(printerService.getPrinters());
      setJobs(printerService.getJobs());
      setSettings(settingsService.getSettings());
      setStations(db.getSnapshot().stations || []);
    });
    return unsub;
  }, []);

  // Close with Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (viewingTestJob) {
          setViewingTestJob(null);
        } else if (editingPrinter) {
          setEditingPrinter(null);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, editingPrinter, viewingTestJob]);

  const handleTestPrint = async (printer: PrinterConfig) => {
    // If it's a USB / Direct printer, trigger real direct ESC/POS hardware print
    if (directPrintService.isEnabled() || printer.connectionType === 'USB') {
      toast.loading(`Sending test slip to ${printer.name}...`, { id: 'test-slip' });
      const res = await directPrintService.testPrint(printer.name);
      if (res.success) {
        toast.success(`Diagnostic test slip printed to ${printer.name}!`, { id: 'test-slip', icon: '🖨️' });
      } else {
        toast.error(res.message || `Failed to print to ${printer.name}`, { id: 'test-slip' });
      }
      return;
    }

    const result = await printerService.testPrint(printer.id);
    const testJob = printerService.getJobs().find((j) => j.id === result.jobId);
    if (testJob) {
      setViewingTestJob(testJob);
    }
    toast.success(`Diagnostic test slip printed to ${printer.name}`);
  };

  // Refresh Windows Local Print Agent health, discover physical printers, and sync real hardware
  const refreshAgent = async (showToast = false) => {
    setIsRefreshingAgent(true);
    try {
      const health = await directPrintService.checkAgentHealth(settings.directPrintAgentUrl);
      setAgentStatus(health);

      if (health.online) {
        const prns = await directPrintService.getAvailablePrinters(settings.directPrintAgentUrl);
        setDetectedPrinters(prns);

        // Filter strictly genuine thermal / receipt printers (ignore Generic/Text Only, Fax, PDF, OneNote, XPS)
        const thermalPrns = prns.filter(
          (p) =>
            !/generic \/ text only|fax|pdf|onenote|xps|document writer/i.test(p.name) &&
            (p.isLikelyThermal ||
              /xp-|80|pos|receipt|thermal/i.test(p.name) ||
              /xp-|80|pos|receipt|thermal/i.test(p.driver))
        );
        const candidates = thermalPrns;

        if (candidates.length > 0 && !settings.directPrintPrinterName) {
          setSettings((prev) => ({ ...prev, directPrintPrinterName: candidates[0].name }));
        }

        // Live hardware sync: sync real Windows printers into db.printers & purge any dummy mock printers
        db.update('printers', (currentPrinters) => {
          // Remove any dummy / mock placeholders and Generic / Text Only completely
          const cleaned = (currentPrinters || []).filter(
            (p) =>
              p &&
              p.name &&
              p.name !== 'Thermal Printer' &&
              p.name !== 'New Thermal Printer' &&
              p.name !== 'USB Printer Port' &&
              p.name !== 'Generic / Text Only' &&
              !p.id?.startsWith('prn_receipt_80mm') &&
              !p.id?.startsWith('prn_kitchen_80mm') &&
              !p.id?.startsWith('prn_bar_80mm') &&
              !p.id?.startsWith('prn_dessert_80mm')
          );

          // For each detected real printer on Windows, add or update its live online status
          candidates.forEach((detected, idx) => {
            const existingIdx = cleaned.findIndex((p) => p.name.toLowerCase() === detected.name.toLowerCase());
            if (existingIdx >= 0) {
              cleaned[existingIdx] = {
                ...cleaned[existingIdx],
                isOnline: Boolean(detected.isOnline),
                address: detected.port || cleaned[existingIdx].address || 'USB',
              };
            } else {
              cleaned.push({
                id: `prn_${detected.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`,
                name: detected.name,
                role: 'RECEIPT',
                connectionType: 'USB',
                address: detected.port || 'USB',
                paperWidthMm: 80,
                autoCut: true,
                drawerKickRJ12: true,
                beepOnPrint: true,
                copies: 1,
                isOnline: Boolean(detected.isOnline),
                isDefaultReceipt: idx === 0,
              });
            }
          });

          return cleaned;
        });

        if (showToast) {
          if (candidates.length > 0) {
            const onlineCount = candidates.filter((c) => c.isOnline).length;
            toast.success(`Found ${candidates.length} printer(s) (${onlineCount} online)!`, { icon: '🖨️' });
          } else {
            toast.info('No thermal printers detected on this computer.');
          }
        }
      } else {
        // Agent offline: purge any dummy mock printers
        db.update('printers', (currentPrinters) =>
          (currentPrinters || []).filter(
            (p) =>
              p &&
              p.name &&
              p.name !== 'Thermal Printer' &&
              p.name !== 'New Thermal Printer' &&
              p.name !== 'USB Printer Port' &&
              !p.id?.startsWith('prn_receipt_80mm') &&
              !p.id?.startsWith('prn_kitchen_80mm') &&
              !p.id?.startsWith('prn_bar_80mm') &&
              !p.id?.startsWith('prn_dessert_80mm')
          )
        );
        if (showToast) {
          toast.error('Local Print Agent is not responding on localhost:23456');
        }
      }
    } finally {
      setIsRefreshingAgent(false);
    }
  };

  const handleScanHardware = async () => {
    await refreshAgent(true);
  };

  // Live polling while modal is open to update plug/unplug hardware status in real-time
  useEffect(() => {
    if (!isOpen) return;
    refreshAgent(false);

    const interval = setInterval(() => {
      refreshAgent(false);
    }, 3500);

    return () => clearInterval(interval);
  }, [isOpen]);

  const handleDirectTestPrint = async () => {
    setIsTestingDirectPrint(true);
    try {
      const res = await directPrintService.testPrint(settings.directPrintPrinterName);
      if (res.success) {
        toast.success(res.message, { icon: '🖨️' });
      } else {
        toast.error(res.message || 'Direct test print failed');
      }
    } finally {
      setIsTestingDirectPrint(false);
    }
  };

  const handleDirectDrawerKick = async () => {
    setIsTestingDrawer(true);
    try {
      const res = await directPrintService.openCashDrawer(settings.directPrintPrinterName);
      if (res.success) {
        toast.success(res.message, { icon: '💵' });
      } else {
        toast.error(res.message || 'Cash drawer kick failed');
      }
    } finally {
      setIsTestingDrawer(false);
    }
  };

  const handleTestDrawerKick = async () => {
    await printerService.openCashDrawer();
    toast.success('Cash drawer solenoid kick pulse fired [ESC p 0]!');
  };

  const handleToggleOnline = (printerId: string) => {
    printerService.togglePrinterOnline(printerId);
  };

  const handleSavePrinter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPrinter?.name || !editingPrinter?.address) {
      toast.error('Printer name and connection address are required.');
      return;
    }

    printerService.savePrinter(editingPrinter);
    toast.success('Printer configuration saved.');
    setEditingPrinter(null);
  };

  const handleDeletePrinter = async (printerId: string) => {
    const printer = printers.find((p) => p.id === printerId);
    const confirmed = await confirmDialog({
      title: `Delete Printer "${printer?.name || 'Device'}"?`,
      message: 'Are you sure you want to remove this printer configuration from the POS station?',
      confirmText: 'Delete Printer',
      cancelText: 'Keep Printer',
      variant: 'danger',
    });

    if (confirmed) {
      printerService.deletePrinter(printerId);
      toast.info('Printer removed.');
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    settingsService.updateSettings(settings);
    toast.success('POS printing preferences updated.');
  };

  const filteredJobs = jobs.filter((j) => {
    if (filterJobStatus !== 'ALL' && j.status !== filterJobStatus) return false;
    if (filterDate) {
      const jobDate = j.createdAt ? j.createdAt.slice(0, 10) : '';
      if (jobDate !== filterDate) return false;
    }
    return true;
  });

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-brand-brown-deep/60 backdrop-blur-md animate-in fade-in select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl bg-white rounded-3xl sm:rounded-[32px] shadow-2xl border border-border/80 overflow-hidden flex flex-col max-h-[92vh] transition-all select-text"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-border/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-teal-light text-brand-teal flex items-center justify-center shadow-xs">
              <Printer className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <h3 className="font-bold text-base text-brand-brown-dark tracking-tight">
                Printers &amp; Hardware
              </h3>
              <p className="text-xs text-text-secondary">
                Manage thermal receipt printers and hardware routing
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-text-secondary hover:text-brand-brown-dark hover:bg-cream-100 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modern Segmented Tab Bar */}
        <div className="px-6 py-2.5 bg-cream-50/50 border-b border-border/60">
          <div className="inline-flex p-1 bg-cream-200/60 rounded-xl border border-cream-200/80 gap-1">
            <button
              onClick={() => setActiveTab('PRINTERS')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-bold text-xs transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'PRINTERS'
                  ? 'bg-brand-teal text-white shadow-xs'
                  : 'text-text-secondary hover:text-brand-brown-dark'
              }`}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Printers ({printers.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('QUEUE')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-bold text-xs transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'QUEUE'
                  ? 'bg-brand-teal text-white shadow-xs'
                  : 'text-text-secondary hover:text-brand-brown-dark'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Print Queue ({jobs.length})</span>
              {jobs.some((j) => j.status === 'FAILED') && (
                <span className="w-2 h-2 rounded-full bg-status-danger animate-pulse" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('SETTINGS')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-bold text-xs transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'SETTINGS'
                  ? 'bg-brand-teal text-white shadow-xs'
                  : 'text-text-secondary hover:text-brand-brown-dark'
              }`}
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>Rules &amp; Preferences</span>
            </button>
          </div>
        </div>

        {/* Scrollable Tab Body */}
        <div
          className={`flex-1 ${
            activeTab === 'QUEUE'
              ? 'overflow-hidden flex flex-col p-4 sm:p-6'
              : 'overflow-y-auto p-5 sm:p-6 space-y-5'
          }`}
        >
          {/* TAB 1: PRINTERS LIST */}
          {activeTab === 'PRINTERS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 pb-1">
                <div>
                  <h4 className="font-bold text-sm text-brand-brown-dark">
                    Connected Printers
                  </h4>
                  <p className="text-xs text-text-secondary">
                    Thermal receipt printers detected on this computer
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleScanHardware}
                    disabled={isRefreshingAgent}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-cream-100 text-brand-brown-dark border border-border/80 rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer disabled:opacity-60"
                    title="Rescan connected USB and thermal printers"
                  >
                    <RotateCw className={`w-3.5 h-3.5 text-brand-teal ${isRefreshingAgent ? 'animate-spin' : ''}`} />
                    <span>{isRefreshingAgent ? 'Scanning...' : 'Rescan'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setEditingPrinter({
                        name: 'Kitchen Thermal',
                        role: 'KITCHEN_KOT',
                        connectionType: 'LAN_IP',
                        address: '192.168.1.200:9100',
                        paperWidthMm: 80,
                        autoCut: true,
                        drawerKickRJ12: false,
                        beepOnPrint: true,
                        copies: 1,
                        isOnline: true,
                        isDefaultReceipt: false,
                      })
                    }
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-brand-teal hover:bg-brand-teal-dark text-white rounded-xl font-bold text-xs shadow-teal transition-all cursor-pointer active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Add Network Printer</span>
                  </button>
                </div>
              </div>

              {/* Printers Card Grid or Clean Empty State */}
              {printers.length === 0 ? (
                <div className="py-16 px-6 text-center border-2 border-dashed border-border/80 rounded-3xl bg-cream-50/40 flex flex-col items-center justify-center space-y-4 animate-in fade-in">
                  <div className="w-14 h-14 rounded-2xl bg-cream-100 border border-cream-200 text-brand-brown/60 flex items-center justify-center shadow-inner">
                    <Printer className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="text-base font-extrabold text-brand-brown-dark mb-1">
                      No Thermal Printers Connected
                    </h4>
                    <p className="text-xs text-text-secondary max-w-md mx-auto">
                      Plug your XP-80C or thermal receipt printer into this computer via USB. Windows will register it and it will appear here automatically.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleScanHardware}
                      disabled={isRefreshingAgent}
                      className="flex items-center gap-2 px-5 py-2 bg-brand-teal hover:bg-brand-teal-dark text-white rounded-xl font-bold text-xs shadow-teal transition-all cursor-pointer"
                    >
                      <RotateCw className={`w-3.5 h-3.5 ${isRefreshingAgent ? 'animate-spin' : ''}`} />
                      <span>{isRefreshingAgent ? 'Scanning Hardware...' : 'Scan / Detect Hardware'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingPrinter({
                          name: 'Kitchen Thermal',
                          role: 'KITCHEN_KOT',
                          connectionType: 'LAN_IP',
                          address: '192.168.1.200:9100',
                          paperWidthMm: 80,
                          autoCut: true,
                          drawerKickRJ12: false,
                          beepOnPrint: true,
                          copies: 1,
                          isOnline: true,
                          isDefaultReceipt: false,
                        })
                      }
                      className="px-4 py-2 bg-white border border-border/80 hover:bg-cream-100 text-brand-brown-dark rounded-xl font-bold text-xs transition-all cursor-pointer"
                    >
                      + Add LAN IP Printer
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(printers || []).filter(Boolean).map((printer) => {
                    const ConnectionIcon =
                      printer.connectionType === 'LAN_IP'
                        ? Wifi
                        : printer.connectionType === 'USB'
                        ? Usb
                        : printer.connectionType === 'BLUETOOTH'
                        ? Bluetooth
                        : Monitor;
                    return (
                      <div
                        key={printer.id}
                        className="bg-white p-5 rounded-2xl border border-border/80 hover:border-brand-teal/40 hover:shadow-xs transition-all flex flex-col justify-between space-y-4"
                      >
                        <div className="space-y-3">
                          {/* Device Header */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-brand-teal-light text-brand-teal flex items-center justify-center border border-brand-teal/20 shrink-0">
                                <ConnectionIcon className="w-5 h-5 stroke-[2]" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h5 className="font-bold text-sm text-brand-brown-dark">
                                    {printer.name}
                                  </h5>
                                  {printer.isDefaultReceipt && (
                                    <span className="px-2 py-0.5 rounded-full bg-brand-teal/10 text-brand-teal font-bold text-[10px]">
                                      Default
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-text-muted mt-0.5">
                                  {printer.connectionType} • {printer.paperWidthMm || 80}mm Thermal • {printer.address || 'Port'}
                                </p>
                              </div>
                            </div>

                            {/* Live Hardware Status Pill */}
                            <div
                              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold transition-all select-none shrink-0 ${
                                printer.isOnline
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                              title={printer.isOnline ? 'Hardware connected and ready to print' : 'Hardware unplugged or turned off'}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  printer.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                                }`}
                              />
                              <span>{printer.isOnline ? 'Online' : 'Offline'}</span>
                            </div>
                          </div>

                          {/* Feature Badges - Subtle & Clean */}
                          <div className="flex items-center gap-2 text-[11px] text-text-secondary pt-0.5">
                            <span className="px-2 py-0.5 rounded-lg bg-cream-50 text-brand-brown-dark font-medium border border-border/60">
                              Role: {(printer.role || 'RECEIPT').replace(/_/g, ' ')}
                            </span>
                            {printer.drawerKickRJ12 && (
                              <span className="px-2 py-0.5 rounded-lg bg-cream-50 text-brand-brown-dark font-medium border border-border/60">
                                Cash Drawer Ready
                              </span>
                            )}
                            {printer.autoCut && (
                              <span className="px-2 py-0.5 rounded-lg bg-cream-50 text-brand-brown-dark font-medium border border-border/60">
                                Auto-Cut
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center justify-between pt-3 border-t border-border/60">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleTestPrint(printer)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-cream-100 hover:bg-cream-200 text-brand-brown-dark rounded-xl text-xs font-bold transition-all cursor-pointer"
                            >
                              <Play className="w-3.5 h-3.5" />
                              <span>Test Slip</span>
                            </button>
                            {printer.drawerKickRJ12 && (
                              <button
                                type="button"
                                onClick={() => {
                                  directPrintService.openCashDrawer(printer.name);
                                  toast.success(`Drawer kick command sent to ${printer.name}`);
                                }}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-cream-50 hover:bg-cream-100 text-brand-brown-dark border border-border/60 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                                title="Kick Cash Drawer Solenoid"
                              >
                                <Coins className="w-3.5 h-3.5 text-amber-600" />
                                <span>Kick Drawer</span>
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setEditingPrinter(printer)}
                              className="p-1.5 text-text-secondary hover:text-brand-brown-dark hover:bg-cream-100 rounded-lg transition-all cursor-pointer"
                              title="Edit Configuration"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeletePrinter(printer.id)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                              title="Remove Printer Profile"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PRINT QUEUE */}
          {activeTab === 'QUEUE' && (
            <div className="flex-1 flex flex-col min-h-0 space-y-3 overflow-hidden">
              {/* Top Filter Bar (Fixed / Non-scrolling) */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-[#EAE3DA] shrink-0">
                <div>
                  <h4 className="font-black text-sm sm:text-base text-brand-brown-dark flex items-center gap-2">
                    <span>Thermal Print Jobs &amp; Spooler Queue</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-cream-100 text-brand-brown-dark font-bold font-mono">
                      {filteredJobs.length} {filteredJobs.length === 1 ? 'record' : 'records'}
                    </span>
                  </h4>
                  <p className="text-xs text-text-muted">
                    Filter by date (day, month, year) or status to inspect and reprint slips
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Custom Designed Responsive Calendar Date Picker */}
                  <CustomDatePicker
                    value={filterDate}
                    onChange={(newDate) => setFilterDate(newDate)}
                    placeholder="All Dates"
                    className="w-48"
                    inputClassName="py-1.5 px-3 text-xs font-bold shadow-2xs"
                    showPresets={true}
                    align="right"
                  />

                  {/* Status Dropdown */}
                  <CustomSelect
                    value={filterJobStatus}
                    onChange={(val) => setFilterJobStatus(val)}
                    buttonClassName="py-1.5 px-3 text-xs"
                    className="w-32"
                    options={[
                      { value: 'ALL', label: 'All Statuses' },
                      { value: 'PRINTED', label: 'PRINTED' },
                      { value: 'FAILED', label: 'FAILED' },
                      { value: 'QUEUED', label: 'QUEUED' },
                    ]}
                  />
                </div>
              </div>

              {/* Scrollable Table Records Container */}
              <div className="flex-1 overflow-y-auto min-h-0 border border-[#F0EAE1] rounded-2xl scrollbar-thin">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-white z-10 shadow-2xs">
                    <tr className="border-b border-[#EAE3DA] text-text-muted font-bold uppercase text-[10px] tracking-wider bg-white">
                      <th className="py-2.5 px-3 bg-white">Time</th>
                      <th className="py-2.5 px-3 bg-white">Type</th>
                      <th className="py-2.5 px-3 bg-white">Order / Ref</th>
                      <th className="py-2.5 px-3 bg-white">Target Printer</th>
                      <th className="py-2.5 px-3 bg-white text-center">Status</th>
                      <th className="py-2.5 px-3 bg-white text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0EAE1]">
                    {filteredJobs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-text-muted font-medium">
                          No print jobs found for {filterDate || 'selected filter'}.
                        </td>
                      </tr>
                    ) : (
                      filteredJobs.map((job) => (
                        <tr key={job.id} className="hover:bg-[#FAF7F2] transition-colors">
                          <td className="py-2.5 px-3 text-text-muted font-mono text-[11px] whitespace-nowrap">
                            {formatDateTime(job.createdAt)}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-brand-brown-dark">
                            {job.type}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-brand-brown-dark">
                            {job.orderNumber || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-text-secondary text-xs">
                            {job.printerName}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`text-[11px] font-bold ${
                                job.status === 'PRINTED'
                                  ? 'text-emerald-700'
                                  : job.status === 'FAILED'
                                  ? 'text-red-600'
                                  : 'text-amber-700'
                              }`}
                            >
                              {job.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right space-x-2 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleViewSlip(job)}
                              className="text-xs font-bold text-brand-teal hover:text-brand-teal-dark hover:underline cursor-pointer"
                            >
                              View Slip
                            </button>
                            {job.status === 'FAILED' && (
                              <button
                                type="button"
                                onClick={async () => {
                                  await printerService.retryJob(job.id);
                                  toast.success(`Job for ${job.orderNumber} re-printed!`);
                                }}
                                className="text-xs font-bold text-amber-700 hover:text-amber-900 hover:underline cursor-pointer"
                              >
                                Retry
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: PRINTING RULES & PREFERENCES */}
          {activeTab === 'SETTINGS' && (
            <form onSubmit={handleSaveSettings} className="space-y-5 select-text max-w-2xl mx-auto">
              {/* Card 1: Primary Receipt Printer */}
              <div className="bg-white rounded-2xl border border-border/80 shadow-xs overflow-hidden">
                <div className="px-5 py-3.5 bg-cream-50/60 border-b border-border/60 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-brand-teal-light text-brand-teal flex items-center justify-center">
                      <Printer className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-brand-brown-dark">Receipt Printer</h4>
                      <p className="text-[11px] text-text-secondary">Default printer for customer receipts and cash drawer</p>
                    </div>
                  </div>

                  {/* Connection indicator */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                        agentStatus?.online
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${agentStatus?.online ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                      {agentStatus?.online ? 'Connected' : 'Offline'}
                    </span>
                    <button
                      type="button"
                      disabled={isRefreshingAgent}
                      onClick={() => refreshAgent(true)}
                      className="p-1 text-text-secondary hover:text-brand-brown-dark rounded-lg transition-all cursor-pointer"
                      title="Rescan printers"
                    >
                      <RotateCw className={`w-3.5 h-3.5 ${isRefreshingAgent ? 'animate-spin text-brand-teal' : ''}`} />
                    </button>
                  </div>
                </div>

                <div className="p-4 sm:p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Printer select */}
                    <div className="sm:col-span-2">
                      <label className="text-xs font-bold text-brand-brown-dark block mb-1.5">
                        Selected Device
                      </label>
                      <select
                        value={settings.directPrintPrinterName || 'XP-80C'}
                        onChange={(e) => setSettings({ ...settings, directPrintPrinterName: e.target.value })}
                        className="w-full px-3 py-2 bg-cream-50/50 border border-border rounded-xl text-xs font-semibold text-brand-brown-dark focus:border-brand-teal focus:bg-white transition-all cursor-pointer"
                      >
                        {detectedPrinters.length > 0 ? (
                          detectedPrinters.map((prn) => (
                            <option key={prn.name} value={prn.name}>
                              {prn.name} {prn.isOnline ? '● Online' : '○ Offline'}
                            </option>
                          ))
                        ) : (
                          <option value="XP-80C">XP-80C (Thermal)</option>
                        )}
                      </select>
                    </div>

                    {/* Paper width */}
                    <div>
                      <label className="text-xs font-bold text-brand-brown-dark block mb-1.5">
                        Paper Width
                      </label>
                      <select
                        value={settings.directPrintPaperWidthMm || 80}
                        onChange={(e) => setSettings({ ...settings, directPrintPaperWidthMm: Number(e.target.value) as any })}
                        className="w-full px-3 py-2 bg-cream-50/50 border border-border rounded-xl text-xs font-semibold text-brand-brown-dark focus:border-brand-teal focus:bg-white transition-all cursor-pointer"
                      >
                        <option value={80}>80 mm (Standard)</option>
                        <option value={58}>58 mm (Compact)</option>
                      </select>
                    </div>
                  </div>

                  {/* Actions: Test Print & Drawer Kick */}
                  <div className="flex items-center justify-between pt-3 border-t border-border/60">
                    <span className="text-xs text-text-secondary">Test Printer &amp; Cash Drawer</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isTestingDrawer || !agentStatus?.online}
                        onClick={handleDirectDrawerKick}
                        className="px-3 py-1.5 bg-white border border-border/80 hover:bg-cream-100 text-brand-brown-dark rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Coins className="w-3.5 h-3.5 text-amber-600" />
                        <span>{isTestingDrawer ? 'Opening...' : 'Open Drawer'}</span>
                      </button>

                      <button
                        type="button"
                        disabled={isTestingDirectPrint || !agentStatus?.online}
                        onClick={handleDirectTestPrint}
                        className="px-3.5 py-1.5 bg-brand-teal hover:bg-brand-teal-dark text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>{isTestingDirectPrint ? 'Printing...' : 'Print Test Slip'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Print Rules & Automation */}
              <div className="bg-white rounded-2xl border border-border/80 shadow-xs overflow-hidden">
                <div className="px-5 py-3.5 bg-cream-50/60 border-b border-border/60">
                  <h4 className="font-bold text-xs sm:text-sm text-brand-brown-dark">Automation &amp; Behavior</h4>
                  <p className="text-[11px] text-text-secondary">Configure automatic printing and hardware actions</p>
                </div>

                <div className="divide-y divide-border/50">
                  {/* Direct Print Toggle */}
                  <label className="flex items-center justify-between px-5 py-3 hover:bg-cream-50/40 transition-all cursor-pointer">
                    <div>
                      <div className="text-xs font-bold text-brand-brown-dark">Direct Thermal Printing</div>
                      <div className="text-[11px] text-text-secondary">Print directly without opening the browser dialog</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.directPrintEnabled ?? true}
                      onChange={(e) => setSettings({ ...settings, directPrintEnabled: e.target.checked })}
                      className="w-4 h-4 rounded text-brand-teal focus:ring-brand-teal cursor-pointer"
                    />
                  </label>

                  {/* Auto-print customer receipt */}
                  <label className="flex items-center justify-between px-5 py-3 hover:bg-cream-50/40 transition-all cursor-pointer">
                    <div>
                      <div className="text-xs font-bold text-brand-brown-dark">Auto-Print Receipt on Payment</div>
                      <div className="text-[11px] text-text-secondary">Output receipt immediately when payment completes</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.autoPrintReceipt}
                      onChange={(e) => setSettings({ ...settings, autoPrintReceipt: e.target.checked })}
                      className="w-4 h-4 rounded text-brand-teal focus:ring-brand-teal cursor-pointer"
                    />
                  </label>

                  {/* Auto-print KOT */}
                  <label className="flex items-center justify-between px-5 py-3 hover:bg-cream-50/40 transition-all cursor-pointer">
                    <div>
                      <div className="text-xs font-bold text-brand-brown-dark">Auto-Print Kitchen Tickets (KOT)</div>
                      <div className="text-[11px] text-text-secondary">Send prep tickets to kitchen when order is placed</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.autoPrintKOT}
                      onChange={(e) => setSettings({ ...settings, autoPrintKOT: e.target.checked })}
                      className="w-4 h-4 rounded text-brand-teal focus:ring-brand-teal cursor-pointer"
                    />
                  </label>

                  {/* Auto-cut paper */}
                  <label className="flex items-center justify-between px-5 py-3 hover:bg-cream-50/40 transition-all cursor-pointer">
                    <div>
                      <div className="text-xs font-bold text-brand-brown-dark">Auto-Cut Paper</div>
                      <div className="text-[11px] text-text-secondary">Automatically cut receipt paper after printing</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.directPrintAutoCut ?? true}
                      onChange={(e) => setSettings({ ...settings, directPrintAutoCut: e.target.checked })}
                      className="w-4 h-4 rounded text-brand-teal focus:ring-brand-teal cursor-pointer"
                    />
                  </label>

                  {/* Open drawer on cash */}
                  <label className="flex items-center justify-between px-5 py-3 hover:bg-cream-50/40 transition-all cursor-pointer">
                    <div>
                      <div className="text-xs font-bold text-brand-brown-dark">Open Cash Drawer on Cash Payment</div>
                      <div className="text-[11px] text-text-secondary">Trigger cash drawer when payment method is Cash</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.openDrawerAfterCashSale}
                      onChange={(e) => setSettings({ ...settings, openDrawerAfterCashSale: e.target.checked })}
                      className="w-4 h-4 rounded text-brand-teal focus:ring-brand-teal cursor-pointer"
                    />
                  </label>

                  {/* Receipt copies */}
                  <div className="flex items-center justify-between px-5 py-3">
                    <div>
                      <div className="text-xs font-bold text-brand-brown-dark">Receipt Copies</div>
                      <div className="text-[11px] text-text-secondary">Number of receipt copies per order</div>
                    </div>
                    <select
                      value={settings.receiptCopies || 1}
                      onChange={(e) => setSettings({ ...settings, receiptCopies: Number(e.target.value) })}
                      className="px-3 py-1.5 bg-cream-50/50 border border-border rounded-xl text-xs font-semibold text-brand-brown-dark focus:border-brand-teal cursor-pointer"
                    >
                      <option value={1}>1 Copy</option>
                      <option value={2}>2 Copies (Customer + Store)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Bottom save bar */}
              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-brand-teal hover:bg-brand-teal-dark text-white rounded-xl font-bold text-xs shadow-teal transition-all active:scale-95 cursor-pointer"
                >
                  Save Preferences
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Edit / Add Printer Submodal */}
      {editingPrinter &&
        createPortal(
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (e.target === e.currentTarget) setEditingPrinter(null);
            }}
            className="fixed inset-0 z-[99999] w-full h-full flex items-center justify-center p-4 bg-brand-brown-deep/80 backdrop-blur-md animate-in fade-in select-none"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[92vh] select-text"
            >
              <div className="flex items-center justify-between px-6 py-4 bg-cream-50 border-b border-border">
                <h4 className="font-extrabold text-base text-brand-brown-dark">
                  {editingPrinter.id ? 'Configure Thermal Printer' : 'Add Thermal Printer'}
                </h4>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingPrinter(null);
                  }}
                  className="p-1.5 text-text-secondary hover:bg-cream-100 rounded-xl cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSavePrinter} className="flex-1 overflow-y-auto p-6 space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase text-text-secondary">Printer Device Name</label>
                  <input
                    type="text"
                    value={editingPrinter.name || ''}
                    onChange={(e) => setEditingPrinter({ ...editingPrinter, name: e.target.value })}
                    placeholder="e.g. Barista Counter 80mm"
                    className="w-full mt-1 px-3.5 py-2.5 bg-cream-50 border border-border rounded-xl text-xs font-bold"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <CustomSelect
                      label="Printer Role"
                      value={editingPrinter.role || 'RECEIPT'}
                      onChange={(val) => setEditingPrinter({ ...editingPrinter, role: val as any })}
                      options={[
                        { value: 'RECEIPT', label: 'Customer Receipt' },
                        { value: 'KITCHEN_KOT', label: 'Kitchen KOT Prep' },
                        { value: 'BAR_KOT', label: 'Bar & Beverage KOT' },
                        { value: 'DESSERT_KOT', label: 'Dessert & Waffle KOT' },
                        { value: 'REPORT', label: 'Shift / Daily Reports' },
                      ]}
                    />
                  </div>

                  <div>
                    <CustomSelect
                      label="Connection Interface"
                      value={editingPrinter.connectionType || 'LAN_IP'}
                      onChange={(val) =>
                        setEditingPrinter({ ...editingPrinter, connectionType: val as any })
                      }
                      options={[
                        { value: 'LAN_IP', label: 'Network (LAN / Wi-Fi IP)' },
                        { value: 'USB', label: 'Direct USB (ESC/POS)' },
                        { value: 'BLUETOOTH', label: 'Bluetooth Thermal' },
                        { value: 'BROWSER_DRIVER', label: 'System Driver' },
                      ]}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-text-secondary">
                    Device Address / IP / Port
                  </label>
                  <input
                    type="text"
                    value={editingPrinter.address || ''}
                    onChange={(e) => setEditingPrinter({ ...editingPrinter, address: e.target.value })}
                    placeholder="e.g. 192.168.1.200:9100 or USB001"
                    className="w-full mt-1 px-3.5 py-2.5 bg-cream-50 border border-border rounded-xl text-xs font-mono font-bold"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <CustomSelect
                      label="Paper Roll Width"
                      value={String(editingPrinter.paperWidthMm || 80)}
                      onChange={(val) =>
                        setEditingPrinter({ ...editingPrinter, paperWidthMm: Number(val) as any })
                      }
                      options={[
                        { value: '80', label: '80mm (Standard)' },
                        { value: '58', label: '58mm (Compact)' },
                      ]}
                    />
                  </div>

                  <div>
                    <CustomSelect
                      label="Station Routing"
                      value={editingPrinter.stationId || ''}
                      onChange={(val) => setEditingPrinter({ ...editingPrinter, stationId: val })}
                      options={[
                        { value: '', label: 'Counter / All Stations' },
                        ...stations.map((st) => ({ value: st.id, label: st.name })),
                      ]}
                    />
                  </div>
                </div>

                <div className="space-y-2.5 pt-2 border-t border-border">
                  <label className="flex items-center gap-2 text-xs font-bold text-text-primary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingPrinter.autoCut}
                      onChange={(e) => setEditingPrinter({ ...editingPrinter, autoCut: e.target.checked })}
                      className="rounded text-brand-teal"
                    />
                    <span>Enable Guillotine Auto-Cutter [GS V 66 0]</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-bold text-text-primary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingPrinter.drawerKickRJ12}
                      onChange={(e) =>
                        setEditingPrinter({ ...editingPrinter, drawerKickRJ12: e.target.checked })
                      }
                      className="rounded text-brand-teal"
                    />
                    <span>Connected Cash Drawer Kick (RJ12 24V port)</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-bold text-text-primary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingPrinter.beepOnPrint}
                      onChange={(e) =>
                        setEditingPrinter({ ...editingPrinter, beepOnPrint: e.target.checked })
                      }
                      className="rounded text-brand-teal"
                    />
                    <span>Chime buzzer on kitchen/bar ticket arrival</span>
                  </label>
                </div>

                <div className="pt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingPrinter(null);
                    }}
                    className="px-4 py-2.5 rounded-xl border border-border text-xs font-bold text-text-secondary hover:bg-cream-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-brand-teal text-white font-extrabold text-xs shadow-teal hover:bg-brand-teal-dark cursor-pointer active:scale-95"
                  >
                    Save Printer
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Diagnostic Test Slip Preview Modal */}
      {viewingTestJob &&
        createPortal(
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (e.target === e.currentTarget) setViewingTestJob(null);
            }}
            className="fixed inset-0 z-[99999] w-full h-full flex items-center justify-center p-4 bg-brand-brown-deep/80 backdrop-blur-md animate-in fade-in select-none"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-border overflow-hidden select-text"
            >
              <div className="flex items-center justify-between px-5 py-3.5 bg-cream-50 border-b border-border">
                <h5 className="font-extrabold text-xs text-brand-brown-dark">Thermal Ticket Diagnostic</h5>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewingTestJob(null);
                  }}
                  className="p-1 text-text-secondary hover:bg-cream-100 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 bg-cream-100/50">
                <div id="printable-test-slip" className="p-4 bg-white rounded-2xl shadow-inner border border-border font-mono text-[11px] leading-relaxed whitespace-pre select-text text-brand-brown-deep">
                  {viewingTestJob.payloadText}
                </div>
              </div>

              <div className="p-3 bg-cream-50 border-t border-border flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    printThermalElement('printable-test-slip');
                  }}
                  className="px-5 py-2 bg-brand-teal text-white rounded-xl text-xs font-extrabold shadow-teal active:scale-95 cursor-pointer hover:bg-brand-teal-dark"
                >
                  Print via Browser
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Admin Designed Thermal Receipt Modal */}
      {viewingReceiptOrder && (
        <ThermalReceiptModal
          order={viewingReceiptOrder}
          isOpen={!!viewingReceiptOrder}
          onClose={() => setViewingReceiptOrder(null)}
        />
      )}

      {/* Admin Designed Kitchen Order Ticket (KOT) Modal */}
      {viewingKOTOrder && (
        <KOTPreviewModal
          order={viewingKOTOrder}
          isOpen={!!viewingKOTOrder}
          onClose={() => setViewingKOTOrder(null)}
        />
      )}
    </div>
  );
};
