import { fetchAndParseCSV } from "../../lib/csvCache";
import React, { useEffect, useState, useMemo, useRef, useCallback, memo } from "react";
import { fetchSheetData, fetchCombinedProducts } from "../../lib/sheets";
import { AREA_URLS } from "../../App";
import type { StockSummary } from "../../types";
import {
  Loader2,
  Search,
  Package,
  ArrowRightLeft,
  Layers,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  X,
  RefreshCw,
  Clock,
  Activity,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  FileText,
  Plus,
  Trash2,
  Download,
  Calendar,
  History,
  ArrowDownRight,
  ChevronLeft,
  ChevronRight,
  MapPin
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { motion, AnimatePresence } from "motion/react";
import * as XLSX from 'xlsx';
import { useData } from '../../context/DataContext';

interface Props {
  spreadsheetId: string;
  area: string;
  title?: string;
  description?: string;
  sheetName?: string;
  isReadOnly?: boolean;
}

interface MappedTransaction {
  id: string;
  tanggal: string;
  tipe: string;
  kodeProduk: string;
  namaBahan: string;
  kuantitas: number;
  uom: string;
  locator: string;
  locatorTo?: string;
  noDocument?: string;
  keterangan?: string;
}

export const displayTanggalIndonesian = (dateStr: string) => {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return dateStr; }
};

