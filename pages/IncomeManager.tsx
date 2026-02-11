
import React, { useState, useMemo, useEffect } from 'react';
import { IncomeItem } from '../types';
import { formatCurrency, safeDateISO } from '../services/financeUtils';
import { Plus, Briefcase, Gift, DollarSign, Trash2, Calendar, Edit2, ChevronLeft, ChevronRight, Copy, Zap, Sparkles, X, BrainCircuit, Repeat, BarChart3, Wallet, PieChart, TrendingDown, TrendingUp, CloudLightning, Loader2, Calculator } from 'lucide-react';
import { ResponsiveContainer, PieChart as RePie, Pie, Cell, Tooltip } from 'recharts';
import { getUserData, saveUserData, getConfig } from '../services/mockDb';
import { pushPartialUpdate, deleteFromCloud } from '../services/cloudSync';

interface IncomeManagerProps {
  incomes: IncomeItem[]; 
  setIncomes: React.Dispatch<React.SetStateAction<IncomeItem[]>>;
  userId: string;
}

export default function IncomeManager({ incomes, setIncomes, userId }: IncomeManagerProps) {
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const currentMonthKey = currentDate.toISOString().slice(0, 7);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const initialFormState = { source: '', amount: 0, type: 'active', frequency: 'monthly', dateReceived: new Date(currentDate).toISOString().split('T')[0], notes: '' };
  const [formData, setFormData] = useState<any>(initialFormState);

  const activeIncomes = useMemo(() => incomes.filter(i => !i._deleted), [incomes]);
  const filteredIncomes = useMemo(() => activeIncomes.filter(i => i.dateReceived?.startsWith(currentMonthKey)), [activeIncomes, currentMonthKey]);
  
  const handleOpenAdd = () => { setEditingId(null); setFormData({ ...initialFormState, dateReceived: new Date().toISOString().split('T')[0] }); setIsModalOpen(true); };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); 
    setIsSaving(true);
    
    let newIncomes = [...incomes];
    const baseDate = new Date(formData.dateReceived);
    const now = new Date().toISOString();
    const itemsToPush: IncomeItem[] = [];
    
    if (editingId) {
        const updatedItem = { ...incomes.find(i => i.id === editingId)!, ...formData, amount: Number(formData.amount), updatedAt: now };
        newIncomes = newIncomes.map(inc => inc.id === editingId ? updatedItem : inc);
        itemsToPush.push(updatedItem);
    } else {
        const repeat = (formData.type === 'active' || formData.type === 'passive') ? 12 : 1;
        for (let i = 0; i < repeat; i++) {
            const nextDate = new Date(baseDate); nextDate.setMonth(baseDate.getMonth() + i);
            const newItem: IncomeItem = {
                id: `inc-${Date.now()}-${i}`, userId, source: formData.source, amount: Number(formData.amount), 
                type: formData.type, frequency: formData.frequency, dateReceived: nextDate.toISOString().split('T')[0], 
                updatedAt: now, _deleted: false
            };
            newIncomes.push(newItem);
            itemsToPush.push(newItem);
        }
    }

    saveUserData(userId, { incomes: newIncomes });
    setIncomes(newIncomes);
    await pushPartialUpdate(userId, { incomes: itemsToPush });
    
    setIsSaving(false);
    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => { 
      if (confirm("Hapus pemasukan ini selamanya dari Cloud?")) { 
          const success = await deleteFromCloud(userId, 'incomes', id);
          if (success) {
              setIncomes(prev => prev.filter(i => i.id !== id));
              saveUserData(userId, { incomes: incomes.filter(i => i.id !== id) });
          }
      } 
  };

  const totalIncome = filteredIncomes.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  
  return (
    <div className="space-y-8 pb-10">
      <div className="bg-slate-900 rounded-3xl p-8 text-white flex justify-between items-center shadow-2xl">
          <div>
              <p className="text-indigo-200 text-sm uppercase font-bold">Total Bulan Ini</p>
              <h2 className="text-4xl font-black">{formatCurrency(totalIncome)}</h2>
          </div>
          <button onClick={handleOpenAdd} className="bg-white text-slate-900 px-6 py-3 rounded-xl font-bold hover:bg-indigo-50 transition shadow-lg">Tambah Income</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredIncomes.map(item => (
              <div key={item.id} className="bg-white rounded-2xl p-5 border shadow-sm group">
                  <div className="flex justify-between items-start">
                      <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Briefcase size={20}/></div>
                      <button onClick={() => handleDelete(item.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"><Trash2 size={16}/></button>
                  </div>
                  <div className="mt-4"><h4 className="font-bold text-slate-900 truncate">{item.source}</h4><p className="text-xl font-black text-brand-600">{formatCurrency(item.amount)}</p></div>
              </div>
          ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
           <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl">
              <h3 className="text-xl font-bold mb-4">Catat Pemasukan</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                  <input type="text" required className="w-full border p-3 rounded-xl" placeholder="Sumber" value={formData.source} onChange={e => setFormData({...formData, source: e.target.value})} />
                  <input type="number" required className="w-full border p-3 rounded-xl" placeholder="Nominal" value={formData.amount} onChange={e => setFormData({...formData, amount: Number(e.target.value)})} />
                  <button type="submit" disabled={isSaving} className="w-full bg-brand-600 text-white py-3 rounded-xl font-bold shadow-lg">{isSaving ? 'Menyimpan...' : 'Simpan Data'}</button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}
