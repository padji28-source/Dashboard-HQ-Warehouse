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
  AlertTriangle,
  TrendingUp,
  FileText,
  Plus,
  Trash2,
  Download,
  Calendar,
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

  const transactions = useMemo(() => {
    // Filter by area and source if necessary, though DataContext might have done it
    return allTransactions.filter(t => t.source === sheetName);
  }, [allTransactions, sheetName]);

  const filtered = useMemo(() => {
    let data = [...transactions];
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(t => 
        t.kodeProduk?.toLowerCase().includes(q) || 
        t.namaBahan?.toLowerCase().includes(q) || 
        t.noDocument?.toLowerCase().includes(q)
      );
    }
    if (startDate) {
      data = data.filter(t => new Date(t.tanggal) >= new Date(startDate));
    }
    if (endDate) {
      data = data.filter(t => new Date(t.tanggal) <= new Date(endDate));
    }
    if (selectedLocator !== "ALL") {
      data = data.filter(t => t.locator === selectedLocator);
    }
    if (selectedLocatorTo !== "ALL") {
      data = data.filter(t => t.locatorTo === selectedLocatorTo);
    }
    return data;
  }, [transactions, search, startDate, endDate, selectedLocator, selectedLocatorTo]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const grandTotalQty = useMemo(() => filtered.reduce((acc, t) => acc + (t.kuantitas || 0), 0), [filtered]);
  const totalIn = useMemo(() => filtered.filter(t => {
     const n = (t.tipe || '').toUpperCase();
     return n === 'IN' || n.includes('AWAL') || n === 'MASUK' || n === 'RECEIPT';
  }).reduce((acc, t) => acc + (t.kuantitas || 0), 0), [filtered]);
  const totalOut = useMemo(() => filtered.filter(t => {
     const n = (t.tipe || '').toUpperCase();
     return n === 'OUT' || n === 'KELUAR' || n === 'ISSUE' || n === 'PEMAKAIAN' || n === 'TRANSFER' || n === 'TF';
  }).reduce((acc, t) => acc + (t.kuantitas || 0), 0), [filtered]);
  const totalAwal = 0; // Simplified

  const handleOpenForm = () => setFormOpen(true);

  const handleAddItem = () => {
    if (!formKodeProduk || !formQty || !formLocator) return;
    const newItem = {
      id: Math.random().toString(36).substr(2, 9),
      kodeProduk: formKodeProduk,
      namaBahan: formNamaBahan,
      kuantitas: parseFloat(formQty),
      uom: formUom,
      locator: formLocator,
      locatorTo: formTipe === 'TRANSFER' ? formLocatorTo : undefined
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
    // Submit logic would go here (e.g., calling an API to update the sheet)
    // For now, just simulating
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
      "Kode Produk": t.kodeProduk,
      "Nama Produk": t.namaBahan,
      "Qty": t.kuantitas,
      "UOM": t.uom,
      "Locator": t.locator,
      "Target": t.locatorTo || "-",
      "Doc #": t.noDocument || "-",
      "Notes": t.keterangan || "-"
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transactions");
    XLSX.writeFile(wb, `${sheetName}_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const uniqueLocatorsFromTable = useMemo(() => Array.from(new Set(transactions.map(t => t.locator))).filter(Boolean).sort(), [transactions]);
  const uniqueLocatorTosFromTable = useMemo(() => Array.from(new Set(transactions.map(t => t.locatorTo))).filter(Boolean).sort(), [transactions]);

  const getLocatorDisplayName = (code: string) => {
    return locatorsMap.get(code)?.nama || code;
  };

  const filteredProductsForDropdown = useMemo(() => {
    if (!productSearchQuery) return [];
    const q = productSearchQuery.toLowerCase();
    const results: any[] = [];
    productsMap.forEach((name, code) => {
      if (code.toLowerCase().includes(q) || name.toLowerCase().includes(q)) {
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
                               <td className="px-8 py-4 text-xs font-bold">{item.namaBahan}</td>
                               <td className="px-4 py-4 text-sm font-black text-right">{item.kuantitas.toLocaleString()}</td>
                               <td className="px-4 py-4 text-center text-[10px] font-black uppercase">{item.locator} {item.locatorTo ? `→ ${item.locatorTo}` : ''}</td>
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

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden flex flex-col min-h-[600px]">
         <div className="p-8 border-b border-slate-100 bg-slate-50/30 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
               <div className="space-y-1">
                  <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-3">
                    <FileText className="w-6 h-6 text-blue-600" /> Ledger
                  </h3>
               </div>
               <div className="flex flex-wrap items-center gap-4">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-xl text-sm" />
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
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase">Doc #</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                  {paginated.map((t, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                       <td className="px-8 py-4 text-[10px] font-bold">{displayTanggalIndonesian(t.tanggal)}</td>
                       <td className="px-4 py-4">
                          <div className="text-[10px] font-black text-slate-400">{t.kodeProduk}</div>
                          <div className="text-xs font-bold text-slate-900">{t.namaBahan}</div>
                       </td>
                       <td className="px-4 py-4 text-right text-sm font-black">{t.kuantitas.toLocaleString()}</td>
                       <td className="px-4 py-4 text-[10px] font-bold uppercase">{t.locator} {t.locatorTo ? `→ ${t.locatorTo}` : ''}</td>
                       <td className="px-4 py-4">
                          <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase", (t.tipe||'').includes('IN') ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')}>
                            {t.tipe}
                          </span>
                       </td>
                       <td className="px-8 py-4 text-[10px] font-mono">{t.noDocument}</td>
                    </tr>
                  ))}
               </tbody>
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
