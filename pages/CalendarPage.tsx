
import React, { useState, useMemo } from 'react';
import { DebtItem, DebtInstallment, PaymentRecord } from '../types';
import { formatCurrency, generateInstallmentsForDebt } from '../services/financeUtils';
import { Calendar as CalIcon, Search, CheckSquare, Square, CheckCircle2, RotateCcw, X, Info, ChevronLeft, ChevronRight, TrendingUp, CalendarDays, Table as TableIcon, Filter, LayoutGrid, ArrowDownUp } from 'lucide-react';
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
  const [viewMode, setViewMode] = useState<'calendar' | 'table'>('calendar');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date()); 
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'pending' | 'overdue'>('all');

  // --- DATA PREP ---
  const allInstallments = useMemo(() => {
      let combined: DebtInstallment[] = [];
      debts.forEach(debt => {
          // Merge saved installments with generated ones
          const savedForDebt = debtInstallments.filter(i => i.debtId === debt.id);
          const fullSchedule = generateInstallmentsForDebt(debt, savedForDebt);
          combined = [...combined, ...fullSchedule];
      });
      return combined.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [debts, debtInstallments]);

  // Calendar View Data
  const yearEvents = useMemo(() => {
      return allInstallments.filter(inst => new Date(inst.dueDate).getFullYear() === selectedYear);
  }, [allInstallments, selectedYear]);

  const eventsMap = useMemo(() => {
      const map: Record<string, DebtInstallment[]> = {};
      yearEvents.forEach(inst => {
          const d = new Date(inst.dueDate);
          const key = `${d.getMonth()}-${d.getDate()}`; 
          if (!map[key]) map[key] = [];
          map[key].push(inst);
      });
      return map;
  }, [yearEvents]);

  const selectedDayEvents = useMemo(() => {
      return allInstallments.filter(inst => {
          const d = new Date(inst.dueDate);
          return d.getDate() === selectedDate.getDate() && 
                 d.getMonth() === selectedDate.getMonth() && 
                 d.getFullYear() === selectedDate.getFullYear();
      });
  }, [allInstallments, selectedDate]);

  // Table View Data
  const filteredTableData = useMemo(() => {
      return allInstallments.filter(inst => {
          if (filterStatus === 'all') return true;
          return inst.status === filterStatus;
      });
  }, [allInstallments, filterStatus]);

  // --- ACTIONS ---
  const handleBulkAction = async (action: 'mark_paid' | 'mark_pending') => {
      if (selectedIds.size === 0) return;
      const newStatus = action === 'mark_paid' ? 'paid' : 'pending';
      const userId = localStorage.getItem('paydone_active_user') || 'user';
      const now = new Date().toISOString();
      const modifiedItems: DebtInstallment[] = [];

      // Find items to update from the full list
      allInstallments.forEach(inst => {
          if (selectedIds.has(inst.id) && inst.status !== newStatus) {
              modifiedItems.push({ ...inst, status: newStatus as any, updatedAt: now });
          }
      });

      if (modifiedItems.length === 0) {
          setSelectedIds(new Set());
          return;
      }

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

      // Push to Cloud
      await pushPartialUpdate(userId, { debtInstallments: modifiedItems });
      setSelectedIds(new Set());
  };

  const toggleSelection = (id: string) => {
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
      setSelectedIds(newSet);
  };

  const selectAllFiltered = () => {
      if (selectedIds.size === filteredTableData.length) {
          setSelectedIds(new Set());
      } else {
          setSelectedIds(new Set(filteredTableData.map(i => i.id)));
      }
  };

  const handleYearChange = (dir: number) => { setSelectedYear(prev => prev + dir); };

  // --- COMPONENT: MINI MONTH ---
  const MiniMonth: React.FC<{ monthIndex: number }> = ({ monthIndex }) => {
      const date = new Date(selectedYear, monthIndex, 1);
      const daysInMonth = new Date(selectedYear, monthIndex + 1, 0).getDate();
      const startDay = date.getDay();
      const monthName = date.toLocaleDateString('id-ID', { month: 'long' });

      return (
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col h-full hover:bg-white hover:shadow-md transition-all">
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-3 text-center">{monthName}</h4>
              <div className="grid grid-cols-7 gap-1 text-center flex-1">
                  {['M','S','S','R','K','J','S'].map((d,i) => (
                      <div key={i} className="text-[9px] font-bold text-slate-300">{d}</div>
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
                                  text-[10px] font-medium rounded-lg aspect-square flex items-center justify-center relative transition-all
                                  ${isSelected ? 'bg-slate-900 text-white shadow-lg scale-110 z-10' : 'hover:bg-slate-200 text-slate-600'}
                                  ${dayEvents.length > 0 ? 'font-bold' : ''}
                              `}
                          >
                              {day}
                              <div className="absolute bottom-1 flex gap-0.5">
                                  {hasPending && <div className="w-1 h-1 rounded-full bg-red-500"></div>}
                                  {hasPaid && !hasPending && <div className="w-1 h-1 rounded-full bg-green-500"></div>}
                              </div>
                          </button>
                      );
                  })}
              </div>
          </div>
      );
  };

  return (
    <div className="space-y-6 pb-24 h-full flex flex-col animate-fade-in">
      
      {/* HEADER CONTROLS */}
      <div className="bg-white p-6 rounded-[2.5rem] border shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                  <CalIcon className="text-brand-600"/> Kalender Sakti
              </h2>
              <p className="text-sm text-slate-500 font-medium mt-1">Peta jalan cashflow dan manajemen cicilan pintar.</p>
          </div>
          
          <div className="flex flex-wrap gap-3">
              <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button 
                    onClick={() => setViewMode('calendar')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition ${viewMode === 'calendar' ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                      <LayoutGrid size={16}/> Kalender
                  </button>
                  <button 
                    onClick={() => setViewMode('table')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition ${viewMode === 'table' ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                      <TableIcon size={16}/> Tabel Cicilan
                  </button>
              </div>

              {viewMode === 'calendar' && (
                  <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                      <button onClick={() => handleYearChange(-1)} className="p-2 hover:bg-white rounded-lg shadow-sm transition"><ChevronLeft size={16}/></button>
                      <span className="font-black text-slate-800 w-20 text-center text-sm">{selectedYear}</span>
                      <button onClick={() => handleYearChange(1)} className="p-2 hover:bg-white rounded-lg shadow-sm transition"><ChevronRight size={16}/></button>
                  </div>
              )}
          </div>
      </div>

      <div className="flex-1 min-h-0">
          
          {/* VIEW: CALENDAR */}
          {viewMode === 'calendar' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
                  <div className="lg:col-span-8 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-6 flex flex-col overflow-hidden">
                      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4 pb-4">
                              {Array.from({length: 12}).map((_, idx) => (
                                  <MiniMonth key={idx} monthIndex={idx} />
                              ))}
                          </div>
                      </div>
                  </div>

                  <div className="lg:col-span-4 flex flex-col gap-6">
                      <div className="bg-slate-900 text-white rounded-[2.5rem] p-8 shadow-xl relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-6 opacity-10"><TrendingUp size={100}/></div>
                          <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-2">Tagihan Harian</h3>
                          <div className="text-4xl font-black tracking-tighter">
                              {/* FIX: Explicit number conversion */}
                              {formatCurrency(selectedDayEvents.reduce((a,b)=>a + Number(b.amount || 0),0))}
                          </div>
                          <p className="text-xs text-slate-400 mt-2 font-medium border-t border-slate-700 pt-2 inline-block">
                              {selectedDate.toLocaleDateString('id-ID', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'})}
                          </p>
                      </div>

                      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden">
                          <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Rincian Hari Ini</h3>
                              <div className="flex gap-2">
                                  <button onClick={() => handleBulkAction('mark_paid')} disabled={selectedIds.size===0} className="p-2 bg-green-100 text-green-700 rounded-lg disabled:opacity-50 hover:bg-green-200 transition"><CheckCircle2 size={16}/></button>
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
          )}

          {/* VIEW: TABLE */}
          {viewMode === 'table' && (
              <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50">
                      <div className="flex gap-2">
                          {['all', 'pending', 'paid', 'overdue'].map(status => (
                              <button 
                                key={status}
                                onClick={() => setFilterStatus(status as any)}
                                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition ${filterStatus === status ? 'bg-slate-900 text-white shadow-lg' : 'bg-white border text-slate-500 hover:bg-slate-100'}`}
                              >
                                  {status}
                              </button>
                          ))}
                      </div>
                      <div className="flex gap-3">
                          {selectedIds.size > 0 && (
                              <div className="flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-xl border border-blue-100 animate-fade-in">
                                  <span className="text-xs font-bold text-blue-700">{selectedIds.size} Selected</span>
                                  <div className="h-4 w-px bg-blue-200"></div>
                                  <button onClick={() => handleBulkAction('mark_paid')} className="text-[10px] bg-white px-2 py-1 rounded border border-blue-200 text-blue-600 font-bold hover:bg-blue-100">Mark Paid</button>
                                  <button onClick={() => handleBulkAction('mark_pending')} className="text-[10px] bg-white px-2 py-1 rounded border border-blue-200 text-slate-600 font-bold hover:bg-slate-50">Reset</button>
                              </div>
                          )}
                      </div>
                  </div>

                  <div className="flex-1 overflow-auto custom-scrollbar">
                      <table className="w-full text-sm text-left">
                          <thead className="text-xs text-slate-500 uppercase bg-white font-black tracking-wider sticky top-0 z-10 border-b shadow-sm">
                              <tr>
                                  <th className="px-6 py-4 w-10">
                                      <button onClick={selectAllFiltered} className="text-slate-400 hover:text-slate-600">
                                          {selectedIds.size > 0 && selectedIds.size === filteredTableData.length ? <CheckSquare size={18}/> : <Square size={18}/>}
                                      </button>
                                  </th>
                                  <th className="px-6 py-4">Jatuh Tempo <ArrowDownUp size={12} className="inline ml-1"/></th>
                                  <th className="px-6 py-4">Nama Hutang</th>
                                  <th className="px-6 py-4">Periode</th>
                                  <th className="px-6 py-4">Total Tagihan</th>
                                  <th className="px-6 py-4">Porsi Pokok</th>
                                  <th className="px-6 py-4">Bunga</th>
                                  <th className="px-6 py-4 text-center">Status</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                              {filteredTableData.map(inst => (
                                  <tr key={inst.id} className={`hover:bg-slate-50 transition group ${selectedIds.has(inst.id) ? 'bg-blue-50/30' : ''}`}>
                                      <td className="px-6 py-4">
                                          <button onClick={()=>toggleSelection(inst.id)} className="text-slate-300 group-hover:text-brand-500">
                                              {selectedIds.has(inst.id) ? <CheckSquare size={18} className="text-brand-600"/> : <Square size={18}/>}
                                          </button>
                                      </td>
                                      <td className="px-6 py-4 font-mono text-slate-600">
                                          {new Date(inst.dueDate).toLocaleDateString('id-ID', {day: '2-digit', month: 'short', year: 'numeric'})}
                                      </td>
                                      <td className="px-6 py-4 font-bold text-slate-900">
                                          {debts.find(d => d.id === inst.debtId)?.name || 'Unknown'}
                                      </td>
                                      <td className="px-6 py-4 text-slate-500">Bulan ke-{inst.period}</td>
                                      <td className="px-6 py-4 font-black text-slate-800">{formatCurrency(inst.amount)}</td>
                                      <td className="px-6 py-4 text-slate-500 text-xs">{formatCurrency(inst.principalPart)}</td>
                                      <td className="px-6 py-4 text-slate-500 text-xs">{formatCurrency(inst.interestPart)}</td>
                                      <td className="px-6 py-4 text-center">
                                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${inst.status === 'paid' ? 'bg-green-100 text-green-700 border border-green-200' : inst.status === 'overdue' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                                              {inst.status}
                                          </span>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                      {filteredTableData.length === 0 && (
                          <div className="text-center py-20 text-slate-400 font-medium italic">Tidak ada data cicilan yang cocok dengan filter ini.</div>
                      )}
                  </div>
              </div>
          )}
      </div>
    </div>
  );
}
