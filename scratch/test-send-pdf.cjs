const fs = require('fs');


async function testSendPdf() {
  const pdfBuf = fs.readFileSync('scratch/receipt-order15.pdf');
  const base64Data = `data:application/pdf;base64,${pdfBuf.toString('base64')}`;

  const ws = new WebSocket('ws://127.0.0.1:17891');

  ws.addEventListener('open', () => {
    console.log('Connected to ws://127.0.0.1:17891');
    const req = {
      id: `test-pdf-${Date.now()}`,
      action: 'printReceipt',
      format: 'pdf',
      data: base64Data,
    };
    ws.send(JSON.stringify(req));
    console.log('Sent printReceipt PDF request, waiting for response...');
  });

  ws.addEventListener('message', (event) => {
    console.log('Received response:', event.data);
    ws.close();
    process.exit(0);
  });

  ws.addEventListener('error', (err) => {
    console.error('WebSocket error:', err);
    process.exit(1);
  });
}

testSendPdf();
