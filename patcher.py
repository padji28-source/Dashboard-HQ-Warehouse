import re
import os

files = [
    ('src/modules/inventory/MtsData.tsx', 'MTS'),
    ('src/components/AkurasiStock.tsx', 'MTS'),
    ('src/modules/inventory/StockOverview.tsx', 'MTS'),
    ('src/modules/inventory/PencocokanData.tsx', 'MTS'),
    ('src/components/Pengepokan.tsx', 'POK'),
    ('src/components/CekStock.tsx', 'POK'),
    ('src/components/DoiMp.tsx', 'POK')
]

for file, type_ in files:
    if not os.path.exists(file):
        continue
    with open(file, 'r') as f:
        code = f.read()
    
    # Remove Papa import
    code = re.sub(r'import Papa from [\'"]papaparse[\'"];\n?', '', code)
    
    if 'fetchAndParseCSV' not in code:
        depth = file.count('/') - 1
        rel_path = '../' * depth + 'lib/csvCache'
        code = f'import {{ fetchAndParseCSV }} from "{rel_path}";\n' + code

    # MTS logic
    if type_ == 'MTS':
        # Find the try/catch block for MTS fetch
        # Usually it starts with `let text = '';` or `let textMts = '';`
        pattern = re.compile(r'(let\s+(text|textMts)\s*=\s*\'\';\s*let\s+fetchedSuccess\s*=\s*false;\s*try\s*\{.*?const\s+(parsed|parsedMts)\s*=\s*Papa\.parse.*?const\s+(data|dataMts)\s*=\s*(parsed|parsedMts)\.data(?:\s*\|\|\s*\[\])?;)', re.DOTALL)
        
        def replMts(m):
            data_var = m.group(4) # data or dataMts
            return f"const {data_var} = await fetchAndParseCSV<string[]>('/api/stock-summary', false, 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSbvA_5FOxi2-nkfz8iJbptOhDfBCLM5LnTwrVLeJ4pf1hlGjSBywsTXQYYtEjuo0DY2M63wcJmc0tP/pub?gid=263347272&single=true&output=csv');"
            
        code = pattern.sub(replMts, code)
        
        # also need to remove `if (fetchedSuccess && textMts)` or similar wrapping. 
        # Wait, the replacement leaves `if (fetchedSuccess && textMts)` dangling if it exists?
        # Let's check AkurasiStock
        code = re.sub(r'if\s*\(\s*fetchedSuccess\s*&&\s*(text|textMts)\s*\)\s*\{', 'if (true) {', code)
        code = re.sub(r'if\s*\(\s*!fetchedSuccess\s*\|\|\s*!(text|textMts)\s*\)\s*\{', 'if (false) {', code)

    elif type_ == 'POK':
        pattern = re.compile(r'(const\s+csvUrl\s*=\s*[\'"].*?[\'"];.*?const\s+(parsed|parsedPok)\s*=\s*Papa\.parse.*?const\s+(data|dataPok)\s*=\s*(parsed|parsedPok)\.data(?:\s*\|\|\s*\[\])?;)', re.DOTALL)
        def replPok(m):
            data_var = m.group(3)
            return f"const {data_var} = await fetchAndParseCSV<any[]>('https://docs.google.com/spreadsheets/d/e/2PACX-1vSbvA_5FOxi2-nkfz8iJbptOhDfBCLM5LnTwrVLeJ4pf1hlGjSBywsTXQYYtEjuo0DY2M63wcJmc0tP/pub?gid=32687697&single=true&output=csv&hl=id');"
            
        code = pattern.sub(replPok, code)

    with open(file, 'w') as f:
        f.write(code)

