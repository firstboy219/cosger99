
import React, { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { ShieldCheck, Database, LogOut, Users, Settings, Briefcase, Server, Code, Rocket, RefreshCw, Wifi, WifiOff, History, LayoutDashboard, Terminal, Workflow, Ticket, ArrowLeftRight, Bot, Activity, Building2 } from 'lucide-react';
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

export default function AdminLayout({ onLogout }: { onLogout: () => void }) {
  const [serverStatus, setServerStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  
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

  return (
    <div className="flex h-screen bg-[#f8fafc] text-slate-900 overflow-hidden font-sans">
      
      {/* Sidebar - Dark Professional Theme */}
      <aside className="w-72 bg-[#0f172a] border-r border-slate-800 flex flex-col z-30 shadow-2xl">
        <div className="h-20 flex items-center px-6 border-b border-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-brand-500 to-indigo-600 p-2 rounded-xl shadow-lg">
                <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-white tracking-tight leading-none">Paydone Admin</h1>
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
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#f8fafc]">
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

        <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="max-w-[1400px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
