
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend, ReferenceLine, BarChart, Bar, RadialBarChart, RadialBar
} from 'recharts';
import { 
  Zap, AlertTriangle, CheckCircle2, Target, Info, Scissors, PieChart as PieIcon,
  Wallet, TrendingDown, AlertCircle, Calculator, Sparkles, BrainCircuit,
  Command, Send, Mic, ArrowUpRight, Activity, ShieldCheck, Clock, 
  ChevronRight, ArrowRight, TrendingUp, Flame, Award, Heart, 
  Calendar, DollarSign, CreditCard, Building2, Car, BarChart3,
  Eye, EyeOff, RefreshCw, ChevronDown, ChevronUp, Lightbulb, Rocket
} from 'lucide-react';
import { DebtItem, ExpenseItem, TaskItem, DailyExpense, SinkingFund, DebtInstallment } from '../types';
import { formatCurrency, generateGlobalProjection, generateCrossingAnalysis, getCurrentInstallment } from '../services/financeUtils';
import { generateDashboardSummary, parseTransactionAI } from '../services/geminiService';
import { pullUserDataFromCloud } from '../services/cloudSync';
import { getConfig } from '../services/mockDb';
import LivingCostWidget from '../components/widgets/LivingCostWidget';

// --- ANIMATED COUNTER COMPONENT ---
function AnimatedNumber({ value, duration = 1200, prefix = '', suffix = '' }: { value: number; duration?: number; prefix?: string; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number>(0);
  useEffect(() => {
    const start = ref.current;
    const diff = value - start;
    if (diff === 0) return;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + diff * eased;
      setDisplay(current);
      ref.current = current;
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value, duration]);
  return <>{prefix}{Math.round(display).toLocaleString('id-ID')}{suffix}</>;
}

// --- SCROLL REVEAL WRAPPER ---
function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setVisible(true); }, { threshold: 0.1 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

// --- HEALTH SCORE GAUGE ---
function HealthGauge({ score, label }: { score: number; label: string }) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const color = clampedScore >= 70 ? '#10b981' : clampedScore >= 40 ? '#f59e0b' : '#ef4444';
  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;
  
  return (
    <div className="relative flex flex-col items-center">
      <svg width="140" height="140" viewBox="0 0 120 120" className="transform -rotate-90">
        <circle cx="60" cy="60" r="54" stroke="#e2e8f0" strokeWidth="8" fill="none" />
        <circle cx="60" cy="60" r="54" stroke={color} strokeWidth="8" fill="none"
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
          style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black" style={{ color }}>{Math.round(clampedScore)}</span>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">{label}</span>
      </div>
    </div>
  );
}

