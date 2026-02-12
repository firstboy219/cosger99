import React, { useState, useMemo } from 'react';
import { DebtItem, DebtInstallment, PaymentRecord } from '../types';
import { formatCurrency, generateInstallmentsForDebt } from '../services/financeUtils';
import { Calendar as CalIcon, Search, CheckSquare, Square, CheckCircle2, RotateCcw, X, Info, ChevronLeft, ChevronRight, TrendingUp, CalendarDays } from 'lucide-react';
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
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date()); // For sidebar details
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // --- DATA PREP ---
  const allInstallments = useMemo(() => {
      let combined: DebtInstallment[] = [];
      debts.forEach(debt => {
          const savedForDebt = debtInstallments.filter(i => i.debtId === debt.id);
          const fullSchedule = generateInstallmentsForDebt(debt, savedForDebt);
          combined = [...combined, ...fullSchedule];
      });
      return combined;
  }, [debts, debtInstallments]);

  // Filter events by selected year to optimize map rendering
  const yearEvents = useMemo(() => {
      return allInstallments.filter(inst => new Date(inst.dueDate).getFullYear() === selectedYear);
  }, [allInstallments, selectedYear]);

  // Group by "Month-Day" key for fast lookup in mini-calendars
  const eventsMap = useMemo(() => {
      const map: Record<string, DebtInstallment[]> = {};
      yearEvents.forEach(inst => {
          const d = new Date(inst.dueDate);
          const key = `${d.getMonth()}-${d.getDate()}`; // Key: "0-1" for Jan 1st
          if (!map[key]) map[key] = [];
          map[key].push(inst);
      });
      return map;
  }, [yearEvents]);

  // Sidebar: Events for the specific clicked date
  const selectedDayEvents = useMemo(() => {
      return allInstallments.filter(inst => {
          const d = new Date(inst.dueDate);
          return d.getDate() === selectedDate.getDate() && 
                 d.getMonth() === selectedDate.getMonth() && 
                 d.getFullYear() === selectedDate.getFullYear();
      });
  }, [allInstallments, selectedDate]);

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

      await pushPartialUpdate(userId, { debtInstallments: modifiedItems });
      setSelectedIds(new Set());
  };

  const toggleSelection = (id: string) => {
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
      setSelectedIds(newSet);
  };

  const handleYearChange = (dir: number) => {
      setSelectedYear(prev => prev + dir);
  };

  // --- SUB-COMPONENT: MINI MONTH ---
  const MiniMonth: React.FC<{ monthIndex: number }> = ({ monthIndex }) => {
      const date = new Date(selectedYear, monthIndex, 1);
      const daysInMonth = new Date(selectedYear, monthIndex + 1, 0).getDate();
      const startDay = date.getDay(); // 0 Sun
      const monthName = date.toLocaleDateString('id-ID', { month: 'long' });

      return (
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex flex-col h-full hover:bg-white hover:shadow-md transition-all">
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2 text-center">{monthName}</h4>
              <div className="grid grid-cols-7 gap-1 text-center flex-1">
                  {['M','S','S','R','K','J','S'].map((d,i) => (
                      <div key={i} className="text-[8px] font-bold text-slate-300">{d}</div>
                  ))}
                  {Array.from({length: startDay}).map((_, i) => <div key={`empty-${i}`} />)}
                  {Array.from({length: daysInMonth}).map((_, i) => {
                      const day = i + 1;
                      const key = `${monthIndex}-${day}`;
                      const dayEvents = eventsMap[key] || [];
                      const hasPending = dayEvents.some(e => e.status === 'pending');
                      const hasPaid = dayEvents.length > 0 && dayEvents.every(e => e.status === 'paid');
                      
                      const isSelected = selectedDate.getDate() === day && selectedDate.getMonth() === monthIndex && selectedDate.getFullYear() === selectedYear;

                      return (
                          <button
                              key={day}
                              onClick={() => setSelectedDate(new Date(selectedYear, monthIndex, day))}
                              className={`
                                  text-[9px] font-medium rounded-md aspect-square flex items-center justify-center relative
                                  ${isSelected ? 'bg-slate-900 text-white' : 'hover:bg-slate-200 text-slate-600'}
                                  ${dayEvents.length > 0 ? 'font-bold' : ''}
                              `}
                          >
                              {day}
                              {/* Status Dot */}
                              {hasPending && <div className="absolute bottom-0.5 w-1 h-1 rounded-full bg-red-500"></div>}
                              {hasPaid && !hasPending && <div className="absolute bottom-0.5 w-1 h-1 rounded-full bg-green-500"></div>}
                          </button>
                      );
                  })}
              </div>
          </div>
      );
  };

  return (
    <div className="space-y-6 pb-24 h-full flex flex-col">
      {/* HEADER */}
      <div className="bg-white p-6 rounded-[2.5rem] border shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2"><CalIcon className="text-brand-600"/> Kalender Sakti</h2>
              <p className="text-sm text-slate-500 font-medium mt-1">Peta jalan cashflow tahunan.</p>
          </div>
          <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
              <button onClick={() => handleYearChange(-1)} className="p-2 hover:bg-white rounded-lg shadow-sm transition"><ChevronLeft size={16}/></button>
              <span className="font-black text-slate-800 w-24 text-center text-lg tracking-tight">{selectedYear}</span>
              <button onClick={() => handleYearChange(1)} className="p-2 hover:bg-white rounded-lg shadow-sm transition"><ChevronRight size={16}/></button>
          </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
          
          {/* MAIN GRID: 12 MONTHS */}
          <div className="lg:col-span-8 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-6 flex flex-col overflow-hidden">
              <div className="flex items-center gap-2 mb-4 text-slate-400 text-xs font-bold uppercase tracking-widest">
                  <CalendarDays size={14}/> Overview Tahun {selectedYear}
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 h-full">
                      {Array.from({length: 12}).map((_, idx) => (
                          <MiniMonth key={idx} monthIndex={idx} />
                      ))}
                  </div>
              </div>
          </div>

          {/* SIDEBAR: SELECTED DAY DETAIL */}
          <div className="lg:col-span-4 flex flex-col gap-6">
              
              {/* Stat Card */}
              <div className="bg-slate-900 text-white rounded-[2.5rem] p-8 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-10"><TrendingUp size={100}/></div>
                  <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-2">Total Tagihan</h3>
                  <div className="text-4xl font-black tracking-tighter">
                      {formatCurrency(selectedDayEvents.reduce((a,b)=>a+b.amount,0))}
                  </div>
                  <p className="text-xs text-slate-400 mt-2 font-medium border-t border-slate-700 pt-2 inline-block">
                      {selectedDate.toLocaleDateString('id-ID', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'})}
                  </p>
              </div>

              {/* Event List */}
              <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden">
                  <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                      <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Rincian Harian</h3>
                      <div className="flex gap-2">
                          <button onClick={() => handleBulkAction('mark_paid')} disabled={selectedIds.size===0} className="p-2 bg-green-100 text-green-700 rounded-lg disabled:opacity-50"><CheckCircle2 size={16}/></button>
                      </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                      {selectedDayEvents.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-center text-slate-400">
                              <CalendarDays size={40} className="mb-2 opacity-20"/>
                              <p className="text-xs italic">Tidak ada tagihan di tanggal ini.</p>
                          </div>
                      ) : selectedDayEvents.map(inst => (
                          <div key={inst.id} className={`p-4 rounded-2xl border transition-all ${inst.status === 'paid' ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-200 shadow-sm'}`}>
                              <div className="flex justify-between items-start mb-2">
                                  <div className="flex items-center gap-3">
                                      <button onClick={()=>toggleSelection(inst.id)}>
                                          {selectedIds.has(inst.id) ? <CheckSquare className="text-brand-600"/> : <Square className="text-slate-300 hover:text-brand-500"/>}
                                      </button>
                                      <div>
                                          <h4 className="font-bold text-slate-900 text-sm line-clamp-1">{debts.find(d=>d.id===inst.debtId)?.name || 'Unknown Debt'}</h4>
                                          <div className="flex gap-2 mt-0.5">
                                              <span className="text-[9px] font-mono text-slate-400">#{inst.period}</span>
                                              <span className={`text-[9px] font-black uppercase px-1.5 py-0 rounded ${inst.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{inst.status}</span>
                                          </div>
                                      </div>
                                  </div>
                              </div>
                              <div className="pl-8 border-l-2 border-slate-100 ml-2">
                                  <p className="text-lg font-black text-slate-800 tracking-tight">{formatCurrency(inst.amount)}</p>
                                  <p className="text-[9px] text-slate-400 mt-1">Pokok: {formatCurrency(inst.principalPart)}</p>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
}
