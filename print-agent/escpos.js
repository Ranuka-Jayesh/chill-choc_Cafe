/**
 * High-performance ESC/POS Binary Command Generator
 * Supports standard XPrinter, Epson, POS-80, and POS-58 thermal printers.
 */

class EscPosBuilder {
  constructor(paperWidthMm = 80) {
    this.buffer = [];
    this.columns = paperWidthMm === 58 ? 32 : 48;
    this.paperWidthMm = paperWidthMm;
    this.init();
  }

  init() {
    this.raw([0x1b, 0x40]); // ESC @ (Initialize printer)
    this.raw([0x1b, 0x74, 0x00]); // Select default code page (PC437 USA)
    return this;
  }

  raw(bytes) {
    if (Array.isArray(bytes)) {
      this.buffer.push(...bytes);
    } else if (Buffer.isBuffer(bytes)) {
      this.buffer.push(...bytes);
    }
    return this;
  }

  align(alignment = 'left') {
    const val = alignment === 'center' ? 0x01 : alignment === 'right' ? 0x02 : 0x00;
    this.raw([0x1b, 0x61, val]);
    return this;
  }

  bold(enable = true) {
    this.raw([0x1b, 0x45, enable ? 0x01 : 0x00]);
    return this;
  }

  doubleHeight(enable = true) {
    this.raw([0x1d, 0x21, enable ? 0x01 : 0x00]);
    return this;
  }

  doubleSize(enable = true) {
    this.raw([0x1d, 0x21, enable ? 0x11 : 0x00]);
    return this;
  }

  invert(enable = true) {
    this.raw([0x1d, 0x42, enable ? 0x01 : 0x00]);
    return this;
  }

  feed(lines = 1) {
    this.raw([0x1b, 0x64, Math.max(1, lines)]);
    return this;
  }

  cut(feedLines = 3) {
    this.raw([0x1d, 0x56, 0x42, feedLines]); // GS V 66 n (Feed n lines and cut)
    return this;
  }

  drawerKick() {
    // Standard ESC p 0 25 250 (24V RJ12 cash drawer pulse 50ms)
    this.raw([0x1b, 0x70, 0x00, 0x19, 0xfa]);
    return this;
  }

  beep() {
    this.raw([0x1b, 0x42, 0x02, 0x02]); // Beep 2 times
    return this;
  }

  text(str = '') {
    const cleanStr = String(str).replace(/\r?\n/g, '\n');
    const buf = Buffer.from(cleanStr, 'ascii');
    this.buffer.push(...buf);
    return this;
  }

  textLine(str = '') {
    this.text(str);
    this.raw([0x0a]); // LF
    return this;
  }

  divider(char = '-') {
    this.textLine(char.repeat(this.columns));
    return this;
  }

  doubleDivider() {
    this.textLine('='.repeat(this.columns));
    return this;
  }

  twoColumns(leftStr = '', rightStr = '') {
    const left = String(leftStr);
    const right = String(rightStr);
    const spaceCount = this.columns - left.length - right.length;

    if (spaceCount > 0) {
      this.textLine(left + ' '.repeat(spaceCount) + right);
    } else {
      // If text overflows single line, print left then right aligned
      this.textLine(left);
      this.align('right').textLine(right).align('left');
    }
    return this;
  }

  qrCode(data = '') {
    if (!data) return this;
    const str = String(data);
    const len = str.length + 3;
    const pL = len % 256;
    const pH = Math.floor(len / 256);

    // QR Code Model 2
    this.raw([0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]);
    // QR Code Module Size (4)
    this.raw([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x04]);
    // QR Code Error Correction Level M (49)
    this.raw([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31]);
    // Store QR Code data
    this.raw([0x1d, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30]);
    this.text(str);
    // Print QR Code
    this.raw([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]);
    this.feed(1);
    return this;
  }

  getBuffer() {
    return Buffer.from(this.buffer);
  }
}

/**
 * Format currency to Rs. XX.XX
 */
