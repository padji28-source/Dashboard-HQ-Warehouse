import fs from 'fs';

const file = 'src/modules/dashboard/ExecutiveDashboard.tsx';
let content = fs.readFileSync(file, 'utf-8');

// The file currently has 7 lines of broken code at the top.
// Let's remove them.
const lines = content.split('\n');
if (lines[0].includes('if (!session.date && !session.timestamp) return;')) {
  lines.splice(0, 7);
}
content = lines.join('\n');

// Now we need to correctly replace the loop body inside MonthlyDiscrepancyChart
const oldStr = `    savedSessions.forEach(session => {
      if (area !== 'ALL' && session.area !== 'ALL' && session.area && session.area.toUpperCase() !== area.toUpperCase()) {
        return;
      }
      if (!session.date && !session.timestamp) return;
      const sDate = new Date(session.date || session.timestamp);
      if (isNaN(sDate.getTime())) return;
      const mName = months[sDate.getMonth()];`;

const newStr = `    savedSessions.forEach(session => {
      if (area !== 'ALL' && session.area !== 'ALL' && session.area && session.area.toUpperCase() !== area.toUpperCase()) {
        return;
      }
      if (!session.date && !session.timestamp) return;
      let sDateStr = session.date;
      if (typeof sDateStr === 'string' && sDateStr.includes('_to_')) {
        sDateStr = sDateStr.split('_to_')[0];
      }
      const sDate = new Date(sDateStr || session.timestamp);
      if (isNaN(sDate.getTime())) return;
      const mName = months[sDate.getMonth()];`;

if (content.includes(oldStr)) {
  content = content.replace(oldStr, newStr);
  console.log("Replaced target string.");
} else {
  // Let's try matching a broader block
  content = content.replace(
/      if \(!session\.date && !session\.timestamp\) return;\n      const sDate = new Date\(session\.date \|\| session\.timestamp\);\n      if \(isNaN\(sDate\.getTime\(\)\)\) return;/m,
`      if (!session.date && !session.timestamp) return;
      let sDateStr = session.date;
      if (typeof sDateStr === 'string' && sDateStr.includes('_to_')) {
        sDateStr = sDateStr.split('_to_')[0];
      }
      const sDate = new Date(sDateStr || session.timestamp);
      if (isNaN(sDate.getTime())) return;`
  );
  console.log("Used fallback replace.");
}

// Also make sure to change localStorage.getItem('saved_reconciliations') to 'mms_saved_reconciliations'
content = content.replace(/localStorage\.getItem\('saved_reconciliations'\)/g, "localStorage.getItem('mms_saved_reconciliations')");

fs.writeFileSync(file, content, 'utf-8');
console.log('Fixed Dashboard!');
