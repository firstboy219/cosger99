
import { LoanType, SimulationInput, SimulationResult, DebtItem, DailyExpense, ExpenseItem, DebtInstallment } from '../types';
import { getConfig } from './mockDb';

// --- ROBUST DATE HELPER (Anti-Crash & Timezone Fix) ---

/**
 * Returns YYYY-MM-DD string in the User's LOCAL Timezone.
 * This prevents the "Date-1" bug caused by toISOString() which uses UTC.
 */
export const toLocalISOString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const safeDateISO = (input?: string | Date | null): string => {
    if (!input) return toLocalISOString(new Date());
    
    try {
        if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
            return input;
        }
        const d = new Date(input);
        if (isNaN(d.getTime())) {
            return toLocalISOString(new Date());
        }
        // Fix: Use local components for string input parsing too if it was a full ISO string
        return toLocalISOString(d);
    } catch (e) {
        return toLocalISOString(new Date());
    }
};

export const calculatePMT = (rate: number, nper: number, pv: number): number => {
  if (rate === 0) return pv / nper;
  // Safety check for crazy inputs
  if (nper <= 0 || pv <= 0) return 0;
  
  const pvif = Math.pow(1 + rate, nper);
  const pmt = (rate * pv * pvif) / (pvif - 1);
  return isFinite(pmt) ? pmt : 0;
};

export const formatCurrency = (amount: number | string): string => {
  // SAFETY NET: Always coerce to Number first to handle string values from DB
  const numAmount = typeof amount === 'string' ? Number(amount.replace(/[^0-9.\-]+/g, '')) : Number(amount);
  const safeAmount = isNaN(numAmount) || !isFinite(numAmount) ? 0 : numAmount;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(safeAmount);
};

export const getMonthDiff = (d1: Date, d2: Date): number => {
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
  let months;
  months = (d2.getFullYear() - d1.getFullYear()) * 12;
  months -= d1.getMonth();
  months += d2.getMonth();
  return months <= 0 ? 0 : months;
};

export const getCurrentInstallment = (debt: DebtItem): number => {
    let strategy = (debt.interestStrategy || 'FIXED').toUpperCase();
    if (strategy === 'STEP_UP') strategy = 'STEPUP';

    // --- Calculate months passed from startDate to this month ---
    const start = debt.startDate ? new Date(debt.startDate) : null;
    const today = new Date();
    const monthsPassed = start && !isNaN(start.getTime())
        ? (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth()) + 1
        : 1;

    // --- For STEPUP: look up current period in schedule (with full key normalization) ---
    if (strategy === 'STEPUP' && debt.stepUpSchedule) {
        let scheduleRaw: any[] = [];
        if (Array.isArray(debt.stepUpSchedule)) {
            scheduleRaw = debt.stepUpSchedule;
        } else if (typeof debt.stepUpSchedule === 'string') {
            try { scheduleRaw = JSON.parse(debt.stepUpSchedule); } catch(e) {}
        }
        // Normalize ALL possible key formats (same as generateInstallmentsForDebt)
        const schedule = scheduleRaw.map((r: any) => ({
            startMonth: Number(r.startMonth ?? r.start_month ?? r.mulai ?? 0),
            endMonth:   Number(r.endMonth   ?? r.end_month   ?? r.akhir ?? r.endMonth ?? 0),
            amount:     Number(r.amount     ?? r.cicilan     ?? r.payment ?? 0),
        }));
        const currentPeriod = schedule.find(s => monthsPassed >= s.startMonth && monthsPassed <= s.endMonth);
        if (currentPeriod) return currentPeriod.amount;
        // Fallback: last period if beyond schedule, first period if before
        if (schedule.length > 0) {
            if (monthsPassed > schedule[schedule.length - 1].endMonth) return schedule[schedule.length - 1].amount;
            return schedule[0].amount;
        }
        return Number(debt.monthlyPayment || 0);
    }

    // --- For ANNUITY/EFEKTIF: compute real installment from remaining principal ---
    if ((strategy === 'ANNUITY' || strategy === 'EFEKTIF') && debt.interestRate && debt.remainingMonths) {
        const annualRate = Number(debt.interestRate || 0);
        const monthlyRate = (annualRate / 100) / 12;
        const remaining = Number(debt.remainingMonths || 1);
        const principal = Number(debt.remainingPrincipal || debt.originalPrincipal || 0);
        if (monthlyRate > 0 && remaining > 0 && principal > 0) {
            // PMT formula for annuity
            const pmt = principal * (monthlyRate * Math.pow(1 + monthlyRate, remaining)) / (Math.pow(1 + monthlyRate, remaining) - 1);
            if (isFinite(pmt) && pmt > 0) return Math.round(pmt);
        }
    }

    // --- Default: use stored monthlyPayment ---
    return Number(debt.monthlyPayment || 0);
};

