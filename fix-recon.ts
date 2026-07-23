import fs from 'fs';
let content = fs.readFileSync('src/modules/inventory/PencocokanData.tsx', 'utf-8');

const handlerCode = `
  const [predictLoading, setPredictLoading] = useState(false);
  const handlePredictCycleCount = async () => {
    try {
      setPredictLoading(true);
      
      const payload = reconciliationList.slice(0, 100).map((i: any) => ({
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

content = content.replace('const handleExportExcel = async () => {', handlerCode + '\n  const handleExportExcel = async () => {');
fs.writeFileSync('src/modules/inventory/PencocokanData.tsx', content, 'utf-8');
console.log("Fixed PencocokanData.tsx");
