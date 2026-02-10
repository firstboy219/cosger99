
import React, { useState, useEffect, useRef } from 'react';
import { formatCurrency } from '../services/financeUtils';
import { Wallet, Plus, Edit2, Trash2, GripVertical, CheckSquare, ChevronLeft, ChevronRight, PiggyBank, Target, X, TrendingUp, PieChart, Repeat, DollarSign, Calendar, Copy, AlertTriangle, ArrowRight, Sparkles, Zap, Save, CheckCircle2, ReceiptText } from 'lucide-react';
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
  userId: string; // NEW PROP
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

  // --- SMART QUICK INPUT LOGIC (UPDATED FOR COPY-PASTE) ---
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
                      userId: userId, // USE CORRECT USER ID
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
          type: 'monthly',
          name: item.name,
          amount: item.amount,
          category: item.category,
          priority: item.priority,
          isRecurring: item.isRecurring !== undefined ? item.isRecurring : false, 
          applyToFuture: true
      });
      setIsFormOpen(true);
  };

  // V34 FIX: Safe Date Parsing
  const handleEditSinkingFund = (fund: SinkingFund) => {
      setEditingId(fund.id);
      setEditingType('sinking_fund');
      setFormData({
          type: 'sinking_fund',
          name: fund.name,
          amount: fund.targetAmount,
          initialBalance: fund.currentAmount,
          deadline: fund.deadline ? new Date(fund.deadline).toISOString().split('T')[0] : '',
          category: 'needs',
          priority: 1,
          isRecurring: false
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

  // --- SMART SAVE LOGIC (PROPAGATION) ---
  const handleSave = (e: React.FormEvent) => {
      e.preventDefault(); 
      if (!formData.name || !formData.amount) return;
      
      if (formData.type === 'monthly') {
          setMonthlyExpenses(prev => {
              const newExpenses = { ...prev };
              
              const upsertItem = (monthKey: string, baseId?: string) => {
                  const list = newExpenses[monthKey] || [];
                  const newItem: ExpenseItem = {
                      userId: userId, // USE CORRECT USER ID
                      name: formData.name,
                      amount: Number(formData.amount),
                      category: formData.category || 'needs',
                      priority: Number(formData.priority) || 1,
                      isTransferred: false,
                      assignedAccountId: null,
                      id: baseId || `alloc-${Date.now()}-${Math.random()}`,
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
                  // Use dynamic recurring months config
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
                  newExpenses[key] = newExpenses[key].filter(item => 
                      item.id !== id && item.name !== name
                  );
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
      
      if (onToggleAllocation && targetStatus) {
          onToggleAllocation(draggedItemId); 
      } else {
          setMonthlyExpenses(prev => ({ 
              ...prev, 
              [currentMonthKey]: (prev[currentMonthKey] || []).map(i => i.id === draggedItemId ? { ...i, isTransferred: targetStatus } : i) 
          })); 
      }
      setDraggedItemId(null); 
  };

  const getFundHistory = (fundId: string) => dailyExpenses.filter(e => e.allocationId === fundId).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const calculateRealized = (pocketId: string) => dailyExpenses.filter(e => e.allocationId === pocketId).reduce((acc, curr) => acc + curr.amount, 0);
  
  const totalBudget = expenses.reduce((a,b)=>a+b.amount,0);
  const totalRealized = expenses.reduce((acc, item) => acc + calculateRealized(item.id), 0);

  return (
    <div className="space-y-6 pb-20">
      
      {/* 1. FLASH ALLOCATOR (SMART PASTE) */}
      <div className="bg-gradient-to-r from-brand-600 to-indigo-700 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 p-6 opacity-10"><Sparkles size={120} /></div>
          
          <div className="relative z-10">
              <h2 className="text-xl font-bold flex items-center gap-2 mb-2"><Zap className="text-yellow-400" /> Flash Allocate</h2>
              <p className="text-brand-100 text-sm mb-4">
                  Paste catatan Anda di sini (Format excel, chat, dll), kami akan buatkan kantongnya otomatis. <br/>
                  <span className="opacity-70 text-xs italic">Contoh: "Listrik 500,000" atau "Sekolah opik 700.000" (Per baris)</span>
              </p>
              
              <form onSubmit={handleQuickInput} className="flex gap-2">
                  <textarea 
                    className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder-brand-200 focus:outline-none focus:bg-white/20 focus:ring-2 focus:ring-white/50 backdrop-blur-sm h-12 min-h-[48px] custom-scrollbar resize-none"
                    placeholder="Paste data di sini..."
                    value={quickInput}
                    onChange={e => setQuickInput(e.target.value)}
                    disabled={isProcessing}
                  />
                  <button type="submit" disabled={isProcessing || !quickInput} className="bg-white text-brand-700 px-6 py-3 rounded-xl font-bold text-sm hover:bg-brand-50 transition shadow-lg disabled:opacity-50 h-12">
                      {isProcessing ? '...' : 'Proses'}
                  </button>
              </form>
          </div>
      </div>

      {/* 2. SINGLE LINE HORIZONTAL CALENDAR */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                  <button onClick={() => handleYearChange(-1)} className="p-1 hover:bg-slate-50 rounded text-slate-400"><ChevronLeft size={16}/></button>
                  <span className="text-sm font-bold text-slate-900">{currentYear}</span>
                  <button onClick={() => handleYearChange(1)} className="p-1 hover:bg-slate-50 rounded text-slate-400"><ChevronRight size={16}/></button>
              </div>
              <div className="text-right">
                  <p className="text-xs text-slate-400">Total Budget</p>
                  <p className="text-sm font-black text-slate-900">{formatCurrency(getMonthTotalBudget(currentDate.getMonth()))}</p>
              </div>
          </div>

          <div className="relative flex items-center">
              <button onClick={() => scrollCalendar('left')} className="absolute left-0 z-10 p-2 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-full shadow-md text-slate-500 hover:text-slate-900"><ChevronLeft size={16}/></button>
              
              <div ref={calendarRef} className="flex overflow-x-auto gap-3 py-2 px-10 no-scrollbar snap-x w-full" style={{ scrollBehavior: 'smooth' }}>
                  {months.map((m, idx) => {
                      const isActive = idx === currentDate.getMonth();
                      const monthTotal = getMonthTotalBudget(idx);
                      return (
                          <button 
                            key={m} 
                            onClick={() => handleMonthSelect(idx)} 
                            className={`flex-shrink-0 snap-center px-5 py-3 rounded-xl border transition-all duration-300 flex flex-col items-center gap-1 min-w-[80px] ${isActive ? 'bg-slate-900 border-slate-900 text-white shadow-lg scale-105' : 'bg-white border-slate-100 text-slate-500 hover:border-brand-200 hover:bg-brand-50/50'}`}
                          >
                              <span className={`text-xs font-bold uppercase ${isActive ? 'text-slate-200' : 'text-slate-400'}`}>{m}</span>
                              <div className="h-4 flex items-center justify-center">
                                  {monthTotal > 0 ? (
                                      <span className={`text-[9px] font-bold px-1.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'}`}>
                                          {monthTotal >= 1000000 ? (monthTotal/1000000).toFixed(1) + 'jt' : (monthTotal/1000).toFixed(0) + 'rb'}
                                      </span>
                                  ) : (
                                      <div className={`w-1 h-1 rounded-full ${isActive ? 'bg-slate-600' : 'bg-slate-200'}`}></div>
                                  )}
                              </div>
                          </button>
                      );
                  })}
              </div>

              <button onClick={() => scrollCalendar('right')} className="absolute right-0 z-10 p-2 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-full shadow-md text-slate-500 hover:text-slate-900"><ChevronRight size={16}/></button>
          </div>
      </div>

      <div className="flex p-1 bg-slate-200 rounded-xl w-full max-w-md mx-auto">
          <button onClick={() => setActiveTab('monthly')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition flex items-center justify-center gap-2 ${activeTab === 'monthly' ? 'bg-white text-slate-900 shadow' : 'text-slate-500'}`}><Wallet size={16}/> Budget Bulanan</button>
          <button onClick={() => setActiveTab('sinking')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition flex items-center justify-center gap-2 ${activeTab === 'sinking' ? 'bg-white text-slate-900 shadow' : 'text-slate-500'}`}><PiggyBank size={16}/> Tabungan Impian</button>
      </div>

      {activeTab === 'monthly' && (
          <div className="space-y-6 animate-fade-in">
              <div className="flex justify-between items-center">
                  <div className="flex gap-2">
                      <div className="bg-white px-3 py-1.5 rounded-lg border text-xs font-medium shadow-sm">
                          Terpakai: <span className="font-bold text-slate-900">{formatCurrency(totalRealized)}</span>
                      </div>
                      <div className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm">
                          Sisa: <span className={totalBudget - totalRealized < 0 ? 'text-red-300' : 'text-green-300'}>{formatCurrency(totalBudget - totalRealized)}</span>
                      </div>
                  </div>
                  <div className="flex gap-2">
                      <button onClick={handleCopyFromPrevious} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100" title="Copy Last Month"><Copy size={16}/></button>
                      <button onClick={() => setIsPartitionOpen(true)} className="p-2 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-100" title="Smart Split"><PieChart size={16}/></button>
                  </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[500px]">
                  {/* Left: Pending (Rencana) */}
                  <div className="flex flex-col bg-slate-100/50 rounded-3xl border-2 border-dashed border-slate-300 p-5" onDragOver={e=>e.preventDefault()} onDrop={e=>handleDrop(e, false)}>
                      <div className="flex justify-between items-center mb-4">
                          <h3 className="font-bold text-slate-700 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-slate-400"></div> Rencana Belanja</h3>
                          <button onClick={handleOpenAdd} className="p-1.5 bg-brand-600 text-white rounded hover:bg-brand-700"><Plus size={16}/></button>
                      </div>
                      <div className="flex-1 space-y-3">
                          {expenses.filter(e=>!e.isTransferred).map(item => {
                              const used = calculateRealized(item.id); 
                              const pct = item.amount > 0 ? Math.min(100, Math.round((used/item.amount)*100)) : 0;
                              return (
                                  <div key={item.id} draggable onDragStart={e=>handleDragStart(e, item.id)} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm cursor-grab group hover:border-brand-300 transition relative overflow-hidden">
                                      {item.debtId && (
                                          <div className="absolute top-0 right-0 bg-red-100 text-red-600 px-2 py-0.5 rounded-bl text-[9px] font-bold uppercase flex items-center gap-1">
                                              <ReceiptText size={10}/> Bill
                                          </div>
                                      )}
                                      <div className="flex justify-between items-start mb-2 relative z-10">
                                          <div>
                                              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                                  {item.name}
                                                  <button onClick={() => handleEditAllocation(item)} className="text-slate-300 hover:text-brand-600"><Edit2 size={12}/></button>
                                                  <button onClick={() => handleDeleteAllocation(item.id, item.name)} className="text-slate-300 hover:text-red-600"><Trash2 size={12}/></button>
                                              </h4>
                                              <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold ${item.category === 'debt' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'}`}>{item.category}</span>
                                              {item.isRecurring && <span className="ml-1 text-[9px] px-2 py-0.5 rounded uppercase font-bold bg-blue-50 text-blue-600">Rutin</span>}
                                          </div>
                                          <GripVertical size={16} className="text-slate-300"/>
                                      </div>
                                      
                                      <div className="relative z-10 mt-3">
                                          <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                                              <span>{formatCurrency(used)}</span>
                                              <span>{formatCurrency(item.amount)}</span>
                                          </div>
                                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                              <div className={`h-full rounded-full transition-all duration-500 ${pct > 100 ? 'bg-red-500' : (pct > 80 ? 'bg-orange-500' : 'bg-brand-500')}`} style={{ width: `${pct}%` }}></div>
                                          </div>
                                      </div>
                                  </div>
                              );
                          })}
                          {expenses.filter(e=>!e.isTransferred).length === 0 && <div className="text-center py-10 text-slate-400 text-xs italic">Semua pos sudah diamankan atau belum dibuat.</div>}
                      </div>
                  </div>
                  
                  {/* Right: Secured (Sudah Disisihkan) */}
                  <div className="flex flex-col bg-green-50/50 rounded-3xl border-2 border-dashed border-green-200 p-5" onDragOver={e=>e.preventDefault()} onDrop={e=>handleDrop(e, true)}>
                      <div className="flex justify-between items-center mb-4">
                          <h3 className="font-bold text-green-800 flex items-center gap-2"><CheckCircle2 size={16} className="text-green-600"/> Dana Aman / Transfer</h3>
                      </div>
                      <div className="flex-1 space-y-3">
                          {expenses.filter(e=>e.isTransferred).map(item => {
                              const used = calculateRealized(item.id); 
                              const pct = item.amount > 0 ? Math.min(100, Math.round((used/item.amount)*100)) : 0;
                              return (
                                  <div key={item.id} draggable onDragStart={e=>handleDragStart(e, item.id)} className="bg-white p-4 rounded-2xl border border-green-200 shadow-sm cursor-grab group relative">
                                      <div className="flex items-center justify-between mb-2">
                                          <div className="flex items-center gap-2">
                                              <CheckSquare size={16} className="text-green-500"/>
                                              <h4 className="font-bold text-slate-600 text-sm line-through decoration-slate-400 decoration-2">{item.name}</h4>
                                          </div>
                                          <div className="flex gap-1">
                                              <button onClick={() => handleEditAllocation(item)} className="text-slate-300 hover:text-brand-600"><Edit2 size={12}/></button>
                                              <button onClick={() => handleDeleteAllocation(item.id, item.name)} className="text-slate-300 hover:text-red-600"><Trash2 size={12}/></button>
                                          </div>
                                      </div>
                                      <div className="mt-2 pl-6">
                                          <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                                               <div className="h-full bg-green-500 rounded-full" style={{width: `${pct}%`}}></div>
                                          </div>
                                          <div className="flex justify-between mt-1">
                                              <span className="text-[10px] text-slate-400">Used: {formatCurrency(used)}</span>
                                              <span className="text-xs font-bold text-slate-700">{formatCurrency(item.amount)}</span>
                                          </div>
                                      </div>
                                  </div>
                              );
                          })}
                          {expenses.filter(e=>e.isTransferred).length === 0 && <div className="text-center py-10 text-slate-400 text-xs italic">Drag pos ke sini jika uangnya sudah disisihkan.</div>}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'sinking' && (
          <div className="space-y-6 animate-fade-in">
              <div className="flex justify-between items-center"><div><h3 className="font-bold text-slate-900 flex items-center gap-2"><TrendingUp size={18} className="text-blue-600"/> Tabungan Jangka Panjang</h3><p className="text-xs text-slate-500">Dana ini dibawa terus ke bulan depan hingga terkumpul.</p></div><button onClick={handleOpenAdd} className="text-xs bg-slate-900 text-white px-4 py-2 rounded-lg font-medium">+ Buat Kantong</button></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sinkingFunds.map(fund => {
                      const stats = getFundHistory(fund.id).reduce((a,b)=>a+b.amount,0); const realBal = fund.currentAmount - stats;
                      return (
                          <div key={fund.id} className="bg-white border border-slate-200 rounded-2xl p-5 relative cursor-pointer hover:shadow-lg transition group" onClick={()=>handleEditSinkingFund(fund)}>
                              <div className="flex justify-between items-start mb-4"><div className="flex items-center gap-3"><div className={`p-3 rounded-xl text-white ${fund.color}`}><Target size={20}/></div><div><h4 className="font-bold text-slate-800">{fund.name}</h4><p className="text-[10px] text-slate-400">Target: {formatCurrency(fund.targetAmount)}</p></div></div><button onClick={(e) => handleDeleteSinkingFund(e, fund)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"><Trash2 size={16}/></button></div>
                              <div><div className="flex justify-between text-xs font-bold mb-1"><span className="text-slate-500">Saldo</span><span className="text-brand-600">{formatCurrency(realBal)}</span></div><div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden"><div className={`h-2 rounded-full ${fund.color}`} style={{width: `${Math.round((fund.currentAmount/fund.targetAmount)*100)}%`}}></div></div></div>
                          </div>
                      );
                  })}
              </div>
          </div>
      )}

      {isFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200">
                  <h3 className="font-bold mb-4 text-lg text-slate-900">{editingId ? 'Edit Alokasi' : 'Buat Kantong Baru'}</h3>
                  <form onSubmit={handleSave} className="space-y-4">
                      <input className="border w-full p-3 rounded-xl bg-slate-50 focus:bg-white transition outline-none focus:ring-2 focus:ring-brand-500" placeholder="Nama Kantong (Misal: Makan)" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} />
                      <div className="relative">
                          <span className="absolute left-3 top-3 text-slate-400 text-sm">Rp</span>
                          <input className="border w-full p-3 pl-10 rounded-xl bg-slate-50 focus:bg-white transition outline-none focus:ring-2 focus:ring-brand-500 font-bold" type="number" placeholder="0" value={formData.amount} onChange={e=>setFormData({...formData, amount: Number(e.target.value)})} />
                      </div>
                      
                      {formData.type === 'monthly' && (
                          <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                              <label className="flex items-center gap-3 cursor-pointer">
                                  <input type="checkbox" checked={editingId ? formData.applyToFuture : formData.isRecurring} onChange={e => editingId ? setFormData({...formData, applyToFuture: e.target.checked}) : setFormData({...formData, isRecurring: e.target.checked})} className="w-5 h-5 text-brand-600 rounded focus:ring-brand-500" />
                                  <div className="flex-1">
                                      <span className="text-sm font-bold text-blue-900 flex items-center gap-2"><Repeat size={14}/> {editingId ? 'Update Bulan Depan Juga?' : 'Jadikan Rutin?'}</span>
                                      <p className="text-[10px] text-blue-700 leading-tight mt-0.5">
                                          {editingId 
                                            ? 'Jika dicentang, nominal baru akan diterapkan ke bulan-bulan selanjutnya.' 
                                            : `Otomatis dibuatkan untuk ${defaultRecurringMonths} bulan ke depan.`}
                                      </p>
                                  </div>
                              </label>
                          </div>
                      )}

                      {formData.type === 'sinking_fund' && (
                          <div className="bg-slate-50 p-4 rounded-xl space-y-4 border border-slate-200">
                              <input className="border w-full p-2 rounded-lg" type="number" placeholder="Sudah Ada Saldo?" value={formData.initialBalance} onChange={e=>setFormData({...formData, initialBalance: Number(e.target.value)})} />
                              <div>
                                  <label className="text-xs font-bold text-slate-500">Kapan Target Tercapai?</label>
                                  {/* DATE FIX V34 */}
                                  <input type="date" className="border w-full p-2 rounded-lg" value={formData.deadline} onChange={e=>setFormData({...formData, deadline: e.target.value})} />
                              </div>
                          </div>
                      )}
                      
                      <div className="flex gap-3 pt-2">
                          <button type="button" onClick={()=>setIsFormOpen(false)} className="flex-1 border p-3 rounded-xl font-bold text-slate-600 hover:bg-slate-50">Batal</button>
                          <button type="submit" className="flex-1 bg-slate-900 text-white p-3 rounded-xl font-bold hover:bg-slate-800 shadow-lg">Simpan</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {isPartitionOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-bold flex items-center gap-2"><PieChart className="text-brand-600"/> Smart Split</h3>
                      <button onClick={()=>setIsPartitionOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                  </div>
                  <div className="space-y-6">
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase">Total Gaji Bulan Ini</label>
                          <div className="relative mt-1">
                              <DollarSign size={16} className="absolute left-3 top-3 text-slate-400"/>
                              <input type="number" className="w-full border border-slate-300 pl-10 pr-4 py-2.5 rounded-lg font-bold text-lg text-slate-900" value={partitionTotal} onChange={e=>setPartitionTotal(Number(e.target.value))} />
                          </div>
                      </div>
                      
                      <div className="space-y-4">
                          {[
                              { key: 'needs', label: `Kebutuhan (${partitionConfig.needs}%)`, color: 'bg-blue-500' },
                              { key: 'wants', label: `Keinginan (${partitionConfig.wants}%)`, color: 'bg-orange-500' },
                              { key: 'debt', label: `Tabungan/Hutang (${partitionConfig.debt}%)`, color: 'bg-green-500' }
                          ].map(item => (
                              <div key={item.key}>
                                  <div className="flex justify-between text-xs font-bold mb-1">
                                      <span>{item.label}</span>
                                      <span>{formatCurrency(partitionTotal * (partitionConfig[item.key as keyof typeof partitionConfig] / 100))}</span>
                                  </div>
                                  <input 
                                    type="range" 
                                    min="0" max="100" 
                                    className={`w-full h-2 rounded-lg appearance-none cursor-pointer accent-${item.color.replace('bg-', '')}`}
                                    style={{background: '#e2e8f0'}}
                                    value={partitionConfig[item.key as keyof typeof partitionConfig]} 
                                    onChange={e=>handlePartitionChange(item.key as any, Number(e.target.value))} 
                                  />
                              </div>
                          ))}
                      </div>

                      <button onClick={handleSavePartition} className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-slate-800 transition">
                          Terapkan Budget Otomatis
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
