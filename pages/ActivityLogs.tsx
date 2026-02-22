
import React, { useEffect, useState } from 'react';
import { getLogs } from '../services/activityLogger';
import { getConfig } from '../services/mockDb';
import { LogItem } from '../types';
import { Clock, Shield, Zap, DollarSign, Activity, Search, Filter, ChevronDown, ChevronUp, CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';

export default function ActivityLogs({ userType }: { userType: 'user' | 'admin' }) {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [filter, setFilter] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // V50.21: Respect showDetailedLogsToUsers config
  const config = getConfig();
  const showDetails = userType === 'admin' || config.showDetailedLogsToUsers === true;

  useEffect(() => {
    const loadData = () => {
        const data = getLogs(userType === 'user' ? 'user' : undefined);
        setLogs(data);
    };

    loadData();

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

  const getStatusBadge = (status?: string) => {
    switch(status) {
      case 'success': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700"><CheckCircle2 size={10}/> Success</span>;
      case 'error': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700"><XCircle size={10}/> Error</span>;
      case 'warning': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700"><AlertTriangle size={10}/> Warning</span>;
      default: return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700"><Info size={10}/> Info</span>;
    }
  };

  // V50.21: Null-safe JSON renderer for payload/response (backend may redact these)
  const renderJsonSafe = (data: any) => {
    if (data === undefined || data === null) return <span className="text-slate-400 italic text-xs">{'[Redacted / Empty]'}</span>;
    try {
      const str = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      return <pre className="text-[11px] font-mono text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200 overflow-x-auto max-h-40 whitespace-pre-wrap">{str}</pre>;
    } catch {
      return <span className="text-slate-400 italic text-xs">{'[Unable to display]'}</span>;
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesText = log.action.toLowerCase().includes(filter.toLowerCase()) || 
      log.details.toLowerCase().includes(filter.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || log.category === categoryFilter;
    return matchesText && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Riwayat Aktivitas</h2>
          <p className="text-slate-500 text-sm">Catatan tindakan yang dilakukan oleh {userType === 'admin' ? 'sistem dan pengguna' : 'akun Anda'}.</p>
        </div>
        <div className="text-xs text-slate-400 font-medium">{filteredLogs.length} entri</div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 bg-slate-50">
           <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Cari aktivitas..."
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
           </div>
           <div className="flex gap-2">
             {['all', 'System', 'Finance', 'AI', 'Security'].map(cat => (
               <button 
                 key={cat} 
                 onClick={() => setCategoryFilter(cat)}
                 className={`px-3 py-2 rounded-lg text-xs font-semibold border transition ${
                   categoryFilter === cat 
                     ? 'bg-blue-600 text-white border-blue-600' 
                     : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                 }`}
               >
                 {cat === 'all' ? 'Semua' : cat}
               </button>
             ))}
           </div>
        </div>

        {/* List */}
        <div className="divide-y divide-slate-100">
          {filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
               <Clock size={48} className="mx-auto mb-4 opacity-50" />
               <p>Belum ada aktivitas tercatat.</p>
            </div>
          ) : (
            filteredLogs.map(log => {
              const isExpanded = expandedLogId === log.id;
              const hasPayloadOrResponse = log.payload !== undefined || log.response !== undefined;

              return (
                <div key={log.id} className="hover:bg-slate-50/50 transition">
                  <div className="p-4 flex gap-4">
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

                     <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                           <div className="flex items-center gap-2 flex-wrap">
                             <h4 className="text-sm font-bold text-slate-900">{log.action}</h4>
                             {log.status && getStatusBadge(log.status)}
                           </div>
                           <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase shrink-0 ${
                             log.category === 'AI' ? 'bg-amber-100 text-amber-700' :
                             log.category === 'Security' ? 'bg-red-100 text-red-700' :
                             log.category === 'Finance' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                           }`}>
                             {log.category}
                           </span>
                        </div>
                        <p className="text-sm text-slate-600 mt-1">{log.details}</p>
                        
                        <div className="flex items-center gap-3 mt-2">
                          {userType === 'admin' && (
                            <p className="text-xs text-slate-400">User: <span className="font-mono">{log.username}</span></p>
                          )}
                          {/* V50.21: Expandable detail section (only if config allows) */}
                          {showDetails && hasPayloadOrResponse && (
                            <button 
                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)} 
                              className="text-xs text-blue-600 font-semibold flex items-center gap-1 hover:underline"
                            >
                              {isExpanded ? <><ChevronUp size={12}/> Sembunyikan</> : <><ChevronDown size={12}/> Detail</>}
                            </button>
                          )}
                        </div>
                     </div>
                  </div>
                  
                  {/* V50.21: Expanded Detail Panel (null-safe) */}
                  {isExpanded && showDetails && (
                    <div className="px-4 pb-4 ml-[76px] space-y-3 animate-fade-in">
                      {log.payload !== undefined && (
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Request Payload</p>
                          {renderJsonSafe(log.payload)}
                        </div>
                      )}
                      {log.response !== undefined && (
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Response</p>
                          {renderJsonSafe(log.response)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
