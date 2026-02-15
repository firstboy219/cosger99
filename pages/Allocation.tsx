
import React, { useState, useEffect, useRef } from 'react';
import { formatCurrency } from '../services/financeUtils';
import { Wallet, Plus, Edit2, Trash2, GripVertical, CheckSquare, ChevronLeft, ChevronRight, PiggyBank, Target, X, TrendingUp, PieChart, Repeat, DollarSign, Calendar, Copy, AlertTriangle, ArrowRight, Sparkles, Zap, Save, CheckCircle2, ReceiptText, ShieldCheck, Lock, ChevronDown, ChevronUp, Info, LayoutDashboard } from 'lucide-react';
import { ExpenseItem, DailyExpense, SinkingFund } from '../types';
import { getUserData, saveUserData, getConfig } from '../services/mockDb';
import { addLogEntry } from '../services/activityLogger';

interface AllocationProps {
  monthlyExpenses: Record<string, ExpenseItem[]>;
  setMonthlyExpenses: React.Dispatch<React.SetStateAction<Record<string, ExpenseItem[]>>>;
  onAddToDailyLog: (expense: DailyExpense) => void;
  dailyExpenses: DailyExpense[]; 
  onToggleAllocation?: (id: string) => void; 
  sinkingFunds: SinkingFund[];
  setSinkingFunds: React.Dispatch<React.SetStateAction<SinkingFund[]>>;
  userId: string;
}

interface AllocationFormData {
    type: 'monthly' | 'sinking_fund';
    name: string;
    amount: number;
    initialBalance?: number;
    deadline?: string;
    category?: 'needs' | 'wants' | 'debt';
    priority?: number;
    isRecurring?: boolean;
    applyToFuture?: boolean;
}

