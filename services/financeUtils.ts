import { LoanType, SimulationInput, SimulationResult, DebtItem, DailyExpense, ExpenseItem, DebtInstallment } from '../types';
import { getConfig } from './mockDb';

// --- ROBUST DATE HELPER (Anti-Crash & Timezone Fix) ---
export const safeDateISO = (input?: string | Date | null): string => {
    if (!input) return new Date().toISOString().split('T')[0];
    
    try {
        // 1. If it's already a simple YYYY-MM-DD string, return it directly to avoid timezone shifts
        if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
            return input;
        }

        const d = new Date(input);
        // Check if date is valid
        if (isNaN(d.getTime())) {
            // Do not fallback to today immediately if input exists but is weird
            // But for safety in forms, we default to today if truly broken
            console.warn("Invalid date detected, fallback to today:", input);
            return new Date().toISOString().split('T')[0];
        }
        return d.toISOString().split('T')[0];
    } catch (e) {
        return new Date().toISOString().split('T')[0];
    }
};

export const calculatePMT = (rate: number, nper: number, pv: number): number => {
  if (rate === 0) return pv / nper;
  const pvif = Math.pow(1 + rate, nper);
  return (rate * pv * pvif) / (pvif - 1);
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const getMonthDiff = (d1: Date, d2: Date): number => {
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
  let months;
  months = (d2.getFullYear() - d1.getFullYear()) * 12;
  months -= d1.getMonth();
  months += d2.getMonth();
  return months <= 0 ? 0 : months;
};

// --- IMPROVED INSTALLMENT GENERATOR ---
export const generateInstallmentsForDebt = (
    debt: DebtItem, 
    existingInstallments: DebtInstallment[] = []
): DebtInstallment[] => {
    const newInstallments: DebtInstallment[] = [];
    
    // 1. Basic Validation
    if (!debt.startDate || !debt.endDate || !debt.originalPrincipal) {
        return [];
    }

    const start = new Date(debt.startDate);
    const end = new Date(debt.endDate);
    
    // Strict date validation
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return [];
    }
    
    // Calculate total duration in months
    let totalMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    if (totalMonths <= 0) totalMonths = 1; 

    let currentBalance = Number(debt.originalPrincipal);
    const strategy = (debt.interestStrategy || 'FIXED').toUpperCase(); 
    
    let stepUpSchedule: any[] = [];
    if (Array.isArray(debt.stepUpSchedule)) {
        stepUpSchedule = debt.stepUpSchedule;
    }

    // 2. Loop through duration
    for (let i = 1; i <= totalMonths; i++) {
        let monthlyAmount = Number(debt.monthlyPayment);

        if (strategy === 'STEP_UP' && stepUpSchedule.length > 0) {
            const activeRange = stepUpSchedule.find(range => i >= Number(range.startMonth) && i <= Number(range.endMonth));
            if (activeRange) {
                monthlyAmount = Number(activeRange.amount);
            }
        }

        const rate = Number(debt.interestRate || 0);
        const interestPart = (currentBalance * (rate / 100)) / 12;
        let principalPart = monthlyAmount - interestPart;
        
        if (principalPart < 0) principalPart = 0;
        
        const prevBalance = currentBalance;
        currentBalance -= principalPart;
        if (currentBalance < 0) currentBalance = 0;

        const dueDateObj = new Date(start);
        dueDateObj.setMonth(start.getMonth() + i);
        
        const targetDay = debt.dueDate || 1;
        const maxDayInMonth = new Date(dueDateObj.getFullYear(), dueDateObj.getMonth() + 1, 0).getDate();
        dueDateObj.setDate(Math.min(targetDay, maxDayInMonth));
        
        const dueDateStr = safeDateISO(dueDateObj);

        const existingRecord = existingInstallments.find(e => e.period === i);
        
        if (existingRecord && existingRecord.status === 'paid') {
            newInstallments.push(existingRecord);
        } else {
            const isPast = new Date(dueDateStr) < new Date() && new Date().toISOString().split('T')[0] !== dueDateStr;
            
            newInstallments.push({
                id: existingRecord ? existingRecord.id : `inst-${debt.id}-p${i}-${Date.now()}-${Math.random().toString(36).substr(2,5)}`,
                debtId: debt.id,
                userId: debt.userId,
                period: i,
                dueDate: dueDateStr,
                amount: Math.round(monthlyAmount),
                principalPart: Math.round(principalPart),
                interestPart: Math.round(interestPart),
                remainingBalance: Math.round(currentBalance),
                status: isPast ? 'overdue' : 'pending',
                notes: existingRecord?.notes || '' 
            });
        }
    }

    return newInstallments;
};

