const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile, exec } = require('child_process');

const PS_SCRIPT_PATH = path.join(__dirname, 'raw_print.ps1');

/**
 * Lists all installed printers on the Windows operating system
 */
function getWindowsPrinters() {
  return new Promise((resolve) => {
    const psCommand = `Get-CimInstance Win32_Printer | Select-Object Name, DeviceID, DriverName, PortName, Default, PrinterStatus, WorkOffline, PrinterState, ExtendedPrinterStatus | ConvertTo-Json -Compress`;

    exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCommand}"`, { windowsHide: true }, (err, stdout) => {
      if (err || !stdout) {
        console.warn('Failed to query Win32_Printer via PowerShell:', err);
        return resolve([]);
      }

      try {
        const parsed = JSON.parse(stdout.trim());
        const list = Array.isArray(parsed) ? parsed : [parsed];
        const printers = list
          .filter(Boolean)
          .map((p) => {
            const name = p.Name || p.DeviceID || 'Unknown Printer';
            const isDefault = Boolean(p.Default);
            const port = p.PortName || '';
            const driver = p.DriverName || '';
            const isOffline = Boolean(p.WorkOffline) || p.PrinterStatus === 1 || p.PrinterState === 2 || p.ExtendedPrinterStatus === 2;
            const isXPrinterOrThermal =
              !/generic \/ text only/i.test(name) &&
              (/xprinter|thermal|receipt|xp-|80|58/i.test(name) ||
                /xprinter|pos|thermal|xp-/i.test(driver) ||
                /usb/i.test(port));

            return {
              name,
              isDefault,
              port,
              driver,
              isLikelyThermal: isXPrinterOrThermal,
              isOnline: !isOffline,
            };
          });

        resolve(printers);
      } catch (parseErr) {
        console.warn('Error parsing PowerShell printer JSON:', parseErr);
        resolve([]);
      }
    });
  });
}

/**
 * Checks if a specific printer is online and connected
 */
function checkPrinterOnline(printerName) {
  return new Promise((resolve) => {
    const escaped = printerName.replace(/'/g, "''");
    const psCmd = `$p = Get-CimInstance Win32_Printer -Filter "Name='${escaped}'" -ErrorAction SilentlyContinue; if (-not $p) { Write-Output "NOT_FOUND"; exit 0 } if ($p.WorkOffline -or $p.PrinterStatus -eq 1 -or $p.PrinterState -eq 2 -or $p.ExtendedPrinterStatus -eq 2) { Write-Output "OFFLINE" } else { Write-Output "ONLINE" }`;

    execFile('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psCmd], { windowsHide: true }, (err, stdout) => {
      const res = (stdout || '').trim();
      resolve(res === 'ONLINE');
    });
  });
}

/**
 * Sends raw binary ESC/POS buffer directly to a Windows printer queue
 */
async function printRawBuffer(printerName, buffer) {
  if (!printerName) {
    throw new Error('No printer name specified');
  }

  // Pre-flight check: verify physical connection
  const isOnline = await checkPrinterOnline(printerName);
  if (!isOnline) {
    throw new Error(`Printer "${printerName}" is offline or unplugged. Please check power or USB cable.`);
  }

  return new Promise((resolve, reject) => {
    // Write buffer to temporary spool file
    const tempFile = path.join(os.tmpdir(), `pos_spool_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.bin`);

    fs.writeFile(tempFile, buffer, (writeErr) => {
      if (writeErr) {
        return reject(new Error(`Failed to write spool buffer: ${writeErr.message}`));
      }

      const args = [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        PS_SCRIPT_PATH,
        '-PrinterName',
        printerName,
        '-FilePath',
        tempFile,
      ];

      execFile('powershell', args, { windowsHide: true }, (execErr, stdout, stderr) => {
        // Clean up temp file immediately
        fs.unlink(tempFile, () => {});

        if (execErr) {
          const errMsg = stderr || stdout || execErr.message;
          return reject(new Error(`Spooler error: ${errMsg.trim()}`));
        }

        resolve({ success: true, message: `Dispatched to ${printerName}` });
      });
    });
  });
}

module.exports = {
  getWindowsPrinters,
  printRawBuffer,
};
