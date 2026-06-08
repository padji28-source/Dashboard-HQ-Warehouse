import { useEffect, useState, useMemo } from 'react';
import { fetchSheetData } from '../lib/sheets';
import type { Transaction, Product, Locator, StockSummary } from '../types';
import { Loader2, Search, Package, ArrowRightLeft, Layers } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function StockOverview({ spreadsheetId, area }: { spreadsheetId: string; area: string }) {
  const [loading, setLoading] = useState(true);
  const [backgroundSyncing, setBackgroundSyncing] = useState(false);
  const [stockSummary, setStockSummary] = useState<StockSummary[]>([]);
  const [search, setSearch] = useState('');
  const [selectedSource, setSelectedSource] = useState('ALL');
  
  const [allTransactions, setAllTransactions] = useState<{tipe: string, pCode: string, pName: string, lCode: string, qty: number, source: string}[]>([]);
  const [productsMap, setProductsMap] = useState<Map<string, string>>(new Map());
  const [locatorsMap, setLocatorsMap] = useState<Map<string, { nama: string; whType: string; area: string }>>(new Map());

  const loadData = async (retryOnMissing = true) => {
    const ranges = [
      "'INPUT'!A:J",
      "'INPUT RM'!A:J",
      "'INPUT MFG'!A:J",
      "'INPUT SUPPLIES'!A:J",
      "'MASTER_PRODUK'!A:B",
      "'MASTER_LOCATOR'!A:E"
    ];

    // Helper to get storage key
    const getStorageKey = (r: string) => {
      const cleanUrl = spreadsheetId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
      return `erp_cache_${cleanUrl}_${r.replace(/[^a-zA-Z0-9]/g, '_')}`;
    };

    // Check if we have localStorage cache for all ranges
    let hasLocalCache = true;
    const cachedDataMap: Record<string, any[][]> = {};
    for (const r of ranges) {
      try {
        const cachedItem = localStorage.getItem(getStorageKey(r));
        if (cachedItem) {
          const parsed = JSON.parse(cachedItem);
          if (parsed && Array.isArray(parsed.data)) {
            cachedDataMap[r] = parsed.data;
          } else {
            hasLocalCache = false;
            break;
          }
        } else {
          hasLocalCache = false;
          break;
        }
      } catch (e) {
        hasLocalCache = false;
        break;
      }
    }

    // If cache exists, process and display it immediately
    if (hasLocalCache) {
      console.log("[SWR] Found complete local cache, displaying immediately...");
      const txRowsNormal = (cachedDataMap["'INPUT'!A:J"] || []).slice(1);
      const txRowsRM = (cachedDataMap["'INPUT RM'!A:J"] || []).slice(1);
      const txRowsMfg = (cachedDataMap["'INPUT MFG'!A:J"] || []).slice(1);
      const txRowsSupplies = (cachedDataMap["'INPUT SUPPLIES'!A:J"] || []).slice(1);
      const pRows = (cachedDataMap["'MASTER_PRODUK'!A:B"] || []).slice(1);
      const lRows = (cachedDataMap["'MASTER_LOCATOR'!A:E"] || []).slice(1);

      const pMap = new Map<string, string>(pRows.filter((r: any[]) => r.length > 0 && r[0]).map((r: any[]) => [String(r[0]).trim(), String(r[1]).trim()]));
      const lMap = new Map<string, { nama: string; whType: string; area: string }>();
      lRows.filter((r: any[]) => r.length > 0 && r[0]).forEach((r: any[]) => {
        const rawKey = String(r[0]).trim();
        const keyUpper = rawKey.toUpperCase();
        lMap.set(rawKey, {
          nama: String(r[1] || r[0]).trim(),
          whType: String(r[3] || '').trim(),
          area: String(r[4] || '').trim()
        });
        lMap.set(keyUpper, {
          nama: String(r[1] || r[0]).trim(),
          whType: String(r[3] || '').trim(),
          area: String(r[4] || '').trim()
        });
      });
      
      const mappedRows: {tipe: string, pCode: string, pName: string, lCode: string, qty: number, source: string}[] = [];
      const processRows = (rows: any[], source: string) => {
        const validRows = (rows || []).filter((r: any[]) => r.length > 0 && (r[0] || r[1] || r[9]));
        validRows.forEach((r: any[]) => {
           const pName = String(r[1] || '').trim();
           let pCode = String(r[9] || '').trim();
           const tipe = String(r[4] || '').trim().toUpperCase();
           if (!pName && !pCode) return;
           if (!pCode) pCode = pName;
           const qtyStr = String(r[2] || '0').replace(',', '.');
           let qty = parseFloat(qtyStr) || 0;
           if (isNaN(qty)) qty = 0;
           let fromLocator = String(r[5] || '').trim();
           let toLocator = String(r[6] || '').trim();
           if (!fromLocator && !toLocator) fromLocator = 'UNKNOWN_L';

           if (tipe === 'TRANSFER' || tipe === 'TF') {
             mappedRows.push({ tipe: 'OUT', pCode, pName, lCode: fromLocator || 'UNKNOWN_L', qty, source });
             mappedRows.push({ tipe: 'IN', pCode, pName, lCode: toLocator || 'UNKNOWN_L', qty, source });
           } else {
             mappedRows.push({ tipe: tipe || 'IN', pCode, pName, lCode: fromLocator || toLocator || 'UNKNOWN_L', qty, source });
           }
        });
      };

      processRows(txRowsNormal, 'INPUT');
      processRows(txRowsRM, 'INPUT RM');
      processRows(txRowsMfg, 'INPUT MFG');
      processRows(txRowsSupplies, 'INPUT SUPPLIES');

      setProductsMap(pMap);
      setLocatorsMap(lMap);
      setAllTransactions(mappedRows);
      
      // Stop blocking spinner!
      setLoading(false);
      // Indicate we are syncing in background
      setBackgroundSyncing(true);
    } else {
      // No cache, we must block with loading spinner
      setLoading(true);
    }

    try {
      let txRowsNormalRaw: any[] = [];
      let txRowsRMRaw: any[] = [];
      let txRowsMfgRaw: any[] = [];
      let txRowsSuppliesRaw: any[] = [];
      let pRowsRaw: any[] = [];
      let lRowsRaw: any[] = [];

      try {
        [txRowsNormalRaw, txRowsRMRaw, txRowsMfgRaw, txRowsSuppliesRaw, pRowsRaw, lRowsRaw] = await Promise.all([
          fetchSheetData(spreadsheetId, "'INPUT'!A:J", true),
          fetchSheetData(spreadsheetId, "'INPUT RM'!A:J", true),
          fetchSheetData(spreadsheetId, "'INPUT MFG'!A:J", true),
          fetchSheetData(spreadsheetId, "'INPUT SUPPLIES'!A:J", true),
          fetchSheetData(spreadsheetId, "'MASTER_PRODUK'!A:B", true),
          fetchSheetData(spreadsheetId, "'MASTER_LOCATOR'!A:E", true)
        ]);
      } catch (fetchErr: any) {
        if (retryOnMissing) {
          console.log("StockOverview missing sheet, compiling or trying auto-init...");
          try {
            const { initializeERPSpreadsheet } = await import('../lib/sheets');
            await initializeERPSpreadsheet(spreadsheetId);
            return loadData(false);
          } catch (initErr) {
            console.error("Auto-init from StockOverview failed:", initErr);
          }
        }
        // Fallback to individual catches if init fails or retry is off
        txRowsNormalRaw = await fetchSheetData(spreadsheetId, "'INPUT'!A:J", true).catch(() => []);
        txRowsRMRaw = await fetchSheetData(spreadsheetId, "'INPUT RM'!A:J", true).catch(() => []);
        txRowsMfgRaw = await fetchSheetData(spreadsheetId, "'INPUT MFG'!A:J", true).catch(() => []);
        txRowsSuppliesRaw = await fetchSheetData(spreadsheetId, "'INPUT SUPPLIES'!A:J", true).catch(() => []);
        pRowsRaw = await fetchSheetData(spreadsheetId, "'MASTER_PRODUK'!A:B", true).catch(() => []);
        lRowsRaw = await fetchSheetData(spreadsheetId, "'MASTER_LOCATOR'!A:E", true).catch(() => []);
      }

      // Save raw data (including headers as a complete representation) to localStorage
      const saveData = (r: string, data: any[][]) => {
        try {
          localStorage.setItem(getStorageKey(r), JSON.stringify({ timestamp: Date.now(), data }));
        } catch (e) {
          console.warn("Failed saving cache to localStorage:", e);
        }
      };

      saveData("'INPUT'!A:J", txRowsNormalRaw);
      saveData("'INPUT RM'!A:J", txRowsRMRaw);
      saveData("'INPUT MFG'!A:J", txRowsMfgRaw);
      saveData("'INPUT SUPPLIES'!A:J", txRowsSuppliesRaw);
      saveData("'MASTER_PRODUK'!A:B", pRowsRaw);
      saveData("'MASTER_LOCATOR'!A:E", lRowsRaw);

      // Slice out the first line from each raw spreadsheet, which contains headers
      const txRowsNormal = txRowsNormalRaw.slice(1);
      const txRowsRM = txRowsRMRaw.slice(1);
      const txRowsMfg = txRowsMfgRaw.slice(1);
      const txRowsSupplies = txRowsSuppliesRaw.slice(1);
      const pRows = pRowsRaw.slice(1);
      const lRows = lRowsRaw.slice(1);

      const pMap = new Map<string, string>(pRows.filter((r: any[]) => r.length > 0 && r[0]).map((r: any[]) => [String(r[0]).trim(), String(r[1]).trim()]));
      const lMap = new Map<string, { nama: string; whType: string; area: string }>();
      lRows.filter((r: any[]) => r.length > 0 && r[0]).forEach((r: any[]) => {
        const rawKey = String(r[0]).trim();
        const keyUpper = rawKey.toUpperCase();
        lMap.set(rawKey, {
          nama: String(r[1] || r[0]).trim(),
          whType: String(r[3] || '').trim(),
          area: String(r[4] || '').trim()
        });
        lMap.set(keyUpper, {
          nama: String(r[1] || r[0]).trim(),
          whType: String(r[3] || '').trim(),
          area: String(r[4] || '').trim()
        });
      });
      
      const mappedRows: {tipe: string, pCode: string, pName: string, lCode: string, qty: number, source: string}[] = [];
      const processRows = (rows: any[], source: string) => {
        const validRows = (rows || []).filter((r: any[]) => r.length > 0 && (r[0] || r[1] || r[9]));
        validRows.forEach((r: any[]) => {
           const pName = String(r[1] || '').trim();
           let pCode = String(r[9] || '').trim();
           const tipe = String(r[4] || '').trim().toUpperCase();
           if (!pName && !pCode) return;
           if (!pCode) pCode = pName;
           const qtyStr = String(r[2] || '0').replace(',', '.');
           let qty = parseFloat(qtyStr) || 0;
           if (isNaN(qty)) qty = 0;
           let fromLocator = String(r[5] || '').trim();
           let toLocator = String(r[6] || '').trim();
           if (!fromLocator && !toLocator) fromLocator = 'UNKNOWN_L';

           if (tipe === 'TRANSFER' || tipe === 'TF') {
             mappedRows.push({ tipe: 'OUT', pCode, pName, lCode: fromLocator || 'UNKNOWN_L', qty, source });
             mappedRows.push({ tipe: 'IN', pCode, pName, lCode: toLocator || 'UNKNOWN_L', qty, source });
           } else {
             mappedRows.push({ tipe: tipe || 'IN', pCode, pName, lCode: fromLocator || toLocator || 'UNKNOWN_L', qty, source });
           }
        });
      };

      processRows(txRowsNormal, 'INPUT');
      processRows(txRowsRM, 'INPUT RM');
      processRows(txRowsMfg, 'INPUT MFG');
      processRows(txRowsSupplies, 'INPUT SUPPLIES');

      setProductsMap(pMap);
      setLocatorsMap(lMap);
      setAllTransactions(mappedRows);
    } catch (err: any) {
      console.error("Background sync error:", err);
      if (!hasLocalCache) {
        alert(`Gagal memuat overview stok: ${err.message}`);
      }
    } finally {
      setLoading(false);
      setBackgroundSyncing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [spreadsheetId]);

  useEffect(() => {
    const stockMap = new Map<string, StockSummary>(); // Key: kodeProduk_whGroup

    allTransactions.forEach((t) => {
      if (selectedSource !== 'ALL' && t.source !== selectedSource) return;

      const { tipe, pCode, pName, lCode, qty } = t;
      const key = `${pCode}_${lCode}`;
      if (!stockMap.has(key)) {
        const lookupKey = lCode.trim();
        const lData = locatorsMap.get(lookupKey) || locatorsMap.get(lookupKey.toUpperCase()) || { nama: lCode, whType: '', area: '' };
        stockMap.set(key, {
          kodeProduk: pCode === pName ? '' : pCode,
          namaProduk: productsMap.get(pCode) || pName || pCode,
          whGroup: lCode,
          namaLocator: lData.nama,
          whType: lData.whType,
          area: lData.area,
          totalIn: 0,
          totalOut: 0,
          stock: 0
        });
      }
      
      const summary = stockMap.get(key)!;
      const normalizedTipe = tipe.replace(/\s+/g, '');
      if (normalizedTipe === 'IN' || normalizedTipe === 'AWAL' || normalizedTipe === 'MASUK' || normalizedTipe === 'RECEIPT' || normalizedTipe === 'SALDOAWAL') {
        summary.totalIn += qty;
        summary.stock += qty;
      } else if (normalizedTipe === 'OUT' || normalizedTipe === 'KELUAR' || normalizedTipe === 'ISSUE' || normalizedTipe === 'PEMAKAIAN') {
        summary.totalOut += qty;
        summary.stock -= qty;
      } else {
        // Assume anything else with a positive locator is an IN unless it's known to be OUT?
        // Actually, just add it to totalIn as a fallback if qty > 0 so it's not lost
        if (qty > 0 && !['TRANSFER', 'TF'].includes(normalizedTipe)) {
           // We only get here if type wasn't recognized at all.
           summary.totalIn += qty;
           summary.stock += qty;
        }
      }
    });
    
    console.log("Stock map size:", stockMap.size);

    const filteredByArea = Array.from(stockMap.values()).filter(s => {
      const hasActivity = s.totalIn > 0 || s.totalOut > 0 || s.stock !== 0;
      if (!hasActivity) return false;
      
      if (area) {
        const sArea = (s.area || '').trim().toLowerCase();
        const areaLower = area.trim().toLowerCase();

        // 1. Check exact or substring area match (e.g. "Area Jakarta" matches "Jakarta")
        const matchesAreaString = sArea !== '' && (sArea === areaLower || sArea.includes(areaLower) || areaLower.includes(sArea));
        if (matchesAreaString) {
          return true;
        }
        
        // 2. Check prefix or substring matches based on locator code (e.g. "PSN-JKT C1" counts as Jakarta)
        const locCode = s.whGroup.trim().toUpperCase();
        
        const areaPrefixes: Record<string, string[]> = {
          'jakarta': ['JKT', 'JAK'],
          'karawang': ['KRW', 'KWG', 'KAR'],
          'semarang': ['SMG', 'SEM'],
          'surabaya': ['SUB', 'SBY', 'SUR'],
          'jember': ['JMB', 'JEM'],
          'makassar': ['MKS', 'MAK'],
          'pontianak': ['PTN', 'PON'],
          'banjarmasin': ['BJM', 'BAN'],
          'palembang': ['PLB', 'PAL'],
          'medan': ['MDN', 'MED'],
          'pekanbaru': ['PKU', 'PEK']
        };
        
        const prefixes = areaPrefixes[areaLower] || [areaLower.substring(0, 3).toUpperCase()];
        const matchesPrefix = prefixes.some(pref => locCode.startsWith(pref) || locCode.includes(pref));
        if (matchesPrefix) return true;

        // If the locator's area field is explicitly set to some other area, exclude it
        if (s.area && !matchesAreaString) {
          return false;
        }

        // Fallback: keep locator if it has no area metadata
        if (!s.area) return true;

        return false;
      }

      return true;
    });

    setStockSummary(filteredByArea);
  }, [allTransactions, productsMap, locatorsMap, selectedSource, area]);

  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLocator, setSelectedLocator] = useState('');

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedLocator]);

  useEffect(() => {
    // Reset selectedLocator if it's no longer valid for the newly filtered stockSummary
    if (selectedLocator && !stockSummary.some(s => s.whGroup === selectedLocator)) {
      setSelectedLocator('');
    }
  }, [stockSummary, selectedLocator]);

  const uniqueLocators = useMemo(() => Array.from(new Map<string, { whGroup: string; nama: string; }>(stockSummary.map(s => [s.whGroup, { whGroup: s.whGroup, nama: s.namaLocator }])).values()).sort((a,b) => a.whGroup.localeCompare(b.whGroup)), [stockSummary]);

  const filtered = stockSummary.filter(s => {
    const matchSearch = s.kodeProduk.toLowerCase().includes(search.toLowerCase()) || 
      s.namaProduk.toLowerCase().includes(search.toLowerCase()) ||
      s.whGroup.toLowerCase().includes(search.toLowerCase()) ||
      s.namaLocator.toLowerCase().includes(search.toLowerCase());
    
    const matchLocator = selectedLocator === '' || s.whGroup === selectedLocator;

    return matchSearch && matchLocator;
  });

  const topItems = useMemo(() => {
    // combine by product for chart
    const byProduct = new Map<string, {name: string, stock: number}>();
    stockSummary.forEach(s => {
      const existing = byProduct.get(s.kodeProduk);
      if (existing) existing.stock += s.stock;
      else byProduct.set(s.kodeProduk, { name: s.namaProduk, stock: s.stock });
    });
    return Array.from(byProduct.values())
      .sort((a,b) => b.stock - a.stock)
      .slice(0, 10)
      .map(d => ({ ...d, name: d.name.length > 15 ? d.name.substring(0,15) + '...' : d.name }));
  }, [stockSummary]);

  const topOutItems = useMemo(() => {
    // combine by product for chart based on total OUT
    const byProduct = new Map<string, {name: string, totalOut: number}>();
    stockSummary.forEach(s => {
      if (s.totalOut > 0) {
        const existing = byProduct.get(s.kodeProduk);
        if (existing) existing.totalOut += s.totalOut;
        else byProduct.set(s.kodeProduk, { name: s.namaProduk, totalOut: s.totalOut });
      }
    });
    return Array.from(byProduct.values())
      .sort((a,b) => b.totalOut - a.totalOut)
      .slice(0, 10)
      .map(d => ({ ...d, name: d.name.length > 15 ? d.name.substring(0,15) + '...' : d.name }));
  }, [stockSummary]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const totalInFiltered = filtered.reduce((acc, s) => acc + s.totalIn, 0);
  const totalOutFiltered = filtered.reduce((acc, s) => acc + s.totalOut, 0);
  const stockRillFiltered = filtered.reduce((acc, s) => acc + s.stock, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Stock per WH Group</h2>
          <p className="text-sm text-slate-500">Peta ketersediaan barang pada setiap warehouse.</p>
        </div>
        <div className="flex items-center gap-3">
          {backgroundSyncing && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full animate-pulse shrink-0 shadow-sm">
              <Loader2 style={{ height: '0.75rem' }} className="w-3 animate-spin text-amber-500" />
              <span>Sinkronisasi data terbaru...</span>
            </div>
          )}
          {!backgroundSyncing && !loading && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full shrink-0 shadow-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Data sinkron</span>
            </div>
          )}
          <button onClick={() => loadData()} className="px-4 py-2 border border-slate-200 bg-white rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm shrink-0">
            Refresh Data
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="border border-slate-200 bg-white rounded-xl p-6 flex items-center gap-4 shadow-sm">
            <div className="w-12 h-12 bg-blue-50 border border-blue-100 rounded-full flex items-center justify-center shrink-0">
               <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
               {(() => {
                 const total = stockSummary.reduce((acc, s) => acc + s.stock, 0);
                 return (
                   <h3 className={cn(
                     "text-2xl font-bold tracking-tight text-slate-900",
                     total < 0 && "text-rose-600"
                   )}>
                     {total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                   </h3>
                 );
               })()}
               <p className="text-sm font-medium text-slate-500">Total Kuantitas Global</p>
            </div>
        </div>

        <div className="border border-slate-200 bg-white rounded-xl p-6 flex items-center gap-4 shadow-sm">
            <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 rounded-full flex items-center justify-center shrink-0">
               <Layers className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
               <h3 className="text-2xl font-bold tracking-tight text-slate-900">
                 {stockSummary.length.toLocaleString()}
               </h3>
               <p className="text-sm font-medium text-slate-500">Total SKU (Items)</p>
            </div>
        </div>

        <div className="border border-slate-200 bg-white rounded-xl p-6 flex items-center gap-4 shadow-sm sm:col-span-2 lg:col-span-1">
            <div className="w-12 h-12 bg-rose-50 border border-rose-100 rounded-full flex items-center justify-center shrink-0">
               <ArrowRightLeft className="w-5 h-5 text-rose-600" />
            </div>
            <div>
               {(() => {
                 const totalOut = stockSummary.reduce((acc, s) => acc + s.totalOut, 0);
                 return (
                   <h3 className="text-2xl font-bold tracking-tight text-rose-600">
                     {totalOut.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                   </h3>
                 );
               })()}
               <p className="text-sm font-medium text-slate-500">Total Transaksi Out (Qty)</p>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Top 10 Stok Terbanyak */}
        <div className="border border-slate-200 bg-white rounded-xl p-6 h-[380px] shadow-sm flex flex-col">
           <div className="mb-4">
             <h3 className="text-base font-semibold text-slate-900">Top 10 Stok Terbanyak</h3>
             <p className="text-xs text-slate-500">Berdasarkan total kuantitas tersisa per item</p>
           </div>
           <div className="flex-1 w-full min-h-0">
             {loading ? (
               <div className="h-full flex items-center justify-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin"/></div>
             ) : (
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topItems} margin={{ top: 10, right: 10, bottom: 25, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis 
                      dataKey="name" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false} 
                      tick={{fill: '#64748b'}} 
                      tickMargin={12} 
                      interval={0} 
                      angle={-25} 
                      textAnchor="end" 
                      height={65} 
                    />
                    <YAxis 
                      type="number" 
                      fontSize={11} 
                      tickLine={false} 
                      axisLine={false} 
                      tick={{fill: '#64748b'}} 
                      tickFormatter={(value) => value.toLocaleString()} 
                      width={50} 
                    />
                    <Tooltip 
                      cursor={{ fill: '#F8FAFC' }} 
                      contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} 
                      formatter={(value: number) => [value.toLocaleString(), 'Stok']}
                    />
                    <Bar dataKey="stock" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={32} name="Stok" />
                  </BarChart>
                </ResponsiveContainer>
             )}
           </div>
        </div>

        {/* Chart 2: Top 10 Transaksi Out Terbanyak */}
        <div className="border border-slate-200 bg-white rounded-xl p-6 h-[380px] shadow-sm flex flex-col">
           <div className="mb-4">
             <h3 className="text-base font-semibold text-slate-900">Top 10 Transaksi Out Terbanyak</h3>
             <p className="text-xs text-slate-500">Berdasarkan akumulasi kuantitas pengeluaran (OUT)</p>
           </div>
           <div className="flex-1 w-full min-h-0">
             {loading ? (
               <div className="h-full flex items-center justify-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin"/></div>
             ) : (
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topOutItems} margin={{ top: 10, right: 10, bottom: 25, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis 
                      dataKey="name" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false} 
                      tick={{fill: '#64748b'}} 
                      tickMargin={12} 
                      interval={0} 
                      angle={-25} 
                      textAnchor="end" 
                      height={65} 
                    />
                    <YAxis 
                      type="number" 
                      fontSize={11} 
                      tickLine={false} 
                      axisLine={false} 
                      tick={{fill: '#64748b'}} 
                      tickFormatter={(value) => value.toLocaleString()} 
                      width={50} 
                    />
                    <Tooltip 
                      cursor={{ fill: '#F5F5F5' }} 
                      contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} 
                      formatter={(value: number) => [value.toLocaleString(), 'Kuantitas Out']}
                    />
                    <Bar dataKey="totalOut" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={32} name="Qty Out" />
                  </BarChart>
                </ResponsiveContainer>
             )}
           </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
           <h3 className="font-semibold text-slate-900 hidden sm:block">Rincian Stok</h3>
           <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
             <select 
               value={selectedSource} 
               onChange={e => setSelectedSource(e.target.value)} 
               className="w-full sm:w-auto px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
             >
               <option value="ALL">Semua Data</option>
               <option value="INPUT">Accessories</option>
               <option value="INPUT RM">Raw Material</option>
               <option value="INPUT MFG">Manufacturing</option>
               <option value="INPUT SUPPLIES">Supplies & GA</option>
             </select>
             <select 
               value={selectedLocator} 
               onChange={e => setSelectedLocator(e.target.value)} 
               className="w-full sm:w-auto px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
             >
               <option value="">Semua Locator</option>
               {uniqueLocators.map(l => <option key={l.whGroup} value={l.whGroup}>{l.nama || l.whGroup}</option>)}
             </select>
             <div className="relative w-full sm:w-64">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
               <input type="text" placeholder="Cari nama, produk, WH Group..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
             </div>
           </div>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 flex justify-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : (<>
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="px-5 py-4 font-medium">Locator</th>
                  <th className="px-5 py-4 font-medium">Nama Produk</th>
                  <th className="px-5 py-4 font-medium text-right">In</th>
                  <th className="px-5 py-4 font-medium text-right">Out</th>
                  <th className="px-5 py-4 font-semibold text-slate-900 text-right">Stok Rill</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginated.map((s, idx) => (
                  <tr key={idx} className="hover:bg-blue-50/40 transition-colors text-slate-700">
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-900">{s.namaLocator}</div>
                      <div className="text-xs text-slate-500 mt-0.5 font-mono">
                         {s.whGroup}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-900">{s.namaProduk}</div>
                      <div className="text-xs text-slate-500 mt-0.5 font-mono">{s.kodeProduk}</div>
                    </td>
                    <td className="px-5 py-4 text-right text-emerald-600 font-medium">
                      {s.totalIn > 0 ? `+${s.totalIn.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-5 py-4 text-right text-rose-600 font-medium">
                      {s.totalOut > 0 ? `-${s.totalOut.toLocaleString()}` : '-'}
                    </td>
                    <td className={cn(
                      "px-5 py-4 text-right font-semibold text-base",
                      s.stock < 0 ? "text-rose-600" : "text-slate-900"
                    )}>
                      {s.stock.toLocaleString()}
                    </td>
                  </tr>
                ))}
                {filtered.length > 0 && (
                  <tr className="bg-slate-50 font-semibold border-t-2 border-slate-200 text-slate-900 sticky bottom-0 z-10 shadow-[0_-1px_0_rgba(0,0,0,0.05)]">
                    <td className="px-5 py-4 text-slate-800" colSpan={2}>Grand Total (Filtered)</td>
                    <td className="px-5 py-4 text-right text-emerald-700 font-bold">
                      {totalInFiltered > 0 ? `+${totalInFiltered.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-5 py-4 text-right text-rose-700 font-bold">
                      {totalOutFiltered > 0 ? `-${totalOutFiltered.toLocaleString()}` : '-'}
                    </td>
                    <td className={cn(
                      "px-5 py-4 text-right font-bold text-lg",
                      stockRillFiltered < 0 ? "text-rose-600" : "text-blue-600"
                    )}>
                      {stockRillFiltered.toLocaleString()}
                    </td>
                  </tr>
                )}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="p-12 text-center text-slate-500">Tidak ada data stok ditemukan.</td></tr>
                )}
              </tbody>
            </table>
            
            {filtered.length > 0 && (
              <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50 rounded-b-xl">
                 <div className="flex items-center gap-2 text-sm text-slate-500">
                   <select 
                     value={pageSize} 
                     onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                     className="border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                   >
                     <option value={10}>10 Baris</option>
                     <option value={50}>50 Baris</option>
                     <option value={100}>100 Baris</option>
                     <option value={10000}>Semua</option>
                   </select>
                   <span>Menampilkan {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filtered.length)} dari {filtered.length} data</span>
                 </div>
                 <div className="flex items-center gap-2">
                   <button 
                     onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                     disabled={currentPage === 1}
                     className="px-3 py-1.5 border border-slate-200 rounded-md bg-white text-sm font-medium text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-colors"
                   >
                     Sebelumnya
                   </button>
                   <button 
                     onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                     disabled={currentPage === totalPages || totalPages === 0}
                     className="px-3 py-1.5 border border-slate-200 rounded-md bg-white text-sm font-medium text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-colors"
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
