
import { getConfig, getDB, saveDB, getUserData } from './mockDb';

const getBackend = () => getConfig().backendUrl?.replace(/\/$/, '') || 'https://api.cosger.online';

export const getHeaders = (userId: string) => {
    const token = localStorage.getItem('paydone_session_token') || '';
    return {
        'Content-Type': 'application/json',
        'x-user-id': userId,
        'x-session-token': token
    };
};

// DISPATCHER FOR ADMIN NOTIFICATIONS
const dispatchNetworkLog = (method: string, url: string, status: number, response: any, payload?: any) => {
    try {
        const event = new CustomEvent('PAYDONE_API_RESPONSE', {
            detail: { method, url, status, response, payload, timestamp: new Date() }
        });
        window.dispatchEvent(event);
    } catch (e) {
        console.error("Failed to dispatch network log", e);
    }
};

// ALLOWLIST FOR PAYLOAD SANITIZATION
const ALLOWED_KEYS = {
    users: ['id', 'username', 'email', 'password', 'role', 'status', 'createdAt', 'lastLogin', 'photoUrl', 'parentUserId', 'sessionToken', 'badges', 'riskProfile', 'bigWhyUrl', 'financialFreedomTarget'],
    debts: ['id', 'userId', 'name', 'type', 'originalPrincipal', 'remainingPrincipal', 'interestRate', 'monthlyPayment', 'startDate', 'endDate', 'dueDate', 'bankName', 'interestStrategy', 'stepUpSchedule', 'totalLiability', 'remainingMonths', 'updatedAt'],
    incomes: ['id', 'userId', 'source', 'amount', 'type', 'frequency', 'dateReceived', 'notes', 'updatedAt'],
    dailyExpenses: ['id', 'userId', 'date', 'title', 'amount', 'category', 'notes', 'receiptImage', 'allocationId', 'updatedAt'],
    debtInstallments: ['id', 'debtId', 'userId', 'period', 'dueDate', 'amount', 'principalPart', 'interestPart', 'remainingBalance', 'status', 'notes', 'updatedAt'],
    tasks: ['id', 'userId', 'title', 'category', 'status', 'dueDate', 'context', 'updatedAt'],
    paymentRecords: ['id', 'debtId', 'userId', 'amount', 'paidDate', 'sourceBank', 'status', 'updatedAt'],
    sinkingFunds: ['id', 'userId', 'name', 'targetAmount', 'currentAmount', 'deadline', 'icon', 'color', 'updatedAt'],
    tickets: ['id', 'userId', 'title', 'description', 'priority', 'status', 'source', 'assignedTo', 'createdAt', 'resolvedAt', 'resolutionNote', 'fixLogs', 'backupData', 'isRolledBack', 'updatedAt'],
    aiAgents: ['id', 'name', 'description', 'systemInstruction', 'model', 'temperature', 'updatedAt'],
    qaScenarios: ['id', 'name', 'category', 'type', 'target', 'method', 'payload', 'description', 'expectedStatus', 'isNegativeCase', 'createdAt', 'lastRun', 'lastStatus', 'updatedAt'],
    baConfigurations: ['id', 'type', 'data', 'updatedAt']
};

const sanitize = (item: any, type: keyof typeof ALLOWED_KEYS) => {
    const validKeys = ALLOWED_KEYS[type];
    if (!validKeys) return item; 
    
    const clean: any = {};
    validKeys.forEach(key => {
        if (item[key] !== undefined) {
            clean[key] = item[key];
        }
    });
    return clean;
};

const sanitizeArray = (items: any[], type: keyof typeof ALLOWED_KEYS) => {
    return items.map(item => sanitize(item, type));
};

// HELPER: Map CamelCase Frontend Collections to Snake_Case Backend Tables (for DELETE)
const getTableEndpoint = (collectionName: string): string => {
    switch (collectionName) {
        case 'dailyExpenses': return 'daily-expenses';
        case 'debtInstallments': return 'debt-installments';
        case 'paymentRecords': return 'payment-records';
        case 'sinkingFunds': return 'sinking-funds';
        case 'aiAgents': return 'ai-agents';
        case 'qaScenarios': return 'qa-scenarios';
        case 'baConfigurations': return 'ba-configurations';
        default: return collectionName.toLowerCase();
    }
};

/**
 * PULL: Menarik data sesuai endpoint /api/sync
 */
