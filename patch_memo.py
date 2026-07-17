import re
import glob
import os

files = [
  'src/components/MasterProduk.tsx',
  'src/components/MasterLocator.tsx',
  'src/modules/inventory/TransactionInput.tsx',
  'src/modules/inventory/StockOverview.tsx',
  'src/modules/inventory/PencocokanData.tsx',
  'src/modules/inventory/MtsData.tsx',
  'src/modules/whatsapp/WhatsAppConsole.tsx',
  'src/components/AkurasiStock.tsx',
  'src/components/Pengepokan.tsx',
  'src/components/CekStock.tsx',
  'src/components/DoiMp.tsx'
]

for file in files:
    if not os.path.exists(file):
        continue
    with open(file, 'r') as f:
        content = f.read()
    
    # If React is not imported, we need to import memo, or we can just use React.memo if React is imported
    # Actually, we can just replace `export default function Component` with `const Component = ...; export default React.memo(Component);`
    # Let's see how they are exported.
    
    # Let's just import { memo } from 'react'; and use memo().
    if 'import { memo }' not in content and 'import React, { memo }' not in content:
        content = re.sub(r'import\s+\{(.*?)\}\s+from\s+[\'"]react[\'"];', r'import {\1, memo} from "react";', content, count=1)
        if 'memo' not in content:
           # If there wasn't an import { ... } from 'react', add it.
           content = 'import { memo } from "react";\n' + content
           
    # Find export default function Name(props)
    match = re.search(r'export default function (\w+)\s*\(', content)
    if match:
        name = match.group(1)
        content = re.sub(r'export default function ' + name, f'function {name}', content)
        content += f'\nexport default memo({name});\n'
    
    with open(file, 'w') as f:
        f.write(content)

