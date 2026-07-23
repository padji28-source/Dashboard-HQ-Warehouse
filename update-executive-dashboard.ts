import fs from 'fs';

const file = 'src/modules/dashboard/ExecutiveDashboard.tsx';
let content = fs.readFileSync(file, 'utf-8');

// replace the savedSessions.forEach in MonthlyDiscrepancyChart
content = content.replace(
/    savedSessions\.forEach\(session => {[\s\S]*?monthlyMap\[mName\]\.skuCount = Math\.max\(monthlyMap\[mName\]\.skuCount, sessionSKU\);\n      }\n    }\);/m,
`    savedSessions.forEach(session => {
      if (area !== 'ALL' && session.area !== 'ALL' && session.area && session.area.toUpperCase() !== area.toUpperCase()) {
        return;
      }
      if (!session.date && !session.timestamp) return;
      const sDate = new Date(session.date || session.timestamp);
      if (isNaN(sDate.getTime())) return;
      const mName = months[sDate.getMonth()];
      
      if (monthlyMap[mName]) {
        let sessionQty = 0;
        let sessionSKU = 0;
        
        const items = session.items || session.reconciliationList;
        if (Array.isArray(items)) {
          items.forEach((r: any) => {
            // If we are filtering by a specific area, only count items from that area
            if (area !== 'ALL' && r.area && r.area.toUpperCase() !== area.toUpperCase()) {
              return;
            }
            const s = Math.abs(r.selisih || 0);
            if (s >= 0.001) {
              sessionQty += s;
              sessionSKU += 1;
            }
          });
        } else {
          sessionQty = session.totalSelisih || session.grandTotals?.selisih || 0;
          sessionSKU = session.discrepancyCount || session.grandTotals?.itemCount || 0;
        }

        monthlyMap[mName].qty = Math.max(monthlyMap[mName].qty, sessionQty);
        monthlyMap[mName].skuCount = Math.max(monthlyMap[mName].skuCount, sessionSKU);
      }
    });`
);

fs.writeFileSync(file, content, 'utf-8');
console.log('Successfully updated ExecutiveDashboard!');
