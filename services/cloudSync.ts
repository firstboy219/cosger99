
import { getConfig, getDB, saveDB, getUserData, saveConfig } from './mockDb';
import { AppConfig, AIAgent } from '../types';
import { convertKeysToSnakeCase, convertKeysToCamelCase } from './formatUtils';

const getBackend = () => getConfig().backendUrl?.replace(/\/$/, '') || 'https://api.cosger.online';

export const getHeaders = (userId: string) => {
    const token = localStorage.getItem('paydone_session_token') || '';
    return {
        'Content-Type': 'application/json',
        'x-user-id': userId,
        'x-session-token': token
    };
};

/**
 * Helper to transform data based on "API Case Convention" setting
 */
const transformPayload = (data: any, direction: 'outgoing' | 'incoming') => {
    if (!data) return data;
    const config = getConfig();
    const convention = config.apiCaseConvention || 'snake_case'; // Default to snake_case per requirement

    if (convention === 'snake_case') {
        if (direction === 'outgoing') return convertKeysToSnakeCase(data);
        if (direction === 'incoming') return convertKeysToCamelCase(data);
    }
    return data; // Pass through if camelCase selected
};

/**
 * Mengambil konfigurasi global (App Settings atau AI Agents) langsung dari tabel sync_data di Cloud
 */
export const fetchGlobalConfigFromCloud = async (collectionName: 'app_settings' | 'ai_agents' | 'ba_rules'): Promise<any> => {
    const baseUrl = getBackend();
    try {
        const res = await fetch(`${baseUrl}/api/sync/global?collection=${collectionName}`, {
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (res.status === 404) {
            // Graceful fallback for older backends
            console.warn(`[CloudSync] Global endpoint not found (Server outdated). Skipping ${collectionName} fetch.`);
            return null;
        }

        if (!res.ok) {
            // Attempt to parse error text for better logging
            const errText = await res.text().catch(() => res.statusText);
            console.warn(`[CloudSync] Failed to fetch ${collectionName}: ${res.status} ${errText}`);
            return null;
        }

        const json = await res.json();
        const rawData = json.data || json.config; // Support both data and config keys
        return transformPayload(rawData, 'incoming');
    } catch (e: any) {
        console.error(`[CloudSync] Network/Logic error fetching ${collectionName}:`, e.message);
        return null;
    }
};

/**
 * Menyimpan konfigurasi global langsung ke Cloud
 */
export const saveGlobalConfigToCloud = async (collectionName: 'app_settings' | 'ai_agents' | 'ba_rules', payload: any): Promise<boolean> => {
    const baseUrl = getBackend();
    try {
        // V46 Fix: Transform payload to match SQL convention (googleClientId -> google_client_id)
        const transformedData = transformPayload(payload, 'outgoing');

        const res = await fetch(`${baseUrl}/api/sync/global`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                collection: collectionName,
                config: transformedData // CHANGED FROM 'data' TO 'config' to fix "No config provided" 400 error
            })
        });
        
        if (res.status === 404) {
            console.warn(`[CloudSync] Global endpoint not found. Cannot save ${collectionName} to cloud.`);
            return false;
        }

        if (!res.ok) {
             const errText = await res.text().catch(() => res.statusText);
             console.error(`[CloudSync] Save failed ${res.status}: ${errText}`);
             return false;
        }

        // Also update local cache if success and it's app_settings
        if (res.ok && collectionName === 'app_settings') {
            saveConfig(payload);
        }
        
        return res.ok;
    } catch (e: any) {
        console.error(`[CloudSync] Error saving ${collectionName}:`, e.message);
        return false;
    }
};

export const pullUserDataFromCloud = async (userId: string, forceFullSync: boolean = false, onProgress?: (msg: string) => void): Promise<any> => {
    const baseUrl = getBackend();
    try {
        if (onProgress) onProgress("Syncing with Cloud SQL...");
        const res = await fetch(`${baseUrl}/api/sync?userId=${userId}`, {
            headers: getHeaders(userId),
        });

        if (!res.ok) {
            const errText = await res.text().catch(() => res.statusText);
            throw new Error(`Cloud Error ${res.status}: ${errText}`);
        }
        
        let data = await res.json();
        
        // TRANSFORM INCOMING DATA (Snake -> Camel) if configured
        data = transformPayload(data, 'incoming');

        const db = getDB();

        // Update local mock DB with cloud data
        if (data.debts) db.debts = data.debts;
        if (data.incomes) db.incomes = data.incomes;
        if (data.dailyExpenses || data.daily_expenses) db.dailyExpenses = data.dailyExpenses || data.daily_expenses;
        if (data.paymentRecords || data.payment_records) db.paymentRecords = data.paymentRecords || data.payment_records;
        if (data.tasks) db.tasks = data.tasks;
        if (data.users) db.users = data.users;
        if (data.sinkingFunds || data.sinking_funds) db.sinkingFunds = data.sinkingFunds || data.sinking_funds;
        if (data.debtInstallments || data.debt_installments) db.debtInstallments = data.debtInstallments || data.debt_installments;
        
        // V45: Sync Tickets if available
        if (data.tickets) db.tickets = data.tickets;

        saveDB(db);
        return getUserData(userId);
    } catch (e: any) {
        console.warn("Pull Failed:", e.message);
        return null;
    }
};

export const pushUserDataToCloud = async (userId: string, data: any): Promise<boolean> => {
    const baseUrl = getBackend();
    try {
        // TRANSFORM OUTGOING DATA (Camel -> Snake) if configured
        const payload = transformPayload({ ...data, userId }, 'outgoing');

        const res = await fetch(`${baseUrl}/api/sync`, {
            method: 'POST',
            headers: getHeaders(userId),
            body: JSON.stringify(payload)
        });
        
        if (!res.ok) {
             const errText = await res.text().catch(() => res.statusText);
             console.error(`Push Failed ${res.status}: ${errText}`);
             return false;
        }
        return true;
    } catch (e) {
        return false;
    }
};

export const pushPartialUpdate = async (userId: string, data: any) => {
    const baseUrl = getBackend();
    try {
        // TRANSFORM OUTGOING DATA
        const payload = transformPayload({ ...data, userId }, 'outgoing');

        const res = await fetch(`${baseUrl}/api/sync`, {
            method: 'POST',
            headers: getHeaders(userId),
            body: JSON.stringify(payload)
        });
        return res.ok;
    } catch { return false; }
};
