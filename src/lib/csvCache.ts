import Papa from 'papaparse';

const cache = new Map<string, { data: any, timestamp: number }>();
const inFlight = new Map<string, Promise<any>>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function fetchAndParseCSV<T = any>(url: string, forceFresh = false, directFallbackUrl?: string): Promise<T[]> {
  const baseUrl = url.split('&t=')[0].split('?t=')[0];

  const now = Date.now();
  if (!forceFresh && cache.has(baseUrl)) {
    const cached = cache.get(baseUrl)!;
    if (now - cached.timestamp < CACHE_TTL) {
      console.log(`[CSV Cache Hit] ${baseUrl}`);
      return cached.data;
    }
  }

  if (inFlight.has(baseUrl)) {
    console.log(`[CSV Cache Coalescing] ${baseUrl}`);
    return inFlight.get(baseUrl)! as Promise<T[]>;
  }

  console.log(`[CSV Fetch] ${baseUrl}`);
  const fetchUrl = baseUrl.includes('?') ? `${baseUrl}&t=${now}` : `${baseUrl}?t=${now}`;

  const promise = (async () => {
    let lastErr: any;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        let res;
        try {
          console.log(`[CSV Fetch Attempt ${attempt}] ${fetchUrl}`);
          res = await fetch(fetchUrl, { cache: 'no-store' });
        } catch (fetchErr) {
          if (directFallbackUrl) {
            console.warn(`[CSV Fetch] Proxy fetch threw error, trying fallback ${directFallbackUrl}:`, fetchErr);
            const fbUrl = directFallbackUrl.includes('?') ? `${directFallbackUrl}&t=${now}` : `${directFallbackUrl}?t=${now}`;
            res = await fetch(fbUrl, { cache: 'no-store' });
          } else {
            throw fetchErr;
          }
        }
        
        if (!res.ok && directFallbackUrl && attempt === 1) {
            console.warn(`[CSV Fetch] Fetch failed with status ${res.status}, trying fallback ${directFallbackUrl}`);
            const fbUrl = directFallbackUrl.includes('?') ? `${directFallbackUrl}&t=${now}` : `${directFallbackUrl}?t=${now}`;
            res = await fetch(fbUrl, { cache: 'no-store' });
        }

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        
        const parsed = Papa.parse<T>(text, { skipEmptyLines: true });
        const data = parsed.data;
        cache.set(baseUrl, { data, timestamp: Date.now() });
        return data;
      } catch (err: any) {
        console.error(`[CSV Fetch Failed Attempt ${attempt}]`, err);
        lastErr = err;
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
      }
    }
    throw new Error(`Gagal memuat data CSV setelah beberapa kali percobaan: ${lastErr?.message || 'Unknown error'}`);
  })()
  .finally(() => {
    inFlight.delete(baseUrl);
  });

  inFlight.set(baseUrl, promise);
  return promise;
}
