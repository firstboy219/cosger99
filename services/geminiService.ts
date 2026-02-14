import { GoogleGenAI, Type } from "@google/genai";
import { DebtItem, Opportunity, TaskItem } from "../types";
import { getConfig, getAgentConfig } from "./mockDb";

const getAgent = (id: string) => {
    const agent = getAgentConfig(id);
    return {
        model: agent?.model || 'gemini-3-flash-preview',
        systemInstruction: agent?.systemInstruction || ''
    };
};

/**
 * AI INTERPRETER: Menerjemahkan kolom database baru dari Backend menjadi bahasa bisnis yang dimengerti user.
 */
export const interpretBackendPayload = async (unknownKeys: string[], rawPayload: any): Promise<string> => {
    // Initialization of AI client
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `
        Terdapat field database baru: [${unknownKeys.join(', ')}].
        Sample Data: ${JSON.stringify(rawPayload).substring(0, 300)}
        
        TUGAS: Jelaskan kegunaan field ini bagi pengguna akhir dalam 1 kalimat taktis.
    `;

    try {
        // Calling generateContent with correct parameters
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { systemInstruction: "Anda adalah analis sistem fintech senior." }
        });
        return response.text || "";
    } catch (e) { return "Konfigurasi backend baru terdeteksi."; }
};

/**
 * DASHBOARD SUMMARY: Menghasilkan ringkasan kondisi finansial yang sangat cerdas dan solutif.
 */
export const generateDashboardSummary = async (metrics: any) => {
    // Initialization of AI client
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const agent = getAgent('dashboard_summary');
    
    // Calling generateContent with correct parameters
    const response = await ai.models.generateContent({
        model: agent.model,
        contents: `Financial Metrics: ${JSON.stringify(metrics)}`,
        config: { systemInstruction: agent.systemInstruction }
    });
    
    return response.text || "";
};

/**
 * TRANSACTION PARSER: Mendukung instruksi bahasa alami yang kompleks untuk entri data.
 */
export const parseTransactionAI = async (input: string, context?: any) => {
    // Initialization of AI client
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const agent = getAgent('command_center');
    
    // Calling generateContent with correct parameters
    const response = await ai.models.generateContent({
        model: agent.model,
        contents: `INPUT: "${input}"\nCONTEXT: ${JSON.stringify(context || {})}`,
        config: { 
            systemInstruction: agent.systemInstruction,
            responseMimeType: "application/json"
        }
    });
    
    try {
        return JSON.parse(response.text || '{}');
    } catch (e) {
        return { intent: 'ERROR', message: "Maaf, instruksi terlalu kompleks." };
    }
};

export const analyzeDebtStrategy = async (debts: DebtItem[], language: string) => {
    // Initialization of AI client
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const agent = getAgent('debt_strategist');
    
    // Calling generateContent with correct parameters
    const response = await ai.models.generateContent({
        model: agent.model,
        contents: `Debts: ${JSON.stringify(debts)}\nLang: ${language}`,
        config: { 
            systemInstruction: agent.systemInstruction,
            responseMimeType: "application/json"
        }
    });
    
    try {
        return JSON.parse(response.text || '{"text": "", "actions": []}');
    } catch (e) {
        return { text: "Gagal menganalisa strategi.", actions: [] };
    }
};

export const findFinancialOpportunities = async (debts: DebtItem[], income: number, country: string, language: string) => {
    // Initialization of AI client
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const agent = getAgent('financial_freedom');
    
    // Calling generateContent with correct parameters and responseSchema
    const response = await ai.models.generateContent({
        model: agent.model,
        contents: `DATA: Debts=${JSON.stringify(debts)}, Income=${income}, Locale=${country}`,
        config: {
            systemInstruction: agent.systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        id: { type: Type.STRING },
                        title: { type: Type.STRING },
                        type: { type: Type.STRING },
                        description: { type: Type.STRING },
                        potentialIncome: { type: Type.STRING },
                        riskLevel: { type: Type.STRING }
                    },
                    required: ["title", "potentialIncome"]
                }
            }
        }
    });
    
    try {
        return JSON.parse(response.text || '[]');
    } catch (e) { return []; }
};

// Implement missing sendChatMessage function for the AI Strategist chat
/**
 * CHAT SERVICE: Chat umum dengan konteks finansial.
 */
export const sendChatMessage = async (message: string, language: string, context: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `CONTEXT: ${context}\nLANG: ${language}\nUSER: ${message}`,
            config: { systemInstruction: "Anda adalah asisten keuangan pribadi yang cerdas dan ramah dari Paydone.id." }
        });
        return response.text || "";
    } catch (e) {
        return "Maaf, sistem AI sedang offline.";
    }
};

// Implement missing getOpportunityDetails function for Financial Freedom details
/**
 * OPPORTUNITY DETAILS: Mengambil detail langkah eksekusi untuk peluang finansial.
 */
export const getOpportunityDetails = async (opp: Opportunity, language: string) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `OPPORTUNITY: ${JSON.stringify(opp)}\nLANG: ${language}`,
            config: {
                systemInstruction: "Berikan penjelasan detail dan langkah-langkah (checklist) untuk peluang bisnis ini. Output dalam JSON.",
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        explanation: { type: Type.STRING },
                        checklist: { type: Type.ARRAY, items: { type: Type.STRING } },
                        sources: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["explanation", "checklist"]
                }
            }
        });
        return JSON.parse(response.text || '{}');
    } catch (e) {
        return { explanation: "Gagal memuat detail strategi.", checklist: [], sources: [] };
    }
};

// Implement missing parseOnboardingResponse function for the initial wizard
/**
 * ONBOARDING PARSER: Ekstraksi data dari percakapan awal user.
 */
export const parseOnboardingResponse = async (step: string, input: string) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const agent = getAgent('new_user_wizard');

    try {
        const response = await ai.models.generateContent({
            model: agent.model,
            contents: `STEP: ${step}\nINPUT: ${input}`,
            config: {
                systemInstruction: agent.systemInstruction,
                responseMimeType: "application/json"
            }
        });
        return JSON.parse(response.text || '{}');
    } catch (e) {
        return null;
    }
};

// Implement missing runDevDebate function for code auditing comparisons
/**
 * DEV DEBATE: AI vs AI comparison for code auditing.
 */
export const runDevDebate = async (history: {role: string, text: string}[], localCode: string, remoteCode: string, targetAi: 'FRONTEND_AI' | 'BACKEND_AI'): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const agent = getAgent('dev_auditor');
    
    const systemInstruction = targetAi === 'FRONTEND_AI' 
        ? "Anda adalah Lead Frontend Architect. Bandingkan kode lokal vs remote. Cari ketidakkonsistenan logika, bug, atau fitur yang hilang di salah satu sisi."
        : "Anda adalah Backend Compliance Bot. Pastikan kode backend (remote) sesuai dengan kebutuhan frontend (lokal). Sarankan perbaikan jika ada API yang tidak sinkron.";

    const historyParts = history.map(h => ({ text: `${h.role}: ${h.text}` }));
    const contents = [
        { text: `LOCAL_CODE_FRONTEND:\n${localCode}\n\nREMOTE_CODE_BACKEND:\n${remoteCode}` },
        ...historyParts
    ];

    try {
        const response = await ai.models.generateContent({
            model: agent.model,
            contents: { parts: contents },
            config: { systemInstruction }
        });
        return response.text || "";
    } catch (e) {
        return "Gagal melakukan audit kode.";
    }
};