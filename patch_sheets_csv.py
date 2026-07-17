import re

filepath = 'src/lib/sheets.ts'
with open(filepath, 'r') as f:
    content = f.read()

# Add import
if 'import { fetchAndParseCSV }' not in content:
    content = 'import { fetchAndParseCSV } from "./csvCache";\n' + content

# Replace fetchPublicMasterProduk
old_func = """  const res = await fetch(csvUrl);
  if (!res.ok) {
    throw new Error("Gagal mengambil data Master Produk dari Google Sheets.");
  }
  const csvText = await res.text();
  const parsed = Papa.parse<any[]>(csvText, { skipEmptyLines: true });
  const data = parsed.data || [];"""

new_func = """  const data = await fetchAndParseCSV<any[]>(csvUrl, forceFresh);"""

content = content.replace(old_func, new_func)
content = re.sub(r"import Papa from 'papaparse';\n", "", content)

with open(filepath, 'w') as f:
    f.write(content)
