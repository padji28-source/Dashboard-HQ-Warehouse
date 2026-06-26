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
  CheckCircle,
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

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function StockOverview({
  spreadsheetId,
  area,
}: {
  spreadsheetId: string;
  area: string;
}) {
  const [loading, setLoading] = useState(true);
  const [stockSummary, setStockSummary] = useState<StockSummary[]>([]);
  const [search, setSearch] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastHash, setLastHash] = useState<string>('');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [showToast, setShowToast] = useState(false);

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

  const loadData = async (retryOnMissing = true, forceFresh = false, silent = false) => {
    try {
      if (!silent) setLoading(true);
      setSyncStatus('syncing');

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
              lCode: fromLocator || toLocator || "UNKNOWN_L",
              qty,
              source,
            });
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
              const [tn, tr, tm, ts, pr, lr] = await Promise.all([
                fetchSheetData(aUrl, "'INPUT'!A2:J", forceFresh).catch(() => []),
                fetchSheetData(aUrl, "'INPUT RM'!A2:J", forceFresh).catch(() => []),
                fetchSheetData(aUrl, "'INPUT MFG'!A2:J", forceFresh).catch(() => []),
                fetchSheetData(aUrl, "'INPUT SUPPLIES'!A2:J", forceFresh).catch(() => []),
                fetchSheetData(aUrl, "'MASTER_PRODUK'!A2:B", forceFresh).catch(() => []),
                fetchSheetData(aUrl, "'MASTER_LOCATOR'!A2:E", forceFresh).catch(() => []),
              ]);

              pr.filter((r: any[]) => r.length > 0 && r[0]).forEach(
                (r: any[]) => {
                  pMap.set(String(r[0]).trim(), String(r[1] || "").trim());
                },
              );

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

        try {
          [txRowsNormal, txRowsRM, txRowsMfg, txRowsSupplies, pRows, lRows] =
            await Promise.all([
              fetchSheetData(spreadsheetId, "'INPUT'!A2:J", forceFresh),
              fetchSheetData(spreadsheetId, "'INPUT RM'!A2:J", forceFresh),
              fetchSheetData(spreadsheetId, "'INPUT MFG'!A2:J", forceFresh),
              fetchSheetData(spreadsheetId, "'INPUT SUPPLIES'!A2:J", forceFresh),
              fetchSheetData(spreadsheetId, "'MASTER_PRODUK'!A2:B", forceFresh),
              fetchSheetData(spreadsheetId, "'MASTER_LOCATOR'!A2:E", forceFresh),
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
              return loadData(false, false, silent);
            } catch (initErr: any) {
              const initErrMsg = String(initErr.message || "").toLowerCase();
              if (
                initErrMsg.includes("already exists") ||
                initErrMsg.includes("ada") ||
                initErrMsg.includes("exists")
              ) {
                console.log("Sheet already exists, continuing to load data.");
                return loadData(false, false, silent);
              }
              console.error("Auto-init from StockOverview failed:", initErr);
            }
          }
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
        }

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
      }

      // Hash comparison
      const currentHash = JSON.stringify({ mappedRows, pMap: Array.from(pMap.entries()), lMap: Array.from(lMap.entries()) });
      
      setLastSyncTime(new Date());
      setSyncStatus('success');

      if (currentHash !== lastHash) {
        setLastHash(currentHash);
        setProductsMap(pMap);
        setLocatorsMap(lMap);
        setAllTransactions(mappedRows);
        
        if (silent && lastHash !== '') { // Only show toast if it's an auto-refresh and data changed
          setShowToast(true);
          setTimeout(() => setShowToast(false), 3000);
        }
      }
    } catch (err: any) {
      setSyncStatus('error');
      if (!silent) alert(`Gagal memuat overview stok: ${err.message}`);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    
    let intervalId: NodeJS.Timeout;
    if (autoRefresh) {
      intervalId = setInterval(() => {
        loadData(false, true, true); // retryOnMissing = false, forceFresh = true, silent = true
      }, 10000); // Poll every 10 seconds per user request
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [spreadsheetId, autoRefresh]);

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
  }, [allTransactions, productsMap, locatorsMap, selectedSource, area]);

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
    <div className="space-y-6 relative">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-4 right-4 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="bg-emerald-50 border border-emerald-200 shadow-lg rounded-xl p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-bold text-emerald-800">Pembaruan Berhasil</p>
              <p className="text-xs text-emerald-600 font-medium mt-0.5">Data Google Sheet berhasil diperbarui.</p>
            </div>
            <button onClick={() => setShowToast(false)} className="ml-2 text-emerald-600 hover:text-emerald-800 focus:outline-none">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Stock per WH Group
          </h2>
          <p className="text-sm text-slate-500">
            Peta ketersediaan barang pada setiap warehouse.
          </p>
        </div>
        <button
          onClick={() => loadData(true, true)}
          className="px-4 py-2 border border-slate-200 bg-white rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Refresh Data
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="border border-slate-200 bg-white rounded-xl p-6 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 bg-blue-50 border border-blue-100 rounded-full flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            {(() => {
              const total = stockSummary.reduce((acc, s) => acc + s.stock, 0);
              return (
                <h3
                   className={cn(
                     "text-2xl font-bold tracking-tight text-slate-900",
                     total < 0 && "text-rose-600",
                   )}
                >
                  {total.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                </h3>
              );
            })()}
            <p className="text-sm font-medium text-slate-500">
              Total Kuantitas Global
            </p>
          </div>
        </div>

        <div className="border border-slate-200 bg-white rounded-xl p-6 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-full flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-2xl font-bold tracking-tight text-slate-900">
              {stockSummary.length.toLocaleString()}
            </h3>
            <p className="text-sm font-medium text-slate-500">
              Total SKU Aktif
            </p>
          </div>
        </div>

        <div className="border border-slate-200 bg-white rounded-xl p-6 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 text-slate-500 opacity-60" />
          </div>
          <div>
            <h3 className="text-2xl font-bold tracking-tight text-slate-600">
              {skuWithNoMovementCount.toLocaleString()}
            </h3>
            <p className="text-sm font-medium text-slate-500">
              SKU Tanpa Pergerakan
            </p>
          </div>
        </div>

        <div className="border border-slate-200 bg-white rounded-xl p-6 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 rounded-full flex items-center justify-center shrink-0">
            <ArrowUpRight className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            {(() => {
              const totalIn = stockSummary.reduce(
                (acc, s) => acc + s.totalIn,
                0,
              );
              return (
                <h3 className="text-2xl font-bold tracking-tight text-emerald-600">
                  {totalIn.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                </h3>
              );
            })()}
            <p className="text-sm font-medium text-slate-500">
              Total Transaksi In (Qty)
            </p>
          </div>
        </div>

        <div className="border border-slate-200 bg-white rounded-xl p-6 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 bg-rose-50 border border-rose-100 rounded-full flex items-center justify-center shrink-0">
            <ArrowRightLeft className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            {(() => {
              const totalOut = stockSummary.reduce(
                (acc, s) => acc + s.totalOut,
                0,
              );
              return (
                <h3 className="text-2xl font-bold tracking-tight text-rose-600">
                  {totalOut.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                </h3>
              );
            })()}
            <p className="text-sm font-medium text-slate-500">
              Total Transaksi Out (Qty)
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Top 10 Stok Terbanyak */}
        <div className="border border-slate-200 bg-white rounded-xl p-6 h-[380px] shadow-sm flex flex-col">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900">
              Top 10 Stok Terbanyak
            </h3>
            <p className="text-xs text-slate-500">
              Berdasarkan total kuantitas tersisa per item
            </p>
          </div>
          <div className="flex-1 w-full min-h-0">
            {loading ? (
              <div className="h-full flex items-center justify-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topItems}
                  margin={{ top: 10, right: 10, bottom: 25, left: 10 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#E2E8F0"
                  />
                  <XAxis
                    dataKey="name"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#64748b" }}
                    tickMargin={12}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={65}
                  />
                  <YAxis
                    type="number"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#64748b" }}
                    tickFormatter={(value) => value.toLocaleString()}
                    width={50}
                  />
                  <Tooltip
                    cursor={{ fill: "#F8FAFC" }}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #E2E8F0",
                      boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                    }}
                    formatter={(value: number) => [
                      value.toLocaleString(),
                      "Stok",
                    ]}
                  />
                  <Bar
                    dataKey="stock"
                    fill="#3B82F6"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                    name="Stok"
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: Top 10 Transaksi Out Terbanyak */}
        <div className="border border-slate-200 bg-white rounded-xl p-6 h-[380px] shadow-sm flex flex-col">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900">
              Top 10 Transaksi Out Terbanyak
            </h3>
            <p className="text-xs text-slate-500">
              Berdasarkan akumulasi kuantitas pengeluaran (OUT)
            </p>
          </div>
          <div className="flex-1 w-full min-h-0">
            {loading ? (
              <div className="h-full flex items-center justify-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topOutItems}
                  margin={{ top: 10, right: 10, bottom: 25, left: 10 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#E2E8F0"
                  />
                  <XAxis
                    dataKey="name"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#64748b" }}
                    tickMargin={12}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={65}
                  />
                  <YAxis
                    type="number"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#64748b" }}
                    tickFormatter={(value) => value.toLocaleString()}
                    width={50}
                  />
                  <Tooltip
                    cursor={{ fill: "#F5F5F5" }}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #E2E8F0",
                      boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                    }}
                    formatter={(value: number) => [
                      value.toLocaleString(),
                      "Kuantitas Out",
                    ]}
                  />
                  <Bar
                    dataKey="totalOut"
                    fill="#EF4444"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                    name="Qty Out"
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <h3 className="font-semibold text-slate-900 hidden sm:block">
            Rincian Stok
          </h3>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="ALL">Semua Data</option>
              <option value="INPUT">Accessories</option>
              <option value="INPUT RM">Raw Material</option>
              <option value="INPUT MFG">Manufacturing</option>
              <option value="INPUT SUPPLIES">Supplies & GA</option>
            </select>
            {/* Custom Multi-Select Locator Dropdown */}
            <div ref={locatorDropdownRef} className="relative w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setLocatorDropdownOpen(!locatorDropdownOpen)}
                className="w-full sm:w-auto px-4 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white flex items-center justify-between gap-2 text-left cursor-pointer hover:bg-slate-50 transition-all font-semibold text-slate-700 min-w-[160px]"
              >
                <span>
                  {selectedLocators.length === 0
                    ? "Semua Locator"
                    : `${selectedLocators.length} Locator terpilih`}
                </span>
                <svg className="w-4 h-4 text-slate-400 font-bold shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {locatorDropdownOpen && (
                <div className="absolute right-0 mt-1.5 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-20 flex flex-col p-3 gap-2 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50">
                    <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="Cari locator..."
                      value={locatorSearch}
                      onChange={(e) => setLocatorSearch(e.target.value)}
                      className="w-full text-xs bg-transparent outline-none border-none text-slate-800"
                    />
                    {locatorSearch && (
                      <button
                        type="button"
                        onClick={() => setLocatorSearch("")}
                        className="text-xs text-slate-400 hover:text-slate-600 font-bold"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 border-b border-slate-100 pb-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setSelectedLocators(uniqueLocators.map((l) => l.whGroup))}
                      className="hover:text-blue-600 transition cursor-pointer"
                    >
                      Pilih Semua
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedLocators([])}
                      className="hover:text-rose-600 transition cursor-pointer"
                    >
                      Kosongkan ({selectedLocators.length})
                    </button>
                  </div>

                  <div className="max-h-56 overflow-y-auto flex flex-col gap-1 pr-1">
                    {(() => {
                      const list = uniqueLocators.filter((l) => {
                        const sClean = locatorSearch.toLowerCase();
                        return (
                          l.whGroup.toLowerCase().includes(sClean) ||
                          l.nama.toLowerCase().includes(sClean)
                        );
                      });

                      if (list.length === 0) {
                        return (
                          <div className="text-center py-4 text-xs text-slate-400">
                            Tidak ada locator ditemukan
                          </div>
                        );
                      }

                      return list.map((l) => {
                        const isChecked = selectedLocators.includes(l.whGroup);
                        return (
                          <label
                            key={l.whGroup}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 cursor-pointer text-xs font-semibold select-none text-slate-700"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setSelectedLocators(
                                    selectedLocators.filter((item) => item !== l.whGroup)
                                  );
                                } else {
                                  setSelectedLocators([...selectedLocators, l.whGroup]);
                                }
                              }}
                              className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                            />
                            <div className="flex flex-col text-left">
                              <span className="font-bold text-slate-900 font-mono text-[11px]">{l.whGroup}</span>
                              {l.nama && l.nama !== l.whGroup && (
                                <span className="text-[10px] text-slate-400 leading-tight font-medium">{l.nama}</span>
                              )}
                            </div>
                          </label>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            </div>
            {/* Search Input */}
            <div ref={dropdownRef} className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama, produk, WH Group..."
                value={search}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearch(val);
                  setShowDropdown(true);
                  if (selectedProduct && val !== selectedProduct.namaProduk) {
                    setSelectedProduct(null);
                  }
                }}
                onFocus={() => setShowDropdown(true)}
                className="w-full pl-9 pr-8 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setSelectedProduct(null);
                    setShowDropdown(false);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              {showDropdown && productSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto z-20 divide-y divide-slate-100">
                  {productSuggestions.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex flex-col focus:outline-none transition-colors border-none cursor-pointer text-slate-700 bg-transparent"
                      onClick={() => {
                        setSelectedProduct(p);
                        setSearch(p.namaProduk);
                        setShowDropdown(false);
                      }}
                    >
                      <span
                        className="font-semibold text-slate-800 text-xs block truncate max-w-full"
                        title={p.namaProduk}
                      >
                        {p.namaProduk}
                      </span>
                      <span
                        className="font-mono text-[10px] text-slate-400 mt-0.5 block truncate max-w-full"
                        title={p.kodeProduk}
                      >
                        {p.kodeProduk}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sync Badge */}
            <div className="flex items-center gap-2 px-3 py-2 text-[11px] font-medium text-slate-600 bg-slate-100 rounded-lg shrink-0 hidden sm:flex">
              {syncStatus === 'syncing' ? (
                <><Loader2 className="w-3 h-3 animate-spin text-blue-500"/> Menyinkronkan...</>
              ) : syncStatus === 'error' ? (
                <><span className="w-2 h-2 rounded-full bg-rose-500"></span> Gagal</>
              ) : (
                <><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Sinkron</>
              )}
              {lastSyncTime && (
                <span className="text-slate-400 border-l border-slate-300 pl-2 ml-1">
                  {lastSyncTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              )}
            </div>

            {/* Auto Refresh Toggle */}
            <div className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg bg-white shrink-0">
              <input 
                type="checkbox" 
                id="auto-refresh"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <label htmlFor="auto-refresh" className="text-xs font-semibold text-slate-600 cursor-pointer">
                Auto-Refresh (10s)
              </label>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 flex justify-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <>
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="px-5 py-4 font-medium">Locator</th>
                    <th className="px-5 py-4 font-medium">Nama Produk</th>
                    <th className="px-5 py-4 font-medium text-right">In</th>
                    <th className="px-5 py-4 font-medium text-right">Out</th>
                    <th className="px-5 py-4 font-semibold text-slate-900 text-right">
                      Stok Rill
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginated.map((s, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-blue-50/40 transition-colors text-slate-700"
                    >
                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-900">
                          {s.namaLocator}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 font-mono">
                          {s.whGroup}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-900">
                          {s.namaProduk}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 font-mono">
                          {s.kodeProduk}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right text-emerald-600 font-medium">
                        {s.totalIn > 0 ? `+${s.totalIn.toLocaleString()}` : "-"}
                      </td>
                      <td className="px-5 py-4 text-right text-rose-600 font-medium">
                        {s.totalOut > 0
                          ? `-${s.totalOut.toLocaleString()}`
                          : "-"}
                      </td>
                      <td
                        className={cn(
                          "px-5 py-4 text-right font-semibold text-base",
                          s.stock < 0 ? "text-rose-600" : "text-slate-900",
                        )}
                      >
                        {s.stock.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {filtered.length > 0 && (
                    <tr className="bg-slate-50 font-semibold border-t-2 border-slate-200 text-slate-900 sticky bottom-0 z-10 shadow-[0_-1px_0_rgba(0,0,0,0.05)]">
                      <td className="px-5 py-4 text-slate-800" colSpan={2}>
                        Grand Total (Filtered)
                      </td>
                      <td className="px-5 py-4 text-right text-emerald-700 font-bold">
                        {totalInFiltered > 0
                          ? `+${totalInFiltered.toLocaleString()}`
                          : "-"}
                      </td>
                      <td className="px-5 py-4 text-right text-rose-700 font-bold">
                        {totalOutFiltered > 0
                          ? `-${totalOutFiltered.toLocaleString()}`
                          : "-"}
                      </td>
                      <td
                        className={cn(
                          "px-5 py-4 text-right font-bold text-lg",
                          stockRillFiltered < 0
                            ? "text-rose-600"
                            : "text-blue-600",
                        )}
                      >
                        {stockRillFiltered.toLocaleString()}
                      </td>
                    </tr>
                  )}
                  {filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="p-12 text-center text-slate-500"
                      >
                        Tidak ada data stok ditemukan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {filtered.length > 0 && (
                <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50 rounded-b-xl">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                    >
                      <option value={10}>10 Baris</option>
                      <option value={50}>50 Baris</option>
                      <option value={100}>100 Baris</option>
                      <option value={10000}>Semua</option>
                    </select>
                    <span>
                      Menampilkan {(currentPage - 1) * pageSize + 1} -{" "}
                      {Math.min(currentPage * pageSize, filtered.length)} dari{" "}
                      {filtered.length} data
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 border border-slate-200 rounded-md bg-white text-sm font-medium text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-colors"
                    >
                      Sebelumnya
                    </button>
                    <button
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages || totalPages === 0}
                      className="px-3 py-1.5 border border-slate-200 rounded-md bg-white text-sm font-medium text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-colors"
                    >
                      Selanjutnya
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
