import re
with open('src/modules/inventory/TransactionInput.tsx', 'r') as f:
    code = f.read()

# Custom replace for the THs
old_thead = '''<thead className="bg-slate-50 sticky top-0 z-10" style={{ width: "100%" }}>
                  <tr className="divide-x divide-slate-200/50" style={{ display: "flex", width: "100%" }}>
                    <th className="px-3 py-3.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-16 bg-white flex items-center justify-center">#</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-white flex-1 flex items-center">Type</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-white flex-1 flex items-center">Tanggal</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-white flex-1 flex items-center">Kode Produk</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-white flex-1 flex items-center">Nama Bahan</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-white flex-1 flex items-center">UOM</th>
                    <th className="px-4 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider bg-white flex-1 flex items-center justify-end">Qty</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-white flex-1 flex items-center">Loc Asal</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-white flex-1 flex items-center">Loc Tujuan</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-white flex-1 flex items-center">No. Doc</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-white flex-1 flex items-center">Keterangan</th>
                  </tr>
                </thead>'''

# The current code might not be exactly this because of previous regex.
# Let's just find the <thead... and replace everything until </thead>
new_thead = '''<thead className="bg-slate-50 sticky top-0 z-10" style={{ width: "100%" }}>
                  <tr className="divide-x divide-slate-200/50" style={{ display: "flex", width: "100%" }}>
                    <th className="px-3 py-3.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-16 bg-white flex items-center justify-center">#</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-white flex-1 flex items-center">Type</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-white flex-1 flex items-center">Tanggal</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-white flex-[2] flex items-center">Kode Produk</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-white flex-[3] flex items-center">Nama Bahan</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-white flex-1 flex items-center">UOM</th>
                    <th className="px-4 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider bg-white flex-1 flex items-center justify-end">Qty</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-white flex-1 flex items-center">Loc Asal</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-white flex-1 flex items-center">Loc Tujuan</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-white flex-1 flex items-center">No. Doc</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-white flex-[2] flex items-center">Keterangan</th>
                  </tr>
                </thead>'''

code = re.sub(r'<thead.*?</thead>', new_thead, code, flags=re.DOTALL)

with open('src/modules/inventory/TransactionInput.tsx', 'w') as f:
    f.write(code)
