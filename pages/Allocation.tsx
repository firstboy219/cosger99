
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { formatCurrency, safeDateISO } from '../services/financeUtils';
import { Wallet, Plus, Trash2, X, Save, Percent, DollarSign, GripVertical, CheckCircle2, Circle, PieChart, TrendingUp, AlertCircle, ArrowRight, Layers, Target, Calendar as CalendarIcon, Upload, FileText, Image as ImageIcon, FileSpreadsheet, Download, RefreshCw, ChevronLeft, ChevronRight, Landmark, CreditCard, Tag, Copy, Edit2, History, ShoppingBag, Coffee, Bus, Zap, Activity, Home, Gift, Book, Heart, BarChart3, ArrowUpRight, ArrowDownRight, Sparkles, Info, Eye, EyeOff, TrendingDown, ChevronDown } from 'lucide-react';
import { ExpenseItem, DailyExpense, SinkingFund, BankAccount } from '../types';
import { getConfig } from '../services/mockDb';
import { saveItemToCloud, deleteFromCloud } from '../services/cloudSync';
import { parseTransactionAI } from '../services/geminiService';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import FeatureGate from '../components/FeatureGate';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

// --- SCROLL REVEAL ---
function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setVisible(true); }, { threshold: 0.08 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

// --- ANIMATED NUMBER ---
function AnimatedNumber({ value, prefix = '' }: { value: number; prefix?: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(0);
  useEffect(() => {
    const start = ref.current; const diff = value - start;
    if (diff === 0) return;
    const startTime = performance.now();
    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / 800, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + diff * eased;
      setDisplay(current); ref.current = current;
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value]);
  return <>{prefix}{Math.round(display).toLocaleString('id-ID')}</>;
}

// --- CIRCULAR PROGRESS ---
function CircularProgress({ percent, size = 56, strokeWidth = 5, color = '#3b82f6', label }: { percent: number; size?: number; strokeWidth?: number; color?: string; label?: string }) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, percent) / 100) * c;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size/2} cy={size/2} r={r} stroke="#e2e8f0" strokeWidth={strokeWidth} fill="none" />
        <circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={strokeWidth} fill="none"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] font-black" style={{ color }}>{Math.round(percent)}%</span>
        {label && <span className="text-[7px] text-slate-400 font-bold">{label}</span>}
      </div>
    </div>
  );
}

interface AllocationProps {
  monthlyExpenses: Record<string, ExpenseItem[]>;
  setMonthlyExpenses: React.Dispatch<React.SetStateAction<Record<string, ExpenseItem[]>>>;
  onAddToDailyLog: (expense: DailyExpense) => void;
  dailyExpenses: DailyExpense[]; 
  onToggleAllocation: (id: string) => void; 
  sinkingFunds: SinkingFund[];
  setSinkingFunds: React.Dispatch<React.SetStateAction<SinkingFund[]>>;
  userId: string;
  bankAccounts?: BankAccount[]; 
  setBankAccounts?: React.Dispatch<React.SetStateAction<BankAccount[]>>; 
}

const AVAILABLE_ICONS = [
    { id: 'shopping-bag', icon: ShoppingBag, label: 'Shopping' },
    { id: 'coffee', icon: Coffee, label: 'Food' },
    { id: 'bus', icon: Bus, label: 'Transport' },
    { id: 'zap', icon: Zap, label: 'Utility' },
    { id: 'activity', icon: Activity, label: 'Health' },
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'gift', icon: Gift, label: 'Gift' },
    { id: 'book', icon: Book, label: 'Edu' },
    { id: 'heart', icon: Heart, label: 'Charity' },
    { id: 'tag', icon: Tag, label: 'Other' },
];

const AVAILABLE_COLORS = [
    'bg-slate-500', 'bg-red-500', 'bg-orange-500', 'bg-amber-500', 
    'bg-green-500', 'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500',
    'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-purple-500', 
    'bg-fuchsia-500', 'bg-pink-500', 'bg-rose-500'
];

