import fs from 'fs';

const files = [
  'src/components/AkurasiStock.tsx',
  'src/modules/inventory/StockOverview.tsx'
];

const oldParseStr = `              if (colLastQty !== -1 && row[colLastQty] !== undefined) {
                let valStr = String(row[colLastQty]).trim();
                valStr = valStr.replace(/[^0-9.-]/g, '');
                lastQty = parseFloat(valStr) || 0;
                if (isNaN(lastQty)) lastQty = 0;
              }`;

const newParseStr = `              if (colLastQty !== -1 && row[colLastQty] !== undefined) {
                let valStr = String(row[colLastQty]).trim();
                
                let lastDot = valStr.lastIndexOf('.');
                let lastComma = valStr.lastIndexOf(',');
                
                if (lastComma > lastDot) {
                  // ID format: 1.234,56 or 28.959,
                  valStr = valStr.replace(/\\./g, '').replace(/,/g, '.');
                } else if (lastDot > lastComma) {
                  // EN format: 1,234.56
                  valStr = valStr.replace(/,/g, '');
                } else if (lastDot !== -1 && lastComma === -1) {
                  // Only dots (e.g. 1.000 or 1.5). In ID locale, 1.000 means 1000.
                  const parts = valStr.split('.');
                  if (parts.length > 1 && parts[parts.length - 1].length === 3) {
                    valStr = valStr.replace(/\\./g, '');
                  }
                } else if (lastComma !== -1 && lastDot === -1) {
                  // Only commas (e.g. 1,000 or 1,5).
                  const parts = valStr.split(',');
                  if (parts.length > 1 && parts[parts.length - 1].length === 3) {
                    valStr = valStr.replace(/,/g, '');
                  } else {
                    valStr = valStr.replace(/,/g, '.');
                  }
                }
                
                valStr = valStr.replace(/[^0-9.-]/g, '');
                lastQty = parseFloat(valStr) || 0;
                if (isNaN(lastQty)) lastQty = 0;
              }`;

for (const file of files) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf-8');
    if (content.includes(oldParseStr)) {
      content = content.replace(oldParseStr, newParseStr);
      fs.writeFileSync(file, content, 'utf-8');
      console.log('Fixed numeric parsing in ' + file);
    } else {
      console.log('Could not find old pattern in ' + file);
    }
  }
}
