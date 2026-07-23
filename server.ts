import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // API Route to proxy Google Apps Script requests (fixes browser CORS POST redirect issues)
  app.post("/api/sheets", async (req, res) => {
    try {
      const { gasUrl, action, range, values } = req.body;
      if (!gasUrl || gasUrl === "HQ" || !gasUrl.startsWith("http")) {
        return res.status(400).json({ error: "Invalid or missing gasUrl parameter" });
      }

      if (action === 'get') {
        const getUrl = `${gasUrl}?action=get&range=${encodeURIComponent(range || '')}&t=${Date.now()}`;
        const response = await fetch(getUrl);
        if (!response.ok) {
          console.warn(`[Proxy Warning] Google Sheets GET returned HTTP ${response.status} for range: ${range}`);
          return res.status(response.status).json({ error: `Google Sheets GET failed: HTTP ${response.status}` });
        }
        const text = await response.text();
        try {
          return res.json(JSON.parse(text));
        } catch {
          return res.status(502).json({ error: "Respon JSON tidak valid dari Google Sheets" });
        }
      }

      // POST action (append, update, init)
      const response = await fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action, range, values })
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        console.warn("Non-JSON response from Apps Script POST:", text.slice(0, 200));
        return res.status(502).json({ error: "Respon tidak valid dari server Google Sheets. Pastikan Google Apps Script di-deploy dengan pengaturan Who has access: Anyone." });
      }

      if (!response.ok || data.error) {
        return res.status(response.ok ? 400 : response.status).json({ error: data.error || `Apps Script HTTP ${response.status}` });
      }

      res.json(data);
    } catch (err: any) {
      console.warn("Soft error in /api/sheets proxy:", err.message || err);
      res.status(502).json({ error: err.message || "Gagal menghubungi server Google Sheets" });
    }
  });

  // Cache MTS data in memory for 10 minutes (600,000 ms)
  let cachedMts: string | null = null;
  let cacheTime = 0;

  // API Route to proxy the MTS CSV
  app.get("/api/stock-summary", async (req, res) => {
    try {
      const now = Date.now();
      const forceRefresh = !!req.query.t;
      if (!forceRefresh && cachedMts && now - cacheTime < 600000) {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        return res.send(cachedMts);
      }

      console.log("Fetching fresh MTS CSV from Google Sheets...");
      // Use hl=id to force Indonesian locale (DD/MM/YYYY) consistently regardless of server location
      const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSbvA_5FOxi2-nkfz8iJbptOhDfBCLM5LnTwrVLeJ4pf1hlGjSBywsTXQYYtEjuo0DY2M63wcJmc0tP/pub?gid=263347272&single=true&output=csv&hl=id';
      const response = await fetch(csvUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
          "Accept": "text/csv,application/csv,text/plain,*/*",
          "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7"
        }
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch from Google Sheets: ${response.status} ${response.statusText}`);
      }

      const data = await response.text();
      cachedMts = data;
      cacheTime = now;

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.send(data);
    } catch (err: any) {
      console.error("Error in /api/mts proxy:", err);
      // Fallback to expired cache if we have one
      if (cachedMts) {
        console.log("Serving expired cached MTS CSV as fallback");
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        return res.send(cachedMts);
      }
      res.status(500).json({ error: err.message || "Failed to fetch MTS CSV" });
    }
  });

  // AI Endpoints
  app.post("/api/gemini/predict-cycle-count", async (req, res) => {
    try {
      const { items } = req.body;
      
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: `Analisis data pergerakan stok inventaris berikut dan prediksikan 5 barang yang paling berisiko tinggi mengalami selisih (discrepancy) untuk cycle counting hari ini. Prioritaskan barang dengan jumlah transaksi tinggi, mutasi besar, dan histori selisih sebelumnya.\n\nData:\n${JSON.stringify(items).substring(0, 50000)}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                kodeProduk: { type: Type.STRING },
                namaProduk: { type: Type.STRING },
                riskScore: { type: Type.NUMBER, description: "Skor risiko 1-100" },
                reason: { type: Type.STRING, description: "Alasan mengapa barang ini berisiko" }
              },
              required: ["kodeProduk", "namaProduk", "riskScore", "reason"]
            }
          }
        }
      });
      
      res.json({ predictions: JSON.parse(response.text || "[]") });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/gemini/detect-anomaly", async (req, res) => {
    try {
      const { transaction, history } = req.body;
      
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: `Saya memiliki sebuah transaksi inventaris baru dan data historis. Evaluasi apakah transaksi baru ini merupakan anomali (kemungkinan salah ketik atau tidak normal) berdasarkan tren historis.\n\nTransaksi Baru:\n${JSON.stringify(transaction)}\n\nHistoris (Rata-rata/Rentang):\n${JSON.stringify(history)}\n\nJawab dengan status anomali dan alasan singkat.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isAnomaly: { type: Type.BOOLEAN },
              confidence: { type: Type.NUMBER, description: "Tingkat keyakinan 0-100" },
              reason: { type: Type.STRING }
            },
            required: ["isAnomaly", "confidence", "reason"]
          }
        }
      });
      
      res.json(JSON.parse(response.text || "{}"));
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/gemini/ocr-tally-sheet", async (req, res) => {
    try {
      const { imageBase64, mimeType } = req.body;
      
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash", // Or gemini-3.6-flash since we are using image text extraction
        contents: {
          parts: [
            {
              inlineData: {
                data: imageBase64,
                mimeType: mimeType || "image/jpeg"
              }
            },
            { text: "Ekstrak data dari tally sheet atau surat jalan ini menjadi format tabel terstruktur. Ambil tanggal, nama barang, kode barang, locator/area, kuantitas, dan tipe pergerakan (IN/OUT/TRANSFER). Abaikan coretan yang tidak relevan." }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                tanggal: { type: Type.STRING },
                namaProduk: { type: Type.STRING },
                kodeProduk: { type: Type.STRING },
                lCode: { type: Type.STRING, description: "Locator/Area" },
                qty: { type: Type.NUMBER },
                tipe: { type: Type.STRING, description: "IN, OUT, atau TRANSFER" }
              },
              required: ["namaProduk", "qty", "tipe"]
            }
          }
        }
      });
      
      res.json({ extractedData: JSON.parse(response.text || "[]") });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
      optimizeDeps: { force: true },
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // SPA fallback
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
