
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
import OnboardingWizard from './pages/OnboardingWizard';
import AdminDashboard from './pages/admin/AdminDashboard'; 
import QAAnalyst from './pages/admin/QAAnalyst'; 
import BAAnalyst from './pages/admin/BAAnalyst';
import Tickets from './pages/admin/Tickets';
import ServerCompare from './pages/admin/ServerCompare'; 
import AICenter from './pages/admin/AICenter';

import { getConfig, getUserData, saveUserData, getAllUsers, clearLocalUserData } from './services/mockDb';
import { addLogEntry } from './services/activityLogger';
import { pullUserDataFromCloud, pushUserDataToCloud } from './services/cloudSync';
import { connectWebSocket, disconnectWebSocket, onMessage } from './services/socket'; 
import { CheckCircle2, X, Cloud, CloudOff, RefreshCw, Zap, AlertTriangle, Loader2 } from 'lucide-react';
import { applyTheme } from './services/themeService';
import { I18nProvider } from './services/translationService';

import { DebtItem, LoanType, TaskItem, PaymentRecord, IncomeItem, ExpenseItem, DailyExpense, DebtInstallment, SinkingFund } from './types';

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

  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const [isDataLoaded, setIsDataLoaded] = useState(false); 
  const [syncStatus, setSyncStatus] = useState<'idle' | 'pulling' | 'pushing' | 'error' | 'offline'>('idle');
  const [lastFailedPayload, setLastFailedPayload] = useState<string | null>(null);
  const [syncErrorMsg, setSyncErrorMsg] = useState<string | null>(null); 
  const [realtimeEvent, setRealtimeEvent] = useState<string | null>(null); 
  const [hasCompletedWizard, setHasCompletedWizard] = useState(false); 
  const [initError, setInitError] = useState<string | null>(null);

  // NEW: Progressive Loading State
  const [syncProgressMsg, setSyncProgressMsg] = useState<string | null>(null);

  // NEW: State to track unsaved local changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  // NEW: Ref to prevent the initial load from triggering a "local save" and showing the button
  const ignoreNextSave = useRef(false);

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
    
    // CLEANUP TOKENS TO FORCE FRESH SYNC ON NEXT LOGIN
    localStorage.removeItem('paydone_last_sync_time');
    localStorage.removeItem('paydone_last_pull_time'); // CRITICAL: Reset pull timestamp to force full sync next time
    localStorage.removeItem('paydone_active_user'); 
    localStorage.removeItem('paydone_session_token');
    
    // CLEANUP AI CACHE (Executive Summary)
    sessionStorage.removeItem('paydone_ai_summary');
  };

  // --- WEBSOCKET & SINGLE LOGIN ENFORCEMENT ---
  useEffect(() => {
    if (!currentUserId || userRole !== 'user') return;
    connectWebSocket(currentUserId);
    
    const unsubscribe = onMessage((event) => {
        setRealtimeEvent(event.type);
        if (event.type === 'SYNC_COMPLETE') {
            console.log("[WS] Cloud sync notification received. (Auto-pull disabled)");
        }
    });
    return () => {
        unsubscribe();
    };
  }, [currentUserId, userRole]);

  // --- INITIAL PULL ON LOAD (FORCE FULL SYNC WITH LOADER) ---
  useEffect(() => {
    const initApp = async () => {
        if (!currentUserId || userRole !== 'user') {
            if (!currentUserId) { 
                setDebts([]); setTasks([]); setDailyExpenses([]); setPaymentRecords([]); setIncomes([]); setMonthlyExpenses({}); setSinkingFunds([]);
            }
            setIsDataLoaded(true);
            return;
        }
        setSyncStatus('pulling');
        setInitError(null);
        try {
            // CRITICAL FIX: Force Full Sync on initial load/login to ensure complete dataset
            // Updated to pass callback for progress updates
            const cloudData = await pullUserDataFromCloud(currentUserId, true, (msg) => setSyncProgressMsg(msg));
            
            setSyncProgressMsg("Finalizing..."); // Final UI update
            
            const localData = getUserData(currentUserId);
            const finalData = cloudData || localData;
            
            // Mark next update as clean (from source)
            ignoreNextSave.current = true;

            // Hydrate State
            setDebts(finalData.debts || []);
            setDebtInstallments(finalData.debtInstallments || []); 
            setTasks(finalData.tasks || []);
            setDailyExpenses(finalData.dailyExpenses || []);
            setPaymentRecords(finalData.paymentRecords || []);
            setIncomes(finalData.incomes || []);
            setMonthlyExpenses(finalData.allocations || {});
            setSinkingFunds(finalData.sinkingFunds || []);
            
            // Reset unsaved changes flag on initial load
            setHasUnsavedChanges(false); 
            setSyncStatus('idle');
            setSyncProgressMsg(null); // Clear Loader
            setIsDataLoaded(true); 
        } catch (e: any) {
            if (e.message === 'SESSION_EXPIRED') {
                alert("Sesi berakhir atau tidak valid. Silakan login kembali.");
                handleLogout();
            } else {
                setSyncStatus('error');
                setInitError(e.message);
                setSyncProgressMsg(null);
                // Fallback to local if cloud fails
                const localData = getUserData(currentUserId);
                if (localData) {
                    ignoreNextSave.current = true;
                    setDebts(localData.debts || []);
                    setDebtInstallments(localData.debtInstallments || []);
                    setTasks(localData.tasks || []);
                    setDailyExpenses(localData.dailyExpenses || []);
                    setPaymentRecords(localData.paymentRecords || []);
                    setIncomes(localData.incomes || []); // Ensure complete fallback
                    setMonthlyExpenses(localData.allocations || {});
                    setSinkingFunds(localData.sinkingFunds || []);
                    
                    // If we fall back to local, it means we ARE "Unsaved" relative to cloud (since cloud failed)
                    setHasUnsavedChanges(true); 
                }
                setIsDataLoaded(true);
            }
        }
    };
    initApp();
  }, [currentUserId, userRole]);

  // --- CRITICAL: AUTO-SAVE & DIRTY CHECK ---
  useEffect(() => {
    if (!currentUserId || userRole !== 'user' || !isDataLoaded) return;
    
    // If this update was triggered by a Pull or Init, skip marking as dirty
    if (ignoreNextSave.current) {
        ignoreNextSave.current = false;
        return;
    }

    // Persist to local MockDB
    saveUserData(currentUserId, {
        debts,
        debtInstallments,
        tasks,
        dailyExpenses,
        paymentRecords,
        incomes,
        allocations: monthlyExpenses,
        sinkingFunds
    });
    
    // Mark as dirty (Show "Save to Cloud" button)
    setHasUnsavedChanges(true);

  }, [debts, debtInstallments, tasks, dailyExpenses, paymentRecords, incomes, monthlyExpenses, sinkingFunds, currentUserId, userRole, isDataLoaded]);

  // --- MANUAL SYNC HANDLER ---
  const handleManualSync = async () => {
      if (!currentUserId || !isDataLoaded) return;
      
      setSyncStatus('pushing');
      setLastFailedPayload(null);
      setSyncErrorMsg(null);
      
      const fullPayload = {
          users: getAllUsers(), 
          debts,
          debtInstallments,
          incomes, 
          tasks,
          dailyExpenses,
          paymentRecords,
          allocations: monthlyExpenses,
          sinkingFunds
      };

      try {
          const success = await pushUserDataToCloud(currentUserId, fullPayload as any);
          if (success) {
              // 1. Clear Local Data (as requested)
              clearLocalUserData(currentUserId);
              
              // 2. Hide Button
              setHasUnsavedChanges(false);
              
              // 3. Mark next state update as clean
              ignoreNextSave.current = true; 

              setSyncStatus('idle');
              setAiResult({ show: true, type: 'success', title: 'Berhasil!', message: 'Data tersimpan di cloud & memori lokal dibersihkan.' });
          }
      } catch (e: any) {
          if (e.message === 'SESSION_EXPIRED') {
              handleLogout();
          } else {
              setSyncStatus('error');
              setLastFailedPayload(JSON.stringify(fullPayload, null, 2));
              setSyncErrorMsg(e.message);
          }
      }
  };

  const handleLogin = (role: 'admin' | 'user', userId: string) => {
    setIsAuthenticated(true);
    setUserRole(role);
    setCurrentUserId(userId);
    localStorage.setItem('paydone_active_user', userId); 
    setIsDataLoaded(false);
    setHasCompletedWizard(false); 
  };

  const addTasks = (newTasks: TaskItem[]) => {
    const enriched = newTasks.map(t => ({ ...t, userId: currentUserId || '' }));
    setTasks(prev => [...prev, ...enriched]);
  };

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => 
      t.id === id ? { ...t, status: t.status === 'pending' ? 'completed' : 'pending' } : t
    ));
  };

  const handleToggleAllocation = (id: string) => {
    setMonthlyExpenses(prev => {
      const list = prev[currentMonthKey] || [];
      const updatedList = list.map(e => {
           if (e.id === id) {
             return { ...e, isTransferred: !e.isTransferred };
           }
           return e;
      });
      return { ...prev, [currentMonthKey]: updatedList };
    });
  };

  const handleAddDailyExpense = (expense: DailyExpense) => {
    setDailyExpenses(prev => [expense, ...prev]);
  };

  const handleWizardComplete = (newIncomes: IncomeItem[], newDebts: DebtItem[]) => {
      if (!currentUserId) return;
      setIncomes(newIncomes.map(i => ({...i, userId: currentUserId})));
      setDebts(newDebts.map(d => ({...d, userId: currentUserId})));
      setHasCompletedWizard(true);
  };

  // --- SMART OMNI-ACTION HANDLER ---
  const handleAIAction = (action: any) => {
    if (!currentUserId) return;
    const { intent, data } = action;
    const now = new Date().toISOString();

    if (intent === 'ADD_DAILY_EXPENSE' || intent === 'ADD_EXPENSE') {
        const newExpense: DailyExpense = {
            id: `ai-exp-${Date.now()}`,
            userId: currentUserId,
            title: data.title || 'Pengeluaran AI',
            amount: Number(data.amount) || 0,
            category: data.category || 'Others',
            date: new Date().toISOString().split('T')[0],
            updatedAt: now,
            _deleted: false
        };
        setDailyExpenses(prev => [newExpense, ...prev]);
        setAiResult({show: true, type: 'success', title: 'Dicatat', message: 'Pengeluaran berhasil disimpan.'});
    
    } else if (intent === 'ADD_INCOME') {
        const newIncome: IncomeItem = {
            id: `ai-inc-${Date.now()}`,
            userId: currentUserId,
            source: data.title || 'Income AI',
            amount: Number(data.amount) || 0,
            type: data.category === 'Passive' ? 'passive' : 'active',
            frequency: 'monthly',
            dateReceived: new Date().toISOString().split('T')[0],
            updatedAt: now,
            _deleted: false
        };
        setIncomes(prev => [...prev, newIncome]);
        setAiResult({show: true, type: 'success', title: 'Dicatat', message: 'Pemasukan berhasil ditambahkan.'});

    } else if (intent === 'ADD_ALLOCATION') {
        const newItem: ExpenseItem = {
            id: `ai-alloc-${Date.now()}`,
            userId: currentUserId,
            name: data.title || 'Budget Baru',
            amount: Number(data.amount) || 0,
            category: 'needs',
            priority: 1,
            isTransferred: false,
            assignedAccountId: null,
            updatedAt: now,
            _deleted: false
        };
        setMonthlyExpenses(prev => ({
            ...prev,
            [currentMonthKey]: [...(prev[currentMonthKey] || []), newItem]
        }));
        setAiResult({show: true, type: 'success', title: 'Budget Dibuat', message: `Pos ${newItem.name} ditambahkan.`});

    } else if (intent === 'PAY_DEBT') {
        const debtId = data.debtId;
        if (debtId) {
            const newPayment: PaymentRecord = {
                id: `ai-pay-${Date.now()}`,
                debtId: debtId,
                userId: currentUserId,
                amount: Number(data.amount) || 0,
                paidDate: new Date().toISOString().split('T')[0],
                sourceBank: 'AI Command',
                status: 'paid',
                updatedAt: now
            };
            setPaymentRecords(prev => [...prev, newPayment]);
            setAiResult({show: true, type: 'success', title: 'Lunas!', message: 'Pembayaran cicilan dicatat.'});
        }
    }
  };

  const totalMonthlyIncome = incomes
    .filter(i => i.dateReceived?.startsWith(currentMonthKey))
    .reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

  return (
    <I18nProvider>
      <Router>
        {/* FULL SCREEN PROGRESS LOADER */}
        {syncProgressMsg && (
            <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-md animate-fade-in text-white">
                <div className="relative">
                    <div className="h-16 w-16 rounded-full border-4 border-slate-700 border-t-brand-500 animate-spin mb-4"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Cloud className="text-white" size={24}/>
                    </div>
                </div>
                <h2 className="text-xl font-bold mb-2">Syncing Data...</h2>
                <p className="text-slate-400 text-sm font-mono animate-pulse">{syncProgressMsg}</p>
            </div>
        )}

        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/simulator" element={<Simulator />} />
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="/register" element={<Register />} />

          <Route 
            path="/app" 
            element={isAuthenticated && userRole === 'user' ? (
              isDataLoaded && !syncProgressMsg ? (
                  <>
                      <DashboardLayout 
                          onLogout={handleLogout} 
                          userId={currentUserId || ''} 
                          syncStatus={syncStatus} 
                          onManualSync={handleManualSync}
                          lastFailedPayload={lastFailedPayload}
                          lastSyncError={syncErrorMsg}
                          hasUnsavedChanges={hasUnsavedChanges} // Pass dirty state prop
                      />
                      {!hasCompletedWizard && debts.length === 0 && incomes.length === 0 && (
                          <OnboardingWizard onComplete={handleWizardComplete} />
                      )}
                  </>
              ) : (
                  <div className="flex h-screen w-full flex-col items-center justify-center bg-white p-6 text-center">
                      {!syncProgressMsg && (
                          <>
                              <Cloud size={48} className="text-brand-600 animate-bounce mb-4" />
                              <h2 className="text-xl font-bold text-slate-900">V42 Security Initialization...</h2>
                              <p className="text-sm text-slate-500">Checking cloud identity for your account.</p>
                          </>
                      )}
                  </div>
              )
            ) : (
              <Navigate to="/login" replace />
            )}
          >
            <Route index element={
                <Dashboard 
                    debts={debts} 
                    debtInstallments={debtInstallments} 
                    allocations={monthlyExpenses[currentMonthKey] || []} 
                    tasks={tasks} 
                    onAIAction={handleAIAction} 
                    income={totalMonthlyIncome} 
                    userId={currentUserId || ''}
                    dailyExpenses={dailyExpenses} 
                    sinkingFunds={sinkingFunds}
                />
            } />
            <Route path="my-debts" element={<MyDebts debts={debts} setDebts={setDebts} paymentRecords={paymentRecords} setPaymentRecords={setPaymentRecords} userId={currentUserId || ''} debtInstallments={debtInstallments} setDebtInstallments={setDebtInstallments} />} />
            <Route path="income" element={<IncomeManager incomes={incomes} setIncomes={setIncomes} userId={currentUserId || ''} />} />
            <Route path="expenses" element={<DailyExpenses expenses={dailyExpenses} setExpenses={setDailyExpenses} allocations={monthlyExpenses[currentMonthKey] || []} userId={currentUserId || ''} />} />
            <Route path="ai-strategist" element={<AIStrategist debts={debts} onAddTasks={addTasks} />} />
            <Route path="allocation" element={<Allocation monthlyExpenses={monthlyExpenses} setMonthlyExpenses={setMonthlyExpenses} onAddToDailyLog={handleAddDailyExpense} dailyExpenses={dailyExpenses} onToggleAllocation={handleToggleAllocation} sinkingFunds={sinkingFunds} setSinkingFunds={setSinkingFunds} userId={currentUserId || ''} />} />
            <Route path="calendar" element={<CalendarPage debts={debts} debtInstallments={debtInstallments} setDebtInstallments={setDebtInstallments} paymentRecords={paymentRecords} setPaymentRecords={setPaymentRecords} />} />
            <Route path="financial-freedom" element={<FinancialFreedom debts={debts} onAddTasks={addTasks} />} />
            <Route path="planning" element={<Planning tasks={tasks} debts={debts} allocations={monthlyExpenses[currentMonthKey] || []} onToggleTask={toggleTask} onToggleAllocation={handleToggleAllocation} />} />
            <Route path="team" element={<FamilyManager />} /> 
            <Route path="logs" element={<ActivityLogs userType="user" />} />
            <Route path="profile" element={<Profile currentUserId={currentUserId} />} />
          </Route>

          <Route 
            path="/admin" 
            element={isAuthenticated && userRole === 'admin' ? <AdminLayout onLogout={handleLogout} /> : <Navigate to="/login" replace />}
          >
            <Route index element={<AdminDashboard />} />
            <Route path="master" element={<MasterData />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="database" element={<DatabaseManager />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="developer" element={<DeveloperTools />} />
            <Route path="logs" element={<ActivityLogs userType="admin" />} />
            <Route path="qa" element={<QAAnalyst />} /> 
            <Route path="ba" element={<BAAnalyst />} /> 
            <Route path="tickets" element={<Tickets />} />
            <Route path="compare" element={<ServerCompare />} /> 
            <Route path="ai-center" element={<AICenter />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        {aiResult.show && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white rounded-2xl w-full max-sm p-6 shadow-2xl relative overflow-hidden transform transition-all scale-100">
                  <div className="relative z-10 text-center">
                      <div className={`mx-auto h-16 w-16 rounded-full flex items-center justify-center mb-4 ${aiResult.type === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                        {aiResult.type === 'success' ? <CheckCircle2 size={32} /> : <X size={32} />}
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2">{aiResult.title}</h3>
                      <p className="text-sm text-slate-500 mb-6">{aiResult.message}</p>
                      <button onClick={() => setAiResult(prev => ({ ...prev, show: false }))} className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition">
                        Selesai
                      </button>
                  </div>
              </div>
          </div>
        )}
      </Router>
    </I18nProvider>
  );
}
