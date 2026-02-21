
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DebtItem, LoanType, PaymentRecord, DebtInstallment, StepUpRange } from '../types';
import { formatCurrency } from '../services/financeUtils';
import { generateInstallmentsForDebt } from '../services/financeUtils';
import { saveItemToCloud, deleteFromCloud } from '../services/cloudSync';
import { getConfig, getUserData, saveUserData } from '../services/mockDb';
import { Plus, Trash2, Edit2, X, Loader2, TrendingUp, Save, CreditCard, Calendar, Calculator, AlertCircle, ArrowRight, Layers, PieChart, Landmark, Percent, ChevronDown, ChevronUp, Search, Filter, Eye, Clock, Banknote, Building2, BadgePercent, BarChart3, FileText, ArrowUpRight, CheckCircle2, XCircle, Info } from 'lucide-react';
import ConfirmDialog from '../components/ui/ConfirmDialog';

interface MyDebtsProps {
  debts: DebtItem[];
  setDebts: React.Dispatch<React.SetStateAction<DebtItem[]>>;
  paymentRecords: PaymentRecord[];
  setPaymentRecords: React.Dispatch<React.SetStateAction<PaymentRecord[]>>;
  userId: string;
  debtInstallments?: DebtInstallment[];
  setDebtInstallments?: React.Dispatch<React.SetStateAction<DebtInstallment[]>>;
}

// --- SUB COMPONENTS ---

function StatCard({ icon: Icon, label, value, accent = false, sub }: { icon: any, label: string, value: string, accent?: boolean, sub?: string }) {
  return (
    <div className={`flex items-start gap-4 p-5 rounded-2xl border transition-all duration-200 hover:shadow-md ${accent ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-900 border-slate-200'}`}>
      <div className={`p-2.5 rounded-xl shrink-0 ${accent ? 'bg-white/20' : 'bg-slate-100'}`}>
        <Icon size={18} className={accent ? 'text-white' : 'text-slate-500'} />
      </div>
      <div className="min-w-0">
        <p className={`text-[11px] font-semibold uppercase tracking-wider mb-1 ${accent ? 'text-blue-200' : 'text-slate-400'}`}>{label}</p>
        <p className={`text-xl font-bold tracking-tight truncate ${accent ? 'text-white' : 'text-slate-900'}`}>{value}</p>
        {sub && <p className={`text-[11px] mt-0.5 ${accent ? 'text-blue-200' : 'text-slate-400'}`}>{sub}</p>}
      </div>
    </div>
  );
}

function ProgressRing({ value, size = 56 }: { value: number, size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(100, Math.max(0, value)) / 100) * circ;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth="5" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#2563eb" strokeWidth="5" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} className="transition-all duration-700" />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="fill-slate-900 text-[11px] font-bold" transform={`rotate(90 ${size/2} ${size/2})`}>{value.toFixed(0)}%</text>
    </svg>
  );
}

