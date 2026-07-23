import fs from 'fs';

let content = fs.readFileSync('src/modules/inventory/PencocokanData.tsx', 'utf-8');

const handlerCode = `
  const [predictLoading, setPredictLoading] = useState(false);
  const handlePredictCycleCount = async () => {
    try {
      setPredictLoading(true);
      
      const payload = reconciliationList.slice(0, 100).map(i => ({
        kodeProduk: i.kodeProduk,
        namaProduk: i.namaProduk,
        mutasiQty: i.mutasiQty,
        selisihSebelumnya: i.selisih,
        stockSistem: i.stockSistem
      }));
      
      const res = await fetch('/api/gemini/predict-cycle-count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payload })
      });
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      let msg = "Rekomendasi Cycle Counting Berbasis AI:\\n\\n";
      data.predictions.forEach((p: any, idx: number) => {
         msg += \`\${idx+1}. \${p.namaProduk} (\${p.kodeProduk})\\n   Skor Risiko: \${p.riskScore}/100\\n   Alasan: \${p.reason}\\n\\n\`;
      });
      alert(msg);
      
    } catch(err:any) {
      alert("Gagal melakukan prediksi AI: " + err.message);
    } finally {
      setPredictLoading(false);
    }
  };
`;

content = content.replace('const handleExportExcel = () => {', handlerCode + '\n  const handleExportExcel = () => {');

const newButtons = `
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
`;

content = content.replace(/<button[\s\S]*?onClick=\{handleExportExcel\}[\s\S]*?<\/button>/, newButtons);

fs.writeFileSync('src/modules/inventory/PencocokanData.tsx', content, 'utf-8');
console.log("Updated PencocokanData.tsx");