export default function Allocation({ monthlyExpenses, setMonthlyExpenses, onAddToDailyLog, dailyExpenses, onToggleAllocation, sinkingFunds, setSinkingFunds, userId }: AllocationProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const currentMonthKey = currentDate.toISOString().slice(0, 7);
  const currentYear = currentDate.getFullYear();
  
  const [activeTab, setActiveTab] = useState<'monthly' | 'sinking'>('monthly');
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  
  // Calendar Slider Ref
  const calendarRef = useRef<HTMLDivElement>(null);

  // Smart Input State
  const [quickInput, setQuickInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSmartPaste, setShowSmartPaste] = useState(false); // UI Toggle

  // Form States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); 
  const [editingType, setEditingType] = useState<'monthly' | 'sinking_fund'>('monthly');
  const [originalName, setOriginalName] = useState('');
  
  const [formData, setFormData] = useState<AllocationFormData>({
      type: 'monthly',
      name: '',
      amount: 0,
      category: 'needs',
      priority: 1,
      isRecurring: true,
      applyToFuture: true
  });

  const [isPartitionOpen, setIsPartitionOpen] = useState(false);
  const [partitionTotal, setPartitionTotal] = useState(10000000);
  
  // DYNAMIC CONFIG LOADING
  const [partitionConfig, setPartitionConfig] = useState({ needs: 50, wants: 30, debt: 20 });
  const [defaultRecurringMonths, setDefaultRecurringMonths] = useState(12);

  useEffect(() => {
      const config = getConfig();
      if (config.advancedConfig) {
          setPartitionConfig({
              needs: config.advancedConfig.smartSplitNeeds,
              wants: config.advancedConfig.smartSplitWants,
              debt: config.advancedConfig.smartSplitDebt
          });
          setDefaultRecurringMonths(config.advancedConfig.defaultRecurringMonths);
      }
  }, []);

  const updateSinkingFunds = (newFunds: SinkingFund[]) => { 
      setSinkingFunds(newFunds); 
  };

  const expenses = monthlyExpenses[currentMonthKey] || [];

  // --- CALENDAR LOGIC (HORIZONTAL SLIDER) ---
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  
  const handleYearChange = (diff: number) => { 
      const newDate = new Date(currentDate); 
      newDate.setFullYear(newDate.getFullYear() + diff); 
      setCurrentDate(newDate); 
  };
  
  const handleMonthSelect = (monthIndex: number) => { 
      const newDate = new Date(currentDate); 
      newDate.setMonth(monthIndex); 
      setCurrentDate(newDate); 
  };

  const scrollCalendar = (direction: 'left' | 'right') => {
      if (calendarRef.current) {
          const scrollAmount = 200;
          calendarRef.current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
      }
  };

  const getMonthTotalBudget = (monthIndex: number) => { 
      const year = currentDate.getFullYear(); 
      const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`; 
      return (monthlyExpenses[monthKey] || []).reduce((acc, curr) => acc + curr.amount, 0); 
  };

  // --- SMART QUICK INPUT LOGIC ---
  const handleQuickInput = (e: React.FormEvent) => {
      e.preventDefault();
      if (!quickInput.trim()) return;
      setIsProcessing(true);

      const itemsToAdd: ExpenseItem[] = [];
      const lines = quickInput.split('\n');

      lines.forEach((line, index) => {
          const trimmed = line.trim();
          if (!trimmed) return;

          const numberMatches = trimmed.match(/([\d,.]+)/g);
          
          if (numberMatches && numberMatches.length > 0) {
              const amountStrRaw = numberMatches[numberMatches.length - 1]; 
              const cleanNumberStr = amountStrRaw.replace(/[^0-9]/g, '');
              const amount = parseFloat(cleanNumberStr);

              if (!isNaN(amount) && amount > 0) {
                  let name = trimmed.replace(amountStrRaw, '').trim();
                  name = name.replace(/[:\-\t]+$/, '').trim();
                  if (!name) name = 'Alokasi Baru';

                  itemsToAdd.push({
                      id: `quick-${Date.now()}-${index}`,
                      userId: userId, 
                      name: name,
                      amount: amount,
                      category: 'needs',
                      priority: 1,
                      isTransferred: false,
                      assignedAccountId: null
                  });
              }
          }
      });

      if (itemsToAdd.length > 0) {
          setMonthlyExpenses(prev => ({
              ...prev,
              [currentMonthKey]: [...(prev[currentMonthKey] || []), ...itemsToAdd]
          }));
          setQuickInput('');
          setShowSmartPaste(false);
          addLogEntry('user', 'user', 'Quick Allocate', `Added ${itemsToAdd.length} items via smart paste`, 'Finance');
          alert(`Berhasil menambahkan ${itemsToAdd.length} pos anggaran.`);
      } else {
          alert("Format tidak dikenali. Pastikan ada nama dan angka. \nContoh:\nListrik 500,000\nPulsa 100.000");
      }
      setIsProcessing(false);
  };

  // --- CRUD HANDLERS ---
  const handleOpenAdd = () => { 
      setEditingId(null); 
      setOriginalName('');
      setEditingType(activeTab === 'monthly' ? 'monthly' : 'sinking_fund'); 
      setFormData({ 
          type: activeTab === 'monthly' ? 'monthly' : 'sinking_fund', 
          name: '', amount: 0, category: 'needs', priority: 1, 
          initialBalance: 0, deadline: '', isRecurring: true, applyToFuture: true 
      }); 
      setIsFormOpen(true); 
  };

  const handleEditAllocation = (item: ExpenseItem) => {
      setEditingId(item.id);
      setOriginalName(item.name); 
      setEditingType('monthly');
      setFormData({
          type: 'monthly', name: item.name, amount: item.amount, category: item.category, priority: item.priority,
          isRecurring: item.isRecurring !== undefined ? item.isRecurring : false, applyToFuture: true
      });
      setIsFormOpen(true);
  };

  const handleEditSinkingFund = (fund: SinkingFund) => {
      setEditingId(fund.id);
      setEditingType('sinking_fund');
      setFormData({
          type: 'sinking_fund', name: fund.name, amount: fund.targetAmount, initialBalance: fund.currentAmount,
          deadline: fund.deadline ? new Date(fund.deadline).toISOString().split('T')[0] : '', category: 'needs', priority: 1, isRecurring: false
      });
      setIsFormOpen(true);
  };

  const handleCopyFromPrevious = () => {
      const prevDate = new Date(currentDate); prevDate.setMonth(prevDate.getMonth() - 1);
      const prevKey = prevDate.toISOString().slice(0, 7);
      const prevItems = monthlyExpenses[prevKey] || [];
      if (prevItems.length === 0) return alert("Tidak ada data budget di bulan lalu.");
      if (expenses.length > 0 && !confirm("Salin budget bulan lalu ke bulan ini?")) return;

      const copied = prevItems.map(item => ({ ...item, id: `copy-${Date.now()}-${Math.random()}`, isTransferred: false }));
      setMonthlyExpenses(prev => ({ ...prev, [currentMonthKey]: copied }));
      addLogEntry('user', 'user', 'Copy Allocation', `Copied ${copied.length} pockets from last month`, 'Finance');
  };

  const handleSave = (e: React.FormEvent) => {
      e.preventDefault(); 
      if (!formData.name || !formData.amount) return;
      
      if (formData.type === 'monthly') {
          setMonthlyExpenses(prev => {
              const newExpenses = { ...prev };
              const upsertItem = (monthKey: string, baseId?: string) => {
                  const list = newExpenses[monthKey] || [];
                  const newItem: ExpenseItem = {
                      userId: userId, name: formData.name, amount: Number(formData.amount), category: formData.category || 'needs',
                      priority: Number(formData.priority) || 1, isTransferred: false, assignedAccountId: null, id: baseId || `alloc-${Date.now()}-${Math.random()}`,
                      isRecurring: formData.isRecurring 
                  };
                  if (editingId && monthKey === currentMonthKey) {
                      newExpenses[monthKey] = list.map(i => i.id === editingId ? { ...i, ...newItem } : i);
                  } else {
                      const existingIdx = list.findIndex(i => i.name === (editingId ? originalName : formData.name));
                      if (existingIdx >= 0 && editingId) {
                          const updatedList = [...list];
                          updatedList[existingIdx] = { ...updatedList[existingIdx], ...newItem, id: updatedList[existingIdx].id }; 
                          newExpenses[monthKey] = updatedList;
                      } else {
                          newExpenses[monthKey] = [...list, newItem];
                      }
                  }
              };
              upsertItem(currentMonthKey, editingId || undefined);
              if (formData.isRecurring || (editingId && formData.applyToFuture)) {
                  const startMonth = new Date(currentDate);
                  for (let i = 1; i <= defaultRecurringMonths; i++) {
                      const nextMonth = new Date(startMonth);
                      nextMonth.setMonth(startMonth.getMonth() + i);
                      const nextKey = nextMonth.toISOString().slice(0, 7);
                      upsertItem(nextKey);
                  }
              }
              return newExpenses;
          });
      } else {
          let newFunds = editingId 
            ? sinkingFunds.map(f => f.id === editingId ? { ...f, name: formData.name, targetAmount: Number(formData.amount), currentAmount: Number(formData.initialBalance), deadline: formData.deadline || '' } : f) 
            : [...sinkingFunds, { id: `sf-${Date.now()}`, userId: userId, name: formData.name, targetAmount: Number(formData.amount), currentAmount: Number(formData.initialBalance) || 0, deadline: formData.deadline || new Date().toISOString().split('T')[0], icon: 'piggy', color: 'bg-blue-500' }];
          updateSinkingFunds(newFunds);
      }
      setIsFormOpen(false);
  };

  const handleDeleteAllocation = (id: string, name: string) => {
      if (!confirm(`Hapus kantong "${name}"? \n\nOpsi: Hapus ini juga akan menghapus kantong dengan nama yang sama di bulan-bulan berikutnya (Unlimited).`)) return;
      setMonthlyExpenses(prev => {
          const newExpenses = { ...prev };
          const startKey = currentMonthKey;
          Object.keys(newExpenses).forEach(key => {
              if (key >= startKey) {
                  newExpenses[key] = newExpenses[key].filter(item => item.id !== id && item.name !== name);
              }
          });
          return newExpenses;
      });
  };

  const handleDeleteSinkingFund = async (e: React.MouseEvent, fund: SinkingFund) => {
      e.stopPropagation();
      if (!confirm("Hapus tabungan ini?")) return;
      const config = getConfig();
      const baseUrl = config.backendUrl?.replace(/\/$/, '') || '';
      try {
          const res = await fetch(`${baseUrl}/api/sinking-funds/${fund.id}?userId=${fund.userId}`, { method: 'DELETE' });
          if (res.ok) {
              const newFunds = sinkingFunds.filter(s => s.id !== fund.id);
              updateSinkingFunds(newFunds);
          } else {
              alert("Gagal menghapus di server.");
          }
      } catch (err) {
          alert("Error koneksi.");
      }
  };

  const handlePartitionChange = (type: 'needs' | 'wants' | 'debt', newValue: number) => {
      const newConfig = { ...partitionConfig, [type]: newValue };
      const others = (['needs','wants','debt'] as const).filter(k => k !== type);
      const rem = 100 - newValue; const oldSum = others.reduce((s, k) => s + partitionConfig[k], 0);
      others.forEach(k => newConfig[k] = oldSum === 0 ? Math.round(rem/2) : Math.round(rem * (partitionConfig[k]/oldSum)));
      const sum = newConfig.needs + newConfig.wants + newConfig.debt;
      if (sum !== 100) newConfig[others[0]] += (100 - sum);
      setPartitionConfig(newConfig);
  };

  const handleSavePartition = () => {
      const newItems: ExpenseItem[] = [
          { id: `auto-${Date.now()}-1`, userId: userId, name: 'Kebutuhan Pokok (Rutin)', amount: partitionTotal * (partitionConfig.needs / 100), category: 'needs', priority: 1, isTransferred: false, assignedAccountId: null, isRecurring: true },
          { id: `auto-${Date.now()}-2`, userId: userId, name: 'Alokasi Gaya Hidup', amount: partitionTotal * (partitionConfig.wants / 100), category: 'wants', priority: 3, isTransferred: false, assignedAccountId: null },
          { id: `auto-${Date.now()}-3`, userId: userId, name: 'Tabungan & Cicilan', amount: partitionTotal * (partitionConfig.debt / 100), category: 'debt', priority: 2, isTransferred: false, assignedAccountId: null },
      ];
      setMonthlyExpenses(prev => ({ ...prev, [currentMonthKey]: [...(prev[currentMonthKey] || []), ...newItems] }));
      setIsPartitionOpen(false);
  };

  const handleDragStart = (e: React.DragEvent, id: string) => { setDraggedItemId(id); e.dataTransfer.effectAllowed = "move"; };
  
  const handleDrop = (e: React.DragEvent, targetStatus: boolean) => { 
      e.preventDefault(); 
      if (!draggedItemId) return; 
      if (onToggleAllocation && targetStatus) { onToggleAllocation(draggedItemId); } 
      else {
          setMonthlyExpenses(prev => ({ 
              ...prev, [currentMonthKey]: (prev[currentMonthKey] || []).map(i => i.id === draggedItemId ? { ...i, isTransferred: targetStatus } : i) 
          })); 
      }
      setDraggedItemId(null); 
  };

  const getFundHistory = (fundId: string) => dailyExpenses.filter(e => e.allocationId === fundId).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const calculateRealized = (pocketId: string) => dailyExpenses.filter(e => e.allocationId === pocketId).reduce((acc, curr) => acc + curr.amount, 0);
  
  const totalBudget = expenses.reduce((a,b)=>a+b.amount,0);
  const totalRealized = expenses.reduce((acc, item) => acc + calculateRealized(item.id), 0);
  const totalSecured = expenses.filter(e=>e.isTransferred).reduce((a,b)=>a+b.amount,0);
  const totalPending = totalBudget - totalSecured;

  // VISUAL HELPERS
  const getProgressColor = (pct: number) => pct > 100 ? 'bg-red-500' : pct > 80 ? 'bg-orange-500' : 'bg-brand-500';

  return (
    <div className="space-y-8 pb-24 animate-fade-in font-sans">
      
      {/* 1. HEADER CONTROL DECK */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row">
          
          {/* Calendar Controller */}
          <div className="flex-1 p-6 border-r border-slate-100 flex flex-col justify-center">
              <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                      <button onClick={() => handleYearChange(-1)} className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 transition"><ChevronLeft size={16}/></button>
                      <span className="text-lg font-black text-slate-900">{currentYear}</span>
                      <button onClick={() => handleYearChange(1)} className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 transition"><ChevronRight size={16}/></button>
                  </div>
                  <button onClick={() => setShowSmartPaste(!showSmartPaste)} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition ${showSmartPaste ? 'bg-indigo-600 text-white shadow-lg' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}>
                      <Zap size={14} className={showSmartPaste ? "fill-white" : "fill-indigo-600"}/> Smart Flash
                  </button>
              </div>

              {/* Horizontal Month Slider */}
              <div className="relative flex items-center group">
                  <button onClick={() => scrollCalendar('left')} className="absolute -left-2 z-10 p-2 bg-white/90 backdrop-blur-sm border rounded-full shadow text-slate-400 hover:text-slate-900 opacity-0 group-hover:opacity-100 transition"><ChevronLeft size={16}/></button>
                  <div ref={calendarRef} className="flex overflow-x-auto gap-2 py-2 px-1 no-scrollbar snap-x w-full scroll-smooth">
                      {months.map((m, idx) => {
                          const isActive = idx === currentDate.getMonth();
                          const monthTotal = getMonthTotalBudget(idx);
                          return (
                              <button key={m} onClick={() => handleMonthSelect(idx)} className={`flex-shrink-0 snap-center px-4 py-2.5 rounded-xl border transition-all duration-300 flex flex-col items-center gap-1 min-w-[70px] ${isActive ? 'bg-slate-900 border-slate-900 text-white shadow-lg scale-105' : 'bg-white border-slate-100 text-slate-400 hover:border-brand-200'}`}>
                                  <span className="text-[10px] font-black uppercase tracking-wider">{m}</span>
                                  <div className={`h-1.5 w-1.5 rounded-full ${monthTotal > 0 ? (isActive ? 'bg-green-400' : 'bg-green-500') : (isActive ? 'bg-slate-700' : 'bg-slate-200')}`}></div>
                              </button>
                          );
                      })}
                  </div>
                  <button onClick={() => scrollCalendar('right')} className="absolute -right-2 z-10 p-2 bg-white/90 backdrop-blur-sm border rounded-full shadow text-slate-400 hover:text-slate-900 opacity-0 group-hover:opacity-100 transition"><ChevronRight size={16}/></button>
              </div>
          </div>

          {/* Stats Overview */}
          <div className="p-6 md:w-80 bg-slate-50/50 flex flex-col justify-center">
              <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total Budget</span>
                  <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded">{expenses.length} Pos</span>
              </div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tighter mb-4">{formatCurrency(totalBudget)}</h2>
              
              <div className="flex gap-2 text-[10px] font-bold uppercase text-slate-400">
                  <div className="flex-1 bg-white p-2 rounded-lg border border-slate-100 text-center">
                      <span className="block mb-1 text-green-600">Secure</span>
                      {formatCurrency(totalSecured)}
                  </div>
                  <div className="flex-1 bg-white p-2 rounded-lg border border-slate-100 text-center">
                      <span className="block mb-1 text-slate-500">Plan</span>
                      {formatCurrency(totalPending)}
                  </div>
              </div>
          </div>
      </div>

      {/* 2. FLASH ALLOCATOR (Collapsible) */}
      {showSmartPaste && (
          <div className="bg-indigo-600 rounded-[2rem] p-6 text-white shadow-xl relative overflow-hidden animate-fade-in-up">
              <div className="absolute right-0 top-0 p-6 opacity-10"><Sparkles size={120} /></div>
              <div className="relative z-10 flex flex-col md:flex-row gap-4 items-start">
                  <div className="flex-1">
                      <h3 className="font-bold flex items-center gap-2 mb-1"><Zap className="text-yellow-400" size={18} /> Flash Allocate</h3>
                      <p className="text-indigo-200 text-xs mb-3">
                          Paste catatan budget (e.g. "Listrik 500rb, Pulsa 100rb"). Kami buatkan pos otomatis.
                      </p>
                      <form onSubmit={handleQuickInput} className="flex gap-2">
                          <textarea className="flex-1 bg-indigo-800/50 border border-indigo-400/30 rounded-xl px-4 py-3 text-sm text-white placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-white/30 backdrop-blur-sm h-12 min-h-[48px] custom-scrollbar resize-none font-medium" placeholder="Paste data di sini..." value={quickInput} onChange={e => setQuickInput(e.target.value)} disabled={isProcessing} />
                          <button type="submit" disabled={isProcessing || !quickInput} className="bg-white text-indigo-700 px-6 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-indigo-50 transition shadow-lg disabled:opacity-50 h-12">
                              {isProcessing ? '...' : 'Process'}
                          </button>
                      </form>
                  </div>
                  <button onClick={() => setShowSmartPaste(false)} className="p-2 bg-indigo-700 rounded-full hover:bg-indigo-800 text-indigo-200"><ChevronUp size={20}/></button>
              </div>
          </div>
      )}

      {/* 3. TABS NAV */}
      <div className="flex justify-center">
          <div className="bg-white p-1 rounded-2xl border border-slate-200 shadow-sm flex">
              <button onClick={() => setActiveTab('monthly')} className={`px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-all ${activeTab === 'monthly' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
                  <Wallet size={14}/> Monthly Budget
              </button>
              <button onClick={() => setActiveTab('sinking')} className={`px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-all ${activeTab === 'sinking' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
                  <PiggyBank size={14}/> Sinking Funds
              </button>
          </div>
      </div>

      {/* 4. MAIN CONTENT AREA */}
      {activeTab === 'monthly' && (
          <div className="space-y-6 animate-fade-in">
              
              {/* Toolbar */}
              <div className="flex justify-between items-center px-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                      <Info size={14}/>
                      <span>Drag kartu ke area kanan untuk mengamankan dana.</span>
                  </div>
                  <div className="flex gap-2">
                      <button onClick={handleCopyFromPrevious} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition" title="Copy Last Month">
                          <Copy size={14}/> Copy Last Month
                      </button>
                      <button onClick={() => setIsPartitionOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition" title="Smart Split">
                          <PieChart size={14}/> Smart Split
                      </button>
                  </div>
              </div>

              {/* FLOW INTERFACE: Left (Planned) -> Right (Secured) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 min-h-[600px]">
                  
                  {/* LEFT: PLANNED STREAM */}
                  <div className="flex flex-col space-y-4" onDragOver={e=>e.preventDefault()} onDrop={e=>handleDrop(e, false)}>
                      <div className="flex justify-between items-center p-2">
                          <h3 className="font-black text-slate-700 uppercase tracking-widest text-xs flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-slate-400"></span> Allocation Stream
                          </h3>
                          <button onClick={handleOpenAdd} className="p-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 shadow-md transition transform active:scale-95"><Plus size={16}/></button>
                      </div>
                      
                      <div className="space-y-3 pb-10">
                          {expenses.filter(e => !e.isTransferred).map(item => {
                              const used = calculateRealized(item.id); 
                              const pct = item.amount > 0 ? Math.min(100, Math.round((used/item.amount)*100)) : 0;
                              return (
                                  <div 
                                    key={item.id} 
                                    draggable 
                                    onDragStart={e=>handleDragStart(e, item.id)} 
                                    className="bg-white p-5 rounded-[1.5rem] border border-slate-200 shadow-sm hover:shadow-lg hover:border-brand-300 hover:-translate-y-1 transition-all cursor-grab active:cursor-grabbing group relative overflow-hidden"
                                  >
                                      {/* Progress Bar Background Hint */}
                                      <div className="absolute bottom-0 left-0 h-1 bg-slate-100 w-full">
                                          <div className={`h-full ${getProgressColor(pct)}`} style={{width: `${pct}%`}}></div>
                                      </div>

                                      <div className="flex justify-between items-start relative z-10">
                                          <div className="flex items-center gap-3">
                                              <div className={`p-2 rounded-xl ${item.category === 'debt' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                                                  {item.category === 'debt' ? <ReceiptText size={18}/> : <Wallet size={18}/>}
                                              </div>
                                              <div>
                                                  <h4 className="font-bold text-slate-800 text-sm">{item.name}</h4>
                                                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mt-0.5">{item.category} {item.isRecurring && '• Routine'}</p>
                                              </div>
                                          </div>
                                          <div className="text-right">
                                              <p className="font-black text-slate-900">{formatCurrency(item.amount)}</p>
                                              <p className="text-[10px] text-slate-400 font-mono mt-0.5">Used: {formatCurrency(used)}</p>
                                          </div>
                                      </div>

                                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                          <button onClick={() => handleEditAllocation(item)} className="p-1.5 bg-white border rounded-lg text-slate-400 hover:text-brand-600"><Edit2 size={12}/></button>
                                          <button onClick={() => handleDeleteAllocation(item.id, item.name)} className="p-1.5 bg-white border rounded-lg text-slate-400 hover:text-red-600"><Trash2 size={12}/></button>
                                      </div>
                                  </div>
                              );
                          })}
                          {expenses.filter(e => !e.isTransferred).length === 0 && (
                              <div className="border-2 border-dashed border-slate-200 rounded-[2rem] p-10 text-center flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
                                  <CheckCircle2 size={48} className="mb-4 opacity-20"/>
                                  <p className="font-bold text-xs uppercase tracking-widest">All Funds Allocated!</p>
                              </div>
                          )}
                      </div>
                  </div>

                  {/* RIGHT: SECURE VAULT */}
                  <div className="flex flex-col space-y-4 h-full" onDragOver={e=>e.preventDefault()} onDrop={e=>handleDrop(e, true)}>
                      <div className="flex justify-between items-center p-2">
                          <h3 className="font-black text-emerald-700 uppercase tracking-widest text-xs flex items-center gap-2">
                              <ShieldCheck size={16}/> Secure Vault
                          </h3>
                          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
                              {formatCurrency(totalSecured)}
                          </span>
                      </div>

                      <div className="flex-1 bg-emerald-50/50 border-2 border-emerald-100 rounded-[2.5rem] p-6 relative overflow-hidden shadow-inner">
                          {/* Decorative Background */}
                          <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none"><Lock size={200} className="text-emerald-900"/></div>
                          
                          <div className="space-y-3 relative z-10 overflow-y-auto custom-scrollbar h-full max-h-[600px] pr-2">
                              {expenses.filter(e => e.isTransferred).length === 0 ? (
                                  <div className="h-full flex flex-col items-center justify-center text-emerald-800/40 text-center p-8">
                                      <ArrowRight size={48} className="mb-4 opacity-30 animate-pulse"/>
                                      <p className="font-bold text-xs uppercase tracking-widest">Drag items here to mark as SECURED</p>
                                  </div>
                              ) : (
                                  expenses.filter(e => e.isTransferred).map(item => {
                                      const used = calculateRealized(item.id);
                                      const pct = item.amount > 0 ? Math.min(100, Math.round((used/item.amount)*100)) : 0;
                                      return (
                                          <div key={item.id} draggable onDragStart={e=>handleDragStart(e, item.id)} className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm flex items-center justify-between cursor-grab group relative">
                                              <div className="flex items-center gap-3">
                                                  <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                                                      <CheckSquare size={16}/>
                                                  </div>
                                                  <div>
                                                      <h4 className="font-bold text-slate-600 text-sm line-through decoration-slate-300 decoration-2">{item.name}</h4>
                                                      <div className="w-24 h-1 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                                                          <div className="h-full bg-emerald-500 rounded-full" style={{width: `${pct}%`}}></div>
                                                      </div>
                                                  </div>
                                              </div>
                                              <div className="text-right">
                                                  <span className="font-bold text-emerald-600 text-sm">{formatCurrency(item.amount)}</span>
                                                  <div className="flex justify-end gap-1 mt-1 opacity-0 group-hover:opacity-100 transition">
                                                      <button onClick={() => handleEditAllocation(item)} className="text-slate-300 hover:text-brand-600"><Edit2 size={12}/></button>
                                                      <button onClick={() => handleDeleteAllocation(item.id, item.name)} className="text-slate-300 hover:text-red-600"><Trash2 size={12}/></button>
                                                  </div>
                                              </div>
                                          </div>
                                      )
                                  })
                              )}
                          </div>
                      </div>
                  </div>

              </div>
          </div>
      )}

      {/* TAB 2: SINKING FUNDS (SMART CARDS) */}
      {activeTab === 'sinking' && (
          <div className="space-y-6 animate-fade-in">
              <div className="flex justify-between items-center">
                  <div>
                      <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                          <Target size={20} className="text-blue-600"/> Goals & Savings
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">Accumulate funds for future expenses.</p>
                  </div>
                  <button onClick={handleOpenAdd} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition shadow-lg flex items-center gap-2">
                      <Plus size={16}/> New Goal
                  </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sinkingFunds.map(fund => {
                      const stats = getFundHistory(fund.id).reduce((a,b)=>a+b.amount,0);
                      const pct = Math.min(100, Math.round((fund.currentAmount/fund.targetAmount)*100));
                      
                      return (
                          <div key={fund.id} onClick={()=>handleEditSinkingFund(fund)} className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm hover:shadow-xl transition-all cursor-pointer group relative overflow-hidden">
                              {/* Background Fill Effect */}
                              <div className="absolute bottom-0 left-0 w-full bg-blue-50/50 transition-all duration-1000 ease-out" style={{height: `${pct}%`}}></div>
                              
                              <div className="relative z-10 flex justify-between items-start mb-4">
                                  <div className={`p-3 rounded-2xl text-white shadow-lg ${fund.color}`}>
                                      <Target size={24}/>
                                  </div>
                                  <button onClick={(e) => handleDeleteSinkingFund(e, fund)} className="p-2 bg-white rounded-full text-slate-300 hover:text-red-500 shadow-sm opacity-0 group-hover:opacity-100 transition"><Trash2 size={16}/></button>
                              </div>
                              
                              <div className="relative z-10 space-y-2">
                                  <h4 className="font-black text-slate-900 text-lg">{fund.name}</h4>
                                  <div className="flex justify-between items-end">
                                      <div>
                                          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Collected</p>
                                          <p className="text-xl font-black text-brand-600">{formatCurrency(fund.currentAmount)}</p>
                                      </div>
                                      <div className="text-right">
                                          <p className="text-[10px] text-slate-400 uppercase font-bold">Target</p>
                                          <p className="text-sm font-bold text-slate-600">{formatCurrency(fund.targetAmount)}</p>
                                      </div>
                                  </div>
                                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mt-2">
                                      <div className={`h-full rounded-full transition-all duration-1000 ${fund.color}`} style={{width: `${pct}%`}}></div>
                                  </div>
                                  <p className="text-right text-[10px] text-slate-400 font-bold">{pct}% Reached</p>
                              </div>
                          </div>
                      );
                  })}
                  
                  {/* Empty Add Card */}
                  <button onClick={handleOpenAdd} className="border-2 border-dashed border-slate-200 rounded-[2rem] p-6 flex flex-col items-center justify-center text-slate-400 hover:border-brand-300 hover:bg-brand-50/50 transition gap-4 min-h-[200px]">
                      <div className="p-4 bg-white rounded-full shadow-sm"><Plus size={24}/></div>
                      <span className="font-bold text-xs uppercase tracking-widest">Create New Goal</span>
                  </button>
              </div>
          </div>
      )}

      {/* MODAL: ADD/EDIT FORM */}
      {isFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-fade-in">
              <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl border border-white/20 relative">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-black text-slate-900 tracking-tight">{editingId ? 'Edit Item' : 'New Allocation'}</h3>
                      <button onClick={()=>setIsFormOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition"><X size={24}/></button>
                  </div>
                  <form onSubmit={handleSave} className="space-y-5">
                      <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 ml-1">Name / Description</label>
                          <input className="w-full border-2 border-slate-100 p-4 rounded-2xl focus:border-brand-500 outline-none font-bold text-slate-800 transition" placeholder="e.g. Listrik" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} autoFocus />
                      </div>
                      <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 ml-1">Amount</label>
                          <div className="relative">
                              <span className="absolute left-4 top-4 text-slate-400 font-bold">Rp</span>
                              <input className="w-full border-2 border-slate-100 p-4 pl-12 rounded-2xl focus:border-brand-500 outline-none font-black text-lg text-slate-900 transition" type="number" placeholder="0" value={formData.amount} onChange={e=>setFormData({...formData, amount: Number(e.target.value)})} />
                          </div>
                      </div>
                      
                      {formData.type === 'monthly' && (
                          <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                              <label className="flex items-center gap-3 cursor-pointer group">
                                  <input type="checkbox" checked={editingId ? formData.applyToFuture : formData.isRecurring} onChange={e => editingId ? setFormData({...formData, applyToFuture: e.target.checked}) : setFormData({...formData, isRecurring: e.target.checked})} className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300" />
                                  <div className="flex-1">
                                      <span className="text-sm font-bold text-indigo-900 flex items-center gap-2 group-hover:text-indigo-700 transition"><Repeat size={16}/> {editingId ? 'Update Future Months?' : 'Make Routine?'}</span>
                                      <p className="text-[10px] text-indigo-700/70 mt-0.5 leading-tight">
                                          {editingId 
                                            ? 'Apply this change to subsequent months.' 
                                            : `Automatically create for next ${defaultRecurringMonths} months.`}
                                      </p>
                                  </div>
                              </label>
                          </div>
                      )}

                      {formData.type === 'sinking_fund' && (
                          <div className="space-y-4">
                              <div>
                                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 ml-1">Initial Balance</label>
                                  <input className="w-full border-2 border-slate-100 p-3 rounded-xl font-bold text-sm" type="number" value={formData.initialBalance} onChange={e=>setFormData({...formData, initialBalance: Number(e.target.value)})} />
                              </div>
                              <div>
                                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 ml-1">Target Date</label>
                                  <input type="date" className="w-full border-2 border-slate-100 p-3 rounded-xl font-bold text-sm text-slate-600" value={formData.deadline} onChange={e=>setFormData({...formData, deadline: e.target.value})} />
                              </div>
                          </div>
                      )}
                      
                      <div className="flex gap-3 pt-4">
                          <button type="button" onClick={()=>setIsFormOpen(false)} className="flex-1 py-3.5 border-2 border-slate-100 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 transition text-xs uppercase tracking-widest">Cancel</button>
                          <button type="submit" className="flex-[2] py-3.5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 shadow-xl transition transform active:scale-95">Save Item</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* MODAL: SMART SPLIT */}
      {isPartitionOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-fade-in">
              <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl border border-white/20">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-black text-slate-900 flex items-center gap-2"><PieChart className="text-brand-600"/> Smart Split</h3>
                      <button onClick={()=>setIsPartitionOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
                  </div>
                  
                  <div className="space-y-6">
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Total Income to Split</label>
                          <div className="relative">
                              <span className="absolute left-0 top-1 text-slate-400 font-bold">Rp</span>
                              <input type="number" className="w-full bg-transparent border-b-2 border-slate-300 pl-6 py-1 font-black text-xl text-slate-900 outline-none focus:border-brand-500 transition" value={partitionTotal} onChange={e=>setPartitionTotal(Number(e.target.value))} />
                          </div>
                      </div>
                      
                      <div className="space-y-5">
                          {[
                              { key: 'needs', label: 'Needs (Pokok)', pct: partitionConfig.needs, color: 'bg-blue-500', text: 'text-blue-600' },
                              { key: 'wants', label: 'Wants (Gaya Hidup)', pct: partitionConfig.wants, color: 'bg-orange-500', text: 'text-orange-600' },
                              { key: 'debt', label: 'Savings/Debt (Tabungan)', pct: partitionConfig.debt, color: 'bg-green-500', text: 'text-green-600' }
                          ].map(item => (
                              <div key={item.key}>
                                  <div className="flex justify-between text-xs font-bold mb-2">
                                      <span className={item.text}>{item.label} <span className="opacity-60 text-[10px]">({item.pct}%)</span></span>
                                      <span className="text-slate-900">{formatCurrency(partitionTotal * (item.pct / 100))}</span>
                                  </div>
                                  <input 
                                    type="range" 
                                    min="0" max="100" 
                                    className={`w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-200 accent-${item.color.replace('bg-', '')}`}
                                    value={partitionConfig[item.key as keyof typeof partitionConfig]} 
                                    onChange={e=>handlePartitionChange(item.key as any, Number(e.target.value))} 
                                  />
                              </div>
                          ))}
                      </div>

                      <button onClick={handleSavePartition} className="w-full bg-slate-900 text-white font-black text-xs uppercase tracking-widest py-4 rounded-2xl shadow-xl hover:bg-slate-800 transition transform active:scale-95 flex justify-center gap-2">
                          <CheckCircle2 size={16}/> Apply Budget
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
