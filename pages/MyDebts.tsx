
import React, { useState, useMemo } from 'react';
import { DebtItem, LoanType, PaymentRecord, DebtInstallment, StepUpRange } from '../types';
import { formatCurrency, generateInstallmentsForDebt } from '../services/financeUtils';
import { pushPartialUpdate, deleteFromCloud } from '../services/cloudSync';
import { Plus, Trash2, Edit2, X, Loader2, TrendingUp, Info, AlertTriangle, Save, Calendar, ChevronDown, ChevronRight, Calculator, PieChart, Table, CheckCircle2, TrendingDown } from 'lucide-react';

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

  // Initial Form State
  const initialForm = { 
    name: '', type: LoanType.KPR, bankName: '', monthlyInstallment: 0, originalPrincipal: 0,
    startDate: new Date().toISOString().split('T')[0], endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 5)).toISOString().split('T')[0], 
    dueDate: 5, interestStrategy: 'Fixed', interestRate: 0, stepUpSchedule: [] as StepUpRange[]
  };
  const [formData, setFormData] = useState(initialForm);

  // Calculations
  const calculatedInfo = useMemo(() => {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      const totalMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
      let totalPayment = formData.monthlyInstallment * (totalMonths > 0 ? totalMonths : 1);
      
      // Rough effective rate calculation
      let effectiveRate = formData.interestRate || 0;
      if (formData.interestStrategy === 'Fixed' && formData.originalPrincipal > 0) {
          const totalInterest = Math.max(0, totalPayment - formData.originalPrincipal);
          effectiveRate = (totalInterest / formData.originalPrincipal) / (totalMonths / 12) * 100;
      }

      return { totalMonths, totalPayment, effectiveRate };
  }, [formData]);

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
    
    const newDebt: DebtItem = {
        id: targetId, userId, name: formData.name, type: formData.type as LoanType, bankName: formData.bankName,
        originalPrincipal: Number(formData.originalPrincipal), monthlyPayment: Number(formData.monthlyInstallment),
        interestRate: formData.interestRate > 0 ? Number(formData.interestRate) : Number(calculatedInfo.effectiveRate.toFixed(2)),
        totalLiability: Number(calculatedInfo.totalPayment), startDate: formData.startDate, endDate: formData.endDate,
        dueDate: formData.dueDate, interestStrategy: formData.interestStrategy as any, stepUpSchedule: formData.stepUpSchedule,
        updatedAt: new Date().toISOString(), _deleted: false, remainingMonths: 0, remainingPrincipal: 0
    };

    // Generate Smart Installments (Client Side)
    const existingInsts = editingId && debtInstallments ? debtInstallments.filter(i => i.debtId === editingId) : [];
    const newInstallments = generateInstallmentsForDebt(newDebt, existingInsts, true); // autoPayHistory=true
    
    // Update Debt Remaining Balance based on generated schedule
    const pendingInstallments = newInstallments.filter(i => i.status !== 'paid');
    newDebt.remainingMonths = pendingInstallments.length;
    newDebt.remainingPrincipal = pendingInstallments.reduce((sum, inst) => sum + inst.principalPart, 0);

    // Sync to Cloud
    const success = await pushPartialUpdate(userId, { 
        debts: [newDebt], 
        debtInstallments: newInstallments 
    });

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

  return (
    <div className="space-y-8 pb-24 animate-fade-in">
      {/* Header */}
      <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h2 className="text-3xl font-black text-slate-900 flex items-center gap-3">
                <TrendingUp className="text-brand-600"/> Portofolio Beban
            </h2>
            <p className="text-slate-500 font-medium mt-1">Kelola kontrak hutang dengan strategi pintar (Smart Calc).</p>
          </div>
          <button onClick={() => { setEditingId(null); setFormData(initialForm); setIsModalOpen(true); }} className="px-8 py-4 bg-slate-900 text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-brand-600 transition shadow-xl transform active:scale-95 flex items-center gap-3">
              <Plus size={18}/> Tambah Kontrak
          </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {activeDebts.length === 0 ? (
              <div className="col-span-full py-20 text-center border-4 border-dashed border-slate-100 rounded-[3rem] text-slate-300">
                  <Info size={48} className="mx-auto mb-4 opacity-20"/>
                  <p className="font-black uppercase tracking-widest">Belum Ada Hutang Terdeteksi</p>
              </div>
          ) : activeDebts.map(debt => {
              const progress = Math.max(5, (1 - (debt.remainingPrincipal / (debt.originalPrincipal || 1))) * 100);
              return (
                  <div key={debt.id} className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm hover:shadow-2xl transition-all group relative overflow-hidden flex flex-col justify-between">
                      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><TrendingUp size={120}/></div>
                      <div>
                          <div className="flex justify-between items-start mb-6 relative z-10">
                              <span className="text-[10px] font-black uppercase bg-brand-50 text-brand-600 px-3 py-1.5 rounded-xl border border-brand-100">{debt.type}</span>
                              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                  <button onClick={() => setViewScheduleId(debt.id)} className="p-2 text-blue-400 hover:text-blue-600 bg-white rounded-lg shadow-sm border border-slate-50" title="Lihat Tabel Cicilan"><Table size={16}/></button>
                                  <button onClick={() => handleEdit(debt)} className="p-2 text-slate-300 hover:text-brand-600 bg-white rounded-lg shadow-sm border border-slate-50"><Edit2 size={16}/></button>
                                  <button onClick={() => handleDelete(debt.id)} className="p-2 text-slate-300 hover:text-red-500 bg-white rounded-lg shadow-sm border border-slate-50"><Trash2 size={16}/></button>
                              </div>
                          </div>
                          <h3 className="font-black text-xl text-slate-900 leading-tight mb-1 truncate">{debt.name}</h3>
                          <div className="flex items-center gap-2 mb-6">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{debt.bankName || 'Pihak Ketiga'}</span>
                              {debt.interestStrategy !== 'Fixed' && <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 rounded font-bold uppercase">{debt.interestStrategy}</span>}
                          </div>
                          <div className="space-y-4">
                              <div>
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Sisa Pokok</p>
                                  <p className="text-3xl font-black text-slate-900 tracking-tighter">{formatCurrency(debt.remainingPrincipal)}</p>
                              </div>
                              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                  <div className={`h-full bg-brand-600 rounded-full`} style={{ width: `${progress}%` }}></div>
                              </div>
                              <p className="text-right text-[9px] text-slate-400 font-bold">{progress.toFixed(0)}% Lunas</p>
                          </div>
                      </div>
                      <div className="mt-8 pt-6 border-t border-slate-50 flex justify-between items-center relative z-10">
                          <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Setoran</p>
                              <p className="font-black text-brand-600">{formatCurrency(debt.monthlyPayment)}</p>
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

      {/* Modal: Schedule Table */}
      {viewScheduleId && (
          <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-fade-in">
              <div className="bg-white rounded-[2rem] w-full max-w-4xl h-[80vh] shadow-2xl border border-white/20 flex flex-col overflow-hidden">
                  <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                      <div>
                          <h3 className="text-xl font-black text-slate-900 flex items-center gap-2"><Calendar size={20} className="text-brand-600"/> Tabel Estimasi Cicilan</h3>
                          <p className="text-xs text-slate-500 font-medium">Jadwal lengkap pembayaran untuk hutang ini.</p>
                      </div>
                      <button onClick={() => setViewScheduleId(null)} className="p-2 hover:bg-slate-200 rounded-full transition"><X size={20}/></button>
                  </div>
                  <div className="flex-1 overflow-auto custom-scrollbar p-6">
                      <table className="w-full text-sm text-left">
                          <thead className="text-xs text-slate-500 uppercase bg-slate-100 font-black tracking-wider sticky top-0 border-b shadow-sm">
                              <tr>
                                  <th className="px-6 py-3">#</th>
                                  <th className="px-6 py-3">Jatuh Tempo</th>
                                  <th className="px-6 py-3">Nominal</th>
                                  <th className="px-6 py-3">Pokok</th>
                                  <th className="px-6 py-3">Bunga</th>
                                  <th className="px-6 py-3">Sisa</th>
                                  <th className="px-6 py-3 text-center">Status</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                              {currentSchedule.map((inst) => (
                                  <tr key={inst.id} className="hover:bg-slate-50 transition">
                                      <td className="px-6 py-4 font-bold text-slate-700">{inst.period}</td>
                                      <td className="px-6 py-4 font-mono text-slate-500">{new Date(inst.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                                      <td className="px-6 py-4 font-bold text-brand-600">{formatCurrency(inst.amount)}</td>
                                      <td className="px-6 py-4 text-slate-600 text-xs">{formatCurrency(inst.principalPart)}</td>
                                      <td className="px-6 py-4 text-slate-600 text-xs">{formatCurrency(inst.interestPart)}</td>
                                      <td className="px-6 py-4 text-slate-400 text-xs">{formatCurrency(inst.remainingBalance)}</td>
                                      <td className="px-6 py-4 text-center">
                                          <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${inst.status === 'paid' ? 'bg-green-100 text-green-600' : inst.status === 'overdue' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>{inst.status}</span>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      {/* Modal: Form */}
      {isModalOpen && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4 animate-fade-in overflow-y-auto">
              <div className="bg-white rounded-[3rem] w-full max-w-2xl p-8 shadow-2xl border border-white/20 my-10 relative">
                  <button onClick={()=>setIsModalOpen(false)} className="absolute top-8 right-8 p-3 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><X size={28}/></button>
                  <div className="flex flex-col gap-1 mb-8">
                      <h3 className="text-2xl font-black text-slate-900 tracking-tighter">{editingId ? 'Edit Kontrak' : 'Kontrak Baru'}</h3>
                      <p className="text-xs text-slate-500 font-medium">Smart System: Tanggal masa lalu akan otomatis ditandai LUNAS.</p>
                  </div>
                  <form onSubmit={handleSubmit} className="space-y-6">
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
                      <div className="grid grid-cols-2 gap-5">
                          <div className="col-span-2 md:col-span-1">
                              <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-1">Pokok Awal (Pinjaman)</label>
                              <input type="number" required className="w-full border-2 border-slate-100 p-4 rounded-2xl focus:border-brand-500 outline-none font-black text-lg" value={formData.originalPrincipal} onChange={e=>setFormData({...formData, originalPrincipal:Number(e.target.value)})} />
                          </div>
                          <div className="col-span-2 md:col-span-1">
                              <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-1">Cicilan / Bulan (Estimasi)</label>
                              <input type="number" required className="w-full border-2 border-slate-100 p-4 rounded-2xl focus:border-brand-500 outline-none font-black text-lg text-brand-600" value={formData.monthlyInstallment} onChange={e=>setFormData({...formData, monthlyInstallment:Number(e.target.value)})} />
                          </div>
                          <div>
                              <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-1">Mulai Kredit</label>
                              <input type="date" required className="w-full border-2 border-slate-100 p-3 rounded-2xl focus:border-brand-500 outline-none text-sm font-bold" value={formData.startDate} onChange={e=>setFormData({...formData, startDate:e.target.value})} />
                          </div>
                          <div>
                              <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-1">Selesai Kredit</label>
                              <input type="date" required className="w-full border-2 border-slate-100 p-3 rounded-2xl focus:border-brand-500 outline-none text-sm font-bold" value={formData.endDate} onChange={e=>setFormData({...formData, endDate:e.target.value})} />
                          </div>
                      </div>
                      <div className="bg-slate-50 p-5 rounded-[2rem] border border-slate-200">
                          <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-3 flex items-center gap-2"><Calculator size={14}/> Strategi Bunga</h4>
                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Metode Perhitungan</label>
                                  <select className="w-full border-2 border-slate-200 p-2 rounded-xl focus:border-brand-500 outline-none font-bold text-sm bg-white" value={formData.interestStrategy} onChange={e=>setFormData({...formData, interestStrategy: e.target.value as any})}>
                                      <option value="Fixed">Flat (Bunga Tetap)</option>
                                      <option value="Annuity">Efektif (Anuitas/KPR)</option>
                                      <option value="StepUp">Step-Up (Berjenjang)</option>
                                  </select>
                              </div>
                              <div>
                                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Bunga (p.a %)</label>
                                  <input type="number" step="0.1" className="w-full border-2 border-slate-200 p-2 rounded-xl focus:border-brand-500 outline-none font-bold text-sm" value={formData.interestRate} onChange={e=>setFormData({...formData, interestRate:Number(e.target.value)})} placeholder="Auto if 0" />
                              </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 border-t border-slate-200 pt-3 mt-4">
                              <div><p className="text-[10px] text-slate-400 font-bold uppercase">Estimasi Bunga</p><p className="text-xl font-black text-slate-800">{calculatedInfo.effectiveRate.toFixed(2)}%</p></div>
                              <div><p className="text-[10px] text-slate-400 font-bold uppercase">Total Bayar</p><p className="text-xl font-black text-slate-800">{formatCurrency(calculatedInfo.totalPayment)}</p></div>
                          </div>
                      </div>
                      <div className="pt-4 flex gap-4">
                          <button type="button" onClick={()=>setIsModalOpen(false)} className="flex-1 py-4 border-2 border-slate-100 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-500 hover:bg-slate-50">Batal</button>
                          <button type="submit" disabled={isSyncing} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 shadow-xl flex items-center justify-center gap-2">
                              {isSyncing ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>}
                              {editingId ? 'Update & Sync' : 'Simpan & Generate'}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
}
