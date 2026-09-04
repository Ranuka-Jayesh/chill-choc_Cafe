import { db } from './storage/db';
import { Order, PrinterJob, SystemSettings } from '@/types';

export interface AgentPrinterInfo {
  name: string;
  isDefault: boolean;
  port: string;
  driver: string;
  isLikelyThermal: boolean;
  isOnline?: boolean;
}

export interface AgentHealthStatus {
  online: boolean;
  version?: string;
  uptimeSecs?: number;
  error?: string;
}

export interface DirectPrintResult {
  success: boolean;
  jobId?: string;
  message: string;
  error?: string;
  duplicateIgnored?: boolean;
}

class DirectPrintService {
  private defaultUrl = 'http://127.0.0.1:23456';
  private defaultAuthToken = 'cafemm_secure_print_token_2026';

  private getSettings(): SystemSettings {
    return db.getSnapshot().settings;
  }

  public getAgentUrl(): string {
    const settings = this.getSettings();
    return (settings.directPrintAgentUrl || this.defaultUrl).replace(/\/$/, '');
  }

  public getAuthToken(): string {
    const settings = this.getSettings();
    return settings.directPrintAuthToken || this.defaultAuthToken;
  }

  public getSelectedPrinter(): string {
    const settings = this.getSettings();
    return settings.directPrintPrinterName || 'XP-80C';
  }

  public isEnabled(): boolean {
    const settings = this.getSettings();
    return Boolean(settings.directPrintEnabled);
  }

  /**
   * Fast health check to verify if the Windows Local Print Agent is active on localhost
   */
  public async checkAgentHealth(customUrl?: string): Promise<AgentHealthStatus> {
    const targetUrl = (customUrl || this.getAgentUrl()).replace(/\/$/, '');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    try {
      const resp = await fetch(`${targetUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });
      clearTimeout(timeoutId);

      if (!resp.ok) {
        return { online: false, error: `HTTP ${resp.status}: Agent returned non-200` };
      }

      const data = await resp.json();
      return {
        online: data.status === 'ONLINE',
        version: data.version,
        uptimeSecs: data.uptimeSecs,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      const isAborted = err.name === 'AbortError';
      return {
        online: false,
        error: isAborted ? 'Connection timed out (agent not responding)' : (err.message || 'Cannot reach local print agent on localhost:23456'),
      };
    }
  }

  /**
   * Auto-detect installed Windows printers from the local cashier computer
   */
  public async getAvailablePrinters(customUrl?: string): Promise<AgentPrinterInfo[]> {
    const targetUrl = (customUrl || this.getAgentUrl()).replace(/\/$/, '');
    const token = this.getAuthToken();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      const resp = await fetch(`${targetUrl}/printers`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'X-POS-Auth': token,
        },
      });
      clearTimeout(timeoutId);

      if (!resp.ok) {
        throw new Error(`Agent error (${resp.status}): Failed to query Windows printers`);
      }

      const data = await resp.json();
      return data.printers || [];
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.warn('[DirectPrintService] Failed to query printers from agent:', err.message);
      return [];
    }
  }

  /**
   * Silent Direct Print Customer Receipt to XPrinter
   */
  public async printCustomerReceipt(
    order: Order,
    options: {
      forceReprint?: boolean;
      customPrinterName?: string;
      autoCut?: boolean;
      openDrawer?: boolean;
    } = {}
  ): Promise<DirectPrintResult> {
    const settings = this.getSettings();
    const printerName = options.customPrinterName || this.getSelectedPrinter();
    const jobId = `job_rcpt_${order.id}_${Date.now()}`;
    const targetUrl = this.getAgentUrl();
    const token = this.getAuthToken();

    const payload = {
      jobId,
      printerName,
      type: 'RECEIPT',
      order,
      settings,
      options: {
        paperWidthMm: settings.directPrintPaperWidthMm || settings.receiptCustomization?.paperWidthMm || 80,
        autoCut: options.autoCut !== undefined ? options.autoCut : (settings.directPrintAutoCut ?? true),
        openDrawer: options.openDrawer !== undefined ? options.openDrawer : (settings.openDrawerAfterCashSale ?? true),
        forceReprint: Boolean(options.forceReprint),
      },
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const resp = await fetch(`${targetUrl}/print`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-POS-Auth': token,
        },
        body: JSON.stringify(payload),
      });
      clearTimeout(timeoutId);

      const result = await resp.json();

      if (!resp.ok || !result.success) {
        const errorMsg = result.error || `HTTP ${resp.status} Print failed`;
        this.recordJob(jobId, order, printerName, 'CUSTOMER_RECEIPT', 'FAILED', errorMsg);
        return {
          success: false,
          jobId,
          message: errorMsg,
          error: errorMsg,
        };
      }

      this.recordJob(jobId, order, printerName, 'CUSTOMER_RECEIPT', 'PRINTED');
      return {
        success: true,
        jobId,
        message: result.message || `Receipt printed to ${printerName}`,
        duplicateIgnored: result.duplicateIgnored,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      const isAborted = err.name === 'AbortError';
      const errorMsg = isAborted
        ? 'Print timed out. Make sure the XPrinter is powered on and connected via USB.'
        : `Cannot connect to print agent: ${err.message || 'Check start-agent.bat'}`;

      this.recordJob(jobId, order, printerName, 'CUSTOMER_RECEIPT', 'FAILED', errorMsg);

      return {
        success: false,
        jobId,
        message: errorMsg,
        error: errorMsg,
      };
    }
  }

  /**
   * Silent Direct Print Kitchen Order Ticket (KOT) to XPrinter
   */
  public async printKitchenTicket(
    order: Order,
    options: {
      customPrinterName?: string;
      autoCut?: boolean;
      beep?: boolean;
    } = {}
  ): Promise<DirectPrintResult> {
    const settings = this.getSettings();
    const printerName = options.customPrinterName || this.getSelectedPrinter();
    const jobId = `job_kot_${order.id}_${Date.now()}`;
    const targetUrl = this.getAgentUrl();
    const token = this.getAuthToken();

    const payload = {
      jobId,
      printerName,
      type: 'KOT',
      order,
      settings,
      options: {
        paperWidthMm: settings.directPrintPaperWidthMm || 80,
        autoCut: options.autoCut !== undefined ? options.autoCut : true,
        beep: options.beep !== undefined ? options.beep : true,
      },
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const resp = await fetch(`${targetUrl}/print`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-POS-Auth': token,
        },
        body: JSON.stringify(payload),
      });
      clearTimeout(timeoutId);

      const result = await resp.json();
      if (!resp.ok || !result.success) {
        const errorMsg = result.error || 'Failed to print KOT';
        this.recordJob(jobId, order, printerName, 'KOT', 'FAILED', errorMsg);
        return { success: false, jobId, message: errorMsg, error: errorMsg };
      }

      this.recordJob(jobId, order, printerName, 'KOT', 'PRINTED');
      return { success: true, jobId, message: `KOT printed to ${printerName}` };
    } catch (err: any) {
      clearTimeout(timeoutId);
      const errorMsg = `KOT print failed: ${err.message}`;
      this.recordJob(jobId, order, printerName, 'KOT', 'FAILED', errorMsg);
      return { success: false, jobId, message: errorMsg, error: errorMsg };
    }
  }

  /**
   * Diagnostic Hardware Test Slip
   */
  public async testPrint(printerName?: string): Promise<DirectPrintResult> {
    const targetPrinter = printerName || this.getSelectedPrinter();
    const targetUrl = this.getAgentUrl();
    const token = this.getAuthToken();

    try {
      const resp = await fetch(`${targetUrl}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-POS-Auth': token,
        },
        body: JSON.stringify({
          printerName: targetPrinter,
          paperWidthMm: this.getSettings().directPrintPaperWidthMm || 80,
        }),
      });

