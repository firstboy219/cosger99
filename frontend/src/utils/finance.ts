// src/utils/finance.ts
// Lightweight port of the web app's financeUtils.ts — only what mobile needs.

export type InterestStrategy = 'Fixed' | 'StepUp' | 'Annuity';

export interface StepUpRange {
  startMonth: number;
  endMonth: number;
  amount: number;
}

export interface DebtLite {
  id: string;
  name?: string;
  type?: string;
  bankName?: string;
  originalPrincipal?: number;
  remainingPrincipal?: number;
  totalLiability?: number;
  monthlyPayment?: number;
  interestRate?: number;
  remainingMonths?: number;
  startDate?: string;
  endDate?: string;
  interestStrategy?: InterestStrategy | string;
  stepUpSchedule?: StepUpRange[] | string;
  payoffMethod?: 'direct_extra' | 'sinking_fund';
  allocatedExtraBudget?: number;
  _deleted?: boolean;
}

export interface ExpenseLite {
  id?: string;
  category?: string;
  amount?: number;
  _deleted?: boolean;
}

const monthsBetween = (a: Date, b: Date) =>
  (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());

const parseSchedule = (raw: any): StepUpRange[] => {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return [];
};

// Get current cicilan amount for a debt, accounting for StepUp scheme.
export const getCurrentInstallment = (debt: DebtLite): number => {
  let strategy = (debt.interestStrategy || 'Fixed').toString();
  // Normalize aliases
  if (strategy.toUpperCase() === 'STEP_UP' || strategy.toUpperCase() === 'STEPUP') {
    strategy = 'StepUp';
  }
  if (strategy === 'StepUp' && debt.stepUpSchedule) {
    const schedule = parseSchedule(debt.stepUpSchedule);
    const start = debt.startDate ? new Date(debt.startDate) : new Date();
    const today = new Date();
    const monthsPassed =
      Number.isFinite(start.getTime()) ? Math.max(1, monthsBetween(start, today) + 1) : 1;
    const range = schedule.find(
      (r) =>
        monthsPassed >= Number(r.startMonth) && monthsPassed <= Number(r.endMonth)
    );
    if (range) return Number(range.amount);
    if (schedule.length > 0) {
      // fall back to last range if past, first if before
      if (monthsPassed > schedule[schedule.length - 1].endMonth)
        return Number(schedule[schedule.length - 1].amount);
      return Number(schedule[0].amount);
    }
  }
  if (strategy === 'Annuity' && debt.interestRate && debt.remainingMonths) {
    const monthlyRate = (Number(debt.interestRate) || 0) / 100 / 12;
    const remaining = Number(debt.remainingMonths);
    const principal = Number(debt.remainingPrincipal || debt.originalPrincipal || 0);
    if (monthlyRate > 0 && remaining > 0 && principal > 0) {
      const pmt =
        (principal * (monthlyRate * Math.pow(1 + monthlyRate, remaining))) /
        (Math.pow(1 + monthlyRate, remaining) - 1);
      if (Number.isFinite(pmt) && pmt > 0) return Math.round(pmt);
    }
  }
  return Number(debt.monthlyPayment || 0);
};

// ─── Simulate payoff: returns months until each debt is paid + overall ─
export interface PayoffSimResult {
  perDebt: { id: string; finishedMonth: number; finishDate: Date }[];
  totalMonths: number;
  totalInterestPaid: number;
  freedomDate: Date;
}

const LIMIT = 600;

