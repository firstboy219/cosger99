
import { LoanType, SimulationInput, SimulationResult, DebtItem, DailyExpense, ExpenseItem, DebtInstallment } from '../types';
import { getConfig } from './mockDb';

// --- ROBUST DATE HELPER (Anti-Crash & Timezone Fix) ---
export const safeDateISO = (input?: string | Date | null): string => {
    if (!input) return new Date().toISOString().split('T')[0];
    
    try {
        if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
            return input;
        }
        const d = new Date(input);
        if (isNaN(d.getTime())) {
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

// --- IMPROVED INSTALLMENT GENERATOR (SMART HISTORY & STRATEGIES) ---
export const generateInstallmentsForDebt = (
    debt: DebtItem, 
    existingInstallments: DebtInstallment[] = [],
    autoPayHistory: boolean = false
): DebtInstallment[] => {
    const newInstallments: DebtInstallment[] = [];
    const todayStr = new Date().toISOString().split('T')[0];
    
    if (!debt.startDate || !debt.endDate || !debt.originalPrincipal) {
        return [];
    }

    const start = new Date(debt.startDate);
    const end = new Date(debt.endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return [];
    }
    
    let totalMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    if (totalMonths <= 0) totalMonths = 1; 

    let currentBalance = Number(debt.originalPrincipal);
    const originalPrincipal = Number(debt.originalPrincipal);
    const strategy = (debt.interestStrategy || 'Fixed').toUpperCase(); // Fixed (Flat), Annuity, StepUp
    const annualRate = Number(debt.interestRate || 0);
    const monthlyRate = (annualRate / 100) / 12;

    // --- PREPARE DATA FOR STEP UP ---
    let stepUpSchedule: any[] = [];
    if (Array.isArray(debt.stepUpSchedule)) {
        stepUpSchedule = debt.stepUpSchedule;
    } else if (typeof debt.stepUpSchedule === 'string') {
        try { stepUpSchedule = JSON.parse(debt.stepUpSchedule); } catch(e) {}
    }

    // --- CALCULATE ANNUITY FIXED PAYMENT (If needed) ---
    // PMT Formula: P * (r(1+r)^n) / ((1+r)^n - 1)
    const annuityPayment = calculatePMT(monthlyRate, totalMonths, originalPrincipal);

    for (let i = 1; i <= totalMonths; i++) {
        let monthlyAmount = 0;
        let principalPart = 0;
        let interestPart = 0;

        // --- STRATEGY SWITCH ---
        if (strategy === 'FIXED' || strategy === 'FLAT') {
            // FLAT RATE: Bunga dihitung dari POKOK AWAL
            interestPart = originalPrincipal * monthlyRate;
            principalPart = originalPrincipal / totalMonths;
            monthlyAmount = principalPart + interestPart;
            
            // Adjust balance logic for flat is simple subtraction of principal portion
            // currentBalance calculation handled at end of loop
        } 
        else if (strategy === 'ANNUITY' || strategy === 'EFEKTIF') {
            // ANNUITY / EFEKTIF: Bunga dihitung dari SISA POKOK
            monthlyAmount = annuityPayment;
            interestPart = currentBalance * monthlyRate;
            principalPart = monthlyAmount - interestPart;
        } 
        else if (strategy === 'STEPUP' || strategy === 'STEP_UP') {
            // STEP UP: User defines Payment Amount per Period Range
            // Default to base monthlyPayment if no schedule matches
            monthlyAmount = Number(debt.monthlyPayment);
            
            const activeRange = stepUpSchedule.find((range: any) => i >= Number(range.startMonth) && i <= Number(range.endMonth));
            if (activeRange) {
                monthlyAmount = Number(activeRange.amount);
            }

            // In Step Up, typically interest is Effective (based on remaining balance)
            interestPart = currentBalance * monthlyRate;
            principalPart = monthlyAmount - interestPart;
        }

        // --- SAFETY CHECKS ---
        if (principalPart < 0) principalPart = 0; // Negative amortization protection
        
        // Final Month Adjustment (To clear dust/rounding errors)
        if (i === totalMonths) {
            if (currentBalance > 0 && (strategy === 'ANNUITY' || strategy === 'STEPUP')) {
                // Adjust principal to clear debt
                principalPart = currentBalance;
                // Recalculate amount if needed, or just let it close
                monthlyAmount = principalPart + interestPart;
            }
        }

        const dueDateObj = new Date(start);
        dueDateObj.setMonth(start.getMonth() + i);
        
        const targetDay = debt.dueDate || 1;
        const maxDayInMonth = new Date(dueDateObj.getFullYear(), dueDateObj.getMonth() + 1, 0).getDate();
        dueDateObj.setDate(Math.min(targetDay, maxDayInMonth));
        
        const dueDateStr = safeDateISO(dueDateObj);

        // Check for existing manual record
        const existingRecord = existingInstallments.find(e => e.period === i);
        
        if (existingRecord) {
            newInstallments.push(existingRecord);
            // If the user manually paid less/more, strict accounting would need to adjust currentBalance differently.
            // For simplicity in this generator, we assume the theoretical Principal reduction happens 
            // OR we rely on the calculated schedule. 
            // Let's stick to the schedule's theoretical balance reduction to keep projection consistent.
            currentBalance -= principalPart;
        } else {
            // Smart History Logic
            let status: 'pending' | 'paid' | 'overdue' = 'pending';
            
            if (autoPayHistory && dueDateStr < todayStr) {
                status = 'paid';
            } else if (dueDateStr < todayStr) {
                status = 'overdue';
            }

            newInstallments.push({
                id: `inst-${debt.id}-p${i}-${Date.now()}-${Math.random().toString(36).substr(2,5)}`,
                debtId: debt.id,
                userId: debt.userId,
                period: i,
                dueDate: dueDateStr,
                amount: Math.round(monthlyAmount),
                principalPart: Math.round(principalPart),
                interestPart: Math.round(interestPart),
                remainingBalance: Math.max(0, Math.round(currentBalance - principalPart)),
                status: status,
                notes: '' 
            });
            
            currentBalance -= principalPart;
        }
        
        if (currentBalance < 0) currentBalance = 0;
    }

    return newInstallments;
};

// --- FREEDOM MATRIX & CROSSING ANALYSIS ENGINE ---
export const generateGlobalProjection = (
    debts: DebtItem[],
    extraMonthlyPayment: number = 0,
    strategy: 'snowball' | 'avalanche' = 'avalanche',
    mode: 'lump_sum' | 'cutoff' = 'lump_sum', // NEW: Support Cutoff Mode
    investmentReturnRate: number = 4.0 // Default 4% p.a for Cutoff Strategy (Money Market Fund)
) => {
    const today = new Date();
    
    // 1. Filter Valid Debts & Pre-calc details
    const activeDebts = debts.filter(d => d.remainingPrincipal > 1000 && !d._deleted).map(d => {
        let parsedStepUp: any[] = [];
        const strategy = (d.interestStrategy || 'FIXED').toUpperCase();
        if (strategy === 'STEP_UP' || strategy === 'STEPUP') {
            if (typeof d.stepUpSchedule === 'string') {
                try { parsedStepUp = JSON.parse(d.stepUpSchedule); } catch(e) {}
            } else if (Array.isArray(d.stepUpSchedule)) {
                parsedStepUp = d.stepUpSchedule;
            }
        }

        const startDate = new Date(d.startDate);
        const monthsPassedStart = getMonthDiff(startDate, today);

        return {
            ...d,
            simBalance: d.remainingPrincipal,
            startBalance: d.remainingPrincipal,
            monthsPassedStart,
            parsedStepUp,
            normalizedStrategy: strategy,
            isPaid: false
        };
    });

    const totalPrincipal = activeDebts.reduce((a,b) => a + b.startBalance, 0);
    const LIMIT = 360; // 30 Years Cap

    // 2. Simulate Standard Path (No Extra)
    const standardSeries: number[] = [];
    let tempDebtsStd = activeDebts.map(d => ({ ...d })); 
    
    for (let m = 0; m <= LIMIT; m++) {
        const totalBal = tempDebtsStd.reduce((sum, d) => sum + d.simBalance, 0);
        
        standardSeries.push(Math.round(totalBal));
        
        if (totalBal <= 0) break;

        tempDebtsStd.forEach(d => {
            if (d.isPaid) return;
            
            let pay = d.monthlyPayment;
            
            // Handle Strategies in Projection
            if (d.normalizedStrategy === 'STEP_UP' && d.parsedStepUp.length > 0) {
                const absMonth = d.monthsPassedStart + m + 1;
                const range = d.parsedStepUp.find((r: any) => absMonth >= Number(r.startMonth) && absMonth <= Number(r.endMonth));
                if (range) pay = Number(range.amount);
            } 
            else if (d.normalizedStrategy === 'ANNUITY') {
                // For projection, we assume payment is fixed as per MonthlyPayment field (user should input average or initial)
                // Or we can recalculate PMT if originalPrincipal exists. 
                // For simplicity, we trust d.monthlyPayment is accurate for the annuity.
            }

            const interest = (d.simBalance * (d.interestRate || 0) / 100) / 12;
            let principal = pay - interest;
            
            if (principal > d.simBalance) principal = d.simBalance;
            
            // Flat rate logic correction for projection: 
            // In real world, Flat Rate payments are constant, but balance reduction is linear.
            // However, typically "outstanding balance" on app refers to Principal.
            // If Flat: Principal Reduction = MonthlyPayment - (OriginalPrincipal * Rate).
            if (d.normalizedStrategy === 'FLAT' || d.normalizedStrategy === 'FIXED') {
                 // Re-derive if possible
                 const orig = d.originalPrincipal || d.remainingPrincipal; // Fallback
                 const flatInterest = (orig * (d.interestRate || 0) / 100) / 12;
                 principal = pay - flatInterest;
            }

            d.simBalance -= principal;
            if (d.simBalance <= 1000) { d.simBalance = 0; d.isPaid = true; }
        });
    }

    // 3. Simulate Paydone Path (With Extra - Lump Sum OR Cutoff)
    const acceleratedSeries: number[] = [];
    const savingsSeries: number[] = []; 
    let tempDebtsAcc = activeDebts.map(d => ({ ...d })); 
    let accumulatedSavings = 0;
    let freedomReached = false;
    
    for (let m = 0; m <= LIMIT; m++) {
        let totalBal = tempDebtsAcc.reduce((sum, d) => sum + d.simBalance, 0);
        
        if (mode === 'cutoff' && accumulatedSavings >= totalBal && !freedomReached && totalBal > 0) {
            freedomReached = true;
            totalBal = 0; 
            accumulatedSavings -= totalBal; 
        }

        if (freedomReached) totalBal = 0; 

        acceleratedSeries.push(Math.round(totalBal));
        savingsSeries.push(Math.round(accumulatedSavings));

        if (totalBal <= 0 && mode === 'lump_sum') break; 
        if (freedomReached && mode === 'cutoff') break; 

        if (mode === 'lump_sum') {
            let extraPool = extraMonthlyPayment;
            const targets = tempDebtsAcc.filter(d => !d.isPaid);
            if (strategy === 'snowball') targets.sort((a, b) => a.simBalance - b.simBalance);
            else targets.sort((a, b) => (b.interestRate || 0) - (a.interestRate || 0));

            // Mandatory Minimums
            targets.forEach(d => {
                let pay = d.monthlyPayment;
                if ((d.normalizedStrategy === 'STEP_UP' || d.normalizedStrategy === 'STEPUP') && d.parsedStepUp.length > 0) {
                    const absMonth = d.monthsPassedStart + m + 1;
                    const range = d.parsedStepUp.find((r: any) => absMonth >= Number(r.startMonth) && absMonth <= Number(r.endMonth));
                    if (range) pay = Number(range.amount);
                }

                // Interest Calculation
                let interest = (d.simBalance * (d.interestRate || 0) / 100) / 12;
                if (d.normalizedStrategy === 'FLAT' || d.normalizedStrategy === 'FIXED') {
                     const orig = d.originalPrincipal || d.remainingPrincipal;
                     interest = (orig * (d.interestRate || 0) / 100) / 12;
                }

                let principal = pay - interest;
                
                if (principal > d.simBalance) {
                    extraPool += (principal - d.simBalance); 
                    principal = d.simBalance;
                }
                d.simBalance -= principal;
                if (d.simBalance <= 1000) { d.simBalance = 0; d.isPaid = true; }
            });

            // Extra Pool
            if (extraPool > 0) {
                const activeTargets = tempDebtsAcc.filter(d => !d.isPaid);
                if (strategy === 'snowball') activeTargets.sort((a, b) => a.simBalance - b.simBalance);
                else activeTargets.sort((a, b) => (b.interestRate || 0) - (a.interestRate || 0));

                for (const t of activeTargets) {
                    if (extraPool <= 0) break;
                    const pay = Math.min(extraPool, t.simBalance);
                    t.simBalance -= pay;
                    extraPool -= pay;
                    if (t.simBalance <= 1000) { t.simBalance = 0; t.isPaid = true; }
                }
            }

        } else {
            // MODE: CUTOFF
            accumulatedSavings += extraMonthlyPayment;
            const monthlyReturn = (investmentReturnRate / 100) / 12;
            accumulatedSavings += (accumulatedSavings * monthlyReturn);

            tempDebtsAcc.forEach(d => {
                if (d.isPaid) return;
                let pay = d.monthlyPayment;
                if ((d.normalizedStrategy === 'STEP_UP' || d.normalizedStrategy === 'STEPUP') && d.parsedStepUp.length > 0) {
                    const absMonth = d.monthsPassedStart + m + 1;
                    const range = d.parsedStepUp.find((r: any) => absMonth >= Number(r.startMonth) && absMonth <= Number(r.endMonth));
                    if (range) pay = Number(range.amount);
                }
                
                let interest = (d.simBalance * (d.interestRate || 0) / 100) / 12;
                if (d.normalizedStrategy === 'FLAT' || d.normalizedStrategy === 'FIXED') {
                     const orig = d.originalPrincipal || d.remainingPrincipal;
                     interest = (orig * (d.interestRate || 0) / 100) / 12;
                }

                let principal = pay - interest;
                if (principal > d.simBalance) principal = d.simBalance;
                d.simBalance -= principal;
                if (d.simBalance <= 1000) { d.simBalance = 0; d.isPaid = true; }
            });
        }
    }

    // 4. Align Data for Chart
    const maxLen = Math.max(standardSeries.length, acceleratedSeries.length);
    const resultData = [];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    for (let i = 0; i < maxLen; i++) {
        if (maxLen > 60 && i % 2 !== 0 && i !== maxLen - 1) continue;

        const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const monthLabel = `${months[date.getMonth()]} ${date.getFullYear()}`;
        
        resultData.push({
            month: monthLabel,
            Biasa: standardSeries[i] !== undefined ? standardSeries[i] : 0,
            Paydone: acceleratedSeries[i] !== undefined ? acceleratedSeries[i] : 0,
            ...(mode === 'cutoff' ? { Tabungan: savingsSeries[i] !== undefined ? savingsSeries[i] : 0 } : {}),
            index: i
        });
    }

    const monthsSaved = Math.max(0, standardSeries.length - acceleratedSeries.length);
    
    // Financial Calculation
    const estInterestRate = 0.12; 
    const totalInterestStd = totalPrincipal * estInterestRate * (standardSeries.length / 12);
    let moneySaved = 0;

    if (mode === 'lump_sum') {
        const totalInterestAcc = totalPrincipal * estInterestRate * (acceleratedSeries.length / 12);
        moneySaved = Math.max(0, totalInterestStd - totalInterestAcc);
    } else {
        const cutoffMonthIndex = acceleratedSeries.findIndex(v => v <= 0);
        const actualMonths = cutoffMonthIndex === -1 ? acceleratedSeries.length : cutoffMonthIndex;
        
        const totalInterestCutoffPath = totalPrincipal * estInterestRate * (actualMonths / 12);
        const investmentGains = (savingsSeries[actualMonths] || 0) - (extraMonthlyPayment * actualMonths);
        
        moneySaved = (totalInterestStd - totalInterestCutoffPath) + investmentGains;
    }

    return { 
        data: resultData, 
        monthsSaved, 
        moneySaved,
        finishDateStd: new Date(today.getFullYear(), today.getMonth() + standardSeries.length, 1),
        finishDateAcc: new Date(today.getFullYear(), today.getMonth() + acceleratedSeries.length, 1)
    };
};

export const generateCrossingAnalysis = (
    income: number,
    debts: DebtItem[],
    expenses: ExpenseItem[]
) => {
    const today = new Date();
    const LIMIT = 24; // 2 Years projection
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const data = [];
    
    // Living Cost (Non-Debt Allocations)
    const monthlyLivingCost = expenses.filter(e => e.category !== 'debt').reduce((a,b) => a + b.amount, 0);

    for (let i = 0; i <= LIMIT; i++) {
        const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const label = `${months[date.getMonth()]} ${date.getFullYear().toString().slice(-2)}`;
        
        let totalDebtPayment = 0;
        
        debts.forEach(d => {
            const startDate = new Date(d.startDate);
            const endDate = new Date(d.endDate);
            const currentSimDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
            
            if (currentSimDate >= startDate && currentSimDate <= endDate) {
                let pay = d.monthlyPayment;
                // Step Up Logic for Crossing
                const monthsSinceStart = getMonthDiff(startDate, currentSimDate) + 1;
                // Fix for TS overlap error: cast to string or normalize
                const strategy = (d.interestStrategy || '').toUpperCase();
                if ((strategy === 'STEPUP' || strategy === 'STEP_UP') && Array.isArray(d.stepUpSchedule)) {
                    const range = d.stepUpSchedule.find(r => monthsSinceStart >= Number(r.startMonth) && monthsSinceStart <= Number(r.endMonth));
                    if (range) pay = Number(range.amount);
                }
                totalDebtPayment += pay;
            }
        });

        const totalExpense = monthlyLivingCost + totalDebtPayment;
        const isDanger = totalExpense > income;

        data.push({
            name: label,
            Income: income,
            Debt: totalDebtPayment,
            TotalExpense: totalExpense,
            isDanger
        });
    }

    const dangerMonth = data.find(d => d.isDanger);
    return { data, dangerMonth };
};

export const runSimulation = (input: SimulationInput): SimulationResult => {
  const { assetPrice: assetPrice, downPaymentPercent: downPaymentPercent, interestRate: interestRate, tenorYears: tenorYears, loanType: loanType } = input;
  const rules = getConfig().systemRules;
  
  const downPayment = assetPrice * (downPaymentPercent / 100);
  const loanAmount = assetPrice - downPayment;
  const monthlyRate = interestRate / 100 / 12;
  const totalMonths = tenorYears * 12;
  const monthlyPayment = calculatePMT(monthlyRate, totalMonths, loanAmount);

  const provisionRate = (rules?.provisionRate || 1.0) / 100;
  const adminFee = loanType === LoanType.KPR ? (rules?.adminFeeKPR || 500000) : (rules?.adminFeeNonKPR || 250000);
  const insuranceRate = loanType === LoanType.KPR ? (rules?.insuranceRateKPR || 2.5) / 100 : (rules?.insuranceRateNonKPR || 1.5) / 100;
  const notaryFee = loanType === LoanType.KPR ? (rules?.notaryFeeKPR || 1.0) / 100 : (rules?.notaryFeeNonKPR || 0.5) / 100;

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

    schedule.push({ month: i, principal, interest, balance });
  }

  return {
    loanAmount,
    monthlyPayment,
    upfrontCosts: { downPayment, provision, adminFee, insurance, notary, totalUpfront },
    schedule
  };
};
