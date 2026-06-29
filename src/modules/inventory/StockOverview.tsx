import { useEffect, useState, useMemo, useRef } from "react";
import { fetchSheetData } from "../../lib/sheets";
import { AREA_URLS } from "../../App";
import type {
  Transaction,
  Product,
  Locator,
  StockSummary,
} from "../../shared/types";
import {
  Loader2,
  Search,
  Package,
  ArrowRightLeft,
  Layers,
  ArrowUpRight,
  PlusCircle,
  X,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import ExecutiveDashboard from "../dashboard/ExecutiveDashboard";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function StockOverview({
  spreadsheetId,
  area,
  onNavigateToTab,
}: {
  spreadsheetId: string;
  area: string;
  onNavigateToTab?: (tabId: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [stockSummary, setStockSummary] = useState<StockSummary[]>([]);
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

  const [allTransactions, setAllTransactions] = useState<
    {
      tipe: string;
      pCode: string;
      pName: string;
      lCode: string;
      qty: number;
      source: string;
    }[]
  >([]);
  const [productsMap, setProductsMap] = useState<Map<string, string>>(
    new Map(),
  );
  const [locatorsMap, setLocatorsMap] = useState<
    Map<string, { nama: string; whType: string; area: string }>
  >(new Map());
  const [mtsMap, setMtsMap] = useState<Map<string, number>>(new Map());

  const loadData = async (retryOnMissing = true, forceFresh = false) => {
    try {
      setLoading(true);

      const pMap = new Map<string, string>();
      const lMap = new Map<
        string,
        { nama: string; whType: string; area: string }
      >();
      const mappedRows: {
        tipe: string;
        pCode: string;
        pName: string;
        lCode: string;
        qty: number;
        source: string;
      }[] = [];

      const processRows = (rows: any[], source: string) => {
        console.log(`Processing rows for ${source}:`, rows?.length);
        const validRows = (rows || []).filter((r: any[]) => {
          if (r.length === 0) return false;
          const tanggal = String(r[0] || '').trim();
          const nama = String(r[1] || '').trim();
          const kode = String(r[9] || '').trim();
          return tanggal !== '' && nama !== '' && kode !== '#N/A' && nama !== '#N/A' && tanggal !== '#N/A';
        });
        validRows.forEach((r: any[]) => {
          const pName = String(r[1] || "").trim();
          let pCode = String(r[9] || "").trim();
          const tipe = String(r[4] || "")
            .trim()
            .toUpperCase();

          if (!pName && !pCode) return;
          if (!pCode) {
            pCode = pName;
          }

          const qtyStr = String(r[2] || "0").replace(",", ".");
          let qty = parseFloat(qtyStr) || 0;
          if (isNaN(qty)) qty = 0;

          let fromLocator = String(r[5] || "").trim();
          let toLocator = String(r[6] || "").trim();

          if (!fromLocator && !toLocator) fromLocator = "UNKNOWN_L";

          if (tipe === "TRANSFER" || tipe === "TF") {
            mappedRows.push({
              tipe: "OUT",
              pCode,
              pName,
              lCode: fromLocator || "UNKNOWN_L",
              qty,
              source,
            });
            if (toLocator) {
              mappedRows.push({
                tipe: "IN",
                pCode,
                pName,
                lCode: toLocator,
                qty,
                source,
              });
            }
          } else {
            mappedRows.push({
              tipe: tipe || "IN",
              pCode,
              pName,
              lCode: fromLocator || toLocator || "UNKNOWN_L",
              qty,
              source,
            });
          }
        });
      };

      if (
        area === "HQ" ||
        spreadsheetId === "HQ" ||
        area === "All Cabang" ||
        area.toLowerCase() === "all"
      ) {
        const urlEntries = Object.entries(AREA_URLS);
        await Promise.all(
          urlEntries.map(async ([aName, aUrl]) => {
            try {
              const [tn, tr, tm, ts, pr, lr, mr] = await Promise.all([
                fetchSheetData(aUrl, "'INPUT'!A2:J", forceFresh).catch(() => []),
                fetchSheetData(aUrl, "'INPUT RM'!A2:J", forceFresh).catch(() => []),
                fetchSheetData(aUrl, "'INPUT MFG'!A2:J", forceFresh).catch(() => []),
                fetchSheetData(aUrl, "'INPUT SUPPLIES'!A2:J", forceFresh).catch(() => []),
                fetchSheetData(aUrl, "'MASTER_PRODUK'!A2:B", forceFresh).catch(() => []),
                fetchSheetData(aUrl, "'MASTER_LOCATOR'!A2:E", forceFresh).catch(() => []),
                fetchSheetData(aUrl, "'MTS'!A2:E", forceFresh).catch(() => []),
              ]);

              // Merge MTS
              mr.forEach((r: any[]) => {
                if (r.length < 5) return;
                const pCode = String(r[0] || "").trim();
                const lCode = String(r[2] || "").trim();
                let qty = parseFloat(String(r[4] || "0").replace(",", ".")) || 0;
                if (isNaN(qty)) qty = 0;
                if (pCode && lCode) {
                  setMtsMap(prev => new Map(prev).set(`${pCode}_${lCode}`, qty));
                }
              });

              // Merge products map
              pr.filter((r: any[]) => r.length > 0 && r[0]).forEach(
                (r: any[]) => {
                  pMap.set(String(r[0]).trim(), String(r[1] || "").trim());
                },
              );

              // Merge locators map
              lr.filter((r: any[]) => r.length > 0 && (r[0] || r[1])).forEach(
                (r: any[]) => {
                  const val = {
                    nama: String(r[1] || r[0]).trim(),
                    whType: String(r[3] || "").trim(),
                    area: String(r[4] || aName).trim(),
                  };
                  if (r[0]) {
                    const k = String(r[0]).trim();
                    lMap.set(k, val);
                    lMap.set(k.toUpperCase(), val);
                  }
                  if (r[1]) {
                    const k = String(r[1]).trim();
                    lMap.set(k, val);
                    lMap.set(k.toUpperCase(), val);
                  }
                },
              );

              processRows(tn, "INPUT");
              processRows(tr, "INPUT RM");
              processRows(tm, "INPUT MFG");
              processRows(ts, "INPUT SUPPLIES");
            } catch (e) {
              console.error(`Error loading data for area ${aName}:`, e);
            }
          }),
        );
      } else {
        let txRowsNormal: any[] = [];
        let txRowsRM: any[] = [];
        let txRowsMfg: any[] = [];
        let txRowsSupplies: any[] = [];
        let pRows: any[] = [];
        let lRows: any[] = [];
        let mtsRows: any[] = [];

        try {
          [txRowsNormal, txRowsRM, txRowsMfg, txRowsSupplies, pRows, lRows, mtsRows] =
            await Promise.all([
              fetchSheetData(spreadsheetId, "'INPUT'!A2:J", forceFresh),
              fetchSheetData(spreadsheetId, "'INPUT RM'!A2:J", forceFresh),
              fetchSheetData(spreadsheetId, "'INPUT MFG'!A2:J", forceFresh),
              fetchSheetData(spreadsheetId, "'INPUT SUPPLIES'!A2:J", forceFresh),
              fetchSheetData(spreadsheetId, "'MASTER_PRODUK'!A2:B", forceFresh),
              fetchSheetData(spreadsheetId, "'MASTER_LOCATOR'!A2:E", forceFresh),
              fetchSheetData(spreadsheetId, "'MTS'!A2:E", forceFresh).catch(() => []),
            ]);
        } catch (fetchErr: any) {
          if (retryOnMissing) {
            console.log(
              "StockOverview missing sheet, compiling or trying auto-init...",
            );
            try {
              const { initializeERPSpreadsheet } =
                await import("../../lib/sheets");
              await initializeERPSpreadsheet(spreadsheetId);
              return loadData(false);
            } catch (initErr: any) {
              const initErrMsg = String(initErr.message || "").toLowerCase();
              if (
                initErrMsg.includes("already exists") ||
                initErrMsg.includes("ada") ||
                initErrMsg.includes("exists")
              ) {
                console.log("Sheet already exists, continuing to load data.");
                return loadData(false);
              }
              console.error("Auto-init from StockOverview failed:", initErr);
            }
          }
          // Fallback to individual catches if init fails or retry is off
          txRowsNormal = await fetchSheetData(
            spreadsheetId,
            "'INPUT'!A2:J",
            forceFresh
          ).catch(() => []);
          txRowsRM = await fetchSheetData(
            spreadsheetId,
            "'INPUT RM'!A2:J",
            forceFresh
          ).catch(() => []);
          txRowsMfg = await fetchSheetData(
            spreadsheetId,
            "'INPUT MFG'!A2:J",
            forceFresh
          ).catch(() => []);
          txRowsSupplies = await fetchSheetData(
            spreadsheetId,
            "'INPUT SUPPLIES'!A2:J",
            forceFresh
          ).catch(() => []);
          pRows = await fetchSheetData(
            spreadsheetId,
            "'MASTER_PRODUK'!A2:B",
            forceFresh
          ).catch(() => []);
          lRows = await fetchSheetData(
            spreadsheetId,
            "'MASTER_LOCATOR'!A2:E",
            forceFresh
          ).catch(() => []);
          mtsRows = await fetchSheetData(
            spreadsheetId,
            "'MTS'!A2:E",
            forceFresh
          ).catch(() => []);
        }

        const mtsMap = new Map<string, number>();
        mtsRows.forEach((r: any[]) => {
          if (r.length < 5) return;
          const pCode = String(r[0] || "").trim();
          const lCode = String(r[2] || "").trim();
          let qty = parseFloat(String(r[4] || "0").replace(",", ".")) || 0;
          if (isNaN(qty)) qty = 0;
          if (pCode && lCode) {
            mtsMap.set(`${pCode}_${lCode}`, qty);
          }
        });

        pRows
          .filter((r: any[]) => r.length > 0 && r[0] && r[0] !== '#N/A' && r[1] !== '#N/A')
          .forEach((r: any[]) => {
            pMap.set(String(r[0]).trim(), String(r[1]).trim());
          });

        lRows
          .filter((r: any[]) => r.length > 0 && (r[0] || r[1]) && r[0] !== '#N/A' && r[1] !== '#N/A')
          .forEach((r: any[]) => {
            const val = {
              nama: String(r[1] || r[0]).trim(),
              whType: String(r[3] || "").trim(),
              area: String(r[4] || "").trim(),
            };
            if (r[0]) {
              lMap.set(String(r[0]).trim(), val);
              lMap.set(String(r[0]).trim().toUpperCase(), val);
            }
            if (r[1]) {
              lMap.set(String(r[1]).trim(), val);
              lMap.set(String(r[1]).trim().toUpperCase(), val);
            }
          });

        processRows(txRowsNormal, "INPUT");
        processRows(txRowsRM, "INPUT RM");
        processRows(txRowsMfg, "INPUT MFG");
        processRows(txRowsSupplies, "INPUT SUPPLIES");
        setMtsMap(mtsMap);
      }

      setProductsMap(pMap);
      setLocatorsMap(lMap);
      console.log("mappedRows total:", mappedRows.length);
      setAllTransactions(mappedRows);
    } catch (err: any) {
      alert(`Gagal memuat overview stok: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    
    let intervalId: NodeJS.Timeout;
    if (autoRefresh) {
      intervalId = setInterval(() => {
        loadData(false, true); // retryOnMissing = false, forceFresh = true
      }, 5000); // Poll every 5 seconds for no delay real-time
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [spreadsheetId, area, autoRefresh]);

  useEffect(() => {
    const stockMap = new Map<string, StockSummary>(); // Key: kodeProduk_whGroup

    allTransactions.forEach((t) => {
      if (selectedSource !== "ALL" && t.source !== selectedSource) return;

      const { tipe, pCode, pName, lCode, qty } = t;
      const key = `${pCode}_${lCode}`;
      if (!stockMap.has(key)) {
        const lookupKey = lCode.trim();
        const lData = locatorsMap.get(lookupKey) ||
          locatorsMap.get(lookupKey.toUpperCase()) || {
            nama: lCode,
            whType: "",
            area: "",
          };
        stockMap.set(key, {
          kodeProduk: pCode === pName ? "" : pCode,
          namaProduk: productsMap.get(pCode) || pName || pCode,
          whGroup: lCode,
          namaLocator: lData.nama,
          whType: lData.whType,
          area: lData.area,
          totalIn: 0,
          totalOut: 0,
          stock: 0,
        });
      }

      const summary = stockMap.get(key)!;
      const normalizedTipe = tipe.replace(/\s+/g, "");
      if (
        normalizedTipe === "IN" ||
        normalizedTipe === "AWAL" ||
        normalizedTipe === "MASUK" ||
        normalizedTipe === "RECEIPT" ||
        normalizedTipe === "SALDOAWAL"
      ) {
        summary.totalIn += qty;
        summary.stock += qty;
      } else if (
        normalizedTipe === "OUT" ||
        normalizedTipe === "KELUAR" ||
        normalizedTipe === "ISSUE" ||
        normalizedTipe === "PEMAKAIAN" ||
        normalizedTipe === "TRANSFER" ||
        normalizedTipe === "TF"
      ) {
        summary.totalOut += qty;
        summary.stock -= qty;
      } else {
        if (qty > 0 && !["TRANSFER", "TF"].includes(normalizedTipe)) {
          summary.totalIn += qty;
          summary.stock += qty;
        }
      }
    });

    // Populate qtySistem and selisih
    stockMap.forEach((summary, key) => {
      const qtySistem = mtsMap.get(key) || 0;
      summary.qtySistem = qtySistem;
      // Round to avoid float issues
      summary.selisih = Math.round((summary.stock - qtySistem) * 1000) / 1000;
    });

    console.log("Stock map size:", stockMap.size);

    const filteredByArea = Array.from(stockMap.values()).filter((s) => {
      const hasActivity = s.totalIn > 0 || s.totalOut > 0 || s.stock !== 0;
      if (!hasActivity) return false;

      if (
        area &&
        area !== "HQ" &&
        area !== "All Cabang" &&
        area.toLowerCase() !== "all"
      ) {
        const sArea = (s.area || "").trim().toLowerCase();
        const areaLower = area.trim().toLowerCase();

        const matchesAreaString =
          sArea !== "" &&
          (sArea === areaLower ||
            sArea.includes(areaLower) ||
            areaLower.includes(sArea));
        if (matchesAreaString) {
          return true;
        }

        const locCode = s.whGroup.trim().toUpperCase();

        const areaPrefixes: Record<string, string[]> = {
          jakarta: ["JKT", "JAK"],
          "jakarta a5": ["JKT-A5", "JKT", "JAK"],
          karawang: ["KRW", "KWG", "KAR"],
          semarang: ["SMG", "SEM"],
          surabaya: ["SUB", "SBY", "SUR"],
          jember: ["JMB", "JEM"],
          makassar: ["MKS", "MAK"],
          pontianak: ["PTN", "PON"],
          banjarmasin: ["BJM", "BAN"],
          palembang: ["PLB", "PAL"],
          medan: ["MDN", "MED"],
          pekanbaru: ["PKU", "PEK"],
        };

        const prefixes = areaPrefixes[areaLower] || [
          areaLower.substring(0, 3).toUpperCase(),
        ];
        const matchesPrefix = prefixes.some(
          (pref) => locCode.startsWith(pref) || locCode.includes(pref),
        );
        if (matchesPrefix) return true;

        if (s.area && !matchesAreaString) {
          return false;
        }

        if (!s.area) return true;

        return false;
      }

      return true;
    });

    setStockSummary(filteredByArea);
  }, [allTransactions, productsMap, locatorsMap, selectedSource, area, mtsMap]);

  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLocators, setSelectedLocators] = useState<string[]>([]);
  const [locatorDropdownOpen, setLocatorDropdownOpen] = useState(false);
  const [locatorSearch, setLocatorSearch] = useState("");
  const locatorDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (locatorDropdownRef.current && !locatorDropdownRef.current.contains(event.target as Node)) {
        setLocatorDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedLocators]);

  useEffect(() => {
    if (selectedLocators.length > 0) {
      const validLocators = new Set(stockSummary.map((s) => s.whGroup));
      const pruned = selectedLocators.filter((loc) => validLocators.has(loc));
      if (pruned.length !== selectedLocators.length) {
        setSelectedLocators(pruned);
      }
    }
  }, [stockSummary, selectedLocators]);

  const skuWithNoMovementCount = useMemo(() => {
    // 1. Filter rows in currently active stockSummary where totalOut is 0 (no out transactions)
    return stockSummary.filter((s) => s.totalOut === 0).length;
  }, [stockSummary]);

  const uniqueLocators = useMemo(
    () =>
      Array.from(
        new Map<string, { whGroup: string; nama: string }>(
          stockSummary.map((s) => [
            s.whGroup,
            { whGroup: s.whGroup, nama: s.namaLocator },
          ]),
        ).values(),
      ).sort((a, b) => a.whGroup.localeCompare(b.whGroup)),
    [stockSummary],
  );

  const uniqueProducts = useMemo(() => {
    const map = new Map<string, { kodeProduk: string; namaProduk: string }>();
    stockSummary.forEach((s) => {
      if (s.namaProduk || s.kodeProduk) {
        const key = `${s.kodeProduk || ""}__${s.namaProduk || ""}`;
        if (!map.has(key)) {
          map.set(key, { kodeProduk: s.kodeProduk, namaProduk: s.namaProduk });
        }
      }
    });
    return Array.from(map.values()).sort((a, b) =>
      a.namaProduk.localeCompare(b.namaProduk),
    );
  }, [stockSummary]);

  const productSuggestions = useMemo(() => {
    if (!search || search.trim().length === 0) return [];
    const term = search.toLowerCase();
    return uniqueProducts
      .filter(
        (p) =>
          p.namaProduk.toLowerCase().includes(term) ||
          p.kodeProduk.toLowerCase().includes(term),
      )
      .slice(0, 15);
  }, [search, uniqueProducts]);

  const filtered = useMemo(() => {
    return stockSummary.filter((s) => {
      const matchSearch = selectedProduct
        ? s.kodeProduk === selectedProduct.kodeProduk
        : s.kodeProduk.toLowerCase().includes(search.toLowerCase()) ||
          s.namaProduk.toLowerCase().includes(search.toLowerCase()) ||
          s.whGroup.toLowerCase().includes(search.toLowerCase()) ||
          s.namaLocator.toLowerCase().includes(search.toLowerCase());

      const matchLocator =
        selectedLocators.length === 0 || selectedLocators.includes(s.whGroup);

      return matchSearch && matchLocator;
    });
  }, [stockSummary, selectedProduct, search, selectedLocators]);

  const topItems = useMemo(() => {
    const byProduct = new Map<string, { name: string; stock: number }>();
    filtered.forEach((s) => {
      const existing = byProduct.get(s.kodeProduk);
      if (existing) existing.stock += s.stock;
      else byProduct.set(s.kodeProduk, { name: s.namaProduk, stock: s.stock });
    });
    return Array.from(byProduct.values())
      .sort((a, b) => b.stock - a.stock)
      .slice(0, 10)
      .map((d) => ({
        ...d,
        name: d.name.length > 15 ? d.name.substring(0, 15) + "..." : d.name,
      }));
  }, [filtered]);

  const topOutItems = useMemo(() => {
    const byProduct = new Map<string, { name: string; totalOut: number }>();
    filtered.forEach((s) => {
      if (s.totalOut > 0) {
        const existing = byProduct.get(s.kodeProduk);
        if (existing) existing.totalOut += s.totalOut;
        else
          byProduct.set(s.kodeProduk, {
            name: s.namaProduk,
            totalOut: s.totalOut,
          });
      }
    });
    return Array.from(byProduct.values())
      .sort((a, b) => b.totalOut - a.totalOut)
      .slice(0, 10)
      .map((d) => ({
        ...d,
        name: d.name.length > 15 ? d.name.substring(0, 15) + "..." : d.name,
      }));
  }, [filtered]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const totalInFiltered = filtered.reduce((acc, s) => acc + s.totalIn, 0);
  const totalOutFiltered = filtered.reduce((acc, s) => acc + s.totalOut, 0);
  const stockRillFiltered = filtered.reduce((acc, s) => acc + s.stock, 0);

  return (
    <ExecutiveDashboard 
      stockSummary={stockSummary}
      allTransactions={allTransactions}
      area={area}
      loading={loading}
      onRefresh={() => loadData(true, true)}
      onNavigateToTab={onNavigateToTab || (() => {})}
    />
  );
}
