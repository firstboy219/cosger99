import React, { useState, useMemo } from 'react';
import { IncomeItem } from '../types';
import { formatCurrency } from '../services/financeUtils';
import { Plus, Briefcase, Trash2, Edit2, X, TrendingUp, Loader2, Save, PieChart, Info, ShieldCheck, AlertCircle, Sparkles } from 'lucide-react';
import { pushPartialUpdate, deleteFromCloud } from '../services/cloudSync';
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface IncomeManagerProps {
  incomes: IncomeItem[]; 
  setIncomes: React.Dispatch<React.SetStateAction<IncomeItem[]>>;
  userId: string;
}

export default function IncomeManager({ incomes = [], setIncomes, userId }: IncomeManagerProps) {
  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showNet, setShowNet] = useState(false); // TAX TOGGLE
  const [formData, setFormData] = useState({ source: '', amount: 0, type: 'active', notes: '' });

  const activeIncomes = useMemo(() => incomes.filter(i => !i._deleted), [incomes]);
  const filteredIncomes = useMemo(() => activeIncomes.filter(i => i.dateReceived?.startsWith(currentMonthKey)), [activeIncomes, currentMonthKey]);
  
  // STATS
  const totalGross = filteredIncomes.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  const totalNet = totalGross * 0.95; // Simple 5% tax assumption for display
  const displayTotal = showNet ? totalNet : totalGross;

  // STABILITY SCORE
  const fixedCount = filteredIncomes.filter(i => i.type === 'active').length;
  const variableCount = filteredIncomes.length - fixedCount;
  const stabilityScore = totalGross > 0 ? (filteredIncomes.filter(i => i.type === 'active').reduce((a,b)=>a+b.amount,0) / totalGross) * 100 : 0;

  // CHART DATA
  const chartData = [
      { name: 'Active', value: filteredIncomes.filter(i => i.type === 'active').reduce((a,b)=>a+b.amount,0), color: '#3b82f6' },
      { name: 'Passive', value: filteredIncomes.filter(i => i.type === 'passive').reduce((a,b)=>a+b.amount,0), color: '#10b981' },
      { name: 'Bonus', value: filteredIncomes.filter(i => i.type === 'windfall').reduce((a,b)=>a+b.amount,0), color: '#f59e0b' }
  ].filter(d => d.value > 0);

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({ source: '', amount: 0, type: 'active', notes: '' });
    setIsModalOpen(true);
  };

  const handleEdit = (item: IncomeItem) => {
    setEditingId(item.id);
    setFormData({ source: item.source, amount: item.amount, type: item.type, notes: item.notes || '' });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); 
    if (!formData.source || formData.amount <= 0) return;
    setIsSaving(true);
    
    const now = new Date().toISOString();
    let finalItem: IncomeItem;

    if (editingId) {
        const existing = incomes.find(i => i.id === editingId);
        finalItem = { ...existing!, ...formData, amount: Number(formData.amount), updatedAt: now };
    } else {
        finalItem = {
            id: `inc-${Date.now()}`,
            userId,
            source: formData.source,
            amount: Number(formData.amount),
            type: formData.type as any,
            frequency: 'monthly',
            dateReceived: new Date().toISOString().split('T')[0],
            updatedAt: now,
            _deleted: false
        };
    }

    const success = await pushPartialUpdate(userId, { incomes: [finalItem] });
    
    if (success) {
        if (editingId) {
            setIncomes(prev => prev.map(inc => inc.id === editingId ? finalItem : inc));
        } else {
            setIncomes(prev => [finalItem, ...prev]);
        }
        setIsModalOpen(false);
    } else {
        alert("Gagal sinkronisasi data ke Cloud SQL.");
    }
    setIsSaving(false);
  };

  const handleDelete = async (id: string) => { 
      if (!confirm("Hapus pemasukan ini secara permanen dari Cloud?")) return;
      setIsSaving(true);
      const success = await deleteFromCloud(userId, 'incomes', id);
      if (success) {
          setIncomes(prev => prev.filter(i => i.id !== id));
      } else {
          alert("Gagal menghapus dari Cloud.");
      }
      setIsSaving(false);
  };

  return (
    <div className="space-y-8 pb-24 animate-fade-in">
      
      {/* HEADER WITH ANALYTICS */}
      <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden grid md:grid-cols-12 gap-8">
          <div className="absolute right-0 top-0 p-10 opacity-5"><TrendingUp size={200}/></div>
          
          {/* Main Total */}
          <div className="md:col-span-6 flex flex-col justify-center relative z-10">
              <div className="flex items-center gap-3 mb-2">
                  <p className="text-brand-400 text-[10px] font-black uppercase tracking-[0.3em]">Total Pendapatan</p>
                  <button onClick={() => setShowNet(!showNet)} className="bg-white/10 px-2 py-0.5 rounded text-[9px] font-bold uppercase hover:bg-white/20 transition">
                      {showNet ? 'Net (Est. Tax 5%)' : 'Gross (Kotor)'}
                  </button>
              </div>
              <h2 className="text-5xl font-black tracking-tighter mb-6">{formatCurrency(displayTotal)}</h2>
              
              <button onClick={handleOpenAdd} className="w-fit bg-white text-slate-900 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-brand-50 transition shadow-xl transform active:scale-95 flex items-center gap-2">
                <Plus size={16}/> Tambah Sumber
              </button>
          </div>

          {/* Stability Score */}
          <div className="md:col-span-3 bg-white/5 rounded-3xl p-6 border border-white/10 relative z-10">
              <div className="flex items-center gap-2 mb-4">
                  <ShieldCheck size={18} className="text-brand-400"/>
                  <span className="text-xs font-bold uppercase tracking-wider">Stability Score</span>
              </div>
              <div className="flex items-end gap-2 mb-2">
                  <span className={`text-4xl font-black ${stabilityScore > 70 ? 'text-green-400' : 'text-yellow-400'}`}>{Math.round(stabilityScore)}</span>
                  <span className="text-sm font-bold text-slate-400 mb-1">/100</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-1000 ${stabilityScore > 70 ? 'bg-green-500' : 'bg-yellow-500'}`} style={{width: `${stabilityScore}%`}}></div>
              </div>
              <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                  {stabilityScore > 70 ? "Pendapatan stabil. Didominasi gaji tetap." : "Fluktuatif. Banyak income variabel."}
              </p>
          </div>

          {/* Composition Chart */}
          <div className="md:col-span-3 bg-white/5 rounded-3xl p-6 border border-white/10 relative z-10 flex flex-col items-center justify-center">
              <div className="h-24 w-24">
                  <ResponsiveContainer width="100%" height="100%">
                      <RePieChart>
                          <Pie data={chartData} innerRadius={30} outerRadius={40} paddingAngle={5} dataKey="value">
                              {chartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                              ))}
                          </Pie>
                          <Tooltip />
                      </RePieChart>
                  </ResponsiveContainer>
              </div>
              <div className="flex gap-3 mt-2">
                  <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div><span className="text-[9px] font-bold">Active</span></div>
                  <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div><span className="text-[9px] font-bold">Passive</span></div>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredIncomes.length === 0 ? (
              <div className="col-span-full py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-slate-400">
                  <Briefcase size={64} className="opacity-10 mb-4"/>
                  <p className="font-bold">Belum ada pemasukan yang tercatat di sistem.</p>
              </div>
          ) : filteredIncomes.map(item => (
              <div key={item.id} className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
                  <div className="flex justify-between items-start mb-6">
                      <div className={`p-4 rounded-2xl ${item.type === 'active' ? 'bg-blue-50 text-blue-600' : item.type === 'passive' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>
                          {item.type === 'active' ? <Briefcase size={24}/> : item.type === 'passive' ? <TrendingUp size={24}/> : <Sparkles size={24}/>}
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={() => handleEdit(item)} className="p-2.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-all"><Edit2 size={16}/></button>
                          <button onClick={() => handleDelete(item.id)} className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={16}/></button>
                      </div>
                  </div>
                  <h4 className="font-black text-slate-900 text-lg leading-tight mb-1">{item.source}</h4>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1">
                      {item.type} {item.type === 'passive' && <span className="text-green-500 ml-1">(Good!)</span>}
                  </p>
                  <p className="text-2xl font-black text-brand-600 tracking-tighter">{formatCurrency(item.amount)}</p>
              </div>
          ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4 animate-fade-in">
           <div className="bg-white rounded-[3rem] w-full max-w-md p-10 shadow-2xl border border-white/20">
              <div className="flex justify-between items-center mb-10">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tighter">{editingId ? 'Edit Pendapatan' : 'Sumber Baru'}</h3>
                  <button onClick={()=>setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><X size={28}/></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-1">Deskripsi Sumber</label>
                      <input type="text" required className="w-full border-2 border-slate-100 p-4 rounded-2xl focus:border-brand-500 outline-none font-bold" value={formData.source} onChange={e => setFormData({...formData, source: e.target.value})} placeholder="Misal: Gaji Utama" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-1">Nominal (IDR)</label>
                          <input type="number" required className="w-full border-2 border-slate-100 p-4 rounded-2xl focus:border-brand-500 outline-none font-black" value={formData.amount} onChange={e => setFormData({...formData, amount: Number(e.target.value)})} />
                      </div>
                      <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-1">Kategori</label>
                          <select className="w-full border-2 border-slate-100 p-4 rounded-2xl focus:border-brand-500 outline-none font-bold bg-white" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                              <option value="active">Active (Kerja)</option>
                              <option value="passive">Passive (Invest)</option>
                              <option value="windfall">Bonus/THR</option>
                          </select>
                      </div>
                  </div>
                  <div className="pt-6 flex gap-3">
                      <button type="button" onClick={()=>setIsModalOpen(false)} className="flex-1 py-4 border-2 border-slate-100 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-500 hover:bg-slate-50">Batal</button>
                      <button type="submit" disabled={isSaving} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 shadow-xl flex items-center justify-center gap-2">
                          {isSaving ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>}
                          Simpan & Sync
                      </button>
                  </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}