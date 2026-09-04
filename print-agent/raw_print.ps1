# Windows RAW Spooler Printing Script for ESC/POS Thermal Printers
param (
    [Parameter(Mandatory=$true)]
    [string]$PrinterName,

    [Parameter(Mandatory=$true)]
    [string]$FilePath
)

$code = @"
using System;
using System.Runtime.InteropServices;
using System.IO;

public class RawPrinter {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public static bool SendFileToPrinter(string szPrinterName, string szFileName) {
        if (!File.Exists(szFileName)) return false;
        byte[] bytes = File.ReadAllBytes(szFileName);
        return SendBytesToPrinter(szPrinterName, bytes);
    }

    public static bool SendBytesToPrinter(string szPrinterName, byte[] pBytes) {
        IntPtr hPrinter = IntPtr.Zero;
        DOCINFOA di = new DOCINFOA();
        di.pDocName = "Thermal_Receipt";
        di.pDataType = "RAW";

        if (OpenPrinter(szPrinterName, out hPrinter, IntPtr.Zero)) {
            if (StartDocPrinter(hPrinter, 1, di)) {
                if (StartPagePrinter(hPrinter)) {
                    IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(pBytes.Length);
                    Marshal.Copy(pBytes, 0, pUnmanagedBytes, pBytes.Length);
                    int dwWritten = 0;
                    bool bSuccess = WritePrinter(hPrinter, pUnmanagedBytes, pBytes.Length, out dwWritten);
                    Marshal.FreeCoTaskMem(pUnmanagedBytes);
                    EndPagePrinter(hPrinter);
                    EndDocPrinter(hPrinter);
                    ClosePrinter(hPrinter);
                    return bSuccess && (dwWritten == pBytes.Length);
                }
                EndDocPrinter(hPrinter);
            }
            ClosePrinter(hPrinter);
        }
        return false;
    }
}
"@

try {
    Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue
} catch {}

if (![System.IO.File]::Exists($FilePath)) {
    Write-Error "Print job buffer file not found: $FilePath"
    exit 1
}

# Verify physical printer online status before dispatching to Windows spooler
$prn = Get-CimInstance Win32_Printer -Filter "Name='$PrinterName'" -ErrorAction SilentlyContinue
if ($prn) {
    if ($prn.WorkOffline -or $prn.PrinterStatus -eq 1 -or $prn.PrinterState -eq 2 -or $prn.ExtendedPrinterStatus -eq 2) {
        Write-Error "Printer '$PrinterName' is offline or unplugged. Please check power or USB connection."
        exit 3
    }
}

$success = [RawPrinter]::SendFileToPrinter($PrinterName, $FilePath)

if ($success) {
    Write-Output "SUCCESS"
    exit 0
} else {
    Write-Error "Failed to send raw data to printer '$PrinterName'. Make sure printer is connected and turned on."
    exit 2
}
