import { useState, useEffect, type FormEvent } from 'react';
import Dashboard from './components/Dashboard';
import {
  ShieldCheck,
  Lock,
  User,
  Eye,
  EyeOff,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Database,
  Boxes,
  Activity,
  ArrowUpRight,
  Loader2,
} from 'lucide-react';
import { db } from './lib/firebase';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { AREAS, AREA_URLS, type AreaName } from './config/areas';
import { computeUserPermissions, type UserSession, type UserRole } from './config/permissions';
import { ToastProvider } from './components/ui/Toast';

// Re-export for any legacy module imports
export { AREAS, AREA_URLS };

export default function App() {
  const [appUsername, setAppUsername] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedArea, setSelectedArea] = useState<string>(() => sessionStorage.getItem('selectedArea') || AREAS[0]);
  const [activeSession, setActiveSession] = useState<UserSession | null>(null);
  const [isVerifyingSession, setIsVerifyingSession] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // 1. Verify existing backend session on initial boot
  useEffect(() => {
    const token = sessionStorage.getItem('auth_token');
    if (!token) {
      setIsVerifyingSession(false);
      return;
    }

    fetch('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Session invalid');
        return res.json();
      })
      .then((data) => {
        if (data.authenticated && data.user) {
          const user = data.user;
          const perms = computeUserPermissions(user.role as UserRole, user.allowedArea, user.readonly);
          const fullSession: UserSession = {
            username: user.username,
            role: user.role,
            allowedArea: user.allowedArea,
            label: user.label,
            readonly: !!user.readonly,
            avatarKicker: user.username.substring(0, 2).toUpperCase(),
            permissions: perms,
          };
          setActiveSession(fullSession);

          // Restore or constrain area
          const savedArea = sessionStorage.getItem('selectedArea') || AREAS[0];
          if (user.allowedArea !== 'ALL' && user.allowedArea !== 'All Cabang') {
            setSelectedArea(user.allowedArea);
            sessionStorage.setItem('selectedArea', user.allowedArea);
          } else {
            setSelectedArea(savedArea);
          }
        } else {
          sessionStorage.removeItem('auth_token');
          setActiveSession(null);
        }
      })
      .catch(() => {
        sessionStorage.removeItem('auth_token');
        setActiveSession(null);
      })
      .finally(() => {
        setIsVerifyingSession(false);
      });
  }, []);

  const handleAreaChange = (newArea: string) => {
    setSelectedArea(newArea);
    sessionStorage.setItem('selectedArea', newArea);
  };

  const handleAppLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: appUsername.trim(),
          password: appPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setLoginError(data.error || 'Username atau password salah. Silakan periksa kembali kredensial Anda.');
        return;
      }

      // Store secure token
      sessionStorage.setItem('auth_token', data.token);

      const user = data.user;
      const perms = computeUserPermissions(user.role as UserRole, user.allowedArea, user.readonly);
      const fullSession: UserSession = {
        username: user.username,
        role: user.role,
        allowedArea: user.allowedArea,
        label: user.label,
        readonly: !!user.readonly,
        avatarKicker: user.username.substring(0, 2).toUpperCase(),
        permissions: perms,
      };

      setActiveSession(fullSession);

      let targetArea = selectedArea;
      if (user.allowedArea !== 'ALL' && user.allowedArea !== 'All Cabang') {
        targetArea = user.allowedArea;
      }
      setSelectedArea(targetArea);
      sessionStorage.setItem('selectedArea', targetArea);
      setAppPassword('');
    } catch {
      setLoginError('Gagal menghubungi server otentikasi. Silakan periksa koneksi Anda.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Heartbeat active user presence in Firestore
  useEffect(() => {
    if (!activeSession) return;

    const sessionId = sessionStorage.getItem('sessionId') || Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem('sessionId', sessionId);

    const userDocRef = doc(db, 'activeUsers', sessionId);

    const updatePresence = async () => {
      try {
        await setDoc(
          userDocRef,
          {
            username: activeSession.username,
            role: activeSession.role,
            area: selectedArea,
            lastSeen: new Date().toISOString(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (e) {
        console.warn('Gagal update user presence:', e);
      }
    };

    updatePresence();
    const intervalId = setInterval(updatePresence, 30000);

    return () => {
      clearInterval(intervalId);
      deleteDoc(userDocRef).catch(() => {});
    };
  }, [activeSession, selectedArea]);

  const handleLogout = async () => {
    const token = sessionStorage.getItem('auth_token');
    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }

    const sessionId = sessionStorage.getItem('sessionId');
    if (sessionId) {
      deleteDoc(doc(db, 'activeUsers', sessionId)).catch(() => {});
      sessionStorage.removeItem('sessionId');
    }

    sessionStorage.removeItem('auth_token');
    setActiveSession(null);
    setAppUsername('');
    setAppPassword('');
    setLoginError(null);
  };

  // Show loading skeleton while verifying existing session
  if (isVerifyingSession) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30 mb-4 animate-bounce">
          <Boxes className="w-6 h-6 text-white" />
        </div>
        <div className="flex items-center gap-2.5 text-sm font-semibold text-slate-300">
          <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
          <span>Memverifikasi sesi aman WMS Command Center...</span>
        </div>
      </div>
    );
  }

  // App Auth Flow (System level)
  if (!activeSession) {
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
                  <span>Performa stok dan aktivitas lebih mudah dipantau secara real-time.</span>
                </div>
              </div>
              <div className="login-feature-card">
                <div className="login-feature-icon"><Database className="w-4 h-4" /></div>
                <div>
                  <strong>Multi-Branch</strong>
                  <span>Berpindah area dan kendali multi-cabang terpadu dari satu sistem.</span>
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
                  onChange={(e) => setAppUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </label>

              <label className="login-field">
                <span><Lock className="w-4 h-4" /> Password</span>
                <div className="password-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Masukkan password"
                    value={appPassword}
                    onChange={(e) => setAppPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </label>

              <button type="submit" disabled={isLoggingIn} className="login-submit">
                {isLoggingIn ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Memverifikasi...</span>
                  </>
                ) : (
                  <>
                    <span>Masuk ke sistem</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="login-help">
              <button type="button" onClick={() => setShowHelp(!showHelp)} className="login-help-trigger">
                <HelpCircle className="w-4 h-4" />
                <span>{showHelp ? 'Sembunyikan panduan akses' : 'Lihat panduan akses & roles'}</span>
                {showHelp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showHelp && (
                <div className="login-help-panel">
                  <div className="login-help-title">Daftar Hak Akses (Role Matrix)</div>
                  <div className="login-help-list">
                    <span><strong>Super Admin</strong> · Seluruh area & kendali penuh</span>
                    <span><strong>Admin C3 / Petugas C3 / Helper</strong> · Operasional pergerakan & stok C3</span>
                    <span><strong>Admin Area</strong> · Terkunci ke cabang operasional masing-masing</span>
                    <span><strong>HQ / PPIC / MP</strong> · Monitoring agregasi 11 cabang terpusat</span>
                  </div>
                  <div className="login-help-note">
                    Autentikasi diverifikasi langsung oleh backend server yang aman. Hubungi administrator bila memerlukan reset kredensial.
                  </div>
                </div>
              )}
            </div>

            <div className="login-card-meta">
              <span><span className="status-dot" /> Secure enterprise session</span>
              <span>Warehouse Management System</span>
            </div>
          </section>
        </div>
      </div>
    );
  }

  const currentGasUrl = selectedArea === 'All Cabang' ? 'HQ' : (AREA_URLS[selectedArea] || '');
  const spreadsheetReady = selectedArea === 'All Cabang' || Boolean(AREA_URLS[selectedArea]);

  if (!spreadsheetReady) {
    return (
      <div className="empty-state-page">
        <div className="empty-state-card">
          <h2 className="text-xl font-bold text-slate-900 mb-2">Konfigurasi area belum tersedia</h2>
          <p className="text-slate-500 mb-6">URL sistem untuk area <strong>{selectedArea}</strong> belum dikonfigurasi.</p>
          <button
            type="button"
            onClick={() => handleAreaChange('All Cabang')}
            className="secondary-action w-full"
          >
            Kembali ke All Cabang
          </button>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <Dashboard
        gasUrl={currentGasUrl}
        area={selectedArea}
        onAreaChange={activeSession.permissions.canSwitchArea ? handleAreaChange : undefined}
        onLogout={handleLogout}
        userRole={activeSession.allowedArea}
        activeUsername={activeSession.username}
        session={activeSession}
      />
    </ToastProvider>
  );
}
