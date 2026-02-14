
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
// Prevents UI-only fields (like totalDebt, dsr) from crashing the SQL Insert.
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
    if (!validKeys) return item; // No filter if type unknown
    
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

/**
 * PULL: Menarik data sesuai endpoint /api/sync backend V47.10
 */
export const pullUserDataFromCloud = async (userId: string, onProgress?: (msg: string) => void): Promise<SyncResult> => {
    const baseUrl = getBackend();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 Seconds Timeout
    const targetUrl = `${baseUrl}/api/sync?userId=${userId}`;

    try {
        if (onProgress) onProgress("Menghubungi Cloud SQL...");
        
        const res = await fetch(targetUrl, {
            headers: getHeaders(userId),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        const data = await res.json();
        
        // DISPATCH NOTIFICATION (Payload null for GET)
        dispatchNetworkLog('GET', targetUrl, res.status, data, null);

        if (!res.ok) return { success: false, error: `Cloud Error ${res.status}` };
        
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
        if (data.tickets) db.tickets = data.tickets; // Added tickets
        
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
    const targetUrl = `${baseUrl}/api/sync`;
    
    // Update local dulu (Optimistic)
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

            // SANITIZE PAYLOAD BEFORE SENDING
            if (key in ALLOWED_KEYS) {
                sanitizedData[key] = sanitizeArray(incomingItems, key as keyof typeof ALLOWED_KEYS);
            } else if (key === 'allocations') {
                // Allocations is record, handled specially in loop below or backend handles flattening
                sanitizedData[key] = data[key]; 
            } else {
                sanitizedData[key] = incomingItems; // Fallback
            }
        } else if (key === 'allocations') {
             sanitizedData[key] = data[key]; // Allocations is object Record<string, []>
        }
    });
    saveDB(db);

    // If 'allocations' is present, we need to sanitize the items inside the record values
    if (sanitizedData.allocations) {
        const cleanAllocations: any = {};
        Object.keys(sanitizedData.allocations).forEach(mKey => {
            // Assume allocation items match 'allocations' key in ALLOWED_KEYS (generic expense item)
            // But ExpenseItem definition is slightly different. Let's make a generic one.
            // For now, we trust allocations structure mostly matches.
            cleanAllocations[mKey] = sanitizedData.allocations[mKey];
        });
        sanitizedData.allocations = cleanAllocations;
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s Timeout for Push

        const finalPayload = { ...sanitizedData, userId };

        const res = await fetch(targetUrl, {
            method: 'POST',
            headers: getHeaders(userId),
            body: JSON.stringify(finalPayload),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        let responseData = {};
        try { responseData = await res.json(); } catch(e) {}
        
        // DISPATCH NOTIFICATION WITH PAYLOAD
        dispatchNetworkLog('POST', targetUrl, res.status, responseData, finalPayload);

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
    
    const targetUrl = `${baseUrl}/api/${endpoint}/${id}`;

    try {
        const res = await fetch(targetUrl, {
            method: 'DELETE',
            headers: getHeaders(userId)
        });
        
        let responseData = {};
        try { responseData = await res.json(); } catch(e) {}
        
        // DISPATCH NOTIFICATION
        dispatchNetworkLog('DELETE', targetUrl, res.status, responseData, { table, id, action: 'DELETE' });
        
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
        
        // DISPATCH NOTIFICATION
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
