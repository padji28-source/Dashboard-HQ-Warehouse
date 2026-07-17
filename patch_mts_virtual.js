const fs = require('fs');

let code = fs.readFileSync('src/modules/inventory/MtsData.tsx', 'utf-8');

if (!code.includes('useVirtualizer')) {
    code = code.replace(
        "import { useEffect, useState, useMemo , memo} from \"react\";",
        "import { useEffect, useState, useMemo , memo, useRef} from \"react\";\nimport { useVirtualizer } from '@tanstack/react-virtual';"
    );
    
    // Replace the tbody rendering
    code = code.replace(
        /<tbody>([\s\S]*?)<\/tbody>/g,
        `
        <tbody
            style={{
              height: \`\${rowVirtualizer.getTotalSize()}px\`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = sortedRows[virtualRow.index];
              return (
                <tr 
                  key={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: \`\${virtualRow.size}px\`,
                    transform: \`translateY(\${virtualRow.start}px)\`,
                  }}
                  className="hover:bg-slate-50 transition border-b border-slate-100 last:border-0"
                >
                  <td className="px-3 py-2 text-slate-500 font-mono text-center w-12 border-r border-slate-100/50 bg-slate-50/30">
                    {virtualRow.index + 1}
                  </td>
                  {displayIndices.map((col, idx) => {
                    const isNum = !isNaN(Number(row[col.originalIndex])) && row[col.originalIndex] !== '';
                    return (
                      <td 
                        key={idx} 
                        className={\`px-4 py-2 \${idx === 0 ? 'font-bold text-slate-700' : 'text-slate-600'} \${isNum ? 'text-right font-mono' : 'text-left'}\`}
                      >
                        {row[col.originalIndex]}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        `
    );
    
    // We need a parent ref
    code = code.replace(
        "const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');",
        "const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');\n  const parentRef = useRef<HTMLDivElement>(null);\n  const rowVirtualizer = useVirtualizer({\n    count: sortedRows.length,\n    getScrollElement: () => parentRef.current,\n    estimateSize: () => 40,\n    overscan: 5,\n  });"
    );
    
    // Add ref to the wrapper
    code = code.replace(
        '<div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm bg-white">',
        '<div ref={parentRef} className="overflow-x-auto overflow-y-auto rounded-xl border border-slate-200 shadow-sm bg-white" style={{ height: "600px" }}>'
    );
    
    // Change table display to support virtualization
    code = code.replace(
        '<table className="w-full text-sm">',
        '<table className="w-full text-sm" style={{ display: "grid" }}>'
    );
    
    code = code.replace(
        '<thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">',
        '<thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10" style={{ display: "grid", width: "100%" }}>'
    );
    
    // And fixing th / tr in thead
    code = code.replace(
        '<tr className="text-left text-xs font-bold text-slate-600 uppercase tracking-wider">',
        '<tr className="text-left text-xs font-bold text-slate-600 uppercase tracking-wider" style={{ display: "flex", width: "100%" }}>'
    );
    
    fs.writeFileSync('src/modules/inventory/MtsData.tsx', code);
}
