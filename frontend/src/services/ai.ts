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

// ─── Parse natural language expense via AI ─────────────────────────
export interface ExpenseAIResult {
  intent: string;
  data?: { title?: string; amount?: number; category?: string; notes?: string };
  message?: string;
}

const EXPENSE_SYSTEM_PROMPT = `You are an Indonesian transaction parser. The user types a SHORT phrase about a daily expense (e.g. "kopi pagi 25rb", "ojek pulang 15000", "belanja sayur 50rb"). Output STRICT JSON ONLY:
{"intent":"ADD_DAILY_EXPENSE"|"ERROR","data":{"title":"<short>","amount":<integer rupiah>,"category":"Food"|"Transport"|"Shopping"|"Utilities"|"Entertainment"|"Others"},"message":"<empty or error reason>"}
Rules: rb/ribu/k=thousand, jt/juta=million. If no amount, intent="ERROR". No markdown, no commentary.`;

export async function parseExpenseFromText(input: string): Promise<ExpenseAIResult> {
  try {
    const text = await callAI({
      prompt: input,
      systemInstruction: EXPENSE_SYSTEM_PROMPT,
      responseJson: true,
    });
    const cleaned = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return parsed as ExpenseAIResult;
  } catch (e: any) {
    if (e instanceof AILimitError) throw e;
    return localExpenseParser(input);
  }
}

export function localExpenseParser(input: string): ExpenseAIResult {
  const text = input.toLowerCase().trim();
  if (!text) return { intent: 'ERROR', message: 'Input kosong' };
  const numMatch = text.match(/(\d+[.,]?\d*)\s*(rb|ribu|jt|juta|k|m)?/i);
  if (!numMatch) return { intent: 'ERROR', message: 'Tidak ditemukan nominal' };
  const num = parseFloat(numMatch[1].replace(',', '.'));
  const unit = (numMatch[2] || '').toLowerCase();
  let amount = num;
  if (unit === 'rb' || unit === 'ribu' || unit === 'k') amount = num * 1000;
  else if (unit === 'jt' || unit === 'juta' || unit === 'm') amount = num * 1_000_000;
  if (!unit && amount < 100) amount = num * 1000;
  const title =
    input.replace(numMatch[0], '').trim().replace(/\s+/g, ' ').slice(0, 60) || 'Pengeluaran';
  let category = 'Others';
  if (/(kopi|makan|sarapan|nasi|sayur|gofood|grabfood|seblak|bakso|mie|warteg|warung|cafe|kafe|jajan|coffee|lunch|dinner)/.test(text)) category = 'Food';
  else if (/(ojek|gojek|grab|bensin|tol|parkir|busway|trans|kereta|krl|transport|uber|gocar|bbm|pertamina)/.test(text)) category = 'Transport';
  else if (/(beli|baju|elektronik|gadget|hp|sepatu|tas|belanja|mall|shopee|tokopedia|lazada)/.test(text)) category = 'Shopping';
  else if (/(listrik|wifi|pulsa|kuota|pln|bpjs|tagihan|air|pdam|gas|indihome|telkomsel)/.test(text)) category = 'Utilities';
  else if (/(nonton|bioskop|game|netflix|spotify|disney|wisata|liburan|hiburan|hobi|movie)/.test(text)) category = 'Entertainment';
  return {
    intent: 'ADD_DAILY_EXPENSE',
    data: { title, amount: Math.round(amount), category },
  };
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
