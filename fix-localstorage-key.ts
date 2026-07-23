import fs from 'fs';

const file = 'src/modules/dashboard/ExecutiveDashboard.tsx';
let content = fs.readFileSync(file, 'utf-8');

content = content.replace(/localStorage\.getItem\('saved_reconciliations'\)/g, "localStorage.getItem('mms_saved_reconciliations')");

fs.writeFileSync(file, content, 'utf-8');
console.log('Fixed localstorage key!');
