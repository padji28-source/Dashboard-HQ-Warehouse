import { useEffect, useState } from 'react';
import { collection, query, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Users, Clock, ShieldCheck, MapPin, Monitor, Smartphone, Globe, Info } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { ADMIN_ACCOUNTS } from '../App';

interface ActiveUser {
  id: string;
  username: string;
  role: string;
  area: string;
  lastActive: Timestamp | null;
  loginTime?: Timestamp | null;
  status?: string;
  browser?: string;
  device?: string;
}

export default function ActiveUsersMonitor() {
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const q = query(collection(db, 'activeUsers'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users: ActiveUser[] = [];
      snapshot.forEach((doc) => {
        users.push({ id: doc.id, ...doc.data() } as ActiveUser);
      });
      setActiveUsers(users);
    });

    const timer = setInterval(() => setCurrentTime(Date.now()), 5000);

    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, []);

  const getStatusInfo = (user: ActiveUser | undefined) => {
    if (!user || user.status === 'Offline') return { text: 'Offline', color: 'bg-slate-400' };

    const lastActive = user.lastActive;
    if (!lastActive) return { text: 'Offline', color: 'bg-slate-400' };
    
    const diff = (currentTime - lastActive.toMillis()) / 1000;
    
    if (diff > 30 * 60) return { text: 'Offline', color: 'bg-rose-500' };
    if (user.status === 'Idle' || diff > 300) return { text: 'Idle', color: 'bg-amber-400' };
    
    return { text: 'Online', color: 'bg-emerald-500' };
  };

  // Map predefined accounts to their active states
  const allUsersList = ADMIN_ACCOUNTS.map(account => {
    // Find if this account is currently active by matching username
    // Note: If multiple sessions exist for the same username, take the most recently active one
    const sessions = activeUsers.filter(u => u.username === account.username);
    const activeSession = sessions.sort((a, b) => {
      const timeA = a.lastActive?.toMillis() || 0;
      const timeB = b.lastActive?.toMillis() || 0;
      return timeB - timeA;
    })[0];

    const statusInfo = getStatusInfo(activeSession);

    return {
      account,
      activeSession,
      statusInfo,
      sortValue: statusInfo.text === 'Online' ? 3 : statusInfo.text === 'Idle' ? 2 : 1
    };
  }).sort((a, b) => {
    if (a.sortValue !== b.sortValue) {
      return b.sortValue - a.sortValue; // Online first, then Idle, then Offline
    }
    const timeA = a.activeSession?.loginTime?.toMillis() || 0;
    const timeB = b.activeSession?.loginTime?.toMillis() || 0;
    return timeB - timeA;
  });

  const getRelativeTime = (timestamp: Timestamp | null | undefined) => {
    if (!timestamp) return '-';
    try {
      return formatDistanceToNow(timestamp.toMillis(), { addSuffix: true, locale: localeId });
    } catch {
      return '-';
    }
  };

  const onlineCount = allUsersList.filter(u => u.statusInfo.text === 'Online' || u.statusInfo.text === 'Idle').length;

  return (
    <div className="p-4 sm:p-6 bg-slate-50 min-h-full">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            Monitor Pengguna (Semua)
            <span className="bg-blue-100 text-blue-700 text-sm py-0.5 px-2.5 rounded-full font-bold ml-2">
              {onlineCount} Online
            </span>
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Pantau sesi login semua pengguna aplikasi WMS.
          </p>
        </div>
        
        <div className="flex gap-4 text-xs font-medium text-slate-600 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Online
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span> Idle ({'>'} 5m)
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-400"></span> Offline
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {allUsersList.map(item => {
          const { account, activeSession, statusInfo } = item;
          
          return (
            <div key={account.username} className={`bg-white rounded-xl border shadow-sm p-5 hover:shadow-md transition-shadow relative overflow-hidden ${statusInfo.text === 'Offline' ? 'border-slate-200 opacity-75' : 'border-slate-200'}`}>
              {/* Decorative top border */}
              <div className={`absolute top-0 left-0 w-full h-1 ${statusInfo.color}`}></div>
              
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold uppercase shrink-0 ${statusInfo.text === 'Offline' ? 'bg-slate-100 text-slate-400 border border-slate-200' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>
                    {account.username.substring(0, 2)}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 leading-tight">{account.username}</h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="flex h-2 w-2 relative">
                        {statusInfo.text === 'Online' && (
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        )}
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${statusInfo.color}`}></span>
                      </span>
                      <span className={`text-xs font-semibold ${statusInfo.text === 'Idle' ? 'text-amber-600' : statusInfo.text === 'Offline' ? 'text-slate-400' : 'text-slate-500'}`}>
                        {statusInfo.text}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2.5 text-sm text-slate-600 bg-slate-50 p-3.5 rounded-lg border border-slate-100">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-medium text-slate-700">{account.label}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-slate-700">Area: <span className="font-medium">{account.allowedArea}</span></span>
                </div>
                
                {statusInfo.text !== 'Offline' ? (
                  <>
                    <div className="flex items-center gap-2">
                      <Info className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-xs">
                        Login: <span className="font-semibold text-slate-700">{activeSession?.loginTime ? new Date(activeSession.loginTime.toMillis()).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}</span>
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-xs">
                        Aktif: <span className="font-semibold text-slate-700">{getRelativeTime(activeSession?.lastActive)}</span>
                      </span>
                    </div>

                    {(activeSession?.device || activeSession?.browser) && (
                      <div className="pt-2 mt-2 border-t border-slate-200/60 flex items-center gap-4 text-xs text-slate-500">
                        <div className="flex items-center gap-1.5">
                          {activeSession?.device === 'Mobile' ? <Smartphone className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5" />}
                          <span>{activeSession?.device || 'Unknown'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5" />
                          <span>{activeSession?.browser || 'Unknown'}</span>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="pt-2 mt-2 border-t border-slate-200/60 text-xs text-slate-400 text-center italic">
                    Pengguna tidak aktif
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

