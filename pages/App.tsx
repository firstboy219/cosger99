
import React, { useState, useEffect, useRef } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import AdminLayout from './layouts/AdminLayout';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Simulator from './pages/Simulator';
import AIStrategist from './pages/AIStrategist';
import Allocation from './pages/Allocation';
import CalendarPage from './pages/CalendarPage';
import Planning from './pages/Planning';
import MasterData from './pages/admin/MasterData';
import DatabaseManager from './pages/admin/DatabaseManager';
import AdminSettings from './pages/admin/Settings';
import DeveloperTools from './pages/admin/DeveloperTools';
import ActivityLogs from './pages/ActivityLogs';
import MyDebts from './pages/MyDebts';
import IncomeManager from './pages/IncomeManager'; 
import DailyExpenses from './pages/DailyExpenses'; 
import FinancialFreedom from './pages/FinancialFreedom';
import UserManagement from './pages/admin/UserManagement';
import FamilyManager from './pages/FamilyManager';
import Profile from './pages/Profile';
import AdminDashboard from './pages/admin/AdminDashboard'; 
import AICenter from './pages/admin/AICenter';
import SQLStudio from './pages/admin/SQLStudio';
import Tickets from './pages/admin/Tickets';
import BAAnalyst from './pages/admin/BAAnalyst';
import QAAnalyst from './pages/admin/QAAnalyst';
import ServerCompare from './pages/admin/ServerCompare';
import ServerTerminal from './pages/admin/ServerTerminal';
import GitDeployment from './pages/admin/GitDeployment'; // IMPORT GIT DEPLOY
import SyncWatchdog from './components/SyncWatchdog';

import { getConfig, getUserData, saveUserData, getAllUsers } from './services/mockDb';
import { pullUserDataFromCloud, pushPartialUpdate, saveItemToCloud } from './services/cloudSync';
import { connectWebSocket, disconnectWebSocket } from './services/socket'; 
import { Cloud, RefreshCw, AlertCircle, CloudDownload, ArrowRight } from 'lucide-react';
import { applyTheme } from './services/themeService';
import { I18nProvider } from './services/translationService';
import { toLocalISOString } from './services/financeUtils';

