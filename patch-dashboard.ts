import fs from 'fs';

const filePath = 'src/modules/dashboard/ExecutiveDashboard.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// Insert imports
if (!content.includes('import { useState')) {
  content = content.replace("import { useMemo,", "import { useMemo, useState,");
}
if (!content.includes('Loader2')) {
  content = content.replace("AlertTriangle, RefreshCw,", "AlertTriangle, RefreshCw, Loader2, Sparkles,");
}

// Add SmartCycleCount and MonthlyDiscrepancyChart components before ExecutiveDashboard
const newComponents = `
interface SmartCycleCountProps {
  stockSummary: any[];
}

const SmartCycleCount = memo(function SmartCycleCount({ stockSummary }: SmartCycleCountProps) {
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const payload = stockSummary.slice(0, 50).map(i => ({
        kodeProduk: i.kodeProduk || 'UNKNOWN',
        namaProduk: i.namaProduk,
        mutasiQty: (i.totalIn || 0) + (i.totalOut || 0),
        selisihSebelumnya: i.selisih || 0,
        stockSistem: i.stock || 0
      }));
      
      const res = await fetch('/api/gemini/predict-cycle-count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payload })
      });
      
      const data = await res.json();
      if (data.predictions) {
        setPredictions(data.predictions);
      }
      setAnalyzed(true);
    } catch(err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full">
      <div className="flex justify-between items-start border-b border-slate-100 pb-3 mb-4">
        <div>
          <h4 className="font-extrabold text-slate-900 text-base flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-purple-600" />
            Smart Cycle Count
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">Prediksi AI untuk SKU berisiko selisih</p>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={loading || stockSummary.length === 0}
          className={\`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors \${loading ? 'bg-purple-100 text-purple-400 cursor-not-allowed' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'}\`}
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
          {loading ? 'Menganalisis...' : 'Analisis AI'}
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto pr-1 space-y-2">
        {!analyzed && !loading ? (
          <div className="flex flex-col items-center justify-center h-48 text-center px-4">
            <div className="w-10 h-10 bg-purple-50 text-purple-300 rounded-full flex items-center justify-center mb-3">
              <Bot className="w-5 h-5" />
            </div>
            <p className="text-sm font-bold text-slate-700">Analisis Historis Transaksi</p>
            <p className="text-xs text-slate-400 mt-1">Gunakan AI untuk memprediksi barang dengan potensi selisih tertinggi untuk penjadwalan cycle count.</p>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-purple-500 mb-2" />
            <p className="text-xs text-slate-500 font-medium">Memproses pola mutasi & retur...</p>
          </div>
        ) : predictions.length > 0 ? (
          predictions.map((p: any, idx: number) => (
            <div key={idx} className="p-3 border border-slate-100 rounded-xl bg-slate-50 flex items-center justify-between hover:border-purple-200 hover:bg-purple-50/50 transition-colors">
              <div className="flex-1 min-w-0 pr-3">
                <p className="text-xs font-extrabold text-slate-800 truncate">{p.namaProduk}</p>
                <p className="text-[10px] text-slate-500 mt-1 leading-tight">{p.reason}</p>
              </div>
              <div className="shrink-0 text-center">
                <div className={\`text-xs font-black px-2 py-1 rounded-md \${p.riskScore > 70 ? 'bg-rose-100 text-rose-700' : p.riskScore > 40 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}\`}>
                  {p.riskScore}/100
                </div>
                <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Skor Risiko</p>
              </div>
            </div>
          ))
        ) : (
          <div className="flex items-center justify-center h-48 text-slate-400 text-xs italic">
            Tidak ada anomali atau risiko selisih tinggi.
          </div>
        )}
      </div>
    </div>
  );
});

const MonthlyDiscrepancyChart = memo(function MonthlyDiscrepancyChart({ area }: { area: string }) {
  // Mock historical trend data for visualization purposes as requested
  const trendData = useMemo(() => [
    { name: 'Jan', selisih: 45 },
    { name: 'Feb', selisih: 52 },
    { name: 'Mar', selisih: 38 },
    { name: 'Apr', selisih: 65 },
    { name: 'Mei', selisih: 48 },
    { name: 'Jun', selisih: 30 },
    { name: 'Jul', selisih: 20 }, // Trend menurun (membaik)
  ], []);

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
      <div className="border-b border-slate-100 pb-3 mb-4">
        <h4 className="font-extrabold text-slate-900 text-base">Tren Selisih Stok Bulanan</h4>
        <p className="text-xs text-slate-500 mt-0.5">Frekuensi selisih (discrepancy) area {area}</p>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={trendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip 
              contentStyle={{ borderRadius: '12px', borderColor: '#e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              labelStyle={{ fontWeight: 'bold', color: '#0f172a' }}
            />
            <Bar dataKey="selisih" fill="#f43f5e" name="Total Selisih" radius={[4, 4, 0, 0]} barSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

interface ExecutiveDashboardProps {
`;

content = content.replace("interface ExecutiveDashboardProps {", newComponents);

const newRow = `
      {/* Third Row: Analytics & AI */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MonthlyDiscrepancyChart area={area} />
        <SmartCycleCount stockSummary={stockSummary} />
      </div>
    </div>
  );
});
`;

content = content.replace(/    <\/div>\s*<\/div>\s*\);\s*}\);\s*export default ExecutiveDashboard;/g, newRow + '\nexport default ExecutiveDashboard;');

fs.writeFileSync(filePath, content, 'utf-8');
console.log("Dashboard Updated!");
