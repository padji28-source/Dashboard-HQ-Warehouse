/**
 * GOOGLE APPS SCRIPT CODE TO DEPLOY:
 * 
 * 1. Open your Google Sheet
 * 2. Extensions > Apps Script
 * 3. Paste the following code:
 * 
function doGet(e) {
  var action = e.parameter.action;
  var range = e.parameter.range;
  if (action === "get") {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    try {
      var sheetData = ss.getRange(range).getValues();
      return ContentService.createTextOutput(JSON.stringify({ values: sheetData })).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
    }
  }
  return ContentService.createTextOutput(JSON.stringify({ error: "Unknown GET action" })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var postData = JSON.parse(e.postData.contents);
  var action = postData.action;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  try {
    if (action === "append") {
      var range = postData.range;
      var values = postData.values;
      var sheetName = range.split("!")[0].replace(/'/g, "");
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) return ContentService.createTextOutput(JSON.stringify({ error: "Sheet not found" })).setMimeType(ContentService.MimeType.JSON);
      sheet.getRange(sheet.getLastRow() + 1, 1, values.length, values[0].length).setValues(values);
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === "update") {
      var range = postData.range;
      var values = postData.values;
      var sheetName = range.split("!")[0].replace(/'/g, "");
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) return ContentService.createTextOutput(JSON.stringify({ error: "Sheet not found" })).setMimeType(ContentService.MimeType.JSON);
      var gridRange = sheet.getRange(range.split("!")[1]);
      gridRange.setValues(values);
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === "init") {
      var sheetsToCreate = [
        { title: 'MASTER_PRODUK', headers: ['Kode Produk', 'Nama Produk', 'Satuan', 'Kategori'] },
        { title: 'MASTER_LOCATOR', headers: ['WH Group', 'Nama Locator', 'Deskripsi', 'WH Type', 'Area'] },
        { title: 'INPUT', headers: ['Tanggal', 'Nama Bahan', 'Qty', 'UOM', 'I/O/A', 'Locator', 'Locator To', 'No. Document', 'Keterangan', 'Kode'] },
        { title: 'INPUT RM', headers: ['Tanggal', 'Nama Bahan', 'Qty', 'UOM', 'I/O/A', 'Locator', 'Locator To', 'No. Document', 'Keterangan', 'Kode'] },
        { title: 'INPUT MFG', headers: ['Tanggal', 'Nama Bahan', 'Qty', 'UOM', 'I/O/A', 'Locator', 'Locator To', 'No. Document', 'Keterangan', 'Kode'] },
        { title: 'INPUT SUPPLIES', headers: ['Tanggal', 'Nama Bahan', 'Qty', 'UOM', 'I/O/A', 'Locator', 'Locator To', 'No. Document', 'Keterangan', 'Kode'] },
      ];
      
      sheetsToCreate.forEach(function(s) {
        var sheet = ss.getSheetByName(s.title);
        if (!sheet) {
          sheet = ss.insertSheet(s.title);
          sheet.getRange(1, 1, 1, s.headers.length).setValues([s.headers]);
        }
      });
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ error: "Unknown POST action" })).setMimeType(ContentService.MimeType.JSON);
}
 * 
 * 4. Click Deploy -> New deployment
 * 5. Select type: Web App
 * 6. Execute as: Me
 * 7. Who has access: Anyone
 * 8. Click Deploy and copy the Web App URL.
 */

// Cache to store completed fetches
interface CacheEntry {
  timestamp: number;
  data: any[][];
}
const fetchCache = new Map<string, CacheEntry>();
const CACHE_TTL = 300000; // Increased to 5 minutes (300,000 ms) for extreme speed boost and reduced GSheet API load

// Map to store in-flight requests (Request Coalescing)
const inFlightRequests = new Map<string, Promise<any[][]>>();

export function clearSheetCache() {
  fetchCache.clear();
  inFlightRequests.clear();
  
  // Clear sessionStorage cached items
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const key = window.sessionStorage.key(i);
        if (key && key.startsWith("gsheet_cache_")) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => window.sessionStorage.removeItem(key));
      console.log(`[Cache Clear] Cleaned ${keysToRemove.length} sessionStorage cache items.`);
    }
  } catch (e) {
    console.error("Failed to clear sessionStorage cache", e);
  }
}

