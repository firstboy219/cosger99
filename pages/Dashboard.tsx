
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, ReferenceLine, BarChart, Bar, RadialBarChart, RadialBar } from '../components/LazyCharts';
import { 
  Zap, AlertTriangle, CheckCircle2, Target, Info, Scissors, PieChart as PieIcon,
  Wallet, TrendingDown, AlertCircle, Calculator, Sparkles, BrainCircuit,
  Command, Send, Mic, ArrowUpRight, Activity, ShieldCheck, Clock, 
  ChevronRight, ArrowRight, TrendingUp, Flame, Award, Heart, 
  Calendar, DollarSign, CreditCard, Building2, Car, BarChart3,
  Eye, EyeOff, RefreshCw, ChevronDown, ChevronUp, Lightbulb, Rocket, Home, Plus
} from 'lucide-react';
import { DebtItem, ExpenseItem, TaskItem, DailyExpense, SinkingFund, DebtInstallment } from '../types';
import { formatCurrency, generateGlobalProjection, generateCrossingAnalysis, getCurrentInstallment } from '../services/financeUtils';
import { matchRules, fetchKnowledgeRules, AIKnowledgeRule, AIParseResult, reportUnknownPrompt } from '../services/localAI';
import { pullUserDataFromCloud } from '../services/cloudSync';
import { getConfig } from '../services/mockDb';
import LivingCostWidget from '../components/widgets/LivingCostWidget';
import FeatureGate from '../components/FeatureGate';

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
  const [debtProgressFilter, setDebtProgressFilter] = useState<string>('all');
  const [crossingDebtFilter, setCrossingDebtFilter] = useState<string[]>([]);

  // Filtered crossing data based on selected debt chips
  const filteredCrossingData = useMemo(() => {
    if (!crossingData) return null;
    // Use debts directly (metrics may not be evaluated yet at this point)
    const activeDebtIds = (debts || []).filter(d => !d._deleted && d.remainingPrincipal > 100).map(d => d.id);
    const selectedIds = crossingDebtFilter.length === 0 ? activeDebtIds : crossingDebtFilter;
    if (selectedIds.length === activeDebtIds.length) return crossingData;
    const filteredDebts = debts.filter(d => selectedIds.includes(d.id));
    return generateCrossingAnalysis(Number(income) || 0, filteredDebts, allocations, debtInstallments);
  }, [crossingData, crossingDebtFilter, debts, income, allocations, debtInstallments]);
  
  // AI COMMAND STATE
  const [commandInput, setCommandInput] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<{type: 'success'|'error', msg: string} | null>(null);
  const [commandHistory, setCommandHistory] = useState<{input: string; response: string; type: 'success'|'error'}[]>([]);
  const [knowledgeRules, setKnowledgeRules] = useState<AIKnowledgeRule[]>([]);
  const [aiConfirmModal, setAiConfirmModal] = useState<AIParseResult | null>(null);
  const [confirmFields, setConfirmFields] = useState<Record<string, any>>({});
  const [selectedMatchIdx, setSelectedMatchIdx] = useState(0);

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
      const crossing = generateCrossingAnalysis(Number(income) || 0, debts, allocations, debtInstallments); // Bug 6: use actual installments
      setCrossingData(crossing);
  }, [debts, income, allocations, extraPayment, freedomMode, debtInstallments]);

  // --- 3. GENERATE LOCAL AI SUMMARY (no external API needed) ---
  useEffect(() => {
      const getSummary = async () => {
          if (Number(income || 0) <= 0 && debts.length === 0) return;
          const lcRatio = Number(income) > 0 ? (metrics.livingCost / Number(income)) * 100 : 0;
          if (metrics.dsr > 40) setAiSummary("DSR kamu " + metrics.dsr.toFixed(1) + "% — terlalu tinggi. Prioritaskan lunasi hutang konsumtif agar cashflow bernafas.");
          else if (metrics.runway < 3) setAiSummary("Dana darurat hanya cukup " + metrics.runway.toFixed(1) + " bulan. Tambah tabungan darurat sebelum investasi.");
          else if (lcRatio > 70) setAiSummary("Living cost " + lcRatio.toFixed(0) + "% dari income — terlalu boros. Review pos pengeluaran dan pangkas yang tidak perlu.");
          else if (metrics.dsr > 30) setAiSummary("DSR " + metrics.dsr.toFixed(1) + "% masih dalam batas. Jaga agar tidak naik, hindari hutang baru.");
          else setAiSummary("Kondisi finansial prima! DSR " + metrics.dsr.toFixed(1) + "% — saatnya agresif investasi.");
      };
      const timeout = setTimeout(getSummary, 1500);
      return () => clearTimeout(timeout);
  }, [metrics.dsr, metrics.runway]);

  // Load knowledge rules for local AI
  useEffect(() => {
    fetchKnowledgeRules().then(setKnowledgeRules);
  }, []);

  // --- 4. AI COMMAND HANDLER ---
  const handleAICommand = (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!commandInput.trim()) return;

      setIsAiProcessing(true);
      setAiFeedback(null);

      try {
          const result = matchRules(commandInput, knowledgeRules);

          if (result.status === 'unknown' || result.matches.length === 0) {
              setAiFeedback({ type: 'error', msg: "Saya belum mengerti maksudnya. Coba 'catat makan 25rb' atau 'gaji masuk 10jt'." });
              setCommandHistory(prev => [{ input: commandInput, response: 'Tidak dikenali', type: 'error' }, ...prev].slice(0, 5));
          } else {
              // Show confirmation modal
              setSelectedMatchIdx(0);
              setConfirmFields({ ...result.matches[0].parsedFields });
              setAiConfirmModal(result);
          }
      } finally {
          setIsAiProcessing(false);
          setTimeout(() => setAiFeedback(null), 4000);
      }
  };

  const handleAIConfirm = () => {
      if (!aiConfirmModal || !onAIAction) return;
      const match = aiConfirmModal.matches[selectedMatchIdx];
      if (!match) return;
      onAIAction({ intent: match.rule.action, data: confirmFields });
      const msg = `✓ ${match.rule.label} berhasil dicatat!`;
      setAiFeedback({ type: 'success', msg });
      setCommandHistory(prev => [{ input: aiConfirmModal.rawInput, response: msg, type: 'success' }, ...prev].slice(0, 5));
      setCommandInput('');
      setAiConfirmModal(null);
      setTimeout(() => setAiFeedback(null), 3000);
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

      {/* ========= AI CONFIRM MODAL ========= */}
      {aiConfirmModal && (() => {
        const isAmbiguous = aiConfirmModal.status === 'ambiguous';
        const currentMatch = aiConfirmModal.matches[selectedMatchIdx];
        const ACTION_FIELD_MAP: Record<string, {key: string; label: string; type: string; options?: string[]}[]> = {
          ADD_EXPENSE: [
            { key: 'title', label: 'Nama Pengeluaran', type: 'text' },
            { key: 'amount', label: 'Jumlah (Rp)', type: 'number' },
            { key: 'category', label: 'Kategori', type: 'select', options: ['Food','Transport','Shopping','Utilities','Entertainment','Others'] },
            { key: 'date', label: 'Tanggal', type: 'date' },
          ],
          ADD_INCOME: [
            { key: 'description', label: 'Keterangan', type: 'text' },
            { key: 'amount', label: 'Jumlah (Rp)', type: 'number' },
            { key: 'source', label: 'Sumber', type: 'text' },
            { key: 'date', label: 'Tanggal', type: 'date' },
          ],
          ADD_ALLOCATION: [
            { key: 'name', label: 'Nama Pos Anggaran', type: 'text' },
            { key: 'amount', label: 'Jumlah (Rp)', type: 'number' },
            { key: 'category', label: 'Kategori', type: 'select', options: ['needs','wants','debt'] },
          ],
          ADD_TASK: [
            { key: 'title', label: 'Judul Tugas', type: 'text' },
            { key: 'dueDate', label: 'Tenggat', type: 'date' },
            { key: 'priority', label: 'Prioritas', type: 'select', options: ['low','medium','high'] },
            { key: 'notes', label: 'Catatan', type: 'text' },
          ],
        };
        const fields = ACTION_FIELD_MAP[currentMatch?.rule?.action || ''] || [];

        return (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4" style={{backdropFilter:'blur(4px)', backgroundColor:'rgba(0,0,0,0.5)'}}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-5 text-white">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"/>
                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-300">Cosger Semi AI</span>
                </div>
                <h3 className="text-base font-black">
                  {isAmbiguous ? '🤔 Maksud kamu yang mana?' : `Konfirmasi: ${currentMatch?.rule?.label}`}
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Input: "{aiConfirmModal.rawInput}"</p>
              </div>

              <div className="p-5 space-y-4">
                {/* Ambiguous: option picker */}
                {isAmbiguous && (
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Pilih aksi yang dimaksud:</p>
                    <div className="space-y-2">
                      {aiConfirmModal.matches.map((m, idx) => (
                        <button
                          key={m.rule.id}
                          onClick={() => { setSelectedMatchIdx(idx); setConfirmFields({ ...m.parsedFields }); }}
                          className={`w-full p-3 rounded-xl border text-left transition-all ${selectedMatchIdx === idx ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 hover:border-blue-300 text-slate-700'}`}
                        >
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-black">{m.rule.label}</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${selectedMatchIdx === idx ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                              {m.confidence === 'high' ? '✓ Yakin' : m.confidence === 'medium' ? '~ Mungkin' : '? Kurang yakin'}
                            </span>
                          </div>
                          <p className={`text-[10px] mt-0.5 ${selectedMatchIdx === idx ? 'text-blue-100' : 'text-slate-400'}`}>{m.rule.example}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Editable fields */}
                {fields.length > 0 && (
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-2">
                      {isAmbiguous ? 'Detail (bisa diedit):' : 'AI sudah mengisi otomatis — cek & edit jika perlu:'}
                    </p>
                    <div className="space-y-2.5">
                      {fields.map(field => (
                        <div key={field.key}>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">{field.label}</label>
                          {field.type === 'select' ? (
                            <select
                              value={confirmFields[field.key] || ''}
                              onChange={e => setConfirmFields(prev => ({ ...prev, [field.key]: e.target.value }))}
                              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                            >
                              {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                          ) : (
                            <input
                              type={field.type}
                              value={confirmFields[field.key] || ''}
                              onChange={e => setConfirmFields(prev => ({ ...prev, [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value }))}
                              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No form needed (CHECK_HEALTH / SHOW_DEBTS) */}
                {fields.length === 0 && currentMatch && (
                  <div className="text-center py-4">
                    <p className="text-sm text-slate-600 font-bold">{currentMatch.rule.description}</p>
                    <p className="text-xs text-slate-400 mt-1">Tidak ada data yang perlu diisi.</p>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex gap-2 px-5 pb-5">
                <button
                  onClick={() => setAiConfirmModal(null)}
                  className="flex-1 py-2.5 border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Batal
                </button>
                <button
                  onClick={handleAIConfirm}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-2xl text-sm font-bold hover:bg-blue-700 transition"
                >
                  ✓ Konfirmasi & Simpan
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      
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
              <HealthGauge score={metrics.healthScore} label="/ 100" />
            </div>

            {/* 4 metric rows: DSR, Runway, Living Cost, Hutang */}
            <div className="space-y-2 mt-4">
              {/* DSR */}
              {(() => {
                const dsrBg = metrics.dsr <= 30 ? 'bg-emerald-50 border-emerald-100' : metrics.dsr <= 40 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100';
                const dsrBarColor = metrics.dsr <= 30 ? 'bg-emerald-500' : metrics.dsr <= 40 ? 'bg-amber-500' : 'bg-red-500';
                const dsrLabel = metrics.dsr <= 30 ? 'Sehat' : metrics.dsr <= 40 ? 'Waspada' : 'Kritis';
                return (
                  <div className={`p-2.5 rounded-xl border ${dsrBg}`}>
                    <div className="flex justify-between items-center mb-1">
                      <div>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">DSR</span>
                        <span className="text-[9px] text-slate-400 ml-1">· % gaji untuk cicilan hutang</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={`text-xs font-black ${dsrStatus.color}`}>{metrics.dsr.toFixed(1)}%</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${metrics.dsr <= 30 ? 'bg-emerald-200 text-emerald-700' : metrics.dsr <= 40 ? 'bg-amber-200 text-amber-700' : 'bg-red-200 text-red-700'}`}>{dsrLabel}</span>
                      </div>
                    </div>
                    <div className="w-full bg-white/70 h-1 rounded-full overflow-hidden">
                      <div className={`h-full ${dsrBarColor} rounded-full transition-all`} style={{width: `${Math.min(100, metrics.dsr / 50 * 100)}%`}}/>
                    </div>
                    <p className="text-[8px] text-slate-400 mt-0.5">Ideal ≤30% · Max 40%</p>
                  </div>
                );
              })()}

              {/* Runway */}
              {(() => {
                const rwBg = metrics.runway >= 6 ? 'bg-emerald-50 border-emerald-100' : metrics.runway >= 3 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100';
                const rwBarColor = metrics.runway >= 6 ? 'bg-emerald-500' : metrics.runway >= 3 ? 'bg-amber-500' : 'bg-red-500';
                const rwLabel = metrics.runway >= 6 ? 'Aman' : metrics.runway >= 3 ? 'Cukup' : 'Tipis';
                const totalLiquid = metrics.totalLiquid;
                return (
                  <div className={`p-2.5 rounded-xl border ${rwBg}`}>
                    <div className="flex justify-between items-center mb-1">
                      <div>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Runway</span>
                        <span className="text-[9px] text-slate-400 ml-1">· bulan bisa bertahan tanpa income</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-black text-slate-800">{metrics.runway.toFixed(1)} bln</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${metrics.runway >= 6 ? 'bg-emerald-200 text-emerald-700' : metrics.runway >= 3 ? 'bg-amber-200 text-amber-700' : 'bg-red-200 text-red-700'}`}>{rwLabel}</span>
                      </div>
                    </div>
                    <div className="w-full bg-white/70 h-1 rounded-full overflow-hidden">
                      <div className={`h-full ${rwBarColor} rounded-full transition-all`} style={{width: `${Math.min(100, metrics.runway / 12 * 100)}%`}}/>
                    </div>
                    <p className="text-[8px] text-slate-400 mt-0.5">Dana darurat: {showBalances ? formatCurrency(totalLiquid) : '••••'} · Ideal ≥6 bln</p>
                  </div>
                );
              })()}

              {/* Living Cost Ratio */}
              {(() => {
                const lcRatio = Number(income) > 0 ? (metrics.livingCost / Number(income)) * 100 : 0;
                const lcBg = lcRatio <= 50 ? 'bg-emerald-50 border-emerald-100' : lcRatio <= 70 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100';
                const lcBarColor = lcRatio <= 50 ? 'bg-emerald-500' : lcRatio <= 70 ? 'bg-amber-500' : 'bg-red-500';
                const lcLabel = lcRatio <= 50 ? 'Efisien' : lcRatio <= 70 ? 'Tinggi' : 'Boros';
                return (
                  <div className={`p-2.5 rounded-xl border ${lcBg}`}>
                    <div className="flex justify-between items-center mb-1">
                      <div>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Living Cost</span>
                        <span className="text-[9px] text-slate-400 ml-1">· % gaji untuk kebutuhan hidup</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-black text-slate-800">{lcRatio.toFixed(1)}%</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${lcRatio <= 50 ? 'bg-emerald-200 text-emerald-700' : lcRatio <= 70 ? 'bg-amber-200 text-amber-700' : 'bg-red-200 text-red-700'}`}>{lcLabel}</span>
                      </div>
                    </div>
                    <div className="w-full bg-white/70 h-1 rounded-full overflow-hidden">
                      <div className={`h-full ${lcBarColor} rounded-full transition-all`} style={{width: `${Math.min(100, lcRatio)}%`}}/>
                    </div>
                    <p className="text-[8px] text-slate-400 mt-0.5">{showBalances ? formatCurrency(metrics.livingCost) : '••••'}/bln · Ideal ≤50%</p>
                  </div>
                );
              })()}

              {/* Hutang aktif count */}
              <div className="p-2.5 rounded-xl border bg-slate-50 border-slate-100 flex justify-between items-center">
                <div>
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Hutang Aktif</span>
                  <span className="text-[9px] text-slate-400 ml-1">· total kewajiban berjalan</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-black text-slate-800">{metrics.activeDebts.length}</span>
                  <span className="text-[9px] text-slate-500">pinjaman</span>
                </div>
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
          {/* Card: Yearly Debt Progress */}
          <Reveal delay={150}>
            {(() => {
              const today = new Date();
              const selectedDebt = debtProgressFilter === 'all' ? null : metrics.activeDebts.find(d => d.id === debtProgressFilter);
              const debtsToShow = selectedDebt ? [selectedDebt] : metrics.activeDebts;

              // Current overall progress
              const totalOriginal  = debtsToShow.reduce((s, d) => s + Number(d.originalPrincipal || d.remainingPrincipal), 0);
              const totalRemaining = debtsToShow.reduce((s, d) => s + Number(d.remainingPrincipal || 0), 0);
              const totalPaid      = totalOriginal - totalRemaining;
              const paidPct        = totalOriginal > 0 ? Math.min(100, (totalPaid / totalOriginal) * 100) : 0;

              // Max end year across debts
              const maxEndYear = debtsToShow.reduce((mx, d) => {
                if (!d.endDate) return mx;
                const yr = new Date(d.endDate).getFullYear();
                return yr > mx ? yr : mx;
              }, today.getFullYear());

              // Year-by-year simulation (all years from NEXT year until fully paid)
              // Uses remaining-principal linear approximation per debt
              type YearEntry = { year: number; balance: number; pct: number; delta: number };
              const years: YearEntry[] = [];
              let prevPct = paidPct;

              for (let y = today.getFullYear() + 1; y <= maxEndYear + 1; y++) {
                let balanceAtYearEnd = 0;
                debtsToShow.forEach(d => {
                  if (!d.endDate) return;
                  const endDate = new Date(d.endDate);
                  const startDate = new Date(d.startDate || today);
                  if (endDate.getFullYear() < y) return; // already paid by this year

                  // Month-accurate: how many months remain at start of year y?
                  const debtTotalMonths = Math.max(1,
                    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
                    (endDate.getMonth() - startDate.getMonth())
                  );
                  // Months from Jan 1 of year y to debt end
                  const monthsLeftAtYearStart = Math.max(0,
                    (endDate.getFullYear() - y) * 12 + endDate.getMonth()
                  );
                  const ratio = Math.max(0, Math.min(1, monthsLeftAtYearStart / debtTotalMonths));
                  balanceAtYearEnd += Number(d.originalPrincipal || d.remainingPrincipal) * ratio;
                });

                const paidByYear = totalOriginal - balanceAtYearEnd;
                const pctByYear  = totalOriginal > 0 ? Math.min(100, Math.max(0, (paidByYear / totalOriginal) * 100)) : 0;
                const delta      = pctByYear - prevPct;
                years.push({ year: y, balance: Math.max(0, balanceAtYearEnd), pct: pctByYear, delta });
                prevPct = pctByYear;
                if (balanceAtYearEnd <= 0) break;
              }

              // Filter: only show future years with meaningful progress, cap at 6 rows
              const futureYears = years.filter(y => y.balance > 0 || y.pct >= 99.9).slice(0, 6);

              return (
              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all h-full flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-red-50 text-red-500 rounded-xl"><CreditCard size={16}/></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Progress Hutang</p>
                  </div>
                  <select
                    value={debtProgressFilter}
                    onChange={e => setDebtProgressFilter(e.target.value)}
                    className="text-[9px] font-bold border border-slate-200 rounded-lg px-1.5 py-1 text-slate-600 bg-white focus:outline-none cursor-pointer"
                  >
                    <option value="all">Semua</option>
                    {metrics.activeDebts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>

                {/* Overall progress bar with year milestone ticks */}
                <div className="mb-4">
                  <div className="flex justify-between mb-1">
                    <span className="text-[10px] font-bold text-slate-500">Sudah terbayar</span>
                    <span className="text-[10px] font-black text-emerald-600">{paidPct.toFixed(1)}%</span>
                  </div>

                  {/* Bar + ticks container */}
                  <div className="relative">
                    {/* Year tick markers above the bar */}
                    {futureYears.length > 0 && (
                      <div className="relative h-4 mb-0.5">
                        {futureYears.map(({ year, pct: tickPct }) => (
                          <div
                            key={year}
                            className="absolute -translate-x-1/2 flex flex-col items-center"
                            style={{ left: `${Math.min(97, Math.max(3, tickPct))}%` }}
                          >
                            <span className="text-[8px] font-bold text-slate-400 whitespace-nowrap leading-none">{year}</span>
                            <span className="text-[7px] text-slate-300 leading-none">{tickPct.toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Green progress bar */}
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-visible relative">
                      {/* Filled portion */}
                      <div
                        className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-1000 relative"
                        style={{ width: `${paidPct}%` }}
                      />
                      {/* Year tick lines overlaid on the bar track */}
                      {futureYears.map(({ year, pct: tickPct }) => (
                        <div
                          key={year}
                          className="absolute top-0 bottom-0 w-px bg-slate-400/60"
                          style={{ left: `${Math.min(97, Math.max(3, tickPct))}%` }}
                          title={`${year}: ${tickPct.toFixed(1)}%`}
                        />
                      ))}
                    </div>

                    {/* Labels below bar */}
                    <div className="flex justify-between mt-1">
                      <span className="text-[9px] text-emerald-600 font-bold">{showBalances ? formatCurrency(totalPaid) : '••••'} lunas</span>
                      <span className="text-[9px] text-red-500 font-bold">{showBalances ? formatCurrency(totalRemaining) : '••••'} sisa</span>
                    </div>
                  </div>
                </div>

                {/* Year-by-year cards */}
                <div className="space-y-1.5 flex-1">
                  {futureYears.map(({ year, balance, pct, delta }) => {
                    const isDone = balance <= 0;
                    return (
                      <div
                        key={year}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-100"
                      >
                        <span className="text-[9px] font-black w-8 shrink-0 text-slate-500">{year}</span>
                        <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isDone ? 'bg-emerald-500' : 'bg-slate-400'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {/* % at year end */}
                        <span className={`text-[9px] font-black w-8 text-right shrink-0 ${isDone ? 'text-emerald-600' : 'text-slate-600'}`}>
                          {isDone ? '✓' : `${pct.toFixed(0)}%`}
                        </span>
                        {/* delta badge */}
                        <span className="text-[8px] text-emerald-600 font-bold bg-emerald-50 rounded px-1 shrink-0 w-10 text-center">
                          +{delta.toFixed(0)}%
                        </span>
                        {/* remaining balance */}
                        <span className={`text-[9px] font-bold shrink-0 w-16 text-right ${isDone ? 'text-emerald-600' : 'text-slate-500'}`}>
                          {isDone ? 'Lunas' : (showBalances ? formatCurrency(balance) : '••••')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              );
            })()}
          </Reveal>

          {/* Card: Net Cashflow */}
          <Reveal delay={200}>
            {(() => {
              const inc = Number(income) || 0;
              const debt = metrics.monthlyDebtObligation;
              const living = metrics.livingCost;
              const totalOut = debt + living;
              const cf = metrics.netCashflow;
              const isSurplus = cf >= 0;
              const cfPct = inc > 0 ? Math.abs(cf / inc * 100) : 0;
              const advice = isSurplus
                ? cfPct >= 20 ? 'Luar biasa! Alokasikan surplus ke investasi atau pelunasan hutang lebih cepat.'
                : cfPct >= 10 ? 'Cashflow sehat. Pertahankan dan tambah alokasi tabungan.'
                : 'Surplus tipis. Cek pengeluaran yang bisa dikurangi agar lebih leluasa.'
                : 'Pengeluaran melebihi income! Segera audit pos anggaran dan potong yang tidak perlu.';
              return (
              <div className={`rounded-3xl p-5 border shadow-sm hover:shadow-md transition-all group relative overflow-hidden ${isSurplus ? 'bg-emerald-950 border-emerald-900' : 'bg-red-950 border-red-900'}`}>
                <div className="relative z-10 h-full flex flex-col">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`p-2 rounded-xl ${isSurplus ? 'bg-emerald-900 text-emerald-400' : 'bg-red-900 text-red-400'}`}><TrendingUp size={16}/></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Cashflow</p>
                  </div>
                  <h3 className={`text-2xl font-black ${isSurplus ? 'text-emerald-400' : 'text-red-400'}`}>
                    {showBalances ? formatCurrency(cf) : <span className="text-slate-600">{'* * * * * *'}</span>}
                  </h3>
                  <p className={`text-[9px] mt-0.5 font-bold ${isSurplus ? 'text-emerald-600' : 'text-red-500'}`}>
                    = Income {showBalances ? formatCurrency(inc) : '••••'} − Hutang {showBalances ? formatCurrency(debt) : '••••'} − Living {showBalances ? formatCurrency(living) : '••••'}
                  </p>
                  <div className="mt-3 flex-1">
                    <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${isSurplus ? 'bg-emerald-500' : 'bg-red-500'}`} style={{width: `${Math.min(100, cfPct * 3)}%`}}/>
                    </div>
                    <p className={`text-[9px] mt-2 leading-relaxed italic ${isSurplus ? 'text-emerald-600/80' : 'text-red-500/80'}`}>{advice}</p>
                  </div>
                </div>
              </div>
              );
            })()}
          </Reveal>

          {/* Card: Kewajiban Bulanan */}
          <Reveal delay={250}>
            {(() => {
              const today = new Date();
              const monthNames = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
              const inc = Number(income) || 1;

              // ── Danger months (STEPUP spikes) ──────────────────────
              const dangerMonths: string[] = [];
              metrics.activeDebts.forEach(d => {
                if ((d.interestStrategy||'').toUpperCase().includes('STEP')) {
                  let stepUp: any[] = [];
                  try { stepUp = typeof d.stepUpSchedule === 'string' ? JSON.parse(d.stepUpSchedule) : (d.stepUpSchedule || []); } catch(e){}
                  stepUp.forEach((range: any) => {
                    const absMonth = Number(range.startMonth ?? range.mulai ?? 0);
                    const amount = Number(range.amount ?? range.cicilan ?? 0);
                    if (amount > 0) {
                      const startDate = new Date(d.startDate);
                      const targetDate = new Date(startDate.getFullYear(), startDate.getMonth() + absMonth - 1, 1);
                      const dsr = (amount / inc) * 100;
                      if (dsr > 35 && targetDate >= today) {
                        dangerMonths.push(`${monthNames[targetDate.getMonth()]} ${targetDate.getFullYear()} (naik ke ${amount < 1e6 ? (amount/1000).toFixed(0)+'rb' : (amount/1e6).toFixed(1)+'jt'})`);
                      }
                    }
                  });
                }
              });
              const uniqueDanger = [...new Set(dangerMonths)].slice(0, 2);
              const thisMonth = monthNames[today.getMonth()] + ' ' + today.getFullYear();

              // ── Yearly Projection Bar Chart ─────────────────────────
              // Simulate month-by-month from today until all debts paid
              // Each year: sum all monthly cicilan for active debts that month
              const yearlyData: { year: string; total: number; isCurrentYear: boolean }[] = [];
              if (metrics.activeDebts.length > 0) {
                const maxEndDate = metrics.activeDebts.reduce((latest, d) => {
                  if (!d.endDate) return latest;
                  const ed = new Date(d.endDate);
                  return ed > latest ? ed : latest;
                }, new Date());

                const simStart = new Date(today.getFullYear(), today.getMonth(), 1);
                const simEnd   = new Date(maxEndDate.getFullYear(), maxEndDate.getMonth() + 1, 1);
                const yearMap: Record<number, number> = {};

                for (let cursor = new Date(simStart); cursor < simEnd; cursor.setMonth(cursor.getMonth() + 1)) {
                  const yr = cursor.getFullYear();
                  const monthIdx = (cursor.getFullYear() - today.getFullYear()) * 12 + (cursor.getMonth() - today.getMonth());
                  let monthTotal = 0;
                  metrics.activeDebts.forEach(d => {
                    if (!d.endDate) return;
                    const debtEnd = new Date(d.endDate);
                    if (cursor > debtEnd) return; // debt already paid
                    // Get installment for this specific month
                    const debtStart = d.startDate ? new Date(d.startDate) : today;
                    const mp = (cursor.getFullYear() - debtStart.getFullYear()) * 12 + (cursor.getMonth() - debtStart.getMonth()) + 1;
                    let strategy = ((d.interestStrategy||'FIXED')).toUpperCase();
                    if (strategy === 'STEP_UP') strategy = 'STEPUP';
                    if (strategy === 'STEPUP' && d.stepUpSchedule) {
                      let sched: any[] = [];
                      try { sched = typeof d.stepUpSchedule === 'string' ? JSON.parse(d.stepUpSchedule) : (d.stepUpSchedule as any[]); } catch(e){}
                      const norm = sched.map((r: any) => ({
                        s: Number(r.startMonth ?? r.start_month ?? r.mulai ?? 0),
                        e: Number(r.endMonth   ?? r.end_month   ?? r.akhir  ?? 0),
                        a: Number(r.amount     ?? r.cicilan     ?? 0),
                      }));
                      const period = norm.find(p => mp >= p.s && mp <= p.e);
                      monthTotal += period ? period.a : (norm.length > 0 ? norm[norm.length-1].a : Number(d.monthlyPayment||0));
                    } else if ((strategy === 'ANNUITY' || strategy === 'EFEKTIF') && d.interestRate && d.remainingMonths) {
                      // Use stored monthly payment for projection (constant annuity)
                      monthTotal += Number(d.monthlyPayment || 0);
                    } else {
                      monthTotal += Number(d.monthlyPayment || 0);
                    }
                  });
                  yearMap[yr] = (yearMap[yr] || 0) + monthTotal;
                  void monthIdx;
                }

                const currentYear = today.getFullYear();
                Object.entries(yearMap).sort(([a],[b]) => Number(a)-Number(b)).forEach(([yr, total]) => {
                  yearlyData.push({ year: yr, total: Math.round(total), isCurrentYear: Number(yr) === currentYear });
                });
              }

              const maxYearlyTotal = yearlyData.length > 0 ? Math.max(...yearlyData.map(d => d.total)) : 1;

              return (
              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all h-full flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-50 text-blue-500 rounded-xl"><Calendar size={16}/></div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kewajiban Bulan Ini</p>
                      <p className="text-[9px] text-slate-400">{thisMonth}</p>
                    </div>
                  </div>
                </div>

                {/* Amount */}
                <h3 className="text-2xl font-black text-slate-900">
                  {showBalances ? formatCurrency(metrics.monthlyDebtObligation) : <span className="text-slate-300">{'* * * * *'}</span>}
                </h3>
                <p className="text-[9px] text-slate-400 mt-0.5">Total cicilan semua hutang aktif bulan ini</p>

                {/* DSR Bar */}
                <div className="mt-3">
                  <div className="flex justify-between mb-1">
                    <div className="flex items-center gap-1">
                      <span className={`text-[10px] font-black ${dsrStatus.color}`}>{dsrStatus.label}</span>
                      <span className="text-[9px] text-slate-400">· DSR {metrics.dsr.toFixed(1)}%</span>
                    </div>
                    <span className="text-[9px] text-slate-400">Ideal ≤30%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-1000 ${dsrStatus.bg}`} style={{ width: `${Math.min(100, metrics.dsr)}%` }} />
                  </div>
                  <p className="text-[8px] text-slate-400 mt-1">DSR = cicilan hutang ÷ income × 100%. Makin kecil makin sehat.</p>
                </div>

                {/* ── Yearly Projection Chart ───────────────────────── */}
                {yearlyData.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                        <BarChart3 size={11} className="text-blue-400"/>
                        Proyeksi Kewajiban Per Tahun
                      </p>
                      <p className="text-[9px] text-slate-400">{yearlyData.length} tahun tersisa</p>
                    </div>

                    {/* Custom bar chart — lightweight, no recharts overhead */}
                    <div className="space-y-1.5">
                      {yearlyData.map((d) => {
                        const pct = maxYearlyTotal > 0 ? (d.total / maxYearlyTotal) * 100 : 0;
                        const inBillions = d.total >= 1e9;
                        const label = inBillions
                          ? (d.total / 1e9).toFixed(2) + ' M'
                          : d.total >= 1e6
                            ? (d.total / 1e6).toFixed(1) + ' jt'
                            : (d.total / 1e3).toFixed(0) + ' rb';
                        return (
                          <div key={d.year} className="flex items-center gap-2">
                            <span className={`text-[9px] font-bold w-8 text-right flex-shrink-0 ${d.isCurrentYear ? 'text-blue-600' : 'text-slate-400'}`}>
                              {d.year}
                            </span>
                            <div className="flex-1 h-4 bg-slate-50 rounded-md overflow-hidden relative">
                              <div
                                className={`h-full rounded-md transition-all duration-700 ${d.isCurrentYear ? 'bg-blue-500' : 'bg-slate-300'}`}
                                style={{ width: `${Math.max(2, pct)}%` }}
                              />
                              {/* Amount label inside/outside bar */}
                              <span
                                className={`absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold ${pct > 60 ? 'text-white' : 'text-slate-500'}`}
                                style={{ mixBlendMode: 'normal' }}
                              >
                                {showBalances ? label : '•••'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Total remaining */}
                    <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center">
                      <span className="text-[9px] text-slate-400">Total sisa kewajiban</span>
                      <span className="text-[10px] font-black text-slate-700">
                        {showBalances ? formatCurrency(yearlyData.reduce((a,d) => a + d.total, 0)) : '•••'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Danger months */}
                {uniqueDanger.length > 0 && (
                  <div className="mt-3 p-2 bg-red-50 border border-red-100 rounded-xl">
                    <p className="text-[9px] font-black text-red-600 flex items-center gap-1"><AlertTriangle size={10}/> Cicilan naik di:</p>
                    {uniqueDanger.map((m, i) => (
                      <p key={i} className="text-[9px] text-red-500 mt-0.5">• {m}</p>
                    ))}
                  </div>
                )}
              </div>
              );
            })()}
          </Reveal>

          {/* Card: Tagihan Terdekat & Dana Cadangan — replaces LivingCost (moved to FinHealth) */}
          <Reveal delay={300}>
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all h-full flex flex-col gap-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="p-2 bg-amber-50 text-amber-500 rounded-xl"><Zap size={16}/></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ringkasan Kewajiban</p>
              </div>
              {metrics.activeDebts.map(d => {
                const orig = Number(d.originalPrincipal || d.remainingPrincipal);
                const rem = Number(d.remainingPrincipal);
                const paid = orig - rem;
                const pct = orig > 0 ? Math.min(100, paid/orig*100) : 0;
                const end = new Date(d.endDate);
                const monthsLeft = Math.max(0, (end.getFullYear() - new Date().getFullYear())*12 + (end.getMonth() - new Date().getMonth()));
                return (
                  <div key={d.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[10px] font-black text-slate-700 truncate max-w-[120px]">{d.name}</span>
                      <span className="text-[9px] text-slate-400">{monthsLeft} bln lagi</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{width: `${pct}%`}}/>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[9px] text-emerald-600 font-bold">{pct.toFixed(0)}% lunas</span>
                      <span className="text-[9px] text-slate-500">{showBalances ? formatCurrency(rem) : '••••'} sisa</span>
                    </div>
                  </div>
                );
              })}
              {metrics.activeDebts.length === 0 && (
                <div className="text-center py-6 text-slate-400 text-xs">Tidak ada hutang aktif 🎉</div>
              )}
            </div>
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
      <FeatureGate featureKey="freedom_matrix" fallback="lock" title="Freedom Matrix">
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
      </FeatureGate>

      {/* ============================================ */}
      {/* SECTION 6: ANALYSIS GRID                     */}
      {/* ============================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* CROSSING ANALYSIS */}
        <FeatureGate featureKey="crossing_analysis" fallback="lock" title="Crossing Analysis">
        <Reveal delay={100}>
          {(() => {
            const activeDebts = metrics.activeDebts;
            const allDebtIds = activeDebts.map(d => d.id);
            const selectedIds = crossingDebtFilter.length === 0 ? allDebtIds : crossingDebtFilter;

            // Filter crossingData to only selected debts
            const displayData = filteredCrossingData || crossingData;
            const hasCrossing = !!displayData?.dangerMonth;
            const isSingleDebt = selectedIds.length === 1;
            const singleDebt = isSingleDebt ? activeDebts.find(d => d.id === selectedIds[0]) : null;

            // Compute impact: what % of total debt is currently selected
            const totalObligation = activeDebts.reduce((s,d)=>s+Number(d.monthlyPayment||0),0);
            const selectedObligation = activeDebts.filter(d=>selectedIds.includes(d.id)).reduce((s,d)=>s+Number(d.monthlyPayment||0),0);
            const selectedPct = totalObligation > 0 ? Math.round(selectedObligation/totalObligation*100) : 100;

            return (
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
            {/* Header */}
            <div className="flex justify-between items-start mb-2">
              <div>
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-2 uppercase tracking-widest">
                  <Target className="text-blue-600" size={16}/> Crossing Analysis
                </h2>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Proyeksi ke depan: kapan total pengeluaran akan melampaui income?
                </p>
              </div>
              {hasCrossing && (
                <span className="px-2 py-1 bg-red-50 text-red-600 rounded-lg text-[10px] font-bold flex items-center gap-1 border border-red-100 animate-pulse shrink-0">
                  <AlertTriangle size={10}/> Bahaya @ {displayData.dangerMonth.name}
                </span>
              )}
            </div>

            {/* WHY THIS WIDGET EXISTS */}
            <div className={`mb-4 p-3 rounded-xl border text-[10px] leading-relaxed ${hasCrossing ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
              <p className={`font-black mb-0.5 ${hasCrossing ? 'text-red-600' : 'text-emerald-700'}`}>
                {hasCrossing ? '⚠ Perlu Aksi Sebelum ' + displayData.dangerMonth.name : '✓ Cashflow Aman Hingga Lunas'}
              </p>
              <p className={hasCrossing ? 'text-red-700' : 'text-emerald-700'}>
                {hasCrossing
                  ? `Grafik ini memproyeksikan pengeluaranmu ke depan sampai hutang lunas. Pada ${displayData.dangerMonth.name}, cicilan STEPUP atau biaya hidup naik sehingga total pengeluaran melampaui income. Kamu perlu menyiapkan dana tambahan atau refinancing sebelum bulan itu.`
                  : `Berdasarkan proyeksi saat ini, pengeluaran tidak akan melampaui income hingga semua hutang lunas. Tetap jaga cashflow positif.`}
              </p>
            </div>

            {/* DEBT FILTER CHIPS */}
            {activeDebts.length > 1 && (
              <div className="mb-4">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2">Filter Hutang — lihat impact per hutang ke grafik:</p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setCrossingDebtFilter([])}
                    className={`px-2.5 py-1 rounded-full text-[9px] font-black border transition-all ${crossingDebtFilter.length === 0 ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}
                  >
                    Semua ({selectedPct === 100 ? '100' : selectedPct}%)
                  </button>
                  {activeDebts.map(d => {
                    const isActive = crossingDebtFilter.includes(d.id);
                    const cicilan = Number(d.monthlyPayment || 0);
                    const pct = totalObligation > 0 ? Math.round(cicilan/totalObligation*100) : 0;
                    return (
                      <button
                        key={d.id}
                        onClick={() => {
                          setCrossingDebtFilter(prev => {
                            if (prev.includes(d.id)) return prev.filter(x => x !== d.id);
                            return [...prev, d.id];
                          });
                        }}
                        className={`px-2.5 py-1 rounded-full text-[9px] font-black border transition-all flex items-center gap-1 ${isActive ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70"/>
                        {d.name.length > 18 ? d.name.slice(0,18)+'…' : d.name}
                        <span className="opacity-70">·{pct}%</span>
                      </button>
                    );
                  })}
                </div>
                {crossingDebtFilter.length > 0 && crossingDebtFilter.length < allDebtIds.length && (
                  <p className="text-[9px] text-blue-600 mt-1.5">
                    Menampilkan {crossingDebtFilter.length} dari {allDebtIds.length} hutang · {selectedPct}% total kewajiban · Grafik berubah untuk menunjukkan proyeksi tanpa hutang yang tidak dipilih
                  </p>
                )}
              </div>
            )}

            {/* Summary Pills */}
            {displayData && (
              <div className="flex flex-wrap gap-2 mb-4">
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-bold text-emerald-700">Income: {formatCurrency(displayData.data?.[0]?.Income || 0)}</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-100">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-[10px] font-bold text-red-700">Expense: {formatCurrency(displayData.data?.[0]?.TotalExpense || 0)}</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 border border-blue-100">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-[10px] font-bold text-blue-700">
                    {isSingleDebt ? singleDebt?.name : 'Semua'} Hutang: {formatCurrency(displayData.data?.[0]?.Debt || 0)}
                  </span>
                </div>
                {crossingDebtFilter.length > 0 && crossingDebtFilter.length < allDebtIds.length && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-100">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-[10px] font-bold text-amber-700">
                      {hasCrossing ? '⚠ Masih crossing' : '✓ Tanpa hutang lain: aman'}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="h-[280px] w-full">
              {displayData && displayData.data && displayData.data.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={displayData.data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
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
                    {displayData.dangerMonth && (
                      <ReferenceLine x={displayData.dangerMonth.name} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'top', value: 'CROSSING!', fill: '#ef4444', fontSize: 9, fontWeight: 'bold' }} />
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
            );
          })()}
        </Reveal>
        </FeatureGate>

        {/* RIGHT COLUMN: DECISION + STRUCTURE */}
        <div className="space-y-6">
          
          {/* "WHICH PAIN" DECISION — EXPANDED */}
          <Reveal delay={150}>
            {(() => {
              const inc = Number(income) || 1;
              const debt = metrics.monthlyDebtObligation;
              const dsr = metrics.dsr;
              const living = metrics.livingCost;
              const totalOut = debt + living;
              const surplus = inc - totalOut;

              // How much extra income needed to hit 30% DSR
              const targetIncome = debt / 0.30;
              const incomeGap = Math.max(0, targetIncome - inc);

              // How much debt to cut to hit 30% DSR
              const targetDebt = inc * 0.30;
              const debtToElim = Math.max(0, debt - targetDebt);

              // Ideal cicilan if refinancing all to 30% DSR ceiling
              const idealCicilan = inc * 0.30;
              // At idealCicilan per month for remaining balance, estimate tenor
              const totalRem = metrics.activeDebts.reduce((s,d) => s + Number(d.remainingPrincipal||0), 0);
              const avgRate = metrics.activeDebts.length > 0
                ? metrics.activeDebts.reduce((s,d) => s + Number(d.interestRate||0), 0) / metrics.activeDebts.length
                : 5;
              const monthlyRate = (avgRate / 100) / 12;
              const refinanceTenorMonths = idealCicilan > 0 && totalRem > 0
                ? Math.ceil(monthlyRate > 0
                    ? Math.log(idealCicilan / (idealCicilan - totalRem * monthlyRate)) / Math.log(1 + monthlyRate)
                    : totalRem / idealCicilan)
                : 0;
              const refinanceTenorYears = (refinanceTenorMonths / 12).toFixed(1);

              // Sewa opsi: estimate monthly rental income from highest-value debt asset
              const kprDebt = metrics.activeDebts.find(d => (d.debtType||'').toUpperCase().includes('KPR') || (d.name||'').toLowerCase().includes('rumah') || (d.name||'').toLowerCase().includes('graha'));
              const estimatedRental = kprDebt ? Math.round(Number(kprDebt.remainingPrincipal) * 0.005) : 0; // ~0.5%/month of property value
              const rentalDsrImpact = estimatedRental > 0 ? ((estimatedRental / inc) * 100).toFixed(1) : '0';

              const problem = dsr > 40
                ? `DSR kamu ${dsr.toFixed(1)}% — setiap bulan ${dsr.toFixed(0)}% gaji langsung habis untuk cicilan. Batas aman adalah 30%, artinya kamu kelebihan beban cicilan ${formatCurrency(debtToElim)}/bln.`
                : `DSR kamu ${dsr.toFixed(1)}% — mendekati batas waspada 40%. Kamu perlu ${formatCurrency(incomeGap)}/bln income tambahan untuk turun ke zona aman.`;

              const options = [
                {
                  id: 'A',
                  icon: <Wallet size={14}/>,
                  title: 'Tambah Pendapatan',
                  color: 'bg-blue-600/90 border-blue-500',
                  highlight: 'ring-2 ring-blue-400/30',
                  value: formatCurrency(incomeGap),
                  valueLabel: '/bulan tambahan income',
                  why: `Dengan tambahan ${formatCurrency(incomeGap)}/bln, DSR langsung turun ke 30% (zona sehat). Cashflow bertambah dan kamu tidak perlu mengubah gaya hidup.`,
                  impact: `DSR turun dari ${dsr.toFixed(1)}% → 30% · Surplus bertambah ${formatCurrency(incomeGap)}/bln`,
                  recommended: dsr <= 45,
                },
                {
                  id: 'B',
                  icon: <Scissors size={14}/>,
                  title: 'Jual Aset / Hemat',
                  color: 'bg-amber-600/90 border-amber-500',
                  highlight: 'ring-2 ring-amber-400/30',
                  value: formatCurrency(debtToElim),
                  valueLabel: 'cicilan perlu dipangkas/bln',
                  why: `Lunasi atau jual aset yang cicilannya memberatkan agar total cicilan turun ${formatCurrency(debtToElim)}/bln. Pilih hutang dengan bunga tertinggi atau nilai aset terbesar.`,
                  impact: `Mengurangi beban ${formatCurrency(debtToElim)}/bln · DSR turun ke 30% · Bebas dari 1 kewajiban`,
                  recommended: dsr > 45,
                },
                {
                  id: 'C',
                  icon: <Building2 size={14}/>,
                  title: 'Pindah Bank / Refinancing',
                  color: 'bg-purple-600/90 border-purple-500',
                  highlight: 'ring-2 ring-purple-400/30',
                  value: formatCurrency(idealCicilan),
                  valueLabel: `/bln (tenor ~${refinanceTenorYears} thn)`,
                  why: `Ajukan refinancing ke bank dengan bunga lebih rendah. Target cicilan ideal ${formatCurrency(idealCicilan)}/bln (30% income). Dengan sisa hutang ${formatCurrency(totalRem)}, estimasi tenor baru ~${refinanceTenorYears} tahun.`,
                  impact: `Cicilan turun ke ${formatCurrency(idealCicilan)}/bln · DSR ke 30% · Tenor ~${refinanceTenorYears} thn`,
                  recommended: dsr > 40 && refinanceTenorMonths > 0 && refinanceTenorMonths < 300,
                },
                ...(estimatedRental > 0 ? [{
                  id: 'D',
                  icon: <Home size={14}/>,
                  title: 'Sewakan Properti',
                  color: 'bg-emerald-600/90 border-emerald-500',
                  highlight: 'ring-2 ring-emerald-400/30',
                  value: `+${formatCurrency(estimatedRental)}`,
                  valueLabel: '/bulan estimasi sewa',
                  why: `${kprDebt?.name || 'Properti'} bisa disewakan. Estimasi sewa ~0.5% dari nilai properti = ${formatCurrency(estimatedRental)}/bln. Penghasilan sewa bisa langsung menutup sebagian cicilan.`,
                  impact: `Menutup ${rentalDsrImpact}% dari DSR · DSR efektif turun ke ~${Math.max(0, dsr - Number(rentalDsrImpact)).toFixed(1)}%`,
                  recommended: false,
                }] : []),
              ];

              return (
              <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-[0.03]"><Scissors size={120}/></div>
                <div className="relative z-10">
                  <h3 className="text-sm font-black text-amber-400 mb-1 flex items-center gap-2 uppercase tracking-widest">
                    <Target size={14}/> The "Which Pain" Decision
                  </h3>

                  {/* Problem Statement */}
                  <div className="mb-4 p-3 bg-red-900/30 border border-red-800/40 rounded-xl">
                    <p className="text-[10px] font-black text-red-400 uppercase tracking-wider mb-1">⚠ Masalah yang Dihadapi</p>
                    <p className="text-[11px] text-slate-300 leading-relaxed">{problem}</p>
                  </div>

                  {/* Options Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {options.map(opt => (
                      <div key={opt.id} className={`p-3.5 rounded-2xl border transition-all ${opt.color} ${opt.recommended ? opt.highlight : 'opacity-75'}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5 font-black text-xs">{opt.icon} {opt.title}</div>
                          {opt.recommended && <span className="text-[8px] bg-white/20 text-white px-1.5 py-0.5 rounded-full font-bold">Disarankan</span>}
                        </div>
                        <div className="text-base font-black text-white">{opt.value}</div>
                        <p className="text-[9px] text-white/70 mb-2">{opt.valueLabel}</p>
                        <div className="border-t border-white/10 pt-2">
                          <p className="text-[9px] text-white/80 leading-relaxed mb-1.5">{opt.why}</p>
                          <div className="bg-white/10 rounded-lg px-2 py-1">
                            <p className="text-[8px] font-black text-white/90">📈 Impact: {opt.impact}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              );
            })()}
          </Reveal>

          {/* STRUKTUR PENGELUARAN - ENHANCED */}
          <Reveal delay={200}>
            {(() => {
              const inc = Number(income) || 1;
              // Actual percentages vs income (not vs total spending)
              const needsPct  = Math.round((structureData[0].value / inc) * 100);
              const wantsPct  = Math.round((structureData[1].value / inc) * 100);
              const debtPct   = Math.round((structureData[2].value / inc) * 100);
              const savePct   = Math.max(0, 100 - needsPct - wantsPct - debtPct);

              // Ideal targets (50/30/20 adapted with debt awareness)
              const idealNeeds = 50; const idealWants = 20; const idealDebt = 30; const idealSave = 20;

              const rows = [
                { name: 'Kebutuhan', desc: 'biaya hidup & operasional', pct: needsPct, ideal: idealNeeds, color: COLORS.needs, idealNote: '≤50% income' },
                { name: 'Keinginan', desc: 'gaya hidup & hiburan', pct: wantsPct, ideal: idealWants, color: COLORS.wants, idealNote: '≤20% income' },
                { name: 'Cicilan Hutang', desc: 'DSR — semua kewajiban kredit', pct: debtPct, ideal: idealDebt, color: COLORS.debt, idealNote: '≤30% income' },
                { name: 'Tersisa / Nabung', desc: 'sisa untuk tabungan & investasi', pct: savePct, ideal: idealSave, color: '#10b981', idealNote: '≥20% income' },
              ];

              // Overall health note
              const problemRows = rows.filter(r => {
                if (r.name === 'Tersisa / Nabung') return r.pct < r.ideal;
                return r.pct > r.ideal;
              });
              const whyText = problemRows.length === 0
                ? 'Distribusi pengeluaranmu sudah ideal! Pertahankan dan tingkatkan porsi tabungan.'
                : `Widget ini menunjukkan ke mana setiap rupiah income-mu pergi. ${problemRows.map(r => r.name === 'Tersisa / Nabung' ? `Tabungan hanya ${r.pct}% (seharusnya ≥${r.ideal}%)` : `${r.name} ${r.pct}% melebihi ideal ${r.ideal}%`).join('; ')}.`;

              const pieData = [
                { name: 'Kebutuhan', value: structureData[0].value, color: COLORS.needs },
                { name: 'Keinginan', value: structureData[1].value, color: COLORS.wants },
                { name: 'Cicilan', value: structureData[2].value, color: COLORS.debt },
                ...(savePct > 0 ? [{ name: 'Sisa', value: Math.max(0, inc - totalStructure), color: '#10b981' }] : []),
              ];

              return (
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 uppercase tracking-widest">
                      <PieIcon size={14} className="text-slate-400"/> Struktur Cashflow
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Distribusi ke mana income-mu pergi setiap bulan</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-slate-400">Total Keluar</p>
                    <p className="text-sm font-black text-slate-900">{showBalances ? formatCurrency(totalStructure) : '••••'}</p>
                  </div>
                </div>

                {/* Why this widget exists */}
                <div className={`mb-4 p-3 rounded-xl border text-[10px] leading-relaxed ${problemRows.length === 0 ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-amber-50 border-amber-100 text-amber-800'}`}>
                  <span className="font-black">{problemRows.length === 0 ? '✓ Distribusi Sehat' : '⚠ Perlu Perhatian'}:</span> {whyText}
                </div>

                <div className="flex items-start gap-5">
                  {/* Bar rows with ideal comparison */}
                  <div className="flex-1 space-y-3">
                    {rows.map((item, idx) => {
                      const isOver = item.name === 'Tersisa / Nabung' ? item.pct < item.ideal : item.pct > item.ideal;
                      const gap = Math.abs(item.pct - item.ideal);
                      return (
                        <div key={idx}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{backgroundColor: item.color}} />
                              <div>
                                <span className="text-[10px] font-black text-slate-700">{item.name}</span>
                                <span className="text-[9px] text-slate-400 ml-1">· {item.desc}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={`text-[10px] font-black ${isOver ? 'text-red-500' : 'text-emerald-600'}`}>{item.pct}%</span>
                              <span className="text-[9px] text-slate-300">|</span>
                              <span className="text-[9px] text-slate-400">ideal {item.idealNote}</span>
                            </div>
                          </div>
                          {/* Stacked bar: actual vs ideal */}
                          <div className="relative w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, item.pct)}%`, backgroundColor: item.color, opacity: isOver ? 1 : 0.8 }} />
                            {/* Ideal marker line */}
                            <div className="absolute top-0 h-full w-0.5 bg-slate-400/60" style={{ left: `${Math.min(100, item.ideal)}%` }} />
                          </div>
                          {isOver && gap > 0 && (
                            <p className="text-[8px] mt-0.5" style={{color: item.color}}>
                              {item.name === 'Tersisa / Nabung'
                                ? `Kurang ${gap}% (${showBalances ? formatCurrency(inc * gap/100) : '••••'}/bln)`
                                : `Lebih ${gap}% dari ideal (${showBalances ? formatCurrency(inc * gap/100) : '••••'}/bln)`}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Donut chart */}
                  <div className="w-24 h-24 relative shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} innerRadius={28} outerRadius={42} paddingAngle={3} dataKey="value">
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[8px] font-black text-slate-400">INCOME</span>
                      <span className="text-[8px] font-black text-slate-600">{showBalances ? (inc >= 1e6 ? (inc/1e6).toFixed(1)+'jt' : (inc/1e3).toFixed(0)+'rb') : '••'}</span>
                    </div>
                  </div>
                </div>
              </div>
              );
            })()}
          </Reveal>
        </div>
      </div>

      {/* ============================================ */}
      {/* SECTION 7: KAPASITAS BAYAR                   */}
      {/* ============================================ */}
      <Reveal delay={100}>
        {(() => {
          const inc = Number(income) || 1;
          const living = metrics.livingCost;
          const debt = metrics.monthlyDebtObligation;
          // Kapasitas = uang yang tersisa setelah biaya hidup, SEBELUM bayar hutang
          const kapasitas = Math.max(0, inc - living);
          // Rasio = berapa persen kapasitas yang "habis" untuk bayar cicilan
          const ratio = kapasitas > 0 ? Math.min(200, (debt / kapasitas) * 100) : 100;
          const sisa = kapasitas - debt;
          const isCritical = ratio >= 100;
          const isWarning = ratio >= 75 && ratio < 100;

          const statusColor = isCritical ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-emerald-600';
          const statusBg = isCritical ? 'bg-red-50 border-red-200' : isWarning ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200';
          const statusLabel = isCritical ? 'Kritis — cicilan melebihi kemampuan' : isWarning ? 'Waspada — hampir di batas maksimum' : 'Sehat — masih ada ruang bernafas';

          const advice = isCritical
            ? `Cicilan hutang (${formatCurrency(debt)}) melebihi kapasitas bayarmu (${formatCurrency(kapasitas)}). Artinya kamu sedang "nombok" dari tabungan atau kamu menekan kebutuhan hidup. Ini tidak sustainable — segera cari solusi tambah income atau lunasi hutang terbesar.`
            : isWarning
            ? `${ratio.toFixed(0)}% dari uang bebas-mu habis untuk cicilan. Hanya tersisa ${formatCurrency(sisa)}/bln. Ruang gerak sangat sempit — hindari hutang baru dan fokus kurangi saldo cicilan terbesar.`
            : `Kapasitas bayarmu sehat. ${ratio.toFixed(0)}% dari uang bebas dipakai untuk cicilan, sisa ${formatCurrency(sisa)}/bln bisa untuk tabungan atau pelunasan ekstra. Optimalkan surplus ini untuk mempercepat lunas.`;

          // Bar data: show income breakdown as a single stacked bar
          const livingPct  = Math.min(100, (living / inc) * 100);
          const debtPct    = Math.min(100 - livingPct, (debt / inc) * 100);
          const sisaPct    = Math.max(0, 100 - livingPct - debtPct);

          return (
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 uppercase tracking-widest">
                  <BarChart3 className="text-blue-600" size={16}/> Kapasitas Bayar
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Seberapa kuat income-mu menanggung cicilan setelah kebutuhan hidup terpenuhi</p>
              </div>
              <span className={`px-2 py-1 rounded-lg text-[10px] font-black border ${statusBg} ${statusColor}`}>{statusLabel}</span>
            </div>

            {/* How to read + Explanation */}
            <div className="mb-4 p-3 rounded-xl border bg-slate-50 border-slate-100">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">💡 Fungsi Widget Ini</p>
              <p className="text-[10px] text-slate-600 leading-relaxed">
                Mengukur seberapa besar cicilan hutang menyita <strong>ruang gerak</strong> setelah semua kebutuhan hidup terpenuhi.
                Semakin kecil Rasio Cicilan, semakin banyak uang bebas untuk ditabung atau investasi.
              </p>
            </div>
            <div className={`mb-5 p-3 rounded-xl border ${statusBg}`}>
              <p className="text-[10px] font-black mb-1" style={{color: isCritical ? '#dc2626' : isWarning ? '#d97706' : '#059669'}}>
                {isCritical ? '🔴 Status Kritis' : isWarning ? '🟡 Status Waspada' : '🟢 Status Sehat'}
              </p>
              <p className="text-[10px] leading-relaxed" style={{color: isCritical ? '#dc2626' : isWarning ? '#d97706' : '#059669'}}>{advice}</p>
            </div>

            {/* Stacked income bar — visual breakdown of 1 month's income */}
            <div className="mb-4">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2">Distribusi Setiap Rp 100 Income</p>
              <div className="flex h-8 rounded-xl overflow-hidden w-full gap-0.5">
                <div className="flex items-center justify-center text-[9px] font-black text-white transition-all duration-1000 shrink-0"
                  style={{ width: `${livingPct}%`, background: '#3b82f6' }}
                  title={`Kebutuhan Hidup: ${livingPct.toFixed(0)}%`}>
                  {livingPct > 12 ? `${livingPct.toFixed(0)}%` : ''}
                </div>
                <div className="flex items-center justify-center text-[9px] font-black text-white transition-all duration-1000 shrink-0"
                  style={{ width: `${debtPct}%`, background: isCritical ? '#ef4444' : '#f97316' }}
                  title={`Cicilan Hutang: ${debtPct.toFixed(0)}%`}>
                  {debtPct > 8 ? `${debtPct.toFixed(0)}%` : ''}
                </div>
                <div className="flex items-center justify-center text-[9px] font-black text-emerald-800 transition-all duration-1000 flex-1"
                  style={{ background: '#d1fae5' }}
                  title={`Sisa Bebas: ${sisaPct.toFixed(0)}%`}>
                  {sisaPct > 5 ? `${sisaPct.toFixed(0)}% sisa` : ''}
                </div>
              </div>
              <div className="flex justify-between mt-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-[9px] text-slate-500 flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500 inline-block"/>Kebutuhan {showBalances ? formatCurrency(living) : '••••'}</span>
                  <span className="text-[9px] text-slate-500 flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-orange-500 inline-block"/>Cicilan {showBalances ? formatCurrency(debt) : '••••'}</span>
                  <span className="text-[9px] text-slate-500 flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-200 inline-block"/>Sisa {showBalances ? formatCurrency(Math.max(0, sisa)) : '••••'}</span>
                </div>
                <span className="text-[9px] font-black text-slate-600">{showBalances ? formatCurrency(inc) : '••••'}/bln</span>
              </div>
            </div>

            {/* Key ratio metric */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl text-center">
                <p className="text-[9px] text-slate-400 font-bold uppercase">Kapasitas Bebas</p>
                <p className="text-sm font-black text-slate-800">{showBalances ? formatCurrency(kapasitas) : '••••'}</p>
                <p className="text-[8px] text-slate-400">income − living cost</p>
              </div>
              <div className={`p-3 rounded-xl text-center ${isCritical ? 'bg-red-50' : isWarning ? 'bg-amber-50' : 'bg-emerald-50'}`}>
                <p className="text-[9px] text-slate-400 font-bold uppercase">Rasio Cicilan</p>
                <p className={`text-sm font-black ${statusColor}`}>{ratio.toFixed(0)}%</p>
                <p className="text-[8px] text-slate-400">dari kapasitas bebas</p>
              </div>
              <div className={`p-3 rounded-xl text-center ${sisa < 0 ? 'bg-red-50' : 'bg-slate-50'}`}>
                <p className="text-[9px] text-slate-400 font-bold uppercase">Sisa Bersih</p>
                <p className={`text-sm font-black ${sisa < 0 ? 'text-red-600' : 'text-slate-800'}`}>{showBalances ? formatCurrency(sisa) : '••••'}</p>
                <p className="text-[8px] text-slate-400">untuk nabung/investasi</p>
              </div>
            </div>

            {/* Action target */}
            {ratio > 60 && (
              <div className="mt-3 p-3 rounded-xl bg-blue-50 border border-blue-100">
                <p className="text-[9px] font-black text-blue-700 mb-0.5">🎯 Yang Harus Kamu Lakukan:</p>
                <p className="text-[10px] text-blue-600 leading-relaxed">
                  Untuk masuk zona aman (Rasio ≤75%), cicilan perlu turun ke maksimal <strong>{showBalances ? formatCurrency(kapasitas * 0.75) : '••••'}/bln</strong> — atau income perlu naik ke minimal <strong>{showBalances ? formatCurrency(debt / 0.75 + living) : '••••'}/bln</strong>.
                </p>
              </div>
            )}
          </div>
          );
        })()}
      </Reveal>

      {/* ============================================ */}
      {/* SECTION 8: RANGKUMAN KONDISI KEUANGAN        */}
      {/* ============================================ */}
      <Reveal delay={50}>
        {(() => {
          const inc = Number(income) || 1;
          const now = new Date();
          const monthNames = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

          // ── Health score label ──────────────────────────────
          const healthLabel = metrics.healthScore >= 80 ? 'Sangat Sehat'
            : metrics.healthScore >= 60 ? 'Sehat'
            : metrics.healthScore >= 40 ? 'Waspada'
            : 'Kritis';
          const healthColor = metrics.healthScore >= 80 ? 'text-emerald-600'
            : metrics.healthScore >= 60 ? 'text-blue-600'
            : metrics.healthScore >= 40 ? 'text-amber-600'
            : 'text-red-600';
          const healthBg = metrics.healthScore >= 80 ? 'bg-emerald-50 border-emerald-200'
            : metrics.healthScore >= 60 ? 'bg-blue-50 border-blue-200'
            : metrics.healthScore >= 40 ? 'bg-amber-50 border-amber-200'
            : 'bg-red-50 border-red-200';

          // ── Cashflow ────────────────────────────────────────
          const cashflowOk = metrics.netCashflow > 0;

          // ── Runway ──────────────────────────────────────────
          const runwayLabel = metrics.runway >= 6 ? 'Aman' : metrics.runway >= 3 ? 'Cukup' : 'Rawan';
          const runwayColor = metrics.runway >= 6 ? 'text-emerald-600' : metrics.runway >= 3 ? 'text-amber-600' : 'text-red-600';

          // ── Expense trend (last 6 months) ───────────────────
          const trend = metrics.monthlyTrend;
          const trendLast  = trend[trend.length - 1] || 0;
          const trendPrev  = trend[trend.length - 2] || 0;
          const trendDelta = trendPrev > 0 ? ((trendLast - trendPrev) / trendPrev) * 100 : 0;
          const trendUp    = trendDelta > 3;
          const trendDown  = trendDelta < -3;

          // ── Living cost ratio ───────────────────────────────
          const lcRatio = inc > 0 ? (metrics.livingCost / inc) * 100 : 0;
          const lcOk    = lcRatio <= 50;

          // ── Total progress lunas ────────────────────────────
          const totalOriginal  = metrics.activeDebts.reduce((s,d) => s + Number(d.originalPrincipal||d.remainingPrincipal),0);
          const totalPaid      = totalOriginal - metrics.totalDebt;
          const paidPct        = totalOriginal > 0 ? Math.min(100,(totalPaid/totalOriginal)*100) : 0;

          // ── Nearest debt due date ───────────────────────────
          const nearestDebt = [...metrics.activeDebts]
            .filter(d => d.endDate)
            .sort((a,b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime())[0];
          const nearestEndDate = nearestDebt ? new Date(nearestDebt.endDate) : null;
          const monthsToNearest = nearestEndDate
            ? (nearestEndDate.getFullYear() - now.getFullYear())*12 + (nearestEndDate.getMonth()-now.getMonth())
            : 0;

          // ── Sinking fund fill % ─────────────────────────────
          const sfGoal    = sinkingFunds.reduce((s,f) => s + Number(f.targetAmount||0), 0);
          const sfCurrent = metrics.totalLiquid;
          const sfPct     = sfGoal > 0 ? Math.min(100,(sfCurrent/sfGoal)*100) : 0;

          // ── Insight items ────────────────────────────────────
          type Insight = { icon: string; title: string; value: string; sub: string; status: 'good'|'warn'|'bad'|'info' };
          const insights: Insight[] = [
            {
              icon: '🏥',
              title: 'Skor Kesehatan',
              value: `${metrics.healthScore.toFixed(0)}/100 — ${healthLabel}`,
              sub: `DSR ${metrics.dsr.toFixed(1)}% · Runway ${metrics.runway.toFixed(1)} bln · Cashflow ${cashflowOk ? '+':''}${((metrics.netCashflow/inc)*100).toFixed(0)}%`,
              status: metrics.healthScore >= 60 ? 'good' : metrics.healthScore >= 40 ? 'warn' : 'bad',
            },
            {
              icon: '💸',
              title: 'Cashflow Bulanan',
              value: cashflowOk ? `Surplus ${((metrics.netCashflow/inc)*100).toFixed(0)}% dari income` : `Defisit — boros ${((-metrics.netCashflow/inc)*100).toFixed(0)}%`,
              sub: `Income − (living + cicilan) = ${cashflowOk ? '+':''}${showBalances ? new Intl.NumberFormat('id').format(Math.round(metrics.netCashflow)) : '•••'}`,
              status: cashflowOk ? 'good' : 'bad',
            },
            {
              icon: '🏦',
              title: 'Dana Darurat',
              value: `${metrics.runway.toFixed(1)} bulan — ${runwayLabel}`,
              sub: `Target ideal ≥6 bln · Saldo ${showBalances ? new Intl.NumberFormat('id').format(Math.round(metrics.totalLiquid)) : '•••'}`,
              status: metrics.runway >= 6 ? 'good' : metrics.runway >= 3 ? 'warn' : 'bad',
            },
            {
              icon: '📊',
              title: 'Rasio Pengeluaran',
              value: `${lcRatio.toFixed(0)}% dari income untuk hidup`,
              sub: `Cicilan ${metrics.dsr.toFixed(0)}% · Living ${lcRatio.toFixed(0)}% · Sisa ${(100-lcRatio-metrics.dsr).toFixed(0)}%`,
              status: lcOk ? 'good' : 'warn',
            },
            {
              icon: '📈',
              title: 'Tren Pengeluaran',
              value: trendDown ? `Turun ${Math.abs(trendDelta).toFixed(0)}% vs bulan lalu 👍` : trendUp ? `Naik ${trendDelta.toFixed(0)}% vs bulan lalu ⚠️` : 'Stabil bulan ini',
              sub: `${monthNames[now.getMonth()]} ${showBalances ? new Intl.NumberFormat('id').format(trendLast) : '•••'} vs ${monthNames[now.getMonth()-1<0?11:now.getMonth()-1]} ${showBalances ? new Intl.NumberFormat('id').format(trendPrev) : '•••'}`,
              status: trendDown ? 'good' : trendUp ? 'warn' : 'info',
            },
            {
              icon: '🎯',
              title: 'Progress Pelunasan',
              value: `${paidPct.toFixed(1)}% dari total hutang terlunasi`,
              sub: metrics.activeDebts.length > 0
                ? `${metrics.activeDebts.length} kontrak aktif · ${nearestDebt ? `${nearestDebt.name} lunas ${monthsToNearest <= 0 ? 'bulan ini' : `${monthsToNearest} bln lagi`}` : ''}`
                : 'Bebas hutang! 🎉',
              status: paidPct >= 50 ? 'good' : paidPct >= 20 ? 'info' : 'warn',
            },
            ...(sfGoal > 0 ? [{
              icon: '🪣',
              title: 'Sinking Fund',
              value: `${sfPct.toFixed(0)}% dari target terkumpul`,
              sub: `${showBalances ? new Intl.NumberFormat('id').format(Math.round(sfCurrent)) : '•••'} dari ${showBalances ? new Intl.NumberFormat('id').format(Math.round(sfGoal)) : '•••'} target`,
              status: (sfPct >= 80 ? 'good' : sfPct >= 40 ? 'info' : 'warn') as 'good'|'warn'|'bad'|'info',
            }] : []),
          ];

          const statusStyle = (s: Insight['status']) => {
            if (s === 'good') return { dot: 'bg-emerald-500', border: 'border-emerald-100', bg: 'bg-emerald-50/50', text: 'text-emerald-700' };
            if (s === 'warn') return { dot: 'bg-amber-400',   border: 'border-amber-100',   bg: 'bg-amber-50/50',   text: 'text-amber-700'  };
            if (s === 'bad')  return { dot: 'bg-red-500',     border: 'border-red-100',     bg: 'bg-red-50/50',     text: 'text-red-700'    };
            return              { dot: 'bg-blue-400',         border: 'border-blue-100',    bg: 'bg-blue-50/50',    text: 'text-blue-700'   };
          };

          // ── Overall verdict ──────────────────────────────────
          const goodCount = insights.filter(i => i.status === 'good').length;
          const badCount  = insights.filter(i => i.status === 'bad').length;
          const verdict = badCount >= 2 ? { text: 'Butuh Perhatian Segera', bg: 'bg-red-600', emoji: '🚨' }
            : badCount === 1 ? { text: 'Ada yang Perlu Diperbaiki', bg: 'bg-amber-500', emoji: '⚠️' }
            : goodCount >= insights.length * 0.7 ? { text: 'Kondisi Keuangan Prima', bg: 'bg-emerald-600', emoji: '✅' }
            : { text: 'Cukup Baik, Terus Jaga', bg: 'bg-blue-600', emoji: '💪' };

          return (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-br from-violet-500 to-indigo-600 text-white rounded-2xl shadow-lg shadow-violet-500/20">
                  <Sparkles size={18}/>
                </div>
                <div>
                  <p className="text-sm font-black text-slate-800">Rangkuman Kondisi Keuangan</p>
                  <p className="text-[10px] text-slate-400">{monthNames[now.getMonth()]} {now.getFullYear()} · {insights.length} indikator dianalisa</p>
                </div>
              </div>
              {/* Verdict badge */}
              <span className={`${verdict.bg} text-white text-[10px] font-black px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm`}>
                {verdict.emoji} {verdict.text}
              </span>
            </div>

            {/* AI Summary Banner */}
            <div className="px-6 py-3 bg-gradient-to-r from-violet-50 to-indigo-50 border-b border-violet-100 flex items-start gap-2">
              <BrainCircuit size={13} className="text-violet-500 mt-0.5 flex-shrink-0"/>
              <p className="text-[11px] text-violet-700 leading-relaxed">{aiSummary}</p>
            </div>

            {/* Insight Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-5">
              {insights.map((item, i) => {
                const st = statusStyle(item.status);
                return (
                  <div key={i} className={`rounded-2xl border ${st.border} ${st.bg} p-3.5 flex flex-col gap-1.5`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm leading-none">{item.icon}</span>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-wide">{item.title}</p>
                      </div>
                      <div className={`w-2 h-2 rounded-full ${st.dot} flex-shrink-0`}/>
                    </div>
                    <p className={`text-[11px] font-bold leading-tight ${st.text}`}>{item.value}</p>
                    <p className="text-[9px] text-slate-400 leading-relaxed">{item.sub}</p>
                  </div>
                );
              })}
            </div>

            {/* Footer: quick action tips */}
            <div className="px-6 pb-5">
              <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                  <Lightbulb size={11} className="text-amber-400"/> Fokus Utama Bulan Ini
                </p>
                <div className="flex flex-wrap gap-2">
                  {metrics.dsr > 40 && (
                    <span className="text-[10px] bg-red-100 text-red-700 font-bold px-2.5 py-1 rounded-full">🔥 DSR tinggi — hindari hutang baru</span>
                  )}
                  {metrics.runway < 3 && (
                    <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-2.5 py-1 rounded-full">🏦 Dana darurat rawan — prioritas isi sinking fund</span>
                  )}
                  {!cashflowOk && (
                    <span className="text-[10px] bg-red-100 text-red-700 font-bold px-2.5 py-1 rounded-full">💸 Cashflow negatif — review pengeluaran segera</span>
                  )}
                  {trendUp && cashflowOk && (
                    <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-2.5 py-1 rounded-full">📈 Pengeluaran naik {trendDelta.toFixed(0)}% — waspadai tren</span>
                  )}
                  {metrics.dsr <= 30 && cashflowOk && metrics.runway >= 6 && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2.5 py-1 rounded-full">✅ Semua indikator sehat — pertahankan & tingkatkan investasi</span>
                  )}
                  {metrics.dsr > 0 && metrics.dsr <= 30 && metrics.runway >= 3 && metrics.runway < 6 && (
                    <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2.5 py-1 rounded-full">🎯 Tingkatkan dana darurat ke 6 bulan</span>
                  )}
                  {nearestDebt && monthsToNearest <= 12 && monthsToNearest > 0 && (
                    <span className="text-[10px] bg-violet-100 text-violet-700 font-bold px-2.5 py-1 rounded-full">🎉 {nearestDebt.name} lunas {monthsToNearest} bln lagi!</span>
                  )}
                </div>
              </div>
            </div>
          </div>
          );
        })()}
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
