import { useState, useEffect, type FormEvent } from 'react';
import Dashboard from './components/Dashboard';
import { ShieldCheck, Lock, User, Eye, EyeOff, HelpCircle, ChevronDown, ChevronUp, Sparkles, Database, Boxes, Activity, ArrowUpRight } from 'lucide-react';
import { db } from './lib/firebase';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

export const AREAS = [
  "All Cabang", "Jakarta", "Karawang", "Semarang", "Surabaya", "Jember", 
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
  { username: 'adminc3', password: 'adminc3123', allowedArea: 'ALL', label: 'Admin C3' },
  { username: 'petugasc3', password: 'petugasc3123', allowedArea: 'ALL', label: 'Petugas C3' },
  { username: 'admina5', password: 'admina5123', allowedArea: 'ALL', label: 'Admin C3' },
  { username: 'petugasa5', password: 'petugasa5123', allowedArea: 'ALL', label: 'Petugas C3' },
  { username: 'helper', password: 'helper123', allowedArea: 'ALL', label: 'Helper' },
  { username: 'hq', password: 'hq123', allowedArea: 'All Cabang', label: 'Admin All Cabang (Pusat)' },
  { username: 'admin_hq', password: 'hq123', allowedArea: 'All Cabang', label: 'Admin All Cabang' },
  { username: 'mp', password: 'mp123', allowedArea: 'All Cabang', label: 'Material Planning (MP)', readonly: true },
  { username: 'ppic', password: 'ppic123', allowedArea: 'All Cabang', label: 'PPIC', readonly: true },
  { username: 'jakarta', password: 'jakarta123', allowedArea: 'Jakarta', label: 'Admin Jakarta' },
  { username: 'admin_jakarta', password: 'jakarta123', allowedArea: 'Jakarta', label: 'Admin Jakarta' },
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
  const [activeUsername, setActiveUsername] = useState(() => localStorage.getItem('activeUsername') || '');
  const [loggedInUserRole, setLoggedInUserRole] = useState(() => localStorage.getItem('userRole') || '');
  const [appAuthenticated, setAppAuthenticated] = useState(() => {
    const storedUser = localStorage.getItem('activeUsername') || '';
    return Boolean(storedUser && ADMIN_ACCOUNTS.some(acc => acc.username === storedUser));
  });
  const [currentGasUrl, setCurrentGasUrl] = useState(() => {
    const storedArea = localStorage.getItem('selectedArea') || AREAS[0];
    return storedArea === 'All Cabang' ? 'HQ' : (AREA_URLS[storedArea] || '');
  });
  const [spreadsheetReady, setSpreadsheetReady] = useState(() => {
    const storedArea = localStorage.getItem('selectedArea') || AREAS[0];
    return storedArea === 'All Cabang' || Boolean(AREA_URLS[storedArea]);
  });
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
      <div className="login-page">
        <div className="login-orb login-orb-left" />
        <div className="login-orb login-orb-right" />

        <div className="login-layout">
          <section className="login-showcase">
            <div className="login-brand-badge">
              <span className="login-brand-mark"><Boxes className="w-4 h-4" /></span>
              Warehouse Intelligence
            </div>
            <div className="login-showcase-copy">
              <span className="eyebrow"><Sparkles className="w-3.5 h-3.5" /> Inventory Command Center</span>
              <h1>Kelola persediaan lebih cepat, lebih jelas, lebih terukur.</h1>
              <p>
                Satu dashboard untuk memantau stok, pergerakan barang, akurasi, dan aktivitas seluruh cabang secara terpusat.
              </p>
            </div>

            <div className="login-feature-grid">
              <div className="login-feature-card">
                <div className="login-feature-icon"><Activity className="w-4 h-4" /></div>
                <div>
                  <strong>Live Visibility</strong>
                  <span>Performa stok dan aktivitas lebih mudah dipantau.</span>
                </div>
              </div>
              <div className="login-feature-card">
                <div className="login-feature-icon"><Database className="w-4 h-4" /></div>
                <div>
                  <strong>Multi-Branch</strong>
                  <span>Berpindah area dan pusat kendali dari satu tempat.</span>
                </div>
              </div>
            </div>

            <div className="login-footer-note">
              <span className="status-dot" />
              Sistem siap digunakan · Multi-area warehouse
            </div>
          </section>

          <section className="login-card">
            <div className="login-card-header">
              <div className="login-icon-wrap">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="eyebrow eyebrow-dark">Secure access</span>
                <h2>Masuk ke Dashboard</h2>
                <p>Gunakan akun operasional yang telah diberikan administrator.</p>
              </div>
            </div>

            <form onSubmit={handleAppLogin} className="login-form">
              {loginError && (
                <div className="login-alert" role="alert">
                  <span>!</span>
                  <p>{loginError}</p>
                </div>
              )}

              <label className="login-field">
                <span><User className="w-4 h-4" /> Username</span>
                <input
                  type="text"
                  placeholder="Contoh: admin atau jakarta"
                  value={appUsername}
                  onChange={e => setAppUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </label>

              <label className="login-field">
                <span><Lock className="w-4 h-4" /> Password</span>
                <div className="password-wrap">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Masukkan password"
                    value={appPassword}
                    onChange={e => setAppPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </label>

              <button type="submit" className="login-submit">
                <span>Masuk ke sistem</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </form>

            <div className="login-help">
              <button type="button" onClick={() => setShowHelp(!showHelp)} className="login-help-trigger">
                <HelpCircle className="w-4 h-4" />
                <span>{showHelp ? "Sembunyikan panduan akses" : "Lihat panduan akses"}</span>
                {showHelp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showHelp && (
                <div className="login-help-panel">
                  <div className="login-help-title">Role yang tersedia</div>
                  <div className="login-help-list">
                    <span><strong>Super Admin</strong> · seluruh area & konfigurasi</span>
                    <span><strong>Admin Area</strong> · operasional cabang tertentu</span>
                    <span><strong>HQ / PPIC / MP</strong> · monitoring terpusat sesuai hak akses</span>
                    <span><strong>Petugas / Helper</strong> · operasional sesuai menu yang diizinkan</span>
                  </div>
                  <div className="login-help-note">
                    Kredensial tidak ditampilkan di layar. Hubungi administrator sistem untuk akses atau reset password.
                  </div>
                </div>
              )}
            </div>

            <div className="login-card-meta">
              <span><span className="status-dot" /> Secure session</span>
              <span>Warehouse Management System</span>
            </div>
          </section>
        </div>
      </div>
    );
  }

  // Fallback if URL is missing for the selected area
  if (!spreadsheetReady) {
    return (
      <div className="empty-state-page">
        <div className="empty-state-card">
          <h2 className="text-xl font-bold text-slate-900 mb-2">Konfigurasi area belum tersedia</h2>
          <p className="text-slate-500 mb-6">URL sistem untuk area <strong>{selectedArea}</strong> belum dikonfigurasi.</p>
          <button
             type="button"
             onClick={handleLogout}
             className="secondary-action w-full"
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

