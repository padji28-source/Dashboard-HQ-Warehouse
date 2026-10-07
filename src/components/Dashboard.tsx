import { useState, lazy, Suspense, memo } from 'react';
import { LogOut, Package, MapPin, ArrowRightLeft, LayoutDashboard, Menu, X, Box, Beaker, ChevronDown, ChevronRight, Scale, FileSpreadsheet, MessageSquare, ExternalLink, BarChart3, TrendingUp, Loader2, Clock, ClipboardList, ShieldCheck } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { AREAS } from '../App';

const MasterProduk = lazy(() => import('./MasterProduk'));
const MasterLocator = lazy(() => import('./MasterLocator'));
const TransactionInput = lazy(() => import('./TransactionInput'));
const StockOverview = lazy(() => import('./StockOverview'));
const PencocokanData = lazy(() => import('./PencocokanData'));
const MtsData = lazy(() => import('./MtsData'));
const WhatsAppConsole = lazy(() => import('../modules/whatsapp/WhatsAppConsole'));
const AkurasiStock = lazy(() => import('./AkurasiStock'));
const Pengepokan = lazy(() => import('./Pengepokan'));
const CekStock = lazy(() => import('./CekStock'));
const DoiMp = lazy(() => import('./DoiMp'));
const UnpostedDokumen = lazy(() => import('../modules/inventory/UnpostedDokumen'));
const StockActivityLogView = lazy(() => import('../modules/inventory/StockActivityLogView'));

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Props {
  spreadsheetId: string;
  area: string;
  onLogout: () => void;
  userRole?: string;
  onAreaChange?: (newArea: string) => void;
  isReadOnly?: boolean;
  activeUsername?: string;
}

