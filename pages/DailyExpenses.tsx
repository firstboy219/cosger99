
import React, { useState, useEffect } from 'react';
import { DailyExpense, ExpenseItem, SinkingFund } from '../types';
import { formatCurrency, detectSpendingAnomaly, safeDateISO } from '../services/financeUtils';
import { parseTransactionAI } from '../services/geminiService';
import { getUserData, saveUserData } from '../services/mockDb';
import { pushPartialUpdate, deleteFromCloud } from '../services/cloudSync';
import { Plus, Tag, Trash2, Edit2, X, AlertTriangle, Sparkles, Send, Loader2, ChevronLeft, ChevronRight, Wallet, Target, Receipt } from 'lucide-react';

interface DailyExpensesProps {
  expenses: DailyExpense[];
  setExpenses: React.Dispatch<React.SetStateAction<DailyExpense[]>>;
  allocations: ExpenseItem[]; 
  userId: string;
}

export default function DailyExpenses({ expenses, setExpenses, allocations, userId }: DailyExpensesProps) {
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState(new Date());
  const [sinkingFunds, setSinkingFunds] = useState<SinkingFund[]>([]);
  const [quickText, setQuickText] = useState('');
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ title: '', amount: 0, category: 'Food', date: filterDate, notes: '', allocationId: '' });

  useEffect(() => {
      const data = getUserData(userId);
      setSinkingFunds(data.sinkingFunds || []);
      const now = new Date();
      const diff = now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1); 
      setStartDate(new Date(now.setDate(diff)));
  }, [userId]);

  const activeExpenses = expenses.filter(e => !e._deleted);

  const handleQuickAdd = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!quickText.trim()) return;
      setIsProcessingAI(true);
      const result = await parseTransactionAI(quickText);
      setIsProcessingAI(false);
      setQuickText('');

      if (result.intent === 'ADD_DAILY_EXPENSE' && result.data) {
          const newItem: DailyExpense = {
              id: `exp-${Date.now()}`,
              userId: userId,
              title: result.data.title || 'Pengeluaran',
              amount: Number(result.data.amount) || 0, 
              category: (result.data.category as any) || 'Others',
              date: filterDate, 
              updatedAt: new Date().toISOString(),
              _deleted: false
          };
          setExpenses(prev => [newItem, ...prev]);
          saveUserData(userId, { dailyExpenses: [newItem, ...expenses] });
          // GRANULAR SYNC
          pushPartialUpdate(userId, { dailyExpenses: [newItem] });
      }
  };

  const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.title || formData.amount <= 0) return;
      const now = new Date().toISOString();

      let finalItem: DailyExpense;
      if (editingId) {
          finalItem = { ...expenses.find(e => e.id === editingId)!, ...formData, amount: Number(formData.amount), updatedAt: now };
          setExpenses(prev => prev.map(e => e.id === editingId ? finalItem : e));
      } else {
          finalItem = { id: `exp-${Date.now()}`, userId, ...formData, amount: Number(formData.amount), updatedAt: now, _deleted: false };
          setExpenses(prev => [finalItem, ...prev]);
      }

      saveUserData(userId, { dailyExpenses: editingId ? expenses.map(e => e.id === editingId ? finalItem : e) : [finalItem, ...expenses] });
      // GRANULAR SYNC
      pushPartialUpdate(userId, { dailyExpenses: [finalItem] });
      setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
      if (!confirm("Hapus catatan ini selamanya dari cloud?")) return;
      
      // GRANULAR CLOUD DELETE
      const success = await deleteFromCloud(userId, 'dailyExpenses', id);
      if (success) {
          setExpenses(prev => prev.filter(e => e.id !== id));
          const current = getUserData(userId);
          saveUserData(userId, { dailyExpenses: current.dailyExpenses.filter(e => e.id !== id) });
      } else {
          alert("Gagal menghapus di server. Pastikan koneksi stabil.");
      }
  };

  const shiftWeek = (dir: 'prev' | 'next') => { const d = new Date(startDate); d.setDate(startDate.getDate() + (dir === 'next' ? 7 : -7)); setStartDate(d); };
  const grouped = activeExpenses.reduce((g, e) => { const d = safeDateISO(e.date); if(!g[d]) g[d] = []; g[d].push(e); return g; }, {} as Record<string, DailyExpense[]>);
  const totalToday = (grouped[filterDate] || []).reduce((a, c) => a + Number(c.amount || 0), 0);

  return (
    <div className="space-y-6 pb-20">
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-4 rounded-2xl shadow-lg flex items-center gap-3">
          <div className="bg-white/10 p-2 rounded-lg"><Sparkles className="text-yellow-400" size={20}/></div>
          <form onSubmit={handleQuickAdd} className="flex-1 relative">
              <input type="text" className="w-full bg-slate-700/50 border border-slate-600 text-white rounded-xl px-4 py-2.5 text-sm outline-none placeholder-slate-400" placeholder="Ketik cepat: 'Makan siang 50rb'..." value={quickText} onChange={e => setQuickText(e.target.value)} disabled={isProcessingAI} />
              <button type="submit" className="absolute right-2 top-2 text-slate-300">{isProcessingAI ? <Loader2 size={18} className="animate-spin"/> : <Send size={18}/>}</button>
          </form>
          <button onClick={() => { setEditingId(null); setIsModalOpen(true); }} className="bg-white text-slate-900 px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2"><Plus size={16}/> Manual</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
              <div className="bg-white p-6 rounded-2xl border shadow-sm">
                  <div className="flex justify-between mb-4">
                      <button onClick={()=>shiftWeek('prev')} className="flex items-center text-xs font-bold"><ChevronLeft size={16}/> Prev</button>
                      <h3 className="font-bold text-sm uppercase tracking-wider">Timeline</h3>
                      <button onClick={()=>shiftWeek('next')} className="flex items-center text-xs font-bold">Next <ChevronRight size={16}/></button>
                  </div>
                  <div className="grid grid-cols-7 gap-2">
                    {Array.from({length: 14}).map((_, i) => {
                        const d = new Date(startDate); d.setDate(startDate.getDate() + i);
                        const ds = d.toISOString().split('T')[0];
                        const sel = ds === filterDate;
                        return (
                            <button key={ds} onClick={()=>setFilterDate(ds)} className={`h-16 rounded-lg border flex flex-col items-center justify-center p-1 transition ${sel ? 'ring-2 ring-brand-600 bg-white' : 'border-slate-100'}`}>
                                <span className="text-[10px] font-bold">{d.getDate()}</span>
                                <span className="text-[8px] opacity-50 uppercase">{d.toLocaleDateString('id-ID', {weekday:'short'})}</span>
                            </button>
                        );
                    })}
                  </div>
              </div>
              <div className="bg-white rounded-xl border p-4 shadow-sm">
                  <h3 className="font-bold text-slate-900 border-b pb-2 mb-4">{new Date(filterDate).toLocaleDateString('id-ID', {day:'numeric', month:'long'})} - {formatCurrency(totalToday)}</h3>
                  <div className="space-y-2">
                      {(grouped[filterDate] || []).map(item => (
                          <div key={item.id} className="bg-slate-50 p-3 rounded-lg flex justify-between items-center group">
                              <div><h4 className="font-bold text-sm">{item.title}</h4><p className="text-[10px] text-slate-400 capitalize">{item.category}</p></div>
                              <div className="flex items-center gap-3"><span className="font-bold text-sm">{formatCurrency(item.amount)}</span><button onClick={()=>handleDelete(item.id)} className="text-red-400 opacity-0 group-hover:opacity-100 transition"><Trash2 size={14}/></button></div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      </div>

      {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
                  <h3 className="text-xl font-bold mb-4">Catat Pengeluaran</h3>
                  <form onSubmit={handleSave} className="space-y-4">
                      <input type="text" className="w-full border p-2 rounded-lg" placeholder="Nama Barang" value={formData.title} onChange={e=>setFormData({...formData, title: e.target.value})} required />
                      <input type="number" className="w-full border p-2 rounded-lg" placeholder="Nominal" value={formData.amount} onChange={e=>setFormData({...formData, amount: Number(e.target.value)})} required />
                      <div className="flex gap-2"><button type="button" onClick={()=>setIsModalOpen(false)} className="flex-1 py-2 border rounded-lg">Batal</button><button type="submit" className="flex-1 py-2 bg-slate-900 text-white rounded-lg">Simpan ke Cloud</button></div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
}
