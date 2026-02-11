
import React, { useState, useEffect, useMemo } from 'react';
import { DebtItem, LoanType, PaymentRecord, DebtInstallment } from '../types';
import { formatCurrency, calculateSmartDebtDetails, calculateImpliedInterestRate, generateGlobalProjection, generateInstallmentsForDebt, safeDateISO } from '../services/financeUtils';
import { getUserData, saveUserData, getConfig } from '../services/mockDb';
import { pushPartialUpdate, deleteFromCloud } from '../services/cloudSync';
import { Plus, Trash2, X, ReceiptText, Zap, Sparkles, PlusCircle, MinusCircle, Loader2, TrendingUp, Copy, Lock, RefreshCw } from 'lucide-react';

interface MyDebtsProps {
  debts: DebtItem[];
  setDebts: React.Dispatch<React.SetStateAction<DebtItem[]>>;
  paymentRecords: PaymentRecord[];
  setPaymentRecords: React.Dispatch<React.SetStateAction<PaymentRecord[]>>;
  userId: string;
  debtInstallments?: DebtInstallment[];
  setDebtInstallments?: React.Dispatch<React.SetStateAction<DebtInstallment[]>>;
}

export default function MyDebts({ debts, setDebts, userId, debtInstallments, setDebtInstallments }: MyDebtsProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const initialForm = { name: '', type: LoanType.KPR, bankName: '', monthlyInstallment: 0, principal: 0, startDate: new Date().toISOString().split('T')[0], endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 15)).toISOString().split('T')[0], dueDate: 5 };
  const [formData, setFormData] = useState(initialForm);

  const activeDebts = useMemo(() => debts.filter(d => !d._deleted), [debts]);

  const handleDelete = async (id: string) => { 
      if (!confirm('Hapus hutang ini selamanya dari Cloud?')) return;
      setIsSyncing(true);
      
      const success = await deleteFromCloud(userId, 'debts', id);
      if (success) {
          setDebts(prev => prev.filter(d => d.id !== id));
          if (setDebtInstallments) setDebtInstallments(prev => prev.filter(inst => inst.debtId !== id));
          const current = getUserData(userId);
          saveUserData(userId, { debts: current.debts.filter(d => d.id !== id), debtInstallments: current.debtInstallments.filter(i => i.debtId !== id) });
      }
      setIsSyncing(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSyncing(true);

    const now = new Date().toISOString();
    const newDebt: DebtItem = {
        ...initialForm, ...formData, 
        id: `debt-${Date.now()}`, userId, updatedAt: now, _deleted: false,
        originalPrincipal: Number(formData.principal), 
        monthlyPayment: Number(formData.monthlyInstallment),
        remainingPrincipal: Number(formData.principal),
        interestRate: 10, totalLiability: Number(formData.principal) * 1.2,
        remainingMonths: 180
    };

    // Generate physical installments for cloud sync
    const insts = generateInstallmentsForDebt(newDebt, []);

    const current = getUserData(userId);
    saveUserData(userId, { debts: [...current.debts, newDebt], debtInstallments: [...current.debtInstallments, ...insts] });
    setDebts(prev => [...prev, newDebt]);
    if (setDebtInstallments) setDebtInstallments(prev => [...prev, ...insts]);

    // GRANULAR PUSH
    await pushPartialUpdate(userId, { debts: [newDebt], debtInstallments: insts });

    setIsSyncing(false);
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-900">Daftar Hutang</h2>
          <button onClick={() => setIsModalOpen(true)} className="bg-slate-900 text-white px-6 py-2 rounded-xl font-bold shadow-lg hover:bg-slate-800 transition">Tambah Hutang</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeDebts.map(debt => (
              <div key={debt.id} className="bg-white rounded-2xl p-5 border shadow-sm group">
                  <div className="flex justify-between">
                      <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-500 px-2 py-1 rounded">{debt.type}</span>
                      <button onClick={() => handleDelete(debt.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"><Trash2 size={16}/></button>
                  </div>
                  <h3 className="font-bold text-lg mt-2 truncate">{debt.name}</h3>
                  <p className="text-xl font-black text-slate-900 mt-2">{formatCurrency(debt.remainingPrincipal)}</p>
                  <p className="text-xs text-slate-400">Cicilan: {formatCurrency(debt.monthlyPayment)}</p>
              </div>
          ))}
      </div>

      {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl">
                  <h3 className="text-xl font-bold mb-4">Tambah Kontrak Hutang</h3>
                  <form onSubmit={handleSubmit} className="space-y-4">
                      <input placeholder="Nama Hutang" className="w-full border p-3 rounded-xl" value={formData.name} onChange={e=>setFormData({...formData, name:e.target.value})} required />
                      <input type="number" placeholder="Pokok Awal" className="w-full border p-3 rounded-xl" value={formData.principal} onChange={e=>setFormData({...formData, principal:Number(e.target.value)})} required />
                      <input type="number" placeholder="Cicilan Bulanan" className="w-full border p-3 rounded-xl" value={formData.monthlyInstallment} onChange={e=>setFormData({...formData, monthlyInstallment:Number(e.target.value)})} required />
                      <button type="submit" className="w-full bg-brand-600 text-white py-3 rounded-xl font-bold shadow-lg">Simpan & Generate Jadwal</button>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
}
