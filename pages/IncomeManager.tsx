
import React, { useState, useMemo, useEffect } from 'react';
import { IncomeItem } from '../types';
import { formatCurrency, safeDateISO } from '../services/financeUtils';
import { Plus, Briefcase, Gift, DollarSign, Trash2, Calendar, Edit2, ChevronLeft, ChevronRight, Copy, Zap, Sparkles, X, BrainCircuit, Repeat, BarChart3, Wallet, PieChart, TrendingDown, TrendingUp, CloudLightning, Loader2, Calculator } from 'lucide-react';
import { ResponsiveContainer, PieChart as RePie, Pie, Cell, Tooltip } from 'recharts';
import { getUserData, saveUserData, getConfig } from '../services/mockDb';

interface IncomeManagerProps {
  incomes: IncomeItem[]; 
  setIncomes: React.Dispatch<React.SetStateAction<IncomeItem[]>>;
  userId: string;
}

export default function IncomeManager({ incomes, setIncomes, userId }: IncomeManagerProps) {
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const currentMonthKey = currentDate.toISOString().slice(0, 7);
  const currentMonthLabel = currentDate.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
  const currentYear = currentDate.getFullYear();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [originalSource, setOriginalSource] = useState(''); 
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [showEstimator, setShowEstimator] = useState(false);
  const [estimateInputs, setEstimateInputs] = useState({ m1: 0, m2: 0, m3: 0 });

  const initialFormState = { source: '', amount: 0, type: 'active', frequency: 'monthly', dateReceived: new Date(currentDate).toISOString().split('T')[0], notes: '' };
  const [formData, setFormData] = useState<any>(initialFormState);

  // V44.5 Filter soft deleted items
  const activeIncomes = useMemo(() => incomes.filter(i => !i._deleted), [incomes]);
  const filteredIncomes = useMemo(() => activeIncomes.filter(i => i.dateReceived?.startsWith(currentMonthKey)), [activeIncomes, currentMonthKey]);
  
  // BUG FIX: Force Number casting
  const getMonthTotal = (monthIndex: number) => { 
      const year = currentDate.getFullYear(); 
      const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`; 
      return activeIncomes.filter(i => i.dateReceived?.startsWith(monthKey)).reduce((acc, curr) => acc + Number(curr.amount || 0), 0); 
  };

  const handleOpenAdd = () => { setEditingId(null); setOriginalSource(''); setFormData({ ...initialFormState, dateReceived: new Date().toISOString().split('T')[0] }); setIsModalOpen(true); };
  
  const handleOpenEdit = (item: IncomeItem) => { 
      setEditingId(item.id); 
      setOriginalSource(item.source); 
      setFormData({ 
          ...item,
          dateReceived: safeDateISO(item.dateReceived)
      }); 
      setIsModalOpen(true); 
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault(); 
    setIsSaving(true);
    
    // DIRECT STATE UPDATE (Synchronous) to trigger App.tsx effect immediately
    let newIncomes = [...incomes];
    const baseDate = new Date(formData.dateReceived);
    const now = new Date().toISOString();
    
    if (editingId) {
        newIncomes = newIncomes.map(inc => {
            const incDate = new Date(inc.dateReceived || '');
            if (inc.id === editingId || (inc.source === originalSource && incDate >= baseDate && (inc.type === 'active' || inc.type === 'passive'))) {
                return {
                    ...inc,
                    source: formData.source,
                    amount: Number(formData.amount),
                    type: formData.type,
                    frequency: formData.frequency,
                    dateReceived: inc.id === editingId ? formData.dateReceived : inc.dateReceived,
                    notes: formData.notes,
                    updatedAt: now // Stamp update
                };
            }
            return inc;
        });
    } else {
        const repeat = (formData.type === 'active' || formData.type === 'passive') ? 120 : 1;
        for (let i = 0; i < repeat; i++) {
            const nextDate = new Date(baseDate); 
            nextDate.setMonth(baseDate.getMonth() + i);
            newIncomes.push({
                id: `inc-${Date.now()}-${i}-${Math.random().toString(36).substr(2,5)}`, 
                userId, 
                source: formData.source || 'Unknown', 
                amount: Number(formData.amount) || 0, 
                type: formData.type, 
                frequency: formData.frequency, 
                dateReceived: nextDate.toISOString().split('T')[0], 
                notes: formData.notes,
                updatedAt: now,
                _deleted: false
            });
        }
    }

    const currentData = getUserData(userId);
    saveUserData(userId, { ...currentData, incomes: newIncomes });
    setIncomes(newIncomes);
    
    setIsSaving(false);
    setIsModalOpen(false);
  };

  // V44.5 SAFE MODE DELETE
  const handleDelete = async (id: string, source: string, dateStr: string) => { 
      if (window.confirm(`Hapus "${source}"? \n\nSemua pendapatan rutin "${source}" dari bulan ini ke depan akan ditandai hapus.`)) { 
          setIsDeleting(true);
          const targetDate = new Date(dateStr);
          const now = new Date().toISOString();
          
          // Soft delete logic: Update existing items instead of filtering
          const newIncomes = incomes.map(inc => {
              const incDate = new Date(inc.dateReceived || '');
              const shouldDelete = (inc.id === id) || (inc.source === source && incDate >= targetDate);
              
              if (shouldDelete) {
                  return { ...inc, _deleted: true, updatedAt: now };
              }
              return inc;
          });

          const currentData = getUserData(userId);
          saveUserData(userId, { ...currentData, incomes: newIncomes });
          setIncomes(newIncomes);
          setIsDeleting(false);
      } 
  };

  const handleYearChange = (diff: number) => { const newDate = new Date(currentDate); newDate.setFullYear(newDate.getFullYear() + diff); setCurrentDate(newDate); };
  const handleMonthSelect = (monthIndex: number) => { const newDate = new Date(currentDate); newDate.setMonth(monthIndex); setCurrentDate(newDate); };

  const applyEstimate = () => {
      const avg = Math.round((estimateInputs.m1 + estimateInputs.m2 + estimateInputs.m3) / 3);
      setFormData({ ...formData, amount: avg, notes: 'Estimated Average Income' });
      setShowEstimator(false);
  };

  // BUG FIX: Force Number casting
  const totalIncome = filteredIncomes.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  
  const chartData = [ 
      { name: 'Active', value: filteredIncomes.filter(i => i.type === 'active').reduce((a, b) => a + Number(b.amount || 0), 0), color: '#3b82f6' }, 
      { name: 'Passive', value: filteredIncomes.filter(i => i.type === 'passive').reduce((a, b) => a + Number(b.amount || 0), 0), color: '#22c55e' }, 
      { name: 'Windfall', value: filteredIncomes.filter(i => i.type === 'windfall').reduce((a, b) => a + Number(b.amount || 0), 0), color: '#a855f7' } 
  ].filter(d => d.value > 0);
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  return (
    <div className="space-y-8 pb-10">
      
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6 relative">
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
              <div><h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Calendar className="text-brand-600" size={20} /> Peta Pemasukan</h2><p className="text-slate-500 text-xs mt-1">Pilih bulan untuk melihat detail.</p></div>
              <div className="flex items-center bg-slate-50 rounded-xl p-1 border border-slate-200"><button onClick={() => handleYearChange(-1)} className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-slate-500 transition"><ChevronLeft size={16}/></button><span className="font-bold text-slate-900 w-20 text-center text-sm">{currentYear}</span><button onClick={() => handleYearChange(1)} className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-slate-500 transition"><ChevronRight size={16}/></button></div>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">{months.map((m, idx) => { const isActive = idx === currentDate.getMonth(); const monthTotal = getMonthTotal(idx); return (<button key={m} onClick={() => handleMonthSelect(idx)} className={`relative py-3 px-2 rounded-2xl border transition-all duration-300 flex flex-col items-center gap-1 ${isActive ? 'bg-slate-900 border-slate-900 text-white shadow-lg transform scale-[1.03]' : 'bg-white border-slate-100 text-slate-500 hover:border-brand-200 hover:bg-brand-50/50'}`}><span className={`text-xs font-bold uppercase tracking-wider ${isActive ? 'text-slate-200' : 'text-slate-400'}`}>{m}</span><div className="h-5 flex items-center justify-center">{monthTotal > 0 ? (<span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700'}`}>{formatCurrency(monthTotal).replace('Rp', '').replace(',00', '').replace(/\./g, '').replace(/000000$/, 'jt').replace(/000$/, 'rb')}</span>) : (<div className={`w-1 h-1 rounded-full ${isActive ? 'bg-slate-600' : 'bg-slate-200'}`}></div>)}</div></button>); })}</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-gradient-to-br from-indigo-900 to-slate-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl flex flex-col justify-between">
              <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none"><Wallet size={200} /></div>
              <div className="relative z-10"><div className="flex items-center gap-2 mb-2"><div className="p-1.5 bg-white/10 rounded-lg backdrop-blur-sm"><BarChart3 size={16} className="text-indigo-300"/></div><span className="text-indigo-200 text-sm font-medium uppercase tracking-wider">{currentMonthLabel}</span></div><h2 className="text-4xl md:text-5xl font-black tracking-tight mt-2">{formatCurrency(totalIncome)}</h2><p className="text-indigo-200 text-sm mt-2">Total cash in bersih bulan ini.</p></div>
              <div className="mt-8 flex gap-3 flex-wrap relative z-10"><button onClick={handleOpenAdd} className="bg-white text-indigo-900 px-5 py-3 rounded-xl font-bold text-sm hover:bg-indigo-50 transition shadow-lg flex items-center gap-2 group"><div className="bg-indigo-100 p-1 rounded-full group-hover:bg-indigo-200 transition"><Plus size={14}/></div>Catat Income</button></div>
          </div>
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col items-center justify-center relative">
              <h3 className="font-bold text-slate-700 mb-4 text-sm uppercase flex items-center gap-2"><PieChart size={16} className="text-slate-400"/> Komposisi</h3>
              {chartData.length > 0 ? (<div className="h-40 w-full relative z-10"><ResponsiveContainer width="100%" height="100%"><RePie><Pie data={chartData} innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value">{chartData.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie><Tooltip formatter={(v:any)=>formatCurrency(v)} contentStyle={{borderRadius: '12px', border:'none', boxShadow:'0 4px 12px rgba(0,0,0,0.1)'}}/></RePie></ResponsiveContainer></div>) : (<div className="text-slate-400 text-xs py-10 text-center flex flex-col items-center">Belum ada data visual.</div>)}
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredIncomes.length === 0 ? (
              <div className="col-span-full py-16 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50"><div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300 shadow-sm"><DollarSign size={32} /></div><p className="text-slate-600 font-bold">Dompet Kosong?</p><button onClick={handleOpenAdd} className="text-brand-600 font-bold text-sm hover:underline">+ Tambah Pemasukan Sekarang</button></div>
          ) : (
              filteredIncomes.map(item => (
                  <div key={item.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition group relative overflow-hidden">
                      <div className="relative z-10 flex justify-between items-start"><div className={`p-3 rounded-xl ${item.type === 'active' ? 'bg-blue-50 text-blue-600' : item.type === 'passive' ? 'bg-green-50 text-green-600' : 'bg-purple-50 text-purple-600'}`}>{item.type === 'windfall' ? <Gift size={20}/> : item.type === 'passive' ? <Zap size={20}/> : <Briefcase size={20}/>}</div><div className="flex gap-1 opacity-0 group-hover:opacity-100 transition"><button onClick={() => handleOpenEdit(item)} className="p-2 text-slate-400 hover:text-slate-900 bg-slate-50 rounded-lg hover:bg-slate-100 transition"><Edit2 size={14}/></button><button onClick={() => handleDelete(item.id, item.source, item.dateReceived || '')} disabled={isDeleting} className="p-2 text-slate-400 hover:text-red-500 bg-slate-50 rounded-lg hover:bg-red-50 transition"><Trash2 size={14}/></button></div></div>
                      <div className="mt-4"><h4 className="font-bold text-slate-900 text-lg truncate" title={item.source}>{item.source}</h4><p className="text-xs text-slate-500 capitalize">{item.type} Income</p></div>
                      <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-end"><div><p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Diterima</p><div className="flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-50 px-2 py-1 rounded"><Calendar size={12}/>{new Date(item.dateReceived || '').toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})}</div></div><p className="text-xl font-black text-slate-900">{formatCurrency(item.amount)}</p></div>
                  </div>
              ))
          )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
           <div className="bg-white rounded-3xl w-full max-w-lg p-0 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50"><h3 className="text-xl font-bold text-slate-900">{editingId ? 'Edit Pemasukan' : 'Catat Pemasukan'}</h3><button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 bg-white p-2 rounded-full shadow-sm"><X size={20}/></button></div>
              <div className="p-6 overflow-y-auto custom-scrollbar">
                  {!showEstimator ? (
                      <form onSubmit={handleSubmit} className="space-y-5">
                        <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Sumber Dana</label><input type="text" required className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none font-medium" value={formData.source} onChange={e => setFormData({...formData, source: e.target.value})} /></div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <div className="flex justify-between items-center mb-1.5"><label className="block text-xs font-bold text-slate-500 uppercase">Nominal (Rp)</label><button type="button" onClick={() => setShowEstimator(true)} className="text-[10px] text-brand-600 font-bold hover:underline flex items-center gap-1"><Calculator size={12}/> Hitung Rata-rata</button></div>
                            <input type="number" required placeholder="0" className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-lg font-black text-slate-900 focus:ring-2 focus:ring-brand-500 outline-none" value={formData.amount} onChange={e => setFormData({...formData, amount: Number(e.target.value)})} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Kategori</label><select className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm bg-white focus:ring-2 focus:ring-brand-500 outline-none" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})}><option value="active">Active (Gaji)</option><option value="passive">Passive</option><option value="windfall">Dadakan</option></select></div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Tanggal</label>
                                <input type="date" required className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none" value={formData.dateReceived} onChange={e => setFormData({...formData, dateReceived: e.target.value})} />
                            </div>
                        </div>
                        
                        {(formData.type === 'active' || formData.type === 'passive') && (
                            <div className="bg-green-50 p-3 rounded-lg border border-green-100 text-xs text-green-700 flex items-center gap-2">
                                <Repeat size={14}/> 
                                <span>Otomatis terisi untuk bulan-bulan berikutnya (Unlimited).</span>
                            </div>
                        )}

                        <div className="flex gap-3 pt-4"><button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 border border-slate-300 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-50 transition">Batal</button><button type="submit" disabled={isSaving} className="flex-1 py-3 bg-brand-600 text-white rounded-xl font-bold text-sm hover:bg-brand-700 shadow-lg transition">{isSaving ? <Loader2 size={20} className="animate-spin inline mr-2"/> : null} {isSaving ? 'Menyimpan...' : 'Simpan Data'}</button></div>
                      </form>
                  ) : (
                      <div className="space-y-4">
                          <h4 className="font-bold text-slate-800 text-sm">Income Estimator (Freelancer)</h4>
                          <p className="text-xs text-slate-500">Masukkan penghasilan 3 bulan terakhir untuk mendapatkan angka rata-rata aman.</p>
                          <input type="number" placeholder="Bulan 1" className="w-full border p-2 rounded" onChange={e=>setEstimateInputs(p=>({...p, m1: Number(e.target.value)}))} />
                          <input type="number" placeholder="Bulan 2" className="w-full border p-2 rounded" onChange={e=>setEstimateInputs(p=>({...p, m2: Number(e.target.value)}))} />
                          <input type="number" placeholder="Bulan 3" className="w-full border p-2 rounded" onChange={e=>setEstimateInputs(p=>({...p, m3: Number(e.target.value)}))} />
                          <div className="flex gap-2 pt-2">
                              <button onClick={()=>setShowEstimator(false)} className="flex-1 border p-2 rounded">Batal</button>
                              <button onClick={applyEstimate} className="flex-1 bg-brand-600 text-white p-2 rounded font-bold">Gunakan Rata-rata</button>
                          </div>
                      </div>
                  )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