import { DebtItem, TaskItem, PaymentRecord, IncomeItem, ExpenseItem, DailyExpense, DebtInstallment, SinkingFund, BankAccount } from './types';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<'user' | 'admin'>('user');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [debtInstallments, setDebtInstallments] = useState<DebtInstallment[]>([]); 
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [incomes, setIncomes] = useState<IncomeItem[]>([]);
  const [dailyExpenses, setDailyExpenses] = useState<DailyExpense[]>([]); 
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([]);
  const [monthlyExpenses, setMonthlyExpenses] = useState<Record<string, ExpenseItem[]>>({});
  const [sinkingFunds, setSinkingFunds] = useState<SinkingFund[]>([]); 
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]); // NEW

  const currentMonthKey = new Date().toISOString().slice(0, 7);
  // Default true to prevent flash of loading screen if local data exists
  const [isDataLoaded, setIsDataLoaded] = useState(true); 
  const [syncStatus, setSyncStatus] = useState<'idle' | 'pulling' | 'pushing' | 'error' | 'offline'>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncProgressMsg, setSyncProgressMsg] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [aiResult, setAiResult] = useState<{ show: boolean; type: 'success' | 'error'; title: string; message: string; }>({ show: false, type: 'success', title: '', message: '' });

  useEffect(() => {
    const config = getConfig();
    if (config.currentThemePreset) applyTheme(config.currentThemePreset);
  }, []);

  const handleLogout = () => {
    disconnectWebSocket(); 
    setIsAuthenticated(false);
    setUserRole('user');
    setCurrentUserId(null);
    setIsDataLoaded(false);
    localStorage.removeItem('paydone_active_user'); 
    localStorage.removeItem('paydone_session_token');
  };

  useEffect(() => {
    if (!currentUserId || userRole !== 'user') return;
    connectWebSocket(currentUserId);
  }, [currentUserId, userRole]);

  // LOAD LOCAL DATA (Instant UI)
  const loadLocalDataIntoState = (userId: string) => {
      const localData = getUserData(userId);
      setDebts(localData.debts || []);
      setDebtInstallments(localData.debtInstallments || []); 
      setTasks(localData.tasks || []);
      setDailyExpenses(localData.dailyExpenses || []);
      setPaymentRecords(localData.paymentRecords || []);
      setIncomes(localData.incomes || []);
      setMonthlyExpenses(localData.allocations || {});
      setSinkingFunds(localData.sinkingFunds || []);
      setBankAccounts(localData.bankAccounts || []);
  };

  // BACKGROUND SYNC (Non-Blocking)
  const performBackgroundSync = async (userId: string) => {
    try {
      const config = getConfig();
      const strategy = config.advancedConfig?.syncStrategy;

      if (strategy === 'manual_only') {
          setSyncStatus('idle');
          return;
      }

      setSyncStatus('pulling');
      
      // Pass a silent callback or null if we don't want to show the full screen loader
      const result = await pullUserDataFromCloud(userId);
      
      if (result.success && result.data) {
          // Note: pullUserDataFromCloud saves to DB, which triggers event.
          // We can also set state directly here for safety.
          const finalData = result.data;
          setDebts(finalData.debts || []);
          setDebtInstallments(finalData.debtInstallments || []); 
          setTasks(finalData.tasks || []);
          setDailyExpenses(finalData.dailyExpenses || []);
          setPaymentRecords(finalData.paymentRecords || []);
          setIncomes(finalData.incomes || []);
          setMonthlyExpenses(finalData.allocations || {});
          setSinkingFunds(finalData.sinkingFunds || []);
          setBankAccounts(finalData.bankAccounts || []);
          
          setSyncStatus('idle');
      } else {
          console.warn("[App] Background sync failed:", result.error);
          setSyncStatus('error');
      }
    } catch (e: any) {
        console.error("[App] Sync Exception:", e);
        setSyncStatus('error');
    }
  };

  useEffect(() => {
    const initApp = async () => {
        // WHITELIST PUBLIC ROUTES: Do NOT check session on landing/login pages
        const hash = window.location.hash;
        if (hash === '#/' || hash === '' || hash.includes('#/login') || hash.includes('#/register')) {
            setIsDataLoaded(true);
            return;
        }

        const storedUserId = localStorage.getItem('paydone_active_user');
        if (!storedUserId) {
            setIsDataLoaded(true);
            return;
        }

        // 1. SET USER & AUTH IMMEDIATELY
        setCurrentUserId(storedUserId);
        setIsAuthenticated(true);
        
        const allUsers = getAllUsers();
        const foundUser = allUsers.find(u => u.id === storedUserId);
        const role = foundUser?.role || (storedUserId === 'u1' ? 'admin' : 'user');
        setUserRole(role);

        // 2. LOAD LOCAL DATA INSTANTLY (No Waiting)
        if (role === 'user') {
            loadLocalDataIntoState(storedUserId);
            
            // 3. TRIGGER BACKGROUND SYNC
            performBackgroundSync(storedUserId);
        }
    };
    initApp();
  }, []);

  // LISTENER FOR DB UPDATES (Crucial for Auto-Sync UI Refresh)
  useEffect(() => {
      const handleDbUpdate = () => {
          if (currentUserId && userRole === 'user') {
              console.log("[App] DB Update Detected. Reloading State...");
              loadLocalDataIntoState(currentUserId);
          }
      };
      window.addEventListener('PAYDONE_DB_UPDATE', handleDbUpdate);
      return () => window.removeEventListener('PAYDONE_DB_UPDATE', handleDbUpdate);
  }, [currentUserId, userRole]);

  const handleManualSync = async () => {
      if (!currentUserId || !isDataLoaded) return;
      setSyncStatus('pushing');
      
      const fullPayload = {
          users: getAllUsers(), 
          debts, debtInstallments, incomes, tasks, dailyExpenses, paymentRecords,
          allocations: monthlyExpenses, sinkingFunds, bankAccounts
      };

      try {
          const success = await pushPartialUpdate(currentUserId, fullPayload);
          if (success) {
              setHasUnsavedChanges(false);
              setSyncStatus('idle');
              setAiResult({ show: true, type: 'success', title: 'Sinkronisasi Cloud', message: 'Seluruh data berhasil diamankan.' });
          } else {
              setSyncStatus('error');
          }
      } catch (e) {
          setSyncStatus('error');
      }
  };

  const handleLogin = (role: 'admin' | 'user', userId: string) => {
    setIsAuthenticated(true);
    setUserRole(role);
    setCurrentUserId(userId);
    localStorage.setItem('paydone_active_user', userId); 
    
    if (role === 'user') {
        loadLocalDataIntoState(userId);
        // performBackgroundSync is redundant here if Login flow already did hydration, 
        // but safe to keep for double check.
    }
  };

  const handleAIAction = (action: any) => {
    if (!currentUserId) return;
    const { intent, data } = action;
    const config = getConfig();
    const isAutoSync = config.advancedConfig?.syncStrategy === 'background';

    if (intent === 'ADD_DAILY_EXPENSE' || intent === 'ADD_EXPENSE') {
        const newItem: DailyExpense = {
            id: `ai-exp-${Date.now()}`,
            userId: currentUserId,
            title: data.title || 'Pengeluaran AI',
            amount: Number(data.amount) || 0,
            category: data.category || 'Others',
            date: toLocalISOString(new Date()),
            updatedAt: new Date().toISOString(),
            _deleted: false
        };
        setDailyExpenses(prev => [newItem, ...prev]);
        saveUserData(currentUserId, { dailyExpenses: [newItem, ...dailyExpenses] });
        
        if (isAutoSync) {
            pushPartialUpdate(currentUserId, { dailyExpenses: [newItem] });
        } else {
            setHasUnsavedChanges(true);
        }
        
        setAiResult({show: true, type: 'success', title: 'Dicatat', message: 'Pengeluaran berhasil disimpan.'});
    }
  };

  // ROBUST ALLOCATION TOGGLE (Fixes Crash)
  const handleToggleAllocation = async (id: string) => {
      const currentList = monthlyExpenses[currentMonthKey] || [];
      const item = currentList.find(i => i.id === id);
      if (!item) return;

      const updatedItem = { ...item, isTransferred: !item.isTransferred, updatedAt: new Date().toISOString() };
      
      // 1. Update Local State (Optimistic)
      setMonthlyExpenses(prev => ({
          ...prev,
          [currentMonthKey]: currentList.map(i => i.id === id ? updatedItem : i)
      }));

      // 2. Save to Cloud/Local (DB)
      // This uses saveItemToCloud which correctly handles array-based storage in DB
      await saveItemToCloud('allocations', updatedItem, false);
  };

  const totalMonthlyIncome = incomes
    .filter(i => i.dateReceived?.startsWith(currentMonthKey) && !i._deleted)
    .reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

  return (
    <I18nProvider>
      <Router>
        {/* SYNC WATCHDOG - Global Component */}
        <SyncWatchdog />
        
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/simulator" element={<Simulator />} />
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="/register" element={<Register />} />

          <Route 
            path="/app" 
            element={isAuthenticated && userRole === 'user' ? (
              // Always show dashboard, sync happens in background status bar
              <DashboardLayout 
                  onLogout={handleLogout} 
                  userId={currentUserId || ''} 
                  syncStatus={syncStatus} 
                  onManualSync={handleManualSync}
                  hasUnsavedChanges={hasUnsavedChanges}
              />
            ) : (
              <Navigate to="/login" replace />
            )}
          >
            <Route index element={
                <div className="space-y-6">
                    <Dashboard debts={debts} debtInstallments={debtInstallments} allocations={monthlyExpenses[currentMonthKey] || []} tasks={tasks} onAIAction={handleAIAction} income={totalMonthlyIncome} userId={currentUserId || ''} dailyExpenses={dailyExpenses} sinkingFunds={sinkingFunds} />
                </div>
            } />
            <Route path="my-debts" element={<MyDebts debts={debts} setDebts={setDebts} paymentRecords={paymentRecords} setPaymentRecords={setPaymentRecords} userId={currentUserId || ''} debtInstallments={debtInstallments} setDebtInstallments={setDebtInstallments} />} />
            <Route path="income" element={<IncomeManager incomes={incomes} setIncomes={setIncomes} userId={currentUserId || ''} />} />
            {/* UPDATED: Pass debtInstallments props and sinkingFunds */}
            <Route path="expenses" element={<DailyExpenses expenses={dailyExpenses} setExpenses={setDailyExpenses} allocations={monthlyExpenses[currentMonthKey] || []} userId={currentUserId || ''} debtInstallments={debtInstallments} setDebtInstallments={setDebtInstallments} sinkingFunds={sinkingFunds} setSinkingFunds={setSinkingFunds} />} />
            <Route path="ai-strategist" element={<AIStrategist debts={debts} onAddTasks={tasks => setTasks(prev => [...prev, ...tasks])} />} />
            <Route path="allocation" element={<Allocation monthlyExpenses={monthlyExpenses} setMonthlyExpenses={setMonthlyExpenses} onAddToDailyLog={handleAIAction} dailyExpenses={dailyExpenses} onToggleAllocation={handleToggleAllocation} sinkingFunds={sinkingFunds} setSinkingFunds={setSinkingFunds} userId={currentUserId || ''} bankAccounts={bankAccounts} setBankAccounts={setBankAccounts} />} />
            <Route path="calendar" element={<CalendarPage debts={debts} debtInstallments={debtInstallments} setDebtInstallments={setDebtInstallments} paymentRecords={paymentRecords} setPaymentRecords={setPaymentRecords} />} />
            <Route path="financial-freedom" element={<FinancialFreedom debts={debts} onAddTasks={tasks => setTasks(prev => [...prev, ...tasks])} />} />
            {/* UPDATED: Pass onToggleAllocation */}
            <Route path="planning" element={<Planning tasks={tasks} debts={debts} debtInstallments={debtInstallments} setDebtInstallments={setDebtInstallments} allocations={monthlyExpenses[currentMonthKey] || []} onToggleTask={id => setTasks(prev => prev.map(t => t.id === id ? { ...t, status: t.status === 'pending' ? 'completed' : 'pending' } : t))} onToggleAllocation={handleToggleAllocation} />} />
            <Route path="logs" element={<ActivityLogs userType="user" />} />
            {/* UPDATED: Pass bankAccounts to Profile */}
            <Route path="profile" element={<Profile currentUserId={currentUserId} bankAccounts={bankAccounts} setBankAccounts={setBankAccounts} />} />
          </Route>

          <Route path="/admin" element={isAuthenticated && userRole === 'admin' ? <AdminLayout onLogout={handleLogout} /> : <Navigate to="/login" replace />}>
            <Route index element={<AdminDashboard />} />
            <Route path="master" element={<MasterData />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="sql-studio" element={<SQLStudio />} />
            <Route path="database" element={<DatabaseManager />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="developer" element={<DeveloperTools />} />
            <Route path="logs" element={<ActivityLogs userType="admin" />} />
            <Route path="ai-center" element={<AICenter />} />
            <Route path="tickets" element={<Tickets />} />
            <Route path="ba" element={<BAAnalyst />} />
            <Route path="qa" element={<QAAnalyst />} />
            <Route path="compare" element={<ServerCompare />} />
            <Route path="terminal" element={<ServerTerminal />} />
            <Route path="git-deploy" element={<GitDeployment />} /> {/* NEW ROUTE */}
          </Route>
        </Routes>

        {aiResult.show && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white rounded-[2.5rem] w-full max-w-sm p-8 shadow-2xl text-center border border-slate-200">
                  <div className="h-16 w-16 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                      <Cloud className="animate-bounce" size={32}/>
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 mb-2">{aiResult.title}</h3>
                  <p className="text-sm text-slate-500 mb-8 font-medium">{aiResult.message}</p>
                  <button onClick={() => setAiResult(prev => ({ ...prev, show: false }))} className="w-full py-4 bg-slate-900 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-slate-800 transition transform active:scale-95 shadow-xl">Siap, Mengerti <ArrowRight className="inline ml-1" size={16}/></button>
              </div>
          </div>
        )}
      </Router>
    </I18nProvider>
  );
}
