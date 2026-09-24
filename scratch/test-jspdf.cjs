const fs = require('fs');
const path = require('path');
const { jsPDF } = require('jspdf');

async function testReceiptPdf() {
  const widthMm = 80;
  // Estimate height: logo (30mm) + header (25mm) + items (30mm) + totals (25mm) + footer (30mm) = ~140mm
  const heightMm = 150;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [widthMm, heightMm],
  });

  const logoPath = path.resolve('public/printlogo.jpg');
  if (fs.existsSync(logoPath)) {
    const logoData = fs.readFileSync(logoPath);
    const logoBase64 = `data:image/jpeg;base64,${logoData.toString('base64')}`;
    // Center logo: 80mm width, 32mm logo width -> x = (80 - 32) / 2 = 24mm
    doc.addImage(logoBase64, 'JPEG', 24, 6, 32, 32);
  }

  doc.setFont('courier', 'bold');
  doc.setFontSize(13);
  doc.text('CHILL & CHOC', 40, 44, { align: 'center' });

  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  doc.text('COOL VIBES, SWEET BITES', 40, 48, { align: 'center' });
  doc.text('No. 42, Galle Road, Colombo 03, Sri Lanka', 40, 52, { align: 'center' });
  doc.text('Tel: +94 11 234 5678', 40, 56, { align: 'center' });

  doc.setLineDash([1, 1]);
  doc.line(4, 59, 76, 59);

  doc.setFont('courier', 'bold');
  doc.setFontSize(9);
  doc.text('Order: # 0014', 4, 63);
  doc.text('DINE IN', 76, 63, { align: 'right' });

  doc.setFont('courier', 'normal');
  doc.setFontSize(7.5);
  doc.text('Date:', 4, 67);
  doc.text('23 Sep 2026, 03:29 AM', 76, 67, { align: 'right' });

  doc.line(4, 70, 76, 70);

  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.text('ITEM', 4, 74);
  doc.text('TOTAL (RS)', 76, 74, { align: 'right' });

  doc.line(4, 76, 76, 76);

  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.text('1x Americano', 4, 80);
  doc.text('700.00', 76, 80, { align: 'right' });

  doc.setFont('courier', 'normal');
  doc.setFontSize(7.5);
  doc.text('  + Regular (8oz)', 4, 84);
  doc.text('  + Normal Sweet', 4, 88);

  doc.line(4, 91, 76, 91);

  doc.text('Subtotal:', 4, 95);
  doc.text('Rs. 700.00', 76, 95, { align: 'right' });

  doc.line(4, 98, 76, 98);

  doc.setFont('courier', 'bold');
  doc.setFontSize(10);
  doc.text('TOTAL:', 4, 103);
  doc.text('Rs. 700.00', 76, 103, { align: 'right' });

  doc.line(4, 106, 76, 106);

  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  doc.text('Payment Method:', 4, 110);
  doc.text('CASH', 76, 110, { align: 'right' });
  doc.text('Cash Received:', 4, 114);
  doc.text('Rs. 700.00', 76, 114, { align: 'right' });
  doc.text('Change Returned:', 4, 118);
  doc.text('Rs. 0.00', 76, 118, { align: 'right' });

  doc.line(4, 121, 76, 121);

  doc.setFontSize(7.5);
  doc.text('Thank you for chilling with us!', 40, 125, { align: 'center' });
  doc.text('Please visit us again.', 40, 129, { align: 'center' });
  doc.text('Follow @chillandchoc.lk', 40, 133, { align: 'center' });

  doc.line(4, 136, 76, 136);

  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.text('DEVELOPED BY OGO TECHNOLOGY', 40, 140, { align: 'center' });
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.text('www.ogotechnology.net • +94 75 930 7059', 40, 144, { align: 'center' });

  const pdfOutput = doc.output('arraybuffer');
  fs.writeFileSync('scratch/sample-receipt.pdf', Buffer.from(pdfOutput));
  console.log('Sample receipt PDF created: scratch/sample-receipt.pdf, size:', pdfOutput.byteLength);
}

testReceiptPdf().catch(console.error);
