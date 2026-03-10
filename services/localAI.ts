/**
 * LOCAL AI ENGINE — Cosger Semi AI
 * No external API. Matches user input against admin-configured knowledge base rules.
 */

import { getConfig , getApiBaseUrl } from './mockDb';

// ─── TYPES ───────────────────────────────────────────────────────────────────

export type AIActionType =
  | 'ADD_EXPENSE'
  | 'ADD_INCOME'
  | 'ADD_TASK'
  | 'CHECK_HEALTH'
  | 'SHOW_DEBTS'
  | 'UNKNOWN';

export interface AIKnowledgeRule {
  id: string;
  label: string;          // e.g. "Catat Pengeluaran"
  action: AIActionType;
  triggers: string[];     // keywords/phrases that trigger this rule
  example: string;        // e.g. "catat makan 25rb"
  defaultFields: Record<string, any>; // pre-filled values
  description: string;    // shown in admin
  priority: number;       // higher = checked first
  isActive: boolean;
}

export interface AIMatchResult {
  rule: AIKnowledgeRule;
  score: number;
  parsedFields: Record<string, any>;
  confidence: 'high' | 'medium' | 'low';
}

export interface AIParseResult {
  status: 'match' | 'ambiguous' | 'unknown';
  matches: AIMatchResult[];    // top N matches
  rawInput: string;
}

// ─── DEFAULT BUILT-IN RULES (fallback if admin hasn't configured anything) ──

export const DEFAULT_RULES: AIKnowledgeRule[] = [
  {
    id: 'builtin_allocation',
    label: 'Alokasi Budget (Pos Anggaran)',
    action: 'ADD_ALLOCATION',
    triggers: ['alokasi', 'alokasikan', 'anggarkan', 'anggaran', 'pos budget', 'pos anggaran', 'budget untuk', 'sisihkan', 'bujet'],
    example: 'alokasikan 700rb untuk makan bulan ini',
    defaultFields: { category: 'needs' },
    description: 'Menambahkan atau mengatur pos anggaran bulanan',
    priority: 11,
    isActive: true,
  },
  {
    id: 'builtin_expense',
    label: 'Catat Pengeluaran',
    action: 'ADD_EXPENSE',
    triggers: ['catat', 'belanja', 'beli', 'bayar', 'makan', 'jajan', 'pengeluaran', 'keluar', 'habis', 'bayar', 'expense', 'spend', 'spent'],
    example: 'catat makan 25rb',
    defaultFields: { category: 'Food' },
    description: 'Mencatat pengeluaran harian',
    priority: 10,
    isActive: true,
  },
  {
    id: 'builtin_income',
    label: 'Catat Pemasukan',
    action: 'ADD_INCOME',
    triggers: ['gaji', 'terima', 'dapat', 'income', 'masuk', 'pemasukan', 'penghasilan', 'dibayar', 'transfer masuk', 'uang masuk'],
    example: 'gaji masuk 10jt',
    defaultFields: { category: 'salary' },
    description: 'Mencatat pemasukan / gaji',
    priority: 9,
    isActive: true,
  },
  {
    id: 'builtin_task',
    label: 'Buat Tugas / Reminder',
    action: 'ADD_TASK',
    triggers: ['ingatkan', 'remind', 'todo', 'tugas', 'jadwal', 'jangan lupa', 'besok', 'lusa', 'minggu depan'],
    example: 'ingatkan bayar cicilan besok',
    defaultFields: { priority: 'medium' },
    description: 'Membuat tugas / pengingat',
    priority: 8,
    isActive: true,
  },
  {
    id: 'builtin_health',
    label: 'Cek Kesehatan Finansial',
    action: 'CHECK_HEALTH',
    triggers: ['cek', 'analisa', 'kesehatan', 'dsr', 'status keuangan', 'gimana keuangan', 'kondisi', 'health', 'skor'],
    example: 'cek kesehatan keuangan saya',
    defaultFields: {},
    description: 'Menganalisa kondisi keuangan',
    priority: 7,
    isActive: true,
  },
  {
    id: 'builtin_debts',
    label: 'Lihat Hutang',
    action: 'SHOW_DEBTS',
    triggers: ['hutang', 'cicilan', 'kredit', 'pinjaman', 'lihat hutang', 'debt', 'tagihan'],
    example: 'lihat semua hutang saya',
    defaultFields: {},
    description: 'Menampilkan daftar hutang aktif',
    priority: 6,
    isActive: true,
  },
];

