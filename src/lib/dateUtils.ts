// Unified date utility for inventory & reconciliation modules

const INDO_MONTHS_MAP: Record<string, string> = {
  januari: '01', jan: '01',
  februari: '02', feb: '02',
  maret: '03', mar: '03',
  april: '04', apr: '04',
  mei: '05', may: '05',
  juni: '06', jun: '06',
  juli: '07', jul: '07',
  agustus: '08', ags: '08', agu: '08', aug: '08',
  september: '09', sep: '09',
  oktober: '10', okt: '10', oct: '10',
  november: '11', nov: '11',
  desember: '12', des: '12', dec: '12'
};

const INDO_MONTHS_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

/**
 * Normalizes any date string or Excel serial number to standard ISO format "YYYY-MM-DD".
 * Returns empty string if invalid or empty.
 */
export function parseToIsoDate(dtStr: any): string {
  if (dtStr === null || dtStr === undefined) return '';
  let cleaned = String(dtStr).trim();
  if (!cleaned || cleaned === '#N/A' || cleaned === '-' || cleaned === 'null' || cleaned === 'undefined') return '';

  // 1. Excel Serial Date check (e.g. 44000 to 55000)
  const num = Number(cleaned);
  if (!isNaN(num) && num > 10000 && num < 100000) {
    const dateObj = new Date(Math.round((num - 25569) * 86400 * 1000));
    if (!isNaN(dateObj.getTime())) {
      const y = dateObj.getUTCFullYear();
      const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
      const d = String(dateObj.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  // 2. Month name check (e.g., "28 Agustus 2024", "28-Agu-24", "15 Jan 2025")
  const wordMatch = cleaned.match(/^(\d{1,2})[\s\-\/\.]([a-zA-Z]+)[\s\-\/\.](\d{2,4})/);
  if (wordMatch) {
    const day = wordMatch[1].padStart(2, '0');
    const monthKey = wordMatch[2].toLowerCase();
    let year = wordMatch[3];
    if (year.length === 2) year = '20' + year;
    const monthNum = INDO_MONTHS_MAP[monthKey];
    if (monthNum) {
      return `${year}-${monthNum}-${day}`;
    }
  }

  // 3. Remove time part if string has spaces and is not month name (e.g. "2024-08-28 14:30:00" or "28/08/2024 14:30:00")
  if (cleaned.includes(' ') && !cleaned.match(/[a-zA-Z]/)) {
    cleaned = cleaned.split(' ')[0];
  }

  // 4. Try exact YYYY-MM-DD or YYYY/MM/DD
  const yyyymmdd = cleaned.match(/^(\d{4})[\-\/](\d{1,2})[\-\/](\d{1,2})/);
  if (yyyymmdd) {
    const y = yyyymmdd[1];
    const m = yyyymmdd[2].padStart(2, '0');
    const d = yyyymmdd[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 5. Try DD/MM/YYYY or DD-MM-YYYY or MM/DD/YYYY
  const parts = cleaned.includes('/') ? cleaned.split('/') : (cleaned.includes('-') ? cleaned.split('-') : []);
  if (parts.length === 3) {
    let p1 = parts[0].trim();
    let p2 = parts[1].trim();
    let y = parts[2].trim();
    if (y.includes(' ')) y = y.split(' ')[0];

    if (p1.length === 4) {
      return `${p1}-${p2.padStart(2, '0')}-${y.padStart(2, '0')}`;
    }
    if (y.length === 2) {
      y = '20' + y;
    }

    const n1 = parseInt(p1, 10);
    const n2 = parseInt(p2, 10);

    if (n1 > 12) {
      // Must be DD/MM/YYYY
      return `${y}-${String(n2).padStart(2, '0')}-${String(n1).padStart(2, '0')}`;
    } else if (n2 > 12) {
      // Must be MM/DD/YYYY
      return `${y}-${String(n1).padStart(2, '0')}-${String(n2).padStart(2, '0')}`;
    } else {
      // Default to Indonesian DD/MM/YYYY
      return `${y}-${String(n2).padStart(2, '0')}-${String(n1).padStart(2, '0')}`;
    }
  }

  // 6. Standard Javascript Date parsing fallback
  const parsed = Date.parse(cleaned);
  if (!isNaN(parsed)) {
    const dObj = new Date(parsed);
    const y = dObj.getFullYear();
    const m = String(dObj.getMonth() + 1).padStart(2, '0');
    const d = String(dObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return cleaned;
}

/**
 * Returns UTC timestamp milliseconds for sorting and chronological comparison.
 */
export function getParsedDateValue(dtStr: any): number {
  const iso = parseToIsoDate(dtStr);
  if (!iso) return 0;
  const parts = iso.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    return new Date(y, m, d).getTime();
  }
  const t = Date.parse(iso);
  return isNaN(t) ? 0 : t;
}

/**
 * Formats ISO date "YYYY-MM-DD" or raw date into Indonesian human readable format "DD MMMM YYYY".
 */
export function displayTanggalIndonesian(dtStr: any): string {
  const iso = parseToIsoDate(dtStr);
  if (!iso) return dtStr || '-';
  const parts = iso.split('-');
  if (parts.length === 3) {
    const d = parseInt(parts[2], 10);
    const m = parseInt(parts[1], 10) - 1;
    const y = parts[0];
    if (m >= 0 && m < 12) {
      return `${d} ${INDO_MONTHS_NAMES[m]} ${y}`;
    }
  }
  return iso;
}

/**
 * Formats ISO date "YYYY-MM-DD" to "DD/MM/YYYY".
 */
export function formatToDDMMYYYY(dtStr: any): string {
  const iso = parseToIsoDate(dtStr);
  if (!iso) return dtStr || '-';
  const parts = iso.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return iso;
}
