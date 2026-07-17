import re

with open('src/modules/inventory/MtsData.tsx', 'r') as f:
    code = f.read()

if 'useVirtualizer' not in code:
    code = code.replace(
        'import { useEffect, useState, useMemo , memo} from "react";',
        'import { useEffect, useState, useMemo , memo, useRef} from "react";\nimport { useVirtualizer } from "@tanstack/react-virtual";'
    )

    code = re.sub(
        r'<tbody>[\s\S]*?</tbody>',
        '''<tbody
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
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
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                    display: 'flex'
                  }}
                  className="hover:bg-slate-50 transition border-b border-slate-100 last:border-0"
                >
                  <td className="px-3 py-2 text-slate-500 font-mono text-center border-r border-slate-100/50 bg-slate-50/30" style={{ width: '50px' }}>
                    {virtualRow.index + 1}
                  </td>
                  {displayIndices.map((col, idx) => {
                    const isNum = !isNaN(Number(row[col.originalIndex])) && row[col.originalIndex] !== '';
                    return (
                      <td 
                        key={idx} 
                        style={{ flex: 1 }}
                        className={`px-4 py-2 ${idx === 0 ? 'font-bold text-slate-700' : 'text-slate-600'} ${isNum ? 'text-right font-mono' : 'text-left'}`}
                      >
                        {row[col.originalIndex]}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>''',
        code
    )

    code = code.replace(
        "const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');",
        "const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');\n  const parentRef = useRef<HTMLDivElement>(null);\n  const rowVirtualizer = useVirtualizer({\n    count: sortedRows.length,\n    getScrollElement: () => parentRef.current,\n    estimateSize: () => 40,\n    overscan: 5,\n  });"
    )

    code = code.replace(
        '<div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm bg-white">',
        '<div ref={parentRef} className="overflow-x-auto overflow-y-auto rounded-xl border border-slate-200 shadow-sm bg-white" style={{ height: "600px" }}>'
    )

    code = code.replace(
        '<table className="w-full text-sm">',
        '<table className="w-full text-sm" style={{ display: "flex", flexDirection: "column" }}>'
    )

    code = code.replace(
        '<thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">',
        '<thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10" style={{ width: "100%" }}>'
    )

    code = code.replace(
        '<tr className="text-left text-xs font-bold text-slate-600 uppercase tracking-wider">',
        '<tr className="text-left text-xs font-bold text-slate-600 uppercase tracking-wider" style={{ display: "flex", width: "100%" }}>\n<th className="px-3 py-3 w-[50px] text-center border-r border-slate-200/50">#</th>'
    )
    
    # We need to remove the original '#' column header
    code = code.replace('<th className="px-3 py-3 text-center border-r border-slate-200/50 w-12">#</th>', '')

    # Apply flex to headers
    code = re.sub(
        r'<th(\s+key=\{idx\}\s+className="px-4 py-3 cursor-pointer.*?")>',
        r'<th style={{ flex: 1 }}\1>',
        code
    )

with open('src/modules/inventory/MtsData.tsx', 'w') as f:
    f.write(code)
