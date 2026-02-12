
import { getConfig, getDB, saveDB, getUserData } from './mockDb';
import { convertKeysToSnakeCase, convertKeysToCamelCase } from './formatUtils';
import { interpretBackendPayload } from './geminiService';

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
 * PULL: Menarik data sesuai endpoint /api/sync backend V47.10
 */
export const pullUserDataFromCloud = async (userId: string, onProgress?: (msg: string) => void): Promise<SyncResult> => {
    const baseUrl = getBackend();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 Seconds Timeout

    try {
        if (onProgress) onProgress("Menghubungi Cloud SQL...");
        
        const res = await fetch(`${baseUrl}/api/sync?userId=${userId}`, {
            headers: getHeaders(userId),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!res.ok) return { success: false, error: `Cloud Error ${res.status}` };
        
        const data = await res.json();

        const db = getDB();
        // Mapping data dari backend ke local state
        if (data.debts) db.debts = data.debts;
        if (data.incomes) db.incomes = data.incomes;
        if (data.dailyExpenses) db.dailyExpenses = data.dailyExpenses;
        if (data.debtInstallments) db.debtInstallments = data.debtInstallments;
        if (data.paymentRecords) db.paymentRecords = data.paymentRecords;
        if (data.allocations) db.allocations = data.allocations;
        if (data.tasks) db.tasks = data.tasks;
        if (data.sinkingFunds) db.sinkingFunds = data.sinkingFunds;
        
        saveDB(db);
        return { success: true, data: getUserData(userId) };
    } catch (e: any) {
        if (e.name === 'AbortError') {
            return { success: false, error: "Connection Timeout (5s)" };
        }
        return { success: false, error: e.message };
    }
};

/**
 * PUSH: Mengirim data ke /api/sync sesuai format loop backend
 */
export const pushPartialUpdate = async (userId: string, data: any): Promise<boolean> => {
    const baseUrl = getBackend();
    const now = new Date().toISOString();
    
    // Update local dulu (Optimistic)
    const db = getDB();
    Object.keys(data).forEach(key => {
        if (Array.isArray(data[key])) {
            const incomingItems = data[key];
            const currentItems = (db as any)[key] || [];
            
            incomingItems.forEach((newItem: any) => {
                const idx = currentItems.findIndex((item: any) => item.id === newItem.id);
                const stampedItem = { ...newItem, updatedAt: now };
                if (idx !== -1) currentItems[idx] = stampedItem;
                else currentItems.push(stampedItem);
            });
            (db as any)[key] = currentItems;
        }
    });
    saveDB(db);

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s Timeout for Push

        const res = await fetch(`${baseUrl}/api/sync`, {
            method: 'POST',
            headers: getHeaders(userId),
            body: JSON.stringify({ ...data, userId }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return res.ok;
    } catch (e) {
        return false;
    }
};

/**
 * DELETE: Menggunakan endpoint spesifik sesuai server.cjs deleteHandler
 */
export const deleteFromCloud = async (userId: string, table: string, id: string): Promise<boolean> => {
    const baseUrl = getBackend();
    
    // Mapping ke endpoint backend (debts, incomes, daily-expenses, allocations)
    let endpoint = table;
    if (table === 'dailyExpenses') endpoint = 'daily-expenses';
    
    try {
        const res = await fetch(`${baseUrl}/api/${endpoint}/${id}`, {
            method: 'DELETE',
            headers: getHeaders(userId)
        });
        
        if (res.ok) {
            const db = getDB();
            if ((db as any)[table]) {
                (db as any)[table] = (db as any)[table].filter((item: any) => item.id !== id);
                saveDB(db);
            }
            return true;
        }
        return false;
    } catch (e) {
        return false;
    }
};

/**
 * SAVE GLOBAL CONFIG: Mengirim konfigurasi sistem ke backend (V44.22)
 */
export const saveGlobalConfigToCloud = async (id: string, config: any): Promise<boolean> => {
    const baseUrl = getBackend();
    const adminId = localStorage.getItem('paydone_active_user') || 'admin';
    try {
        const res = await fetch(`${baseUrl}/api/admin/config`, {
            method: 'POST',
            headers: getHeaders(adminId),
            body: JSON.stringify({ id, config })
        });
        return res.ok;
    } catch (e) {
        return false;
    }
};

export interface SyncResult {
    success: boolean;
    data?: any;
    error?: string;
}
