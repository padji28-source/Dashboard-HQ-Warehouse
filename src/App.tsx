import { useState, useEffect, type FormEvent } from 'react';
import Dashboard from './components/Dashboard';
import { Loader2, ShieldCheck, Lock, User, MapPin, Eye, EyeOff, Info, HelpCircle, ChevronDown, ChevronUp, ArrowRight, AlertTriangle } from 'lucide-react';
import { db } from './lib/firebase';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';

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
    
    const updatePresence = async () => {
      try {
        await setDoc(userDocRef, {
          username: activeUsername,
          role: loggedInUserRole,
          area: selectedArea,
          lastActive: serverTimestamp(),
        }, { merge: true });
      } catch (e) {
        console.error("Gagal update user presence:", e);
      }
    };

    updatePresence();
    const intervalId = setInterval(updatePresence, 30000); // update every 30 seconds

    return () => {
      clearInterval(intervalId);
      // Try to clean up on unmount/logout, though browser close might skip this
      deleteDoc(userDocRef).catch(console.error);
    };
  }, [appAuthenticated, activeUsername, selectedArea, loggedInUserRole]);

  const handleLogout = () => {
    // Delete session before clearing state
    const sessionId = localStorage.getItem('sessionId');
    if (sessionId) {
      deleteDoc(doc(db, 'activeUsers', sessionId)).catch(console.error);
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
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Abstract Background Elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px]" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="max-w-md w-full relative z-10"
        >
          <div className="bg-white/95 backdrop-blur-xl rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] border border-white/20 overflow-hidden p-8 sm:p-12">
            <div className="text-center mb-10">
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-500/20"
              >
                <ShieldCheck className="w-8 h-8" />
              </motion.div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900 mb-2 leading-tight">
                WH Dashboard
              </h1>
              <p className="text-slate-500 text-sm font-medium">
                Warehouse Management System Multi-Area
              </p>
            </div>
            
            <form onSubmit={handleAppLogin} className="space-y-6">
              <AnimatePresence mode="wait">
                {loginError && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-800 text-xs font-bold flex items-center gap-3"
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{loginError}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 ml-1">
                  Username
                </label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 transition-colors group-focus-within:text-blue-600" />
                  <input 
                    type="text" 
                    placeholder="Enter username"
                    value={appUsername}
                    onChange={e => setAppUsername(e.target.value)}
                    required
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm font-bold text-slate-900 placeholder:text-slate-300"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 ml-1">
                  Password
                </label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 transition-colors group-focus-within:text-blue-600" />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="••••••••"
                    value={appPassword}
                    onChange={e => setAppPassword(e.target.value)}
                    required
                    className="w-full pl-11 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm font-bold text-slate-900 placeholder:text-slate-300 tracking-widest"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <motion.button 
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl hover:bg-slate-800 active:bg-slate-950 transition-all shadow-[0_12px_24px_-8px_rgba(0,0,0,0.3)] text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2"
              >
                Sign In <ArrowRight className="w-4 h-4" />
              </motion.button>
            </form>

            <div className="mt-10 pt-8 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowHelp(!showHelp)}
                className="flex items-center gap-2 mx-auto text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700 transition-colors"
              >
                <HelpCircle className="w-4 h-4" />
                <span>{showHelp ? "Hide" : "Show"} Access Guide</span>
                {showHelp ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              <AnimatePresence>
                {showHelp && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-6 bg-slate-50 rounded-2xl p-5 border border-slate-100 max-h-56 overflow-y-auto space-y-4 shadow-inner"
                  >
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      Registered Admin Accounts
                    </div>
                    <div className="space-y-3">
                      {AREAS.filter(ar => ar !== 'All Cabang').map(ar => {
                        const pass = ar.toLowerCase() === 'makassar' ? 'makassar111' : `${ar.toLowerCase()}123`;
                        return (
                          <div key={ar} className="flex items-center justify-between gap-4 pb-2 border-b border-slate-100 last:border-0">
                            <span className="text-[11px] font-bold text-slate-700">{ar}</span>
                            <div className="flex gap-2">
                              <code className="bg-white px-2 py-0.5 rounded text-[10px] font-black text-blue-600 border border-slate-100">{ar.toLowerCase()}</code>
                              <code className="bg-white px-2 py-0.5 rounded text-[10px] font-black text-slate-400 border border-slate-100">{pass}</code>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <p className="mt-8 text-center text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] opacity-50">
            Internal Operations System • v2.0
          </p>
        </motion.div>
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
      activeUsername={activeUsername}
    />
  );
}

