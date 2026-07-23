import fs from 'fs';
let content = fs.readFileSync('src/modules/inventory/PencocokanData.tsx', 'utf-8');

const targetContentRegex = /Periode: <strong>\{formatToDDMMYYYY\(activeSavedSession\.date\)\}<\/strong> \| [\s\S]*?Prediksi Selisih \(AI\)[\s\S]*?<\/button>\s*<\/div>\s*<\/div>/;

const correctContent = `Periode: <strong>{formatToDDMMYYYY(activeSavedSession.date)}</strong> | 
                Disimpan pada: <strong>{new Date(activeSavedSession.timestamp).toLocaleString('id-ID')}</strong>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveSavedSession(null)}
            className="px-4 py-2 border border-amber-300 hover:bg-amber-100 bg-amber-50 text-amber-900 font-bold text-xs sm:text-sm rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition-all focus:outline-none"
          >
            <Undo className="w-4 h-4 text-amber-700" />
            Kembali ke Data Live (Real-Time)
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Scale className="w-6 h-6 text-blue-600" />
            Pencocokan Data (Reconciliation)
          </h2>
          <p className="text-sm text-slate-500">
            Bandingkan kuantitas fisik wilayah lapangan dengan catatan ledger pusat (Google Sheet Data MTS).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!activeSavedSession && (
            <button
              type="button"
              onClick={initSaveSession}
              disabled={loading || filteredReconciliation.length === 0}
              className="px-3.5 py-2 border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold rounded-lg flex items-center gap-2 transition-colors shadow-sm text-sm disabled:opacity-50"
              title="Kunci & Simpan Rekonsiliasi Saat Ini"
            >
              <Lock className="w-4 h-4" />
              Kunci & Simpan Sesi
            </button>
          )}

          <button 
            type="button"
            onClick={loadData} 
            disabled={!!activeSavedSession}
            className="px-3.5 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-lg flex items-center gap-2 transition-colors shadow-sm text-sm disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Refresh Sinkronisasi
          </button>

          <button 
            type="button"
            onClick={handleExportExcel}
            disabled={loading || displayedList.length === 0}
            className="px-3.5 py-2 border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold rounded-lg flex items-center gap-2 transition-colors shadow-sm text-sm disabled:opacity-50"
            title="Ekspor data rekonsiliasi ke Microsoft Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-4.5 h-4.5 text-blue-600" />
            Export Excel
          </button>
          
          <button 
            type="button"
            onClick={handlePredictCycleCount}
            disabled={loading || predictLoading || reconciliationList.length === 0}
            className={\`px-3.5 py-2 border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 font-semibold rounded-lg flex items-center gap-2 transition-colors shadow-sm text-sm disabled:opacity-50 \${predictLoading ? 'animate-pulse' : ''}\`}
            title="Prediksi barang rentan selisih menggunakan AI"
          >
            {predictLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4.5 h-4.5 text-purple-600" />}
            {predictLoading ? 'Menganalisis...' : 'Prediksi Selisih (AI)'}
          </button>
        </div>
      </div>`;

content = content.replace(targetContentRegex, correctContent);
fs.writeFileSync('src/modules/inventory/PencocokanData.tsx', content, 'utf-8');
console.log("Fixed PencocokanData.tsx part 2");
