
import { DebtItem, Opportunity, TaskItem } from "../types";
import { getConfig, getAgentConfig } from "./mockDb";

// --- SECURITY UPDATE V42: STRICT AUTH HEADER INJECTION ---
// Helper to get current authenticated user ID from reliable storage
const getAuthIdentifier = () => {
    return localStorage.getItem('paydone_active_user') || 'guest_mode';
};

// Helper to get session token
const getSessionToken = () => {
    return localStorage.getItem('paydone_session_token') || '';
};

const getBackendUrl = () => {
    const config = getConfig();
    return config.backendUrl?.replace(/\/$/, '') || '';
};

// Helper: Raw Fetch Wrapper with V42 Auth
const makeProxyRequest = async (baseUrl: string, prompt: string, model: string, systemInstruction?: string) => {
    const userId = getAuthIdentifier();
    
    // Construct V42 Compliant Body
    const bodyPayload = { 
        prompt, 
        model, 
        userId: userId, // V42 Requirement: userId in body
        systemInstruction // Pass dynamic instruction to backend
    };

    try {
        const response = await fetch(`${baseUrl}/api/ai/analyze`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-user-id': userId, // V42 Requirement: Header injection
                'x-session-token': getSessionToken() // V44.17 Session Enforcement
            },
            body: JSON.stringify(bodyPayload)
        });

        // V42 AUTH HANDLER
        if (response.status === 401) {
            console.error("[GeminiService] 401 Unauthorized - Session Invalid");
            // Only force logout if we are not in guest/onboarding mode
            if (userId !== 'guest_mode') {
                localStorage.removeItem('paydone_active_user'); 
                window.location.reload(); 
            }
            throw new Error("Session Expired: Please login again.");
        }

        if (response.status === 403) {
            console.warn("[GeminiService] 403 Forbidden. Check API Key or Service Account permissions.");
            throw new Error("AI Service Access Denied (403). Please check System Config API Key.");
        }

        if (!response.ok) {
            let errorMessage = `Server Error: ${response.status}`;
            try {
                const errorData = await response.json();
                if (errorData.error) errorMessage = errorData.error;
            } catch (e) {
                // response was not json
            }
            throw new Error(errorMessage);
        }

        const data = await response.json();
        return data.text;
    } catch (e: any) {
        console.error("AI Request Failed:", e.message);
        throw e;
    }
};

// DYNAMIC AGENT CALLER
const callAgent = async (agentId: string, userPrompt: string, contextData: string = '') => {
    const baseUrl = getBackendUrl();
    if (!baseUrl) throw new Error("Backend URL missing");

    const agentConfig = getAgentConfig(agentId);
    const systemInstruction = agentConfig ? agentConfig.systemInstruction : "You are a helpful assistant.";
    // Updated fallback model to gemini-3-flash-preview as per guidelines
    const model = agentConfig ? agentConfig.model : "gemini-3-flash-preview";

    const fullPrompt = contextData ? `CONTEXT DATA:\n${contextData}\n\nUSER PROMPT:\n${userPrompt}` : userPrompt;

    try {
        return await makeProxyRequest(baseUrl, fullPrompt, model, systemInstruction);
    } catch (e: any) {
        console.error(`Agent ${agentId} failed:`, e);
        throw e;
    }
};

// Helper to extract JSON from text
const extractJSON = (text: string) => {
    try {
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start === -1 || end === -1) return {};
        return JSON.parse(text.substring(start, end + 1));
    } catch (e) {
        return {};
    }
};

const extractJSONArray = (text: string) => {
    try {
        const start = text.indexOf('[');
        const end = text.lastIndexOf(']');
        if (start === -1 || end === -1) return [];
        return JSON.parse(text.substring(start, end + 1));
    } catch (e) {
        return [];
    }
};

// --- FEATURES ---

