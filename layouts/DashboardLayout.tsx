
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { NavLink, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, BrainCircuit, Wallet, Menu, X, Bell, LogOut, PieChart, CalendarDays, ClipboardList, List, TrendingUp, DollarSign, Receipt, History, Users, UserCog, Search, ChevronDown, Globe, AlertCircle, CheckCircle2, PiggyBank, AlarmClock, Copy, Sparkles, Zap, ChevronRight, Wifi, RefreshCw, AlertTriangle, CloudUpload, Bug, CloudDownload, Code, Database } from 'lucide-react';
import { useTranslation } from '../services/translationService';
import { getUserData, getAllUsers } from '../services/mockDb';
import { DebtItem, SinkingFund, TaskItem, User } from '../types';
import { formatCurrency } from '../services/financeUtils';
import { pullUserDataFromCloud } from '../services/cloudSync';

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
  lastFailedPayload?: string | null;
  lastSyncError?: string | null;
  hasUnsavedChanges?: boolean; // NEW PROP
}

interface Notification {
    id: string;
    type: 'warning' | 'success' | 'info' | 'alarm';
    title: string;
    message: string;
    date: string;
}

export default function DashboardLayout({ onLogout, userId, syncStatus, onManualSync, lastFailedPayload, lastSyncError, hasUnsavedChanges }: DashboardLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { t, language, setLanguage } = useTranslation();
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [menuSearch, setMenuSearch] = useState('');
  const [showDebugModal, setShowDebugModal] = useState(false);
  const navigate = useNavigate();
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [nextBill, setNextBill] = useState<{name: string, days: number, amount: number} | null>(null);

  const [notifMenuOpen, setNotifMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);

  // --- MANUAL PULL (GET) STATE ---
  const [isPulling, setIsPulling] = useState(false);
  const [pullResult, setPullResult] = useState<{ status: 'success' | 'error', data: any } | null>(null);
  const [showPullModal, setShowPullModal] = useState(false);

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

  useEffect(() => {
      const data = getUserData(userId);
      const today = new Date().getDate();
      const tempNotifs: Notification[] = [];
      data.debts.forEach((debt: DebtItem) => {
          const due = debt.dueDate;
          const diff = due - today;
          if (diff >= 0 && diff <= 3) {
              tempNotifs.push({ id: `due-${debt.id}`, type: diff === 0 ? 'warning' : 'info', title: diff === 0 ? 'Jatuh Tempo Hari Ini!' : `Jatuh Tempo ${diff} Hari Lagi`, message: `Siapkan dana ${formatCurrency(debt.monthlyPayment)} untuk ${debt.name}.`, date: new Date().toISOString() });
          }
      });
      setNotifications(tempNotifs);
  }, [userId]);

  const handleManualPull = async () => {
      setIsPulling(true);
      try {
          // MODIFIED: Force Full Sync (true) when manually requested by user button
          const data = await pullUserDataFromCloud(userId, true);
          // If null (e.g. 404 handled gracefully inside), show distinct message
          setPullResult({ 
              status: 'success', 
              data: data || { message: "No Data returned (Possible 404 or Empty DB)" } 
          });
      } catch (e: any) {
          setPullResult({ 
              status: 'error', 
              data: { error: e.message, stack: e.stack } 
          });
      } finally {
          setIsPulling(false);
          setShowPullModal(true);
      }
  };

  const menuStructure = useMemo(() => [
      { title: 'Overview', items: [{ to: '/app', icon: LayoutDashboard, label: t("nav.dashboard") }, { to: '/app/ai-strategist', icon: BrainCircuit, label: t("nav.ai_strategist"), badge: 'AI' }, { to: '/app/planning', icon: ClipboardList, label: t("nav.planning") }] },
      { title: 'Management', items: [{ to: '/app/my-debts', icon: List, label: t("nav.my_debts") }, { to: '/app/allocation', icon: PieChart, label: t("nav.allocation") }, { to: '/app/calendar', icon: CalendarDays, label: t("nav.calendar") }] },
      { title: 'Tracker', items: [{ to: '/app/income', icon: DollarSign, label: t("nav.income") }, { to: '/app/expenses', icon: Receipt, label: t("nav.expenses") }, { to: '/app/financial-freedom', icon: TrendingUp, label: t("nav.freedom") }] },
      { title: 'Account', items: [{ to: '/app/team', icon: Users, label: t("nav.team") }, { to: '/app/logs', icon: History, label: t("nav.history") }, { to: '/app/profile', icon: UserCog, label: t("nav.profile") }] }
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
                <div className="bg-gradient-to-tr from-brand-600 to-indigo-600 text-white p-2 rounded-xl shadow-lg shadow-brand-900/50">
                    <Wallet className="h-5 w-5" />
                </div>
                <div>
                    <h1 className="font-bold text-lg tracking-tight leading-none text-white">Paydone<span className="text-brand-500">.id</span></h1>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">Financial Cockpit</p>
                </div>
            </div>
            <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden text-slate-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-4 flex flex-col gap-6">
            <div className="relative px-3 group">
                <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none text-slate-500 group-focus-within:text-brand-500 transition-colors"><Search size={14} /></div>
                <input type="text" placeholder="Jump to..." value={menuSearch} onChange={(e) => setMenuSearch(e.target.value)} className="w-full bg-slate-900/50 border border-slate-700/50 text-slate-300 text-xs rounded-lg py-2.5 pl-9 pr-3 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 transition-all placeholder-slate-600"/>
            </div>
            {nextBill && !menuSearch && (
                <div onClick={() => navigate('/app/calendar')} className="mx-3 p-3 bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-slate-700/50 relative overflow-hidden cursor-pointer group hover:border-brand-500/30 transition-all shadow-lg">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><AlarmClock size={40}/></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-1"><span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse"></span><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Upcoming Bill</span></div>
                        <h4 className="text-sm font-bold text-white truncate">{nextBill.name}</h4>
                        <div className="flex justify-between items-end mt-1"><span className="text-xs text-brand-400 font-mono">{formatCurrency(nextBill.amount)}</span><span className={`text-[10px] px-2 py-0.5 rounded font-bold ${nextBill.days <= 3 ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-300'}`}>{nextBill.days === 0 ? 'Today!' : `${nextBill.days}d left`}</span></div>
                    </div>
                </div>
            )}
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
                    <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${syncStatus === 'error' ? 'bg-red-50' : syncStatus === 'pushing' || syncStatus === 'pulling' ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`}></div>
                </div>
                <div className="flex-1 min-0"><p className="text-sm font-bold text-white truncate group-hover:text-brand-300 transition-colors">{currentUser?.username || 'User'}</p><div className="flex items-center gap-1.5 text-slate-500 text-[10px]">{syncStatus === 'error' ? (<span className="text-red-400 flex items-center gap-1"><AlertTriangle size={10}/> Sync Failed</span>) : syncStatus === 'pushing' || syncStatus === 'pulling' ? (<span className="text-blue-400 flex items-center gap-1"><RefreshCw size={10} className="animate-spin"/> Syncing...</span>) : (<div className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors" title="V42 Secure Connection"><span className="flex items-center gap-1"><Wifi size={10}/> V42 Secure</span></div>)}</div></div>
                <button onClick={onLogout} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all" title="Logout"><LogOut size={18} /></button>
            </div>
        </div>
      </aside>

      {/* DEBUG PAYLOAD & ERROR MODAL */}
      {showDebugModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col h-[85vh]">
                  <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center text-white">
                      <div className="flex items-center gap-2">
                          <Bug className="text-red-400" size={20}/>
                          <h3 className="font-bold">Sync Failure Analysis</h3>
                      </div>
                      <button onClick={() => setShowDebugModal(false)} className="text-slate-400 hover:text-white transition"><X size={24}/></button>
                  </div>
                  <div className="flex-1 overflow-auto p-6 bg-black flex flex-col gap-6">
                      
                      {/* 1. SERVER RESPONSE SECTION */}
                      <div className="space-y-2">
                          <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider border-b border-red-900/50 pb-1">Server Response (Error)</h4>
                          <div className="p-4 bg-red-950/30 border border-red-900 rounded-lg text-red-200 text-xs font-mono whitespace-pre-wrap leading-relaxed shadow-inner">
                              {lastSyncError || "No error details captured."}
                          </div>
                      </div>

                      {/* 2. REQUEST PAYLOAD SECTION */}
                      <div className="space-y-2">
                          <div className="flex justify-between items-end border-b border-slate-800 pb-1">
                              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Request Payload Sent</h4>
                              <button 
                                  onClick={() => { navigator.clipboard.writeText(lastFailedPayload || ''); alert("Payload Copied!"); }}
                                  className="text-[10px] text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1"
                              >
                                  <Copy size={12}/> Copy JSON
                              </button>
                          </div>
                          <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg text-green-400 text-[10px] font-mono whitespace-pre-wrap leading-relaxed">
                              {lastFailedPayload || "// No payload captured."}
                          </div>
                      </div>

                  </div>
                  <div className="p-4 bg-slate-800 border-t border-slate-700 flex justify-end gap-3">
                      <button 
                          onClick={() => setShowDebugModal(false)}
                          className="px-6 py-2 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-50 transition"
                      >
                          Close Inspector
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* MANUAL PULL RESPONSE INSPECTOR MODAL */}
      {showPullModal && pullResult && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
              <div className={`rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col h-[85vh] border-2 ${pullResult.status === 'success' ? 'bg-slate-900 border-green-500/50' : 'bg-slate-900 border-red-500/50'}`}>
                  {/* Header */}
                  <div className={`p-4 border-b flex justify-between items-center text-white ${pullResult.status === 'success' ? 'bg-green-900/20 border-green-900/50' : 'bg-red-900/20 border-red-900/50'}`}>
                      <div className="flex items-center gap-2">
                          {pullResult.status === 'success' ? <Database className="text-green-400" size={20}/> : <AlertTriangle className="text-red-400" size={20}/>}
                          <h3 className="font-bold flex items-center gap-2">
                              Cloud Response Inspector
                              <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold ${pullResult.status === 'success' ? 'bg-green-500 text-slate-900' : 'bg-red-500 text-white'}`}>
                                  {pullResult.status === 'success' ? '200 OK' : 'REQUEST FAILED'}
                              </span>
                          </h3>
                      </div>
                      <button onClick={() => setShowPullModal(false)} className="text-slate-400 hover:text-white transition"><X size={24}/></button>
                  </div>

                  {/* Body */}
                  <div className="flex-1 overflow-auto p-0 flex flex-col bg-black">
                      <div className="p-2 bg-slate-800 text-xs text-slate-400 font-mono border-b border-slate-700 flex justify-between items-center">
                          <span>GET /api/sync?userId={userId}&fullSync=true</span>
                          <button 
                              onClick={() => { navigator.clipboard.writeText(JSON.stringify(pullResult.data, null, 2)); alert("Response Copied!"); }}
                              className="flex items-center gap-1 hover:text-white transition"
                          >
                              <Copy size={12}/> Copy
                          </button>
                      </div>
                      <div className="flex-1 p-6 overflow-auto custom-scrollbar">
                          <pre className={`text-xs font-mono whitespace-pre-wrap leading-relaxed ${pullResult.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                              {JSON.stringify(pullResult.data, null, 2)}
                          </pre>
                      </div>
                  </div>

                  {/* Footer */}
                  <div className="p-4 bg-slate-800 border-t border-slate-700 flex justify-end gap-3">
                      <button 
                          onClick={() => setShowPullModal(false)}
                          className={`px-6 py-2 rounded-xl text-sm font-bold transition ${pullResult.status === 'success' ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-red-600 text-white hover:bg-red-700'}`}
                      >
                          Close & Apply
                      </button>
                  </div>
              </div>
          </div>
      )}

      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 lg:px-8 z-20 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden text-slate-500 hover:text-slate-900"><Menu size={20} /></button>
            <div className="hidden md:flex items-center text-sm text-slate-500"><span className="hover:text-slate-900 cursor-pointer transition flex items-center gap-1"><LayoutDashboard size={14}/> App</span><ChevronRight size={14} className="mx-1 text-slate-300"/><span className="font-semibold text-slate-900">{filteredMenu.flatMap(g => g.items).find(i => location.pathname === i.to || location.pathname.startsWith(i.to + '/'))?.label || 'Dashboard'}</span></div>
          </div>

          <div className="flex items-center gap-3">
            {/* --- SYNC CONTROLS --- */}
            <div className="flex items-center gap-2">
                {syncStatus === 'error' && (
                    <button 
                        onClick={() => setShowDebugModal(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg border border-red-200 text-xs font-bold hover:bg-red-100 transition animate-pulse"
                        title="Inspect Failed Data"
                    >
                        <Bug size={14} /> Error
                    </button>
                )}
                
                {/* NEW: MANUAL PULL BUTTON */}
                <button 
                    onClick={handleManualPull}
                    disabled={isPulling || syncStatus === 'pushing'}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm border bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-brand-600"
                    title="Tarik Data Terbaru dari Cloud (Manual - Full Sync)"
                >
                    {isPulling ? <RefreshCw size={14} className="animate-spin" /> : <CloudDownload size={14} />}
                    Tarik Data
                </button>

                {/* EXISTING: MANUAL PUSH BUTTON */}
                {hasUnsavedChanges && (
                    <button 
                        onClick={onManualSync}
                        disabled={syncStatus === 'pushing' || isPulling}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition shadow-sm border ${
                            syncStatus === 'pushing' ? 'bg-slate-50 text-slate-400 border-slate-200' : 
                            syncStatus === 'error' ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' :
                            'bg-brand-600 text-white border-brand-600 hover:bg-brand-700'
                        }`}
                    >
                        {syncStatus === 'pushing' ? <RefreshCw size={14} className="animate-spin" /> : <CloudUpload size={14} />}
                        {syncStatus === 'pushing' ? 'Saving...' : 'Simpan ke Cloud'}
                    </button>
                )}
            </div>

            <div className="h-6 w-px bg-slate-200 mx-1"></div>

            <div className="relative">
               <button onClick={() => setLangMenuOpen(!langMenuOpen)} className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 px-2 py-1 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition"><Globe size={16} /><span className="uppercase font-bold text-xs">{language}</span><ChevronDown size={12} /></button>
               {langMenuOpen && (<div className="absolute right-0 top-full mt-2 w-32 bg-white border border-slate-200 shadow-xl rounded-xl py-1 z-50 animate-fade-in-up"><button onClick={() => { setLanguage('id'); setLangMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center justify-between"><span>Indonesian</span>{language === 'id' && <CheckCircle2 size={14} className="text-brand-600"/>}</button><button onClick={() => { setLanguage('en'); setLangMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center justify-between"><span>English</span>{language === 'en' && <CheckCircle2 size={14} className="text-brand-600"/>}</button></div>)}
            </div>

            <div className="relative" ref={notifRef}>
                <button onClick={() => setNotifMenuOpen(!notifMenuOpen)} className={`relative p-2 rounded-full transition-colors ${notifMenuOpen ? 'bg-brand-50 text-brand-600' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}><Bell size={18} />{notifications.length > 0 && (<span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>)}</button>
                {notifMenuOpen && (<div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 shadow-xl rounded-2xl z-50 overflow-hidden animate-fade-in-up"><div className="p-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center"><h3 className="font-bold text-sm text-slate-800 flex items-center gap-2"><Sparkles size={14} className="text-yellow-500"/> Notifikasi</h3></div><div className="max-h-[300px] overflow-y-auto custom-scrollbar">{notifications.length === 0 ? (<div className="p-8 text-center text-slate-400 text-xs">Tidak ada notifikasi baru.</div>) : (notifications.map(notif => (<div key={notif.id} className={`p-3 border-b border-slate-50 hover:bg-slate-50 transition flex gap-3 ${notif.type === 'alarm' ? 'bg-amber-50/50' : ''}`}><div className={`mt-1 flex-shrink-0 p-1.5 rounded-full ${notif.type === 'warning' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>{notif.type === 'warning' ? <AlertCircle size={14} /> : <Wallet size={14} />}</div><div><h4 className="text-sm font-bold text-slate-800">{notif.title}</h4><p className="text-xs text-slate-500 leading-relaxed">{notif.message}</p></div></div>)))}</div></div>)}
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
