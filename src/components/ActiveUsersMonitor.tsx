import { useEffect, useState } from 'react';
import { collection, query, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Users, Clock, ShieldCheck, MapPin } from 'lucide-react';

interface ActiveUser {
  id: string;
  username: string;
  role: string;
  area: string;
  lastActive: Timestamp | null;
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

    const timer = setInterval(() => setCurrentTime(Date.now()), 5000); // update current time every 5s

    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, []);

  const getStatus = (lastActive: Timestamp | null) => {
    if (!lastActive) return { text: 'Unknown', color: 'bg-slate-500' };
    
    // Consider active if pinged in the last 60 seconds
    const diff = (currentTime - lastActive.toMillis()) / 1000;
    if (diff < 60) return { text: 'Online', color: 'bg-emerald-500' };
    if (diff < 300) return { text: 'Away', color: 'bg-amber-500' };
    return { text: 'Offline', color: 'bg-slate-400' };
  };

  const loggedInUsers = activeUsers.filter(user => {
    const status = getStatus(user.lastActive);
    return status.text !== 'Offline' && status.text !== 'Unknown';
  });

  return (
    <div className="p-4 sm:p-6 bg-slate-50 min-h-full">
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Users className="w-6 h-6 text-blue-600" />
          Monitor Pengguna Aktif
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Pantau sesi pengguna yang sedang login saat ini secara real-time.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loggedInUsers.length === 0 ? (
          <div className="col-span-full p-8 text-center bg-white rounded-xl border border-slate-200">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Tidak ada pengguna aktif saat ini.</p>
          </div>
        ) : (
          loggedInUsers.map(user => {
            const status = getStatus(user.lastActive);
            
            return (
              <div key={user.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 font-bold uppercase">
                      {user.username.substring(0, 2)}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 leading-tight">{user.username}</h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="flex h-2 w-2 relative">
                          {status.text === 'Online' && (
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          )}
                          <span className={`relative inline-flex rounded-full h-2 w-2 ${status.color}`}></span>
                        </span>
                        <span className="text-xs text-slate-500 font-medium">{status.text}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-medium text-slate-700">{user.role || 'User'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>Area: <span className="font-semibold text-slate-700">{user.area || 'All'}</span></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-xs">
                      Last ping: {user.lastActive ? new Date(user.lastActive.toMillis()).toLocaleTimeString() : '-'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
