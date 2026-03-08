/**
 * GEMINI SERVICE — Backend Proxy Only
 * Semua AI calls diarahkan ke backend /api/ai/analyze
 * TIDAK ada @google/genai di browser (mencegah TDZ bundle error)
 * process.env.API_KEY tidak tersedia di browser anyway
 */

import { DebtItem, Opportunity, TaskItem } from "../types";
import { getConfig, getAgentConfig } from "./mockDb";

// --- AI LIMIT ERROR (402 Handling) ---
export class AILimitError extends Error {
  constructor(message?: string) {
    super(message || 'Kuota AI Anda telah habis. Silakan upgrade paket untuk melanjutkan.');
    this.name = 'AILimitError';
  }
}

const getAgent = (id: string) => {
  const agent = getAgentConfig(id);
  return {
    model: agent?.model || 'gemini-1.5-flash',
    systemInstruction: agent?.systemInstruction || ''
  };
};

/**
 * Backend AI Proxy - single entry point for all AI calls
 */
const callBackendAI = async (payload: {
  prompt: string;
  model?: string;
  systemInstruction?: string;
  responseJson?: boolean;
}): Promise<string> => {
  const config = getConfig();
  const baseUrl = config.backendUrl?.replace(/\/$/, '') || 'https://api.cosger.com';
  const userId = localStorage.getItem('paydone_active_user') || '';
  const token = localStorage.getItem('paydone_session_token') || '';

  const res = await fetch(`${baseUrl}/api/ai/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
      'x-session-token': token,
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (res.status === 402) throw new AILimitError();
  if (!res.ok) throw new Error(`Backend AI error: ${res.status}`);

  const data = await res.json();
  return data.result || data.text || JSON.stringify(data);
};

// ─── EXPORTED AI FUNCTIONS ────────────────────────────────────────────────────

export const interpretBackendPayload = async (unknownKeys: string[], rawPayload: any): Promise<string> => {
  try {
    return await callBackendAI({
      prompt: `Field database baru: [${unknownKeys.join(', ')}]. Sample: ${JSON.stringify(rawPayload).substring(0, 300)}. Jelaskan kegunaan field ini dalam 1 kalimat.`,
      systemInstruction: 'Anda adalah analis sistem fintech senior.',
    });
  } catch (e) {
    return 'Konfigurasi backend baru terdeteksi.';
  }
};

export const generateDashboardSummary = async (metrics: any): Promise<string> => {
  const agent = getAgent('dashboard_summary');
  try {
    return await callBackendAI({
      prompt: `Financial Metrics: ${JSON.stringify(metrics)}`,
      model: agent.model,
      systemInstruction: agent.systemInstruction,
    });
  } catch (e: any) {
    if (e instanceof AILimitError) throw e;
    // Local fallback
    if (metrics.dsr > 40) return `DSR ${metrics.dsr?.toFixed(1)}% terlalu tinggi. Prioritaskan lunasi hutang konsumtif.`;
    if (metrics.runway < 3) return `Dana darurat hanya ${metrics.runway?.toFixed(1)} bulan. Tambah tabungan darurat.`;
    return 'Kondisi finansial prima! Saatnya agresif investasi.';
  }
};

export const parseTransactionAI = async (input: string, context?: any): Promise<any> => {
  const agent = getAgent('command_center');
  try {
    const text = await callBackendAI({
      prompt: `INPUT: "${input}"\nCONTEXT: ${JSON.stringify(context || {})}`,
      model: agent.model,
      systemInstruction: agent.systemInstruction,
      responseJson: true,
    });
    return JSON.parse(text);
  } catch (e: any) {
    if (e instanceof AILimitError) throw e;
    return { intent: 'ERROR', message: 'Maaf, instruksi terlalu kompleks.' };
  }
};

export const analyzeDebtStrategy = async (debts: DebtItem[], language: string): Promise<any> => {
  const agent = getAgent('debt_strategist');
  try {
    const text = await callBackendAI({
      prompt: `Debts: ${JSON.stringify(debts)}\nLang: ${language}`,
      model: agent.model,
      systemInstruction: agent.systemInstruction,
      responseJson: true,
    });
    return JSON.parse(text);
  } catch (e: any) {
    if (e instanceof AILimitError) throw e;
    return { text: 'Gagal menganalisa strategi.', actions: [] };
  }
};

export const findFinancialOpportunities = async (
  debts: DebtItem[], income: number, country: string, language: string
): Promise<any[]> => {
  const agent = getAgent('financial_freedom');
  try {
    const text = await callBackendAI({
      prompt: `DATA: Debts=${JSON.stringify(debts)}, Income=${income}, Locale=${country}, Lang=${language}`,
      model: agent.model,
      systemInstruction: agent.systemInstruction,
      responseJson: true,
    });
    return JSON.parse(text);
  } catch (e: any) {
    if (e instanceof AILimitError) throw e;
    return [];
  }
};

export const sendChatMessage = async (
  message: string, language: string, context: string
): Promise<string> => {
  try {
    return await callBackendAI({
      prompt: `CONTEXT: ${context}\nLANG: ${language}\nUSER: ${message}`,
      model: 'gemini-1.5-flash',
      systemInstruction: 'Anda adalah asisten keuangan pribadi yang cerdas dan ramah dari Paydone.id.',
    });
  } catch (e: any) {
    if (e instanceof AILimitError) throw e;
    return 'Maaf, sistem AI sedang offline.';
  }
};

export const getOpportunityDetails = async (opp: Opportunity, language: string): Promise<any> => {
  try {
    const text = await callBackendAI({
      prompt: `OPPORTUNITY: ${JSON.stringify(opp)}\nLANG: ${language}`,
      model: 'gemini-1.5-flash',
      systemInstruction: 'Berikan penjelasan detail dan langkah-langkah (checklist) untuk peluang bisnis ini. Output dalam JSON.',
      responseJson: true,
    });
    return JSON.parse(text);
  } catch (e) {
    return { explanation: 'Gagal memuat detail strategi.', checklist: [], sources: [] };
  }
};

export const parseOnboardingResponse = async (step: string, input: string): Promise<any> => {
  const agent = getAgent('new_user_wizard');
  try {
    const text = await callBackendAI({
      prompt: `STEP: ${step}\nINPUT: ${input}`,
      model: agent.model,
      systemInstruction: agent.systemInstruction,
      responseJson: true,
    });
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
};

export const runDevDebate = async (
  history: { role: string; text: string }[],
  localCode: string,
  remoteCode: string,
  targetAi: 'FRONTEND_AI' | 'BACKEND_AI'
): Promise<string> => {
  const agent = getAgent('dev_auditor');
  const systemInstruction = targetAi === 'FRONTEND_AI'
    ? 'Anda adalah Lead Frontend Architect. Bandingkan kode lokal vs remote. Cari ketidakkonsistenan logika, bug, atau fitur yang hilang.'
    : 'Anda adalah Backend Compliance Bot. Pastikan kode backend sesuai dengan kebutuhan frontend. Sarankan perbaikan jika ada API yang tidak sinkron.';

  const historyText = history.map(h => `${h.role}: ${h.text}`).join('\n');
  try {
    return await callBackendAI({
      prompt: `LOCAL:\n${localCode}\n\nREMOTE:\n${remoteCode}\n\nHISTORY:\n${historyText}`,
      model: agent.model,
      systemInstruction,
    });
  } catch (e) {
    return 'Gagal melakukan audit kode.';
  }
};
