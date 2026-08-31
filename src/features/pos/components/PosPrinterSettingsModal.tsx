import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { printerService, PrintResult } from '@/services/printerService';
import { settingsService } from '@/services/settingsService';
import { PrinterConfig, PrinterJob, SystemSettings, PreparationStation } from '@/types';
import { db } from '@/services/storage/db';
import { formatDateTime } from '@/utils/format';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { confirmDialog } from '@/store/useConfirmStore';
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
} from 'lucide-react';
import { toast } from 'sonner';

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

  const [editingPrinter, setEditingPrinter] = useState<Partial<PrinterConfig> | null>(null);
  const [viewingTestJob, setViewingTestJob] = useState<PrinterJob | null>(null);
  const [filterJobStatus, setFilterJobStatus] = useState('ALL');

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

  if (!isOpen) return null;

  const handleTestPrint = async (printer: PrinterConfig) => {
    const result = await printerService.testPrint(printer.id);
    const testJob = printerService.getJobs().find((j) => j.id === result.jobId);
    if (testJob) {
      setViewingTestJob(testJob);
    }
    toast.success(`Diagnostic test slip printed to ${printer.name}`);
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
    return true;
  });

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
        <div className="flex items-center justify-between px-5 sm:px-8 py-4 sm:py-5 bg-gradient-to-r from-cream-50 to-white border-b border-border/70">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-brand-teal-light border border-brand-teal/20 text-brand-teal flex items-center justify-center shadow-sm">
              <Printer className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg text-brand-brown-dark tracking-tight">
                POS Printer Management & Hardware Routing
              </h3>
              <p className="text-xs text-text-secondary">
                Configure 80mm ESC/POS receipt, kitchen, and bar thermal printers
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center text-text-secondary hover:text-brand-brown-dark hover:bg-cream-100 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modern Segmented Tab Bar */}
        <div className="px-5 sm:px-8 py-3 bg-cream-50/50 border-b border-border/60">
          <div className="inline-flex p-1 bg-cream-200/70 rounded-2xl border border-cream-200 gap-1 w-full sm:w-auto overflow-x-auto">
            <button
              onClick={() => setActiveTab('PRINTERS')}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-extrabold text-xs transition-all whitespace-nowrap ${
                activeTab === 'PRINTERS'
                  ? 'bg-brand-teal text-white shadow-teal'
                  : 'text-text-secondary hover:text-brand-brown-dark'
              }`}
            >
              <Printer className="w-4 h-4" />
              <span>Configured Printers ({printers.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('QUEUE')}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-extrabold text-xs transition-all whitespace-nowrap ${
                activeTab === 'QUEUE'
                  ? 'bg-brand-teal text-white shadow-teal'
                  : 'text-text-secondary hover:text-brand-brown-dark'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Print Queue & Logs ({jobs.length})</span>
              {jobs.some((j) => j.status === 'FAILED') && (
                <span className="w-2 h-2 rounded-full bg-status-danger animate-pulse" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('SETTINGS')}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-extrabold text-xs transition-all whitespace-nowrap ${
                activeTab === 'SETTINGS'
                  ? 'bg-brand-teal text-white shadow-teal'
                  : 'text-text-secondary hover:text-brand-brown-dark'
              }`}
            >
              <Settings2 className="w-4 h-4" />
              <span>Printing Rules</span>
            </button>
          </div>
        </div>

        {/* Scrollable Tab Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6">
          {/* TAB 1: PRINTERS LIST */}
          {activeTab === 'PRINTERS' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-extrabold text-sm sm:text-base text-brand-brown-dark">
                    Connected Receipt & Prep Printers
                  </h4>
                  <p className="text-xs text-text-secondary">
                    Manage ESC/POS printer routing, test diagnostic prints, and cash drawer solenoid
                  </p>
                </div>

                <div className="flex items-center gap-2.5 self-start sm:self-auto">
                  <button
                    onClick={handleTestDrawerKick}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 bg-brand-yellow-light hover:bg-brand-yellow/30 text-amber-900 border border-brand-yellow/50 rounded-xl font-extrabold text-xs shadow-sm transition-all active:scale-95"
                  >
                    <Coins className="w-4 h-4 text-brand-orange" />
                    Test Drawer Kick
                  </button>

                  <button
                    onClick={() =>
                      setEditingPrinter({
                        name: '',
                        role: 'RECEIPT',
                        connectionType: 'LAN_IP',
                        address: '192.168.1.100:9100',
                        paperWidthMm: 80,
                        autoCut: true,
                        drawerKickRJ12: false,
                        beepOnPrint: true,
                        copies: 1,
                        isOnline: true,
                        isDefaultReceipt: false,
                      })
                    }
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-brand-teal hover:bg-brand-teal-dark text-white rounded-xl font-black text-xs shadow-teal transition-all active:scale-95"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    Add Printer
                  </button>
                </div>
              </div>

              {/* Printers Card Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                {printers.map((printer) => {
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
                      className="bg-white p-5 rounded-3xl border-2 border-border/80 hover:border-brand-teal/40 hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-3">
                        {/* Device Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-cream-100/90 text-brand-teal flex items-center justify-center border border-cream-200/80 shadow-xs">
                              <ConnectionIcon className="w-5 h-5 stroke-[2]" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h5 className="font-extrabold text-sm text-brand-brown-dark">
                                  {printer.name}
                                </h5>
                                {printer.isDefaultReceipt && (
                                  <span className="px-2 py-0.5 rounded-full bg-brand-teal-light text-brand-teal font-extrabold text-[10px] uppercase">
                                    Default
                                  </span>
                                )}
                              </div>
                              <p className="text-xs font-mono text-text-secondary mt-0.5">{printer.address}</p>
                            </div>
                          </div>

                          {/* Online Toggle Pill */}
                          <button
                            onClick={() => handleToggleOnline(printer.id)}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold transition-all ${
                              printer.isOnline
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                printer.isOnline ? 'bg-emerald-500 shadow-sm' : 'bg-rose-500'
                              }`}
                            />
                            <span>{printer.isOnline ? 'Online' : 'Offline'}</span>
                          </button>
                        </div>

                        {/* Feature Badges */}
                        <div className="flex flex-wrap gap-1.5 pt-1 text-[11px]">
                          <span className="px-2.5 py-1 rounded-xl bg-cream-100/80 text-brand-brown-dark font-extrabold uppercase border border-cream-200/60">
                            Role: {printer.role.replace(/_/g, ' ')}
                          </span>
                          <span className="px-2.5 py-1 rounded-xl bg-cream-100/80 text-text-primary font-bold border border-cream-200/60">
                            {printer.paperWidthMm}mm Thermal
                          </span>
                          {printer.drawerKickRJ12 && (
                            <span className="px-2.5 py-1 rounded-xl bg-brand-yellow-light text-amber-900 font-extrabold border border-brand-yellow/40 flex items-center gap-1">
                              <Coins className="w-3 h-3 text-brand-orange" />
                              RJ12 Solenoid
                            </span>
                          )}
                          {printer.autoCut && (
                            <span className="px-2.5 py-1 rounded-xl bg-cream-100/80 text-text-secondary font-medium border border-cream-200/60 flex items-center gap-1">
                              <Scissors className="w-3 h-3 text-text-secondary" />
                              Auto-Cut
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action Bar */}
                      <div className="pt-3 border-t border-cream-100 flex items-center gap-2">
                        <button
                          onClick={() => handleTestPrint(printer)}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-cream-100 hover:bg-brand-teal hover:text-white rounded-xl text-brand-brown-dark font-extrabold text-xs transition-all active:scale-95 shadow-xs"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          Test Print
                        </button>

                        <button
                          onClick={() => setEditingPrinter(printer)}
                          className="p-2.5 text-text-secondary hover:text-brand-teal hover:bg-cream-100 rounded-xl transition-all"
                          title="Edit Configuration"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleDeletePrinter(printer.id)}
                          className="p-2.5 text-text-secondary hover:text-status-danger hover:bg-status-danger-bg rounded-xl transition-all"
                          title="Delete Printer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: PRINT QUEUE */}
          {activeTab === 'QUEUE' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="font-extrabold text-sm sm:text-base text-brand-brown-dark">
                    Thermal Print Jobs & Dispatch Queue
                  </h4>
                  <p className="text-xs text-text-secondary">
                    Monitor spooler statuses, retry failed tickets, and verify thermal receipts
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <CustomSelect
                    value={filterJobStatus}
                    onChange={(val) => setFilterJobStatus(val)}
                    buttonClassName="py-2 px-3 text-xs"
                    className="w-36"
                    options={[
                      { value: 'ALL', label: 'All Statuses' },
                      { value: 'PRINTED', label: 'PRINTED' },
                      { value: 'FAILED', label: 'FAILED' },
                      { value: 'QUEUED', label: 'QUEUED' },
                    ]}
                  />

                  <button
                    onClick={() => printerService.simulateFailedJob('#1099')}
                    className="px-3.5 py-2 bg-cream-100 hover:bg-rose-50 hover:text-rose-600 border border-border rounded-xl text-xs font-extrabold transition-all"
                  >
                    Simulate Paper Jam
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="bg-white rounded-3xl border border-border shadow-soft overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border bg-cream-50 text-text-secondary font-bold uppercase text-[10px]">
                        <th className="py-3 px-4">Time</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Order / Ref</th>
                        <th className="py-3 px-4">Target Printer</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cream-100 font-medium">
                      {filteredJobs.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-12 text-text-secondary">
                            No print jobs found.
                          </td>
                        </tr>
                      ) : (
                        filteredJobs.map((job) => (
                          <tr key={job.id} className="hover:bg-cream-50/60 transition-colors">
                            <td className="py-3 px-4 text-text-secondary">{formatDateTime(job.createdAt)}</td>
                            <td className="py-3 px-4 font-bold text-brand-brown-dark">{job.type}</td>
                            <td className="py-3 px-4 font-black text-brand-teal">{job.orderNumber || '-'}</td>
                            <td className="py-3 px-4 text-text-secondary">{job.printerName}</td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase ${
                                  job.status === 'PRINTED'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : job.status === 'FAILED'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200 animate-pulse'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}
                              >
                                {job.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right space-x-1.5">
                              <button
                                onClick={() => setViewingTestJob(job)}
                                className="px-2.5 py-1.5 bg-cream-100 hover:bg-cream-200 text-brand-brown font-bold text-[11px] rounded-lg transition-colors"
                              >
                                View Slip
                              </button>
                              {job.status === 'FAILED' && (
                                <button
                                  onClick={async () => {
                                    await printerService.retryJob(job.id);
                                    toast.success(`Job for ${job.orderNumber} re-printed!`);
                                  }}
                                  className="px-2.5 py-1.5 bg-brand-teal text-white font-extrabold text-[11px] rounded-lg shadow-teal"
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
            </div>
          )}

          {/* TAB 3: PRINTING RULES */}
          {activeTab === 'SETTINGS' && (
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex items-center gap-3.5 p-4 sm:p-5 bg-cream-50/80 hover:bg-cream-100/80 rounded-2xl sm:rounded-3xl border border-border text-xs font-bold cursor-pointer transition-all">
                  <input
                    type="checkbox"
                    checked={settings.autoPrintReceipt}
                    onChange={(e) => setSettings({ ...settings, autoPrintReceipt: e.target.checked })}
                    className="w-4 h-4 rounded text-brand-teal focus:ring-brand-teal"
                  />
                  <div>
                    <div className="text-sm font-extrabold text-brand-brown-dark">Auto-Print Customer Receipt</div>
                    <div className="text-[11px] text-text-secondary font-normal mt-0.5">
                      Automatically output thermal receipt after completing payment
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-3.5 p-4 sm:p-5 bg-cream-50/80 hover:bg-cream-100/80 rounded-2xl sm:rounded-3xl border border-border text-xs font-bold cursor-pointer transition-all">
                  <input
                    type="checkbox"
                    checked={settings.autoPrintKOT}
                    onChange={(e) => setSettings({ ...settings, autoPrintKOT: e.target.checked })}
                    className="w-4 h-4 rounded text-brand-teal focus:ring-brand-teal"
                  />
                  <div>
                    <div className="text-sm font-extrabold text-brand-brown-dark">Auto-Print Kitchen Prep Tickets (KOT)</div>
                    <div className="text-[11px] text-text-secondary font-normal mt-0.5">
                      Dispatch ticket to Bar/Kitchen/Dessert stations upon order submission
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-3.5 p-4 sm:p-5 bg-cream-50/80 hover:bg-cream-100/80 rounded-2xl sm:rounded-3xl border border-border text-xs font-bold cursor-pointer transition-all">
                  <input
                    type="checkbox"
                    checked={settings.openDrawerAfterCashSale}
                    onChange={(e) => setSettings({ ...settings, openDrawerAfterCashSale: e.target.checked })}
                    className="w-4 h-4 rounded text-brand-teal focus:ring-brand-teal"
                  />
                  <div>
                    <div className="text-sm font-extrabold text-brand-brown-dark">Automatic Cash Drawer Solenoid Kick</div>
                    <div className="text-[11px] text-text-secondary font-normal mt-0.5">
                      Fire 24V RJ12 solenoid pulse when Cash is tendered
                    </div>
                  </div>
                </label>

                <div className="p-4 sm:p-5 bg-cream-50/80 rounded-2xl sm:rounded-3xl border border-border flex items-center justify-between">
                  <div>
                    <label className="text-sm font-extrabold text-brand-brown-dark block">
                      Receipt Copies to Print
                    </label>
                    <span className="text-[11px] text-text-secondary">
                      Customer copy + Merchant copy
                    </span>
                  </div>
                  <select
                    value={settings.receiptCopies || 1}
                    onChange={(e) => setSettings({ ...settings, receiptCopies: Number(e.target.value) })}
                    className="px-3.5 py-2 bg-white border border-border rounded-xl text-xs font-bold text-brand-brown-dark"
                  >
                    <option value={1}>1 Copy</option>
                    <option value={2}>2 Copies (Merchant + Customer)</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-3 bg-brand-teal hover:bg-brand-teal-dark text-white rounded-2xl font-extrabold text-xs shadow-teal transition-all active:scale-95"
                >
                  Save Printing Preferences
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-cream-50 border-t border-border/80 flex items-center justify-between">
          <span className="text-xs font-semibold text-text-secondary hidden sm:inline">
            Press ESC or click Done when finished.
          </span>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-8 py-3 bg-brand-brown-dark hover:bg-brand-brown-deep text-white font-extrabold text-xs rounded-2xl shadow-soft transition-all active:scale-95 ml-auto"
          >
            Done
          </button>
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
                <div className="p-4 bg-white rounded-2xl shadow-inner border border-border font-mono text-[11px] leading-relaxed whitespace-pre select-text text-brand-brown-deep">
                  {viewingTestJob.payloadText}
                </div>
              </div>

              <div className="p-3 bg-cream-50 border-t border-border flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    window.print();
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
    </div>
  );
};