export const detectSpendingAnomaly = (expenses: DailyExpense[]) => {
    if (expenses.length === 0) return null;
    
    const rules = getConfig().systemRules;
    const PERCENT_THRESHOLD = (rules?.anomalyPercentThreshold || 40) / 100;
    const MIN_AMOUNT = rules?.anomalyMinAmount || 500000;

    const categoryTotals: Record<string, number> = {};
    expenses.forEach(e => {
        categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
    });

    const total = expenses.reduce((a,b) => a + b.amount, 0);
    let anomaly = null;

    Object.keys(categoryTotals).forEach(cat => {
        const pct = (categoryTotals[cat] / total);
        if (pct > PERCENT_THRESHOLD && total > MIN_AMOUNT) { 
            anomaly = {
                category: cat,
                percent: Math.round(pct * 100),
                amount: categoryTotals[cat],
                status: 'warning',
                message: `Pengeluaran '${cat}' mendominasi ${Math.round(pct * 100)}% budget minggu ini.`
            };
        }
    });

    return anomaly;
};

export const checkRefinanceOpportunity = (debt: DebtItem) => {
    const rules = getConfig().systemRules;
    const GAP = rules?.refinanceGapThreshold || 2.0;
    const MIN_PRINCIPAL = rules?.minPrincipalForRefinance || 50000000;

    const BENCHMARKS = {
        [LoanType.KPR]: rules?.benchmarkRateKPR || 7.5,
        [LoanType.KKB]: rules?.benchmarkRateKKB || 5.0,
        [LoanType.KTA]: rules?.benchmarkRateKTA || 11.0,
        [LoanType.CC]: rules?.benchmarkRateCC || 20.0
    };

    const marketRate = BENCHMARKS[debt.type] || 10;
    const userRate = debt.interestRate || 0;

    if (userRate > (marketRate + GAP) && debt.remainingPrincipal > MIN_PRINCIPAL) {
        const rateDiff = (userRate - marketRate) / 100;
        const potentialSavingsPerYear = debt.remainingPrincipal * rateDiff;
        const yearsLeft = (debt.remainingMonths || 12) / 12;
        const totalSavings = potentialSavingsPerYear * yearsLeft;

        return {
            isOpportunity: true,
            marketRate,
            potentialSavings: totalSavings,
            monthlySave: totalSavings / (yearsLeft * 12)
        };
    }

    return { isOpportunity: false };
};

