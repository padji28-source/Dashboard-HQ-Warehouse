import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

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
      const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSbvA_5FOxi2-nkfz8iJbptOhDfBCLM5LnTwrVLeJ4pf1hlGjSBywsTXQYYtEjuo0DY2M63wcJmc0tP/pub?gid=263347272&single=true&output=csv';
      const response = await fetch(csvUrl);
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
