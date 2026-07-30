const fs = require('fs');

const data = `Material Transaction Summary,,,,,,,,,,,,,,,,,,,
Organization :,All,,,,,,,,,,,,,,,,,,
Date :,2025-07-01 00:00:00,,,Terakhir Ditarik: 2026-07-29 23:50:57,,,,,,,,,,,,,,,
Locator,,Search Key,,,Name,,UOM,,"StartQty",MR,CR+,MatTO+,Prod +,Ship -,VendRet -,MatFrom -,P-,Adj+,Last Qty
PSN-KRW POK JKT,,PVC-VS-1-ELBOW,,,"1"" PVC ELBOW",,Pcs,,0,0,0,5200,0,0,0,-29200,0,24000,0
Sub Total,,,,,"1"" PVC ELBOW",,,,0,0,0,5200,0,0,0,-29200,0,24000,0`;

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

const lines = data.split('\n');
const parsed = lines.map(parseCSVLine);

let headerIndex = 0;
for (let i = 0; i < Math.min(10, parsed.length); i++) {
  const nonEmpCount = parsed[i].filter(val => String(val).trim().length > 0).length;
  if (nonEmpCount > 3) {
    headerIndex = i;
    break;
  }
}

const rawHeaders = parsed[headerIndex] || [];
const cleanedHeaders = rawHeaders.map(h => String(h).trim());
console.log("Cleaned headers:", cleanedHeaders);
const colLastQty = cleanedHeaders.findIndex(h => h.toLowerCase().includes('last qty') || h.toLowerCase().includes('sistem'));
console.log("colLastQty:", colLastQty);

