
import React, { useState } from 'react';
import { DebtItem, Opportunity, TaskItem } from '../types';
import { findFinancialOpportunities, getOpportunityDetails } from '../services/geminiService';
import { formatCurrency } from '../services/financeUtils';
import { TrendingUp, Globe, Rocket, ShieldCheck, AlertTriangle, ArrowRight, Loader2, PlusCircle, CheckCircle, Sparkles, Database, Search, Calculator, Filter, MapPin, X, ExternalLink, ListChecks, GripVertical, Settings2, Lock, Zap, Crown } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from '../services/translationService';
import { useFreemium } from '../services/freemiumStore';

interface FinancialFreedomProps {
  debts: DebtItem[];
  onAddTasks: (tasks: TaskItem[]) => void;
}

export default function FinancialFreedom({ debts, onAddTasks }: FinancialFreedomProps) {
  const navigate = useNavigate();
  const { language } = useTranslation();
  const { isFeatureAvailable, subscriptionStatus } = useFreemium();
  const hasAccess = isFeatureAvailable('financial_freedom');
  const [income, setIncome] = useState<number>(15000000); 
  const [isLoading, setIsLoading] = useState(false);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [searchStatus, setSearchStatus] = useState('');
  
  // Drag & Drop Lists
  const [selectedPlan, setSelectedPlan] = useState<Opportunity[]>([]);
  const [draggedItem, setDraggedItem] = useState<{item: Opportunity, source: 'market' | 'plan'} | null>(null);

  // Detail Modal State
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [oppDetails, setOppDetails] = useState<{explanation: string, checklist: string[], sources: string[]} | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [selectedSteps, setSelectedSteps] = useState<string[]>([]); 

  // Interactive Sliders
  const [investMonthly, setInvestMonthly] = useState(1000000);
  const [investReturn, setInvestReturn] = useState(10); 
  const [investYears, setInvestYears] = useState(10);
  const [selectedCountry, setSelectedCountry] = useState('Indonesia');
  
  // Execute Loader
  const [isExecuting, setIsExecuting] = useState(false);

  // Calculation
  const calculatePotential = () => {
      const r = investReturn / 100 / 12;
      const n = investYears * 12;
      const fvMonthly = investMonthly * ((Math.pow(1 + r, n) - 1) / r);
      // Mock added potential from selected opportunities
      const activeIncomeBoost = selectedPlan.length * 500000; // Assume each opp adds 500k monthly
      const totalFuture = fvMonthly + (activeIncomeBoost * 12 * investYears);
      return totalFuture;
  };
  const futureWealth = calculatePotential();

  const handleSearchOpportunities = async () => {
    setIsLoading(true);
    setOpportunities([]);
    const stages = [`Scanning Market Data in ${selectedCountry}...`, "Menganalisa Emerging Trends...", "Kalkulasi Risiko..."];
    for (const stage of stages) { setSearchStatus(stage); await new Promise(r => setTimeout(r, 800)); }
    
    const results = await findFinancialOpportunities(debts, income, selectedCountry, language);
    setOpportunities(results);
    setIsLoading(false);
  };

  const handleViewDetails = async (opp: Opportunity) => {
      setSelectedOpp(opp);
      setOppDetails(null);
      setIsLoadingDetails(true);
      const details = await getOpportunityDetails(opp, language);
      setOppDetails(details);
      setSelectedSteps(details.checklist || []); 
      setIsLoadingDetails(false);
  };

  const handleDragStart = (e: React.DragEvent, item: Opportunity, source: 'market' | 'plan') => {
      setDraggedItem({ item, source });
      e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (e: React.DragEvent, target: 'market' | 'plan') => {
      e.preventDefault();
      if (!draggedItem) return;
      if (draggedItem.source === target) return;

      if (target === 'plan') {
          setOpportunities(prev => prev.filter(o => o.id !== draggedItem.item.id));
          setSelectedPlan(prev => [...prev, draggedItem.item]);
      } else {
          setSelectedPlan(prev => prev.filter(o => o.id !== draggedItem.item.id));
          setOpportunities(prev => [...prev, draggedItem.item]);
      }
      setDraggedItem(null);
  };

  const handleAddToPlanTasks = async () => {
    if (selectedPlan.length === 0) return;
    setIsExecuting(true);
    
    try {
        let allNewTasks: TaskItem[] = [];

        // For each selected plan, we need to fetch detailed checklist if not already present
        // In a real app, we might cache this. Here we fetch on demand.
        for (const opp of selectedPlan) {
            // Check if we already have fetched details in local state (complex with current structure, so just re-fetch for safety/simplicity)
            // or pass detailed object if we stored it. 
            // Better UX: Show "Compiling Strategy for [Title]..."
            
            const details = await getOpportunityDetails(opp, language);
            const steps = details.checklist || [`Riset awal tentang ${opp.title}`];
            
            const tasksForOpp = steps.map((step, idx) => ({
                id: `ff-exec-${opp.id}-${idx}-${Date.now()}`,
                title: `${opp.title}: ${step}`,
                status: 'pending' as const,
                category: 'Business' as const,
                userId: 'current',
                dueDate: new Date(new Date().setDate(new Date().getDate() + (idx + 1) * 3)).toISOString().split('T')[0], // Staggered every 3 days
                context: 'Financial Freedom' as const
            }));
            
            allNewTasks = [...allNewTasks, ...tasksForOpp];
        }

        onAddTasks(allNewTasks);
        navigate('/app/planning');
    } catch (e) {
        alert("Gagal menyusun rencana. Coba lagi.");
    } finally {
        setIsExecuting(false);
    }
  };

  // Feature gate: popup modal handled below in JSX


  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20 h-screen flex flex-col">
      
      {/* 1. Interactive Simulator Header */}
      <div className="bg-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-2xl flex-shrink-0 grid md:grid-cols-3 gap-8">
          <div className="col-span-2">
              <h1 className="text-2xl font-bold mb-4 flex items-center gap-2"><Rocket className="text-brand-400"/> Financial Freedom Simulator</h1>
              <p className="text-slate-400 text-sm mb-6">Atur parameter investasi dan pilih peluang bisnis untuk melihat proyeksi kekayaan masa depan.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                  <div>
                      <div className="flex justify-between text-xs mb-2"><span>Investasi Bulanan</span><span className="font-bold text-brand-300">{formatCurrency(investMonthly)}</span></div>
                      <input type="range" min="100000" max="20000000" step="100000" className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer" value={investMonthly} onChange={e => setInvestMonthly(Number(e.target.value))} />
                  </div>
                  <div>
                      <div className="flex justify-between text-xs mb-2"><span>Ekspektasi Return (p.a)</span><span className="font-bold text-brand-300">{investReturn}%</span></div>
                      <input type="range" min="2" max="30" className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer" value={investReturn} onChange={e => setInvestReturn(Number(e.target.value))} />
                  </div>
                  <div>
                      <div className="flex justify-between text-xs mb-2"><span>Durasi (Tahun)</span><span className="font-bold text-brand-300">{investYears} Thn</span></div>
                      <input type="range" min="1" max="40" className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer" value={investYears} onChange={e => setInvestYears(Number(e.target.value))} />
                  </div>
              </div>
          </div>
          
          <div className="bg-gradient-to-br from-brand-600 to-indigo-700 rounded-2xl p-6 flex flex-col justify-center items-center text-center shadow-lg relative overflow-hidden">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
              <p className="text-xs font-bold uppercase tracking-widest text-brand-100 mb-2">Proyeksi Kekayaan</p>
              <h2 className="text-4xl font-black mb-1">{formatCurrency(futureWealth)}</h2>
              <p className="text-xs text-brand-200">+ Potensi bisnis dari Plan</p>
          </div>
      </div>

      {/* 2. Drag & Drop Playground */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0">
          
          {/* LEFT: Marketplace */}
          <div 
            className="flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, 'market')}
          >
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                      <Search size={18} className="text-slate-400"/>
                      <h3 className="font-bold text-slate-700">Opportunity Marketplace</h3>
                  </div>
                  <div className="flex gap-2">
                      <select className="text-xs border rounded p-1" value={selectedCountry} onChange={e => setSelectedCountry(e.target.value)}>
                          <option value="Indonesia">Indonesia</option>
                          <option value="Global">Global</option>
                      </select>
                      <button onClick={handleSearchOpportunities} disabled={isLoading} className="text-xs bg-slate-900 text-white px-3 py-1 rounded hover:bg-slate-700">
                          {isLoading ? 'Scanning...' : 'Scan'}
                      </button>
                  </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
                  {opportunities.length === 0 && !isLoading && (
                      <div className="text-center py-10 text-slate-400 text-sm">Belum ada peluang. Klik Scan untuk mencari.</div>
                  )}
                  {opportunities.map(opp => (
                      <div 
                        key={opp.id} 
                        draggable 
                        onDragStart={(e) => handleDragStart(e, opp, 'market')}
                        className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition group"
                      >
                          <div className="flex justify-between items-start mb-2">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${opp.type === 'Passive Income' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{opp.type}</span>
                              <GripVertical size={16} className="text-slate-300"/>
                          </div>
                          <h4 className="font-bold text-slate-900 mb-1">{opp.title}</h4>
                          <p className="text-xs text-slate-500 line-clamp-2">{opp.description}</p>
                          <div className="mt-3 flex justify-between items-center border-t border-slate-50 pt-2">
                              <span className="text-xs font-bold text-brand-600">{opp.potentialIncome}</span>
                              <button onClick={() => handleViewDetails(opp)} className="text-xs text-slate-400 hover:text-slate-900 font-bold">Detail</button>
                          </div>
                      </div>
                  ))}
              </div>
          </div>

          {/* RIGHT: My Master Plan */}
          <div 
            className="flex flex-col bg-slate-900 rounded-2xl border border-slate-800 shadow-lg overflow-hidden relative"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, 'plan')}
          >
              <div className="p-4 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
                  <h3 className="font-bold text-white flex items-center gap-2"><Sparkles size={18} className="text-yellow-400"/> My Master Plan</h3>
                  <span className="text-xs text-slate-400">{selectedPlan.length} Item Selected</span>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-3 relative">
                  {selectedPlan.length === 0 && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-slate-800 m-4 rounded-xl">
                          <p className="text-sm">Drag peluang bisnis ke sini</p>
                      </div>
                  )}
                  {selectedPlan.map(opp => (
                      <div 
                        key={opp.id} 
                        draggable 
                        onDragStart={(e) => handleDragStart(e, opp, 'plan')}
                        className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm cursor-grab active:cursor-grabbing hover:border-brand-500 transition group"
                      >
                          <div className="flex justify-between items-start mb-2">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-slate-700 text-slate-300">{opp.type}</span>
                              <button onClick={() => handleViewDetails(opp)} className="text-xs text-brand-400 font-bold">Action Plan</button>
                          </div>
                          <h4 className="font-bold text-white mb-1">{opp.title}</h4>
                          <p className="text-xs text-slate-400">{opp.potentialIncome}</p>
                      </div>
                  ))}
              </div>

              <div className="p-4 bg-slate-950 border-t border-slate-800">
                  <button 
                    onClick={handleAddToPlanTasks} 
                    disabled={selectedPlan.length===0 || isExecuting} 
                    className="w-full py-3 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700 disabled:opacity-50 transition flex justify-center gap-2 items-center"
                  >
                      {isExecuting ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18}/>}
                      {isExecuting ? 'Menyusun Task...' : 'Eksekusi Rencana Ini'}
                  </button>
              </div>
          </div>

      </div>

      {/* DETAIL MODAL (Kept same logic, just rendering) */}
      {selectedOpp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white rounded-2xl w-full max-w-2xl p-0 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50">
                      <div><h3 className="text-xl font-bold text-slate-900">{selectedOpp.title}</h3></div>
                      <button onClick={() => setSelectedOpp(null)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
                  </div>
                  <div className="p-6 overflow-y-auto flex-1">
                      {isLoadingDetails ? (
                          <div className="py-12 text-center"><Loader2 size={32} className="mx-auto text-brand-600 animate-spin mb-4" /><p className="text-slate-500">AI sedang menyusun strategi...</p></div>
                      ) : oppDetails ? (
                          <div className="space-y-6">
                              <div className="prose prose-sm text-slate-600"><p>{oppDetails.explanation}</p></div>
                              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                                  <h4 className="font-bold text-slate-900 mb-3">Langkah Eksekusi</h4>
                                  <div className="space-y-2">{oppDetails.checklist.map((step, idx) => (<div key={idx} className="flex gap-3 text-sm text-slate-700"><CheckCircle size={16} className="text-green-500 shrink-0 mt-0.5"/>{step}</div>))}</div>
                              </div>
                          </div>
                      ) : <p className="text-red-500">Gagal memuat detail.</p>}
                  </div>
              </div>
          </div>
      )}

      {/* ═══ FEATURE GATE MODAL ═══ */}
      {!hasAccess && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-100">
            {/* Header */}
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-8 py-6 text-white text-center">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Crown size={28} className="text-amber-300" />
              </div>
              <h3 className="text-xl font-black">Fitur Premium</h3>
              <p className="text-sm text-white/80 mt-1">Jalan Ninja Financial Freedom</p>
            </div>

            {/* Body */}
            <div className="px-8 py-6 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
                <p className="text-sm font-bold text-amber-800">
                  Mohon maaf, paket kamu saat ini (<span className="font-black">{subscriptionStatus.currentPackage || 'Free Plan'}</span>) tidak menyertakan fitur ini.
                </p>
                <p className="text-xs text-amber-600 mt-1">Silahkan upgrade terlebih dahulu untuk mengakses halaman ini.</p>
              </div>

              <div className="space-y-2">
                {[
                  'Financial Freedom Simulator & proyeksi kekayaan',
                  'Opportunity Marketplace — scan peluang bisnis AI',
                  'My Master Plan — drag & drop rencana aksi',
                  'Eksekusi rencana ke Task Manager otomatis',
                ].map((f, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="w-4 h-4 bg-violet-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Zap size={9} className="text-violet-600" />
                    </div>
                    <span className="text-xs text-slate-600">{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="px-8 pb-8 space-y-3">
              <Link
                to="/app/upgrade"
                className="flex items-center justify-center gap-2 w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-black text-sm rounded-2xl shadow-lg shadow-violet-500/25 transition-all hover:scale-[1.01] active:scale-[0.99]"
              >
                <Crown size={16} />
                Upgrade Sekarang
                <ArrowRight size={15} />
              </Link>
              <button
                onClick={() => navigate(-1)}
                className="w-full py-3 text-sm text-slate-400 hover:text-slate-600 font-medium transition"
              >
                ← Kembali
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
