import { api } from './api';
import { getDB, saveDB, getUserData } from './mockDb';

// Map internal collection names to API resource paths (hyphenated)
const RESOURCE_MAP: Record<string, string> = {
    debts: 'debts',
    incomes: 'incomes',
    dailyExpenses: 'daily-expenses',
    allocations: 'allocations',
    debtInstallments: 'debt-installments',
    tasks: 'tasks',
    paymentRecords: 'payment-records',
    sinkingFunds: 'sinking-funds',
    tickets: 'tickets',
    aiAgents: 'ai-agents',
    qaScenarios: 'qa-scenarios',
    banks: 'admin/banks',
    baConfigurations: 'admin/ba-configurations',
    bankAccounts: 'bank-accounts',
    users: 'users'
};

// Map for Secure Delete (Must match SQL Table Names)
const SQL_TABLE_MAP: Record<string, string> = {
    debts: 'debts',
    incomes: 'incomes',
    dailyExpenses: 'daily_expenses',
    allocations: 'allocations',
    debtInstallments: 'debt_installments',
    tasks: 'tasks',
    paymentRecords: 'payment_records',
    sinkingFunds: 'sinking_funds',
    tickets: 'tickets',
    aiAgents: 'ai_agents',
    qaScenarios: 'qa_scenarios',
    bankAccounts: 'bank_accounts',
    users: 'users'
};

const dispatchNetworkLog = (method: string, url: string, status: number, response: any, payload?: any) => {
    try {
        const event = new CustomEvent('PAYDONE_API_RESPONSE', {
            detail: { method, url, status, response, payload, timestamp: new Date() }
        });
        window.dispatchEvent(event);
    } catch (e) {
        // Ignore log errors
    }
};

export interface SyncResult {
    success: boolean;
    data?: any;
    error?: string;
}

// --- HYDRATION: THE "FULL GET" ---
export const pullUserDataFromCloud = async (userId: string, tokenOverride?: string): Promise<SyncResult> => {
    try {
        // GET /api/sync?userId=...
        const options = tokenOverride ? { headers: { 'x-session-token': tokenOverride, 'Authorization': `Bearer ${tokenOverride}` } } : {};
        const data = await api.get(`/sync?userId=${userId}`, options);
        
        // Populate Local Store (Hydration)
        const db = getDB();
        
        // Ensure user data structure exists with defaults using helper
        const userData = getUserData(userId); 

        // Core Data - Update Local Reference
        if (data.debts) userData.debts = data.debts;
        if (data.incomes) userData.incomes = data.incomes;
        if (data.dailyExpenses) userData.dailyExpenses = data.dailyExpenses;
        if (data.debtInstallments) userData.debtInstallments = data.debtInstallments;
        if (data.paymentRecords) userData.paymentRecords = data.paymentRecords;
        if (data.tasks) userData.tasks = data.tasks;
        if (data.sinkingFunds) userData.sinkingFunds = data.sinkingFunds;
        if (data.bankAccounts) userData.bankAccounts = data.bankAccounts;
        
        // Global/Admin Data
        if (data.tickets) db.tickets = data.tickets;
        if (data.banks) db.banks = data.banks;
        if (data.config) db.config = { ...db.config, ...data.config };
        if (data.qaScenarios) db.qaScenarios = data.qaScenarios;
        if (data.baConfigurations) db.baConfigurations = data.baConfigurations;
        // Note: Users are usually not fully synced to client for security, but if backend sends them:
        if (data.users) db.users = data.users;

        // Handle Allocations (Map to Object or Array depending on local schema preference)
        // Ensure local schema supports flat array for allocations if that's what server returns
        if (Array.isArray(data.allocations)) {
            // Update root allocation cache (Admin View)
            db.allocations = data.allocations;
            
            // Re-map flat array to month-key object for User UI efficiency
            const allocMap: Record<string, any[]> = {};
            data.allocations.forEach((a: any) => {
                const key = a.monthKey || 'general';
                if (!allocMap[key]) allocMap[key] = [];
                allocMap[key].push(a);
            });
            userData.allocations = allocMap;
        }

        // Commit updates to DB object
        if (!db.userData) db.userData = {};
        db.userData[userId] = userData;

        saveDB(db); // This triggers 'PAYDONE_DB_UPDATE' via mockDb.ts
        dispatchNetworkLog('GET', '/api/sync', 200, data);
        
        return { success: true, data: userData }; 
    } catch (e: any) {
        console.error("Hydration Failed:", e);
        dispatchNetworkLog('GET', '/api/sync', 500, { error: e.message });
        return { success: false, error: e.message };
    }
};

