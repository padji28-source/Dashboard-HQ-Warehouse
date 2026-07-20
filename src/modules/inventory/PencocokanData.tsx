import { useEffect, useState, useMemo, useRef , memo} from "react";
import { Loader2, Search, Scale, CheckCircle2, AlertTriangle, RefreshCw, Undo, Lock, History, FileSpreadsheet, Info, Calendar, Trash2, Check, X } from 'lucide-react';
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

function PencocokanData({ spreadsheetId, area }: { spreadsheetId: string; area: string }) {
  const { transactions: allTransactions, productsMap, locatorsMap, loading: dataLoading, refreshData } = useData();
  const [loading, setLoading] = useState(false);
  const [activeStocks, setActiveStocks] = useState<StockSummary[]>([]);
  const [mtsMap, setMtsMap] = useState<Map<string, number>>(new Map());
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSource, setSelectedSource] = useState("ALL");
  const [selectedArea, setSelectedArea] = useState<string>("ALL");

  const handleRefresh = async () => {
    setLoading(true);
    await refreshData(true);
    setLoading(false);
  };

  useEffect(() => {
     const loadMts = async () => {
        const mtsMapLocal = new Map<string, number>();
        try {
            const dataMts = await fetchAndParseCSV<string[]>('/api/stock-summary', false, 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSbvA_5FOxi2-nkfz8iJbptOhDfBCLM5LnTwrVLeJ4pf1hlGjSBywsTXQYYtEjuo0DY2M63wcJmc0tP/pub?gid=263347272&single=true&output=csv');
              
              if (dataMts.length > 0) {
                let headerIndex = 0;
                for (let i = 0; i < Math.min(10, dataMts.length); i++) {
                  if (dataMts[i].filter(v => v).length > 3) { headerIndex = i; break; }
                }
                const rawHeaders = dataMts[headerIndex] || [];
                const colLoc = rawHeaders.findIndex(h => h.toLowerCase().includes('locator'));
                const colSku = rawHeaders.findIndex(h => h.toLowerCase().includes('sku') || h.toLowerCase().includes('produk'));
                const colName = rawHeaders.findIndex(h => h.toLowerCase().includes('nama') || h.toLowerCase() === 'name');
                const colLastQty = rawHeaders.findIndex(h => h.toLowerCase().includes('last qty') || h.toLowerCase().includes('sistem'));

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
          } catch (err) { console.error(err); }
          setMtsMap(mtsMapLocal);
      };
      loadMts();
  }, []);

  useEffect(() => {
    const stockMap = new Map<string, StockSummary>();
    
    allTransactions.forEach(t => {
      const { pCode, pName, lCode, qty, tipe, area: rowArea, source } = t;
      if (selectedSource !== "ALL" && source !== selectedSource) return;
      if (selectedArea !== "ALL" && rowArea !== selectedArea) return;

      const key = `${rowArea}_${lCode}_${pCode}`;
      let summary = stockMap.get(key);
      if (!summary) {
        const lookupKey = lCode.trim();
        const lData = locatorsMap.get(lookupKey) || locatorsMap.get(lookupKey.toUpperCase()) || { nama: lCode, whType: '', area: rowArea };
        summary = {
          kodeProduk: pCode,
          namaProduk: productsMap.get(pCode) || pName || pCode,
          whGroup: lCode,
          namaLocator: lData.nama,
          whType: lData.whType,
          area: rowArea || area,
          totalIn: 0,
          totalOut: 0,
          stock: 0
        };
        stockMap.set(key, summary);
      }

      const norm = (tipe || '').toUpperCase();
      if (norm === 'IN' || norm.includes('AWAL') || norm === 'RECEIPT') {
        summary.totalIn += qty;
        summary.stock += qty;
      } else if (norm === 'OUT' || norm === 'ISSUE' || norm === 'KELUAR') {
        summary.totalOut += qty;
        summary.stock -= qty;
      }
    });

    stockMap.forEach(s => {
       const pk = s.kodeProduk.toUpperCase();
       const nk = s.namaProduk.toUpperCase();
       const lk = s.whGroup.toUpperCase();
       s.qtySistem = mtsMap.get(`${pk}_${lk}`) || mtsMap.get(`${nk}_${lk}`) || 0;
       s.selisih = Math.round((s.stock - s.qtySistem) * 1000) / 1000;
    });

    setActiveStocks(Array.from(stockMap.values()));
  }, [allTransactions, productsMap, locatorsMap, area, selectedSource, selectedArea, mtsMap]);

  const filtered = useMemo(() => {
    return activeStocks.filter(s => {
      const term = search.toLowerCase();
      return s.namaProduk.toLowerCase().includes(term) || s.kodeProduk.toLowerCase().includes(term) || s.whGroup.toLowerCase().includes(term);
    });
  }, [activeStocks, search]);

  const paginated = useMemo(() => {
    return filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [filtered, currentPage, pageSize]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
           <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <Scale className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Pencocokan Data</h2>
              <p className="text-sm text-slate-500">Rekonsiliasi stok antara input area dan sistem MTS</p>
            </div>
          </div>
          <button onClick={handleRefresh} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <RefreshCw className={cn("w-5 h-5 text-slate-400", (loading || dataLoading) && "animate-spin")} />
          </button>
        </div>

        <div className="p-4 bg-slate-50/50 flex flex-col md:flex-row gap-4">
           <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari Produk atau Locator..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none"
            />
          </div>
          <select value={selectedSource} onChange={(e) => setSelectedSource(e.target.value)} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm">
            <option value="ALL">Semua Sumber</option>
            <option value="INPUT">Accessories</option>
            <option value="INPUT RM">Raw Material</option>
            <option value="INPUT MFG">Manufacturing</option>
            <option value="INPUT SUPPLIES">Supplies</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
             <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Produk</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Locator</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Input Area</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Sistem MTS</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Selisih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
               {dataLoading ? (
                 <tr><td colSpan={5} className="py-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" /></td></tr>
               ) : paginated.length === 0 ? (
                 <tr><td colSpan={5} className="py-12 text-center text-slate-500">Tidak ada data untuk direkonsiliasi</td></tr>
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
                     <td className="px-6 py-4 text-center font-bold text-blue-600">{s.stock.toLocaleString()}</td>
                     <td className="px-6 py-4 text-center font-bold text-slate-600">{s.qtySistem?.toLocaleString()}</td>
                     <td className="px-6 py-4 text-center">
                        <span className={cn("inline-flex px-2 py-1 rounded-lg text-sm font-bold", s.selisih === 0 ? "text-emerald-600" : "bg-rose-50 text-rose-700")}>
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
