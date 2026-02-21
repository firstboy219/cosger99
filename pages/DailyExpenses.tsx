
import React, { useState, useMemo, useEffect } from 'react';
import { DailyExpense, ExpenseItem, DebtInstallment, SinkingFund } from '../types';
import { formatCurrency, safeDateISO, toLocalISOString } from '../services/financeUtils';
import { parseTransactionAI } from '../services/geminiService';
import { saveItemToCloud, deleteFromCloud } from '../services/cloudSync';
import { getConfig } from '../services/mockDb';
import { Plus, Tag, Trash2, Edit2, X, Sparkles, Send, Loader2, ChevronLeft, ChevronRight, Receipt, Wallet, AlertCircle, CreditCard, ShoppingBag, Coffee, Bus, Zap, TrendingUp, Calendar, ArrowRight, Activity, Filter, Target, GripVertical, CheckCircle2 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip, Legend } from 'recharts';
import ConfirmDialog from '../components/ui/ConfirmDialog';

interface DailyExpensesProps {
  expenses: DailyExpense[];
  setExpenses: React.Dispatch<React.SetStateAction<DailyExpense[]>>;
  allocations: ExpenseItem[]; 
  userId: string;
  debtInstallments: DebtInstallment[];
  setDebtInstallments: React.Dispatch<React.SetStateAction<DebtInstallment[]>>;
  sinkingFunds?: SinkingFund[]; 
  setSinkingFunds?: React.Dispatch<React.SetStateAction<SinkingFund[]>>;
}

const CATEGORY_COLORS: Record<string, string> = {
    Food: '#f59e0b',       // Amber
    Transport: '#3b82f6',  // Blue
    Shopping: '#ec4899',   // Pink
    Utilities: '#eab308',  // Yellow
    Entertainment: '#8b5cf6', // Purple
    Others: '#94a3b8'      // Slate
};

