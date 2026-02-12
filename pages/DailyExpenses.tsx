
import React, { useState, useMemo } from 'react';
import { DailyExpense, ExpenseItem } from '../types';
import { formatCurrency, safeDateISO } from '../services/financeUtils';
import { parseTransactionAI } from '../services/geminiService';
import { pushPartialUpdate, deleteFromCloud } from '../services/cloudSync';
import { Plus, Tag, Trash2, Edit2, X, Sparkles, Send, Loader2, ChevronLeft, ChevronRight, Receipt } from 'lucide-react';

interface DailyExpensesProps {
  expenses: DailyExpense[];
  setExpenses: React.Dispatch<React.SetStateAction<DailyExpense[]>>;
  allocations: ExpenseItem[]; 
  userId: string;
}

export default function DailyExpenses({ expenses = [], setExpenses, allocations = [], userId }: DailyExpensesProps) {
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState(new Date());
  const [quickText, setQuickText] = useState('');
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ title: '', amount: 0, category: 'Others' as any, date: filterDate, notes: '' });

  const handleQuickAdd = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!quickText.trim()) return;
      setIsProcessingAI(true);
      try {
          const result = await parseTransactionAI(quickText);
          if (result.intent === 'ADD_DAILY_EXPENSE' || result.intent === 'ADD_EXPENSE') {
              const newItem: DailyExpense = {
                  id: `exp-${Date.now()}`,
                  userId: userId,
                  title: result.data.title || 'Pengeluaran AI',
                  amount: Number(result.data.amount) || 0, 
                  category: (result.data.category as any) || 'Others',
                  date: filterDate, 
                  updatedAt: new Date().toISOString(),
                  _deleted: false
              };
              setExpenses(prev => [newItem, ...prev]);
              await pushPartialUpdate(userId, { dailyExpenses: [newItem] });
          }
      } catch (e) {
          alert("Gagal memproses via AI.");
      } finally {
          setIsProcessingAI(false);
          setQuickText('');
      }
  };

  const handleEdit = (item: DailyExpense) => {
      setEditingId(item.id);
      setFormData({ 
          title: item.title, 
          amount: item.amount, 
          category: item.category, 
          date: item.date, 
          notes: item.notes || '' 
      });
      setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.title || formData.amount <= 0) return;
      
      let finalItem: DailyExpense;
      if (editingId) {
          const existing = expenses.find(e => e.id === editingId);
          finalItem = { ...existing!, ...formData, amount: Number(formData.amount), updatedAt: new Date().toISOString() };
      } else {
          finalItem = { 
              id: `exp-${Date.now()}`, 
              userId, 
              ...formData, 
              amount: Number(formData.amount), 
              updatedAt: new Date().toISOString(), 
              _deleted: false 
          };
      }

      const success = await pushPartialUpdate(userId, { dailyExpenses: [finalItem] });
      if (success) {
          if (editingId) setExpenses(prev => prev.map(e => e.id === editingId ? finalItem : e));
          else setExpenses(prev => [finalItem, ...prev]);
          setIsModalOpen(false);
          setEditingId(null);
      } else {
          alert("Gagal sinkronisasi ke Cloud.");
      }
  };

  const handleDelete = async (id: string) => {
      if (!confirm("Hapus catatan ini selamanya dari Cloud?")) return;
      const success = await deleteFromCloud(userId, 'dailyExpenses', id);
      if (success) {
          setExpenses(prev => prev.filter(e => e.id !== id));
      } else {
          alert("Gagal menghapus dari server.");
      }
  };

  const shiftWeek = (dir: 'prev' | 'next') => { 
      const d = new Date(startDate); 
      d.setDate(startDate.getDate() + (dir === 'next' ? 7 : -7)); 
      setStartDate(d); 
  };

  const grouped = expenses.filter(e => !e._deleted).reduce((g, e) => { 
      const d = safeDateISO(e.date); 
      if(!g[d]) g[d] = []; 
      g[d].push(e); 
      return g; 
  }, {} as Record<string, DailyExpense[]>);

  const totalToday = (grouped[filterDate] || []).reduce((a, c) => a + Number(c.amount || 0), 0);

  return (
    <div className="space-y-8 pb-20 animate-fade-in">
      <div className="bg-slate-900 p-6 rounded-[2.5rem] shadow-2xl flex flex-col md:flex-row items-center gap-4 border border-slate-800">
          <div className="bg-white/10 p-3 rounded-2xl"><Sparkles className="text-yellow-400" size={24}/></div>
          <form onSubmit={handleQuickAdd} className="flex-1 relative w-full">
              <input 
                type="text" 
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-2xl px-6 py-3.5 text-sm focus:ring-2 focus:ring-brand-500 outline-none" 
                placeholder="AI Quick Log: 'Makan bakso 25rb'..." 
                value={quickText} 
                onChange={e => setQuickText(e.target.value)} 
                disabled={isProcessingAI} 
              />
              <button type="submit" className="absolute right-4 top-3.5 text-slate-400 hover:text-white transition-colors">
                  {isProcessingAI ? <Loader2 size={20} className="animate-spin"/> : <Send size={20}/>}
              </button>
          </form>
          <button onClick={() => { setEditingId(null); setIsModalOpen(true); }} className="bg-white text-slate-900 px-8 py-3.5 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-brand-50 transition shadow-xl transform active:scale-95 flex items-center gap-2">
              <Plus size={18}/> Manual Log
          </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-6">
              <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
                  <div className="flex justify-between items-center mb-8">
                      <button onClick={()=>shiftWeek('prev')} className="p-2 rounded-xl hover:bg-slate-50 transition"><ChevronLeft/></button>
                      <h3 className="font-black text-[10px] uppercase tracking-[0.3em] text-slate-400">Expense Calendar</h3>
                      <button onClick={()=>shiftWeek('next')} className="p-2 rounded-xl hover:bg-slate-50 transition"><ChevronRight/></button>
                  </div>
                  <div className="grid grid-cols-7 gap-3">
                    {Array.from({length: 7}).map((_, i) => {
                        const d = new Date(startDate); d.setDate(startDate.getDate() + i);
                        const ds = d.toISOString().split('T')[0];
                        const sel = ds === filterDate;
                        return (
                            <button key={ds} onClick={()=>setFilterDate(ds)} className={`h-24 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all ${sel ? 'border-brand-500 bg-brand-50 shadow-lg' : 'border-slate-50 hover:border-slate-100'}`}>
                                <span className={`text-lg font-black ${sel ? 'text-brand-700' : 'text-slate-400'}`}>{d.getDate()}</span>
                                <span className={`text-[10px] uppercase font-black tracking-widest ${sel ? 'text-brand-600/60' : 'text-slate-300'}`}>{d.toLocaleDateString('id-ID', {weekday:'short'})}</span>
                            </button>
                        );
                    })}
                  </div>
              </div>
              
              <div className="bg-white rounded-[2.5rem] border p-8 shadow-sm min-h-[400px]">
                  <div className="flex justify-between items-center border-b pb-6 mb-8">
                      <div>
                        <h3 className="text-xl font-black text-slate-900">{new Date(filterDate).toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'})}</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Daftar Jajan</p>
                      </div>
                      <span className="text-3xl font-black text-brand-600 tracking-tighter">{formatCurrency(totalToday)}</span>
                  </div>
                  <div className="space-y-4">
                      {(grouped[filterDate] || []).length === 0 ? (
                          <div className="text-center py-20 text-slate-400 flex flex-col items-center">
                              <Receipt size={48} className="opacity-10 mb-4" />
                              <p className="font-bold text-sm">Belum ada catatan jajan hari ini.</p>
                          </div>
                      ) : (grouped[filterDate] || []).map(item => (
                          <div key={item.id} className="bg-slate-50/50 p-5 rounded-3xl flex justify-between items-center group border border-transparent hover:border-brand-100 hover:bg-white transition-all">
                              <div className="flex items-center gap-5">
                                  <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100"><Tag size={20} className="text-slate-400"/></div>
                                  <div>
                                    <h4 className="font-black text-slate-900">{item.title}</h4>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">{item.category}</p>
                                  </div>
                              </div>
                              <div className="flex items-center gap-6">
                                  <span className="font-black text-slate-900 text-lg">{formatCurrency(item.amount)}</span>
                                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                      <button onClick={()=>handleEdit(item)} className="p-2.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-all"><Edit2 size={18}/></button>
                                      <button onClick={()=>handleDelete(item.id)} className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18}/></button>
                                  </div>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
          
          <div className="lg:col-span-4">
              <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden">
                  <h3 className="font-black text-[10px] uppercase tracking-[0.3em] text-slate-500 mb-8">Statistik Pengeluaran</h3>
                  <div className="space-y-6">
                      <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Rata-rata Harian</span>
                          <span className="text-xl font-black text-white">{formatCurrency(expenses.reduce((a,b)=>a+b.amount,0) / (expenses.length || 1))}</span>
                      </div>
                      <div className="h-px bg-slate-800"></div>
                      <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Akumulasi</span>
                          <span className="text-3xl font-black text-brand-400 tracking-tighter">{formatCurrency(expenses.reduce((a,b)=>a+b.amount,0))}</span>
                      </div>
                  </div>
              </div>
          </div>
      </div>

      {isModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white rounded-[3rem] w-full max-w-md p-10 shadow-2xl border border-white/20">
                  <div className="flex justify-between items-center mb-10">
                      <h3 className="text-2xl font-black text-slate-900 tracking-tighter">{editingId ? 'Edit Catatan' : 'Catat Baru'}</h3>
                      <button onClick={()=>setIsModalOpen(false)} className="p-3 hover:bg-slate-50 rounded-full transition-colors text-slate-400 hover:text-slate-600"><X size={28}/></button>
                  </div>
                  <form onSubmit={handleSave} className="space-y-8">
                      <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-1 tracking-widest">Deskripsi Jajan</label>
                          <input type="text" className="w-full border-2 border-slate-100 p-4 rounded-2xl focus:border-brand-500 outline-none font-bold transition-all" value={formData.title} onChange={e=>setFormData({...formData, title: e.target.value})} required />
                      </div>
                      <div className="grid grid-cols-2 gap-5">
                          <div>
                              <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-1 tracking-widest">Nominal (IDR)</label>
                              <input type="number" className="w-full border-2 border-slate-100 p-4 rounded-2xl focus:border-brand-500 outline-none font-black transition-all" value={formData.amount} onChange={e=>setFormData({...formData, amount: Number(e.target.value)})} required />
                          </div>
                          <div>
                              <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-1 tracking-widest">Kategori</label>
                              <select className="w-full border-2 border-slate-100 p-4 rounded-2xl focus:border-brand-500 outline-none font-black bg-white transition-all" value={formData.category} onChange={e=>setFormData({...formData, category: e.target.value as any})}>
                                  <option value="Food">Makanan</option>
                                  <option value="Transport">Transport</option>
                                  <option value="Shopping">Belanja</option>
                                  <option value="Utilities">Tagihan</option>
                                  <option value="Entertainment">Hiburan</option>
                                  <option value="Others">Lainnya</option>
                              </select>
                          </div>
                      </div>
                      <div className="pt-6 flex gap-4">
                          <button type="button" onClick={()=>setIsModalOpen(false)} className="flex-1 py-4 border-2 border-slate-100 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all transform active:scale-95">Batal</button>
                          <button type="submit" className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-xl transform active:scale-95">Simpan & Sync</button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
}