export function getParsedDateValue(dateStr: string): number {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

function TransactionInput({ spreadsheetId, area, title = "Inventory Management", description = "Record and monitor stock movements", sheetName = "INPUT", isReadOnly = false }: Props) {
  const { transactions: allTransactions, productsMap, locatorsMap, loading: dataLoading, refreshData } = useData();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  
  // Local state for the entry form
  const [itemsList, setItemsList] = useState<any[]>([]);
  const [formTanggal, setFormTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [formTipe, setFormTipe] = useState<'IN' | 'OUT' | 'TRANSFER'>('IN');
  const [formNoDocument, setFormNoDocument] = useState('');
  const [formKeterangan, setFormKeterangan] = useState('');
  
  // Line item form state
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedProductIndex, setSelectedProductIndex] = useState('');
  const [formKodeProduk, setFormKodeProduk] = useState('');
  const [formNamaBahan, setFormNamaBahan] = useState('');
  const [formQty, setFormQty] = useState('');
  const [formUom, setFormUom] = useState('');
  const [formLocator, setFormLocator] = useState('');
  const [formLocatorTo, setFormLocatorTo] = useState('');

  // Table filtering and search states
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedLocator, setSelectedLocator] = useState("ALL");
  const [selectedLocatorTo, setSelectedLocatorTo] = useState("ALL");
  const [searchSuggestionsOpen, setSearchSuggestionsOpen] = useState(false);
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadData = async (force = false) => {
    setLoading(true);
    await refreshData(force);
    setLoading(false);
  };

  const [selectedSource, setSelectedSource] = useState(sheetName || "INPUT");

  const transactions = useMemo(() => {
    if (selectedSource === "ALL") return allTransactions;
    return allTransactions.filter(t => t.source === selectedSource);
  }, [allTransactions, selectedSource]);

  const filtered = useMemo(() => {
    let data = [...transactions];
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(t => 
        String(t.pCode || '').toLowerCase().includes(q) || 
        String(t.pName || '').toLowerCase().includes(q) || 
        String(t.noDocument || '').toLowerCase().includes(q)
      );
    }
    if (startDate) {
      data = data.filter(t => new Date(t.tanggal) >= new Date(startDate));
    }
    if (endDate) {
      data = data.filter(t => new Date(t.tanggal) <= new Date(endDate));
    }
    if (selectedLocator !== "ALL") {
      data = data.filter(t => t.lCode === selectedLocator);
    }
    if (selectedLocatorTo !== "ALL") {
      data = data.filter(t => t.toLocator === selectedLocatorTo);
    }
    return data;
  }, [transactions, search, startDate, endDate, selectedLocator, selectedLocatorTo]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const stats = useMemo(() => {
    let awal = 0;
    const start = startDate ? new Date(startDate) : null;
    if (start) start.setHours(0, 0, 0, 0);

    // Calculate AWAL from 'AWAL' type transactions
    let awalData = [...transactions];
    if (search) {
      const q = search.toLowerCase();
      awalData = awalData.filter(t => 
        String(t.pCode || '').toLowerCase().includes(q) || 
        String(t.pName || '').toLowerCase().includes(q) || 
        String(t.noDocument || '').toLowerCase().includes(q)
      );
    }
    if (selectedLocator !== "ALL") {
      awalData = awalData.filter(t => t.lCode === selectedLocator);
    }
    if (selectedLocatorTo !== "ALL") {
      awalData = awalData.filter(t => t.toLocator === selectedLocatorTo);
    }

    awal = awalData
      .filter(t => {
        const n = (t.tipe || '').toUpperCase();
        const isAwal = n.includes('AWAL');
        const isBeforeOrOnStart = !start || new Date(t.tanggal) <= start;
        return isAwal && isBeforeOrOnStart;
      })
      .reduce((acc, t) => acc + (t.qty || 0), 0);

    const currentIn = filtered.filter(t => {
       const n = (t.tipe || '').toUpperCase();
       if (n.includes('AWAL')) {
          // Only count as IN if not already in 'awal' stat
          return start ? new Date(t.tanggal) > start : false;
       }
       return n === 'IN' || n === 'MASUK' || n === 'RECEIPT';
    }).reduce((acc, t) => acc + (t.qty || 0), 0);

    const currentOut = filtered.filter(t => {
       const n = (t.tipe || '').toUpperCase();
       if (n.includes('AWAL')) return false;
       return n === 'OUT' || n === 'KELUAR' || n === 'ISSUE' || n === 'PEMAKAIAN' || n === 'TRANSFER' || n === 'TF';
    }).reduce((acc, t) => acc + (t.qty || 0), 0);

    return { awal, in: currentIn, out: currentOut, akhir: awal + currentIn - currentOut };
  }, [transactions, filtered, startDate, search, selectedLocator, selectedLocatorTo]);

  const searchSuggestions = useMemo(() => {
    if (!search || search.length < 2) return [];
    const q = search.toLowerCase();
    const results: any[] = [];
    productsMap.forEach((name, code) => {
      if (code.endsWith('_FULL')) return;
      const sCode = String(code || '').toLowerCase();
      const sName = String(name || '').toLowerCase();
      if (sCode.includes(q) || sName.includes(q)) {
        results.push({ kode: code, nama: name });
      }
    });
    return results.slice(0, 10);
  }, [search, productsMap]);

  const handleOpenForm = () => setFormOpen(true);

  const handleAddItem = () => {
    if (!formKodeProduk || !formQty || !formLocator) return;
    const newItem = {
      id: Math.random().toString(36).substr(2, 9),
      pCode: formKodeProduk,
      pName: formNamaBahan,
      qty: parseFloat(formQty),
      uom: formUom,
      lCode: formLocator,
      toLocator: formTipe === 'TRANSFER' ? formLocatorTo : undefined
    };
    setItemsList([...itemsList, newItem]);
    setFormQty('');
    setProductSearchQuery('');
    setFormKodeProduk('');
    setFormNamaBahan('');
    setFormUom('');
  };

  const handleRemoveItem = (id: string) => {
    setItemsList(itemsList.filter(i => i.id !== id));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (itemsList.length === 0) return;
    setSubmitting(true);
    // Submit logic would go here
    setTimeout(() => {
      setSubmitting(false);
      setFormOpen(false);
      setItemsList([]);
      refreshData(true);
    }, 1500);
  };

  const exportToExcel = () => {
    const dataToExport = filtered.map(t => ({
      "Tanggal": t.tanggal,
      "Tipe": t.tipe,
      "Kode Produk": t.pCode,
      "Nama Produk": t.pName,
      "Qty": t.qty,
      "UOM": t.uom,
      "Locator": t.lCode,
      "Target": t.toLocator || "-",
      "Doc #": t.noDocument || "-",
      "Notes": t.keterangan || "-"
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transactions");
    XLSX.writeFile(wb, `${sheetName}_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const uniqueLocatorsFromTable = useMemo(() => Array.from(new Set(transactions.map(t => t.lCode))).filter(Boolean).sort(), [transactions]);
  const uniqueLocatorTosFromTable = useMemo(() => Array.from(new Set(transactions.map(t => t.toLocator))).filter(Boolean).sort(), [transactions]);

  const getLocatorDisplayName = (code: string) => {
    return locatorsMap.get(code)?.nama || code;
  };

  const filteredProductsForDropdown = useMemo(() => {
    if (!productSearchQuery) return [];
    const q = productSearchQuery.toLowerCase();
    const results: any[] = [];
    productsMap.forEach((name, code) => {
      if (code.endsWith('_FULL')) return;
      const sCode = String(code || '').toLowerCase();
      const sName = String(name || '').toLowerCase();
      if (sCode.includes(q) || sName.includes(q)) {
        results.push({ kode: code, nama: name });
      }
    });
    return results.slice(0, 10);
  }, [productSearchQuery, productsMap]);

  return (
    <div className="space-y-6">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">{title}</h2>
          <p className="text-sm text-slate-500 font-medium">{description}</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={exportToExcel}
            className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-900 hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <Download className="w-3.5 h-3.5" />
            EXPORT
          </button>
          <button 
            onClick={() => loadData(true)} 
            className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-900 hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            REFRESH
          </button>
          {!isReadOnly && (
            <button 
              onClick={handleOpenForm}
              className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-xs font-black hover:bg-slate-800 transition-all shadow-xl flex items-center gap-2 uppercase tracking-wider"
            >
              <Plus className="w-4 h-4" /> Add Transaction
            </button>
          )}
        </div>
      </motion.div>
      
      {/* Summary Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Stok Awal", value: stats.awal, icon: History, color: "text-slate-600", bg: "bg-slate-50" },
          { label: "Total Masuk", value: stats.in, icon: ArrowDownRight, color: "text-emerald-600", bg: "bg-emerald-50/50" },
          { label: "Total Keluar", value: stats.out, icon: ArrowUpRight, color: "text-rose-600", bg: "bg-rose-50/50" },
          { label: "Stok Akhir", value: stats.akhir, icon: Package, color: "text-blue-600", bg: "bg-blue-50/50" }
        ].map((stat, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.1 }}
            className={cn("p-4 rounded-2xl border border-slate-100 flex flex-col justify-between h-24 shadow-sm", stat.bg)}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{stat.label}</span>
              <stat.icon className={cn("w-4 h-4", stat.color)} />
            </div>
            <div className="text-lg font-black text-slate-900">
              {stat.value.toLocaleString()}
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {formOpen && !isReadOnly && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-2xl space-y-8 relative">
               <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-2">
                    <Plus className="w-6 h-6 text-blue-600" /> 
                    Input {title}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-widest">Multi-Item Entry System</p>
                </div>
                <button onClick={() => setFormOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-400 hover:text-slate-900" />
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-8">
                 <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 space-y-6">
                   <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Type *</label>
                        <select value={formTipe} onChange={e => setFormTipe(e.target.value as any)} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold">
                          <option value="IN">IN</option>
                          <option value="OUT">OUT</option>
                          <option value="TRANSFER">TRANSFER</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Date *</label>
                        <input type="date" value={formTanggal} onChange={e => setFormTanggal(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Doc #</label>
                        <input type="text" value={formNoDocument} onChange={e => setFormNoDocument(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold" placeholder="BK-001" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Notes</label>
                        <input type="text" value={formKeterangan} onChange={e => setFormKeterangan(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold" placeholder="Optional notes" />
                      </div>
                   </div>
                 </div>

                 <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 items-end">
                       <div className="relative space-y-1.5">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Product *</label>
                          <div className="relative">
                             <input 
                              type="text" 
                              placeholder="Search..." 
                              value={productSearchQuery} 
                              onChange={e => { setProductSearchQuery(e.target.value); setDropdownOpen(true); }}
                              onFocus={() => setDropdownOpen(true)}
                              className="w-full pl-4 pr-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm font-bold"
                             />
                             <AnimatePresence>
                               {dropdownOpen && filteredProductsForDropdown.length > 0 && (
                                 <motion.div className="absolute z-50 left-0 w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-60 overflow-y-auto">
                                   {filteredProductsForDropdown.map((p, idx) => (
                                     <button key={idx} type="button" onClick={() => { setFormKodeProduk(p.kode); setFormNamaBahan(p.nama); setProductSearchQuery(p.nama); setDropdownOpen(false); }} className="w-full text-left px-4 py-3 hover:bg-slate-50 text-xs font-bold">
                                       {p.kode} - {p.nama}
                                     </button>
                                   ))}
                                 </motion.div>
                               )}
                             </AnimatePresence>
                          </div>
                       </div>
                       <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Qty *</label>
                          <input type="number" value={formQty} onChange={e => setFormQty(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold" />
                       </div>
                       <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Locator *</label>
                          <input type="text" value={formLocator} onChange={e => setFormLocator(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold" placeholder="Location" />
                       </div>
                       {formTipe === 'TRANSFER' && (
                         <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Target *</label>
                            <input type="text" value={formLocatorTo} onChange={e => setFormLocatorTo(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold" placeholder="To Location" />
                         </div>
                       )}
                       <button type="button" onClick={handleAddItem} className="bg-slate-900 text-white font-black py-2.5 rounded-xl hover:bg-slate-800 text-[10px] uppercase">Add</button>
                    </div>
                 </div>

                 <div className="border border-slate-200 rounded-[2rem] overflow-hidden bg-white">
                    <table className="w-full text-left border-collapse">
                       <thead className="bg-slate-50">
                          <tr>
                             <th className="px-8 py-4 text-[10px] font-black text-slate-500 uppercase">Product</th>
                             <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase text-right">Qty</th>
                             <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase text-center">Locator</th>
                             <th className="px-8 py-4 text-[10px] font-black text-slate-500 uppercase text-center w-20">Actions</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {itemsList.map((item, idx) => (
                            <tr key={idx}>
                               <td className="px-8 py-4 text-xs font-bold">{item.pName}</td>
                               <td className="px-4 py-4 text-sm font-black text-right">{item.qty.toLocaleString()}</td>
                               <td className="px-4 py-4 text-center text-[10px] font-black uppercase">{item.lCode} {item.toLocator ? `→ ${item.toLocator}` : ''}</td>
                               <td className="px-8 py-4 text-center">
                                  <button type="button" onClick={() => handleRemoveItem(item.id)} className="text-red-500 p-2"><Trash2 className="w-4 h-4" /></button>
                               </td>
                            </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>

                 <div className="flex justify-end gap-4">
                    <button type="button" onClick={() => setFormOpen(false)} className="px-8 py-3 text-[10px] font-black text-slate-500 uppercase">Cancel</button>
                    <button type="submit" disabled={submitting || itemsList.length === 0} className="bg-blue-600 text-white px-10 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50">
                      {submitting ? 'Saving...' : `Save ${itemsList.length} Transactions`}
                    </button>
                 </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Charts Section Removed */}
      
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden flex flex-col min-h-[600px]">
        <div className="p-8 border-b border-slate-100 bg-slate-50/30 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
               <div className="space-y-1">
                  <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-3">
                    <FileText className="w-6 h-6 text-blue-600" /> Ledger
                  </h3>
               </div>
               <div className="flex flex-wrap items-center gap-4">
                  <select 
                    value={selectedSource} 
                    onChange={(e) => setSelectedSource(e.target.value)}
                    className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:outline-none"
                  >
                    <option value="ALL">Semua Sumber</option>
                    <option value="INPUT">Accessories</option>
                    <option value="INPUT RM">Raw Material</option>
                    <option value="INPUT MFG">Manufacturing</option>
                    <option value="INPUT SUPPLIES">Supplies</option>
                  </select>
                  <select 
                    value={selectedLocator} 
                    onChange={(e) => setSelectedLocator(e.target.value)}
                    className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:outline-none"
                  >
                    <option value="ALL">Semua Locator</option>
                    {uniqueLocatorsFromTable.map(loc => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Search SKU or Name..." 
                      value={search} 
                      onChange={e => { setSearch(e.target.value); setSearchSuggestionsOpen(true); }} 
                      onFocus={() => setSearchSuggestionsOpen(true)}
                      onBlur={() => setTimeout(() => setSearchSuggestionsOpen(false), 200)}
                      className="w-full pl-10 pr-4 py-2 border rounded-xl text-sm" 
                    />
                    <AnimatePresence>
                      {searchSuggestionsOpen && searchSuggestions.length > 0 && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute z-50 left-0 w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden"
                        >
                          {searchSuggestions.map((p, i) => (
                            <button 
                              key={i} 
                              onClick={() => { setSearch(p.kode); setSearchSuggestionsOpen(false); }}
                              className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex flex-col gap-0.5"
                            >
                              <span className="text-[10px] font-black text-blue-600">{p.kode}</span>
                              <span className="text-xs font-bold text-slate-900">{p.nama}</span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="flex items-center gap-2 border rounded-xl p-1 bg-white">
                     <Calendar className="w-4 h-4 text-slate-400 ml-2" />
                     <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-[10px] font-bold p-1" />
                     <span className="text-slate-300">/</span>
                     <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-[10px] font-bold p-1" />
                  </div>
               </div>
            </div>
         </div>

         <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
               <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase">Date</th>
                    <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase">Product</th>
                    <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase text-right">Qty</th>
                    <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase">Locator</th>
                    <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase">Type</th>
                    <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase">Source</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase">Doc #</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                  {paginated.map((t, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                       <td className="px-8 py-4 text-[10px] font-bold">{displayTanggalIndonesian(t.tanggal)}</td>
                       <td className="px-4 py-4">
                          <div className="text-[10px] font-black text-slate-400">{t.pCode}</div>
                          <div className="text-xs font-bold text-slate-900">{t.pName}</div>
                       </td>
                       <td className="px-4 py-4 text-right text-sm font-black">{t.qty.toLocaleString()}</td>
                       <td className="px-4 py-4 text-[10px] font-bold uppercase">{t.lCode} {t.toLocator ? `→ ${t.toLocator}` : ''}</td>
                       <td className="px-4 py-4">
                          <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase", (t.tipe||'').includes('IN') ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')}>
                            {t.tipe}
                          </span>
                       </td>
                       <td className="px-4 py-4 text-[10px] font-mono text-slate-500 uppercase">{t.source}</td>
                       <td className="px-8 py-4 text-[10px] font-mono">{t.noDocument}</td>
                    </tr>
                  ))}
               </tbody>
               {filtered.length > 0 && (
                 <tfoot className="bg-slate-100/80 border-t-2 border-slate-200 font-black">
                   <tr className="divide-x divide-slate-200/50">
                     <td colSpan={2} className="px-8 py-3 text-[10px] text-slate-500 uppercase tracking-widest">Grand Totals</td>
                     <td className="px-4 py-3 text-right space-y-1">
                        <div className="flex justify-between items-center gap-4 text-[10px] text-slate-400">
                          <span>AWAL:</span>
                          <span className="text-slate-600">{stats.awal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center gap-4 text-[10px] text-emerald-600">
                          <span>IN:</span>
                          <span>+{stats.in.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center gap-4 text-[10px] text-rose-600">
                          <span>OUT:</span>
                          <span>-{stats.out.toLocaleString()}</span>
                        </div>
                        <div className="pt-1 border-t border-slate-200 flex justify-between items-center gap-4 text-sm text-blue-700 font-black">
                          <span>RIIL:</span>
                          <span>{stats.akhir.toLocaleString()}</span>
                        </div>
                     </td>
                     <td colSpan={4} className="bg-slate-50/30"></td>
                   </tr>
                 </tfoot>
               )}
            </table>
         </div>

         {filtered.length > pageSize && (
            <div className="p-6 border-t border-slate-100 flex items-center justify-between">
               <p className="text-[10px] font-black text-slate-400 uppercase">Showing {paginated.length} of {filtered.length}</p>
               <div className="flex gap-2">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-4 py-2 border rounded-xl text-xs font-bold disabled:opacity-50">Prev</button>
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-4 py-2 border rounded-xl text-xs font-bold disabled:opacity-50">Next</button>
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

export default memo(TransactionInput);