const CATEGORY_META: Record<string, { label: string; color: string; bg: string; border: string; text: string }> = {
  needs: { label: 'Needs', color: '#3b82f6', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600' },
  wants: { label: 'Wants', color: '#f59e0b', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600' },
  debt: { label: 'Debt/Save', color: '#ef4444', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600' },
  savings: { label: 'Savings', color: '#10b981', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600' },
};

export default function Allocation({ monthlyExpenses, setMonthlyExpenses, onToggleAllocation, userId, sinkingFunds, setSinkingFunds, bankAccounts = [], setBankAccounts, dailyExpenses = [] }: AllocationProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const getMonthKey = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return `${year}-${month}`;
  };

  const currentMonthKey = getMonthKey(currentDate);
  
  const [localList, setLocalList] = useState<ExpenseItem[]>([]);
  const [showBalances, setShowBalances] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  
  // Confirmation Modal State
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  
  useEffect(() => {
      setLocalList(monthlyExpenses[currentMonthKey] || []);
  }, [monthlyExpenses, currentMonthKey]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [isSfFormOpen, setIsSfFormOpen] = useState(false);
  const [editingSfId, setEditingSfId] = useState<string | null>(null);
  const [showSfHistoryId, setShowSfHistoryId] = useState<string | null>(null);
  const [showAllocHistoryId, setShowAllocHistoryId] = useState<string | null>(null);
  
  // DnD State
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const dragItemNode = useRef<any>(null);
  
  // Smart Form State
  const [mode, setMode] = useState<'fixed' | 'percent'>('fixed');
  const [formData, setFormData] = useState({ 
      name: '', amount: 0, percent: 0, category: 'needs', priority: 1, 
      isRecurring: true, assignedAccountId: '', icon: 'tag', color: 'bg-slate-500' 
  });
  const [isSaving, setIsSaving] = useState(false);

  // Sinking Fund State
  const [sfFormData, setSfFormData] = useState<{
      name: string;
      target: number;
      current: number;
      deadline: string;
      category: string;
      assignedAccountId: string;
  }>({ name: '', target: 0, current: 0, deadline: '', category: 'Other', assignedAccountId: '' });

  const BASE_INCOME = 15000000; 

  // --- METRICS ---
  const metrics = useMemo(() => {
      const total = localList.reduce((a,b) => a + Number(b.amount), 0);
      const needs = localList.filter(i => i.category === 'needs').reduce((a,b) => a + Number(b.amount), 0);
      const wants = localList.filter(i => i.category === 'wants').reduce((a,b) => a + Number(b.amount), 0);
      const savings = localList.filter(i => i.category === 'debt' || i.category === 'savings').reduce((a,b) => a + Number(b.amount), 0);
      
      const remaining = BASE_INCOME - total;
      const needsPercent = total > 0 ? (needs / total) * 100 : 0;
      const wantsPercent = total > 0 ? (wants / total) * 100 : 0;
      const savingsPercent = total > 0 ? (savings / total) * 100 : 0;

      const totalUsed = localList.reduce((sum, item) => {
        const used = dailyExpenses.filter(e => e.allocationId === item.id).reduce((s, e) => s + Number(e.amount || 0), 0);
        return sum + used;
      }, 0);

      // SF metrics
      const totalSfTarget = sinkingFunds.reduce((a, b) => a + Number(b.targetAmount || 0), 0);
      const totalSfCurrent = sinkingFunds.reduce((a, b) => a + Number(b.currentAmount || 0), 0);
      const sfProgress = totalSfTarget > 0 ? (totalSfCurrent / totalSfTarget) * 100 : 0;
      
      return { total, needs, wants, savings, remaining, needsPercent, wantsPercent, savingsPercent, totalUsed, totalSfTarget, totalSfCurrent, sfProgress };
  }, [localList, dailyExpenses, sinkingFunds]);

  // Pie chart data
  const pieData = useMemo(() => {
    return [
      { name: 'Needs', value: metrics.needs, color: '#3b82f6' },
      { name: 'Wants', value: metrics.wants, color: '#f59e0b' },
      { name: 'Debt/Save', value: metrics.savings, color: '#ef4444' },
      ...(metrics.remaining > 0 ? [{ name: 'Sisa', value: metrics.remaining, color: '#e2e8f0' }] : []),
    ].filter(d => d.value > 0);
  }, [metrics]);

  // Filtered list
  const filteredList = useMemo(() => {
    if (filterCategory === 'all') return localList;
    return localList.filter(i => i.category === filterCategory);
  }, [localList, filterCategory]);

  // --- CALENDAR HANDLERS ---
  const handleYearChange = (increment: number) => {
      const newDate = new Date(currentDate);
      newDate.setFullYear(newDate.getFullYear() + increment);
      setCurrentDate(newDate);
  };

  const handleMonthSelect = (monthIndex: number) => {
      const newDate = new Date(currentDate);
      newDate.setMonth(monthIndex);
      setCurrentDate(newDate);
  };

  // --- DRAG AND DROP ---
  const handleDragStart = (e: React.DragEvent, index: number) => {
      setDraggedItemIndex(index);
      dragItemNode.current = index;
      e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnter = (e: React.DragEvent, index: number) => {
      if (dragItemNode.current !== null && dragItemNode.current !== index) {
          const newList = [...localList];
          const item = newList[dragItemNode.current];
          newList.splice(dragItemNode.current, 1);
          newList.splice(index, 0, item);
          setDraggedItemIndex(index);
          dragItemNode.current = index;
          setLocalList(newList);
      }
  };

  const handleDragEnd = async () => {
      setDraggedItemIndex(null);
      dragItemNode.current = null;
      setMonthlyExpenses(prev => ({ ...prev, [currentMonthKey]: localList }));
  };

  // --- HELPERS ---
  const getUsedAmount = (allocId: string) => {
      return dailyExpenses
          .filter(e => e.allocationId === allocId)
          .reduce((sum, e) => sum + Number(e.amount), 0);
  };

  // --- CRUD OPERATIONS ---
  const handleSave = async (e: React.FormEvent) => {
      e.preventDefault(); 
      if (!formData.name || !formData.amount) return;
      
      if (editingId) {
          const used = getUsedAmount(editingId);
          if (Number(formData.amount) < used) {
              alert(`Gagal: Nominal tidak boleh lebih kecil dari dana yang sudah terpakai (${formatCurrency(used)})`);
              return;
          }
      }

      setIsSaving(true);

      const newItem: any = {
          id: editingId || `alloc-${Date.now()}`,
          userId: userId, 
          name: formData.name, 
          amount: Number(formData.amount), 
          category: formData.category || 'needs',
          priority: localList.length + 1, 
          isTransferred: false, 
          isRecurring: formData.isRecurring,
          assignedAccountId: formData.assignedAccountId,
          monthKey: currentMonthKey,
          percentage: Number(formData.percent),
          icon: formData.icon,
          color: formData.color,
          updatedAt: new Date().toISOString()
      };

      const updatedList = editingId 
          ? localList.map(i => i.id === editingId ? { ...newItem, isTransferred: i.isTransferred } : i)
          : [...localList, newItem];
      
      setLocalList(updatedList);
      setMonthlyExpenses(prev => ({ ...prev, [currentMonthKey]: updatedList }));
      setIsFormOpen(false);

      try {
          await saveItemToCloud('allocations', newItem, !editingId);

          if (formData.isRecurring && !editingId) {
              const currentMonthIdx = currentDate.getMonth();
              const year = currentDate.getFullYear();
              
              const recurringPromises = [];
              for (let m = currentMonthIdx + 1; m < 12; m++) {
                  const futureMonthKey = `${year}-${String(m+1).padStart(2,'0')}`;
                  const futureItem = {
                      ...newItem,
                      id: `alloc-${Date.now()}-${m}`,
                      monthKey: futureMonthKey,
                      updatedAt: new Date().toISOString()
                  };
                  
                  setMonthlyExpenses(prev => ({
                      ...prev,
                      [futureMonthKey]: [...(prev[futureMonthKey] || []), futureItem]
                  }));

                  recurringPromises.push(saveItemToCloud('allocations', futureItem, true));
              }
              
              if (recurringPromises.length > 0) {
                  await Promise.all(recurringPromises);
              }
          }

      } catch (e) {
          alert("Gagal menyimpan ke cloud. Perubahan tersimpan lokal.");
      } finally {
          setIsSaving(false);
      }
  };

  const handleDeleteAllocationClick = (id: string) => {
      const used = getUsedAmount(id);
      if (used > 0) {
          alert(`Tidak dapat menghapus pos ini karena sudah ada transaksi sebesar ${formatCurrency(used)}.`);
          return;
      }

      setConfirmConfig({
          isOpen: true,
          title: "Hapus Pos Anggaran?",
          message: "Apakah Anda yakin ingin menghapus pos anggaran ini?",
          onConfirm: () => {
              executeDeleteAllocation(id);
              setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          }
      });
  };

  const executeDeleteAllocation = async (id: string) => {
      const updatedList = localList.filter(i => i.id !== id);
      setLocalList(updatedList);
      setMonthlyExpenses(prev => ({ ...prev, [currentMonthKey]: updatedList }));
      await deleteFromCloud(userId, 'allocations', id);
  };

  const handleToggle = async (id: string) => {
      const updatedList = localList.map(i => i.id === id ? { ...i, isTransferred: !i.isTransferred } : i);
      setLocalList(updatedList);
      const item = updatedList.find(i => i.id === id);
      if(item) await saveItemToCloud('allocations', item, false);
  };

  // --- SINKING FUND HANDLERS ---
  const openSfModal = (sf?: SinkingFund) => {
      if (sf) {
          setEditingSfId(sf.id);
          setSfFormData({
              name: sf.name,
              target: sf.targetAmount,
              current: sf.currentAmount,
              deadline: sf.deadline,
              category: sf.category || 'Other',
              assignedAccountId: sf.assignedAccountId || ''
          });
      } else {
          setEditingSfId(null);
          setSfFormData({ name: '', target: 0, current: 0, deadline: '', category: 'Other', assignedAccountId: '' });
      }
      setIsSfFormOpen(true);
  };

  const handleSaveSF = async (e: React.FormEvent) => {
      e.preventDefault();
      const sfId = editingSfId || `sf-${Date.now()}`;
      
      const newSf: SinkingFund = {
          id: sfId,
          userId,
          name: sfFormData.name,
          targetAmount: Number(sfFormData.target),
          currentAmount: Number(sfFormData.current),
          deadline: sfFormData.deadline,
          category: sfFormData.category as any,
          assignedAccountId: sfFormData.assignedAccountId,
          icon: 'target',
          color: 'bg-blue-500',
          updatedAt: new Date().toISOString()
      };

      if (editingSfId) {
          setSinkingFunds(prev => prev.map(s => s.id === editingSfId ? newSf : s));
      } else {
          setSinkingFunds(prev => [...prev, newSf]);
      }
      
      setIsSfFormOpen(false);
      await saveItemToCloud('sinkingFunds', newSf, !editingSfId);
  };

  const handleDeleteSFClick = (id: string) => {
      setConfirmConfig({
          isOpen: true,
          title: "Hapus Kantong?",
          message: "Apakah Anda yakin ingin menghapus kantong ini? Dana yang sudah terkumpul akan hilang dari tracking.",
          onConfirm: () => {
              executeDeleteSF(id);
              setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          }
      });
  };

  const executeDeleteSF = async (id: string) => {
      setSinkingFunds(prev => prev.filter(s => s.id !== id));
      await deleteFromCloud(userId, 'sinkingFunds', id);
  };

  // --- UI HELPERS ---
  const getCategoryColor = (cat: string) => {
      return CATEGORY_META[cat]?.color || '#94a3b8';
  };

  const renderIcon = (iconName: string | undefined, size: number = 16) => {
      const found = AVAILABLE_ICONS.find(i => i.id === iconName);
      const IconComp = found ? found.icon : Tag;
      return <IconComp size={size} />;
  };

  const getMonthlyTotal = (year: number, monthIdx: number) => {
      const key = `${year}-${String(monthIdx+1).padStart(2,'0')}`;
      const items = monthlyExpenses[key] || [];
      return items.reduce((a,b) => a + Number(b.amount || 0), 0);
  };

  const calculateMonthlySaving = () => {
      if (!sfFormData.target || !sfFormData.deadline) return 0;
      const targetDate = new Date(sfFormData.deadline);
      const today = new Date();
      const months = (targetDate.getFullYear() - today.getFullYear()) * 12 + (targetDate.getMonth() - today.getMonth());
      if (months <= 0) return sfFormData.target - sfFormData.current;
      return Math.ceil((sfFormData.target - sfFormData.current) / months);
  };

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

  // Budget health score
  const budgetHealth = useMemo(() => {
    const usagePercent = metrics.total > 0 ? (metrics.totalUsed / metrics.total) * 100 : 0;
    const incomeRatio = (metrics.total / BASE_INCOME) * 100;
    if (incomeRatio > 100) return { label: 'Over Budget', color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200' };
    if (usagePercent > 80) return { label: 'Hampir Habis', color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200' };
    return { label: 'Terkendali', color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200' };
  }, [metrics]);

  return (
    <div className="space-y-6 pb-24 font-sans">
       
       {/* ============================================ */}
       {/* SECTION 1: BUDGET OVERVIEW HERO              */}
       {/* ============================================ */}
       <Reveal>
         <div className="relative bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 rounded-3xl p-6 md:p-8 overflow-hidden shadow-2xl">
            {/* Decorative */}
            <div className="absolute top-0 right-0 p-10 opacity-[0.03] pointer-events-none"><PieChart size={220}/></div>
            <div className="absolute -left-16 -bottom-16 w-64 h-64 bg-blue-600 rounded-full blur-[120px] opacity-15 pointer-events-none" />
            <div className="absolute right-10 top-0 w-40 h-40 bg-indigo-500 rounded-full blur-[100px] opacity-10 pointer-events-none" />
            <div className="absolute inset-0 opacity-[0.02] pointer-events-none"
              style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

            <div className="relative z-10">
              {/* Top Row */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.06] border border-white/10 text-blue-300 text-[9px] font-black uppercase tracking-widest mb-3">
                    <Wallet size={10}/> Budget Cockpit
                  </div>
                  <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                    {currentDate.toLocaleDateString('id-ID', {month:'long', year:'numeric'})}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowBalances(!showBalances)} className="p-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-slate-400 hover:text-white hover:bg-white/[0.1] transition-all">
                    {showBalances ? <Eye size={16}/> : <EyeOff size={16}/>}
                  </button>
                  <button 
                    onClick={() => { setEditingId(null); setFormData({ name: '', amount: 0, percent: 0, category: 'needs', priority: 1, isRecurring: true, assignedAccountId: '', icon: 'tag', color: 'bg-slate-500' }); setIsFormOpen(true); }} 
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-blue-600/25 active:scale-95"
                  >
                    <Plus size={14}/> Pos Baru
                  </button>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Total Alokasi */}
                <div className="bg-white/[0.05] backdrop-blur-sm rounded-2xl p-4 border border-white/[0.08]">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Total Alokasi</p>
                  <p className="text-xl md:text-2xl font-black text-white">
                    {showBalances ? <><span className="text-slate-500 text-sm">Rp</span> <AnimatedNumber value={metrics.total} /></> : '* * * *'}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase ${metrics.total > BASE_INCOME ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                      {((metrics.total/BASE_INCOME)*100).toFixed(0)}% of income
                    </span>
                  </div>
                </div>

                {/* Terpakai */}
                <div className="bg-white/[0.05] backdrop-blur-sm rounded-2xl p-4 border border-white/[0.08]">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Terpakai</p>
                  <p className="text-xl md:text-2xl font-black text-amber-400">
                    {showBalances ? <><span className="text-amber-600 text-sm">Rp</span> <AnimatedNumber value={metrics.totalUsed} /></> : '* * * *'}
                  </p>
                  <div className="mt-2 w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-1000"
                      style={{ width: `${metrics.total > 0 ? Math.min(100, (metrics.totalUsed / metrics.total) * 100) : 0}%` }} />
                  </div>
                </div>

                {/* Sisa Budget */}
                <div className="bg-white/[0.05] backdrop-blur-sm rounded-2xl p-4 border border-white/[0.08]">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Sisa Budget</p>
                  <p className={`text-xl md:text-2xl font-black ${metrics.remaining >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {showBalances ? <><span className={`text-sm ${metrics.remaining >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>Rp</span> <AnimatedNumber value={Math.abs(metrics.remaining)} /></> : '* * * *'}
                  </p>
                  <div className="flex items-center gap-1 mt-2">
                    {metrics.remaining >= 0 
                      ? <ArrowUpRight size={12} className="text-emerald-400"/>
                      : <ArrowDownRight size={12} className="text-red-400"/>
                    }
                    <span className={`text-[9px] font-bold ${metrics.remaining >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {metrics.remaining >= 0 ? 'Available' : 'Over!'}
                    </span>
                  </div>
                </div>

                {/* Pie Mini */}
                <div className="bg-white/[0.05] backdrop-blur-sm rounded-2xl p-4 border border-white/[0.08] flex items-center gap-3">
                  <div className="w-14 h-14 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPie>
                        <Pie data={pieData} innerRadius={16} outerRadius={26} paddingAngle={3} dataKey="value" strokeWidth={0}>
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </RechartsPie>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1 flex-1 min-w-0">
                    {[
                      { label: 'Needs', pct: metrics.needsPercent, color: '#3b82f6' },
                      { label: 'Wants', pct: metrics.wantsPercent, color: '#f59e0b' },
                      { label: 'D/S', pct: metrics.savingsPercent, color: '#ef4444' },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: item.color }}/>
                        <span className="text-[9px] text-slate-500 font-medium">{item.label}</span>
                        <span className="text-[9px] text-white font-black ml-auto">{item.pct.toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Budget Usage Bar */}
              <div className="mt-5 bg-white/[0.04] rounded-xl p-3 border border-white/[0.06]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Smart Split</span>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${budgetHealth.bg} ${budgetHealth.color} border ${budgetHealth.border}`}>{budgetHealth.label}</span>
                </div>
                <div className="flex h-3 w-full rounded-full overflow-hidden bg-white/[0.06]">
                  <div className="bg-blue-500 h-full transition-all duration-700" style={{ width: `${metrics.total > 0 ? (metrics.needs / metrics.total) * 100 : 0}%` }}/>
                  <div className="bg-amber-500 h-full transition-all duration-700" style={{ width: `${metrics.total > 0 ? (metrics.wants / metrics.total) * 100 : 0}%` }}/>
                  <div className="bg-red-500 h-full transition-all duration-700" style={{ width: `${metrics.total > 0 ? (metrics.savings / metrics.total) * 100 : 0}%` }}/>
                </div>
                <div className="flex justify-between mt-2 text-[9px] font-bold text-slate-500">
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block"/> Needs {formatCurrency(metrics.needs)}</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block"/> Wants {formatCurrency(metrics.wants)}</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block"/> D/S {formatCurrency(metrics.savings)}</span>
                </div>
              </div>
            </div>
         </div>
       </Reveal>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           {/* ============================================ */}
           {/* LEFT SIDEBAR                                 */}
           {/* ============================================ */}
           <div className="lg:col-span-1 space-y-6">
               
               {/* MONTHLY CALENDAR SELECTOR */}
               <Reveal delay={100}>
                 <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
                   <div className="flex justify-between items-center mb-5">
                       <h3 className="text-xs font-black text-slate-900 flex items-center gap-2 uppercase tracking-widest">
                           <CalendarIcon className="text-blue-600" size={14}/> Periode
                       </h3>
                       <div className="flex items-center gap-1.5 bg-slate-100 p-0.5 rounded-lg">
                           <button onClick={() => handleYearChange(-1)} className="p-1 hover:bg-white rounded-md transition text-slate-400"><ChevronLeft size={14}/></button>
                           <span className="text-[10px] font-black text-slate-700 px-1.5">{currentDate.getFullYear()}</span>
                           <button onClick={() => handleYearChange(1)} className="p-1 hover:bg-white rounded-md transition text-slate-400"><ChevronRight size={14}/></button>
                       </div>
                   </div>
                   
                   <div className="grid grid-cols-4 gap-2">
                       {monthNames.map((month, index) => {
                           const isSelected = index === currentDate.getMonth();
                           const totalAllocated = getMonthlyTotal(currentDate.getFullYear(), index);
                           const hasData = totalAllocated > 0;

                           return (
                               <button 
                                   key={month} 
                                   onClick={() => handleMonthSelect(index)}
                                   className={`relative py-2 rounded-xl flex flex-col items-center justify-center transition-all ${
                                       isSelected 
                                       ? 'bg-slate-900 text-white shadow-lg scale-105 z-10' 
                                       : 'bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                                   }`}
                               >
                                   <span className="text-[10px] font-bold">{month}</span>
                                   {hasData && (
                                       <span className={`text-[8px] font-bold mt-0.5 ${isSelected ? 'text-emerald-300' : 'text-emerald-600'}`}>
                                           {totalAllocated >= 1000000 ? `${(totalAllocated/1000000).toFixed(1)}jt` : `${(totalAllocated/1000).toFixed(0)}k`}
                                       </span>
                                   )}
                                   {isSelected && <div className="absolute -bottom-0.5 w-4 h-1 rounded-full bg-blue-500"/>}
                               </button>
                           );
                       })}
                   </div>
                 </div>
               </Reveal>

               {/* SINKING FUNDS */}
               <Reveal delay={200}>
                 <FeatureGate featureKey="sinking_fund" fallback="lock" title="Kantong Dana">
                 <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
                   <div className="flex justify-between items-center mb-4">
                       <h3 className="text-xs font-black text-slate-900 flex items-center gap-2 uppercase tracking-widest">
                           <Target className="text-emerald-600" size={14}/> Kantong Dana
                       </h3>
                       <button onClick={() => openSfModal()} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg transition active:scale-95">
                           <Plus size={14}/>
                       </button>
                   </div>

                   {/* SF Summary */}
                   {sinkingFunds.length > 0 && (
                     <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100 mb-4">
                       <CircularProgress percent={metrics.sfProgress} size={44} strokeWidth={4} color="#10b981" />
                       <div className="flex-1 min-w-0">
                         <p className="text-[10px] font-bold text-emerald-700">Total Progress</p>
                         <p className="text-sm font-black text-emerald-800 truncate">{formatCurrency(metrics.totalSfCurrent)} <span className="text-[10px] font-medium text-emerald-500">/ {formatCurrency(metrics.totalSfTarget)}</span></p>
                       </div>
                     </div>
                   )}
                   
                   <div className="space-y-3">
                       {/* BANK ACCOUNTS */}
                       {bankAccounts.map(acc => (
                           <div key={acc.id} className={`p-4 rounded-2xl border relative group text-white shadow-lg ${acc.color || 'bg-slate-900'} overflow-hidden`}>
                               <div className="absolute top-0 right-0 p-3 opacity-15"><Landmark size={48}/></div>
                               <div className="relative z-10">
                                   <div className="flex items-center gap-1.5 bg-black/20 px-2 py-0.5 rounded-md backdrop-blur-sm w-fit mb-2">
                                       <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"/>
                                       <span className="text-[8px] font-black uppercase tracking-widest">Source</span>
                                   </div>
                                   <p className="font-black text-sm truncate">{acc.bankName}</p>
                                   <p className="font-mono text-[10px] opacity-70 truncate">{acc.accountNumber || '**** ****'}</p>
                               </div>
                           </div>
                       ))}

                       {/* Sinking Funds */}
                       {sinkingFunds.map(sf => {
                           const progress = sf.targetAmount > 0 ? Math.min(100, (sf.currentAmount / sf.targetAmount) * 100) : 0;
                           const linkedBank = bankAccounts.find(b => b.id === sf.assignedAccountId);
                           const targetDate = new Date(sf.deadline);
                           const today = new Date();
                           const daysLeft = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
                           const remaining = sf.targetAmount - sf.currentAmount;
                           const dailySaving = daysLeft > 0 ? remaining / daysLeft : 0;

                           return (
                               <div key={sf.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 relative group hover:border-blue-200 hover:bg-blue-50/30 transition-all">
                                   <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition z-20">
                                       <button onClick={() => openSfModal(sf)} className="p-1 bg-white text-slate-400 hover:text-blue-600 rounded-md shadow-sm"><Edit2 size={10}/></button>
                                       <button onClick={() => setShowSfHistoryId(sf.id)} className="p-1 bg-white text-slate-400 hover:text-blue-600 rounded-md shadow-sm"><History size={10}/></button>
                                       <button onClick={() => handleDeleteSFClick(sf.id)} className="p-1 bg-white text-red-400 hover:text-red-600 rounded-md shadow-sm"><Trash2 size={10}/></button>
                                   </div>

                                   <div className="flex items-start justify-between mb-2">
                                     <div>
                                       <p className="text-sm font-bold text-slate-800 truncate">{sf.name}</p>
                                       <span className="text-[9px] font-bold text-slate-400">{sf.category || 'Other'}</span>
                                     </div>
                                     {daysLeft > 0 && <span className="text-[9px] font-bold text-slate-400 bg-white px-1.5 py-0.5 rounded shrink-0">{daysLeft}d</span>}
                                   </div>

                                   <div className="flex items-center gap-2 mb-2">
                                     <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                                       <div className="bg-emerald-500 h-full transition-all duration-700 relative rounded-full" style={{ width: `${progress}%` }}>
                                         {progress > 10 && <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full"/>}
                                       </div>
                                     </div>
                                     <span className="text-[10px] font-black text-emerald-600 shrink-0">{progress.toFixed(0)}%</span>
                                   </div>

                                   <div className="flex justify-between text-[10px]">
                                     <span className="text-slate-500 font-medium">{formatCurrency(sf.currentAmount)}</span>
                                     <span className="text-slate-700 font-bold">{formatCurrency(sf.targetAmount)}</span>
                                   </div>
                                   
                                   {remaining > 0 && dailySaving > 0 && (
                                     <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                                       <span className="text-[9px] text-slate-400 italic">Perlu nabung</span>
                                       <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{formatCurrency(dailySaving)}/hari</span>
                                     </div>
                                   )}
                                   {linkedBank && (
                                     <div className="flex items-center gap-1 mt-1.5 text-[9px] text-slate-400">
                                       <CreditCard size={9}/> {linkedBank.bankName}
                                     </div>
                                   )}
                               </div>
                           );
                       })}

                       {(sinkingFunds.length === 0 && bankAccounts.length === 0) && (
                           <div className="text-center py-8 text-slate-300 text-xs border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center gap-2">
                               <Target size={24} className="opacity-30"/>
                               <p className="text-slate-400">Belum ada kantong dana</p>
                               <button onClick={() => openSfModal()} className="text-blue-600 font-bold hover:underline text-[10px]">Buat Baru</button>
                           </div>
                       )}
                   </div>
                 </div>
                 </FeatureGate>
               </Reveal>
           </div>

           {/* ============================================ */}
           {/* RIGHT: ALLOCATIONS LIST                      */}
           {/* ============================================ */}
           <div className="lg:col-span-2 space-y-4">
               
               {/* Filter & View Toggle */}
               <Reveal delay={100}>
                 <div className="flex items-center justify-between gap-3">
                   <div className="flex gap-1.5 flex-wrap">
                     {[
                       { key: 'all', label: 'Semua', count: localList.length },
                       { key: 'needs', label: 'Needs', count: localList.filter(i => i.category === 'needs').length },
                       { key: 'wants', label: 'Wants', count: localList.filter(i => i.category === 'wants').length },
                       { key: 'debt', label: 'D/S', count: localList.filter(i => i.category === 'debt' || i.category === 'savings').length },
                     ].map(f => (
                       <button
                         key={f.key}
                         onClick={() => setFilterCategory(f.key)}
                         className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                           filterCategory === f.key 
                             ? 'bg-slate-900 text-white shadow-sm' 
                             : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
                         }`}
                       >
                         {f.label} <span className="opacity-60">({f.count})</span>
                       </button>
                     ))}
                   </div>
                   <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
                     <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition ${viewMode === 'list' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600'}`}>
                       <BarChart3 size={12}/>
                     </button>
                     <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition ${viewMode === 'grid' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600'}`}>
                       <Layers size={12}/>
                     </button>
                   </div>
                 </div>
               </Reveal>

               {filteredList.length === 0 ? (
                   <Reveal delay={150}>
                     <div className="text-center py-16 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                       <Layers size={40} className="mx-auto mb-3 text-slate-200"/>
                       <p className="font-bold text-slate-400 text-sm">Belum ada pos anggaran</p>
                       <p className="text-[11px] text-slate-300 mt-1">{currentDate.toLocaleDateString('id-ID', {month:'long', year:'numeric'})}</p>
                       <button 
                         onClick={() => { setEditingId(null); setFormData({ name: '', amount: 0, percent: 0, category: 'needs', priority: 1, isRecurring: true, assignedAccountId: '', icon: 'tag', color: 'bg-slate-500' }); setIsFormOpen(true); }}
                         className="mt-4 px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-slate-800 transition active:scale-95"
                       >
                         <Plus size={14} className="inline mr-1.5"/> Buat Pos Pertama
                       </button>
                     </div>
                   </Reveal>
               ) : viewMode === 'grid' ? (
                 /* GRID VIEW */
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   {filteredList.map((item, index) => {
                     const linkedBank = bankAccounts.find(b => b.id === item.assignedAccountId);
                     const usedAmount = getUsedAmount(item.id);
                     const usagePercent = item.amount > 0 ? Math.min(100, (usedAmount / item.amount) * 100) : 0;
                     const catMeta = CATEGORY_META[item.category] || CATEGORY_META.needs;

                     return (
                       <Reveal key={item.id} delay={index * 50}>
                         <div className={`group relative bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-lg transition-all ${item.isTransferred ? 'opacity-80 bg-slate-50/50' : ''}`}>
                           {/* Top Row */}
                           <div className="flex items-start justify-between mb-3">
                             <div className={`p-2.5 rounded-xl shrink-0 ${item.color || 'bg-slate-500'} text-white shadow-sm`}>
                               {renderIcon(item.icon, 18)}
                             </div>
                             <div className="flex items-center gap-1.5">
                               <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${catMeta.bg} ${catMeta.text} border ${catMeta.border}`}>
                                 {catMeta.label}
                               </span>
                               <button onClick={() => handleToggle(item.id)} className={`transition-transform active:scale-90 ${item.isTransferred ? 'text-emerald-500' : 'text-slate-300 hover:text-blue-500'}`}>
                                 {item.isTransferred ? <CheckCircle2 size={18} className="fill-emerald-100"/> : <Circle size={18}/>}
                               </button>
                             </div>
                           </div>

                           {/* Name & Amount */}
                           <div className="cursor-pointer" onClick={() => { setEditingId(item.id); setFormData({ name: item.name, amount: item.amount, percent: item.percentage || 0, category: item.category || 'needs', priority: item.priority, isRecurring: item.isRecurring || false, assignedAccountId: item.assignedAccountId || '', icon: item.icon || 'tag', color: item.color || 'bg-slate-500' }); setIsFormOpen(true); }}>
                             <h4 className="font-bold text-slate-900 truncate mb-1">{item.name}</h4>
                             <p className="text-xl font-black text-slate-900">{showBalances ? formatCurrency(item.amount) : '***'}</p>
                           </div>

                           {/* Usage Bar */}
                           <div className="mt-3">
                             <div className="flex justify-between text-[9px] font-bold mb-1">
                               <span className="text-slate-400">Terpakai</span>
                               <span className={usagePercent >= 90 ? 'text-red-500' : 'text-slate-500'}>{usagePercent.toFixed(0)}%</span>
                             </div>
                             <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                               <div className={`h-full rounded-full transition-all duration-700 ${usagePercent >= 100 ? 'bg-red-500' : usagePercent >= 80 ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${usagePercent}%` }}/>
                             </div>
                             {usedAmount > 0 && (
                               <p className="text-[9px] text-slate-400 mt-1">{formatCurrency(usedAmount)} / {formatCurrency(item.amount)}</p>
                             )}
                           </div>

                           {/* Tags */}
                           <div className="flex flex-wrap gap-1 mt-3">
                             {item.isRecurring && <span className="text-[8px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-bold border border-indigo-100">Rutin</span>}
                             {linkedBank && <span className="text-[8px] bg-slate-900 text-white px-1.5 py-0.5 rounded font-bold">{linkedBank.bankName}</span>}
                           </div>

                           {/* Hover Actions */}
                           <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition z-10">
                             <button onClick={() => handleDeleteAllocationClick(item.id)} className={`p-1.5 rounded-lg transition ${usedAmount > 0 ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-red-50 text-red-500 hover:bg-red-100'}`} disabled={usedAmount > 0}><Trash2 size={12}/></button>
                           </div>
                         </div>
                       </Reveal>
                     );
                   })}
                 </div>
               ) : (
                 /* LIST VIEW */
                 <div className="space-y-3">
                   {filteredList.map((item, index) => {
                       const linkedBank = bankAccounts.find(b => b.id === item.assignedAccountId);
                       const usedAmount = getUsedAmount(item.id);
                       const usagePercent = item.amount > 0 ? Math.min(100, (usedAmount / item.amount) * 100) : 0;
                       const catMeta = CATEGORY_META[item.category] || CATEGORY_META.needs;
                       
                       return (
                         <Reveal key={item.id} delay={index * 40}>
                           <div 
                                draggable
                                onDragStart={(e) => handleDragStart(e, index)}
                                onDragEnter={(e) => handleDragEnter(e, index)}
                                onDragEnd={handleDragEnd}
                                onDragOver={(e) => e.preventDefault()}
                                className={`group relative bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all ${draggedItemIndex === index ? 'opacity-20 scale-95 border-blue-500 border-dashed' : ''} ${item.isTransferred ? 'opacity-80 bg-slate-50/50' : ''}`}
                           >
                               <div className="flex items-center gap-3">
                                   {/* Drag Handle */}
                                   <div className="cursor-grab active:cursor-grabbing text-slate-200 hover:text-slate-400 transition">
                                       <GripVertical size={16}/>
                                   </div>

                                   {/* Icon */}
                                   <div className={`p-2.5 rounded-xl shrink-0 ${item.color || 'bg-slate-500'} text-white shadow-sm`}>
                                       {renderIcon(item.icon, 16)}
                                   </div>

                                   {/* Toggle */}
                                   <button onClick={() => handleToggle(item.id)} className={`transition-all active:scale-90 ${item.isTransferred ? 'text-emerald-500' : 'text-slate-300 hover:text-blue-500'}`}>
                                       {item.isTransferred ? <CheckCircle2 size={22} className="fill-emerald-100"/> : <Circle size={22}/>}
                                   </button>

                                   {/* Content */}
                                   <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setEditingId(item.id); setFormData({ name: item.name, amount: item.amount, percent: item.percentage || 0, category: item.category || 'needs', priority: item.priority, isRecurring: item.isRecurring || false, assignedAccountId: item.assignedAccountId || '', icon: item.icon || 'tag', color: item.color || 'bg-slate-500' }); setIsFormOpen(true); }}>
                                       <div className="flex items-center gap-2 mb-1">
                                           <h4 className="font-bold text-sm text-slate-900 truncate">{item.name}</h4>
                                           <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${catMeta.bg} ${catMeta.text} border ${catMeta.border}`}>
                                               {catMeta.label}
                                           </span>
                                           {item.isRecurring && <span className="text-[8px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-bold border border-indigo-100 hidden sm:inline-flex items-center gap-0.5"><RefreshCw size={8}/> Rutin</span>}
                                       </div>
                                       {/* Mini Progress */}
                                       <div className="flex items-center gap-2 mt-1">
                                         <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-[120px]">
                                           <div className={`h-full rounded-full transition-all duration-500 ${usagePercent >= 100 ? 'bg-red-500' : usagePercent >= 80 ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${usagePercent}%` }}/>
                                         </div>
                                         <span className="text-[9px] font-bold text-slate-400">{usagePercent.toFixed(0)}% used</span>
                                         {linkedBank && (
                                           <span className="text-[8px] bg-slate-900 text-white px-1.5 py-0.5 rounded font-bold hidden sm:flex items-center gap-0.5">
                                             <CreditCard size={8} className="text-yellow-400"/> {linkedBank.bankName}
                                           </span>
                                         )}
                                       </div>
                                   </div>

                                   {/* Amount */}
                                   <div className="flex flex-col items-end gap-1 shrink-0">
                                       <span className="text-lg font-black text-slate-900">
                                           {showBalances ? formatCurrency(item.amount) : '***'}
                                       </span>
                                       {usedAmount > 0 && (
                                         <span className="text-[10px] font-medium text-slate-400">-{formatCurrency(usedAmount)}</span>
                                       )}
                                   </div>

                                   {/* Actions */}
                                   <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                       {item.isTransferred && (
                                           <button onClick={() => setShowAllocHistoryId(item.id)} className="p-2 bg-blue-50 text-blue-500 rounded-lg hover:bg-blue-100 transition" title="Riwayat"><History size={13}/></button>
                                       )}
                                       <button onClick={() => handleDeleteAllocationClick(item.id)} className={`p-2 rounded-lg transition ${usedAmount > 0 ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-red-50 text-red-500 hover:bg-red-100'}`} disabled={usedAmount > 0}><Trash2 size={13}/></button>
                                   </div>
                               </div>
                           </div>
                         </Reveal>
                       );
                   })}
                 </div>
               )}
           </div>
       </div>

       {/* ============================================ */}
       {/* MODALS (All preserved from original)         */}
       {/* ============================================ */}

       {/* ALLOCATION HISTORY MODAL */}
       {showAllocHistoryId && (
           <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" style={{ animation: 'fadeInUp 0.2s ease-out' }}>
               <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                   <div className="flex justify-between items-center mb-4 border-b pb-4">
                       <div>
                           <h3 className="text-lg font-black text-slate-900">Riwayat Penggunaan</h3>
                           <p className="text-xs text-slate-500">{localList.find(a=>a.id===showAllocHistoryId)?.name}</p>
                       </div>
                       <button onClick={() => setShowAllocHistoryId(null)} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:text-slate-900 transition"><X size={18}/></button>
                   </div>
                   
                   <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                       {dailyExpenses.filter(e => e.allocationId === showAllocHistoryId).length === 0 ? (
                           <div className="text-center py-10 text-slate-400 text-sm italic">Belum ada transaksi.</div>
                       ) : (
                           dailyExpenses.filter(e => e.allocationId === showAllocHistoryId).map(exp => (
                               <div key={exp.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                                   <div>
                                       <p className="font-bold text-slate-800 text-sm">{exp.title}</p>
                                       <p className="text-[10px] text-slate-400">{safeDateISO(exp.date)}</p>
                                   </div>
                                   <span className="font-mono font-bold text-red-600">-{formatCurrency(exp.amount)}</span>
                               </div>
                           ))
                       )}
                   </div>
               </div>
           </div>
       )}

       {/* SINKING FUND FORM MODAL */}
       {isSfFormOpen && (
           <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4" style={{ animation: 'fadeInUp 0.2s ease-out' }}>
               <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl border border-white/20">
                   <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2"><Target size={20} className="text-emerald-600"/> {editingSfId ? 'Edit Kantong' : 'Smart Sinking Fund'}</h3>
                   
                   <form onSubmit={handleSaveSF} className="space-y-5">
                       <div>
                           <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Nama Tujuan</label>
                           <input className="w-full border-2 border-slate-100 p-3 rounded-xl font-bold text-slate-800 outline-none focus:border-blue-500 transition" placeholder="Misal: Liburan Jepang" value={sfFormData.name} onChange={e => setSfFormData({...sfFormData, name: e.target.value})} required />
                       </div>

                       <div className="grid grid-cols-2 gap-4">
                           <div>
                               <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Target (Rp)</label>
                               <input className="w-full border-2 border-slate-100 p-3 rounded-xl font-mono text-sm font-bold outline-none focus:border-blue-500 transition" type="number" placeholder="0" value={sfFormData.target} onChange={e => setSfFormData({...sfFormData, target: Number(e.target.value)})} required />
                           </div>
                           <div>
                               <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Terkumpul</label>
                               <input 
                                   className={`w-full border-2 border-slate-100 p-3 rounded-xl font-mono text-sm font-bold outline-none ${editingSfId ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : 'focus:border-blue-500'} transition`} 
                                   type="number" 
                                   placeholder="0" 
                                   value={sfFormData.current} 
                                   onChange={e => setSfFormData({...sfFormData, current: Number(e.target.value)})} 
                                   disabled={!!editingSfId}
                               />
                               {editingSfId && <p className="text-[9px] text-slate-400 mt-1 italic">Update saldo lewat Daily Expenses</p>}
                           </div>
                       </div>

                       <div>
                           <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Kategori</label>
                           <div className="flex flex-wrap gap-2">
                               {['Emergency', 'Holiday', 'Gadget', 'Vehicle', 'Education', 'Other'].map(cat => (
                                   <button 
                                     key={cat}
                                     type="button" 
                                     onClick={() => setSfFormData({...sfFormData, category: cat})}
                                     className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${sfFormData.category === cat ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
                                   >
                                       {cat}
                                   </button>
                               ))}
                           </div>
                       </div>

                       <div>
                           <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Deadline</label>
                           <input type="date" className="w-full border-2 border-slate-100 p-3 rounded-xl text-sm font-medium outline-none focus:border-blue-500 text-slate-600 transition" value={sfFormData.deadline} onChange={e => setSfFormData({...sfFormData, deadline: e.target.value})} required />
                       </div>

                       {sfFormData.target > 0 && sfFormData.deadline && (
                           <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex items-center justify-between">
                               <div>
                                   <p className="text-[10px] font-bold text-emerald-500 uppercase">Perlu Nabung</p>
                                   <p className="text-lg font-black text-emerald-700">{formatCurrency(calculateMonthlySaving())} <span className="text-xs text-emerald-500 font-medium">/ bulan</span></p>
                               </div>
                               <TrendingUp size={24} className="text-emerald-300"/>
                           </div>
                       )}

                       <div>
                           <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Hubungkan Rekening</label>
                           <select 
                               className="w-full border-2 border-slate-100 p-3 rounded-xl text-sm font-bold bg-white outline-none focus:border-blue-500 text-slate-700 transition"
                               value={sfFormData.assignedAccountId}
                               onChange={e => setSfFormData({...sfFormData, assignedAccountId: e.target.value})}
                           >
                               <option value="">-- Pilih Sumber Dana --</option>
                               {bankAccounts.map(acc => (
                                   <option key={acc.id} value={acc.id}>{acc.bankName} - {acc.accountNumber}</option>
                               ))}
                           </select>
                       </div>

                       <div className="flex gap-3 pt-2">
                           <button type="button" onClick={() => setIsSfFormOpen(false)} className="flex-1 py-3 border-2 border-slate-100 rounded-xl font-bold text-slate-500 hover:bg-slate-50 text-xs uppercase tracking-widest transition">Batal</button>
                           <button type="submit" className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 shadow-lg text-xs uppercase tracking-widest transition active:scale-95">Simpan</button>
                       </div>
                   </form>
               </div>
           </div>
       )}

       {/* SINKING FUND HISTORY MODAL */}
       {showSfHistoryId && (
           <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" style={{ animation: 'fadeInUp 0.2s ease-out' }}>
               <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                   <div className="flex justify-between items-center mb-4 border-b pb-4">
                       <div>
                           <h3 className="text-lg font-black text-slate-900">Riwayat Tabungan</h3>
                           <p className="text-xs text-slate-500">{sinkingFunds.find(s=>s.id===showSfHistoryId)?.name}</p>
                       </div>
                       <button onClick={() => setShowSfHistoryId(null)} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:text-slate-900 transition"><X size={18}/></button>
                   </div>
                   
                   <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                       {dailyExpenses.filter(e => e.sinkingFundId === showSfHistoryId).length === 0 ? (
                           <div className="text-center py-10 text-slate-400 text-sm italic">Belum ada transaksi tabungan.</div>
                       ) : (
                           dailyExpenses.filter(e => e.sinkingFundId === showSfHistoryId).map(exp => (
                               <div key={exp.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                                   <div>
                                       <p className="font-bold text-slate-800 text-sm">{exp.title}</p>
                                       <p className="text-[10px] text-slate-400">{safeDateISO(exp.date)}</p>
                                   </div>
                                   <span className="font-mono font-bold text-green-600">+{formatCurrency(exp.amount)}</span>
                               </div>
                           ))
                       )}
                   </div>
               </div>
           </div>
       )}

       {/* ALLOCATION FORM MODAL */}
       {isFormOpen && (
           <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4" style={{ animation: 'fadeInUp 0.2s ease-out' }}>
               <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl border border-white/20 overflow-y-auto max-h-[90vh]">
                   <div className="flex justify-between items-center mb-6">
                       <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                           {editingId ? <Edit2 size={18} className="text-blue-600"/> : <Plus size={18} className="text-blue-600"/>}
                           {editingId ? 'Edit Pos' : 'Pos Baru'}
                       </h3>
                       <button onClick={()=>setIsFormOpen(false)} className="p-2 bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition"><X size={18}/></button>
                   </div>
                   
                   <form onSubmit={handleSave} className="space-y-5">
                       <div>
                           <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 ml-1">Nama Pos</label>
                           <input className="w-full border-2 border-slate-100 p-3.5 rounded-2xl focus:border-blue-500 outline-none font-bold text-slate-800 transition" placeholder="Misal: Belanja Bulanan" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} autoFocus />
                       </div>

                       <div>
                           <div className="flex justify-between items-center mb-1.5 ml-1">
                               <label className="text-[10px] font-black text-slate-500 uppercase">Target Budget</label>
                               <div className="flex bg-slate-100 rounded-lg p-0.5">
                                   <button type="button" onClick={() => setMode('fixed')} className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition ${mode === 'fixed' ? 'bg-white shadow text-slate-900' : 'text-slate-400'}`}><DollarSign size={11}/></button>
                                   <button type="button" onClick={() => setMode('percent')} className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition ${mode === 'percent' ? 'bg-white shadow text-slate-900' : 'text-slate-400'}`}><Percent size={11}/></button>
                               </div>
                           </div>
                           
                           {mode === 'fixed' ? (
                               <input type="number" className="w-full border-2 border-slate-100 p-3.5 rounded-2xl focus:border-blue-500 outline-none font-black text-2xl text-slate-900 transition" value={formData.amount} onChange={e=>setFormData({...formData, amount: Number(e.target.value)})} />
                           ) : (
                               <div className="flex gap-2">
                                   <div className="relative flex-1">
                                       <input type="number" className="w-full border-2 border-slate-100 p-3.5 rounded-2xl focus:border-blue-500 outline-none font-black text-2xl text-slate-900 transition" value={formData.percent} onChange={e=>setFormData({...formData, percent: Number(e.target.value)})} />
                                       <span className="absolute right-4 top-4 font-bold text-slate-400">%</span>
                                   </div>
                                   <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 flex items-center justify-center min-w-[110px]">
                                       <span className="font-bold text-slate-600 text-sm">{formatCurrency(formData.amount)}</span>
                                   </div>
                               </div>
                           )}
                       </div>

                       {/* ICON SELECTOR */}
                       <div>
                           <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 ml-1">Icon</label>
                           <div className="flex flex-wrap gap-1.5">
                               {AVAILABLE_ICONS.map(i => (
                                   <button 
                                     key={i.id}
                                     type="button"
                                     onClick={() => setFormData({...formData, icon: i.id})}
                                     className={`p-2 rounded-xl border transition ${formData.icon === i.id ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'}`}
                                     title={i.label}
                                   >
                                       <i.icon size={16} />
                                   </button>
                               ))}
                           </div>
                       </div>

                       {/* COLOR SELECTOR */}
                       <div>
                           <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 ml-1">Warna</label>
                           <div className="flex flex-wrap gap-1.5">
                               {AVAILABLE_COLORS.map(c => (
                                   <button 
                                     key={c}
                                     type="button"
                                     onClick={() => setFormData({...formData, color: c})}
                                     className={`w-6 h-6 rounded-full transition ${c} ${formData.color === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-110'}`}
                                   />
                               ))}
                           </div>
                       </div>

                       <div className="grid grid-cols-2 gap-3">
                           <div>
                               <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 ml-1">Kategori</label>
                               <select className="w-full border-2 border-slate-100 p-3 rounded-2xl focus:border-blue-500 outline-none font-bold text-sm bg-white transition" value={formData.category} onChange={e=>setFormData({...formData, category: e.target.value})}>
                                   <option value="needs">Needs (Wajib)</option>
                                   <option value="wants">Wants (Hiburan)</option>
                                   <option value="debt">Debt/Saving</option>
                               </select>
                           </div>
                           <div>
                               <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 ml-1">Sumber Dana</label>
                               <select 
                                   className="w-full border-2 border-slate-100 p-3 rounded-2xl focus:border-blue-500 outline-none font-bold text-sm bg-white transition"
                                   value={formData.assignedAccountId}
                                   onChange={e => setFormData({...formData, assignedAccountId: e.target.value})}
                               >
                                   <option value="">-- Pilih --</option>
                                   {bankAccounts.map(acc => (
                                       <option key={acc.id} value={acc.id}>{acc.bankName}</option>
                                   ))}
                               </select>
                           </div>
                       </div>
                       
                       <label className="flex items-center gap-3 cursor-pointer p-3.5 border-2 border-slate-100 rounded-2xl w-full hover:bg-slate-50 transition">
                           <input type="checkbox" className="w-4 h-4 accent-blue-600 rounded" checked={formData.isRecurring} onChange={e=>setFormData({...formData, isRecurring: e.target.checked})} />
                           <div>
                             <span className="text-xs font-bold text-slate-700">Rutin Hingga Akhir Tahun</span>
                             <p className="text-[9px] text-slate-400">Otomatis dibuat untuk bulan-bulan berikutnya</p>
                           </div>
                       </label>

                       <div className="flex gap-3 pt-3">
                           <button type="button" onClick={()=>setIsFormOpen(false)} className="flex-1 py-3.5 border-2 border-slate-100 rounded-2xl font-bold text-slate-500 text-xs uppercase tracking-widest hover:bg-slate-50 transition">Batal</button>
                           <button type="submit" disabled={isSaving} className="flex-1 py-3.5 bg-slate-900 text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-xl hover:bg-slate-800 transition active:scale-95 flex items-center justify-center gap-2">
                               {isSaving ? <><RefreshCw size={14} className="animate-spin"/> Menyimpan...</> : <><Save size={14}/> Simpan</>}
                           </button>
                       </div>
                   </form>
               </div>
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

       {/* INLINE CSS */}
       <style>{`
         @keyframes fadeInUp {
           from { opacity: 0; transform: translateY(12px); }
           to { opacity: 1; transform: translateY(0); }
         }
       `}</style>
    </div>
  );
}
