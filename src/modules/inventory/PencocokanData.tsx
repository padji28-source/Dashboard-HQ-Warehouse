import { useEffect, useState, useMemo } from 'react';
import { fetchSheetData } from '../../lib/sheets';
import { AREA_URLS } from '../../App';
import { Loader2, Search, Scale, CheckCircle2, AlertTriangle, RefreshCw, Undo, Lock, History, FileSpreadsheet, Info, Calendar, Trash2, Check } from 'lucide-react';
import Papa from 'papaparse';
import { collection, addDoc, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import * as XLSX from 'xlsx';

// Custom tailwind utility class helper if required
function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}

// Helper to format values with optional UOM aware precision (e.g., minimum 2 decimals for Kg)
function formatValue(num: number, uom?: string) {
  if (num === null || num === undefined) return '0';
  const uomLower = uom ? uom.toLowerCase().trim() : '';
  const isKg = uomLower.includes('kg') || uomLower.includes('kilo');
  
  return num.toLocaleString('id-ID', {
    minimumFractionDigits: isKg ? 2 : 0,
    maximumFractionDigits: 3
  });
}

function formatToDDMMYYYY(dateStr: string): string {
  if (!dateStr) return '';
  const cleaned = dateStr.trim();
  
  // Try YYYY-MM-DD or YYYY-M-D
  const yyyymmdd = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (yyyymmdd) {
    const y = yyyymmdd[1];
    const m = yyyymmdd[2].padStart(2, '0');
    const d = yyyymmdd[3].padStart(2, '0');
    return `${d}-${m}-${y}`;
  }

  // Try YYYY-MM or YYYY-M
  const yyyymm = cleaned.match(/^(\d{4})-(\d{1,2})$/);
  if (yyyymm) {
    const y = yyyymm[1];
    const m = yyyymm[2].padStart(2, '0');
    return `${m}-${y}`;
  }

  // Try standard Date parsing
  const parsed = Date.parse(cleaned);
  if (!isNaN(parsed)) {
    const dObj = new Date(parsed);
    const d = String(dObj.getDate()).padStart(2, '0');
    const m = String(dObj.getMonth() + 1).padStart(2, '0');
    const y = dObj.getFullYear();
    return `${d}-${m}-${y}`;
  }

  return dateStr;
}

// ==========================================
// PERSISTENCE ENGINE: CLOUD & LOCAL STORAGE
// ==========================================
const LOCAL_STORAGE_KEY = 'mms_saved_reconciliations';

function getLocalSavedReconciliations(): any[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to parse local saved reconciliations:', e);
    return [];
  }
}

function saveLocalReconciliation(record: any) {
  try {
    const records = getLocalSavedReconciliations();
    records.unshift(record);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('Failed to save record to localStorage:', e);
  }
}

function deleteLocalReconciliation(id: string) {
  try {
    const records = getLocalSavedReconciliations();
    const updated = records.filter(r => r.id !== id);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to delete record from localStorage:', e);
  }
}

// Firestore Operations with Fail-Safe Fallbacks
async function saveToFirestore(record: any) {
  try {
    const colRef = collection(db, 'saved_reconciliations');
    await addDoc(colRef, record);
    return true;
  } catch (e) {
    console.error('Failed to save to Firestore:', e);
    return false;
  }
}

async function loadFromFirestore(): Promise<any[]> {
  try {
    const colRef = collection(db, 'saved_reconciliations');
    const snapshot = await getDocs(colRef);
    const results: any[] = [];
    snapshot.forEach(docSnap => {
      results.push({
        fireId: docSnap.id,
        ...docSnap.data()
      });
    });
    return results;
  } catch (e) {
    console.error('Failed to load from Firestore:', e);
    return [];
  }
}

async function deleteFromFirestore(fireId: string) {
  try {
    await deleteDoc(doc(db, 'saved_reconciliations', fireId));
    return true;
  } catch (e) {
    console.error('Failed to delete from Firestore:', e);
    return false;
  }
}