// ─── NUMBER PARSER ────────────────────────────────────────────────────────────

export function parseIndonesianNumber(text: string): number | null {
  // Match patterns like: 25rb, 1.5jt, 500k, 2m, 25000, 1,500,000
  const clean = text.toLowerCase().replace(/[,_]/g, '');
  
  // Patterns: "25rb", "1.5jt", "500k", "2m", "25000", "1500000"
  const patterns = [
    { re: /(\d+(?:\.\d+)?)\s*(?:juta|jt|m)\b/, mul: 1_000_000 },
    { re: /(\d+(?:\.\d+)?)\s*(?:ribu|rb|k)\b/, mul: 1_000 },
    { re: /(\d+(?:\.\d+)?)\s*(?:ratus|rts)\b/, mul: 100 },
    { re: /(\d[\d.]*\d|\d)/, mul: 1 },  // plain number
  ];
  
  for (const { re, mul } of patterns) {
    const m = clean.match(re);
    if (m) {
      const val = parseFloat(m[1].replace(/\./g, mul === 1 ? '' : '.'));
      return Math.round(val * mul);
    }
  }
  return null;
}

// ─── DATE PARSER ─────────────────────────────────────────────────────────────

export function toLocalDateStr(d: Date): string {
  // Use local timezone — avoids UTC offset shifting date backward (e.g. UTC+7 midnight issue)
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseRelativeDate(text: string): string {
  const lower = text.toLowerCase();
  const today = new Date();

  if (lower.includes('besok') || lower.includes('tomorrow')) {
    today.setDate(today.getDate() + 1);
  } else if (lower.includes('lusa')) {
    today.setDate(today.getDate() + 2);
  } else if (lower.includes('minggu depan') || lower.includes('next week')) {
    today.setDate(today.getDate() + 7);
  } else if (lower.includes('kemarin') || lower.includes('yesterday')) {
    today.setDate(today.getDate() - 1);
  }
  // Use LOCAL date (not UTC) to avoid timezone drift
  return toLocalDateStr(today);
}

// ─── CATEGORY DETECTOR ───────────────────────────────────────────────────────

const CATEGORY_MAP: Record<string, string[]> = {
  Food:          ['makan', 'minum', 'kopi', 'teh', 'resto', 'warung', 'nasi', 'bakso', 'food', 'eat', 'lunch', 'dinner', 'sarapan', 'siang', 'malam', 'snack', 'jajan'],
  Transport:     ['bensin', 'solar', 'parkir', 'grab', 'gojek', 'tol', 'ojek', 'busway', 'kereta', 'tiket', 'transport', 'bbm', 'motor', 'mobil'],
  Shopping:      ['beli', 'belanja', 'shopee', 'tokopedia', 'lazada', 'toko', 'mall', 'shop'],
  Utilities:     ['listrik', 'air', 'internet', 'wifi', 'pdam', 'gas', 'tagihan', 'bills', 'pulsa', 'token'],
  Entertainment: ['nonton', 'netflix', 'spotify', 'hiburan', 'game', 'main', 'bioskop', 'film'],
};

export function detectCategory(text: string): string {
  const lower = text.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_MAP)) {
    if (keywords.some(k => lower.includes(k))) return cat;
  }
  return 'Others';
}

// ─── FIELD EXTRACTOR ─────────────────────────────────────────────────────────

