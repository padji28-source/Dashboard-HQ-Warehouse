import { useEffect, useState, useMemo, useRef , memo} from "react";
import { Loader2, Search as SearchIcon, Scale as ScaleIcon, CheckCircle2, AlertCircle, RefreshCw, Undo, Lock as LockIcon, History as HistoryIcon, FileSpreadsheet, Info as InfoIcon, Calendar as CalendarIcon, Trash2, Check, X } from 'lucide-react';
import { collection, addDoc, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useData } from '../../context/DataContext';
import { fetchAndParseCSV } from "../../lib/csvCache";
import { StockSummary } from "../../shared/types";

// Custom tailwind utility class helper if required
function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}

// Helper to format values
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
  const parsed = Date.parse(dateStr);
  if (!isNaN(parsed)) {
    const dObj = new Date(parsed);
    const d = String(dObj.getDate()).padStart(2, '0');
    const m = String(dObj.getMonth() + 1).padStart(2, '0');
    const y = dObj.getFullYear();
    return `${d}-${m}-${y}`;
  }
  return dateStr;
}

const LOCAL_STORAGE_KEY = 'mms_saved_reconciliations';

interface ReconciliationItem {
  kodeProduk: string;
  namaProduk: string;
  whGroup: string;
  namaLocator: string;
  stokInput: number;
  stokSistem: number;
  selisih: number;
  area: string;
  source: string;
  uom: string;
  lastUpdated?: string;
}

interface SavedReconciliation {
  id: string;
  timestamp: string;
  area: string;
  items: ReconciliationItem[];
  summary: {
    totalItems: number;
    totalSelisih: number;
    totalAkurasi: number;
  };
}

