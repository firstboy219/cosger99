
import React, { useState, useEffect } from 'react';
import { DailyExpense, ExpenseItem, SinkingFund } from '../types';
import { formatCurrency, detectSpendingAnomaly, safeDateISO } from '../services/financeUtils';
import { parseTransactionAI } from '../services/geminiService';
import { getUserData, getConfig, saveUserData } from '../services/mockDb';
import { Receipt, Calendar, Plus, Search, Tag, Trash2, Camera, Edit2, X, Check, Filter, ArrowRight, Wallet, ChevronLeft, ChevronRight, Target, PiggyBank, Flame, Grid, AlertTriangle, Sparkles, Send, Loader2 } from 'lucide-react';

interface DailyExpensesProps {
  expenses: DailyExpense[];
  setExpenses: React.Dispatch<React.SetStateAction<DailyExpense[]>>;
  allocations: ExpenseItem[]; 
  userId: string; // NEW PROP
}

export default function DailyExpenses({ expenses, setExpenses, allocations, userId }: DailyExpensesProps) {
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState(new Date());
  const [sinkingFunds, setSinkingFunds] = useState<SinkingFund[]>([]);
  
  // AI Quick Add
  const [quickText, setQuickText] = useState('');
  const [isProcessingAI, setIsProcessingAI] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '', amount: 0, category: 'Food', date: filterDate, notes: '', allocationId: ''
  });
  const [draggedExpenseId, setDraggedExpenseId] = useState<string | null>(null);

  useEffect(() => {
      const data = getUserData(userId || 'u2'); // Use dynamic userId or safe fallback
      setSinkingFunds(data.sinkingFunds || []);
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); 
      const monday = new Date(now.setDate(diff));
      setStartDate(monday);
  }, [userId]);

  useEffect(() => {
    if (!isModalOpen && !editingId) { setFormData(prev => ({ ...prev, date: filterDate })); }
  }, [filterDate, isModalOpen, editingId]);

  // V44.5 Filter soft deleted items from UI
  const activeExpenses = expenses.filter(e => !e._deleted);
  const anomaly = detectSpendingAnomaly(activeExpenses);

  const handleQuickAdd = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!quickText.trim()) return;
      setIsProcessingAI(true);
      
      const result = await parseTransactionAI(quickText);
      
      setIsProcessingAI(false);
      setQuickText('');

      if (result.intent === 'ADD_DAILY_EXPENSE' && result.data) {
          const d = result.data;
          
          const newItem: DailyExpense = {
              id: `ai-exp-${Date.now()}`,
              userId: userId, // CORRECT USER ID
              title: d.title || 'Pengeluaran',
              amount: Number(d.amount) || 0, 
              category: (d.category as any) || 'Others',
              date: filterDate, 
              notes: 'Added via AI',
              updatedAt: new Date().toISOString(),
              _deleted: false
          };
          setExpenses(prev => [newItem, ...prev]);
          alert(`Berhasil menambahkan: ${newItem.title} - ${formatCurrency(newItem.amount)}`);
      } else {
          alert("Gagal memproses. Coba format: 'Makan siang 50rb'");
      }
  };

  const getTwoWeeks = (start: Date) => {
      const days = [];
      for (let i = 0; i < 14; i++) {
          const d = new Date(start); d.setDate(start.getDate() + i); days.push(d);
      }
      return days;
  };
  const daysGrid = getTwoWeeks(startDate);

  const groupedExpenses = activeExpenses.reduce((groups, expense) => {
    const date = safeDateISO(expense.date);
    if (!groups[date]) groups[date] = [];
    groups[date].push(expense);
    return groups;
  }, {} as Record<string, DailyExpense[]>);

  // BUG FIX: Force Number
  const dailyTotals: Record<string, number> = {};
  let maxDailyTotal = 0;
  Object.keys(groupedExpenses).forEach(date => {
      const total = groupedExpenses[date].reduce((sum, item) => sum + Number(item.amount || 0), 0);
      dailyTotals[date] = total;
      if (total > maxDailyTotal) maxDailyTotal = total;
  });

  const activePockets = allocations.filter(a => a.isTransferred);

  // V44.5 SAFE MODE DELETE
  const handleDelete = async (id: string) => { 
      if (!confirm("Hapus catatan ini?")) return;
      
      const itemToDelete = expenses.find(e => e.id === id);
      if (!itemToDelete) return;

      try {
          const now = new Date().toISOString();
          const newExpenses = expenses.map(e => e.id === id ? { ...e, _deleted: true, updatedAt: now } : e);
          
          setExpenses(newExpenses);
          // Persist Soft Delete Locally
          saveUserData(itemToDelete.userId, { dailyExpenses: newExpenses });

      } catch (e) {
          alert("Error menghapus data.");
      }
  };

  const handleOpenAdd = () => { setEditingId(null); setFormData({ title: '', amount: 0, category: 'Food', date: filterDate, notes: '', allocationId: '' }); setIsModalOpen(true); };
  
  const handleOpenEdit = (item: DailyExpense) => { 
      setEditingId(item.id); 
      setFormData({ 
          title: item.title, 
          amount: item.amount, 
          category: item.category, 
          date: safeDateISO(item.date), 
          notes: item.notes || '', 
          allocationId: item.allocationId || '' 
      }); 
      setIsModalOpen(true); 
  };
  
  const handleSave = (e: React.FormEvent) => { 
      e.preventDefault(); 
      if (!formData.title || formData.amount <= 0) return; 
      const now = new Date().toISOString();

      if (editingId) { 
          setExpenses(prev => prev.map(e => e.id === editingId ? { ...e, title: formData.title, amount: Number(formData.amount), category: formData.category as any, date: formData.date, notes: formData.notes, allocationId: formData.allocationId || undefined, updatedAt: now } : e)); 
      } else { 
          const newItem: DailyExpense = { id: `manual-exp-${Date.now()}`, userId: userId, title: formData.title, amount: Number(formData.amount), category: formData.category as any, date: formData.date, notes: formData.notes, allocationId: formData.allocationId || undefined, updatedAt: now, _deleted: false }; 
          setExpenses(prev => [newItem, ...prev]); 
      } 
      setIsModalOpen(false); 
  };
  
  const handleDragStart = (e: React.DragEvent, id: string) => { setDraggedExpenseId(id); e.dataTransfer.effectAllowed = "link"; };
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDropOnPocket = (e: React.DragEvent, pocketId: string) => { 
      e.preventDefault(); 
      if (!draggedExpenseId) return; 
      const now = new Date().toISOString();
      setExpenses(prev => prev.map(exp => exp.id === draggedExpenseId ? { ...exp, allocationId: pocketId, updatedAt: now } : exp)); 
      setDraggedExpenseId(null); 
  };

  // BUG FIX: Force Number
  const getPocketStats = (pocketId: string, budget: number) => { 
      const used = activeExpenses.filter(e => e.allocationId === pocketId).reduce((acc, curr) => acc + Number(curr.amount || 0), 0); 
      return { used, remaining: budget - used, percent: Math.min(100, Math.round((used / budget) * 100)) }; 
  };
  
  const getSinkingFundStats = (fund: SinkingFund) => { 
      const used = activeExpenses.filter(e => e.allocationId === fund.id).reduce((acc, curr) => acc + Number(curr.amount || 0), 0); 
      return { used, remaining: Number(fund.currentAmount || 0) - used, percentUsed: fund.currentAmount > 0 ? Math.min(100, Math.round((used / fund.currentAmount) * 100)) : 0 }; 
  };
  
  const getCategoryColor = (cat: string) => { switch(cat) { case 'Food': return 'bg-orange-100 text-orange-700'; case 'Transport': return 'bg-blue-100 text-blue-700'; case 'Utilities': return 'bg-yellow-100 text-yellow-700'; case 'Shopping': return 'bg-pink-100 text-pink-700'; default: return 'bg-slate-100 text-slate-700'; } };
  
  // BUG FIX: Force Number
  const totalToday = (groupedExpenses[filterDate] || []).reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  
  const shiftWeek = (direction: 'prev' | 'next') => { const newStart = new Date(startDate); newStart.setDate(startDate.getDate() + (direction === 'next' ? 7 : -7)); setStartDate(newStart); };

  return (
    <div className="space-y-6 pb-20">
      
      {/* AI QUICK ADD BAR */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-4 rounded-2xl shadow-lg flex items-center gap-3">
          <div className="bg-white/10 p-2 rounded-lg"><Sparkles className="text-yellow-400" size={20}/></div>
          <form onSubmit={handleQuickAdd} className="flex-1 relative">
              <input 
                type="text" 
                className="w-full bg-slate-700/50 border border-slate-600 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder-slate-400"
                placeholder="Ketik cepat: 'Kopi Kenangan 20rb' atau 'Bensin 50rb'..."
                value={quickText}
                onChange={e => setQuickText(e.target.value)}
                disabled={isProcessingAI}
              />
              <button type="submit" disabled={isProcessingAI || !quickText} className="absolute right-2 top-2 text-slate-300 hover:text-white disabled:opacity-50">
                  {isProcessingAI ? <Loader2 size={18} className="animate-spin"/> : <Send size={18}/>}
              </button>
          </form>
          <button onClick={handleOpenAdd} className="bg-white text-slate-900 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-100 transition whitespace-nowrap flex items-center gap-2">
              <Plus size={16}/> Manual
          </button>
      </div>

      {anomaly && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3 animate-fade-in">
              <AlertTriangle className="text-amber-600 mt-0.5" size={20} />
              <div><h4 className="text-amber-800 font-bold text-sm">Smart Spend Alert</h4><p className="text-amber-700 text-xs mt-1">{anomaly.message}</p></div>
          </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <button onClick={() => shiftWeek('prev')} className="p-2 hover:bg-slate-100 rounded-full flex items-center gap-1 text-xs font-bold text-slate-600"><ChevronLeft size={16}/> Prev Week</button>
                    <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wider">{startDate.toLocaleDateString('id-ID', {month:'short', day:'numeric'})} - {daysGrid[13].toLocaleDateString('id-ID', {month:'short', day:'numeric', year:'numeric'})}</h3>
                    <button onClick={() => shiftWeek('next')} className="p-2 hover:bg-slate-100 rounded-full flex items-center gap-1 text-xs font-bold text-slate-600">Next Week <ChevronRight size={16}/></button>
                </div>
                <div className="grid grid-cols-7 gap-2">
                    {['Sn','Sl','Rb','Km','Jm','Sb','Mg'].map(d => <span key={d} className="text-[10px] font-bold text-slate-400 text-center uppercase mb-1">{d}</span>)}
                    {daysGrid.map((dateObj, idx) => {
                        const dateStr = dateObj.toISOString().split('T')[0];
                        const isSelected = dateStr === filterDate;
                        const isToday = new Date().toISOString().split('T')[0] === dateStr;
                        const dailyTotal = dailyTotals[dateStr] || 0;
                        const intensity = maxDailyTotal > 0 ? (dailyTotal / maxDailyTotal) : 0;
                        let intensityClass = 'bg-white';
                        if (dailyTotal > 0) {
                            if (intensity < 0.3) intensityClass = 'bg-green-50 border-green-200'; else if (intensity < 0.7) intensityClass = 'bg-yellow-50 border-yellow-200'; else intensityClass = 'bg-red-50 border-red-200';
                        }
                        return (
                            <button key={dateStr} onClick={() => setFilterDate(dateStr)} className={`h-20 rounded-xl border flex flex-col items-center justify-center p-1 transition relative hover:shadow-md ${isSelected ? 'ring-2 ring-brand-600 z-10 bg-white' : `border-slate-100 hover:border-brand-200 ${intensityClass}`}`}>
                                <span className={`text-xs font-bold mb-1 ${isToday ? 'text-white bg-brand-600 w-6 h-6 rounded-full flex items-center justify-center' : 'text-slate-700'}`}>{dateObj.getDate()}</span>
                                {dailyTotal > 0 && (<span className="text-[9px] font-bold text-slate-500 truncate w-full text-center">{formatCurrency(dailyTotal).replace('Rp', '').split(',')[0]}</span>)}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                 <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
                     <div><span className="text-xs text-slate-500 uppercase font-bold">{new Date(filterDate).toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric'})}</span><h3 className="text-xl font-bold text-slate-900">{formatCurrency(totalToday)}</h3></div>
                     {totalToday === 0 && <span className="text-sm text-slate-400">Tidak ada pengeluaran.</span>}
                 </div>
                 <div className="space-y-3">
                    {(groupedExpenses[filterDate] || []).map(item => (
                        <div key={item.id} draggable onDragStart={(e) => handleDragStart(e, item.id)} className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center justify-between cursor-grab active:cursor-grabbing group hover:bg-white hover:shadow-sm transition">
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500"><Tag size={14} /></div>
                                <div><h4 className="font-bold text-sm text-slate-800">{item.title}</h4><div className="flex items-center gap-2 mt-0.5"><span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${getCategoryColor(item.category)}`}>{item.category}</span>{item.allocationId && (<span className="flex items-center gap-1 text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded"><Target size={8} /> {allocations.find(a => a.id === item.allocationId)?.name || sinkingFunds.find(s => s.id === item.allocationId)?.name || 'Kantong'}</span>)}</div></div>
                            </div>
                            <div className="text-right flex items-center gap-3"><p className="font-bold text-slate-900 text-sm">{formatCurrency(item.amount)}</p><div className="flex gap-1 opacity-0 group-hover:opacity-100 transition"><button onClick={() => handleOpenEdit(item)} className="text-slate-400 hover:text-blue-600"><Edit2 size={14} /></button><button onClick={() => handleDelete(item.id)} className="text-slate-400 hover:text-red-600"><Trash2 size={14} /></button></div></div>
                        </div>
                    ))}
                 </div>
            </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm sticky top-4">
                <h3 className="font-bold text-slate-700 flex items-center gap-2 mb-4 text-sm uppercase tracking-wider"><Wallet size={16} /> Drag to Allocate</h3>
                <div className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto custom-scrollbar pr-2">
                    <div className="space-y-2"><p className="text-xs font-bold text-slate-400">Budget Bulanan</p>{activePockets.map(pocket => { const stats = getPocketStats(pocket.id, pocket.amount); return (<div key={pocket.id} onDragOver={handleDragOver} onDrop={(e) => handleDropOnPocket(e, pocket.id)} className="bg-slate-50 p-3 rounded-lg border border-slate-200 hover:border-brand-300 transition group"><div className="flex justify-between items-center mb-1"><h4 className="font-bold text-xs text-slate-800 truncate">{pocket.name}</h4><span className={`text-[10px] font-bold ${stats.remaining < 0 ? 'text-red-500' : 'text-slate-500'}`}>{formatCurrency(stats.remaining)}</span></div><div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden"><div className={`h-1.5 rounded-full ${stats.remaining < 0 ? 'bg-red-500' : 'bg-brand-500'} transition-all`} style={{width: `${Math.min(100, stats.percent)}%`}}></div></div></div>); })}</div>
                    <div className="space-y-2 pt-2 border-t border-slate-100"><p className="text-xs font-bold text-slate-400">Tabungan</p>{sinkingFunds.map(fund => { const stats = getSinkingFundStats(fund); return (<div key={fund.id} onDragOver={handleDragOver} onDrop={(e) => handleDropOnPocket(e, fund.id)} className="bg-blue-50 p-3 rounded-lg border border-blue-100 hover:border-blue-300 transition"><div className="flex justify-between items-center mb-1"><h4 className="font-bold text-xs text-slate-800 truncate">{fund.name}</h4><span className="text-[10px] font-bold text-blue-600">{formatCurrency(stats.remaining)}</span></div><div className="w-full bg-blue-200 rounded-full h-1.5 overflow-hidden"><div className="h-1.5 bg-blue-500 rounded-full transition-all" style={{width: `${Math.min(100, stats.percentUsed)}%`}}></div></div></div>); })}</div>
                </div>
            </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
           <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
              <h3 className="text-xl font-bold text-slate-900 mb-4">{editingId ? 'Edit Catatan' : 'Tambah Pengeluaran'}</h3>
              <form onSubmit={handleSave} className="space-y-4">
                 <div><label className="block text-sm font-medium text-slate-700 mb-1">Nama Item</label><input type="text" required className="w-full border border-slate-300 rounded-lg px-4 py-2" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} /></div>
                 <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Nominal (Rp)</label><input type="number" required className="w-full border border-slate-300 rounded-lg px-4 py-2" value={formData.amount} onChange={e => setFormData({...formData, amount: Number(e.target.value)})} /></div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Tanggal</label><input type="date" required className="w-full border border-slate-300 rounded-lg px-4 py-2" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} /></div>
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">Ambil dari Kantong</label>
                   <select className="w-full border border-slate-300 rounded-lg px-4 py-2 bg-white" value={formData.allocationId} onChange={e => setFormData({...formData, allocationId: e.target.value})}>
                      <option value="">-- Tidak Ada --</option>
                      <optgroup label="Budget Bulanan">{activePockets.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}</optgroup>
                      <optgroup label="Tabungan">{sinkingFunds.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}</optgroup>
                   </select>
                 </div>
                 <div className="pt-2 flex gap-3"><button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2 bg-white border rounded-lg">Batal</button><button type="submit" className="flex-1 py-2 bg-brand-600 text-white rounded-lg">Simpan</button></div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}
