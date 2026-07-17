import re

with open('src/modules/inventory/TransactionInput.tsx', 'r') as f:
    code = f.read()

if 'useVirtualizer' not in code:
    code = code.replace(
        'import { useState, useEffect, useMemo, useRef , memo} from "react";',
        'import { useState, useEffect, useMemo, useRef, memo } from "react";\nimport { useVirtualizer } from "@tanstack/react-virtual";'
    )
    
    # In TransactionInput, the rows are rendered by mapping over `filtered`.
    # Let's find the tbody.
    tbody_pattern = r'<tbody className="divide-y divide-slate-100/80 bg-white">\s*\{filtered\.map\(\(t, idx\) => \([\s\S]*?</tr>\s*\)\s*\}\s*</tbody>'
    
    # We'll replace it with a virtualized version
    replacement = '''<tbody
                  className="bg-white"
                  style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const t = filtered[virtualRow.index];
                    const idx = virtualRow.index;
                    return (
                      <tr 
                        key={idx} 
                        className="hover:bg-blue-50/50 transition-colors border-b border-slate-100/80"
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                          display: 'flex'
                        }}
                      >
                        <td className="px-3 py-3 w-16 text-center text-xs font-medium text-slate-400 border-r border-slate-100/50 flex items-center justify-center">{idx + 1}</td>
                        <td className="px-4 py-3 flex-1 flex items-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold tracking-wide uppercase ${t.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : t.type === 'OUT' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'}`}>
                            {t.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 font-medium whitespace-nowrap flex-1 flex items-center">{t.date}</td>
                        <td className="px-4 py-3 flex-[2] flex items-center">
                          <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">{t.kode}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 font-semibold truncate flex-[3] flex items-center" title={t.nama}>{t.nama}</td>
                        <td className="px-4 py-3 flex-1 flex items-center">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50 px-2 py-1 rounded-md">{t.satuan}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-800 flex-1 flex items-center justify-end">{t.qty.toLocaleString()}</td>
                        <td className="px-4 py-3 flex-1 flex items-center">
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 px-2 py-1 rounded">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {t.locator}
                          </span>
                        </td>
                        <td className="px-4 py-3 flex-1 flex items-center">{t.locatorTo ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 px-2 py-1 rounded">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {t.locatorTo}
                          </span>
                        ) : '-'}</td>
                        <td className="px-4 py-3 text-xs text-slate-500 flex-1 flex items-center">{t.noDocument || '-'}</td>
                        <td className="px-4 py-3 text-xs text-slate-500 flex-[2] flex items-center truncate max-w-[150px]" title={t.keterangan || ''}>{t.keterangan || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>'''

    code = re.sub(tbody_pattern, replacement, code)
    
    # Insert rowVirtualizer right before the `return` of the component.
    # Usually around line 718 or similar.
    # Let's find: `return (` inside `function TransactionInput`
    
    code = code.replace(
        '  return (\n    <div className=',
        '''  const tableContainerRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 50,
    overscan: 5,
  });

  return (
    <div className='''
    )

    code = code.replace(
        '<div className="overflow-x-auto shadow-sm ring-1 ring-black/5 rounded-xl bg-white">',
        '<div ref={tableContainerRef} className="overflow-x-auto overflow-y-auto shadow-sm ring-1 ring-black/5 rounded-xl bg-white" style={{ height: "600px" }}>'
    )
    
    code = code.replace(
        '<table className="min-w-full divide-y divide-slate-200">',
        '<table className="min-w-full divide-y divide-slate-200" style={{ display: "flex", flexDirection: "column" }}>'
    )
    code = code.replace(
        '<thead className="bg-slate-50">',
        '<thead className="bg-slate-50 sticky top-0 z-10" style={{ width: "100%" }}>'
    )
    code = code.replace(
        '<tr className="divide-x divide-slate-200/50">',
        '<tr className="divide-x divide-slate-200/50" style={{ display: "flex", width: "100%" }}>'
    )
    
    # We need to change the TH widths as well
    code = re.sub(r'<th\s+className="px-3 py-3\.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-16 bg-white">\s*#\s*</th>', '<th className="px-3 py-3.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-16 bg-white flex items-center justify-center">#</th>', code)
    
    code = re.sub(r'<th\s+className="px-4 py-3\.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-white">', '<th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-white flex-1 flex items-center">', code)
    code = re.sub(r'<th\s+className="px-4 py-3\.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider bg-white">', '<th className="px-4 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider bg-white flex-1 flex items-center justify-end">', code)
    
    # Make sure kode gets flex-[2] and nama gets flex-[3] and keterangan flex-[2]
    # Let's just do a blanket replace for the `th` inside TransactionInput
    
with open('src/modules/inventory/TransactionInput.tsx', 'w') as f:
    f.write(code)
