import fs from 'fs';

let appFile = 'src/App.tsx';
let appContent = fs.readFileSync(appFile, 'utf-8');

appContent = appContent.replace(/"Jakarta A5", /g, '');
appContent = appContent.replace(/  "Jakarta A5": "https:\/\/script\.google\.com\/macros\/s\/AKfycbwLKZrkQ_q7Vo4ycSiS7Y_WAPYUBlD8XyD9bUEdqe3ODPEvpzPCVcVzjyykIgyiw23R-w\/exec",\n/g, '');
appContent = appContent.replace(/  \{ username: 'jakarta_a5', password: 'jakarta123', allowedArea: 'Jakarta A5', label: 'Admin Jakarta A5' \},\n/g, '');
appContent = appContent.replace(/  \{ username: 'admin_jakarta_a5', password: 'jakarta123', allowedArea: 'Jakarta A5', label: 'Admin Jakarta A5' \},\n/g, '');

fs.writeFileSync(appFile, appContent, 'utf-8');
console.log('App.tsx updated.');

let cekStockFile = 'src/components/CekStock.tsx';
let cekStockContent = fs.readFileSync(cekStockFile, 'utf-8');
cekStockContent = cekStockContent.replace(/      "Jakarta A5",\n/g, '');
fs.writeFileSync(cekStockFile, cekStockContent, 'utf-8');
console.log('CekStock.tsx updated.');

let masterProdukFile = 'src/modules/products/MasterProduk.tsx';
let masterProdukContent = fs.readFileSync(masterProdukFile, 'utf-8');
masterProdukContent = masterProdukContent.replace(/const mapped = area === "Jakarta A5" \? "Jakarta" : area;/g, 'const mapped = area;');
fs.writeFileSync(masterProdukFile, masterProdukContent, 'utf-8');
console.log('MasterProduk.tsx updated.');

