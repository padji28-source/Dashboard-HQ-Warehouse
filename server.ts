import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // API Route to proxy Google Apps Script requests (fixes browser CORS POST redirect issues)
  app.post("/api/sheets", async (req, res) => {
    try {
      const { gasUrl, action, range, values } = req.body;
      if (!gasUrl) {
        return res.status(400).json({ error: "Missing gasUrl parameter" });
      }

      if (action === 'get') {
        const getUrl = `${gasUrl}?action=get&range=${encodeURIComponent(range || '')}&t=${Date.now()}`;
        const response = await fetch(getUrl);
        if (!response.ok) {
          throw new Error(`Google Sheets GET failed: HTTP ${response.status}`);
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
        console.error("Non-JSON response from Apps Script POST:", text.slice(0, 200));
        return res.status(502).json({ error: "Respon tidak valid dari server Google Sheets. Pastikan Google Apps Script di-deploy dengan pengaturan Who has access: Anyone." });
      }

      if (!response.ok || data.error) {
        return res.status(400).json({ error: data.error || `Apps Script HTTP ${response.status}` });
      }

      res.json(data);
    } catch (err: any) {
      console.error("Error in /api/sheets proxy:", err);
      res.status(500).json({ error: err.message || "Gagal menghubungi server Google Sheets" });
    }
  });

  // Cache MTS data in memory for 10 minutes (600,000 ms)
  let cachedMts: string | null = null;
  let cacheTime = 0;

  // API Route to proxy the MTS CSV
  app.get("/api/mts", async (req, res) => {
    try {
      const now = Date.now();
      if (cachedMts && now - cacheTime < 600000) {
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

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
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
