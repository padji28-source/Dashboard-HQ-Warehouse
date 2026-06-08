import { useState } from 'react';
import { LogOut, Package, MapPin, ArrowRightLeft, LayoutDashboard, Menu, X, Box, Beaker, ChevronDown, ChevronRight } from 'lucide-react';
import MasterProduk from './MasterProduk';
import MasterLocator from './MasterLocator';
import TransactionInput from './TransactionInput';
import StockOverview from './StockOverview';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Props {
  spreadsheetId: string;
  area: string;
  onLogout: () => void;
}

export default function Dashboard({ spreadsheetId, area, onLogout }: Props) {
  const [activeTab, setActiveTab] = useState<'stock' | 'produk' | 'locator' | 'input' | 'input_rm' | 'input_mfg' | 'input_supplies'>('stock');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pergerakanOpen, setPergerakanOpen] = useState(true);

  const mainTabs = [
    { id: 'stock', label: 'Stock Overview', icon: LayoutDashboard },
  ] as const;

  const pergerakanTabs = [
    { id: 'input', label: 'Accessories', icon: ArrowRightLeft },
    { id: 'input_rm', label: 'Raw Material', icon: Beaker },
    { id: 'input_mfg', label: 'Manufacturing', icon: Box },
    { id: 'input_supplies', label: 'Supplies & GA', icon: Package },
  ] as const;

  const masterTabs = [
    { id: 'produk', label: 'Master Produk', icon: Package },
    { id: 'locator', label: 'Master Locator', icon: MapPin },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Header for all devices */}
      <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0 shadow-sm">
               <Box className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-bold text-lg text-slate-900 tracking-tight hidden sm:block">Dashboard HQ WH</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-slate-900 leading-none">Administrator</p>
            <p className="text-xs text-slate-500 mt-1 leading-none">Area {area}</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-600 font-bold">
            A
          </div>
        </div>
      </header>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
          onClick={() => setSidebarOpen(false)} 
        />
      )}

      {/* Drawer Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 border-r border-slate-800 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800 shrink-0 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center shrink-0 shadow-sm">
               <Box className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-white tracking-tight">Dashboard HQ WH</span>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="p-2 -mr-2 text-slate-400 hover:text-white rounded-lg transition-colors focus:outline-none"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto">
          <div className="space-y-1 mt-2">
            <div className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Menu Utama</div>
            {mainTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id as any); setSidebarOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-lg transition-all duration-200",
                  activeTab === tab.id 
                    ? "bg-blue-600 text-white shadow-md shadow-blue-900/20" 
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                )}
              >
                <tab.icon className={cn("w-5 h-5", activeTab === tab.id ? "text-white" : "text-slate-400")} />
                {tab.label}
              </button>
            ))}

            <div className="mt-4 pt-4 border-t border-slate-800">
              <button 
                onClick={() => setPergerakanOpen(!pergerakanOpen)} 
                className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-all duration-200"
              >
                <div className="flex items-center gap-3">
                  <ArrowRightLeft className="w-5 h-5" />
                  <span>Data Pergerakan</span>
                </div>
                {pergerakanOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              
              {pergerakanOpen && (
                <div className="mt-1 ml-4 border-l border-slate-700/50 pl-2 space-y-1">
                  {pergerakanTabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => { setActiveTab(tab.id as any); setSidebarOpen(false); }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200",
                        activeTab === tab.id 
                          ? "bg-blue-600/20 text-blue-400 font-semibold" 
                          : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                      )}
                    >
                      <tab.icon className={cn("w-4 h-4", activeTab === tab.id ? "text-blue-400" : "text-slate-500")} />
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-800">
              <div className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Master Data</div>
              {masterTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id as any); setSidebarOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200",
                    activeTab === tab.id 
                      ? "bg-blue-600/20 text-blue-400 font-semibold" 
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                  )}
                >
                  <tab.icon className={cn("w-4 h-4", activeTab === tab.id ? "text-blue-400" : "text-slate-500")} />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        <div className="p-4 border-t border-slate-800 shrink-0 bg-slate-950/20">
          <button 
            onClick={() => {
              setSidebarOpen(false);
              onLogout();
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-slate-300 bg-slate-800/80 rounded-lg hover:bg-rose-600 hover:text-white transition-all duration-200"
          >
            <LogOut className="w-4 h-4" />
            Logout System
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-full min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <div className="w-full">
          {activeTab === 'stock' && <StockOverview spreadsheetId={spreadsheetId} />}
          {activeTab === 'input' && <TransactionInput spreadsheetId={spreadsheetId} sheetName="INPUT" title="Accessories" description="Catat transaksi barang Masuk (IN), Keluar (OUT), dan Transfer." />}
          {activeTab === 'input_rm' && <TransactionInput spreadsheetId={spreadsheetId} sheetName="INPUT RM" title="Raw Material" description="Catat transaksi untuk Raw Material Masuk (IN), Keluar (OUT), dan Transfer." />}
          {activeTab === 'input_mfg' && <TransactionInput spreadsheetId={spreadsheetId} sheetName="INPUT MFG" title="Manufacturing" description="Catat transaksi untuk Manufacturing Masuk (IN), Keluar (OUT), dan Transfer." />}
          {activeTab === 'input_supplies' && <TransactionInput spreadsheetId={spreadsheetId} sheetName="INPUT SUPPLIES" title="Supplies & GA" description="Catat transaksi untuk Supplies & GA Masuk (IN), Keluar (OUT), dan Transfer." />}
          {activeTab === 'produk' && <MasterProduk spreadsheetId={spreadsheetId} />}
          {activeTab === 'locator' && <MasterLocator spreadsheetId={spreadsheetId} />}
        </div>
      </main>
    </div>
  );
}

