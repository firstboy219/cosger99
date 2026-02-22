
import React, { useState, useMemo, useCallback } from 'react';
import { DebtItem, DebtInstallment, PaymentRecord } from '../types';
import { formatCurrency, generateInstallmentsForDebt } from '../services/financeUtils';
import { Calendar as CalIcon, CheckSquare, Square, CheckCircle2, ChevronLeft, ChevronRight, CalendarDays, Table as TableIcon, LayoutGrid, Search, Filter, ArrowUpDown, ChevronsUp, X, Banknote, Clock, AlertCircle, CircleDot, Eye, EyeOff } from 'lucide-react';
import { pushPartialUpdate } from '../services/cloudSync';
import { saveUserData, getUserData } from '../services/mockDb';

interface CalendarPageProps {
  debts: DebtItem[];
  debtInstallments: DebtInstallment[];
  setDebtInstallments: React.Dispatch<React.SetStateAction<DebtInstallment[]>>;
  paymentRecords: PaymentRecord[];
  setPaymentRecords: React.Dispatch<React.SetStateAction<PaymentRecord[]>>;
}

// --- STATUS BADGE ---
const StatusBadge: React.FC<{status: string}> = ({status}) => {
  const config: Record<string, {bg: string, text: string, dot: string, label: string}> = {
    paid: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Lunas' },
    pending: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Belum' },
    overdue: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500', label: 'Terlambat' },
  };
  const c = config[status] || config.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`}/>
      {c.label}
    </span>
  );
};

export default function CalendarPage({ debts, debtInstallments, setDebtInstallments, paymentRecords, setPaymentRecords }: CalendarPageProps) {
  const [viewMode, setViewMode] = useState<'calendar' | 'table'>('calendar');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'pending' | 'overdue'>('all');
  const [filterDebtId, setFilterDebtId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'dueDate' | 'amount' | 'period'>('dueDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showFilters, setShowFilters] = useState(false);

  // 3-month window offset from today
  const [monthOffset, setMonthOffset] = useState(0);

  // --- DATA PREP ---
  const allInstallments = useMemo(() => {
      let combined: DebtInstallment[] = [];
      debts.forEach(debt => {
          const savedForDebt = debtInstallments.filter(i => i.debtId === debt.id);
          const fullSchedule = generateInstallmentsForDebt(debt, savedForDebt);
          combined = [...combined, ...fullSchedule];
      });
      return combined.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [debts, debtInstallments]);

  // The 3 months to display
  const threeMonths = useMemo(() => {
      const today = new Date();
      return [0, 1, 2].map(i => {
          const d = new Date(today.getFullYear(), today.getMonth() + monthOffset + i, 1);
          return { year: d.getFullYear(), month: d.getMonth() };
      });
  }, [monthOffset]);

  // Events map for the 3 visible months
  const eventsMap = useMemo(() => {
      const map: Record<string, DebtInstallment[]> = {};
      allInstallments.forEach(inst => {
          const d = new Date(inst.dueDate);
          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          if (!map[key]) map[key] = [];
          map[key].push(inst);
      });
      return map;
  }, [allInstallments]);

  const selectedDayEvents = useMemo(() => {
      return allInstallments.filter(inst => {
          const d = new Date(inst.dueDate);
          return d.getDate() === selectedDate.getDate() &&
                 d.getMonth() === selectedDate.getMonth() &&
                 d.getFullYear() === selectedDate.getFullYear();
      });
  }, [allInstallments, selectedDate]);

  // Table data with full filtering and sorting
  const filteredTableData = useMemo(() => {
      let data = allInstallments.filter(inst => {
          if (filterStatus !== 'all' && inst.status !== filterStatus) return false;
          if (filterDebtId !== 'all' && inst.debtId !== filterDebtId) return false;
          if (searchQuery) {
              const debtName = debts.find(d => d.id === inst.debtId)?.name || '';
              const q = searchQuery.toLowerCase();
              if (!debtName.toLowerCase().includes(q) && !inst.period.toString().includes(q)) return false;
          }
          return true;
      });
      data.sort((a, b) => {
          let cmp = 0;
          if (sortField === 'dueDate') cmp = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
          else if (sortField === 'amount') cmp = Number(a.amount || 0) - Number(b.amount || 0);
          else if (sortField === 'period') cmp = a.period - b.period;
          return sortDir === 'asc' ? cmp : -cmp;
      });
      return data;
  }, [allInstallments, filterStatus, filterDebtId, searchQuery, sortField, sortDir, debts]);

  // Summary stats for table
  const tableStats = useMemo(() => {
      const total = filteredTableData.reduce((a, b) => a + Number(b.amount || 0), 0);
      const paid = filteredTableData.filter(i => i.status === 'paid');
      const pending = filteredTableData.filter(i => i.status === 'pending');
      const overdue = filteredTableData.filter(i => i.status === 'overdue');
      const paidTotal = paid.reduce((a, b) => a + Number(b.amount || 0), 0);
      const pendingTotal = pending.reduce((a, b) => a + Number(b.amount || 0), 0);
      return { total, paidCount: paid.length, pendingCount: pending.length, overdueCount: overdue.length, paidTotal, pendingTotal };
  }, [filteredTableData]);

  // --- ACTIONS ---
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

      if (modifiedItems.length === 0) {
          setSelectedIds(new Set());
          return;
      }

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

  // AUTO-CASCADE CHECK: checking month N auto-checks all months 1..N for the SAME debt
  const handleCascadeCheck = useCallback((inst: DebtInstallment) => {
      const isCurrentlySelected = selectedIds.has(inst.id);
      const newSet = new Set(selectedIds);

      // Get all installments for the same debt, sorted by period
      const sameDebtInstallments = filteredTableData
          .filter(i => i.debtId === inst.debtId)
          .sort((a, b) => a.period - b.period);

      if (isCurrentlySelected) {
          // UNCHECK: uncheck this and all AFTER it for the same debt
          sameDebtInstallments.forEach(i => {
              if (i.period >= inst.period) newSet.delete(i.id);
          });
      } else {
          // CHECK: check this and all BEFORE it for the same debt
          sameDebtInstallments.forEach(i => {
              if (i.period <= inst.period) newSet.add(i.id);
          });
      }
      setSelectedIds(newSet);
  }, [selectedIds, filteredTableData]);

  const selectAllFiltered = () => {
      if (selectedIds.size === filteredTableData.length) {
          setSelectedIds(new Set());
      } else {
          setSelectedIds(new Set(filteredTableData.map(i => i.id)));
      }
  };

  const toggleSort = (field: typeof sortField) => {
      if (sortField === field) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
      else { setSortField(field); setSortDir('asc'); }
  };

  // --- MINI MONTH COMPONENT (Improved) ---
  const MiniMonth: React.FC<{ year: number; monthIndex: number }> = ({ year, monthIndex }) => {
      const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
      const startDay = new Date(year, monthIndex, 1).getDay();
      const monthName = new Date(year, monthIndex, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
      const today = new Date();
      const isCurrentMonth = today.getFullYear() === year && today.getMonth() === monthIndex;

      // Count events for this month
      const monthPending = allInstallments.filter(inst => {
          const d = new Date(inst.dueDate);
          return d.getFullYear() === year && d.getMonth() === monthIndex && inst.status === 'pending';
      }).length;
      const monthPaid = allInstallments.filter(inst => {
          const d = new Date(inst.dueDate);
          return d.getFullYear() === year && d.getMonth() === monthIndex && inst.status === 'paid';
      }).length;
      const monthTotal = allInstallments.filter(inst => {
          const d = new Date(inst.dueDate);
          return d.getFullYear() === year && d.getMonth() === monthIndex;
      }).reduce((a, b) => a + Number(b.amount || 0), 0);

      return (
          <div className={`rounded-2xl border transition-all ${isCurrentMonth ? 'border-slate-300 bg-white shadow-lg ring-1 ring-slate-200' : 'border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-md'}`}>
              {/* Month header */}
              <div className={`px-5 py-3 border-b flex items-center justify-between ${isCurrentMonth ? 'border-slate-200 bg-slate-900 text-white rounded-t-2xl' : 'border-slate-100'}`}>
                  <h4 className={`text-sm font-bold ${isCurrentMonth ? 'text-white' : 'text-slate-700'}`}>{monthName}</h4>
                  {monthTotal > 0 && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isCurrentMonth ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      {formatCurrency(monthTotal)}
                    </span>
                  )}
              </div>

              {/* Calendar grid */}
              <div className="p-3">
                  <div className="grid grid-cols-7 gap-0.5 mb-1">
                      {['Min','Sen','Sel','Rab','Kam','Jum','Sab'].map((d, i) => (
                          <div key={i} className="text-[9px] font-bold text-slate-300 text-center py-1">{d}</div>
                      ))}
                  </div>
                  <div className="grid grid-cols-7 gap-0.5">
                      {Array.from({length: startDay}).map((_, i) => <div key={`e-${i}`} className="aspect-square" />)}
                      {Array.from({length: daysInMonth}).map((_, i) => {
                          const day = i + 1;
                          const key = `${year}-${monthIndex}-${day}`;
                          const dayEvents = eventsMap[key] || [];
                          const hasPending = dayEvents.some(e => e.status === 'pending');
                          const allPaid = dayEvents.length > 0 && dayEvents.every(e => e.status === 'paid');
                          const hasOverdue = dayEvents.some(e => e.status === 'overdue');
                          const isToday = today.getDate() === day && isCurrentMonth;
                          const isSelected = selectedDate.getDate() === day && selectedDate.getMonth() === monthIndex && selectedDate.getFullYear() === year;

                          return (
                              <button
                                  key={day}
                                  onClick={() => setSelectedDate(new Date(year, monthIndex, day))}
                                  className={`
                                      aspect-square rounded-lg flex flex-col items-center justify-center relative text-[11px] font-medium transition-all
                                      ${isSelected ? 'bg-slate-900 text-white shadow-lg scale-110 z-10 ring-2 ring-slate-400' : ''}
                                      ${isToday && !isSelected ? 'bg-blue-50 text-blue-700 font-bold ring-1 ring-blue-200' : ''}
                                      ${!isSelected && !isToday ? 'hover:bg-slate-100 text-slate-600' : ''}
                                      ${dayEvents.length > 0 ? 'font-bold' : ''}
                                  `}
                              >
                                  {day}
                                  {dayEvents.length > 0 && (
                                      <div className="absolute bottom-0.5 flex gap-0.5">
                                          {hasOverdue && <span className="w-1 h-1 rounded-full bg-red-500"/>}
                                          {hasPending && !hasOverdue && <span className="w-1 h-1 rounded-full bg-amber-500"/>}
                                          {allPaid && <span className="w-1 h-1 rounded-full bg-emerald-500"/>}
                                      </div>
                                  )}
                              </button>
                          );
                      })}
                  </div>
              </div>

              {/* Month summary footer */}
              <div className="px-4 py-2.5 border-t border-slate-100 flex items-center gap-3 text-[10px]">
                  {monthPaid > 0 && <span className="flex items-center gap-1 text-emerald-600 font-bold"><CheckCircle2 size={10}/> {monthPaid}</span>}
                  {monthPending > 0 && <span className="flex items-center gap-1 text-amber-600 font-bold"><Clock size={10}/> {monthPending}</span>}
                  {monthPaid === 0 && monthPending === 0 && <span className="text-slate-300 italic">Tidak ada tagihan</span>}
              </div>
          </div>
      );
  };

  return (
    <div className="space-y-4 pb-24 h-full flex flex-col">

      {/* HEADER */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
                      <div className="p-2 bg-slate-100 rounded-xl"><CalIcon size={18} className="text-slate-700"/></div>
                      Kalender Sakti
                  </h2>
                  <p className="text-xs text-slate-400 mt-1 ml-11">Peta jalan cicilan & manajemen pembayaran</p>
              </div>

              <div className="flex items-center gap-2">
                  {/* View mode toggle */}
                  <div className="flex bg-slate-100 p-0.5 rounded-lg">
                      <button
                        onClick={() => setViewMode('calendar')}
                        className={`px-3.5 py-2 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${viewMode === 'calendar' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                          <LayoutGrid size={14}/> Kalender
                      </button>
                      <button
                        onClick={() => setViewMode('table')}
                        className={`px-3.5 py-2 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${viewMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                          <TableIcon size={14}/> Tabel Cicilan
                      </button>
                  </div>
              </div>
          </div>
      </div>

      {/* ===== CALENDAR VIEW ===== */}
      {viewMode === 'calendar' && (
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* 3 Month Calendar Grid */}
              <div className="lg:col-span-2 flex flex-col gap-4">
                  {/* Month navigation */}
                  <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-4 py-2.5">
                      <button onClick={() => setMonthOffset(prev => prev - 1)} className="p-1.5 hover:bg-slate-100 rounded-lg transition"><ChevronLeft size={16} className="text-slate-500"/></button>
                      <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-700">
                              {new Date(new Date().getFullYear(), new Date().getMonth() + monthOffset, 1).toLocaleDateString('id-ID', {month: 'long', year: 'numeric'})}
                              {' - '}
                              {new Date(new Date().getFullYear(), new Date().getMonth() + monthOffset + 2, 1).toLocaleDateString('id-ID', {month: 'long', year: 'numeric'})}
                          </span>
                          {monthOffset !== 0 && (
                              <button onClick={() => setMonthOffset(0)} className="text-[10px] px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 font-semibold transition">Hari ini</button>
                          )}
                      </div>
                      <button onClick={() => setMonthOffset(prev => prev + 1)} className="p-1.5 hover:bg-slate-100 rounded-lg transition"><ChevronRight size={16} className="text-slate-500"/></button>
                  </div>

                  {/* The 3 calendars */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1">
                      {threeMonths.map((m, idx) => (
                          <MiniMonth key={`${m.year}-${m.month}`} year={m.year} monthIndex={m.month} />
                      ))}
                  </div>

                  {/* Legend */}
                  <div className="flex items-center gap-4 px-2 text-[10px] text-slate-400">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"/> Lunas</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"/> Belum Bayar</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"/> Terlambat</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-200 ring-1 ring-blue-300"/> Hari Ini</span>
                  </div>
              </div>

              {/* Right Panel: Selected Day Detail */}
              <div className="flex flex-col gap-3">
                  {/* Summary card */}
                  <div className="bg-slate-900 text-white rounded-2xl p-5 relative overflow-hidden">
                      <div className="absolute top-0 right-0 opacity-5"><Banknote size={120}/></div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                          {selectedDate.toLocaleDateString('id-ID', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'})}
                      </p>
                      <div className="text-2xl font-bold tracking-tight mt-1">
                          {formatCurrency(selectedDayEvents.reduce((a, b) => a + Number(b.amount || 0), 0))}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-2">
                          {selectedDayEvents.length > 0 ? `${selectedDayEvents.length} tagihan` : 'Tidak ada tagihan'}
                          {selectedDayEvents.filter(e => e.status === 'paid').length > 0 && ` \u00B7 ${selectedDayEvents.filter(e => e.status === 'paid').length} lunas`}
                      </p>
                  </div>

                  {/* Day events list */}
                  <div className="bg-white rounded-2xl border border-slate-200 flex-1 flex flex-col overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                          <h3 className="text-xs font-bold text-slate-700">Rincian Tagihan</h3>
                          {selectedDayEvents.length > 0 && (
                              <button
                                  onClick={() => {
                                      const pendingIds = selectedDayEvents.filter(e => e.status !== 'paid').map(e => e.id);
                                      setSelectedIds(new Set(pendingIds));
                                      handleBulkAction('mark_paid');
                                  }}
                                  className="text-[10px] px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg font-bold hover:bg-emerald-100 transition flex items-center gap-1"
                              >
                                  <CheckCircle2 size={10}/> Tandai Semua Lunas
                              </button>
                          )}
                      </div>
                      <div className="flex-1 overflow-y-auto p-3 space-y-2">
                          {selectedDayEvents.length === 0 ? (
                              <div className="h-full flex flex-col items-center justify-center text-center py-10">
                                  <CalendarDays size={32} className="text-slate-200 mb-2"/>
                                  <p className="text-xs text-slate-300">Pilih tanggal yang memiliki tagihan</p>
                              </div>
                          ) : selectedDayEvents.map(inst => {
                              const debt = debts.find(d => d.id === inst.debtId);
                              return (
                                  <div key={inst.id} className={`p-3 rounded-xl border transition-all ${inst.status === 'paid' ? 'bg-slate-50 border-slate-100 opacity-70' : 'bg-white border-slate-200 hover:shadow-sm'}`}>
                                      <div className="flex items-start justify-between gap-2">
                                          <div className="flex-1 min-w-0">
                                              <p className="text-sm font-bold text-slate-800 truncate">{debt?.name || 'Unknown'}</p>
                                              <div className="flex items-center gap-2 mt-1">
                                                  <span className="text-[10px] text-slate-400 font-mono">Ke-{inst.period}</span>
                                                  <StatusBadge status={inst.status}/>
                                              </div>
                                          </div>
                                          <div className="text-right shrink-0">
                                              <p className="text-sm font-bold text-slate-900">{formatCurrency(inst.amount)}</p>
                                              <p className="text-[9px] text-slate-400 mt-0.5">Pokok: {formatCurrency(inst.principalPart)}</p>
                                          </div>
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* ===== TABLE VIEW ===== */}
      {viewMode === 'table' && (
          <div className="flex-1 min-h-0 flex flex-col gap-3">

              {/* Stats bar */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex items-center gap-3">
                      <div className="p-2 bg-slate-100 rounded-lg"><Banknote size={16} className="text-slate-600"/></div>
                      <div><p className="text-[10px] text-slate-400 font-semibold">Total</p><p className="text-sm font-bold text-slate-800">{formatCurrency(tableStats.total)}</p></div>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex items-center gap-3">
                      <div className="p-2 bg-emerald-50 rounded-lg"><CheckCircle2 size={16} className="text-emerald-600"/></div>
                      <div><p className="text-[10px] text-slate-400 font-semibold">Lunas</p><p className="text-sm font-bold text-emerald-700">{tableStats.paidCount} <span className="text-[10px] text-slate-400 font-normal">cicilan</span></p></div>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex items-center gap-3">
                      <div className="p-2 bg-amber-50 rounded-lg"><Clock size={16} className="text-amber-600"/></div>
                      <div><p className="text-[10px] text-slate-400 font-semibold">Belum</p><p className="text-sm font-bold text-amber-700">{tableStats.pendingCount} <span className="text-[10px] text-slate-400 font-normal">cicilan</span></p></div>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex items-center gap-3">
                      <div className="p-2 bg-red-50 rounded-lg"><AlertCircle size={16} className="text-red-600"/></div>
                      <div><p className="text-[10px] text-slate-400 font-semibold">Terlambat</p><p className="text-sm font-bold text-red-700">{tableStats.overdueCount} <span className="text-[10px] text-slate-400 font-normal">cicilan</span></p></div>
                  </div>
              </div>

              {/* Toolbar */}
              <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                      {/* Search */}
                      <div className="relative flex-1 min-w-[180px]">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300"/>
                          <input
                              type="text"
                              value={searchQuery}
                              onChange={e => setSearchQuery(e.target.value)}
                              placeholder="Cari nama hutang atau periode..."
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg text-xs py-2 pl-9 pr-3 focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 placeholder-slate-300"
                          />
                          {searchQuery && (
                              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"><X size={12}/></button>
                          )}
                      </div>

                      {/* Status filters */}
                      <div className="flex bg-slate-100 p-0.5 rounded-lg">
                          {([
                              { key: 'all', label: 'Semua' },
                              { key: 'pending', label: 'Belum' },
                              { key: 'paid', label: 'Lunas' },
                              { key: 'overdue', label: 'Terlambat' },
                          ] as const).map(s => (
                              <button
                                  key={s.key}
                                  onClick={() => setFilterStatus(s.key)}
                                  className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${filterStatus === s.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                              >
                                  {s.label}
                              </button>
                          ))}
                      </div>

                      {/* Filter toggle */}
                      <button onClick={() => setShowFilters(!showFilters)} className={`p-2 rounded-lg border transition-all ${showFilters ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-200 hover:text-slate-600'}`}>
                          <Filter size={14}/>
                      </button>
                  </div>

                  {/* Advanced filters */}
                  {showFilters && (
                      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
                          <div className="flex items-center gap-2">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">Hutang:</label>
                              <select
                                  value={filterDebtId}
                                  onChange={e => setFilterDebtId(e.target.value)}
                                  className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-400"
                              >
                                  <option value="all">Semua Hutang</option>
                                  {debts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                              </select>
                          </div>
                          {(filterDebtId !== 'all' || searchQuery) && (
                              <button
                                  onClick={() => { setFilterDebtId('all'); setSearchQuery(''); setFilterStatus('all'); }}
                                  className="text-[10px] px-2.5 py-1 bg-red-50 text-red-600 rounded-lg font-bold hover:bg-red-100 transition flex items-center gap-1"
                              >
                                  <X size={10}/> Reset Filter
                              </button>
                          )}
                      </div>
                  )}
              </div>

              {/* Bulk action bar */}
              {selectedIds.size > 0 && (
                  <div className="bg-slate-900 text-white rounded-xl p-3 flex items-center justify-between gap-3 animate-fade-in">
                      <div className="flex items-center gap-3">
                          <span className="text-xs font-bold">{selectedIds.size} dipilih</span>
                          <span className="text-[10px] text-slate-400">
                              Total: {formatCurrency(allInstallments.filter(i => selectedIds.has(i.id)).reduce((a, b) => a + Number(b.amount || 0), 0))}
                          </span>
                      </div>
                      <div className="flex items-center gap-2">
                          <button onClick={() => handleBulkAction('mark_paid')} className="px-3 py-1.5 bg-emerald-600 rounded-lg text-[10px] font-bold hover:bg-emerald-500 transition flex items-center gap-1.5"><CheckCircle2 size={12}/> Tandai Lunas</button>
                          <button onClick={() => handleBulkAction('mark_pending')} className="px-3 py-1.5 bg-slate-700 rounded-lg text-[10px] font-bold hover:bg-slate-600 transition">Reset Status</button>
                          <button onClick={() => setSelectedIds(new Set())} className="p-1.5 hover:bg-slate-700 rounded-lg transition"><X size={14}/></button>
                      </div>
                  </div>
              )}

              {/* Table */}
              <div className="bg-white rounded-xl border border-slate-200 flex-1 flex flex-col overflow-hidden">
                  <div className="flex-1 overflow-auto">
                      <table className="w-full text-sm text-left">
                          <thead className="text-[10px] text-slate-400 uppercase bg-slate-50 font-bold tracking-wider sticky top-0 z-10 border-b border-slate-200">
                              <tr>
                                  <th className="px-4 py-3 w-10">
                                      <button onClick={selectAllFiltered} className="text-slate-300 hover:text-slate-600 transition">
                                          {selectedIds.size > 0 && selectedIds.size === filteredTableData.length ? <CheckSquare size={16} className="text-slate-700"/> : <Square size={16}/>}
                                      </button>
                                  </th>
                                  <th className="px-4 py-3 cursor-pointer hover:text-slate-600 transition" onClick={() => toggleSort('dueDate')}>
                                      <span className="flex items-center gap-1">Jatuh Tempo <ArrowUpDown size={10} className={sortField === 'dueDate' ? 'text-slate-700' : ''}/></span>
                                  </th>
                                  <th className="px-4 py-3">Nama Hutang</th>
                                  <th className="px-4 py-3 cursor-pointer hover:text-slate-600 transition" onClick={() => toggleSort('period')}>
                                      <span className="flex items-center gap-1">Periode <ArrowUpDown size={10} className={sortField === 'period' ? 'text-slate-700' : ''}/></span>
                                  </th>
                                  <th className="px-4 py-3 cursor-pointer hover:text-slate-600 transition" onClick={() => toggleSort('amount')}>
                                      <span className="flex items-center gap-1">Tagihan <ArrowUpDown size={10} className={sortField === 'amount' ? 'text-slate-700' : ''}/></span>
                                  </th>
                                  <th className="px-4 py-3">Pokok</th>
                                  <th className="px-4 py-3">Bunga</th>
                                  <th className="px-4 py-3">Sisa Saldo</th>
                                  <th className="px-4 py-3 text-center">Status</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                              {filteredTableData.map(inst => {
                                  const debt = debts.find(d => d.id === inst.debtId);
                                  const isChecked = selectedIds.has(inst.id);
                                  return (
                                      <tr key={inst.id} className={`group transition-colors ${isChecked ? 'bg-blue-50/40' : 'hover:bg-slate-50/80'} ${inst.status === 'paid' ? 'opacity-60' : ''}`}>
                                          <td className="px-4 py-3">
                                              <button onClick={() => handleCascadeCheck(inst)} className="transition" title="Klik untuk menandai sampai periode ini">
                                                  {isChecked ? <CheckSquare size={16} className="text-slate-700"/> : <Square size={16} className="text-slate-200 group-hover:text-slate-400"/>}
                                              </button>
                                          </td>
                                          <td className="px-4 py-3 text-xs text-slate-500 font-mono whitespace-nowrap">
                                              {new Date(inst.dueDate).toLocaleDateString('id-ID', {day: '2-digit', month: 'short', year: 'numeric'})}
                                          </td>
                                          <td className="px-4 py-3">
                                              <p className="text-xs font-bold text-slate-800 truncate max-w-[160px]">{debt?.name || 'Unknown'}</p>
                                              {debt?.bankName && <p className="text-[10px] text-slate-300 mt-0.5">{debt.bankName}</p>}
                                          </td>
                                          <td className="px-4 py-3 text-xs text-slate-500">
                                              <span className="bg-slate-100 px-2 py-0.5 rounded-md font-mono text-[10px] font-bold">{inst.period}</span>
                                          </td>
                                          <td className="px-4 py-3 text-xs font-bold text-slate-800">{formatCurrency(inst.amount)}</td>
                                          <td className="px-4 py-3 text-[11px] text-slate-400">{formatCurrency(inst.principalPart)}</td>
                                          <td className="px-4 py-3 text-[11px] text-slate-400">{formatCurrency(inst.interestPart)}</td>
                                          <td className="px-4 py-3 text-[11px] text-slate-400">{formatCurrency(inst.remainingBalance)}</td>
                                          <td className="px-4 py-3 text-center"><StatusBadge status={inst.status}/></td>
                                      </tr>
                                  );
                              })}
                          </tbody>
                      </table>
                      {filteredTableData.length === 0 && (
                          <div className="text-center py-16">
                              <CalendarDays size={32} className="mx-auto text-slate-200 mb-2"/>
                              <p className="text-xs text-slate-300">Tidak ada data cicilan yang cocok dengan filter ini.</p>
                          </div>
                      )}
                  </div>

                  {/* Table footer */}
                  <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-[10px] text-slate-400">
                      <span>Menampilkan {filteredTableData.length} dari {allInstallments.length} cicilan</span>
                      <span className="font-bold">
                          Total belum bayar: <span className="text-amber-600">{formatCurrency(tableStats.pendingTotal)}</span>
                      </span>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