export const pullUserDataFromCloud = async (userId: string, onProgress?: (msg: string) => void): Promise<SyncResult> => {
    const baseUrl = getBackend();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); 
    const targetUrl = `${baseUrl}/api/sync?userId=${userId}`;

    try {
        if (onProgress) onProgress("Menghubungi Cloud SQL...");
        
        const res = await fetch(targetUrl, {
            headers: getHeaders(userId),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        const data = await res.json();
        
        dispatchNetworkLog('GET', targetUrl, res.status, data, null);

        if (!res.ok) return { success: false, error: `Cloud Error ${res.status}` };
        
        const db = getDB();
        if (data.debts) db.debts = data.debts;
        if (data.incomes) db.incomes = data.incomes;
        if (data.dailyExpenses) db.dailyExpenses = data.dailyExpenses;
        if (data.debtInstallments) db.debtInstallments = data.debtInstallments; // Critical Fix
        if (data.paymentRecords) db.paymentRecords = data.paymentRecords;
        if (data.allocations) db.allocations = data.allocations;
        if (data.tasks) db.tasks = data.tasks;
        if (data.sinkingFunds) db.sinkingFunds = data.sinkingFunds;
        if (data.tickets) db.tickets = data.tickets;
        
        saveDB(db);
        return { success: true, data: getUserData(userId) };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
};

/**
 * PUSH: Mengirim data ke /api/sync
 */
export const pushPartialUpdate = async (userId: string, data: any): Promise<boolean> => {
    const baseUrl = getBackend();
    const now = new Date().toISOString();
    const targetUrl = `${baseUrl}/api/sync`;
    
    // Update local (Optimistic)
    const db = getDB();
    const sanitizedData: any = {};

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

            if (key in ALLOWED_KEYS) {
                sanitizedData[key] = sanitizeArray(incomingItems, key as keyof typeof ALLOWED_KEYS);
            } else if (key === 'allocations') {
                sanitizedData[key] = data[key]; 
            } else {
                sanitizedData[key] = incomingItems;
            }
        } else if (key === 'allocations') {
             sanitizedData[key] = data[key];
        }
    });
    saveDB(db);

    if (sanitizedData.allocations) {
        // Allocations structure handling if needed
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); 

        const finalPayload = { ...sanitizedData, userId };

        console.log(`[CloudSync] Pushing payload size: ${JSON.stringify(finalPayload).length} bytes`);

        const res = await fetch(targetUrl, {
            method: 'POST',
            headers: getHeaders(userId),
            body: JSON.stringify(finalPayload),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        let responseData = {};
        try { responseData = await res.json(); } catch(e) {}
        
        dispatchNetworkLog('POST', targetUrl, res.status, responseData, finalPayload);

        return res.ok;
    } catch (e) {
        console.error("[CloudSync] Push Failed:", e);
        return false;
    }
};

/**
 * DELETE: Menggunakan endpoint spesifik
 */
export const deleteFromCloud = async (userId: string, table: string, id: string): Promise<boolean> => {
    const baseUrl = getBackend();
    
    // Critical Fix: Map camelCase collection names to URL-friendly endpoints
    const endpoint = getTableEndpoint(table);
    const targetUrl = `${baseUrl}/api/${endpoint}/${id}`;

    console.log(`[CloudSync] Deleting ${id} from ${endpoint}...`);

    try {
        const res = await fetch(targetUrl, {
            method: 'DELETE',
            headers: getHeaders(userId)
        });
        
        let responseData = {};
        try { responseData = await res.json(); } catch(e) {}
        
        dispatchNetworkLog('DELETE', targetUrl, res.status, responseData, { table, id, action: 'DELETE' });
        
        if (res.ok) {
            const db = getDB();
            // Local update needs exact state key (camelCase)
            if ((db as any)[table]) {
                (db as any)[table] = (db as any)[table].filter((item: any) => item.id !== id);
                saveDB(db);
            }
            return true;
        }
        return false;
    } catch (e) {
        console.error("[CloudSync] Delete Failed:", e);
        return false;
    }
};

/**
 * SAVE GLOBAL CONFIG
 */
export const saveGlobalConfigToCloud = async (id: string, config: any): Promise<boolean> => {
    const baseUrl = getBackend();
    const adminId = localStorage.getItem('paydone_active_user') || 'admin';
    const targetUrl = `${baseUrl}/api/admin/config`;
    
    const payload = { id, config };

    try {
        const res = await fetch(targetUrl, {
            method: 'POST',
            headers: getHeaders(adminId),
            body: JSON.stringify(payload)
        });
        
        let responseData = {};
        try { responseData = await res.json(); } catch(e) {}
        
        dispatchNetworkLog('POST', targetUrl, res.status, responseData, payload);

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