export const simulatePayoff = (
  debtsRaw: DebtLite[],
  extraMonthlyPayment: number = 0,
  strategy: 'snowball' | 'avalanche' = 'avalanche'
): PayoffSimResult => {
  const today = new Date();
  const debts = debtsRaw
    .filter((d) => !d._deleted && Number(d.remainingPrincipal || d.totalLiability || 0) > 1000)
    .map((d) => {
      let s = (d.interestStrategy || 'Fixed').toString();
      if (s.toUpperCase() === 'STEP_UP' || s.toUpperCase() === 'STEPUP') s = 'StepUp';
      const start = d.startDate ? new Date(d.startDate) : today;
      return {
        ...d,
        normalizedStrategy: s as InterestStrategy,
        parsedSchedule: parseSchedule(d.stepUpSchedule),
        simBalance: Number(d.remainingPrincipal || d.totalLiability || 0),
        isPaid: false,
        finishedMonth: -1,
        monthsPassedAtStart: monthsBetween(start, today),
      };
    });

  let totalInterest = 0;

  for (let m = 0; m < LIMIT; m++) {
    const allDone = debts.every((d) => d.isPaid);
    if (allDone) break;

    let extraPool = extraMonthlyPayment;

    // Mandatory minimums
    debts.forEach((d) => {
      if (d.isPaid) return;
      let pay = Number(d.monthlyPayment || 0);
      if (d.normalizedStrategy === 'StepUp' && d.parsedSchedule.length > 0) {
        const absMonth = d.monthsPassedAtStart + m + 1;
        const range = d.parsedSchedule.find(
          (r: any) => absMonth >= Number(r.startMonth) && absMonth <= Number(r.endMonth)
        );
        if (range) pay = Number(range.amount);
        else {
          const sorted = [...d.parsedSchedule].sort(
            (a: any, b: any) => Number(b.endMonth) - Number(a.endMonth)
          );
          if (sorted.length > 0) pay = Number(sorted[0].amount);
        }
      }
      let principal: number;
      if (d.normalizedStrategy === 'Fixed' || d.normalizedStrategy === 'StepUp') {
        const initialMonths = Number(d.remainingMonths) > 0 ? Number(d.remainingMonths) : 1;
        const monthsLeft = Math.max(1, initialMonths - m);
        principal = Math.min(d.simBalance / monthsLeft, d.simBalance);
      } else {
        // Annuity
        const interest = (d.simBalance * Number(d.interestRate || 0)) / 100 / 12;
        totalInterest += interest;
        principal = pay - interest;
        if (principal <= 0) principal = 0;
        if (principal > d.simBalance) principal = d.simBalance;
      }
      if (principal > d.simBalance) {
        extraPool += principal - d.simBalance;
        principal = d.simBalance;
      }
      d.simBalance -= principal;
      if (d.simBalance <= 1000) {
        d.simBalance = 0;
        d.isPaid = true;
        d.finishedMonth = m + 1;
      }
    });

    // Apply extra pool by chosen strategy
    if (extraPool > 0) {
      const targets = debts.filter((d) => !d.isPaid);
      if (strategy === 'snowball') {
        targets.sort((a, b) => a.simBalance - b.simBalance);
      } else {
        targets.sort(
          (a, b) => Number(b.interestRate || 0) - Number(a.interestRate || 0)
        );
      }
      for (const t of targets) {
        if (extraPool <= 0) break;
        const pay = Math.min(extraPool, t.simBalance);
        t.simBalance -= pay;
        extraPool -= pay;
        if (t.simBalance <= 1000) {
          t.simBalance = 0;
          t.isPaid = true;
          t.finishedMonth = m + 1;
        }
      }
    }
  }

  const lastFinishedMonth = debts.reduce(
    (max, d) => (d.finishedMonth > max ? d.finishedMonth : max),
    0
  );
  const freedomDate = new Date(today.getFullYear(), today.getMonth() + lastFinishedMonth, 1);

  return {
    perDebt: debts.map((d) => ({
      id: d.id,
      finishedMonth: d.finishedMonth > 0 ? d.finishedMonth : LIMIT,
      finishDate: new Date(today.getFullYear(), today.getMonth() + d.finishedMonth, 1),
    })),
    totalMonths: lastFinishedMonth,
    totalInterestPaid: totalInterest,
    freedomDate,
  };
};

// ─── Crossing analysis: monthly Income vs (cicilan + living cost) ─────
export interface CrossingPoint {
  label: string;
  date: Date;
  income: number;
  debtPayment: number;
  totalExpense: number;
  isDanger: boolean;
}

export const generateCrossingAnalysis = (
  monthlyIncome: number,
  debts: DebtLite[],
  monthlyLivingCost: number,
  horizonMonths: number = 36
): { data: CrossingPoint[]; dangerMonth: CrossingPoint | null } => {
  const today = new Date();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const data: CrossingPoint[] = [];

  for (let i = 0; i <= horizonMonths; i++) {
    const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const label = `${months[date.getMonth()]} ${String(date.getFullYear()).slice(-2)}`;
    let debtPayment = 0;
    debts.forEach((d) => {
      if (d._deleted) return;
      const start = d.startDate ? new Date(d.startDate) : today;
      const end = d.endDate ? new Date(d.endDate) : today;
      if (date < start || date > end) return;
      const absMonth = monthsBetween(start, date) + 1;
      let pay = Number(d.monthlyPayment || 0);
      const strat = (d.interestStrategy || 'Fixed').toString();
      if (
        (strat === 'StepUp' || strat.toUpperCase() === 'STEPUP' || strat.toUpperCase() === 'STEP_UP') &&
        d.stepUpSchedule
      ) {
        const sched = parseSchedule(d.stepUpSchedule);
        const r = sched.find(
          (s) => absMonth >= Number(s.startMonth) && absMonth <= Number(s.endMonth)
        );
        if (r) pay = Number(r.amount);
      }
      debtPayment += pay;
    });
    const totalExpense = monthlyLivingCost + debtPayment;
    data.push({
      label,
      date,
      income: monthlyIncome,
      debtPayment,
      totalExpense,
      isDanger: totalExpense > monthlyIncome && monthlyIncome > 0,
    });
  }
  return { data, dangerMonth: data.find((d) => d.isDanger) || null };
};
