
import React, { useState, useEffect } from 'react';
import { TaskItem, DebtItem, ExpenseItem, DebtInstallment } from '../types';
import { CheckSquare, Square, ClipboardList, Clock, Zap, TrendingUp, Calendar, User, PieChart, GripVertical, Loader2 } from 'lucide-react';
import { formatCurrency } from '../services/financeUtils';
import { saveUserData, getUserData, getDB, saveDB } from '../services/mockDb';
import { saveItemToCloud } from '../services/cloudSync';

interface PlanningProps {
  tasks: TaskItem[];
  debts: DebtItem[];
  debtInstallments: DebtInstallment[]; // NEW PROP
  setDebtInstallments: React.Dispatch<React.SetStateAction<DebtInstallment[]>>; // NEW PROP
  allocations: ExpenseItem[]; 
  onToggleTask: (id: string) => void;
  onToggleAllocation?: (id: string) => void; 
}

export default function Planning({ tasks, debts, debtInstallments, setDebtInstallments, allocations, onToggleTask, onToggleAllocation }: PlanningProps) {
  const [sortedTasks, setSortedTasks] = useState<TaskItem[]>([]);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // GENERATE DEBT TASKS FROM INSTALLMENTS (Accuracy Fix)
    // Filter for installments due in the current month (or slightly future/past pending ones)
    // We prioritize showing the installment for this month.
    const relevantInstallments = debtInstallments.filter(inst => {
        const d = new Date(inst.dueDate);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const debtTasks: TaskItem[] = relevantInstallments.map(inst => {
       const debtName = debts.find(d => d.id === inst.debtId)?.name || 'Cicilan Hutang';
       return {
         id: `installment-task__${inst.id}`, // NEW ID FORMAT
         userId: inst.userId,
         title: `Bayar Cicilan ${debtName} (${formatCurrency(inst.amount)})`,
         category: 'Payment',
         status: inst.status === 'paid' ? 'completed' : 'pending', 
         dueDate: inst.dueDate,
         context: 'Routine Bill'
       };
    });

    // Fallback: If no installment exists for a debt in this month (e.g. data missing), maybe alert or skip.
    // For now, relying on debtInstallments ensures we only show real scheduled bills.

    // Allocation Tasks Generator (SAFE MAPPING from props)
    // Ensure 'allocations' is an array before mapping
    const safeAllocations = Array.isArray(allocations) ? allocations : [];
    
    const allocationTasks: TaskItem[] = safeAllocations.map(item => ({
       id: item.id, 
       userId: item.userId,
       title: `Alokasi Dana: ${item.name} (${formatCurrency(item.amount)})`,
       category: 'Administration',
       status: item.isTransferred || item.assignedAccountId ? 'completed' : 'pending',
       dueDate: new Date().toISOString().split('T')[0],
       context: 'Allocation'
    }));

    const merged = [...debtTasks, ...allocationTasks, ...tasks].sort((a, b) => {
        // REMOVED STATUS SORTING to keep checked items in place
        // if (a.status === 'completed' && b.status !== 'completed') return 1;
        // if (a.status !== 'completed' && b.status === 'completed') return -1;
        
        const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        return dateA - dateB;
    });
    
    setSortedTasks(merged);
  }, [tasks, debts, debtInstallments, allocations, processingId]); 

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'Administration': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Payment': return 'bg-green-50 text-green-700 border-green-200';
      case 'Negotiation': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Investment': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Business': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getContextBadge = (context?: string) => {
    if (!context) return null;
    switch(context) {
        case 'Debt Acceleration': return <span className="flex items-center gap-1 text-[10px] font-bold bg-red-50 text-red-600 px-2 py-0.5 rounded border border-red-100"><Zap size={10} /> Accelerate</span>;
        case 'Financial Freedom': return <span className="flex items-center gap-1 text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded border border-indigo-100"><TrendingUp size={10} /> Freedom</span>;
        case 'Routine Bill': return <span className="flex items-center gap-1 text-[10px] font-bold bg-slate-50 text-slate-600 px-2 py-0.5 rounded border border-slate-200"><Calendar size={10} /> Tagihan</span>;
        case 'Allocation': return <span className="flex items-center gap-1 text-[10px] font-bold bg-orange-50 text-orange-600 px-2 py-0.5 rounded border border-orange-200"><PieChart size={10} /> Alokasi</span>;
        default: return <span className="flex items-center gap-1 text-[10px] font-bold bg-slate-50 text-slate-500 px-2 py-0.5 rounded border border-slate-200"><User size={10} /> Manual</span>;
    }
  };

  const handleToggle = async (task: TaskItem) => {
      setProcessingId(task.id);

      // DEBT TASK Logic (Updated)
      if (task.id.startsWith('installment-task__')) {
          const instId = task.id.split('__')[1];
          const installment = debtInstallments.find(i => i.id === instId);

          if (installment) {
              const newStatus: 'pending' | 'paid' | 'overdue' = installment.status === 'paid' ? 'pending' : 'paid';
              const updatedInstallment: DebtInstallment = { ...installment, status: newStatus, updatedAt: new Date().toISOString() };
              
              // 1. Update State (Optimistic)
              setDebtInstallments(prev => prev.map(i => i.id === instId ? updatedInstallment : i));

              // 2. Cloud Save
              await saveItemToCloud('debtInstallments', updatedInstallment, false);
          }
      } 
      // ALLOCATION TASK Logic
      else if (task.context === 'Allocation') {
          if (onToggleAllocation) {
              onToggleAllocation(task.id);
          } else {
              // Fallback: If prop is missing, update directly via cloud logic
              // Note: This requires finding the item in 'allocations' array passed as prop
              const item = allocations.find(a => a.id === task.id);
              if (item) {
                  const updatedItem = { ...item, isTransferred: !item.isTransferred, updatedAt: new Date().toISOString() };
                  await saveItemToCloud('allocations', updatedItem, false);
                  // Force refresh via window reload if stuck (worst case fallback)
                  // window.location.reload(); 
              }
          }
      } 
      // MANUAL TASK Logic
      else {
          onToggleTask(task.id);
          const userId = localStorage.getItem('paydone_active_user');
          if (userId) {
              const userData = getUserData(userId);
              const updatedTask = userData.tasks.find(t => t.id === task.id);
              if (updatedTask) {
                  const newStatus: 'pending' | 'completed' = updatedTask.status === 'pending' ? 'completed' : 'pending';
                  const finalTask: TaskItem = { ...updatedTask, status: newStatus, updatedAt: new Date().toISOString() };
                  
                  // Update Local
                  const newTasks = userData.tasks.map(t => t.id === task.id ? finalTask : t);
                  saveUserData(userId, { ...userData, tasks: newTasks });
                  
                  // Direct PUT
                  await saveItemToCloud('tasks', finalTask, false);
              }
          }
      }
      
      setTimeout(() => setProcessingId(null), 300);
  };

  const handleDragStart = (index: number) => { setDraggedItemIndex(index); };
  const handleDragEnter = (index: number) => {
      if (draggedItemIndex === null || draggedItemIndex === index) return;
      const newItems = [...sortedTasks];
      const item = newItems[draggedItemIndex];
      newItems.splice(draggedItemIndex, 1);
      newItems.splice(index, 0, item);
      setDraggedItemIndex(index);
      setSortedTasks(newItems);
  };
  const handleDragEnd = () => { setDraggedItemIndex(null); };

  const completedCount = sortedTasks.filter(t => t.status === 'completed').length;
  const progress = sortedTasks.length > 0 ? Math.round((completedCount / sortedTasks.length) * 100) : 0;

  const renderDate = (dateStr?: string) => {
      if (!dateStr) return null;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      const isOverdue = d < new Date() && d.getDate() !== new Date().getDate();
      return (
        <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${isOverdue ? 'text-red-500' : 'text-slate-400'}`}>
            <Clock size={12} />
            {d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
            {isOverdue && <span>(Overdue)</span>}
        </div>
      );
  };

  return (
    <div className="space-y-8 pb-20 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white p-8 rounded-[2.5rem] border shadow-sm">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Planning & Eksekusi</h2>
          <p className="text-slate-500 font-medium mt-1">Gabungan tugas dari AI Strategist, Financial Freedom, Alokasi Budget, dan Jadwal Tagihan.</p>
        </div>
        <div className="bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100 min-w-[200px]">
           <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Progress</span>
              <span className="text-sm font-black text-brand-600">{progress}%</span>
           </div>
           <div className="w-full bg-slate-200 rounded-full h-2">
              <div className="bg-brand-600 h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
           </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
           <div className="p-2 bg-brand-100 text-brand-600 rounded-xl"><ClipboardList size={20} /></div>
           <h3 className="font-black text-slate-800 text-lg">Action Plan Terpadu</h3>
        </div>
        
        <div className="divide-y divide-slate-100">
          {sortedTasks.length === 0 ? (
            <div className="p-20 text-center text-slate-400">
                <ClipboardList size={64} className="mx-auto mb-4 opacity-20" />
                <p className="font-bold text-sm uppercase tracking-widest">Belum ada tugas aktif.</p>
            </div>
          ) : (
            sortedTasks.map((task, index) => (
              <div 
                key={task.id} 
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragEnter={() => handleDragEnter(index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => e.preventDefault()}
                className={`p-6 flex items-start gap-5 hover:bg-slate-50 transition cursor-grab active:cursor-grabbing group ${task.status === 'completed' ? 'opacity-50 bg-slate-50/50' : ''} ${draggedItemIndex === index ? 'opacity-20' : 'opacity-100'}`}
              >
                <div className="mt-2 text-slate-300 group-hover:text-slate-400 cursor-grab"><GripVertical size={16} /></div>

                <div className="mt-1 cursor-pointer" onClick={() => handleToggle(task)}>
                  {processingId === task.id ? (
                      <Loader2 size={24} className="animate-spin text-brand-600"/>
                  ) : task.status === 'completed' ? (
                    <div className="bg-green-100 text-green-600 p-1.5 rounded-xl transition-transform transform scale-110"><CheckSquare size={20} /></div>
                  ) : (
                    <Square size={24} className="text-slate-300 hover:text-brand-500 transition" />
                  )}
                </div>
                
                <div className="flex-1 cursor-pointer" onClick={() => handleToggle(task)}>
                  <div className="flex items-center gap-2 mb-1.5">
                     {getContextBadge(task.context)}
                     <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded border ${getCategoryColor(task.category)}`}>{task.category}</span>
                  </div>
                  <p className={`text-base font-bold leading-snug ${task.status === 'completed' ? 'text-slate-500 line-through decoration-slate-300' : 'text-slate-800'}`}>{task.title}</p>
                  {/* Keep showing date even if completed, or user request implies just sorting change. Let's keep existing logic for date rendering. */}
                  {renderDate(task.dueDate)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
