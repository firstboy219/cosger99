
import React, { useState, useEffect, useMemo } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell, PieChart, Pie, Legend, ReferenceLine, ComposedChart, Line
} from 'recharts';
import { 
  Mic, Send, Sparkles, TrendingDown, TrendingUp,
  Zap, Wind, Activity, Wallet, PiggyBank, BrainCircuit, X,
  FastForward, HeartPulse, ArrowRight, Info, Calendar, ShieldCheck, Target, 
  LayoutDashboard, AlertTriangle, Scale, Calculator, ArrowUpRight, ArrowDownRight,
  PieChart as PieIcon, BarChart3, AlertCircle, CheckCircle2, Scissors, Briefcase, GraduationCap, Hourglass, Landmark, Coins, Loader2, Search, Bot, ReceiptText, MessageCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DebtItem, ExpenseItem, TaskItem, DailyExpense, DebtInstallment, SinkingFund } from '../types';
import { formatCurrency, getMonthDiff, generateInstallmentsForDebt, safeDateISO } from '../services/financeUtils';
import { getAllUsers, getConfig, getUserData } from '../services/mockDb';
import { parseTransactionAI, generateDashboardSummary } from '../services/geminiService';

interface DashboardProps {
  debts: DebtItem[];
  debtInstallments?: DebtInstallment[];
  allocations: ExpenseItem[]; 
  tasks: TaskItem[];
  income?: number;
  onAIAction?: (action: any) => void;
  userId: string;
  dailyExpenses?: DailyExpense[];
  sinkingFunds?: SinkingFund[]; 
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function Dashboard({ debts, debtInstallments = [], allocations, income = 0, onAIAction, userId, dailyExpenses = [], sinkingFunds = [] }: DashboardProps) {
  const navigate = useNavigate();
  const [omniInput, setOmniInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // --- AI SUMMARY STATE ---
  const [aiSummary, setAiSummary] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(false);
  
  // --- CONTEXT AWARE STATE ---
  const [clarificationMode, setClarificationMode] = useState<string | null>(null); 
  const [aiQuestion, setAiQuestion] = useState<string | null>(null);

  // --- AI MODAL STATE ---
  const [showOmniPlan, setShowOmniPlan] = useState(false);
  const [parsedPlan, setParsedPlan] = useState<any>(null); 

  // --- FREEDOM MATRIX STATE ---
  const [extraPayment, setExtraPayment] = useState(1000000); // Slider Value
  const [freedomStrategy, setFreedomStrategy] = useState<'lump_sum' | 'cutoff'>('lump_sum');

  // --- 1. CORE DATA ENGINE ---
  const { 
      totalDebt, totalMonthlyObligation, activeDebts, 
      totalRealExpenses, totalLivingCost, netCashflow,
      expenseByCategory, capacityData, healthMetrics, crossingData, freedomMatrixData,
      decisionPain, currentMonthLabel
  } = useMemo(() => {
      // 1. Filter Active Debts
      const validDebts = (debts || []).filter(d => !d._deleted).map((d: any) => ({
          ...d,
          remainingPrincipal: Number(d.remainingPrincipal || 0),
          monthlyPayment: Number(d.monthlyPayment || 0),
          interestRate: Number(d.interestRate || 10),
          startDate: d.startDate || new Date().toISOString(),
          endDate: d.endDate || new Date().toISOString()
      }));

      const tDebt = validDebts.reduce((a, b) => a + Number(b.remainingPrincipal || 0), 0);
      const tObligation = validDebts.reduce((a, b) => a + Number(b.monthlyPayment || 0), 0);
      const realExp = (dailyExpenses || []).reduce((a, b) => a + Number(b.amount || 0), 0);
      
      const catMap: Record<string, number> = { 'Needs': 0, 'Wants': 0, 'Debt': 0, 'Savings': 0 };
      catMap['Debt'] = tObligation;

      // 2. Calculate Living Cost from Allocations (Routine Pockets)
      let calculatedLivingCost = 0;
      if (allocations && allocations.length > 0) {
          allocations.forEach(item => {
              const amount = Number(item.amount || 0);
              if (item.category === 'needs' || item.category === 'wants') {
                  calculatedLivingCost += amount;
                  if (item.category === 'needs') catMap['Needs'] += amount;
                  if (item.category === 'wants') catMap['Wants'] += amount;
              }
          });
      } else {
          const disposable = Math.max(0, income - tObligation);
          catMap['Needs'] = disposable * 0.5;
          catMap['Wants'] = disposable * 0.3;
          calculatedLivingCost = catMap['Needs'] + catMap['Wants'];
      }

      const tLiving = calculatedLivingCost;
      const monthlyBurn = tObligation + tLiving;
      
      const totalSavings = (sinkingFunds || []).reduce((acc, sf) => acc + Number(sf.currentAmount || 0), 0);
      const config = getConfig();
      const assumedCash = config.advancedConfig?.runwayAssumption || 0;
      const liquidAssets = totalSavings + assumedCash;
      const runwayMonths = monthlyBurn > 0 ? liquidAssets / monthlyBurn : 0;

      const dsr = income > 0 ? (tObligation / income) * 100 : 0;
      const dsrStatus = dsr < (config.systemRules?.dsrSafeLimit || 30) ? 'Sehat' : (dsr < (config.systemRules?.dsrWarningLimit || 45) ? 'Waspada' : 'Bahaya');

      // --- CROSSING ANALYSIS DATA (REAL DATE RANGE) ---
      let crossingData = [];
      const currentDate = new Date();
      const currentMonthLabel = currentDate.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });

      // Determine Date Range from Debts
      let minDate = new Date();
      let maxDate = new Date();
      
      if (validDebts.length > 0) {
          // Earliest start date
          const startDates = validDebts.map(d => new Date(d.startDate).getTime());
          minDate = new Date(Math.min(...startDates));
          
          // Latest end date
          const endDates = validDebts.map(d => new Date(d.endDate).getTime());
          maxDate = new Date(Math.max(...endDates));
      } else {
          // Default range if no debts: Current Year
          minDate.setMonth(0);
          maxDate.setMonth(11);
      }

      // Generate Amortization for ALL debts
      let aggregatedInstallments: { date: string, amount: number }[] = [];
      validDebts.forEach(debt => {
          const schedule = generateInstallmentsForDebt(debt, []); 
          schedule.forEach(inst => {
              aggregatedInstallments.push({ date: inst.dueDate.slice(0, 7), amount: inst.amount });
          });
      });

      // Loop month by month from Min to Max
      const iterDate = new Date(minDate);
      iterDate.setDate(1); // Start of month
      
      // Limit iterations to prevent crashing (max 20 years = 240 months)
      let safetyCounter = 0;
      while (iterDate <= maxDate && safetyCounter < 240) {
          const monthKey = iterDate.toISOString().slice(0, 7); // YYYY-MM
          const monthLabel = iterDate.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });

          const monthlyDebtPayment = aggregatedInstallments
              .filter(item => item.date === monthKey)
              .reduce((sum, item) => sum + item.amount, 0);

          crossingData.push({
              month: monthLabel,
              income: income,
              obligation: monthlyDebtPayment, 
              totalExp: monthlyDebtPayment + tLiving,
              livingCost: tLiving
          });

          // Increment Month
          iterDate.setMonth(iterDate.getMonth() + 1);
          safetyCounter++;
      }