      const data = await resp.json();
      if (!resp.ok || !data.success) {
        return { success: false, message: data.error || 'Test print failed' };
      }

      return { success: true, message: `Diagnostic slip sent to "${targetPrinter}"!` };
    } catch (err: any) {
      return { success: false, message: `Agent communication error: ${err.message}` };
    }
  }

  /**
   * Fire cash drawer solenoid kick pulse [ESC p 0]
   */
  public async openCashDrawer(printerName?: string): Promise<DirectPrintResult> {
    const targetPrinter = printerName || this.getSelectedPrinter();
    const targetUrl = this.getAgentUrl();
    const token = this.getAuthToken();

    try {
      const resp = await fetch(`${targetUrl}/open-drawer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-POS-Auth': token,
        },
        body: JSON.stringify({ printerName: targetPrinter }),
      });

      const data = await resp.json();
      if (!resp.ok || !data.success) {
        return { success: false, message: data.error || 'Failed to open drawer' };
      }

      return { success: true, message: 'Cash drawer kick signal sent!' };
    } catch (err: any) {
      return { success: false, message: `Agent error: ${err.message}` };
    }
  }

  private recordJob(
    jobId: string,
    order: Order,
    printerName: string,
    type: 'CUSTOMER_RECEIPT' | 'KOT',
    status: 'PRINTED' | 'FAILED',
    error?: string
  ) {
    const now = new Date().toISOString();
    const job: PrinterJob = {
      id: jobId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      printerId: printerName,
      printerName,
      type,
      status,
      attempts: 1,
      createdAt: now,
      printedAt: status === 'PRINTED' ? now : undefined,
      error,
      payloadText: `Order #${order.orderNumber} - ${order.totalCents / 100} LKR (${type})`,
    };

    db.update('printerJobs', (jobs) => [job, ...(jobs || [])]);
  }
}

export const directPrintService = new DirectPrintService();
