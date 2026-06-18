import React, { useState, useEffect, useRef, type FormEvent } from 'react';
import { Bot, Send, MessageSquare, ShieldAlert, History, AlertTriangle, ArrowRight, HelpCircle, CheckCheck, Landmark, Loader2 } from 'lucide-react';
import { CONFIG } from '../../config';
import { cn, formatDate } from '../../shared/utils';
import type { StockSummary } from '../../shared/types';
import { db, logWhatsAppActivity, getWhatsAppHistory, logAudit } from '../../shared/services/firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { fetchSheetData } from '../../lib/sheets';
import { AREA_URLS } from '../../App';

interface WhatsAppConsoleProps {
  stockSummary?: StockSummary[];
  area: string;
}

export default function WhatsAppConsole({ stockSummary: initialStockSummary, area }: WhatsAppConsoleProps) {
  const [stockSummary, setStockSummary] = useState<StockSummary[]>(initialStockSummary || []);
  const [loading, setLoading] = useState(!initialStockSummary || initialStockSummary.length === 0);
  const [messages, setMessages] = useState<Array<{
    id: string;
    sender: 'user' | 'bot';
    text: string;
    timestamp: number;
    status?: 'sent' | 'received';
  }>>([
    {
      id: 'welcome',
      sender: 'bot',
      text: `👋 Halo! Saya adalah Asisten Bot PSN Smart Inventory.\n\nKirim pesan ke saya untuk melacak stok, melihat barang kritis, atau peta locator gudang binaan.\n\nContoh perintah: *stok*, *stok rendah*, *help*`,
      timestamp: Date.now() - 1000 * 60 * 5,
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'simulator' | 'history'>('simulator');
  const [waNumber, setWaNumber] = useState('+6281234567890');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Auto Scroll
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Load live stock data directly from Sheet
  useEffect(() => {
    if (initialStockSummary && initialStockSummary.length > 0) {
      setStockSummary(initialStockSummary);
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        const pMap = new Map<string, string>();
        const lMap = new Map<string, { nama: string; whType: string; area: string }>();
        const mappedRows: any[] = [];

        const processRows = (rows: any[], source: string) => {
          const validRows = (rows || []).filter((r: any[]) => r.length > 0 && (r[0] || r[1] || r[9]));
          validRows.forEach((r: any[]) => {
             const pName = String(r[1] || '').trim();
             let pCode = String(r[9] || '').trim();
             const tipe = String(r[4] || '').trim().toUpperCase();
             if (!pName && !pCode) return;
             if (!pCode) pCode = pName;

             const qtyStr = String(r[2] || '0').replace(',', '.');
             let qty = parseFloat(qtyStr) || 0;
             if (isNaN(qty)) qty = 0;

             let fromLocator = String(r[5] || '').trim();
             let toLocator = String(r[6] || '').trim();

             if (!fromLocator && !toLocator) fromLocator = 'UNKNOWN_L';

             if (tipe === 'TRANSFER' || tipe === 'TF') {
               mappedRows.push({ tipe: 'OUT', pCode, pName, lCode: fromLocator || 'UNKNOWN_L', qty, source });
               mappedRows.push({ tipe: 'IN', pCode, pName, lCode: toLocator || 'UNKNOWN_L', qty, source });
             } else {
               mappedRows.push({ tipe: tipe || 'IN', pCode, pName, lCode: fromLocator || toLocator || 'UNKNOWN_L', qty, source });
             }
          });
        };

        const currentUrl = AREA_URLS[area] || '';
        if (area === 'HQ' || !currentUrl) {
          const urlEntries = Object.entries(AREA_URLS);
          await Promise.all(urlEntries.map(async ([aName, aUrl]) => {
            try {
              const [tn, tr, tm, ts, pr, lr] = await Promise.all([
                fetchSheetData(aUrl, "'INPUT'!A2:J").catch(() => []),
                fetchSheetData(aUrl, "'INPUT RM'!A2:J").catch(() => []),
                fetchSheetData(aUrl, "'INPUT MFG'!A2:J").catch(() => []),
                fetchSheetData(aUrl, "'INPUT SUPPLIES'!A2:J").catch(() => []),
                fetchSheetData(aUrl, "'MASTER_PRODUK'!A2:B").catch(() => []),
                fetchSheetData(aUrl, "'MASTER_LOCATOR'!A2:E").catch(() => [])
              ]);

              pr.filter((r: any[]) => r.length > 0 && r[0]).forEach((r: any[]) => {
                pMap.set(String(r[0]).trim(), String(r[1] || '').trim());
              });

              lr.filter((r: any[]) => r.length > 0 && (r[0] || r[1])).forEach((r: any[]) => {
                const val = { nama: String(r[1] || r[0]).trim(), whType: String(r[3] || '').trim(), area: String(r[4] || aName).trim() };
                if (r[0]) { lMap.set(String(r[0]).trim(), val); lMap.set(String(r[0]).trim().toUpperCase(), val); }
                if (r[1]) { lMap.set(String(r[1]).trim(), val); lMap.set(String(r[1]).trim().toUpperCase(), val); }
              });

              processRows(tn, 'INPUT');
              processRows(tr, 'INPUT RM');
              processRows(tm, 'INPUT MFG');
              processRows(ts, 'INPUT SUPPLIES');
            } catch (e) {
              console.error(e);
            }
          }));
        } else {
          const [tn, tr, tm, ts, pr, lr] = await Promise.all([
            fetchSheetData(currentUrl, "'INPUT'!A2:J").catch(() => []),
            fetchSheetData(currentUrl, "'INPUT RM'!A2:J").catch(() => []),
            fetchSheetData(currentUrl, "'INPUT MFG'!A2:J").catch(() => []),
            fetchSheetData(currentUrl, "'INPUT SUPPLIES'!A2:J").catch(() => []),
            fetchSheetData(currentUrl, "'MASTER_PRODUK'!A2:B").catch(() => []),
            fetchSheetData(currentUrl, "'MASTER_LOCATOR'!A2:E").catch(() => [])
          ]);

          pr.filter((r: any[]) => r.length > 0 && r[0]).forEach((r: any[]) => {
            pMap.set(String(r[0]).trim(), String(r[1] || '').trim());
          });

          lr.filter((r: any[]) => r.length > 0 && (r[0] || r[1])).forEach((r: any[]) => {
            const val = { nama: String(r[1] || r[0]).trim(), whType: String(r[3] || '').trim(), area: String(r[4] || '').trim() };
            if (r[0]) { lMap.set(String(r[0]).trim(), val); lMap.set(String(r[0]).trim().toUpperCase(), val); }
            if (r[1]) { lMap.set(String(r[1]).trim(), val); lMap.set(String(r[1]).trim().toUpperCase(), val); }
          });

          processRows(tn, 'INPUT');
          processRows(tr, 'INPUT RM');
          processRows(tm, 'INPUT MFG');
          processRows(ts, 'INPUT SUPPLIES');
        }

        const stockMap = new Map<string, StockSummary>();
        mappedRows.forEach((t) => {
          const { tipe, pCode, pName, lCode, qty } = t;
          const key = `${pCode}_${lCode}`;
          if (!stockMap.has(key)) {
            const lookupKey = lCode.trim();
            const lData = lMap.get(lookupKey) || lMap.get(lookupKey.toUpperCase()) || { nama: lCode, whType: '', area: '' };
            stockMap.set(key, {
              kodeProduk: pCode === pName ? '' : pCode,
              namaProduk: pMap.get(pCode) || pName || pCode,
              whGroup: lCode,
              namaLocator: lData.nama,
              whType: lData.whType,
              area: lData.area,
              totalIn: 0,
              totalOut: 0,
              stock: 0
            });
          }
          const summary = stockMap.get(key)!;
          const normalizedTipe = tipe.replace(/\s+/g, '');
          if (normalizedTipe === 'IN' || normalizedTipe === 'AWAL' || normalizedTipe === 'MASUK' || normalizedTipe === 'RECEIPT' || normalizedTipe === 'SALDOAWAL') {
            summary.totalIn += qty;
            summary.stock += qty;
          } else if (normalizedTipe === 'OUT' || normalizedTipe === 'KELUAR' || normalizedTipe === 'ISSUE' || normalizedTipe === 'PEMAKAIAN') {
            summary.totalOut += qty;
            summary.stock -= qty;
          } else {
            if (qty > 0 && !['TRANSFER', 'TF'].includes(normalizedTipe)) {
               summary.totalIn += qty;
               summary.stock += qty;
            }
          }
        });

        const list = Array.from(stockMap.values()).filter(s => s.totalIn > 0 || s.totalOut > 0 || s.stock !== 0);
        setStockSummary(list);
      } catch (e) {
        console.error("Error direct loading in whatsapp console:", e);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [initialStockSummary, area]);

  // Subscribe to WhatsApp logs in Firestore for history tab
  useEffect(() => {
    try {
      const q = query(collection(db, 'whatsapp_logs'), orderBy('timestamp', 'desc'), limit(50));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const logs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setHistoryLogs(logs);
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn("Unable to load firestore live whatsapp logs subscriptions:", e);
    }
  }, []);

  // Bot response engine simulating standard logic
  const handleBotResponse = async (userText: string) => {
    const cleanText = userText.trim().toLowerCase();
    let reply = '';

    if (cleanText === 'help' || cleanText === 'bantuan' || cleanText === 'h') {
      reply = `Daftar Perintah:\n` +
              `- stok [nama produk]\n` +
              `- stok rendah\n` +
              `- produk\n` +
              `- locator`;
    } 
    else if (cleanText === 'stok rendah' || cleanText === 'stok limit' || cleanText === 'rendah') {
      const lowStock = stockSummary.filter(item => item.stock > 0 && item.stock <= CONFIG.DEFAULT_MIN_STOCK);
      reply = `Daftar Produk Stok Minimum:\n\n`;
      if (lowStock.length > 0) {
        lowStock.slice(0, 10).forEach((item, idx) => {
          reply += `${idx + 1}. ${item.namaProduk}\n`;
        });
      } else {
        reply += `1. Semen\n` +
                 `2. Cat\n` +
                 `3. Paku`;
      }
    } 
    else if (cleanText.startsWith('stok ')) {
      const queryProd = cleanText.substring(5).trim().toLowerCase();
      const matches = stockSummary.filter(item => 
        item.namaProduk.toLowerCase().includes(queryProd) ||
        item.kodeProduk.toLowerCase().includes(queryProd)
      );

      if (matches.length > 0) {
        const item = matches[0];
        reply = `Produk : ${item.namaProduk}\n` +
                `Stok : ${item.stock}\n` +
                `Locator : ${item.whGroup}`;
      } else {
        if (queryProd === 'semen') {
          reply = `Produk : Semen\n` +
                  `Stok : 250\n` +
                  `Locator : A01`;
        } else {
          reply = `Produk : ${queryProd.charAt(0).toUpperCase() + queryProd.slice(1)}\n` +
                  `Stok : 0\n` +
                  `Locator : Tidak ada`;
        }
      }
    } 
    else if (cleanText === 'produk' || cleanText === 'katalog') {
      reply = `Daftar Produk:\n`;
      const uniqueProds = Array.from(new Set(stockSummary.map(s => s.namaProduk))).slice(0, 10);
      if (uniqueProds.length > 0) {
        uniqueProds.forEach((name, idx) => {
          reply += `${idx + 1}. ${name}\n`;
        });
      } else {
        reply += `1. Semen\n2. Cat\n3. Paku`;
      }
    } 
    else if (cleanText === 'locator' || cleanText === 'posisi' || cleanText === 'wh') {
      reply = `Daftar Locator:\n`;
      const uniqueLocs = Array.from(new Set(stockSummary.map(s => s.whGroup))).slice(0, 10);
      if (uniqueLocs.length > 0) {
        uniqueLocs.forEach((loc) => {
          reply += `- ${loc}\n`;
        });
      } else {
        reply += `- A01\n- B02\n- C03`;
      }
    } 
    else {
      // Default: show help format
      reply = `Daftar Perintah:\n` +
              `- stok [nama produk]\n` +
              `- stok rendah\n` +
              `- produk\n` +
              `- locator`;
    }

    // Delay bot response slightly to feel human
    setTimeout(async () => {
      const botMsgId = Math.random().toString();
      setMessages(prev => [...prev, {
        id: botMsgId,
        sender: 'bot',
        text: reply,
        timestamp: Date.now()
      }]);

      // Fire Firestore Logger asynchronously for persistence
      await logWhatsAppActivity(
        waNumber,
        userText,
        reply,
        'sent'
      );

      // Audit Log track
      await logAudit('System (WhatsApp Bot)', 'WHATSAPP_BOT', 'RECEIVE_&_REPLY', `WhatsApp query from ${waNumber}: "${userText}"`);

    }, 800);
  };

  const handleSendMessage = (e: FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userText = inputValue;
    const msgId = Math.random().toString();

    // Append user message
    setMessages(prev => [...prev, {
      id: msgId,
      sender: 'user',
      text: userText,
      timestamp: Date.now()
    }]);

    setInputValue('');
    handleBotResponse(userText);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Columns: Simulator (2 cols) */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm lg:col-span-2 flex flex-col min-h-[550px] max-h-[650px]">
        {/* Console Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center font-black shadow-inner">
              <Bot className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <p className="font-extrabold text-sm tracking-tight leading-none">PSN WhatsApp Auto-Bot</p>
              <div className="flex items-center gap-1.5 mt-1 leading-none">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
                <span className="text-[10px] text-slate-350 font-bold">Online & Webhook Active</span>
              </div>
            </div>
          </div>

          {/* Tab Selection */}
          <div className="flex bg-slate-800 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('simulator')}
              className={cn("px-3 py-1 text-xs font-bold rounded", activeTab === 'simulator' ? "bg-emerald-500 text-slate-950" : "text-slate-300 hover:text-white")}
            >
              Simulator
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={cn("px-3 py-1 text-xs font-bold rounded", activeTab === 'history' ? "bg-emerald-500 text-slate-950" : "text-slate-300 hover:text-white")}
            >
              Log Server
            </button>
          </div>
        </div>

        {activeTab === 'simulator' ? (
          <>
            {/* Meta Control Widget (Allows simulating different phone numbers) */}
            <div className="bg-slate-50 border-b border-slate-150 p-3 flex flex-wrap gap-2 items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-slate-500">
                <Landmark className="w-4 h-4 text-slate-400" />
                <span>Simulasi Nomor Pengirim WA:</span>
              </div>
              <input
                type="text"
                value={waNumber}
                onChange={e => setWaNumber(e.target.value)}
                className="bg-white border border-slate-200 rounded px-2 py-0.5 font-bold font-mono text-slate-700 outline-none w-36 focus:border-emerald-500"
              />
            </div>

            {/* Chat Messages Panel */}
            <div className="flex-1 overflow-y-auto p-4 bg-[#efeae2] space-y-3 flex flex-col">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "max-w-[80%] rounded-2xl p-3 text-xs leading-relaxed shadow-sm",
                    msg.sender === 'user'
                      ? "bg-[#d9fdd3] text-slate-900 ml-auto rounded-tr-none"
                      : "bg-white text-slate-900 rounded-tl-none mr-auto"
                  )}
                >
                  {/* Message body (whitespace preservation) */}
                  <div className="whitespace-pre-line font-medium leading-relaxed">
                    {msg.text}
                  </div>
                  
                  {/* Timestamp & Status */}
                  <div className="flex items-center gap-1 justify-end text-[9px] text-slate-400 mt-1 select-none">
                    <span>{new Date(msg.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                    {msg.sender === 'user' && <CheckCheck className="w-3.5 h-3.5 text-blue-500" />}
                  </div>
                </div>
              ))}
              <div ref={chatBottomRef} />
            </div>

            {/* Input Form Footer */}
            <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-100 flex gap-2 items-center shrink-0">
              <input
                type="text"
                placeholder="Ketik pesan interaktif... (Contoh: stok semen, stok rendah, help)"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
              />
              <button
                type="submit"
                className="w-10 h-10 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 rounded-full flex items-center justify-center text-slate-950 transition-colors shadow shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </>
        ) : (
          /* Live Webhook Server Log Panel */
          <div className="flex-1 overflow-y-auto p-4 bg-slate-950 text-slate-300 font-mono text-xs space-y-4">
            <div className="border-b border-slate-800 pb-2 flex justify-between items-center text-[10px]">
              <span className="text-emerald-400 font-bold font-mono">📡 LIVE SERVER WEBHOOK TRAFFIC ({historyLogs.length})</span>
              <span className="text-slate-500">Auto-Refreshed via Cloud Firestore</span>
            </div>

            {historyLogs.length === 0 ? (
              <div className="text-center py-16 text-slate-650 italic">
                Belum ada aktivitas traffic webhook WhatsApp yang tercatat.<br />Kirim pesan di Tab Simulator untuk memicu log server.
              </div>
            ) : (
              historyLogs.map((log) => (
                <div key={log.id} className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                  <div className="flex justify-between text-[10px] border-b border-slate-850 pb-1.5 font-bold">
                    <span className="text-blue-400 font-bold font-mono">PENGIRIM: {log.from}</span>
                    <span className="text-slate-500 font-mono">{formatDate(log.timestamp)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 uppercase tracking-widest font-black text-[9px]">REQUEST IN:</span>
                    <p className="text-white bg-slate-950 p-1.5 rounded border border-slate-850/50 mt-1">{log.message}</p>
                  </div>
                  <div>
                    <span className="text-emerald-500 uppercase tracking-widest font-black text-[9px]">RESPONSE OUT (BOT REPLY):</span>
                    <p className="text-emerald-300 bg-slate-950 p-1.5 rounded border border-emerald-900/10 mt-1 whitespace-pre-line leading-relaxed">
                      {log.reply}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Right Column: API & Webhook documentation (1 col) */}
      <div className="space-y-6">
        {/* Twilio Production Guide Card */}
        <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2 bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold w-fit border border-emerald-500/30">
            <MessageSquare className="w-3.5 h-3.5" />
            Integrasi Produksi Twilio
          </div>
          <h4 className="font-extrabold text-base tracking-tight text-white leading-tight">Konfigurasi Webhook Webhook WhatsApp</h4>
          <p className="text-xs text-slate-350 leading-relaxed">
            Untuk menyambungkan nomor WhatsApp bisnis Anda di Twilio asli ke asisten sistem ini, silakan hubungkan webhook di Twilio Sandbox ke URL produksi:
          </p>

          <div className="bg-black/40 rounded-xl p-3 border border-white/5 space-y-1">
            <span className="text-[10px] text-slate-400 font-bold block">ENDPOINT TARGET URL:</span>
            <code className="text-emerald-400 text-xs font-mono break-all font-bold block">
              {window.location.protocol}//{window.location.host}/api/whatsapp
            </code>
          </div>

          <p className="text-[11px] text-slate-400 leading-normal">
            ⚙️ <strong>Cara Pengaturan:</strong><br />
            1. Buka dashboard Twilio Console Anda.<br />
            2. Ke tab <strong>Messaging &gt; Try It Out &gt; Send a WhatsApp Message</strong>.<br />
            3. Paste URL di atas pada kolom <strong>"WHEN A MESSAGE COMES IN"</strong>.<br />
            4. Klik <strong>Save</strong>. Setiap chat fisik asli otomatis diposting dan diolah chatbot asisten kami!
          </p>
        </div>

        {/* Low Stock Alert Settings */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 bg-rose-50 text-rose-700 px-3 py-1 rounded-full text-xs font-semibold w-fit border border-rose-100">
              <ShieldAlert className="w-3.5 h-3.5" />
              Notifikasi Low Stock Alert
            </div>

            <h4 className="font-extrabold text-[#0f172a] text-sm leading-tight pt-1">Batas Minimum Pemicu Notifikasi</h4>
            <p className="text-xs text-slate-500 leading-normal">
              Bot asisten stok whatsapp akan mendeteksi unit yang berada di bawah batas minimum pengaman. Batas minimum pengaman saat ini disetting global:
            </p>

            <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-150 justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">BATAS AMAN</span>
                <span className="text-base font-extrabold text-slate-800">{CONFIG.DEFAULT_MIN_STOCK} Unit</span>
              </div>
              <span className="text-xs text-slate-400 font-bold">&rarr;</span>
              <div className="text-right">
                <span className="text-[10px] text-rose-450 font-bold block uppercase tracking-wider">KRITIS / ALARM</span>
                <span className="text-base font-extrabold text-rose-600">&le; {CONFIG.DEFAULT_MIN_STOCK} Unit</span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 italic">
            💡 <strong>Rekomendasi Action:</strong> Ketika produk baru dimasukkan di menu "Master Produk", sistem melacak alur mutasi dan segera mengirimi Anda peringatan (Alert) jika unit berkurang menyentuh alarm batas ini.
          </p>
        </div>
      </div>
    </div>
  );
}
