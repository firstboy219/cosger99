import React, { useMemo } from 'react';
import { DailyExpense, DebtInstallment, ExpenseItem } from '../../types';
import { formatCurrency } from '../../services/financeUtils';
import { Activity, AlertTriangle, CheckCircle2, TrendingUp } from 'lucide-react';

interface LivingCostWidgetProps {
  income: number;
  dailyExpenses: DailyExpense[];
  debtInstallments: DebtInstallment[];
  allocations: ExpenseItem[];
}

export default function LivingCostWidget({ 
  income, 
  dailyExpenses, 
  debtInstallments, 
  allocations 
}: LivingCostWidgetProps) {

  const metrics = useMemo(() => {
    // Source from ALLOCATIONS (budget items), not daily expenses
    // 1. Needs + Wants from allocation (non-debt categories)
    const totalNeedsExpense = allocations
      .filter(a => !a._deleted && a.category !== 'debt')
      .reduce((sum, a) => sum + Number(a.amount || 0), 0);

    // 2. Debt allocation amount (debt category allocations)
    const totalDebtAllocation = allocations
      .filter(a => !a._deleted && a.category === 'debt')
      .reduce((sum, a) => sum + Number(a.amount || 0), 0);

    const totalLivingCost = totalNeedsExpense + totalDebtAllocation;
    const totalIncome = Number(income) || 0;
    
    // Avoid division by zero
    const ratio = totalIncome > 0 ? (totalLivingCost / totalIncome) * 100 : 0;

    return {
      totalLivingCost,
      totalIncome,
      ratio,
      totalNeedsExpense,
      totalDebtPaid: totalDebtAllocation
    };
  }, [income, allocations]);

  // Determine Status Color & Text
  let statusColor = 'text-green-500';
  let bgColor = 'bg-green-50';
  let borderColor = 'border-green-100';
  let progressColor = 'bg-green-500';
  let statusText = 'Ideal / Safe';
  let Icon = CheckCircle2;

  if (metrics.ratio > 70) {
    statusColor = 'text-red-500';
    bgColor = 'bg-red-50';
    borderColor = 'border-red-100';
    progressColor = 'bg-red-500';
    statusText = 'Danger / Overbudget';
    Icon = AlertTriangle;
  } else if (metrics.ratio > 50) {
    statusColor = 'text-amber-500';
    bgColor = 'bg-amber-50';
    borderColor = 'border-amber-100';
    progressColor = 'bg-amber-500';
    statusText = 'Warning / High';
    Icon = Activity;
  }

  return (
    <div className={`p-6 rounded-[2.5rem] border ${borderColor} ${bgColor} shadow-sm flex flex-col justify-between hover:shadow-lg transition-all group relative overflow-hidden`}>
      <div className="flex justify-between items-start z-10">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Living Cost Ratio</p>
          <h3 className={`text-4xl font-black ${statusColor}`}>
            {metrics.ratio.toFixed(1)}<span className="text-lg">%</span>
          </h3>
        </div>
        <div className={`p-3 rounded-2xl bg-white/50 backdrop-blur-sm ${statusColor}`}>
          <Icon size={24}/>
        </div>
      </div>

      <div className="mt-4 z-10">
        {/* Progress Bar */}
        <div className="w-full h-3 bg-slate-200/50 rounded-full overflow-hidden mb-3">
          <div 
            className={`h-full rounded-full transition-all duration-1000 ${progressColor}`} 
            style={{ width: `${Math.min(100, metrics.ratio)}%` }}
          ></div>
        </div>

        <div className="flex justify-between items-end">
          <div>
            <p className={`text-xs font-bold ${statusColor} mb-0.5`}>{statusText}</p>
            <p className="text-[10px] text-slate-500 font-medium">
              {formatCurrency(metrics.totalLivingCost)} of {formatCurrency(metrics.totalIncome)}
            </p>
          </div>
          
          {/* Mini Breakdown Tooltip-ish */}
          <div className="text-[9px] text-right text-slate-400 leading-tight">
            <div>Needs: {formatCurrency(metrics.totalNeedsExpense)}</div>
            <div>Debt: {formatCurrency(metrics.totalDebtPaid)}</div>
          </div>
        </div>
      </div>

      {/* Decorative Background Icon */}
      <div className="absolute -bottom-4 -right-4 opacity-5 pointer-events-none">
        <TrendingUp size={100} className={statusColor.replace('text-', 'text-')}/>
      </div>
    </div>
  );
}
