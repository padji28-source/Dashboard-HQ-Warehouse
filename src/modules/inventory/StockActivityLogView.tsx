import React, { useState, useEffect, useMemo, memo } from 'react';
import {
  ClipboardList,
  Search,
  Filter,
  Plus,
  RefreshCw,
  Download,
  Calendar,
  ArrowDownRight,
  ArrowUpRight,
  ArrowRightLeft,
  SlidersHorizontal,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  MapPin,
  Package,
  Layers,
  FileText,
  X,
  TrendingUp,
  TrendingDown,
  Info,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import type { StockActivityLog } from '../../shared/types';
import { getStockActivityLogs, logStockActivity } from '../../shared/services/firebase';
import { formatNumber, cn } from '../../shared/utils';
import { fetchSheetData } from '../../lib/sheets';
import { AREA_URLS, AREAS } from '../../App';
import { parseToIsoDate, formatToDDMMYYYY } from '../../lib/dateUtils';

interface StockActivityLogViewProps {
  spreadsheetId?: string;
  currentArea?: string;
  activeUsername?: string;
  onNavigateToTab?: (tabId: string) => void;
}

const CATEGORY_TABS = [
  { id: 'ALL', label: 'Semua Kategori', sheet: '' },
  { id: 'Accessories', label: 'Accessories', sheet: 'INPUT' },
  { id: 'Raw Material', label: 'Raw Material', sheet: 'INPUT RM' },
  { id: 'Manufacturing', label: 'Manufacturing', sheet: 'INPUT MFG' },
  { id: 'Supplies & GA', label: 'Supplies & GA', sheet: 'INPUT SUPPLIES' },
  { id: 'Audit / Penyesuaian', label: 'Audit / Penyesuaian', sheet: '' }
];

const ACTION_TYPES = [
  { id: 'ALL', label: 'Semua Aksi' },
  { id: 'IN', label: 'Masuk (IN)', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  { id: 'OUT', label: 'Keluar (OUT)', color: 'text-rose-700 bg-rose-50 border-rose-200' },
  { id: 'ADJUSTMENT', label: 'Audit / Penyesuaian', color: 'text-purple-700 bg-purple-50 border-purple-200' }
];

const StockActivityLogView = memo(function StockActivityLogView({
  spreadsheetId = '',
  currentArea = 'Semarang',
  activeUsername = 'Admin',
  onNavigateToTab
}: StockActivityLogViewProps) {
  const [logs, setLogs] = useState<StockActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArea, setSelectedArea] = useState<string>(currentArea || 'ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [timeRange, setTimeRange] = useState<'ALL' | '1D' | '7D' | '30D' | 'CUSTOM'>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table');
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  // Modal form state for adding manual audit / adjustment observation
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formArea, setFormArea] = useState(currentArea === 'ALL' || currentArea === 'All Cabang' ? 'Semarang' : currentArea);
  const [formCategory, setFormCategory] = useState('Accessories');
  const [formActionType, setFormActionType] = useState<'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT'>('ADJUSTMENT');
  const [formPCode, setFormPCode] = useState('');
  const [formPName, setFormPName] = useState('');
  const [formLocator, setFormLocator] = useState('');
  const [formLocatorTo, setFormLocatorTo] = useState('');
  const [formQty, setFormQty] = useState('');
  const [formUom, setFormUom] = useState('PCS');
  const [formDocNo, setFormDocNo] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Sync selectedArea when currentArea prop changes
  useEffect(() => {
    if (currentArea) {
      setSelectedArea(currentArea);
      if (currentArea !== 'ALL' && currentArea !== 'All Cabang') {
        setFormArea(currentArea);
      }
    }
  }, [currentArea]);

  // Load real logs from Google Sheets ("Data Pergerakan") & Firestore Logs
  const loadLogs = async () => {
    setLoading(true);
    try {
      const combinedLogs: StockActivityLog[] = [];
      const productNamesMap = new Map<string, string>();

      // 1. Determine which areas to fetch
      const isAllAreas = selectedArea === 'ALL' || selectedArea === 'All Cabang' || selectedArea === 'HQ';
      const areasToFetch: { name: string; url: string }[] = [];

      if (isAllAreas) {
        Object.entries(AREA_URLS).forEach(([aName, aUrl]) => {
          areasToFetch.push({ name: aName, url: aUrl });
        });
      } else {
        const url = AREA_URLS[selectedArea] || (spreadsheetId && spreadsheetId.startsWith('http') ? spreadsheetId : '');
        if (url) {
          areasToFetch.push({ name: selectedArea, url });
        }
      }

      // 2. Fetch sheet rows for each area across the 4 Data Pergerakan categories
      await Promise.all(
        areasToFetch.map(async ({ name: aName, url: aUrl }) => {
          try {
            const [tn, tr, tm, ts, pr] = await Promise.all([
              fetchSheetData(aUrl, "'INPUT'!A2:J", true).catch(() => []),
              fetchSheetData(aUrl, "'INPUT RM'!A2:J", true).catch(() => []),
              fetchSheetData(aUrl, "'INPUT MFG'!A2:J", true).catch(() => []),
              fetchSheetData(aUrl, "'INPUT SUPPLIES'!A2:J", true).catch(() => []),
              fetchSheetData(aUrl, "'MASTER_PRODUK'!A2:D", true).catch(() => [])
            ]);

            // Populate master product lookup
            pr.filter((r: any[]) => r.length > 0 && r[0] && r[0] !== '#N/A').forEach((r: any[]) => {
              const code = String(r[0]).trim();
              const name = String(r[1] || '').trim();
              if (code && name) {
                productNamesMap.set(code.toUpperCase(), name);
                productNamesMap.set(name.toUpperCase(), code);
              }
            });

            // Helper to parse each sheet category into StockActivityLog objects
            const parseRows = (rows: any[], catName: string, sheetTitle: string) => {
              const validRows = (rows || []).filter((r: any[]) => {
                if (!Array.isArray(r) || r.length === 0) return false;
                const tgl = String(r[0] || '').trim();
                const nama = String(r[1] || '').trim();
                const kode = String(r[9] || '').trim();
                return tgl !== '' && (nama !== '' || kode !== '') && tgl !== '#N/A';
              });

              validRows.forEach((r: any[], idx: number) => {
                const rawTanggal = String(r[0] || '').trim();
                const isoDate = parseToIsoDate(rawTanggal);
                const timeStamp = isoDate ? new Date(isoDate).getTime() : Date.now() - idx * 1000;
                const namaBahan = String(r[1] || '').trim();
                const qtyVal = parseFloat(String(r[2] || '0').replace(/,/g, '.'));
                const qty = isNaN(qtyVal) ? 0 : qtyVal;
                const uom = String(r[3] || 'PCS').trim().toUpperCase();
                const rawType = String(r[4] || 'IN').trim().toUpperCase();
                const locatorFrom = String(r[5] || '-').trim();
                const locatorTo = String(r[6] || '').trim();
                const docNo = String(r[7] || '').trim();
                const notes = String(r[8] || '').trim();
                let pCode = String(r[9] || '').trim();

                if (!pCode && namaBahan) {
                  pCode = productNamesMap.get(namaBahan.toUpperCase()) || '';
                }

                // Determine action type
                let actionType: 'IN' | 'OUT' | 'TRANSFER' = 'IN';
                if (rawType.includes('OUT') || rawType.includes('KELUAR') || rawType.includes('ISSUE') || rawType.includes('PEMAKAIAN')) {
                  actionType = 'OUT';
                } else if (rawType.includes('TF') || rawType.includes('TRANSFER')) {
                  actionType = 'TRANSFER';
                }

                let impact = '';
                if (actionType === 'IN') {
                  impact = `Penambahan stok fisik +${formatNumber(qty)} ${uom} di locator ${locatorFrom}`;
                } else if (actionType === 'OUT') {
                  impact = `Pengurangan stok fisik -${formatNumber(qty)} ${uom} di locator ${locatorFrom}`;
                } else {
                  impact = `Mutasi antar locator ${locatorFrom} ➔ ${locatorTo || '?'} (${formatNumber(qty)} ${uom})`;
                }

                combinedLogs.push({
                  id: `sheet_${aName}_${sheetTitle}_${idx}_${isoDate || 'nodate'}`,
                  timestamp: timeStamp,
                  dateStr: isoDate ? `${isoDate} (Transaksi Sheet)` : rawTanggal,
                  username: 'Petugas Gudang',
                  area: aName,
                  category: catName,
                  actionType,
                  pCode: pCode || 'SKU-UNKNOWN',
                  pName: namaBahan || (pCode ? productNamesMap.get(pCode.toUpperCase()) || pCode : 'Produk Tanpa Nama'),
                  locator: locatorFrom,
                  locatorTo: locatorTo || undefined,
                  qty: actionType === 'OUT' ? -Math.abs(qty) : qty,
                  uom: uom || 'PCS',
                  docNo: docNo || '-',
                  notes: notes || '-',
                  impactSummary: impact
                });
              });
            };

            parseRows(tn, 'Accessories', 'INPUT');
            parseRows(tr, 'Raw Material', 'INPUT RM');
            parseRows(tm, 'Manufacturing', 'INPUT MFG');
            parseRows(ts, 'Supplies & GA', 'INPUT SUPPLIES');
          } catch (areaErr) {
            console.warn(`Gagal memuat log sheet untuk area ${aName}:`, areaErr);
          }
        })
      );

      // 3. Fetch any additional saved audit & adjustment logs from Firestore / local storage
      try {
        const fsLogs = await getStockActivityLogs(isAllAreas ? undefined : selectedArea, 100);
        fsLogs.forEach(fLog => {
          // Avoid duplicates
          if (!combinedLogs.some(c => c.id === fLog.id)) {
            combinedLogs.push(fLog);
          }
        });
      } catch (fsErr) {
        console.warn('Gagal memuat log audit tambahan:', fsErr);
      }

      // Sort descending by timestamp / date (newest first)
      combinedLogs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      setLogs(combinedLogs);
    } catch (err) {
      console.error('Gagal menyinkronkan data log aktivitas stok:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [selectedArea, spreadsheetId]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedArea, selectedCategory, selectedAction, searchQuery, timeRange, startDate, endDate, pageSize]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Area filter
      if (selectedArea !== 'ALL' && selectedArea !== 'All Cabang' && selectedArea !== 'HQ') {
        const logArea = (log.area || '').toUpperCase().trim();
        const selArea = selectedArea.toUpperCase().trim();
        if (logArea !== selArea && !logArea.includes(selArea) && !selArea.includes(logArea)) {
          return false;
        }
      }

      // Category filter
      if (selectedCategory !== 'ALL') {
        const logCat = (log.category || '').toUpperCase().trim();
        const selCat = selectedCategory.toUpperCase().trim();
        if (!logCat.includes(selCat) && !selCat.includes(logCat)) {
          return false;
        }
      }

      // Action type filter
      if (selectedAction !== 'ALL') {
        if (log.actionType !== selectedAction) return false;
      }

      // Date range filter
      if (startDate || endDate) {
        let logDate = '';
        if (log.dateStr) {
          logDate = parseToIsoDate(log.dateStr) || '';
        }
        if (!logDate && log.timestamp) {
          logDate = new Date(log.timestamp).toISOString().split('T')[0];
        }
        if (startDate && logDate && logDate < startDate) return false;
        if (endDate && logDate && logDate > endDate) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchCode = (log.pCode || '').toLowerCase().includes(q);
        const matchName = (log.pName || '').toLowerCase().includes(q);
        const matchUser = (log.username || '').toLowerCase().includes(q);
        const matchDoc = (log.docNo || '').toLowerCase().includes(q);
        const matchNotes = (log.notes || '').toLowerCase().includes(q);
        const matchLoc = (log.locator || '').toLowerCase().includes(q) || (log.locatorTo || '').toLowerCase().includes(q);
        const matchArea = (log.area || '').toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchUser && !matchDoc && !matchNotes && !matchLoc && !matchArea) {
          return false;
        }
      }

      return true;
    });
  }, [logs, selectedArea, selectedCategory, selectedAction, timeRange, startDate, endDate, searchQuery]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: 0,
      Accessories: 0,
      'Raw Material': 0,
      Manufacturing: 0,
      'Supplies & GA': 0,
      'Audit / Penyesuaian': 0
    };

    logs.forEach(l => {
      // Area match
      if (selectedArea !== 'ALL' && selectedArea !== 'All Cabang' && selectedArea !== 'HQ') {
        const logArea = (l.area || '').toUpperCase().trim();
        const selArea = selectedArea.toUpperCase().trim();
        if (logArea !== selArea && !logArea.includes(selArea) && !selArea.includes(logArea)) {
          return;
        }
      }

      counts.ALL++;
      const cat = (l.category || '').trim();
      if (cat.includes('Accessories')) counts.Accessories++;
      else if (cat.includes('Raw Material') || cat.includes('RM')) counts['Raw Material']++;
      else if (cat.includes('Manufacturing') || cat.includes('MFG')) counts.Manufacturing++;
      else if (cat.includes('Supplies') || cat.includes('GA')) counts['Supplies & GA']++;
      else counts['Audit / Penyesuaian']++;
    });

    return counts;
  }, [logs, selectedArea]);

  // Metrics summary
  const metrics = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    let totalAdjustment = 0;
    const affectedSkus = new Set<string>();

    filteredLogs.forEach(l => {
      if (l.pCode && l.pCode !== 'SKU-UNKNOWN') affectedSkus.add(l.pCode);
      if (l.actionType === 'IN') {
        totalIn++;
      } else if (l.actionType === 'OUT') {
        totalOut++;
      } else if (l.actionType === 'ADJUSTMENT') {
        totalAdjustment++;
      }
    });

    return {
      total: filteredLogs.length,
      totalIn,
      totalOut,
      totalAdjustment,
      uniqueSkus: affectedSkus.size
    };
  }, [filteredLogs]);

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / pageSize) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  // Handle submit manual audit / stock change log
  const handleCreateLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPCode.trim() && !formPName.trim()) {
      alert('Mohon lengkapi kode SKU atau nama produk.');
      return;
    }

    setFormSubmitting(true);
    try {
      const numQty = parseFloat(formQty) || 0;
      let impactSummary = '';
      if (formActionType === 'IN') {
        impactSummary = `Penambahan stok fisik +${formatNumber(numQty)} ${formUom} di locator ${formLocator || '-'}`;
      } else if (formActionType === 'OUT') {
        impactSummary = `Pengurangan stok fisik -${formatNumber(numQty)} ${formUom} di locator ${formLocator || '-'}`;
      } else if (formActionType === 'TRANSFER') {
        impactSummary = `Mutasi locator: ${formLocator || '-'} ➔ ${formLocatorTo || '-'} (${formatNumber(numQty)} ${formUom})`;
      } else {
        impactSummary = `Audit penyesuaian selisih: ${numQty >= 0 ? '+' : ''}${formatNumber(numQty)} ${formUom} (${formNotes || 'Koreksi stok'})`;
      }

      const newLog = await logStockActivity({
        username: activeUsername || 'Admin',
        area: formArea,
        category: formCategory,
        actionType: formActionType,
        pCode: formPCode.toUpperCase().trim() || 'MANUAL-SKU',
        pName: formPName.trim() || 'Penyesuaian Manual',
        locator: formLocator.toUpperCase().trim() || '-',
        locatorTo: formActionType === 'TRANSFER' ? formLocatorTo.toUpperCase().trim() : undefined,
        qty: numQty,
        uom: formUom.toUpperCase().trim(),
        docNo: formDocNo.trim() || 'MANUAL-AUDIT',
        notes: formNotes.trim(),
        impactSummary
      });

      // Update state locally
      setLogs(prev => [newLog, ...prev]);

      // Reset & close modal
      setIsModalOpen(false);
      setFormPCode('');
      setFormPName('');
      setFormLocator('');
      setFormLocatorTo('');
      setFormQty('');
      setFormDocNo('');
      setFormNotes('');
      alert('Log audit berhasil dicatat!');
    } catch (err) {
      console.error('Gagal mencatat log aktivitas:', err);
      alert('Gagal mencatat log aktivitas stok.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      alert('Tidak ada log untuk diekspor.');
      return;
    }

    const headers = ['Waktu / Tanggal', 'Area', 'Kategori', 'Kode SKU', 'Nama Barang', 'In', 'Out', 'Selisih', 'Satuan', 'Locator', 'No Dokumen', 'Keterangan', 'Tipe Aksi', 'Petugas'];
    const rows = filteredLogs.map(l => {
      let qtyIn = 0;
      let qtyOut = 0;
      let selisih = 0;

      if (l.actionType === 'IN') {
        qtyIn = Math.abs(l.qty);
        selisih = qtyIn;
      } else if (l.actionType === 'OUT') {
        qtyOut = Math.abs(l.qty);
        selisih = -qtyOut;
      } else if (l.actionType === 'ADJUSTMENT') {
        if (l.qty > 0) {
          qtyIn = l.qty;
          selisih = l.qty;
        } else {
          qtyOut = Math.abs(l.qty);
          selisih = l.qty;
        }
      } else {
        // TRANSFER
        qtyIn = Math.abs(l.qty);
        qtyOut = Math.abs(l.qty);
        selisih = 0;
      }

      return [
        `"${l.dateStr || new Date(l.timestamp).toLocaleDateString('id-ID')}"`,
        `"${l.area || ''}"`,
        `"${l.category || ''}"`,
        `"${l.pCode || ''}"`,
        `"${(l.pName || '').replace(/"/g, '""')}"`,
        qtyIn,
        qtyOut,
        selisih,
        `"${l.uom || ''}"`,
        `"${l.locator || ''}${l.locatorTo ? ` -> ${l.locatorTo}` : ''}"`,
        `"${(l.docNo || '').replace(/"/g, '""')}"`,
        `"${(l.notes || '').replace(/"/g, '""')}"`,
        l.actionType,
        `"${l.username || ''}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `log_aktivitas_stok_${selectedArea}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5 pb-12">
      {/* Top Banner & Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                <ClipboardList className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  Log Aktivitas Stok (Data Pergerakan)
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
                  <span>Sinkronisasi otomatis dengan seluruh transaksi Masuk, Keluar, dan Transfer di Menu Data Pergerakan</span>
                  <span>&bull;</span>
                  <span className="font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md">
                    Area: {selectedArea === 'ALL' || selectedArea === 'All Cabang' ? 'Semua Cabang' : selectedArea}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Catat Audit / Penyesuaian</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              title="Unduh data log ke CSV"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Ekspor CSV</span>
            </button>

            <button
              onClick={loadLogs}
              disabled={loading}
              className="p-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-xl shadow-xs transition-all cursor-pointer"
              title="Sinkronkan Ulang Data"
            >
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin text-blue-600")} />
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-100">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Total Aktivitas</span>
            <div className="text-xl font-black text-slate-900 mt-1">{metrics.total.toLocaleString('id-ID')}</div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">{metrics.uniqueSkus.toLocaleString('id-ID')} SKU terdata</span>
          </div>

          <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider">Masuk (IN)</span>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="text-xl font-black text-emerald-950 mt-1">{metrics.totalIn.toLocaleString('id-ID')}</div>
            <span className="text-[10px] text-emerald-700 mt-0.5 block">Penambahan transaksi</span>
          </div>

          <div className="p-3.5 bg-rose-50/70 rounded-xl border border-rose-200">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-rose-800 uppercase tracking-wider">Keluar (OUT)</span>
              <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
            </div>
            <div className="text-xl font-black text-rose-950 mt-1">{metrics.totalOut.toLocaleString('id-ID')}</div>
            <span className="text-[10px] text-rose-700 mt-0.5 block">Pengeluaran transaksi</span>
          </div>

          <div className="p-3.5 bg-purple-50/70 rounded-xl border border-purple-200">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-purple-800 uppercase tracking-wider">Audit / Penyesuaian</span>
              <SlidersHorizontal className="w-3.5 h-3.5 text-purple-600" />
            </div>
            <div className="text-xl font-black text-purple-950 mt-1">{metrics.totalAdjustment.toLocaleString('id-ID')}</div>
            <span className="text-[10px] text-purple-700 mt-0.5 block">Koreksi & Opname</span>
          </div>
        </div>
      </div>

      {/* Category Tabs Menu (Synchronized with Data Pergerakan) */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 md:p-4 shadow-sm flex flex-col gap-2.5">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Kategori Data Pergerakan</div>
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORY_TABS.map(cat => {
            const isActive = selectedCategory === cat.id;
            const count = categoryCounts[cat.id] || 0;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(
                  "px-3.5 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer flex items-center gap-2",
                  isActive
                    ? "bg-slate-900 text-white border-slate-900 shadow-sm ring-1 ring-slate-900"
                    : "border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-xs"
                )}
              >
                <span>{cat.label}</span>
                <span className={cn(
                  "px-1.5 py-0.5 text-[10px] rounded-full",
                  isActive ? "bg-white/25 text-white font-black" : "bg-slate-100 text-slate-600 font-semibold"
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari SKU, Nama Barang, Locator, No Dokumen, Catatan, Petugas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Area, Date & View Mode Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Area Filter */}
            <select
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Semua Cabang (All Area)</option>
              {AREAS.filter(a => a !== 'All Cabang').map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>

            {/* Date Selector Filter */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs">
              <div className="flex items-center gap-1 px-1 text-slate-500 font-bold">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden sm:inline">Tanggal:</span>
              </div>

              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="Tanggal Mulai"
              />
              <span className="text-slate-400 font-bold text-[10px]">s/d</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="Tanggal Selesai"
              />

              <div className="flex items-center gap-1 ml-0.5 border-l border-slate-200 pl-1.5">
                <button
                  type="button"
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                  className={cn(
                    "px-2 py-1 rounded text-[10px] font-bold transition-all border cursor-pointer",
                    !startDate && !endDate ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                  )}
                >
                  Semua
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date().toISOString().split('T')[0];
                    setStartDate(today);
                    setEndDate(today);
                  }}
                  className="px-2 py-1 rounded bg-white hover:bg-slate-100 text-slate-600 font-semibold text-[10px] border border-slate-200 cursor-pointer"
                >
                  Hari Ini
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date();
                    const past = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                    setStartDate(past.toISOString().split('T')[0]);
                    setEndDate(today.toISOString().split('T')[0]);
                  }}
                  className="px-2 py-1 rounded bg-white hover:bg-slate-100 text-slate-600 font-semibold text-[10px] border border-slate-200 cursor-pointer"
                >
                  7 Hari
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date();
                    const past = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                    setStartDate(past.toISOString().split('T')[0]);
                    setEndDate(today.toISOString().split('T')[0]);
                  }}
                  className="px-2 py-1 rounded bg-white hover:bg-slate-100 text-slate-600 font-semibold text-[10px] border border-slate-200 cursor-pointer"
                >
                  30 Hari
                </button>
              </div>
            </div>

            {/* View Mode Toggle */}
            <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                onClick={() => setViewMode('table')}
                className={cn(
                  "px-2.5 py-1.5 rounded-lg transition-all text-[11px]",
                  viewMode === 'table' ? "bg-white text-slate-900 font-bold shadow-xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                Tabel
              </button>
              <button
                onClick={() => setViewMode('timeline')}
                className={cn(
                  "px-2.5 py-1.5 rounded-lg transition-all text-[11px]",
                  viewMode === 'timeline' ? "bg-white text-slate-900 font-bold shadow-xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                Garis Waktu
              </button>
            </div>
          </div>
        </div>

        {/* Action Type Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
          <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Tipe Aksi:
          </span>
          {ACTION_TYPES.map(act => (
            <button
              key={act.id}
              onClick={() => setSelectedAction(act.id)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border cursor-pointer",
                selectedAction === act.id
                  ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              )}
            >
              {act.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content View: Table or Timeline */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-3" />
            <p className="text-sm font-semibold">Menyinkronkan log aktivitas dengan Data Pergerakan...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 space-y-2">
            <ClipboardList className="w-10 h-10 text-slate-300" />
            <p className="text-sm font-bold text-slate-600">Tidak ada log aktivitas stok yang sesuai kriteria</p>
            <p className="text-xs text-slate-400">Coba ubah filter kategori, cabang, atau kata kunci pencarian.</p>
          </div>
        ) : viewMode === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                {selectedAction === 'IN' ? (
                  <tr>
                    <th className="py-3.5 px-4">Waktu / Tanggal</th>
                    <th className="py-3.5 px-3">Locator</th>
                    <th className="py-3.5 px-3">Kategori</th>
                    <th className="py-3.5 px-3">Kode SKU</th>
                    <th className="py-3.5 px-4">Nama Barang</th>
                    <th className="py-3.5 px-3 text-right bg-emerald-50/50 text-emerald-800">In</th>
                    <th className="py-3.5 px-4">Keterangan</th>
                  </tr>
                ) : selectedAction === 'OUT' ? (
                  <tr>
                    <th className="py-3.5 px-4">Waktu / Tanggal</th>
                    <th className="py-3.5 px-3">Locator</th>
                    <th className="py-3.5 px-3">Kategori</th>
                    <th className="py-3.5 px-3">Kode SKU</th>
                    <th className="py-3.5 px-4">Nama Barang</th>
                    <th className="py-3.5 px-3 text-right bg-rose-50/50 text-rose-800">Out</th>
                    <th className="py-3.5 px-4">Keterangan</th>
                  </tr>
                ) : (
                  <tr>
                    <th className="py-3.5 px-4">Waktu / Tanggal</th>
                    <th className="py-3.5 px-3">Locator</th>
                    <th className="py-3.5 px-3">Kategori</th>
                    <th className="py-3.5 px-3">Kode SKU</th>
                    <th className="py-3.5 px-4">Nama Barang</th>
                    <th className="py-3.5 px-3 text-right bg-emerald-50/50 text-emerald-800">In</th>
                    <th className="py-3.5 px-3 text-right bg-rose-50/50 text-rose-800">Out</th>
                    <th className="py-3.5 px-3 text-right bg-blue-50/50 text-blue-900">Selisih</th>
                    <th className="py-3.5 px-4">Keterangan</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedLogs.map((log) => {
                  let qtyIn = 0;
                  let qtyOut = 0;
                  let selisih = 0;

                  if (log.actionType === 'IN') {
                    qtyIn = Math.abs(log.qty);
                    selisih = qtyIn;
                  } else if (log.actionType === 'OUT') {
                    qtyOut = Math.abs(log.qty);
                    selisih = -qtyOut;
                  } else if (log.actionType === 'ADJUSTMENT') {
                    if (log.qty > 0) {
                      qtyIn = log.qty;
                      selisih = log.qty;
                    } else {
                      qtyOut = Math.abs(log.qty);
                      selisih = log.qty;
                    }
                  } else {
                    // TRANSFER
                    qtyIn = Math.abs(log.qty);
                    qtyOut = Math.abs(log.qty);
                    selisih = 0;
                  }

                  const isTransfer = log.actionType === 'TRANSFER';

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* 1. Timestamp */}
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{log.dateStr || new Date(log.timestamp).toLocaleDateString('id-ID')}</span>
                        </div>
                      </td>

                      {/* 2. Locator */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {isTransfer ? (
                          <span className="font-mono text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                            {log.locator} ➔ {log.locatorTo || '-'}
                          </span>
                        ) : (
                          <span className="font-mono text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {log.locator || '-'}
                          </span>
                        )}
                      </td>

                      {/* 3. Category */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={cn(
                          "inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide",
                          log.category === 'Accessories' ? "bg-blue-50 text-blue-700 border border-blue-100" :
                          log.category === 'Raw Material' ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                          log.category === 'Manufacturing' ? "bg-purple-50 text-purple-700 border border-purple-100" :
                          log.category === 'Supplies & GA' ? "bg-amber-50 text-amber-700 border border-amber-100" :
                          "bg-slate-100 text-slate-700 border border-slate-200"
                        )}>
                          {log.category}
                        </span>
                      </td>

                      {/* 4. SKU */}
                      <td className="py-3 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {log.pCode || '-'}
                        </span>
                      </td>

                      {/* 5. Nama Barang */}
                      <td className="py-3 px-4 font-semibold text-slate-800 max-w-xs truncate" title={log.pName}>
                        <div className="truncate">{log.pName}</div>
                        {selectedAction === 'ALL' && log.actionType === 'ADJUSTMENT' && (
                          <span className="inline-block text-[9px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200 mt-0.5">
                            Audit / Penyesuaian
                          </span>
                        )}
                      </td>

                      {/* 6. In (if NOT OUT-only table) */}
                      {selectedAction !== 'OUT' && (
                        <td className="py-3 px-3 text-right whitespace-nowrap bg-emerald-50/20">
                          {qtyIn > 0 ? (
                            <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              +{formatNumber(qtyIn)} {log.uom}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-mono">-</span>
                          )}
                        </td>
                      )}

                      {/* 7. Out (if NOT IN-only table) */}
                      {selectedAction !== 'IN' && (
                        <td className="py-3 px-3 text-right whitespace-nowrap bg-rose-50/20">
                          {qtyOut > 0 ? (
                            <span className="font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              -{formatNumber(qtyOut)} {log.uom}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-mono">-</span>
                          )}
                        </td>
                      )}

                      {/* 8. Selisih (Only for Penyesuaian & ALL table) */}
                      {selectedAction !== 'IN' && selectedAction !== 'OUT' && (
                        <td className="py-3 px-3 text-right whitespace-nowrap bg-blue-50/20">
                          <span className={cn(
                            "font-mono font-black text-xs px-2 py-0.5 rounded",
                            selisih > 0 ? "text-emerald-800 bg-emerald-100/60 font-black" :
                            selisih < 0 ? "text-rose-800 bg-rose-100/60 font-black" :
                            "text-slate-500 font-semibold"
                          )}>
                            {selisih > 0 ? `+${formatNumber(selisih)}` : selisih < 0 ? formatNumber(selisih) : '0'} {log.uom}
                          </span>
                        </td>
                      )}

                      {/* 9. Keterangan */}
                      <td className="py-3 px-4 max-w-sm">
                        {log.docNo && log.docNo !== '-' && (
                          <div className="font-semibold text-slate-800 text-[11px] truncate max-w-[200px]" title={log.docNo}>
                            {log.docNo}
                          </div>
                        )}
                        {log.notes && log.notes !== '-' && (
                          <div className="text-[11px] text-slate-500 truncate mt-0.5" title={log.notes}>
                            {log.notes}
                          </div>
                        )}
                        {(!log.docNo || log.docNo === '-') && (!log.notes || log.notes === '-') && (
                          <span className="text-slate-300 font-mono">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Timeline View */
          <div className="p-6 space-y-6">
            {paginatedLogs.map((log) => {
              const isPositive = log.actionType === 'IN' || (log.qty > 0 && log.actionType !== 'OUT');
              const isTransfer = log.actionType === 'TRANSFER';

              return (
                <div key={log.id} className="flex gap-4 group">
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center font-bold text-white shadow-sm shrink-0",
                      log.actionType === 'IN' ? "bg-emerald-600" :
                      log.actionType === 'OUT' ? "bg-rose-600" :
                      log.actionType === 'TRANSFER' ? "bg-blue-600" :
                      "bg-purple-600"
                    )}>
                      {log.actionType === 'IN' && <ArrowDownRight className="w-4 h-4" />}
                      {log.actionType === 'OUT' && <ArrowUpRight className="w-4 h-4" />}
                      {log.actionType === 'TRANSFER' && <ArrowRightLeft className="w-4 h-4" />}
                      {log.actionType === 'ADJUSTMENT' && <SlidersHorizontal className="w-4 h-4" />}
                    </div>
                    <div className="w-0.5 flex-1 bg-slate-200 mt-2 group-last:hidden" />
                  </div>

                  <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{log.pName}</span>
                        <span className="font-mono text-xs font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {log.pCode}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-slate-200 text-slate-700">
                          {log.category}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                          Area: {log.area}
                        </span>
                      </div>

                      <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {log.dateStr || new Date(log.timestamp).toLocaleString('id-ID')}
                      </span>
                    </div>

                    <div className="text-xs text-slate-700 font-medium">
                      {log.impactSummary}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                      {log.docNo && log.docNo !== '-' && (
                        <span>No Dokumen: <strong className="text-slate-700">{log.docNo}</strong></span>
                      )}
                      {log.locator && (
                        <span>Locator: <strong className="font-mono text-slate-700">{log.locator}{log.locatorTo ? ` ➔ ${log.locatorTo}` : ''}</strong></span>
                      )}
                      <span>Perubahan: <strong className={cn("font-mono", isTransfer ? "text-blue-700" : isPositive ? "text-emerald-700" : "text-rose-700")}>{isTransfer ? '' : isPositive ? '+' : ''}{formatNumber(log.qty)} {log.uom}</strong></span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination footer */}
        {!loading && filteredLogs.length > 0 && (
          <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50">
            <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
              <span>Menampilkan baris {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredLogs.length)} dari {filteredLogs.length} entri</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer"
              >
                <option value="25">25 / hal</option>
                <option value="50">50 / hal</option>
                <option value="100">100 / hal</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
              >
                Sebelumnya
              </button>
              <span className="px-3 py-1.5 text-xs font-bold text-slate-800 bg-slate-200 rounded-lg">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
              >
                Berikutnya
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Manual Audit / Stock Adjustment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Catat Audit / Penyesuaian Stok</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLog} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Area Cabang</label>
                  <select
                    value={formArea}
                    onChange={(e) => setFormArea(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-semibold text-slate-800"
                  >
                    {AREAS.filter(a => a !== 'All Cabang').map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kategori</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-semibold text-slate-800"
                  >
                    <option value="Accessories">Accessories</option>
                    <option value="Raw Material">Raw Material</option>
                    <option value="Manufacturing">Manufacturing</option>
                    <option value="Supplies & GA">Supplies & GA</option>
                    <option value="Audit / Penyesuaian">Audit / Penyesuaian</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tipe Aksi</label>
                  <select
                    value={formActionType}
                    onChange={(e) => setFormActionType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-semibold text-slate-800"
                  >
                    <option value="ADJUSTMENT">Audit / Penyesuaian Selisih</option>
                    <option value="IN">Masuk (IN)</option>
                    <option value="OUT">Keluar (OUT)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kode SKU</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: ACC-001"
                    value={formPCode}
                    onChange={(e) => setFormPCode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Produk / Bahan</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Zipper Metal 15cm"
                  value={formPName}
                  onChange={(e) => setFormPName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {formActionType === 'TRANSFER' ? 'Locator Asal' : 'Locator'}
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: RAK-01"
                    value={formLocator}
                    onChange={(e) => setFormLocator(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {formActionType === 'TRANSFER' ? (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Locator Tujuan</label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: RAK-02"
                      value={formLocatorTo}
                      onChange={(e) => setFormLocatorTo(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">No. Dokumen / Referensi</label>
                    <input
                      type="text"
                      placeholder="Contoh: BA-OPNAME-01"
                      value={formDocNo}
                      onChange={(e) => setFormDocNo(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kuantitas (Qty)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="Kuantitas"
                    value={formQty}
                    onChange={(e) => setFormQty(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Satuan (UOM)</label>
                  <input
                    type="text"
                    required
                    placeholder="PCS / KG / ROLL"
                    value={formUom}
                    onChange={(e) => setFormUom(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl uppercase font-bold focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Catatan / Alasan Audit</label>
                <textarea
                  rows={2}
                  placeholder="Keterangan penyesuaian selisih fisik vs sistem..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {formSubmitting ? 'Menyimpan...' : 'Simpan Log Audit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
});

export default StockActivityLogView;
