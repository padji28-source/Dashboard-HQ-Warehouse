import { useEffect, useState, type FormEvent } from 'react';
import { fetchSheetData, appendSheetRow } from '../lib/sheets';
import type { Transaction, Product, Locator } from '../types';
import { Loader2, Plus, Search, Package, MapPin, Calendar, FileText, Hash, ArrowDownRight, ArrowUpRight, CheckCircle2, ArrowRightLeft, FileDigit } from 'lucide-react';

interface Props {
  spreadsheetId: string;
  sheetName: string;
  title: string;
  description: string;
}

export default function TransactionInput({ spreadsheetId, sheetName, title, description }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [locators, setLocators] = useState<Locator[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]); // YYYY-MM-DD format for date input
  const [tipe, setTipe] = useState<'IN' | 'OUT' | 'AWAL'>('IN');
  const [kodeProduk, setKodeProduk] = useState('');
  const [locatorAsal, setLocatorAsal] = useState('');
  const [locatorTujuan, setLocatorTujuan] = useState('');
  const [kuantitas, setKuantitas] = useState(1);
  const [noDocument, setNoDocument] = useState('');
  const [keterangan, setKeterangan] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [txRows, pRows, lRows] = await Promise.all([
        fetchSheetData(spreadsheetId, `'${sheetName}'!A2:J`),
        fetchSheetData(spreadsheetId, "'MASTER_PRODUK'!A2:C"), // Need Satuan (UOM)
        fetchSheetData(spreadsheetId, "'MASTER_LOCATOR'!A2:E")
      ]);

      setTransactions(txRows
        .filter((r: any[]) => r.length > 0 && (r[0] || r[1] || r[9]))
        .map((r: any[]) => ({
          tanggal: String(r[0] || ''),
          namaBahan: String(r[1] || ''),
          kuantitas: parseFloat(String(r[2] || '0').replace(',', '.')) || 0,
          uom: String(r[3] || ''),
          tipe: String(r[4] || '').trim().toUpperCase() as 'IN'|'OUT'|'AWAL',
          locator: String(r[5] || ''),
          locatorTo: String(r[6] || ''),
          noDocument: String(r[7] || ''),
          keterangan: String(r[8] || ''),
          kodeProduk: String(r[9] || '')
        }))
        .reverse()
      );

      const uniqueP = Array.from(new Map(pRows.filter((r: any[]) => r.length > 0 && r[0]).map((r: any[]) => [String(r[0]), { kode: String(r[0]), nama: String(r[1] || ''), satuan: String(r[2] || ''), kategori: '' }])).values());
      const uniqueL = Array.from(new Map(lRows.filter((r: any[]) => r.length > 0 && r[0]).map((r: any[]) => [String(r[0]), { whGroup: String(r[0]), nama: String(r[1] || ''), deskripsi: String(r[2] || ''), whType: String(r[3] || ''), area: String(r[4] || '') }])).values());

      setProducts(uniqueP as Product[]);
      setLocators(uniqueL as Locator[]);

    } catch (err: any) {
      alert(`Gagal memuat transaksi dari ${sheetName}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [spreadsheetId, sheetName]);

  const formatTanggal = (isoDate: string) => {
    const parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate;
    const y = parts[0].slice(2);
    const m = parts[1];
    const d = parts[2];
    return `${m}/${d}/${y}`; // Mm/Dd/Yy
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!kodeProduk || !locatorAsal || kuantitas <= 0) return;
    setSubmitting(true);
    try {
      const selectedProduct = products.find(p => p.kode === kodeProduk);
      const namaBahan = selectedProduct?.nama || kodeProduk;
      const uom = selectedProduct?.satuan || 'Pcs';
      const fTanggal = formatTanggal(tanggal);

      const rowsToAppend = [];
      
      // format: Tanggal | Nama Bahan | Qty | UOM | I/O/A | Locator | Locator To | No. Document | Keterangan | Kode
      if (tipe === 'OUT' && locatorTujuan && locatorTujuan !== locatorAsal) {
        rowsToAppend.push([fTanggal, namaBahan, kuantitas.toString(), uom, 'OUT', locatorAsal, locatorTujuan, noDocument, keterangan ? `${keterangan} (Transfer ke ${locatorTujuan})` : `Transfer ke ${locatorTujuan}`, kodeProduk]);
        rowsToAppend.push([fTanggal, namaBahan, kuantitas.toString(), uom, 'IN', locatorTujuan, '', noDocument, keterangan ? `${keterangan} (Transfer dari ${locatorAsal})` : `Transfer dari ${locatorAsal}`, kodeProduk]);
      } else {
        rowsToAppend.push([fTanggal, namaBahan, kuantitas.toString(), uom, tipe, locatorAsal, '', noDocument, keterangan, kodeProduk]);
      }

      await appendSheetRow(spreadsheetId, `'${sheetName}'!A:J`, rowsToAppend);
      setFormOpen(false);
      setKodeProduk(''); setLocatorAsal(''); setLocatorTujuan(''); setKuantitas(1); setNoDocument(''); setKeterangan('');
      await loadData();
    } catch (err: any) {
      alert(`Gagal menyimpan transaksi: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const filtered = transactions.filter(t => 
    t.kodeProduk.toLowerCase().includes(search.toLowerCase()) || 
    t.namaBahan.toLowerCase().includes(search.toLowerCase()) || 
    t.locator.toLowerCase().includes(search.toLowerCase()) ||
    t.noDocument.toLowerCase().includes(search.toLowerCase()) ||
    t.keterangan.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h2>
          <p className="text-sm text-slate-500 mt-1">{description}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadData} className="px-4 py-2 border border-slate-200 bg-white rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-200">
            Refresh Data
          </button>
          <button 
            onClick={() => setFormOpen(!formOpen)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-2 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <Plus className={`w-4 h-4 transition-transform ${formOpen ? 'rotate-45' : ''}`} /> {formOpen ? 'Batal' : 'Tambah Transaksi'}
          </button>
        </div>
      </div>

      {formOpen && (
        <div className="bg-white rounded-xl shadow-sm border border-blue-100 overflow-hidden animate-in fade-in duration-300">
          <div className="bg-blue-50/50 px-6 py-4 border-b border-blue-100 flex items-center gap-3">
             <div className="p-2 bg-blue-100 rounded-lg text-blue-700">
               <ArrowRightLeft className="w-5 h-5" />
             </div>
             <div>
               <h3 className="text-lg font-semibold text-slate-900">Form Transaksi Baru ({sheetName})</h3>
               <p className="text-xs text-slate-500">Pilih tipe transaksi dan lengkapi rincian di bawah ini.</p>
             </div>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Calendar className="w-4 h-4 text-slate-400" /> Tanggal
                </label>
                <input required type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none" />
              </div>
              
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <ArrowRightLeft className="w-4 h-4 text-slate-400" /> Tipe Transaksi
                </label>
                <select value={tipe} onChange={e => {setTipe(e.target.value as 'IN'|'OUT'|'AWAL'); setLocatorTujuan('')}} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none">
                  <option value="IN">Masuk (IN)</option>
                  <option value="OUT">Keluar (OUT)</option>
                  <option value="AWAL">Saldo Awal (AWAL)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Package className="w-4 h-4 text-slate-400" /> Produk
                </label>
                <select required value={kodeProduk} onChange={e => setKodeProduk(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none">
                  <option value="">-- Pilih Produk --</option>
                  {products.map(p => <option key={p.kode} value={p.kode}>[{p.kode}] {p.nama}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <MapPin className="w-4 h-4 text-slate-400" /> Locator {tipe === 'OUT' ? 'Asal' : ''}
                </label>
                <select required value={locatorAsal} onChange={e => setLocatorAsal(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none">
                  <option value="">-- Pilih Locator --</option>
                  {locators.map(l => <option key={l.whGroup} value={l.whGroup}>[{l.whGroup}] {l.nama}</option>)}
                </select>
              </div>

              {tipe === 'OUT' && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-left-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-blue-700">
                    <MapPin className="w-4 h-4 text-blue-500" /> Locator Tujuan (Opsional)
                  </label>
                  <select value={locatorTujuan} onChange={e => setLocatorTujuan(e.target.value)} className="w-full px-3 py-2 border border-blue-200 rounded-lg bg-blue-50/30 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none">
                    <option value="">-- Bukan Transfer --</option>
                    {locators.map(l => <option key={l.whGroup} value={l.whGroup} disabled={l.whGroup === locatorAsal}>[{l.whGroup}] {l.nama}</option>)}
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Hash className="w-4 h-4 text-slate-400" /> Kuantitas
                </label>
                <input required type="number" min="0.01" step="0.01" value={kuantitas} onChange={e => setKuantitas(parseFloat(e.target.value))} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none" placeholder="0" />
              </div>

              <div className="space-y-1.5 ">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <FileDigit className="w-4 h-4 text-slate-400" /> No. Document
                </label>
                <input type="text" value={noDocument} onChange={e => setNoDocument(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none" placeholder="No. Dokumen..." />
              </div>

              <div className="md:col-span-2 lg:col-span-2 space-y-1.5">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <FileText className="w-4 h-4 text-slate-400" /> Keterangan Catatan
                </label>
                <input type="text" value={keterangan} onChange={e => setKeterangan(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none" placeholder="Tambahkan catatan jika diperlukan..." />
              </div>
            </div>
            
            <div className="pt-6 mt-6 border-t border-slate-100 flex justify-end gap-3">
              <button disabled={submitting} type="submit" className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin"/> : <CheckCircle2 className="w-4 h-4" />} Simpan Transaksi {tipe === 'OUT' && locatorTujuan ? '& Transfer' : ''}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 flex items-center bg-slate-50/50">
           <div className="relative max-w-sm w-full">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
             <input type="text" placeholder="Cari transaksi (produk, locator, dokumen)..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
           </div>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-16 flex flex-col items-center justify-center text-blue-600 gap-3">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="text-sm font-medium text-slate-500">Memuat data transaksi dari {sheetName}...</p>
            </div>
          ) : (<>
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="px-5 py-3.5 font-semibold text-xs tracking-wider uppercase">Tanggal</th>
                  <th className="px-5 py-3.5 font-semibold text-xs tracking-wider uppercase">Nama Bahan</th>
                  <th className="px-5 py-3.5 font-semibold text-xs tracking-wider uppercase text-right">Qty</th>
                  <th className="px-5 py-3.5 font-semibold text-xs tracking-wider uppercase">UOM</th>
                  <th className="px-5 py-3.5 font-semibold text-xs tracking-wider uppercase">I/O/A</th>
                  <th className="px-5 py-3.5 font-semibold text-xs tracking-wider uppercase">Locator</th>
                  <th className="px-5 py-3.5 font-semibold text-xs tracking-wider uppercase">Locator To</th>
                  <th className="px-5 py-3.5 font-semibold text-xs tracking-wider uppercase">No. Document</th>
                  <th className="px-5 py-3.5 font-semibold text-xs tracking-wider uppercase">Keterangan</th>
                  <th className="px-5 py-3.5 font-semibold text-xs tracking-wider uppercase">Kode</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginated.map((t, idx) => {
                  return (
                    <tr key={idx} className="hover:bg-blue-50/30 transition-colors text-slate-700 group">
                      <td className="px-5 py-3 text-slate-500 tabular-nums">
                        <div className="flex items-center gap-2">
                           <Calendar className="w-3.5 h-3.5 text-slate-400" />
                           {t.tanggal}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="font-medium text-slate-900 group-hover:text-blue-600 transition-colors">{t.namaBahan}</div>
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-lg tabular-nums">
                        <div className={
                           t.tipe === 'IN' ? 'text-emerald-600' : 
                           t.tipe === 'OUT' ? 'text-rose-600' : 'text-slate-700'
                        }>{t.kuantitas.toLocaleString()}</div>
                      </td>
                      <td className="px-5 py-3 text-slate-500 text-sm">
                        {t.uom}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${
                           t.tipe === 'IN' ? 'bg-emerald-100 text-emerald-700' : 
                           t.tipe === 'AWAL' ? 'bg-blue-100 text-blue-700' : 
                           'bg-rose-100 text-rose-700'
                        }`}>
                          {t.tipe === 'IN' && <ArrowDownRight className="w-3 h-3" />}
                          {t.tipe === 'OUT' && <ArrowUpRight className="w-3 h-3" />}
                          {t.tipe === 'AWAL' && <CheckCircle2 className="w-3 h-3" />}
                          {t.tipe}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="font-medium text-slate-900 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {t.locator}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {t.locatorTo ? (
                          <div className="font-medium text-slate-900 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            {t.locatorTo}
                          </div>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3 font-mono text-slate-500 text-xs">
                        {t.noDocument || '-'}
                      </td>
                      <td className="px-5 py-3 text-slate-500 truncate max-w-[200px]" title={t.keterangan}>
                        {t.keterangan || <span className="text-slate-300 italic">Tidak ada catatan</span>}
                      </td>
                      <td className="px-5 py-3 font-mono text-slate-500 text-xs">
                        {t.kodeProduk}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center">
                         <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                            <Search className="w-6 h-6" />
                         </div>
                         <p className="font-medium text-slate-700">Tidak ada data transaksi</p>
                         <p className="text-sm mt-1">Coba sesuaikan filter pencarian atau tambahkan transaksi baru.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            
            {filtered.length > 0 && (
              <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
                 <div className="flex items-center gap-3 text-sm text-slate-600">
                   <div className="flex items-center gap-2">
                     Tampilkan
                     <select 
                       value={pageSize} 
                       onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                       className="border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm cursor-pointer"
                     >
                       <option value={10}>10</option>
                       <option value={50}>50</option>
                       <option value={100}>100</option>
                       <option value={10000}>Semua</option>
                     </select>
                     baris
                   </div>
                   <div className="hidden sm:block text-slate-300">|</div>
                   <span className="hidden sm:block">Menampilkan {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filtered.length)} dari {filtered.length} transaksi</span>
                 </div>
                 <div className="flex items-center gap-1">
                   <button 
                     onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                     disabled={currentPage === 1}
                     className="px-4 py-1.5 border border-slate-200 rounded-lg bg-white text-sm font-medium text-slate-600 disabled:opacity-40 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                   >
                     Sebelumnya
                   </button>
                   <button 
                     onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                     disabled={currentPage === totalPages || totalPages === 0}
                     className="px-4 py-1.5 border border-slate-200 rounded-lg bg-white text-sm font-medium text-slate-600 disabled:opacity-40 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
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

