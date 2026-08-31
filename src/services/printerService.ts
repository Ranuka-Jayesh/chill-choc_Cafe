import { db } from './storage/db';
import { Order, PrinterJob, SystemSettings, PrinterConfig } from '@/types';
import { formatLKR, formatDateTime } from '@/utils/format';

export interface PrintResult {
  success: boolean;
  jobId: string;
  message: string;
}

export const printerService = {
  getPrinters: (): PrinterConfig[] => {
    return db.getSnapshot().printers || [];
  },

  getPrinterById: (id: string): PrinterConfig | undefined => {
    return db.getSnapshot().printers?.find((p) => p.id === id);
  },

  savePrinter: (input: Partial<PrinterConfig>): PrinterConfig => {
    const existing = db.getSnapshot().printers?.find((p) => p.id === input.id);
    let updatedPrinter: PrinterConfig;

    if (existing) {
      updatedPrinter = { ...existing, ...input } as PrinterConfig;
      db.update('printers', (printers) =>
        (printers || []).map((p) => (p.id === existing.id ? updatedPrinter : p))
      );
    } else {
      updatedPrinter = {
        id: input.id || `prn_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        name: input.name || 'New Thermal Printer',
        role: input.role || 'RECEIPT',
        connectionType: input.connectionType || 'LAN_IP',
        address: input.address || '192.168.1.200:9100',
        paperWidthMm: input.paperWidthMm || 80,
        autoCut: input.autoCut !== undefined ? input.autoCut : true,
        drawerKickRJ12: input.drawerKickRJ12 !== undefined ? input.drawerKickRJ12 : false,
        beepOnPrint: input.beepOnPrint !== undefined ? input.beepOnPrint : true,
        copies: input.copies || 1,
        stationId: input.stationId,
        isOnline: input.isOnline !== undefined ? input.isOnline : true,
        isDefaultReceipt: Boolean(input.isDefaultReceipt),
      };
      db.update('printers', (printers) => [...(printers || []), updatedPrinter]);
    }

    return updatedPrinter;
  },

  deletePrinter: (printerId: string): void => {
    db.update('printers', (printers) => (printers || []).filter((p) => p.id !== printerId));
  },

  togglePrinterOnline: (printerId: string): void => {
    db.update('printers', (printers) =>
      (printers || []).map((p) => (p.id === printerId ? { ...p, isOnline: !p.isOnline } : p))
    );
  },

  /**
   * Generates and prints an ESC/POS 80mm Hardware Diagnostic Test Slip
   */
  testPrint: async (printerId: string): Promise<PrintResult> => {
    const printer = db.getSnapshot().printers?.find((p) => p.id === printerId) || {
      id: printerId,
      name: 'Thermal Printer 80mm',
      connectionType: 'LAN_IP',
      address: '192.168.1.100:9100',
      paperWidthMm: 80,
      role: 'RECEIPT',
    };

    const jobId = `job_test_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const now = new Date().toISOString();

    const lines: string[] = [
      '================================',
      '        CHILL & CHOC CAFÉ       ',
      '     PRINTER SELF-TEST REPORT   ',
      '================================',
      `Printer: ${printer.name}`,
      `Hardware ID: ${printer.id}`,
      `Role: ${printer.role}`,
      `Connection: ${printer.connectionType}`,
      `Address/Port: ${printer.address}`,
      `Paper Width: ${printer.paperWidthMm}mm`,
      `Auto-Cutter: ENABLED [GS V 66 0]`,
      `Drawer Kick: RJ12 24V [ESC p 0]`,
      `Date & Time: ${formatDateTime(now)}`,
      '--------------------------------',
      'CHARACTER ENCODING & ALIGNMENT: ',
      'Left     -- Center --      Right',
      '1234567890!@#$%^&*()_+-=[]{}|;:',
      '--------------------------------',
      'BARCODE DENSITY TEST:           ',
      '||||||||||||||||||||||||||||||||',
      '        * CHILL-CHOC-TEST *     ',
      '================================',
      '      HARDWARE DIAGNOSTIC OK    ',
      '================================',
    ];

    const job: PrinterJob = {
      id: jobId,
      orderNumber: 'TEST-PAGE',
      printerId: printer.id,
      printerName: printer.name,
      type: 'TEST_PRINT',
      status: 'PRINTED',
      attempts: 1,
      createdAt: now,
      printedAt: now,
      payloadText: lines.join('\n'),
      formattedThermalLines: lines,
    };

    db.update('printerJobs', (jobs) => [job, ...jobs]);

    return {
      success: true,
      jobId,
      message: `Test slip sent to ${printer.name} (${printer.address}).`,
    };
  },

  /**
   * Formats and submits a Kitchen Order Ticket (KOT)
   * Kitchen tickets do NOT show prices!
   */
  printKitchenTicket: async (order: Order): Promise<PrintResult> => {
    const settings = db.getSnapshot().settings;
    const jobId = `job_kot_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

    const lines: string[] = [
      '================================',
      '        CHILL & CHOC CAFÉ       ',
      '       KITCHEN ORDER TICKET     ',
      '================================',
      `Order: ${order.orderNumber} (${order.orderType === 'DINE_IN' ? 'DINE IN' : 'TAKEAWAY'})`,
      order.tableNumber ? `TABLE: ${order.tableNumber.toUpperCase()}` : '',
      `Time: ${formatDateTime(order.createdAt)}`,
      `Cashier: ${order.cashierName}`,
      '--------------------------------',
      'QTY  ITEM & MODIFIERS           ',
      '--------------------------------',
    ].filter(Boolean);

    for (const item of order.items) {
      lines.push(`${item.quantity}x   ${item.name.toUpperCase()}`);
      for (const mod of item.modifiers) {
        lines.push(`     * ${mod.groupName}: ${mod.optionName}`);
      }
      if (item.notes) {
        lines.push(`     NOTE: [${item.notes}]`);
      }
    }

    lines.push('--------------------------------');
    lines.push(`Station: AUTO-ROUTED`);
    lines.push('================================');

    const payloadText = lines.join('\n');

    const job: PrinterJob = {
      id: jobId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      printerId: 'prn_kitchen_80mm',
      printerName: 'Main Kitchen Thermal 80mm',
      type: 'KOT',
      status: 'PRINTED',
      attempts: 1,
      createdAt: new Date().toISOString(),
      printedAt: new Date().toISOString(),
      payloadText,
      formattedThermalLines: lines,
    };

    db.update('printerJobs', (jobs) => [job, ...jobs]);

    return {
      success: true,
      jobId,
      message: `KOT for ${order.orderNumber} sent to Kitchen Printer.`,
    };
  },

  /**
   * Formats and submits a Customer Receipt (80mm thermal)
   */
  printCustomerReceipt: async (order: Order): Promise<PrintResult> => {
    const settings: SystemSettings = db.getSnapshot().settings;
    const jobId = `job_rcpt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

    const lines: string[] = [
      '================================',
      `       ${settings.businessName.toUpperCase()}      `,
      `    ${settings.tagline.toUpperCase()}   `,
      '================================',
      settings.address,
      `Tel: ${settings.phone}`,
      '--------------------------------',
      `Order: ${order.orderNumber}`,
      `Type: ${order.orderType === 'DINE_IN' ? 'Dine In' : 'Takeaway'}${order.tableNumber ? `  (Table ${order.tableNumber})` : ''}`,
      `Date: ${formatDateTime(order.createdAt)}`,
      '--------------------------------',
      'ITEM                       TOTAL',
      '--------------------------------',
    ];

    for (const item of order.items) {
      const itemPriceStr = formatLKR(item.itemTotalCents).replace('Rs. ', '');
      const nameLine = `${item.quantity}x ${item.name}`;
      const padding = Math.max(1, 32 - nameLine.length - itemPriceStr.length);
      lines.push(`${nameLine}${' '.repeat(padding)}${itemPriceStr}`);

      for (const mod of item.modifiers) {
        const modPrice = mod.priceCents > 0 ? ` (+${formatLKR(mod.priceCents)})` : '';
        lines.push(`   + ${mod.optionName}${modPrice}`);
      }
    }

    lines.push('--------------------------------');
    lines.push(`Subtotal:              ${formatLKR(order.subtotalCents)}`);
    if (order.discountCents > 0) {
      lines.push(`Discount:             -${formatLKR(order.discountCents)}`);
    }
    if (order.serviceChargeCents > 0) {
      lines.push(`Service Charge:        ${formatLKR(order.serviceChargeCents)}`);
    }
    if (order.taxCents > 0) {
      lines.push(`Tax:                   ${formatLKR(order.taxCents)}`);
    }
    lines.push('================================');
    lines.push(`TOTAL DUE:             ${formatLKR(order.totalCents)}`);
    lines.push('================================');

    if (order.paymentMethod === 'CASH') {
      lines.push(`Payment Method:        CASH`);
      if (order.cashReceivedCents) {
        lines.push(`Cash Received:         ${formatLKR(order.cashReceivedCents)}`);
        lines.push(`Change Given:          ${formatLKR(order.changeGivenCents || 0)}`);
      }
    } else if (order.paymentMethod === 'CARD') {
      lines.push(`Payment Method:        CARD`);
      if (order.cardReference) {
        lines.push(`Card Ref:              ${order.cardReference}`);
      }
    } else if (order.paymentMethod === 'QR') {
      lines.push(`Payment Method:        LankaQR / Digital`);
      if (order.qrReference) {
        lines.push(`QR Ref:                ${order.qrReference}`);
      }
    } else if (order.paymentMethod === 'SPLIT' && order.paymentSplits) {
      lines.push(`Payment Method:        SPLIT`);
      order.paymentSplits.forEach((sp) => {
        lines.push(` * ${sp.method}: ${formatLKR(sp.amountCents)}`);
      });
    }

    lines.push('--------------------------------');
    lines.push(settings.receiptFooter || 'Thank you for your visit!');
    lines.push('--------------------------------');
    lines.push('  Developed by OGO TECHNOLOGY   ');
    lines.push('www.ogotechnology.net • +94 75 930 7059');
    lines.push('================================');

    const payloadText = lines.join('\n');

    const job: PrinterJob = {
      id: jobId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      printerId: 'prn_receipt_80mm',
      printerName: 'Main Counter Receipt 80mm',
      type: 'CUSTOMER_RECEIPT',
      status: 'PRINTED',
      attempts: 1,
      createdAt: new Date().toISOString(),
      printedAt: new Date().toISOString(),
      payloadText,
      formattedThermalLines: lines,
    };

    db.update('printerJobs', (jobs) => [job, ...jobs]);

    return {
      success: true,
      jobId,
      message: `Receipt for ${order.orderNumber} printed successfully.`,
    };
  },

  /**
   * Simulates Cash Drawer Kick Solenoid
   */
  openCashDrawer: async (): Promise<void> => {
    try {
      if (typeof window !== 'undefined' && (window.AudioContext || (window as any).webkitAudioContext)) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      }
    } catch {
      // ignore audio context restrictions
    }
  },

  getJobs: (): PrinterJob[] => {
    return db.getSnapshot().printerJobs;
  },

  retryJob: async (jobId: string): Promise<void> => {
    db.update('printerJobs', (jobs) =>
      jobs.map((j) =>
        j.id === jobId
          ? {
              ...j,
              attempts: j.attempts + 1,
              status: 'PRINTED',
              printedAt: new Date().toISOString(),
              error: undefined,
            }
          : j
      )
    );
  },

  simulateFailedJob: async (orderNumber: string): Promise<void> => {
    const job: PrinterJob = {
      id: `job_fail_${Date.now()}`,
      orderNumber,
      printerId: 'prn_kitchen_80mm',
      printerName: 'Main Kitchen Thermal 80mm',
      type: 'KOT',
      status: 'FAILED',
      attempts: 1,
      createdAt: new Date().toISOString(),
      error: 'Paper out or printer disconnected. Check thermal roll.',
      payloadText: `FAILED TICKET FOR ${orderNumber}`,
    };
    db.update('printerJobs', (jobs) => [job, ...jobs]);
  },
};
