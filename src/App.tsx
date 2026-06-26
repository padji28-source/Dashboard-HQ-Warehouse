import { useState, useEffect, type FormEvent } from 'react';
import Dashboard from './components/Dashboard';
import { Loader2, ShieldCheck, Lock, User, MapPin, Eye, EyeOff, Info, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { db } from './lib/firebase';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

export const AREAS = [
  "All Cabang", "Jakarta", "Jakarta A5", "Karawang", "Semarang", "Surabaya", "Jember", 
  "Makassar", "Pontianak", "Banjarmasin", "Palembang", "Medan", "Pekanbaru"
];

export const AREA_URLS: Record<string, string> = {
  "Semarang": "https://script.google.com/macros/s/AKfycbyIIH9cK_28B_1snnP34O-sAYSbfD6AxKa469DpROT-bLusjZJVAalJC_287gG5IfN2/exec",
  "Medan": "https://script.google.com/macros/s/AKfycbztMdYKZVq9CzjyDV0hS4gIp28G2YYcJ06blnEX2R2TxNI7VakMMWWJWNtB02MT4h0kdg/exec",
  "Banjarmasin": "https://script.google.com/macros/s/AKfycbwBAHlRLcpd6ORSMHwHkil_YTR5sBWoFyCwpHA0ykAZeRXKEGcJL5sffVSx-wh_l8ZM/exec",
  "Jember": "https://script.google.com/macros/s/AKfycbxRo-cmtM1FdQgWSce2sR2BuGdCmSAau2F-3a9V4T26DgPpqCA2nDAy58wtablPqO4C/exec",
  "Makassar": "https://script.google.com/macros/s/AKfycbwDPpdlYvLcleIZ2oKrsVCTsI1sSv9k3auuaDmV7zcvH8Yf-hn6guJ9OCCBzM95tMeJ/exec",
  "Palembang": "https://script.google.com/macros/s/AKfycbwum8m0n6DhxPhAzQ1VvPf5HSfufJeX-Im_YUG88BjRIAHJlUVY2TS5Ba1vXGl4z5rD/exec",
  "Pekanbaru": "https://script.google.com/macros/s/AKfycbw_EWJWwwDfu184ZCje9ypcsoIcqliMlVuPhjiGikiFbvjtWBUpsxuThRp4_N0eeOycCw/exec",
  "Pontianak": "https://script.google.com/macros/s/AKfycbz2xTv0vr0iz6nQeLMPcW79oKtezE9l1gtlvdJUDUfccR2sGsMtMXn9MjvO-wJmoXA/exec",
  "Surabaya": "https://script.google.com/macros/s/AKfycbyNvvxxikV5eZE4eBqqH_H4Nhl6B7GJT1btQz9ncVih4FHvxnQE4kEQAM789LtUBBFmlg/exec",
  "Karawang": "https://script.google.com/macros/s/AKfycbwTI_3RCL4lle9lJei4qTv_Cm4VnCCFawNFLgZzJ_O83Y5T3qhHN6JxiX5QujfoRDegzQ/exec",
  "Jakarta": "https://script.google.com/macros/s/AKfycbwgor6oSmZzRE0MaFN51B2YaiDJe8dtV3guKrGdZLY9gLdQgFsk4tANGGm1B1aQMdZUFw/exec",
  "Jakarta A5": "https://script.google.com/macros/s/AKfycbwLKZrkQ_q7Vo4ycSiS7Y_WAPYUBlD8XyD9bUEdqe3ODPEvpzPCVcVzjyykIgyiw23R-w/exec",
};

// Admin authentication accounts mapping
export interface AdminAccount {
  username: string;
  password: string;
  allowedArea: string; // 'ALL' or specific area
  label: string;
  readonly?: boolean;
}

export const ADMIN_ACCOUNTS: AdminAccount[] = [
  { username: 'admin', password: 'admin123', allowedArea: 'ALL', label: 'Super Admin (Semua Area)' },
  { username: 'hq', password: 'hq123', allowedArea: 'All Cabang', label: 'Admin All Cabang (Pusat)' },
  { username: 'admin_hq', password: 'hq123', allowedArea: 'All Cabang', label: 'Admin All Cabang' },
  { username: 'mp', password: 'mp123', allowedArea: 'All Cabang', label: 'Material Planning (MP)', readonly: true },
  { username: 'ppic', password: 'ppic123', allowedArea: 'All Cabang', label: 'PPIC', readonly: true },
  { username: 'jakarta', password: 'jakarta123', allowedArea: 'Jakarta', label: 'Admin Jakarta' },
  { username: 'admin_jakarta', password: 'jakarta123', allowedArea: 'Jakarta', label: 'Admin Jakarta' },
  { username: 'jakarta_a5', password: 'jakarta123', allowedArea: 'Jakarta A5', label: 'Admin Jakarta A5' },
  { username: 'admin_jakarta_a5', password: 'jakarta123', allowedArea: 'Jakarta A5', label: 'Admin Jakarta A5' },
  { username: 'karawang', password: 'karawang123', allowedArea: 'Karawang', label: 'Admin Karawang' },
  { username: 'admin_karawang', password: 'karawang123', allowedArea: 'Karawang', label: 'Admin Karawang' },
  { username: 'semarang', password: 'semarang123', allowedArea: 'Semarang', label: 'Admin Semarang' },
  { username: 'admin_semarang', password: 'semarang123', allowedArea: 'Semarang', label: 'Admin Semarang' },
  { username: 'surabaya', password: 'surabaya123', allowedArea: 'Surabaya', label: 'Admin Surabaya' },
  { username: 'admin_surabaya', password: 'surabaya123', allowedArea: 'Surabaya', label: 'Admin Surabaya' },
  { username: 'jember', password: 'jember123', allowedArea: 'Jember', label: 'Admin Jember' },
  { username: 'admin_jember', password: 'jember123', allowedArea: 'Jember', label: 'Admin Jember' },
  { username: 'makassar', password: 'makassar111', allowedArea: 'Makassar', label: 'Admin Makassar' },
  { username: 'admin_makassar', password: 'makassar123', allowedArea: 'Makassar', label: 'Admin Makassar' },
  { username: 'pontianak', password: 'pontianak123', allowedArea: 'Pontianak', label: 'Admin Pontianak' },
  { username: 'admin_pontianak', password: 'pontianak123', allowedArea: 'Pontianak', label: 'Admin Pontianak' },
  { username: 'banjarmasin', password: 'banjarmasin123', allowedArea: 'Banjarmasin', label: 'Admin Banjarmasin' },
  { username: 'admin_banjarmasin', password: 'banjarmasin123', allowedArea: 'Banjarmasin', label: 'Admin Banjarmasin' },
  { username: 'palembang', password: 'palembang123', allowedArea: 'Palembang', label: 'Admin Palembang' },
  { username: 'admin_palembang', password: 'palembang123', allowedArea: 'Palembang', label: 'Admin Palembang' },
  { username: 'medan', password: 'medan123', allowedArea: 'Medan', label: 'Admin Medan' },
  { username: 'admin_medan', password: 'medan123', allowedArea: 'Medan', label: 'Admin Medan' },
  { username: 'pekanbaru', password: 'pekanbaru123', allowedArea: 'Pekanbaru', label: 'Admin Pekanbaru' },
  { username: 'admin_pekanbaru', password: 'pekanbaru123', allowedArea: 'Pekanbaru', label: 'Admin Pekanbaru' },
];

export default function App() {
  const [appUsername, setAppUsername] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedArea, setSelectedArea] = useState(() => localStorage.getItem('selectedArea') || AREAS[0]);
  const [appAuthenticated, setAppAuthenticated] = useState(false);
  const [loggedInUserRole, setLoggedInUserRole] = useState(() => localStorage.getItem('userRole') || '');
  const [activeUsername, setActiveUsername] = useState(() => localStorage.getItem('activeUsername') || '');
  const [currentGasUrl, setCurrentGasUrl] = useState('');
  const [spreadsheetReady, setSpreadsheetReady] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Check if current user is readonly
  const isReadOnly = ADMIN_ACCOUNTS.find(acc => acc.username === activeUsername)?.readonly || false;

  const handleAreaChange = (newArea: string) => {
    setSelectedArea(newArea);
    localStorage.setItem('selectedArea', newArea);
    const url = AREA_URLS[newArea] || '';
    setCurrentGasUrl(newArea === 'All Cabang' ? 'HQ' : url);
    setSpreadsheetReady(newArea === 'All Cabang' ? true : !!url);
  };

  const handleAppLogin = (e: FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const inputUser = appUsername.trim().toLowerCase();
    const inputPass = appPassword;

    // Find custom admin record (matched either simple username or with 'admin_' prefix)
    const matchedAccount = ADMIN_ACCOUNTS.find(
      acc => acc.username.toLowerCase() === inputUser && acc.password === inputPass
    );

    if (matchedAccount) {
      let finalArea = selectedArea;

      // Restrict and force specific area for non-superadmins and non-HQ admins
      if (matchedAccount.allowedArea !== 'ALL' && matchedAccount.allowedArea !== 'All Cabang') {
        finalArea = matchedAccount.allowedArea;
        setSelectedArea(finalArea);
      }

      setAppAuthenticated(true);
      setLoggedInUserRole(matchedAccount.allowedArea);
      setActiveUsername(matchedAccount.username);
      localStorage.setItem('selectedArea', finalArea);
      localStorage.setItem('userRole', matchedAccount.allowedArea);
      localStorage.setItem('activeUsername', matchedAccount.username);
      const url = AREA_URLS[finalArea] || '';
      setCurrentGasUrl(finalArea === 'All Cabang' ? 'HQ' : url);
      setSpreadsheetReady(finalArea === 'All Cabang' ? true : !!url);
    } else {
      setLoginError('Username atau password salah! Silakan periksa kembali kredensial Anda.');
    }
  };

  useEffect(() => {
    if (!appAuthenticated || !activeUsername) return;

    const sessionId = localStorage.getItem('sessionId') || Math.random().toString(36).substring(2, 15);
    localStorage.setItem('sessionId', sessionId);

    const userDocRef = doc(db, 'activeUsers', sessionId);
    
    const getBrowserInfo = () => {
      const ua = navigator.userAgent;
      if (ua.includes('Edg')) return 'Edge';
      if (ua.includes('Chrome')) return 'Chrome';
      if (ua.includes('Firefox')) return 'Firefox';
      if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
      return 'Unknown Browser';
    };

    const getDeviceInfo = () => {
      const ua = navigator.userAgent;
      if (/Mobile|Android|iP(hone|od|ad)/.test(ua)) return 'Mobile';
      return 'Desktop';
    };
    
    // Initial login mark
    const markLogin = async () => {
      try {
        await setDoc(userDocRef, {
          username: activeUsername,
          role: loggedInUserRole,
          area: selectedArea,
          loginTime: serverTimestamp(),
          lastActive: serverTimestamp(),
          status: 'Online',
          browser: getBrowserInfo(),
          device: getDeviceInfo(),
          app: 'HQ'
        }, { merge: true });
      } catch(e) {
        console.error("Gagal mark login:", e);
      }
    };
    
    markLogin();

    const updatePresence = async () => {
      try {
        await setDoc(userDocRef, {
          lastActive: serverTimestamp(),
          status: 'Online'
        }, { merge: true });
      } catch (e) {
        console.error("Gagal update user presence:", e);
      }
    };

    const intervalId = setInterval(updatePresence, 30000); // update every 30 seconds

    // Track Idle locally to avoid spamming Firestore
    let isIdle = false;
    let idleTimeout: NodeJS.Timeout;
    let lastInteraction = Date.now();

    const setIdle = () => {
      isIdle = true;
      setDoc(userDocRef, { status: 'Idle', lastActive: serverTimestamp() }, { merge: true }).catch(console.error);
    };

    const resetIdleTimer = () => {
      const now = Date.now();
      if (now - lastInteraction < 1000) return; // throttle to once per second
      lastInteraction = now;

      clearTimeout(idleTimeout);
      
      if (isIdle) {
        isIdle = false;
        setDoc(userDocRef, { status: 'Online', lastActive: serverTimestamp() }, { merge: true }).catch(console.error);
      }

      idleTimeout = setTimeout(setIdle, 5 * 60 * 1000); // mark as Idle after 5 mins of no interaction
    };

    window.addEventListener('mousemove', resetIdleTimer);
    window.addEventListener('keypress', resetIdleTimer);
    resetIdleTimer();

    return () => {
      clearInterval(intervalId);
      clearTimeout(idleTimeout);
      window.removeEventListener('mousemove', resetIdleTimer);
      window.removeEventListener('keypress', resetIdleTimer);
      // Try to clean up on unmount/logout
      setDoc(userDocRef, { status: 'Offline', lastActive: serverTimestamp() }, { merge: true }).catch(console.error);
    };
  }, [appAuthenticated, activeUsername, selectedArea, loggedInUserRole]);

  const handleLogout = () => {
    // Delete session before clearing state
    const sessionId = localStorage.getItem('sessionId');
    if (sessionId) {
      setDoc(doc(db, 'activeUsers', sessionId), { status: 'Offline', lastActive: serverTimestamp() }, { merge: true }).catch(console.error);
      localStorage.removeItem('sessionId');
    }

    
    setAppAuthenticated(false);
    setAppUsername('');
    setAppPassword('');
    setSpreadsheetReady(false);
    setLoginError(null);
    setLoggedInUserRole('');
    setActiveUsername('');
    localStorage.removeItem('userRole');
    localStorage.removeItem('activeUsername');
  };

  // App Auth Flow (System level)
  if (!appAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden p-6 sm:p-8">
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-inner">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-1">Dashboard All Cabang WH</h1>
            <p className="text-slate-500 text-sm">Warehouse Management System Multi-Area</p>
          </div>
          
          <form onSubmit={handleAppLogin} className="space-y-4">
            {loginError && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-rose-800 text-xs font-medium">
                ⚠️ {loginError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                Username
              </label>
              <input 
                type="text" 
                placeholder="Contoh: jakarta atau admin"
                value={appUsername}
                onChange={e => setAppUsername(e.target.value)}
                required
                className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-slate-300 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                Password
              </label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  placeholder="Ketik password..."
                  value={appPassword}
                  onChange={e => setAppPassword(e.target.value)}
                  required
                  className="w-full pl-3.5 pr-10 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-slate-300 font-medium font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 outline-none"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button 
              type="submit"
              className="w-full bg-slate-900 text-white font-semibold py-2.5 rounded-lg hover:bg-slate-800 active:bg-slate-950 transition-colors shadow-sm text-sm"
            >
              Sign In
            </button>
          </form>

          {/* Collapsible Helper Panel for easy testing & guidance */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowHelp(!showHelp)}
              className="flex items-center gap-1.5 mx-auto text-xs text-blue-600 font-semibold hover:text-blue-700 focus:outline-none select-none transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>{showHelp ? "Sembunyikan" : "Tampilkan"} Panduan Kredensial Admin</span>
              {showHelp ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showHelp && (
              <div className="mt-4 bg-slate-50 border border-slate-150 rounded-lg p-3 text-xs max-h-48 overflow-y-auto space-y-2">
                <div className="sticky top-0 bg-slate-50 pb-1 border-b border-slate-200 mb-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Akun Akses Terdaftar
                </div>
                <div className="space-y-1.5 font-medium text-slate-600">
                  <div>
                    <p className="text-slate-800 font-bold">Admin Area Spesifik (Sesuai tugas):</p>
                    <p className="text-[10px] text-slate-400 ml-2 mb-1">Masing-masing admin dikunci ke areanya & tidak bisa mengakses area lain.</p>
                    <ul className="ml-2 space-y-1 list-disc list-inside">
                      {AREAS.filter(ar => ar !== 'All Cabang').map(ar => {
                        const pass = ar.toLowerCase() === 'makassar' ? 'makassar111' : `${ar.toLowerCase()}123`;
                        return (
                          <li key={ar} className="text-[11px]">
                            <strong>{ar}</strong>: U: <code className="bg-white px-1 text-slate-800 font-bold">{ar.toLowerCase()}</code> / P: <code className="bg-white px-1 text-slate-800 font-bold">{pass}</code>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Fallback if URL is missing for the selected area
  if (!spreadsheetReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden p-6 sm:p-8 text-center">
          <h2 className="text-xl font-bold text-slate-900 mb-2">Konfigurasi Area Tidak Valid</h2>
          <p className="text-slate-500 mb-6">URL sistem untuk area <strong>{selectedArea}</strong> belum dikonfigurasi.</p>
          <button
             type="button"
             onClick={handleLogout}
             className="w-full bg-slate-900 text-white font-medium py-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  return (
    <Dashboard 
      spreadsheetId={currentGasUrl} 
      area={selectedArea} 
      onLogout={handleLogout} 
      userRole={loggedInUserRole} 
      onAreaChange={handleAreaChange} 
      isReadOnly={isReadOnly}
    />
  );
}

