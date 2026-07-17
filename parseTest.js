function parseToIsoDate(dtStr) {
  if (!dtStr) return '';
  let cleaned = dtStr.trim();
  
  if (cleaned.includes(' ') && (cleaned.includes('-') || cleaned.includes('/'))) {
    const parts = cleaned.split(' ');
    if ((parts[0].includes('-') || parts[0].includes('/')) && parts.length > 1 && parts[1].includes(':')) {
      cleaned = parts[0];
    }
  }

  const num = Number(cleaned);
  if (!isNaN(num) && num > 10000) {
    const dateObj = new Date(Math.round((num - 25569) * 86400 * 1000));
    return dateObj.toISOString().split('T')[0];
  }

  if (!cleaned.includes('T')) {
    const yyyymmdd = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (yyyymmdd) {
      const y = yyyymmdd[1];
      const m = yyyymmdd[2].padStart(2, '0');
      const d = yyyymmdd[3].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  const parts = cleaned.includes('/') ? cleaned.split('/') : cleaned.split('-');
  if (parts.length === 3) {
    let p1 = parts[0].trim().padStart(2, '0');
    let p2 = parts[1].trim().padStart(2, '0');
    let y = parts[2].trim();
    if (y.includes(' ')) y = y.split(' ')[0];

    if (p1.length === 4) { 
       return `${p1}-${p2}-${y.padStart(2, '0')}`;
    }
    if (y.length === 2) {
      y = '20' + y;
    }
    if (parseInt(p1) > 12) {
      return `${y.padStart(4, '20')}-${p2}-${p1}`;
    }
    if (parseInt(p2) > 12) {
      return `${y.padStart(4, '20')}-${p1}-${p2}`;
    }
    return `${y.padStart(4, '20')}-${p2}-${p1}`;
  }

  const parsed = Date.parse(dtStr);
  if (!isNaN(parsed)) {
    const dObj = new Date(parsed);
    const y = dObj.getFullYear();
    const m = String(dObj.getMonth() + 1).padStart(2, '0');
    const d = String(dObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return '';
}
console.log(parseToIsoDate("08 Jul 2026"));
console.log(parseToIsoDate("06-01-2026 14:30:00"));
console.log(parseToIsoDate("2026-07-15"));
console.log(parseToIsoDate("15/07/2026"));