function PencocokanData({ spreadsheetId, activeArea: area }: { spreadsheetId: string; activeArea: string }) {
  const { transactions: allTransactions, productsMap, locatorsMap, loading: dataLoading, refreshData } = useData();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [activeStocks, setActiveStocks] = useState<any[]>([]);
  const [mtsMap, setMtsMap] = useState<Map<string, number>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSource, setSelectedSource] = useState("ALL");
  const [selectedArea, setSelectedArea] = useState<string>("ALL");

  const [selectedLocator, setSelectedLocator] = useState("ALL");

  const loadMts = async (autoReconcile = true) => {
    setLoading(true);
    setError(null);
    const mtsMapLocal = new Map<string, number>();
    try {
      const gidMap: Record<string, string> = {
        'JAKARTA': '263347272',
        'BANDUNG': '1113036495',
        'SEMARANG': '1046187680',
        'SURABAYA': '632551509'
      };
      const currentArea = (area || 'JAKARTA').toUpperCase();
      const gid = gidMap[currentArea] || '263347272';
      
      const proxyUrl = `/api/stock-summary?gid=${gid}`;
      const fallbackUrl = `https://docs.google.com/spreadsheets/d/e/2PACX-1vSbvA_5FOxi2-nkfz8iJbptOhDfBCLM5LnTwrVLeJ4pf1hlGjSBywsTXQYYtEjuo0DY2M63wcJmc0tP/pub?gid=${gid}&single=true&output=csv`;

      console.log(`Loading MTS for area ${currentArea} (GID: ${gid})`);
      const dataMts = await fetchAndParseCSV<string[]>(proxyUrl, true, fallbackUrl);
      
      if (dataMts.length > 0) {
        let headerIndex = -1;
        for (let i = 0; i < Math.min(15, dataMts.length); i++) {
          const rowStr = dataMts[i].map(v => String(v).toLowerCase().trim());
          if (rowStr.some(v => v.includes('locator')) && (rowStr.some(v => v.includes('search key')) || rowStr.some(v => v.includes('sku')))) {
            headerIndex = i;
            break;
          }
        }
        
        if (headerIndex === -1) headerIndex = 0;

        const rawHeaders = dataMts[headerIndex] || [];
        const colLoc = rawHeaders.findIndex(h => String(h || '').toLowerCase().trim() === 'locator');
        const colSku = rawHeaders.findIndex(h => {
          const s = String(h || '').toLowerCase().trim();
          return s === 'search key' || s === 'sku';
        });
        const colName = rawHeaders.findIndex(h => {
          const s = String(h || '').toLowerCase().trim();
          return s === 'name' || s === 'nama';
        });
        const colLastQty = rawHeaders.findIndex(h => {
          const s = String(h || '').toLowerCase().trim();
          return s === 'last qty' || s === 'stock' || s === 'saldo';
        });

        dataMts.slice(headerIndex + 1).forEach(row => {
          const loc = colLoc !== -1 ? String(row[colLoc] || '').trim().toUpperCase() : '';
          const sku = colSku !== -1 ? String(row[colSku] || '').trim().toUpperCase() : '';
          const name = colName !== -1 ? String(row[colName] || '').trim().toUpperCase() : '';
          let lastQty = 0;
          if (colLastQty !== -1) lastQty = parseFloat(String(row[colLastQty] || '0').replace(/[^0-9.-]/g, '')) || 0;

          if (loc) {
            if (sku) mtsMapLocal.set(`${sku}_${loc}`, lastQty);
            if (name) mtsMapLocal.set(`${name}_${loc}`, lastQty);
          }
        });
      }
      if (autoReconcile) setShouldReconcile(true);
    } catch (err: any) { 
      console.error("Error loading MTS:", err);
      setError(`Gagal memuat data MTS: ${err.message || "Kesalahan jaringan"}`);
    } finally {
      setMtsMap(mtsMapLocal);
      setLoading(false);
    }
  };

  const [reconciledDataAll, setReconciledDataAll] = useState<any[]>([]);
  const [reconciledData, setReconciledData] = useState<any[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  useEffect(() => {
    const initLoad = async () => {
      // Ensure we have current transactions
      if (allTransactions.length === 0) {
        await refreshData(false);
      }
      // Then pull MTS
      await loadMts(true);
    };
    initLoad();
  }, [area]);

  const runReconciliation = (txs: any[], pMap: Map<string, any>, lMap: Map<string, any>, currentMts: Map<string, number>) => {
    const stockMap = new Map<string, any>();
    const targetDate = new Date(selectedDate);
    targetDate.setHours(0,0,0,0);
    
    txs.forEach(t => {
      const { pCode, pName, lCode, qty, tipe, area: rowArea, source, tanggal } = t;
      if (selectedArea !== "ALL" && rowArea !== selectedArea) return;

      const transDate = new Date(tanggal);
      transDate.setHours(0,0,0,0);

      const isBefore = transDate < targetDate;
      const isToday = transDate.getTime() === targetDate.getTime();
      
      if (!isBefore && !isToday) return;

      const key = `${rowArea}_${lCode}_${pCode}`;
      let summary = stockMap.get(key);
      if (!summary) {
        const lookupKey = lCode.trim();
        const lData = lMap.get(lookupKey) || lMap.get(lookupKey.toUpperCase()) || { nama: lCode, whType: '', area: rowArea };
        summary = {
          kodeProduk: pCode,
          namaProduk: typeof pMap.get(pCode) === 'string' ? pMap.get(pCode) : (pMap.get(pCode)?.nama || pName || pCode),
          whGroup: lCode,
          namaLocator: lData.nama,
          whType: lData.whType,
          area: rowArea || area,
          source: source || 'UNKNOWN',
          stokKemarin: 0,
          mutasiIn: 0,
          mutasiOut: 0,
          stock: 0
        };
        stockMap.set(key, summary);
      }

      const norm = (tipe || '').toUpperCase();
      const isIN = norm === 'IN' || norm.includes('AWAL') || norm === 'RECEIPT' || norm === 'MASUK';
      const isOUT = norm === 'OUT' || norm === 'ISSUE' || norm === 'KELUAR' || norm === 'TRANSFER' || norm === 'TF';

      if (isBefore) {
        if (isIN) summary.stokKemarin += qty;
        else if (isOUT) summary.stokKemarin -= qty;
        else if (qty > 0) summary.stokKemarin += qty;
      } else if (isToday) {
        if (isIN) summary.mutasiIn += qty;
        else if (isOUT) summary.mutasiOut += qty;
        else if (qty > 0) summary.mutasiIn += qty;
      }
    });

    stockMap.forEach(s => {
       s.stock = s.stokKemarin + s.mutasiIn - s.mutasiOut;
       const pk = String(s.kodeProduk || '').toUpperCase();
       const lk = String(s.whGroup || '').toUpperCase();
       s.qtySistem = currentMts.get(`${pk}_${lk}`) || 0;
       s.selisih = Math.round((s.stock - s.qtySistem) * 1000) / 1000;
    });

    const allData = Array.from(stockMap.values());
    setReconciledDataAll(allData);
    setReconciledData(allData);
    setLastRefreshed(new Date());
  };

  useEffect(() => {
    if (selectedSource === "ALL") {
      setReconciledData(reconciledDataAll);
    } else {
      setReconciledData(reconciledDataAll.filter(s => s.source === selectedSource));
    }
  }, [selectedSource, reconciledDataAll]);

  const [shouldReconcile, setShouldReconcile] = useState(false);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      // 1. Refresh transactions from context
      await refreshData(true);
      
      // 2. Refresh MTS data from proxy
      await loadMts();
      
      // 3. Trigger re-calculation
      setShouldReconcile(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Initial load if needed, but the user asked for manual. 
  useEffect(() => {
    if (allTransactions.length > 0 && (reconciledData.length === 0 || shouldReconcile) && !loading) {
      runReconciliation(allTransactions, productsMap, locatorsMap, mtsMap);
      setShouldReconcile(false);
    }
  }, [allTransactions, productsMap, locatorsMap, mtsMap, shouldReconcile, loading]);

  const filtered = useMemo(() => {
    return reconciledData.filter(s => {
      const term = search.toLowerCase();
      const matchSearch = String(s.namaProduk || '').toLowerCase().includes(term) || 
                          String(s.kodeProduk || '').toLowerCase().includes(term) || 
                          String(s.whGroup || '').toLowerCase().includes(term);
      const matchLocator = selectedLocator === "ALL" || s.whGroup === selectedLocator;
      return matchSearch && matchLocator;
    });
  }, [reconciledData, search, selectedLocator]);

  const paginated = useMemo(() => {
    return filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [filtered, currentPage, pageSize]);

  const uniqueLocators = useMemo(() => {
    const locs = new Set(reconciledData.map(s => s.whGroup));
    return Array.from(locs).filter(Boolean).sort();
  }, [reconciledData]);

  const totalSKU = reconciledData.length;
  const matchSKU = reconciledData.filter(s => s.selisih === 0).length;
  const varSKU = reconciledData.filter(s => s.selisih !== 0).length;
  const matchPercent = totalSKU > 0 ? Math.round((matchSKU / totalSKU) * 100) : 0;

  const catCounts = {
    'ALL': reconciledDataAll.length,
    'INPUT': reconciledDataAll.filter(s => s.source === "INPUT").length,
    'INPUT RM': reconciledDataAll.filter(s => s.source === "INPUT RM").length,
    'INPUT MFG': reconciledDataAll.filter(s => s.source === "INPUT MFG").length,
    'INPUT SUPPLIES': reconciledDataAll.filter(s => s.source === "INPUT SUPPLIES").length,
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 flex items-center justify-center rounded-xl text-blue-600">
              <ScaleIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Pencocokan Data (Reconciliation)</h1>
              <p className="text-sm text-slate-500">Bandingkan kuantitas fisik wilayah lapangan dengan catatan ledger pusat (Google Sheet Data MTS).</p>
            </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-4 py-2 bg-emerald-50 text-emerald-600 font-semibold text-sm rounded-lg border border-emerald-100 flex items-center gap-2 hover:bg-emerald-100 transition-colors">
            <LockIcon className="w-4 h-4" /> Kunci & Simpan Sesi
          </button>
          <button onClick={handleRefresh} disabled={loading || dataLoading} className="px-4 py-2 bg-white text-slate-600 font-semibold text-sm rounded-lg border border-slate-200 flex items-center gap-2 hover:bg-slate-50 transition-colors disabled:opacity-50">
            <RefreshCw className={cn("w-4 h-4", (loading || dataLoading) && "animate-spin")} /> Refresh Sinkronisasi
          </button>
          <button className="px-4 py-2 bg-blue-50 text-blue-600 font-semibold text-sm rounded-lg border border-blue-100 flex items-center gap-2 hover:bg-blue-100 transition-colors">
            <FileSpreadsheet className="w-4 h-4" /> Export Excel
          </button>
        </div>
      </div>

      {/* TABS */}
      <div className="flex items-center gap-2">
        <button className="px-4 py-2 bg-blue-600 text-white font-semibold text-sm rounded-lg flex items-center gap-2 shadow-sm">
          <CalendarIcon className="w-4 h-4" /> Pencocokan Harian
        </button>
        <button className="px-4 py-2 bg-white text-slate-600 font-semibold text-sm rounded-lg border border-slate-200 flex items-center gap-2 hover:bg-slate-50 transition-colors">
          <CalendarIcon className="w-4 h-4" /> Pencocokan Periode
        </button>
      </div>

      {/* INFO BANNER */}
      <div className="bg-blue-50/50 border border-blue-100 p-3 rounded-lg flex items-start gap-2 text-sm text-blue-800">
        <InfoIcon className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <p>
          Sedang menampilkan <span className="font-bold">Pencocokan Harian</span> untuk tanggal <span className="font-bold">{formatToDDMMYYYY(selectedDate)}</span>. Stok Rill diakumulasi dari seluruh transaksi <span className="font-bold">sebelum atau pada tanggal tersebut</span>, dengan kolom Mutasi mencatat aktivitas mutasi harian khusus di tanggal berjalan.
        </p>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">TOTAL SKU / KOMBINASI</span>
            <span className="text-3xl font-black text-slate-800">{totalSKU}</span>
            <span className="text-xs text-slate-400 mt-1">Grup lokasi & produk aktif</span>
          </div>
          
          <div className="bg-white p-4 rounded-xl border-l-4 border-l-emerald-500 border-y border-r border-slate-200 shadow-sm flex flex-col justify-center">
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">SESUAI (MATCH)</span>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              <span className="text-3xl font-black text-emerald-600">{matchSKU}</span>
            </div>
            <span className="text-xs text-slate-400 mt-1">{matchPercent}% Tingkat kecocokan</span>
          </div>

          <div className="bg-white p-4 rounded-xl border-l-4 border-l-rose-500 border-y border-r border-slate-200 shadow-sm flex flex-col justify-center">
            <span className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mb-1">ADA SELISIH (VARIAN)</span>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-6 h-6 text-rose-500" />
              <span className="text-3xl font-black text-rose-600">{varSKU}</span>
            </div>
            <span className="text-xs text-slate-400 mt-1">Butuh pemeriksaan unit/mutasi</span>
          </div>

          <div className="bg-white p-4 rounded-xl border-l-4 border-l-blue-500 border-y border-r border-slate-200 shadow-sm flex flex-col justify-center">
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">STATUS DATA</span>
            <div className="flex items-center gap-2">
              <InfoIcon className="w-6 h-6 text-blue-500" />
              <span className="text-2xl font-black text-blue-700">MTS LIVE FEED</span>
            </div>
            <span className="text-xs text-slate-400 mt-1">Sistem sinkronisasi waktu riil</span>
          </div>
      </div>

      {/* CATEGORY TABS */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 block">KATEGORI MENU PENCOCOKAN</span>
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'ALL', label: 'Semua Kategori (All)' },
            { id: 'INPUT', label: 'Accessories' },
            { id: 'INPUT RM', label: 'Raw Material' },
            { id: 'INPUT MFG', label: 'Manufacturing' },
            { id: 'INPUT SUPPLIES', label: 'Supplies & GA' }
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedSource(cat.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded border text-sm font-semibold transition-colors",
                selectedSource === cat.id 
                  ? "bg-slate-900 border-slate-900 text-white" 
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              )}
            >
              {cat.label}
              <span className={cn(
                "text-xs px-1.5 py-0.5 rounded",
                selectedSource === cat.id ? "bg-slate-700 text-slate-200" : "bg-slate-100 text-slate-500"
              )}>
                {catCounts[cat.id as keyof typeof catCounts] || 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50/50 flex flex-col md:flex-row gap-4 border-b border-slate-100">
           <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari Produk atau Locator..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none"
            />
          </div>
          <select value={selectedLocator} onChange={(e) => setSelectedLocator(e.target.value)} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm">
            <option value="ALL">Semua Locator</option>
            {uniqueLocators.map(loc => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
             <CalendarIcon className="w-4 h-4 text-slate-400" />
             <input 
               type="date" 
               value={selectedDate} 
               onChange={e => {
                 setSelectedDate(e.target.value);
                 setShouldReconcile(true);
               }} 
               className="bg-transparent border-none text-xs font-bold focus:ring-0 cursor-pointer"
             />
           </div>
        </div>
        
        {error && (
          <div className="mx-4 mb-4 p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-3 text-rose-700 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="font-medium">{error}</p>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
             <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Produk</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Locator</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Stok Kemarin</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Mutasi IN</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Mutasi OUT</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Input Area</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Sistem MTS</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Selisih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
               {dataLoading ? (
                 <tr><td colSpan={8} className="py-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" /></td></tr>
               ) : paginated.length === 0 ? (
                 <tr><td colSpan={8} className="py-12 text-center text-slate-500">Tidak ada data untuk direkonsiliasi</td></tr>
               ) : (
                 paginated.map((s, idx) => (
                   <tr key={idx} className="hover:bg-slate-50 transition-colors">
                     <td className="px-6 py-4">
                       <div className="flex flex-col">
                         <span className="text-sm font-bold text-slate-900">{s.namaProduk}</span>
                         <span className="text-[10px] font-mono text-slate-400">{s.kodeProduk}</span>
                       </div>
                     </td>
                     <td className="px-6 py-4 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">{s.whGroup}</span>
                     </td>
                     <td className="px-4 py-4 text-center font-medium text-slate-400">{s.stokKemarin.toLocaleString()}</td>
                     <td className="px-4 py-4 text-center font-bold text-emerald-600">+{s.mutasiIn.toLocaleString()}</td>
                     <td className="px-4 py-4 text-center font-bold text-rose-600">-{s.mutasiOut.toLocaleString()}</td>
                     <td className="px-4 py-4 text-center font-bold text-blue-600 underline decoration-blue-100 underline-offset-4">{s.stock.toLocaleString()}</td>
                     <td className="px-4 py-4 text-center font-bold text-slate-600 bg-slate-50/50">{s.qtySistem?.toLocaleString()}</td>
                     <td className="px-6 py-4 text-center">
                        <span className={cn("inline-flex px-3 py-1 rounded-xl text-sm font-bold", s.selisih === 0 ? "text-emerald-600 bg-emerald-50" : "bg-rose-50 text-rose-700")}>
                           {s.selisih > 0 ? `+${s.selisih.toLocaleString()}` : s.selisih.toLocaleString()}
                        </span>
                     </td>
                   </tr>
                 ))
               )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default memo(PencocokanData);