      // --- FREEDOM MATRIX DATA (Debt Reduction Curves) ---
      const matrixData = [];
      const monthsLimit = 120; // 10 Years view
      
      let balanceStd = tDebt;
      let balancePaydone = tDebt; // Jalur Paydone (Direct Payment)
      let savingsAccumulated = 0; // Tabungan Cutoff (Ungu)
      let freedomMonth = 0; // Kapan lunas?

      for (let i = 0; i <= monthsLimit; i++) {
          const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
          const monthLabel = date.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
          
          // 1. Standard Path (Minimum Payment)
          if (balanceStd > 0) {
              const interest = (balanceStd * 0.1) / 12; // Approx 10% avg interest
              balanceStd = balanceStd - (tObligation - interest);
              if (balanceStd < 0) balanceStd = 0;
          }

          // 2. Paydone Path (Logic depends on Strategy)
          if (freedomStrategy === 'lump_sum') {
              // Direct Extra Payment: Reduces Principal Faster
              if (balancePaydone > 0) {
                  const interest = (balancePaydone * 0.1) / 12;
                  balancePaydone = balancePaydone - (tObligation + extraPayment - interest);
                  if (balancePaydone < 0) {
                      balancePaydone = 0;
                      if (freedomMonth === 0) freedomMonth = i;
                  }
              }
          } else {
              // Cutoff Strategy: Accumulate Savings, Pay Debt Normally until Intersection
              if (balancePaydone > 0) {
                  const interest = (balancePaydone * 0.1) / 12;
                  balancePaydone = balancePaydone - (tObligation - interest); // Pay Normal
                  if (balancePaydone < 0) balancePaydone = 0;
                  
                  // Accumulate Savings
                  savingsAccumulated += extraPayment;
                  
                  // Check Intersection (Cutoff)
                  if (savingsAccumulated >= balancePaydone && freedomMonth === 0) {
                      freedomMonth = i;
                      // Visual Effect: Drop debt to 0 at this point
                      balancePaydone = 0;
                  }
              }
          }

          matrixData.push({
              name: monthLabel,
              Standard: Math.round(balanceStd),
              Paydone: Math.round(balancePaydone),
              Savings: freedomStrategy === 'cutoff' ? Math.round(savingsAccumulated) : null
          });
      }

