import { useEffect, useState, type FormEvent } from 'react';
import { fetchSheetData, appendSheetRow } from '../lib/sheets';
import type { Locator } from '../types';
import { Loader2, Plus, Search } from 'lucide-react';

export default function MasterLocator({ spreadsheetId }: { spreadsheetId: string }) {
  const [locators, setLocators] = useState<Locator[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [whGroup, setWhGroup] = useState('');
  const [nama, setNama] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [whType, setWhType] = useState('');
  const [area, setArea] = useState('');

  const loadData = async (retryOnMissing = true) => {
    try {
      setLoading(true);
      let rows: any[] = [];
      try {
        rows = await fetchSheetData(spreadsheetId, "'MASTER_LOCATOR'!A2:E");
      } catch (fetchErr: any) {
        const errorMsg = String(fetchErr.message || '').toLowerCase();
        const isMissingSheet = errorMsg.includes('not found') || errorMsg.includes('range') || errorMsg.includes('unparseable') || errorMsg.includes('cannot read');
        
        if (retryOnMissing && isMissingSheet) {
          console.log("MASTER_LOCATOR sheet not found, trying auto-init...");
          try {
            const { initializeERPSpreadsheet } = await import('../lib/sheets');
            await initializeERPSpreadsheet(spreadsheetId);
            return loadData(false);
          } catch (initErr) {
            console.error("Auto-init from MasterLocator failed:", initErr);
            throw fetchErr;
          }
        } else {
          throw fetchErr;
        }
      }
      setLocators(rows.filter((r: any[]) => r.length > 0 && (r[0] || r[1])).map((r: any[]) => ({
        whGroup: String(r[0] || ''),
        nama: String(r[1] || ''),
        deskripsi: String(r[2] || ''),
        whType: String(r[3] || ''),
        area: String(r[4] || '')
      })));
    } catch (err: any) {
      alert(`Gagal memuat locator: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [spreadsheetId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!whGroup || !nama) return;
    setSubmitting(true);
    try {
      await appendSheetRow(spreadsheetId, "'MASTER_LOCATOR'!A:E", [
        [whGroup, nama, deskripsi, whType, area]
      ]);
      setFormOpen(false);
      setWhGroup(''); setNama(''); setDeskripsi(''); setWhType(''); setArea('');
      await loadData();
    } catch (err: any) {
      alert(`Gagal menyimpan locator: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const filtered = locators.filter(p => 
    p.whGroup.toLowerCase().includes(search.toLowerCase()) || 
    p.nama.toLowerCase().includes(search.toLowerCase()) ||
    p.whType.toLowerCase().includes(search.toLowerCase()) ||
    p.area.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Master Locator</h2>
          <p className="text-sm text-slate-500">Daftar lokasi atau gudang penyimpanan.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadData} className="px-4 py-2 border border-slate-200 bg-white rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            Refresh
          </button>
          <button 
            onClick={() => setFormOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" /> Tambah Locator
          </button>
        </div>
      </div>

      {formOpen && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-4">
          <h3 className="text-lg font-semibold mb-4">Tambah Locator Baru</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">WH Group</label>
              <input required type="text" value={whGroup} onChange={e => setWhGroup(e.target.value)} className="w-full px-3 py-2 border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nama Locator</label>
              <input required type="text" value={nama} onChange={e => setNama(e.target.value)} className="w-full px-3 py-2 border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">WH Type</label>
              <input type="text" value={whType} onChange={e => setWhType(e.target.value)} className="w-full px-3 py-2 border rounded-md" placeholder="e.g., Raw Material, Finished Goods" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Area</label>
              <input type="text" value={area} onChange={e => setArea(e.target.value)} className="w-full px-3 py-2 border rounded-md" placeholder="e.g., Jakarta, Surabaya" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Deskripsi</label>
              <input type="text" value={deskripsi} onChange={e => setDeskripsi(e.target.value)} className="w-full px-3 py-2 border rounded-md" />
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
             <input type="text" placeholder="Cari WH Group, nama, tipe, area..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
           </div>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 flex justify-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : (<>
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="px-5 py-4 font-medium">WH Group</th>
                  <th className="px-5 py-4 font-medium">Nama Locator</th>
                  <th className="px-5 py-4 font-medium">WH Type</th>
                  <th className="px-5 py-4 font-medium">Area</th>
                  <th className="px-5 py-4 font-medium">Deskripsi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginated.map((l, idx) => (
                  <tr key={`${l.whGroup}-${idx}`} className="hover:bg-blue-50/40 transition-colors text-slate-700">
                    <td className="px-5 py-4 font-mono text-xs">{l.whGroup}</td>
                    <td className="px-5 py-4 font-medium text-slate-900">{l.nama}</td>
                    <td className="px-5 py-4">{l.whType || '-'}</td>
                    <td className="px-5 py-4">{l.area || '-'}</td>
                    <td className="px-5 py-4 text-slate-500">{l.deskripsi || '-'}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="p-12 text-center text-slate-500">Tidak ada data locator ditemukan.</td></tr>
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