export const calculateSmartDebtDetails = (
    monthlyPayment: number,
    startDateStr: string,
    endDateStr: string,
    stepUpSchedule: { startMonth: number; endMonth: number; amount: number }[] = []
) => {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const now = new Date();

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return {
            totalLiability: 0,
            paidAmount: 0,
            remainingPrincipal: 0,
            remainingMonths: 0,
            tenorMonths: 0,
            currentMonthlyPayment: 0,
            monthsPassed: 0
        };
    }

    const tenorMonths = getMonthDiff(start, end);
    const monthsPassed = getMonthDiff(start, now);
    const remainingMonths = Math.max(0, tenorMonths - monthsPassed);

    let totalLiability = 0;
    let paidAmount = 0;
    let currentMonthlyPayment = monthlyPayment;

    if (stepUpSchedule.length > 0) {
        for (let i = 1; i <= tenorMonths; i++) {
            const range = stepUpSchedule.find(r => i >= r.startMonth && i <= r.endMonth);
            const amount = range ? Number(range.amount) : monthlyPayment;
            
            totalLiability += amount;
            if (i <= monthsPassed) {
                paidAmount += amount;
            }
            if (i === monthsPassed + 1) {
                currentMonthlyPayment = amount;
            }
        }
    } else {
        totalLiability = monthlyPayment * tenorMonths;
        paidAmount = monthlyPayment * Math.min(monthsPassed, tenorMonths);
    }

    const remainingPrincipal = Math.max(0, totalLiability - paidAmount);

    return {
        totalLiability,
        paidAmount,
        remainingPrincipal,
        remainingMonths,
        tenorMonths,
        currentMonthlyPayment,
        monthsPassed
    };
};

export const calculateImpliedInterestRate = (originalPrincipal: number, totalLiability: number, monthlyPayment: number) => {
    if (!originalPrincipal || originalPrincipal <= 0) return 0;
    if (!totalLiability || totalLiability <= 0) return 0;
    if (totalLiability <= originalPrincipal) return 0;

    const totalMonths = monthlyPayment > 0 ? Math.ceil(totalLiability / monthlyPayment) : 0;
    if (totalMonths === 0) return 0;

    const totalInterest = totalLiability - originalPrincipal;
    const years = totalMonths / 12;
    const rate = ((totalInterest / originalPrincipal) / years) * 100;
    
    return parseFloat(rate.toFixed(2));
};

export const calculateCurrentDebtStatus = (
  originalPrincipal: number,
  totalLiability: number,
  startDateStr: string,
  endDateStr: string,
  stepUpSchedule?: { startMonth: number; endMonth: number; amount: number }[]
) => {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const now = new Date();

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return {
        monthlyPayment: 0,
        remainingPrincipal: 0,
        remainingMonths: 0,
        interestRate: 0,
        monthsPassed: 0
      };
  }

  const totalMonths = getMonthDiff(start, end);
  const monthsPassed = getMonthDiff(start, now);
  const remainingMonths = Math.max(0, totalMonths - monthsPassed);

  let monthlyPayment = 0;
  let totalPaid = 0;

  let parsedSchedule: any[] = [];
  if (stepUpSchedule) {
      if (typeof stepUpSchedule === 'string') {
          try { parsedSchedule = JSON.parse(stepUpSchedule); } catch(e) { parsedSchedule = []; }
      } else if (Array.isArray(stepUpSchedule)) {
          parsedSchedule = stepUpSchedule;
      }
  }

  if (parsedSchedule.length > 0) {
    for (let i = 1; i <= monthsPassed; i++) {
        const range = parsedSchedule.find((r:any) => i >= Number(r.startMonth) && i <= Number(r.endMonth));
        const payment = range ? Number(range.amount) : 0;
        totalPaid += payment;
    }
    const currentMonthIndex = monthsPassed + 1;
    const currentRange = parsedSchedule.find((r:any) => currentMonthIndex >= Number(r.startMonth) && currentMonthIndex <= Number(r.endMonth));
    if (currentRange) {
        monthlyPayment = Number(currentRange.amount);
    } else if (remainingMonths > 0) {
        monthlyPayment = (totalLiability - totalPaid) / remainingMonths;
    }
  } else {
    monthlyPayment = totalMonths > 0 ? totalLiability / totalMonths : 0;
    totalPaid = monthlyPayment * monthsPassed;
  }
  
  const remainingLiability = Math.max(0, totalLiability - totalPaid);
  const totalInterest = totalLiability - originalPrincipal;
  const years = totalMonths / 12;
  const impliedRate = years > 0 ? ((totalInterest / originalPrincipal) / years) * 100 : 0;

  return {
    monthlyPayment,
    remainingPrincipal: remainingLiability,
    remainingMonths: Math.max(0, remainingMonths),
    interestRate: impliedRate,
    monthsPassed
  };
};

