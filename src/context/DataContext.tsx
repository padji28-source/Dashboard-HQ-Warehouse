import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { fetchSheetData, fetchCombinedProducts } from '../lib/sheets';
import { AREA_URLS } from '../App';

interface Transaction {
  tipe: string;
  pCode: string;
  pName: string;
  lCode: string;
  toLocator?: string;
  qty: number;
  area: string;
  tanggal: string;
  source: string;
  uom: string;
}

interface DataContextType {
  transactions: Transaction[];
  productsMap: Map<string, any>;
  locatorsMap: Map<string, any>;
  loading: boolean;
  error: string | null;
  refreshData: (force?: boolean) => Promise<void>;
  lastUpdated: Date | null;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children, spreadsheetId, area }: { children: React.ReactNode, spreadsheetId: string, area: string }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [productsMap, setProductsMap] = useState<Map<string, any>>(new Map());
  const [locatorsMap, setLocatorsMap] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refreshData = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const isHQ = area === 'All Cabang' || area === 'HQ';
      const pMap = new Map<string, any>();
      const lMap = new Map<string, any>();
      const allTx: Transaction[] = [];

      // 1. Fetch Products once
      const combinedProds = await fetchCombinedProducts(force).catch(() => []);
      combinedProds.forEach(p => {
        const pCode = p.kode.toUpperCase().trim();
        pMap.set(pCode, p.nama);
        // Also map per area for RPH if needed (CekStock uses this)
        pMap.set(pCode + '_FULL', p);
      });

      const fetchArea = async (aName: string, aUrl: string) => {
        const sheets = ["'INPUT'!A2:J", "'INPUT RM'!A2:J", "'INPUT MFG'!A2:J", "'INPUT SUPPLIES'!A2:J"];
        const names = ["INPUT", "INPUT RM", "INPUT MFG", "INPUT SUPPLIES"];
        
        const results = await Promise.all([
          ...sheets.map(s => fetchSheetData(aUrl, s, force).catch(() => [])),
          fetchSheetData(aUrl, "'MASTER_LOCATOR'!A2:E", force).catch(() => [])
        ]);

        const locData = results[4];
        locData.forEach((r: any[]) => {
          if (r[0] || r[1]) {
            const k = String(r[0] || '').trim().toUpperCase();
            if (k) lMap.set(k, { nama: String(r[1] || r[0]).trim(), whType: String(r[3] || '').trim(), area: String(r[4] || aName).trim() });
          }
        });

        for (let i = 0; i < 4; i++) {
          const rows = results[i];
          rows.forEach((r: any[]) => {
            if (!r[0] || !r[1] || r[1] === '#N/A') return;
            const pName = String(r[1] || '').trim();
            let pCode = String(r[9] || '').trim();
            if (!pCode || pCode === '#N/A') pCode = pName;
            
            const qty = parseFloat(String(r[2] || '0').replace(',', '.')) || 0;
            const tipe = String(r[4] || '').trim().toUpperCase();
            const tDate = String(r[0] || '').trim();
            const uom = String(r[3] || '').trim();

            if (tipe === 'TRANSFER' || tipe === 'TF') {
              const fromL = String(r[5] || '').trim();
              const toL = String(r[6] || '').trim();
              if (fromL) allTx.push({ tipe: 'OUT', pCode, pName, lCode: fromL, qty, area: aName, tanggal: tDate, source: names[i], uom, toLocator: toL });
              if (toL) allTx.push({ tipe: 'IN', pCode, pName, lCode: toL, qty, area: aName, tanggal: tDate, source: names[i], uom });
            } else {
              const lCode = String(r[5] || r[6] || '').trim();
              if (lCode) allTx.push({ tipe: tipe || 'IN', pCode, pName, lCode, qty, area: aName, tanggal: tDate, source: names[i], uom });
            }
          });
        }
      };

      if (isHQ) {
        await Promise.all(Object.entries(AREA_URLS).map(([name, url]) => fetchArea(name, url)));
      } else {
        await fetchArea(area, spreadsheetId);
      }

      setTransactions(allTx);
      setProductsMap(pMap);
      setLocatorsMap(lMap);
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [spreadsheetId, area]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  return (
    <DataContext.Provider value={{ transactions, productsMap, locatorsMap, loading, error, refreshData, lastUpdated }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) throw new Error('useData must be used within a DataProvider');
  return context;
}