      // --- WHICH PAIN DECISION LOGIC ---
      const safeDSR = 30; // 30%
      const targetIncome = tObligation / (safeDSR / 100);
      const incomeGap = Math.max(0, targetIncome - income);
      
      const targetObligation = income * (safeDSR / 100);
      const debtReductionNeeded = Math.max(0, tObligation - targetObligation);
      const assetValueToSell = debtReductionNeeded * 50; 

      const decisionPain = {
          dsr,
          incomeGap,
          debtReductionMonthly: debtReductionNeeded,
          assetSellTarget: assetValueToSell
      };

      return {
          totalDebt: tDebt,
          totalMonthlyObligation: tObligation,
          activeDebts: validDebts,
          totalRealExpenses: realExp,
          totalLivingCost: tLiving, 
          netCashflow: income - (tObligation + realExp),
          expenseByCategory: [
              { name: 'Needs (50%)', value: catMap['Needs'], fill: '#3b82f6' },
              { name: 'Wants (30%)', value: catMap['Wants'], fill: '#f59e0b' },
              { name: 'Debt (Max 30%)', value: catMap['Debt'], fill: '#ef4444' }, 
          ],
          capacityData: [
              { name: 'Kapasitas Bayar', value: Math.max(0, income - tLiving) },
              { name: 'Kewajiban Hutang', value: tObligation }
          ],
          healthMetrics: { dsr, dsrStatus, runwayMonths },
          crossingData,
          freedomMatrixData: { data: matrixData, freedomMonth },
          decisionPain,
          currentMonthLabel
      };
  }, [debts, dailyExpenses, income, allocations, sinkingFunds, extraPayment, freedomStrategy]);

  // --- GENERATE AI SUMMARY (OPTIMIZED: SESSION CACHE) ---
  useEffect(() => {
      const fetchSummary = async () => {
          if (!userId || income <= 0) return;

          // 1. Check Cache First
          const cachedSummary = sessionStorage.getItem('paydone_ai_summary');
          if (cachedSummary) {
              setAiSummary(cachedSummary);
              return;
          }

          setLoadingSummary(true);
          const metrics = {
              dsr: healthMetrics.dsr,
              runway: healthMetrics.runwayMonths,
              netCashflow,
              totalDebt,
              income,
              debtCount: activeDebts.length
          };
          
          try {
              const text = await generateDashboardSummary(metrics);
              setAiSummary(text);
              sessionStorage.setItem('paydone_ai_summary', text); // Cache it
          } catch (e) {
              console.error("AI Summary Error", e);
          } finally {
              setLoadingSummary(false);
          }
      };
      
      fetchSummary();
  }, [userId, healthMetrics.dsr, netCashflow]); // Only runs if metrics change significantly or initial load

  // --- SMART AI LOGIC ---
  const handleOmniCommand = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!omniInput.trim()) return;
      setIsAnalyzing(true);
      setParsedPlan(null); setAiQuestion(null);

      try {
          let finalInput = omniInput;
          if (clarificationMode) finalInput = `[Previous Context: ${clarificationMode}] User Answer: ${omniInput}`;

          const contextData = {
              debts: activeDebts.map(d => ({ name: d.name, monthlyPayment: d.monthlyPayment })),
              allocations: allocations.map(a => ({ name: a.name, amount: a.amount })),
              income
          };

          const result = await parseTransactionAI(finalInput, contextData);
          
          if (result && result.intent === 'CLARIFICATION') {
              setClarificationMode(finalInput);
              setAiQuestion(result.question || "Mohon perjelas maksud Anda.");
              setOmniInput(''); 
          } else if (result && result.intent && result.intent !== 'ERROR') {
              const { intent, data } = result;
              let status: 'ready' | 'missing_data' = 'ready';
              let displayTitle = '';
              let matchedData = null;

              if (intent === 'PAY_DEBT') {
                  displayTitle = 'Bayar Cicilan';
                  const match = debts.find(d => d.name.toLowerCase().includes((data.matchedItemName || data.title || '').toLowerCase()));
                  if (match) { matchedData = match; if (!data.amount) data.amount = match.monthlyPayment; } else { status = 'missing_data'; }
              } else if (intent === 'ADD_INCOME') { displayTitle = 'Tambah Pemasukan'; if (!data.amount) status = 'missing_data'; }
              else if (intent === 'ADD_EXPENSE') { displayTitle = 'Catat Pengeluaran'; if (!data.amount) status = 'missing_data'; }
              else if (intent === 'ADD_DEBT') { displayTitle = 'Tambah Hutang Baru'; if (!data.amount) status = 'missing_data'; }
              else if (intent === 'ADD_ALLOCATION') { displayTitle = 'Buat Budget Baru'; if (!data.amount) status = 'missing_data'; }

              setParsedPlan({ originalInput: omniInput, intent, amount: data.amount || 0, displayTitle, data, matchedData, status });
              setShowOmniPlan(true); setClarificationMode(null); setAiQuestion(null);
          } else { alert("Maaf, AI tidak mengerti."); }
      } catch (e) { alert("Gagal menghubungi AI."); } finally { setIsAnalyzing(false); }
  };

  const executeOmniPlan = () => {
      if (!parsedPlan || !onAIAction) return;
      const payload: any = { intent: parsedPlan.intent, data: { ...parsedPlan.data, amount: parsedPlan.amount } };
      if (parsedPlan.intent === 'PAY_DEBT' && parsedPlan.matchedData) payload.data.debtId = parsedPlan.matchedData.id;
      onAIAction(payload);
      setShowOmniPlan(false); setOmniInput('');
  };

  return (
    <div className="min-h-screen space-y-8 pb-24 font-sans text-slate-900">
      
      {/* 1. HEADER & AI COMMAND CENTER */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
                  <LayoutDashboard className="text-slate-400" size={32}/> Financial Cockpit
              </h1>
              <p className="text-slate-500 font-medium mt-1">Analisa 360° Kesehatan & Strategi Keuangan Anda</p>
          </div>
          <div className="w-full lg:w-[600px] relative group z-30">
              <div className={`absolute inset-0 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500 ${aiQuestion ? 'bg-amber-500' : 'bg-gradient-to-r from-blue-500 to-indigo-600'}`}></div>
              <form onSubmit={handleOmniCommand} className={`relative bg-white rounded-2xl shadow-xl border flex items-center p-2 transition-all focus-within:ring-2 ${aiQuestion ? 'border-amber-300 ring-amber-200' : 'border-slate-200 focus-within:ring-blue-500/50'}`}>
                  <div className={`pl-3 pr-3 ${aiQuestion ? 'text-amber-500 animate-pulse' : 'text-brand-600'}`}>
                      {isAnalyzing ? <Loader2 size={24} className="animate-spin text-indigo-600"/> : aiQuestion ? <MessageCircle size={24}/> : <BrainCircuit size={24} className={omniInput ? "text-indigo-600" : ""} />}
                  </div>
                  <input type="text" className="flex-1 bg-transparent border-none outline-none text-slate-800 placeholder-slate-400 text-sm font-bold py-2.5" placeholder={isAnalyzing ? "AI Sedang Menerjemahkan..." : aiQuestion ? aiQuestion : "Ketik: 'tambah income 5jt', 'bayar kpr', 'beli kopi 20rb'"} value={omniInput} onChange={e => setOmniInput(e.target.value)} disabled={isAnalyzing} autoFocus={!!aiQuestion} />
                  {aiQuestion && (<button type="button" onClick={() => { setAiQuestion(null); setClarificationMode(null); setOmniInput(''); }} className="p-2 mr-1 text-slate-400 hover:text-slate-600"><X size={16}/></button>)}
                  <button type="submit" disabled={!omniInput || isAnalyzing} className="p-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition disabled:opacity-50 shadow-md"><ArrowRight size={18}/></button>
              </form>
          </div>
      </div>

      {/* NEW: AI SUMMARY WIDGET */}
      <div className="bg-gradient-to-r from-indigo-900 to-slate-900 rounded-3xl p-1 shadow-xl relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none"></div>
          <div className="bg-slate-900/90 backdrop-blur-sm rounded-[22px] p-6 flex items-start gap-4 text-white relative z-10">
              <div className="p-3 bg-indigo-500/20 rounded-2xl border border-indigo-500/30 flex-shrink-0 animate-pulse-slow">
                  <Sparkles size={24} className="text-indigo-300"/>
              </div>
              <div className="flex-1">
                  <div className="flex justify-between items-center mb-2">
                      <h3 className="font-bold text-lg text-indigo-100 flex items-center gap-2">
                          AI Executive Summary
                          <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30 uppercase tracking-wider">Gemini 3 Preview</span>
                      </h3>
                  </div>
                  <div className="text-slate-300 text-sm leading-relaxed max-w-4xl">
                      {loadingSummary ? (
                          <div className="flex items-center gap-2 text-slate-500"><Loader2 size={14} className="animate-spin"/> Analyzing your financial data...</div>
                      ) : (
                          aiSummary || "Halo! Saya AI asisten keuanganmu. Masukkan data income dan hutang agar saya bisa memberikan analisa lengkap di sini."
                      )}
                  </div>
              </div>
          </div>
      </div>

      {/* 2. FREEDOM MATRIX (TAB CUTOFF UPDATED) */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-center mb-6">
              <div>
                  <h3 className="font-bold text-2xl text-slate-900 flex items-center gap-2">
                      <Calculator size={24} className="text-brand-600"/> Freedom Matrix
                  </h3>
                  <p className="text-slate-500 text-sm">Timeline lengkap dari awal berhutang hingga estimasi lunas.</p>
              </div>
              <div className="flex gap-2">
                  <button 
                    onClick={() => setFreedomStrategy('lump_sum')}
                    className={`px-4 py-2 border rounded-lg text-xs font-bold flex items-center gap-2 transition ${freedomStrategy === 'lump_sum' ? 'bg-brand-50 border-brand-200 text-brand-600 shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                  >
                      <Zap size={14}/> Lump Sum (Cicil Extra)
                  </button>
                  <button 
                    onClick={() => setFreedomStrategy('cutoff')}
                    className={`px-4 py-2 border rounded-lg text-xs font-bold flex items-center gap-2 transition ${freedomStrategy === 'cutoff' ? 'bg-purple-50 border-purple-200 text-purple-600 shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                  >
                      <PiggyBank size={14}/> Cutoff (Tabung Extra)
                  </button>
              </div>
          </div>

          <div className="grid lg:grid-cols-12 gap-8">
              {/* Left Panel: Inputs & Stats */}
              <div className="lg:col-span-4 space-y-6">
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                      <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 mb-4"><Zap size={14} className="text-yellow-500"/> EXTRA PAYMENT / BLN</label>
                      <input 
                        type="range" 
                        min="0" max="10000000" step="100000" 
                        className="w-full h-3 bg-brand-200 rounded-lg appearance-none cursor-pointer accent-brand-600 mb-4"
                        value={extraPayment}
                        onChange={e => setExtraPayment(Number(e.target.value))}
                      />
                      <div className="text-right">
                          <span className="text-3xl font-black text-slate-900">{formatCurrency(extraPayment)}</span>
                      </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                      <div className="bg-green-50 p-4 rounded-2xl border border-green-100 text-center">
                          <Hourglass size={24} className="text-green-600 mx-auto mb-2"/>
                          <p className="text-[10px] font-bold text-green-700 uppercase">HEMAT WAKTU</p>
                          <p className="text-2xl font-black text-green-800">{freedomMatrixData.freedomMonth > 0 ? (freedomMatrixData.data.length - freedomMatrixData.freedomMonth) : 0} <span className="text-sm">Bln</span></p>
                      </div>
                      <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 text-center">
                          <PiggyBank size={24} className="text-blue-600 mx-auto mb-2"/>
                          <p className="text-[10px] font-bold text-blue-700 uppercase">POTENSI HEMAT</p>
                          <p className="text-xl font-black text-blue-800">{formatCurrency(totalDebt * 0.15)}</p>
                      </div>
                  </div>

                  <div className="bg-slate-900 p-6 rounded-2xl text-white text-center shadow-xl">
                      <Coins size={32} className="text-yellow-400 mx-auto mb-2"/>
                      <p className="text-xs font-bold text-slate-400 uppercase mb-1">TOTAL EXTRA INVESTMENT</p>
                      <p className="text-2xl font-black text-white">{formatCurrency(extraPayment * (freedomMatrixData.freedomMonth || 12))}</p>
                      <p className="text-[10px] text-slate-500 mt-1">Total uang tambahan yang harus disiapkan.</p>
                  </div>
              </div>

              {/* Right Panel: Chart */}
              <div className="lg:col-span-8 h-[400px] relative">
                  <div className="absolute top-0 right-0 flex gap-4 text-xs font-medium text-slate-500 z-10">
                      <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-slate-400"></div> Jalur Biasa</div>
                      <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-brand-600"></div> Jalur Paydone</div>
                      {freedomStrategy === 'cutoff' && (
                          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-purple-500"></div> Tabungan Cutoff</div>
                      )}
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={freedomMatrixData.data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                          <defs>
                              <linearGradient id="colorAcc" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                              </linearGradient>
                              <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.1}/>
                                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                              </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" tick={{fontSize: 10}} tickLine={false} axisLine={false} interval={12} />
                          <YAxis tickFormatter={(val) => `${val/1000000}jt`} tick={{fontSize: 10}} tickLine={false} axisLine={false} />
                          <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{borderRadius: '12px', border:'none', boxShadow:'0 10px 15px -3px rgba(0, 0, 0, 0.1)'}} />
                          
                          {/* Standard Line (Dashed Gray) */}
                          <Line type="monotone" dataKey="Standard" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={false} />
                          
                          {/* Paydone Line (Solid Blue) */}
                          <Line type="monotone" dataKey="Paydone" stroke="#2563eb" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                          
                          {/* Savings Line (Only in Cutoff Mode) */}
                          {freedomStrategy === 'cutoff' && (
                              <Area type="monotone" dataKey="Savings" stroke="#a855f7" fill="url(#colorSavings)" strokeWidth={2} dot={false} />
                          )}
                          
                          {/* Freedom Line */}
                          {freedomMatrixData.freedomMonth > 0 && (
                              <ReferenceLine x={freedomMatrixData.data[freedomMatrixData.freedomMonth].name} stroke="#10b981" strokeWidth={2} label={{ position: 'top', value: 'BEBAS HUTANG! 🎉', fill: '#10b981', fontSize: 10, fontWeight: 'bold' }} />
                          )}
                      </AreaChart>
                  </ResponsiveContainer>
              </div>
          </div>
      </div>

      {/* 3. ROW 3: WHICH PAIN & STRUCTURE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* THE "WHICH PAIN" DECISION */}
          <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl flex flex-col justify-between">
              <div className="absolute right-0 top-0 p-8 opacity-5"><Scissors size={200} /></div>
              <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-2 text-yellow-400">
                      <Target size={24} />
                      <h2 className="text-xl font-bold">The "Which Pain" Decision</h2>
                  </div>
                  <p className="text-slate-400 text-sm mb-6">
                      Pilih satu rasa sakit untuk masa depan yang tenang. (DSR Saat Ini: <span className={healthMetrics.dsr > 30 ? "text-red-400 font-bold" : "text-green-400 font-bold"}>{healthMetrics.dsr.toFixed(1)}%</span>)
                  </p>

                  <div className="space-y-4">
                      {/* Option A */}
                      <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700 hover:border-blue-500/50 transition cursor-pointer group">
                          <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                  <Briefcase className="text-blue-400" size={20}/>
                                  <h3 className="font-bold text-sm">Opsi A: Cari Tambahan</h3>
                              </div>
                              <span className="text-[10px] text-slate-500 font-bold uppercase">TARGET / BULAN</span>
                          </div>
                          <p className="text-2xl font-black text-white group-hover:text-blue-400 transition mt-1">{formatCurrency(decisionPain.incomeGap)}</p>
                      </div>

                      {/* Option B */}
                      <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700 hover:border-red-500/50 transition cursor-pointer group">
                          <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                  <Scissors className="text-red-400" size={20}/>
                                  <h3 className="font-bold text-sm">Opsi B: Jual Aset</h3>
                              </div>
                              <span className="text-[10px] text-slate-500 font-bold uppercase">NILAI ASET</span>
                          </div>
                          <p className="text-2xl font-bold text-white group-hover:text-red-400 transition mt-1">{formatCurrency(decisionPain.assetSellTarget)}</p>
                      </div>
                  </div>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-800 flex items-center gap-2 text-xs text-slate-400 italic">
                  <Sparkles size={14} className="text-yellow-500"/> "Fokus investasi atau pelunasan dipercepat."
              </div>
          </div>

          {/* STRUKTUR PENGELUARAN (Donut) */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative flex flex-col items-center justify-center">
              <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2 w-full"><PieIcon size={18} className="text-slate-400"/> STRUKTUR PENGELUARAN</h3>
              <div className="flex items-center w-full h-full">
                  <div className="h-64 w-64 relative flex-shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                              <Pie
                                  data={expenseByCategory}
                                  cx="50%" cy="50%"
                                  innerRadius={60} outerRadius={80}
                                  paddingAngle={5}
                                  dataKey="value"
                                  startAngle={90} endAngle={-270}
                              >
                                  {expenseByCategory.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                              </Pie>
                              <Tooltip formatter={(val: number) => formatCurrency(val)} contentStyle={{borderRadius: '12px', border:'none', boxShadow:'0 4px 12px rgba(0,0,0,0.1)'}}/>
                          </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-xs text-slate-400 font-bold uppercase">Total Out</span>
                          <span className="text-lg font-black text-slate-900">{formatCurrency(totalMonthlyObligation + totalLivingCost)}</span>
                      </div>
                  </div>
                  
                  <div className="flex-1 space-y-3 pl-4 w-full">
                      {expenseByCategory.map((entry, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs w-full">
                              <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full" style={{backgroundColor: entry.fill}}></div>
                                  <span className="text-slate-600 font-medium truncate max-w-[120px]" title={entry.name}>{entry.name.split('(')[0]}</span>
                              </div>
                              <span className="font-bold text-slate-900">
                                  {totalMonthlyObligation + totalLivingCost > 0 
                                    ? ((entry.value / (totalMonthlyObligation + totalLivingCost)) * 100).toFixed(0) 
                                    : 0}%
                              </span>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      </div>

      {/* 4. ROW 4: KAPASITAS & CROSSING */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Kapasitas Bayar (Bar Chart) */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative">
              <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2"><Scale size={18} className="text-blue-600"/> Kapasitas Bayar</h3>
                  <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded">Income Bersih vs Hutang</span>
              </div>
              
              <div className="h-48 relative z-10">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart layout="vertical" data={capacityData} margin={{ top: 0, right: 30, left: 20, bottom: 0 }} barSize={30}>
                          <XAxis type="number" hide />
                          <YAxis dataKey="name" type="category" tick={{fontSize: 10, fontWeight: 'bold', fill: '#64748b'}} width={100} tickLine={false} axisLine={false} />
                          <Tooltip formatter={(val: number) => formatCurrency(val)} cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '12px', border:'none', boxShadow:'0 4px 12px rgba(0,0,0,0.1)'}}/>
                          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                              {capacityData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#ef4444'} />
                              ))}
                          </Bar>
                      </BarChart>
                  </ResponsiveContainer>
              </div>
              <div className="mt-4 flex items-start gap-2 text-[10px] text-slate-500 italic">
                  <Info size={12} className="mt-0.5 shrink-0"/> "Grafik ini menunjukkan sisa uangmu setelah makan/transport (Needs) dibandingkan dengan total cicilan. Jika merah lebih panjang, kamu defisit."
              </div>
          </div>

          {/* Crossing Analysis (Line) */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative">
              <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2"><TrendingUp size={18} className="text-blue-600"/> Crossing Analysis</h3>
              <div className="h-48 relative z-10">
                  <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={crossingData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                          <XAxis dataKey="month" tick={{fontSize: 10}} tickLine={false} axisLine={false} />
                          <YAxis hide domain={['auto', 'auto']} />
                          <Tooltip formatter={(val: number) => formatCurrency(val)} contentStyle={{borderRadius: '12px', border:'none', boxShadow:'0 4px 12px rgba(0,0,0,0.1)'}}/>
                          
                          {/* Reference Line Current Month */}
                          <ReferenceLine x={currentMonthLabel} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'top', value: 'Bulan Ini', fill: '#ef4444', fontSize: 10 }} />

                          {/* Income Threshold (Green Dashed) */}
                          <Line type="step" dataKey="income" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Pemasukan" />
                          
                          {/* Expense Line (Red) */}
                          <Line type="monotone" dataKey="totalExp" stroke="#ef4444" strokeWidth={2} dot={false} name="Total Out (Hidup + Hutang)" />
                          
                          {/* Debt Portion (Blue Area - Mocked as Line for clarity in composed) */}
                          <Line type="monotone" dataKey="obligation" stroke="#3b82f6" strokeWidth={2} dot={false} name="Porsi Cicilan Real" />
                      </ComposedChart>
                  </ResponsiveContainer>
              </div>
              
              <div className="mt-2 flex justify-center gap-4 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> Pemasukan</span>
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Cicilan</span>
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> Total Out</span>
              </div>

              <div className="mt-4 bg-green-50 border border-green-100 p-2 rounded-lg flex items-center gap-2 text-xs text-green-700 font-medium">
                  <CheckCircle2 size={14}/> Grafik ini menggunakan jadwal cicilan riil & budget rutin Anda.
              </div>
          </div>
      </div>

      {/* SMART AI PLAN CONFIRMATION MODAL */}
      {showOmniPlan && parsedPlan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden transform scale-100 transition-all border border-slate-200">
                  <div className="bg-gradient-to-r from-slate-900 to-indigo-900 p-6 text-white flex justify-between items-start">
                      <div><div className="flex items-center gap-2 mb-1 text-indigo-200 text-xs font-bold uppercase tracking-wider"><Bot size={14}/> Paydone Command Center</div><h3 className="font-bold text-xl">Konfirmasi: {parsedPlan.displayTitle}</h3></div>
                      <button onClick={() => setShowOmniPlan(false)} className="text-indigo-300 hover:text-white transition bg-white/10 p-1.5 rounded-full"><X size={20}/></button>
                  </div>
                  <div className="p-6 space-y-6">
                      <div className="flex gap-4 items-start"><div className={`p-3 rounded-2xl shadow-sm ${parsedPlan.intent === 'PAY_DEBT' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>{parsedPlan.intent === 'PAY_DEBT' || parsedPlan.intent === 'ADD_DEBT' ? <Coins size={24}/> : <ReceiptText size={24}/>}</div><div className="flex-1"><h4 className="text-sm text-slate-500 font-medium">Original Input:</h4><p className="font-medium text-slate-700 text-sm mb-2 italic">"{parsedPlan.originalInput}"</p><div className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(parsedPlan.amount)}</div></div></div>
                      {parsedPlan.matchedData ? (<div className="bg-green-50 border border-green-200 rounded-xl p-4"><div className="flex justify-between items-start mb-1"><span className="text-xs font-bold text-green-700 flex items-center gap-1"><CheckCircle2 size={12}/> Target Ditemukan</span></div><p className="text-sm text-slate-700 mt-1">Terhubung ke: <strong>{parsedPlan.matchedData.name}</strong></p></div>) : parsedPlan.status === 'missing_data' ? (<div className="bg-amber-50 border border-amber-200 rounded-xl p-4"><div className="flex justify-between items-start mb-1"><span className="text-xs font-bold text-amber-700 flex items-center gap-1"><AlertCircle size={12}/> Data Kurang Lengkap</span></div><p className="text-sm text-slate-700 mt-1">Mohon lengkapi nominal atau target.</p></div>) : null}
                      <div className="flex gap-3 pt-2"><button onClick={() => setShowOmniPlan(false)} className="flex-1 py-3 border border-slate-300 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition">Batal</button><button onClick={executeOmniPlan} disabled={parsedPlan.status === 'missing_data'} className="flex-1 py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 shadow-lg flex items-center justify-center gap-2 transition transform active:scale-95 disabled:opacity-50"><CheckCircle2 size={18}/> Eksekusi</button></div>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
}
