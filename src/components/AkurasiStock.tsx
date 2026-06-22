import { useEffect, useState, useMemo } from 'react';
import { fetchSheetData } from '../lib/sheets';
import { AREA_URLS } from '../App';
import { Loader2, AlertTriangle, RefreshCw, BarChart3, ArrowDownToLine, CheckCircle2, CircleAlert, Percent, Box, MapPin } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}

interface AccuracySummary {
  area: string;
  totalSku: number;
  totalSelisih: number;
  accuracyPercent: number;
}

interface DiscrepancyItem {
  area: string;
  locator: string;
  namaBahan: string;
  uom: string;
  qtyFisik: number;
  qtySistem: number;
  selisih: number;
}

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
  
  // Try MM/DD/YYYY or M/D/YY
  const slashed = cleaned.split('/');
  if (slashed.length === 3) {
    let m = slashed[0].padStart(2, '0');
    let d = slashed[1].padStart(2, '0');
    let y = slashed[2].trim();
    if (y.length === 2) {
      y = '20' + y;
    }
    return `${y.padStart(4, '20')}-${m}-${d}`;
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
  return '';
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

export default function AkurasiStock() {
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const localNow = new Date(now.getTime() - offset * 60 * 1000);
    return localNow.toISOString().split('T')[0];
  });
  const [reconType, setReconType] = useState<'daily' | 'monthly'>('daily');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    return `${now.getFullYear()}-${mm}`;
  });

  const [allAreaSummary, setAllAreaSummary] = useState<AccuracySummary[]>([]);
  const [allDiscrepancies, setAllDiscrepancies] = useState<DiscrepancyItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Search filter for differences table
  const [tableSearch, setTableSearch] = useState('');
  const [selectedAreaFilter, setSelectedAreaFilter] = useState('ALL');

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      // 1. Fetch MTS Sheet Data (System Stock)
      const csvUrl = '/api/mts';
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
        console.error('Failed to pre-fetch MTS in Akurasi Stock:', err);
      }

      // 2. Load all transactions, products, and locators from each area
      const summaryList: AccuracySummary[] = [];
      const discrepancyList: DiscrepancyItem[] = [];

      const urlEntries = Object.entries(AREA_URLS);

      await Promise.all(
        urlEntries.map(async ([aName, aUrl]) => {
          try {
            const [tn, tr, tm, ts, pr, lr] = await Promise.all([
              fetchSheetData(aUrl, "'INPUT'!A2:J").catch(() => []),
              fetchSheetData(aUrl, "'INPUT RM'!A2:J").catch(() => []),
              fetchSheetData(aUrl, "'INPUT MFG'!A2:J").catch(() => []),
              fetchSheetData(aUrl, "'INPUT SUPPLIES'!A2:J").catch(() => []),
              fetchSheetData(aUrl, "'MASTER_PRODUK'!A2:D").catch(() => []),
              fetchSheetData(aUrl, "'MASTER_LOCATOR'!A2:E").catch(() => [])
            ]);

            const pMap = new Map<string, { nama: string; satuan: string }>();
            pr.filter((r: any[]) => r.length > 0 && r[0] && r[0] !== '#N/A' && r[1] !== '#N/A').forEach((r: any[]) => {
              pMap.set(String(r[0]).trim(), {
                nama: String(r[1] || '').trim(),
                satuan: String(r[2] || '').trim()
              });
            });

            const lMap = new Map<string, { nama: string; whType: string; area: string }>();
            lr.filter((r: any[]) => r.length > 0 && (r[0] || r[1]) && r[0] !== '#N/A' && r[1] !== '#N/A').forEach((r: any[]) => {
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

            const rawTransactions: any[] = [];
            const processBranchRows = (rows: any[], sourceSheet: string) => {
              const valid = (rows || []).filter((r: any[]) => {
                if (r.length === 0) return false;
                const tanggal = String(r[0] || '').trim();
                const nama = String(r[1] || '').trim();
                const kode = String(r[9] || '').trim();
                return tanggal !== '' && nama !== '' && kode !== '#N/A' && nama !== '#N/A' && tanggal !== '#N/A';
              });
              valid.forEach((r: any[]) => {
                const tanggalRaw = String(r[0] || '').trim();
                const tanggal = parseToIsoDate(tanggalRaw);
                const pName = String(r[1] || '').trim();
                let pCode = String(r[9] || '').trim();
                const tipe = String(r[4] || '').trim().toUpperCase();
                const uom = String(r[3] || '').trim();
                
                if (!pName && !pCode) return;
                if (!pCode) pCode = pName;

                const qtyStr = String(r[2] || '0').replace(',', '.');
                let qty = parseFloat(qtyStr) || 0;
                if (isNaN(qty)) qty = 0;

                let fromLocator = String(r[5] || '').trim();
                let toLocator = String(r[6] || '').trim();
                if (!fromLocator && !toLocator) fromLocator = 'UNKNOWN_L';

                if (tipe === 'TRANSFER' || tipe === 'TF') {
                  rawTransactions.push({ tipe: 'OUT', pCode, pName, lCode: fromLocator || 'UNKNOWN_L', qty, uom, tanggal });
                  rawTransactions.push({ tipe: 'IN', pCode, pName, lCode: toLocator || 'UNKNOWN_L', qty, uom, tanggal });
                } else {
                  rawTransactions.push({ 
                    tipe: tipe || 'IN', 
                    pCode, 
                    pName, 
                    lCode: fromLocator || toLocator || 'UNKNOWN_L', 
                    qty, 
                    uom,
                    tanggal
                  });
                }
              });
            };

            processBranchRows(tn, 'INPUT');
            processBranchRows(tr, 'INPUT RM');
            processBranchRows(tm, 'INPUT MFG');
            processBranchRows(ts, 'INPUT SUPPLIES');

            // Compile stats for this area using reconciliation maps
            const areaStocksMap = new Map<string, { key: string; lCode: string; pCode: string; pName: string; uom: string; physicalQty: number }>();

            rawTransactions.forEach(t => {
              const { tipe, pCode, pName, lCode, qty, uom, tanggal } = t;
              const itemKey = `${lCode}_${pCode}`;

              let includeInCumulative = false;
              if (reconType === 'daily') {
                includeInCumulative = !tanggal || tanggal <= selectedDate;
              } else {
                const transMonth = tanggal ? tanggal.substring(0, 7) : '';
                includeInCumulative = !tanggal || transMonth <= selectedMonth;
              }

              if (includeInCumulative) {
                if (!areaStocksMap.has(itemKey)) {
                  const pData = pMap.get(pCode) || { nama: pName || pCode, satuan: uom || 'Pcs' };
                  areaStocksMap.set(itemKey, {
                    key: itemKey,
                    lCode,
                    pCode: pCode === pName ? '' : pCode,
                    pName: pData.nama,
                    uom: pData.satuan || uom || 'Pcs',
                    physicalQty: 0
                  });
                }

                const item = areaStocksMap.get(itemKey)!;
                const normType = tipe.replace(/\s+/g, '');

                if (normType === 'IN' || normType === 'AWAL' || normType === 'MASUK' || normType === 'RECEIPT' || normType === 'SALDOAWAL') {
                  item.physicalQty += qty;
                } else if (normType === 'OUT' || normType === 'KELUAR' || normType === 'ISSUE' || normType === 'PEMAKAIAN') {
                  item.physicalQty -= qty;
                } else {
                  if (qty > 0) {
                    item.physicalQty += qty;
                  }
                }
              }
            });

            // Convert to statistics
            let areaTotalSku = 0;
            let areaTotalSelisih = 0;

            areaStocksMap.forEach(item => {
              const locKey = item.lCode.toUpperCase().trim();
              const pCodeUpper = item.pCode.toUpperCase().trim();
              const pNameUpper = item.pName.toUpperCase().trim();

              let systemQty = 0;
              if (mtsMap.has(`${locKey}_${pCodeUpper}`)) {
                systemQty = mtsMap.get(`${locKey}_${pCodeUpper}`) || 0;
              } else if (mtsMap.has(`${locKey}_${pNameUpper}`)) {
                systemQty = mtsMap.get(`${locKey}_${pNameUpper}`) || 0;
              } else if (mtsMap.has(`${locKey}_${pCodeUpper.replace(/\s+/g, '')}`)) {
                systemQty = mtsMap.get(`${locKey}_${pCodeUpper.replace(/\s+/g, '')}`) || 0;
              }

              const diff = item.physicalQty - systemQty;
              areaTotalSku += 1;

              if (diff !== 0) {
                areaTotalSelisih += 1;
                discrepancyList.push({
                  area: aName,
                  locator: item.lCode,
                  namaBahan: item.pName,
                  uom: item.uom,
                  qtyFisik: item.physicalQty,
                  qtySistem: systemQty,
                  selisih: diff
                });
              }
            });

            const accuracy = areaTotalSku > 0 
              ? Math.max(0, Math.min(100, Math.round(((areaTotalSku - areaTotalSelisih) / areaTotalSku) * 100))) 
              : 100;

            summaryList.push({
              area: aName,
              totalSku: areaTotalSku,
              totalSelisih: areaTotalSelisih,
              accuracyPercent: accuracy
            });

          } catch (err) {
            console.error(`Error aggregating accuracy for area ${aName}:`, err);
          }
        })
      );

      // Sort summaryList based on search order of AREAS
      const order = Object.keys(AREA_URLS);
      summaryList.sort((a, b) => order.indexOf(a.area) - order.indexOf(b.area));

      setAllAreaSummary(summaryList);
      setAllDiscrepancies(discrepancyList);

    } catch (err: any) {
      console.error(err);
      setErrorMsg('Gagal memuat akurasi stock: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [reconType, selectedDate, selectedMonth]);

  const exportDiscrepanciesToExcel = () => {
    try {
      const dataToExport = filteredTableData.map(item => ({
        'Area / Cabang': item.area,
        'Locator': item.locator,
        'Nama Bahan / Produk': item.namaBahan,
        'Uom': item.uom,
        'Quantity Fisik': item.qtyFisik,
        'Quantity Sistem (MTS)': item.qtySistem,
        'Selisih Selisih': item.selisih
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Discrepancies');

      // Autofit columns set
      const fitCols = [
        { wch: 18 }, // Area
        { wch: 15 }, // Locator
        { wch: 25 }, // Nama Bahan
        { wch: 10 }, // Uom
        { wch: 15 }, // Qty Fisik
        { wch: 20 }, // Qty Sistem
        { wch: 12 }  // Selisih
      ];
      ws['!cols'] = fitCols;

      XLSX.writeFile(wb, `Selisih_Akurasi_Stock_ALL_CABANG_${reconType === 'daily' ? formatToDDMMYYYY(selectedDate) : formatToDDMMYYYY(selectedMonth)}.xlsx`);
    } catch (error: any) {
      alert('Ekspor ke Excel gagal: ' + error.message);
    }
  };

  const filteredTableData = useMemo(() => {
    return allDiscrepancies.filter(item => {
      const matchArea = selectedAreaFilter === 'ALL' || item.area === selectedAreaFilter;
      const matchSearch = !tableSearch || 
        item.namaBahan.toLowerCase().includes(tableSearch.toLowerCase()) ||
        item.locator.toLowerCase().includes(tableSearch.toLowerCase()) ||
        item.area.toLowerCase().includes(tableSearch.toLowerCase());
      return matchArea && matchSearch;
    });
  }, [allDiscrepancies, selectedAreaFilter, tableSearch]);

  const totalSKUCount = useMemo(() => allAreaSummary.reduce((sum, item) => sum + item.totalSku, 0), [allAreaSummary]);
  const totalDiscrepanciesCount = useMemo(() => allAreaSummary.reduce((sum, item) => sum + item.totalSelisih, 0), [allAreaSummary]);
  const averageAccuracyPercent = useMemo(() => {
    return totalSKUCount > 0 
      ? Math.round(((totalSKUCount - totalDiscrepanciesCount) / totalSKUCount) * 100) 
      : 100;
  }, [totalSKUCount, totalDiscrepanciesCount]);

  return (
    <div className="w-full space-y-6">
      {/* Header section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            Metrik Akurasi Stock - All Cabang
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Analisis akurasi real-time SKU fisik vs sistem MTS di seluruh cabang ditarik dari riwayat mutasi.
          </p>
        </div>

        {/* Date Filter & Control UI */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setReconType('daily')}
              className={cn(
                "px-3 py-1 text-xs font-bold rounded-md transition-all duration-200",
                reconType === 'daily' ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-900"
              )}
            >
              Harian
            </button>
            <button
              onClick={() => setReconType('monthly')}
              className={cn(
                "px-3 py-1 text-xs font-bold rounded-md transition-all duration-200",
                reconType === 'monthly' ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-900"
              )}
            >
              Bulanan
            </button>
          </div>

          {reconType === 'daily' ? (
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1 shadow-sm">
              <span className="text-[10px] uppercase tracking-wide font-bold text-slate-400">Tanggal:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="text-xs sm:text-sm font-bold text-slate-800 focus:outline-none"
              />
            </div>
          ) : (
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1 shadow-sm">
              <span className="text-[10px] uppercase tracking-wide font-bold text-slate-400">Bulan:</span>
              <input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="text-xs sm:text-sm font-bold text-slate-800 focus:outline-none"
              />
            </div>
          )}

          <button
            onClick={loadData}
            title="Reload Data"
            disabled={loading}
            className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Accuracy KPI Grid summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Rata-rata Akurasi</span>
            <div className="text-3xl font-black text-emerald-600 mt-1">{averageAccuracyPercent}%</div>
            <span className="text-[10px] font-medium text-slate-400 mt-1 block">Seluruh SKU terintegrasi</span>
          </div>
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
            <Percent className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Total SKU Berjalan</span>
            <div className="text-3xl font-black text-blue-600 mt-1">{totalSKUCount}</div>
            <span className="text-[10px] font-medium text-slate-400 mt-1 block">SKU di 12 area/cabang</span>
          </div>
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
            <Box className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">SKU yang Selisih</span>
            <div className={`text-3xl font-black mt-1 ${totalDiscrepanciesCount > 0 ? "text-rose-500" : "text-emerald-600"}`}>
              {totalDiscrepanciesCount}
            </div>
            <span className="text-[10px] font-medium text-slate-400 mt-1 block">Memerlukan penyesuaian</span>
          </div>
          <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 flex flex-col items-center justify-center shadow-sm">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
          <p className="text-slate-600 font-semibold">Menganalisis & menghitung akurasi stock multi-area...</p>
          <p className="text-slate-400 text-xs mt-1">Mengambil database transaksional dari seluruh 12 lembar cabang Google Sheets.</p>
        </div>
      ) : errorMsg ? (
        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-6 text-center text-rose-800">
          <CircleAlert className="w-10 h-10 mx-auto mb-3" />
          <p className="font-semibold">{errorMsg}</p>
          <button onClick={loadData} className="mt-3 px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg text-xs transition duration-200">
            Coba Lagi
          </button>
        </div>
      ) : (
        <>
          {/* Chart Section */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-500" />
              Grafik Komparasi Akurasi dan Jumlah SKU per Cabang
            </h3>
            
            <div className="w-full h-80 sm:h-96">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={allAreaSummary} margin={{ top: 20, right: 10, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="area" 
                    tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <YAxis 
                    yAxisId="left" 
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    label={{ value: 'Jumlah SKU', angle: -90, position: 'insideLeft', style: { fill: '#64748b', fontSize: 11, fontWeight: 500 } }}
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right" 
                    domain={[0, 100]}
                    tick={{ fill: '#059669', fontSize: 11 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    label={{ value: 'Akurasi (%)', angle: 90, position: 'insideRight', style: { fill: '#059669', fontSize: 11, fontWeight: 500 } }}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', borderColor: '#e2e8f0', boxShadow: '0 4px 12px -2px rgba(0,0,0,0.05)' }} 
                    formatter={(value: any, name: string) => {
                      if (name === 'accuracyPercent') return [`${value}%`, 'Akurasi Stock'];
                      if (name === 'totalSku') return [`${value} SKU`, 'Total SKU'];
                      if (name === 'totalSelisih') return [`${value} SKU`, 'Total Selisih'];
                      return [value, name];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, fontWeight: 500 }} />
                  <Bar yAxisId="left" dataKey="totalSku" name="totalSku" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={26} />
                  <Bar yAxisId="left" dataKey="totalSelisih" name="totalSelisih" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={26} />
                  <Line yAxisId="right" type="monotone" dataKey="accuracyPercent" name="accuracyPercent" stroke="#10b981" strokeWidth={3} dot={{ r: 4, stroke: '#10b981', strokeWidth: 2, fill: '#fff' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            
            <div className="mt-3 flex flex-wrap gap-4 text-xs font-semibold text-slate-500 justify-center">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-indigo-500 rounded-full inline-block"></span> Total SKU Terdaftar</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-rose-500 rounded-full inline-block"></span> SKU Selisih (Qty Fisik ≠ Qty Sistem)</span>
              <span className="flex items-center gap-1.5"><span className="w-3.5 h-0.5 border-t-2 border-emerald-500 inline-block"></span> Persentase Akurasi (%)</span>
            </div>
          </div>

          {/* Table list of differences */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-500" />
                  Rincian Penemuan SKU Selisih (Seluruh Cabang)
                </h3>
                <p className="text-xs text-slate-500 mt-1">Ditemukan {allDiscrepancies.length} item dengan ketidaksesuaian jumlah stok fisik terhadap sistem utama.</p>
              </div>

              {/* Filtering Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <input 
                  type="text"
                  value={tableSearch}
                  onChange={e => setTableSearch(e.target.value)}
                  placeholder="Cari locator, bahan..."
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 w-44"
                />

                <select
                  value={selectedAreaFilter}
                  onChange={e => setSelectedAreaFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-bold text-slate-700 bg-white cursor-pointer"
                >
                  <option value="ALL">Semua Cabang (Filter)</option>
                  {allAreaSummary.map(item => (
                    <option key={item.area} value={item.area}>{item.area}</option>
                  ))}
                </select>

                <button
                  onClick={exportDiscrepanciesToExcel}
                  disabled={filteredTableData.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 active:bg-emerald-800 transition disabled:opacity-50"
                >
                  <ArrowDownToLine className="w-3.5 h-3.5" />
                  Ekspor Excel
                </button>
              </div>
            </div>

            {filteredTableData.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <p className="font-bold text-slate-700 text-sm">Hebat! Tidak ada ketidaksesuaian stock ditemukan.</p>
                <p className="text-slate-400 text-xs mt-1">Sesuai dengan kriteria filter area dan pencarian saat ini.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-250 select-none text-slate-700 font-bold text-[11px] uppercase tracking-wider">
                      <th className="px-5 py-4">Area</th>
                      <th className="px-5 py-4">Locator</th>
                      <th className="px-5 py-4">Nama Bahan</th>
                      <th className="px-5 py-4">UOM</th>
                      <th className="px-5 py-4 text-right">Qty Fisik (Riwayat)</th>
                      <th className="px-5 py-4 text-right">Qty Sistem (MTS)</th>
                      <th className="px-5 py-4 text-right">Selisih</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-xs text-slate-600">
                    {filteredTableData.map((item, idx) => {
                      const isOverStock = item.selisih > 0;
                      return (
                        <tr key={idx} className="hover:bg-slate-50/50 transition">
                          <td className="px-5 py-3.5 font-bold text-slate-800 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-blue-500" />
                            {item.area}
                          </td>
                          <td className="px-5 py-3.5"><span className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded font-bold font-mono">{item.locator}</span></td>
                          <td className="px-5 py-3.5 font-bold text-slate-700">{item.namaBahan}</td>
                          <td className="px-5 py-3.5"><span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full uppercase tracking-wider font-extrabold">{item.uom}</span></td>
                          <td className="px-5 py-3.5 text-right font-bold text-slate-800 font-mono">{item.qtyFisik.toLocaleString()}</td>
                          <td className="px-5 py-3.5 text-right font-bold text-slate-800 font-mono">{item.qtySistem.toLocaleString()}</td>
                          <td className={`px-5 py-3.5 text-right font-black font-mono ${isOverStock ? "text-emerald-600" : "text-rose-500"}`}>
                            {isOverStock ? '+' : ''}{item.selisih.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