export default function DailyExpenses({ expenses = [], setExpenses, allocations = [], userId, debtInstallments = [], setDebtInstallments, sinkingFunds = [], setSinkingFunds }: DailyExpensesProps) {
  const [filterDate, setFilterDate] = useState(toLocalISOString(new Date()));
  const [startDate, setStartDate] = useState(new Date());
  const [quickText, setQuickText] = useState('');
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ 
      title: '', 
      amount: 0, 
      category: 'Food' as any, 
      date: filterDate, 
      notes: '',
      allocationId: '', // New: Pocket ID
      sinkingFundId: '', // New: Pocket ID
      pocketType: '' as 'allocation' | 'sf' | '' // New: Helper for UI
  });
  const [isSaving, setIsSaving] = useState(false);

  // DnD State
  const [draggedExpense, setDraggedExpense] = useState<DailyExpense | null>(null);

  // Confirmation Modal State
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  // --- DATA PROCESSING ---
  const groupedExpenses = useMemo(() => {
      return expenses.filter(e => !e._deleted).reduce((acc, exp) => {
          const d = safeDateISO(exp.date);
          if (!acc[d]) acc[d] = [];
          acc[d].push(exp);
          return acc;
      }, {} as Record<string, DailyExpense[]>);
  }, [expenses]);

  const todaysExpenses = groupedExpenses[filterDate] || [];
  const totalToday = todaysExpenses.reduce((a, b) => a + Number(b.amount), 0);

  // Filter Active Allocations & SF for Sidebar
  const activeAllocations = useMemo(() => {
      // Show allocs that ARE transferred/paid AND have positive balance (hide minus/empty)
      return allocations.filter(a => a.isTransferred && !a._deleted && a.amount > 0);
  }, [allocations]);

  const activeSinkingFunds = useMemo(() => {
      // Hide full sinking funds
      return sinkingFunds.filter(s => s.currentAmount < s.targetAmount);
  }, [sinkingFunds]);

  // Prepare Chart Data
  const chartData = useMemo(() => {
      const catMap: Record<string, number> = {};
      todaysExpenses.forEach(e => {
          catMap[e.category] = (catMap[e.category] || 0) + Number(e.amount);
      });
      return Object.keys(catMap).map(key => ({
          name: key,
          value: catMap[key],
          color: CATEGORY_COLORS[key] || '#cbd5e1'
      })).sort((a,b) => b.value - a.value);
  }, [todaysExpenses]);

  const highestCategory = chartData.length > 0 ? chartData[0] : null;

  // --- ICONS MAP ---
  const getCategoryIcon = (cat: string) => {
      switch(cat) {
          case 'Food': return <Coffee size={18}/>;
          case 'Transport': return <Bus size={18}/>;
          case 'Shopping': return <ShoppingBag size={18}/>;
          case 'Utilities': return <Zap size={18}/>;
          case 'Entertainment': return <Activity size={18}/>;
          default: return <Tag size={18}/>;
      }
  };

  // --- ACTIONS ---
  const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.title || formData.amount <= 0) return;
      
      setIsSaving(true);
      const strategy = getConfig().advancedConfig?.syncStrategy || 'background';
      const now = new Date().toISOString();
      const tempId = `temp-exp-${Date.now()}`;

      // Exclude pocketType from payload
      const { pocketType, ...cleanFormData } = formData;

      // FIX DATE: Use formData.date directly (YYYY-MM-DD)
      const newItem: DailyExpense = { 
          id: editingId || tempId, 
          userId, 
          ...cleanFormData,
          date: formData.date, 
          amount: Number(formData.amount), 
          updatedAt: now, 
          _deleted: false,
          // Explicitly set pocket IDs based on selection
          allocationId: formData.pocketType === 'allocation' ? formData.allocationId : undefined,
          sinkingFundId: formData.pocketType === 'sf' ? formData.sinkingFundId : undefined
      };

      // 1. Optimistic Update List
      if (editingId) setExpenses(prev => prev.map(e => e.id === editingId ? newItem : e));
      else setExpenses(prev => [newItem, ...prev]);

      setIsModalOpen(false); 
      
      // 2. Persist Expense FIRST (to avoid race condition with DB reload)
      try {
          const saveResult = await saveItemToCloud('dailyExpenses', newItem, !editingId);
          // Sync server-returned ID back to local state for correct edit/delete
          if (saveResult.success && saveResult.data) {
              const serverItem = saveResult.data;
              if (!editingId && serverItem.id && serverItem.id !== tempId) {
                  newItem.id = serverItem.id;
                  setExpenses(prev => prev.map(e => e.id === tempId ? { ...e, id: serverItem.id } : e));
              }
          }
      } catch (err) {
          console.error("Failed to save expense", err);
      }

      // 3. Update Pocket Balances (After expense is safe)
      // Helper to update pocket balances
      const updatePocket = async (type: 'allocation' | 'sf', id: string, amount: number, operation: 'add' | 'subtract') => {
          if (type === 'allocation') {
              // Allocation: Subtract when spending, Add when refunding
              const target = allocations.find(a => a.id === id);
              if (target) {
                  const newAmount = operation === 'add' ? target.amount + amount : target.amount - amount;
                  await saveItemToCloud('allocations', { ...target, amount: newAmount, updatedAt: new Date().toISOString() }, false);
              }
          } else {
              // Sinking Fund: Add when saving, Subtract when reverting
              const target = sinkingFunds.find(s => s.id === id);
              if (target && setSinkingFunds) {
                  const newAmount = operation === 'add' ? target.currentAmount + amount : target.currentAmount - amount;
                  const updatedSf = { ...target, currentAmount: newAmount, updatedAt: new Date().toISOString() };
                  setSinkingFunds(prev => prev.map(s => s.id === id ? updatedSf : s));
                  await saveItemToCloud('sinkingFunds', updatedSf, false);
              }
          }
      };

      // Handle Balance Updates (Revert Old -> Apply New)
      if (editingId) {
          const original = expenses.find(e => e.id === editingId);
          if (original) {
              // Revert Old
              if (original.allocationId) await updatePocket('allocation', original.allocationId, original.amount, 'add');
              if (original.sinkingFundId) await updatePocket('sf', original.sinkingFundId, original.amount, 'subtract');
          }
      }

      // Apply New
      if (newItem.allocationId) await updatePocket('allocation', newItem.allocationId, newItem.amount, 'subtract');
      if (newItem.sinkingFundId) await updatePocket('sf', newItem.sinkingFundId, newItem.amount, 'add');

      setIsSaving(false);
  };

  const handleDeleteClick = (id: string) => {
      setConfirmConfig({
          isOpen: true,
          title: "Hapus Catatan?",
          message: "Apakah Anda yakin ingin menghapus catatan pengeluaran ini selamanya?",
          onConfirm: () => {
              executeDelete(id);
              setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          }
      });
  };

  const executeDelete = async (id: string) => {
      setExpenses(prev => prev.filter(e => e.id !== id));
      await deleteFromCloud(userId, 'dailyExpenses', id);
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!quickText.trim()) return;
      setIsProcessingAI(true);
      
      try {
          const result = await parseTransactionAI(quickText, { allocations });
          if (result.intent === 'ADD_DAILY_EXPENSE' || result.intent === 'ADD_EXPENSE') {
              const newItem: DailyExpense = {
                  id: `exp-${Date.now()}`,
                  userId,
                  title: result.data.title || 'Pengeluaran AI',
                  amount: Number(result.data.amount) || 0, 
                  category: (result.data.category as any) || 'Others',
                  date: filterDate, 
                  updatedAt: new Date().toISOString(),
                  _deleted: false
              };
              
              const saveResult = await saveItemToCloud('dailyExpenses', newItem, true);
              if (saveResult.success) {
                  setExpenses(prev => [saveResult.data || newItem, ...prev]);
                  setQuickText('');
              }
          } else {
              alert("AI: Format tidak dikenali. Coba 'Makan 20rb'");
          }
      } catch (e) {
          alert("Gagal memproses via AI.");
      } finally {
          setIsProcessingAI(false);
      }
  };

  const handleEdit = (item: DailyExpense) => {
      setEditingId(item.id);
      setFormData({ 
          title: item.title, 
          amount: item.amount, 
          category: item.category, 
          date: item.date, 
          notes: item.notes || '',
          allocationId: item.allocationId || '',
          sinkingFundId: item.sinkingFundId || '',
          pocketType: item.allocationId ? 'allocation' : item.sinkingFundId ? 'sf' : ''
      });
      setIsModalOpen(true);
  };

  const shiftWeek = (dir: 'prev' | 'next') => { 
      const d = new Date(startDate); 
      d.setDate(startDate.getDate() + (dir === 'next' ? 7 : -7)); 
      setStartDate(d); 
  };

  const renderTooltip = (props: any) => {
      const { active, payload } = props;
      if (active && payload && payload.length) {
          return (
              <div className="bg-slate-900 text-white p-3 rounded-xl text-xs shadow-xl border border-slate-700">
                  <p className="font-bold mb-1">{payload[0].name}</p>
                  <p className="font-mono">{formatCurrency(payload[0].value)}</p>
                  <p className="text-slate-400">{(payload[0].percent * 100).toFixed(0)}%</p>
              </div>
          );
      }
      return null;
  };

  return (
    <div className="space-y-6 pb-24 animate-fade-in font-sans h-[calc(100vh-100px)] flex flex-col">
      
      {/* 1. HEADER & AI COMMAND */}
      <div className="bg-slate-900 p-6 rounded-[2.5rem] shadow-2xl flex flex-col md:flex-row items-center gap-6 border border-slate-800 shrink-0 relative z-20 overflow-hidden">
          <div className="absolute right-0 top-0 p-12 opacity-5 pointer-events-none"><Receipt size={150} className="text-white"/></div>
          
          <div className="bg-white/10 p-3 rounded-2xl shrink-0 backdrop-blur-md border border-white/10">
              <Sparkles className="text-yellow-400 animate-pulse" size={24}/>
          </div>
          
          <div className="flex-1 w-full space-y-1 relative z-10">
              <h2 className="text-white font-black text-xl tracking-tight">Daily Expenses</h2>
              <form onSubmit={handleQuickAdd} className="relative w-full max-w-2xl">
                  <input 
                    type="text" 
                    className="w-full bg-slate-800/50 border border-slate-700 text-white rounded-2xl pl-4 pr-12 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none placeholder-slate-500 font-medium transition-all focus:bg-slate-800 backdrop-blur-sm" 
                    placeholder="Ketik cepat: 'Kopi 25rb', 'Bensin 50rb'..." 
                    value={quickText} 
                    onChange={e => setQuickText(e.target.value)} 
                    disabled={isProcessingAI} 
                  />
                  <button type="submit" className="absolute right-2 top-2 p-1.5 bg-slate-700 hover:bg-brand-600 rounded-xl text-slate-300 hover:text-white transition-colors">
                      {isProcessingAI ? <Loader2 size={16} className="animate-spin"/> : <Send size={16}/>}
                  </button>
              </form>
          </div>

          <button onClick={() => { setEditingId(null); setFormData({ title: '', amount: 0, category: 'Food', date: filterDate, notes: '', allocationId: '', sinkingFundId: '', pocketType: '' }); setIsModalOpen(true); }} className="bg-white text-slate-900 px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-brand-50 transition shadow-xl transform active:scale-95 flex items-center gap-2 whitespace-nowrap shrink-0 relative z-10">
              <Plus size={16}/> New Entry
          </button>
      </div>

      {/* 2. MAIN CONTENT GRID */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
          
          {/* LEFT: CALENDAR & LIST */}
          <div className="lg:col-span-8 flex flex-col gap-6 overflow-hidden">
              
              {/* DATE NAVIGATOR */}
              <div className="bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm shrink-0 flex flex-col gap-2">
                  <div className="flex items-center justify-between px-2">
                      <button onClick={()=>shiftWeek('prev')} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-900 transition"><ChevronLeft size={18}/></button>
                      <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 bg-slate-100 px-3 py-1 rounded-full">{startDate.toLocaleDateString('id-ID', {month:'long', year:'numeric'})}</span>
                      <button onClick={()=>shiftWeek('next')} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-900 transition"><ChevronRight size={18}/></button>
                  </div>
                  
                  <div className="grid grid-cols-7 gap-2">
                    {Array.from({length: 7}).map((_, i) => {
                        const d = new Date(startDate); 
                        d.setDate(startDate.getDate() + i);
                        // Fix for local date logic in loop
                        const ds = toLocalISOString(d); // YYYY-MM-DD local
                        
                        const isSelected = ds === filterDate;
                        const isToday = ds === toLocalISOString(new Date());
                        const dayExpenses = groupedExpenses[ds] || [];
                        const dayTotal = dayExpenses.reduce((a,b)=>a+Number(b.amount),0);
                        
                        return (
                            <button key={ds} onClick={()=>setFilterDate(ds)} className={`relative h-20 rounded-2xl border transition-all flex flex-col items-center justify-center gap-1 group ${isSelected ? 'bg-slate-900 border-slate-900 text-white shadow-lg scale-105 z-10' : 'bg-white border-slate-100 text-slate-400 hover:border-brand-200 hover:bg-slate-50'}`}>
                                <span className={`text-[9px] font-black uppercase ${isSelected ? 'text-slate-400' : 'text-slate-300'}`}>{d.toLocaleDateString('id-ID', {weekday:'short'})}</span>
                                <span className={`text-lg font-black leading-none ${isSelected ? 'text-white' : isToday ? 'text-brand-600' : 'text-slate-700'}`}>{d.getDate()}</span>
                                
                                <div className="flex flex-col items-center mt-1">
                                    {dayTotal > 0 && (
                                        <span className={`text-[10px] font-bold ${isSelected ? 'text-brand-300' : 'text-slate-500'}`}>
                                            {dayTotal >= 1000000 ? `${(dayTotal/1000000).toFixed(1)}jt` : `${(dayTotal/1000).toFixed(0)}k`}
                                        </span>
                                    )}
                                    <div className="flex gap-0.5 mt-0.5 h-1 items-end">
                                        {dayTotal > 0 && <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-brand-400' : 'bg-brand-500'}`}></div>}
                                        {dayExpenses.length > 3 && <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-slate-600' : 'bg-slate-300'}`}></div>}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                  </div>
              </div>

              {/* TRANSACTIONS LIST */}
              <div className="flex-1 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <div>
                          <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                              {new Date(filterDate).toLocaleDateString('id-ID', {weekday: 'long', day:'numeric', month:'long'})}
                          </h3>
                          <p className="text-xs text-slate-500 font-medium mt-1">
                              {todaysExpenses.length} Transaksi Tercatat
                          </p>
                      </div>
                      <div className="text-right">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Hari Ini</p>
                          <p className="text-2xl font-black text-slate-900">{formatCurrency(totalToday)}</p>
                      </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                      {todaysExpenses.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-slate-300 text-center p-10">
                              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4"><Wallet size={32} className="opacity-30"/></div>
                              <p className="text-sm font-bold text-slate-400">Belum ada pengeluaran.</p>
                              <p className="text-xs text-slate-300 mt-1">Hemat pangkal kaya!</p>
                          </div>
                      ) : (
                          todaysExpenses.map(item => (
                              <div 
                                key={item.id} 
                                className={`relative p-4 rounded-3xl border transition-all bg-white group flex items-start gap-4 hover:shadow-lg ${item.allocationId ? 'border-green-200 bg-green-50/20' : item.sinkingFundId ? 'border-blue-200 bg-blue-50/20' : 'border-slate-100 hover:border-brand-200'}`}
                              >
                                  <div className={`p-3.5 rounded-2xl shrink-0 flex items-center justify-center text-white shadow-sm ${item.category === 'Food' ? 'bg-amber-500' : item.category === 'Transport' ? 'bg-blue-500' : item.category === 'Shopping' ? 'bg-pink-500' : 'bg-slate-500'}`}>
                                      {getCategoryIcon(item.category)}
                                  </div>
                                  <div className="flex-1 min-w-0 pt-1">
                                      <div className="flex justify-between items-start">
                                          <h4 className="font-bold text-slate-900 truncate pr-2 text-base">{item.title}</h4>
                                          <span className="font-black text-slate-900 whitespace-nowrap text-lg">{formatCurrency(item.amount)}</span>
                                      </div>
                                      <div className="flex items-center gap-2 mt-1">
                                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider bg-slate-100 px-2 py-0.5 rounded">{item.category}</span>
                                          {item.allocationId && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold flex items-center gap-1 border border-green-200"><CheckCircle2 size={10}/> Paid from Budget</span>}
                                          {item.sinkingFundId && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold flex items-center gap-1 border border-blue-200"><Target size={10}/> Saved to Sinking Fund</span>}
                                          {item.notes && <span className="text-[10px] text-slate-400 truncate max-w-[150px] italic">- {item.notes}</span>}
                                      </div>
                                  </div>
                                  <div className="absolute right-4 bottom-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button onClick={()=>handleEdit(item)} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition"><Edit2 size={14}/></button>
                                      <button onClick={()=>handleDeleteClick(item.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"><Trash2 size={14}/></button>
                                  </div>
                              </div>
                          ))
                      )}
                  </div>
              </div>
          </div>

          {/* RIGHT: ANALYTICS & POCKETS */}
          <div className="lg:col-span-4 flex flex-col gap-6 h-full overflow-y-auto custom-scrollbar">
              
              {/* DROPPABLE POCKETS ZONE */}
              <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-5">
                  <h3 className="font-black text-slate-900 text-sm uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Target size={16} className="text-brand-600"/> Pockets & Goals
                  </h3>
                  <div className="space-y-3 pr-1">
                      {/* Allocations (Pay) - NOW SHOWING PAID/TRANSFERRED */}
                      {activeAllocations.map(alloc => (
                          <div 
                            key={alloc.id}
                            className="p-4 rounded-3xl border border-slate-100 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 transition-all cursor-default group relative overflow-hidden"
                          >
                              <div className="flex justify-between items-start mb-2 relative z-10">
                                  <div>
                                      <span className="text-xs font-black text-slate-700 uppercase tracking-wide block mb-1">{alloc.name}</span>
                                      <span className="text-lg font-black text-slate-900">{formatCurrency(alloc.amount)}</span>
                                  </div>
                                  <div className="p-2 bg-white rounded-xl shadow-sm text-slate-400 group-hover:text-blue-500 transition-colors">
                                      <Wallet size={18}/>
                                  </div>
                              </div>
                              
                              <div className="flex items-center gap-2 mt-2 relative z-10">
                                  <button 
                                    onClick={() => { 
                                        setEditingId(null); 
                                        setFormData({ 
                                            title: '', 
                                            amount: 0, 
                                            category: 'Others', 
                                            date: filterDate, 
                                            notes: '', 
                                            allocationId: alloc.id, 
                                            sinkingFundId: '', 
                                            pocketType: 'allocation' 
                                        }); 
                                        setIsModalOpen(true); 
                                    }}
                                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-blue-500 hover:text-white hover:border-blue-500 transition shadow-sm flex items-center gap-1"
                                  >
                                      <Plus size={10}/> Pakai
                                  </button>
                                  <span className="text-[9px] text-slate-400 italic group-hover:text-blue-400 transition-colors">Drop here to pay</span>
                              </div>
                          </div>
                      ))}

                      {/* Sinking Funds (Save) */}
                      {activeSinkingFunds.map(sf => {
                          const progress = sf.targetAmount > 0 ? Math.min(100, (sf.currentAmount/sf.targetAmount)*100) : 0;
                          return (
                              <div 
                                key={sf.id}
                                className="p-4 rounded-3xl border border-slate-100 bg-green-50 hover:bg-green-100 transition-all cursor-default group relative overflow-hidden"
                              >
                                  <div className="flex justify-between items-start mb-2 relative z-10">
                                      <div>
                                          <span className="text-xs font-black text-green-800 uppercase tracking-wide block mb-1">{sf.name}</span>
                                          <span className="text-lg font-black text-green-900">{formatCurrency(sf.currentAmount)}</span>
                                      </div>
                                      <div className="p-2 bg-white rounded-xl shadow-sm text-green-400 group-hover:text-green-600 transition-colors">
                                          <Target size={18}/>
                                      </div>
                                  </div>

                                  <div className="w-full bg-white/50 h-2 rounded-full overflow-hidden mb-3 relative z-10">
                                      <div className="h-full bg-green-500 transition-all duration-500" style={{width: `${progress}%`}}></div>
                                  </div>
                                  
                                  <div className="flex items-center justify-between relative z-10">
                                      <span className="text-[10px] font-bold text-green-700">{progress.toFixed(0)}% Terkumpul</span>
                                      <button 
                                        onClick={() => { 
                                            setEditingId(null); 
                                            setFormData({ 
                                                title: `Nabung ${sf.name}`, 
                                                amount: 0, 
                                                category: 'Others', 
                                                date: filterDate, 
                                                notes: '', 
                                                allocationId: '', 
                                                sinkingFundId: sf.id, 
                                                pocketType: 'sf' 
                                            }); 
                                            setIsModalOpen(true); 
                                        }}
                                        className="px-3 py-1.5 bg-white border border-green-200 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-green-500 hover:text-white hover:border-green-500 transition shadow-sm flex items-center gap-1"
                                      >
                                          <Plus size={10}/> Isi
                                      </button>
                                  </div>
                              </div>
                          );
                      })}
                      
                      {sinkingFunds.length === 0 && activeAllocations.length === 0 && (
                          <div className="text-center text-xs text-slate-400 py-4 italic border-2 border-dashed border-slate-100 rounded-xl">No active pockets found.</div>
                      )}
                  </div>
              </div>

              {/* SUMMARY CHART */}
              <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-6 flex flex-col items-center justify-center relative overflow-hidden min-h-[300px]">
                  <h3 className="font-black text-slate-900 text-sm uppercase tracking-widest mb-6 w-full flex items-center gap-2">
                      <PieChart size={16} className="text-brand-600"/> Spending Breakdown
                  </h3>
                  
                  {chartData.length > 0 ? (
                      <div className="w-full h-64 relative">
                          <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                  <Pie
                                      data={chartData}
                                      cx="50%"
                                      cy="50%"
                                      innerRadius={60}
                                      outerRadius={80}
                                      paddingAngle={5}
                                      dataKey="value"
                                      stroke="none"
                                  >
                                      {chartData.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={entry.color} />
                                      ))}
                                  </Pie>
                                  <ReTooltip content={renderTooltip} />
                                  <Legend 
                                      verticalAlign="bottom" 
                                      height={36} 
                                      iconType="circle"
                                      formatter={(val, entry: any) => <span className="text-[10px] font-bold text-slate-500 uppercase ml-1">{val}</span>} 
                                  />
                              </PieChart>
                          </ResponsiveContainer>
                          {/* Center Label */}
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                              <span className="text-xs text-slate-400 font-bold uppercase">Total</span>
                              <span className="text-lg font-black text-slate-900">{formatCurrency(totalToday)}</span>
                          </div>
                      </div>
                  ) : (
                      <div className="flex flex-col items-center justify-center text-slate-300 h-64 w-full">
                          <TrendingUp size={48} className="mb-2 opacity-20"/>
                          <p className="text-xs font-bold uppercase tracking-widest">No Data</p>
                      </div>
                  )}
              </div>

          </div>
      </div>

      {/* MODAL FORM */}
      {isModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-fade-in">
              <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl border border-white/20">
                  <div className="flex justify-between items-center mb-8">
                      <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                          {editingId ? <Edit2 size={20}/> : <Plus size={20}/>}
                          {editingId ? 'Edit Transaksi' : 'Catat Pengeluaran'}
                      </h3>
                      <button onClick={()=>setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X size={24}/></button>
                  </div>
                  <form onSubmit={handleSave} className="space-y-6">
                      <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-1">Nama Transaksi</label>
                          <input type="text" className="w-full border-2 border-slate-100 p-4 rounded-2xl focus:border-brand-500 outline-none font-bold text-slate-800" value={formData.title} onChange={e=>setFormData({...formData, title: e.target.value})} autoFocus placeholder="Contoh: Makan Siang" />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-1">Nominal (IDR)</label>
                              <input type="number" className="w-full border-2 border-slate-100 p-4 rounded-2xl focus:border-brand-500 outline-none font-black text-slate-900" value={formData.amount} onChange={e=>setFormData({...formData, amount: Number(e.target.value)})} />
                          </div>
                          <div>
                              <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-1">Kategori</label>
                              <select className="w-full border-2 border-slate-100 p-4 rounded-2xl focus:border-brand-500 outline-none font-bold bg-white text-sm" value={formData.category} onChange={e=>setFormData({...formData, category: e.target.value as any})}>
                                  {Object.keys(CATEGORY_COLORS).map(cat => (
                                      <option key={cat} value={cat}>{cat}</option>
                                  ))}
                              </select>
                          </div>
                      </div>

                      <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-1">Tanggal</label>
                          <input 
                            type="date" 
                            className="w-full border-2 border-slate-100 p-4 rounded-2xl focus:border-brand-500 outline-none font-medium text-slate-600" 
                            value={formData.date} 
                            onChange={e => setFormData({...formData, date: e.target.value})} 
                          />
                      </div>

                      {/* POCKET SELECTION (TAGGING) */}
                      <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-1">Ambil dari Kantong (Opsional)</label>
                          <select 
                              className="w-full border-2 border-slate-100 p-4 rounded-2xl focus:border-brand-500 outline-none font-bold bg-white text-sm"
                              value={formData.pocketType === 'allocation' ? `alloc-${formData.allocationId}` : formData.pocketType === 'sf' ? `sf-${formData.sinkingFundId}` : ''}
                              onChange={e => {
                                  const val = e.target.value;
                                  if (!val) {
                                      setFormData({ ...formData, pocketType: '', allocationId: '', sinkingFundId: '' });
                                  } else if (val.startsWith('alloc-')) {
                                      setFormData({ ...formData, pocketType: 'allocation', allocationId: val.replace('alloc-', ''), sinkingFundId: '' });
                                  } else if (val.startsWith('sf-')) {
                                      setFormData({ ...formData, pocketType: 'sf', sinkingFundId: val.replace('sf-', ''), allocationId: '' });
                                  }
                              }}
                          >
                              <option value="">-- Tidak Ada (General) --</option>
                              <optgroup label="Budget Allocations (Paid)">
                                  {activeAllocations.map(a => (
                                      <option key={a.id} value={`alloc-${a.id}`}>{a.name} ({formatCurrency(a.amount)})</option>
                                  ))}
                              </optgroup>
                              <optgroup label="Sinking Funds">
                                  {sinkingFunds.map(s => (
                                      <option key={s.id} value={`sf-${s.id}`}>{s.name} ({formatCurrency(s.currentAmount)})</option>
                                  ))}
                              </optgroup>
                          </select>
                      </div>
                      
                      {/* SMART BUDGET IMPACT */}
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mt-2">
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1"><TrendingUp size={12}/> Impact ke Budget Harian</p>
                          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                              <div className={`h-full ${formData.amount > 100000 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, (formData.amount / 150000) * 100)}%` }}></div>
                          </div>
                          <p className="text-right text-[10px] text-slate-400 mt-1 font-mono">Limit Harian Est: 150k</p>
                      </div>

                      <div className="pt-4 flex gap-3">
                          <button type="button" onClick={()=>setIsModalOpen(false)} className="flex-1 py-4 border-2 border-slate-100 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition">Batal</button>
                          <button type="submit" disabled={isSaving} className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl flex items-center justify-center gap-2 transform active:scale-95">
                              {isSaving ? <Loader2 size={16} className="animate-spin"/> : "Simpan Data"}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* CONFIRMATION DIALOG */}
      <ConfirmDialog
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
        confirmText="Hapus"
        cancelText="Batal"
        variant="danger"
      />
    </div>
  );
}