export const runSimulation = (input: SimulationInput): SimulationResult => {
  const { assetPrice, downPaymentPercent, interestRate, tenorYears, loanType } = input;
  
  const rules = getConfig().systemRules;
  
  const downPayment = assetPrice * (downPaymentPercent / 100);
  const loanAmount = assetPrice - downPayment;
  const monthlyRate = interestRate / 100 / 12;
  const totalMonths = tenorYears * 12;
  const monthlyPayment = calculatePMT(monthlyRate, totalMonths, loanAmount);

  const provisionRate = (rules?.provisionRate || 1.0) / 100;
  
  const adminFee = loanType === LoanType.KPR 
        ? (rules?.adminFeeKPR || 500000) 
        : (rules?.adminFeeNonKPR || 250000);
        
  const insuranceRate = loanType === LoanType.KPR 
        ? (rules?.insuranceRateKPR || 2.5) / 100 
        : (rules?.insuranceRateNonKPR || 1.5) / 100;
        
  const notaryFee = loanType === LoanType.KPR 
        ? (rules?.notaryFeeKPR || 1.0) / 100 
        : (rules?.notaryFeeNonKPR || 0.5) / 100;

  const provision = loanAmount * provisionRate;
  const insurance = assetPrice * insuranceRate;
  const notary = assetPrice * notaryFee;
  const totalUpfront = downPayment + provision + adminFee + insurance + notary;

  const schedule = [];
  let balance = loanAmount;
  
  for (let i = 1; i <= totalMonths; i++) {
    const interest = balance * monthlyRate;
    const principal = monthlyPayment - interest;
    balance = balance - principal;
    if (balance < 0) balance = 0;

    schedule.push({
      month: i,
      principal,
      interest,
      balance
    });
  }

  return {
    loanAmount,
    monthlyPayment,
    upfrontCosts: {
      downPayment,
      provision,
      adminFee,
      insurance,
      notary,
      totalUpfront
    },
    schedule
  };
};

export const generateExistingDebtSchedule = (debt: DebtItem) => {
  return generateInstallmentsForDebt(debt, []);
};

