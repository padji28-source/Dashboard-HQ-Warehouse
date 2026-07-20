import { useMemo, memo, ComponentType } from 'react';
import type { StockSummary } from '../../shared/types';
import { cn, formatNumber } from '../../shared/utils';
import { Package, MapPin, Layers, TrendingUp, TrendingDown, AlertTriangle, RefreshCw, Clock, ShieldAlert, ChevronRight, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'motion/react';

interface DashboardCardProps {
  title: string;
  value: string | number;
  icon: ComponentType<{ className?: string }>;
  iconBgClass?: string;
  hoverBorderClass?: string;
  onClick?: () => void;
  onClickLabel?: string;
  footerText?: string;
  className?: string;
  delay?: number;
}

const DashboardCard = memo(function DashboardCard({
  title,
  value,
  icon: Icon,
  iconBgClass = "bg-blue-50 text-blue-600",
  hoverBorderClass = "hover:border-blue-200",
  onClick,
  onClickLabel,
  footerText,
  className,
  delay = 0
}: DashboardCardProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={cn(
        "bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between transition-all duration-300 group hover:shadow-md", 
        hoverBorderClass, 
        className
      )}
    >
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{title}</p>
          <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{value}</h3>
        </div>
        <div className={cn("p-3 rounded-2xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-sm", iconBgClass)}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      
      <div className="mt-6 flex items-center justify-between">
        {onClick && onClickLabel ? (
          <button 
            onClick={onClick} 
            className="text-[11px] font-bold flex items-center gap-1.5 text-slate-500 hover:text-blue-600 transition-colors group/btn"
          >
            {onClickLabel}
            <ChevronRight className="w-3 h-3 group-hover/btn:translate-x-0.5 transition-transform" />
          </button>
        ) : footerText ? (
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            {footerText}
          </span>
        ) : (
          <div className="h-4" />
        )}
      </div>
    </motion.div>
  );
});

interface StockDistributionChartProps {
  chartData: any[];
}

const StockDistributionChart = memo(function StockDistributionChart({ chartData }: StockDistributionChartProps) {
  return (
    <div className="h-[320px] w-full mt-4">
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 20 }}>
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                <stop offset="100%" stopColor="#2563eb" stopOpacity={0.8} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="name" 
              tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }} 
              axisLine={false} 
              tickLine={false}
              dy={10}
            />
            <YAxis 
              tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }} 
              axisLine={false} 
              tickLine={false} 
            />
            <Tooltip 
              cursor={{ fill: '#f8fafc' }}
              contentStyle={{ 
                borderRadius: '16px', 
                border: 'none', 
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                padding: '12px 16px'
              }}
              labelStyle={{ fontWeight: 800, color: '#0f172a', marginBottom: '4px', fontSize: '12px' }}
              itemStyle={{ fontWeight: 600, fontSize: '12px' }}
            />
            <Bar 
              dataKey="stock" 
              fill="url(#barGradient)" 
              name="Stok Rill" 
              radius={[8, 8, 0, 0]} 
              barSize={32} 
            />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-full flex items-center justify-center text-slate-400 italic text-sm">
          Tidak ada data stok rill positif untuk disajikan dalam grafik.
        </div>
      )}
    </div>
  );
});

interface ExecutiveDashboardProps {
  stockSummary: StockSummary[];
  allTransactions: any[];
  area: string;
  loading: boolean;
  onRefresh: () => void;
  onNavigateToTab: (tabId: string) => void;
}

