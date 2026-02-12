
import React, { useState, useMemo, useEffect } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend, ReferenceLine
} from 'recharts';
import { 
  Zap, AlertTriangle, CheckCircle2, Target, Info, Scissors, PieChart as PieIcon,
  Wallet, TrendingDown, AlertCircle, Calculator, Sparkles, BrainCircuit,
  Command, Send, Mic, ArrowUpRight, Activity, ShieldCheck, Clock
} from 'lucide-react';
import { DebtItem, ExpenseItem, TaskItem, DailyExpense, SinkingFund } from '../types';
import { formatCurrency, generateGlobalProjection, generateCrossingAnalysis } from '../services/financeUtils';
import { generateDashboardSummary, parseTransactionAI } from '../services/geminiService';

interface DashboardProps {
  debts: DebtItem[];
  allocations: ExpenseItem[]; 
  tasks: TaskItem[];
  income?: number;
  onAIAction?: (action: any) => void;
  userId: string;
  dailyExpenses?: DailyExpense[];
  sinkingFunds?: SinkingFund[]; 
  debtInstallments?: any[]; 
}

export default function Dashboard({ 
  debts = [], 
  allocations = [], 
  income = 0, 
  sinkingFunds = [],
  onAIAction
}: DashboardProps) {
  
  // --- STATE FOR WIDGETS ---
  const [extraPayment, setExtraPayment] = useState(0);
  const [freedomMode, setFreedomMode] = useState<'lump_sum' | 'cutoff'>('lump_sum');
  const [freedomMatrix, setFreedomMatrix] = useState<any>(null);
  const [crossingData, setCrossingData] = useState<any>(null);
  const [aiSummary, setAiSummary] = useState("AI sedang menganalisa data keuanganmu...");
  
  // AI COMMAND STATE
  const [commandInput, setCommandInput] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<{type: 'success'|'error', msg: string} | null>(null);

  // --- 1. CALCULATE METRICS ---
  const metrics = useMemo(() => {
    const activeDebts = debts.filter(d => !d._deleted && d.remainingPrincipal > 100);
    const totalDebt = activeDebts.reduce((a, b) => a + b.remainingPrincipal, 0);
    const monthlyDebtObligation = activeDebts.reduce((a, b) => a + b.monthlyPayment, 0);
    
    // Living Cost = Allocations that are NOT debt
    const livingCost = allocations.filter(a => a.category !== 'debt').reduce((a, b) => a + b.amount, 0);
    const totalLivingCost = livingCost > 0 ? livingCost : (income * 0.5); 

    const totalExpense = monthlyDebtObligation + totalLivingCost;
    const netCashflow = income - totalExpense;
    const dsr = income > 0 ? (monthlyDebtObligation / income) * 100 : 0;
    
    // Runway
    const totalLiquid = sinkingFunds.reduce((a, b) => a + b.currentAmount, 0);
    const runway = totalExpense > 0 ? totalLiquid / totalExpense : 0;

    return { totalDebt, monthlyDebtObligation, livingCost, netCashflow, dsr, runway, activeDebts, totalExpense };
  }, [debts, allocations, income, sinkingFunds]);

  // --- 2. GENERATE CHARTS ON CHANGE ---
  useEffect(() => {
      const projection = generateGlobalProjection(debts, extraPayment, 'snowball', freedomMode);
      setFreedomMatrix(projection);

      const crossing = generateCrossingAnalysis(income, debts, allocations);
      setCrossingData(crossing);
  }, [debts, income, allocations, extraPayment, freedomMode]);

  // --- 3. GENERATE AI SUMMARY ---
  useEffect(() => {
      const getSummary = async () => {
          if (income <= 0 && debts.length === 0) return;
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
              setAiFeedback({ type: 'success', msg: `Berhasil: ${result.intent.replace('ADD_', 'Catat ')}` });
              setCommandInput('');
          } else {
              setAiFeedback({ type: 'error', msg: "Maaf, saya kurang paham. Coba 'Catat makan 20rb'." });
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
      { name: 'Needs (50%)', value: metrics.livingCost * 0.7, color: COLORS.needs }, 
      { name: 'Wants (30%)', value: metrics.livingCost * 0.3, color: COLORS.wants },
      { name: 'Debt (Max 30%)', value: metrics.monthlyDebtObligation, color: COLORS.debt },
  ];
  const totalStructure = structureData.reduce((a,b)=>a+b.value,0);

  // DECISION LOGIC
  const decisionGap = Math.max(0, (metrics.monthlyDebtObligation / 0.3) - income);
  const highestDebt = metrics.activeDebts.sort((a,b) => b.monthlyPayment - a.monthlyPayment)[0];

  return (
    <div className="space-y-8 pb-20 animate-fade-in font-sans">
      
      {/* SECTION 1: AI COMMAND CENTER (THE BRAIN) */}
      <div className="relative bg-slate-900 rounded-[2.5rem] p-8 overflow-hidden shadow-2xl">
          {/* Decorative Background */}
          <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none"><BrainCircuit size={200} className="text-white"/></div>
          <div className="absolute -left-10 -bottom-10 w-64 h-64 bg-brand-600 rounded-full blur-[100px] opacity-20 pointer-events-none"></div>

          <div className="relative z-10 max-w-3xl mx-auto text-center space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-brand-300 text-[10px] font-black uppercase tracking-widest backdrop-blur-md">
                  <Sparkles size={12}/> Paydone AI Assistant V2
              </div>
              
              <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">
                  Apa yang ingin kamu <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-indigo-400">selesaikan hari ini?</span>
              </h2>

              <form onSubmit={handleAICommand} className="relative w-full max-w-xl mx-auto group">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-brand-400 transition-colors">
                      <Command size={20} />
                  </div>
                  <input 
                      type="text" 
                      value={commandInput}
                      onChange={(e) => setCommandInput(e.target.value)}
                      placeholder="Contoh: 'Catat pengeluaran kopi 25rb' atau 'Analisa hutang saya'..." 
                      className="w-full pl-12 pr-14 py-4 rounded-2xl bg-white/10 border border-white/10 text-white placeholder-slate-400 focus:bg-white/20 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-500/20 transition-all shadow-xl backdrop-blur-md font-medium"
                      disabled={isAiProcessing}
                  />
                  <button 
                      type="submit"
                      disabled={!commandInput.trim() || isAiProcessing}
                      className="absolute right-2 top-2 p-2 bg-brand-600 text-white rounded-xl hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg active:scale-95"
                  >
                      {isAiProcessing ? <Sparkles size={20} className="animate-spin"/> : <Send size={20}/>}
                  </button>
              </form>

              {aiFeedback && (
                  <div className={`text-sm font-bold animate-fade-in-up ${aiFeedback.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
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
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-xs font-bold hover:bg-white/10 hover:text-white hover:border-brand-400/50 transition-all"
                      >
                          {chip.icon} {chip.label}
                      </button>
                  ))}
              </div>
          </div>
      </div>

      {/* SECTION 2: HEALTH SCORE & KEY METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Metric 1: DSR */}
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-lg transition-all group">
              <div className="flex justify-between items-start">
                  <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Debt Service Ratio</p>
                      <h3 className={`text-4xl font-black ${metrics.dsr > 40 ? 'text-red-500' : 'text-slate-900'}`}>
                          {metrics.dsr.toFixed(1)}<span className="text-lg">%</span>
                      </h3>
                  </div>
                  <div className={`p-3 rounded-2xl ${metrics.dsr > 40 ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}>
                      <Activity size={24}/>
                  </div>
              </div>
              <div className="mt-4">
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-1000 ${metrics.dsr > 40 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, metrics.dsr)}%` }}></div>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2 font-medium">
                      {metrics.dsr > 40 ? '⚠️ Bahaya! Kurangi hutang.' : '✅ Cashflow sehat.'}
                  </p>
              </div>
          </div>

          {/* Metric 2: Runway */}
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-lg transition-all group">
              <div className="flex justify-between items-start">
                  <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Financial Runway</p>
                      <h3 className="text-4xl font-black text-slate-900">
                          {metrics.runway.toFixed(1)}<span className="text-lg text-slate-400"> Bln</span>
                      </h3>
                  </div>
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                      <ShieldCheck size={24}/>
                  </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                  <div className="flex -space-x-2">
                      {sinkingFunds.slice(0,3).map(sf => (
                          <div key={sf.id} className={`w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[8px] text-white ${sf.color}`}>
                              <Target size={10}/>
                          </div>
                      ))}
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium">
                      Total Liquid: {formatCurrency(sinkingFunds.reduce((a,b)=>a+b.currentAmount,0))}
                  </p>
              </div>
          </div>

          {/* Metric 3: Net Cashflow */}
          <div className="bg-slate-900 p-6 rounded-[2.5rem] shadow-xl flex flex-col justify-between relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform"><Wallet size={100} className="text-white"/></div>
              <div className="relative z-10">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Net Cashflow / Bulan</p>
                  <h3 className={`text-3xl font-black ${metrics.netCashflow < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {formatCurrency(metrics.netCashflow)}
                  </h3>
              </div>
              <div className="relative z-10 mt-4 pt-4 border-t border-white/10">
                  <p className="text-xs text-slate-300 italic flex items-start gap-2">
                      <Sparkles size={14} className="text-yellow-400 shrink-0 mt-0.5"/>
                      "{aiSummary.split('.')[0]}."
                  </p>
              </div>
          </div>
      </div>

      {/* SECTION 3: FREEDOM MATRIX */}
      <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-lg relative overflow-hidden">
          <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-6 relative z-10">
              <div>
                  <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                      <Calculator className="text-brand-600" /> Freedom Matrix
                  </h2>
                  <p className="text-slate-500 text-sm mt-1">Simulator pelunasan hutang dengan strategi Snowball vs Avalanche.</p>
              </div>
              <div className="flex p-1 bg-slate-100 rounded-xl">
                  <button 
                    onClick={() => setFreedomMode('lump_sum')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${freedomMode === 'lump_sum' ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                      <Zap size={14}/> Percepat Cicil
                  </button>
                  <button 
                    onClick={() => setFreedomMode('cutoff')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${freedomMode === 'cutoff' ? 'bg-white text-purple-700 shadow' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                      <Target size={14}/> Strategi Cutoff
                  </button>
              </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 relative z-10">
              {/* CONTROLS */}
              <div className="lg:col-span-1 space-y-6">
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                      <label className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-widest mb-4">
                          <Zap size={14} className="text-yellow-500"/> Extra Payment / Bln
                      </label>
                      <input 
                        type="range" 
                        min="0" max={income * 0.5} step="100000"
                        value={extraPayment}
                        onChange={(e) => setExtraPayment(Number(e.target.value))}
                        className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-600 mb-4"
                      />
                      <div className="text-3xl font-black text-slate-900 text-right">
                          {formatCurrency(extraPayment)}
                      </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                      <div className="p-5 bg-green-50 rounded-3xl border border-green-100 text-center">
                          <p className="text-[10px] font-black uppercase text-green-600 mb-1">Hemat Waktu</p>
                          <div className="text-3xl font-black text-green-700">{freedomMatrix?.monthsSaved || 0} <span className="text-sm">Bln</span></div>
                      </div>
                      <div className="p-5 bg-blue-50 rounded-3xl border border-blue-100 text-center">
                          <p className="text-[10px] font-black uppercase text-blue-600 mb-1">Potensi Hemat</p>
                          <div className="text-lg font-black text-blue-700 truncate" title={formatCurrency(freedomMatrix?.moneySaved || 0)}>{formatCurrency(freedomMatrix?.moneySaved || 0)}</div>
                      </div>
                  </div>
              </div>

              {/* CHART AREA */}
              <div className="lg:col-span-2 h-[350px] w-full bg-slate-50/50 rounded-3xl border border-slate-100 p-4">
                  {freedomMatrix && (
                      <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={freedomMatrix.data} margin={{ top: 20, right: 30, left: 20, bottom: 10 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                              <XAxis dataKey="month" tick={{fontSize: 10, fill: '#94a3b8'}} tickLine={false} axisLine={false} minTickGap={30} />
                              <YAxis tickFormatter={(val) => `${val/1000000}jt`} tick={{fontSize: 10, fill: '#94a3b8'}} tickLine={false} axisLine={false} />
                              <Tooltip 
                                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '12px'}} 
                                  formatter={(val:number) => formatCurrency(val)}
                              />
                              <Legend verticalAlign="top" height={36} iconType="circle" />
                              <Line type="monotone" dataKey="Biasa" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={false} name="Jalur Biasa" />
                              <Line type="monotone" dataKey="Paydone" stroke="#2563eb" strokeWidth={3} dot={false} name="Jalur Cepat" />
                              
                              {freedomMode === 'cutoff' && (
                                  <Line type="monotone" dataKey="Tabungan" stroke="#a855f7" strokeWidth={2} dot={false} name="Tabungan Cutoff" />
                              )}
                              
                              {freedomMatrix.finishDateAcc && (
                                  <ReferenceLine x={freedomMatrix.data.find((d:any) => d.Paydone <= 0)?.month} stroke="#10b981" strokeDasharray="3 3" label={{ position: 'top', value: 'BEBAS! 🎉', fill: '#10b981', fontSize: 10, fontWeight: 'bold' }} />
                              )}
                          </LineChart>
                      </ResponsiveContainer>
                  )}
              </div>
          </div>
      </div>

      {/* SECTION 4: ANALYSIS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* CROSSING ANALYSIS */}
          <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-lg flex flex-col">
              <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
                      <Target className="text-blue-600"/> Crossing Analysis
                  </h2>
                  {crossingData?.dangerMonth && (
                      <span className="px-3 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-bold flex items-center gap-1 animate-pulse border border-red-100">
                          <AlertTriangle size={12}/> BAHAYA @ {crossingData.dangerMonth.name}
                      </span>
                  )}
              </div>

              <div className="flex-1 min-h-[300px]">
                  {crossingData && (
                      <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={crossingData.data}>
                              <defs>
                                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                                  </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                              <XAxis dataKey="name" tick={{fontSize: 10, fill: '#94a3b8'}} tickLine={false} axisLine={false} />
                              <YAxis tickFormatter={(val) => `${val/1000000}jt`} tick={{fontSize: 10, fill: '#94a3b8'}} tickLine={false} axisLine={false} />
                              <Tooltip contentStyle={{borderRadius: '12px', fontSize: '12px'}} formatter={(val:number) => formatCurrency(val)} />
                              <Legend verticalAlign="top" iconType="circle" height={36}/>
                              
                              <Area type="step" dataKey="TotalExpense" stroke="#ef4444" fill="url(#colorExpense)" name="Total Pengeluaran" strokeWidth={2}/>
                              <Line type="step" dataKey="Debt" stroke="#3b82f6" strokeWidth={2} name="Porsi Hutang" dot={false}/>
                              <Line type="step" dataKey="Income" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" name="Pemasukan" dot={false}/>
                          </AreaChart>
                      </ResponsiveContainer>
                  )}
              </div>
          </div>

          {/* STRUCTURE & DECISION */}
          <div className="space-y-8">
              
              {/* "WHICH PAIN" DECISION */}
              <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-5"><Scissors size={150}/></div>
                  
                  <div className="relative z-10">
                      <h3 className="text-lg font-bold text-yellow-400 mb-2 flex items-center gap-2">
                          <Target size={18}/> The "Which Pain" Decision
                      </h3>
                      <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                          Saran sistem berdasarkan DSR {metrics.dsr.toFixed(1)}%:
                      </p>

                      <div className="grid grid-cols-2 gap-4">
                          {/* OPTION A */}
                          <div className={`p-4 rounded-2xl border transition cursor-pointer ${metrics.dsr < 40 ? 'bg-blue-600 border-blue-500 shadow-lg scale-105' : 'bg-slate-800 border-slate-700 opacity-60'}`}>
                              <div className="flex items-center gap-2 mb-2 font-bold text-sm">
                                  <Wallet size={16}/> Opsi A: Cari Tambahan
                              </div>
                              <p className="text-[10px] text-blue-100 mb-2">Target Income Tambahan:</p>
                              <div className="text-xl font-black">{formatCurrency(metrics.monthlyDebtObligation / 0.3 - income > 0 ? metrics.monthlyDebtObligation / 0.3 - income : 0)}</div>
                          </div>

                          {/* OPTION B */}
                          <div className={`p-4 rounded-2xl border transition cursor-pointer ${metrics.dsr >= 40 ? 'bg-red-600 border-red-500 shadow-lg scale-105' : 'bg-slate-800 border-slate-700 opacity-60'}`}>
                              <div className="flex items-center gap-2 mb-2 font-bold text-sm">
                                  <Scissors size={16}/> Opsi B: Jual Aset
                              </div>
                              <p className="text-[10px] text-red-100 mb-2">Potensi Hemat Cicilan:</p>
                              <div className="text-xl font-black truncate">{formatCurrency(highestDebt?.monthlyPayment || 0)}</div>
                          </div>
                      </div>
                  </div>
              </div>

              {/* STRUKTUR PENGELUARAN */}
              <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm flex items-center justify-between">
                  <div>
                      <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 uppercase tracking-widest mb-4">
                          <PieIcon size={16} className="text-slate-400"/> Struktur Cashflow
                      </h3>
                      <div className="space-y-2">
                          {structureData.map((item, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-xs font-medium text-slate-600">
                                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: item.color}}></div>
                                  {item.name}: <span className="font-bold text-slate-900">{formatCurrency(item.value)}</span>
                              </div>
                          ))}
                      </div>
                  </div>
                  <div className="w-32 h-32 relative">
                      <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                              <Pie data={structureData} innerRadius={35} outerRadius={50} paddingAngle={5} dataKey="value">
                                  {structureData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                  ))}
                              </Pie>
                          </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className="text-xs font-black text-slate-400">OUT</span>
                      </div>
                  </div>
              </div>

          </div>
      </div>

      {/* SECTION 5: KAPASITAS BAYAR (VISUAL BAR) */}
      <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <TrendingDown className="text-blue-600"/> Kapasitas Bayar
              </h3>
              <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold uppercase">Income - Needs vs Cicilan</span>
          </div>
          
          <div className="space-y-6">
              <div>
                  <div className="flex justify-between text-xs font-bold mb-2 text-slate-600">
                      <span>Kapasitas (Uang Nganggur)</span>
                  </div>
                  <div className="h-10 bg-green-500 rounded-r-2xl w-[80%] relative flex items-center px-4 text-white font-black shadow-lg shadow-green-200 text-sm">
                      {formatCurrency(metrics.netCashflow + metrics.monthlyDebtObligation)}
                  </div>
              </div>
              <div>
                  <div className="flex justify-between text-xs font-bold mb-2 text-slate-600">
                      <span>Kewajiban Hutang</span>
                  </div>
                  <div className="h-10 bg-red-500 rounded-r-2xl relative flex items-center px-4 text-white font-black shadow-lg shadow-red-200 text-sm" style={{ width: `${Math.min(100, (metrics.monthlyDebtObligation / (metrics.netCashflow + metrics.monthlyDebtObligation)) * 80)}%` }}>
                      {formatCurrency(metrics.monthlyDebtObligation)}
                  </div>
              </div>
          </div>
      </div>

    </div>
  );
}
