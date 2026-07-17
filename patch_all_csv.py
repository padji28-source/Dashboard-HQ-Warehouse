import os
import re

files_to_patch = [
    'src/components/DoiMp.tsx',
    'src/components/CekStock.tsx',
    'src/components/Pengepokan.tsx',
    'src/components/AkurasiStock.tsx',
    'src/modules/inventory/MtsData.tsx',
    'src/modules/inventory/StockOverview.tsx',
    'src/modules/inventory/PencocokanData.tsx'
]

for file in files_to_patch:
    if not os.path.exists(file):
        continue
    
    with open(file, 'r') as f:
        content = f.read()
        
    # Remove Papa import
    content = re.sub(r'import Papa from [\'"]papaparse[\'"];\n?', '', content)
    
    # Add fetchAndParseCSV import
    if 'fetchAndParseCSV' not in content:
        # Determine relative path to src/lib/csvCache
        depth = file.count('/') - 1
        rel_path = '../' * depth + 'lib/csvCache'
        content = f'import {{ fetchAndParseCSV }} from "{rel_path}";\n' + content
        
    # Pattern 1:
    # const res = await fetch(csvUrl);
    # ...
    # const csvText = await res.text();
    # const parsed = Papa.parse<any[]>(csvText, { skipEmptyLines: true });
    
    # We will use regex to find the fetch block.
    # It might be complicated because some fetch multiple URLs.
    # Let's just find `await fetch(...)` and the subsequent `Papa.parse` 
    pass

