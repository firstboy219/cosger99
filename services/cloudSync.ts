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
    users: 'users',
    packages: 'packages',
    paymentMethods: 'payment-methods',
    promos: 'promos',
    subscriptions: 'subscriptions',
    notifications: 'notifications'
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
    users: 'users',
    packages: 'packages',
    paymentMethods: 'payment_methods',
    promos: 'promos',
    subscriptions: 'subscriptions',
    notifications: 'notifications'
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
        // CRITICAL: Handle both camelCase AND snake_case keys from backend
        // The backend may return snake_case (daily_expenses) or camelCase (dailyExpenses)
        const resolve = (camel: string, snake: string) => data[camel] || data[snake];
        
        const debtsData = resolve('debts', 'debts');
        const incomesData = resolve('incomes', 'incomes');
        const dailyExpensesData = resolve('dailyExpenses', 'daily_expenses');
        const debtInstallmentsData = resolve('debtInstallments', 'debt_installments');
        const paymentRecordsData = resolve('paymentRecords', 'payment_records');
        const tasksData = resolve('tasks', 'tasks');
        const sinkingFundsData = resolve('sinkingFunds', 'sinking_funds');
        const bankAccountsData = resolve('bankAccounts', 'bank_accounts');
        
        // V50.18 Protocol 2: Backend returns complex columns as JSON objects.
        // Ensure we do NOT JSON.parse() them again to prevent TypeError/White Screen.
        // The safe approach: if it's already an object/array, leave it alone.
        const safeJsonField = (arr: any[], fields: string[]): any[] => {
            if (!Array.isArray(arr)) return arr;
            return arr.map(item => {
                const safe = { ...item };
                fields.forEach(f => {
                    if (f in safe && typeof safe[f] === 'string') {
                        try { safe[f] = JSON.parse(safe[f]); } catch { /* leave as string */ }
                    }
                    // Already object? Leave it untouched.
                });
                return safe;
            });
        };
        
        if (debtsData) userData.debts = safeJsonField(debtsData, ['stepUpSchedule']);
        if (incomesData) userData.incomes = incomesData;
        if (dailyExpensesData) userData.dailyExpenses = dailyExpensesData;
        if (debtInstallmentsData) userData.debtInstallments = debtInstallmentsData;
        if (paymentRecordsData) userData.paymentRecords = paymentRecordsData;
        if (tasksData) userData.tasks = tasksData;
        if (sinkingFundsData) userData.sinkingFunds = sinkingFundsData;
        if (bankAccountsData) userData.bankAccounts = bankAccountsData;
        
        // V50.21: Activity Logs from cloud (merge with local, deduplicate by id)
        const activityLogsData = resolve('activityLogs', 'activity_logs');
        if (activityLogsData && Array.isArray(activityLogsData)) {
            const existingIds = new Set((db.logs || []).map((l: any) => l.id));
            const newLogs = activityLogsData.filter((l: any) => !existingIds.has(l.id));
            db.logs = [...(db.logs || []), ...newLogs].sort((a: any, b: any) => 
                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            ).slice(0, 200); // Cap at 200
        }
        
        // Global/Admin Data (handle both camelCase and snake_case)
        const ticketsData = resolve('tickets', 'tickets');
        const banksData = resolve('banks', 'banks');
        const configData = data.config;
        const qaScenariosData = resolve('qaScenarios', 'qa_scenarios');
        const baConfigurationsData = resolve('baConfigurations', 'ba_configurations');
        
        if (ticketsData) db.tickets = safeJsonField(ticketsData, ['fixLogs', 'backupData']);
        if (banksData) db.banks = banksData;
        if (configData) db.config = { ...db.config, ...configData };
        if (qaScenariosData) db.qaScenarios = safeJsonField(qaScenariosData, ['payload']);
        if (baConfigurationsData) db.baConfigurations = baConfigurationsData;

        // V50.34 Freemium Hydration
        const packagesData = resolve('packages', 'packages');
        const paymentMethodsData = resolve('paymentMethods', 'payment_methods');
        const promosData = resolve('promos', 'promos');
        const subscriptionsData = resolve('subscriptions', 'subscriptions');
        const notificationsData = resolve('notifications', 'notifications');
        const activeFeaturesData = resolve('activeFeatures', 'active_features');
        const subscriptionStatusData = resolve('subscriptionStatus', 'subscription_status');

        if (packagesData && Array.isArray(packagesData)) db.packages = safeJsonField(packagesData, ['features']);
        if (paymentMethodsData && Array.isArray(paymentMethodsData)) db.paymentMethods = paymentMethodsData;
        if (promosData && Array.isArray(promosData)) db.promos = promosData;
        if (subscriptionsData && Array.isArray(subscriptionsData)) db.subscriptions = subscriptionsData;
        if (notificationsData && Array.isArray(notificationsData)) db.notifications = notificationsData;
        if (activeFeaturesData && typeof activeFeaturesData === 'object') db.activeFeatures = activeFeaturesData;
        if (subscriptionStatusData && typeof subscriptionStatusData === 'object') db.subscriptionStatus = subscriptionStatusData;
        // Merge users from cloud into local DB (upsert to avoid overwriting local-only users)
        if (data.users && Array.isArray(data.users)) {
            const existingIds = new Set((db.users || []).map((u: any) => u.id));
            data.users.forEach((cloudUser: any) => {
                if (existingIds.has(cloudUser.id)) {
                    db.users = (db.users || []).map((u: any) => u.id === cloudUser.id ? { ...u, ...cloudUser } : u);
                } else {
                    db.users = [...(db.users || []), cloudUser];
                }
            });
        }
        
        // Also ensure current user exists in db.users (critical for Profile page)
        if (userId && db.users) {
            const currentUserExists = db.users.some((u: any) => u.id === userId);
            if (!currentUserExists) {
                // Create a minimal user entry so Profile doesn't crash
                db.users.push({
                    id: userId,
                    username: 'User',
                    email: '',
                    role: 'user' as const,
                    status: 'active' as const,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
            }
        }

        // Handle Allocations (Map to Object or Array depending on local schema preference)
        // Ensure local schema supports flat array for allocations if that's what server returns
        const allocationsData = resolve('allocations', 'allocations');
        if (Array.isArray(allocationsData)) {
            // Update root allocation cache (Admin View)
            db.allocations = allocationsData;
            
            // Re-map flat array to month-key object for User UI efficiency
            const allocMap: Record<string, any[]> = {};
            allocationsData.forEach((a: any) => {
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

/**
 * V50.21 Protocol 2: Payload Sanitizer
 * - Coerce boolean fields explicitly to true/false (backend uses ?? operator)
 * - Ensure JSON object fields are NOT double-stringified
 * - Ensure array fields (stepUpSchedule) remain intact as full arrays
 */
const sanitizePayloadForV50 = (payload: any): any => {
    const sanitized = { ...payload };
    
    // Boolean coercion (V50.21 uses ?? to read these, so explicit true/false required)
    const booleanFields = ['isRecurring', 'isTransferred', 'isRolledBack', 'isNegativeCase'];
    booleanFields.forEach(field => {
        if (field in sanitized) {
            sanitized[field] = sanitized[field] === true || sanitized[field] === 'true' ? true : false;
        }
    });
    
    // JSON object/array fields: ensure they are native objects, NOT double-stringified strings.
    // V50.21 backend expects these as pure JSON objects/arrays in the body.
    // If they are strings, parse them ONCE. If already objects/arrays, leave them alone.
    const jsonFields = ['stepUpSchedule', 'payload', 'badges', 'fixLogs', 'backupData'];
    jsonFields.forEach(field => {
        if (field in sanitized) {
            if (typeof sanitized[field] === 'string') {
                try {
                    sanitized[field] = JSON.parse(sanitized[field]);
                } catch {
                    // Leave as string if it's not valid JSON
                }
            }
            // Final guard: if stepUpSchedule exists but is not an array, wrap or default it
            if (field === 'stepUpSchedule' && sanitized[field] !== undefined && sanitized[field] !== null) {
                if (!Array.isArray(sanitized[field])) {
                    console.warn('[CloudSync] stepUpSchedule is not an array after sanitization, resetting to []');
                    sanitized[field] = [];
                }
            }
        }
    });
    
    return sanitized;
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
        
        // Prepare Payload: Strip internal fields and apply V50.18 sanitization
        const payload = sanitizePayloadForV50({ ...item });
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
        
        // FALLBACK: Save to local DB even if cloud fails (offline resilience)
        try {
            const db = getDB();
            const activeUserId = item.userId;
            if (activeUserId && db.userData?.[activeUserId]) {
                const userSpecificData = db.userData[activeUserId] as any;
                if (collection === 'allocations') {
                    if (!userSpecificData.allocations || Array.isArray(userSpecificData.allocations)) {
                        userSpecificData.allocations = {};
                    }
                    const monthKey = item.monthKey || 'general';
                    const monthList = userSpecificData.allocations[monthKey] || [];
                    const cleanList = monthList.filter((i: any) => i.id !== item.id);
                    userSpecificData.allocations[monthKey] = [...cleanList, item];
                } else if (userSpecificData[collection] && Array.isArray(userSpecificData[collection])) {
                    if (isNew) {
                        userSpecificData[collection] = [item, ...userSpecificData[collection]];
                    } else {
                        userSpecificData[collection] = userSpecificData[collection].map((i: any) => i.id === item.id ? item : i);
                    }
                } else {
                    userSpecificData[collection] = [item];
                }
                saveDB(db);
            }
        } catch (localErr) {
            console.error(`Local fallback save also failed for ${collection}:`, localErr);
        }
        
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
        // V50.35 TAHAP 2: DELETE with secure headers
        // api.delete() automatically includes x-user-id and x-session-token headers
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
