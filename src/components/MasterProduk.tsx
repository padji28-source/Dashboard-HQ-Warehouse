import { useEffect, useState, type FormEvent } from 'react';
import { fetchSheetData, appendSheetRow } from '../lib/sheets';
import type { Product } from '../types';
import { Loader2, Plus, Search } from 'lucide-react';

export default function MasterProduk({ spreadsheetId }: { spreadsheetId: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [kode, setKode] = useState('');
  const [nama, setNama] = useState('');
  const [satuan, setSatuan] = useState('');
  const [kategori, setKategori] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const rows = await fetchSheetData(spreadsheetId, "'MASTER_PRODUK'!A2:D");
      setProducts(rows.filter((r: any[]) => r.length > 0 && (r[0] || r[1])).map((r: any[]) => ({
        kode: String(r[0] || ''),
        nama: String(r[1] || ''),
        satuan: String(r[2] || ''),
        kategori: String(r[3] || '')
      })));
    } catch (err: any) {
      alert(`Gagal memuat produk: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [spreadsheetId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!kode || !nama) return;
    setSubmitting(true);
    try {
      await appendSheetRow(spreadsheetId, "'MASTER_PRODUK'!A:D", [
        [kode, nama, satuan, kategori]
      ]);
      setFormOpen(false);
      setKode(''); setNama(''); setSatuan(''); setKategori('');
      await loadData();
    } catch (err: any) {
      alert(`Gagal menyimpan produk: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const filtered = products.filter(p => 
    p.kode.toLowerCase().includes(search.toLowerCase()) || 
    p.nama.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Master Produk</h2>
          <p className="text-sm text-slate-500">Kelola daftar produk yang ada di sistem.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadData} className="px-4 py-2 border border-slate-200 bg-white rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            Refresh
          </button>
          <button 
            onClick={() => setFormOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" /> Tambah Produk
          </button>
        </div>
      </div>

      {formOpen && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-4">
          <h3 className="text-lg font-semibold mb-4">Tambah Produk Baru</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Kode Produk</label>
              <input required type="text" value={kode} onChange={e => setKode(e.target.value)} className="w-full px-3 py-2 border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nama Produk</label>
              <input required type="text" value={nama} onChange={e => setNama(e.target.value)} className="w-full px-3 py-2 border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Satuan (UOM)</label>
              <input type="text" value={satuan} onChange={e => setSatuan(e.target.value)} className="w-full px-3 py-2 border rounded-md placeholder:text-slate-400" placeholder="pcs, kg, liter..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Kategori</label>
              <input type="text" value={kategori} onChange={e => setKategori(e.target.value)} className="w-full px-3 py-2 border rounded-md" />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-3 mt-2">
              <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900">Batal</button>
              <button disabled={submitting} type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
                {submitting && <Loader2 className="w-4 h-4 animate-spin"/>} Simpan
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100">
           <div className="relative max-w-md">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
             <input type="text" placeholder="Cari produk..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
           </div>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 flex justify-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : (<>
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="px-5 py-4 font-medium">Kode</th>
                  <th className="px-5 py-4 font-medium">Nama Produk</th>
                  <th className="px-5 py-4 font-medium">Satuan</th>
                  <th className="px-5 py-4 font-medium">Kategori</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginated.map((p, idx) => (
                  <tr key={`${p.kode}-${idx}`} className="hover:bg-blue-50/40 transition-colors text-slate-700">
                    <td className="px-5 py-4 font-mono text-xs text-slate-500">{p.kode}</td>
                    <td className="px-5 py-4 font-medium text-slate-900">{p.nama}</td>
                    <td className="px-5 py-4">{p.satuan || '-'}</td>
                    <td className="px-5 py-4 px-4 py-3"><span className="inline-flex bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md text-xs font-medium">{p.kategori || 'Uncategorized'}</span></td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={4} className="p-12 text-center text-slate-500">Tidak ada data produk ditemukan.</td></tr>
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
