import { format, parseISO } from 'date-fns';

/**
 * Converts integer cents into a formatted Sri Lankan Rupee string.
 * Example: 125000 -> "Rs. 1,250.00"
 */
export function formatLKR(cents: number | undefined | null): string {
  if (cents === undefined || cents === null || isNaN(cents)) {
    return 'Rs. 0.00';
  }
  const isNegative = cents < 0;
  const absCents = Math.abs(cents);
  const rupees = absCents / 100;
  
  const formattedNumber = rupees.toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `${isNegative ? '-' : ''}Rs. ${formattedNumber}`;
}

/**
 * Format raw number amount (e.g. 1250) to formatted LKR string
 */
export function formatRawLKR(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return 'Rs. 0.00';
  }
  return formatLKR(Math.round(amount * 100));
}

/**
 * Live formats numeric text with thousands-separating commas while preserving decimal places.
 * Example: "5000" -> "5,000", "12500.5" -> "12,500.5"
 */
export function formatCommaInput(val: string | number | undefined | null): string {
  if (val === undefined || val === null || val === '') return '';
  const str = val.toString().replace(/,/g, '').trim();
  if (!str) return '';

  // Check if negative
  const isNegative = str.startsWith('-');
  const unsigned = isNegative ? str.slice(1) : str;

  // Split integer and decimal parts
  const parts = unsigned.split('.');
  const intPart = parts[0].replace(/\D/g, '');
  const decimalPart = parts.length > 1 ? parts.slice(1).join('').replace(/\D/g, '') : null;

  const formattedInt = intPart ? Number(intPart).toLocaleString('en-US') : '';

  if (decimalPart !== null) {
    return `${isNegative ? '-' : ''}${formattedInt || '0'}.${decimalPart}`;
  }
  return `${isNegative ? '-' : ''}${formattedInt}`;
}

/**
 * Strips all commas and non-numeric characters from a string.
 * Example: "5,000.50" -> "5000.50"
 */
export function stripCommas(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return '';
  return val.toString().replace(/,/g, '').trim();
}

/**
 * Convert user entered rupee float/int (with or without commas) to integer cents safely
 * Example: "5,000.00" -> 500000
 */
export function rupeesToCents(rupees: number | string): number {
  if (typeof rupees === 'string') {
    const cleaned = rupees.replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(cleaned);
    if (isNaN(parsed)) return 0;
    return Math.round(parsed * 100);
  }
  if (isNaN(rupees)) return 0;
  return Math.round(rupees * 100);
}

/**
 * Convert cents back to decimal float
 */
export function centsToRupees(cents: number): number {
  return (cents || 0) / 100;
}

export const SRI_LANKA_TIMEZONE = 'Asia/Colombo';

/**
 * Generates an ISO 8601 string strictly pinned to Sri Lanka Standard Time (Asia/Colombo, UTC+05:30).
 * Uses the local wall-clock components and explicitly attaches the '+05:30' offset,
 * completely immune to incorrect host Windows/OS timezone settings (e.g. UTC+1 vs UTC+5:30).
 * Example: "2026-09-24T15:10:44.568+05:30"
 */
export function getSriLankaNowISO(dateInput: Date | string | number = new Date()): string {
  if (typeof dateInput === 'string' && dateInput.includes('+05:30')) {
    return dateInput;
  }
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return new Date().toISOString();

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  const milliseconds = String(d.getMilliseconds()).padStart(3, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}+05:30`;
}

/**
 * Date / Time formatting helpers strictly pinned to Asia/Colombo (Sri Lanka) Time.
 * Guarantees consistent date/time displays across all devices and countries.
 */
export function formatDateTime(isoString: string | undefined | null): string {
  if (!isoString) return '-';
  try {
    const date = typeof isoString === 'string' ? new Date(isoString) : isoString;
    if (isNaN(date.getTime())) return String(isoString);
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: SRI_LANKA_TIMEZONE,
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).formatToParts(date);
    const m: Record<string, string> = {};
    parts.forEach((p) => { m[p.type] = p.value; });
    const period = (m.dayPeriod || '').toUpperCase();
    return `${m.day} ${m.month} ${m.year}, ${m.hour}:${m.minute} ${period}`.trim();
  } catch {
    return String(isoString);
  }
}

export function formatDate(isoString: string | undefined | null): string {
  if (!isoString) return '-';
  try {
    const date = typeof isoString === 'string' ? new Date(isoString) : isoString;
    if (isNaN(date.getTime())) return String(isoString);
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: SRI_LANKA_TIMEZONE,
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    }).formatToParts(date);
    const m: Record<string, string> = {};
    parts.forEach((p) => { m[p.type] = p.value; });
    return `${m.day} ${m.month} ${m.year}`.trim();
  } catch {
    return String(isoString);
  }
}

export function formatTime(isoString: string | undefined | null): string {
  if (!isoString) return '-';
  try {
    const date = typeof isoString === 'string' ? new Date(isoString) : isoString;
    if (isNaN(date.getTime())) return String(isoString);
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: SRI_LANKA_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).formatToParts(date);
    const m: Record<string, string> = {};
    parts.forEach((p) => { m[p.type] = p.value; });
    const period = (m.dayPeriod || '').toUpperCase();
    return `${m.hour}:${m.minute} ${period}`.trim();
  } catch {
    return String(isoString);
  }
}

/**
 * Generate clean order numbers: #1045, #1046 etc.
 */
export function formatOrderNumber(num: number): string {
  return `#${num.toString().padStart(4, '0')}`;
}