function DebtBadge({ type }: { type: string }) {
  const config: Record<string, { bg: string, text: string, icon: any }> = {
    KPR: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', icon: Building2 },
    KKB: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', icon: CreditCard },
    KTA: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', icon: Banknote },
    'Kartu Kredit': { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700', icon: CreditCard }
  };
  const c = config[type] || config.KTA;
  const BadgeIcon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${c.bg} ${c.text} uppercase tracking-wider`}>
      <BadgeIcon size={10} /> {type}
    </span>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="p-5 bg-slate-100 rounded-2xl mb-5">
        <FileText size={40} className="text-slate-300" />
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-2">Belum ada kontrak hutang</h3>
      <p className="text-sm text-slate-400 mb-6 max-w-xs">Mulai tambahkan kontrak hutang Anda untuk memantau cicilan secara real-time.</p>
      <button onClick={onAdd} className="flex items-center gap-2 bg-blue-600 text-white px-5 py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition active:scale-95 shadow-lg shadow-blue-600/20">
        <Plus size={16} /> Tambah Kontrak
      </button>
    </div>
  );
}

// --- MAIN COMPONENT ---

export default function MyDebts({ debts = [], setDebts, userId, debtInstallments = [], setDebtInstallments }: MyDebtsProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [expandedDebtId, setExpandedDebtId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'form' | 'installments'>('form');
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  
  // Confirmation Modal State
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  // Smart Form State
  const [formData, setFormData] = useState({ 
    name: '', 
    type: LoanType.KPR, 
    bankName: '', 
    originalPrincipal: 0,
    monthlyInstallment: 0,
    startDate: new Date().toISOString().split('T')[0], 
    endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 5)).toISOString().split('T')[0], 
    dueDate: 5,
    interestStrategy: 'Fixed' as 'Fixed' | 'StepUp',
    stepUpSchedule: [] as StepUpRange[]
  });

  // Step Up UI Helper State
  const [stepUpRows, setStepUpRows] = useState<{start: string, end: string, amount: string}[]>([
      { start: '1', end: '12', amount: '0' }
  ]);

  // Realtime Analysis State
  const [analysis, setAnalysis] = useState({
      tenorMonths: 0,
      impliedInterestRate: 0,
      totalOverpayment: 0,
      totalLiability: 0,
      currentRemaining: 0,
      monthsPassed: 0,
      progress: 0
  });

  const activeDebts = useMemo(() => (debts || []).filter(d => !d._deleted), [debts]);

  // Filtered/Searched debts
  const filteredDebts = useMemo(() => {
    let list = activeDebts;
    if (filterType !== 'all') list = list.filter(d => d.type === filterType);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(d => d.name.toLowerCase().includes(q) || (d.bankName || '').toLowerCase().includes(q));
    }
    return list;
  }, [activeDebts, filterType, searchQuery]);

  // Toast auto dismiss
  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  // SMART CALCULATION EFFECT (FIXED FOR STEP UP)
  useEffect(() => {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      const today = new Date();
      
      let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
      if (months < 1) months = 1;

      let monthsPassed = (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth());
      if (monthsPassed < 0) monthsPassed = 0;
      if (monthsPassed > months) monthsPassed = months;

      const principal = Number(formData.originalPrincipal) || 0;
      const baseInstallment = Number(formData.monthlyInstallment) || 0;
      
      // Calculate Liability based on Strategy
      let totalLiability = 0;
      
      if (formData.interestStrategy === 'StepUp') {
          let stepUpTotal = 0;
          for (let m = 1; m <= months; m++) {
              const matchingRow = stepUpRows.find(row => {
                  const s = Number(row.start);
                  const e = Number(row.end);
                  return m >= s && m <= e;
              });

              if (matchingRow) {
                  stepUpTotal += Number(matchingRow.amount);
              } else {
                  stepUpTotal += baseInstallment;
              }
          }
          totalLiability = stepUpTotal;
      } else {
          totalLiability = baseInstallment * months;
      }

      const totalOverpayment = Math.max(0, totalLiability - principal);
      
      const yearlyInterest = (totalOverpayment / months) * 12;
      const impliedRate = principal > 0 ? (yearlyInterest / principal) * 100 : 0;

      const avgMonthlyPayment = totalLiability / months;
      const amountPaidEst = avgMonthlyPayment * monthsPassed;
      const principalRemaining = Math.max(0, principal - (principal / months * monthsPassed));

      const progress = principal > 0 ? ((principal - principalRemaining) / principal) * 100 : 0;

      setAnalysis({
          tenorMonths: months,
          impliedInterestRate: impliedRate,
          totalOverpayment,
          totalLiability,
          currentRemaining: principalRemaining,
          monthsPassed,
          progress
      });

  }, [formData.startDate, formData.endDate, formData.originalPrincipal, formData.monthlyInstallment, formData.interestStrategy, stepUpRows]);

  const resetForm = useCallback(() => {
    setFormData({
      name: '', type: LoanType.KPR, bankName: '', originalPrincipal: 0,
      monthlyInstallment: 0,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 5)).toISOString().split('T')[0],
      dueDate: 5, interestStrategy: 'Fixed', stepUpSchedule: []
    });
    setStepUpRows([{ start: '1', end: '12', amount: '0' }]);
    setActiveTab('form');
  }, []);

  const openAddModal = useCallback(() => {
    setEditingId(null);
    resetForm();
    setIsModalOpen(true);
  }, [resetForm]);

  const handleEdit = (debt: DebtItem) => {
      setEditingId(debt.id);
      
      let parsedSchedule: StepUpRange[] = [];
      if (debt.stepUpSchedule) {
          if (Array.isArray(debt.stepUpSchedule)) {
              parsedSchedule = debt.stepUpSchedule;
          } else if (typeof debt.stepUpSchedule === 'string') {
              try { parsedSchedule = JSON.parse(debt.stepUpSchedule); } catch(e) {}
          }
      }

      setFormData({
          name: debt.name, 
          type: debt.type, 
          bankName: debt.bankName || '', 
          originalPrincipal: debt.originalPrincipal, 
          monthlyInstallment: debt.monthlyPayment,
          startDate: debt.startDate ? new Date(debt.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0], 
          endDate: debt.endDate ? new Date(debt.endDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0], 
          dueDate: debt.dueDate || 5,
          interestStrategy: (debt.interestStrategy as 'Fixed' | 'StepUp') || 'Fixed',
          stepUpSchedule: parsedSchedule
      });

      if (parsedSchedule.length > 0) {
          setStepUpRows(parsedSchedule.map(s => ({
              start: s.startMonth.toString(),
              end: s.endMonth.toString(),
              amount: s.amount.toString()
          })));
      } else {
          setStepUpRows([{ start: '1', end: '12', amount: debt.monthlyPayment.toString() }]);
      }

      setActiveTab('form');
      setIsModalOpen(true);
  };

  const handleAddStepUpRow = () => {
      const lastRow = stepUpRows[stepUpRows.length - 1];
      const nextStart = lastRow ? (Number(lastRow.end) + 1).toString() : '1';
      const nextEnd = (Number(nextStart) + 11).toString();
      setStepUpRows([...stepUpRows, { start: nextStart, end: nextEnd, amount: '0' }]);
  };

  const handleStepUpChange = (index: number, field: keyof typeof stepUpRows[0], value: string) => {
      const newRows = [...stepUpRows];
      newRows[index][field] = value;
      setStepUpRows(newRows);
  };

  const handleRemoveStepUpRow = (index: number) => {
      setStepUpRows(stepUpRows.filter((_, i) => i !== index));
  };

  const handleDeleteClick = (id: string) => { 
      setConfirmConfig({
          isOpen: true,
          title: "Hapus Kontrak Hutang?",
          message: "Data yang dihapus tidak dapat dikembalikan. Installment terkait juga akan terhapus.",
          onConfirm: () => {
              executeDelete(id);
              setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          }
      });
  };

  const executeDelete = async (id: string) => {
      const prevDebts = [...debts];
      setIsSyncing(true);

      // Optimistic UI Update
      setDebts(prev => prev.filter(d => d.id !== id));
      // Also remove related installments
      if (setDebtInstallments) {
        setDebtInstallments(prev => prev.filter(i => i.debtId !== id));
      }

      try {
          const success = await deleteFromCloud(userId, 'debts', id);
          if (!success) throw new Error("Gagal menghapus di server");
          setToastMessage({ text: 'Kontrak hutang berhasil dihapus.', type: 'success' });
      } catch (e) {
          console.error(e);
          setDebts(prevDebts);
          setToastMessage({ text: 'Gagal menghapus. Periksa koneksi Anda.', type: 'error' });
      } finally {
          setIsSyncing(false);
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validations
    if (!formData.name.trim()) {
        setToastMessage({ text: 'Nama kontrak wajib diisi.', type: 'error' });
        return;
    }
    if (formData.originalPrincipal <= 0) {
        setToastMessage({ text: 'Plafon awal harus lebih dari 0.', type: 'error' });
        return;
    }
    if (formData.originalPrincipal < 0 || formData.monthlyInstallment < 0) {
        setToastMessage({ text: 'Nominal tidak boleh negatif!', type: 'error' });
        return;
    }
    if (formData.interestStrategy === 'Fixed' && formData.monthlyInstallment <= 0) {
        setToastMessage({ text: 'Cicilan bulanan wajib diisi untuk tipe Fixed.', type: 'error' });
        return;
    }
    if (new Date(formData.startDate) >= new Date(formData.endDate)) {
        setToastMessage({ text: 'Tanggal selesai harus setelah tanggal mulai.', type: 'error' });
        return;
    }
    if (formData.dueDate < 1 || formData.dueDate > 31) {
        setToastMessage({ text: 'Tanggal jatuh tempo harus antara 1-31.', type: 'error' });
        return;
    }

    // StepUp specific validations
    if (formData.interestStrategy === 'StepUp') {
      const hasInvalidRow = stepUpRows.some(r => Number(r.amount) <= 0 || Number(r.start) <= 0 || Number(r.end) <= 0);
      if (hasInvalidRow) {
        setToastMessage({ text: 'Semua periode Step-Up harus memiliki nilai > 0.', type: 'error' });
        return;
      }
      // Check for overlapping ranges
      for (let i = 0; i < stepUpRows.length; i++) {
        for (let j = i + 1; j < stepUpRows.length; j++) {
          const a = { s: Number(stepUpRows[i].start), e: Number(stepUpRows[i].end) };
          const b = { s: Number(stepUpRows[j].start), e: Number(stepUpRows[j].end) };
          if (a.s <= b.e && b.s <= a.e) {
            setToastMessage({ text: `Periode Step-Up baris ${i+1} dan ${j+1} overlap.`, type: 'error' });
            return;
          }
        }
      }
    }

    setIsSyncing(true);
    const strategy = getConfig().advancedConfig?.syncStrategy || 'background';
    const tempId = `temp-debt-${Date.now()}`;
    const targetId = editingId || tempId;

    let finalStepUpSchedule: StepUpRange[] = [];
    if (formData.interestStrategy === 'StepUp') {
        finalStepUpSchedule = stepUpRows.map(r => ({
            startMonth: Number(r.start),
            endMonth: Number(r.end),
            amount: Number(r.amount)
        }));
    }

    const existingDebt = editingId ? debts.find(d => d.id === editingId) : null;

    // Compute monthlyPayment for StepUp: use first period amount as default monthlyPayment for backend compatibility
    const effectiveMonthly = formData.interestStrategy === 'StepUp' 
      ? (finalStepUpSchedule.length > 0 ? finalStepUpSchedule[0].amount : 0)
      : Number(formData.monthlyInstallment);

    const newDebt: DebtItem = {
        id: targetId, 
        userId, 
        name: formData.name.trim(), 
        type: formData.type as LoanType, 
        bankName: formData.bankName.trim(),
        originalPrincipal: Number(formData.originalPrincipal), 
        totalLiability: analysis.totalLiability, 
        monthlyPayment: formData.interestStrategy === 'Fixed' ? Number(formData.monthlyInstallment) : effectiveMonthly,
        
        interestRate: Number(analysis.impliedInterestRate.toFixed(2)), 
        remainingPrincipal: Number(analysis.currentRemaining.toFixed(0)), 
        remainingMonths: Math.max(0, analysis.tenorMonths - analysis.monthsPassed),
        monthsPassed: analysis.monthsPassed,
        
        startDate: formData.startDate, 
        endDate: formData.endDate,
        dueDate: Number(formData.dueDate), 
        interestStrategy: formData.interestStrategy,
        
        stepUpSchedule: finalStepUpSchedule, 
        
        updatedAt: new Date().toISOString(), 
        createdAt: existingDebt?.createdAt || new Date().toISOString(),
        _deleted: false, 
        
        payoffMethod: existingDebt?.payoffMethod || 'direct_extra',
        allocatedExtraBudget: existingDebt?.allocatedExtraBudget || 0,
        currentSavedAmount: existingDebt?.currentSavedAmount || 0,
        earlySettlementDiscount: existingDebt?.earlySettlementDiscount || 0
    };

    // Optimistic UI Update
    if (strategy === 'manual_only') {
        setDebts(prev => editingId ? prev.map(d => d.id === editingId ? newDebt : d) : [...prev, newDebt]);
    }

    try {
        const { monthsPassed: _mp, ...debtWithoutMonthsPassed } = newDebt;
        const payload = {
            ...debtWithoutMonthsPassed,
            stepUpSchedule: JSON.stringify(finalStepUpSchedule)
        };

        const result = await saveItemToCloud('debts', payload, !editingId);

        if (result.success) {
            const savedItem = result.data || newDebt;
            if (typeof savedItem.stepUpSchedule === 'string') {
                try { savedItem.stepUpSchedule = JSON.parse(savedItem.stepUpSchedule); } catch(e) {}
            }

            if (strategy === 'background') {
                setDebts(prev => editingId ? prev.map(d => d.id === editingId ? savedItem : d) : [...prev, savedItem]);
            } else if (!editingId) {
                setDebts(prev => prev.map(d => d.id === tempId ? savedItem : d));
            }

            // Generate installments after successful save
            const finalDebt = savedItem;
            const existingInstallmentsForDebt = debtInstallments.filter(i => i.debtId === finalDebt.id);
            const newInstallments = generateInstallmentsForDebt(finalDebt, existingInstallmentsForDebt, true);
            
            if (newInstallments.length > 0 && setDebtInstallments) {
              // Replace installments for this debt
              setDebtInstallments(prev => {
                const otherInstallments = prev.filter(i => i.debtId !== finalDebt.id);
                return [...otherInstallments, ...newInstallments];
              });

              // Save to local DB
              const userData = getUserData(userId);
              const otherInstLocal = (userData.debtInstallments || []).filter(i => i.debtId !== finalDebt.id);
              saveUserData(userId, { debtInstallments: [...otherInstLocal, ...newInstallments] });

              // Sync each installment to cloud (batch - first 3 to avoid rate limiting, rest silently)
              for (let idx = 0; idx < Math.min(newInstallments.length, 3); idx++) {
                try {
                  await saveItemToCloud('debtInstallments', {
                    ...newInstallments[idx],
                    _deleted: undefined
                  }, true);
                } catch (e) {
                  console.warn('[v0] Installment sync skipped:', idx, e);
                }
              }
            }

            setToastMessage({ text: editingId ? 'Kontrak berhasil diperbarui.' : 'Kontrak baru berhasil disimpan.', type: 'success' });
            setIsModalOpen(false);
            resetForm();
        } else {
            throw new Error(result.error);
        }
    } catch (e) {
        if (strategy === 'manual_only') {
            if (!editingId) setDebts(prev => prev.filter(d => d.id !== tempId));
        }
        setToastMessage({ text: 'Gagal menyimpan. Cek koneksi Anda.', type: 'error' });
    } finally {
        setIsSyncing(false);
    }
  };

  // Summary calculations
  const totalOutstanding = activeDebts.reduce((a,b) => a + Number(b.remainingPrincipal || 0), 0);
  const totalMonthly = activeDebts.reduce((a,b) => a + Number(b.monthlyPayment || 0), 0);
  const totalPrincipalStart = activeDebts.reduce((a,b) => a + Number(b.originalPrincipal || 0), 0);
  const totalPaid = totalPrincipalStart - totalOutstanding;
  const overallProgress = totalPrincipalStart > 0 ? (totalPaid / totalPrincipalStart) * 100 : 0;

  const getCurrentInstallment = (debt: DebtItem) => {
      if (debt.interestStrategy !== 'StepUp' || !debt.stepUpSchedule) return debt.monthlyPayment;
      
      const start = new Date(debt.startDate);
      const today = new Date();
      const monthsPassed = (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth()) + 1;
      
      let schedule: StepUpRange[] = [];
      if (Array.isArray(debt.stepUpSchedule)) {
          schedule = debt.stepUpSchedule;
      } else if (typeof debt.stepUpSchedule === 'string') {
          try { schedule = JSON.parse(debt.stepUpSchedule); } catch(e) {}
      }

      const currentPeriod = schedule.find(s => monthsPassed >= s.startMonth && monthsPassed <= s.endMonth);
      return currentPeriod ? currentPeriod.amount : debt.monthlyPayment;
  };

  // Get installments for expanded view
  const getInstallmentsForDebt = (debtId: string) => {
    return debtInstallments.filter(i => i.debtId === debtId).sort((a,b) => a.period - b.period);
  };

  // --- Form Input helper ---
  const inputClass = "w-full border border-slate-200 bg-white p-3 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none font-medium text-slate-800 text-sm transition-all";
  const labelClass = "block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5";

  return (
    <div className="space-y-6 pb-24 font-sans">
      
      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className={`fixed top-4 right-4 z-[200] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-lg border text-sm font-semibold animate-fade-in ${toastMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
          {toastMessage.type === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
          {toastMessage.text}
          <button onClick={() => setToastMessage(null)} className="ml-2 opacity-50 hover:opacity-100"><X size={14}/></button>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight text-balance">Portfolio Hutang</h1>
          <p className="text-sm text-slate-400 mt-1">{activeDebts.length} kontrak aktif</p>
        </div>
        <button onClick={openAddModal} className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700 transition active:scale-[0.97] shadow-sm">
          <Plus size={16}/> Tambah Kontrak
        </button>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Landmark} label="Total Plafon" value={formatCurrency(totalPrincipalStart)} />
        <StatCard icon={TrendingUp} label="Outstanding" value={formatCurrency(totalOutstanding)} accent />
        <StatCard icon={Banknote} label="Beban Bulanan" value={formatCurrency(totalMonthly)} sub="Total cicilan per bulan" />
        <div className="flex items-center gap-4 p-5 rounded-2xl border border-slate-200 bg-white">
          <ProgressRing value={overallProgress} />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Progress Lunas</p>
            <p className="text-xl font-bold text-slate-900">{formatCurrency(totalPaid)}</p>
            <p className="text-[11px] text-slate-400">telah terbayar</p>
          </div>
        </div>
      </div>

      {/* SEARCH & FILTER BAR */}
      {activeDebts.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
            <input type="text" placeholder="Cari nama atau bank..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none transition" />
          </div>
          <div className="flex gap-2">
            {['all', 'KPR', 'KKB', 'KTA', 'Kartu Kredit'].map(t => (
              <button key={t} onClick={() => setFilterType(t)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition ${filterType === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                {t === 'all' ? 'Semua' : t}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* DEBT LIST */}
      {filteredDebts.length === 0 && activeDebts.length === 0 ? (
        <EmptyState onAdd={openAddModal} />
      ) : filteredDebts.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">Tidak ada hasil untuk filter ini.</div>
      ) : (
        <div className="space-y-3">
          {filteredDebts.map(debt => {
              const progress = debt.originalPrincipal > 0 ? ((debt.originalPrincipal - debt.remainingPrincipal) / debt.originalPrincipal) * 100 : 0;
              const isStepUp = debt.interestStrategy === 'StepUp';
              const isExpanded = expandedDebtId === debt.id;
              const installments = isExpanded ? getInstallmentsForDebt(debt.id) : [];
              
              return (
                <div key={debt.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden transition-all hover:shadow-md">
                  {/* Main Row */}
                  <div className="p-5 flex flex-col md:flex-row gap-4 items-start md:items-center">
                    {/* Left: Name & Meta */}
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <button onClick={() => setExpandedDebtId(isExpanded ? null : debt.id)} className="p-2 rounded-lg hover:bg-slate-100 transition shrink-0 mt-0.5" title="Detail">
                        {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                      </button>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <h3 className="text-base font-bold text-slate-900 truncate" title={debt.name}>{debt.name}</h3>
                          <DebtBadge type={debt.type} />
                          {isStepUp && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border bg-violet-50 border-violet-200 text-violet-700 uppercase tracking-wider">
                              <Layers size={10}/> Step-Up
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 flex items-center gap-1.5">
                          <Building2 size={12} /> {debt.bankName || '-'} 
                          <span className="text-slate-300 mx-1">|</span>
                          <Clock size={12} /> {debt.remainingMonths} bulan lagi
                          <span className="text-slate-300 mx-1">|</span>
                          Jatuh tempo tgl {debt.dueDate}
                        </p>
                        {/* Progress Bar */}
                        <div className="flex items-center gap-3 mt-3 max-w-xs">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{width: `${Math.min(100, progress)}%`}}></div>
                          </div>
                          <span className="text-[11px] font-semibold text-slate-400 tabular-nums">{progress.toFixed(0)}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Middle: Financial Numbers */}
                    <div className="flex gap-6 md:gap-8 pl-10 md:pl-0">
                      <div>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase mb-0.5">Outstanding</p>
                        <p className="text-base font-bold text-slate-900 tabular-nums">{formatCurrency(debt.remainingPrincipal)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase mb-0.5">Cicilan</p>
                        <p className="text-base font-bold text-blue-600 tabular-nums">{formatCurrency(getCurrentInstallment(debt))}</p>
                        {isStepUp && <p className="text-[9px] text-slate-400">current step</p>}
                      </div>
                      <div className="hidden lg:block">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase mb-0.5">Bunga</p>
                        <p className="text-base font-bold text-slate-700 tabular-nums">{debt.interestRate}%</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pl-10 md:pl-0">
                      <button onClick={() => handleEdit(debt)} className="p-2.5 rounded-xl border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition" title="Edit">
                        <Edit2 size={15}/>
                      </button>
                      <button onClick={() => handleDeleteClick(debt.id)} className="p-2.5 rounded-xl border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition" title="Hapus">
                        <Trash2 size={15}/>
                      </button>
                    </div>
                  </div>

                  {/* Expanded: Installment Detail */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50 p-5 animate-fade-in">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2"><BarChart3 size={14} /> Jadwal Cicilan ({installments.length} periode)</h4>
                        {installments.length === 0 && (
                          <p className="text-xs text-slate-400 italic">Belum ada installment. Simpan ulang kontrak ini untuk generate.</p>
                        )}
                      </div>
                      {installments.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-slate-200">
                                <th className="text-left py-2 px-3 font-semibold text-slate-500">#</th>
                                <th className="text-left py-2 px-3 font-semibold text-slate-500">Jatuh Tempo</th>
                                <th className="text-right py-2 px-3 font-semibold text-slate-500">Cicilan</th>
                                <th className="text-right py-2 px-3 font-semibold text-slate-500">Pokok</th>
                                <th className="text-right py-2 px-3 font-semibold text-slate-500">Bunga</th>
                                <th className="text-right py-2 px-3 font-semibold text-slate-500">Sisa</th>
                                <th className="text-center py-2 px-3 font-semibold text-slate-500">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {installments.slice(0, 24).map(inst => (
                                <tr key={inst.id} className="border-b border-slate-100 hover:bg-white transition">
                                  <td className="py-2.5 px-3 font-medium text-slate-600">{inst.period}</td>
                                  <td className="py-2.5 px-3 text-slate-600">{inst.dueDate}</td>
                                  <td className="py-2.5 px-3 text-right font-semibold text-slate-900 tabular-nums">{formatCurrency(inst.amount)}</td>
                                  <td className="py-2.5 px-3 text-right text-slate-600 tabular-nums">{formatCurrency(inst.principalPart)}</td>
                                  <td className="py-2.5 px-3 text-right text-slate-600 tabular-nums">{formatCurrency(inst.interestPart)}</td>
                                  <td className="py-2.5 px-3 text-right font-medium text-slate-700 tabular-nums">{formatCurrency(inst.remainingBalance)}</td>
                                  <td className="py-2.5 px-3 text-center">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                                      inst.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                                      inst.status === 'overdue' ? 'bg-red-100 text-red-700' :
                                      'bg-slate-100 text-slate-500'
                                    }`}>
                                      {inst.status === 'paid' ? <CheckCircle2 size={10}/> : inst.status === 'overdue' ? <AlertCircle size={10}/> : <Clock size={10}/>}
                                      {inst.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {installments.length > 24 && (
                            <p className="text-xs text-slate-400 text-center mt-3">Menampilkan 24 dari {installments.length} periode</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
          })}
        </div>
      )}

      {/* SMART MODAL */}
      {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in" onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}>
              <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-slate-200 max-h-[92vh] overflow-hidden flex flex-col md:flex-row" onClick={e => e.stopPropagation()}>
                  
                  {/* LEFT: FORM INPUTS */}
                  <div className="p-6 md:p-8 md:w-3/5 overflow-y-auto flex-1">
                      <div className="flex justify-between items-center mb-6">
                          <div>
                            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                {editingId ? <Edit2 size={18}/> : <Plus size={18}/>}
                                {editingId ? 'Edit Kontrak' : 'Tambah Kontrak Baru'}
                            </h3>
                            <p className="text-xs text-slate-400 mt-1">Isi data pinjaman. Kalkulasi dilakukan otomatis.</p>
                          </div>
                          <button onClick={()=>{ setIsModalOpen(false); resetForm(); }} className="p-2 hover:bg-slate-100 rounded-lg transition text-slate-400"><X size={20}/></button>
                      </div>
                      
                      <form id="debtForm" onSubmit={handleSubmit} className="space-y-5">
                          {/* BASIC INFO */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="sm:col-span-2">
                                  <label className={labelClass}>Nama Kontrak</label>
                                  <input className={inputClass} placeholder="Misal: KPR Rumah Cikarang" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} required />
                              </div>
                              <div>
                                  <label className={labelClass}>Bank / Lender</label>
                                  <input className={inputClass} placeholder="Nama bank" value={formData.bankName} onChange={e=>setFormData({...formData, bankName: e.target.value})} />
                              </div>
                              <div>
                                  <label className={labelClass}>Jenis Kredit</label>
                                  <select className={inputClass} value={formData.type} onChange={e=>setFormData({...formData, type: e.target.value as LoanType})}>
                                      <option value={LoanType.KPR}>KPR (Rumah)</option>
                                      <option value={LoanType.KKB}>KKB (Kendaraan)</option>
                                      <option value={LoanType.KTA}>KTA (Cash)</option>
                                      <option value={LoanType.CC}>Kartu Kredit</option>
                                  </select>
                              </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              <div>
                                  <label className={labelClass}>Mulai Kredit</label>
                                  <input type="date" className={inputClass} value={formData.startDate} onChange={e=>setFormData({...formData, startDate: e.target.value})} required />
                              </div>
                              <div>
                                  <label className={labelClass}>Selesai Kredit</label>
                                  <input type="date" className={inputClass} value={formData.endDate} onChange={e=>setFormData({...formData, endDate: e.target.value})} required />
                              </div>
                              <div>
                                  <label className={labelClass}>Tgl Jatuh Tempo</label>
                                  <input type="number" min="1" max="31" className={inputClass} value={formData.dueDate} onChange={e=>setFormData({...formData, dueDate: Number(e.target.value)})} />
                              </div>
                          </div>

                          <div>
                              <label className={labelClass}>Plafon Awal (Pokok Pinjaman)</label>
                              <div className="relative">
                                  <span className="absolute left-3.5 top-3 text-slate-400 font-semibold text-sm">Rp</span>
                                  <input type="number" min="0" className={`${inputClass} pl-10`} value={formData.originalPrincipal || ''} onChange={e=>setFormData({...formData, originalPrincipal: Number(e.target.value)})} required placeholder="0" />
                              </div>
                          </div>

                          {/* STRATEGY SWITCHER */}
                          <div className="p-5 bg-slate-50 rounded-xl border border-slate-200">
                              <div className="flex justify-between items-center mb-4">
                                  <label className="text-xs font-bold text-slate-700">Strategi Bunga</label>
                                  <div className="flex bg-white rounded-lg p-0.5 border border-slate-200">
                                      <button type="button" onClick={()=>setFormData({...formData, interestStrategy: 'Fixed'})} className={`px-4 py-1.5 rounded-md text-xs font-semibold transition ${formData.interestStrategy === 'Fixed' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                        Flat / Fixed
                                      </button>
                                      <button type="button" onClick={()=>setFormData({...formData, interestStrategy: 'StepUp'})} className={`px-4 py-1.5 rounded-md text-xs font-semibold transition ${formData.interestStrategy === 'StepUp' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                        Step-Up
                                      </button>
                                  </div>
                              </div>

                              {formData.interestStrategy === 'Fixed' ? (
                                  <div>
                                      <label className={labelClass}>Cicilan Tetap per Bulan</label>
                                      <div className="relative">
                                          <span className="absolute left-3.5 top-3 text-slate-400 font-semibold text-sm">Rp</span>
                                          <input type="number" min="0" className={`${inputClass} pl-10`} value={formData.monthlyInstallment || ''} onChange={e=>setFormData({...formData, monthlyInstallment: Number(e.target.value)})} required placeholder="0" />
                                      </div>
                                  </div>
                              ) : (
                                  <div className="space-y-3 animate-fade-in">
                                      <div className="flex justify-between items-center">
                                          <p className="text-xs text-violet-700 font-semibold flex items-center gap-1"><Layers size={12}/> Jenjang Kenaikan</p>
                                          <button type="button" onClick={handleAddStepUpRow} className="text-[11px] bg-violet-100 text-violet-700 px-3 py-1 rounded-md font-semibold hover:bg-violet-200 transition">+ Tambah Periode</button>
                                      </div>
                                      
                                      <div className="space-y-2">
                                          <div className="grid grid-cols-[60px_8px_60px_1fr_32px] gap-2 text-[10px] font-semibold text-slate-400 uppercase px-1">
                                            <span>Mulai</span><span></span><span>Akhir</span><span>Cicilan (Rp)</span><span></span>
                                          </div>
                                          {stepUpRows.map((row, idx) => (
                                              <div key={idx} className="grid grid-cols-[60px_8px_60px_1fr_32px] gap-2 items-center">
                                                  <input type="number" className="border border-slate-200 p-2 rounded-lg text-xs text-center font-semibold bg-white" value={row.start} onChange={e => handleStepUpChange(idx, 'start', e.target.value)} />
                                                  <span className="text-slate-300 text-center">-</span>
                                                  <input type="number" className="border border-slate-200 p-2 rounded-lg text-xs text-center font-semibold bg-white" value={row.end} onChange={e => handleStepUpChange(idx, 'end', e.target.value)} />
                                                  <input type="number" placeholder="0" className="border border-slate-200 p-2 rounded-lg text-xs font-semibold bg-white" value={row.amount} onChange={e => handleStepUpChange(idx, 'amount', e.target.value)} />
                                                  <button type="button" onClick={() => handleRemoveStepUpRow(idx)} className="p-1.5 text-slate-300 hover:text-red-500 rounded transition" title="Hapus"><X size={14}/></button>
                                              </div>
                                          ))}
                                      </div>
                                      <div className="flex items-start gap-2 mt-2 p-3 bg-violet-50 rounded-lg border border-violet-100">
                                        <Info size={14} className="text-violet-500 shrink-0 mt-0.5" />
                                        <p className="text-[11px] text-violet-600 leading-relaxed">Cicilan mengikuti tabel ini. Bulan di luar jangkauan menggunakan cicilan default.</p>
                                      </div>
                                  </div>
                              )}
                          </div>

                          {/* Submit Button - Mobile */}
                          <div className="md:hidden pt-2">
                            <button 
                              type="submit" 
                              form="debtForm"
                              disabled={isSyncing} 
                              className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]"
                            >
                              {isSyncing ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>}
                              {editingId ? 'Perbarui Kontrak' : 'Simpan Kontrak'}
                            </button>
                          </div>
                      </form>
                  </div>

                  {/* RIGHT: SMART PREVIEW PANEL */}
                  <div className="p-6 md:p-8 md:w-2/5 bg-slate-900 text-white flex flex-col justify-between relative overflow-hidden border-t md:border-t-0 md:border-l border-slate-800">
                      <div className="absolute -top-10 -right-10 opacity-5 pointer-events-none"><Calculator size={180}/></div>
                      
                      <div className="relative z-10">
                          <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-6 flex items-center gap-2"><Calculator size={14} className="text-blue-400" /> Kalkulasi Otomatis</h4>
                          
                          <div className="space-y-5">
                              <div className="flex justify-between items-baseline pb-4 border-b border-slate-800">
                                  <span className="text-slate-400 text-sm">Est. Bunga (Flat)</span>
                                  <span className="font-mono font-bold text-lg text-amber-400">{analysis.impliedInterestRate.toFixed(2)}% <span className="text-xs text-slate-500 font-normal">p.a</span></span>
                              </div>
                              <div className="flex justify-between items-baseline pb-4 border-b border-slate-800">
                                  <span className="text-slate-400 text-sm">Tenor</span>
                                  <span className="font-mono font-bold text-lg text-white">{analysis.tenorMonths} <span className="text-xs text-slate-500 font-normal">bulan</span></span>
                              </div>
                              <div className="flex justify-between items-baseline pb-4 border-b border-slate-800">
                                  <span className="text-slate-400 text-sm">Total Bunga</span>
                                  <span className="font-mono font-bold text-lg text-red-400">{formatCurrency(analysis.totalOverpayment)}</span>
                              </div>
                              <div className="flex justify-between items-baseline pb-4 border-b border-slate-800">
                                  <span className="text-slate-400 text-sm">Total Kewajiban</span>
                                  <span className="font-mono font-bold text-lg text-blue-400">{formatCurrency(analysis.totalLiability)}</span>
                              </div>
                              
                              <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/50">
                                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Posisi Saat Ini</p>
                                  <div className="flex justify-between items-end mb-3">
                                      <span className="text-xs text-slate-400">Bulan ke-{analysis.monthsPassed}</span>
                                      <span className="font-bold text-xl text-white">{formatCurrency(analysis.currentRemaining)}</span>
                                  </div>
                                  <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                      <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${analysis.progress}%` }}></div>
                                  </div>
                                  <p className="text-[10px] text-slate-500 mt-1.5 text-right">{analysis.progress.toFixed(1)}% selesai</p>
                              </div>
                          </div>
                      </div>

                      <div className="hidden md:flex gap-3 mt-6 relative z-10">
                          <button type="button" onClick={()=>{ setIsModalOpen(false); resetForm(); }} className="px-5 py-3 rounded-xl font-semibold text-slate-400 hover:text-white hover:bg-white/10 transition text-sm">Batal</button>
                          <button 
                            type="submit" 
                            form="debtForm"
                            disabled={isSyncing} 
                            className="flex-1 py-3 bg-white text-slate-900 rounded-xl font-bold text-sm hover:bg-blue-50 transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.97]"
                          >
                              {isSyncing ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>}
                              {editingId ? 'Perbarui' : 'Simpan Kontrak'}
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Loading Overlay */}
      {isSyncing && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 text-sm font-semibold animate-fade-in">
          <Loader2 size={16} className="animate-spin" /> Menyimpan data...
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
