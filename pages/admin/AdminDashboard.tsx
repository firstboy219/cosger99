
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
  LayoutDashboard, Fingerprint, Clock, CloudLightning, FileCode, Server, Copy, Check, Code, ScanLine, ArrowDown, ArrowUp, Activity, ShieldAlert, Zap, Wrench, ExternalLink, Settings, ShieldQuestion, PlayCircle, X, ArrowRight, HardDrive, Wifi
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface RealUser {
    id: string;
    username: string;
    email: string;
    role: string;
    status: string;
    last_login?: string;
    total_debt?: number;
    totalDebt?: number;
    total_income?: number;
    totalIncome?: number;
    dsr?: number;
    monthly_obligation?: number;
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

  const [syncLogs, setSyncLogs] = useState<LogItem[]>([]);
  const [selectedLog, setSelectedLog] = useState<LogItem | null>(null);

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
                     last_login: u.lastLogin, 
                     total_debt: data.debts.reduce((a, b) => a + (b.remainingPrincipal || 0), 0),
                     total_income: data.incomes.reduce((a, b) => a + (b.amount || 0), 0),
                     monthly_obligation: data.debts.reduce((a, b) => a + (b.monthlyPayment || 0), 0)
                 };
              });
          }
          
          setUsers(userData);
          const totalDebt = userData.reduce((acc: number, u: any) => acc + (Number(u.total_debt || u.totalDebt) || 0), 0);
          const totalIncome = userData.reduce((acc: number, u: any) => acc + (Number(u.total_income || u.totalIncome) || 0), 0);
          const active = userData.filter((u: any) => u.status === 'active').length;
          const risky = userData.filter((u: any) => {
              const debt = Number(u.monthly_obligation || u.monthlyObligation) || 0;
              const inc = Number(u.total_income || u.totalIncome) || 1; 
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
          const res = await fetch(`${baseUrl}/api/diagnostic`, { mode: 'cors' });
          if (res.ok) {
              const data = await res.json();
              updateStep('db_link', 'success', `Cloud SQL OK. ${Object.keys(data.schema || {}).length} tabel aktif.`);
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
    const interval = setInterval(() => {
        const logs = getLogs();
        setSyncLogs(logs.filter(l => l.category === 'System' && (l.action.includes('DB Read') || l.action.includes('DB Write'))));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
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
             <button onClick={fetchData} className="px-5 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold flex items-center gap-2 hover:bg-slate-50 transition shadow-sm">
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Sync
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
          <div className="bg-black rounded-[2rem] border border-slate-800 shadow-2xl overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                      <Terminal size={18} className="text-green-500 animate-pulse" />
                      <h3 className="font-bold text-xs text-green-400 font-mono tracking-widest uppercase">Traffic Protocol Analyzer</h3>
                  </div>
                  <div className="flex gap-1"><div className="w-1.5 h-1.5 rounded-full bg-red-500/20"></div><div className="w-1.5 h-1.5 rounded-full bg-green-500/20"></div></div>
              </div>
              <div className="flex-1 flex overflow-hidden">
                  <div className="w-1/3 border-r border-slate-800 overflow-y-auto custom-scrollbar bg-slate-900/50">
                      {syncLogs.length === 0 ? <div className="p-8 text-center text-slate-600 text-[10px] font-mono uppercase tracking-widest">Awaiting traffic...</div> : syncLogs.map(log => (
                          <div key={log.id} onClick={() => setSelectedLog(log)} className={`p-4 border-b border-slate-800 cursor-pointer hover:bg-slate-800 transition ${selectedLog?.id === log.id ? 'bg-slate-800 border-l-4 border-l-green-500' : ''}`}>
                              <div className="flex justify-between items-center mb-1.5">
                                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter ${log.action.includes('Write') ? 'bg-blue-900 text-blue-300' : 'bg-green-900 text-green-300'}`}>
                                      {log.action.includes('Write') ? 'PUSH_TX' : 'PULL_REQ'}
                                  </span>
                                  <span className="text-[9px] text-slate-500 font-mono">{new Date(log.timestamp).toLocaleTimeString()}</span>
                              </div>
                              <div className="text-[10px] text-slate-300 font-mono truncate">{log.action}</div>
                          </div>
                      ))}
                  </div>
                  <div className="w-2/3 bg-black p-6 overflow-auto custom-scrollbar">
                      {selectedLog ? (
                          <div className="font-mono text-[11px] leading-relaxed">
                              <div className="mb-6 pb-3 border-b border-slate-800 flex justify-between items-start">
                                  <div>
                                    <span className="text-slate-500 block mb-1 uppercase text-[9px] font-black tracking-widest">Transaction Hash</span>
                                    <span className="text-white font-bold text-xs">{selectedLog.id}</span>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-slate-500 block mb-1 uppercase text-[9px] font-black tracking-widest">Origin</span>
                                    <span className="text-green-500 font-bold">{selectedLog.username}</span>
                                  </div>
                              </div>
                              <div className="text-green-400 whitespace-pre-wrap">{selectedLog.details}</div>
                          </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-800 text-center px-10">
                            <ScanLine size={48} className="mb-4 opacity-10 animate-pulse"/>
                            <p className="font-mono text-[10px] uppercase tracking-[0.3em] opacity-30 italic">Initialize analyzer scan...</p>
                        </div>
                      )}
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
}
