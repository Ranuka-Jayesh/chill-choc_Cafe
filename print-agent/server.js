const http = require('http');
const { getWindowsPrinters, printRawBuffer } = require('./rawPrinter');
const { buildCustomerReceipt, buildKitchenTicket, buildTestSlip } = require('./escpos');

const PORT = process.env.PORT || 23456;
const DEFAULT_AUTH_TOKEN = process.env.POS_AUTH_TOKEN || 'cafemm_secure_print_token_2026';

// In-memory cache to prevent duplicate print jobs
const processedJobs = new Map();

// Clean up old job IDs every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, time] of processedJobs.entries()) {
    if (now - time > 120000) {
      processedJobs.delete(id);
    }
  }
}, 600000);

/**
 * Handle CORS and Private Network Access (PNA)
 */
function setCorsHeaders(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-POS-Auth, Access-Control-Request-Private-Network'
  );
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Critical for Chrome & Edge PNA (Private Network Access) from HTTPS to localhost
  if (req.headers['access-control-request-private-network'] || req.headers['access-control-request-headers']) {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
      if (body.length > 2 * 1024 * 1024) {
        // 2MB limit
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  setCorsHeaders(req, res);

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  // 1. Health & Status Check (no auth required for quick ping)
  if (pathname === '/health' || pathname === '/status') {
    return sendJson(res, 200, {
      status: 'ONLINE',
      agent: 'CafeMM-Windows-Print-Agent',
      version: '1.0.0',
      uptimeSecs: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  }

  // 2. Authentication Check for functional endpoints
  const authToken = req.headers['x-pos-auth'] || urlObj.searchParams.get('token');
  if (authToken && authToken !== DEFAULT_AUTH_TOKEN) {
    return sendJson(res, 401, { success: false, error: 'Unauthorized: Invalid print agent token' });
  }

  // 3. List Windows Printers
  if (req.method === 'GET' && pathname === '/printers') {
    try {
      const printers = await getWindowsPrinters();
      return sendJson(res, 200, { success: true, count: printers.length, printers });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 4. Open Cash Drawer Kick Pulse
  if (req.method === 'POST' && pathname === '/open-drawer') {
    try {
      const body = await parseBody(req);
      const printerName = body.printerName;
      if (!printerName) {
        return sendJson(res, 400, { success: false, error: 'printerName parameter required' });
      }

      // Standard ESC p 0 25 250 pulse
      const kickBuffer = Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]);
      await printRawBuffer(printerName, kickBuffer);
      return sendJson(res, 200, { success: true, message: `Drawer kick pulse sent to ${printerName}` });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 5. Hardware Self-Test Slip
  if (req.method === 'POST' && pathname === '/test') {
    try {
      const body = await parseBody(req);
      const printerName = body.printerName;
      const paperWidth = body.paperWidthMm || 80;
      if (!printerName) {
        return sendJson(res, 400, { success: false, error: 'printerName parameter required' });
      }

      const buffer = buildTestSlip(printerName, paperWidth);
      await printRawBuffer(printerName, buffer);
      return sendJson(res, 200, { success: true, message: `Test slip printed to ${printerName}` });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 6. Direct ESC/POS Print Endpoint
  if (req.method === 'POST' && pathname === '/print') {
    try {
      const body = await parseBody(req);
      const { jobId, printerName, type = 'RECEIPT', order, settings = {}, options = {} } = body;

      if (!printerName) {
        return sendJson(res, 400, { success: false, error: 'printerName is required' });
      }

      // Check Duplicate Prevention
      if (jobId && !options.forceReprint) {
        if (processedJobs.has(jobId)) {
          console.log(`[PrintAgent] Ignored duplicate job ${jobId}`);
          return sendJson(res, 200, {
            success: true,
            jobId,
            duplicateIgnored: true,
            message: `Duplicate job #${jobId} already printed recently`,
          });
        }
      }

      let printBuffer;
      if (type === 'KOT') {
        if (!order) return sendJson(res, 400, { success: false, error: 'order data required for KOT' });
        printBuffer = buildKitchenTicket(order, settings, options);
      } else if (type === 'TEST') {
        printBuffer = buildTestSlip(printerName, options.paperWidthMm || 80);
      } else {
        // Customer Receipt
        if (!order) return sendJson(res, 400, { success: false, error: 'order data required for receipt' });
        printBuffer = buildCustomerReceipt(order, settings, options);
      }

      // Spool to Windows Printer
      await printRawBuffer(printerName, printBuffer);

      // Record in cache
      if (jobId) {
        processedJobs.set(jobId, Date.now());
      }

      console.log(`[PrintAgent] Successfully printed ${type} for order #${order?.orderNumber || 'N/A'} on "${printerName}"`);

      return sendJson(res, 200, {
        success: true,
        jobId,
        message: `Successfully printed ${type} to ${printerName}`,
      });
    } catch (err) {
      console.error('[PrintAgent] Print error:', err);
      return sendJson(res, 500, {
        success: false,
        error: err.message || 'Spooler printing failed',
      });
    }
  }

  // Not Found
  sendJson(res, 404, { error: 'Route not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('====================================================');
  console.log(`  CafeMM Windows Thermal Print Agent v1.0.0`);
  console.log(`  Listening on http://127.0.0.1:${PORT}`);
  console.log(`  Ready to receive ESC/POS print jobs for XPrinter`);
  console.log('====================================================');
});
