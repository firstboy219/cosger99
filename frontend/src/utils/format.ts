// src/utils/format.ts
export const formatCurrency = (n: number | string | undefined | null): string => {
  const num = Number(n) || 0;
  if (num >= 1_000_000_000) return `Rp ${(num / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (num >= 1_000_000) return `Rp ${(num / 1_000_000).toFixed(1).replace(/\.0$/, '')}jt`;
  if (num >= 1_000) return `Rp ${(num / 1_000).toFixed(0)}rb`;
  return `Rp ${num.toLocaleString('id-ID')}`;
};

export const formatCurrencyFull = (n: number | string | undefined | null): string => {
  const num = Number(n) || 0;
  return `Rp ${num.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`;
};

export const parseNumeric = (s: string): number => {
  const cleaned = String(s).replace(/[^\d]/g, '');
  return Number(cleaned) || 0;
};

export const formatNumberInput = (s: string | number): string => {
  const num = parseNumeric(String(s));
  return num.toLocaleString('id-ID');
};

export const formatDate = (iso?: string): string => {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '-';
  }
};

export const monthKey = (d: Date = new Date()): string => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
