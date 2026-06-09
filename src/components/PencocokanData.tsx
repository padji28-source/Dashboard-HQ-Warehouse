import { useEffect, useState, useMemo } from 'react';
import { fetchSheetData } from '../lib/sheets';
import { AREA_URLS } from '../App';
import { Loader2, Search, Scale, CheckCircle2, AlertTriangle, RefreshCw, Undo, Save, Info } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Papa from 'papaparse';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ReconciliationItem {
  key: string; // pCode + '_' + lCode
  whGroup: string;
  namaLocator: string;
  kodeProduk: string;
  namaProduk: string;
  uom: string;
  stockSistem: number;
  stokRill: number; // dynamically calculated from transactions
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
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAreaFilter, setSelectedAreaFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL'); // ALL, SESUAI, SELISIH
  const [selectedLocator, setSelectedLocator] = useState('ALL');

  // Pagination state
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  // Auto-reset page index when filters or page limit change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedAreaFilter, selectedLocator, selectedStatusFilter, pageSize]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load MTS CSV to get Google Sheet values for "Stok Sistem" (Last Qty columns)
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
      const mappedRows: { tipe: string; pCode: string; pName: string; lCode: string; qty: number; uom: string; source: string; area: string }[] = [];

      const processRows = (rows: any[], source: string, currentArea: string) => {
        const validRows = (rows || []).filter((r: any[]) => r.length > 0 && (r[0] || r[1] || r[9]));
        validRows.forEach((r: any[]) => {
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
            mappedRows.push({ tipe: 'OUT', pCode, pName, lCode: fromLocator || 'UNKNOWN_L', qty, uom, source, area: currentArea });
            mappedRows.push({ tipe: 'IN', pCode, pName, lCode: toLocator || 'UNKNOWN_L', qty, uom, source, area: currentArea });
          } else {
            mappedRows.push({ 
              tipe: tipe || 'IN', 
              pCode, 
              pName, 
              lCode: fromLocator || toLocator || 'UNKNOWN_L', 
              qty, 
              uom,
              source,
              area: currentArea
            });
          }
        });
      };

      if (area === 'HQ' || spreadsheetId === 'HQ') {
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

  // Data loaded successfully
  useEffect(() => {
    loadData();
  }, [spreadsheetId, area]);

  // Compile Reconciliation list based on transaction history and maps
  const reconciliationList = useMemo(() => {
    const listMap = new Map<string, ReconciliationItem>();

    allTransactions.forEach(t => {
      const { tipe, pCode, pName, lCode, qty, uom, area: rowArea } = t;
      const itemKey = `${rowArea}_${lCode}_${pCode}`;

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
          stokRill: 0,
          selisih: 0,
          status: 'BELUM',
          area: rowArea || lData.area || area
        });
      }

      const item = listMap.get(itemKey)!;
      const normalizedType = tipe.replace(/\s+/g, '');
      if (normalizedType === 'IN' || normalizedType === 'AWAL' || normalizedType === 'MASUK' || normalizedType === 'RECEIPT' || normalizedType === 'SALDOAWAL') {
        item.stokRill += qty;
      } else if (normalizedType === 'OUT' || normalizedType === 'KELUAR' || normalizedType === 'ISSUE' || normalizedType === 'PEMAKAIAN') {
        item.stokRill -= qty;
      } else {
        if (qty > 0 && !['TRANSFER', 'TF'].includes(normalizedType)) {
          item.stokRill += qty;
        }
      }
    });

    // Match with MTS CSV "LAST QTY" to determine "Stok Sistem"
    return Array.from(listMap.values()).map(item => {
      const locKey = item.whGroup.toUpperCase().trim();
      const productCodeUpper = item.kodeProduk.toUpperCase().trim();
      const productNameUpper = item.namaProduk.toUpperCase().trim();

      // Lookup sequence:
      // 1. Locator + Product Code
      // 2. Locator + Product Name
      // 3. Locator + Code without spaces
      let matchedLastQty = 0;
      if (mtsLookupMap.has(`${locKey}_${productCodeUpper}`)) {
        matchedLastQty = mtsLookupMap.get(`${locKey}_${productCodeUpper}`) || 0;
      } else if (mtsLookupMap.has(`${locKey}_${productNameUpper}`)) {
        matchedLastQty = mtsLookupMap.get(`${locKey}_${productNameUpper}`) || 0;
      } else if (mtsLookupMap.has(`${locKey}_${productCodeUpper.replace(/\s+/g, '')}`)) {
        matchedLastQty = mtsLookupMap.get(`${locKey}_${productCodeUpper.replace(/\s+/g, '')}`) || 0;
      }

      const selisih = item.stokRill - matchedLastQty;
      const status = selisih === 0 ? 'SESUAI' : 'SELISIH';

      return {
        ...item,
        stockSistem: matchedLastQty,
        stokRill: item.stokRill,
        selisih,
        status
      };
    });
  }, [allTransactions, productsMap, locatorsMap, mtsLookupMap, area]);

  // Filter unique locators for selection
  const uniqueLocators = useMemo(() => {
    const list = reconciliationList;
    const filterByArea = selectedAreaFilter === 'ALL' ? list : list.filter(item => item.area === selectedAreaFilter);
    return Array.from(new Map(filterByArea.map(i => [i.whGroup, { code: i.whGroup, name: i.namaLocator }])).values()).sort((a: any, b: any) => a.code.localeCompare(b.code));
  }, [reconciliationList, selectedAreaFilter]);

  // Filter reconciliation list is dependent on user choice filters
  const filteredReconciliation = useMemo(() => {
    return reconciliationList.filter(item => {
      // 1. Search Query
      const q = searchQuery.toLowerCase();
      const matchSearch = item.namaProduk.toLowerCase().includes(q) || 
        item.kodeProduk.toLowerCase().includes(q) ||
        item.whGroup.toLowerCase().includes(q) ||
        item.namaLocator.toLowerCase().includes(q);

      if (!matchSearch) return false;

      // 2. Area Filter
      if (selectedAreaFilter !== 'ALL' && item.area !== selectedAreaFilter) return false;

      // 3. Locator Filter
      if (selectedLocator !== 'ALL' && item.whGroup !== selectedLocator) return false;

      // 4. Status Filter
      if (selectedStatusFilter === 'SESUAI' && item.status !== 'SESUAI') return false;
      if (selectedStatusFilter === 'SELISIH' && item.status !== 'SELISIH') return false;
      if (selectedStatusFilter === 'BELUM' && item.status !== 'BELUM') return false;

      return true;
    });
  }, [reconciliationList, searchQuery, selectedAreaFilter, selectedLocator, selectedStatusFilter]);

  // Compute pagination
  const totalPages = Math.ceil(filteredReconciliation.length / pageSize);
  const paginatedReconciliation = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredReconciliation.slice(start, start + pageSize);
  }, [filteredReconciliation, currentPage, pageSize]);

  // Summary Metrics
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

  // Grand Total calculation for filtered items
  const grandTotals = useMemo(() => {
    let totalStokRill = 0;
    let totalStockSistem = 0;
    let totalSelisih = 0;

    filteredReconciliation.forEach(item => {
      totalStokRill += item.stokRill || 0;
      totalStockSistem += item.stockSistem || 0;
      totalSelisih += item.selisih || 0;
    });

    return {
      stokRill: totalStokRill,
      stockSistem: totalStockSistem,
      selisih: totalSelisih
    };
  }, [filteredReconciliation]);

  // Unique areas available inside data
  const uniqueAreas = useMemo(() => {
    return Array.from(new Set(reconciliationList.map(i => i.area).filter(Boolean))).sort();
  }, [reconciliationList]);

  // Reset locator filter if area changes
  useEffect(() => {
    setSelectedLocator('ALL');
  }, [selectedAreaFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Scale className="w-6 h-6 text-blue-600" />
            Pencocokan Data (Reconciliation)
          </h2>
          <p className="text-sm text-slate-500">
            Bandingkan kuantitas fisik wilayah lapangan (**Stok Rill** dari transaksi area) dengan records ledger pusat (**Stok Sistem** dari MTS LAST QTY).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
            type="button"
            onClick={loadData} 
            className="px-3.5 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-lg flex items-center gap-2 transition-colors shadow-sm text-sm"
            title="Refresh Data"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Refresh Sinkronisasi
          </button>
        </div>
      </div>

      {/* Stats Summary Panel */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">Total SKU / Kombinasi</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{metrics.totalItems}</div>
          <div className="text-xs text-slate-400 mt-1">Grup lokasi & produk aktif</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm border-l-4 border-l-emerald-500">
          <div className="text-xs font-semibold text-emerald-600 uppercase">Sesuai (Match)</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-5 h-5" />
            {metrics.matched}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {metrics.totalItems > 0 ? Math.round((metrics.matched / metrics.totalItems) * 100) : 0}% Tingkat kecocokan
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm border-l-4 border-l-rose-500">
          <div className="text-xs font-semibold text-rose-600 uppercase">Ada Selisih (Varian)</div>
          <div className="text-2xl font-bold text-rose-700 mt-1 flex items-center gap-1.5">
            <AlertTriangle className="w-5 h-5 animate-pulse" />
            {metrics.selisih}
          </div>
          <div className="text-xs text-slate-400 mt-1">Butuh pemeriksaan unit/mutasi</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm border-l-4 border-l-sky-500">
          <div className="text-xs font-semibold text-sky-600 uppercase">Koneksi Feed MTS</div>
          <div className="text-xl font-bold text-sky-700 mt-1 flex items-center gap-1.5">
            <Info className="w-5 h-5 text-sky-500" />
            LIVE INSTANT
          </div>
          <div className="text-xs text-slate-400 mt-1">Terhubung ke Data MTS online</div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-center gap-3">
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

        {/* Dynamic Area Filter (HQ Only) */}
        {(area === 'HQ' || spreadsheetId === 'HQ') && (
          <div className="w-full md:w-48 text-left">
            <select
              value={selectedAreaFilter}
              onChange={e => setSelectedAreaFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 bg-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="ALL">Semua Area</option>
              {uniqueAreas.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        )}

        {/* Locator Filter */}
        <div className="w-full md:w-48 text-left">
          <select
            value={selectedLocator}
            onChange={e => setSelectedLocator(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 bg-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
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
            className="w-full px-3 py-2 text-sm border border-slate-200 bg-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
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
              <thead className="bg-slate-50/80 text-slate-600 border-b border-slate-200">
                <tr>
                  {(area === 'HQ' || spreadsheetId === 'HQ') && <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider">Area</th>}
                  <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider">Locator</th>
                  <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider">Nama Produk</th>
                  <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider">UOM</th>
                  <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider text-right">Stok Rill</th>
                  <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider text-right">Stock Sistem</th>
                  <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider text-right">Selisih</th>
                  <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredReconciliation.length === 0 ? (
                  <tr>
                    <td colSpan={(area === 'HQ' || spreadsheetId === 'HQ') ? 8 : 7} className="p-12 text-center text-slate-500 italic">
                      Tidak ada rekonsiliasi yang cocok dengan kriteria filter.
                    </td>
                  </tr>
                ) : (
                  paginatedReconciliation.map(item => (
                    <tr key={item.key} className="hover:bg-blue-50/20 transition-colors text-slate-700">
                      {/* Area (Only for HQ) */}
                      {(area === 'HQ' || spreadsheetId === 'HQ') && (
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-slate-100 text-slate-700">
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
                        <div className="text-xs text-slate-500 font-mono mt-0.5">{item.kodeProduk}</div>
                      </td>

                      {/* UOM */}
                      <td className="px-5 py-4">
                        <span className="text-slate-600 font-medium">{item.uom}</span>
                      </td>

                      {/* Stok Rill (Calculated physical area logs) */}
                      <td className="px-5 py-4 text-right font-semibold text-slate-900">
                        {item.stokRill.toLocaleString()}
                      </td>

                      {/* Stock Sistem (From central MTS LAST QTY) */}
                      <td className="px-5 py-4 text-right font-medium text-slate-700 bg-slate-50/50">
                        {item.stockSistem.toLocaleString()}
                      </td>

                      {/* Selisih */}
                      <td className={cn(
                        "px-5 py-4 text-right font-bold text-sm",
                        item.status === 'BELUM' && "text-slate-400 font-normal",
                        item.status === 'SESUAI' && "text-emerald-600",
                        item.status === 'SELISIH' && (item.selisih > 0 ? "text-blue-600" : "text-rose-600")
                      )}>
                        {item.selisih === 0 ? '0' : (item.selisih > 0 ? `+${item.selisih.toLocaleString()}` : item.selisih.toLocaleString())}
                      </td>

                      {/* Status Badge */}
                      <td className="px-5 py-4 text-center">
                        {item.status === 'SESUAI' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Sesuai (Match)
                          </span>
                        )}
                        {item.status === 'SELISIH' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Selisih (Discrepancy)
                          </span>
                        )}
                        {item.status === 'BELUM' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                            <Info className="w-3.5 h-3.5" />
                            Belum Dihitung
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}

                {/* Grand Total Row */}
                {!loading && filteredReconciliation.length > 0 && (
                  <tr className="bg-slate-50 border-t-2 border-slate-300 font-bold text-slate-900">
                    <td 
                      colSpan={(area === 'HQ' || spreadsheetId === 'HQ') ? 4 : 3} 
                      className="px-5 py-4 text-left font-bold text-slate-800 tracking-wider text-xs uppercase"
                    >
                      🚀 Grand Total ({filteredReconciliation.length} Baris Terfilter)
                    </td>
                    <td className="px-5 py-4 text-right text-slate-950 font-extrabold text-sm">
                      {grandTotals.stokRill.toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-right text-slate-800 font-bold text-sm bg-slate-100/50">
                      {grandTotals.stockSistem.toLocaleString()}
                    </td>
                    <td className={cn(
                      "px-5 py-4 text-right text-sm font-extrabold",
                      grandTotals.selisih === 0 ? "text-emerald-700" : (grandTotals.selisih > 0 ? "text-blue-700" : "text-rose-700")
                    )}>
                      {grandTotals.selisih === 0 ? '0' : (grandTotals.selisih > 0 ? `+${grandTotals.selisih.toLocaleString()}` : grandTotals.selisih.toLocaleString())}
                    </td>
                    <td className="px-5 py-4 text-center text-slate-400 font-normal text-xs italic">
                      —
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination controls */}
        {!loading && filteredReconciliation.length > 0 && (
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
                Menampilkan {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredReconciliation.length)} dari {filteredReconciliation.length} baris
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
      
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex gap-3 text-slate-600 text-xs sm:text-sm">
        <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-800">Keterangan Prosedur Sinkronisasi:</span> Kolom <span className="font-semibold">Stok Rill</span> dirancang otomatis dari total kalkulasi mutasi transaksi digital wilayah area (IN/OUT), dan Kolom <span className="font-semibold">Stock Sistem</span> ditarik secara real-time dari kolom <span className="font-semibold">LAST QTY</span> lembar dokumen Google Sheet Data MTS pusat sesuai dengan kecocokan nama produk & locator terdaftar.
        </div>
      </div>
    </div>
  );
}
