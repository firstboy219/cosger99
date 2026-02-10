
import React, { useState, useEffect, useMemo } from 'react';
import { DebtItem, LoanType, PaymentRecord, DebtInstallment } from '../types';
import { formatCurrency, calculateSmartDebtDetails, calculateImpliedInterestRate, generateGlobalProjection, checkRefinanceOpportunity, safeDateISO } from '../services/financeUtils';
import { parseTransactionAI } from '../services/geminiService';
import { getUserData, saveUserData, getConfig, getAllUsers } from '../services/mockDb';
import { pullUserDataFromCloud, pushUserDataToCloud } from '../services/cloudSync';
import { Plus, Trash2, X, ReceiptText, Zap, Sparkles, PlusCircle, MinusCircle, Loader2, TrendingUp, Copy, Lock, RefreshCw } from 'lucide-react';
import { addLogEntry } from '../services/activityLogger';

interface MyDebtsProps {
  debts: DebtItem[];
  setDebts: React.Dispatch<React.SetStateAction<DebtItem[]>>;
  paymentRecords: PaymentRecord[];
  setPaymentRecords: React.Dispatch<React.SetStateAction<PaymentRecord[]>>;
  userId: string;
  debtInstallments?: DebtInstallment[];
  setDebtInstallments?: React.Dispatch<React.SetStateAction<DebtInstallment[]>>;
}

interface StepUpRow {
    startMonth: number;
    endMonth: number;
    amount: number;
}

