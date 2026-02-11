
import { getConfig, getDB, saveDB, getUserData } from './mockDb';
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

const transformPayload = (data: any, direction: 'outgoing' | 'incoming') => {
    if (!data) return data;
    const config = getConfig();
    const convention = config.apiCaseConvention || 'snake_case';

    if (convention === 'snake_case') {
        if (direction === 'outgoing') return convertKeysToSnakeCase(data);
        if (direction === 'incoming') return convertKeysToCamelCase(data);
    }
    return data;
};

/**
 * FULL PULL: Digunakan saat login atau inisialisasi awal.
 * Mengembalikan objek detail hasil sync.
 */
export interface SyncResult {
    success: boolean;
    data?: any;
    error?: string;
    status?: number;
}

export const pullUserDataFromCloud = async (userId: string, onProgress?: (msg: string) => void): Promise<SyncResult> => {
    const baseUrl = getBackend();
    try {
        if (onProgress) onProgress("Menghubungi Cloud SQL...");
        const res = await fetch(`${baseUrl}/api/sync?userId=${userId}`, {
            headers: getHeaders(userId),
        });

        if (!res.ok) {
            let errorMsg = `Server Error (${res.status})`;
            try {
                const errData = await res.json();
                errorMsg = errData.error || errorMsg;
            } catch(e) {}
            return { success: false, error: errorMsg, status: res.status };
        }
        
        let data = await res.json();
        data = transformPayload(data, 'incoming');

        const db = getDB();
        // Fix: Expand pullUserDataFromCloud to handle all syncable entities
        if (data.debts) db.debts = data.debts;
        if (data.incomes) db.incomes = data.incomes;
        if (data.dailyExpenses) db.dailyExpenses = data.dailyExpenses;
        if (data.debtInstallments) db.debtInstallments = data.debtInstallments;
        if (data.tasks) db.tasks = data.tasks;
        if (data.tickets) db.tickets = data.tickets;
        if (data.sinkingFunds) db.sinkingFunds = data.sinkingFunds;
        if (data.paymentRecords) db.paymentRecords = data.paymentRecords;
        
        saveDB(db);
        return { success: true, data: getUserData(userId) };
    } catch (e: any) {
        return { success: false, error: e.message === 'Failed to fetch' ? "Gagal terhubung ke Backend (CORS atau Offline)" : e.message };
    }
};

/**
 * PARTIAL PUSH: Mengirimkan HANYA item yang berubah.
 */
export const pushPartialUpdate = async (userId: string, data: any): Promise<boolean> => {
    const baseUrl = getBackend();
    try {
        const payload = transformPayload({ ...data, userId }, 'outgoing');
        const res = await fetch(`${baseUrl}/api/sync`, {
            method: 'POST',
            headers: getHeaders(userId),
            body: JSON.stringify(payload)
        });
        return res.ok;
    } catch (e) {
        console.error("Partial Sync Failed", e);
        return false;
    }
};

/**
 * PHYSICAL DELETE: Menghapus satu record spesifik di server.
 */
export const deleteFromCloud = async (userId: string, collection: string, id: string): Promise<boolean> => {
    const baseUrl = getBackend();
    const tableMap: Record<string, string> = {
        'debts': 'debts',
        'dailyExpenses': 'daily_expenses',
        'incomes': 'incomes',
        'debtInstallments': 'debt_installments',
        'tasks': 'tasks',
        'sinkingFunds': 'sinking_funds'
    };
    const tableName = tableMap[collection] || collection;

    try {
        const res = await fetch(`${baseUrl}/api/sync/${tableName}/${id}?userId=${userId}`, {
            method: 'DELETE',
            headers: getHeaders(userId)
        });
        return res.ok;
    } catch (e) {
        return false;
    }
};

export const saveGlobalConfigToCloud = async (configId: string, data: any): Promise<boolean> => {
    const baseUrl = getBackend();
    const adminId = localStorage.getItem('paydone_active_user') || 'admin';
    try {
        const res = await fetch(`${baseUrl}/api/admin/config`, {
            method: 'POST',
            headers: getHeaders(adminId),
            body: JSON.stringify({ id: configId, data })
        });
        return res.ok;
    } catch { return false; }
};