import { useEffect, useState, useMemo, useRef, memo} from "react";
import type { StockSummary } from "../types";
import {
  Loader2,
  Search,
  Package,
  ArrowRightLeft,
  Layers,
  ArrowUpRight,
  ChevronDown,
  X,
  RefreshCw,
  Clock,
  Activity,
  AlertTriangle,
} from "lucide-react";
import { useData } from '../context/DataContext';

function CekStock({ spreadsheetId, area }: { spreadsheetId: string; area: string }) {
  const { transactions: allTransactions, productsMap, locatorsMap, loading: dataLoading, refreshData } = useData();
  const [loading, setLoading] = useState(false);
  const [stockSummary, setStockSummary] = useState<StockSummary[]>([]);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedArea, setSelectedArea] = useState<string>("ALL");
  const [selectedSource, setSelectedSource] = useState<string>("ALL");

  const handleRefresh = async () => {
    setLoading(true);
    await refreshData(true);
    setLoading(false);
  };

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
        const lData = locatorsMap.get(lookupKey) || 
                     locatorsMap.get(lookupKey.toUpperCase()) || 
                     { nama: lCode, whType: '', area: rowArea };
        
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

      const normalizedTipe = (tipe || '').replace(/\s+/g, "").toUpperCase();
      const isIN = normalizedTipe === "IN" || normalizedTipe.includes("AWAL") || normalizedTipe === "MASUK" || normalizedTipe === "RECEIPT";
      const isOUT = normalizedTipe === "OUT" || normalizedTipe === "KELUAR" || normalizedTipe === "ISSUE" || normalizedTipe === "PEMAKAIAN" || normalizedTipe === "TRANSFER" || normalizedTipe === "TF";

      if (isIN) {
        summary.totalIn += qty;
        summary.stock += qty;
      } else if (isOUT) {
        summary.totalOut += qty;
        summary.stock -= qty;
      } else if (qty > 0) {
        summary.totalIn += qty;
        summary.stock += qty;
      }
    });

    setStockSummary(Array.from(stockMap.values()));
  }, [allTransactions, productsMap, locatorsMap, area, selectedSource, selectedArea]);

  const filtered = useMemo(() => {
    if (!search) return stockSummary;
    const term = search.toLowerCase();
    return stockSummary.filter(s => 
      s.kodeProduk.toLowerCase().includes(term) || 
      s.namaProduk.toLowerCase().includes(term) || 
      s.whGroup.toLowerCase().includes(term) || 
      s.namaLocator.toLowerCase().includes(term)
    );
  }, [stockSummary, search]);

  const paginated = useMemo(() => {
    return filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [filtered, currentPage, pageSize]);

  return (
    <div className="space-y-6 max-w-full">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Cek Stock Real-time</h2>
              <p className="text-sm text-slate-500">Melihat ketersediaan stok di seluruh locator</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
             <button 
                onClick={handleRefresh}
                disabled={loading || dataLoading}
                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all disabled:opacity-50"
              >
                <RefreshCw className={cn("w-5 h-5", (loading || dataLoading) && "animate-spin")} />
              </button>
          </div>
        </div>

        <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari SKU, Nama Produk, atau Locator..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
          
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none cursor-pointer"
          >
            <option value="ALL">Semua Sumber</option>
            <option value="INPUT">Accessories</option>
            <option value="INPUT RM">Raw Material</option>
            <option value="INPUT MFG">Manufacturing</option>
            <option value="INPUT SUPPLIES">Supplies</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Produk</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Locator</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Masuk</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Keluar</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Stok Akhir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dataLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
                    <p className="text-sm text-slate-500 font-medium">Memuat data stok...</p>
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    Tidak ada data stok ditemukan
                  </td>
                </tr>
              ) : (
                paginated.map((s, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{s.namaProduk}</span>
                        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-tight">{s.kodeProduk}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-slate-100 text-slate-600 border border-slate-200">
                          {s.whGroup}
                        </span>
                        <span className="text-[10px] text-slate-400 mt-1">{s.namaLocator}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-bold text-emerald-600">+{s.totalIn.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-bold text-rose-600">-{s.totalOut.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className={cn(
                        "inline-flex flex-col px-3 py-1 rounded-xl border font-bold text-sm min-w-[60px]",
                        s.stock > 0 ? "bg-blue-50 text-blue-700 border-blue-100" : 
                        s.stock < 0 ? "bg-rose-50 text-rose-700 border-rose-100" :
                        "bg-slate-50 text-slate-400 border-slate-100"
                      )}>
                        {s.stock.toLocaleString()}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > pageSize && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-500 font-medium">
              Menampilkan {(currentPage - 1) * pageSize + 1} sampai {Math.min(currentPage * pageSize, filtered.length)} dari {filtered.length} baris
            </p>
            <div className="flex gap-2">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-xs font-bold border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                Prev
              </button>
              <button 
                onClick={() => setCurrentPage(prev => prev + 1)}
                disabled={currentPage * pageSize >= filtered.length}
                className="px-3 py-1 text-xs font-bold border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}

export default memo(CekStock);
