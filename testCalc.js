const rows = [
  ["06-07-2026", "Sak Dalam PE P100 x L60 Cm", "125", "Kilo Gram", "IN", "AMT-KRW", "PSN-KRW C51", "", "", "BB-SAK-DALAM-PE-100x60"],
  ["06-07-2026", "Sak Dalam PE P100 x L60 Cm", "125", "Kilo Gram", "OUT", "AMT-KRW", "AMT-KRW GIL PROD", "", "", "BB-SAK-DALAM-PE-100x60"],
  ["08-07-2026", "Sak Dalam PE P100 x L60 Cm", "125", "Kilo Gram", "IN", "AMT-KRW", "PSN-KRW C51", "", "", "BB-SAK-DALAM-PE-100x60"],
  ["08-07-2026", "Sak Dalam PE P100 x L60 Cm", "125", "Kilo Gram", "OUT", "AMT-KRW", "AMT-KRW GIL PROD", "", "", "BB-SAK-DALAM-PE-100x60"],
  ["10-07-2026", "Sak Dalam PE P100 x L60 Cm", "250", "Kilo Gram", "IN", "AMT-KRW", "PSN-KRW C51", "", "", "BB-SAK-DALAM-PE-100x60"],
  ["10-07-2026", "Sak Dalam PE P100 x L60 Cm", "250", "Kilo Gram", "OUT", "AMT-KRW", "AMT-KRW GIL PROD", "", "", "BB-SAK-DALAM-PE-100x60"],
  ["11-07-2026", "Sak Dalam PE P100 x L60 Cm", "25", "Kilo Gram", "IN", "AMT-KRW", "PSN-KRW C51", "", "", "BB-SAK-DALAM-PE-100x60"],
  ["11-07-2026", "Sak Dalam PE P100 x L60 Cm", "25", "Kilo Gram", "OUT", "AMT-KRW", "AMT-KRW EXT MB PROD", "", "", "BB-SAK-DALAM-PE-100x60"],
  ["13-07-2026", "Sak Dalam PE P100 x L60 Cm", "25", "Kilo Gram", "IN", "AMT-KRW", "PSN-KRW C51", "", "", "BB-SAK-DALAM-PE-100x60"],
  ["13-07-2026", "Sak Dalam PE P100 x L60 Cm", "25", "Kilo Gram", "OUT", "AMT-KRW", "AMT-KRW EXT MB PROD", "", "", "BB-SAK-DALAM-PE-100x60"],
  ["14-07-2026", "Sak Dalam PE P100 x L60 Cm", "200", "Kilo Gram", "IN", "AMT-KRW", "PSN-KRW C51", "", "", "BB-SAK-DALAM-PE-100x60"],
  ["14-07-2026", "Sak Dalam PE P100 x L60 Cm", "200", "Kilo Gram", "OUT", "AMT-KRW", "AMT-KRW GIL PROD", "", "", "BB-SAK-DALAM-PE-100x60"]
];

let pcStock = 0;
let txStock = 0;

rows.forEach(r => {
  // PencocokanData logic
  let tipe = String(r[4]).replace(/\s+/g, '').toUpperCase();
  let fromLocator = String(r[5]);
  let toLocator = String(r[6]);
  let qty = parseFloat(String(r[2])) || 0;
  
  if (!fromLocator && !toLocator) fromLocator = 'UNKNOWN_L';
  let pLCode = '';
  let pTipe = '';
  if (tipe === 'TRANSFER' || tipe === 'TF') {
    // skip
  } else {
    pTipe = tipe || 'IN';
    pLCode = fromLocator || toLocator || 'UNKNOWN_L';
  }
  
  let pIsIN = pTipe === 'IN' || pTipe.includes('AWAL') || pTipe === 'MASUK' || pTipe === 'RECEIPT';
  let pIsOUT = pTipe === 'OUT' || pTipe === 'KELUAR' || pTipe === 'ISSUE' || pTipe === 'PEMAKAIAN' || pTipe === 'TRANSFER' || pTipe === 'TF';
  
  if (pLCode === 'AMT-KRW') {
    if (pIsIN) pcStock += qty;
    else if (pIsOUT) pcStock -= qty;
  }
  
  // TransactionInput logic
  let txIsIN = tipe === 'IN' || tipe.includes('AWAL') || tipe === 'MASUK' || tipe === 'RECEIPT';
  let txIsOUT = tipe === 'OUT' || tipe === 'KELUAR' || tipe === 'ISSUE' || tipe === 'PEMAKAIAN' || tipe === 'TRANSFER' || tipe === 'TF';
  
  if (txIsIN) {
    if (fromLocator === 'AMT-KRW') txStock += qty;
  } else if (txIsOUT) {
    if (fromLocator === 'AMT-KRW') txStock -= qty;
    if ((tipe === 'TRANSFER' || tipe === 'TF') && toLocator === 'AMT-KRW') {
      txStock += qty;
    }
  }
});

console.log("PencocokanData Stock:", pcStock);
console.log("TransactionInput Stock:", txStock);
