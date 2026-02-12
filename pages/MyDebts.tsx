
import React, { useState, useMemo } from 'react';
import { DebtItem, LoanType, PaymentRecord, DebtInstallment, StepUpRange } from '../types';
import { formatCurrency, generateInstallmentsForDebt } from '../services/financeUtils';
import { pushPartialUpdate, deleteFromCloud } from '../services/cloudSync';
import { Plus, Trash2, Edit2, X, Loader2, TrendingUp, Info, AlertTriangle, Save, Calendar, ChevronDown, ChevronRight, Calculator, PieChart, Table } from 'lucide-react';

interface MyDebtsProps {
  debts: DebtItem[];
  setDebts: React.Dispatch<React.SetStateAction<DebtItem[]>>;
  paymentRecords: PaymentRecord[];
  setPaymentRecords: React.Dispatch<React.SetStateAction<PaymentRecord[]>>;
  userId: string;
  debtInstallments?: DebtInstallment[];
  setDebtInstallments?: React.Dispatch<React.SetStateAction<DebtInstallment[]>>;
}

export default function MyDebts({ debts = [], setDebts, userId, debtInstallments = [], setDebtInstallments }: MyDebtsProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Schedule Viewer State
  const [viewScheduleId, setViewScheduleId] = useState<string | null>(null);

  // Advanced Form State
  const initialForm = { 
    name: '', 
    type: LoanType.KPR, 
    bankName: '', 
    monthlyInstallment: 0, 
    principal: 0, 
    interestRate: 10,
    startDate: new Date().toISOString().split('T')[0], 
    endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 15)).toISOString().split('T')[0], 
    dueDate: 5,
    interestStrategy: 'Fixed', // 'Fixed' | 'StepUp'
    stepUpSchedule: [] as StepUpRange[]
  };
  
  const [formData, setFormData] = useState(initialForm);
  const [activeStepUpYear, setActiveStepUpYear] = useState<number>(1); // UI helper for adding years

  const activeDebts = useMemo(() => (debts || []).filter(d => !d._deleted), [debts]);

  // Get installments for the currently viewed debt
  const currentSchedule = useMemo(() => {
      if (!viewScheduleId) return [];
      return debtInstallments
        .filter(i => i.debtId === viewScheduleId)
        .sort((a, b) => a.period - b.period);
  }, [viewScheduleId, debtInstallments]);

  const handleEdit = (debt: DebtItem) => {
      setEditingId(debt.id);
      
      // Parse Step Up Schedule if string/JSON
      let parsedSchedule: StepUpRange[] = [];
      if (typeof debt.stepUpSchedule === 'string') {
          try { parsedSchedule = JSON.parse(debt.stepUpSchedule); } catch(e) {}
      } else if (Array.isArray(debt.stepUpSchedule)) {
          parsedSchedule = debt.stepUpSchedule;
      }

      setFormData({
          name: debt.name,
          type: debt.type,
          bankName: debt.bankName || '',
          monthlyInstallment: debt.monthlyPayment,
          principal: debt.remainingPrincipal,
          interestRate: debt.interestRate || 10,
          startDate: debt.startDate,
          endDate: debt.endDate,
          dueDate: debt.dueDate || 5,
          interestStrategy: debt.interestStrategy || 'Fixed',
          stepUpSchedule: parsedSchedule
      });
      setIsModalOpen(true);
  };

  const handleAddStepUpRow = () => {
      const startMonth = formData.stepUpSchedule.length > 0 
        ? formData.stepUpSchedule[formData.stepUpSchedule.length - 1].endMonth + 1 
        : 1;
      
      const newRow: StepUpRange = {
          startMonth: startMonth,
          endMonth: startMonth + 11, // Default 1 year
          amount: formData.monthlyInstallment // Default to current flat rate
      };
      
      setFormData(prev => ({ ...prev, stepUpSchedule: [...prev.stepUpSchedule, newRow] }));
  };

  const updateStepUpRow = (index: number, field: keyof StepUpRange, value: number) => {
      const updated = [...formData.stepUpSchedule];
      updated[index] = { ...updated[index], [field]: value };
      setFormData(prev => ({ ...prev, stepUpSchedule: updated }));
  };

  const removeStepUpRow = (index: number) => {
      const updated = formData.stepUpSchedule.filter((_, i) => i !== index);
      setFormData(prev => ({ ...prev, stepUpSchedule: updated }));
  };

  const handleDelete = async (id: string) => { 
      if (!confirm('Hapus kontrak hutang ini selamanya dari Cloud SQL?')) return;
      setIsSyncing(true);
      const success = await deleteFromCloud(userId, 'debts', id);
      if (success) {
          setDebts(prev => prev.filter(d => d.id !== id));
          if (setDebtInstallments) setDebtInstallments(prev => prev.filter(inst => inst.debtId !== id));
      } else {
          alert("Gagal menghapus data di server.");
      }
      setIsSyncing(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSyncing(true);

    const targetId = editingId || `debt-${Date.now()}`;
    const newDebt: DebtItem = {
        id: targetId, 
        userId, 
        name: formData.name,
        type: formData.type as LoanType,
        bankName: formData.bankName,
        originalPrincipal: Number(formData.principal), 
        monthlyPayment: Number(formData.monthlyInstallment),
        remainingPrincipal: Number(formData.principal),
        interestRate: Number(formData.interestRate),
        totalLiability: Number(formData.principal) * (1 + (Number(formData.interestRate)/100)), // Crude estimate
        startDate: formData.startDate,
        endDate: formData.endDate,
        dueDate: formData.dueDate,
        interestStrategy: formData.interestStrategy as 'Fixed' | 'StepUp',
        stepUpSchedule: formData.stepUpSchedule,
        updatedAt: new Date().toISOString(), 
        _deleted: false,
        remainingMonths: 180 // Recalculated in utility
    };

    // Regenerate Installments based on new logic
    const insts = generateInstallmentsForDebt(newDebt, []);
    
    // Recalculate remainingMonths & liability based on schedule
    newDebt.remainingMonths = insts.length;
    newDebt.totalLiability = insts.reduce((a, b) => a + b.amount, 0);

    const success = await pushPartialUpdate(userId, { 
        debts: [newDebt], 
        debtInstallments: insts 
    });

    if (success) {
        if (editingId) {
            setDebts(prev => prev.map(d => d.id === editingId ? newDebt : d));
            if (setDebtInstallments) setDebtInstallments(prev => {
                const filtered = prev.filter(i => i.debtId !== editingId);
                return [...filtered, ...insts];
            });
        } else {
            setDebts(prev => [...prev, newDebt]);
            if (setDebtInstallments) setDebtInstallments(prev => [...prev, ...insts]);
        }
        setIsModalOpen(false);
        setEditingId(null);
        setFormData(initialForm);
    } else {
        alert("Gagal sinkronisasi ke Cloud.");
    }
    setIsSyncing(false);
  };

  return (
    <div className="space-y-8 pb-24 animate-fade-in">
      
      {/* HEADER CARD */}
      <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h2 className="text-3xl font-black text-slate-900 flex items-center gap-3">
                <TrendingUp className="text-brand-600"/> Portofolio Beban
            </h2>
            <p className="text-slate-500 font-medium mt-1">Kelola kontrak hutang dengan strategi pintar (Fixed & Step-Up).</p>
          </div>
          <button onClick={() => { setEditingId(null); setFormData(initialForm); setIsModalOpen(true); }} className="px-8 py-4 bg-slate-900 text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-brand-600 transition shadow-xl transform active:scale-95 flex items-center gap-3">
              <Plus size={18}/> Tambah Kontrak
          </button>
      </div>

      {/* DEBT GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {activeDebts.length === 0 ? (
              <div className="col-span-full py-20 text-center border-4 border-dashed border-slate-100 rounded-[3rem] text-slate-300">
                  <Info size={48} className="mx-auto mb-4 opacity-20"/>
                  <p className="font-black uppercase tracking-widest">Belum Ada Hutang Terdeteksi</p>
              </div>
          ) : activeDebts.map(debt => {
              // Calculate effective installments if Step Up
              let currentInstallment = debt.monthlyPayment;
              const isStepUp = debt.interestStrategy === 'StepUp';
              
              return (
                  <div key={debt.id} className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm hover:shadow-2xl transition-all group relative overflow-hidden flex flex-col justify-between">
                      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><TrendingUp size={120}/></div>
                      
                      <div>
                          <div className="flex justify-between items-start mb-6 relative z-10">
                              <span className="text-[10px] font-black uppercase bg-brand-50 text-brand-600 px-3 py-1.5 rounded-xl border border-brand-100">{debt.type}</span>
                              <div className="flex gap-2">
                                  <button onClick={() => setViewScheduleId(debt.id)} className="p-2 text-blue-400 hover:text-blue-600 transition-colors bg-white rounded-lg shadow-sm border border-slate-50" title="Lihat Tabel Cicilan"><Table size={16}/></button>
                                  <button onClick={() => handleEdit(debt)} className="p-2 text-slate-300 hover:text-brand-600 transition-colors bg-white rounded-lg shadow-sm border border-slate-50"><Edit2 size={16}/></button>
                                  <button onClick={() => handleDelete(debt.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors bg-white rounded-lg shadow-sm border border-slate-50"><Trash2 size={16}/></button>
                              </div>
                          </div>
                          
                          <h3 className="font-black text-xl text-slate-900 leading-tight mb-1 truncate">{debt.name}</h3>
                          <div className="flex items-center gap-2 mb-6">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{debt.bankName || 'Pihak Ketiga'}</span>
                              {isStepUp && <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 rounded font-bold uppercase">Step-Up</span>}
                          </div>

                          <div className="space-y-4">
                              <div>
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Sisa Pokok</p>
                                  <p className="text-3xl font-black text-slate-900 tracking-tighter">{formatCurrency(debt.remainingPrincipal)}</p>
                              </div>
                              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                  <div className="h-full bg-brand-600 rounded-full" style={{ width: `${Math.max(5, (1 - (debt.remainingPrincipal / (debt.originalPrincipal || 1))) * 100)}%` }}></div>
                              </div>
                          </div>
                      </div>

                      <div className="mt-8 pt-6 border-t border-slate-50 flex justify-between items-center relative z-10">
                          <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Setoran {isStepUp ? '(Current)' : ''}</p>
                              <p className="font-black text-brand-600">{formatCurrency(currentInstallment)}</p>
                          </div>
                          <div className="text-right">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tgl Tempo</p>
                              <p className="font-black text-slate-700">{debt.dueDate}</p>
                          </div>
                      </div>
                  </div>
              );
          })}
      </div>

      {/* MODAL: SCHEDULE TABLE */}
      {viewScheduleId && (
          <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-fade-in">
              <div className="bg-white rounded-[2rem] w-full max-w-4xl h-[80vh] shadow-2xl border border-white/20 flex flex-col overflow-hidden">
                  <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                      <div>
                          <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                              <Calendar size={20} className="text-brand-600"/> Tabel Estimasi Cicilan
                          </h3>
                          <p className="text-xs text-slate-500 font-medium">Jadwal lengkap pembayaran untuk hutang ini.</p>
                      </div>
                      <button onClick={() => setViewScheduleId(null)} className="p-2 hover:bg-slate-200 rounded-full transition"><X size={20}/></button>
                  </div>
                  
                  <div className="flex-1 overflow-auto custom-scrollbar p-6">
                      <table className="w-full text-sm text-left">
                          <thead className="text-xs text-slate-500 uppercase bg-slate-100 font-black tracking-wider sticky top-0">
                              <tr>
                                  <th className="px-6 py-3 rounded-tl-lg">Cicilan Ke</th>
                                  <th className="px-6 py-3">Tgl Estimasi</th>
                                  <th className="px-6 py-3">Total Bayar</th>
                                  <th className="px-6 py-3">Porsi Pokok</th>
                                  <th className="px-6 py-3">Porsi Bunga</th>
                                  <th className="px-6 py-3">Sisa Hutang</th>
                                  <th className="px-6 py-3 rounded-tr-lg text-center">Status</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                              {currentSchedule.length === 0 ? (
                                  <tr><td colSpan={7} className="text-center py-10 text-slate-400">Tidak ada jadwal cicilan. Edit hutang untuk generate ulang.</td></tr>
                              ) : (
                                  currentSchedule.map((inst, idx) => (
                                      <tr key={inst.id} className="hover:bg-slate-50 transition">
                                          <td className="px-6 py-4 font-bold text-slate-700">#{inst.period}</td>
                                          <td className="px-6 py-4 font-mono text-slate-500">
                                              {new Date(inst.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                          </td>
                                          <td className="px-6 py-4 font-bold text-brand-600">{formatCurrency(inst.amount)}</td>
                                          <td className="px-6 py-4 text-slate-600">{formatCurrency(inst.principalPart)}</td>
                                          <td className="px-6 py-4 text-slate-600">{formatCurrency(inst.interestPart)}</td>
                                          <td className="px-6 py-4 text-slate-400">{formatCurrency(inst.remainingBalance)}</td>
                                          <td className="px-6 py-4 text-center">
                                              <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${inst.status === 'paid' ? 'bg-green-100 text-green-600' : inst.status === 'overdue' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                                                  {inst.status}
                                              </span>
                                          </td>
                                      </tr>
                                  ))
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL: ADD/EDIT DEBT */}
      {isModalOpen && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4 animate-fade-in overflow-y-auto">
              <div className="bg-white rounded-[3rem] w-full max-w-2xl p-8 shadow-2xl border border-white/20 my-10">
                  <div className="flex justify-between items-center mb-8">
                      <div>
                          <h3 className="text-2xl font-black text-slate-900 tracking-tighter">{editingId ? 'Edit Kontrak' : 'Kontrak Baru'}</h3>
                          <p className="text-xs text-slate-500 font-medium">Isi detail pinjaman dengan akurat untuk strategi pelunasan.</p>
                      </div>
                      <button onClick={()=>setIsModalOpen(false)} className="p-3 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><X size={28}/></button>
                  </div>
                  
                  <form onSubmit={handleSubmit} className="space-y-6">
                      
                      {/* Section 1: Basic Info */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="col-span-full">
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-1">Nama Hutang</label>
                            <input type="text" required className="w-full border-2 border-slate-100 p-4 rounded-2xl focus:border-brand-500 outline-none font-bold" value={formData.name} onChange={e=>setFormData({...formData, name:e.target.value})} placeholder="Misal: KPR Mandiri 2024" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-1">Jenis Pinjaman</label>
                            <select className="w-full border-2 border-slate-100 p-4 rounded-2xl focus:border-brand-500 outline-none font-bold bg-white" value={formData.type} onChange={e=>setFormData({...formData, type: e.target.value as LoanType})}>
                                <option value={LoanType.KPR}>KPR (Rumah)</option>
                                <option value={LoanType.KKB}>KKB (Kendaraan)</option>
                                <option value={LoanType.KTA}>KTA (Cash)</option>
                                <option value={LoanType.CC}>Kartu Kredit</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-1">Bank / Leasing</label>
                            <input type="text" className="w-full border-2 border-slate-100 p-4 rounded-2xl focus:border-brand-500 outline-none font-bold" value={formData.bankName} onChange={e=>setFormData({...formData, bankName:e.target.value})} placeholder="BCA / BRI" />
                        </div>
                      </div>
                      
                      {/* Section 2: Numbers */}
                      <div className="grid grid-cols-2 gap-5">
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-1">Sisa Pokok (IDR)</label>
                            <input type="number" required className="w-full border-2 border-slate-100 p-4 rounded-2xl focus:border-brand-500 outline-none font-black text-lg" value={formData.principal} onChange={e=>setFormData({...formData, principal:Number(e.target.value)})} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-1">Bunga (p.a %)</label>
                            <input type="number" step="0.1" required className="w-full border-2 border-slate-100 p-4 rounded-2xl focus:border-brand-500 outline-none font-black text-lg" value={formData.interestRate} onChange={e=>setFormData({...formData, interestRate:Number(e.target.value)})} />
                        </div>
                      </div>

                      {/* Section 3: Strategy Switcher */}
                      <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                          <label className="block text-[10px] font-black text-slate-500 uppercase mb-4 ml-1 flex items-center gap-2">
                              <Calculator size={14} className="text-brand-600"/> Skema Pembayaran
                          </label>
                          <div className="flex gap-4 mb-6">
                              <button type="button" onClick={() => setFormData({...formData, interestStrategy: 'Fixed'})} className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition ${formData.interestStrategy === 'Fixed' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-500 border border-slate-200'}`}>
                                  Flat / Fixed
                              </button>
                              <button type="button" onClick={() => setFormData({...formData, interestStrategy: 'StepUp'})} className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition ${formData.interestStrategy === 'StepUp' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-500 border border-slate-200'}`}>
                                  Step-Up (Berjenjang)
                              </button>
                          </div>

                          {formData.interestStrategy === 'Fixed' ? (
                              <div>
                                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-1">Cicilan Tetap per Bulan</label>
                                  <input type="number" required className="w-full border-2 border-white p-4 rounded-2xl focus:border-brand-500 outline-none font-black text-brand-600 text-xl shadow-sm" value={formData.monthlyInstallment} onChange={e=>setFormData({...formData, monthlyInstallment:Number(e.target.value)})} />
                              </div>
                          ) : (
                              <div className="space-y-4">
                                  <div className="flex items-center gap-2 text-xs text-slate-500 italic bg-blue-50 p-3 rounded-xl">
                                      <Info size={16}/> Masukkan jadwal kenaikan cicilan (misal: KPR tahun ke-1 flat, tahun ke-3 naik).
                                  </div>
                                  
                                  {formData.stepUpSchedule.map((row, idx) => (
                                      <div key={idx} className="flex gap-3 items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                          <div className="flex-1">
                                              <label className="text-[9px] font-bold text-slate-400 uppercase">Bulan Ke</label>
                                              <div className="flex items-center gap-2">
                                                  <input type="number" className="w-16 border rounded p-1 text-xs font-bold" value={row.startMonth} onChange={(e) => updateStepUpRow(idx, 'startMonth', Number(e.target.value))} />
                                                  <span className="text-xs text-slate-400">-</span>
                                                  <input type="number" className="w-16 border rounded p-1 text-xs font-bold" value={row.endMonth} onChange={(e) => updateStepUpRow(idx, 'endMonth', Number(e.target.value))} />
                                              </div>
                                          </div>
                                          <div className="flex-1">
                                              <label className="text-[9px] font-bold text-slate-400 uppercase">Nominal</label>
                                              <input type="number" className="w-full border rounded p-1 text-xs font-bold text-brand-600" value={row.amount} onChange={(e) => updateStepUpRow(idx, 'amount', Number(e.target.value))} />
                                          </div>
                                          <button type="button" onClick={() => removeStepUpRow(idx)} className="text-red-400 hover:text-red-600 p-2"><Trash2 size={16}/></button>
                                      </div>
                                  ))}

                                  <button type="button" onClick={handleAddStepUpRow} className="w-full py-2 border-2 border-dashed border-slate-300 rounded-xl text-xs font-bold text-slate-500 hover:border-brand-400 hover:text-brand-600 transition flex items-center justify-center gap-2">
                                      <Plus size={14}/> Tambah Jenjang
                                  </button>
                              </div>
                          )}
                      </div>

                      <div className="grid grid-cols-2 gap-5">
                          <div>
                              <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-1">Mulai Kredit</label>
                              <input type="date" required className="w-full border-2 border-slate-100 p-3 rounded-2xl focus:border-brand-500 outline-none text-sm font-bold" value={formData.startDate} onChange={e=>setFormData({...formData, startDate:e.target.value})} />
                          </div>
                          <div>
                              <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-1">Selesai Kredit</label>
                              <input type="date" required className="w-full border-2 border-slate-100 p-3 rounded-2xl focus:border-brand-500 outline-none text-sm font-bold" value={formData.endDate} onChange={e=>setFormData({...formData, endDate:e.target.value})} />
                          </div>
                      </div>

                      <div className="pt-4 flex gap-4">
                          <button type="button" onClick={()=>setIsModalOpen(false)} className="flex-1 py-4 border-2 border-slate-100 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-500 hover:bg-slate-50">Batal</button>
                          <button type="submit" disabled={isSyncing} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 shadow-xl flex items-center justify-center gap-2">
                              {isSyncing ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>}
                              {editingId ? 'Update Kontrak' : 'Simpan Kontrak'}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
}
