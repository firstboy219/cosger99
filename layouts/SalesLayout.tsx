import React, { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Package, CreditCard, Receipt, Users, Megaphone, FileText, Mail,
  LogOut, Wifi, WifiOff, RefreshCw, ShieldCheck, Menu, X, UserCheck
} from 'lucide-react';
import { getConfig } from '../services/mockDb';

const SidebarItem = ({ to, icon: Icon, label, badge }: { to: string; icon: any; label: string; badge?: string }) => (
  <NavLink
    to={to}
    end={to === '/sales'}
    className={({ isActive }) =>
      `group flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-200 mb-1 ${
        isActive
          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20'
          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`
    }
  >
    <div className="flex items-center gap-3">
      <Icon size={18} className="shrink-0" />
      <span className="font-medium text-sm">{label}</span>
    </div>
    {badge && (
      <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-md font-bold border border-emerald-500/30">
        {badge}
      </span>
    )}
  </NavLink>
);

export default function SalesLayout({ onLogout }: { onLogout: () => void }) {
  const [serverStatus, setServerStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [mobileOpen, setMobileOpen] = useState(false);

  const config = getConfig();
  const appName = config.appName || 'Paydone.id';
  const appLogo = config.appLogoUrl;

  const checkServerStatus = async () => {
    setServerStatus('checking');
    try {
      const cfg = getConfig();
      const baseUrl = cfg.backendUrl?.replace(/\/$/, '') || '';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${baseUrl}/api/health`, { signal: controller.signal });
      clearTimeout(timeoutId);
      setServerStatus(res.ok ? 'online' : 'offline');
    } catch {
      setServerStatus('offline');
    }
  };

  useEffect(() => {
    checkServerStatus();
    const interval = setInterval(checkServerStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const sidebarContent = (
    <>
      <div className="h-20 flex items-center px-6 border-b border-slate-800/50">
        <div className="flex items-center gap-3">
          {appLogo ? (
            <img src={appLogo} alt="Logo" className="w-10 h-10 object-contain bg-white rounded-xl p-1 shadow-lg" />
          ) : (
            <div className="bg-gradient-to-tr from-emerald-500 to-teal-600 p-2 rounded-xl shadow-lg">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
          )}
          <div>
            <h1 className="font-bold text-lg text-white tracking-tight leading-none">{appName}</h1>
            <p className="text-[10px] text-emerald-400 font-bold uppercase mt-1 tracking-widest">Sales Panel</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-8 overflow-y-auto custom-scrollbar">
        <div>
          <h3 className="px-4 mb-3 text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Dashboard</h3>
          <SidebarItem to="/sales" icon={LayoutDashboard} label="Overview" />
        </div>

        <div>
          <h3 className="px-4 mb-3 text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Produk</h3>
          <SidebarItem to="/sales/packages" icon={Package} label="Manajemen Paket" />
          <SidebarItem to="/sales/payment-methods" icon={CreditCard} label="Metode Pembayaran" />
        </div>

        <div>
          <h3 className="px-4 mb-3 text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Transaksi</h3>
          <SidebarItem to="/sales/transactions" icon={Receipt} label="Transaksi" badge="LIVE" />
          <SidebarItem to="/sales/users" icon={Users} label="Kelola User" />
        </div>

        <div>
          <h3 className="px-4 mb-3 text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Marketing</h3>
          <SidebarItem to="/sales/promos" icon={Megaphone} label="Promo & Idle User" />
          <SidebarItem to="/sales/content" icon={FileText} label="Konten / Artikel" />
          <SidebarItem to="/sales/email-blast" icon={Mail} label="Email Blast" />
          <SidebarItem to="/sales/reactivate" icon={UserCheck} label="Reactivation" badge="NEW" />
        </div>
      </nav>

      <div className="p-4 mt-auto border-t border-slate-800 bg-[#0b1120]">
        <div
          className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
            serverStatus === 'online'
              ? 'bg-green-500/5 border-green-500/20 text-green-400'
              : serverStatus === 'offline'
              ? 'bg-red-500/5 border-red-500/20 text-red-400'
              : 'bg-slate-800/50 border-slate-700 text-slate-500'
          }`}
        >
          <div className="flex items-center gap-2">
            {serverStatus === 'online' ? <Wifi size={14} /> : <WifiOff size={14} />}
            <span className="text-[10px] font-bold uppercase">
              {serverStatus === 'online' ? 'Connected' : 'Disconnected'}
            </span>
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
    </>
  );

  return (
    <div className="flex h-screen bg-[#f8fafc] text-slate-900 overflow-hidden font-sans">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-72 bg-[#0f172a] border-r border-slate-800 flex-col z-30 shadow-2xl">
        {sidebarContent}
      </aside>

      {/* Mobile Header + Drawer */}
      <div className="lg:hidden fixed top-0 inset-x-0 h-16 bg-[#0f172a] z-40 flex items-center justify-between px-4 border-b border-slate-800">
        <div className="flex items-center gap-2 text-white">
          <ShieldCheck size={20} className="text-emerald-400" />
          <span className="font-bold text-sm">{appName} Sales</span>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="text-white p-2">
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-30 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 bg-[#0f172a] flex flex-col z-40 shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#f8fafc] relative">
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 z-20 max-lg:mt-16">
          <div>
            <h2 className="text-slate-900 font-black text-xl tracking-tight">Sales Panel</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">CRM & Subscription Management</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <span className="text-xs font-bold text-slate-900 uppercase">Sales Agent</span>
              <span className="text-[10px] text-emerald-600 font-mono">cosger-v50.34</span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-sm shadow-lg">
              SA
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
