/**
 * Isolated Thermal Printing Utility for Xprinter & POS 80mm/58mm printers
 * 
 * Instead of relying on whole-window print with complicated overflow hacks,
 * this renders the exact target slip inside an isolated iframe,
 * ensuring 100% visible, razor-sharp thermal receipts with zero blank pages.
 */
export function printThermalElement(elementOrId: HTMLElement | string): void {
  const targetElem =
    typeof elementOrId === 'string'
      ? document.getElementById(elementOrId)
      : elementOrId;

  if (!targetElem) {
    console.warn(`[printThermalElement] Element not found:`, elementOrId);
    window.print();
    return;
  }

  // Remove any previous temporary iframe
  const existingFrame = document.getElementById('thermal-isolated-print-frame');
  if (existingFrame && existingFrame.parentNode) {
    existingFrame.parentNode.removeChild(existingFrame);
  }

  // Create isolated printing frame
  const iframe = document.createElement('iframe');
  iframe.id = 'thermal-isolated-print-frame';
  iframe.style.position = 'fixed';
  iframe.style.top = '-9999px';
  iframe.style.left = '-9999px';
  iframe.style.width = '80mm';
  iframe.style.height = '100px';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  // Collect all CSS link tags and style tags from current document
  const styleNodes = Array.from(
    document.querySelectorAll('link[rel="stylesheet"], style')
  );
  // Sanitize styles so no imported visibility:hidden can hide the receipt content
  const headStyles = styleNodes
    .map((node) => node.outerHTML)
    .join('\n')
    .replace(/visibility\s*:\s*hidden/gi, 'visibility: visible');

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>Thermal Receipt</title>
        ${headStyles}
        <style>
          @page {
            size: auto;
            margin: 0mm !important;
          }
          *, *::before, *::after {
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            text-shadow: none !important;
            box-shadow: none !important;
          }
          html, body {
            margin: 0 !important;
            padding: 1mm 2mm !important;
            background: #ffffff !important;
            color: #000000 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            display: block !important;
            visibility: visible !important;
            overflow: visible !important;
            font-family: 'JetBrains Mono', 'Courier New', Courier, monospace !important;
          }
          body, body * {
            visibility: visible !important;
            opacity: 1 !important;
          }
          @media print {
            html, body {
              visibility: visible !important;
              display: block !important;
              background: #ffffff !important;
              color: #000000 !important;
              width: 80mm !important;
              max-width: 80mm !important;
              margin: 0 !important;
              padding: 1mm 2mm !important;
            }
            body, body * {
              visibility: visible !important;
              opacity: 1 !important;
            }
          }
          img {
            max-width: 100% !important;
            height: auto !important;
          }
          .thermal-dev-footer, .thermal-dev-footer * {
            color: #000000 !important;
            -webkit-text-fill-color: #000000 !important;
            opacity: 1 !important;
          }
        </style>
      </head>
      <body class="thermal-isolated-frame" style="background:#ffffff !important; color:#000000 !important; margin:0 !important; padding:1mm 2mm !important; width:80mm !important;">
        <div style="width: 100%; max-width: 78mm; margin: 0 auto; background: #ffffff !important; color: #000000 !important; visibility: visible !important;">
          ${targetElem.innerHTML}
        </div>
      </body>
    </html>
  `);
  doc.close();

  // Give brief moment for fonts and images to settle in iframe
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.warn('Iframe print error, falling back to window.print()', err);
      window.print();
    } finally {
      // Clean up after print dialog finishes
      setTimeout(() => {
        try {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        } catch {}
      }, 4000);
    }
  }, 350);
}
