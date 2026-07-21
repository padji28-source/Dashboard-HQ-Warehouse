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
  AlertCircle,
} from "lucide-react";
import { useData } from '../context/DataContext';

function CekStock({ spreadsheetId, area }: { spreadsheetId: string; area: string }) {
  const { transactions: allTransactions, productsMap, locatorsMap, loading: dataLoading, refreshData } = useData();
  const [loading, setLoading] = useState(false);
  const [groupedStock, setGroupedStock] = useState<any[]>([]);
  const [uniqueLocators, setUniqueLocators] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedArea, setSelectedArea] = useState<string>("ALL");
  const [selectedSource, setSelectedSource] = useState<string>("ALL");
  const [shouldRecalculate, setShouldRecalculate] = useState(false);

  const calculatePivot = (txs: any[], pMap: Map<string, any>) => {
    const stockMap = new Map<string, any>();
    const locSet = new Set<string>();
    
    txs.forEach(t => {
      const { pCode, pName, lCode, qty, tipe, area: rowArea, source } = t;
      if (selectedSource !== "ALL" && source !== selectedSource) return;
      if (selectedArea !== "ALL" && rowArea !== selectedArea) return;

      const pKey = pCode;
      const lKey = lCode.trim().toUpperCase();
      if (lKey) locSet.add(lKey);
      
      let summary = stockMap.get(pKey);
      if (!summary) {
        summary = {
          kodeProduk: pCode,
          namaProduk: typeof pMap.get(pCode) === 'string' ? pMap.get(pCode) : (pMap.get(pCode)?.nama || pName || pCode),
          locators: {} as Record<string, number>,
          total: 0
        };
        stockMap.set(pKey, summary);
      }

      if (!summary.locators[lKey]) summary.locators[lKey] = 0;

      const normalizedTipe = (tipe || '').replace(/\s+/g, "").toUpperCase();
      const isIN = normalizedTipe === "IN" || normalizedTipe.includes("AWAL") || normalizedTipe === "MASUK" || normalizedTipe === "RECEIPT";
      const isOUT = normalizedTipe === "OUT" || normalizedTipe === "KELUAR" || normalizedTipe === "ISSUE" || normalizedTipe === "PEMAKAIAN" || normalizedTipe === "TRANSFER" || normalizedTipe === "TF";

      if (isIN) {
        summary.locators[lKey] += qty;
        summary.total += qty;
      } else if (isOUT) {
        summary.locators[lKey] -= qty;
        summary.total -= qty;
      } else if (qty > 0) {
        summary.locators[lKey] += qty;
        summary.total += qty;
      }
    });

    const locArray = Array.from(locSet).sort();
    setUniqueLocators(locArray);
    setGroupedStock(Array.from(stockMap.values()));
  };

  const handleRefresh = async () => {
    setLoading(true);
    await refreshData(true);
    setShouldRecalculate(true);
    setLoading(false);
  };

  useEffect(() => {
    if (allTransactions.length > 0 && (groupedStock.length === 0 || shouldRecalculate)) {
      calculatePivot(allTransactions, productsMap);
      setShouldRecalculate(false);
    }
  }, [allTransactions, shouldRecalculate, groupedStock.length]);

  useEffect(() => {
    if (allTransactions.length > 0) {
      setShouldRecalculate(true);
    }
  }, [selectedSource, selectedArea]);

  const filtered = useMemo(() => {
    if (!search) return groupedStock;
    const term = search.toLowerCase();
    return groupedStock.filter(s => 
      s.kodeProduk.toLowerCase().includes(term) || 
      s.namaProduk.toLowerCase().includes(term)
    );
  }, [groupedStock, search]);

  const grandTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    let overall = 0;
    uniqueLocators.forEach(loc => totals[loc] = 0);
    
    filtered.forEach(s => {
      uniqueLocators.forEach(loc => {
        const qty = s.locators[loc] || 0;
        totals[loc] += qty;
      });
      overall += s.total;
    });
    
    return { perLocator: totals, overall };
  }, [filtered, uniqueLocators]);

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
              <h2 className="text-lg font-bold text-slate-900">Cek Stock Pivot</h2>
              <p className="text-sm text-slate-500">Ketersediaan stok per produk di setiap locator</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
             <button 
                onClick={handleRefresh}
                disabled={loading || dataLoading}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-black shadow-lg shadow-blue-100 transition-all disabled:opacity-50"
              >
                <RefreshCw className={cn("w-4 h-4", (loading || dataLoading) && "animate-spin")} />
                REFRESH DATA
              </button>
          </div>
        </div>

        <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari SKU atau Nama Produk..."
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
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest sticky left-0 bg-slate-50 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">Produk</th>
                {uniqueLocators.map(loc => (
                  <th key={loc} className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center min-w-[100px] border-l border-slate-100">
                    {loc}
                  </th>
                ))}
                <th className="px-6 py-4 text-[10px] font-black text-slate-700 uppercase tracking-widest text-center border-l border-slate-200 bg-slate-100 sticky right-0 z-10 shadow-[-2px_0_5px_rgba(0,0,0,0.05)]">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dataLoading ? (
                <tr>
                  <td colSpan={uniqueLocators.length + 3} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
                    <p className="text-sm text-slate-500 font-medium">Memuat data stok...</p>
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={uniqueLocators.length + 3} className="px-6 py-12 text-center text-slate-500">
                    Tidak ada data stok ditemukan
                  </td>
                </tr>
              ) : (
                paginated.map((s, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4 sticky left-0 bg-white group-hover:bg-slate-50 transition-colors z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate max-w-[250px]" title={s.namaProduk}>{s.namaProduk}</span>
                        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-tight">{s.kodeProduk}</span>
                      </div>
                    </td>
                    {uniqueLocators.map(loc => {
                      const qty = s.locators[loc] || 0;
                      return (
                        <td key={loc} className="px-4 py-4 text-center border-l border-slate-100 font-mono text-xs">
                          {qty !== 0 ? (
                            <span className={cn(
                              "font-bold",
                              qty > 0 ? "text-emerald-600" : "text-rose-600"
                            )}>
                              {qty.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-6 py-4 text-center border-l border-slate-200 bg-slate-50 font-black text-sm sticky right-0 z-10 shadow-[-2px_0_5px_rgba(0,0,0,0.05)]">
                      <div className={cn(
                        "inline-flex flex-col px-3 py-1 rounded-xl border min-w-[60px]",
                        s.total > 0 ? "bg-blue-50 text-blue-700 border-blue-100" : 
                        s.total < 0 ? "bg-rose-50 text-rose-700 border-rose-100" :
                        "bg-slate-50 text-slate-400 border-slate-100"
                      )}>
                        {s.total.toLocaleString()}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filtered.length > 0 && !dataLoading && (
              <tfoot className="bg-slate-100 font-black border-t-2 border-slate-200">
                <tr>
                  <td className="px-6 py-4 sticky left-0 bg-slate-100 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)] text-slate-700">
                    GRAND TOTAL
                  </td>
                  {uniqueLocators.map(loc => (
                    <td key={loc} className="px-4 py-4 text-center border-l border-slate-200 font-mono text-[11px] text-slate-900">
                      {grandTotals.perLocator[loc].toLocaleString()}
                    </td>
                  ))}
                  <td className="px-6 py-4 text-center border-l border-slate-300 bg-blue-100 text-blue-900 text-sm font-black sticky right-0 z-10 shadow-[-2px_0_5px_rgba(0,0,0,0.05)]">
                    {grandTotals.overall.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            )}
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