export async function fetchSheetData(gasUrl: string, range: string, forceFresh = false) {
  const cacheKey = `${gasUrl}||${range}`;
  const storageKey = `gsheet_cache_${cacheKey}`;

  // 1. Check in-memory Cache (if not forcing fresh)
  if (!forceFresh) {
    const cached = fetchCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      console.log(`[Memory Cache Hit] Returning cached data for range: ${range}`);
      return JSON.parse(JSON.stringify(cached.data)); // Return deep copy to prevent mutation
    }

    // 2. Check sessionStorage Cache (if not forcing fresh)
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        const stored = window.sessionStorage.getItem(storageKey);
        if (stored) {
          const parsed: CacheEntry = JSON.parse(stored);
          if (Date.now() - parsed.timestamp < CACHE_TTL) {
            console.log(`[Session Cache Hit] Returning cached data for range: ${range}`);
            // Warm up in-memory cache
            fetchCache.set(cacheKey, parsed);
            return JSON.parse(JSON.stringify(parsed.data));
          }
        }
      }
    } catch (e) {
      console.warn("sessionStorage retrieval failed:", e);
    }
  }

  // 3. Check if a request for this exact key is already in flight (Coalescing / promise deduplication)
  if (inFlightRequests.has(cacheKey)) {
    console.log(`[Request Coalesced] Awaiting in-flight request for range: ${range}`);
    const inFlightPromise = inFlightRequests.get(cacheKey)!;
    const data = await inFlightPromise;
    return JSON.parse(JSON.stringify(data));
  }

  // 4. Define the actual fetch operation (with automatic retries)
  const fetchPromise = (async () => {
    let attempts = 0;
    const maxAttempts = 3;
    const baseDelay = 1000; // 1 second base delay for backoff

    while (attempts < maxAttempts) {
      try {
        const url = `${gasUrl}?action=get&range=${encodeURIComponent(range)}&t=${Date.now()}`;
        let data;
        try {
          const res = await fetch(url, { cache: 'no-store' });
          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
          }
          data = await res.json();
        } catch (fetchErr: any) {
          if (typeof window !== 'undefined') {
            const proxyRes = await fetch('/api/sheets', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ gasUrl, action: 'get', range })
            });
            if (!proxyRes.ok) throw fetchErr;
            data = await proxyRes.json();
          } else {
            throw fetchErr;
          }
        }

        if (data && data.error) {
          throw new Error(data.error);
        }

        const values = data.values || [];
        
        // Populate in-memory cache
        const cacheEntry: CacheEntry = { timestamp: Date.now(), data: values };
        fetchCache.set(cacheKey, cacheEntry);

        // Populate sessionStorage cache
        try {
          if (typeof window !== "undefined" && window.sessionStorage) {
            window.sessionStorage.setItem(storageKey, JSON.stringify(cacheEntry));
          }
        } catch (e) {
          console.warn("sessionStorage save failed:", e);
        }

        return values;
      } catch (error: any) {
        attempts++;
        console.warn(`[Fetch Effort ${attempts}/${maxAttempts}] for ${range} failed: ${error.message}`);
        if (attempts >= maxAttempts) {
          throw error;
        }
        // Exponential backoff delay with jitter
        const delay = baseDelay * Math.pow(2, attempts - 1) * (0.5 + Math.random());
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    return [];
  })();

  // 5. Save to inFlightRequests map
  inFlightRequests.set(cacheKey, fetchPromise);

  try {
    const data = await fetchPromise;
    return JSON.parse(JSON.stringify(data));
  } finally {
    // 6. Always clean up in-flight request once it's done
    inFlightRequests.delete(cacheKey);
  }
}

async function proxyPost(gasUrl: string, payload: any) {
  if (!gasUrl || gasUrl === 'HQ') {
    throw new Error("URL sistem belum dikonfigurasi untuk cabang ini.");
  }
  const endpoint = typeof window !== 'undefined' ? '/api/sheets' : gasUrl;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gasUrl, ...payload })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    let errMsg = errText;
    try {
      const parsed = JSON.parse(errText);
      if (parsed.error) errMsg = parsed.error;
    } catch {}
    throw new Error(`Gagal menyimpan ke server (HTTP ${res.status}): ${errMsg}`);
  }

  const data = await res.json();
  if (data && data.error) throw new Error(data.error);
  return data;
}

export async function appendSheetRow(gasUrl: string, range: string, values: any[][]) {
  clearSheetCache(); // Invalidate cache on write
  return proxyPost(gasUrl, { action: 'append', range, values });
}

export async function updateSheetRow(gasUrl: string, range: string, values: any[][]) {
  clearSheetCache(); // Invalidate cache on write
  return proxyPost(gasUrl, { action: 'update', range, values });
}

/** Check if the necessary sheets exist, if not create them */
export async function initializeERPSpreadsheet(gasUrl: string) {
  clearSheetCache(); // Invalidate cache on init
  if (!gasUrl || gasUrl === 'HQ') return;
  return proxyPost(gasUrl, { action: 'init' });
}
