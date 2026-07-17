import re
import os

files = [
  'src/modules/inventory/PencocokanData.tsx',
  'src/modules/inventory/TransactionInput.tsx',
  'src/modules/inventory/MtsData.tsx',
  'src/components/DoiMp.tsx',
  'src/components/Pengepokan.tsx',
  'src/components/AkurasiStock.tsx'
]

for file in files:
    with open(file, 'r') as f:
        content = f.read()
    
    # Remove import
    content = re.sub(r'import\s+\*\s+as\s+XLSX\s+from\s+[\'"]xlsx[\'"];\n?', '', content)
    
    # Make export functions async and inject import
    content = re.sub(r'const (handleExport|exportExcel|exportToExcel|handleExportToExcel) = \(\) => \{', r'const \1 = async () => {\n    const XLSX = await import("xlsx");', content)
    
    with open(file, 'w') as f:
        f.write(content)