const ExecutiveDashboard = memo(function ExecutiveDashboard({
  stockSummary,
  allTransactions,
  area,
  loading,
  onRefresh,
  onNavigateToTab
}: ExecutiveDashboardProps) {

  const stats = useMemo(() => {
    const uniqueProducts = stockSummary.length;
    const uniqueLocators = new Set(stockSummary.map(s => s.whGroup)).size;
    
    let totalStock = 0;
    let totalIn = 0;
    let totalOut = 0;

    stockSummary.forEach(item => {
      totalStock += item.stock;
      totalIn += item.totalIn;
      totalOut += item.totalOut;
    });

    const discrepancyItems = stockSummary.filter(item => Math.abs(item.selisih || 0) >= 0.001);
    const unmovedItems = stockSummary.filter(item => item.totalIn === 0 && item.totalOut === 0);

    return {
      uniqueProducts,
      uniqueLocators,
      totalStock,
      totalIn,
      totalOut,
      lowStockCount: discrepancyItems.length,
      lowStockList: discrepancyItems,
      unmovedCount: unmovedItems.length
    };
  }, [stockSummary]);

  const topTransactionProducts = useMemo(() => {
    if (stockSummary.length === 0) return [];
    const withTrans = stockSummary.map(item => ({
      ...item,
      totalTrans: item.totalIn + item.totalOut
    })).filter(item => item.totalTrans > 0);
    return withTrans.sort((a, b) => b.totalTrans - a.totalTrans).slice(0, 3);
  }, [stockSummary]);

  const recentActivities = useMemo(() => {
    return allTransactions
      .slice(0, 8)
      .map((t, idx) => ({
        id: idx,
        pName: t.pName,
        lCode: t.lCode,
        qty: t.qty,
        tipe: t.tipe || 'IN',
        source: t.source || 'INPUT',
        tanggal: t.tanggal || 'Hari Ini'
      }));
  }, [allTransactions]);

  const chartData = useMemo(() => {
    return stockSummary
      .filter(item => item.stock > 0)
      .sort((a, b) => b.stock - a.stock)
      .slice(0, 10)
      .map(item => ({
        name: item.namaProduk.length > 12 ? item.namaProduk.substring(0, 12) + '..' : item.namaProduk,
        stock: item.stock
      }));
  }, [stockSummary]);

  return (
    <div className="space-y-8 pb-12">
      {/* Header Section */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-6"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em]">Live Overview</span>
          </div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Executive Dashboard</h2>
          <p className="text-sm text-slate-500 font-medium">
            Monitor logistik area <span className="text-slate-900 font-bold">{area}</span> secara presisi dan real-time.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="group px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-2xl flex items-center gap-2.5 transition-all shadow-xl shadow-slate-900/10 disabled:opacity-50 active:scale-95"
          >
            <RefreshCw className={cn("w-4 h-4 transition-transform group-hover:rotate-180 duration-500", loading && "animate-spin")} />
            SYNCHRONIZE DATA
          </button>
        </div>
      </motion.div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <DashboardCard
          title="Total Produk SKU"
          value={formatNumber(stats.uniqueProducts)}
          icon={Package}
          iconBgClass="bg-blue-50 text-blue-600"
          hoverBorderClass="hover:border-blue-400"
          onClick={() => onNavigateToTab('produk')}
          onClickLabel="Kelola Katalog"
          delay={0.1}
        />
        <DashboardCard
          title="Area & Locator"
          value={formatNumber(stats.uniqueLocators)}
          icon={MapPin}
          iconBgClass="bg-indigo-50 text-indigo-600"
          hoverBorderClass="hover:border-indigo-400"
          onClick={() => onNavigateToTab('locator')}
          onClickLabel="Lihat Pemetaan"
          delay={0.2}
        />
        <DashboardCard
          title="Saldo Akumulatif"
          value={formatNumber(stats.totalStock)}
          icon={Layers}
          iconBgClass="bg-emerald-50 text-emerald-600"
          hoverBorderClass="hover:border-emerald-400"
          onClick={() => onNavigateToTab('stock')}
          onClickLabel="Rincian Saldo"
          delay={0.3}
        />
        <DashboardCard
          title="Discrepancy Alert"
          value={stats.lowStockCount}
          icon={ShieldAlert}
          iconBgClass={stats.lowStockCount > 0 ? "bg-rose-50 text-rose-600" : "bg-slate-50 text-slate-400"}
          hoverBorderClass={stats.lowStockCount > 0 ? "hover:border-rose-400" : "hover:border-slate-300"}
          className={stats.lowStockCount > 0 ? "bg-rose-50/30 ring-1 ring-rose-100" : ""}
          footerText={stats.lowStockCount > 0 ? "Butuh Rekonsiliasi" : "Data Akurat"}
          delay={0.4}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Analytics Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="lg:col-span-2 bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-6"
        >
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <h4 className="text-xl font-black text-slate-900 tracking-tight">Sebaran Saldo Produk</h4>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Kuantitas Terbanyak (Top 10)</p>
            </div>
            <div className="p-2 bg-slate-50 rounded-xl">
              <Activity className="w-5 h-5 text-slate-400" />
            </div>
          </div>
          <StockDistributionChart chartData={chartData} />
        </motion.div>

        {/* Activity Feed */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col"
        >
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-1">
              <h4 className="text-xl font-black text-slate-900 tracking-tight">Alur Barang</h4>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Aktivitas Terkini</p>
            </div>
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-sm">
              <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
            </div>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
            {recentActivities.length > 0 ? (
              recentActivities.map((act, i) => (
                <div key={act.id} className="group flex gap-4 items-start relative pb-6 last:pb-0">
                  {i !== recentActivities.length - 1 && (
                    <div className="absolute left-4 top-10 bottom-0 w-px bg-slate-100" />
                  )}
                  <div className={cn(
                    "w-8 h-8 rounded-xl shrink-0 flex items-center justify-center z-10 transition-transform group-hover:scale-110",
                    act.tipe === 'OUT' ? "bg-rose-50 text-rose-600 shadow-rose-100" : "bg-emerald-50 text-emerald-600 shadow-emerald-100"
                  )}>
                    {act.tipe === 'OUT' ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-sm font-black text-slate-900 truncate tracking-tight">{act.pName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md uppercase tracking-wider">{act.lCode}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Qty: {act.qty}</span>
                    </div>
                  </div>
                  <div className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter pt-1 shrink-0">
                    {act.tanggal}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12 space-y-3">
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center">
                  <Clock className="w-6 h-6 text-slate-200" />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest italic">No recent activity</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Discrepancy & Focus Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col"
        >
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-1">
              <h4 className="text-xl font-black text-slate-900 tracking-tight">Focus Discrepancy</h4>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Butuh Rekonsiliasi Fisik</p>
            </div>
            <div className="px-3 py-1 bg-rose-50 text-rose-600 rounded-lg text-[10px] font-black uppercase tracking-widest">
              Action Required
            </div>
          </div>

          <div className="space-y-4 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
            {stats.lowStockList.length > 0 ? (
              stats.lowStockList.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-2xl transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 shadow-sm flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <AlertTriangle className="w-5 h-5 text-rose-500" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-800 leading-tight">{item.namaProduk}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Locator: <span className="text-slate-600">{item.whGroup}</span></p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn("text-lg font-black leading-none tracking-tighter", (item.selisih || 0) > 0 ? "text-blue-600" : "text-rose-600")}>
                      {(item.selisih || 0) > 0 ? `+${item.selisih}` : item.selisih}
                    </p>
                    <p className="text-[9px] font-black text-slate-300 uppercase mt-1 tracking-tighter">Variance Qty</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center shadow-inner">
                  <AlertTriangle className="w-8 h-8 text-emerald-400 opacity-30" />
                </div>
                <p className="text-xs font-black text-slate-300 uppercase tracking-widest italic">All inventory in sync</p>
              </div>
            )}
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-linear-to-br from-slate-900 via-slate-800 to-blue-900 text-white p-8 rounded-[2rem] shadow-2xl border border-white/5 flex flex-col justify-between overflow-hidden relative"
        >
          {/* Subtle Background Elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[100px] rounded-full -mr-32 -mt-32" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/10 blur-[80px] rounded-full -ml-24 -mb-24" />

          <div className="relative z-10 space-y-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10">
                <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                High Velocity
              </div>
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                Real-Time Perputaran
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-2xl font-black tracking-tighter">Perputaran Tercepat</h4>
              <p className="text-sm text-slate-400 font-medium leading-relaxed">
                Produk dengan intensitas mutasi tertinggi di area {area}.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              {topTransactionProducts.length > 0 ? (
                topTransactionProducts.map((product, idx) => (
                  <div key={idx} className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10 hover:bg-white/10 transition-colors group">
                    <div className="flex justify-between items-start gap-4">
                      <div className="min-w-0">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] block mb-1">Product Name</span>
                        <span className="font-black text-white leading-tight truncate block group-hover:text-blue-300 transition-colors">{product.namaProduk}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] block mb-1">Activity</span>
                        <span className="font-black text-emerald-400 text-lg leading-none tracking-tighter">{formatNumber(product.totalTrans)}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-white/5 rounded-2xl p-8 text-center border border-white/5">
                  <p className="text-xs font-black text-slate-600 uppercase tracking-widest">Insufficent Data</p>
                </div>
              )}
            </div>
          </div>

          <div className="relative z-10 pt-8 mt-6 border-t border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Live Syncing</span>
            </div>
            <button
              onClick={() => onNavigateToTab('cek_stock')}
              className="px-6 py-2 bg-white text-slate-900 text-xs font-black rounded-xl hover:bg-blue-50 active:scale-95 transition-all shadow-xl shadow-white/5"
            >
              FULL INVENTORY
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
});

export default ExecutiveDashboard;