// --- UNIVERSAL CRUD: WRITE OPERATIONS ---
export const saveItemToCloud = async (collection: string, item: any, isNew: boolean, tokenOverride?: string): Promise<SyncResult> => {
    const endpoint = RESOURCE_MAP[collection] || collection;
    const path = isNew ? `/${endpoint}` : `/${endpoint}/${item.id}`;
    
    // Ensure item has ID and userId
    if (!item.id) item.id = `${collection}-${Date.now()}`;
    
    // STRICT USER ID CHECK
    if (!item.userId) {
        const activeUser = localStorage.getItem('paydone_active_user');
        if (activeUser) {
            item.userId = activeUser;
        } else {
            console.warn(`[CloudSync] Warning: No userId found for ${collection} save. Defaulting to 'admin'.`);
            item.userId = 'admin';
        }
    }

    // PRE-FLIGHT TOKEN CHECK
    const token = tokenOverride || localStorage.getItem('paydone_session_token');
    if (!token) {
        console.warn(`[CloudSync] No session token found. Aborting save for ${collection}.`);
        return { success: false, error: "NO_SESSION_TOKEN" };
    }

    try {
        const options = tokenOverride ? { headers: { 'x-session-token': tokenOverride, 'Authorization': `Bearer ${tokenOverride}` } } : {};
        
        // Prepare Payload: Strip internal fields like _deleted
        const payload = { ...item };
        delete payload._deleted;
        
        // 1. API CALL
        let result;
        if (isNew) {
            result = await api.post(path, payload, options);
        } else {
            result = await api.put(path, payload, options);
        }

        // Response should contain the saved item
        const savedItem = result.data || result;

        // 2. UPDATE LOCAL DB (PERSISTENCE)
        const db = getDB();
        const activeUserId = item.userId;
        
        if (activeUserId && db.userData?.[activeUserId]) {
             const userSpecificData = db.userData[activeUserId] as any;
             
             // --- SPECIAL HANDLING: ALLOCATIONS (Object/Map Structure) ---
             if (collection === 'allocations') {
                 // Ensure allocations is an object
                 if (!userSpecificData.allocations || Array.isArray(userSpecificData.allocations)) {
                     userSpecificData.allocations = {};
                 }

                 const monthKey = savedItem.monthKey || 'general';
                 const monthList = userSpecificData.allocations[monthKey] || [];
                 
                 // Remove existing if updating (to avoid dupe)
                 const cleanList = monthList.filter((i: any) => i.id !== savedItem.id);
                 
                 // Add updated item
                 userSpecificData.allocations[monthKey] = [...cleanList, savedItem];
             } 
             // --- STANDARD HANDLING: ARRAYS ---
             else if (userSpecificData[collection] && Array.isArray(userSpecificData[collection])) {
                 const list = userSpecificData[collection];
                 if (isNew) {
                     userSpecificData[collection] = [savedItem, ...list];
                 } else {
                     userSpecificData[collection] = list.map((i: any) => i.id === savedItem.id ? savedItem : i);
                 }
             }
             // --- INITIALIZE IF MISSING ---
             else if (!userSpecificData[collection] && activeUserId) {
                 userSpecificData[collection] = [savedItem];
             }
        }

        // 3. UPDATE ROOT COLLECTIONS (For Admin/Global)
        if ((db as any)[collection] && Array.isArray((db as any)[collection])) {
            const list = (db as any)[collection];
            if (isNew) {
                (db as any)[collection] = [savedItem, ...list];
            } else {
                (db as any)[collection] = list.map((i: any) => i.id === savedItem.id ? savedItem : i);
            }
        }
        
        saveDB(db);

        dispatchNetworkLog(isNew ? 'POST' : 'PUT', path, 200, result, payload);
        return { success: true, data: savedItem };

    } catch (e: any) {
        console.error(`CRUD Error ${collection}:`, e.message);
        dispatchNetworkLog(isNew ? 'POST' : 'PUT', path, 500, { error: e.message }, item);
        return { success: false, error: e.message };
    }
};

