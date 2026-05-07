// src/services/ai.ts
// AI integration with Paydone backend (api.cosger.com /api/ai/analyze)
// Falls back to local heuristic insights when AI quota is exhausted (402).

import { API_BASE_URL, storage } from './api';

export class AILimitError extends Error {
  constructor(msg?: string) {
    super(msg || 'Kuota AI habis. Upgrade paket untuk lanjut.');
    this.name = 'AILimitError';
  }
}

export type AICallPayload = {
  prompt: string;
  systemInstruction?: string;
  model?: string;
  responseJson?: boolean;
};

export async function callAI(payload: AICallPayload): Promise<string> {
  const token = (await storage.getToken()) || '';
  const userId = (await storage.getUserId()) || '';
  const res = await fetch(`${API_BASE_URL}/api/ai/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
      'x-session-token': token,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model: payload.model || 'gemini-1.5-flash',
      ...payload,
    }),
  });
  if (res.status === 402 || res.status === 403) {
    throw new AILimitError();
  }
  if (!res.ok) {
    throw new Error(`AI error ${res.status}`);
  }
  const data = await res.json();
  return data.result || data.text || '';
}

// ─── Local fallback heuristic ───────────────────────────────────────
export function localInsight(metrics: {
  dsr: number;
  totalDebt: number;
  totalIncome: number;
  monthlyObligation: number;
  emergencyFund?: number;
  debtCount: number;
}): { headline: string; body: string; tone: 'good' | 'warning' | 'danger' } {
  const { dsr, totalIncome, monthlyObligation, debtCount } = metrics;
  if (totalIncome === 0 && debtCount > 0) {
    return {
      headline: 'Catat penghasilan rutin dulu',
      body: 'Tanpa data pemasukan, sulit hitung DSR & strategi pelunasan. Tambah penghasilan bulananmu untuk insight akurat.',
      tone: 'warning',
    };
  }
  if (dsr > 50) {
    return {
      headline: `DSR ${dsr.toFixed(0)}% — kritis ⚠️`,
      body: `Cicilan Rp ${(monthlyObligation / 1_000_000).toFixed(1)}jt menyedot >50% pemasukan. Prioritaskan negosiasi restrukturisasi atau lunasi hutang konsumtif tertinggi dulu.`,
      tone: 'danger',
    };
  }
  if (dsr > 35) {
    return {
      headline: `DSR ${dsr.toFixed(0)}% — di atas batas aman`,
      body: 'Idealnya DSR ≤ 35%. Pertimbangkan extra payment ke hutang dengan bunga tertinggi (avalanche method) untuk mempercepat pelunasan.',
      tone: 'warning',
    };
  }
  if (dsr > 20) {
    return {
      headline: `DSR ${dsr.toFixed(0)}% — masih sehat`,
      body: 'Cashflow oke. Sisihkan 20% pemasukan untuk dana darurat sebelum agresif lunasi hutang. Konsisten = bebas finansial.',
      tone: 'good',
    };
  }
  if (debtCount === 0) {
    return {
      headline: 'Hebat! Bebas hutang 🎉',
      body: 'Saatnya alokasikan dana ke investasi jangka panjang & dana pensiun. Mulai dengan target 10–20% pemasukan/bulan.',
      tone: 'good',
    };
  }
  return {
    headline: `DSR ${dsr.toFixed(0)}% — prima 💚`,
    body: `Beban cicilan kecil. Pertimbangkan investasi reksadana / saham agar uangmu bekerja sambil hutang dilunasi terjadwal.`,
    tone: 'good',
  };
}
