
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

import { getConfig, getUserData, saveUserData, getAllUsers } from './services/mockDb';
import { pullUserDataFromCloud, pushPartialUpdate } from './services/cloudSync';
import { connectWebSocket, disconnectWebSocket } from './services/socket'; 
import { Cloud, RefreshCw, AlertCircle, CloudDownload, ArrowRight } from 'lucide-react';
import { applyTheme } from './services/themeService';
import { I18nProvider } from './services/translationService';

import { DebtItem, TaskItem, PaymentRecord, IncomeItem, ExpenseItem, DailyExpense, DebtInstallment, SinkingFund } from './types';

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

  // INITIAL LOAD HANDLER
  const performInitialSync = async (userId: string) => {
    setSyncStatus('pulling');
    setSyncError(null);
    
    const result = await pullUserDataFromCloud(userId, (msg) => setSyncProgressMsg(msg));
    
    if (result.success && result.data) {
        const finalData = result.data;
        setDebts(finalData.debts || []);
        setDebtInstallments(finalData.debtInstallments || []); 
        setTasks(finalData.tasks || []);
        setDailyExpenses(finalData.dailyExpenses || []);
        setPaymentRecords(finalData.paymentRecords || []);
        setIncomes(finalData.incomes || []);
        setMonthlyExpenses(finalData.allocations || {});
        setSinkingFunds(finalData.sinkingFunds || []);
        
        setSyncStatus('idle');
        setSyncProgressMsg(null);
        setIsDataLoaded(true); 
    } else {
        setSyncStatus('error');
        setSyncError(result.error || "Gagal sinkronisasi data.");
        setSyncProgressMsg(null);
        // Tetap tandai loaded agar user bisa masuk dashboard, tapi dengan data lokal lama
        setIsDataLoaded(true); 
    }
  };

  useEffect(() => {
    const initApp = async () => {
        const storedUserId = localStorage.getItem('paydone_active_user');
        if (!storedUserId) {
            setIsDataLoaded(true);
            return;
        }

        setCurrentUserId(storedUserId);
        setIsAuthenticated(true);
        setUserRole(storedUserId === 'u1' ? 'admin' : 'user');

        await performInitialSync(storedUserId);
    };
    initApp();
  }, []);

  const handleManualSync = async () => {
      if (!currentUserId || !isDataLoaded) return;
      setSyncStatus('pushing');
      
      const fullPayload = {
          users: getAllUsers(), 
          debts, debtInstallments, incomes, tasks, dailyExpenses, paymentRecords,
          allocations: monthlyExpenses, sinkingFunds
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
    window.location.reload(); 
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
            date: new Date().toISOString().split('T')[0],
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

  const totalMonthlyIncome = incomes
    .filter(i => i.dateReceived?.startsWith(currentMonthKey) && !i._deleted)
    .reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

  return (
    <I18nProvider>
      <Router>
        {syncProgressMsg && (
            <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-md animate-fade-in text-white">
                <div className="h-16 w-16 rounded-full border-4 border-slate-700 border-t-brand-500 animate-spin mb-4"></div>
                <h2 className="text-xl font-bold mb-2">Sinkronisasi Cloud...</h2>
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
              isDataLoaded ? (
                  <DashboardLayout 
                      onLogout={handleLogout} 
                      userId={currentUserId || ''} 
                      syncStatus={syncStatus} 
                      onManualSync={handleManualSync}
                      hasUnsavedChanges={hasUnsavedChanges}
                  />
              ) : (
                  <div className="flex h-screen w-full flex-col items-center justify-center bg-white p-6">
                      <Cloud size={48} className="text-brand-600 animate-bounce mb-4" />
                      <h2 className="text-xl font-bold">Inisialisasi Keamanan V42...</h2>
                  </div>
              )
            ) : (
              <Navigate to="/login" replace />
            )}
          >
            <Route index element={
                <div className="space-y-6">
                    {syncError && (
                        <div className="bg-red-50 border-2 border-red-200 p-6 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4 animate-shake">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-red-100 text-red-600 rounded-2xl"><AlertCircle size={24}/></div>
                                <div>
                                    <h3 className="font-bold text-red-900">Gagal Sinkronisasi Awal</h3>
                                    <p className="text-xs text-red-700 mt-1">Backend: "{syncError}"</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => performInitialSync(currentUserId!)}
                                className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition shadow-lg shadow-red-200"
                            >
                                <CloudDownload size={18}/> Coba Tarik Data Lagi
                            </button>
                        </div>
                    )}
                    <Dashboard debts={debts} debtInstallments={debtInstallments} allocations={monthlyExpenses[currentMonthKey] || []} tasks={tasks} onAIAction={handleAIAction} income={totalMonthlyIncome} userId={currentUserId || ''} dailyExpenses={dailyExpenses} sinkingFunds={sinkingFunds} />
                </div>
            } />
            <Route path="my-debts" element={<MyDebts debts={debts} setDebts={setDebts} paymentRecords={paymentRecords} setPaymentRecords={setPaymentRecords} userId={currentUserId || ''} debtInstallments={debtInstallments} setDebtInstallments={setDebtInstallments} />} />
            <Route path="income" element={<IncomeManager incomes={incomes} setIncomes={setIncomes} userId={currentUserId || ''} />} />
            <Route path="expenses" element={<DailyExpenses expenses={dailyExpenses} setExpenses={setDailyExpenses} allocations={monthlyExpenses[currentMonthKey] || []} userId={currentUserId || ''} />} />
            <Route path="ai-strategist" element={<AIStrategist debts={debts} onAddTasks={tasks => setTasks(prev => [...prev, ...tasks])} />} />
            <Route path="allocation" element={<Allocation monthlyExpenses={monthlyExpenses} setMonthlyExpenses={setMonthlyExpenses} onAddToDailyLog={handleAIAction} dailyExpenses={dailyExpenses} onToggleAllocation={id => setMonthlyExpenses(prev => { const list = prev[currentMonthKey] || []; return { ...prev, [currentMonthKey]: list.map(e => e.id === id ? { ...e, isTransferred: !e.isTransferred } : e) }; })} sinkingFunds={sinkingFunds} setSinkingFunds={setSinkingFunds} userId={currentUserId || ''} />} />
            <Route path="calendar" element={<CalendarPage debts={debts} debtInstallments={debtInstallments} setDebtInstallments={setDebtInstallments} paymentRecords={paymentRecords} setPaymentRecords={setPaymentRecords} />} />
            <Route path="financial-freedom" element={<FinancialFreedom debts={debts} onAddTasks={tasks => setTasks(prev => [...prev, ...tasks])} />} />
            <Route path="planning" element={<Planning tasks={tasks} debts={debts} allocations={monthlyExpenses[currentMonthKey] || []} onToggleTask={id => setTasks(prev => prev.map(t => t.id === id ? { ...t, status: t.status === 'pending' ? 'completed' : 'pending' } : t))} />} />
            <Route path="logs" element={<ActivityLogs userType="user" />} />
            <Route path="profile" element={<Profile currentUserId={currentUserId} />} />
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