export const generateGlobalProjection = (
    debts: DebtItem[],
    extraMonthlyPayment: number = 0,
    strategy: 'snowball' | 'avalanche' = 'avalanche'
) => {
    let maxMonths = 0;
    const today = new Date();
    
    // PRE-FILTER: Only valid debts
    const activeDebts = debts.filter(d => {
        if (!d.startDate || !d.endDate) return false;
        const s = new Date(d.startDate);
        const e = new Date(d.endDate);
        return !isNaN(s.getTime()) && !isNaN(e.getTime());
    }).map(d => {
        const end = new Date(d.endDate);
        const rem = getMonthDiff(today, end);
        if (rem > maxMonths) maxMonths = rem;
        
        let parsedStepUp: any[] = [];
        const strategy = (d.interestStrategy || 'FIXED').toUpperCase();
        if (strategy === 'STEP_UP') {
            if (typeof d.stepUpSchedule === 'string') {
                try { parsedStepUp = JSON.parse(d.stepUpSchedule); } catch(e) {}
            } else if (Array.isArray((d as any).step_up_schedule)) {
                parsedStepUp = (d as any).step_up_schedule;
            } else if (Array.isArray(d.stepUpSchedule)) {
                parsedStepUp = d.stepUpSchedule;
            }
        }

        const startDate = new Date(d.startDate);
        const monthsPassedStart = getMonthDiff(startDate, today);

        return {
            ...d,
            calculatedRemainingMonths: rem,
            currentBalance: d.remainingPrincipal,
            monthsPassedStart,
            parsedStepUp,
            normalizedStrategy: strategy
        };
    });

    const LIMIT = Math.min(maxMonths + 12, 360); 

    const standardSeries = new Array(LIMIT + 1).fill(0);
    
    activeDebts.forEach(debt => {
        let bal = debt.remainingPrincipal;
        for (let m = 0; m <= LIMIT; m++) {
            if (m > debt.calculatedRemainingMonths) {
                standardSeries[m] += 0;
                continue;
            }
            standardSeries[m] += bal;
            let pay = debt.monthlyPayment;
            
            if (debt.normalizedStrategy === 'STEP_UP' && debt.parsedStepUp.length > 0) {
                const absMonth = debt.monthsPassedStart + m + 1;
                const range = debt.parsedStepUp.find((r: any) => absMonth >= Number(r.startMonth) && absMonth <= Number(r.endMonth));
                if (range) pay = Number(range.amount);
            }
            
            const interest = (bal * (debt.interestRate || 0) / 100) / 12;
            const principal = pay - interest;
            bal -= (principal > 0 ? principal : 0);
            if (bal < 0) bal = 0;
        }
    });

    let accDebts = activeDebts.map(d => ({ ...d, simBalance: d.remainingPrincipal, isPaid: d.remainingPrincipal <= 0 }));
    const acceleratedSeries = new Array(LIMIT + 1).fill(0);

    for (let m = 0; m <= LIMIT; m++) {
        const totalAccBal = accDebts.reduce((sum, d) => sum + d.simBalance, 0);
        acceleratedSeries[m] = Math.round(totalAccBal);

        if (totalAccBal <= 0) continue;

        let extraPool = extraMonthlyPayment;

        accDebts.forEach(d => {
            if (d.isPaid) return;
            
            let pay = d.monthlyPayment;
            if (d.normalizedStrategy === 'STEP_UP' && d.parsedStepUp.length > 0) {
                const absMonth = d.monthsPassedStart + m + 1;
                const range = d.parsedStepUp.find((r: any) => absMonth >= Number(r.startMonth) && absMonth <= Number(r.endMonth));
                if (range) pay = Number(range.amount);
            }

            const interest = (d.simBalance * (d.interestRate || 0) / 100) / 12;
            let principal = pay - interest;
            if (principal < 0) principal = 0;
            if (principal > d.simBalance) principal = d.simBalance;

            d.simBalance -= principal;
            if (d.simBalance <= 1) { d.simBalance = 0; d.isPaid = true; }
        });

        if (extraPool > 0) {
            const targets = accDebts.filter(d => !d.isPaid);
            if (strategy === 'snowball') targets.sort((a, b) => a.simBalance - b.simBalance);
            else targets.sort((a, b) => (b.interestRate || 0) - (a.interestRate || 0));

            for (const t of targets) {
                if (extraPool <= 0) break;
                let pay = Math.min(extraPool, t.simBalance);
                t.simBalance -= pay;
                extraPool -= pay;
                if (t.simBalance <= 1) { t.simBalance = 0; t.isPaid = true; }
            }
        }
    }

    const resultData = [];
    let monthsSaved = 0;
    let standardFinish = -1;
    let acceleratedFinish = -1;

    for (let i = 0; i <= LIMIT; i++) {
        const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const monthLabel = date.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
        
        const std = Math.round(standardSeries[i]);
        const acc = Math.round(acceleratedSeries[i]);

        if (std <= 0 && standardFinish === -1) standardFinish = i;
        if (acc <= 0 && acceleratedFinish === -1) acceleratedFinish = i;

        if (i > 0 && std <= 0 && acc <= 0 && i > (Math.max(standardFinish, acceleratedFinish) + 2)) break;

        resultData.push({
            index: i,
            month: monthLabel,
            standard: std,
            accelerated: acc
        });
    }

    if (standardFinish !== -1 && acceleratedFinish !== -1) {
        monthsSaved = Math.max(0, standardFinish - acceleratedFinish);
    } else if (standardFinish === -1 && acceleratedFinish !== -1) {
        monthsSaved = Math.max(0, LIMIT - acceleratedFinish); 
    }

    return { data: resultData, monthsSaved };
};