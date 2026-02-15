
import React, { useState, useEffect, useMemo } from 'react';
import { DebtItem, LoanType, PaymentRecord, DebtInstallment, StepUpRange } from '../types';
import { formatCurrency, generateInstallmentsForDebt, calculatePMT } from '../services/financeUtils';
import { pushPartialUpdate, deleteFromCloud } from '../services/cloudSync';
import { Plus, Trash2, Edit2, X, Loader2, TrendingUp, Info, Save, Calendar, Calculator, Table, CheckCircle2, DollarSign, Clock, Percent, ArrowRightLeft, CreditCard, ShieldAlert } from 'lucide-react';

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
  const [viewScheduleId, setViewScheduleId] = useState<string | null>(null);

  // --- SMART CALCULATION STATE ---
  const [calcMode, setCalcMode] = useState<'find_installment' | 'find_rate'>('find_installment');

  // Initial Form State
  const initialForm = { 
    name: '', type: LoanType.KPR, bankName: '', monthlyInstallment: 0, originalPrincipal: 0,
    startDate: new Date().toISOString().split('T')[0], endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 5)).toISOString().split('T')[0], 
    dueDate: 5, interestStrategy: 'Fixed', interestRate: 0, stepUpSchedule: [] as StepUpRange[]
  };
  const [formData, setFormData] = useState(initialForm);

  // --- SMART CALCULATOR EFFECT ---
  useEffect(() => {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
      const tenorMonths = months > 0 ? months : 1;

      if (calcMode === 'find_installment') {
          if (formData.originalPrincipal > 0 && formData.interestRate > 0) {
              const ratePerMonth = (formData.interestRate / 100) / 12;
              let pmt = 0;
              if (formData.interestStrategy === 'Fixed') {
                  const totalInterest = formData.originalPrincipal * (formData.interestRate / 100) * (tenorMonths / 12);
                  pmt = (formData.originalPrincipal + totalInterest) / tenorMonths;
              } else {
                  pmt = calculatePMT(ratePerMonth, tenorMonths, formData.originalPrincipal);
              }
              if (Math.abs(pmt - formData.monthlyInstallment) > 100) {
                  setFormData(prev => ({ ...prev, monthlyInstallment: Math.round(pmt) }));
              }
          }
      } else {
          if (formData.originalPrincipal > 0 && formData.monthlyInstallment > 0) {
              const totalPay = formData.monthlyInstallment * tenorMonths;
              const totalInterest = Math.max(0, totalPay - formData.originalPrincipal);
              const rate = ((totalInterest / formData.originalPrincipal) / (tenorMonths / 12)) * 100;
              if (Math.abs(rate - formData.interestRate) > 0.1) {
                  setFormData(prev => ({ ...prev, interestRate: Number(rate.toFixed(2)) }));
              }
          }
      }
  }, [formData.originalPrincipal, formData.startDate, formData.endDate, calcMode, calcMode === 'find_installment' ? formData.interestRate : formData.monthlyInstallment, formData.interestStrategy]);

  const activeDebts = useMemo(() => (debts || []).filter(d => !d._deleted), [debts]);
  const currentSchedule = useMemo(() => {
      if (!viewScheduleId) return [];
      return debtInstallments.filter(i => i.debtId === viewScheduleId).sort((a, b) => a.period - b.period);
  }, [viewScheduleId, debtInstallments]);

  // Actions
  const handleEdit = (debt: DebtItem) => {
      setEditingId(debt.id);
      let parsedSchedule: StepUpRange[] = [];
      if (typeof debt.stepUpSchedule === 'string') { try { parsedSchedule = JSON.parse(debt.stepUpSchedule); } catch(e) {} } 
      else if (Array.isArray(debt.stepUpSchedule)) { parsedSchedule = debt.stepUpSchedule; }

      setFormData({
          name: debt.name, type: debt.type, bankName: debt.bankName || '', monthlyInstallment: debt.monthlyPayment,
          originalPrincipal: debt.originalPrincipal, startDate: debt.startDate, endDate: debt.endDate, dueDate: debt.dueDate || 5,
          interestStrategy: debt.interestStrategy || 'Fixed', interestRate: debt.interestRate || 0, stepUpSchedule: parsedSchedule
      });
      setCalcMode('find_rate');
      setIsModalOpen(true);
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
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    const months = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()));
    const totalLiability = formData.monthlyInstallment * months;

    const newDebt: DebtItem = {
        id: targetId, userId, name: formData.name, type: formData.type as LoanType, bankName: formData.bankName,
        originalPrincipal: Number(formData.originalPrincipal), monthlyPayment: Number(formData.monthlyInstallment),
        interestRate: Number(formData.interestRate),
        totalLiability: totalLiability, startDate: formData.startDate, endDate: formData.endDate,
        dueDate: Number(formData.dueDate), interestStrategy: formData.interestStrategy as any, stepUpSchedule: formData.stepUpSchedule,
        updatedAt: new Date().toISOString(), _deleted: false, remainingMonths: 0, remainingPrincipal: 0
    };

    const existingInsts = editingId && debtInstallments ? debtInstallments.filter(i => i.debtId === editingId) : [];
    const newInstallments = generateInstallmentsForDebt(newDebt, existingInsts, true); 
    
    const pendingInstallments = newInstallments.filter(i => i.status !== 'paid');
    newDebt.remainingMonths = pendingInstallments.length;
    newDebt.remainingPrincipal = pendingInstallments.reduce((sum, inst) => sum + inst.principalPart, 0);

    const success = await pushPartialUpdate(userId, { debts: [newDebt], debtInstallments: newInstallments });

    if (success) {
        setDebts(prev => editingId ? prev.map(d => d.id === editingId ? newDebt : d) : [...prev, newDebt]);
        if (setDebtInstallments) {
            setDebtInstallments(prev => {
                const filtered = prev.filter(i => i.debtId !== targetId);
                return [...filtered, ...newInstallments];
            });
        }
        setIsModalOpen(false);
        setEditingId(null);
        setFormData(initialForm);
    } else {
        alert("Gagal sinkronisasi ke Cloud. Cek koneksi internet.");
    }
    setIsSyncing(false);
  };

  const totalOutstanding = activeDebts.reduce((a,b)=>a+b.remainingPrincipal,0);
  const totalMonthly = activeDebts.reduce((a,b)=>a+b.monthlyPayment,0);

  return (
    <div className="space-y-8 pb-24 animate-fade-in font-sans">
      
      {/* 1. HERO SUMMARY CARD */}
      <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 p-12 opacity-10"><TrendingUp size={180}/></div>
          <div className="relative z-10 grid md:grid-cols-2 gap-8 items-center">
              <div>
                  <h2 className="text-3xl font-black mb-2 tracking-tight">Portofolio Kewajiban</h2>
                  <p className="text-slate-400 text-sm mb-6">Kelola kontrak hutang, simulasi bunga, dan lacak sisa pokok secara real-time.</p>
                  <button onClick={() => { setEditingId(null); setFormData(initialForm); setCalcMode('find_installment'); setIsModalOpen(true); }} className="bg-white text-slate-900 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-brand-50 transition shadow-lg flex items-center gap-2 transform active:scale-95">
                      <Plus size={16}/> Kontrak Baru
                  </button>
              </div>
              <div className="flex gap-4">
                  <div className="flex-1 bg-white/10 backdrop-blur-md border border-white/10 p-5 rounded-2xl">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Outstanding</p>
                      <p className="text-2xl font-black">{formatCurrency(totalOutstanding)}</p>
                  </div>
                  <div className="flex-1 bg-white/10 backdrop-blur-md border border-white/10 p-5 rounded-2xl">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Beban Bulanan</p>
                      <p className="text-2xl font-black text-red-300">{formatCurrency(totalMonthly)}</p>
                  </div>
              </div>
          </div>
      </div>

      {/* 2. DEBT CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeDebts.length === 0 ? (
              <div className="col-span-full py-24 text-center border-4 border-dashed border-slate-200 rounded-[3rem] text-slate-400 bg-slate-50/50">
                  <CreditCard size={64} className="mx-auto mb-4 opacity-20"/>
                  <p className="font-black uppercase tracking-widest text-sm">Belum Ada Hutang (Bagus!)</p>
                  <p className="text-xs text-slate-400 mt-1">Atau tambahkan jika ada yang tersembunyi.</p>
              </div>
          ) : activeDebts.map(debt => {
              const progress = Math.max(5, (1 - (debt.remainingPrincipal / (debt.originalPrincipal || 1))) * 100);
              const isDanger = (debt.interestRate || 0) > 10;
              
              return (
                  <div key={debt.id} className="group bg-white rounded-[2.5rem] p-6 border border-slate-200 shadow-sm hover:shadow-2xl hover:border-brand-200 transition-all relative overflow-hidden flex flex-col justify-between h-full">
                      {/* Card Header */}
                      <div className="flex justify-between items-start mb-4 relative z-10">
                          <div className={`p-3 rounded-2xl ${isDanger ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                              {debt.type === 'KPR' ? <CreditCard size={20}/> : <CreditCard size={20}/>} 
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => setViewScheduleId(debt.id)} className="p-2 text-slate-400 hover:text-brand-600 bg-white border rounded-xl hover:shadow-md transition"><Table size={16}/></button>
                              <button onClick={() => handleEdit(debt)} className="p-2 text-slate-400 hover:text-brand-600 bg-white border rounded-xl hover:shadow-md transition"><Edit2 size={16}/></button>
                              <button onClick={() => handleDelete(debt.id)} className="p-2 text-slate-400 hover:text-red-600 bg-white border rounded-xl hover:shadow-md transition"><Trash2 size={16}/></button>
                          </div>
                      </div>

                      {/* Content */}
                      <div className="relative z-10 flex-1">
                          <div className="flex justify-between items-center mb-1">
                              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{debt.bankName || 'Vendor'}</span>
                              <span className="text-[10px] font-black bg-slate-100 px-2 py-0.5 rounded text-slate-600 uppercase">{debt.interestStrategy}</span>
                          </div>
                          <h3 className="text-lg font-black text-slate-900 leading-tight mb-4 line-clamp-2">{debt.name}</h3>
                          
                          <div className="space-y-3 mb-6">
                              <div className="flex justify-between items-end">
                                  <span className="text-xs text-slate-500 font-medium">Sisa Pokok</span>
                                  <span className="text-xl font-black text-slate-900 tracking-tight">{formatCurrency(debt.remainingPrincipal)}</span>
                              </div>
                              
                              {/* Progress Bar */}
                              <div className="relative w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div className={`absolute top-0 left-0 h-full rounded-full ${isDanger ? 'bg-red-500' : 'bg-brand-600'}`} style={{width: `${progress}%`}}></div>
                              </div>
                              <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase">
                                  <span>{progress.toFixed(0)}% Lunas</span>
                                  <span>{debt.remainingMonths} Bulan Lagi</span>
                              </div>
                          </div>
                      </div>

                      {/* Footer */}
                      <div className="pt-4 border-t border-slate-100 relative z-10 flex justify-between items-center">
                          <div>
                              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Setoran</p>
                              <p className={`font-black ${isDanger ? 'text-red-600' : 'text-brand-600'}`}>{formatCurrency(debt.monthlyPayment)}</p>
                          </div>
                          <div className="text-right">
                              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Tempo</p>
                              <div className="flex items-center gap-1 justify-end font-bold text-slate-700">
                                  <Calendar size={12}/> Tgl {debt.dueDate}
                              </div>
                          </div>
                      </div>
                  </div>
              );
          })}
      </div>

      {/* Modal: Schedule Table */}
      {viewScheduleId && (
          <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-fade-in">
              <div className="bg-white rounded-[2.5rem] w-full max-w-4xl h-[85vh] shadow-2xl border border-white/20 flex flex-col overflow-hidden">
                  <div className="p-8 border-b flex justify-between items-center bg-slate-50/50">
                      <div>
                          <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3"><Table size={24} className="text-brand-600"/> Jadwal Amortisasi</h3>
                          <p className="text-sm text-slate-500 font-medium mt-1">Rincian pembayaran pokok vs bunga per bulan.</p>
                      </div>
                      <button onClick={() => setViewScheduleId(null)} className="p-3 hover:bg-slate-100 rounded-full transition text-slate-400 hover:text-slate-600"><X size={24}/></button>
                  </div>
                  <div className="flex-1 overflow-auto custom-scrollbar p-0">
                      <table className="w-full text-sm text-left">
                          <thead className="text-xs text-slate-500 uppercase bg-white font-black tracking-wider sticky top-0 border-b shadow-sm z-10">
                              <tr>
                                  <th className="px-8 py-4">Periode</th>
                                  <th className="px-6 py-4">Jatuh Tempo</th>
                                  <th className="px-6 py-4">Total Bayar</th>
                                  <th className="px-6 py-4 text-brand-600">Porsi Pokok</th>
                                  <th className="px-6 py-4 text-red-500">Porsi Bunga</th>
                                  <th className="px-6 py-4">Sisa Hutang</th>
                                  <th className="px-6 py-4 text-center">Status</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                              {currentSchedule.map((inst) => (
                                  <tr key={inst.id} className="hover:bg-brand-50/30 transition group">
                                      <td className="px-8 py-4 font-bold text-slate-700">#{inst.period}</td>
                                      <td className="px-6 py-4 font-mono text-slate-500 text-xs">{new Date(inst.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                                      <td className="px-6 py-4 font-bold text-slate-900">{formatCurrency(inst.amount)}</td>
                                      <td className="px-6 py-4 text-brand-700 font-medium text-xs">{formatCurrency(inst.principalPart)}</td>
                                      <td className="px-6 py-4 text-red-600 font-medium text-xs">{formatCurrency(inst.interestPart)}</td>
                                      <td className="px-6 py-4 text-slate-400 text-xs font-mono">{formatCurrency(inst.remainingBalance)}</td>
                                      <td className="px-6 py-4 text-center">
                                          <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider border ${inst.status === 'paid' ? 'bg-green-50 text-green-600 border-green-100' : inst.status === 'overdue' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>{inst.status}</span>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      {/* Modal: SMART FORM (REDESIGNED) */}
      {isModalOpen && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4 animate-fade-in overflow-y-auto">
              <div className="bg-white rounded-[2.5rem] w-full max-w-3xl shadow-2xl border border-white/20 my-10 relative flex flex-col overflow-hidden animate-slide-up">
                  
                  {/* Header */}
                  <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <div>
                          <h3 className="text-2xl font-black text-slate-900 tracking-tighter flex items-center gap-2">
                              {editingId ? <Edit2 className="text-brand-600" size={24}/> : <Plus className="text-brand-600" size={24}/>}
                              {editingId ? 'Edit Kontrak' : 'Kontrak Baru'}
                          </h3>
                          <p className="text-xs text-slate-500 font-medium mt-1">Isi detail pinjaman untuk perhitungan otomatis.</p>
                      </div>
                      <button onClick={()=>setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"><X size={24}/></button>
                  </div>

                  <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar">
                      <div className="p-8 space-y-8">
                          
                          {/* SECTION 1: IDENTITY */}
                          <div className="space-y-4">
                              <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                  <Info size={14}/> Identitas Pinjaman
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                  <div className="col-span-full md:col-span-1">
                                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Nama Hutang</label>
                                      <input type="text" required className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl focus:border-brand-500 outline-none font-bold text-slate-800 transition-all" value={formData.name} onChange={e=>setFormData({...formData, name:e.target.value})} placeholder="Misal: KPR Rumah" />
                                  </div>
                                  <div>
                                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Kategori</label>
                                      <select className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl focus:border-brand-500 outline-none font-bold text-slate-800 transition-all" value={formData.type} onChange={e=>setFormData({...formData, type: e.target.value as LoanType})}>
                                          <option value={LoanType.KPR}>KPR (Rumah)</option>
                                          <option value={LoanType.KKB}>KKB (Kendaraan)</option>
                                          <option value={LoanType.KTA}>KTA (Cash)</option>
                                          <option value={LoanType.CC}>Kartu Kredit</option>
                                      </select>
                                  </div>
                                  <div className="col-span-full md:col-span-2">
                                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Bank / Pemberi Pinjaman</label>
                                      <input type="text" className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl focus:border-brand-500 outline-none font-bold text-slate-800 transition-all" value={formData.bankName} onChange={e=>setFormData({...formData, bankName:e.target.value})} placeholder="Nama Bank atau Leasing" />
                                  </div>
                              </div>
                          </div>

                          {/* SECTION 2: SMART CALCULATOR */}
                          <div className="bg-brand-50/50 rounded-[2rem] p-6 border-2 border-brand-100/50 relative overflow-hidden">
                              <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none"><Calculator size={100} className="text-brand-600"/></div>
                              
                              <div className="flex justify-between items-center mb-6 relative z-10">
                                  <h4 className="text-xs font-black text-brand-700 uppercase tracking-[0.2em] flex items-center gap-2">
                                      <Calculator size={14}/> Kalkulator Pintar
                                  </h4>
                                  
                                  {/* TOGGLE MODE */}
                                  <div className="flex bg-white p-1 rounded-lg border border-brand-200 shadow-sm">
                                      <button 
                                        type="button" 
                                        onClick={() => setCalcMode('find_installment')}
                                        className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all flex items-center gap-1 ${calcMode === 'find_installment' ? 'bg-brand-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
                                      >
                                          Hitung Cicilan
                                      </button>
                                      <button 
                                        type="button" 
                                        onClick={() => setCalcMode('find_rate')}
                                        className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all flex items-center gap-1 ${calcMode === 'find_rate' ? 'bg-brand-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
                                      >
                                          Hitung Bunga
                                      </button>
                                  </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                                  {/* POKOK */}
                                  <div className="col-span-full">
                                      <label className="block text-[10px] font-bold text-brand-800/60 uppercase mb-1.5">Pokok Pinjaman (Plafond)</label>
                                      <div className="relative group">
                                          <DollarSign className="absolute left-4 top-4 text-brand-400 group-focus-within:text-brand-600 transition-colors" size={20}/>
                                          <input type="number" required className="w-full pl-12 pr-4 py-4 bg-white border-2 border-brand-100 rounded-2xl focus:border-brand-500 outline-none font-black text-2xl text-slate-800 shadow-sm transition-all" value={formData.originalPrincipal} onChange={e=>setFormData({...formData, originalPrincipal:Number(e.target.value)})} placeholder="0" />
                                      </div>
                                  </div>

                                  {/* DATE RANGE (TENOR) */}
                                  <div>
                                      <label className="block text-[10px] font-bold text-brand-800/60 uppercase mb-1.5">Mulai Kredit</label>
                                      <div className="relative">
                                          <input type="date" required className="w-full pl-4 pr-4 py-3 bg-white border-2 border-brand-100 rounded-xl focus:border-brand-500 outline-none font-bold text-sm text-slate-700" value={formData.startDate} onChange={e=>setFormData({...formData, startDate:e.target.value})} />
                                      </div>
                                  </div>
                                  <div>
                                      <label className="block text-[10px] font-bold text-brand-800/60 uppercase mb-1.5">Selesai Kredit</label>
                                      <div className="relative">
                                          <input type="date" required className="w-full pl-4 pr-4 py-3 bg-white border-2 border-brand-100 rounded-xl focus:border-brand-500 outline-none font-bold text-sm text-slate-700" value={formData.endDate} onChange={e=>setFormData({...formData, endDate:e.target.value})} />
                                      </div>
                                  </div>

                                  {/* DYNAMIC FIELDS BASED ON MODE */}
                                  <div>
                                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 flex justify-between">
                                          <span>Bunga (p.a)</span>
                                          {calcMode === 'find_rate' && <span className="text-brand-600 bg-brand-100 px-1.5 rounded text-[9px] font-black">AUTO</span>}
                                      </label>
                                      <div className="relative">
                                          <input 
                                            type="number" step="0.01" 
                                            className={`w-full pl-4 pr-10 py-3 border-2 rounded-xl outline-none font-bold text-lg transition-all ${calcMode === 'find_rate' ? 'bg-slate-100 text-slate-500 border-transparent cursor-not-allowed' : 'bg-white border-brand-100 text-slate-800 focus:border-brand-500'}`}
                                            value={formData.interestRate} 
                                            onChange={e=>setFormData({...formData, interestRate:Number(e.target.value)})}
                                            readOnly={calcMode === 'find_rate'}
                                          />
                                          <Percent className="absolute right-4 top-4 text-slate-400" size={16}/>
                                      </div>
                                  </div>

                                  <div>
                                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 flex justify-between">
                                          <span>Cicilan / Bulan</span>
                                          {calcMode === 'find_installment' && <span className="text-brand-600 bg-brand-100 px-1.5 rounded text-[9px] font-black">AUTO</span>}
                                      </label>
                                      <input 
                                        type="number" 
                                        className={`w-full px-4 py-3 border-2 rounded-xl outline-none font-bold text-lg transition-all ${calcMode === 'find_installment' ? 'bg-slate-100 text-slate-500 border-transparent cursor-not-allowed' : 'bg-white border-brand-100 text-slate-800 focus:border-brand-500'}`}
                                        value={formData.monthlyInstallment} 
                                        onChange={e=>setFormData({...formData, monthlyInstallment:Number(e.target.value)})}
                                        readOnly={calcMode === 'find_installment'}
                                      />
                                  </div>
                              </div>

                              <div className="mt-4 pt-4 border-t border-brand-200/50 grid grid-cols-2 gap-4 relative z-10">
                                  <div>
                                      <label className="block text-[10px] font-bold text-brand-800/60 uppercase mb-1">Strategi Bunga</label>
                                      <select className="w-full bg-white border-2 border-brand-100 p-2 rounded-lg text-xs font-bold focus:border-brand-500 outline-none" value={formData.interestStrategy} onChange={e=>setFormData({...formData, interestStrategy: e.target.value as any})}>
                                          <option value="Fixed">Flat (Tetap)</option>
                                          <option value="Annuity">Efektif (KPR/Anuitas)</option>
                                          <option value="StepUp">Step-Up (Berjenjang)</option>
                                      </select>
                                  </div>
                                  <div className="text-right">
                                      <p className="text-[10px] font-bold text-brand-800/60 uppercase">Estimasi Total Bayar</p>
                                      <p className="text-lg font-black text-brand-700 mt-1">
                                          {formatCurrency(formData.monthlyInstallment * Math.max(1, (new Date(formData.endDate).getFullYear() - new Date(formData.startDate).getFullYear()) * 12 + (new Date(formData.endDate).getMonth() - new Date(formData.startDate).getMonth())))}
                                      </p>
                                  </div>
                              </div>
                          </div>

                          {/* SECTION 3: SCHEDULE */}
                          <div className="space-y-4">
                              <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                  <Clock size={14}/> Jadwal Pembayaran
                              </h4>
                              
                              <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-100 flex items-center justify-between">
                                  <div>
                                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tanggal Jatuh Tempo (Per Bulan)</label>
                                      <div className="flex items-center gap-3">
                                          <Calendar size={18} className="text-slate-400"/>
                                          <span className="text-sm font-bold text-slate-700">Setiap Tanggal</span>
                                          <select 
                                            className="bg-white border-2 border-slate-200 p-2 rounded-lg font-black text-slate-800 focus:border-brand-500 outline-none w-20 text-center"
                                            value={formData.dueDate}
                                            onChange={e => setFormData({...formData, dueDate: Number(e.target.value)})}
                                          >
                                              {Array.from({length: 31}, (_, i) => i + 1).map(d => (
                                                  <option key={d} value={d}>{d}</option>
                                              ))}
                                          </select>
                                      </div>
                                  </div>
                                  <div className="text-right">
                                      <p className="text-[10px] font-bold text-slate-400 uppercase">Jadwal Berikutnya</p>
                                      <p className="text-sm font-black text-slate-800 mt-1">
                                          Tgl {formData.dueDate}, Bulan Depan
                                      </p>
                                  </div>
                              </div>
                          </div>

                      </div>
                  </form>

                  {/* Footer Actions */}
                  <div className="p-6 border-t border-slate-100 bg-white flex gap-4">
                      <button type="button" onClick={()=>setIsModalOpen(false)} className="flex-1 py-4 border-2 border-slate-100 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-colors">Batal</button>
                      <button onClick={handleSubmit} disabled={isSyncing} className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 shadow-xl flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-70">
                          {isSyncing ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>}
                          {editingId ? 'Simpan Perubahan' : 'Generate Jadwal'}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
