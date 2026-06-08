import { useEffect, useState, type FormEvent } from 'react';
import { fetchSheetData, appendSheetRow } from '../lib/sheets';
import type { Transaction, Product, Locator } from '../types';
import { Loader2, Plus, Search, Package, MapPin, Calendar, FileText, Hash, ArrowDownRight, ArrowUpRight, CheckCircle2, ArrowRightLeft, FileDigit } from 'lucide-react';

interface Props {
  spreadsheetId: string;
  sheetName: string;
  title: string;
  description: string;
}

const INDO_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const getParsedDateValue = (dtStr: string): number => {
  if (!dtStr) return 0;
  
  // Try YYYY-MM-DD
  const yyyymmdd = dtStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (yyyymmdd) {
    return new Date(parseInt(yyyymmdd[1], 10), parseInt(yyyymmdd[2], 10) - 1, parseInt(yyyymmdd[3], 10)).getTime();
  }
  
  // Try MM/DD/YY or MM/DD/YYYY
  const slashed = dtStr.split('/');
  if (slashed.length === 3) {
    const m = parseInt(slashed[0], 10) - 1;
    const d = parseInt(slashed[1], 10);
    let y = parseInt(slashed[2], 10);
    if (slashed[2].length === 2) {
      y += 2000;
    }
    return new Date(y, m, d).getTime();
  }
  
  const t = Date.parse(dtStr);
  return isNaN(t) ? 0 : t;
};

export const displayTanggalIndonesian = (dtStr: string): string => {
  if (!dtStr) return '-';
  
  let dateObj: Date | null = null;
  
  // Try matching YYYY-MM-DD (e.g., "2026-06-08")
  const yyyymmdd = dtStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (yyyymmdd) {
    const y = parseInt(yyyymmdd[1], 10);
    const m = parseInt(yyyymmdd[2], 10) - 1;
    const d = parseInt(yyyymmdd[3], 10);
    dateObj = new Date(y, m, d);
  } else {
    // Try matching MM/DD/YY or MM/DD/YYYY (e.g., "06/08/26" or "06/08/2026")
    const slashed = dtStr.split('/');
    if (slashed.length === 3) {
      const m = parseInt(slashed[0], 10) - 1;
      const d = parseInt(slashed[1], 10);
      let y = parseInt(slashed[2], 10);
      if (slashed[2].length === 2) {
        y += 2000; // assume 20xx
      }
      if (!isNaN(m) && !isNaN(d) && !isNaN(y)) {
        dateObj = new Date(y, m, d);
      }
    }
  }
  
  if (!dateObj || isNaN(dateObj.getTime())) {
    // Fallback to standard javascript Parsing
    const timestamp = Date.parse(dtStr);
    if (!isNaN(timestamp)) {
      dateObj = new Date(timestamp);
    }
  }
  
  if (dateObj && !isNaN(dateObj.getTime())) {
    const d = String(dateObj.getDate()).padStart(2, '0');
    const mIndex = dateObj.getMonth();
    const mLabel = INDO_MONTHS[mIndex] || String(mIndex + 1);
    const y = dateObj.getFullYear();
    return `${d}-${mLabel}-${y}`;
  }
  
  return dtStr; // Return as is if fully unrecognized
};

