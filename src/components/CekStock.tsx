import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { fetchSheetData } from "../lib/sheets";
import { AREA_URLS } from "../App";
import type { StockSummary } from "../types";
import {
  Loader2,
  Search,
  Package,
  ArrowRightLeft,
  Layers,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  X,
  RefreshCw,
  Clock
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface Props {
  spreadsheetId: string;
  area: string;
}

interface MappedTransaction {
  tipe: string;
  pCode: string;
  pName: string;
  lCode: string;
  toLocator?: string;
  qty: number;
  source: string;
  area: string;
}

export default function CekStock({ spreadsheetId, area }: Props) {
  const [allTransactions, setAllTransactions] = useState<MappedTransaction[]>([]);
  const [productsMap, setProductsMap] = useState<Map<string, string>>(new Map());
  const [locatorsMap, setLocatorsMap] = useState<Map<string, { nama: string; whType: string; area: string }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Table filtering and search states
  const [selectedSource, setSelectedSource] = useState<string>("ALL");
  const [selectedLocators, setSelectedLocators] = useState<string[]>([]);
  const [locatorDropdownOpen, setLocatorDropdownOpen] = useState(false);
  const [locatorSearch, setLocatorSearch] = useState("");
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState<{
    kodeProduk: string;
    namaProduk: string;
    locator: string;
  } | null>(null);

  // Refs for closing locator dropdown when clicking outside
  const locatorDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        locatorDropdownRef.current &&
        !locatorDropdownRef.current.contains(event.target as Node)
      ) {
        setLocatorDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadAllData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setLoading(true);
    setError(null);

    const pMap = new Map<string, string>();
    const lMap = new Map<string, { nama: string; whType: string; area: string }>();
    const mappedRows: MappedTransaction[] = [];

    const processRows = (rows: any[], source: string, sourceAreaName: string) => {
      const validRows = (rows || []).filter((r: any[]) => {
        if (r.length === 0) return false;
        const tanggal = String(r[0] || "").trim();
        const nama = String(r[1] || "").trim();
        const kode = String(r[9] || "").trim();
        return (
          tanggal !== "" &&
          nama !== "" &&
          kode !== "#N/A" &&
          nama !== "#N/A" &&
          tanggal !== "#N/A"
        );
      });

      validRows.forEach((r: any[]) => {
        const pName = String(r[1] || "").trim();
        let pCode = String(r[9] || "").trim();
        const tipe = String(r[4] || "").trim().toUpperCase();

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
            toLocator,
            qty,
            source,
            area: sourceAreaName,
          });
          if (toLocator) {
            mappedRows.push({
              tipe: "IN",
              pCode,
              pName,
              lCode: toLocator,
              qty,
              source,
              area: sourceAreaName,
            });
          }
        } else {
          mappedRows.push({
            tipe: tipe || "IN",
            pCode,
            pName,
            lCode: fromLocator || toLocator || "UNKNOWN_L",
            toLocator,
            qty,
            source,
            area: sourceAreaName,
          });
        }
      });
    };

    try {
      const isGlobal =
        area === "HQ" ||
        spreadsheetId === "HQ" ||
        area === "All Cabang" ||
        area.toLowerCase() === "all";

      if (isGlobal) {
        const urlEntries = Object.entries(AREA_URLS);
        await Promise.all(
          urlEntries.map(async ([aName, aUrl]) => {
            try {
              const [tn, tr, tm, ts, pr, lr] = await Promise.all([
                fetchSheetData(aUrl, "'INPUT'!A2:J").catch(() => []),
                fetchSheetData(aUrl, "'INPUT RM'!A2:J").catch(() => []),
                fetchSheetData(aUrl, "'INPUT MFG'!A2:J").catch(() => []),
                fetchSheetData(aUrl, "'INPUT SUPPLIES'!A2:J").catch(() => []),
                fetchSheetData(aUrl, "'MASTER_PRODUK'!A2:B").catch(() => []),
                fetchSheetData(aUrl, "'MASTER_LOCATOR'!A2:E").catch(() => []),
              ]);

              // Merge products
              pr.filter((r: any[]) => r.length > 0 && r[0]).forEach((r: any[]) => {
                pMap.set(String(r[0]).trim().toUpperCase(), String(r[1] || "").trim());
              });

              // Merge locators
              lr.filter((r: any[]) => r.length > 0 && (r[0] || r[1])).forEach((r: any[]) => {
                const val = {
                  nama: String(r[1] || r[0]).trim(),
                  whType: String(r[3] || "").trim(),
                  area: String(r[4] || aName).trim(),
                };
                if (r[0]) {
                  const k = String(r[0]).trim().toUpperCase();
                  lMap.set(k, val);
                }
              });

              processRows(tn, "INPUT", aName);
              processRows(tr, "INPUT RM", aName);
              processRows(tm, "INPUT MFG", aName);
              processRows(ts, "INPUT SUPPLIES", aName);
            } catch (e) {
              console.error(`Error loading data for area ${aName}:`, e);
            }
          })
        );
      } else {
        const [tn, tr, tm, ts, pr, lr] = await Promise.all([
          fetchSheetData(spreadsheetId, "'INPUT'!A2:J").catch(() => []),
          fetchSheetData(spreadsheetId, "'INPUT RM'!A2:J").catch(() => []),
          fetchSheetData(spreadsheetId, "'INPUT MFG'!A2:J").catch(() => []),
          fetchSheetData(spreadsheetId, "'INPUT SUPPLIES'!A2:J").catch(() => []),
          fetchSheetData(spreadsheetId, "'MASTER_PRODUK'!A2:B").catch(() => []),
          fetchSheetData(spreadsheetId, "'MASTER_LOCATOR'!A2:E").catch(() => []),
        ]);

        pr.filter((r: any[]) => r.length > 0 && r[0]).forEach((r: any[]) => {
          pMap.set(String(r[0]).trim().toUpperCase(), String(r[1] || "").trim());
        });

        lr.filter((r: any[]) => r.length > 0 && (r[0] || r[1])).forEach((r: any[]) => {
          const val = {
            nama: String(r[1] || r[0]).trim(),
            whType: String(r[3] || "").trim(),
            area: String(r[4] || area).trim(),
          };
          if (r[0]) {
            const k = String(r[0]).trim().toUpperCase();
            lMap.set(k, val);
          }
        });

        processRows(tn, "INPUT", area);
        processRows(tr, "INPUT RM", area);
        processRows(tm, "INPUT MFG", area);
        processRows(ts, "INPUT SUPPLIES", area);
      }

      setAllTransactions(mappedRows);
      setProductsMap(pMap);
      setLocatorsMap(lMap);
      setLastRefresh(new Date());
    } catch (err: any) {
      console.error("Critical error in CekStock loading:", err);
      setError(err.message || "Failed to load stock data");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [spreadsheetId, area]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Aggregate stock per locator + product SKU
  const stockSummary = useMemo(() => {
    const stockMap = new Map<string, StockSummary>();

    allTransactions.forEach((t) => {
      if (selectedSource !== "ALL" && t.source !== selectedSource) {
        return;
      }

      const pCodeClean = t.pCode.toUpperCase().trim();
      const locatorClean = t.lCode.toUpperCase().trim();
      const key = `${pCodeClean}||${locatorClean}`;

      if (!stockMap.has(key)) {
        const prodNameFromMap = productsMap.get(pCodeClean) || t.pName;
        const locMeta = locatorsMap.get(locatorClean);

        stockMap.set(key, {
          kodeProduk: t.pCode,
          namaProduk: prodNameFromMap,
          whGroup: t.lCode,
          namaLocator: locMeta ? locMeta.nama : t.lCode,
          whType: locMeta ? locMeta.whType : "",
          area: t.area || area,
          totalIn: 0,
          totalOut: 0,
          stock: 0,
        });
      }

      const summary = stockMap.get(key)!;
      const normalizedTipe = t.tipe.replace(/\s+/g, "").toUpperCase();
      const isIN = normalizedTipe === "IN" || normalizedTipe.includes("AWAL") || normalizedTipe === "MASUK" || normalizedTipe === "RECEIPT";
      const isOUT = normalizedTipe === "OUT" || normalizedTipe === "KELUAR" || normalizedTipe === "ISSUE" || normalizedTipe === "PEMAKAIAN" || normalizedTipe === "TRANSFER" || normalizedTipe === "TF";

      if (isIN) {
        summary.totalIn += t.qty;
        summary.stock += t.qty;
      } else if (isOUT) {
        summary.totalOut += t.qty;
        summary.stock -= t.qty;
      } else {
        if (t.qty > 0) {
          summary.totalIn += t.qty;
          summary.stock += t.qty;
        }
      }
    });

    const activeStocks = Array.from(stockMap.values()).filter((s) => {
      return s.totalIn > 0 || s.totalOut > 0 || s.stock !== 0;
    });

    return activeStocks;
  }, [allTransactions, productsMap, locatorsMap, selectedSource, area]);

  // Unique list of WhGroups for custom locator dropdown
  const uniqueLocators = useMemo(() => {
    const map = new Map<string, string>();
    stockSummary.forEach((s) => {
      if (s.whGroup) {
        map.set(s.whGroup.toUpperCase().trim(), s.namaLocator);
      }
    });
    return Array.from(map.entries()).map(([code, name]) => ({
      whGroup: code,
      nama: name || code,
    }));
  }, [stockSummary]);

  // Compute overall KPI status cards
  const stats = useMemo(() => {
    // Apply locator multi-select prefix filter for stats if active
    const finalStockSummary = stockSummary.filter((s) => {
      if (selectedLocators.length > 0) {
        return selectedLocators.includes(s.whGroup.toUpperCase().trim());
      }
      return true;
    });

    const totalKuantitasGlobal = finalStockSummary.reduce((acc, s) => acc + s.stock, 0);
    const totalSKU = finalStockSummary.length;
    const skuTanpaPergerakan = finalStockSummary.filter((s) => s.totalOut === 0).length;
    const totalInQty = finalStockSummary.reduce((acc, s) => acc + s.totalIn, 0);
    const totalOutQty = finalStockSummary.reduce((acc, s) => acc + s.totalOut, 0);

    return {
      totalKuantitasGlobal,
      totalSKU,
      skuTanpaPergerakan,
      totalInQty,
      totalOutQty,
    };
  }, [stockSummary, selectedLocators]);

  // Chart: Qty In & Out group by area (excluding 'All Cabang' for chart categories)
  const areaChartData = useMemo(() => {
    const areas = [
      "Semarang",
      "Medan",
      "Banjarmasin",
      "Jember",
      "Makassar",
      "Palembang",
      "Pekanbaru",
      "Pontianak",
      "Surabaya",
      "Karawang",
      "Jakarta",
      "Jakarta A5",
    ];

    const chartMap: Record<string, { name: string; "Qty In": number; "Qty Out": number }> = {};
    areas.forEach((a) => {
      chartMap[a] = { name: a, "Qty In": 0, "Qty Out": 0 };
    });

    allTransactions.forEach((t) => {
      // Apply source filter if active
      if (selectedSource !== "ALL" && t.source !== selectedSource) {
        return;
      }

      // Apply locator filter if active
      const lCodeClean = t.lCode.toUpperCase().trim();
      if (selectedLocators.length > 0 && !selectedLocators.includes(lCodeClean)) {
        return;
      }

      // Apply search query filter if active
      if (search.trim() !== "") {
        const q = search.toLowerCase().trim();
        const pCodeClean = t.pCode.toLowerCase().trim();
        const pName = (productsMap.get(t.pCode.toUpperCase().trim()) || t.pName).toLowerCase().trim();
        const lName = (locatorsMap.get(lCodeClean)?.nama || t.lCode).toLowerCase().trim();
        const lCodeLower = t.lCode.toLowerCase().trim();

        const matches =
          pCodeClean.includes(q) ||
          pName.includes(q) ||
          lCodeLower.includes(q) ||
          lName.includes(q);

        if (!matches) {
          return;
        }
      }

      const tArea = t.area || area;
      if (chartMap[tArea]) {
        const normalizedTipe = t.tipe.replace(/\s+/g, "");

        if (
          normalizedTipe === "IN" ||
          normalizedTipe === "AWAL" ||
          normalizedTipe === "MASUK" ||
          normalizedTipe === "RECEIPT" ||
          normalizedTipe === "SALDOAWAL"
        ) {
          chartMap[tArea]["Qty In"] += t.qty;
        } else if (
          normalizedTipe === "OUT" ||
          normalizedTipe === "KELUAR" ||
          normalizedTipe === "ISSUE" ||
          normalizedTipe === "PEMAKAIAN"
        ) {
          chartMap[tArea]["Qty Out"] += t.qty;
        } else {
          if (t.qty > 0) {
            chartMap[tArea]["Qty In"] += t.qty;
          }
        }
      }
    });

    return Object.values(chartMap).filter((d) => d["Qty In"] > 0 || d["Qty Out"] > 0);
  }, [allTransactions, selectedSource, selectedLocators, search, productsMap, locatorsMap, area]);

  // Table filtering and search
  const filteredTableData = useMemo(() => {
    let result = stockSummary;

    // Filter by selected locators
    if (selectedLocators.length > 0) {
      result = result.filter((s) => selectedLocators.includes(s.whGroup.toUpperCase().trim()));
    }

    // Filter by search text
    if (search.trim() !== "") {
      const q = search.toLowerCase().trim();
      result = result.filter((s) => {
        return (
          s.kodeProduk.toLowerCase().includes(q) ||
          s.namaProduk.toLowerCase().includes(q) ||
          s.whGroup.toLowerCase().includes(q) ||
          s.namaLocator.toLowerCase().includes(q)
        );
      });
    }

    return result;
  }, [stockSummary, selectedLocators, search]);

  // Totals for filtered list
  const filteredTotals = useMemo(() => {
    const totalIn = filteredTableData.reduce((acc, s) => acc + s.totalIn, 0);
    const totalOut = filteredTableData.reduce((acc, s) => acc + s.totalOut, 0);
    const totalStock = filteredTableData.reduce((acc, s) => acc + s.stock, 0);
    return { totalIn, totalOut, totalStock };
  }, [filteredTableData]);

  // Paginated table rows
  const paginatedTableData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredTableData.slice(startIndex, startIndex + pageSize);
  }, [filteredTableData, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredTableData.length / pageSize);

  // Auto-reset page when filtering
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedSource, selectedLocators, search, pageSize]);

  return (
    <div className="space-y-8 animate-in fade-in duration-250">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Package className="w-7 h-7 text-blue-600" />
            Cek Stock & Performa Transaksi
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Analisis realtime kuantitas barang, pergerakan IN/OUT, serta perbandingan aktivitas antar cabang.
          </p>
        </div>
        <div className="flex flex-col gap-3 self-start md:self-auto md:items-end">
          <div className="flex items-center gap-2 text-xs bg-blue-50 text-blue-800 font-semibold px-3 py-1.5 rounded-full border border-blue-100">
            🟢 Status Koneksi: Terhubung Ke GSheet ({area})
          </div>
          <div className="flex items-center gap-2">
            {lastRefresh && (
              <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                <Clock className="w-3.5 h-3.5" />
                {lastRefresh.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} - {lastRefresh.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            )}
            <button
              onClick={() => loadAllData(true)}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-blue-600 font-semibold text-xs rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Memperbarui...' : 'Refresh Manual'}
            </button>
          </div>
        </div>
      </div>

      {/* Loading state rendering */}
      {loading ? (
        <div className="min-h-[400px] flex flex-col items-center justify-center gap-4 bg-white border border-slate-200 rounded-2xl p-12 shadow-sm">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
          <p className="text-sm font-semibold text-slate-600">Menarik data dari Google Sheets...</p>
          <p className="text-xs text-slate-400">Proses ini membutuhkan waktu beberapa detik untuk agregasi multi-area.</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center max-w-lg mx-auto">
          <p className="text-rose-800 font-bold mb-2">Terjadi Kesalahan Pengambilan Data</p>
          <p className="text-sm text-rose-650 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-rose-600 hover:bg-rose-700 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-all"
          >
            Coba Ambil Ulang Data
          </button>
        </div>
      ) : (
        <>
          {/* Bento Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            {/* 1. Total Kuantitas Global */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 border border-blue-100 rounded-full flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xl sm:text-2xl font-black text-slate-900 truncate">
                  {stats.totalKuantitasGlobal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </h4>
                <p className="text-xs font-bold text-slate-450 uppercase tracking-wide mt-0.5">Total Kuantitas Global</p>
              </div>
            </div>

            {/* 2. Total SKU Aktif */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-full flex items-center justify-center shrink-0">
                <Package className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xl sm:text-2xl font-black text-slate-900 truncate">
                  {stats.totalSKU.toLocaleString()}
                </h4>
                <p className="text-xs font-bold text-slate-450 uppercase tracking-wide mt-0.5 font-sans">Total SKU Aktif</p>
              </div>
            </div>

            {/* 3. SKU Tanpa Pergerakan */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center shrink-0">
                <Package className="w-5 h-5 text-slate-400" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xl sm:text-2xl font-black text-slate-600 truncate">
                  {stats.skuTanpaPergerakan.toLocaleString()}
                </h4>
                <p className="text-xs font-bold text-slate-450 uppercase tracking-wide mt-0.5">SKU Tanpa Pergerakan</p>
              </div>
            </div>

            {/* 4. Total Transaksi In (Qty) */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 rounded-full flex items-center justify-center shrink-0">
                <ArrowUpRight className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xl sm:text-2xl font-black text-emerald-600 truncate">
                  {stats.totalInQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </h4>
                <p className="text-xs font-bold text-slate-450 uppercase tracking-wide mt-0.5">Total Transaksi In (Qty)</p>
              </div>
            </div>

            {/* 5. Total Transaksi Out (Qty) */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex items-center gap-4">
              <div className="w-12 h-12 bg-rose-50 border border-rose-100 rounded-full flex items-center justify-center shrink-0">
                <ArrowRightLeft className="w-5 h-5 text-rose-600" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xl sm:text-2xl font-black text-rose-600 truncate">
                  {stats.totalOutQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </h4>
                <p className="text-xs font-bold text-slate-450 uppercase tracking-wide mt-0.5">Total Transaksi Out (Qty)</p>
              </div>
            </div>
          </div>

          {/* Recharts Area Performance Double Bar Chart */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col h-[400px]">
            <div className="mb-4">
              <h3 className="font-bold text-slate-900 text-lg">Grafik Transaksi In dan Out Setiap Area</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Volume volume perpindahan (In vs Out) berdasarkan kriteria kategori data terpilih
              </p>
            </div>
            <div className="flex-1 w-full min-h-0">
              {areaChartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                  Tidak ada catatan transaksi pergerakan yang tervalidasi pada filter sumber data ini.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={areaChartData} margin={{ top: 10, right: 10, bottom: 5, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis
                      dataKey="name"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#64748B", fontWeight: 600 }}
                      tickMargin={10}
                    />
                    <YAxis
                      type="number"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#64748B" }}
                      tickFormatter={(value) => value.toLocaleString()}
                      width={55}
                    />
                    <Tooltip
                      cursor={{ fill: "#F8FAFC" }}
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid #E2E8F0",
                        boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                      }}
                      formatter={(value: number) => [value.toLocaleString(), ""]}
                    />
                    <Legend iconSize={10} wrapperStyle={{ position: "relative", marginTop: "10px" }} />
                    <Bar
                      dataKey="Qty In"
                      fill="#10B981"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                      name="Volume IN"
                    />
                    <Bar
                      dataKey="Qty Out"
                      fill="#EF4444"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                      name="Volume OUT"
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Rincian Stok Table Section */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
            {/* Table Header Controls */}
            <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row items-center justify-between gap-4 bg-slate-50/50">
              <h3 className="font-bold text-slate-900 shrink-0 text-md">
                Rincian Analisis Stok ({filteredTableData.length} data)
              </h3>
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                {/* Select Kategori Sheet */}
                <select
                  value={selectedSource}
                  onChange={(e) => setSelectedSource(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white font-semibold text-slate-700 cursor-pointer outline-none transition"
                >
                  <option value="ALL">Semua Kategori</option>
                  <option value="INPUT">Accessories</option>
                  <option value="INPUT RM">Raw Material</option>
                  <option value="INPUT MFG">Manufacturing</option>
                  <option value="INPUT SUPPLIES">Supplies & GA</option>
                </select>

                {/* Locator Dropdown Filter */}
                <div ref={locatorDropdownRef} className="relative w-full sm:w-auto z-20">
                  <button
                    type="button"
                    onClick={() => setLocatorDropdownOpen(!locatorDropdownOpen)}
                    className="w-full sm:w-auto px-4 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white flex items-center justify-between gap-2 text-left cursor-pointer hover:bg-slate-50 transition-all font-semibold text-slate-700 min-w-[170px]"
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
                    <div className="absolute right-0 mt-1.5 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-30 flex flex-col p-3 gap-2 animate-in fade-in slide-in-from-top-1 duration-150">
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
                            className="text-xs text-slate-450 hover:text-slate-650 font-bold"
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
                            const sClean = locatorSearch.toLowerCase().trim();
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

                {/* Global Search Input */}
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari produk, kode SKU, locator..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 outline-none transition bg-white"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-650"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Table Area */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-[#FAFBFD] border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-5 py-4">Locator & Area</th>
                    <th className="px-5 py-4">Nama & Kode Produk (SKU)</th>
                    <th className="px-5 py-4 text-right">Volume In</th>
                    <th className="px-5 py-4 text-right">Volume Out</th>
                    <th className="px-5 py-4 text-right">Stok Rill Saat Ini</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {paginatedTableData.map((s, idx) => (
                    <tr 
                      key={idx} 
                      onClick={() => setSelectedProduct({ kodeProduk: s.kodeProduk, namaProduk: s.namaProduk, locator: s.whGroup })}
                      className="hover:bg-slate-50 transition-colors text-slate-700 cursor-pointer"
                    >
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900 leading-tight">
                          {s.namaLocator || s.whGroup}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[10.5px] text-slate-400 font-bold font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            {s.whGroup}
                          </span>
                          <span className="text-[9.5px] bg-blue-50 border border-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-semibold">
                            {s.area}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900 leading-tight">
                          {s.namaProduk}
                        </div>
                        <div className="text-[10.5px] text-slate-400 mt-1 font-mono hover:text-slate-600 cursor-help flex items-center gap-1">
                          <span>SKU: {s.kodeProduk}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right text-emerald-600 font-bold font-mono">
                        {s.totalIn > 0 ? `+${s.totalIn.toLocaleString()}` : "-"}
                      </td>
                      <td className="px-5 py-4 text-right text-rose-600 font-bold font-mono">
                        {s.totalOut > 0 ? `-${s.totalOut.toLocaleString()}` : "-"}
                      </td>
                      <td
                        className={`px-5 py-4 text-right font-extrabold text-[15px] font-mono ${
                          s.stock < 0 ? "text-rose-600" : "text-slate-900"
                        }`}
                      >
                        {s.stock.toLocaleString()}
                      </td>
                    </tr>
                  ))}

                  {/* Grand Totals Rows */}
                  {filteredTableData.length > 0 && (
                    <tr className="bg-slate-100/85 font-extrabold border-t-2 border-slate-200 text-slate-900 sticky bottom-0 z-10 shadow-[0_-1px_0_rgba(0,0,0,0.05)]">
                      <td className="px-5 py-4.5 text-slate-800 text-[13px]" colSpan={2}>
                        Grand Total Hasil Filter
                      </td>
                      <td className="px-5 py-4.5 text-right text-emerald-700 text-[14px] font-mono">
                        {filteredTotals.totalIn > 0 ? `+${filteredTotals.totalIn.toLocaleString()}` : "-"}
                      </td>
                      <td className="px-5 py-4.5 text-right text-rose-700 text-[14px] font-mono">
                        {filteredTotals.totalOut > 0 ? `-${filteredTotals.totalOut.toLocaleString()}` : "-"}
                      </td>
                      <td
                        className={`px-5 py-4.5 text-right text-[16px] font-mono ${
                          filteredTotals.totalStock < 0 ? "text-rose-600" : "text-blue-700"
                        }`}
                      >
                        {filteredTotals.totalStock.toLocaleString()}
                      </td>
                    </tr>
                  )}

                  {/* Empty State */}
                  {filteredTableData.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-16 text-center text-slate-450 text-sm font-semibold">
                        ❌ Tidak ada rincian analitis stok yang cocok dengan kriteria filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {filteredTableData.length > 0 && (
              <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
                <div className="flex items-center gap-2.5 text-sm text-slate-500 font-semibold">
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                    }}
                    className="border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-950 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm cursor-pointer"
                  >
                    <option value={10}>10 Baris</option>
                    <option value={50}>50 Baris</option>
                    <option value={100}>100 Baris</option>
                    <option value={filteredTableData.length}>Lihat Semua ({filteredTableData.length})</option>
                  </select>
                  <span>
                    Menampilkan {(currentPage - 1) * pageSize + 1} -{" "}
                    {Math.min(currentPage * pageSize, filteredTableData.length)} dari{" "}
                    {filteredTableData.length} data
                  </span>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3.5 py-2 border border-slate-200 rounded-lg bg-white text-xs font-semibold text-slate-700 disabled:opacity-40 hover:bg-slate-50 transition shadow-sm cursor-pointer disabled:cursor-not-allowed"
                    >
                      Sebelumnya
                    </button>
                    <div className="flex items-center gap-1 bg-white border border-slate-200 px-3 py-1 rounded-lg text-xs font-bold text-slate-800">
                      Hal {currentPage} dari {totalPages}
                    </div>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3.5 py-2 border border-slate-200 rounded-lg bg-white text-xs font-semibold text-slate-700 disabled:opacity-40 hover:bg-slate-50 transition shadow-sm cursor-pointer disabled:cursor-not-allowed"
                    >
                      Berikutnya
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal Detail Transaksi */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="font-extrabold text-slate-900 text-lg tracking-tight">Detail Transaksi Produk</h3>
                <p className="text-xs text-slate-500 mt-1">
                  <span className="font-semibold text-slate-700">{selectedProduct.namaProduk}</span> &bull; 
                  Locator: <span className="font-mono text-blue-600 bg-blue-50 px-1 py-0.5 rounded ml-1">{selectedProduct.locator}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors focus:outline-none"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-[#FAFBFD] border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Tipe</th>
                      <th className="px-4 py-3">Qty</th>
                      <th className="px-4 py-3">Locator Tujuan / Asal</th>
                      <th className="px-4 py-3">Sumber Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {allTransactions
                      .filter(t => t.pCode === selectedProduct.kodeProduk && t.lCode === selectedProduct.locator)
                      .map((t, idx) => {
                        const isOut = ['OUT', 'KELUAR', 'ISSUE', 'PEMAKAIAN', 'TRANSFER', 'TF'].includes(t.tipe.replace(/\s+/g, '').toUpperCase());
                        return (
                          <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3">
                              <span className={`text-[10px] font-bold px-2 py-1 rounded-md border ${
                                isOut 
                                  ? 'bg-rose-50 border-rose-100 text-rose-700' 
                                  : 'bg-emerald-50 border-emerald-100 text-emerald-700'
                              }`}>
                                {t.tipe}
                              </span>
                            </td>
                            <td className={`px-4 py-3 font-mono font-bold ${isOut ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {isOut ? '-' : '+'}{t.qty}
                            </td>
                            <td className="px-4 py-3 text-slate-600 text-xs font-mono font-bold">
                              {t.toLocator || '-'}
                            </td>
                            <td className="px-4 py-3 text-slate-600 text-xs">{t.source}</td>
                          </tr>
                        );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