// Helper to normalize dates to YYYY-MM-DD
function parseToIsoDate(dtStr: string): string {
  if (!dtStr) return '';
  const cleaned = dtStr.trim();
  
  // Try YYYY-MM-DD
  const yyyymmdd = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (yyyymmdd) {
    const y = yyyymmdd[1];
    const m = yyyymmdd[2].padStart(2, '0');
    const d = yyyymmdd[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  
  // Try DD/MM/YYYY or MM/DD/YYYY
  const slashed = cleaned.split('/');
  if (slashed.length === 3) {
    const part1 = parseInt(slashed[0], 10);
    const part2 = parseInt(slashed[1], 10);
    let y = slashed[2].trim();
    
    if (y.length === 2) y = '20' + y;
    y = y.padStart(4, '20');

    // Assume DD/MM/YYYY by default for Indonesia
    let m = part2;
    let d = part1;

    // If second part is > 12, it must be MM/DD/YYYY
    if (part2 > 12) {
      m = part1;
      d = part2;
    } else if (part1 > 12) {
      // It's definitely DD/MM/YYYY
      m = part2;
      d = part1;
    } // else we stick to DD/MM/YYYY assumption

    const sm = String(m).padStart(2, '0');
    const sd = String(d).padStart(2, '0');
    return `${y}-${sm}-${sd}`;
  }

  // Try standard Date parsing
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

interface ReconciliationItem {
  key: string; // pCode + '_' + lCode
  whGroup: string;
  namaLocator: string;
  kodeProduk: string;
  namaProduk: string;
  uom: string;
  stockSistem: number;
  stokKemarin: number; // dynamically calculated from start up to selectedDate - 1 (Yesterday / PM)
  stokRill: number; // dynamically calculated from transactions
  mutasiQty: number; // qty shifted inside the defined interval (daily / monthly)
  mutasiQtyIn: number; // IN mutations
  mutasiQtyOut: number; // OUT mutations
  selisih: number;
  status: 'SESUAI' | 'SELISIH' | 'BELUM';
  area: string;
}

export default function PencocokanData({ spreadsheetId, area }: { spreadsheetId: string; area: string }) {
  const [loading, setLoading] = useState(true);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [productsMap, setProductsMap] = useState<Map<string, { nama: string; satuan: string }>>(new Map());
  const [locatorsMap, setLocatorsMap] = useState<Map<string, { nama: string; whType: string; area: string }>>(new Map());
  const [mtsLookupMap, setMtsLookupMap] = useState<Map<string, number>>(new Map());
  
  // Daily and Monthly Reconciliation configuration
  const [reconType, setReconType] = useState<'daily' | 'monthly'>('daily');
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const localNow = new Date(now.getTime() - offset * 60 * 1000);
    return localNow.toISOString().split('T')[0];
  });
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    return `${now.getFullYear()}-${mm}`;
  });

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAreaFilter, setSelectedAreaFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL'); // ALL, SESUAI, SELISIH
  const [selectedLocator, setSelectedLocator] = useState('ALL');

  // Pagination state
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  // Saved Sesi / Locked State Variables
  const [savedSessions, setSavedSessions] = useState<any[]>([]);
  const [activeSavedSession, setActiveSavedSession] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [sessionNameInput, setSessionNameInput] = useState('');
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Fetch saved sessions
  const loadSavedSessions = async () => {
    try {
      setLoadingSessions(true);
      const fsSessions = await loadFromFirestore();
      const localSessions = getLocalSavedReconciliations();
      
      const combined = [...fsSessions, ...localSessions];
      const uniqueMap = new Map<string, any>();
      combined.forEach(s => {
        if (!uniqueMap.has(s.id)) {
          uniqueMap.set(s.id, s);
        } else {
          const existing = uniqueMap.get(s.id);
          uniqueMap.set(s.id, { ...existing, ...s });
        }
      });
      
      const sorted = Array.from(uniqueMap.values()).sort((a, b) => b.timestamp - a.timestamp);
      setSavedSessions(sorted);
    } catch (e) {
      console.error('Error loading saved sessions:', e);
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    loadSavedSessions();
  }, []);

  // Auto-reset page index when filters, type, or selection date changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedAreaFilter, selectedLocator, selectedStatusFilter, pageSize, reconType, selectedDate, selectedMonth]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSbvA_5FOxi2-nkfz8iJbptOhDfBCLM5LnTwrVLeJ4pf1hlGjSBywsTXQYYtEjuo0DY2M63wcJmc0tP/pub?gid=263347272&single=true&output=csv';
      const mtsMap = new Map<string, number>();
      
      try {
        const resMts = await fetch(csvUrl);
        if (resMts.ok) {
          const textMts = await resMts.text();
          const parsedMts = Papa.parse<string[]>(textMts, { skipEmptyLines: true });
          const dataMts = parsedMts.data || [];
          
          if (dataMts.length > 0) {
            let headerIndex = 0;
            for (let i = 0; i < Math.min(10, dataMts.length); i++) {
              const nonEmpCount = dataMts[i].filter(val => String(val).trim().length > 0).length;
              if (nonEmpCount > 3) {
                headerIndex = i;
                break;
              }
            }
            const rawHeaders = dataMts[headerIndex] || [];
            const cleanedHeaders = rawHeaders.map(h => String(h).trim());

            const colLoc = cleanedHeaders.findIndex(h => h.toLowerCase().includes('locator'));
            const colSku = cleanedHeaders.findIndex(h => h.toLowerCase().includes('search key') || h.toLowerCase() === 'sku' || h.toLowerCase().includes('produk'));
            const colName = cleanedHeaders.findIndex(h => h.toLowerCase() === 'name' || h.toLowerCase().includes('nama'));
            const colLastQty = cleanedHeaders.findIndex(h => h.toLowerCase().includes('last qty') || h.toLowerCase().includes('sistem'));

            const mtsRows = dataMts.slice(headerIndex + 1);
            mtsRows.forEach(row => {
              const loc = colLoc !== -1 ? String(row[colLoc] || '').trim().toUpperCase() : '';
              const sku = colSku !== -1 ? String(row[colSku] || '').trim().toUpperCase() : '';
              const name = colName !== -1 ? String(row[colName] || '').trim().toUpperCase() : '';
              
              let lastQty = 0;
              if (colLastQty !== -1 && row[colLastQty] !== undefined) {
                let valStr = String(row[colLastQty]).trim();
                valStr = valStr.replace(/[^0-9.-]/g, '');
                lastQty = parseFloat(valStr) || 0;
                if (isNaN(lastQty)) lastQty = 0;
              }

              if (loc) {
                if (sku) {
                  mtsMap.set(`${loc}_${sku}`, lastQty);
                }
                if (name) {
                  mtsMap.set(`${loc}_${name}`, lastQty);
                }
              }
            });
          }
        }
      } catch (err) {
        console.error('Failed to pre-fetch MTS database in reconciliation page:', err);
      }
      setMtsLookupMap(mtsMap);

      const pMap = new Map<string, { nama: string; satuan: string }>();
      const lMap = new Map<string, { nama: string; whType: string; area: string }>();
      const mappedRows: { tipe: string; pCode: string; pName: string; lCode: string; qty: number; uom: string; source: string; area: string; tanggal: string }[] = [];

      const processRows = (rows: any[], source: string, currentArea: string) => {
        const validRows = (rows || []).filter((r: any[]) => r.length > 0 && (r[0] || r[1] || r[9]));
        validRows.forEach((r: any[]) => {
          const tanggalRaw = String(r[0] || '').trim();
          const tanggal = parseToIsoDate(tanggalRaw);
          const pName = String(r[1] || '').trim();
          let pCode = String(r[9] || '').trim();
          const tipe = String(r[4] || '').trim().toUpperCase();
          const uom = String(r[3] || '').trim();
          
          if (!pName && !pCode) return;
          if (!pCode) {
            pCode = pName;
          }

          const qtyStr = String(r[2] || '0').replace(',', '.');
          let qty = parseFloat(qtyStr) || 0;
          if (isNaN(qty)) qty = 0;

          let fromLocator = String(r[5] || '').trim();
          let toLocator = String(r[6] || '').trim();
          
          if (!fromLocator && !toLocator) fromLocator = 'UNKNOWN_L';

          if (tipe === 'TRANSFER' || tipe === 'TF') {
            mappedRows.push({ tipe: 'OUT', pCode, pName, lCode: fromLocator || 'UNKNOWN_L', qty, uom, source, area: currentArea, tanggal });
            mappedRows.push({ tipe: 'IN', pCode, pName, lCode: toLocator || 'UNKNOWN_L', qty, uom, source, area: currentArea, tanggal });
          } else {
            mappedRows.push({ 
              tipe: tipe || 'IN', 
              pCode, 
              pName, 
              lCode: fromLocator || toLocator || 'UNKNOWN_L', 
              qty, 
              uom,
              source,
              area: currentArea,
              tanggal
            });
          }
        });
      };

      if (area === 'HQ' || spreadsheetId === 'HQ' || area === 'All Cabang' || area.toLowerCase() === 'all') {
        const urlEntries = Object.entries(AREA_URLS);
        await Promise.all(urlEntries.map(async ([aName, aUrl]) => {
          try {
            const [tn, tr, tm, ts, pr, lr] = await Promise.all([
              fetchSheetData(aUrl, "'INPUT'!A2:J").catch(() => []),
              fetchSheetData(aUrl, "'INPUT RM'!A2:J").catch(() => []),
              fetchSheetData(aUrl, "'INPUT MFG'!A2:J").catch(() => []),
              fetchSheetData(aUrl, "'INPUT SUPPLIES'!A2:J").catch(() => []),
              fetchSheetData(aUrl, "'MASTER_PRODUK'!A2:D").catch(() => []),
              fetchSheetData(aUrl, "'MASTER_LOCATOR'!A2:E").catch(() => [])
            ]);

            pr.filter((r: any[]) => r.length > 0 && r[0]).forEach((r: any[]) => {
              pMap.set(String(r[0]).trim(), {
                nama: String(r[1] || '').trim(),
                satuan: String(r[2] || '').trim()
              });
            });

            lr.filter((r: any[]) => r.length > 0 && (r[0] || r[1])).forEach((r: any[]) => {
              const val = {
                nama: String(r[1] || r[0]).trim(),
                whType: String(r[3] || '').trim(),
                area: String(r[4] || aName).trim()
              };
              if (r[0]) {
                const k = String(r[0]).trim();
                lMap.set(k, val);
                lMap.set(k.toUpperCase(), val);
              }
              if (r[1]) {
                const k = String(r[1]).trim();
                lMap.set(k, val);
                lMap.set(k.toUpperCase(), val);
              }
            });

            processRows(tn, 'INPUT', aName);
            processRows(tr, 'INPUT RM', aName);
            processRows(tm, 'INPUT MFG', aName);
            processRows(ts, 'INPUT SUPPLIES', aName);
          } catch (e) {
            console.error(`Error loading area ${aName}:`, e);
          }
        }));
      } else {
        const [tn, tr, tm, ts, pr, lr] = await Promise.all([
          fetchSheetData(spreadsheetId, "'INPUT'!A2:J").catch(() => []),
          fetchSheetData(spreadsheetId, "'INPUT RM'!A2:J").catch(() => []),
          fetchSheetData(spreadsheetId, "'INPUT MFG'!A2:J").catch(() => []),
          fetchSheetData(spreadsheetId, "'INPUT SUPPLIES'!A2:J").catch(() => []),
          fetchSheetData(spreadsheetId, "'MASTER_PRODUK'!A2:D").catch(() => []),
          fetchSheetData(spreadsheetId, "'MASTER_LOCATOR'!A2:E").catch(() => [])
        ]);

        pr.filter((r: any[]) => r.length > 0 && r[0]).forEach((r: any[]) => {
          pMap.set(String(r[0]).trim(), {
            nama: String(r[1] || '').trim(),
            satuan: String(r[2] || '').trim()
          });
        });

        lr.filter((r: any[]) => r.length > 0 && (r[0] || r[1])).forEach((r: any[]) => {
          const val = {
            nama: String(r[1] || r[0]).trim(),
            whType: String(r[3] || '').trim(),
            area: String(r[4] || area).trim()
          };
          if (r[0]) {
            const k = String(r[0]).trim();
            lMap.set(k, val);
            lMap.set(k.toUpperCase(), val);
          }
          if (r[1]) {
            const k = String(r[1]).trim();
            lMap.set(k, val);
            lMap.set(k.toUpperCase(), val);
          }
        });

        processRows(tn, 'INPUT', area);
        processRows(tr, 'INPUT RM', area);
        processRows(tm, 'INPUT MFG', area);
        processRows(ts, 'INPUT SUPPLIES', area);
      }

      setProductsMap(pMap);
      setLocatorsMap(lMap);
      setAllTransactions(mappedRows);
    } catch (err: any) {
      console.error(err);
      alert('Gagal menyinkronkan data untuk pencocokan: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [spreadsheetId, area]);

  // Compile Reconciliation list based on transaction history and maps
  const reconciliationList = useMemo(() => {
    const listMap = new Map<string, ReconciliationItem>();

    allTransactions.forEach(t => {
      const { tipe, pCode, pName, lCode, qty, uom, area: rowArea, tanggal } = t;
      const itemKey = `${rowArea}_${lCode}_${pCode}`;

      let includeInCumulative = false;
      let includeInYesterday = false;
      let includeInMutation = false;

      const normalizedType = tipe.replace(/\s+/g, '');
      const isAwal = normalizedType === 'AWAL' || normalizedType === 'SALDOAWAL' || normalizedType === 'INITIAL' || normalizedType === 'SALDO';

      if (reconType === 'daily') {
        includeInCumulative = !tanggal || tanggal <= selectedDate;
        includeInYesterday = !tanggal || tanggal < selectedDate || (isAwal && tanggal <= selectedDate);
        includeInMutation = tanggal === selectedDate && !isAwal;
      } else {
        const transMonth = tanggal ? tanggal.substring(0, 7) : '';
        includeInCumulative = !tanggal || transMonth <= selectedMonth;
        
        // Month before selectedMonth
        const prevMonth = (() => {
          if (!selectedMonth) return '';
          const parts = selectedMonth.split('-');
          if (parts.length !== 2) return '';
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10);
          const prevD = new Date(y, m - 2, 1);
          return `${prevD.getFullYear()}-${String(prevD.getMonth() + 1).padStart(2, '0')}`;
        })();
        
        includeInYesterday = !tanggal || (transMonth && transMonth <= prevMonth) || (isAwal && transMonth <= selectedMonth);
        includeInMutation = transMonth === selectedMonth && !isAwal;
      }

      if (!listMap.has(itemKey)) {
        const lookupKey = lCode.trim();
        const lData = locatorsMap.get(lookupKey) || locatorsMap.get(lookupKey.toUpperCase()) || { nama: lCode, whType: '', area: rowArea };
        const pData = productsMap.get(pCode) || { nama: pName || pCode, satuan: uom || 'Pcs' };

        listMap.set(itemKey, {
          key: itemKey,
          whGroup: lCode,
          namaLocator: lData.nama,
          kodeProduk: pCode === pName ? '' : pCode,
          namaProduk: pData.nama,
          uom: pData.satuan || uom || 'Pcs',
          stockSistem: 0,
          stokKemarin: 0,
          stokRill: 0,
          mutasiQty: 0,
          mutasiQtyIn: 0,
          mutasiQtyOut: 0,
          selisih: 0,
          status: 'BELUM',
          area: rowArea || lData.area || area
        });
      }

      const item = listMap.get(itemKey)!;

      if (includeInYesterday) {
        if (normalizedType === 'IN' || normalizedType === 'AWAL' || normalizedType === 'MASUK' || normalizedType === 'RECEIPT' || normalizedType === 'SALDOAWAL') {
          item.stokKemarin += qty;
        } else if (normalizedType === 'OUT' || normalizedType === 'KELUAR' || normalizedType === 'ISSUE' || normalizedType === 'PEMAKAIAN') {
          item.stokKemarin -= qty;
        } else {
          if (qty > 0 && !['TRANSFER', 'TF'].includes(normalizedType)) {
            item.stokKemarin += qty;
          }
        }
      }

      if (includeInCumulative) {
        if (normalizedType === 'IN' || normalizedType === 'AWAL' || normalizedType === 'MASUK' || normalizedType === 'RECEIPT' || normalizedType === 'SALDOAWAL') {
          item.stokRill += qty;
        } else if (normalizedType === 'OUT' || normalizedType === 'KELUAR' || normalizedType === 'ISSUE' || normalizedType === 'PEMAKAIAN') {
          item.stokRill -= qty;
        } else {
          if (qty > 0 && !['TRANSFER', 'TF'].includes(normalizedType)) {
            item.stokRill += qty;
          }
        }
      }

      if (includeInMutation) {
        if (normalizedType === 'IN' || normalizedType === 'AWAL' || normalizedType === 'MASUK' || normalizedType === 'RECEIPT' || normalizedType === 'SALDOAWAL') {
          item.mutasiQty += qty;
          item.mutasiQtyIn += qty;
        } else if (normalizedType === 'OUT' || normalizedType === 'KELUAR' || normalizedType === 'ISSUE' || normalizedType === 'PEMAKAIAN') {
          item.mutasiQty -= qty;
          item.mutasiQtyOut += Math.abs(qty);
        } else {
          if (qty > 0 && !['TRANSFER', 'TF'].includes(normalizedType)) {
            item.mutasiQty += qty;
            item.mutasiQtyIn += qty;
          }
        }
      }
    });

    return Array.from(listMap.values()).map(item => {
      const locKey = item.whGroup.toUpperCase().trim();
      const productCodeUpper = item.kodeProduk.toUpperCase().trim();
      const productNameUpper = item.namaProduk.toUpperCase().trim();

      let matchedLastQty = 0;
      if (mtsLookupMap.has(`${locKey}_${productCodeUpper}`)) {
        matchedLastQty = mtsLookupMap.get(`${locKey}_${productCodeUpper}`) || 0;
      } else if (mtsLookupMap.has(`${locKey}_${productNameUpper}`)) {
        matchedLastQty = mtsLookupMap.get(`${locKey}_${productNameUpper}`) || 0;
      } else if (mtsLookupMap.has(`${locKey}_${productCodeUpper.replace(/\s+/g, '')}`)) {
        matchedLastQty = mtsLookupMap.get(`${locKey}_${productCodeUpper.replace(/\s+/g, '')}`) || 0;
      }

      const stokKemarin = Math.round(item.stokKemarin * 1000) / 1000;
      const stokRill = Math.round(item.stokRill * 1000) / 1000;
      const mutasiQty = Math.round(item.mutasiQty * 1000) / 1000;
      const mutasiQtyIn = Math.round(item.mutasiQtyIn * 1000) / 1000;
      const mutasiQtyOut = Math.round(item.mutasiQtyOut * 1000) / 1000;
      const selisih = Math.round((stokRill - matchedLastQty) * 1000) / 1000;
      const status = Math.abs(selisih) < 0.001 ? 'SESUAI' : 'SELISIH';

      return {
        ...item,
        stokKemarin,
        stokRill,
        mutasiQty,
        mutasiQtyIn,
        mutasiQtyOut,
        stockSistem: matchedLastQty,
        selisih,
        status
      };
    });
  }, [allTransactions, productsMap, locatorsMap, mtsLookupMap, area, reconType, selectedDate, selectedMonth]);

  // Filter unique locators for selection
  const uniqueLocators = useMemo(() => {
    const list = activeSavedSession ? activeSavedSession.items : reconciliationList;
    const filterByArea = selectedAreaFilter === 'ALL' ? list : list.filter((item: any) => item.area === selectedAreaFilter);
    return Array.from(new Map(filterByArea.map((i: any) => [i.whGroup, { code: i.whGroup, name: i.namaLocator }])).values()).sort((a: any, b: any) => a.code.localeCompare(b.code));
  }, [reconciliationList, activeSavedSession, selectedAreaFilter]);

  // Filter reconciliation list is dependent on user choice filters
  const filteredReconciliation = useMemo(() => {
    return reconciliationList.filter(item => {
      const q = searchQuery.toLowerCase();
      const matchSearch = item.namaProduk.toLowerCase().includes(q) || 
        item.kodeProduk.toLowerCase().includes(q) ||
        item.whGroup.toLowerCase().includes(q) ||
        item.namaLocator.toLowerCase().includes(q);

      if (!matchSearch) return false;

      if (selectedAreaFilter !== 'ALL' && item.area !== selectedAreaFilter) return false;
      if (selectedLocator !== 'ALL' && item.whGroup !== selectedLocator) return false;

      if (selectedStatusFilter === 'SESUAI' && item.status !== 'SESUAI') return false;
      if (selectedStatusFilter === 'SELISIH' && item.status !== 'SELISIH') return false;
      if (selectedStatusFilter === 'BELUM' && item.status !== 'BELUM') return false;

      return true;
    });
  }, [reconciliationList, searchQuery, selectedAreaFilter, selectedLocator, selectedStatusFilter]);

  // Summary Metrics for LIVE
  const metrics = useMemo(() => {
    const list = reconciliationList;
    const filteredByAreaList = selectedAreaFilter === 'ALL' ? list : list.filter(i => i.area === selectedAreaFilter);
    
    const totalCounted = filteredByAreaList.filter(i => i.stokRill !== null).length;
    const totalMatched = filteredByAreaList.filter(i => i.status === 'SESUAI').length;
    const totalSelisih = filteredByAreaList.filter(i => i.status === 'SELISIH').length;
    const totalBelum = filteredByAreaList.filter(i => i.status === 'BELUM').length;

    return {
      totalItems: filteredByAreaList.length,
      counted: totalCounted,
      matched: totalMatched,
      selisih: totalSelisih,
      belumDiisi: totalBelum
    };
  }, [reconciliationList, selectedAreaFilter]);

  // Grand Total calculation for LIVE
  const grandTotals = useMemo(() => {
    let totalStokKemarin = 0;
    let totalStokRill = 0;
    let totalStockSistem = 0;
    let totalSelisih = 0;
    let totalMutasiQty = 0;
    let totalMutasiQtyIn = 0;
    let totalMutasiQtyOut = 0;

    filteredReconciliation.forEach(item => {
      totalStokKemarin += item.stokKemarin || 0;
      totalStokRill += item.stokRill || 0;
      totalStockSistem += item.stockSistem || 0;
      totalSelisih += item.selisih || 0;
      totalMutasiQty += item.mutasiQty || 0;
      totalMutasiQtyIn += item.mutasiQtyIn || 0;
      totalMutasiQtyOut += item.mutasiQtyOut || 0;
    });

    return {
      stokKemarin: Math.round(totalStokKemarin * 1000) / 1000,
      stokRill: Math.round(totalStokRill * 1000) / 1000,
      stockSistem: Math.round(totalStockSistem * 1000) / 1000,
      selisih: Math.round(totalSelisih * 1000) / 1000,
      mutasiQty: Math.round(totalMutasiQty * 1000) / 1000,
      mutasiQtyIn: Math.round(totalMutasiQtyIn * 1000) / 1000,
      mutasiQtyOut: Math.round(totalMutasiQtyOut * 1000) / 1000
    };
  }, [filteredReconciliation]);

  // Save action handlers
  const initSaveSession = () => {
    const dStr = reconType === 'daily' ? selectedDate : selectedMonth;
    const typeLabel = reconType === 'daily' ? 'Harian' : 'Bulanan';
    const areaLabel = selectedAreaFilter === 'ALL' ? (area === 'HQ' ? 'HQ-Pusat' : area) : selectedAreaFilter;
    setSessionNameInput(`Pencocokan ${typeLabel} ${areaLabel} (${dStr})`);
    setShowSaveModal(true);
  };

  const handleSaveSessionConfirm = async () => {
    if (!sessionNameInput.trim()) {
      alert('Silakan masukkan nama sesi.');
      return;
    }
    
    try {
      setIsSaving(true);
      const dStr = reconType === 'daily' ? selectedDate : selectedMonth;
      
      const sessionData = {
        id: 'rec_' + Date.now(),
        name: sessionNameInput.trim(),
        type: reconType,
        date: dStr,
        timestamp: Date.now(),
        area: selectedAreaFilter === 'ALL' ? (area === 'HQ' ? 'HQ' : area) : selectedAreaFilter,
        grandTotals: {
          stokKemarin: grandTotals.stokKemarin,
          stokRill: grandTotals.stokRill,
          stockSistem: grandTotals.stockSistem,
          selisih: grandTotals.selisih,
          mutasiQty: grandTotals.mutasiQty,
          mutasiQtyIn: grandTotals.mutasiQtyIn,
          mutasiQtyOut: grandTotals.mutasiQtyOut,
          itemCount: filteredReconciliation.length
        },
        items: filteredReconciliation.map(item => ({
          key: item.key,
          whGroup: item.whGroup,
          namaLocator: item.namaLocator,
          kodeProduk: item.kodeProduk,
          namaProduk: item.namaProduk,
          uom: item.uom,
          stokKemarin: item.stokKemarin,
          stokRill: item.stokRill,
          mutasiQty: item.mutasiQty,
          mutasiQtyIn: item.mutasiQtyIn,
          mutasiQtyOut: item.mutasiQtyOut,
          stockSistem: item.stockSistem,
          selisih: item.selisih,
          status: item.status,
          area: item.area
        }))
      };

      const firestoreSuccess = await saveToFirestore(sessionData);
      saveLocalReconciliation(sessionData);
      
      setShowSaveModal(false);
      alert(firestoreSuccess 
        ? 'Sesi pencocokan berhasil dikunci & disimpan di cloud!' 
        : 'Sesi disimpan di penyimpanan lokal (Cloud tidak terjangkau).'
      );
      
      loadSavedSessions();
    } catch (e: any) {
      console.error(e);
      alert('Gagal menyimpan sesi: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSession = async (sess: any) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus arsip pencocokan "${sess.name}"?`)) {
      return;
    }
    
    try {
      if (sess.fireId) {
        await deleteFromFirestore(sess.fireId);
      }
      deleteLocalReconciliation(sess.id);
      
      if (activeSavedSession?.id === sess.id) {
        setActiveSavedSession(null);
      }
      
      alert('Arsip berhasil dihapus!');
      loadSavedSessions();
    } catch (e: any) {
      console.error(e);
      alert('Gagal menghapus arsip: ' + e.message);
    }
  };

  // Adaptive data selectors (Live vs Archived)
  const displayedList = useMemo(() => {
    if (activeSavedSession) {
      return activeSavedSession.items.filter((item: any) => {
        const q = searchQuery.toLowerCase();
        return item.namaProduk.toLowerCase().includes(q) || 
          item.kodeProduk.toLowerCase().includes(q) ||
          item.whGroup.toLowerCase().includes(q) ||
          item.namaLocator.toLowerCase().includes(q);
      });
    }
    return filteredReconciliation;
  }, [activeSavedSession, filteredReconciliation, searchQuery]);

  const displayedTotals = useMemo(() => {
    if (activeSavedSession) {
      let totalStokKemarin = 0;
      let totalStokRill = 0;
      let totalStockSistem = 0;
      let totalSelisih = 0;
      let totalMutasiQty = 0;
      let totalMutasiQtyIn = 0;
      let totalMutasiQtyOut = 0;

      displayedList.forEach((item: any) => {
        totalStokKemarin += item.stokKemarin || 0;
        totalStokRill += item.stokRill || 0;
        totalStockSistem += item.stockSistem || 0;
        totalSelisih += item.selisih || 0;
        totalMutasiQty += item.mutasiQty || 0;
        totalMutasiQtyIn += item.mutasiQtyIn || 0;
        totalMutasiQtyOut += item.mutasiQtyOut || 0;
      });

      return {
        stokKemarin: Math.round(totalStokKemarin * 1000) / 1000,
        stokRill: Math.round(totalStokRill * 1000) / 1000,
        stockSistem: Math.round(totalStockSistem * 1000) / 1000,
        selisih: Math.round(totalSelisih * 1000) / 1000,
        mutasiQty: Math.round(totalMutasiQty * 1000) / 1000,
        mutasiQtyIn: Math.round(totalMutasiQtyIn * 1000) / 1000,
        mutasiQtyOut: Math.round(totalMutasiQtyOut * 1000) / 1000
      };
    }
    return grandTotals;
  }, [activeSavedSession, displayedList, grandTotals]);

  const displayedMetrics = useMemo(() => {
    if (activeSavedSession) {
      const list = activeSavedSession.items;
      const totalCounted = list.filter((i: any) => i.stokRill !== null).length;
      const totalMatched = list.filter((i: any) => i.status === 'SESUAI').length;
      const totalSelisih = list.filter((i: any) => i.status === 'SELISIH').length;
      const totalBelum = list.filter((i: any) => i.status === 'BELUM').length;

      return {
        totalItems: list.length,
        counted: totalCounted,
        matched: totalMatched,
        selisih: totalSelisih,
        belumDiisi: totalBelum
      };
    }
    return metrics;
  }, [activeSavedSession, metrics]);

  const currentReconType = activeSavedSession ? activeSavedSession.type : reconType;

  // Compute pagination based on adaptive list
  const totalPages = Math.ceil(displayedList.length / pageSize);
  const paginatedReconciliation = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return displayedList.slice(start, start + pageSize);
  }, [displayedList, currentPage, pageSize]);

  // Unique areas available inside data
  const uniqueAreas = useMemo(() => {
    return Array.from(new Set(reconciliationList.map(i => i.area).filter(Boolean))).sort();
  }, [reconciliationList]);

  // Reset locator filter if area changes
  useEffect(() => {
    setSelectedLocator('ALL');
  }, [selectedAreaFilter]);

  const handleExportExcel = () => {
    if (displayedList.length === 0) {
      alert('Tidak ada data untuk diekspor!');
      return;
    }

    let dataToExport = [];
    const dateStr = currentReconType === 'daily' ? formatToDDMMYYYY(selectedDate) : formatToDDMMYYYY(selectedMonth);
    const typeLabel = currentReconType === 'daily' ? 'Harian' : 'Bulanan';

    if (currentReconType === 'daily') {
      dataToExport = displayedList.map(item => ({
        'Locator': `${item.namaLocator} (${item.whGroup})`,
        'Kode Produk': item.kodeProduk,
        'Nama Produk': item.namaProduk,
        'Stok Rill (Tgl kemarin)': item.stokKemarin,
        'Mutasi Hari Ini IN': (item as any).mutasiQtyIn ?? 0,
        'Mutasi Hari Ini OUT': (item as any).mutasiQtyOut ?? 0,
        'Stock Rill (Hari ini)': item.stokRill,
        'Stock Tarikan MTS': item.stockSistem,
        'Selisih': item.selisih,
        'Status': item.status
      }));
    } else {
      dataToExport = displayedList.map(item => ({
        'Area': item.area || '',
        'Locator': `${item.namaLocator} (${item.whGroup})`,
        'Kode Produk': item.kodeProduk,
        'Nama Produk': item.namaProduk,
        'Stok Rill (Akhir Bulan Ini)': item.stokRill,
        'Stok Sistem (MTS)': item.stockSistem,
        'Selisih': item.selisih,
        'Status': item.status
      }));
    }

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);

    const colWidths = currentReconType === 'daily' 
      ? [
          { wch: 25 }, // Locator
          { wch: 15 }, // Kode Produk
          { wch: 40 }, // Nama Produk
          { wch: 22 }, // Stok Rill (Tgl kemarin)
          { wch: 20 }, // Mutasi Hari Ini IN
          { wch: 20 }, // Mutasi Hari Ini OUT
          { wch: 22 }, // Stock Rill (Hari ini)
          { wch: 20 }, // Stock Tarikan MTS
          { wch: 12 }, // Selisih
          { wch: 15 }, // Status
        ]
      : [
          { wch: 12 }, // Area
          { wch: 25 }, // Locator
          { wch: 15 }, // Kode Produk
          { wch: 40 }, // Nama Produk
          { wch: 25 }, // Stok Rill (Akhir Bulan Ini)
          { wch: 20 }, // Stok Sistem (MTS)
          { wch: 12 }, // Selisih
          { wch: 15 }, // Status
        ];

    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Rekon ${typeLabel}`);

    const activeArea = activeSavedSession ? activeSavedSession.area : area;
    const fileName = `Pencocokan_Data_${typeLabel}_${(activeArea || 'HQ').toUpperCase()}_${dateStr}.xlsx`;

    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div className="space-y-6">
      {/* Locked Archive Alert Banner */}
      {activeSavedSession && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 rounded-lg text-amber-700 col-span-1">
              <Lock className="w-5 h-5 shrink-0" />
            </div>
            <div>
              <div className="font-bold text-amber-950 text-sm sm:text-base">
                Menampilkan Arsip Terkunci: <span className="underline">{activeSavedSession.name}</span>
              </div>
              <div className="text-xs text-amber-800 mt-0.5">
                Wilayah Area: <strong className="uppercase">{activeSavedSession.area}</strong> | 
                Tipe: <strong>{activeSavedSession.type === 'daily' ? 'Harian' : 'Bulanan'}</strong> | 
                Periode: <strong>{formatToDDMMYYYY(activeSavedSession.date)}</strong> | 
                Disimpan pada: <strong>{new Date(activeSavedSession.timestamp).toLocaleString('id-ID')}</strong>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveSavedSession(null)}
            className="px-4 py-2 border border-amber-300 hover:bg-amber-100 bg-amber-50 text-amber-900 font-bold text-xs sm:text-sm rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition-all focus:outline-none"
          >
            <Undo className="w-4 h-4 text-amber-700" />
            Kembali ke Data Live (Real-Time)
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Scale className="w-6 h-6 text-blue-600" />
            Pencocokan Data (Reconciliation)
          </h2>
          <p className="text-sm text-slate-500">
            Bandingkan kuantitas fisik wilayah lapangan dengan catatan ledger pusat (Google Sheet Data MTS).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!activeSavedSession && (
            <button
              type="button"
              onClick={initSaveSession}
              disabled={loading || filteredReconciliation.length === 0}
              className="px-3.5 py-2 border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold rounded-lg flex items-center gap-2 transition-colors shadow-sm text-sm disabled:opacity-50"
              title="Kunci & Simpan Rekonsiliasi Saat Ini"
            >
              <Lock className="w-4 h-4" />
              Kunci & Simpan Sesi
            </button>
          )}

          <button 
            type="button"
            onClick={loadData} 
            disabled={!!activeSavedSession}
            className="px-3.5 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-lg flex items-center gap-2 transition-colors shadow-sm text-sm disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Refresh Sinkronisasi
          </button>

          <button 
            type="button"
            onClick={handleExportExcel}
            disabled={loading || displayedList.length === 0}
            className="px-3.5 py-2 border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold rounded-lg flex items-center gap-2 transition-colors shadow-sm text-sm disabled:opacity-50"
            title="Ekspor data rekonsiliasi ke Microsoft Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-4.5 h-4.5 text-blue-600" />
            Export Excel
          </button>
        </div>
      </div>

      {/* Mode Sub-nav Tabs (Daily vs Monthly) */}
      {!activeSavedSession && (
        <div className="bg-white border border-slate-200 rounded-xl p-1 flex shadow-sm max-w-md">
          <button
            onClick={() => setReconType('daily')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-xs sm:text-sm font-semibold rounded-lg transition-all focus:outline-none",
              reconType === 'daily'
                ? "bg-blue-600 text-white shadow"
                : "text-slate-600 hover:text-slate-950 hover:bg-slate-50"
            )}
          >
            <Calendar className="w-4 h-4" />
            Pencocokan Harian
          </button>
          <button
            onClick={() => setReconType('monthly')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-xs sm:text-sm font-semibold rounded-lg transition-all focus:outline-none",
              reconType === 'monthly'
                ? "bg-blue-600 text-white shadow"
                : "text-slate-600 hover:text-slate-955 hover:bg-slate-50"
            )}
          >
            <Calendar className="w-4 h-4" />
            Pencocokan Bulanan
          </button>
        </div>
      )}

      {/* Info active interval description */}
      <div className="bg-blue-50/55 border border-blue-100 rounded-xl px-4 py-3 text-xs sm:text-sm text-blue-800 flex items-center gap-3">
        <Info className="w-5 h-5 text-blue-500 shrink-0" />
        <div>
          {activeSavedSession ? (
            <span>
              Arsip Terkunci: Menampilkan snapshot historis dengan tipe pencocokan <strong>{activeSavedSession.type === 'daily' ? 'Harian' : 'Bulanan'}</strong> untuk tanggal/periode <strong>{formatToDDMMYYYY(activeSavedSession.date)}</strong> di wilayah area <strong>{activeSavedSession.area}</strong>.
            </span>
          ) : reconType === 'daily' ? (
            <span>
              Sedang menampilkan <strong>Pencocokan Harian</strong> untuk tanggal <strong>{formatToDDMMYYYY(selectedDate)}</strong>. Stok Rill diakumulasi dari seluruh transaksi <strong>sebelum atau pada tanggal tersebut</strong>, dengan kolom Mutasi mencatat aktivitas mutasi harian khusus di tanggal berjalan.
            </span>
          ) : (
            <span>
              Sedang menampilkan <strong>Pencocokan Bulanan</strong> untuk periode <strong>{formatToDDMMYYYY(selectedMonth)}</strong>. Stok Rill diakumulasi dari seluruh transaksi <strong>sebelum atau pada akhir bulan tersebut</strong>, dengan kolom Mutasi mencatat total aktivitas mutasi bulanan.
            </span>
          )}
        </div>
      </div>

      {/* Stats Summary Panel */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">Total SKU / Kombinasi</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{displayedMetrics.totalItems}</div>
          <div className="text-xs text-slate-400 mt-1">Grup lokasi & produk aktif</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm border-l-4 border-l-emerald-500">
          <div className="text-xs font-semibold text-emerald-600 uppercase font-bold">Sesuai (Match)</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-5 h-5" />
            {displayedMetrics.matched}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {displayedMetrics.totalItems > 0 ? Math.round((displayedMetrics.matched / displayedMetrics.totalItems) * 100) : 0}% Tingkat kecocokan
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm border-l-4 border-l-rose-500">
          <div className="text-xs font-semibold text-rose-600 uppercase font-bold">Ada Selisih (Varian)</div>
          <div className="text-2xl font-bold text-rose-700 mt-1 flex items-center gap-1.5">
            <AlertTriangle className="w-5 h-5" />
            {displayedMetrics.selisih}
          </div>
          <div className="text-xs text-slate-400 mt-1">Butuh pemeriksaan unit/mutasi</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm border-l-4 border-l-sky-500">
          <div className="text-xs font-semibold text-sky-600 uppercase font-bold">Status Data</div>
          <div className="text-xl font-bold text-sky-700 mt-1 flex items-center gap-1.5">
            <Info className="w-5 h-5 text-sky-500" />
            {activeSavedSession ? 'ARSIP TERKUNCI' : 'MTS LIVE FEED'}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {activeSavedSession ? 'Snapshot statis tersimpan' : 'Sistem sinkronisasi waktu riil'}
          </div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input 
            type="text" 
            placeholder="Cari locator, kode/nama produk..." 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
          />
        </div>

        {/* Date Selector depending on Type */}
        <div className="w-full md:w-52 text-left">
          {activeSavedSession ? (
            <div className="w-full px-3.5 py-2 text-sm border border-amber-200 bg-amber-50 rounded-lg font-semibold text-amber-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{formatToDDMMYYYY(activeSavedSession.date)}</span>
            </div>
          ) : reconType === 'daily' ? (
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 bg-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-slate-800"
              />
            </div>
          ) : (
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 bg-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-slate-800"
              />
            </div>
          )}
        </div>

        {/* Dynamic Area Filter (HQ Only) */}
        {(area === 'HQ' || spreadsheetId === 'HQ') && (
          <div className="w-full md:w-48 text-left">
            {activeSavedSession ? (
              <div className="w-full px-3 py-2 text-sm border border-amber-200 bg-amber-50/50 rounded-lg font-bold text-amber-900 flex items-center gap-2">
                <span>Area: <strong className="uppercase">{activeSavedSession.area}</strong></span>
              </div>
            ) : (
              <select
                value={selectedAreaFilter}
                onChange={e => setSelectedAreaFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 bg-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-700"
              >
                <option value="ALL">Semua Area</option>
                {uniqueAreas.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Locator Filter */}
        <div className="w-full md:w-48 text-left">
          <select
            value={selectedLocator}
            onChange={e => setSelectedLocator(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 bg-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-700"
          >
            <option value="ALL">Semua Locator</option>
            {uniqueLocators.map(loc => (
              <option key={loc.code} value={loc.code}>{loc.name || loc.code}</option>
            ))}
          </select>
        </div>

        {/* Match Status Filter */}
        <div className="w-full md:w-48 text-left">
          <select
            value={selectedStatusFilter}
            onChange={e => setSelectedStatusFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 bg-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-700"
          >
            <option value="ALL">Semua Status</option>
            <option value="SESUAI">Sesuai (Match)</option>
            <option value="SELISIH">Ada Selisih (Varian)</option>
            <option value="BELUM">Belum Diisi</option>
          </select>
        </div>
      </div>

      {/* Main Table card */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-16 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <div className="text-sm font-medium">Memproses data dari jaringan...</div>
            </div>
          ) : (
            <table className="w-full text-left text-sm whitespace-nowrap divide-y divide-slate-150">
              {currentReconType === 'daily' ? (
                <thead className="bg-slate-50/80 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider">Locator</th>
                    <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider">Nama Produk</th>
                    <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider text-right bg-slate-100/40 text-slate-700">Stok Rill (Tgl kemarin)</th>
                    <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider text-right bg-blue-50/30 text-blue-800">Mutasi Hari Ini IN</th>
                    <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider text-right bg-rose-50/10 text-rose-800 font-bold">Mutasi Hari Ini OUT</th>
                    <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider text-right bg-emerald-50/20 text-emerald-800">Stock Rill (Hari ini)</th>
                    <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider text-right bg-cyan-50/25 text-slate-750 font-bold">Stock Tarikan MTS</th>
                    <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider text-right">Selisih</th>
                    <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider text-center font-bold">Status</th>
                  </tr>
                </thead>
              ) : (
                <thead className="bg-slate-50/80 text-slate-600 border-b border-slate-200">
                  <tr>
                    {(area === 'HQ' || spreadsheetId === 'HQ') && <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider">Area</th>}
                    <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider">Locator</th>
                    <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider">Nama Produk</th>
                    <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider text-right bg-slate-100/40 text-slate-700 font-medium">Stok Rill (akhir bulan ini)</th>
                    <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider text-right bg-blue-50/30 text-blue-800">Stok Sistem (MTS)</th>
                    <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider text-right">Selisih</th>
                    <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider text-center font-bold">Status</th>
                  </tr>
                </thead>
              )}

              <tbody className="divide-y divide-slate-100 bg-white">
                {displayedList.length === 0 ? (
                  <tr>
                    <td 
                      colSpan={currentReconType === 'daily' ? 9 : ((area === 'HQ' || spreadsheetId === 'HQ') ? 7 : 6)} 
                      className="p-12 text-center text-slate-500 italic"
                    >
                      Tidak ada rekonsiliasi yang cocok dengan kriteria filter atau arsip kosong.
                    </td>
                  </tr>
                ) : (
                  paginatedReconciliation.map(item => (
                    <tr key={item.key} className="hover:bg-blue-50/20 transition-colors text-slate-700">
                      {currentReconType === 'monthly' && (area === 'HQ' || spreadsheetId === 'HQ') && (
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-slate-100 text-slate-705">
                            {item.area}
                          </span>
                        </td>
                      )}

                      {/* Locator */}
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900">{item.namaLocator}</div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">{item.whGroup}</div>
                      </td>

                      {/* Product */}
                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-900 truncate max-w-xs" title={item.namaProduk}>
                          {item.namaProduk}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-slate-500 font-mono">{item.kodeProduk}</span>
                          {item.uom && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 uppercase">
                              {item.uom}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Custom Daily layout columns */}
                      {currentReconType === 'daily' && (
                        <>
                          {/* Stok Rill kemarin */}
                          <td className="px-5 py-4 text-right font-medium text-slate-700 bg-slate-50/25">
                            {formatValue(item.stokKemarin, item.uom)}
                          </td>

                          {/* Mutasi Hari Ini IN */}
                          <td className="px-5 py-4 text-right font-semibold text-emerald-600 bg-emerald-50/5">
                            {formatValue((item as any).mutasiQtyIn ?? 0, item.uom)}
                          </td>

                          {/* Mutasi Hari Ini OUT */}
                          <td className="px-5 py-4 text-right font-semibold text-rose-600 bg-rose-50/5">
                            {formatValue((item as any).mutasiQtyOut ?? 0, item.uom)}
                          </td>

                          {/* Stock Rill (Hari ini) */}
                          <td className="px-5 py-4 text-right font-bold text-slate-900 bg-emerald-50/10">
                            {formatValue(item.stokRill, item.uom)}
                          </td>

                          {/* Stock Tarikan MTS */}
                          <td className="px-5 py-4 text-right font-medium text-slate-700 bg-slate-50/50">
                            {formatValue(item.stockSistem, item.uom)}
                          </td>

                          {/* Selisih */}
                          <td className={
                            `px-5 py-4 text-right font-bold text-sm ${
                              item.status === 'BELUM' ? "text-slate-400 font-normal" : ""
                            } ${
                              item.status === 'SESUAI' ? "text-emerald-600" : ""
                            } ${
                              item.status === 'SELISIH' ? (item.selisih > 0 ? "text-blue-600" : "text-rose-600") : ""
                            }`
                          }>
                            {item.selisih === 0 ? '0' : (item.selisih > 0 ? `+${formatValue(item.selisih, item.uom)}` : formatValue(item.selisih, item.uom))}
                          </td>

                          {/* Status Badge */}
                          <td className="px-5 py-4 text-center">
                            {item.status === 'SESUAI' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                                <Check className="w-3.5 h-3.5" />
                                Sesuai (Match)
                              </span>
                            )}
                            {item.status === 'SELISIH' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 animate-pulse">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Selisih
                              </span>
                            )}
                            {item.status === 'BELUM' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                                <Info className="w-3.5 h-3.5" />
                                Belum Dihitung
                              </span>
                            )}
                          </td>
                        </>
                      )}

                      {/* Custom Monthly layout columns */}
                      {currentReconType === 'monthly' && (
                        <>
                          <td className="px-5 py-4 text-right font-bold text-slate-900 bg-slate-50/25">
                            {formatValue(item.stokRill, item.uom)}
                          </td>

                          <td className="px-5 py-4 text-right font-medium text-slate-700 bg-slate-50/50">
                            {formatValue(item.stockSistem, item.uom)}
                          </td>

                          <td className={
                            `px-5 py-4 text-right font-bold text-sm ${
                              item.status === 'BELUM' ? "text-slate-400 font-normal" : ""
                            } ${
                              item.status === 'SESUAI' ? "text-emerald-600" : ""
                            } ${
                              item.status === 'SELISIH' ? (item.selisih > 0 ? "text-blue-600" : "text-rose-600") : ""
                            }`
                          }>
                            {item.selisih === 0 ? '0' : (item.selisih > 0 ? `+${formatValue(item.selisih, item.uom)}` : formatValue(item.selisih, item.uom))}
                          </td>
                        </>
                      )}

                      {/* Status Badge (Only for Monthly view) */}
                      {currentReconType === 'monthly' && (
                        <td className="px-5 py-4 text-center">
                          {item.status === 'SESUAI' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                              <Check className="w-3.5 h-3.5" />
                              Sesuai (Match)
                            </span>
                          )}
                          {item.status === 'SELISIH' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 animate-pulse">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Selisih
                            </span>
                          )}
                          {item.status === 'BELUM' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                              <Info className="w-3.5 h-3.5" />
                              Belum Dihitung
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                )}

                {/* Adaptive Grand Total Row */}
                {!loading && displayedList.length > 0 && (
                  <tr className="bg-slate-100/60 border-t-2 border-slate-300 font-bold text-slate-900">
                    <td 
                      colSpan={2} 
                      className="px-5 py-4 text-left font-extrabold text-slate-800 tracking-wider text-xs uppercase"
                    >
                      🚀 Grand Total ({displayedList.length} Baris Terfilter)
                    </td>

                    {/* Daily Totals render */}
                    {currentReconType === 'daily' && (
                      <>
                        <td className="px-5 py-4 text-right text-slate-600 font-bold text-sm bg-slate-100/10">
                          {formatValue(displayedTotals.stokKemarin)}
                        </td>

                        <td className="px-5 py-4 text-right font-extrabold text-sm text-emerald-700 bg-emerald-50/10">
                          {formatValue((displayedTotals as any).mutasiQtyIn ?? 0)}
                        </td>

                        <td className="px-5 py-4 text-right font-extrabold text-sm text-rose-700 bg-rose-50/10">
                          {formatValue((displayedTotals as any).mutasiQtyOut ?? 0)}
                        </td>

                        <td className="px-5 py-4 text-right text-slate-900 font-extrabold text-sm bg-emerald-50/10">
                          {formatValue(displayedTotals.stokRill)}
                        </td>

                        <td className="px-5 py-4 text-right text-slate-800 font-bold text-sm bg-slate-100/50">
                          {formatValue(displayedTotals.stockSistem)}
                        </td>

                        <td className={
                          `px-5 py-4 text-right text-sm font-extrabold ${
                            displayedTotals.selisih === 0 ? "text-emerald-700" : (displayedTotals.selisih > 0 ? "text-blue-700" : "text-rose-700")
                          }`
                        }>
                          {displayedTotals.selisih === 0 ? '0' : (displayedTotals.selisih > 0 ? `+${formatValue(displayedTotals.selisih)}` : formatValue(displayedTotals.selisih))}
                        </td>

                        <td className="px-5 py-4 text-center text-slate-400 font-normal text-xs italic">
                          —
                        </td>
                      </>
                    )}

                    {/* Monthly Totals render */}
                    {currentReconType === 'monthly' && (
                      <>
                        <td className="px-5 py-4 text-right text-slate-900 font-extrabold text-sm bg-slate-100/10">
                          {formatValue(displayedTotals.stokRill)}
                        </td>

                        <td className="px-5 py-4 text-right text-slate-800 font-bold text-sm bg-slate-100/50">
                          {formatValue(displayedTotals.stockSistem)}
                        </td>

                        <td className={
                          `px-5 py-4 text-right text-sm font-extrabold ${
                            displayedTotals.selisih === 0 ? "text-emerald-700" : (displayedTotals.selisih > 0 ? "text-blue-700" : "text-rose-700")
                          }`
                        }>
                          {displayedTotals.selisih === 0 ? '0' : (displayedTotals.selisih > 0 ? `+${formatValue(displayedTotals.selisih)}` : formatValue(displayedTotals.selisih))}
                        </td>
                      </>
                    )}

                    {currentReconType === 'monthly' && (
                      <td className="px-5 py-4 text-center text-slate-400 font-normal text-xs italic">
                        —
                      </td>
                    )}
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination controls */}
        {!loading && displayedList.length > 0 && (
          <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50">
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <select 
                value={pageSize} 
                onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                className="border border-slate-200 rounded-md px-2.5 py-1.5 bg-white text-slate-900 font-semibold text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value={50}>50 baris</option>
                <option value={100}>100 baris</option>
                <option value={150}>150 baris</option>
              </select>
              <span>
                Menampilkan {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, displayedList.length)} dari {displayedList.length} baris
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button 
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3.5 py-1.5 border border-slate-200 rounded-md bg-white text-sm font-semibold text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-colors"
              >
                Sebelumnya
              </button>
              <div className="text-xs text-slate-500 px-2 font-bold whitespace-nowrap">
                Halaman {currentPage} dari {totalPages || 1}
              </div>
              <button 
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="px-3.5 py-1.5 border border-slate-200 rounded-md bg-white text-sm font-semibold text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-colors"
              >
                Selanjutnya
              </button>
            </div>
          </div>
        )}
      </div>

      {/* HISTORI SESI REKONSILIASI TERKUNCI REGISTER SECTION */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-extrabold text-slate-800">
              Histori Pencocokan Terkunci & Tersimpan
            </h3>
          </div>
          <span className="text-[10px] sm:text-xs font-mono bg-indigo-50 text-indigo-700 px-2 py-1 rounded">
            Cloud & Local Sync Active
          </span>
        </div>

        {loadingSessions ? (
          <div className="py-6 flex justify-center items-center gap-2 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm font-medium">Memuat histori dari database...</span>
          </div>
        ) : savedSessions.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm italic">
            Belum ada pencocokan terkunci yang disimpan. Klik tombol "Kunci & Simpan Sesi" di bagian atas untuk menyimpan status rekonsiliasi saat ini.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {savedSessions.map((sess) => (
              <div 
                key={sess.id} 
                className={
                  `border rounded-xl p-4 flex flex-col justify-between transition-all shadow-sm ${
                    activeSavedSession?.id === sess.id ? "border-amber-400 bg-amber-50/25 ring-1 ring-amber-400" : "border-slate-200 hover:border-slate-300 bg-white"
                  }`
                }
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-slate-900 text-sm truncate max-w-[200px]" title={sess.name}>
                      {sess.name}
                    </span>
                    <span className={
                      `px-2 py-0.5 rounded text-[10px] font-extrabold uppercase shrink-0 tracking-wider ${
                        sess.type === 'daily' ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"
                      }`
                    }>
                      {sess.type === 'daily' ? 'Harian' : 'Bulanan'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-y-1.5 gap-x-2 text-xs text-slate-500 mt-2.5 font-medium">
                    <div>Area: <strong className="text-slate-800 uppercase">{sess.area}</strong></div>
                    <div>Periode: <strong className="text-slate-800 font-mono">{formatToDDMMYYYY(sess.date)}</strong></div>
                    <div>Kombinasi: <strong>{sess.grandTotals?.itemCount ?? sess.items?.length ?? 0} SKU</strong></div>
                    <div>Simpanan: <strong>{sess.fireId ? 'Server Cloud' : 'Browser Lokal'}</strong></div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-3 gap-1 bg-slate-50 rounded-lg p-2 text-center text-[11px] font-mono">
                    <div>
                      <div className="font-semibold text-[9px] text-slate-400 uppercase">Awal</div>
                      <div className="font-bold text-slate-800">{(sess.grandTotals?.stokKemarin ?? (sess.grandTotals?.stokRill - sess.grandTotals?.mutasiQty) ?? 0).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="font-semibold text-[9px] text-slate-400 uppercase">Mutasi</div>
                      <div className="font-bold text-slate-800">{(sess.grandTotals?.mutasiQty || 0).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="font-semibold text-[9px] text-slate-400 uppercase">Selisih</div>
                      <div className={cn("font-bold", sess.grandTotals?.selisih === 0 ? "text-emerald-700" : "text-rose-700")}>
                        {(sess.grandTotals?.selisih || 0).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-4 pt-2 border-t border-slate-100">
                  {activeSavedSession?.id === sess.id ? (
                    <button
                      type="button"
                      onClick={() => setActiveSavedSession(null)}
                      className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors focus:ring-2 focus:ring-amber-500"
                    >
                      <Undo className="w-3.5 h-3.5 text-white" />
                      Tutup Arsip
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSavedSession(sess);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors focus:ring-2 focus:ring-blue-500"
                    >
                      <History className="w-3.5 h-3.5 text-white" />
                      Buka Sesi
                    </button>
                  )}
                  
                  <button
                    type="button"
                    onClick={() => handleDeleteSession(sess)}
                    className="p-1.5 border border-slate-200 rounded-lg hover:bg-rose-50 hover:text-rose-700 text-slate-400 transition-colors focus:outline-none"
                    title="Hapus Arsip Sesi"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex gap-3 text-slate-600 text-xs sm:text-sm">
        <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-slate-800">Keterangan Prosedur Rekonsiliasi:</span> Kolom <span className="font-bold">Mutasi</span> menghitung transaksi IN/OUT yang dicatat di tanggal/bulan berjalan. Kolom <span className="font-bold">Stok Rill (Kemarin atau Awal Bulan)</span> dihitung dari akumulasi transaksi sebelum batas interval. Selisih dihitung terhadap <span className="font-bold">Stok Sistem (MTS)</span> dari Google Sheets. Data ini dapat Anda simpan secara permanen ke database lokal & cloud dengan mengklik tombol "Kunci & Simpan Sesi".
        </div>
      </div>

      {/* SAVE SESSION DOCUMENTATION DIALOG/MODAL */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xl w-full max-w-lg space-y-4 text-left my-8">
            <div className="flex items-center gap-3 text-emerald-800 border-b border-slate-100 pb-3">
              <div className="p-2.5 bg-emerald-100 rounded-full text-emerald-700 col-span-1">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-slate-950">Kunci & Simpan Rekonsiliasi</h3>
                <p className="text-xs text-slate-500">
                  Data status pencocokan akan terkunci secara permanen sebagai arsip snapshot historis.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Nama Sesi Terkunci
              </label>
              <input 
                type="text" 
                value={sessionNameInput}
                onChange={e => setSessionNameInput(e.target.value)}
                placeholder="Masukkan deskripsi nama arsip..."
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 outline-none sm:text-sm"
              />
              <p className="text-[11px] text-slate-400">
                Saran nama default menyertakan jenis laporan, area, dan date filter saat ini.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs leading-relaxed font-mono space-y-1 text-slate-700">
              <div>• Total item: <strong>{filteredReconciliation.length}</strong></div>
              <div>• Grand Total Rill: <strong>{grandTotals.stokRill.toLocaleString()} unit</strong></div>
              <div>• Grand Total Sistem: <strong>{grandTotals.stockSistem.toLocaleString()} unit</strong></div>
              <div>• Grand Total Selisih: <strong className={grandTotals.selisih === 0 ? "text-emerald-700" : "text-rose-700"}>{grandTotals.selisih.toLocaleString()}</strong></div>
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                disabled={isSaving}
                className="flex-1 py-2.5 border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-sm rounded-lg transition-colors focus:outline-none"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveSessionConfirm}
                disabled={isSaving}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-lg shadow-sm flex items-center justify-center gap-2 transition-colors focus:ring-2 focus:ring-emerald-500"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Simpan & Kunci
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