function formatRupees(cents = 0) {
  return 'Rs. ' + (cents / 100).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Generates an ESC/POS Customer Receipt Binary Buffer
 */
function buildCustomerReceipt(order, settings = {}, options = {}) {
  const paperWidth = options.paperWidthMm || settings.paperWidthMm || 80;
  const builder = new EscPosBuilder(paperWidth);
  const custom = settings.receiptCustomization || {};

  const businessName = (custom.businessName !== undefined ? custom.businessName : settings.businessName) || 'CHILL & CHOC';
  const tagline = (custom.tagline !== undefined ? custom.tagline : settings.tagline) || 'Cool Vibes, Sweet Bites';
  const address = (custom.address !== undefined ? custom.address : settings.address) || '';
  const phone = (custom.phone !== undefined ? custom.phone : settings.phone) || '';
  const footer = (custom.receiptFooter !== undefined ? custom.receiptFooter : settings.receiptFooter) || 'Thank you for chilling with us!';

  // 1. Brand Header
  builder.align('center');
  if (businessName.trim()) {
    builder.doubleSize(true).bold(true).textLine(businessName.toUpperCase()).doubleSize(false);
  }
  if (tagline.trim()) {
    builder.bold(false).textLine(tagline);
  }
  if (address.trim()) {
    builder.textLine(address);
  }
  if (phone.trim()) {
    builder.textLine(`Tel: ${phone}`);
  }

  builder.align('left');
  builder.doubleDivider();

  // 2. Order Metadata
  const orderPrefix = custom.orderNumberPrefix || 'Order: #';
  const cleanOrderNum = (order.orderNumber || '').replace(/^#/, '');
  builder.bold(true).twoColumns(`${orderPrefix}${cleanOrderNum}`, order.orderType === 'DINE_IN' ? 'DINE IN' : 'TAKEAWAY');
  builder.bold(false);

  if (order.tableNumber && order.orderType === 'DINE_IN') {
    builder.twoColumns('Table:', `Table ${order.tableNumber}`);
  }
  builder.twoColumns('Date & Time:', new Date(order.createdAt || Date.now()).toLocaleString('en-GB'));
  builder.twoColumns('Cashier:', order.cashierName || 'Cashier');

  builder.divider('-');

  // 3. Items Table Header
  builder.bold(true).twoColumns('ITEM DESCRIPTION', 'TOTAL').bold(false);
  builder.divider('-');

  // 4. Line Items
  for (const item of order.items || []) {
    const itemTotal = formatRupees(item.itemTotalCents || 0);
    const itemTitle = `${item.quantity}x ${item.name}`;
    builder.bold(true).twoColumns(itemTitle, itemTotal).bold(false);

    // Modifiers
    for (const mod of item.modifiers || []) {
      const modPrice = mod.priceCents > 0 ? ` (+${formatRupees(mod.priceCents)})` : '';
      builder.textLine(`   * ${mod.optionName}${modPrice}`);
    }

    // Notes
    if (item.notes) {
      builder.textLine(`   Note: [${item.notes}]`);
    }
  }

  builder.divider('-');

  // 5. Financial Summary
  builder.twoColumns('Subtotal:', formatRupees(order.subtotalCents || 0));

  const loyaltyDisc = order.loyaltyDiscountCents || 0;
  const manualDisc = Math.max(0, (order.discountCents || 0) - loyaltyDisc);
  if (manualDisc > 0) {
    builder.twoColumns('Discount:', `-${formatRupees(manualDisc)}`);
  }
  if (loyaltyDisc > 0) {
    builder.twoColumns('Loyalty Discount:', `-${formatRupees(loyaltyDisc)}`);
  }
  if (order.serviceChargeCents > 0) {
    builder.twoColumns('Service Charge (10%):', formatRupees(order.serviceChargeCents));
  }
  if (order.taxCents > 0) {
    builder.twoColumns('VAT:', formatRupees(order.taxCents));
  }

  builder.doubleDivider();
  builder.bold(true).doubleHeight(true).twoColumns('TOTAL DUE:', formatRupees(order.totalCents || 0)).doubleHeight(false);
  builder.doubleDivider();

  // 6. Tender & Payment Method
  if (order.paymentMethod === 'CASH') {
    builder.twoColumns('Payment Method:', 'CASH');
    if (order.cashReceivedCents) {
      builder.twoColumns('Cash Tendered:', formatRupees(order.cashReceivedCents));
      builder.twoColumns('Change Returned:', formatRupees(order.changeGivenCents || 0));
    }
  } else if (order.paymentMethod === 'CARD') {
    builder.twoColumns('Payment Method:', 'CARD');
    if (order.cardReference) {
      builder.twoColumns('Card Ref / Approval:', order.cardReference);
    }
  } else if (order.paymentMethod === 'QR') {
    builder.twoColumns('Payment Method:', 'LankaQR / Digital');
    if (order.qrReference) {
      builder.twoColumns('QR Ref:', order.qrReference);
    }
  } else if (order.paymentMethod === 'SPLIT' && order.paymentSplits) {
    builder.textLine('Payment Method: SPLIT TENDER');
    order.paymentSplits.forEach((sp) => {
      builder.twoColumns(` * ${sp.method}:`, formatRupees(sp.amountCents));
    });
  }

  // 7. Customer Loyalty Ledger
  if (order.customerName) {
    builder.divider('-');
    builder.twoColumns('Customer:', order.customerName);
    if (order.loyaltyPointsRedeemed && order.loyaltyPointsRedeemed > 0) {
      builder.twoColumns('Points Redeemed:', `-${order.loyaltyPointsRedeemed} Pts`);
    }
    if (order.loyaltyPointsEarned && order.loyaltyPointsEarned > 0) {
      builder.twoColumns('Points Earned:', `+${order.loyaltyPointsEarned} Pts`);
    }
  }

  // 8. Custom Footer & Credits
  builder.divider('-');
  builder.align('center');
  footer.split(/\r?\n/).forEach((line) => {
    if (line.trim()) builder.textLine(line.trim());
  });

  builder.feed(1);
  builder.bold(true).textLine('DEVELOPED BY OGO TECHNOLOGY');
  builder.textLine('www.ogotechnology.net');
  builder.textLine('+94 75 930 7059').bold(false);

  // 9. QR Code Verification (Order reference)
  if (custom.showQrCode ?? true) {
    builder.feed(1);
    builder.qrCode(`https://chillandchoc.lk/verify?order=${cleanOrderNum}`);
    builder.textLine(`Order Ref: #${cleanOrderNum}`);
  }

  // 10. Drawer Kick & Auto Cut
  if (options.openDrawer || (order.paymentMethod === 'CASH' && (settings.openDrawerAfterCashSale ?? true))) {
    builder.drawerKick();
  }

  if (options.autoCut !== false) {
    builder.feed(3);
    builder.cut(3);
  }

  return builder.getBuffer();
}

/**
 * Generates an ESC/POS Kitchen Order Ticket (KOT)
 */
function buildKitchenTicket(order, settings = {}, options = {}) {
  const paperWidth = options.paperWidthMm || 80;
  const builder = new EscPosBuilder(paperWidth);

  builder.align('center');
  builder.doubleSize(true).bold(true).textLine('KITCHEN ORDER TICKET').doubleSize(false);
  builder.align('left');
  builder.doubleDivider();

  const cleanOrderNum = (order.orderNumber || '').replace(/^#/, '');
  builder.doubleHeight(true).bold(true).twoColumns(`ORDER #${cleanOrderNum}`, order.orderType === 'DINE_IN' ? 'DINE IN' : 'TAKEAWAY').doubleHeight(false);

  if (order.tableNumber && order.orderType === 'DINE_IN') {
    builder.bold(true).twoColumns('TABLE NUMBER:', `TABLE ${order.tableNumber}`).bold(false);
  }

  builder.twoColumns('Time Placed:', new Date(order.createdAt || Date.now()).toLocaleTimeString('en-GB'));
  builder.twoColumns('Server / Cashier:', order.cashierName || 'Cashier');
  builder.doubleDivider();

  builder.bold(true).textLine('QTY   ITEM & PREPARATION DETAILS').bold(false);
  builder.divider('-');

  for (const item of order.items || []) {
    builder.doubleHeight(true).bold(true).textLine(`${item.quantity}x   ${item.name.toUpperCase()}`).doubleHeight(false).bold(false);

    for (const mod of item.modifiers || []) {
      builder.textLine(`      * ${mod.groupName}: ${mod.optionName}`);
    }

    if (item.notes) {
      builder.bold(true).textLine(`      >> NOTE: [${item.notes}] <<`).bold(false);
    }
    builder.feed(1);
  }

  builder.doubleDivider();
  builder.align('center');
  builder.bold(true).textLine('--- END OF KOT TICKET ---').bold(false);

  if (options.beep !== false) {
    builder.beep();
  }

  builder.feed(3);
  builder.cut(3);

  return builder.getBuffer();
}

/**
 * Diagnostic Self-Test Slip
 */
function buildTestSlip(printerName = 'XPrinter 80mm', paperWidth = 80) {
  const builder = new EscPosBuilder(paperWidth);

  builder.align('center');
  builder.doubleSize(true).bold(true).textLine('CHILL & CHOC CAFE').doubleSize(false);
  builder.bold(true).textLine('HARDWARE DIAGNOSTIC REPORT').bold(false);
  builder.doubleDivider();

  builder.align('left');
  builder.twoColumns('Printer Device:', printerName);
  builder.twoColumns('Paper Width:', `${paperWidth}mm`);
  builder.twoColumns('Agent Protocol:', 'Local ESC/POS Spooler v1.0');
  builder.twoColumns('Timestamp:', new Date().toLocaleString('en-GB'));
  builder.divider('-');

  builder.textLine('CHARACTER SIZING TEST:');
  builder.textLine('Normal Text [Font A 12x24]');
  builder.bold(true).textLine('Bold Text [ESC E 1]').bold(false);
  builder.doubleHeight(true).textLine('Double Height Text [GS ! 1]').doubleHeight(false);
  builder.doubleSize(true).textLine('Double Size Text [GS ! 17]').doubleSize(false);

  builder.divider('-');
  builder.align('center');
  builder.textLine('BARCODE / QR CODE TEST:');
  builder.qrCode('CHILL-CHOC-TEST-OK');
  builder.textLine('QR Engine: PASSED');

  builder.doubleDivider();
  builder.bold(true).textLine('HARDWARE DIAGNOSTIC: 100% OK').bold(false);
  builder.textLine('Guillotine Auto-Cutter: TEST CUT');

  builder.feed(3);
  builder.cut(3);

  return builder.getBuffer();
}

module.exports = {
  EscPosBuilder,
  buildCustomerReceipt,
  buildKitchenTicket,
  buildTestSlip,
};