// --- IMPROVED INSTALLMENT GENERATOR (SMART HISTORY & STRATEGIES) ---
export const generateInstallmentsForDebt = (
    debt: DebtItem, 
    existingInstallments: DebtInstallment[] = [],
    autoPayHistory: boolean = false
): DebtInstallment[] => {
    const newInstallments: DebtInstallment[] = [];
    const todayStr = toLocalISOString(new Date());
    
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
    
    // QA FIX: Normalize strategy string (handle backend snake_case vs frontend CamelCase)
    let strategy = (debt.interestStrategy || 'Fixed').toUpperCase();
    if (strategy === 'STEP_UP') strategy = 'STEPUP';

    const annualRate = Number(debt.interestRate || 0);
    const monthlyRate = (annualRate / 100) / 12;

    // --- PREPARE DATA FOR STEP UP ---
    // CRITICAL FIX: Normalize keys from ANY format (camelCase, snake_case, Indonesian)
    // Backend may return: { startMonth, endMonth, amount } OR { mulai, akhir, cicilan } OR { start_month, end_month, amount }
    let stepUpScheduleRaw: any[] = [];
    if (Array.isArray(debt.stepUpSchedule)) {
        stepUpScheduleRaw = debt.stepUpSchedule;
    } else if (typeof debt.stepUpSchedule === 'string') {
        try { stepUpScheduleRaw = JSON.parse(debt.stepUpSchedule); } catch(e) { console.error("StepUp Parse Error", e); }
    }
    // Normalize every entry to CONSISTENT keys { startMonth, endMonth, amount }
    // This fixes the property-name mismatch that caused .find() to always return undefined
    const stepUpSchedule = stepUpScheduleRaw.map((r: any) => ({
        startMonth: Number(r.startMonth ?? r.start_month ?? r.mulai ?? 0),
        endMonth: Number(r.endMonth ?? r.end_month ?? r.akhir ?? 0),
        amount: Number(r.amount ?? r.cicilan ?? 0)
    }));

    // --- CALCULATE ANNUITY FIXED PAYMENT (If needed) ---
    // PMT Formula: P * (r(1+r)^n) / ((1+r)^n - 1)
    const annuityPayment = calculatePMT(monthlyRate, totalMonths, originalPrincipal);

    // STEPUP FIX: extend totalMonths if the step-up schedule has periods beyond the computed tenor.
    // E.g. period 95-95 adjustment row on a 94-month loan must still be generated.
    if (strategy === 'STEPUP' && stepUpSchedule.length > 0) {
        const maxStepMonth = Math.max(...stepUpSchedule.map(r => r.endMonth));
        if (maxStepMonth > totalMonths) totalMonths = maxStepMonth;
    }

    for (let i = 1; i <= totalMonths; i++) {
        let monthlyAmount = 0;
        let principalPart = 0;
        let interestPart = 0;

        // --- STRATEGY SWITCH ---
        if (strategy === 'FIXED' || strategy === 'FLAT') {
            // FLAT RATE: Bunga dihitung dari POKOK AWAL
            interestPart = originalPrincipal * monthlyRate;
            principalPart = (originalPrincipal / totalMonths);
            monthlyAmount = principalPart + interestPart;
        } 
        else if (strategy === 'ANNUITY' || strategy === 'EFEKTIF') {
            // ANNUITY / EFEKTIF: Bunga dihitung dari SISA POKOK
            const safeBalance = Math.max(0, currentBalance);
            monthlyAmount = annuityPayment;
            interestPart = safeBalance * monthlyRate;
            principalPart = monthlyAmount - interestPart;
        } 
        else if (strategy === 'STEPUP') {
            // STEP UP: User defines Payment Amount per Period Range.
            //
            // CRITICAL FIX: Indonesian KPR Step-Up loans use FLAT rate interest calculation.
            // Interest is computed on originalPrincipal (FIXED every month), NOT on remaining balance.
            //
            // Using EFFECTIVE rate (safeBalance × monthlyRate) caused the balance to shrink TOO FAST
            // because effective interest grows smaller as balance decreases → more principal paid →
            // balance hits 0 at e.g. period 87 instead of period 94 → periods 88-94 show Rp 0.
            //
            // With FLAT rate: interest = originalPrincipal × monthlyRate (CONSTANT),
            // principal = cicilan - constant_interest, balance reduces at the rate the bank expects.
            
            // Resolve cicilan amount for this period
            const activeRange = stepUpSchedule.find(range => i >= range.startMonth && i <= range.endMonth);
            if (activeRange) {
                monthlyAmount = activeRange.amount;
            } else {
                const priorRanges = stepUpSchedule.filter(r => r.endMonth < i);
                const lastPrior = priorRanges.length > 0
                    ? priorRanges.reduce((a, b) => (b.endMonth > a.endMonth ? b : a))
                    : null;
                const futureRanges = stepUpSchedule.filter(r => r.startMonth > i);
                const firstFuture = futureRanges.length > 0
                    ? futureRanges.reduce((a, b) => (b.startMonth < a.startMonth ? b : a))
                    : null;
                if (lastPrior) {
                    monthlyAmount = lastPrior.amount;
                } else if (firstFuture) {
                    monthlyAmount = firstFuture.amount;
                } else {
                    monthlyAmount = Number(debt.monthlyPayment || 0);
                }
            }

            // FLAT rate: interest always = originalPrincipal × monthlyRate (constant)
            interestPart = originalPrincipal * monthlyRate;
            principalPart = Math.max(0, monthlyAmount - interestPart);
        }

        // --- SAFETY CHECKS ---
        // Prevent principal part from exceeding remaining balance (natural end-of-loan)
        if (principalPart > currentBalance) {
            principalPart = currentBalance;
            if (strategy === 'ANNUITY' || strategy === 'FIXED' || strategy === 'FLAT') {
                // Recalculate final payment as exact remaining balance + final interest
                monthlyAmount = principalPart + interestPart;
            }
            // STEPUP: do NOT override monthlyAmount — the cicilan table amount is authoritative.
            // The bank's step schedule already encodes the correct final payment.
            // We only trim principalPart to avoid negative balance.
        }

        // CRITICAL FIX: Set day to 1 BEFORE calling setMonth() to prevent day-overflow.
        // Bug: new Date("2024-05-29"), setMonth(25) → Feb 2026, day 29 → Feb has 28 days
        //      → JS overflows to Mar 1, 2026 → setDate(26) → Mar 26 (wrong month!)
        //      Period 21 = Mar 26 AND period 22 = Mar 26 (duplicate), Feb skipped entirely.
        // Fix: anchor to day 1 first, then add months safely, then set target day.
        const dueDateObj = new Date(start.getFullYear(), start.getMonth() + i, 1);
        
        const targetDay = debt.dueDate || 1;
        const maxDayInMonth = new Date(dueDateObj.getFullYear(), dueDateObj.getMonth() + 1, 0).getDate();
        dueDateObj.setDate(Math.min(targetDay, maxDayInMonth));
        
        const dueDateStr = safeDateISO(dueDateObj);

        // Check for existing manual record
        const existingRecord = existingInstallments.find(e => e.period === i);
        
        if (existingRecord) {
            // If using existing record, we must still respect the theoretical principal reduction
            // to keep the schedule projection consistent for future months.
            newInstallments.push(existingRecord);
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
        
        // Final Safety Clamp
        if (currentBalance < 0) currentBalance = 0;
    }

    return newInstallments;
};

// ... (Rest of file exports remain unchanged: generateGlobalProjection, generateCrossingAnalysis, runSimulation)
export const generateGlobalProjection = (
    debts: DebtItem[],
    extraMonthlyPayment: number = 0,
    strategy: 'snowball' | 'avalanche' = 'avalanche',
    mode: 'lump_sum' | 'cutoff' = 'lump_sum', 
    investmentReturnRate: number = 4.0 
) => {
    const today = new Date();
    
    // 1. Filter Valid Debts & Pre-calc details
    const activeDebts = debts.filter(d => d.remainingPrincipal > 1000 && !d._deleted).map(d => {
        let parsedStepUp: any[] = [];
        let strategyStr = (d.interestStrategy || 'FIXED').toUpperCase();
        if (strategyStr === 'STEP_UP') strategyStr = 'STEPUP';

        if (strategyStr === 'STEPUP') {
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
            simBalance: Number(d.remainingPrincipal),
            startBalance: Number(d.remainingPrincipal),
            monthsPassedStart,
            parsedStepUp,
            normalizedStrategy: strategyStr,
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

            let pay = Number(d.monthlyPayment || 0);

            // Determine payment amount from strategy
            if (d.normalizedStrategy === 'STEPUP' && d.parsedStepUp.length > 0) {
                const absMonth = d.monthsPassedStart + m + 1;
                const range = d.parsedStepUp.find((r: any) => absMonth >= Number(r.startMonth) && absMonth <= Number(r.endMonth));
                if (range) {
                    pay = Number(range.amount);
                } else {
                    // Past end of schedule: use last step's amount (not default monthlyPayment)
                    const sorted = [...d.parsedStepUp].sort((a: any, b: any) => Number(b.endMonth) - Number(a.endMonth));
                    if (sorted.length > 0) pay = Number(sorted[0].amount);
                }
            }

            // Compute interest based on strategy
            const orig = (d.originalPrincipal || d.startBalance);
            let interest: number;
            if (d.normalizedStrategy === 'FLAT' || d.normalizedStrategy === 'FIXED' || d.normalizedStrategy === 'STEPUP') {
                // FLAT rate: interest = original principal × monthly rate (constant)
                interest = (orig * (d.interestRate || 0) / 100) / 12;
            } else {
                // ANNUITY / effective rate
                interest = (d.simBalance * (d.interestRate || 0) / 100) / 12;
            }

            let principal = pay - interest;
            if (principal <= 0) principal = 0; // Safety: never let balance grow
            if (principal > d.simBalance) principal = d.simBalance;

            d.simBalance -= principal;
            if (d.simBalance <= 1000) { d.simBalance = 0; d.isPaid = true; }
        });
    }

    // 3. Simulate Paydone Path
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
                let pay = Number(d.monthlyPayment || 0);
                if ((d.normalizedStrategy === 'STEPUP') && d.parsedStepUp.length > 0) {
                    const absMonth = d.monthsPassedStart + m + 1;
                    const range = d.parsedStepUp.find((r: any) => absMonth >= Number(r.startMonth) && absMonth <= Number(r.endMonth));
                    if (range) {
                        pay = Number(range.amount);
                    } else {
                        const sorted = [...d.parsedStepUp].sort((a: any, b: any) => Number(b.endMonth) - Number(a.endMonth));
                        if (sorted.length > 0) pay = Number(sorted[0].amount);
                    }
                }

                const orig = (d.originalPrincipal || d.startBalance);
                let interest: number;
                if (d.normalizedStrategy === 'FLAT' || d.normalizedStrategy === 'FIXED' || d.normalizedStrategy === 'STEPUP') {
                    interest = (orig * (d.interestRate || 0) / 100) / 12;
                } else {
                    interest = (d.simBalance * (d.interestRate || 0) / 100) / 12;
                }

                let principal = pay - interest;
                if (principal <= 0) principal = 0; // Safety: never grow balance
                
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
                let pay = Number(d.monthlyPayment || 0);
                if ((d.normalizedStrategy === 'STEPUP') && d.parsedStepUp.length > 0) {
                    const absMonth = d.monthsPassedStart + m + 1;
                    const range = d.parsedStepUp.find((r: any) => absMonth >= Number(r.startMonth) && absMonth <= Number(r.endMonth));
                    if (range) {
                        pay = Number(range.amount);
                    } else {
                        const sorted = [...d.parsedStepUp].sort((a: any, b: any) => Number(b.endMonth) - Number(a.endMonth));
                        if (sorted.length > 0) pay = Number(sorted[0].amount);
                    }
                }

                const orig = (d.originalPrincipal || d.startBalance);
                let interest: number;
                if (d.normalizedStrategy === 'FLAT' || d.normalizedStrategy === 'FIXED' || d.normalizedStrategy === 'STEPUP') {
                    interest = (orig * (d.interestRate || 0) / 100) / 12;
                } else {
                    interest = (d.simBalance * (d.interestRate || 0) / 100) / 12;
                }

                let principal = pay - interest;
                if (principal <= 0) principal = 0; // Safety: never grow balance
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
    expenses: ExpenseItem[],
    debtInstallments: DebtInstallment[] = []
) => {
    const today = new Date();

    // ─── STEP 1: Build authoritative installment schedule from debt data ───────
    // ALWAYS regenerate from debt amortization formulas for projection accuracy.
    // Stored debtInstallments may have stale/incorrect amounts (e.g. remaining balance
    // stored instead of monthly cicilan). Freshly-computed installments guarantee
    // "Porsi Hutang" = actual monthly cicilan total, not outstanding balance.
    const activeDebts = debts.filter(d => !d._deleted && d.startDate && d.endDate);

    // Build full schedule by regenerating for each debt, merging status from stored records
    let effectiveInstallments: DebtInstallment[] = [];
    activeDebts.forEach(debt => {
        // Pass stored installments so paid/overdue status is preserved on existing records
        const stored = debtInstallments.filter(inst => inst.debtId === debt.id);
        const generated = generateInstallmentsForDebt(debt, stored, false);
        effectiveInstallments = effectiveInstallments.concat(generated);
    });

    // ─── STEP 2: Calculate LIMIT from the furthest debt end date ─────────────
    let LIMIT = 24;
    if (activeDebts.length > 0) {
        const latestEndDate = activeDebts.reduce((latest, d) => {
            const endDate = new Date(d.endDate);
            return endDate > latest ? endDate : latest;
        }, new Date(0));
        const monthsToEnd = (latestEndDate.getFullYear() - today.getFullYear()) * 12 + (latestEndDate.getMonth() - today.getMonth());
        LIMIT = Math.max(6, Math.min(monthsToEnd, 360));
    }

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const data = [];

    // ─── STEP 3: Monthly living cost = ALL allocation items (needs + wants) ──
    // Debt-category allocations (pos hutang) are EXCLUDED because cicilan is already
    // tracked separately in totalDebtPayment — prevents double-counting.
    const monthlyLivingCost = expenses.filter(e => e.category !== 'debt')
        .reduce((a, b) => a + Number(b.amount || 0), 0);

    for (let i = 0; i <= LIMIT; i++) {
        const simDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const label = `${months[simDate.getMonth()]} ${simDate.getFullYear().toString().slice(-2)}`;
        const simYearMonth = `${simDate.getFullYear()}-${String(simDate.getMonth() + 1).padStart(2, '0')}`;

        // ─── STEP 4: Total cicilan = sum of all installment amounts for this month ──
        // Uses actual inst.amount (monthly cicilan) — NOT remainingBalance or totalLiability.
        // Filter handles both "2026-03-15" and "2026-03-15T00:00:00.000Z" formats.
        const monthInstallments = effectiveInstallments.filter(inst => {
            const d = (inst.dueDate || '').substring(0, 7); // Always "YYYY-MM"
            return d === simYearMonth;
        });

        const totalDebtPayment = monthInstallments.length > 0
            ? monthInstallments.reduce((sum, inst) => sum + Number(inst.amount || 0), 0)
            : 0;

        // ─── STEP 5: TotalExpense = living cost (allocations) + cicilan hutang ──
        const totalExpense = Number(monthlyLivingCost) + Number(totalDebtPayment);
        const isDanger = totalExpense > Number(income || 0);

        data.push({
            name: label,
            Income: Number(income || 0),
            Debt: Number(totalDebtPayment),           // Monthly cicilan total
            TotalExpense: Number(totalExpense),        // Cicilan + allocation (needs/wants)
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
