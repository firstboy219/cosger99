
import React, { useEffect, useState } from 'react';
import { getConfig, getAllUsers, getUserData } from '../../services/mockDb';
import { formatCurrency } from '../../services/financeUtils';
import { getLogs } from '../../services/activityLogger';
import { LogItem } from '../../types';
import BackendHealthCheck from './BackendHealthCheck';
import { 
  Users, DollarSign, TrendingUp, AlertTriangle, Database, 
  RefreshCw, Search, CheckCircle2, 
  Terminal, AlertCircle, WifiOff, UserCheck, 
  LayoutDashboard, Fingerprint, Clock, CloudLightning, FileCode, Server, Copy, Check, Code, ScanLine, ArrowDown, ArrowUp, Activity, ShieldAlert, Zap, Wrench, ExternalLink, Settings, ShieldQuestion, PlayCircle, X, ArrowRight, HardDrive, Wifi, Eye, ArrowUpRight, ArrowDownLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface RealUser {
    id: string;
    username: string;
    email: string;
    role: string;
    status: string;
    lastLogin?: string;
    totalDebt?: number;
    totalIncome?: number;
    dsr?: number;
    monthlyObligation?: number;
}

interface DiagnosticStep {
    id: string;
    label: string;
    status: 'pending' | 'running' | 'success' | 'error';
    message?: string;
    fixAction?: () => void;
    fixLabel?: string;
}

interface NetworkLog {
    id: string;
    timestamp: Date;
    method: string;
    url: string;
    status: number;
    response: any;
    payload?: any;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<RealUser[]>([]);
  const [isCloudActive, setIsCloudActive] = useState(false);
  const [connDetail, setConnDetail] = useState('Checking Handshake...');
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalSystemDebt: 0,
    totalSystemIncome: 0,
    riskUsers: 0
  });

  const [lastSynced, setLastSynced] = useState<string>("");
  const [diagError, setDiagError] = useState<string | null>(null);
  
  const [showSmartDiag, setShowSmartDiag] = useState(false);
  const [diagSteps, setDiagSteps] = useState<DiagnosticStep[]>([]);
  const [isDiagRunning, setIsDiagRunning] = useState(false);

  // REAL TIME LOGS (For Widget Only, Toast is Global now)
  const [networkLogs, setNetworkLogs] = useState<NetworkLog[]>([]);
  const [selectedNetworkLog, setSelectedNetworkLog] = useState<NetworkLog | null>(null);

  // --- TIME SYNC STATE ---
  const [localTime, setLocalTime] = useState<Date>(new Date());
  const [serverTime, setServerTime] = useState<string | null>(null);
  const [isTimeSyncing, setIsTimeSyncing] = useState(false);

  const fetchServerTime = async () => {
      setIsTimeSyncing(true);
      const config = getConfig();
      const baseUrl = config.backendUrl?.replace(/\/$/, '') || 'https://api.cosger.online';
      
      try {
          // Try specific time endpoint first
          const res = await fetch(`${baseUrl}/api/admin/server-time`, { mode: 'cors' });
          if (res.ok) {
              const data = await res.json();
              if (data.serverTime) {
                  setServerTime(data.serverTime);
              } else if (data.iso) {
                  setServerTime(data.iso);
              }
          } else {
              // Fallback: Use Response Header
              const healthRes = await fetch(`${baseUrl}/api/health`, { mode: 'cors' });
              const dateHeader = healthRes.headers.get('date');
              if (dateHeader) {
                  setServerTime(new Date(dateHeader).toISOString());
              } else {
                  setServerTime(null);
              }
          }
      } catch (e) {
          setServerTime(null);
      } finally {
          setIsTimeSyncing(false);
      }
  };

  useEffect(() => {
      // Local Clock Tick
      const timer = setInterval(() => setLocalTime(new Date()), 1000);
      
      // Fetch Server Time on Mount
      fetchServerTime();

      return () => clearInterval(timer);
  }, []);

  const fetchData = async () => {
      setLoading(true);
      setDiagError(null); 
      
      try {
          const config = getConfig();
          const baseUrl = config.backendUrl?.replace(/\/$/, '') || 'https://api.cosger.online';
          
          let userData: any[] = [];
          let isCloudSuccessful = false;

          try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 10000); 

              const userRes = await fetch(`${baseUrl}/api/admin/users`, { 
                  signal: controller.signal,
                  mode: 'cors'
              });
              clearTimeout(timeoutId);

              if (userRes.ok) {
                  userData = await userRes.json();
                  isCloudSuccessful = true;
                  setIsCloudActive(true); 
                  setConnDetail('Backend Synced Successfully');
              } else {
                  throw new Error(`HTTP Error ${userRes.status}`);
              }
          } catch (cloudErr: any) {
              console.warn("[CLOUD] Sync failed:", cloudErr.message);
              setDiagError(cloudErr.message);
              setIsCloudActive(false);
              setConnDetail(`Offline: ${cloudErr.message === 'Failed to fetch' ? 'CORS Error or Server Down' : cloudErr.message}`);
          }

          if (!isCloudSuccessful) {
              const localUsers = getAllUsers() || [];
              userData = localUsers.map((u: any) => {
                 const data = getUserData(u.id);
                 return {
                     ...u,
                     lastLogin: u.lastLogin, 
                     totalDebt: data.debts.reduce((a, b) => a + (b.remainingPrincipal || 0), 0),
                     totalIncome: data.incomes.reduce((a, b) => a + (b.amount || 0), 0),
                     monthlyObligation: data.debts.reduce((a, b) => a + (b.monthlyPayment || 0), 0)
                 };
              });
          }
          
          setUsers(userData);
          // Strictly use camelCase properties
          const totalDebt = userData.reduce((acc: number, u: any) => acc + (Number(u.totalDebt) || 0), 0);
          const totalIncome = userData.reduce((acc: number, u: any) => acc + (Number(u.totalIncome) || 0), 0);
          const active = userData.filter((u: any) => u.status === 'active').length;
          const risky = userData.filter((u: any) => {
              const debt = Number(u.monthlyObligation) || 0;
              const inc = Number(u.totalIncome) || 1; 
              return (debt / inc) * 100 > 50;
          }).length;

          setStats({ totalUsers: userData.length, activeUsers: active, totalSystemDebt: totalDebt, totalSystemIncome: totalIncome, riskUsers: risky });
          setLastSynced(new Date().toLocaleTimeString());
          
      } catch (e: any) {
          setDiagError(`Fatal Dashboard Failure: ${e.message}`);
          setIsCloudActive(false);
      } finally {
          setLoading(false);
      }
  };

  const runSmartDiagnostic = async () => {
      setIsDiagRunning(true);
      setShowSmartDiag(true);
      const config = getConfig();
      const baseUrl = config.backendUrl?.replace(/\/$/, '') || 'https://api.cosger.online';
      
      const initialSteps: DiagnosticStep[] = [
          { id: 'conf', label: 'Verifikasi URL Target', status: 'running' },
          { id: 'handshake', label: 'Handshake Health Check', status: 'pending' },
          { id: 'db_link', label: 'Database Logic Probe', status: 'pending' }
      ];
      setDiagSteps(initialSteps);

      await new Promise(r => setTimeout(r, 800));
      updateStep('conf', 'success', `Targeting: ${baseUrl}`);

      updateStep('handshake', 'running');
      try {
          const res = await fetch(`${baseUrl}/api/health`, { mode: 'cors' });
          if (!res.ok) throw new Error("Status API " + res.status);
          updateStep('handshake', 'success', 'Server Backend Terdeteksi');
      } catch (e: any) {
          updateStep('handshake', 'error', 'Gagal terhubung. Cek koneksi internet atau CORS backend.', () => window.open(baseUrl + '/api/health'), 'Tes Manual');
          setIsDiagRunning(false); return;
      }

      updateStep('db_link', 'running');
      try {
          // CORRECTED: Use plural 'diagnostics' as per backend standard
          const res = await fetch(`${baseUrl}/api/diagnostics`, { mode: 'cors' });
          if (res.ok) {
              const data = await res.json();
              updateStep('db_link', 'success', `Cloud SQL OK. ${Object.keys(data.schema || data.tables || {}).length} tabel aktif.`);
              setIsCloudActive(true);
          } else throw new Error("Status " + res.status);
      } catch (e: any) {
          updateStep('db_link', 'error', `Tabel tidak terdeteksi: ${e.message}`, () => navigate('/admin/database'), 'Audit DB');
          setIsCloudActive(false);
      }
      setIsDiagRunning(false);
  };

  const updateStep = (id: string, status: DiagnosticStep['status'], message?: string, fixAction?: () => void, fixLabel?: string) => {
      setDiagSteps(prev => prev.map(s => s.id === id ? { ...s, status, message, fixAction, fixLabel } : s));
  };

  useEffect(() => {
    fetchData();
    
    // LISTENER FOR LIVE TRAFFIC WIDGET
    const handleNetworkLog = (e: Event) => {
        const detail = (e as CustomEvent).detail;
        const newLog: NetworkLog = {
            id: `net-${Date.now()}-${Math.random()}`,
            ...detail
        };
        setNetworkLogs(prev => [newLog, ...prev.slice(0, 49)]); // Keep last 50
    };

    window.addEventListener('PAYDONE_API_RESPONSE', handleNetworkLog);
    return () => window.removeEventListener('PAYDONE_API_RESPONSE', handleNetworkLog);
  }, []);

  return (
    <div className="space-y-6">
      
      {/* RAW RESPONSE MODAL FOR WIDGET INTERACTION (SPLIT VIEW) */}
      {selectedNetworkLog && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-slate-900 rounded-[2rem] w-full max-w-5xl shadow-2xl border border-slate-700 flex flex-col h-[85vh] overflow-hidden">
                  <div className="p-6 border-b border-slate-800 bg-black/20 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                          <div className={`px-3 py-1 rounded-lg text-xs font-black uppercase ${selectedNetworkLog.method === 'GET' ? 'bg-blue-600 text-white' : 'bg-orange-600 text-white'}`}>{selectedNetworkLog.method}</div>
                          <div className="text-sm font-mono text-slate-300">{selectedNetworkLog.url}</div>
                      </div>
                      <button onClick={() => setSelectedNetworkLog(null)} className="text-slate-500 hover:text-white transition"><X size={24}/></button>
                  </div>
                  
                  <div className="flex-1 flex overflow-hidden">
                      {/* LEFT: REQUEST PAYLOAD */}
                      <div className="flex-1 border-r border-slate-800 bg-slate-950 flex flex-col min-w-0">
                          <div className="p-3 border-b border-slate-800 flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-widest bg-slate-900/50">
                              <ArrowUpRight size={14}/> Request Payload
                          </div>
                          <div className="flex-1 overflow-auto p-6 custom-scrollbar font-mono text-xs text-blue-300 bg-slate-950">
                              {selectedNetworkLog.payload ? (
                                  <pre className="whitespace-pre-wrap">{JSON.stringify(selectedNetworkLog.payload, null, 2)}</pre>
                              ) : (
                                  <div className="text-slate-600 italic">// No payload (GET Request)</div>
                              )}
                          </div>
                      </div>

                      {/* RIGHT: RESPONSE BODY */}
                      <div className="flex-1 bg-black flex flex-col min-w-0">
                          <div className="p-3 border-b border-slate-800 flex items-center gap-2 text-xs font-bold text-green-400 uppercase tracking-widest bg-slate-900/50">
                              <ArrowDownLeft size={14}/> Server Response
                          </div>
                          <div className="flex-1 overflow-auto p-6 custom-scrollbar font-mono text-xs text-green-400 bg-black">
                              <pre className="whitespace-pre-wrap">{JSON.stringify(selectedNetworkLog.response, null, 2)}</pre>
                          </div>
                      </div>
                  </div>

                  <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
                      <button onClick={() => { navigator.clipboard.writeText(JSON.stringify(selectedNetworkLog, null, 2)); alert("Copied Full Log!"); }} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 text-xs font-bold uppercase transition">
                          <Copy size={14}/> Copy Full Log
                      </button>
                  </div>
              </div>
          </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                <LayoutDashboard className="text-brand-600" size={32} />
                Admin Cockpit <span className="text-brand-600">V15.3</span>
            </h2>
            <div className="flex items-center gap-3 mt-1">
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${isCloudActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {isCloudActive ? <Wifi size={12}/> : <WifiOff size={12}/>}
                    {isCloudActive ? 'Cloud Live' : 'Disconnected'}
                </div>
                <p className="text-slate-500 text-xs font-medium border-l pl-3">
                    {connDetail} • Sync: {lastSynced || 'Never'}
                </p>
            </div>
          </div>
          <div className="flex gap-2">
             <button onClick={() => { fetchData(); fetchServerTime(); }} className="px-5 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold flex items-center gap-2 hover:bg-slate-50 transition shadow-sm">
                <RefreshCw size={14} className={loading || isTimeSyncing ? 'animate-spin' : ''} /> Refresh Sync
             </button>
             <button 
                onClick={runSmartDiagnostic}
                className={`px-5 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition shadow-lg border ${
                    !isCloudActive ? 'bg-red-600 text-white border-red-700' : 'bg-slate-900 text-white border-slate-950'
                }`}
             >
                <div className={`w-2 h-2 rounded-full ${isCloudActive ? 'bg-green-400' : 'bg-white animate-pulse'}`}></div>
                {!isCloudActive ? 'Deep Repair Connection' : 'System Guard Online'}
             </button>
          </div>
      </div>

      {/* TIME SYNCHRONIZATION MONITOR */}
      <div className="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <Clock size={24}/>
              </div>
              <div>
                  <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wide">Time Synchronization</h3>
                  <p className="text-xs text-slate-500 mt-1">Comparing Client (Frontend) vs Server (Backend) Datetime</p>
              </div>
          </div>
          
          <div className="flex flex-1 w-full md:w-auto items-center gap-2 md:gap-8 justify-between md:justify-end">
              {/* Frontend Time */}
              <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Frontend (Local)</p>
                  <p className="text-xl font-mono font-bold text-slate-800">
                      {localTime.toLocaleTimeString([], { hour12: false })}
                  </p>
                  <p className="text-[9px] text-slate-400 font-mono">
                      {localTime.toLocaleDateString()}
                  </p>
              </div>

              {/* Status Indicator */}
              <div className="flex flex-col items-center px-4">
                  {serverTime ? (
                      Math.abs(new Date(serverTime).getTime() - localTime.getTime()) < 60000 
                          ? <CheckCircle2 size={20} className="text-green-500"/>
                          : <AlertTriangle size={20} className="text-amber-500"/>
                  ) : (
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                  )}
                  <div className="h-px w-10 bg-slate-200 my-2"></div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase">
                      {serverTime 
                          ? `${Math.abs(Math.round((new Date(serverTime).getTime() - localTime.getTime()) / 1000))}s Diff` 
                          : 'No Signal'}
                  </span>
              </div>

              {/* Backend Time */}
              <div className="text-left">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Backend (Server)</p>
                  {serverTime ? (
                      <>
                          <p className="text-xl font-mono font-bold text-indigo-600">
                              {new Date(serverTime).toLocaleTimeString([], { hour12: false })}
                          </p>
                          <p className="text-[9px] text-slate-400 font-mono">
                              {new Date(serverTime).toLocaleDateString()}
                          </p>
                      </>
                  ) : (
                      <p className="text-sm font-bold text-red-400 flex items-center gap-1">
                          <WifiOff size={14}/> Offline
                      </p>
                  )}
              </div>
          </div>
      </div>

      {showSmartDiag && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 animate-fade-in">
              <div className="bg-white rounded-[3rem] w-full max-w-xl shadow-2xl overflow-hidden flex flex-col border border-white/20">
                  <div className="bg-slate-950 p-10 flex justify-between items-start text-white relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-8 opacity-10"><ShieldQuestion size={150}/></div>
                      <div className="relative z-10">
                          <h3 className="text-3xl font-black tracking-tight flex items-center gap-4">
                              <ShieldAlert size={32} className="text-amber-400"/> Handshake Audit
                          </h3>
                          <p className="text-slate-400 text-sm mt-3 leading-relaxed">Pemeriksaan mendalam jalur komunikasi ke <br/><strong>api.cosger.online</strong></p>
                      </div>
                      <button onClick={() => setShowSmartDiag(false)} className="p-3 bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white rounded-full transition-all relative z-20"><X size={28}/></button>
                  </div>
                  <div className="p-10 space-y-6">
                      {diagSteps.map((step) => (
                          <div key={step.id} className={`p-5 rounded-3xl border transition-all ${step.status === 'success' ? 'bg-green-50 border-green-200' : step.status === 'error' ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100'}`}>
                              <div className="flex justify-between items-center">
                                  <div className="flex items-center gap-4">
                                      <div className={`p-2 rounded-xl bg-white shadow-sm border ${step.status === 'success' ? 'text-green-600 border-green-100' : step.status === 'error' ? 'text-red-600 border-red-100' : 'text-slate-300 border-slate-100'}`}>
                                          {step.status === 'running' && <RefreshCw size={20} className="animate-spin text-blue-500"/>}
                                          {step.status === 'success' && <CheckCircle2 size={20}/>}
                                          {step.status === 'error' && <AlertCircle size={20}/>}
                                          {step.status === 'pending' && <Clock size={20}/>}
                                      </div>
                                      <span className={`font-black text-sm uppercase tracking-wider ${step.status === 'error' ? 'text-red-900' : 'text-slate-700'}`}>{step.label}</span>
                                  </div>
                              </div>
                              {step.message && (
                                  <div className="mt-4 pl-14">
                                      <p className={`text-xs mb-4 font-medium ${step.status === 'error' ? 'text-red-700' : 'text-slate-500'}`}>{step.message}</p>
                                      {step.fixAction && (
                                          <button onClick={() => { setShowSmartDiag(false); step.fixAction?.(); }} className="px-5 py-2.5 bg-slate-900 text-white text-[10px] font-black uppercase rounded-xl tracking-widest shadow-xl transform active:scale-95 transition">
                                              <Wrench size={14} className="inline mr-2"/> {step.fixLabel}
                                          </button>
                                      )}
                                  </div>
                              )}
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-[2rem] border shadow-sm flex flex-col justify-between hover:border-brand-300 transition group">
              <div className="flex justify-between items-start">
                  <div><p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">User Ecosystem</p><h3 className="text-3xl font-black text-slate-900">{stats.totalUsers}</h3></div>
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl group-hover:scale-110 transition shadow-sm"><Users size={24}/></div>
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-[10px] font-black uppercase text-green-600 bg-green-50 px-3 py-1.5 rounded-xl w-fit border border-green-100"><UserCheck size={14} /> {stats.activeUsers} Active Nodes</div>
          </div>
          <div className="bg-white p-6 rounded-[2rem] border shadow-sm flex flex-col justify-between hover:border-red-300 transition group">
              <div className="flex justify-between items-start">
                  <div><p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Liability Exposure</p><h3 className="text-3xl font-black text-slate-900">{formatCurrency(stats.totalSystemDebt)}</h3></div>
                  <div className="p-3 bg-red-50 text-red-600 rounded-2xl group-hover:scale-110 transition shadow-sm"><TrendingUp size={24}/></div>
              </div>
              <div className="mt-4 text-[10px] text-slate-500 font-bold uppercase tracking-wider">Aggregated Cloud Debt</div>
          </div>
          <div className="bg-white p-6 rounded-[2rem] border shadow-sm flex flex-col justify-between hover:border-green-300 transition group">
              <div className="flex justify-between items-start">
                  <div><p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Global Cashflow</p><h3 className="text-3xl font-black text-slate-900">{formatCurrency(stats.totalSystemIncome)}</h3></div>
                  <div className="p-3 bg-green-50 text-green-600 rounded-2xl group-hover:scale-110 transition shadow-sm"><DollarSign size={24}/></div>
              </div>
              <div className="mt-4 text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Monthly Velocity</div>
          </div>
          <div className="bg-white p-6 rounded-[2rem] border shadow-sm flex flex-col justify-between hover:border-orange-300 transition group">
              <div className="flex justify-between items-start">
                  <div><p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Stability Risk</p><h3 className="text-3xl font-black text-slate-900">{stats.riskUsers}</h3></div>
                  <div className="p-3 bg-orange-50 text-orange-600 rounded-2xl group-hover:scale-110 transition shadow-sm"><AlertTriangle size={24}/></div>
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-[10px] font-black uppercase text-red-600 bg-red-50 px-3 py-1.5 rounded-xl w-fit border border-red-100"><Fingerprint size={14}/> High DSR Accounts</div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[400px]">
          <BackendHealthCheck />
          
          {/* TRAFFIC ANALYZER WITH LIVE FEED */}
          <div className="bg-black rounded-[2rem] border border-slate-800 shadow-2xl overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                      <Terminal size={18} className="text-green-500 animate-pulse" />
                      <h3 className="font-bold text-xs text-green-400 font-mono tracking-widest uppercase">Traffic Protocol Analyzer</h3>
                  </div>
                  <div className="flex gap-2">
                      <span className="text-[9px] text-slate-500 font-mono">{networkLogs.length} Events</span>
                      <div className="flex gap-1"><div className="w-1.5 h-1.5 rounded-full bg-red-500/20"></div><div className="w-1.5 h-1.5 rounded-full bg-green-500/20"></div></div>
                  </div>
              </div>
              <div className="flex-1 flex overflow-hidden">
                  <div className="w-1/3 border-r border-slate-800 overflow-y-auto custom-scrollbar bg-slate-900/50">
                      {networkLogs.length === 0 ? <div className="p-8 text-center text-slate-600 text-[10px] font-mono uppercase tracking-widest">Awaiting traffic...</div> : networkLogs.map(log => (
                          <div key={log.id} onClick={() => setSelectedNetworkLog(log)} className={`p-3 border-b border-slate-800 cursor-pointer hover:bg-slate-800 transition ${selectedNetworkLog?.id === log.id ? 'bg-slate-800 border-l-2 border-l-green-500' : ''}`}>
                              <div className="flex justify-between items-center mb-1">
                                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter ${log.method === 'GET' ? 'bg-blue-900 text-blue-300' : log.method === 'DELETE' ? 'bg-red-900 text-red-300' : 'bg-orange-900 text-orange-300'}`}>
                                      {log.method}
                                  </span>
                                  <span className={`text-[9px] font-mono ${log.status === 200 ? 'text-green-500' : 'text-red-500'}`}>{log.status}</span>
                              </div>
                              <div className="text-[9px] text-slate-400 font-mono truncate" title={log.url}>{log.url.split('/api')[1] || log.url}</div>
                              <div className="text-[8px] text-slate-600 mt-1 text-right">{log.timestamp.toLocaleTimeString()}</div>
                          </div>
                      ))}
                  </div>
                  <div className="w-2/3 bg-black p-6 overflow-auto custom-scrollbar">
                      {selectedNetworkLog ? (
                          <div className="font-mono text-[11px] leading-relaxed space-y-4">
                              <div className="pb-3 border-b border-slate-800 flex justify-between items-start">
                                  <div>
                                    <span className="text-slate-500 block mb-1 uppercase text-[9px] font-black tracking-widest">Endpoint</span>
                                    <span className="text-white font-bold text-xs break-all">{selectedNetworkLog.url}</span>
                                  </div>
                              </div>
                              {selectedNetworkLog.payload && (
                                  <div>
                                      <span className="text-blue-500 block mb-1 uppercase text-[9px] font-black tracking-widest">Payload Sent</span>
                                      <div className="text-blue-300 whitespace-pre-wrap">{JSON.stringify(selectedNetworkLog.payload, null, 2)}</div>
                                  </div>
                              )}
                              <div>
                                  <span className="text-green-500 block mb-1 uppercase text-[9px] font-black tracking-widest">Response</span>
                                  <div className="text-green-400 whitespace-pre-wrap">{JSON.stringify(selectedNetworkLog.response, null, 2)}</div>
                              </div>
                          </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-800 text-center px-10">
                            <ScanLine size={48} className="mb-4 opacity-10 animate-pulse"/>
                            <p className="font-mono text-[10px] uppercase tracking-[0.3em] opacity-30 italic">Select a packet to inspect payload...</p>
                        </div>
                      )}
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
}
