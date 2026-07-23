import fs from 'fs';

let content = fs.readFileSync('src/modules/inventory/TransactionInput.tsx', 'utf-8');

// Insert OCR button state and handler
const handlerCode = `
  const [ocrLoading, setOcrLoading] = useState(false);
  const handleOcrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setOcrLoading(true);
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        try {
          const base64 = reader.result?.toString().split(',')[1];
          const mimeType = file.type;
          
          const res = await fetch('/api/gemini/ocr-tally-sheet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: base64, mimeType })
          });
          
          const data = await res.json();
          if (data.error) throw new Error(data.error);
          
          const extracted = data.extractedData;
          if (!Array.isArray(extracted) || extracted.length === 0) {
            alert("Tidak ada data yang berhasil diekstrak.");
            return;
          }
          
          const newItems = extracted.map((item: any) => ({
            id: Math.random().toString(36).substring(2, 9),
            kodeProduk: item.kodeProduk || 'UNKNOWN',
            namaBahan: item.namaProduk || '',
            kuantitas: parseFloat(item.qty) || 0,
            uom: 'Pcs',
            locator: item.lCode || formLocator || 'UNKNOWN',
            locatorTo: ''
          }));
          setItemsList(prev => [...prev, ...newItems]);
          alert(\`Berhasil mengekstrak \${newItems.length} barang dari dokumen! Silakan lengkapi kode/locator bila perlu.\`);
        } catch(err:any) {
           alert("Gagal OCR: " + err.message);
        } finally {
          setOcrLoading(false);
        }
      };
    } catch (err: any) {
      alert("Gagal melakukan OCR: " + err.message);
      setOcrLoading(false);
    } finally {
      if (e.target) e.target.value = '';
    }
  };
`;

content = content.replace('const handleRemoveItem = (id: string) => {', handlerCode + '\n  const handleRemoveItem = (id: string) => {');

const newFormSubmit = `
  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (itemsList.length === 0) {
      alert('Mohon masukkan minimal 1 barang ke dalam daftar dengan mengklik tombol "+ Tambahkan ke Daftar"!');
      return;
    }
    if (!formTanggal) {
      alert('Mohon tentukan tanggal transaksi!');
      return;
    }

    setSubmitting(true);
    try {
      // AI Anomaly Detection
      try {
        const historyData = transactions.slice(0, 50).map(t => ({qty: t.kuantitas, tipe: t.tipe}));
        const checkRes = await fetch('/api/gemini/detect-anomaly', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transaction: itemsList, history: historyData })
        });
        const anomalyData = await checkRes.json();
        if (anomalyData.isAnomaly) {
           const proceed = window.confirm(\`[AI Anomaly Alert] \${anomalyData.reason}\\n\\nYakin ingin melanjutkan menyimpan data ini?\`);
           if (!proceed) {
             setSubmitting(false);
             return;
           }
        }
      } catch (err) {
        console.warn("Anomaly detection failed", err);
      }

      const rows = itemsList.map(item => [
`;
content = content.replace(/const handleFormSubmit = async \(e: FormEvent\) => {[\s\S]*?const rows = itemsList.map\(item => \[/, newFormSubmit);

const newOcrButton = `
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-600" /> Input Transaksi Multi-Item Baru ({title})
            </h3>
            <div className="flex items-center gap-3">
              <label className={\`cursor-pointer px-4 py-1.5 border border-purple-200 bg-purple-50 text-purple-700 rounded-lg text-sm font-semibold shadow-sm hover:bg-purple-100 transition-colors flex items-center gap-2 \${ocrLoading ? 'opacity-50 cursor-not-allowed' : ''}\`}>
                {ocrLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                {ocrLoading ? 'Ekstrak AI...' : 'Scan Tally Sheet (AI OCR)'}
                <input type="file" accept="image/*" className="hidden" onChange={handleOcrUpload} disabled={ocrLoading} />
              </label>
              <button 
                type="button" 
                onClick={() => setFormOpen(false)} 
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold hover:underline"
              >
                Batal / Tutup
              </button>
            </div>
`;
content = content.replace(/<h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">[\s\S]*?Batal \/ Tutup[\s\S]*?<\/button>/, newOcrButton);

fs.writeFileSync('src/modules/inventory/TransactionInput.tsx', content, 'utf-8');
console.log("Updated TransactionInput.tsx");
