
import React, { useState, useMemo } from 'react';
import { DebtItem, DebtInstallment, PaymentRecord } from '../types';
import { formatCurrency, generateInstallmentsForDebt } from '../services/financeUtils';
import { Calendar, Search, CheckSquare, Square, CheckCircle2, RotateCcw, X, Info } from 'lucide-react';
import { pushPartialUpdate } from '../services/cloudSync';
import { saveUserData, getUserData } from '../services/mockDb';

interface CalendarPageProps {
  debts: DebtItem[];
  debtInstallments: DebtInstallment[];
  setDebtInstallments: React.Dispatch<React.SetStateAction<DebtInstallment[]>>;
  paymentRecords: PaymentRecord[];
  setPaymentRecords: React.Dispatch<React.SetStateAction<PaymentRecord[]>>;
}

export default function CalendarPage({ debts, debtInstallments, setDebtInstallments, paymentRecords, setPaymentRecords }: CalendarPageProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const allInstallments = useMemo(() => {
      let combined: DebtInstallment[] = [];
      debts.forEach(debt => {
          const savedForDebt = debtInstallments.filter(i => i.debtId === debt.id);
          const fullSchedule = generateInstallmentsForDebt(debt, savedForDebt);
          combined = [...combined, ...fullSchedule];
      });
      return combined;
  }, [debts, debtInstallments]);

  const filteredData = allInstallments.filter(i => {
      const debt = debts.find(d => d.id === i.debtId);
      return (debt?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
  }).sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const handleBulkAction = async (action: 'mark_paid' | 'mark_pending') => {
      if (selectedIds.size === 0) return;
      const newStatus = action === 'mark_paid' ? 'paid' : 'pending';
      const userId = localStorage.getItem('paydone_active_user') || 'user';
      const now = new Date().toISOString();
      const modifiedItems: DebtInstallment[] = [];

      allInstallments.forEach(inst => {
          if (selectedIds.has(inst.id) && inst.status !== newStatus) {
              modifiedItems.push({ ...inst, status: newStatus as any, updatedAt: now });
          }
      });

      if (modifiedItems.length === 0) return;

      // Update Local State
      setDebtInstallments(prev => {
          let updated = [...prev];
          modifiedItems.forEach(item => {
              const idx = updated.findIndex(p => p.id === item.id);
              if (idx !== -1) updated[idx] = item;
              else updated.push(item);
          });
          const current = getUserData(userId);
          saveUserData(userId, { ...current, debtInstallments: updated });
          return updated;
      });

      // GRANULAR PARTIAL SYNC
      await pushPartialUpdate(userId, { debtInstallments: modifiedItems });
      setSelectedIds(new Set());
  };

  const toggleSelection = (id: string) => {
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
      setSelectedIds(newSet);
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="bg-white p-6 rounded-2xl border shadow-sm flex justify-between items-center">
          <div><h2 className="text-2xl font-bold">Timeline Pembayaran</h2><p className="text-sm text-slate-500">Kelola status pembayaran cicilan secara granular.</p></div>
          <div className="flex gap-2">
              <button onClick={() => handleBulkAction('mark_paid')} disabled={selectedIds.size===0} className="bg-green-600 text-white px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-50">Lunas ({selectedIds.size})</button>
              <button onClick={() => handleBulkAction('mark_pending')} disabled={selectedIds.size===0} className="bg-slate-200 text-slate-700 px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-50">Pending</button>
          </div>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden">
          <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b">
                  <tr>
                      <th className="p-4 w-10"></th>
                      <th className="p-4">Tanggal</th>
                      <th className="p-4">Nama Hutang</th>
                      <th className="p-4">Nominal</th>
                      <th className="p-4">Status</th>
                  </tr>
              </thead>
              <tbody className="divide-y">
                  {filteredData.map(inst => (
                      <tr key={inst.id} className={selectedIds.has(inst.id) ? 'bg-blue-50' : ''}>
                          <td className="p-4"><button onClick={()=>toggleSelection(inst.id)}>{selectedIds.has(inst.id)?<CheckSquare className="text-brand-600"/>:<Square className="text-slate-300"/>}</button></td>
                          <td className="p-4 font-mono">{inst.dueDate}</td>
                          <td className="p-4 font-bold">{debts.find(d=>d.id===inst.debtId)?.name}</td>
                          <td className="p-4 font-mono">{formatCurrency(inst.amount)}</td>
                          <td className="p-4"><span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${inst.status==='paid'?'bg-green-100 text-green-700':'bg-yellow-100 text-yellow-700'}`}>{inst.status}</span></td>
                      </tr>
                  ))}
              </tbody>
          </table>
      </div>
    </div>
  );
}