export const deleteFromCloud = async (userId: string, collection: string, id: string): Promise<boolean> => {
    // V50.00: Use Secure Sync Delete Endpoint
    const tableName = SQL_TABLE_MAP[collection];
    
    if (!tableName) {
        console.error(`[CloudSync] Delete aborted: No SQL table mapping for collection '${collection}'`);
        return false;
    }

    const path = `/sync/${tableName}/${id}`;

    // PRE-FLIGHT TOKEN CHECK
    const token = localStorage.getItem('paydone_session_token');
    if (!token) {
        console.warn(`[CloudSync] No session token found. Aborting delete for ${collection}.`);
        return false;
    }

    try {
        // 1. API CALL
        await api.delete(path);
        
        // 2. REMOVE FROM LOCAL DB
        const db = getDB();
        
        // Update User Specific Data
        if (db.userData?.[userId]) {
            const userSpecificData = db.userData[userId] as any;
            
            // --- SPECIAL HANDLING: ALLOCATIONS ---
            if (collection === 'allocations') {
                 if (userSpecificData.allocations && typeof userSpecificData.allocations === 'object') {
                     // Iterate keys because ID might be in any month (though mostly current)
                     Object.keys(userSpecificData.allocations).forEach(key => {
                         if (Array.isArray(userSpecificData.allocations[key])) {
                             userSpecificData.allocations[key] = userSpecificData.allocations[key].filter((item: any) => item.id !== id);
                         }
                     });
                 }
            }
            // --- STANDARD ARRAYS ---
            else if (userSpecificData[collection] && Array.isArray(userSpecificData[collection])) {
                userSpecificData[collection] = userSpecificData[collection].filter((item: any) => item.id !== id);
            }
        }

        // Update Root Data
        if ((db as any)[collection] && Array.isArray((db as any)[collection])) {
            (db as any)[collection] = (db as any)[collection].filter((item: any) => item.id !== id);
        }
        
        saveDB(db);
        
        dispatchNetworkLog('DELETE', path, 200, { success: true });
        return true;
    } catch (e: any) {
        console.error("Delete Failed:", e);
        dispatchNetworkLog('DELETE', path, 500, { error: e.message });
        return false;
    }
};

// Legacy support / Admin config
export const saveGlobalConfigToCloud = async (id: string, config: any): Promise<boolean> => {
    try {
        await api.post('/admin/config', { id, config });
        dispatchNetworkLog('POST', '/api/admin/config', 200, { success: true }, { id, config });
        return true;
    } catch (e: any) {
        dispatchNetworkLog('POST', '/api/admin/config', 500, { error: e.message }, { id, config });
        return false;
    }
};

// Load Global Config from Cloud DB (config table)
export const loadGlobalConfigFromCloud = async (): Promise<SyncResult> => {
    try {
        const data = await api.get('/admin/config');
        dispatchNetworkLog('GET', '/api/admin/config', 200, data);
        return { success: true, data };
    } catch (e: any) {
        dispatchNetworkLog('GET', '/api/admin/config', 500, { error: e.message });
        return { success: false, error: e.message };
    }
};

// Required by some older components, mapped to new structure
export const getHeaders = (userId: string) => {
    const token = localStorage.getItem('paydone_session_token') || '';
    return {
        'Content-Type': 'application/json',
        'x-user-id': userId,
        'x-session-token': token,
        'Authorization': `Bearer ${token}`
    };
};

export const pushPartialUpdate = async (userId: string, data: any): Promise<boolean> => {
    try {
        await api.post('/sync', { userId, ...data });
        return true;
    } catch (e) {
        return false;
    }
};
