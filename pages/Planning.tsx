
import React, { useMemo, useState, useEffect } from 'react';
import { TaskItem, DebtItem, ExpenseItem } from '../types';
import { CheckSquare, Square, ClipboardList, Clock, ArrowRight, Tag, Zap, TrendingUp, Calendar, User, PieChart, GripVertical } from 'lucide-react';
import { formatCurrency } from '../services/financeUtils';
import { saveUserData, getUserData } from '../services/mockDb';

interface PlanningProps {
  tasks: TaskItem[];
  debts: DebtItem[];
  allocations: ExpenseItem[]; 
  onToggleTask: (id: string) => void;
  onToggleAllocation?: (id: string) => void; 
}

export default function Planning({ tasks, debts, allocations, onToggleTask, onToggleAllocation }: PlanningProps) {
  
  // Local state for sorted tasks to support DnD
  const [sortedTasks, setSortedTasks] = useState<TaskItem[]>([]);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

  // Sync with props when they change
  useEffect(() => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
    const nextMonthYear = currentMonth === 11 ? currentYear + 1 : currentYear;

    // 1. Generate tasks for debts that are due soon (this month or next)
    const debtTasks: TaskItem[] = debts.map(debt => {
       const rawDay = typeof debt.dueDate === 'number' ? debt.dueDate : 1;
       const dueDateDay = Math.max(1, Math.min(31, rawDay)); // Safety clamp
       
       let targetDate = new Date(currentYear, currentMonth, dueDateDay);
       
       // Handle invalid date creation
       if (isNaN(targetDate.getTime())) {
           targetDate = new Date(); 
       }

       if (today.getDate() > dueDateDay) {
          targetDate = new Date(nextMonthYear, nextMonth, dueDateDay);
       }
       
       // Double check validity before calling methods
       if (isNaN(targetDate.getTime())) {
           targetDate = new Date();
       }

       const isoDate = targetDate.toISOString().split('T')[0];

       return {
         id: `auto-pay-task-${debt.id}-${isoDate}`,
         userId: debt.userId,
         title: `Bayar Cicilan ${debt.name} (${formatCurrency(debt.monthlyPayment)})`,
         category: 'Payment',
         status: 'pending', 
         dueDate: isoDate,
         context: 'Routine Bill'
       };
    });

    // 2. Generate tasks from Monthly Allocations
    const allocationTasks: TaskItem[] = allocations.map(item => ({
       id: item.id, 
       userId: item.userId,
       title: `Alokasi Dana: ${item.name} (${formatCurrency(item.amount)})`,
       category: 'Administration',
       status: item.isTransferred || item.assignedAccountId ? 'completed' : 'pending',
       dueDate: new Date().toISOString().split('T')[0],
       context: 'Allocation'
    }));

    // 3. Combine with Manual Tasks and sort by date initially
    const merged = [...debtTasks, ...allocationTasks, ...tasks].sort((a, b) => {
        if (a.status === 'completed' && b.status !== 'completed') return 1;
        if (a.status !== 'completed' && b.status === 'completed') return -1;
        
        const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        
        const validA = isNaN(dateA) ? Infinity : dateA;
        const validB = isNaN(dateB) ? Infinity : dateB;

        return validA - validB;
    });
    
    setSortedTasks(merged);
  }, [tasks, debts, allocations]);


  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'Administration': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Payment': return 'bg-green-100 text-green-700 border-green-200';
      case 'Negotiation': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'Investment': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Business': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getContextBadge = (context?: string) => {
    if (!context) return null;
    switch(context) {
        case 'Debt Acceleration':
            return (
                <span className="flex items-center gap-1 text-[10px] font-bold bg-red-50 text-red-600 px-2 py-0.5 rounded border border-red-100">
                    <Zap size={10} /> Accelerate
                </span>
            );
        case 'Financial Freedom':
            return (
                <span className="flex items-center gap-1 text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded border border-indigo-100">
                    <TrendingUp size={10} /> Freedom
                </span>
            );
        case 'Routine Bill':
            return (
                <span className="flex items-center gap-1 text-[10px] font-bold bg-slate-50 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                    <Calendar size={10} /> Tagihan
                </span>
            );
        case 'Allocation':
            return (
                <span className="flex items-center gap-1 text-[10px] font-bold bg-orange-50 text-orange-600 px-2 py-0.5 rounded border border-orange-200">
                    <PieChart size={10} /> Alokasi
                </span>
            );
        default:
            return (
                <span className="flex items-center gap-1 text-[10px] font-bold bg-slate-50 text-slate-500 px-2 py-0.5 rounded border border-slate-200">
                    <User size={10} /> Manual
                </span>
            );
    }
  };

  const handleToggle = (task: TaskItem) => {
      // 1. Call parent handler to update React state
      if (task.context === 'Allocation' && onToggleAllocation) {
          onToggleAllocation(task.id);
      } else {
          onToggleTask(task.id);
      }

      // 2. Explicitly update Local Storage to prevent data loss on reload
      // We manually toggle the status here for the DB save
      // Note: This relies on 'tasks' array logic for manual tasks.
      // Auto-generated tasks (Debts/Allocations) might not be saved in 'tasks' array, 
      // but allocations are saved in 'allocations'.
      
      const userId = localStorage.getItem('paydone_active_user');
      if (userId) {
          const userData = getUserData(userId);
          
          if (task.context === 'Allocation') {
              // Update Allocation in DB
              // Since allocations are stored by month, this is complex to find without month key.
              // Assuming App.tsx handles allocation state correctly via onToggleAllocation -> setMonthlyExpenses -> saveUserData
              // so we might skip manual save for allocations if App.tsx does it.
          } else {
              // Update Tasks in DB
              const newTasks = userData.tasks.map(t => 
                  t.id === task.id ? { ...t, status: t.status === 'pending' ? 'completed' : 'pending' as any } : t
              );
              // Only save if it was actually in the tasks list
              if (newTasks.find(t => t.id === task.id)) {
                  saveUserData(userId, { ...userData, tasks: newTasks });
              }
          }
      }
  };

  // DnD Handlers
  const handleDragStart = (index: number) => {
      setDraggedItemIndex(index);
  };

  const handleDragEnter = (index: number) => {
      if (draggedItemIndex === null || draggedItemIndex === index) return;
      
      const newItems = [...sortedTasks];
      const item = newItems[draggedItemIndex];
      newItems.splice(draggedItemIndex, 1);
      newItems.splice(index, 0, item);
      
      setDraggedItemIndex(index);
      setSortedTasks(newItems);
  };

  const handleDragEnd = () => {
      setDraggedItemIndex(null);
      // In a real app, you would save the new order to DB here
  };

  const completedCount = sortedTasks.filter(t => t.status === 'completed').length;
  const progress = sortedTasks.length > 0 ? Math.round((completedCount / sortedTasks.length) * 100) : 0;

  // Helper for safe date rendering
  const renderDate = (dateStr?: string) => {
      if (!dateStr) return null;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return <span className="text-red-400">Invalid Date</span>;
      
      const isOverdue = d < new Date();
      return (
        <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${isOverdue ? 'text-red-500' : 'text-slate-400'}`}>
            <Clock size={12} />
            {d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
            {isOverdue && <span>(Overdue)</span>}
        </div>
      );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Planning & Eksekusi</h2>
          <p className="text-slate-500 text-sm">Gabungan tugas dari AI Strategist, Financial Freedom, Alokasi Budget, dan Jadwal Tagihan.</p>
        </div>
      </div>

      {/* Progress Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-2">
           <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-800">Progress Bulanan</h3>
              <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-500">
                {completedCount} / {sortedTasks.length} Selesai
              </span>
           </div>
           <span className="text-sm font-semibold text-brand-600">{progress}%</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2.5">
          <div 
            className="bg-brand-600 h-2.5 rounded-full transition-all duration-500" 
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      {/* Task List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
           <ClipboardList size={20} className="text-brand-600" />
           <h3 className="font-bold text-slate-900">Action Plan Terpadu</h3>
        </div>
        
        <div className="divide-y divide-slate-100">
          {sortedTasks.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <ClipboardList size={48} className="mx-auto mb-4 opacity-50" />
              <p>Belum ada tugas aktif. Gunakan AI Strategist untuk membuat rencana atau tambahkan data keuangan.</p>
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
                className={`p-4 flex items-start gap-4 hover:bg-slate-50 transition cursor-grab active:cursor-grabbing group ${task.status === 'completed' ? 'opacity-50 bg-slate-50' : ''} ${draggedItemIndex === index ? 'opacity-20' : 'opacity-100'}`}
              >
                <div className="mt-2 text-slate-300 group-hover:text-slate-400 cursor-grab">
                    <GripVertical size={16} />
                </div>

                <div className="mt-1 cursor-pointer" onClick={() => handleToggle(task)}>
                  {task.status === 'completed' ? (
                    <div className="bg-green-100 text-green-600 p-1 rounded-md">
                        <CheckSquare size={20} />
                    </div>
                  ) : (
                    <Square size={20} className="text-slate-300 hover:text-brand-500 transition" />
                  )}
                </div>
                
                <div className="flex-1 cursor-pointer" onClick={() => handleToggle(task)}>
                  <div className="flex items-center gap-2 mb-1">
                     {/* CONTEXT BADGE */}
                     {getContextBadge(task.context)}
                     
                     {/* CATEGORY BADGE */}
                     <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${getCategoryColor(task.category)}`}>
                       {task.category}
                     </span>
                  </div>

                  <p className={`text-sm font-medium leading-relaxed ${task.status === 'completed' ? 'text-slate-500 line-through decoration-slate-400' : 'text-slate-900'}`}>
                    {task.title}
                  </p>
                  
                  {task.status !== 'completed' && renderDate(task.dueDate)}
                </div>

                <div className="text-slate-300 group-hover:text-brand-400 transition-colors self-center">
                  <ArrowRight size={18} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
