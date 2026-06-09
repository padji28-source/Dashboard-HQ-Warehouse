import { useState, type FormEvent } from 'react';
import Dashboard from './components/Dashboard';
import { Loader2 } from 'lucide-react';

export const AREAS = [
  "HQ", "Jakarta", "Karawang", "Semarang", "Surabaya", "Jember", 
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
  "Karawang": "https://script.google.com/macros/s/AKfycbwKnLNG0uY5M5Npsj8CbPGfHdsyk7f2dltxgPl7XfV0-CrfyjDpjsnRiWt8nVVVerI3/exec",
  "Jakarta": "https://script.google.com/macros/s/AKfycbwgor6oSmZzRE0MaFN51B2YaiDJe8dtV3guKrGdZLY9gLdQgFsk4tANGGm1B1aQMdZUFw/exec",
};

export default function App() {
  const [appUsername, setAppUsername] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [selectedArea, setSelectedArea] = useState(() => localStorage.getItem('selectedArea') || AREAS[0]);
  const [appAuthenticated, setAppAuthenticated] = useState(false);
  const [currentGasUrl, setCurrentGasUrl] = useState('');
  const [spreadsheetReady, setSpreadsheetReady] = useState(false);

  const handleAppLogin = (e: FormEvent) => {
    e.preventDefault();
    if (appUsername === 'admin' && appPassword === 'admin123') {
      setAppAuthenticated(true);
      localStorage.setItem('selectedArea', selectedArea);
      const url = AREA_URLS[selectedArea] || '';
      setCurrentGasUrl(selectedArea === 'HQ' ? 'HQ' : url);
      setSpreadsheetReady(selectedArea === 'HQ' ? true : !!url);
    } else {
      alert('Username atau password salah!');
    }
  };

  const handleLogout = () => {
    setAppAuthenticated(false);
    setAppUsername('');
    setAppPassword('');
    setSpreadsheetReady(false);
  };

  // App Auth Flow (System level)
  if (!appAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden p-6 sm:p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">Dashboard HQ WH</h1>
            <p className="text-slate-500 text-sm">Warehouse Management System</p>
          </div>
          
          <form onSubmit={handleAppLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
              <input 
                type="text" 
                value={appUsername}
                onChange={e => setAppUsername(e.target.value)}
                required
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input 
                type="password" 
                value={appPassword}
                onChange={e => setAppPassword(e.target.value)}
                required
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Area</label>
              <select 
                value={selectedArea}
                onChange={e => setSelectedArea(e.target.value)}
                required
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                {AREAS.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <button 
              type="submit"
              className="w-full bg-slate-900 text-white font-medium py-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              Login
            </button>
          </form>
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

  return <Dashboard spreadsheetId={currentGasUrl} area={selectedArea} onLogout={handleLogout} />;
}

