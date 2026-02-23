
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { NavLink, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, BrainCircuit, Wallet, Menu, X, Bell, LogOut, PieChart, CalendarDays, ClipboardList, List, TrendingUp, DollarSign, Receipt, History, Users, UserCog, Search, ChevronDown, Globe, AlertCircle, CheckCircle2, PiggyBank, AlarmClock, Copy, Sparkles, Zap, ChevronRight, Wifi, RefreshCw, AlertTriangle, CloudUpload, Bug, CloudDownload, Code, Database, Eye, Terminal, Send, Megaphone, Info, Gift, ShieldAlert, ArrowRight, FileText } from 'lucide-react';
import { useTranslation } from '../services/translationService';
import { getUserData, getAllUsers, getConfig, getDB, saveDB } from '../services/mockDb';
import { DebtItem, SinkingFund, TaskItem, User, AppConfig, AppNotification } from '../types';
import { formatCurrency } from '../services/financeUtils';
import { pullUserDataFromCloud } from '../services/cloudSync';
import { api } from '../services/api';
import GracePeriodBanner from '../components/GracePeriodBanner';

// --- MODERN SIDEBAR ITEM ---
interface SidebarItemProps {
  to: string;
  icon: any;
  label: string;
  badge?: string;
  onClick?: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ to, icon: Icon, label, badge, onClick }) => {
  const location = useLocation();
  const isActive = location.pathname === to || (to !== '/app' && location.pathname.startsWith(to + '/'));
  
  return (
    <NavLink 
      to={to} 
      onClick={onClick}
      className={`group flex items-center justify-between px-4 py-3 mx-3 rounded-xl transition-all duration-300 relative overflow-hidden mb-1 ${
        isActive 
          ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-lg shadow-brand-900/20 translate-x-1' 
          : 'text-slate-400 hover:bg-slate-800/50 hover:text-white hover:translate-x-1'
      }`}
    >
      {isActive && <div className="absolute inset-0 bg-white/10 blur-xl pointer-events-none"></div>}
      <div className="flex items-center gap-3 relative z-10">
        <Icon size={18} className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110 text-slate-300 group-hover:text-white'}`} />
        <span className="font-medium tracking-wide text-sm">{label}</span>
      </div>
      {badge && (
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold relative z-10 shadow-sm ${
            isActive ? 'bg-white/20 text-white border border-white/20' : 'bg-brand-900/50 text-brand-400 border border-brand-800'
        }`}>
          {badge}
        </span>
      )}
    </NavLink>
  );
};

interface DashboardLayoutProps {
  onLogout: () => void;
  userId: string; 
  syncStatus: 'idle' | 'pulling' | 'pushing' | 'error' | 'offline';
  onManualSync?: () => void;
  hasUnsavedChanges?: boolean;
}

export default function DashboardLayout({ onLogout, userId, syncStatus, onManualSync, hasUnsavedChanges }: DashboardLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { t, language, setLanguage } = useTranslation();
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [menuSearch, setMenuSearch] = useState('');
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [showPayloadModal, setShowPayloadModal] = useState(false);
  const [currentPayload, setCurrentPayload] = useState<any>(null);

  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [nextBill, setNextBill] = useState<{name: string, days: number, amount: number} | null>(null);
  const [notifMenuOpen, setNotifMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);
  
  const unreadCount = useMemo(() => notifications.filter(n => !n.is_read).length, [notifications]);

  const [isPulling, setIsPulling] = useState(false);
  const [pullResult, setPullResult] = useState<{ status: 'success' | 'error', data: any } | null>(null);
  const [showPullModal, setShowPullModal] = useState(false);

  // REACTIVE CONFIG STATE
  const [appConfig, setAppConfig] = useState<AppConfig>(getConfig());

  useEffect(() => {
      const updateConfig = () => setAppConfig(getConfig());
      window.addEventListener('PAYDONE_CONFIG_UPDATE', updateConfig);
      return () => window.removeEventListener('PAYDONE_CONFIG_UPDATE', updateConfig);
  }, []);

  const isAutoSync = appConfig.advancedConfig?.syncStrategy === 'background';
  const appName = appConfig.appName || 'Paydone.id';
  const appDesc = appConfig.appDescription || 'Financial Cockpit';
  const appLogo = appConfig.appLogoUrl;

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
              setNotifMenuOpen(false);
          }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
      if (userId) {
          const users = getAllUsers();
          const found = users.find(u => u.id === userId);
          if (found) setCurrentUser(found);
          const data = getUserData(userId);
          const today = new Date().getDate();
          const upcomingDebts = data.debts.map(d => {
              let diff = d.dueDate - today;
              if (diff < 0) diff += 30;
              return { ...d, diff };
          }).sort((a,b) => a.diff - b.diff);
          if (upcomingDebts.length > 0) {
              setNextBill({ name: upcomingDebts[0].name, days: upcomingDebts[0].diff, amount: upcomingDebts[0].monthlyPayment });
          }
      }
  }, [userId]);

  // V50.35 TAHAP 5: Hydrate notifications from local DB + fetch from backend
  useEffect(() => {
    const loadNotifs = async () => {
      const db = getDB();
      
      // First, try to fetch from backend
      try {
        const backendNotifs = await api.get('/notifications').catch(() => null);
        if (Array.isArray(backendNotifs)) {
          db.notifications = backendNotifs;
          saveDB(db);
        }
      } catch {
        // Silently fail - use local DB
      }
      
      const allNotifs = Array.isArray(db.notifications) 
        ? db.notifications.filter((n: AppNotification) => n.user_id === userId || !n.user_id)
        : [];
      setNotifications(allNotifs.sort((a: AppNotification, b: AppNotification) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    };
    
    loadNotifs();
    window.addEventListener('PAYDONE_DB_UPDATE', loadNotifs);
    // V50.35 TAHAP 5: Listen for real-time notifications via WebSocket
    window.addEventListener('PAYDONE_NOTIFICATION', loadNotifs);
    
    return () => {
      window.removeEventListener('PAYDONE_DB_UPDATE', loadNotifs);
      window.removeEventListener('PAYDONE_NOTIFICATION', loadNotifs);
    };
  }, [userId]);

  const markAsRead = useCallback(async (notifId: string) => {
    // Optimistic update
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, is_read: true } : n));
    // Update local DB
    const db = getDB();
    db.notifications = (db.notifications || []).map((n: AppNotification) => n.id === notifId ? { ...n, is_read: true } : n);
    saveDB(db);
    // Sync to backend
    try { await api.put(`/notifications/${notifId}/read`, {}); } catch { /* ignore */ }
  }, []);

  const markAllAsRead = useCallback(async () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    const db = getDB();
    db.notifications = (db.notifications || []).map((n: AppNotification) => ({ ...n, is_read: true }));
    saveDB(db);
    for (const id of unreadIds) {
      try { await api.put(`/notifications/${id}/read`, {}); } catch { /* ignore */ }
    }
  }, [notifications]);

  const handleManualPull = async () => {
      setIsPulling(true);
      const result = await pullUserDataFromCloud(userId);
      setPullResult({ 
          status: result.success ? 'success' : 'error', 
          data: result.success ? result.data : { error: result.error }
      });
      setIsPulling(false);
      setShowPullModal(true);
  };

  const initiateSync = () => {
      const userData = getUserData(userId);
      const fullPayload = { users: getAllUsers(), ...userData };

      if (appConfig.enablePayloadPreview) {
          setCurrentPayload(fullPayload);
          setShowPayloadModal(true);
      } else {
          onManualSync?.();
      }
  };

  const menuStructure = useMemo(() => [
      { title: 'Overview', items: [{ to: '/app', icon: LayoutDashboard, label: t("nav.dashboard") }, { to: '/app/ai-strategist', icon: BrainCircuit, label: t("nav.ai_strategist"), badge: 'AI' }, { to: '/app/planning', icon: ClipboardList, label: t("nav.planning") }] },
      { title: 'Management', items: [{ to: '/app/my-debts', icon: List, label: t("nav.my_debts") }, { to: '/app/allocation', icon: PieChart, label: t("nav.allocation") }, { to: '/app/calendar', icon: CalendarDays, label: t("nav.calendar") }] },
      { title: 'Tracker', items: [{ to: '/app/income', icon: DollarSign, label: t("nav.income") }, { to: '/app/expenses', icon: Receipt, label: t("nav.expenses") }, { to: '/app/financial-freedom', icon: TrendingUp, label: t("nav.freedom") }] },
      { title: 'Account', items: [{ to: '/app/logs', icon: History, label: t("nav.history") }, { to: '/app/profile', icon: UserCog, label: t("nav.profile") }, { to: '/app/upgrade', icon: Zap, label: 'Upgrade', badge: 'PRO' }, { to: '/app/billing', icon: FileText, label: 'Billing' }] }
  ], [t]);

  const filteredMenu = useMemo(() => {
      if (!menuSearch) return menuStructure;
      return menuStructure.map(group => ({ ...group, items: group.items.filter(item => item.label.toLowerCase().includes(menuSearch.toLowerCase())) })).filter(group => group.items.length > 0);
  }, [menuSearch, menuStructure]);

  return (
    <div className="flex h-screen bg-[#f8fafc] font-sans text-slate-900 overflow-hidden">
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0f172a] text-slate-300 border-r border-slate-800 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 shadow-2xl flex flex-col ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-20 flex items-center px-6 border-b border-slate-800/60 bg-gradient-to-r from-[#0f172a] to-[#1e293b]">
            <div className="flex items-center gap-3 text-white w-full">
                {appLogo ? (
                    <img src={appLogo} alt="Logo" className="w-9 h-9 object-contain bg-white rounded-xl p-1 shadow-lg shadow-brand-900/50" />
                ) : (
                    <div className="bg-gradient-to-tr from-brand-600 to-indigo-600 text-white p-2 rounded-xl shadow-lg shadow-brand-900/50">
                        <Wallet className="h-5 w-5" />
                    </div>
                )}
                <div className="overflow-hidden">
                    <h1 className="font-bold text-lg tracking-tight leading-none text-white truncate max-w-[150px]">{appName}</h1>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5 truncate max-w-[150px]">{appDesc}</p>
                </div>
            </div>
            <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden text-slate-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-4 flex flex-col gap-6">
            <div className="relative px-3 group">
                <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none text-slate-500 group-focus-within:text-brand-500 transition-colors"><Search size={14} /></div>
                <input type="text" placeholder="Jump to..." value={menuSearch} onChange={(e) => setMenuSearch(e.target.value)} className="w-full bg-slate-900/50 border border-slate-700/50 text-slate-300 text-xs rounded-lg py-2.5 pl-9 pr-3 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 transition-all placeholder-slate-600"/>
            </div>
            <div className="space-y-6">
                {filteredMenu.map((group, idx) => (
                    <div key={idx}><div className="px-6 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">{group.title}<div className="h-px bg-slate-800 flex-1"></div></div><div className="space-y-0.5">{group.items.map((item, i) => (<SidebarItem key={i} to={item.to} icon={item.icon} label={item.label} badge={item.badge} onClick={() => setIsMobileMenuOpen(false)}/>))}</div></div>
                ))}
            </div>
        </div>
        <div className="p-4 border-t border-slate-800/60 bg-[#0b1120]">
            <div className="bg-slate-900/50 rounded-xl p-3 border border-slate-800 flex items-center gap-3 relative group transition-all hover:bg-slate-800 hover:border-slate-700">
                <div className="relative">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-brand-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm overflow-hidden shadow-lg border-2 border-slate-900 group-hover:border-brand-500 transition-colors">{currentUser?.photoUrl ? (<img src={currentUser.photoUrl} alt="User" className="w-full h-full object-cover"/>) : (currentUser?.username?.charAt(0).toUpperCase() || 'U')}</div>
                    <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${syncStatus === 'error' ? 'bg-red-500' : syncStatus === 'pushing' || syncStatus === 'pulling' ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`}></div>
                </div>
                <div className="flex-1 min-0"><p className="text-sm font-bold text-white truncate group-hover:text-brand-300 transition-colors">{currentUser?.username || 'User'}</p><div className="flex items-center gap-1.5 text-slate-500 text-[10px]">{syncStatus === 'error' ? (<span className="text-red-400 flex items-center gap-1"><AlertTriangle size={10}/> Sync Problem</span>) : syncStatus === 'pushing' || syncStatus === 'pulling' ? (<span className="text-blue-400 flex items-center gap-1"><RefreshCw size={10} className="animate-spin"/> Synchronizing...</span>) : (<div className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors" title="V42 Secure Connection"><span className="flex items-center gap-1"><Wifi size={10}/> {isAutoSync ? 'Realtime Link' : 'V42 Secure'}</span></div>)}</div></div>
                <button onClick={onLogout} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all" title="Logout"><LogOut size={18} /></button>
            </div>
        </div>
      </aside>

      {/* PAYLOAD MODAL */}
      {showPayloadModal && currentPayload && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 animate-fade-in">
              <div className="bg-white rounded-[2.5rem] w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col h-[85vh] border border-white/20">
                  <div className="bg-slate-950 p-8 flex justify-between items-start text-white relative">
                      <div className="relative z-10">
                          <h3 className="text-2xl font-black tracking-tight flex items-center gap-3">
                              <Terminal size={24} className="text-brand-400"/> Data Payload Inspector
                          </h3>
                          <p className="text-slate-400 text-sm mt-2">Pratinjau data transaksi yang akan dikirim ke Cloud SQL</p>
                      </div>
                      <button onClick={() => setShowPayloadModal(false)} className="p-2 bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white rounded-full transition-all"><X size={24}/></button>
                  </div>
                  <div className="flex-1 overflow-hidden flex flex-col bg-black">
                      <div className="flex-1 overflow-auto p-6 custom-scrollbar font-mono text-[11px] text-green-400 bg-black leading-relaxed">
                          <pre>{JSON.stringify(currentPayload, null, 2)}</pre>
                      </div>
                  </div>
                  <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                      <button onClick={() => setShowPayloadModal(false)} className="px-6 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-white transition">Batal</button>
                      <button onClick={() => { setShowPayloadModal(false); onManualSync?.(); }} className="px-8 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-black uppercase tracking-widest hover:bg-brand-700 shadow-xl flex items-center gap-2 transform active:scale-95 transition"><Send size={16}/> Kirim Sekarang</button>
                  </div>
              </div>
          </div>
      )}

      {/* PULL MODAL */}
      {showPullModal && pullResult && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
              <div className={`rounded-[2.5rem] w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col h-[85vh] border-2 bg-slate-900 ${pullResult.status === 'success' ? 'border-green-500/50' : 'border-red-500/50'}`}>
                  <div className={`p-6 border-b flex justify-between items-center text-white ${pullResult.status === 'success' ? 'bg-green-900/20' : 'bg-red-900/20'}`}>
                      <h3 className="font-bold flex items-center gap-2 text-xl">
                          {pullResult.status === 'success' ? <Database className="text-green-400"/> : <AlertTriangle className="text-red-400"/>}
                          Cloud SQL Response
                      </h3>
                      <button onClick={() => setShowPullModal(false)} className="text-slate-400 hover:text-white transition"><X size={24}/></button>
                  </div>
                  <div className="flex-1 overflow-auto p-6 font-mono text-xs text-green-400 bg-black leading-relaxed">
                      <pre>{JSON.stringify(pullResult.data, null, 2)}</pre>
                  </div>
                  <div className="p-6 bg-slate-900 border-t border-slate-800 flex justify-end">
                      <button onClick={() => { setShowPullModal(false); if(pullResult.status === 'success') window.location.reload(); }} className="px-8 py-2.5 bg-white text-slate-900 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-slate-50 transition">Tutup & Terapkan</button>
                  </div>
              </div>
          </div>
      )}

      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <GracePeriodBanner />
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 lg:px-8 z-20 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden text-slate-500 hover:text-slate-900"><Menu size={20} /></button>
            <div className="hidden md:flex items-center text-sm text-slate-500 font-semibold text-slate-900">{filteredMenu.flatMap(g => g.items).find(i => location.pathname === i.to || location.pathname.startsWith(i.to + '/'))?.label || 'Dashboard'}</div>
          </div>

          <div className="flex items-center gap-3">
            {/* MANUAL MODE CONTROLS */}
            {!isAutoSync && (
                <div className="flex items-center gap-2 animate-fade-in">
                    <button onClick={handleManualPull} disabled={isPulling || syncStatus === 'pushing'} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm border bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-brand-600" title="Tarik Data (Manual)">
                        {isPulling ? <RefreshCw size={14} className="animate-spin" /> : <CloudDownload size={14} />}
                        Tarik
                    </button>

                    <button 
                        onClick={initiateSync} 
                        disabled={syncStatus === 'pushing' || isPulling} 
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition shadow-lg border ${
                            hasUnsavedChanges 
                            ? 'bg-brand-600 text-white border-brand-600 hover:bg-brand-700 shadow-brand-500/20' 
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                        {syncStatus === 'pushing' ? <RefreshCw size={14} className="animate-spin" /> : <CloudUpload size={14} />}
                        {hasUnsavedChanges ? 'Simpan Perubahan' : 'Sync / Payload'}
                    </button>
                </div>
            )}

            {isAutoSync && (
                <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 text-green-700 text-[10px] font-black uppercase tracking-tighter border border-green-100">
                    <Wifi size={10} className="animate-pulse"/> Realtime Sync Active
                </div>
            )}

            <div className="h-6 w-px bg-slate-200 mx-1"></div>

            <div className="relative">
               <button onClick={() => setLangMenuOpen(!langMenuOpen)} className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 px-2 py-1 rounded-lg hover:bg-slate-50 transition font-bold text-xs uppercase">{language} <ChevronDown size={12} /></button>
               {langMenuOpen && (<div className="absolute right-0 top-full mt-2 w-32 bg-white border border-slate-200 shadow-xl rounded-xl py-1 z-50 animate-fade-in-up"><button onClick={() => { setLanguage('id'); setLangMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center justify-between"><span>Indonesia</span>{language === 'id' && <CheckCircle2 size={14} className="text-brand-600"/>}</button><button onClick={() => { setLanguage('en'); setLangMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center justify-between"><span>English</span>{language === 'en' && <CheckCircle2 size={14} className="text-brand-600"/>}</button></div>)}
            </div>

            <div className="relative" ref={notifRef}>
              <button onClick={() => setNotifMenuOpen(!notifMenuOpen)} className={`p-2 rounded-full transition-colors relative ${notifMenuOpen ? 'bg-brand-50 text-brand-600' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}>
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center min-w-[18px] h-[18px] border-2 border-white shadow-sm">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Popover */}
              {notifMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white border border-slate-200 shadow-2xl rounded-2xl z-50 overflow-hidden" style={{ animation: 'fadeInUp 0.15s ease-out' }}>
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
                    <h4 className="text-sm font-bold text-slate-900">Notifikasi</h4>
                    {unreadCount > 0 && (
                      <button onClick={markAllAsRead} className="text-[10px] font-bold text-brand-600 hover:text-brand-700 transition">Tandai semua dibaca</button>
                    )}
                  </div>
                  <div className="max-h-[360px] overflow-y-auto custom-scrollbar">
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                        <Bell size={32} className="text-slate-200 mb-3" />
                        <p className="text-sm font-bold text-slate-400">Belum ada notifikasi</p>
                        <p className="text-[11px] text-slate-300 mt-1">Notifikasi dari sistem dan promo akan muncul di sini.</p>
                      </div>
                    ) : (
                      notifications.slice(0, 20).map(notif => {
                        const NotifIcon = notif.type === 'promo' ? Gift : notif.type === 'warning' ? ShieldAlert : notif.type === 'system' ? AlertCircle : Info;
                        const iconColor = notif.type === 'promo' ? 'text-amber-600 bg-amber-50' : notif.type === 'warning' ? 'text-red-600 bg-red-50' : notif.type === 'system' ? 'text-slate-600 bg-slate-100' : 'text-blue-600 bg-blue-50';
                        const timeAgo = (() => {
                          const diff = Date.now() - new Date(notif.created_at).getTime();
                          const mins = Math.floor(diff / 60000);
                          if (mins < 60) return `${mins}m lalu`;
                          const hours = Math.floor(mins / 60);
                          if (hours < 24) return `${hours}j lalu`;
                          return `${Math.floor(hours / 24)}h lalu`;
                        })();

                        return (
                          <div
                            key={notif.id}
                            onClick={() => { markAsRead(notif.id); if (notif.action_url) navigate(notif.action_url); }}
                            className={`flex gap-3 px-5 py-3.5 border-b border-slate-50 cursor-pointer transition-colors hover:bg-slate-50 ${!notif.is_read ? 'bg-brand-50/30' : ''}`}
                          >
                            <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${iconColor}`}>
                              {notif.image_url ? (
                                <img src={notif.image_url} alt="" className="w-9 h-9 rounded-xl object-cover" />
                              ) : (
                                <NotifIcon size={16} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className={`text-xs leading-snug ${!notif.is_read ? 'font-bold text-slate-900' : 'font-medium text-slate-600'}`}>{notif.title}</p>
                                {!notif.is_read && <div className="w-2 h-2 bg-brand-500 rounded-full flex-shrink-0 mt-1" />}
                              </div>
                              <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">{notif.message}</p>
                              <p className="text-[10px] text-slate-300 mt-1">{timeAgo}</p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  {notifications.length > 0 && (
                    <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 text-center">
                      <button onClick={() => { setNotifMenuOpen(false); navigate('/app/logs'); }} className="text-[11px] font-bold text-brand-600 hover:text-brand-700 transition flex items-center gap-1 mx-auto">
                        Lihat semua riwayat <ArrowRight size={12} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-[var(--body-bg)] p-6 lg:p-8 custom-scrollbar">
          <div className="max-w-[1600px] mx-auto"><Outlet /></div>
        </main>
      </div>

      {isMobileMenuOpen && (<div onClick={() => setIsMobileMenuOpen(false)} className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden backdrop-blur-sm transition-opacity"></div>)}
    </div>
  );
}
