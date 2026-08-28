import Papa from 'papaparse';

export interface UnpostedDoc {
  id: string;
  menu: string;
  documentStatus: string;
  createdBy: string;
  documentNo: string;
  documentDate: string;
  area: string;
}

export interface UnpostedSummary {
  total: number;
  menuCounts: Record<string, number>;
  statusCounts: Record<string, number>;
  areaCounts: Record<string, number>;
  lastUpdated?: string;
}

const TARIKAN_CSV_PROXY = '/api/unposted-docs';
const TARIKAN_CSV_DIRECT = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSbvA_5FOxi2-nkfz8iJbptOhDfBCLM5LnTwrVLeJ4pf1hlGjSBywsTXQYYtEjuo0DY2M63wcJmc0tP/pub?gid=1541449669&single=true&output=csv&hl=id';

/**
 * Deduce area from Documentno if explicit Area field is empty
 */
export function deduceAreaFromDocNo(docNo: string, explicitArea: string): string {
  const cleanArea = explicitArea ? explicitArea.trim() : '';
  if (cleanArea && cleanArea.toUpperCase() !== 'UNKNOWN' && cleanArea !== '-') {
    return cleanArea;
  }

  if (!docNo) return 'Lainnya / General';
  const upper = docNo.toUpperCase();

  if (upper.includes('JKT') || upper.includes('JAKARTA') || upper.includes('/YKT/')) return 'Jakarta';
  if (upper.includes('KRW') || upper.includes('PID') || upper.includes('KARAWANG')) return 'Karawang';
  if (upper.includes('SMG') || upper.includes('SEMARANG')) return 'Semarang';
  if (upper.includes('SBY') || upper.includes('SURABAYA')) return 'Surabaya';
  if (upper.includes('JMR') || upper.includes('JEMBER')) return 'Jember';
  if (upper.includes('MKS') || upper.includes('MAKASSAR')) return 'Makassar';
  if (upper.includes('PTN') || upper.includes('PONTIANAK')) return 'Pontianak';
  if (upper.includes('BJM') || upper.includes('BANJARMASIN')) return 'Banjarmasin';
  if (upper.includes('PLG') || upper.includes('PALEMBANG')) return 'Palembang';
  if (upper.includes('MDN') || upper.includes('MEDAN')) return 'Medan';
  if (upper.includes('PKB') || upper.includes('PEKANBARU')) return 'Pekanbaru';
  if (upper.includes('AMT')) return 'Jakarta';
  if (upper.includes('PSN')) return 'Jakarta';

  return 'Lainnya / General';
}

/**
 * Fetch and parse Unposted Dokumen from sheet Tarikan (gid 1541449669)
 */
export async function fetchUnpostedDocuments(forceFresh = false): Promise<UnpostedDoc[]> {
  const url = TARIKAN_CSV_PROXY + (forceFresh ? `?t=${Date.now()}` : '');
  let text = '';

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Proxy error: ${res.status}`);
    text = await res.text();
  } catch (err) {
    console.warn('Fallback to direct Google Sheet link for unposted docs:', err);
    const fallbackRes = await fetch(TARIKAN_CSV_DIRECT + (forceFresh ? `&t=${Date.now()}` : ''), { cache: 'no-store' });
    if (!fallbackRes.ok) throw new Error(`Direct fetch error: ${fallbackRes.status}`);
    text = await fallbackRes.text();
  }

  const rawLines = text.split('\n');
  const documents: UnpostedDoc[] = [];

  let menuIdx = 0;
  let statusIdx = 1;
  let createdIdx = 2;
  let docNoIdx = 3;
  let dateIdx = 4;
  let areaIdx = 5;

  let startRow = 2; // Default starting row for sheet Tarikan

  // Find header line dynamically
  for (let i = 0; i < Math.min(10, rawLines.length); i++) {
    const lineStr = rawLines[i].replace(/^"|"$/g, '').trim();
    if (lineStr.toLowerCase().includes('menu') && (lineStr.toLowerCase().includes('document') || lineStr.toLowerCase().includes('documentno'))) {
      const parts = lineStr.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
      parts.forEach((p, idx) => {
        const lower = p.toLowerCase();
        if (lower === 'menu') {
          menuIdx = idx;
        } else if (lower.includes('status')) {
          statusIdx = idx;
        } else if (lower.includes('created')) {
          createdIdx = idx;
        } else if (lower.includes('documentno') || lower.includes('docno') || (lower.includes('doc') && !lower.includes('date'))) {
          docNoIdx = idx;
        } else if (lower.includes('date')) {
          dateIdx = idx;
        } else if (lower.includes('area')) {
          areaIdx = idx;
        }
      });
      startRow = i + 1;
      break;
    }
  }

  for (let i = startRow; i < rawLines.length; i++) {
    const lineStr = rawLines[i].trim();
    if (!lineStr) continue;

    // Use Papa.parse for precise quote parsing per line
    const parsedLine = Papa.parse<string[]>(lineStr, { skipEmptyLines: true }).data[0];
    if (!parsedLine || parsedLine.length < 3) continue;

    const menu = (parsedLine[menuIdx] || '').trim();
    const documentStatus = (parsedLine[statusIdx] || '').trim();
    const createdBy = (parsedLine[createdIdx] || '').trim();
    const documentNo = (parsedLine[docNoIdx] || '').trim();
    const documentDate = (parsedLine[dateIdx] || '').trim();
    const rawArea = (parsedLine[areaIdx] || '').trim();

    // Skip headers or invalid rows
    if (!menu || menu.toLowerCase() === 'menu' || documentNo.toLowerCase().includes('documentno')) continue;
    if (createdBy.toLowerCase().includes('terakhir ditarik')) continue;

    const area = deduceAreaFromDocNo(documentNo, rawArea);

    documents.push({
      id: `${documentNo || 'doc'}-${i}`,
      menu,
      documentStatus: documentStatus || 'In Progress',
      createdBy: createdBy || '-',
      documentNo: documentNo || '-',
      documentDate: documentDate || '-',
      area
    });
  }

  return documents;
}

/**
 * Filter documents according to user role and selected area.
 * Rules:
 * - If selected area is "All Cabang" or "HQ" or user is Super Admin / HQ, show all.
 * - Otherwise, match row.area against selectedArea.
 */
export function filterDocsByArea(docs: UnpostedDoc[], selectedArea: string, isSuperAdminOrHq: boolean): UnpostedDoc[] {
  if (isSuperAdminOrHq || selectedArea === 'All Cabang' || selectedArea === 'HQ' || selectedArea === 'ALL') {
    return docs;
  }

  const targetAreaLower = selectedArea.toLowerCase();
  return docs.filter(doc => {
    const docAreaLower = doc.area.toLowerCase();
    return docAreaLower === targetAreaLower || (docAreaLower.includes(targetAreaLower));
  });
}
