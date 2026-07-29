const vals = ["28.959,", "0,", "13,", "258,", "342,", "1.234,56", "1,000.00", "1.000"];

for (let v of vals) {
  let valStr = String(v).trim();
  // We notice the user uses ID locale in google sheets. 
  // In ID locale: dots are thousands, commas are decimals.
  // Example: "28.959," -> 28959
  // To handle this properly:
  
  // If there's a dot and it is followed by exactly 3 digits and maybe more thousands dots...
  // Actually, easiest way for ID locale: remove all dots, then change comma to dot.
  // BUT what if it's "1,000.00"? Then we'd break it. 
  // Since this app uses ID locale (indicated by "28.959,"), we should assume ID locale.
  // Is there any case where it's EN locale?
  // Let's just check the last separator.
  let lastDot = valStr.lastIndexOf('.');
  let lastComma = valStr.lastIndexOf(',');
  
  if (lastComma > lastDot) {
    // ID locale format or just comma decimal (e.g. "28.959,", "1,5", "1.234,56", "0,")
    valStr = valStr.replace(/\./g, ''); // remove all dots
    valStr = valStr.replace(/,/g, '.'); // comma to dot
  } else if (lastDot > lastComma) {
    // EN locale format (e.g. "1,234.56", "1,000.", "0.5")
    valStr = valStr.replace(/,/g, ''); // remove all commas
  } else {
    // No commas and no dots, or one of them is absent.
    // What if it's "1.000"? lastDot > -1, lastComma = -1. So lastDot > lastComma.
    // It would be treated as EN locale -> "1.000" -> 1.
    // BUT wait! If it's ID locale, "1.000" means 1000! 
    // In ID locale, if there are exactly 3 digits after the dot, it's 1000.
    // However, the CSV above shows "28.959,". The comma is ALWAYS there even for integers!
  }
  
  valStr = valStr.replace(/[^0-9.-]/g, '');
  let lastQty = parseFloat(valStr) || 0;
  console.log(v, "->", lastQty);
}