// --- SPARKLINE MINI ---
function Sparkline({ data, color = '#3b82f6', height = 32 }: { data: number[]; color?: string; height?: number }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${height - ((v - min) / range) * (height - 4) - 2}`).join(' ');
  return (
    <svg width={w} height={height} className="overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface DashboardProps {
  debts: DebtItem[];
  allocations: ExpenseItem[]; 
  tasks: TaskItem[];
  income?: number;
  onAIAction?: (action: any) => void;
  userId: string;
  dailyExpenses?: DailyExpense[];
  sinkingFunds?: SinkingFund[]; 
  debtInstallments?: DebtInstallment[]; 
}

export default function Dashboard({ 
  debts = [], 
  allocations = [], 
  income = 0, 
  sinkingFunds = [],
  dailyExpenses = [],
  debtInstallments = [],
  onAIAction,
  userId
}: DashboardProps) {
  
  // --- STATE FOR WIDGETS ---
  const [extraPayment, setExtraPayment] = useState(0);
  const [freedomMode, setFreedomMode] = useState<'lump_sum' | 'cutoff'>('lump_sum');
  const [freedomMatrix, setFreedomMatrix] = useState<any>(null);
  const [crossingData, setCrossingData] = useState<any>(null);
  const [aiSummary, setAiSummary] = useState("AI sedang menganalisa data keuanganmu...");
  const [showBalances, setShowBalances] = useState(true);
  const [expandedDebt, setExpandedDebt] = useState<string | null>(null);
  const [activeMetricTab, setActiveMetricTab] = useState<'overview' | 'debts' | 'cashflow'>('overview');
  
  // AI COMMAND STATE
  const [commandInput, setCommandInput] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<{type: 'success'|'error', msg: string} | null>(null);
  const [commandHistory, setCommandHistory] = useState<{input: string; response: string; type: 'success'|'error'}[]>([]);

  // BRAND CONFIG
  const appConfig = getConfig();
  const appName = appConfig.appName || 'Paydone.id';

  // --- 0. HYDRATION CHECK ---
  useEffect(() => {
      if (userId && debts.length === 0 && Number(income) === 0) {
          pullUserDataFromCloud(userId).catch(console.error);
      }
  }, [userId, debts.length, income]);

  // --- 1. CALCULATE METRICS ---
  const metrics = useMemo(() => {
    const activeDebts = debts.filter(d => !d._deleted && d.remainingPrincipal > 100);
    const totalDebt = activeDebts.reduce((a, b) => a + Number(b.remainingPrincipal || 0), 0);
    const monthlyDebtObligation = activeDebts.reduce((a, b) => a + getCurrentInstallment(b), 0);
    
    const livingCost = allocations.filter(a => a.category !== 'debt').reduce((a, b) => a + Number(b.amount || 0), 0);
    const totalLivingCost = livingCost > 0 ? livingCost : (Number(income || 0) * 0.5); 

    const totalExpense = Number(monthlyDebtObligation) + Number(totalLivingCost);
    const netCashflow = Number(income || 0) - Number(totalExpense);
    const dsr = Number(income || 0) > 0 ? (Number(monthlyDebtObligation) / Number(income || 0)) * 100 : 0;
    
    const totalLiquid = sinkingFunds.reduce((a, b) => a + Number(b.currentAmount || 0), 0);
    const runway = totalExpense > 0 ? totalLiquid / totalExpense : 0;

    // Health Score (0-100)
    const dsrScore = Math.max(0, 100 - (dsr * 2.5));
    const runwayScore = Math.min(100, runway * 16.67);
    const cashflowScore = netCashflow > 0 ? Math.min(100, (netCashflow / (Number(income || 1))) * 200) : 0;
    const healthScore = (dsrScore * 0.4) + (runwayScore * 0.3) + (cashflowScore * 0.3);

    // Monthly expenses trend (last 6 months)
    const now = new Date();
    const monthlyTrend: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7);
      const total = dailyExpenses.filter(e => e.date?.startsWith(key) && !e._deleted).reduce((s, e) => s + Number(e.amount || 0), 0);
      monthlyTrend.push(total);
    }

    return { totalDebt, monthlyDebtObligation, livingCost, netCashflow, dsr, runway, activeDebts, totalExpense, healthScore, totalLiquid, monthlyTrend };
  }, [debts, allocations, income, sinkingFunds, dailyExpenses]);

  // --- 2. GENERATE CHARTS ON CHANGE ---
  useEffect(() => {
      const projection = generateGlobalProjection(debts, extraPayment, 'snowball', freedomMode);
      setFreedomMatrix(projection);
      const crossing = generateCrossingAnalysis(Number(income) || 0, debts, allocations);
      setCrossingData(crossing);
  }, [debts, income, allocations, extraPayment, freedomMode]);

  // --- 3. GENERATE AI SUMMARY ---
  useEffect(() => {
      const getSummary = async () => {
          if (Number(income || 0) <= 0 && debts.length === 0) return;
          try {
              const summary = await generateDashboardSummary(metrics);
              setAiSummary(summary);
          } catch (e) {
              if (metrics.dsr > 40) setAiSummary("DSR Kamu tinggi! Fokus turunkan hutang konsumtif.");
              else if (metrics.runway < 3) setAiSummary("Dana darurat tipis. Tambah cash sebelum investasi.");
              else setAiSummary("Kondisi prima! Saatnya gaspol investasi.");
          }
      };
      const timeout = setTimeout(getSummary, 1500);
      return () => clearTimeout(timeout);
  }, [metrics.dsr, metrics.runway]);

  // --- 4. AI COMMAND HANDLER ---
  const handleAICommand = async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!commandInput.trim()) return;

      setIsAiProcessing(true);
      setAiFeedback(null);

      try {
          const result = await parseTransactionAI(commandInput);
          if (onAIAction && result && result.intent !== 'ERROR' && result.intent !== 'CLARIFICATION') {
              onAIAction(result);
              const msg = `Berhasil: ${result.intent.replace('ADD_', 'Catat ')}`;
              setAiFeedback({ type: 'success', msg });
              setCommandHistory(prev => [{ input: commandInput, response: msg, type: 'success' }, ...prev].slice(0, 5));
              setCommandInput('');
          } else {
              const msg = "Maaf, saya kurang paham. Coba 'Catat makan 20rb'.";
              setAiFeedback({ type: 'error', msg });
              setCommandHistory(prev => [{ input: commandInput, response: msg, type: 'error' }, ...prev].slice(0, 5));
          }
      } catch (err) {
          setAiFeedback({ type: 'error', msg: "Gagal memproses perintah." });
      } finally {
          setIsAiProcessing(false);
          setTimeout(() => setAiFeedback(null), 3000);
      }
  };

  // --- COLORS ---
  const COLORS = {
      needs: '#3b82f6', 
      wants: '#f59e0b', 
      debt: '#ef4444',  
      savings: '#10b981' 
  };

  // --- STRUCTURE DATA ---
  const structureData = [
      { name: 'Kebutuhan', value: Number(metrics.livingCost || 0) * 0.7, color: COLORS.needs, percent: 0 }, 
      { name: 'Keinginan', value: Number(metrics.livingCost || 0) * 0.3, color: COLORS.wants, percent: 0 },
      { name: 'Cicilan Hutang', value: Number(metrics.monthlyDebtObligation || 0), color: COLORS.debt, percent: 0 },
  ];
  const totalStructure = structureData.reduce((a,b)=>a+b.value,0);
  structureData.forEach(item => { item.percent = totalStructure > 0 ? Math.round((item.value / totalStructure) * 100) : 0; });

  // DECISION LOGIC
  const highestDebt = [...metrics.activeDebts].sort((a,b) => b.monthlyPayment - a.monthlyPayment)[0];

  // Debt type icons
  const debtTypeIcon = (type: string) => {
    switch(type) {
      case 'KPR': return <Building2 size={16} />;
      case 'KKB': return <Car size={16} />;
      case 'Kartu Kredit': return <CreditCard size={16} />;
      default: return <DollarSign size={16} />;
    }
  };

  // DSR Status 
  const dsrStatus = metrics.dsr > 50 ? { label: 'Kritis', color: 'text-red-500', bg: 'bg-red-500', ring: 'ring-red-500/20', bgLight: 'bg-red-50', border: 'border-red-200' }
    : metrics.dsr > 30 ? { label: 'Waspada', color: 'text-amber-500', bg: 'bg-amber-500', ring: 'ring-amber-500/20', bgLight: 'bg-amber-50', border: 'border-amber-200' }
    : { label: 'Sehat', color: 'text-emerald-500', bg: 'bg-emerald-500', ring: 'ring-emerald-500/20', bgLight: 'bg-emerald-50', border: 'border-emerald-200' };

  // Today's expenses
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayExpenses = dailyExpenses.filter(e => e.date === todayKey && !e._deleted);
  const todayTotal = todayExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  // Next bill
  const today = new Date().getDate();
  const upcomingDebts = metrics.activeDebts.map(d => {
    let diff = d.dueDate - today;
    if (diff < 0) diff += 30;
    return { ...d, diff };
  }).sort((a,b) => a.diff - b.diff);

  return (
    <div className="space-y-6 pb-20 font-sans">
      
      {/* ============================================ */}
      {/* SECTION 1: AI COMMAND CENTER (THE BRAIN)     */}
      {/* ============================================ */}
      <Reveal>
        <div className="relative bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 rounded-3xl p-6 md:p-8 overflow-hidden shadow-2xl">
          {/* Decorative Background Elements */}
          <div className="absolute top-0 right-0 p-10 opacity-[0.04] pointer-events-none"><BrainCircuit size={200} className="text-white"/></div>
          <div className="absolute -left-10 -bottom-10 w-64 h-64 bg-blue-600 rounded-full blur-[100px] opacity-20 pointer-events-none" />
          <div className="absolute right-20 top-10 w-32 h-32 bg-indigo-500 rounded-full blur-[80px] opacity-10 pointer-events-none" />
          
          {/* Floating grid pattern */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

          <div className="relative z-10 max-w-3xl mx-auto text-center space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.08] border border-white/10 text-blue-300 text-[10px] font-black uppercase tracking-widest backdrop-blur-sm">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-blue-400"></span></span>
              {appName} AI Assistant
            </div>
            
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-tight">
              Apa yang ingin kamu <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">selesaikan hari ini?</span>
            </h2>

            <form onSubmit={handleAICommand} className="relative w-full max-w-xl mx-auto group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-blue-400 transition-colors">
                <Command size={18} />
              </div>
              <input 
                type="text" 
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                placeholder="Contoh: 'Catat pengeluaran kopi 25rb'..." 
                className="w-full pl-12 pr-14 py-4 rounded-2xl bg-white/[0.07] border border-white/10 text-white placeholder-slate-500 focus:bg-white/[0.12] focus:border-blue-400/50 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all backdrop-blur-sm font-medium text-sm"
                disabled={isAiProcessing}
              />
              <button 
                type="submit"
                disabled={!commandInput.trim() || isAiProcessing}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg active:scale-95"
              >
                {isAiProcessing ? <RefreshCw size={18} className="animate-spin"/> : <Send size={18}/>}
              </button>
            </form>

            {aiFeedback && (
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold ${aiFeedback.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}
                style={{ animation: 'fadeInUp 0.3s ease-out' }}>
                {aiFeedback.type === 'success' ? <CheckCircle2 size={14}/> : <AlertCircle size={14}/>}
                {aiFeedback.msg}
              </div>
            )}

            {/* Quick Chips */}
            <div className="flex flex-wrap justify-center gap-2">
              {[
                { icon: <Wallet size={12}/>, label: "Log Gaji Masuk", cmd: "Pemasukan gaji 10jt" },
                { icon: <TrendingDown size={12}/>, label: "Catat Jajan", cmd: "Pengeluaran makan 50rb" },
                { icon: <Target size={12}/>, label: "Cek Kesehatan", cmd: "Analisa DSR saya" }
              ].map((chip, idx) => (
                <button 
                  key={idx}
                  onClick={() => setCommandInput(chip.cmd)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-slate-400 text-[11px] font-semibold hover:bg-white/[0.08] hover:text-white hover:border-white/20 transition-all"
                >
                  {chip.icon} {chip.label}
                </button>
              ))}
            </div>

            {/* Command History */}
            {commandHistory.length > 0 && (
              <div className="mt-3 space-y-1.5 text-left max-w-xl mx-auto">
                {commandHistory.slice(0, 2).map((h, i) => (
                  <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05] text-[11px]">
                    <span className="text-slate-500 shrink-0 mt-0.5">{h.type === 'success' ? <CheckCircle2 size={12} className="text-emerald-400"/> : <AlertCircle size={12} className="text-red-400"/>}</span>
                    <div><span className="text-slate-400">{h.input}</span> <span className="text-slate-600">{'>'}</span> <span className={h.type === 'success' ? 'text-emerald-400' : 'text-red-400'}>{h.response}</span></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Reveal>

      {/* ============================================ */}
      {/* SECTION 2: HEALTH SCORE + KEY METRICS        */}
      {/* ============================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Health Score Card */}
        <Reveal className="lg:col-span-4" delay={100}>
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Financial Health</p>
                <p className="text-xs text-slate-500 mt-0.5">Skor kesehatanmu saat ini</p>
              </div>
              <button onClick={() => setShowBalances(!showBalances)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all">
                {showBalances ? <Eye size={16}/> : <EyeOff size={16}/>}
              </button>
            </div>
            
            <div className="flex-1 flex items-center justify-center py-2">
              <HealthGauge score={metrics.healthScore} label="Score" />
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="text-center p-2 rounded-xl bg-slate-50">
                <p className="text-[9px] font-bold text-slate-400 uppercase">DSR</p>
                <p className={`text-sm font-black ${dsrStatus.color}`}>{metrics.dsr.toFixed(1)}%</p>
              </div>
              <div className="text-center p-2 rounded-xl bg-slate-50">
                <p className="text-[9px] font-bold text-slate-400 uppercase">Runway</p>
                <p className="text-sm font-black text-slate-800">{metrics.runway.toFixed(1)} bln</p>
              </div>
              <div className="text-center p-2 rounded-xl bg-slate-50">
                <p className="text-[9px] font-bold text-slate-400 uppercase">Hutang</p>
                <p className="text-sm font-black text-slate-800">{metrics.activeDebts.length}</p>
              </div>
            </div>

            {/* AI Summary */}
            <div className="mt-4 p-3 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100">
              <p className="text-[11px] text-slate-600 leading-relaxed flex items-start gap-2">
                <Sparkles size={14} className="text-blue-500 shrink-0 mt-0.5"/>
                <span className="italic">{aiSummary.split('.').slice(0, 2).join('.')}.</span>
              </p>
            </div>
          </div>
        </Reveal>

        {/* Metric Cards Grid */}
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Card: Total Hutang */}
          <Reveal delay={150}>
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
              <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-red-50 opacity-50 group-hover:scale-150 transition-transform duration-500" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-red-50 text-red-500 rounded-xl"><CreditCard size={16}/></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Hutang</p>
                  </div>
                  <Sparkline data={[100, 95, 88, 82, 75, 70].map(v => v * (metrics.totalDebt / 100 || 1))} color="#ef4444" />
                </div>
                <h3 className="text-2xl font-black text-slate-900">
                  {showBalances ? formatCurrency(metrics.totalDebt) : <span className="text-slate-300">{'* * * * * *'}</span>}
                </h3>
                <p className="text-[11px] text-slate-400 mt-1 font-medium">{metrics.activeDebts.length} hutang aktif</p>
              </div>
            </div>
          </Reveal>

          {/* Card: Net Cashflow */}
          <Reveal delay={200}>
            <div className={`rounded-3xl p-5 border shadow-sm hover:shadow-md transition-all group relative overflow-hidden ${metrics.netCashflow >= 0 ? 'bg-emerald-950 border-emerald-900' : 'bg-red-950 border-red-900'}`}>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-xl ${metrics.netCashflow >= 0 ? 'bg-emerald-900 text-emerald-400' : 'bg-red-900 text-red-400'}`}><TrendingUp size={16}/></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Cashflow</p>
                  </div>
                </div>
                <h3 className={`text-2xl font-black ${metrics.netCashflow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {showBalances ? formatCurrency(metrics.netCashflow) : <span className="text-slate-600">{'* * * * * *'}</span>}
                </h3>
                <p className={`text-[11px] mt-1 font-medium ${metrics.netCashflow >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {metrics.netCashflow >= 0 ? 'Surplus - Keep going!' : 'Defisit - Perlu aksi!'}
                </p>
              </div>
            </div>
          </Reveal>

          {/* Card: Kewajiban Bulanan */}
          <Reveal delay={250}>
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-50 text-blue-500 rounded-xl"><Calendar size={16}/></div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kewajiban / Bulan</p>
                </div>
              </div>
              <h3 className="text-2xl font-black text-slate-900">
                {showBalances ? formatCurrency(metrics.monthlyDebtObligation) : <span className="text-slate-300">{'* * * * *'}</span>}
              </h3>
              <div className="mt-3 w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-1000 ${dsrStatus.bg}`} style={{ width: `${Math.min(100, metrics.dsr)}%` }} />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className={`text-[10px] font-bold ${dsrStatus.color}`}>{dsrStatus.label} ({metrics.dsr.toFixed(1)}% DSR)</span>
                <span className="text-[10px] text-slate-400">Max 30%</span>
              </div>
            </div>
          </Reveal>

          {/* Card: Living Cost Widget */}
          <Reveal delay={300}>
            <LivingCostWidget 
              income={Number(income)} 
              dailyExpenses={dailyExpenses} 
              debtInstallments={debtInstallments} 
              allocations={allocations} 
            />
          </Reveal>
        </div>
      </div>

      {/* ============================================ */}
      {/* SECTION 3: QUICK INSIGHTS ROW                */}
      {/* ============================================ */}
      <Reveal delay={100}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Today's Spending */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
              <Flame size={20}/>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Pengeluaran Hari Ini</p>
              <p className="text-lg font-black text-slate-900 truncate">{formatCurrency(todayTotal)}</p>
            </div>
            <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-bold">{todayExpenses.length} transaksi</span>
          </div>

          {/* Next Bill */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex items-center gap-4">
            <div className={`p-3 rounded-2xl ${upcomingDebts[0]?.diff <= 3 ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
              <Clock size={20}/>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Tagihan Terdekat</p>
              <p className="text-sm font-black text-slate-900 truncate">{upcomingDebts[0]?.name || '-'}</p>
            </div>
            {upcomingDebts[0] && (
              <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${upcomingDebts[0].diff <= 3 ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-blue-50 text-blue-600 border border-blue-200'}`}>
                {upcomingDebts[0].diff} hari
              </span>
            )}
          </div>

          {/* Sinking Fund Progress */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-500 rounded-2xl">
              <ShieldCheck size={20}/>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Dana Cadangan</p>
              <p className="text-lg font-black text-slate-900 truncate">{formatCurrency(metrics.totalLiquid)}</p>
            </div>
            <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-bold border border-emerald-200">
              {metrics.runway.toFixed(1)} bln
            </span>
          </div>
        </div>
      </Reveal>

      {/* ============================================ */}
      {/* SECTION 4: DEBT PORTFOLIO                    */}
      {/* ============================================ */}
      {metrics.activeDebts.length > 0 && (
        <Reveal delay={150}>
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 uppercase tracking-widest">
                <BarChart3 size={16} className="text-slate-400"/> Portfolio Hutang
              </h3>
              <span className="text-[10px] text-slate-400 font-bold">{metrics.activeDebts.length} aktif</span>
            </div>
            
            <div className="space-y-3">
              {metrics.activeDebts.slice(0, 5).map((debt, idx) => {
                const progress = debt.originalPrincipal > 0 ? ((debt.originalPrincipal - debt.remainingPrincipal) / debt.originalPrincipal) * 100 : 0;
                const isExpanded = expandedDebt === debt.id;
                return (
                  <div key={debt.id} className="group">
                    <button 
                      onClick={() => setExpandedDebt(isExpanded ? null : debt.id)}
                      className="w-full text-left p-4 rounded-2xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 transition-all flex items-center gap-4"
                    >
                      <div className={`p-2.5 rounded-xl shrink-0 ${
                        debt.type === 'KPR' ? 'bg-blue-50 text-blue-600' :
                        debt.type === 'KKB' ? 'bg-amber-50 text-amber-600' :
                        debt.type === 'Kartu Kredit' ? 'bg-red-50 text-red-500' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {debtTypeIcon(debt.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-900 truncate">{debt.name}</p>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-bold">{debt.type}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
                          </div>
                          <span className="text-[10px] font-bold text-slate-500 shrink-0">{progress.toFixed(0)}%</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-black text-slate-900">{showBalances ? formatCurrency(debt.remainingPrincipal) : '***'}</p>
                        <p className="text-[10px] text-slate-400">{formatCurrency(getCurrentInstallment(debt))}/bln</p>
                      </div>
                      <ChevronDown size={14} className={`text-slate-300 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {isExpanded && (
                      <div className="mt-1 ml-14 mr-4 p-4 rounded-xl bg-slate-50 border border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center"
                        style={{ animation: 'fadeInUp 0.2s ease-out' }}>
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Bunga</p>
                          <p className="text-sm font-black text-slate-700">{debt.interestRate}%</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Sisa Tenor</p>
                          <p className="text-sm font-black text-slate-700">{debt.remainingMonths} bln</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Jatuh Tempo</p>
                          <p className="text-sm font-black text-slate-700">Tgl {debt.dueDate}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Strategi</p>
                          <p className="text-sm font-black text-slate-700">{debt.interestStrategy || 'Fixed'}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Reveal>
      )}

      {/* ============================================ */}
      {/* SECTION 5: FREEDOM MATRIX                    */}
      {/* ============================================ */}
      <Reveal delay={150}>
        <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4 relative z-10">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Calculator className="text-blue-600" size={20}/> Freedom Matrix
              </h2>
              <p className="text-slate-500 text-xs mt-1">Simulator pelunasan hutang: Snowball vs Avalanche</p>
            </div>
            <div className="flex p-1 bg-slate-100 rounded-xl">
              <button 
                onClick={() => setFreedomMode('lump_sum')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${freedomMode === 'lump_sum' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Zap size={12}/> Percepat
              </button>
              <button 
                onClick={() => setFreedomMode('cutoff')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${freedomMode === 'cutoff' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Target size={12}/> Cutoff
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
            {/* CONTROLS */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                  <Zap size={12} className="text-amber-500"/> Extra Payment / Bulan
                </label>
                <input 
                  type="range" 
                  min="0" max={Number(income || 0) * 0.5} step="100000"
                  value={extraPayment}
                  onChange={(e) => setExtraPayment(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 mb-3"
                />
                <div className="text-2xl font-black text-slate-900 text-right">
                  {formatCurrency(extraPayment)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
                  <p className="text-[9px] font-black uppercase text-emerald-600 mb-1">Hemat Waktu</p>
                  <div className="text-2xl font-black text-emerald-700">{freedomMatrix?.monthsSaved || 0} <span className="text-xs">Bln</span></div>
                </div>
                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 text-center">
                  <p className="text-[9px] font-black uppercase text-blue-600 mb-1">Potensi Hemat</p>
                  <div className="text-sm font-black text-blue-700 truncate" title={formatCurrency(freedomMatrix?.moneySaved || 0)}>{formatCurrency(freedomMatrix?.moneySaved || 0)}</div>
                </div>
              </div>

              {/* Freedom Tips */}
              <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                <p className="text-[10px] font-bold text-indigo-600 flex items-center gap-1.5 mb-1.5"><Lightbulb size={12}/> Tips</p>
                <p className="text-[11px] text-indigo-700 leading-relaxed">
                  {extraPayment > 0 
                    ? `Dengan tambahan ${formatCurrency(extraPayment)}/bln, kamu bisa bebas ${freedomMatrix?.monthsSaved || 0} bulan lebih cepat!`
                    : 'Geser slider di atas untuk melihat dampak pembayaran tambahan terhadap percepatan pelunasan.'
                  }
                </p>
              </div>
            </div>

            {/* CHART AREA */}
            <div className="lg:col-span-2 h-[340px] w-full bg-slate-50/50 rounded-2xl border border-slate-100 p-4">
              {freedomMatrix && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={freedomMatrix.data} margin={{ top: 20, right: 20, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{fontSize: 10, fill: '#94a3b8'}} tickLine={false} axisLine={false} minTickGap={30} />
                    <YAxis tickFormatter={(val) => `${val/1000000}jt`} tick={{fontSize: 10, fill: '#94a3b8'}} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '12px', padding: '8px 12px'}} 
                      formatter={(val: any) => formatCurrency(Number(val || 0))}
                    />
                    <Legend verticalAlign="top" height={36} iconType="circle" />
                    <Line type="monotone" dataKey="Biasa" stroke="#cbd5e1" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={false} name="Jalur Biasa" />
                    <Line type="monotone" dataKey="Paydone" stroke="#2563eb" strokeWidth={3} dot={false} name="Jalur Cepat" />
                    
                    {freedomMode === 'cutoff' && (
                      <Line type="monotone" dataKey="Tabungan" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Tabungan Cutoff" />
                    )}
                    
                    {freedomMatrix.finishDateAcc && freedomMatrix.data.find((d:any) => d.Paydone <= 0) && (
                      <ReferenceLine x={freedomMatrix.data.find((d:any) => d.Paydone <= 0)?.month} stroke="#10b981" strokeDasharray="3 3" label={{ position: 'top', value: 'BEBAS!', fill: '#10b981', fontSize: 10, fontWeight: 'bold' }} />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </Reveal>

      {/* ============================================ */}
      {/* SECTION 6: ANALYSIS GRID                     */}
      {/* ============================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* CROSSING ANALYSIS - FIXED: Use ComposedChart for mixed Area+Line */}
        <Reveal delay={100}>
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2 uppercase tracking-widest">
                <Target className="text-blue-600" size={16}/> Crossing Analysis
              </h2>
              {crossingData?.dangerMonth && (
                <span className="px-2 py-1 bg-red-50 text-red-600 rounded-lg text-[10px] font-bold flex items-center gap-1 border border-red-100 animate-pulse">
                  <AlertTriangle size={10}/> Bahaya @ {crossingData.dangerMonth.name}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mb-4">Proyeksi hingga akhir tenor hutang: kapan pengeluaran melebihi pemasukan?</p>

            {/* Summary Pills */}
            {crossingData && (
              <div className="flex flex-wrap gap-2 mb-4">
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-bold text-emerald-700">Income: {formatCurrency(crossingData.data?.[0]?.Income || 0)}</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-100">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-[10px] font-bold text-red-700">Expense: {formatCurrency(crossingData.data?.[0]?.TotalExpense || 0)}</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 border border-blue-100">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-[10px] font-bold text-blue-700">Hutang: {formatCurrency(crossingData.data?.[0]?.Debt || 0)}</span>
                </div>
              </div>
            )}

            <div className="h-[300px] w-full">
              {crossingData && crossingData.data && crossingData.data.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={crossingData.data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorExpenseFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorDebtFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                    <XAxis dataKey="name" tick={{fontSize: 9, fill: '#94a3b8'}} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tickFormatter={(val: number) => `${(val/1000000).toFixed(0)}jt`} tick={{fontSize: 9, fill: '#94a3b8'}} tickLine={false} axisLine={false} width={45} />
                    <Tooltip 
                      contentStyle={{borderRadius: '12px', fontSize: '11px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', padding: '8px 12px'}} 
                      formatter={(val: any, name: string) => [formatCurrency(Number(val || 0)), name]}
                      labelStyle={{fontSize: '10px', fontWeight: 'bold', color: '#475569', marginBottom: '4px'}}
                    />
                    <Legend verticalAlign="top" iconType="circle" height={36} wrapperStyle={{fontSize: '10px', fontWeight: 'bold'}}/>
                    
                    <Area type="monotone" dataKey="TotalExpense" stroke="#ef4444" fill="url(#colorExpenseFill)" name="Total Pengeluaran" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#ef4444', stroke: '#fff', strokeWidth: 2 }}/>
                    <Area type="monotone" dataKey="Debt" stroke="#3b82f6" fill="url(#colorDebtFill)" name="Porsi Hutang" strokeWidth={2} dot={false} activeDot={{ r: 3, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}/>
                    <Area type="monotone" dataKey="Income" stroke="#10b981" fill="none" name="Pemasukan" strokeWidth={2} strokeDasharray="6 3" dot={false} activeDot={{ r: 3, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}/>
                    
                    {crossingData.dangerMonth && (
                      <ReferenceLine x={crossingData.dangerMonth.name} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'top', value: 'CROSSING!', fill: '#ef4444', fontSize: 9, fontWeight: 'bold' }} />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <Activity size={40} className="text-slate-200 mb-3"/>
                  <p className="text-sm font-bold text-slate-400">Data belum tersedia</p>
                  <p className="text-[11px] text-slate-300 mt-1">Tambahkan income dan hutang untuk melihat analisis</p>
                </div>
              )}
            </div>
          </div>
        </Reveal>

        {/* RIGHT COLUMN: DECISION + STRUCTURE */}
        <div className="space-y-6">
          
          {/* "WHICH PAIN" DECISION */}
          <Reveal delay={150}>
            <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-[0.04]"><Scissors size={120}/></div>
              
              <div className="relative z-10">
                <h3 className="text-sm font-black text-amber-400 mb-1 flex items-center gap-2 uppercase tracking-widest">
                  <Target size={14}/> The "Which Pain" Decision
                </h3>
                <p className="text-slate-400 text-[11px] mb-4 leading-relaxed">
                  Rekomendasi berdasarkan DSR {metrics.dsr.toFixed(1)}%:
                </p>

                <div className="grid grid-cols-2 gap-3">
                  {/* OPTION A */}
                  <div className={`p-4 rounded-2xl border transition-all ${metrics.dsr < 40 ? 'bg-blue-600/90 border-blue-500 shadow-lg ring-2 ring-blue-400/20' : 'bg-slate-800/50 border-slate-700/50 opacity-50'}`}>
                    <div className="flex items-center gap-2 mb-2 font-bold text-xs">
                      <Wallet size={14}/> Opsi A
                    </div>
                    <p className="text-[10px] text-blue-100 mb-1">Cari Tambahan Income:</p>
                    <div className="text-lg font-black">{formatCurrency(metrics.monthlyDebtObligation / 0.3 - Number(income || 0) > 0 ? metrics.monthlyDebtObligation / 0.3 - Number(income || 0) : 0)}</div>
                  </div>

                  {/* OPTION B */}
                  <div className={`p-4 rounded-2xl border transition-all ${metrics.dsr >= 40 ? 'bg-red-600/90 border-red-500 shadow-lg ring-2 ring-red-400/20' : 'bg-slate-800/50 border-slate-700/50 opacity-50'}`}>
                    <div className="flex items-center gap-2 mb-2 font-bold text-xs">
                      <Scissors size={14}/> Opsi B
                    </div>
                    <p className="text-[10px] text-red-100 mb-1">Jual Aset / Hemat:</p>
                    <div className="text-lg font-black truncate">{formatCurrency(highestDebt?.monthlyPayment || 0)}</div>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          {/* STRUKTUR PENGELUARAN - ENHANCED */}
          <Reveal delay={200}>
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 uppercase tracking-widest mb-5">
                <PieIcon size={14} className="text-slate-400"/> Struktur Cashflow
              </h3>
              
              <div className="flex items-center gap-6">
                <div className="flex-1 space-y-3">
                  {structureData.map((item, idx) => (
                    <div key={idx}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: item.color}} />
                          <span className="text-xs font-medium text-slate-600">{item.name}</span>
                        </div>
                        <span className="text-xs font-black text-slate-800">{item.percent}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${item.percent}%`, backgroundColor: item.color }} />
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="w-28 h-28 relative shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={structureData} innerRadius={30} outerRadius={45} paddingAngle={4} dataKey="value">
                        {structureData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-[10px] font-black text-slate-400">OUT</span>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-bold">Total Pengeluaran</span>
                <span className="text-sm font-black text-slate-900">{formatCurrency(totalStructure)}</span>
              </div>
            </div>
          </Reveal>
        </div>
      </div>

      {/* ============================================ */}
      {/* SECTION 7: KAPASITAS BAYAR                   */}
      {/* ============================================ */}
      <Reveal delay={100}>
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 uppercase tracking-widest">
              <BarChart3 className="text-blue-600" size={16}/> Kapasitas Bayar
            </h3>
            <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-bold">Income - Needs vs Cicilan</span>
          </div>
          
          <div className="space-y-5">
            <div>
              <div className="flex justify-between text-[11px] font-bold mb-2">
                <span className="text-slate-600 flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"/>Kapasitas (Uang Nganggur)</span>
                <span className="text-slate-900">{formatCurrency(metrics.netCashflow + metrics.monthlyDebtObligation)}</span>
              </div>
              <div className="h-8 bg-slate-100 rounded-xl overflow-hidden relative">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-xl flex items-center px-3 text-white text-xs font-black shadow-sm transition-all duration-1000"
                  style={{ width: `${Math.min(100, Math.max(10, 80))}%` }}>
                </div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[11px] font-bold mb-2">
                <span className="text-slate-600 flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500"/>Kewajiban Hutang</span>
                <span className="text-slate-900">{formatCurrency(metrics.monthlyDebtObligation)}</span>
              </div>
              <div className="h-8 bg-slate-100 rounded-xl overflow-hidden relative">
                <div className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-xl flex items-center px-3 text-white text-xs font-black shadow-sm transition-all duration-1000"
                  style={{ width: `${Math.min(100, Math.max(5, (metrics.monthlyDebtObligation / (metrics.netCashflow + metrics.monthlyDebtObligation)) * 80))}%` }}>
                </div>
              </div>
            </div>

            {/* Ratio Indicator */}
            <div className="flex items-center justify-center gap-4 pt-2">
              <div className="flex items-center gap-1.5 text-[11px]">
                <div className="w-6 h-1.5 bg-emerald-500 rounded-full" />
                <span className="text-slate-500 font-medium">Kapasitas</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px]">
                <div className="w-6 h-1.5 bg-red-500 rounded-full" />
                <span className="text-slate-500 font-medium">Kewajiban</span>
              </div>
              <div className="px-2 py-1 bg-slate-50 rounded-lg text-[10px] font-bold text-slate-500">
                Rasio: {metrics.netCashflow + metrics.monthlyDebtObligation > 0 ? ((metrics.monthlyDebtObligation / (metrics.netCashflow + metrics.monthlyDebtObligation)) * 100).toFixed(0) : 0}%
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      {/* INLINE CSS ANIMATIONS */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
