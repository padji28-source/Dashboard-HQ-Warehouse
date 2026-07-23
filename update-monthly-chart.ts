import fs from 'fs';

const file = 'src/modules/dashboard/ExecutiveDashboard.tsx';
let content = fs.readFileSync(file, 'utf-8');

// Ensure useEffect, db, collection, getDocs imports
if (!content.includes("import { db }")) {
  content = content.replace(
    "import { useMemo, useState, memo, ComponentType } from 'react';",
    "import { useMemo, useState, useEffect, memo, ComponentType } from 'react';\nimport { db } from '../../lib/firebase';\nimport { collection, getDocs } from 'firebase/firestore';"
  );
}

// Replace MonthlyDiscrepancyChart definition
const oldChartStart = content.indexOf('const MonthlyDiscrepancyChart =');
const oldChartEnd = content.indexOf('interface ExecutiveDashboardProps {');

if (oldChartStart !== -1 && oldChartEnd !== -1) {
  const newChartCode = `interface MonthlyDiscrepancyChartProps {
  area: string;
  stockSummary?: StockSummary[];
  allTransactions?: any[];
}

const MonthlyDiscrepancyChart = memo(function MonthlyDiscrepancyChart({
  area,
  stockSummary = [],
  allTransactions = []
}: MonthlyDiscrepancyChartProps) {
  const [savedSessions, setSavedSessions] = useState<any[]>([]);

  useEffect(() => {
    let isMounted = true;
    async function loadSessions() {
      try {
        const colRef = collection(db, 'saved_reconciliations');
        const snapshot = await getDocs(colRef);
        const results: any[] = [];
        snapshot.forEach(docSnap => {
          results.push({ fireId: docSnap.id, ...docSnap.data() });
        });
        const local = JSON.parse(localStorage.getItem('saved_reconciliations') || '[]');
        if (isMounted) setSavedSessions([...results, ...local]);
      } catch (e) {
        const local = JSON.parse(localStorage.getItem('saved_reconciliations') || '[]');
        if (isMounted) setSavedSessions(local);
      }
    }
    loadSessions();
    return () => { isMounted = false; };
  }, []);

  const { trendData, totalCurrentSelisihSKU, totalCurrentSelisihQty } = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
    const now = new Date();
    
    // Filter stock summary by area if needed
    const filteredStock = area === 'ALL' 
      ? stockSummary 
      : stockSummary.filter(s => (s.area || '').toUpperCase() === area.toUpperCase() || (s.whGroup || '').toUpperCase() === area.toUpperCase());

    // Compute live active selisih from stockSummary (pencocokan data live)
    let liveQty = 0;
    let liveSKU = 0;
    filteredStock.forEach(item => {
      const s = Math.abs(item.selisih || 0);
      if (s >= 0.001) {
        liveQty += s;
        liveSKU += 1;
      }
    });

    // Create container for last 6 months
    const monthList: string[] = [];
    const monthlyMap: Record<string, { qty: number; skuCount: number }> = {};

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mName = months[d.getMonth()];
      monthList.push(mName);
      monthlyMap[mName] = { qty: 0, skuCount: 0 };
    }

    const currentMName = months[now.getMonth()];
    if (monthlyMap[currentMName]) {
      monthlyMap[currentMName].qty = liveQty;
      monthlyMap[currentMName].skuCount = liveSKU;
    }

    // Incorporate saved reconciliation sessions
    savedSessions.forEach(session => {
      if (area !== 'ALL' && session.area && session.area.toUpperCase() !== area.toUpperCase()) {
        return;
      }
      if (!session.date && !session.timestamp) return;
      const sDate = new Date(session.date || session.timestamp);
      if (isNaN(sDate.getTime())) return;
      const mName = months[sDate.getMonth()];
      
      if (monthlyMap[mName]) {
        let sessionQty = 0;
        let sessionSKU = 0;
        if (Array.isArray(session.reconciliationList)) {
          session.reconciliationList.forEach((r: any) => {
            const s = Math.abs(r.selisih || 0);
            if (s >= 0.001) {
              sessionQty += s;
              sessionSKU += 1;
            }
          });
        } else {
          sessionQty = session.totalSelisih || 0;
          sessionSKU = session.discrepancyCount || 0;
        }

        monthlyMap[mName].qty = Math.max(monthlyMap[mName].qty, sessionQty);
        monthlyMap[mName].skuCount = Math.max(monthlyMap[mName].skuCount, sessionSKU);
      }
    });

    const data = monthList.map(mName => ({
      name: mName,
      selisih: monthlyMap[mName].qty,
      sku: monthlyMap[mName].skuCount
    }));

    return {
      trendData: data,
      totalCurrentSelisihSKU: liveSKU,
      totalCurrentSelisihQty: liveQty
    };
  }, [stockSummary, area, savedSessions]);

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
      <div className="border-b border-slate-100 pb-3 mb-4 flex justify-between items-start">
        <div>
          <h4 className="font-extrabold text-slate-900 text-base">Tren Selisih Stok Bulanan</h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time Pencocokan Data area <span className="font-bold text-blue-600">{area}</span>
          </p>
        </div>
        <div className="text-right">
          <span className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 text-xs font-black rounded-lg inline-block">
            {formatNumber(totalCurrentSelisihQty)} Unit ({totalCurrentSelisihSKU} SKU)
          </span>
        </div>
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
              formatter={(val: number) => [\`\${formatNumber(val)} Unit\`, 'Selisih Stok']}
            />
            <Bar dataKey="selisih" fill="#f43f5e" name="Total Selisih (Qty)" radius={[6, 6, 0, 0]} barSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});\n\n`;

  content = content.substring(0, oldChartStart) + newChartCode + content.substring(oldChartEnd);
}

// Update component call at bottom
content = content.replace(
  '<MonthlyDiscrepancyChart area={area} />',
  '<MonthlyDiscrepancyChart area={area} stockSummary={stockSummary} allTransactions={allTransactions} />'
);

fs.writeFileSync(file, content, 'utf-8');
console.log('Successfully updated MonthlyDiscrepancyChart!');
