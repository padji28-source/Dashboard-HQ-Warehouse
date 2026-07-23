import fs from 'fs';

const file = 'src/modules/dashboard/ExecutiveDashboard.tsx';
let content = fs.readFileSync(file, 'utf-8');

content = content.replace(
/      if \(!session\.date && !session\.timestamp\) return;\n      const sDate = new Date\(session\.date || session\.timestamp\);\n      if \(isNaN\(sDate\.getTime\(\)\)\) return;/m,
`      if (!session.date && !session.timestamp) return;
      let sDateStr = session.date;
      if (typeof sDateStr === 'string' && sDateStr.includes('_to_')) {
        sDateStr = sDateStr.split('_to_')[0]; // Use start date for monthly reconciliation
      }
      const sDate = new Date(sDateStr || session.timestamp);
      if (isNaN(sDate.getTime())) return;`
);

fs.writeFileSync(file, content, 'utf-8');
console.log('Fixed date parsing!');
