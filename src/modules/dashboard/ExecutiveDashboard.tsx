import { useMemo, useEffect } from 'react';
import type { StockSummary } from '../../shared/types';
import { CONFIG } from '../../config';
import { cn, formatNumber } from '../../shared/utils';
import { Package, MapPin, Layers, TrendingUp, TrendingDown, AlertTriangle, RefreshCw, Bot, Clock, ShieldAlert } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ExecutiveDashboardProps {
  stockSummary: StockSummary[];
  allTransactions: any[];
  area: string;
  loading: boolean;
  onRefresh: () => void;
  onNavigateToTab: (tabId: string) => void;
  userRole?: string;
  username?: string;
}

export default function ExecutiveDashboard({
  stockSummary,
  allTransactions,
  area,
  loading,
  onRefresh,
  onNavigateToTab,
  userRole,
  username
}: ExecutiveDashboardProps) {

  // Auto-Reload / Polling System (Refresh setiap 30 detik)
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (!loading) {
        onRefresh();
      }
    }, 30000);

    return () => clearInterval(intervalId);
  }, [onRefresh, loading]);

  // 1. Calculate aggregated summary metrics
  const stats = useMemo(() => {
    const uniqueProducts = new Set(stockSummary.map(s => s.kodeProduk || s.namaProduk)).size;
    const uniqueLocators = new Set(stockSummary.map(s => s.whGroup)).size;
    
    let totalStock = 0;
    stockSummary.forEach(item => {
      totalStock += item.stock;
    });

    const lowStockItems = stockSummary.filter(item => item.stock > 0 && item.stock <= CONFIG.DEFAULT_MIN_STOCK);

    return {
      uniqueProducts,
      uniqueLocators,
      totalStock,
      lowStockCount: lowStockItems.length,
      lowStockList: lowStockItems.slice(0, 5),
    };
  }, [stockSummary]);

  // 2. Extract recent activities
  const recentActivities = useMemo(() => {
    return allTransactions
      .slice(0, 8)
      .map((t, idx) => ({
        id: idx,
        namaProduk: t.pName,
        locator: t.lCode,
        qty: t.qty,
        tipe: t.tipe || 'IN',
        source: t.source || 'INPUT',
        timestamp: t.tanggal || 'Hari Ini'
      }));
  }, [allTransactions]);

  // 3. Chart data
  const chartData = useMemo(() => {
    return stockSummary
      .filter(item => item.stock > 0)
      .sort((a, b) => b.stock - a.stock)
      .slice(0, 10)
      .map(item => ({
        name: item.namaProduk.length > 15 ? item.namaProduk.substring(0, 15) + '...' : item.namaProduk,
        stock: item.stock
      }));
  }, [stockSummary]);

  return (
    <div className="space-y-6">
      {/* Upper Title Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Executive Dashboard</h2>
          <p className="text-sm text-slate-500 mt-1">
            Status logistik dan pergudangan area <span className="font-bold text-blue-600">{area}</span> secara real-time.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Badge Monitoring Super Admin */}
          {userRole === 'ALL' && username && (
            <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg shadow-sm">
               <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
               <span className="text-xs font-bold text-slate-700 tracking-wide uppercase">
                 Active Admin: {username}
               </span>
            </div>
          )}

          <button
            onClick={onRefresh}
            disabled={loading}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-sm"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Sync Real-Time
          </button>
        </div>
      </div>

      {/* Main KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI: Total Produk */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-blue-200 transition-colors group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Produk</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1 tracking-tight">{formatNumber(stats.uniqueProducts)}</h3>
            </div>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-110 transition-transform">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <button onClick={() => onNavigateToTab('produk')} className="text-left text-xs font-bold text-blue-600 hover:text-blue-700 mt-3 flex items-center gap-1">
            Lihat daftar produk &rarr;
          </button>
        </div>

        {/* KPI: Total Locator */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-indigo-200 transition-colors group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Locator</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1 tracking-tight">{formatNumber(stats.uniqueLocators)}</h3>
            </div>
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl group-hover:scale-110 transition-transform">
              <MapPin className="w-5 h-5" />
            </div>
          </div>
          <button onClick={() => onNavigateToTab('locator')} className="text-left text-xs font-bold text-indigo-600 hover:text-indigo-700 mt-3 flex items-center gap-1">
            Petakan tata ruang &rarr;
          </button>
        </div>

        {/* KPI: Total Stok */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-emerald-200 transition-colors group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Stok Akumulatif</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1 tracking-tight">{formatNumber(stats.totalStock)}</h3>
            </div>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-110 transition-transform">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <button onClick={() => onNavigateToTab('stock')} className="text-left text-xs font-bold text-emerald-600 hover:text-emerald-700 mt-3 flex items-center gap-1">
            Lihat rincian saldo &rarr;
          </button>
        </div>

        {/* KPI: Stok Minimum Alert */}
        <div className={cn(
          "p-5 rounded-2xl border shadow-sm flex flex-col justify-between transition-colors group",
          stats.lowStockCount > 0 
            ? "bg-rose-50 border-rose-100 text-rose-950 hover:bg-rose-100/50" 
            : "bg-white border-slate-200 hover:border-emerald-100"
        )}>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Stok Minimum Alert</p>
              <h3 className={cn("text-2xl font-black mt-1 tracking-tight", stats.lowStockCount > 0 ? "text-rose-600" : "text-emerald-600")}>
                {stats.lowStockCount > 0 ? `${stats.lowStockCount} Peringatan` : "0 Kritikal"}
              </h3>
            </div>
            <div className={cn(
              "p-2.5 rounded-xl group-hover:scale-110 transition-transform",
              stats.lowStockCount > 0 ? "bg-rose-100 text-rose-650 animate-pulse" : "bg-emerald-50 text-emerald-600"
            )}>
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <span className="text-xs font-medium text-slate-500 mt-3">
            {stats.lowStockCount > 0 ? `Terdapat barang segera habis!` : `Seluruh stok dalam kondisi aman`}
          </span>
        </div>
      </div>

      {/* Primary Row: Chart & Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div>
              <h4 className="font-extrabold text-slate-900 text-base">Top 10 Sebaran Saldo Produk</h4>
              <p className="text-xs text-slate-500 mt-0.5">Produk dengan kuantitas stok rill terbanyak saat ini</p>
            </div>
          </div>

          <div className="h-80 w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', borderColor: '#e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    labelStyle={{ fontWeight: 'bold', color: '#0f172a' }}
                  />
                  <Bar dataKey="stock" fill="#3b82f6" name="Stok Rill" radius={[6, 6, 0, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 italic text-sm">
                Tidak ada data stok rill positif untuk disajikan dalam grafik.
              </div>
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="border-b border-slate-100 pb-3 mb-4">
            <h4 className="font-extrabold text-slate-900 text-base">Aktivitas & Alur Barang</h4>
          </div>
          <div className="flex-1 overflow-y-auto max-h-80 pr-1 space-y-3">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mb-2 text-slate-300" />
                <span className="text-xs">Menyinkronkan feed...</span>
              </div>
            ) : recentActivities.length > 0 ? (
              recentActivities.map((act) => (
                <div key={act.id} className="flex gap-3 text-xs items-start border-b border-slate-50 pb-2.5 last:border-0 last:pb-0">
                  <div className={cn("p-1.5 rounded-lg shrink-0 mt-0.5", act.tipe === 'OUT' ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600")}>
                    {act.tipe === 'OUT' ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 leading-tight truncate">{act.namaProduk}</p>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                      <span className="font-semibold text-slate-500 bg-slate-100 px-1 rounded">{act.locator}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center h-48 text-slate-400 italic text-xs">Belum ada transaksi.</div>
            )}
          </div>
        </div>
      </div>
      {/* (Bottom section remains as your original code, shortened for brevity here) */}
    </div>
  );
}