import fs from 'fs';

const file = 'src/modules/dashboard/ExecutiveDashboard.tsx';
let content = fs.readFileSync(file, 'utf-8');

const oldLogic = `    // Create container for last 6 months
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
      if (area !== 'ALL' && session.area !== 'ALL' && session.area && session.area.toUpperCase() !== area.toUpperCase()) {
        return;
      }
      if (!session.date && !session.timestamp) return;
      let sDateStr = session.date;
      if (typeof sDateStr === 'string' && sDateStr.includes('_to_')) {
        sDateStr = sDateStr.split('_to_')[0]; // Use start date for monthly reconciliation
      }
      const sDate = new Date(sDateStr || session.timestamp);
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
    });

    const data = monthList.map(mName => ({
      name: mName,
      selisih: monthlyMap[mName].qty,
      sku: monthlyMap[mName].skuCount
    }));`;

const newLogic = `    // Create container for last 6 months
    const monthList: string[] = [];
    const monthlyMap: Record<string, { qty: number; skuCount: number }> = {};
    // Track max per area per month to correctly sum them up for "ALL"
    const monthlyAreaMax: Record<string, Record<string, { qty: number; skuCount: number }>> = {};

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mName = months[d.getMonth()];
      monthList.push(mName);
      monthlyMap[mName] = { qty: 0, skuCount: 0 };
      monthlyAreaMax[mName] = {};
    }

    const currentMName = months[now.getMonth()];
    if (monthlyMap[currentMName]) {
      // Live data acts as the baseline for the current month
      monthlyMap[currentMName].qty = liveQty;
      monthlyMap[currentMName].skuCount = liveSKU;
    }

    // Incorporate saved reconciliation sessions
    savedSessions.forEach(session => {
      // Filter out sessions that don't match the selected area (if not ALL)
      if (area !== 'ALL' && session.area !== 'ALL' && session.area && session.area.toUpperCase() !== area.toUpperCase()) {
        return;
      }
      
      if (!session.date && !session.timestamp) return;
      let sDateStr = session.date;
      if (typeof sDateStr === 'string' && sDateStr.includes('_to_')) {
        sDateStr = sDateStr.split('_to_')[0]; // Use start date for monthly reconciliation
      }
      const sDate = new Date(sDateStr || session.timestamp);
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
          sessionQty = Math.abs(session.totalSelisih || session.grandTotals?.selisih || 0);
          sessionSKU = session.discrepancyCount || session.grandTotals?.itemCount || 0;
        }

        // We group by session.area to ensure we sum different areas instead of overwriting them
        const sArea = (session.area || 'UNKNOWN').toUpperCase();
        if (!monthlyAreaMax[mName][sArea]) {
          monthlyAreaMax[mName][sArea] = { qty: 0, skuCount: 0 };
        }
        
        monthlyAreaMax[mName][sArea].qty = Math.max(monthlyAreaMax[mName][sArea].qty, sessionQty);
        monthlyAreaMax[mName][sArea].skuCount = Math.max(monthlyAreaMax[mName][sArea].skuCount, sessionSKU);
      }
    });

    // Finalize the map by summing the maxes of all areas (or just taking the max if it's a single area filter)
    monthList.forEach(mName => {
      let aggregatedQty = 0;
      let aggregatedSKU = 0;
      
      const areasForMonth = Object.keys(monthlyAreaMax[mName]);
      if (areasForMonth.length > 0) {
        // If it's a specific area, we just take that area's max (handled by the area filter above)
        // If it's 'ALL', we sum all area maxes. But beware: if they saved an 'ALL' session, it might double count!
        // If there's an 'ALL' session, it usually contains all items.
        if (areasForMonth.includes('ALL')) {
          aggregatedQty = monthlyAreaMax[mName]['ALL'].qty;
          aggregatedSKU = monthlyAreaMax[mName]['ALL'].skuCount;
        } else {
          areasForMonth.forEach(a => {
            aggregatedQty += monthlyAreaMax[mName][a].qty;
            aggregatedSKU += monthlyAreaMax[mName][a].skuCount;
          });
        }
        
        // Use the maximum between live (current month) and the aggregated historical saves
        monthlyMap[mName].qty = Math.max(monthlyMap[mName].qty, aggregatedQty);
        monthlyMap[mName].skuCount = Math.max(monthlyMap[mName].skuCount, aggregatedSKU);
      }
    });

    const data = monthList.map(mName => ({
      name: mName,
      selisih: monthlyMap[mName].qty,
      sku: monthlyMap[mName].skuCount
    }));`;

if (content.includes(oldLogic)) {
  content = content.replace(oldLogic, newLogic);
  fs.writeFileSync(file, content, 'utf-8');
  console.log('Successfully updated ExecutiveDashboard aggregation logic!');
} else {
  console.log('Could not find old logic in ExecutiveDashboard.tsx');
  // fallback string replace just in case formatting differs slightly
}
