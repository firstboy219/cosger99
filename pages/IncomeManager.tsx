
import React, { useState, useMemo, useEffect } from 'react';
import { IncomeItem } from '../types';
import { formatCurrency, toLocalISOString } from '../services/financeUtils';
import { saveItemToCloud, deleteFromCloud } from '../services/cloudSync';
import { getConfig } from '../services/mockDb';
import { Plus, Briefcase, Trash2, Edit2, X, TrendingUp, Loader2, Save, Sparkles, Repeat, Calendar as CalendarIcon, PieChart, ChevronLeft, ChevronRight, Wallet, Target, ArrowUpRight, Filter, Clock } from 'lucide-react';
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import ConfirmDialog from '../components/ui/ConfirmDialog';

interface IncomeManagerProps {
  incomes: IncomeItem[]; 
  setIncomes: React.Dispatch<React.SetStateAction<IncomeItem[]>>;
  userId: string;
}

export default function IncomeManager({ incomes = [], setIncomes, userId }: IncomeManagerProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]); // New: Selection State
  
  // Confirmation Modal State
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  
  // Smart Form State
  const [formData, setFormData] = useState<{ 
      source: string; 
      amount: number; 
      type: 'active' | 'passive' | 'windfall'; 
      frequency: 'monthly' | 'one-time';
      dateReceived: string; 
  }>({ 
      source: '', 
      amount: 0, 
      type: 'active', 
      frequency: 'monthly',
      dateReceived: toLocalISOString(new Date())
  });

  const activeIncomes = useMemo(() => incomes.filter(i => !i._deleted), [incomes]);

  // --- CALENDAR LOGIC ---
  const handleYearChange = (increment: number) => {
      const newDate = new Date(currentDate);
      newDate.setFullYear(newDate.getFullYear() + increment);
      setCurrentDate(newDate);
  };

  const handleMonthSelect = (monthIndex: number) => {
      const newDate = new Date(currentDate);
      newDate.setMonth(monthIndex);
      setCurrentDate(newDate);
  };

  // --- FILTERING LOGIC (STRICT) ---
  const filteredIncomes = useMemo(() => {
      return activeIncomes.filter(item => {
          // 1. Always show Monthly/Recurring incomes (Concept: they repeat)
          if (item.frequency === 'monthly') {
              // CHECK START DATE
              if (item.dateReceived) {
                  const start = new Date(item.dateReceived);
                  const viewStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                  if (viewStart < new Date(start.getFullYear(), start.getMonth(), 1)) return false;
              }
              
              // CHECK END DATE
              if (item.endDate) {
                  const end = new Date(item.endDate);
                  const viewStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                  if (viewStart > end) return false;
              }
              
              return true;
          }
          
          // 2. For One-time, STRICTLY match the selected month and year
          if (!item.dateReceived) return false;
          
          // Use string slicing for safe local date comparison (avoid TZ issues)
          // item.dateReceived is usually YYYY-MM-DD
          const itemYear = parseInt(item.dateReceived.substring(0, 4));
          const itemMonth = parseInt(item.dateReceived.substring(5, 7)) - 1; // 0-based month
          
          return itemYear === currentDate.getFullYear() && itemMonth === currentDate.getMonth();
      });
  }, [activeIncomes, currentDate]);

  // --- METRICS ---
  const metrics = useMemo(() => {
      const total = filteredIncomes.reduce((a, b) => a + Number(b.amount), 0);
      const active = filteredIncomes.filter(i => i.type === 'active').reduce((a, b) => a + Number(b.amount), 0);
      const passive = filteredIncomes.filter(i => i.type === 'passive' || i.type === 'windfall').reduce((a, b) => a + Number(b.amount), 0);
      
      const passiveRatio = total > 0 ? (passive / total) * 100 : 0;
      
      // Annual Projection (Recurring * 12 + One-time in current view)
      // Note: This is a simple projection based on current view
      const recurringTotal = activeIncomes.filter(i => i.frequency === 'monthly' && !i.endDate).reduce((a,b) => a + Number(b.amount), 0);
      const annualProjection = (recurringTotal * 12) + activeIncomes.filter(i => i.frequency === 'one-time').reduce((a,b) => a + Number(b.amount), 0);

      return { total, active, passive, passiveRatio, annualProjection };
  }, [filteredIncomes, activeIncomes]);

  // Chart Data
  const chartData = [
      { name: 'Active (Kerja)', value: metrics.active, color: '#3b82f6' },
      { name: 'Passive/Bonus', value: metrics.passive, color: '#10b981' }
  ].filter(d => d.value > 0);

  // Helper to get total for specific month (for calendar badges)
  const getMonthTotal = (monthIndex: number) => {
      const targetYear = currentDate.getFullYear();
      const viewDate = new Date(targetYear, monthIndex, 1);
      
      return activeIncomes.reduce((acc, item) => {
          if (item.frequency === 'monthly') {
              // Check Start
              if (item.dateReceived) {
                  const start = new Date(item.dateReceived);
                  if (viewDate < new Date(start.getFullYear(), start.getMonth(), 1)) return acc;
              }
              // Check End
              if (item.endDate) {
                  const end = new Date(item.endDate);
                  if (viewDate > end) return acc;
              }
              return acc + Number(item.amount);
          }
          
          if (!item.dateReceived) return acc;
          const itemYear = parseInt(item.dateReceived.substring(0, 4));
          const itemMonth = parseInt(item.dateReceived.substring(5, 7)) - 1;
          
          if (itemMonth === monthIndex && itemYear === targetYear) return acc + Number(item.amount);
          return acc;
      }, 0);
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({ 
        source: '', amount: 0, type: 'active', frequency: 'monthly', 
        // Default to the CURRENTLY SELECTED month for new entries
        dateReceived: toLocalISOString(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()))
    });
    setIsModalOpen(true);
  };

  const handleEdit = (item: IncomeItem) => {
    setEditingId(item.id);
    setFormData({ 
        source: item.source, 
        amount: item.amount, 
        type: item.type, 
        frequency: item.frequency || 'monthly',
        dateReceived: item.dateReceived || toLocalISOString(new Date())
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); 
    if (!formData.source || formData.amount <= 0) return;
    
    setIsSaving(true);
    const strategy = getConfig().advancedConfig?.syncStrategy || 'background';
    const tempId = `inc-${Date.now()}`;
    const now = new Date().toISOString();

    // RECURRING SPLIT LOGIC
    if (editingId) {
        const existing = incomes.find(i => i.id === editingId);
        if (existing && existing.frequency === 'monthly') {
            const start = new Date(existing.dateReceived || now);
            const viewStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            
            // If editing a future/current instance of a past recurring item
            if (viewStart > new Date(start.getFullYear(), start.getMonth(), 1)) {
                // 1. End the old item last month
                const prevMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0); // Last day of prev month
                const updatedOldItem: IncomeItem = {
                    ...existing,
                    endDate: toLocalISOString(prevMonthEnd),
                    updatedAt: now
                };
                
                // 2. Create new item starting this month
                const newItem: IncomeItem = {
                    id: tempId,
                    userId,
                    ...formData,
                    amount: Number(formData.amount),
                    dateReceived: toLocalISOString(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)), // Start 1st of this month
                    updatedAt: now,
                    createdAt: now,
                    _deleted: false
                };
                
                // Apply updates
                setIncomes(prev => [
                    ...prev.map(i => i.id === editingId ? updatedOldItem : i),
                    newItem
                ]);
                
                await saveItemToCloud('incomes', updatedOldItem, false);
                await saveItemToCloud('incomes', newItem, true);
                
                setIsModalOpen(false);
                setIsSaving(false);
                return;
            }
        }
    }

    let finalItem: IncomeItem;
    if (editingId) {
        const existing = incomes.find(i => i.id === editingId);
        finalItem = { ...existing!, ...formData, amount: Number(formData.amount), updatedAt: now };
    } else {
        finalItem = {
            id: tempId, userId,
            ...formData, amount: Number(formData.amount),
            updatedAt: now, 
            createdAt: now, // NEW: Track creation timestamp
            _deleted: false
        };
    }

    // Optimistic Update
    if (strategy === 'manual_only' || strategy === 'background') {
        if (editingId) setIncomes(prev => prev.map(inc => inc.id === editingId ? finalItem : inc));
        else setIncomes(prev => [finalItem, ...prev]);
        setIsModalOpen(false);
        setIsSaving(false);
    }

    try {
        const result = await saveItemToCloud('incomes', finalItem, !editingId);
        if (result.success && strategy === 'background') {
             // Sync success confirmation if needed
        }
    } catch (e) {
        if (strategy === 'manual_only') {
            alert("Failed to save.");
        }
    }
  };

  // UPDATED: Modal Delete Logic
  const handleDelete = (e: React.MouseEvent, id: string) => { 
      e.stopPropagation();
      setConfirmConfig({
          isOpen: true,
          title: "Hapus Pemasukan?",
          message: "Apakah Anda yakin ingin menghapus data pemasukan ini? Data yang dihapus tidak dapat dikembalikan.",
          onConfirm: () => {
              executeDelete(id);
              setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          }
      });
  };

  const executeDelete = async (id: string) => {
      const existing = incomes.find(i => i.id === id);
      const now = new Date().toISOString();
      
      // RECURRING SPLIT DELETE LOGIC
      if (existing && existing.frequency === 'monthly') {
          const start = new Date(existing.dateReceived || now);
          const viewStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
          
          // If deleting a future/current instance of a past recurring item
          if (viewStart > new Date(start.getFullYear(), start.getMonth(), 1)) {
              // Instead of deleting, just END it last month
              const prevMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0);
              const updatedOldItem: IncomeItem = {
                  ...existing,
                  endDate: toLocalISOString(prevMonthEnd),
                  updatedAt: now
              };
              
              setIncomes(prev => prev.map(i => i.id === id ? updatedOldItem : i));
              await saveItemToCloud('incomes', updatedOldItem, false);
              return;
          }
      }
      
      // Normal Delete
      setIncomes(prev => prev.filter(i => i.id !== id));
      await deleteFromCloud(userId, 'incomes', id);
  };

  // --- BULK ACTIONS ---
  const toggleSelection = (id: string) => {
      setSelectedIds(prev => 
          prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
      );
  };

  const handleSelectAll = () => {
      if (selectedIds.length === filteredIncomes.length) {
          setSelectedIds([]);
      } else {
          setSelectedIds(filteredIncomes.map(i => i.id));
      }
  };

  const handleBulkDelete = () => {
      setConfirmConfig({
          isOpen: true,
          title: `Hapus ${selectedIds.length} Item?`,
          message: "Data yang dihapus tidak dapat dikembalikan.",
          onConfirm: () => {
              executeBulkDelete();
              setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          }
      });
  };

  const executeBulkDelete = async () => {
      // Optimistic update
      setIncomes(prev => prev.filter(i => !selectedIds.includes(i.id)));
      
      // Async delete
      for (const id of selectedIds) {
          await deleteFromCloud(userId, 'incomes', id);
      }
      setSelectedIds([]);
  };

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

  return (
    <div className="space-y-8 pb-24 animate-fade-in font-sans">
      
      {/* 1. HEADER & TOTAL CARD */}
      <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl border border-slate-800">
          <div className="absolute right-0 top-0 p-12 opacity-5"><Wallet size={200}/></div>
          
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
              <div>
                  <h2 className="text-3xl font-black tracking-tight mb-1">Income Cockpit</h2>
                  <div className="flex items-center gap-2 mb-6">
                      <span className="text-sm font-medium bg-white/10 px-3 py-1 rounded-full border border-white/20">
                          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                      </span>
                      <p className="text-slate-400 text-sm font-medium">Analisa Arus Kas</p>
                  </div>
                  
                  <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Total Pemasukan Bulan Ini</span>
                      <div className="text-5xl font-black tracking-tighter text-white flex items-center gap-3">
                          {formatCurrency(metrics.total)}
                      </div>
                      <div className="flex items-center gap-3 mt-3">
                          <span className="text-xs font-bold text-slate-400 bg-white/10 px-2 py-1 rounded flex items-center gap-1">
                              <Sparkles size={12} className="text-yellow-400"/> Proyeksi Tahunan: {formatCurrency(metrics.annualProjection)}
                          </span>
                      </div>
                  </div>
              </div>

              {/* CHART CARD */}
              <div className="bg-slate-800/50 p-6 rounded-3xl border border-white/10 backdrop-blur-md flex items-center gap-6">
                  <div className="w-24 h-24 relative">
                      <ResponsiveContainer width="100%" height="100%">
                          <RePieChart>
                              <Pie data={chartData} innerRadius={35} outerRadius={45} paddingAngle={5} dataKey="value">
                                  {chartData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                  ))}
                              </Pie>
                              <Tooltip 
                                contentStyle={{borderRadius: '8px', border:'none', fontSize:'10px', backgroundColor: '#1e293b', color: '#fff'}}
                                formatter={(val: number) => formatCurrency(val)}
                              />
                          </RePieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className="text-[10px] font-bold text-slate-400">Rasio</span>
                      </div>
                  </div>
                  <div className="flex-1">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Structure</h4>
                      <div className="space-y-2">
                          <div className="flex justify-between items-center text-xs">
                              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Active</div>
                              <span className="font-bold">{formatCurrency(metrics.active)}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500"></div> Passive</div>
                              <span className="font-bold">{formatCurrency(metrics.passive)}</span>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT: CALENDAR SELECTOR */}
          <div className="lg:col-span-1 space-y-6">
               <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6">
                   <div className="flex justify-between items-center mb-6">
                       <h3 className="text-bold text-slate-900 flex items-center gap-2">
                           <CalendarIcon className="text-brand-600" size={18}/> Periode
                       </h3>
                       <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                           <button onClick={() => handleYearChange(-1)} className="p-1.5 hover:bg-white rounded-lg transition shadow-sm text-slate-500"><ChevronLeft size={16}/></button>
                           <span className="text-xs font-black text-slate-700 px-2">{currentDate.getFullYear()}</span>
                           <button onClick={() => handleYearChange(1)} className="p-1.5 hover:bg-white rounded-lg transition shadow-sm text-slate-500"><ChevronRight size={16}/></button>
                       </div>
                   </div>
                   
                   <div className="grid grid-cols-4 gap-3">
                       {monthNames.map((month, index) => {
                           const isSelected = index === currentDate.getMonth();
                           const monthTotal = getMonthTotal(index);
                           const hasData = monthTotal > 0;

                           return (
                               <button 
                                   key={month} 
                                   onClick={() => handleMonthSelect(index)}
                                   className={`relative py-3 rounded-xl flex flex-col items-center justify-center transition-all ${
                                       isSelected 
                                       ? 'bg-slate-900 text-white shadow-lg scale-105 z-10' 
                                       : 'bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                                   }`}
                               >
                                   <span className="text-xs font-bold">{month}</span>
                                   {hasData && !isSelected && (
                                       <div className="w-1 h-1 bg-green-500 rounded-full mt-1"></div>
                                   )}
                                   {isSelected && hasData && (
                                       <span className="text-[10px] font-mono mt-1 text-green-300 opacity-80">
                                           {(monthTotal/1000000).toFixed(1)}m
                                       </span>
                                   )}
                               </button>
                           );
                       })}
                   </div>
                   
                   <div className="mt-6 p-4 bg-brand-50 rounded-2xl border border-brand-100">
                       <h4 className="text-xs font-bold text-brand-800 mb-1 flex items-center gap-2">
                           <Target size={14}/> Stability Score
                       </h4>
                       <div className="flex items-center gap-2">
                           <div className="flex-1 h-2 bg-brand-200 rounded-full overflow-hidden">
                               <div className="h-full bg-brand-600 rounded-full" style={{width: `${100 - metrics.passiveRatio}%`}}></div>
                           </div>
                           <span className="text-xs font-black text-brand-700">{(100 - metrics.passiveRatio).toFixed(0)}% Active</span>
                       </div>
                       <p className="text-[10px] text-brand-600/70 mt-2 leading-relaxed">
                           Skor stabilitas tinggi berarti income Anda bergantung pada kerja aktif. Tingkatkan Passive Income untuk kebebasan waktu.
                       </p>
                   </div>
               </div>
          </div>

          {/* RIGHT: INCOME LIST */}
          <div className="lg:col-span-2">
              <div className="flex justify-between items-center mb-4 px-2">
                  <div className="flex items-center gap-4">
                      <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                          <Filter size={18} className="text-slate-400"/> Sumber Dana
                      </h3>
                      {filteredIncomes.length > 0 && (
                          <div className="flex items-center gap-2 pl-4 border-l border-slate-200">
                              <input 
                                  type="checkbox" 
                                  checked={filteredIncomes.length > 0 && selectedIds.length === filteredIncomes.length}
                                  onChange={handleSelectAll}
                                  className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                              />
                              <span className="text-[10px] font-bold text-slate-500 uppercase cursor-pointer" onClick={handleSelectAll}>Select All</span>
                          </div>
                      )}
                  </div>

                  <div className="flex gap-2">
                      {selectedIds.length > 0 && (
                          <button onClick={handleBulkDelete} className="bg-red-50 text-red-600 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-red-100 transition flex items-center gap-2 animate-fade-in">
                              <Trash2 size={14}/> Hapus ({selectedIds.length})
                          </button>
                      )}
                      <button onClick={handleOpenAdd} className="bg-slate-900 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition shadow-lg flex items-center gap-2">
                          <Plus size={14}/> Tambah
                      </button>
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredIncomes.length === 0 ? (
                      <div className="col-span-full py-16 text-center border-2 border-dashed border-slate-200 rounded-[2rem] bg-slate-50/50">
                          <Wallet className="mx-auto text-slate-300 mb-3 opacity-50" size={48}/>
                          <p className="text-slate-400 text-sm font-medium">Belum ada pemasukan tercatat di {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}.</p>
                      </div>
                  ) : (
                      filteredIncomes.map(item => (
                          <div 
                            key={item.id} 
                            onClick={() => handleEdit(item)}
                            className={`group bg-white rounded-[2rem] p-5 border shadow-sm hover:shadow-xl transition-all relative overflow-hidden cursor-pointer ${selectedIds.includes(item.id) ? 'border-brand-500 ring-1 ring-brand-500 bg-brand-50/10' : 'border-slate-100'}`}
                          >
                              <div className="flex justify-between items-start mb-4">
                                  <div className="flex items-center gap-3">
                                      <input 
                                          type="checkbox"
                                          checked={selectedIds.includes(item.id)}
                                          onClick={(e) => e.stopPropagation()}
                                          onChange={(e) => { toggleSelection(item.id); }}
                                          className="w-5 h-5 rounded-lg border-2 border-slate-200 text-slate-900 focus:ring-slate-900 cursor-pointer"
                                      />
                                      <div className={`p-3 rounded-2xl ${item.type === 'active' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                                          {item.type === 'active' ? <Briefcase size={20}/> : <TrendingUp size={20}/>}
                                      </div>
                                  </div>
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                      <button onClick={(e) => { e.stopPropagation(); handleEdit(item); }} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-all"><Edit2 size={14}/></button>
                                      <button onClick={(e) => handleDelete(e, item.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={14}/></button>
                                  </div>
                              </div>
                              
                              <h4 className="font-black text-slate-900 text-base leading-tight mb-1 truncate">{item.source}</h4>
                              
                              <div className="flex flex-wrap gap-2 mb-4">
                                  {item.frequency === 'monthly' ? (
                                      <span className="text-[9px] font-bold bg-purple-50 text-purple-600 px-2 py-0.5 rounded border border-purple-100 flex items-center gap-1">
                                          <Repeat size={10}/> Rutin
                                      </span>
                                  ) : (
                                      <span className="text-[9px] font-bold bg-amber-50 text-amber-600 px-2 py-0.5 rounded border border-amber-100 flex items-center gap-1">
                                          <Sparkles size={10}/> Sekali
                                      </span>
                                  )}
                                  <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200 uppercase">{item.type}</span>
                              </div>
                              
                              <div className="flex justify-between items-end border-t border-slate-50 pt-3">
                                  <p className="text-xl font-black text-slate-900 tracking-tighter">{formatCurrency(item.amount)}</p>
                                  
                                  <div className="flex flex-col items-end">
                                      {item.frequency === 'one-time' && (
                                          <span className="text-[9px] text-slate-400 font-mono mb-1">
                                              {new Date(item.dateReceived || '').toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})}
                                          </span>
                                      )}
                                      {item.createdAt && (
                                          <span className="text-[8px] text-slate-300 font-medium flex items-center gap-1">
                                              <Clock size={8}/> Added {new Date(item.createdAt).toLocaleDateString()}
                                          </span>
                                      )}
                                  </div>
                              </div>
                          </div>
                      ))
                  )}
              </div>
          </div>
      </div>

      {/* SMART MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-fade-in">
           <div className="bg-white rounded-[3rem] w-full max-w-md p-8 shadow-2xl border border-white/20">
              <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                      {editingId ? <Edit2 size={20} className="text-brand-600"/> : <Plus size={20} className="text-brand-600"/>}
                      {editingId ? 'Edit Sumber' : 'Sumber Baru'}
                  </h3>
                  <button onClick={()=>setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><X size={24}/></button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 ml-1">Sumber Pendapatan</label>
                      <input type="text" required className="w-full border-2 border-slate-100 p-4 rounded-2xl focus:border-brand-500 outline-none font-bold text-slate-800" value={formData.source} onChange={e => setFormData({...formData, source: e.target.value})} placeholder="Misal: Gaji Utama" autoFocus />
                  </div>
                  
                  <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 ml-1">Nominal (IDR)</label>
                      <input type="number" required className="w-full border-2 border-slate-100 p-4 rounded-2xl focus:border-brand-500 outline-none font-black text-2xl text-slate-900" value={formData.amount} onChange={e => setFormData({...formData, amount: Number(e.target.value)})} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 ml-1">Frekuensi</label>
                          <select className="w-full border-2 border-slate-100 p-3 rounded-2xl focus:border-brand-500 outline-none font-bold bg-white text-sm" value={formData.frequency} onChange={e => setFormData({...formData, frequency: e.target.value as any})}>
                              <option value="monthly">Bulanan (Rutin)</option>
                              <option value="one-time">Sekali (Bonus)</option>
                          </select>
                      </div>
                      <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 ml-1">Tipe</label>
                          <select className="w-full border-2 border-slate-100 p-3 rounded-2xl focus:border-brand-500 outline-none font-bold bg-white text-sm" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})}>
                              <option value="active">Active (Kerja)</option>
                              <option value="passive">Passive (Aset)</option>
                              <option value="windfall">Bonus/THR</option>
                          </select>
                      </div>
                  </div>

                  {formData.frequency === 'one-time' && (
                      <div className="animate-fade-in">
                          <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 ml-1">Tanggal Terima</label>
                          <input type="date" className="w-full border-2 border-slate-100 p-3 rounded-2xl focus:border-brand-500 outline-none font-bold text-slate-600 text-sm" value={formData.dateReceived} onChange={e => setFormData({...formData, dateReceived: e.target.value})} />
                      </div>
                  )}

                  {/* SMART PREVIEW BOX */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                      <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Estimasi Tahunan</p>
                          <p className="text-sm font-black text-slate-800">
                              {formatCurrency(formData.frequency === 'monthly' ? formData.amount * 12 : formData.amount)}
                          </p>
                      </div>
                      <TrendingUp size={20} className="text-green-500"/>
                  </div>

                  <div className="pt-2 flex gap-3">
                      <button type="button" onClick={()=>setIsModalOpen(false)} className="flex-1 py-4 border-2 border-slate-100 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition">Batal</button>
                      <button type="submit" disabled={isSaving} className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 shadow-xl flex items-center justify-center gap-2 transition transform active:scale-95">
                          {isSaving ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>}
                          Simpan
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