export default function TransactionInput({ spreadsheetId, sheetName, title, description }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [locators, setLocators] = useState<Locator[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedLocator, setSelectedLocator] = useState('ALL');
  const [selectedLocatorTo, setSelectedLocatorTo] = useState('ALL');

  const loadData = async (retryOnMissing = true) => {
    const cleanUrl = spreadsheetId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
    const txKey = `erp_cache_${cleanUrl}_tx_${sheetName.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const pKey = `erp_cache_${cleanUrl}_master_produk_C`; // cache key with C suffix to separate columns
    const lKey = `erp_cache_${cleanUrl}_master_locator`;

    // Try starting from cache
    try {
      const cachedTx = localStorage.getItem(txKey);
      const cachedP = localStorage.getItem(pKey);
      const cachedL = localStorage.getItem(lKey);

      if (cachedTx && cachedP && cachedL) {
        const txRows = (JSON.parse(cachedTx).data || []).slice(1);
        const pRows = (JSON.parse(cachedP).data || []).slice(1);
        const lRows = (JSON.parse(cachedL).data || []).slice(1);

        const parsedTransactions = txRows
          .filter((r: any[]) => r.length > 0 && (r[0] || r[1] || r[9]))
          .map((r: any[]) => ({
            tanggal: String(r[0] || ''),
            namaBahan: String(r[1] || ''),
            kuantitas: parseFloat(String(r[2] || '0').replace(',', '.')) || 0,
            uom: String(r[3] || ''),
            tipe: String(r[4] || '').trim().toUpperCase() as 'IN'|'OUT'|'AWAL',
            locator: String(r[5] || ''),
            locatorTo: String(r[6] || ''),
            noDocument: String(r[7] || ''),
            keterangan: String(r[8] || ''),
            kodeProduk: String(r[9] || '')
          }));

        parsedTransactions.sort((a, b) => getParsedDateValue(a.tanggal) - getParsedDateValue(b.tanggal));
        setTransactions(parsedTransactions);

        const uniqueP = Array.from(new Map(pRows.filter((r: any[]) => r.length > 0 && r[0]).map((r: any[]) => [String(r[0]), { kode: String(r[0]), nama: String(r[1] || ''), satuan: String(r[2] || ''), kategori: '' }])).values());
        const uniqueL = Array.from(new Map(lRows.filter((r: any[]) => r.length > 0 && r[0]).map((r: any[]) => [String(r[0]), { whGroup: String(r[0]), nama: String(r[1] || ''), deskripsi: String(r[2] || ''), whType: String(r[3] || ''), area: String(r[4] || '') }])).values());

        setProducts(uniqueP as Product[]);
        setLocators(uniqueL as Locator[]);
        setLoading(false);
        console.log(`[SWR] Loaded transactions for ${sheetName} from cache`);
      }
    } catch (e) {
      console.warn("Failed loading cached transactions:", e);
    }

    try {
      let txRows: any[] = [];
      let pRows: any[] = [];
      let lRows: any[] = [];
      
      try {
        [txRows, pRows, lRows] = await Promise.all([
          fetchSheetData(spreadsheetId, `'${sheetName}'!A:J`, true),
          fetchSheetData(spreadsheetId, "'MASTER_PRODUK'!A:C", true),
          fetchSheetData(spreadsheetId, "'MASTER_LOCATOR'!A:E", true)
        ]);
      } catch (fetchErr: any) {
        if (retryOnMissing) {
          console.log("Error fetching transactions or master data. Attempting auto-initialization...");
          try {
            const { initializeERPSpreadsheet } = await import('../lib/sheets');
            await initializeERPSpreadsheet(spreadsheetId);
            // Retry once
            return loadData(false);
          } catch (initErr: any) {
            console.error("Auto-initialization fallback failed:", initErr);
            throw fetchErr; // rethrow original fetch error
          }
        } else {
          throw fetchErr;
        }
      }

      // Save to cache (raw with headers intact)
      try {
        localStorage.setItem(txKey, JSON.stringify({ timestamp: Date.now(), data: txRows }));
        localStorage.setItem(pKey, JSON.stringify({ timestamp: Date.now(), data: pRows }));
      } catch (e) {
        console.warn("Failed saving transactions/products to cache:", e);
      }

      // Slice out headers for display & mapping
      txRows = txRows.slice(1);
      pRows = pRows.slice(1);
      lRows = lRows.slice(1);

      const parsedTransactions = txRows
        .filter((r: any[]) => r.length > 0 && (r[0] || r[1] || r[9]))
        .map((r: any[]) => ({
          tanggal: String(r[0] || ''),
          namaBahan: String(r[1] || ''),
          kuantitas: parseFloat(String(r[2] || '0').replace(',', '.')) || 0,
          uom: String(r[3] || ''),
          tipe: String(r[4] || '').trim().toUpperCase() as 'IN'|'OUT'|'AWAL',
          locator: String(r[5] || ''),
          locatorTo: String(r[6] || ''),
          noDocument: String(r[7] || ''),
          keterangan: String(r[8] || ''),
          kodeProduk: String(r[9] || '')
        }));

      // Sort chronological ascending (oldest on top, newest at the bottom)
      parsedTransactions.sort((a, b) => getParsedDateValue(a.tanggal) - getParsedDateValue(b.tanggal));

      setTransactions(parsedTransactions);

      const uniqueP = Array.from(new Map(pRows.filter((r: any[]) => r.length > 0 && r[0]).map((r: any[]) => [String(r[0]), { kode: String(r[0]), nama: String(r[1] || ''), satuan: String(r[2] || ''), kategori: '' }])).values());
      const uniqueL = Array.from(new Map(lRows.filter((r: any[]) => r.length > 0 && r[0]).map((r: any[]) => [String(r[0]), { whGroup: String(r[0]), nama: String(r[1] || ''), deskripsi: String(r[2] || ''), whType: String(r[3] || ''), area: String(r[4] || '') }])).values());

      setProducts(uniqueP as Product[]);
      setLocators(uniqueL as Locator[]);

    } catch (err: any) {
      console.error("Transactions background load error:", err);
      if (loading) {
        alert(`Gagal memuat transaksi dari ${sheetName}: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [spreadsheetId, sheetName]);

  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Extract unique locators dynamically from transaction table records as requested
  const uniqueLocatorsFromTable = Array.from(new Set(transactions.map(t => t.locator).filter(Boolean))).sort() as string[];
  const uniqueLocatorTosFromTable = Array.from(new Set(transactions.map(t => t.locatorTo).filter(Boolean))).sort() as string[];

  const getLocatorDisplayName = (code: string) => {
    const found = locators.find(l => l.whGroup === code);
    return found ? `${code} - ${found.nama}` : code;
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedLocator, selectedLocatorTo, startDate, endDate]);

  const filtered = transactions.filter(t => {
    const matchesSearch = 
      t.kodeProduk.toLowerCase().includes(search.toLowerCase()) || 
      t.namaBahan.toLowerCase().includes(search.toLowerCase()) || 
      t.locator.toLowerCase().includes(search.toLowerCase()) ||
      t.noDocument.toLowerCase().includes(search.toLowerCase()) ||
      t.keterangan.toLowerCase().includes(search.toLowerCase());

    const matchesLocator = 
      selectedLocator === 'ALL' || 
      t.locator === selectedLocator;

    const matchesLocatorTo = 
      selectedLocatorTo === 'ALL' || 
      t.locatorTo === selectedLocatorTo;

    // Timezone & format consistent parsing using getParsedDateValue
    const matchesDateRange = (() => {
      if (!startDate && !endDate) return true;
      const val = getParsedDateValue(t.tanggal);
      if (!val) return false;
      if (startDate) {
        const startVal = getParsedDateValue(startDate);
        if (val < startVal) return false;
      }
      if (endDate) {
        const endVal = getParsedDateValue(endDate);
        if (val > endVal) return false;
      }
      return true;
    })();

    return matchesSearch && matchesLocator && matchesLocatorTo && matchesDateRange;
  });

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const totalIn = filtered.reduce((sum, t) => t.tipe === 'IN' ? sum + t.kuantitas : sum, 0);
  const totalOut = filtered.reduce((sum, t) => t.tipe === 'OUT' ? sum + t.kuantitas : sum, 0);
  const totalAwal = filtered.reduce((sum, t) => t.tipe === 'AWAL' ? sum + t.kuantitas : sum, 0);
  const grandTotalQty = filtered.reduce((sum, t) => sum + t.kuantitas, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h2>
          <p className="text-sm text-slate-500 mt-1">{description}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => loadData(true)} className="px-4 py-2 border border-slate-200 bg-white rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-200">
            Refresh Data
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
        {/* Filters Panel with Search, Date Range Filter and Dynamic Locators options */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 space-y-4">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Cari transaksi..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none shadow-sm bg-white" />
            </div>

            {/* Date range inputs */}
            <div className="flex flex-wrap items-center gap-3 bg-white px-3 py-1.5 border border-slate-200 rounded-lg shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 shrink-0">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> Filter Tanggal:
              </span>
              <div className="flex items-center gap-2">
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={e => setStartDate(e.target.value)}
                  className="px-2 py-1 text-xs border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                  title="Tanggal Mulai"
                />
                <span className="text-slate-400 text-xs font-medium">s.d</span>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={e => setEndDate(e.target.value)}
                  className="px-2 py-1 text-xs border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                  title="Tanggal Selesai"
                />
              </div>
              {(startDate || endDate) && (
                <button 
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                  className="text-xs font-medium text-rose-600 hover:text-rose-700 hover:underline px-1 shrink-0"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-1">
             <div className="flex items-center gap-2">
               <span className="text-sm font-medium text-slate-600 shrink-0">Filter Locator:</span>
               <select 
                 value={selectedLocator} 
                 onChange={e => setSelectedLocator(e.target.value)}
                 className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-sm min-w-[150px] max-w-[240px]"
               >
                 <option value="ALL">Semua Locator</option>
                 {uniqueLocatorsFromTable.map(loc => (
                   <option key={loc} value={loc}>
                     {getLocatorDisplayName(loc)}
                   </option>
                 ))}
               </select>
             </div>

             <div className="flex items-center gap-2">
               <span className="text-sm font-medium text-slate-600 shrink-0">Filter Locator To:</span>
               <select 
                 value={selectedLocatorTo} 
                 onChange={e => setSelectedLocatorTo(e.target.value)}
                 className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-sm min-w-[150px] max-w-[240px]"
               >
                 <option value="ALL">Semua Locator To</option>
                 {uniqueLocatorTosFromTable.map(loc => (
                   <option key={loc} value={loc}>
                     {getLocatorDisplayName(loc)}
                   </option>
                 ))}
               </select>
             </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-16 flex flex-col items-center justify-center text-blue-600 gap-3">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="text-sm font-medium text-slate-500">Memuat data transaksi dari {sheetName}...</p>
            </div>
          ) : (<>
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="px-5 py-3.5 font-semibold text-xs tracking-wider uppercase">Tanggal</th>
                  <th className="px-5 py-3.5 font-semibold text-xs tracking-wider uppercase">Nama Bahan</th>
                  <th className="px-5 py-3.5 font-semibold text-xs tracking-wider uppercase text-right">Qty</th>
                  <th className="px-5 py-3.5 font-semibold text-xs tracking-wider uppercase">UOM</th>
                  <th className="px-5 py-3.5 font-semibold text-xs tracking-wider uppercase">I/O/A</th>
                  <th className="px-5 py-3.5 font-semibold text-xs tracking-wider uppercase">Locator</th>
                  <th className="px-5 py-3.5 font-semibold text-xs tracking-wider uppercase">Locator To</th>
                  <th className="px-5 py-3.5 font-semibold text-xs tracking-wider uppercase">No. Document</th>
                  <th className="px-5 py-3.5 font-semibold text-xs tracking-wider uppercase">Keterangan</th>
                  <th className="px-5 py-3.5 font-semibold text-xs tracking-wider uppercase">Kode</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginated.map((t, idx) => {
                  return (
                    <tr key={idx} className="hover:bg-blue-50/30 transition-colors text-slate-700 group">
                      <td className="px-5 py-3 text-slate-500 tabular-nums">
                        <div className="flex items-center gap-2">
                           <Calendar className="w-3.5 h-3.5 text-slate-400" />
                           {displayTanggalIndonesian(t.tanggal)}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="font-medium text-slate-900 group-hover:text-blue-600 transition-colors">{t.namaBahan}</div>
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-lg tabular-nums">
                        <div className={
                           t.tipe === 'IN' ? 'text-emerald-600' : 
                           t.tipe === 'OUT' ? 'text-rose-600' : 'text-slate-700'
                        }>{t.kuantitas.toLocaleString()}</div>
                      </td>
                      <td className="px-5 py-3 text-slate-500 text-sm">
                        {t.uom}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${
                           t.tipe === 'IN' ? 'bg-emerald-100 text-emerald-700' : 
                           t.tipe === 'AWAL' ? 'bg-blue-100 text-blue-700' : 
                           'bg-rose-100 text-rose-700'
                        }`}>
                          {t.tipe === 'IN' && <ArrowDownRight className="w-3 h-3" />}
                          {t.tipe === 'OUT' && <ArrowUpRight className="w-3 h-3" />}
                          {t.tipe === 'AWAL' && <CheckCircle2 className="w-3 h-3" />}
                          {t.tipe}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="font-medium text-slate-900 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {t.locator}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {t.locatorTo ? (
                          <div className="font-medium text-slate-900 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            {t.locatorTo}
                          </div>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3 font-mono text-slate-500 text-xs">
                        {t.noDocument || '-'}
                      </td>
                      <td className="px-5 py-3 text-slate-500 truncate max-w-[200px]" title={t.keterangan}>
                        {t.keterangan || <span className="text-slate-300 italic">Tidak ada catatan</span>}
                      </td>
                      <td className="px-5 py-3 font-mono text-slate-500 text-xs">
                        {t.kodeProduk}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length > 0 && (
                  <tr className="bg-slate-50 font-semibold border-t-2 border-slate-200 text-slate-900 sticky bottom-0 z-10 shadow-[0_-1px_0_rgba(0,0,0,0.05)]">
                    <td className="px-5 py-4 text-slate-800" colSpan={2}>Grand Total (Filtered)</td>
                    <td className="px-5 py-4 text-right font-bold text-lg tabular-nums text-blue-600">
                      {grandTotalQty.toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-slate-500 text-sm" colSpan={7}>
                      <span className="inline-flex flex-wrap items-center gap-4 text-xs font-semibold uppercase tracking-wider">
                        <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-md border border-emerald-100">Total IN: {totalIn.toLocaleString()}</span>
                        <span className="bg-rose-50 text-rose-700 px-2.5 py-1 rounded-md border border-rose-100">Total OUT: {totalOut.toLocaleString()}</span>
                        {totalAwal > 0 && <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md border border-blue-100">Total AWAL: {totalAwal.toLocaleString()}</span>}
                      </span>
                    </td>
                  </tr>
                )}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center">
                         <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                            <Search className="w-6 h-6" />
                         </div>
                         <p className="font-medium text-slate-700">Tidak ada data transaksi</p>
                         <p className="text-sm mt-1">Coba sesuaikan filter pencarian atau tambahkan transaksi baru.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            
            {filtered.length > 0 && (
              <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
                 <div className="flex items-center gap-3 text-sm text-slate-600">
                   <div className="flex items-center gap-2">
                     Tampilkan
                     <select 
                       value={pageSize} 
                       onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                       className="border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm cursor-pointer"
                     >
                       <option value={10}>10</option>
                       <option value={50}>50</option>
                       <option value={100}>100</option>
                       <option value={10000}>Semua</option>
                     </select>
                     baris
                   </div>
                   <div className="hidden sm:block text-slate-300">|</div>
                   <span className="hidden sm:block">Menampilkan {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filtered.length)} dari {filtered.length} transaksi</span>
                 </div>
                 <div className="flex items-center gap-1">
                   <button 
                     onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                     disabled={currentPage === 1}
                     className="px-4 py-1.5 border border-slate-200 rounded-lg bg-white text-sm font-medium text-slate-600 disabled:opacity-40 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                   >
                     Sebelumnya
                   </button>
                   <button 
                     onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                     disabled={currentPage === totalPages || totalPages === 0}
                     className="px-4 py-1.5 border border-slate-200 rounded-lg bg-white text-sm font-medium text-slate-600 disabled:opacity-40 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                   >
                     Selanjutnya
                   </button>
                 </div>
              </div>
            )}
          </>)}
        </div>
      </div>
    </div>
  );
}

