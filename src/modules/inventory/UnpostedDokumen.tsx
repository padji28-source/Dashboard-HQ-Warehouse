import { useState, useEffect, useMemo, memo } from 'react';
import { 
  FileText, 
  Search, 
  RefreshCw, 
  Filter, 
  Download, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Layers, 
  ChevronLeft, 
  ChevronRight, 
  MapPin, 
  User, 
  Calendar, 
  FileCheck,
  Building2,
  FileSpreadsheet
} from 'lucide-react';
import { fetchUnpostedDocuments, filterDocsByArea, UnpostedDoc } from '../../lib/unpostedService';
import { AREAS } from '../../App';

interface Props {
  area: string;
  userRole?: string;
  activeUsername?: string;
}

const MENU_ICONS: Record<string, string> = {
  'Sales Order': '🛍️',
  'Shipment': '🚚',
  'Customer Return': '↩️',
  'Inventory Move': '📦',
  'Material Receipt': '📥',
  'Purchase Order': '🛒',
  'Purchase Requisition': '📝',
  'Production': '🏭',
  'Physical Inventory': '📋',
  'Route': '🗺️',
  'Vendor Return': '🏬'
};

const UnpostedDokumen = memo(function UnpostedDokumen({ area, userRole = '', activeUsername = '' }: Props) {
  const [documents, setDocuments] = useState<UnpostedDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMenu, setSelectedMenu] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [filterArea, setFilterArea] = useState<string>(area);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const usernameLower = (activeUsername || '').toLowerCase();
  const isAdminA5 = usernameLower === 'admina5';
  const isSuperAdmin = userRole === 'ALL' || usernameLower === 'admin' || isAdminA5;
  const isHQ = userRole === 'HQ' || userRole === 'All Cabang' || usernameLower === 'hq' || usernameLower === 'admin_hq' || area === 'All Cabang' || area === 'HQ';
  const isPPICorMP = usernameLower === 'ppic' || usernameLower === 'mp' || userRole.toUpperCase().includes('PPIC') || userRole.toUpperCase().includes('MP');
  const isSuperAdminOrHq = isSuperAdmin || isHQ || isPPICorMP;

  useEffect(() => {
    setFilterArea(area);
  }, [area]);

  const loadData = async (forceFresh = false) => {
    try {
      if (forceFresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const docs = await fetchUnpostedDocuments(forceFresh);
      setDocuments(docs);
    } catch (err: any) {
      console.error('Error loading unposted documents:', err);
      setError(err.message || 'Gagal memuat data Unposted Dokumen dari Google Sheets.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter docs by area based on user permissions
  const areaFilteredDocs = useMemo(() => {
    return filterDocsByArea(documents, filterArea, isSuperAdminOrHq && filterArea === 'All Cabang');
  }, [documents, filterArea, isSuperAdminOrHq]);

  // Calculate QTY counts for each menu
  const menuStats = useMemo(() => {
    const counts: Record<string, number> = {};
    let totalDocs = 0;

    areaFilteredDocs.forEach(doc => {
      counts[doc.menu] = (counts[doc.menu] || 0) + 1;
      totalDocs++;
    });

    // Sort menu items by count descending
    const sortedMenus = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, qty]) => ({ name, qty }));

    return { totalDocs, sortedMenus, rawCounts: counts };
  }, [areaFilteredDocs]);

  // Apply search and dropdown filters
  const filteredDocuments = useMemo(() => {
    return areaFilteredDocs.filter(doc => {
      // Menu filter
      if (selectedMenu !== 'ALL' && doc.menu !== selectedMenu) return false;
      
      // Status filter
      if (selectedStatus !== 'ALL' && doc.documentStatus !== selectedStatus) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchDocNo = doc.documentNo.toLowerCase().includes(query);
        const matchUser = doc.createdBy.toLowerCase().includes(query);
        const matchMenu = doc.menu.toLowerCase().includes(query);
        const matchArea = doc.area.toLowerCase().includes(query);
        const matchDate = doc.documentDate.toLowerCase().includes(query);
        if (!matchDocNo && !matchUser && !matchMenu && !matchArea && !matchDate) return false;
      }

      return true;
    });
  }, [areaFilteredDocs, selectedMenu, selectedStatus, searchQuery]);

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedMenu, selectedStatus, filterArea]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredDocuments.length / pageSize) || 1;
  const paginatedDocs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDocuments.slice(start, start + pageSize);
  }, [filteredDocuments, currentPage, pageSize]);

  // Export CSV
  const handleExportCSV = () => {
    if (filteredDocuments.length === 0) return;

    const headers = ['Menu', 'Document Status', 'Created By', 'Documentno', 'Document Date', 'Area'];
    const rows = filteredDocuments.map(d => [
      `"${d.menu}"`,
      `"${d.documentStatus}"`,
      `"${d.createdBy}"`,
      `"${d.documentNo}"`,
      `"${d.documentDate}"`,
      `"${d.area}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Unposted_Dokumen_${filterArea.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Clock className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Unposted Dokumen</h2>
            <span className="px-2.5 py-0.5 text-xs font-bold bg-amber-100 text-amber-800 rounded-full border border-amber-200">
              {menuStats.totalDocs} Dokumen Outstanding
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Monitoring dokumen outstanding (Draft & In Progress) dari iDempiere sheet <span className="font-semibold text-slate-700">Tarikan</span>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Area Filter Selector (for HQ & Super Admin) */}
          {isSuperAdminOrHq && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 shadow-xs">
              <MapPin className="w-4 h-4 text-blue-500 shrink-0" />
              <span className="text-xs font-bold text-slate-500 uppercase">Area:</span>
              <select
                value={filterArea}
                onChange={(e) => setFilterArea(e.target.value)}
                className="bg-transparent text-slate-900 font-bold text-xs sm:text-sm focus:outline-none cursor-pointer pr-1"
              >
                {AREAS.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          )}

          {/* Refresh Button */}
          <button
            onClick={() => loadData(true)}
            disabled={refreshing || loading}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-all disabled:opacity-50 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Sync Real-Time</span>
          </button>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            disabled={filteredDocuments.length === 0}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-all disabled:opacity-50 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* QTY Masing Masing Menu (Metric Cards Grid) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Qty Masing-Masing Menu</h3>
          </div>
          <span className="text-xs text-slate-500">
            Klik kartu menu untuk memfilter tabel
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[...Array(6)].map((_, idx) => (
              <div key={idx} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {/* "Semua Menu" Summary Card */}
            <button
              onClick={() => setSelectedMenu('ALL')}
              className={`p-4 rounded-2xl border text-left transition-all duration-200 shadow-xs flex flex-col justify-between ${
                selectedMenu === 'ALL'
                  ? 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-400/50 shadow-md'
                  : 'bg-white hover:bg-slate-50 text-slate-900 border-slate-200 hover:border-blue-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xl">📊</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                  selectedMenu === 'ALL' ? 'bg-blue-500/40 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  Total
                </span>
              </div>
              <div className="mt-2">
                <div className={`text-2xl font-black ${selectedMenu === 'ALL' ? 'text-white' : 'text-slate-900'}`}>
                  {menuStats.totalDocs.toLocaleString('id-ID')}
                </div>
                <div className={`text-xs font-bold truncate mt-0.5 ${selectedMenu === 'ALL' ? 'text-blue-100' : 'text-slate-600'}`}>
                  Semua Menu
                </div>
              </div>
            </button>

            {/* Menu specific cards */}
            {menuStats.sortedMenus.map(({ name, qty }) => {
              const isSelected = selectedMenu === name;
              const icon = MENU_ICONS[name] || '📄';
              const percent = menuStats.totalDocs > 0 ? ((qty / menuStats.totalDocs) * 100).toFixed(1) : '0';

              return (
                <button
                  key={name}
                  onClick={() => setSelectedMenu(isSelected ? 'ALL' : name)}
                  className={`p-4 rounded-2xl border text-left transition-all duration-200 shadow-xs flex flex-col justify-between ${
                    isSelected
                      ? 'bg-amber-500 text-white border-amber-500 ring-2 ring-amber-400/50 shadow-md'
                      : 'bg-white hover:bg-slate-50 text-slate-900 border-slate-200 hover:border-amber-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xl">{icon}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isSelected ? 'bg-amber-600/40 text-white' : 'bg-amber-50 text-amber-700 border border-amber-100'
                    }`}>
                      {percent}%
                    </span>
                  </div>
                  <div className="mt-2">
                    <div className={`text-2xl font-black ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                      {qty.toLocaleString('id-ID')}
                    </div>
                    <div className={`text-xs font-bold truncate mt-0.5 ${isSelected ? 'text-amber-50' : 'text-slate-700'}`} title={name}>
                      {name}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Filter Controls Bar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari Documentno, User Created By, atau Area..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Menu Dropdown */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={selectedMenu}
                onChange={(e) => setSelectedMenu(e.target.value)}
                className="bg-transparent text-xs font-medium text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="ALL">Semua Menu ({areaFilteredDocs.length})</option>
                {Object.keys(menuStats.rawCounts).sort().map(m => (
                  <option key={m} value={m}>
                    {m} ({menuStats.rawCounts[m]})
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Status Dropdown */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs">
              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-transparent text-xs font-medium text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="ALL">Semua Status</option>
                <option value="Draft">Draft</option>
                <option value="In Progress">In Progress</option>
              </select>
            </div>

            {/* Clear Filters Button */}
            {(searchQuery || selectedMenu !== 'ALL' || selectedStatus !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedMenu('ALL');
                  setSelectedStatus('ALL');
                }}
                className="text-xs font-bold text-rose-600 hover:text-rose-700 px-2 py-1 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors"
              >
                Reset Filter
              </button>
            )}
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/70 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Menu</th>
                <th className="py-3 px-4">Document Status</th>
                <th className="py-3 px-4">Created By</th>
                <th className="py-3 px-4">Documentno</th>
                <th className="py-3 px-4">Document Date</th>
                <th className="py-3 px-4">Area</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                      <span className="font-medium text-sm">Memuat data Unposted Dokumen...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedDocs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="w-8 h-8 text-slate-300" />
                      <span className="font-bold text-slate-700 text-base">Tidak ada dokumen ditemukan</span>
                      <p className="text-xs text-slate-500 max-w-sm">
                        {searchQuery || selectedMenu !== 'ALL' || selectedStatus !== 'ALL'
                          ? 'Coba atur ulang kata kunci pencarian atau filter yang Anda gunakan.'
                          : `Tidak ada dokumen unposted untuk area ${filterArea}.`}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Menu */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 font-bold text-slate-900">
                        <span>{MENU_ICONS[doc.menu] || '📄'}</span>
                        <span>{doc.menu}</span>
                      </div>
                    </td>

                    {/* Document Status */}
                    <td className="py-3 px-4">
                      {doc.documentStatus.toLowerCase() === 'draft' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Draft
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          {doc.documentStatus}
                        </span>
                      )}
                    </td>

                    {/* Created By */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 font-medium text-slate-800">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{doc.createdBy}</span>
                      </div>
                    </td>

                    {/* Documentno */}
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 tracking-tight">
                        {doc.documentNo}
                      </span>
                    </td>

                    {/* Document Date */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{doc.documentDate}</span>
                      </div>
                    </td>

                    {/* Area */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        <MapPin className="w-3 h-3 text-blue-500" />
                        {doc.area}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer Pagination */}
        {!loading && filteredDocuments.length > 0 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span>Menampilkan {Math.min((currentPage - 1) * pageSize + 1, filteredDocuments.length)} - {Math.min(currentPage * pageSize, filteredDocuments.length)} dari <strong>{filteredDocuments.length}</strong> dokumen</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold focus:outline-none"
              >
                <option value={25}>25 per halaman</option>
                <option value={50}>50 per halaman</option>
                <option value={100}>100 per halaman</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <span className="px-3 font-semibold text-slate-800">
                Halaman {currentPage} dari {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default UnpostedDokumen;
