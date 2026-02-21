
import React, { useEffect, useState } from 'react';
import { getLogs } from '../services/activityLogger';
import { LogItem } from '../types';
import { Clock, Shield, Zap, DollarSign, Activity, Search, Filter } from 'lucide-react';

export default function ActivityLogs({ userType }: { userType: 'user' | 'admin' }) {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const loadData = () => {
        const data = getLogs(userType === 'user' ? 'user' : undefined);
        setLogs(data);
    };

    loadData(); // Initial load

    // Listen for DB updates
    const handleDbUpdate = () => {
        loadData();
    };
    window.addEventListener('PAYDONE_DB_UPDATE', handleDbUpdate);
    return () => window.removeEventListener('PAYDONE_DB_UPDATE', handleDbUpdate);
  }, [userType]);

  const getIcon = (category: string) => {
    switch(category) {
      case 'AI': return <Zap size={16} className="text-amber-500" />;
      case 'Finance': return <DollarSign size={16} className="text-green-500" />;
      case 'Security': return <Shield size={16} className="text-red-500" />;
      default: return <Activity size={16} className="text-blue-500" />;
    }
  };

  const filteredLogs = logs.filter(log => 
    log.action.toLowerCase().includes(filter.toLowerCase()) || 
    log.details.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Riwayat Aktivitas</h2>
          <p className="text-slate-500 text-sm">Catatan tindakan yang dilakukan oleh {userType === 'admin' ? 'sistem dan pengguna' : 'akun Anda'}.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 flex gap-4 bg-slate-50">
           <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Cari aktivitas..."
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-brand-500"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
           </div>
           <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">
             <Filter size={16} /> Filter
           </button>
        </div>

        {/* List */}
        <div className="divide-y divide-slate-100">
          {filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
               <Clock size={48} className="mx-auto mb-4 opacity-50" />
               <p>Belum ada aktivitas tercatat.</p>
            </div>
          ) : (
            filteredLogs.map(log => (
              <div key={log.id} className="p-4 flex gap-4 hover:bg-slate-50 transition">
                 <div className="flex flex-col items-center gap-1 min-w-[60px]">
                    <span className="text-xs font-bold text-slate-500">
                      {new Date(log.timestamp).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(log.timestamp).toLocaleDateString('id-ID', {day: 'numeric', month:'short'})}
                    </span>
                 </div>
                 
                 <div className="p-2 h-fit bg-slate-100 rounded-full border border-slate-200">
                    {getIcon(log.category)}
                 </div>

                 <div className="flex-1">
                    <div className="flex justify-between items-start">
                       <h4 className="text-sm font-bold text-slate-900">{log.action}</h4>
                       <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                         log.category === 'AI' ? 'bg-amber-100 text-amber-700' :
                         log.category === 'Security' ? 'bg-red-100 text-red-700' :
                         log.category === 'Finance' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                       }`}>
                         {log.category}
                       </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">{log.details}</p>
                    {userType === 'admin' && (
                      <p className="text-xs text-slate-400 mt-1">User: <span className="font-mono">{log.username}</span></p>
                    )}
                 </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
