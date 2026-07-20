import React, { useEffect, useState, useMemo, useRef, memo } from "react";
import { fetchAndParseCSV } from "../../lib/csvCache";
import {
  StockSummary,
} from "../../shared/types";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import ExecutiveDashboard from "../dashboard/ExecutiveDashboard";
import { useData } from '../../context/DataContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function StockOverview({
  spreadsheetId,
  area,
  onNavigateToTab,
}: {
  spreadsheetId: string;
  area: string;
  onNavigateToTab?: (tabId: string) => void;
}) {
  const { transactions: allTransactions, productsMap, locatorsMap, loading: dataLoading, refreshData } = useData();
  const [loading, setLoading] = useState(false);
  const [activeStocks, setActiveStocks] = useState<StockSummary[]>([]);
  const [search, setSearch] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<{
    kodeProduk: string;
    namaProduk: string;
  } | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const [selectedSource, setSelectedSource] = useState("ALL");
  const [mtsMap, setMtsMap] = useState<Map<string, number>>(new Map());

  const loadMtsData = async () => {
    const mtsMapLocal = new Map<string, number>();
    try {
        const dataMts = await fetchAndParseCSV<string[]>('/api/stock-summary', false, 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSbvA_5FOxi2-nkfz8iJbptOhDfBCLM5LnTwrVLeJ4pf1hlGjSBywsTXQYYtEjuo0DY2M63wcJmc0tP/pub?gid=263347272&single=true&output=csv');
          
          if (dataMts.length > 0) {
            let headerIndex = 0;
            for (let i = 0; i < Math.min(10, dataMts.length); i++) {
              const nonEmpCount = dataMts[i].filter(val => String(val).trim().length > 0).length;
              if (nonEmpCount > 3) {
                headerIndex = i;
                break;
              }
            }
            const rawHeaders = dataMts[headerIndex] || [];
            const cleanedHeaders = rawHeaders.map(h => String(h).trim());

            const colLoc = cleanedHeaders.findIndex(h => h.toLowerCase().includes('locator'));
            const colSku = cleanedHeaders.findIndex(h => h.toLowerCase().includes('search key') || h.toLowerCase() === 'sku' || h.toLowerCase().includes('produk'));
            const colName = cleanedHeaders.findIndex(h => h.toLowerCase() === 'name' || h.toLowerCase().includes('nama'));
            const colLastQty = cleanedHeaders.findIndex(h => h.toLowerCase().includes('last qty') || h.toLowerCase().includes('sistem'));

            const mtsRows = dataMts.slice(headerIndex + 1);
            mtsRows.forEach(row => {
              const loc = colLoc !== -1 ? String(row[colLoc] || '').trim().toUpperCase() : '';
              const sku = colSku !== -1 ? String(row[colSku] || '').trim().toUpperCase() : '';
              const name = colName !== -1 ? String(row[colName] || '').trim().toUpperCase() : '';
              
              let lastQty = 0;
              if (colLastQty !== -1 && row[colLastQty] !== undefined) {
                let valStr = String(row[colLastQty]).trim();
                valStr = valStr.replace(/[^0-9.-]/g, '');
                lastQty = parseFloat(valStr) || 0;
              }

              if (loc) {
                if (sku) mtsMapLocal.set(`${sku}_${loc}`, lastQty);
                if (name) mtsMapLocal.set(`${name}_${loc}`, lastQty);
              }
            });
          }
      } catch (err) {
        console.error('Failed to fetch MTS database:', err);
      }
      setMtsMap(mtsMapLocal);
  };

  useEffect(() => {
    loadMtsData();
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    await Promise.all([refreshData(true), loadMtsData()]);
    setLoading(false);
  };

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    if (autoRefresh) {
      intervalId = setInterval(() => {
        refreshData(false);
      }, 30000);
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [autoRefresh, refreshData]);

  useEffect(() => {
    const stockMap = new Map<string, StockSummary>();
    const selectedDate = new Date().toISOString().split('T')[0];

    const transactionsCount = allTransactions.length;
    for (let i = 0; i < transactionsCount; i++) {
      const t = allTransactions[i];
      if (selectedSource !== "ALL" && t.source !== selectedSource) continue;

      const { tipe, pCode, pName, lCode, qty, area: rowArea, tanggal } = t;
      if (tanggal && tanggal > selectedDate) continue;

      const key = `${rowArea}_${lCode}_${pCode}`;
      let summary = stockMap.get(key);
      
      if (!summary) {
        const lookupKey = lCode.trim();
        const lData = locatorsMap.get(lookupKey) ||
          locatorsMap.get(lookupKey.toUpperCase()) || {
            nama: lCode,
            whType: "",
            area: rowArea,
          };
        summary = {
          kodeProduk: pCode === pName ? "" : pCode,
          namaProduk: productsMap.get(pCode) || pName || pCode,
          whGroup: lCode,
          namaLocator: lData.nama,
          whType: lData.whType,
          area: rowArea || lData.area || area,
          totalIn: 0,
          totalOut: 0,
          stock: 0,
        };
        stockMap.set(key, summary);
      }

      const normalizedTipe = (tipe || '').replace(/\s+/g, "").toUpperCase();
      const isIN = normalizedTipe === "IN" || normalizedTipe.includes("AWAL") || normalizedTipe === "MASUK" || normalizedTipe === "RECEIPT";
      const isOUT = normalizedTipe === "OUT" || normalizedTipe === "KELUAR" || normalizedTipe === "ISSUE" || normalizedTipe === "PEMAKAIAN" || normalizedTipe === "TRANSFER" || normalizedTipe === "TF";

      if (isIN) {
        summary.totalIn += qty;
        summary.stock += qty;
      } else if (isOUT) {
        summary.totalOut += qty;
        summary.stock -= qty;
      } else if (qty > 0) {
        summary.totalIn += qty;
        summary.stock += qty;
      }
    }

    stockMap.forEach((summary) => {
      const pCodeUpper = (summary.kodeProduk || '').toUpperCase().trim();
      const pNameUpper = (summary.namaProduk || '').toUpperCase().trim();
      const locKey = (summary.whGroup || '').toUpperCase().trim();

      let qtySistem = 0;
      if (mtsMap.has(`${pCodeUpper}_${locKey}`)) {
        qtySistem = mtsMap.get(`${pCodeUpper}_${locKey}`) || 0;
      } else if (mtsMap.has(`${pNameUpper}_${locKey}`)) {
        qtySistem = mtsMap.get(`${pNameUpper}_${locKey}`) || 0;
      }

      summary.qtySistem = qtySistem;
      summary.selisih = Math.round((summary.stock - qtySistem) * 1000) / 1000;
    });

    const filteredByArea = Array.from(stockMap.values()).filter((s) => {
      const hasActivity = s.totalIn > 0 || s.totalOut > 0 || Math.abs(s.stock) > 0.001 || Math.abs(s.qtySistem) > 0.001;
      if (!hasActivity) return false;
      
      if (area && area !== "HQ" && area !== "All Cabang" && area.toLowerCase() !== "all") {
        return (s.area || "").trim().toLowerCase() === area.trim().toLowerCase();
      }
      return true;
    });

    setActiveStocks(filteredByArea);
  }, [allTransactions, selectedSource, productsMap, locatorsMap, area, mtsMap]);

  return (
    <ExecutiveDashboard 
      stockSummary={activeStocks}
      allTransactions={allTransactions}
      area={area}
      loading={loading || dataLoading}
      onRefresh={handleRefresh}
      onNavigateToTab={onNavigateToTab || (() => {})}
    />
  );
}

export default memo(StockOverview);