export function extractFields(input: string, action: AIActionType): Record<string, any> {
  const lower = input.toLowerCase();
  const amount = parseIndonesianNumber(input);
  const date = parseRelativeDate(input);
  
  // Extract title: remove numbers/units/keywords, clean up
  let title = input
    .replace(/\d+(?:[.,]\d+)?\s*(?:juta|jt|ribu|rb|k|m|ratus|rts)\b/gi, '')
    .replace(/\d[\d.,]*/g, '')
    .replace(/\b(catat|tambah|buat|bikin|ingatkan|remind|gaji|income|pengeluaran|expense|masuk|keluar)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  if (!title) title = input.trim();
  // Capitalize
  title = title.charAt(0).toUpperCase() + title.slice(1);

  if (action === 'ADD_EXPENSE') {
    return {
      title: title || 'Pengeluaran',
      amount: amount || 0,
      category: detectCategory(input),
      date,
    };
  }
  if (action === 'ADD_ALLOCATION') {
    return {
      name: title || 'Alokasi Baru',
      amount: amount || 0,
      category: lower.includes('hutang') || lower.includes('cicilan') ? 'debt'
        : lower.includes('hiburan') || lower.includes('jalan') || lower.includes('hangout') ? 'wants'
        : 'needs',
    };
  }
  if (action === 'ADD_INCOME') {
    return {
      description: title || 'Pemasukan',
      amount: amount || 0,
      date,
      source: lower.includes('gaji') ? 'Gaji' : lower.includes('freelance') ? 'Freelance' : 'Lainnya',
    };
  }
  if (action === 'ADD_TASK') {
    return {
      title: title || 'Tugas Baru',
      dueDate: date,
      notes: input,
      priority: lower.includes('penting') || lower.includes('urgent') ? 'high' : 'medium',
    };
  }
  return {};
}

// ─── MAIN MATCHER ────────────────────────────────────────────────────────────

export function matchRules(input: string, rules: AIKnowledgeRule[]): AIParseResult {
  const lower = input.toLowerCase().trim();
  const activeRules = rules.filter(r => r.isActive).sort((a, b) => b.priority - a.priority);
  
  const scored: AIMatchResult[] = [];

  for (const rule of activeRules) {
    let score = 0;
    let matchedTriggers = 0;
    
    for (const trigger of rule.triggers) {
      if (lower.includes(trigger.toLowerCase())) {
        score += trigger.length > 3 ? 3 : 1; // longer trigger = higher weight
        matchedTriggers++;
      }
    }
    
    if (matchedTriggers === 0) continue;
    
    // Boost score for amount presence on expense/income rules
    const hasAmount = parseIndonesianNumber(input) !== null;
    if (hasAmount && (rule.action === 'ADD_EXPENSE' || rule.action === 'ADD_INCOME')) {
      score += 3;
    }
    
    const parsedFields = { ...rule.defaultFields, ...extractFields(input, rule.action) };
    const confidence: 'high' | 'medium' | 'low' = score >= 6 ? 'high' : score >= 3 ? 'medium' : 'low';
    
    scored.push({ rule, score, parsedFields, confidence });
  }
  
  scored.sort((a, b) => b.score - a.score);
  
  if (scored.length === 0) {
    return { status: 'unknown', matches: [], rawInput: input };
  }
  
  const top = scored[0];
  const second = scored[1];

  // Special case: if top is ADD_ALLOCATION but input ALSO has expense/income words
  // → semantically ambiguous ("alokasikan makan" = budget OR actual spend?)
  const EXPENSE_WORDS = ['makan','beli','bayar','jajan','belanja','habis','beli','spend'];
  const hasExpenseWord = EXPENSE_WORDS.some(w => lower.includes(w));
  if (
    top.rule.action === 'ADD_ALLOCATION' && hasExpenseWord &&
    scored.some(s => s.rule.action === 'ADD_EXPENSE')
  ) {
    // Re-order: put ADD_ALLOCATION first, ADD_EXPENSE second
    const allocMatch = scored.find(s => s.rule.action === 'ADD_ALLOCATION')!;
    const expenseMatch = scored.find(s => s.rule.action === 'ADD_EXPENSE')!;
    return { status: 'ambiguous', matches: [allocMatch, expenseMatch], rawInput: input };
  }

  // Ambiguous if top two scores are close (within 3 points)
  if (second && Math.abs(top.score - second.score) <= 3 && top.confidence !== 'high') {
    return { status: 'ambiguous', matches: scored.slice(0, 3), rawInput: input };
  }
  
  return { status: 'match', matches: scored.slice(0, 1), rawInput: input };
}

// ─── FETCH RULES FROM BACKEND ─────────────────────────────────────────────────

export async function fetchKnowledgeRules(): Promise<AIKnowledgeRule[]> {
  try {
    const config = getConfig();
    const base = getApiBaseUrl();
    const userId = localStorage.getItem('paydone_active_user') || '';
    const token = localStorage.getItem('paydone_session_token') || '';
    
    const res = await fetch(`${base}/api/ai/knowledge-rules`, {
      headers: { 'x-user-id': userId, 'x-session-token': token }
    });
    if (!res.ok) return DEFAULT_RULES;
    const data = await res.json();
    const serverRules: AIKnowledgeRule[] = data.rules || [];
    // Merge: server rules take priority, fill gaps with defaults
    const serverIds = new Set(serverRules.map(r => r.id));
    const merged = [
      ...serverRules,
      ...DEFAULT_RULES.filter(r => !serverIds.has(r.id))
    ];
    return merged;
  } catch {
    return DEFAULT_RULES;
  }
}

export async function saveKnowledgeRules(rules: AIKnowledgeRule[], adminHeaders: Record<string, string>): Promise<boolean> {
  try {
    const config = getConfig();
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/admin/ai/knowledge-rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...adminHeaders },
      body: JSON.stringify({ rules })
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── REPORT UNKNOWN PROMPT TO SERVER ─────────────────────────────────────────

export async function reportUnknownPrompt(rawInput: string): Promise<void> {
  try {
    const config = getConfig();
    const base = getApiBaseUrl();
    const userId = localStorage.getItem('paydone_active_user') || '';
    const token = localStorage.getItem('paydone_session_token') || '';
    await fetch(`${base}/api/ai/unknown-prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': userId, 'x-session-token': token },
      body: JSON.stringify({ rawInput })
    });
  } catch { /* silent fail */ }
}

// ─── FETCH UNKNOWN PROMPTS (admin) ───────────────────────────────────────────

export interface UnknownPrompt {
  id: string;
  raw_input: string;
  user_id: string;
  count: number;
  status: 'pending' | 'resolved' | 'ignored';
  resolved_actions: { action: AIActionType; label: string }[];
  admin_notes: string;
  created_at: string;
}

export async function fetchUnknownPrompts(adminHeaders: Record<string, string>, status = 'pending'): Promise<UnknownPrompt[]> {
  try {
    const config = getConfig();
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/admin/ai/unknown-prompts?status=${status}`, { headers: adminHeaders });
    if (!res.ok) return [];
    const data = await res.json();
    return data.prompts || [];
  } catch { return []; }
}

export async function resolveUnknownPrompt(
  id: string,
  status: 'resolved' | 'ignored',
  resolvedActions: { action: AIActionType; label: string }[],
  adminNotes: string,
  adminHeaders: Record<string, string>
): Promise<boolean> {
  try {
    const config = getConfig();
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/admin/ai/unknown-prompts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...adminHeaders },
      body: JSON.stringify({ status, resolved_actions: resolvedActions, admin_notes: adminNotes })
    });
    return res.ok;
  } catch { return false; }
}
