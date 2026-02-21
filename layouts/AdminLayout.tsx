
import React, { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { ShieldCheck, Database, LogOut, Users, Settings, Briefcase, Server, Code, Rocket, RefreshCw, Wifi, WifiOff, History, LayoutDashboard, Terminal, Workflow, Ticket, ArrowLeftRight, Bot, Activity, Building2, DatabaseZap, Eye, X, Copy, ArrowUpRight, ArrowDownLeft, GitBranch } from 'lucide-react';
import { getConfig } from '../services/mockDb';

const SidebarItem = ({ to, icon: Icon, label, badge }: { to: string, icon: any, label: string, badge?: string }) => {
  return (
    <NavLink 
      to={to} 
      end={to === "/admin"}
      className={({ isActive }) => `group flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-200 mb-1 ${
        isActive 
          ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/20' 
          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon size={18} className="shrink-0" />
        <span className="font-medium text-sm">{label}</span>
      </div>
      {badge && (
        <span className="text-[10px] bg-brand-500/20 text-brand-400 px-1.5 py-0.5 rounded-md font-bold border border-brand-500/30">
          {badge}
        </span>
      )}
    </NavLink>
  );
};

interface NetworkLog {
    id: string;
    timestamp: Date;
    method: string;
    url: string;
    status: number;
    response: any;
    payload?: any; // Added Request Payload
}

export default function AdminLayout({ onLogout }: { onLogout: () => void }) {
  const [serverStatus, setServerStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  
  // GLOBAL TOAST STATE
  const [activeToast, setActiveToast] = useState<NetworkLog | null>(null);
  const [selectedNetworkLog, setSelectedNetworkLog] = useState<NetworkLog | null>(null);

  // REACTIVE CONFIG STATE
  const config = getConfig();
  const appName = config.appName || 'Paydone.id';
  const appLogo = config.appLogoUrl;

  const checkServerStatus = async () => {
    setServerStatus('checking');
    try {
      const config = getConfig();
      const baseUrl = config.backendUrl?.replace(/\/$/, '') || '';
      const url = `${baseUrl}/api/health`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (res.ok) setServerStatus('online');
      else setServerStatus('offline');
    } catch (e) {
      setServerStatus('offline');
    }
  };

  useEffect(() => {
    checkServerStatus();
    const interval = setInterval(checkServerStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // GLOBAL LISTENER FOR LIVE TRAFFIC
  useEffect(() => {
      const handleNetworkLog = (e: Event) => {
          const detail = (e as CustomEvent).detail;
          const newLog: NetworkLog = {
              id: `net-${Date.now()}-${Math.random()}`,
              ...detail
          };
          
          // Show Toast
          setActiveToast(newLog);
          setTimeout(() => setActiveToast(null), 5000); // 5 Seconds visibility
      };

      window.addEventListener('PAYDONE_API_RESPONSE', handleNetworkLog);
      return () => window.removeEventListener('PAYDONE_API_RESPONSE', handleNetworkLog);
  }, []);

  return (
    <div className="flex h-screen bg-[#f8fafc] text-slate-900 overflow-hidden font-sans">
      
      {/* Sidebar - Dark Professional Theme */}
      <aside className="w-72 bg-[#0f172a] border-r border-slate-800 flex flex-col z-30 shadow-2xl">
        <div className="h-20 flex items-center px-6 border-b border-slate-800/50">
          <div className="flex items-center gap-3">
            {appLogo ? (
                <img src={appLogo} alt="Logo" className="w-10 h-10 object-contain bg-white rounded-xl p-1 shadow-lg"/>
            ) : (
                <div className="bg-gradient-to-tr from-brand-500 to-indigo-600 p-2 rounded-xl shadow-lg">
                    <ShieldCheck className="h-6 w-6 text-white" />
                </div>
            )}
            <div>
              <h1 className="font-bold text-lg text-white tracking-tight leading-none">{appName} Admin</h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-widest">Internal Engine</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-8 overflow-y-auto custom-scrollbar">
          
          {/* Group: MONITORING */}
          <div>
            <h3 className="px-4 mb-3 text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Overview</h3>
            <div className="space-y-1">
                <SidebarItem to="/admin" icon={LayoutDashboard} label="Command Center" />
                <SidebarItem to="/admin/logs" icon={History} label="Activity Logs" />
                <SidebarItem to="/admin/tickets" icon={Ticket} label="Support Tickets" badge="AI" />
            </div>
          </div>

          {/* Group: BUSINESS & USERS */}
          <div>
            <h3 className="px-4 mb-3 text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Management</h3>
            <div className="space-y-1">
                <SidebarItem to="/admin/master" icon={Users} label="Users & Partners" />
                <SidebarItem to="/admin/ba" icon={Workflow} label="Business Logic" />
            </div>
          </div>

          {/* Group: ENGINE & CONFIG */}
          <div>
            <h3 className="px-4 mb-3 text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">System & AI</h3>
            <div className="space-y-1">
                <SidebarItem to="/admin/settings" icon={Settings} label="Global Settings" />
                <SidebarItem to="/admin/ai-center" icon={Bot} label="AI Neural Center" />
            </div>
          </div>
          
          {/* Group: DEVOPS */}
          <div>
            <h3 className="px-4 mb-3 text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Developer Console</h3>
            <div className="space-y-1">
                <SidebarItem to="/admin/git-deploy" icon={GitBranch} label="Git Deployment" badge="V47" />
                <SidebarItem to="/admin/terminal" icon={Terminal} label="Server Terminal" badge="ROOT" />
                <SidebarItem to="/admin/sql-studio" icon={DatabaseZap} label="SQL Studio" />
                <SidebarItem to="/admin/database" icon={Database} label="Database Sync" />
                <SidebarItem to="/admin/qa" icon={Terminal} label="QA Automation" />
                <SidebarItem to="/admin/compare" icon={ArrowLeftRight} label="Code Fact Checker" />
                <SidebarItem to="/admin/developer" icon={Rocket} label="Cloud Deployment" />
            </div>
          </div>
        </nav>

        {/* Status Indicator Bottom */}
        <div className="p-4 mt-auto border-t border-slate-800 bg-[#0b1120]">
            <div className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                serverStatus === 'online' ? 'bg-green-500/5 border-green-500/20 text-green-400' : 
                serverStatus === 'offline' ? 'bg-red-500/5 border-red-500/20 text-red-400' : 
                'bg-slate-800/50 border-slate-700 text-slate-500'
            }`}>
                <div className="flex items-center gap-2">
                    {serverStatus === 'online' ? <Wifi size={14} /> : <WifiOff size={14} />}
                    <span className="text-[10px] font-bold uppercase">{serverStatus === 'online' ? 'Connected' : 'Disconnected'}</span>
                </div>
                <button onClick={checkServerStatus} className="hover:rotate-180 transition-transform duration-500">
                    <RefreshCw size={12} className={serverStatus === 'checking' ? 'animate-spin' : ''} />
                </button>
            </div>
            <button 
                onClick={onLogout}
                className="flex items-center gap-3 w-full mt-3 px-4 py-2.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all duration-200 text-sm font-bold"
            >
                <LogOut size={18} />
                <span>Log out</span>
            </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#f8fafc] relative">
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 z-20">
          <div className="flex flex-col">
              <h2 className="text-slate-900 font-black text-xl tracking-tight">Control Panel</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">System Administration</p>
          </div>
          <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                  <span className="text-xs font-bold text-slate-900 uppercase">Super Admin</span>
                  <span className="text-[10px] text-slate-500 font-mono">paydone-v15.3-prod</span>
              </div>
              <div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-sm shadow-lg shadow-slate-200">
                AD
              </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8 custom-scrollbar relative">
          <div className="max-w-[1400px] mx-auto">
            <Outlet />
          </div>
        </main>

        {/* GLOBAL LIVE TOAST NOTIFICATION */}
        {activeToast && (
            <div className="fixed bottom-6 right-6 z-[120] animate-fade-in-up">
                <div 
                    className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-4 max-w-sm cursor-pointer hover:scale-105 transition transform" 
                    onClick={() => setSelectedNetworkLog(activeToast)}
                >
                    <div className={`p-2 rounded-xl ${activeToast.status >= 200 && activeToast.status < 300 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        <Server size={20}/>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                            <span className={`text-[10px] font-black uppercase px-1.5 rounded ${activeToast.method === 'GET' ? 'bg-blue-900 text-blue-300' : activeToast.method === 'POST' ? 'bg-green-900 text-green-300' : activeToast.method === 'DELETE' ? 'bg-red-900 text-red-300' : 'bg-orange-900 text-orange-300'}`}>{activeToast.method}</span>
                            <span className={`text-[10px] font-mono ${activeToast.status >= 200 && activeToast.status < 300 ? 'text-green-400' : 'text-red-400'}`}>{activeToast.status}</span>
                        </div>
                        <p className="text-xs text-slate-300 truncate font-mono">{activeToast.url.split('/api')[1] || activeToast.url}</p>
                    </div>
                    <button className="text-slate-500 hover:text-white"><Eye size={16}/></button>
                </div>
            </div>
        )}

        {/* RAW RESPONSE MODAL (SPLIT VIEW) */}
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

      </div>
    </div>
  );
}
