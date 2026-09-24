const fs = require('fs');
const { jsPDF } = require('jspdf');

function generateReceiptPdf(order, settings, custom, options = {}) {
  const is58 = options.paperWidthMm === 58 || custom?.paperWidthMm === 58;
  const paperWidth = is58 ? 58 : 80;
  const leftX = 4;
  const rightX = paperWidth - 4;
  const centerX = paperWidth / 2;

  // 1. Calculate required height
  let h = 4; // top margin
  const showLogo = custom ? custom.showLogo !== false : true;
  const logoH = showLogo ? 30 : 0;
  h += logoH + 2; // logo + margin

  // Business header
  h += 6; // title
  if (custom?.tagline || settings.tagline) h += 4;
  if (custom?.address || settings.address) h += 4;
  if (custom?.phone || settings.phone) h += 4;
  h += 3; // divider

  // Order meta
  h += 5; // order # & type
  if (order.tableNumber && order.orderType === 'DINE_IN') h += 4;
  h += 4; // date
  h += 3; // divider

  // Items header
  h += 5;
  h += 2; // divider

  // Line items
  for (const item of order.items) {
    h += 5; // name & price
    if (item.modifiers && item.modifiers.length > 0) {
      h += item.modifiers.length * 3.8;
    }
    if (item.notes) h += 3.5;
  }
  h += 3; // divider

  // Totals
  h += 4; // subtotal
  if (order.discountCents > 0) h += 4;
  if (order.serviceChargeCents > 0) h += 4;
  if (order.taxCents > 0) h += 4;
  h += 2; // divider
  h += 6; // TOTAL
  h += 3; // divider

  // Payment
  h += 4; // payment method
  if (order.paymentMethod === 'CASH') h += 8; // received + change
  h += 3; // divider

  // Footer & Social
  h += 10;
  h += 3; // divider

  // Developer credit
  h += 8;
  h += 6; // bottom margin

  const totalHeightMm = Math.ceil(h);

  // 2. Create jsPDF document with exact page dimensions
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [paperWidth, totalHeightMm],
  });

  let y = 4;

  // Logo
  if (showLogo) {
    const logoPath = 'public/printlogo.jpg';
    if (fs.existsSync(logoPath)) {
      const logoData = fs.readFileSync(logoPath);
      const logoBase64 = `data:image/jpeg;base64,${logoData.toString('base64')}`;
      const logoSize = is58 ? 24 : 30;
      const logoX = (paperWidth - logoSize) / 2;
      doc.addImage(logoBase64, 'JPEG', logoX, y, logoSize, logoSize);
      y += logoSize + 2;
    }
  }

  // Business Name
  doc.setFont('courier', 'bold');
  doc.setFontSize(is58 ? 11 : 13);
  const bName = (custom?.businessName || settings.businessName || 'CHILL & CHOC').toUpperCase();
  doc.text(bName, centerX, y + 4, { align: 'center' });
  y += 5;

  doc.setFont('courier', 'normal');
  doc.setFontSize(is58 ? 7 : 8);
  const tagline = (custom?.tagline || settings.tagline || 'COOL VIBES, SWEET BITES').toUpperCase();
  if (tagline) {
    doc.text(tagline, centerX, y + 3, { align: 'center' });
    y += 4;
  }
  const address = custom?.address || settings.address;
  if (address) {
    doc.text(address, centerX, y + 3, { align: 'center' });
    y += 4;
  }
  const phone = custom?.phone || settings.phone;
  if (phone) {
    doc.text(`Tel: ${phone}`, centerX, y + 3, { align: 'center' });
    y += 4;
  }

  // Divider
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(leftX, y + 2, rightX, y + 2);
  y += 4;

  // Order Meta
  doc.setFont('courier', 'bold');
  doc.setFontSize(is58 ? 8 : 9);
  const cleanNum = order.orderNumber.replace(/^#+/, '');
  doc.text(`Order: # ${cleanNum}`, leftX, y + 3);
  doc.text(order.orderType === 'DINE_IN' ? 'DINE IN' : 'TAKEAWAY', rightX, y + 3, { align: 'right' });
  y += 4.5;

  if (order.tableNumber && order.orderType === 'DINE_IN') {
    doc.setFont('courier', 'normal');
    doc.setFontSize(is58 ? 7 : 8);
    doc.text('Table Number:', leftX, y + 3);
    doc.text(`Table ${order.tableNumber}`, rightX, y + 3, { align: 'right' });
    y += 4;
  }

  doc.setFont('courier', 'normal');
  doc.setFontSize(is58 ? 7 : 7.5);
  doc.text('Date:', leftX, y + 3);
  doc.text('23 Sep 2026, 03:51 AM', rightX, y + 3, { align: 'right' });
  y += 4;

  // Divider
  doc.line(leftX, y + 1, rightX, y + 1);
  y += 3;

  // Items Header
  doc.setFont('courier', 'bold');
  doc.setFontSize(is58 ? 7.5 : 8);
  doc.text('ITEM', leftX, y + 3);
  doc.text('TOTAL (RS)', rightX, y + 3, { align: 'right' });
  y += 4;
  doc.line(leftX, y + 1, rightX, y + 1);
  y += 3;

  // Purchased Items
  for (const item of order.items) {
    doc.setFont('courier', 'bold');
    doc.setFontSize(is58 ? 7.5 : 8);
    doc.text(`${item.quantity}x ${item.name}`, leftX, y + 3);
    doc.text((item.itemTotalCents / 100).toFixed(2), rightX, y + 3, { align: 'right' });
    y += 4;

    doc.setFont('courier', 'normal');
    doc.setFontSize(is58 ? 6.5 : 7.5);
    if (item.modifiers) {
      for (const mod of item.modifiers) {
        doc.text(`  + ${mod.optionName}`, leftX, y + 3);
        y += 3.5;
      }
    }
    if (item.notes) {
      doc.setFont('courier', 'italic');
      doc.text(`  Note: ${item.notes}`, leftX, y + 3);
      doc.setFont('courier', 'normal');
      y += 3.5;
    }
  }

  // Divider
  doc.line(leftX, y + 1, rightX, y + 1);
  y += 3;

  // Financial Breakdown
  doc.setFont('courier', 'normal');
  doc.setFontSize(is58 ? 7 : 8);
  doc.text('Subtotal:', leftX, y + 3);
  doc.text(`Rs. ${(order.subtotalCents / 100).toFixed(2)}`, rightX, y + 3, { align: 'right' });
  y += 4;

  if (order.discountCents > 0) {
    doc.text('Discount:', leftX, y + 3);
    doc.text(`-Rs. ${(order.discountCents / 100).toFixed(2)}`, rightX, y + 3, { align: 'right' });
    y += 4;
  }
  if (order.serviceChargeCents > 0) {
    doc.text('Service Charge:', leftX, y + 3);
    doc.text(`+Rs. ${(order.serviceChargeCents / 100).toFixed(2)}`, rightX, y + 3, { align: 'right' });
    y += 4;
  }
  if (order.taxCents > 0) {
    doc.text('Tax:', leftX, y + 3);
    doc.text(`+Rs. ${(order.taxCents / 100).toFixed(2)}`, rightX, y + 3, { align: 'right' });
    y += 4;
  }

  // Total
  doc.line(leftX, y + 1, rightX, y + 1);
  y += 3;
  doc.setFont('courier', 'bold');
  doc.setFontSize(is58 ? 9 : 10.5);
  doc.text('TOTAL:', leftX, y + 3.5);
  doc.text(`Rs. ${(order.totalCents / 100).toFixed(2)}`, rightX, y + 3.5, { align: 'right' });
  y += 5.5;
  doc.line(leftX, y + 1, rightX, y + 1);
  y += 3;

  // Payment Method
  doc.setFont('courier', 'normal');
  doc.setFontSize(is58 ? 7 : 8);
  doc.text('Payment Method:', leftX, y + 3);
  doc.text(order.paymentMethod, rightX, y + 3, { align: 'right' });
  y += 4;

  if (order.paymentMethod === 'CASH') {
    const cashRec = order.cashReceivedCents || order.totalCents;
    doc.text('Cash Received:', leftX, y + 3);
    doc.text(`Rs. ${(cashRec / 100).toFixed(2)}`, rightX, y + 3, { align: 'right' });
    y += 4;
    doc.text('Change Returned:', leftX, y + 3);
    doc.text(`Rs. ${((order.changeGivenCents || 0) / 100).toFixed(2)}`, rightX, y + 3, { align: 'right' });
    y += 4;
  }

  // Divider
  doc.line(leftX, y + 1, rightX, y + 1);
  y += 3;

  // Footer Message
  doc.setFontSize(is58 ? 6.5 : 7.5);
  doc.text('Thank you for chilling with us!', centerX, y + 3, { align: 'center' });
  y += 3.8;
  doc.text('Please visit us again.', centerX, y + 3, { align: 'center' });
  y += 3.8;
  doc.text('Follow @chillandchoc.lk', centerX, y + 3, { align: 'center' });
  y += 4;

  // Divider
  doc.line(leftX, y + 1, rightX, y + 1);
  y += 3;

  // Developer Credit
  doc.setFont('courier', 'bold');
  doc.setFontSize(is58 ? 7 : 8);
  doc.text('DEVELOPED BY OGO TECHNOLOGY', centerX, y + 3, { align: 'center' });
  y += 3.8;
  doc.setFont('courier', 'normal');
  doc.setFontSize(is58 ? 6 : 7);
  doc.text('www.ogotechnology.net • +94 75 930 7059', centerX, y + 3, { align: 'center' });

  return doc;
}

const mockOrder = {
  orderNumber: '0015',
  orderType: 'DINE_IN',
  tableNumber: '01',
  createdAt: new Date().toISOString(),
  paymentMethod: 'CASH',
  subtotalCents: 105000,
  totalCents: 105000,
  cashReceivedCents: 105000,
  changeGivenCents: 0,
  discountCents: 0,
  serviceChargeCents: 0,
  taxCents: 0,
  items: [
    {
      quantity: 1,
      name: 'Mocha Delight',
      itemTotalCents: 105000,
      modifiers: [
        { optionName: 'Regular (8oz)' },
        { optionName: 'Fresh Milk' },
        { optionName: 'Normal Sweet' },
      ],
    },
  ],
};

const doc = generateReceiptPdf(mockOrder, {}, {});
const outBuf = Buffer.from(doc.output('arraybuffer'));
fs.writeFileSync('scratch/receipt-order15.pdf', outBuf);
console.log('Generated receipt-order15.pdf, size:', outBuf.length);
