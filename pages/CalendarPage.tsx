
import React, { useState, useEffect, useMemo } from 'react';
import { DebtItem, PaymentRecord, DebtInstallment } from '../types';
import { formatCurrency, generateInstallmentsForDebt } from '../services/financeUtils';
import { ChevronLeft, ChevronRight, Calendar, Trash2, Edit2, Filter, List, Grid3X3, Plus, Search, Square, CheckSquare, CheckCircle2, RotateCcw, X, Info } from 'lucide-react';
import { getPublicHolidays } from '../services/geminiService';
import { pushPartialUpdate } from '../services/cloudSync';
import { saveUserData, getUserData } from '../services/mockDb';

interface CalendarPageProps {
  debts: DebtItem[];
  debtInstallments: DebtInstallment[];
  setDebtInstallments: React.Dispatch<React.SetStateAction<DebtInstallment[]>>;
  paymentRecords: PaymentRecord[];
  setPaymentRecords: React.Dispatch<React.SetStateAction<PaymentRecord[]>>;
}

interface Holiday {
    date: string;
    name: string;
}

export default function CalendarPage({ debts, debtInstallments, setDebtInstallments, paymentRecords, setPaymentRecords }: CalendarPageProps) {
  const [viewMode, setViewMode] = useState<'calendar' | 'table'>('table'); // Default to table for better debugging
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [selectedDebtFilter, setSelectedDebtFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Bulk Action State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'edit' | 'pay' | 'add'>('edit');
  const [formData, setFormData] = useState({ 
      id: '', date: '', amount: 0, status: 'pending', notes: '', debtId: '' 
  });

  const getUserId = () => localStorage.getItem('paydone_active_user') || 'user';

  // --- 1. ROBUST DATE HELPER ---
  const safeDate = (dateStr: string | undefined): Date | null => {
      if (!dateStr) return null;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      return d;
  };

  const formatDateDisplay = (dateStr: string) => {
      const d = safeDate(dateStr);
      if (!d) return <span className="text-red-400 text-[10px] font-mono">Invalid Date</span>;
      return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // --- 2. AUTO-HEALING DATA ENGINE ---
  // BUG FIX: Previously, if a debt had ANY record in the DB, the generator stopped creating the rest of the schedule.
  // Now, we iterate ALL debts and merge Real DB records with Virtual Generated ones for a complete timeline.
  const allInstallments = useMemo(() => {
      let combined: DebtInstallment[] = [];

      // 1. Process active debts (Merging Real + Virtual)
      debts.forEach(debt => {
          // Get saved installments for this specific debt
          const savedForDebt = debtInstallments.filter(i => i.debtId === debt.id);
          
          // Generate full schedule. The generator utility handles merging:
          // If a period exists in 'savedForDebt', it uses that.
          // If not, it generates a virtual pending installment.
          const fullSchedule = generateInstallmentsForDebt(debt, savedForDebt);
          
          // FIX: Include manual items (period 0) which are skipped by generator logic (1..N)
          const manualItems = savedForDebt.filter(i => i.period === 0);

          combined = [...combined, ...fullSchedule, ...manualItems];
      });

      // 2. Handle Orphaned Installments (Debt deleted but installments remain)
      // We check if there are any installments in DB whose debtId is NOT in the active debts list
      const activeDebtIds = new Set(debts.map(d => d.id));
      const orphans = debtInstallments.filter(inst => !activeDebtIds.has(inst.debtId));
      
      return [...combined, ...orphans];
  }, [debts, debtInstallments]);

  // --- 3. FILTERING LOGIC ---
  const filteredData = useMemo(() => {
      let data = [...allInstallments];

      // Filter by Dropdown Debt
      if (selectedDebtFilter !== 'all') {
          data = data.filter(i => i.debtId === selectedDebtFilter);
      }

      // Filter by Search Text
      if (searchQuery) {
          const lower = searchQuery.toLowerCase();
          data = data.filter(i => {
              const debt = debts.find(d => d.id === i.debtId);
              const debtName = debt ? debt.name.toLowerCase() : '';
              const notes = (i.notes || '').toLowerCase();
              return debtName.includes(lower) || notes.includes(lower);
          });
      }

      // Sort by Date (Safe Sort)
      return data.sort((a, b) => {
          const tA = safeDate(a.dueDate)?.getTime() || 0;
          const tB = safeDate(b.dueDate)?.getTime() || 0;
          return tA - tB;
      });
  }, [allInstallments, selectedDebtFilter, searchQuery, debts]);

  // Fetch Holidays
  useEffect(() => {
      const fetchHolidays = async () => {
          const data = await getPublicHolidays('Indonesia', currentYear);
          setHolidays(data);
      };
      fetchHolidays();
  }, [currentYear]);

  // --- CRUD HANDLERS ---
  const toggleSelection = (id: string) => {
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
      setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
      if (selectedIds.size === filteredData.length) setSelectedIds(new Set());
      else setSelectedIds(new Set(filteredData.map(i => i.id)));
  };

  // NEW: Single Delete Handler
  const handleDelete = async (id: string) => {
      if (!confirm("Hapus data cicilan ini?")) return;
      
      const userId = getUserId();
      const now = new Date().toISOString();

      // 1. Check if item exists in state (is saved)
      const itemToDelete = debtInstallments.find(i => i.id === id);
      
      if (itemToDelete) {
          const deletedItem = { ...itemToDelete, _deleted: true, updatedAt: now };

          // 2. Update Local State
          setDebtInstallments(prev => {
              const newList = prev.filter(i => i.id !== id);
              
              const currentUserData = getUserData(userId);
              saveUserData(userId, { ...currentUserData, debtInstallments: newList });
              
              return newList;
          });

          // 3. Sync
          await pushPartialUpdate(userId, { debtInstallments: [deletedItem] });
      } else {
          // It's a virtual item (generated by schedule). 
          alert("Item ini adalah jadwal otomatis (Virtual). Tidak bisa dihapus permanen dari sini. \n\nTips: Ubah status menjadi 'Paid' atau edit Hutang Induk (Tenor/Tanggal) untuk mengubah jadwal.");
      }
  };

  const handleBulkAction = async (action: 'mark_paid' | 'mark_pending' | 'delete') => {
      if (!confirm(`Konfirmasi aksi massal pada ${selectedIds.size} item?`)) return;
      
      const newStatus = action === 'mark_paid' ? 'paid' : 'pending';
      const modifiedInstallments: DebtInstallment[] = [];
      const newPaymentRecords: PaymentRecord[] = [];
      const userId = getUserId();
      const now = new Date().toISOString();

      // 1. Calculate Changes (Optimized Loop)
      // Iterate through ALL valid installments (virtual + real) to find selected ones
      allInstallments.forEach(inst => {
          if (selectedIds.has(inst.id)) {
              if (action === 'delete') {
                  // Only delete if it's a real record (exists in DB/State)
                  if (debtInstallments.some(d => d.id === inst.id)) {
                      modifiedInstallments.push({ ...inst, _deleted: true, updatedAt: now });
                  }
              } else {
                  // Only update if status changed to avoid redundant network traffic
                  if (inst.status !== newStatus) {
                      const updatedItem = { 
                          ...inst, 
                          status: newStatus as any,
                          updatedAt: now // Stamp local time
                      };
                      modifiedInstallments.push(updatedItem);

                      if (action === 'mark_paid') {
                          newPaymentRecords.push({
                              id: `pay-bulk-${Date.now()}-${inst.id}`,
                              debtId: inst.debtId,
                              userId: inst.userId,
                              amount: inst.amount,
                              paidDate: new Date().toISOString().split('T')[0],
                              sourceBank: 'Bulk Update',
                              status: 'paid',
                              updatedAt: now
                          });
                      }
                  }
              }
          }
      });

      // 2. Update Local State (Optimistic UI)
      setDebtInstallments(prev => {
          let updatedList = [...prev];

          if (action === 'delete') {
              // Remove deleted items from local state
              updatedList = updatedList.filter(item => !selectedIds.has(item.id));
          } else {
              // A. Update existing items in the array
              updatedList = updatedList.map(item => {
                  if (selectedIds.has(item.id)) {
                      return { ...item, status: newStatus as any };
                  }
                  return item;
              });

              // B. Add "Virtual" items that are now "Real" (because they were modified)
              const virtuals = modifiedInstallments.filter(m => !m._deleted && !prev.some(p => p.id === m.id));
              updatedList = [...updatedList, ...virtuals];
          }
          
          // Explicitly save to Local Storage immediately
          const currentUserData = getUserData(userId);
          saveUserData(userId, { 
              ...currentUserData, 
              debtInstallments: updatedList,
              paymentRecords: [...currentUserData.paymentRecords, ...newPaymentRecords]
          });

          return updatedList;
      });

      if (newPaymentRecords.length > 0) {
          setPaymentRecords(prev => [...prev, ...newPaymentRecords]);
      }

      // 3. Fire Lightweight Partial Sync (Background)
      if (modifiedInstallments.length > 0) {
          const payload: any = { debtInstallments: modifiedInstallments };
          if (newPaymentRecords.length > 0) {
              payload.paymentRecords = newPaymentRecords;
          }
          
          // Non-blocking sync call
          pushPartialUpdate(userId, payload).then(ok => {
              if(!ok) console.warn("Background sync for installments failed (Data saved locally)");
          });
      }

      setSelectedIds(new Set());
  };

  const handleOpenModal = (inst: DebtInstallment | null, mode: 'edit'|'add') => {
      setModalMode(mode);
      if (inst) {
          setFormData({
              id: inst.id,
              date: inst.dueDate,
              amount: inst.amount,
              status: inst.status,
              notes: inst.notes || '',
              debtId: inst.debtId
          });
      } else {
          setFormData({
              id: `manual-${Date.now()}`,
              date: new Date().toISOString().split('T')[0],
              amount: 0,
              status: 'pending',
              notes: '',
              debtId: debts[0]?.id || ''
          });
      }
      setIsModalOpen(true);
  };

  const handleSaveModal = async (e: React.FormEvent) => {
      e.preventDefault();
      const userId = getUserId();
      const now = new Date().toISOString();

      const newItem: DebtInstallment = {
          id: formData.id,
          debtId: formData.debtId,
          userId: userId, 
          period: 0,
          dueDate: formData.date,
          amount: Number(formData.amount),
          principalPart: Number(formData.amount),
          interestPart: 0,
          remainingBalance: 0,
          status: formData.status as any,
          notes: formData.notes,
          updatedAt: now
      };

      // 1. Update Local State
      setDebtInstallments(prev => {
          const exists = prev.find(i => i.id === formData.id);
          let newList;
          if (exists) newList = prev.map(i => i.id === formData.id ? newItem : i);
          else newList = [...prev, newItem];

          // FIX 2: Explicit Save
          const currentUserData = getUserData(userId);
          saveUserData(userId, { ...currentUserData, debtInstallments: newList });
          
          return newList;
      });

      // 2. Partial Sync
      await pushPartialUpdate(userId, { debtInstallments: [newItem] });

      setIsModalOpen(false);
  };

  // --- CALENDAR RENDERER ---
  const getCalendarCells = () => {
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      const startDay = new Date(currentYear, currentMonth, 1).getDay(); // 0=Sun
      const cells = [];
      
      for(let i=0; i<startDay; i++) cells.push(null);
      for(let i=1; i<=daysInMonth; i++) {
          const dateStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
          const dayData = filteredData.filter(d => d.dueDate === dateStr);
          const holiday = holidays.find(h => h.date === dateStr);
          cells.push({ day: i, data: dayData, holiday });
      }
      return cells;
  };

  return (
    <div className="space-y-6 pb-24 relative">
      
      {/* HEADER */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col xl:flex-row justify-between gap-4">
          <div>
              <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="text-brand-600" /> Kalender Cicilan
              </h2>
              <p className="text-slate-500 text-sm">Monitoring jadwal pembayaran dan cashflow keluar.</p>
          </div>
          
          <div className="flex flex-wrap gap-3 items-center">
              <div className="relative">
                  <Filter className="absolute left-3 top-2.5 text-slate-400" size={14}/>
                  <select 
                    className="pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-sm bg-slate-50 focus:ring-2 focus:ring-brand-500 outline-none w-full xl:w-48"
                    value={selectedDebtFilter}
                    onChange={(e) => setSelectedDebtFilter(e.target.value)}
                  >
                      <option value="all">Semua Hutang</option>
                      {debts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
              </div>

              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button onClick={() => setViewMode('calendar')} className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition ${viewMode === 'calendar' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
                      <Grid3X3 size={14}/> Kalender
                  </button>
                  <button onClick={() => setViewMode('table')} className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition ${viewMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
                      <List size={14}/> Tabel List
                  </button>
              </div>

              <button onClick={() => handleOpenModal(null, 'add')} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition shadow-lg">
                  <Plus size={14}/> Manual
              </button>
          </div>
      </div>

      {/* VIEW: CALENDAR */}
      {viewMode === 'calendar' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <button onClick={() => { if(currentMonth===0){ setCurrentMonth(11); setCurrentYear(currentYear-1); } else { setCurrentMonth(currentMonth-1); } }} className="p-2 hover:bg-white rounded-lg"><ChevronLeft size={20}/></button>
                  <h3 className="text-lg font-bold text-slate-800">{new Date(currentYear, currentMonth).toLocaleString('id-ID', { month: 'long', year: 'numeric' })}</h3>
                  <button onClick={() => { if(currentMonth===11){ setCurrentMonth(0); setCurrentYear(currentYear+1); } else { setCurrentMonth(currentMonth+1); } }} className="p-2 hover:bg-white rounded-lg"><ChevronRight size={20}/></button>
              </div>
              
              <div className="grid grid-cols-7 border-b bg-slate-50 text-center py-2 text-xs font-bold text-slate-400">
                  {['Min','Sen','Sel','Rab','Kam','Jum','Sab'].map(d => <div key={d}>{d}</div>)}
              </div>

              <div className="grid grid-cols-7 auto-rows-[120px] divide-x divide-y divide-slate-100">
                  {getCalendarCells().map((cell, idx) => {
                      if(!cell) return <div key={idx} className="bg-slate-50/30"></div>;
                      const isToday = new Date().getDate() === cell.day && new Date().getMonth() === currentMonth && new Date().getFullYear() === currentYear;
                      
                      return (
                          <div key={idx} className={`p-2 relative group hover:bg-slate-50 transition ${isToday ? 'bg-blue-50/30' : ''}`}>
                              <div className="flex justify-between items-start mb-1">
                                  <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-brand-600 text-white' : 'text-slate-500'}`}>{cell.day}</span>
                                  {cell.holiday && <div className="w-2 h-2 bg-red-400 rounded-full" title={cell.holiday.name}></div>}
                              </div>
                              <div className="space-y-1 overflow-y-auto max-h-[80px] custom-scrollbar">
                                  {cell.data.map(inst => {
                                      const debt = debts.find(d => d.id === inst.debtId);
                                      const isPaid = inst.status === 'paid';
                                      return (
                                          <div key={inst.id} onClick={()=>handleOpenModal(inst, 'edit')} className={`text-[9px] px-1.5 py-1 rounded border cursor-pointer truncate ${isPaid ? 'bg-green-100 text-green-700 border-green-200' : 'bg-white border-slate-200 text-slate-600'}`}>
                                              {debt?.name || 'Unknown'} ({formatCurrency(inst.amount).split(',')[0]})
                                          </div>
                                      )
                                  })}
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      )}

      {/* VIEW: TABLE */}
      {viewMode === 'table' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-20">
              <div className="p-4 border-b border-slate-100 flex gap-4 bg-slate-50">
                  <div className="relative flex-1 max-w-sm">
                      <Search className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                      <input 
                        type="text" 
                        placeholder="Cari nama hutang, nominal..." 
                        className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                      />
                  </div>
              </div>

              <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                          <tr>
                              <th className="px-4 py-4 w-10 text-center"><button onClick={toggleSelectAll} className="text-slate-400 hover:text-slate-700">{selectedIds.size > 0 && selectedIds.size === filteredData.length ? <CheckSquare size={18}/> : <Square size={18}/>}</button></th>
                              <th className="px-6 py-4">Jatuh Tempo</th>
                              <th className="px-6 py-4">Nama Hutang</th>
                              <th className="px-6 py-4">Periode</th>
                              <th className="px-6 py-4">Nominal</th>
                              <th className="px-6 py-4">Status</th>
                              <th className="px-6 py-4 text-right">Aksi</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {filteredData.length === 0 ? (
                              <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-400">Tidak ada data cicilan yang cocok.</td></tr>
                          ) : (
                              filteredData.map(inst => {
                                  const debt = debts.find(d => d.id === inst.debtId);
                                  const isSelected = selectedIds.has(inst.id);
                                  const dateObj = safeDate(inst.dueDate);
                                  const isOverdue = inst.status !== 'paid' && dateObj && dateObj < new Date();

                                  return (
                                      <tr key={inst.id} className={`hover:bg-slate-50 transition group ${isSelected ? 'bg-blue-50/50' : ''}`}>
                                          <td className="px-4 py-4 text-center">
                                              <button onClick={() => toggleSelection(inst.id)} className={`${isSelected ? 'text-brand-600' : 'text-slate-300 hover:text-slate-500'}`}>
                                                  {isSelected ? <CheckSquare size={18}/> : <Square size={18}/>}
                                              </button>
                                          </td>
                                          <td className="px-6 py-4 font-mono text-slate-600">{formatDateDisplay(inst.dueDate)}</td>
                                          <td className="px-6 py-4 font-bold text-slate-800">{debt ? debt.name : <span className="text-red-400 italic flex items-center gap-1"><Info size={12}/> Data Terhapus</span>}</td>
                                          <td className="px-6 py-4 text-slate-500">{inst.period === 0 ? 'Manual' : `Ke-${inst.period}`}</td>
                                          <td className="px-6 py-4 font-mono font-medium">{formatCurrency(inst.amount)}</td>
                                          <td className="px-6 py-4">
                                              <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${inst.status === 'paid' ? 'bg-green-100 text-green-700' : isOverdue ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                  {isOverdue ? 'Telat' : inst.status}
                                              </span>
                                          </td>
                                          <td className="px-6 py-4 text-right">
                                              <div className="flex justify-end gap-1">
                                                  <button onClick={() => handleOpenModal(inst, 'edit')} className="p-1.5 bg-white border border-slate-200 rounded hover:bg-slate-50 text-slate-500" title="Edit"><Edit2 size={14}/></button>
                                                  <button onClick={() => handleDelete(inst.id)} className="p-1.5 bg-white border border-slate-200 rounded hover:bg-red-50 text-red-500" title="Hapus"><Trash2 size={14}/></button>
                                              </div>
                                          </td>
                                      </tr>
                                  );
                              })
                          )}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* FLOATING ACTION BAR */}
      {selectedIds.size > 0 && viewMode === 'table' && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-4 z-50 border border-slate-700 max-w-sm w-full justify-between animate-fade-in-up">
              <div className="flex items-center gap-2">
                  <div className="bg-brand-600 text-xs font-bold px-2 py-1 rounded">{selectedIds.size}</div>
                  <span className="text-xs font-bold text-slate-300">Selected</span>
              </div>
              <div className="flex items-center gap-2">
                  <button onClick={() => handleBulkAction('mark_paid')} className="p-2 hover:bg-slate-700 rounded-lg text-green-400 tooltip" title="Mark Paid"><CheckCircle2 size={20}/></button>
                  <button onClick={() => handleBulkAction('mark_pending')} className="p-2 hover:bg-slate-700 rounded-lg text-yellow-400 tooltip" title="Mark Pending"><RotateCcw size={20}/></button>
                  <div className="w-px h-6 bg-slate-700 mx-1"></div>
                  <button onClick={() => handleBulkAction('delete')} className="p-2 hover:bg-red-900/50 rounded-lg text-red-400 tooltip" title="Delete"><Trash2 size={20}/></button>
                  <button onClick={() => setSelectedIds(new Set())} className="ml-2 text-slate-500 hover:text-white"><X size={20}/></button>
              </div>
          </div>
      )}

      {/* MODAL */}
      {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-slate-900">{modalMode === 'add' ? 'Tambah Manual' : 'Edit Data'}</h3>
                      <button onClick={() => setIsModalOpen(false)}><X size={24} className="text-slate-400"/></button>
                  </div>
                  <form onSubmit={handleSaveModal} className="space-y-4">
                      {modalMode === 'add' && (
                          <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1">Pilih Hutang</label>
                              <select className="w-full border p-2 rounded-lg" value={formData.debtId} onChange={e => setFormData({...formData, debtId: e.target.value})}>
                                  {debts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                              </select>
                          </div>
                      )}
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Tanggal</label>
                          <input type="date" required className="w-full border p-2 rounded-lg" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Nominal (Rp)</label>
                          <input type="number" required className="w-full border p-2 rounded-lg font-bold" value={formData.amount} onChange={e => setFormData({...formData, amount: Number(e.target.value)})} />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Status</label>
                          <select className="w-full border p-2 rounded-lg" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                              <option value="pending">Pending</option>
                              <option value="paid">Paid</option>
                              <option value="overdue">Overdue</option>
                          </select>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Catatan</label>
                          <textarea className="w-full border p-2 rounded-lg h-20" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
                      </div>
                      <button type="submit" className="w-full py-3 bg-brand-600 text-white font-bold rounded-xl shadow-lg hover:bg-brand-700">Simpan</button>
                  </form>
              </div>
          </div>
      )}

    </div>
  );
}