export const generateDashboardSummary = async (metrics: any) => {
    try {
        const context = JSON.stringify(metrics, null, 2);
        const text = await callAgent('dashboard_summary', "Generate my financial summary for today.", context);
        return text;
    } catch (e) {
        return "AI sedang istirahat. Cek data manual ya.";
    }
};

export const parseTransactionAI = async (text: string, contextData: any = {}) => {
    try {
        // Serialize Context for AI
        const debtsContext = contextData.debts ? contextData.debts.map((d: any) => `${d.name} (Cicilan: ${d.monthlyPayment})`).join(', ') : 'No Active Debts';
        const allocationsContext = contextData.allocations ? contextData.allocations.map((a: any) => a.name).join(', ') : '';
        
        const context = `
            Existing Debts: [${debtsContext}]
            Existing Allocations: [${allocationsContext}]
        `;
        
        const textRes = await callAgent('command_center', text, context);
        return extractJSON(textRes);
    } catch (e) { return { intent: 'ERROR', message: 'AI Parse Failed' }; }
};

export const analyzeDebtStrategy = async (debts: DebtItem[], language: string = 'id'): Promise<{ text: string; actions: string[] }> => {
    try {
        const context = JSON.stringify(debts.map(d => ({ name: d.name, rate: d.interestRate, remaining: d.remainingPrincipal, monthly: d.monthlyPayment })));
        const textRes = await callAgent('debt_strategist', `Analyze these debts in language: ${language}`, context);
        return extractJSON(textRes);
    } catch (e) {
        return { text: "AI Analysis Failed (Connection Error). Please try again.", actions: [] };
    }
};

export const parseOnboardingResponse = async (step: 'INCOME' | 'DEBT', input: string) => {
  try {
    const textRes = await callAgent('new_user_wizard', `Step: ${step}. User Input: "${input}"`);
    return extractJSON(textRes);
  } catch (error) { return null; }
};

export const findFinancialOpportunities = async (debts: DebtItem[], income: number, country: string = 'Indonesia', language: string = 'id'): Promise<Opportunity[]> => {
    try {
        const context = `Debts: ${debts.length}, Income: ${income}, Country: ${country}`;
        const textRes = await callAgent('financial_freedom', "Generate financial opportunities.", context);
        return extractJSONArray(textRes);
    } catch (e) { return []; }
};

export const getOpportunityDetails = async (opp: Opportunity, language: string = 'id'): Promise<{ explanation: string; checklist: string[]; sources: string[] }> => {
    try {
        const text = await callAgent('financial_freedom', `Details for opportunity: "${opp.title}". Return JSON {explanation, checklist, sources}.`);
        return extractJSON(text);
    } catch (e) { return { explanation: "Error fetching details.", checklist: [], sources: [] }; }
};

export const sendChatMessage = async (message: string, language: string = 'id', contextData: string = ''): Promise<string> => {
    try {
        return await callAgent('debt_strategist', message, contextData);
    } catch (e) {
        return "Maaf, sistem AI sedang sibuk. Coba lagi nanti.";
    }
};

// Legacy tools (DevTools) REFACTORED TO AGENTS
export const runDevDebate = async (history: any[], local: string, remote: string, role: string) => {
    const context = `Role: ${role}\nLocal: ${local.substring(0, 500)}...\nRemote: ${remote.substring(0, 500)}...`;
    return await callAgent('dev_auditor', "Analyze code differences.", context); 
};

export const generateQAScenarios = async (routes: string[]) => {
    const context = `Routes: ${routes.join(',')}`;
    const text = await callAgent('qa_specialist', "Generate QA Scenarios.", context);
    return extractJSONArray(text);
};

export const parseBugReportToScenario = async (input: string) => {
    const text = await callAgent('qa_specialist', `Parse bug report to QA Scenario JSON: "${input}"`);
    return extractJSON(text);
};

export const getPublicHolidays = async (country: string, year: number) => {
    const text = await callAgent('system_utility', `List holidays in ${country} ${year} as JSON Array {date, name}.`);
    return extractJSONArray(text);
};
