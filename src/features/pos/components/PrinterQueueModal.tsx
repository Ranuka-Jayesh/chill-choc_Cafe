import React, { useEffect } from 'react';
import { printerService } from '@/services/printerService';
import { PrinterJob } from '@/types';
import { formatDateTime } from '@/utils/format';
import { Printer, X, RefreshCw, AlertTriangle, CheckCircle2, FileText, Bug } from 'lucide-react';
import { toast } from 'sonner';

interface PrinterQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrinterQueueModal: React.FC<PrinterQueueModalProps> = ({ isOpen, onClose }) => {
  // Close with Escape key
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const jobs = printerService.getJobs();

  const handleRetry = async (jobId: string) => {
    await printerService.retryJob(jobId);
    toast.success('Reprint job re-queued successfully.');
  };

  const handleSimulateFailure = async () => {
    await printerService.simulateFailedJob('#1045');
    toast.warning('Simulated printer out-of-paper error.');
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-brown-deep/60 backdrop-blur-sm animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-white rounded-3xl shadow-elevated border border-border overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-cream-50 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-teal-light text-brand-teal flex items-center justify-center">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-brand-brown-dark">Thermal Printer Job Queue</h3>
              <p className="text-xs text-text-secondary">ESC/POS 80mm Hardware Dispatcher</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSimulateFailure}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-brand-orange bg-cream-100 hover:bg-cream-200 rounded-lg border border-border"
              title="Test Printer Error Failure Flow"
            >
              <Bug className="w-3.5 h-3.5" />
              Simulate Error
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-text-secondary hover:bg-cream-100">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-white">
          {jobs.length === 0 ? (
            <div className="text-center py-10 text-text-secondary">
              <Printer className="w-10 h-10 mx-auto text-zinc-300 mb-2" />
              <p className="font-bold text-sm">No printer jobs recorded yet.</p>
            </div>
          ) : (
            jobs.map((job) => {
              const isFailed = job.status === 'FAILED';

              return (
                <div
                  key={job.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isFailed
                      ? 'bg-status-danger-bg/40 border-status-danger/40'
                      : 'bg-cream-50/50 border-border'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-xs text-brand-brown-dark">
                          {job.type} {job.orderNumber ? `(${job.orderNumber})` : ''}
                        </span>
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                            isFailed
                              ? 'bg-status-danger text-white'
                              : 'bg-status-success text-white'
                          }`}
                        >
                          {job.status}
                        </span>
                        <span className="text-[11px] text-text-secondary font-mono">
                          {job.printerName}
                        </span>
                      </div>

                      <p className="text-[11px] text-text-secondary">
                        Created: {formatDateTime(job.createdAt)} • Attempts: {job.attempts}
                      </p>

                      {job.error && (
                        <div className="flex items-center gap-1.5 text-xs text-status-danger font-bold mt-1 bg-white/80 p-2 rounded-lg border border-status-danger/20">
                          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                          <span>{job.error}</span>
                        </div>
                      )}
                    </div>

                    {isFailed && (
                      <button
                        onClick={() => handleRetry(job.id)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-brand-teal hover:bg-brand-teal-dark text-white rounded-xl font-bold text-xs shadow-teal active:scale-95"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Retry Print
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-cream-50 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-brand-teal text-white font-bold text-xs shadow-teal hover:bg-brand-teal-dark"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
