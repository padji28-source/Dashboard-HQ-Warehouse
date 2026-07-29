import fs from 'fs';

const file = 'src/modules/inventory/PencocokanData.tsx';
let content = fs.readFileSync(file, 'utf-8');

const oldParseStr = `              if (colLastQty !== -1 && row[colLastQty] !== undefined) {
                let valStr = String(row[colLastQty]).trim();
                // Handle Indonesian number format (1.234,56) vs English (1,234.56)
                // If it contains both, we check positions. But commonly in this sheet it's ID format like "28.959,"
                // We can remove dots and change comma to dot IF it matches ID format, 
                // OR we just remove all non-numeric/comma/dot.
                if (valStr.includes(',') && !valStr.includes('.')) {
                  valStr = valStr.replace(/,/g, '.');
                } else if (valStr.includes('.') && valStr.includes(',')) {
                  const lastDot = valStr.lastIndexOf('.');
                  const lastComma = valStr.lastIndexOf(',');
                  if (lastComma > lastDot) {
                     // ID format: 1.234,56
                     valStr = valStr.replace(/\\./g, '').replace(/,/g, '.');
                  } else {
                     // EN format: 1,234.56
                     valStr = valStr.replace(/,/g, '');
                  }
                } else if (valStr.includes('.')) {
                   // Only dots. Could be thousand separator "28.959" or decimal "28.959"
                   // Looking at the data, it's often thousands if > 3 digits, but to be safe:
                   // The CSV has "28.959," which is handled above. 
                   // If it's just "28.959" without comma, we'll leave it as is, parseFloat will parse as 28.959 (English decimal).
                }
                
                // General cleanup for trailing spaces/currency
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

content = content.replace(oldParseStr, newParseStr);
fs.writeFileSync(file, content, 'utf-8');
console.log('Fixed numeric parsing v3!');