export default function MyDebts({ debts, setDebts, paymentRecords, setPaymentRecords, userId, debtInstallments, setDebtInstallments }: MyDebtsProps) {
  const [strategy, setStrategy] = useState<'snowball' | 'avalanche'>('avalanche');
  const [accelerationAmount, setAccelerationAmount] = useState<number>(1000000); 
  const [isSyncing, setIsSyncing] = useState(false);

  // --- 1. SMART SORTING & FILTERING (HIDE DELETED) ---
  const sortedDebts = useMemo(() => {
      // Filter out soft-deleted items
      const activeDebts = debts.filter(d => !d._deleted);
      return activeDebts.sort((a, b) => strategy === 'snowball' ? a.remainingPrincipal - b.remainingPrincipal : b.interestRate - a.interestRate);
  }, [debts, strategy]);

  // --- 2. SIMULATION ---
  const simulationResult = useMemo(() => {
      const activeDebts = debts.filter(d => !d._deleted);
      if (!activeDebts || activeDebts.length === 0) return { data: [], savedInterest: 0, monthsSaved: 0 };
      return generateGlobalProjection(activeDebts, accelerationAmount, strategy);
  }, [debts, accelerationAmount, strategy]);

  // --- CRUD States ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [aiParsing, setAiParsing] = useState(false);
  const [smartInputText, setSmartInputText] = useState('');
  
  const initialForm = { 
      name: '', type: LoanType.KPR, bankName: '', monthlyInstallment: 0, principal: 0, 
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 15)).toISOString().split('T')[0],
      dueDate: 5, isStepUp: false, stepUpRows: [] as StepUpRow[]
  };
  const [formData, setFormData] = useState(initialForm);
  const [calculatedPreview, setCalculatedPreview] = useState<any>(null);

  useEffect(() => {
      // Auto calculate Preview whenever relevant fields change
      const relevantPayment = formData.isStepUp ? 0 : formData.monthlyInstallment;
      const relevantSchedule = formData.isStepUp ? formData.stepUpRows : [];

      if ((relevantPayment > 0 || (formData.isStepUp && relevantSchedule.length > 0)) && formData.startDate && formData.endDate) {
          const s = new Date(formData.startDate);
          const e = new Date(formData.endDate);
          if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
              const details = calculateSmartDebtDetails(
                  relevantPayment, 
                  formData.startDate, 
                  formData.endDate, 
                  relevantSchedule
              );
              setCalculatedPreview(details);
          } else {
              setCalculatedPreview(null);
          }
      } else { 
          setCalculatedPreview(null); 
      }
  }, [formData.monthlyInstallment, formData.startDate, formData.endDate, formData.isStepUp, formData.stepUpRows]);

  const handleOpenAdd = () => { setEditingId(null); setFormData(initialForm); setCalculatedPreview(null); setIsModalOpen(true); };

  const formatDateForInput = (dateStr?: string | Date) => {
      return safeDateISO(dateStr);
  };

  const handleOpenEdit = (e: React.MouseEvent, debt: DebtItem) => { 
      e.stopPropagation(); setEditingId(debt.id); 
      
      const rawStrategy = (debt.interestStrategy || 'FIXED').toString().toUpperCase().trim();
      const isStepUp = rawStrategy.includes('STEP');
      const rows = (isStepUp && Array.isArray(debt.stepUpSchedule)) ? debt.stepUpSchedule : [];

      setFormData({
          name: debt.name, type: debt.type, bankName: debt.bankName || '', monthlyInstallment: debt.monthlyPayment,
          principal: debt.originalPrincipal, 
          startDate: formatDateForInput(debt.startDate), 
          endDate: formatDateForInput(debt.endDate), 
          dueDate: debt.dueDate,
          isStepUp: isStepUp, 
          stepUpRows: rows
      });
      setIsModalOpen(true); 
  };

  const handleDuplicate = async (e: React.MouseEvent, debt: DebtItem) => {
      e.stopPropagation();
      const rawStrategy = (debt.interestStrategy || 'FIXED').toString().toUpperCase().trim();
      const isStepUp = rawStrategy.includes('STEP');
      const rows = (isStepUp && Array.isArray(debt.stepUpSchedule)) ? debt.stepUpSchedule : [];

      setFormData({
          name: `${debt.name} (Copy)`,
          type: debt.type, 
          bankName: debt.bankName || '', 
          monthlyInstallment: debt.monthlyPayment,
          principal: debt.originalPrincipal, 
          startDate: formatDateForInput(debt.startDate), 
          endDate: formatDateForInput(debt.endDate), 
          dueDate: debt.dueDate,
          isStepUp: isStepUp, 
          stepUpRows: rows
      });

      setEditingId(null); 
      setCalculatedPreview(null);
      setIsModalOpen(true);
  };

  // --- V44.5 SAFE MODE DELETE (SOFT DELETE) ---
  const handleDelete = async (e: React.MouseEvent, id: string) => { 
      e.stopPropagation(); 
      if (!window.confirm('Hapus hutang ini? Data akan ditandai hapus dan disinkronkan ke server.')) return;

      setIsSyncing(true);
      
      try {
          // 1. SOFT DELETE LOCALLY
          // Mark as _deleted instead of filtering out
          const newDebts = debts.map(d => d.id === id ? { ...d, _deleted: true, updatedAt: new Date().toISOString() } : d);
          setDebts(newDebts); // UI will update because filtered view ignores _deleted
          
          // We also need to soft-delete related installments logic if present, or just leave them until sync cleanup
          // For safety, let's mark installments too if we have them in state
          if (setDebtInstallments && debtInstallments) {
              const newInstallments = debtInstallments.map(inst => inst.debtId === id ? { ...inst, _deleted: true, updatedAt: new Date().toISOString() } : inst);
              setDebtInstallments(newInstallments);
              
              const currentData = getUserData(userId);
              saveUserData(userId, { ...currentData, debts: newDebts, debtInstallments: newInstallments });
          } else {
              const currentData = getUserData(userId);
              saveUserData(userId, { ...currentData, debts: newDebts });
          }

          // 2. TRIGGER SYNC (Push Deletions)
          // Ideally App.tsx handles auto-sync, but we can trigger it manually for feedback
          // If in "manual mode", this just saves locally until user clicks Sync
          const config = getConfig();
          if (config.advancedConfig?.syncStrategy === 'background') {
             // Let the background process handle it or trigger immediate push
             // For now, we simulate success locally
          }

      } catch(err) {
          console.error("Delete error", err);
      } finally {
          setIsSyncing(false);
          addLogEntry('user', userId, 'Delete Debt', `Soft deleted debt ${id}`, 'Finance');
      }
  };

  const addStepUpRow = () => {
      const lastEnd = formData.stepUpRows.length > 0 ? formData.stepUpRows[formData.stepUpRows.length - 1].endMonth : 0;
      setFormData(prev => ({ ...prev, stepUpRows: [...prev.stepUpRows, { startMonth: lastEnd + 1, endMonth: lastEnd + 12, amount: formData.monthlyInstallment }] }));
  };

  const removeStepUpRow = (index: number) => {
      const newRows = [...formData.stepUpRows];
      newRows.splice(index, 1);
      setFormData({ ...formData, stepUpRows: newRows });
  };

  const updateStepUpRow = (index: number, field: keyof StepUpRow, value: number) => {
      const newRows = [...formData.stepUpRows];
      newRows[index] = { ...newRows[index], [field]: value };
      
      if (field === 'endMonth') {
          for(let i = index + 1; i < newRows.length; i++) {
              newRows[i].startMonth = newRows[i-1].endMonth + 1;
              if (newRows[i].endMonth < newRows[i].startMonth) newRows[i].endMonth = newRows[i].startMonth + 11;
          }
      }
      setFormData({ ...formData, stepUpRows: newRows });
  };

  const handleSmartParse = async () => {
      if (!smartInputText) return;
      setAiParsing(true);
      const result = await parseTransactionAI(`ADD_DEBT: ${smartInputText}`);
      setAiParsing(false);

      if (result.intent === 'ADD_DEBT' && result.data) {
          const d = result.data;
          setFormData(prev => ({
              ...prev,
              name: d.title || 'Hutang Baru',
              monthlyInstallment: d.monthlyPayment || 0,
              principal: d.principal || (d.monthlyPayment * (d.tenorMonths || 12) * 0.8),
              dueDate: 1, 
              bankName: d.bank || '',
              startDate: new Date().toISOString().split('T')[0],
              endDate: new Date(new Date().setMonth(new Date().getMonth() + (d.tenorMonths || 12))).toISOString().split('T')[0]
          }));
          setSmartInputText('');
          alert("Data terisi otomatis! Silakan cek kembali.");
      } else {
          alert("AI bingung. Coba format: 'KPR BCA 500juta cicilan 4juta selama 15 tahun'");
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!calculatedPreview) return;
    
    const startObj = new Date(formData.startDate);
    const endObj = new Date(formData.endDate);
    
    if (isNaN(startObj.getTime()) || isNaN(endObj.getTime())) {
        alert("Format tanggal tidak valid. Mohon periksa kembali input tanggal.");
        return;
    }

    setIsSyncing(true);

    const finalMonthlyPayment = formData.isStepUp ? calculatedPreview.currentMonthlyPayment : formData.monthlyInstallment;

    const sanitizedPrincipal = Number(formData.principal) || (Number(calculatedPreview.totalLiability) * 0.8) || 0;
    const sanitizedTotalLiability = Number(calculatedPreview.totalLiability) || 0;
    const sanitizedMonthlyPayment = Number(finalMonthlyPayment) || 0;
    const sanitizedRemainingPrincipal = Number(calculatedPreview.remainingPrincipal) || 0;

    const impliedRate = calculateImpliedInterestRate(
        sanitizedPrincipal,
        sanitizedTotalLiability, 
        sanitizedMonthlyPayment
    );

    const sanitizedInterestRate = (impliedRate && !isNaN(impliedRate)) ? impliedRate : 10;

    const debtData: any = { 
        name: formData.name, type: formData.type, bankName: formData.bankName,
        originalPrincipal: sanitizedPrincipal,
        totalLiability: sanitizedTotalLiability,
        monthlyPayment: sanitizedMonthlyPayment,
        startDate: startObj.toISOString(), 
        endDate: endObj.toISOString(), 
        dueDate: Number(formData.dueDate) || 5, 
        interestStrategy: formData.isStepUp ? 'STEP_UP' : 'FIXED', 
        stepUpSchedule: formData.isStepUp ? formData.stepUpRows : [], 
        remainingPrincipal: sanitizedRemainingPrincipal,
        remainingMonths: Number(calculatedPreview.remainingMonths) || 0,
        interestRate: sanitizedInterestRate,
        userId: userId,
        // V44.5 Sync Metadata
        updatedAt: new Date().toISOString(),
        _deleted: false 
    };

    let newId = editingId;
    if (!newId) {
        newId = `debt-${Date.now()}`;
        debtData.createdAt = new Date().toISOString(); 
    }
    debtData.id = newId;

    const currentData = getUserData(userId);
    let updatedDebts = [...currentData.debts];
    if (editingId) {
        updatedDebts = updatedDebts.map(d => d.id === editingId ? { ...d, ...debtData } : d);
    } else {
        updatedDebts.push(debtData);
    }

    saveUserData(userId, { ...currentData, debts: updatedDebts });
    setDebts(updatedDebts.filter(d => d.userId === userId));

    setIsSyncing(false);
    setIsModalOpen(false);
    addLogEntry('user', userId, editingId ? 'Edit Debt' : 'Create Debt', `Saved ${debtData.name}`, 'Finance');
  };

  return (
    <div className="space-y-8 pb-10 relative">
      
      {/* GLOBAL LOADING OVERLAY */}
      {isSyncing && (
          <div className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-sm flex items-center justify-center">
              <div className="bg-white p-6 rounded-2xl shadow-2xl flex flex-col items-center">
                  <RefreshCw className="animate-spin text-brand-600 mb-3" size={32} />
                  <h3 className="font-bold text-slate-900">Processing...</h3>
                  <p className="text-xs text-slate-500">Updating Local State</p>
              </div>
          </div>
      )}

      {/* 1. WAR ROOM */}
      <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl">
         <div className="relative z-10 flex flex-col md:flex-row justify-between items-start gap-8">
            <div className="max-w-xl">
                <h2 className="text-3xl font-bold tracking-tight mb-2">The War Room</h2>
                <p className="text-slate-400">Strategi pelunasan cerdas. Lihat dampak percepatan pelunasan terhadap masa depan finansial Anda.</p>
                <div className="flex gap-2 mt-4 items-center">
                    <span className="text-xs font-bold uppercase text-slate-500 mr-2">Mode:</span>
                    <button onClick={() => setStrategy('snowball')} className={`px-4 py-2 rounded-xl text-sm font-bold border transition ${strategy === 'snowball' ? 'bg-blue-600 border-blue-600' : 'border-slate-700 hover:bg-slate-800'}`}>Snowball (Kecil Dulu)</button>
                    <button onClick={() => setStrategy('avalanche')} className={`px-4 py-2 rounded-xl text-sm font-bold border transition ${strategy === 'avalanche' ? 'bg-red-600 border-red-600' : 'border-slate-700 hover:bg-slate-800'}`}>Avalanche (Bunga Dulu)</button>
                </div>
            </div>
            <div className="flex gap-4">
                <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700 backdrop-blur-sm min-w-[140px]">
                    <p className="text-2xl font-black text-white">{simulationResult.monthsSaved} Bulan</p>
                    <p className="text-xs text-slate-400">Lebih Cepat Lunas</p>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700 backdrop-blur-sm min-w-[140px]">
                    <p className="text-2xl font-black text-green-400">{formatCurrency(simulationResult.savedInterest || 0)}</p>
                    <p className="text-xs text-slate-400">Hemat Bunga</p>
                </div>
            </div>
         </div>
      </div>

      {/* 2. DEBT LIST */}
      <div>
          <div className="flex justify-between items-center mb-6">
             <h3 className="font-bold text-slate-900 text-lg">Daftar Hutang</h3>
             <button onClick={handleOpenAdd} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-xl shadow-lg hover:bg-slate-800 transition"><Plus size={18} /> Tambah Hutang</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedDebts.map((debt) => {
                  const opp = checkRefinanceOpportunity(debt);
                  const strategyRaw = (debt.interestStrategy || '').toString().toUpperCase();
                  const isStepUp = strategyRaw.includes('STEP');

                  return (
                      <div key={debt.id} className="rounded-2xl border bg-white border-slate-200 p-5 group cursor-pointer relative hover:shadow-lg transition hover:border-brand-200" onClick={(e) => handleOpenEdit(e, debt)}>
                        {opp.isOpportunity && (
                            <div className="absolute -top-3 right-4 bg-red-500 text-white text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-md z-10 animate-pulse">
                                <Zap size={10} className="fill-white"/> ALERT: Bunga Mahal!
                            </div>
                        )}
                        <div className="flex justify-between items-start mb-3">
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase bg-slate-100 text-slate-600">{debt.type}</span>
                          <span className={`text-[10px] font-bold ${debt.interestRate > 10 ? 'text-red-500' : 'text-green-600'}`}>{debt.interestRate}% p.a</span>
                        </div>
                        <h3 className="font-bold text-slate-900 text-lg truncate mb-1">{debt.name}</h3>
                        <div className="flex justify-between items-end mb-4">
                            <div>
                                <p className="text-xs text-slate-400">Sisa Pokok</p>
                                <p className="text-xl font-black text-slate-900">{formatCurrency(debt.remainingPrincipal)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-slate-400">Tenor</p>
                                <p className="text-sm font-bold text-slate-700">{debt.remainingMonths} Bln</p>
                            </div>
                        </div>
                        
                        {isStepUp && (
                            <div className="mb-4 bg-blue-50 border border-blue-100 p-2 rounded-lg text-xs text-blue-700 flex items-center gap-2">
                                <TrendingUp size={16}/>
                                <span>Skema Step-Up Aktif</span>
                            </div>
                        )}

                        <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                            <div className="text-xs text-slate-500 font-bold">Cicilan: {formatCurrency(debt.monthlyPayment)}</div>
                            <div className="flex gap-1">
                                <button onClick={(e) => handleDuplicate(e, debt)} className="p-1.5 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition" title="Duplicate"><Copy size={16} /></button>
                                <button onClick={(e) => handleDelete(e, debt.id)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition" title="Delete"><Trash2 size={16} /></button>
                            </div>
                        </div>
                      </div>
                  );
            })}
          </div>
      </div>

      {/* ADD/EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-0 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                <h3 className="text-xl font-bold">{editingId ? 'Edit Kontrak Hutang' : 'Tambah Hutang Baru'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white"><X size={24}/></button>
            </div>
            
            <div className="overflow-y-auto p-6 space-y-6 custom-scrollbar">
                {!editingId && (
                    <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex flex-col gap-2">
                        <label className="text-xs font-bold text-indigo-800 flex items-center gap-2"><Sparkles size={14}/> Smart AI Input</label>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                placeholder="Cth: KPR BNI 800juta cicilan 5juta selama 20 tahun..." 
                                className="flex-1 border border-indigo-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                value={smartInputText}
                                onChange={e => setSmartInputText(e.target.value)}
                            />
                            <button onClick={handleSmartParse} disabled={aiParsing} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50">
                                {aiParsing ? <Loader2 size={16} className="animate-spin"/> : 'Isi Otomatis'}
                            </button>
                        </div>
                    </div>
                )}

                <form id="debtForm" onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Nama Pinjaman</label>
                            <input type="text" required className="w-full border border-slate-300 p-2.5 rounded-lg text-sm" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Bank / Leasing</label>
                            <input type="text" className="w-full border border-slate-300 p-2.5 rounded-lg text-sm" value={formData.bankName} onChange={e => setFormData({...formData, bankName: e.target.value})} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Tipe</label>
                            <select className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as LoanType})}>
                                <option value="KPR">KPR (Rumah)</option>
                                <option value="KKB">KKB (Kendaraan)</option>
                                <option value="KTA">KTA (Cash)</option>
                                <option value="CC">Kartu Kredit</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Pokok Awal (Principal)</label>
                            <input type="number" required className="w-full border border-slate-300 p-2.5 rounded-lg text-sm font-semibold" value={formData.principal} onChange={e => setFormData({...formData, principal: Number(e.target.value)})} />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Mulai Kredit</label>
                            <input type="date" required className="w-full border border-slate-300 p-2.5 rounded-lg text-sm" value={formatDateForInput(formData.startDate)} onChange={e => setFormData({...formData, startDate: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Selesai Kredit</label>
                            <input type="date" required className="w-full border border-slate-300 p-2.5 rounded-lg text-sm" value={formatDateForInput(formData.endDate)} onChange={e => setFormData({...formData, endDate: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Tgl Jatuh Tempo</label>
                            <input type="number" min="1" max="31" className="w-full border border-slate-300 p-2.5 rounded-lg text-sm" value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: Number(e.target.value)})} />
                        </div>
                    </div>

                    <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2"><ReceiptText size={16}/> Skema Pembayaran</h4>
                            <div className="flex bg-white rounded-lg p-1 border border-slate-200">
                                <button 
                                    type="button" 
                                    disabled={!!editingId}
                                    onClick={() => {
                                        const fallbackInstallment = calculatedPreview ? calculatedPreview.currentMonthlyPayment : 0;
                                        setFormData({
                                            ...formData, 
                                            isStepUp: false, 
                                            stepUpRows: [], 
                                            monthlyInstallment: formData.monthlyInstallment || fallbackInstallment
                                        });
                                    }} 
                                    className={`px-3 py-1 text-xs font-bold rounded-md transition ${!formData.isStepUp ? 'bg-slate-900 text-white shadow' : 'text-slate-500'} ${editingId ? 'cursor-not-allowed opacity-70' : ''}`}
                                >
                                    Fixed
                                </button>
                                <button 
                                    type="button" 
                                    disabled={!!editingId}
                                    onClick={() => setFormData({
                                        ...formData, 
                                        isStepUp: true, 
                                        monthlyInstallment: 0 
                                    })} 
                                    className={`px-3 py-1 text-xs font-bold rounded-md transition ${formData.isStepUp ? 'bg-slate-900 text-white shadow' : 'text-slate-500'} ${editingId ? 'cursor-not-allowed opacity-70' : ''}`}
                                >
                                    Step-Up
                                </button>
                            </div>
                        </div>

                        {editingId && (
                            <div className="mb-4 text-[10px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200 flex items-center gap-2">
                                <Lock size={12} className="flex-shrink-0"/>
                                Skema pembayaran (Fixed/Step-Up) dikunci setelah pembuatan.
                            </div>
                        )}

                        {!formData.isStepUp ? (
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Cicilan Tetap per Bulan</label>
                                <input type="number" className="w-full border border-slate-300 p-3 rounded-lg font-bold text-slate-900 text-lg" value={formData.monthlyInstallment} onChange={e => setFormData({...formData, monthlyInstallment: Number(e.target.value)})} />
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <p className="text-xs text-slate-500">Atur kenaikan cicilan berjenjang (contoh: KPR FLPP / Promo Bank).</p>
                                {formData.stepUpRows.map((row, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <div className="flex-1 flex items-center gap-2 bg-white border border-slate-300 p-2 rounded-lg">
                                            <span className="text-xs text-slate-400">Bulan ke</span>
                                            <input type="number" className="w-12 text-center font-bold text-sm outline-none" value={row.startMonth} disabled />
                                            <span className="text-xs text-slate-400">-</span>
                                            <input type="number" className="w-12 text-center font-bold text-sm border-b border-slate-200 focus:border-brand-500 outline-none" value={row.endMonth} onChange={e => updateStepUpRow(idx, 'endMonth', Number(e.target.value))} />
                                        </div>
                                        <div className="flex-[2] bg-white border border-slate-300 p-2 rounded-lg flex items-center">
                                            <span className="text-xs text-slate-400 mr-2">Rp</span>
                                            <input type="number" className="w-full font-bold text-sm outline-none" value={row.amount} onChange={e => updateStepUpRow(idx, 'amount', Number(e.target.value))} />
                                        </div>
                                        <button type="button" onClick={() => removeStepUpRow(idx)} className="text-red-400 hover:text-red-600"><MinusCircle size={18}/></button>
                                    </div>
                                ))}
                                <button type="button" onClick={addStepUpRow} className="text-xs font-bold text-brand-600 flex items-center gap-1 hover:underline"><PlusCircle size={14}/> Tambah Jenjang Periode</button>
                            </div>
                        )}
                    </div>

                    {calculatedPreview && (
                        <div className="bg-green-50 border border-green-200 p-4 rounded-xl">
                            <h4 className="text-green-800 font-bold text-xs uppercase mb-2">Simulasi Real-Time</h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-slate-500 text-xs">Total Kewajiban</p>
                                    <p className="font-bold text-slate-900">{formatCurrency(calculatedPreview.totalLiability)}</p>
                                </div>
                                <div>
                                    <p className="text-slate-500 text-xs">Bunga Efektif (Est)</p>
                                    <p className="font-bold text-slate-900">{calculateImpliedInterestRate(formData.principal, calculatedPreview.totalLiability, calculatedPreview.currentMonthlyPayment)}% p.a</p>
                                </div>
                            </div>
                        </div>
                    )}
                </form>
            </div>
            
            <div className="p-4 border-t border-slate-200 flex justify-end gap-3 bg-slate-50">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 border border-slate-300 rounded-xl font-bold text-slate-600 hover:bg-white transition">Batal</button>
                <button type="submit" form="debtForm" className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition shadow-lg">Simpan Data</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