const Dashboard = memo(function Dashboard({ spreadsheetId, area, onLogout, userRole = '', onAreaChange, isReadOnly = false, activeUsername = '' }: Props) {
  const [activeTab, setActiveTab] = useState<'stock' | 'activity_log' | 'pencocokan' | 'produk' | 'locator' | 'input' | 'input_rm' | 'input_mfg' | 'input_supplies' | 'mts' | 'whatsapp' | 'akurasi' | 'pengepokan' | 'cek_stock' | 'doi_mp' | 'unposted'>('stock');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set(['stock']));
  const handleTabChange = (tab: any) => { setActiveTab(tab); setVisitedTabs(prev => new Set(prev).add(tab)); setSidebarOpen(false); };
  const [pergerakanOpen, setPergerakanOpen] = useState(true);

  const usernameLower = (activeUsername || '').toLowerCase();
  const isAdminA5 = usernameLower === 'admina5' || usernameLower === 'adminc3';
  const isPetugasA5 = usernameLower === 'petugasa5' || usernameLower === 'petugasc3';
  const isHelper = usernameLower === 'helper';

  const isSuperAdmin = userRole === 'ALL' || usernameLower === 'admin' || isAdminA5;
  const isHQ = userRole === 'HQ' || userRole === 'All Cabang' || usernameLower === 'hq' || usernameLower === 'admin_hq';
  const isSuperAdminOrHq = (isSuperAdmin || isHQ) && !isPetugasA5 && !isHelper;
  const isMP = usernameLower === 'mp';

  const isAuthorizedForPencocokan = !isPetugasA5 && !isHelper; // Hide for petugas and helper
  
  const getSafeActiveTab = () => {
    if (activeTab === 'pencocokan' && !isAuthorizedForPencocokan) return 'stock';
    if (activeTab === 'akurasi' && (isPetugasA5 || isHelper)) return 'stock';
    if (activeTab === 'pengepokan' && (isPetugasA5 || isHelper)) return 'stock';
    if (activeTab === 'doi_mp' && (isPetugasA5 || isHelper)) return 'stock';
    if (activeTab === 'whatsapp' && !isSuperAdminOrHq) return 'stock';
    if (activeTab === 'mts' && ((area !== 'HQ' && area !== 'All Cabang') || isReadOnly || isPetugasA5 || isHelper)) return 'stock';
    if ((activeTab === 'produk' || activeTab === 'locator') && (isPetugasA5 || isHelper)) return 'stock';
    if (isHelper && ['input', 'input_rm', 'input_mfg', 'input_supplies'].includes(activeTab)) return 'stock';
    return activeTab;
  };
  const safeActiveTab = getSafeActiveTab();

  const isAuthorizedForDoiMp = 
    !isPetugasA5 && !isHelper && (
      ['mp', 'ppic', 'hq', 'admin'].includes(usernameLower) ||
      usernameLower.startsWith('admin')
    );

  const isAuthorizedForPengepokan = 
    !isPetugasA5 && !isHelper && (
      area === 'All Cabang' || 
      ['mp', 'ppic', 'hq', 'admin'].includes(usernameLower) ||
      usernameLower.startsWith('admin')
    );

  const mainTabs = [
    { id: 'stock', label: 'Executive Dashboard', icon: LayoutDashboard },
    { id: 'activity_log', label: 'Log Aktivitas Stok', icon: ClipboardList },
    { id: 'unposted', label: 'Unposted Dokumen', icon: Clock },
    { id: 'cek_stock', label: 'Cek Stock', icon: Package },
    ...(isAuthorizedForDoiMp ? [{ id: 'doi_mp', label: 'DOI MP', icon: TrendingUp }] : []),
    ...(!isReadOnly && isAuthorizedForPencocokan ? [{ id: 'pencocokan', label: 'Pencocokan Data', icon: Scale }] : []),
    ...(!isReadOnly && area === 'All Cabang' && !isPetugasA5 && !isHelper ? [{ id: 'akurasi', label: 'Akurasi Stock', icon: BarChart3 }] : []),
    ...(isAuthorizedForPengepokan ? [{ id: 'pengepokan', label: 'Pengepokan', icon: Box }] : []),
    ...(isSuperAdminOrHq ? [{ id: 'whatsapp', label: 'WhatsApp Bot', icon: MessageSquare }] : []),
  ] as const;

  const pergerakanTabs = [
    { id: 'input', label: 'Accessories', icon: ArrowRightLeft },
    { id: 'input_rm', label: 'Raw Material', icon: Beaker },
    { id: 'input_mfg', label: 'Manufacturing', icon: Box },
    { id: 'input_supplies', label: 'Supplies & GA', icon: Package },
  ] as const;

  const masterTabs = [
    ...(((!isReadOnly || isSuperAdmin || isMP) && !isPetugasA5 && !isHelper) ? [
      { id: 'produk', label: 'Master Produk', icon: Package },
      { id: 'locator', label: 'Master Locator', icon: MapPin },
    ] : [])
  ] as const;

  return (
    <div className="app-shell">
      {/* Top Header for all devices */}
      <header className="app-topbar">
        <div className="topbar-left">
          <button
            onClick={() => setSidebarOpen(true)}
            className="icon-button"
            aria-label="Buka navigasi"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="brand-lockup">
            <div className="brand-mark"><Box className="w-5 h-5" /></div>
            <div className="brand-copy">
              <strong>WH Command Center</strong>
              <span>Warehouse Management System</span>
            </div>
          </div>
        </div>

        <div className="topbar-right">
          {(userRole === 'ALL' || userRole === 'HQ' || userRole === 'All Cabang') && onAreaChange ? (
            <label className="area-switcher">
              <span><MapPin className="w-3.5 h-3.5" /> Area</span>
              <select value={area} onChange={(e) => onAreaChange(e.target.value)} aria-label="Pilih area">
                {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
          ) : (
            <div className="topbar-context">
              <span className="topbar-kicker">Area aktif</span>
              <strong>{area}</strong>
            </div>
          )}

          <div className="profile-chip">
            <div className="profile-avatar">
              {isAdminA5 ? 'C3' : isPetugasA5 ? 'PC' : isHelper ? 'HP' : userRole === 'ALL' ? 'SA' : (userRole === 'HQ' || userRole === 'All Cabang') ? 'AC' : area.substring(0, 2)}
            </div>
            <div className="profile-copy">
              <strong>{activeUsername || 'Administrator'}</strong>
              <span>{isAdminA5 ? 'Admin C3' : isPetugasA5 ? 'Petugas C3' : isHelper ? 'Helper' : userRole === 'ALL' ? 'Super Admin' : (userRole === 'HQ' || userRole === 'All Cabang') ? 'Admin All Cabang' : 'Admin Area'}</span>
            </div>
            <ShieldCheck className="profile-status" />
          </div>
        </div>
      </header>

      <div className="workspace">
      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="sidebar-overlay" 
          onClick={() => setSidebarOpen(false)} 
        />
      )}

      {/* Drawer Sidebar */}
      <div className={cn(
        "app-sidebar",
        sidebarOpen ? "sidebar-open" : "sidebar-closed"
      )}>
        <div className="sidebar-header">
          <div className="flex items-center gap-3">
            <div className="sidebar-brand-mark"><Box className="w-5 h-5" /></div>
             <div className="sidebar-brand-copy"><strong>WH Command Center</strong><span>{area}</span></div>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="icon-button icon-button-dark"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="sidebar-nav-scroll">
          <div className="sidebar-nav">
            <div className="sidebar-section-title">Menu Utama</div>
            {mainTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => { handleTabChange(tab.id as any); }}
                className={cn(
                  "nav-item",
                  safeActiveTab === tab.id 
                    ? "nav-item-active" 
                    : "nav-item-idle"
                )}
              >
                <tab.icon className="nav-item-icon w-5 h-5" />
                {tab.label}
              </button>
            ))}

            {((area === 'HQ' || area === 'All Cabang') && !isReadOnly && !isPetugasA5 && !isHelper) ? (
              <div className="mt-4 pt-4 border-t border-slate-800">
                <button
                  onClick={() => { handleTabChange('mts'); }}
                  className={cn(
                    "nav-item",
                    safeActiveTab === 'mts' 
                      ? "bg-blue-600 text-white shadow-md shadow-blue-900/20" 
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                  )}
                >
                  <FileSpreadsheet className={cn("w-5 h-5", safeActiveTab === 'mts' ? "text-white" : "text-slate-400")} />
                  <span>Data MTS</span>
                </button>
              </div>
            ) : (!isHelper && (
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
                        onClick={() => { handleTabChange(tab.id as any); }}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200",
                          safeActiveTab === tab.id 
                            ? "bg-blue-600/20 text-blue-400 font-semibold" 
                            : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                        )}
                      >
                        <tab.icon className={cn("w-4 h-4", safeActiveTab === tab.id ? "text-blue-400" : "text-slate-500")} />
                        {tab.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {masterTabs.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-800">
                <div className="sidebar-section-title">Master Data</div>
                {masterTabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => { handleTabChange(tab.id as any); }}
                    className={cn(
                      "nav-item nav-item-compact",
                      safeActiveTab === tab.id 
                        ? "nav-item-active nav-item-subactive" 
                        : "nav-item-idle"
                    )}
                  >
                    <tab.icon className={cn("w-4 h-4", safeActiveTab === tab.id ? "text-blue-400" : "text-slate-500")} />
                    {tab.label}
                  </button>
                ))}
              </div>
            )}

            {(userRole === 'ALL' || userRole === 'HQ' || userRole === 'All Cabang' || isAdminA5) && (
              <div className="mt-4 pt-4 border-t border-slate-800">
                <div className="sidebar-section-title">Sistem Eksternal</div>
                <a
                  href="https://wmsc3.vercel.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-150 transition-all duration-200"
                >
                  <div className="flex items-center gap-3">
                    <ExternalLink className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span className="font-bold text-emerald-400">WMS C3</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </a>
              </div>
            )}
          </div>
        </div>
        
        <div className="sidebar-footer">
          <button 
            onClick={() => {
              setSidebarOpen(false);
              onLogout();
            }}
            className="logout-button"
          >
            <LogOut className="w-4 h-4" />
            Logout System
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="app-main">
        <div className="app-content">
          <div className={cn(safeActiveTab !== 'stock' && 'hidden')}>
            {visitedTabs.has('stock') && (
              <Suspense fallback={<div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>}>
                <StockOverview spreadsheetId={spreadsheetId} area={area} onNavigateToTab={handleTabChange as any} />
              </Suspense>
            )}
          </div>
          <div className={cn(safeActiveTab !== 'activity_log' && 'hidden')}>
            {visitedTabs.has('activity_log') && (
              <Suspense fallback={<div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>}>
                <StockActivityLogView spreadsheetId={spreadsheetId} currentArea={area} activeUsername={activeUsername} onNavigateToTab={handleTabChange} />
              </Suspense>
            )}
          </div>
          <div className={cn(safeActiveTab !== 'unposted' && 'hidden')}>
            {visitedTabs.has('unposted') && (
              <Suspense fallback={<div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>}>
                <UnpostedDokumen area={area} userRole={userRole} activeUsername={activeUsername} />
              </Suspense>
            )}
          </div>
          <div className={cn(safeActiveTab !== 'cek_stock' && 'hidden')}>
            {visitedTabs.has('cek_stock') && (
              <Suspense fallback={<div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>}>
                <CekStock spreadsheetId={spreadsheetId} area={area} />
              </Suspense>
            )}
          </div>
          <div className={cn(safeActiveTab !== 'doi_mp' && 'hidden')}>
            {visitedTabs.has('doi_mp') && (
              <Suspense fallback={<div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>}>
                <DoiMp spreadsheetId={spreadsheetId} area={area} activeUsername={activeUsername} userRole={userRole} />
              </Suspense>
            )}
          </div>
          <div className={cn(safeActiveTab !== 'pencocokan' && 'hidden')}>
            {visitedTabs.has('pencocokan') && (
              <Suspense fallback={<div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>}>
                <PencocokanData spreadsheetId={spreadsheetId} area={area} />
              </Suspense>
            )}
          </div>
          <div className={cn(safeActiveTab !== 'akurasi' && 'hidden')}>
            {visitedTabs.has('akurasi') && (
              <Suspense fallback={<div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>}>
                <AkurasiStock />
              </Suspense>
            )}
          </div>
          <div className={cn(safeActiveTab !== 'pengepokan' && 'hidden')}>
            {visitedTabs.has('pengepokan') && (
              <Suspense fallback={<div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>}>
                <Pengepokan />
              </Suspense>
            )}
          </div>
          <div className={cn(safeActiveTab !== 'mts' && 'hidden')}>
            {visitedTabs.has('mts') && (
              <Suspense fallback={<div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>}>
                <MtsData />
              </Suspense>
            )}
          </div>
          <div className={cn(safeActiveTab !== 'input' && 'hidden')}>
            {visitedTabs.has('input') && (
              <Suspense fallback={<div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>}>
                {(area === 'HQ' || area === 'All Cabang') ? <HQReadOnlyPlaceholder title="Accessories" /> : (
              <TransactionInput spreadsheetId={spreadsheetId} sheetName="INPUT" title="Accessories" description="Catat transaksi barang Masuk (IN), Keluar (OUT), dan Transfer." isReadOnly={isReadOnly} activeUsername={activeUsername} area={area} />
            )}
              </Suspense>
            )}
          </div>
          <div className={cn(safeActiveTab !== 'input_rm' && 'hidden')}>
            {visitedTabs.has('input_rm') && (
              <Suspense fallback={<div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>}>
                {(area === 'HQ' || area === 'All Cabang') ? <HQReadOnlyPlaceholder title="Raw Material" /> : (
              <TransactionInput spreadsheetId={spreadsheetId} sheetName="INPUT RM" title="Raw Material" description="Catat transaksi untuk Raw Material Masuk (IN), Keluar (OUT), dan Transfer." isReadOnly={isReadOnly} activeUsername={activeUsername} area={area} />
            )}
              </Suspense>
            )}
          </div>
          <div className={cn(safeActiveTab !== 'input_mfg' && 'hidden')}>
            {visitedTabs.has('input_mfg') && (
              <Suspense fallback={<div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>}>
                {(area === 'HQ' || area === 'All Cabang') ? <HQReadOnlyPlaceholder title="Manufacturing" /> : (
              <TransactionInput spreadsheetId={spreadsheetId} sheetName="INPUT MFG" title="Manufacturing" description="Catat transaksi untuk Manufacturing Masuk (IN), Keluar (OUT), dan Transfer." isReadOnly={isReadOnly} activeUsername={activeUsername} area={area} />
            )}
              </Suspense>
            )}
          </div>
          <div className={cn(safeActiveTab !== 'input_supplies' && 'hidden')}>
            {visitedTabs.has('input_supplies') && (
              <Suspense fallback={<div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>}>
                {(area === 'HQ' || area === 'All Cabang') ? <HQReadOnlyPlaceholder title="Supplies & GA" /> : (
              <TransactionInput spreadsheetId={spreadsheetId} sheetName="INPUT SUPPLIES" title="Supplies & GA" description="Catat transaksi untuk Supplies & GA Masuk (IN), Keluar (OUT), dan Transfer." isReadOnly={isReadOnly} activeUsername={activeUsername} area={area} />
            )}
              </Suspense>
            )}
          </div>
          <div className={cn(safeActiveTab !== 'produk' && 'hidden')}>
            {visitedTabs.has('produk') && (
              <Suspense fallback={<div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>}>
                <MasterProduk spreadsheetId={spreadsheetId} area={area} isReadOnly={isReadOnly} activeUsername={activeUsername} userRole={userRole} />
              </Suspense>
            )}
          </div>
          <div className={cn(safeActiveTab !== 'locator' && 'hidden')}>
            {visitedTabs.has('locator') && (
              <Suspense fallback={<div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>}>
                {(area === 'HQ' || area === 'All Cabang') ? <HQReadOnlyPlaceholder title="Master Locator" /> : (
              <MasterLocator spreadsheetId={spreadsheetId} isReadOnly={isReadOnly} activeUsername={activeUsername} userRole={userRole} />
            )}
              </Suspense>
            )}
          </div>
          <div className={cn(safeActiveTab !== 'whatsapp' && 'hidden')}>
            {visitedTabs.has('whatsapp') && (
              <Suspense fallback={<div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>}>
                <WhatsAppConsole area={area} />
              </Suspense>
            )}
          </div>
        </div>
      </main>
      </div>
    </div>
  );
});

function HQReadOnlyPlaceholder({ title }: { title: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-12 shadow-sm text-center max-w-xl mx-auto my-8">
      <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
        <Scale className="w-8 h-8" style={{ transform: 'rotate(-10deg)' }} />
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-3">Menu {title} Dinonaktifkan di Area All Cabang</h3>
      <p className="text-sm text-slate-500 leading-relaxed max-w-md mx-auto mb-6">
        Gudang pusat All Cabang / HQ beroperasi dalam mode Agregasi Multi-Area (Read-Only) untuk memantau performa inventaris di seluruh 11 gudang cabang secara real-time. 
        Anda tidak dapat mengubah data individual dari mode ini. Gunakan area cabang tertentu saat membutuhkan penginputan transaksi atau perubahan master data.
      </p>
    </div>
  );
}

export default Dashboard;

