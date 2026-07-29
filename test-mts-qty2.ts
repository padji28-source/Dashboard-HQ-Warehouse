const vals = ["28.959,", "0,", "13,", "258,", "342,", "1.234,56", "1.000"];

for (let v of vals) {
  let valStr = String(v).trim();
  
  // Assume ID locale unconditionally
  valStr = valStr.replace(/\./g, ''); // remove all dots
  valStr = valStr.replace(/,/g, '.'); // comma to dot
  valStr = valStr.replace(/[^0-9.-]/g, ''); // remove any other weird chars
  
  let lastQty = parseFloat(valStr) || 0;
  console.log(v, "->", lastQty);
}
