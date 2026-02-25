
import { getConfig } from './mockDb';
import { sanitizeDatePayload } from './dateUtils';

const getBaseUrl = () => getConfig().backendUrl?.replace(/\/$/, '') || 'https://api.cosger.com';

/**
 * V50.18 Protocol 1: Header & Authentication
 * - All requests MUST include x-user-id and x-session-token
 * - Admin endpoints (/api/admin/*) MUST include x-admin-secret
 */
const getAuthHeaders = (endpoint?: string) => {
    const userId = localStorage.getItem('paydone_active_user') || '';
    const token = localStorage.getItem('paydone_session_token') || '';
    
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-user-id': userId,
        'x-session-token': token
        // V50.35 TAHAP 2: GZIP & Time Sanitizer
        // DO NOT override Accept-Encoding - let browser/fetch handle GZIP automatically
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // V50.18: Admin endpoints require x-admin-secret header
    if (endpoint && endpoint.includes('/admin')) {
        const adminSecret = localStorage.getItem('paydone_admin_secret') || 'paydone-admin-2025';
        headers['x-admin-secret'] = adminSecret;
    }

    return headers;
};

/**
 * V50.18 Protocol 4: PUT Payload Sanitizer
 * Strip id, user_id, userId, and created_at/createdAt from PUT bodies
 * to prevent IDOR & time corruption on the backend.
 */
const stripRestrictedFieldsForPut = (body: any): any => {
    if (!body || typeof body !== 'object') return body;
    const sanitized = { ...body };
    delete sanitized.id;
    delete sanitized.user_id;
    delete sanitized.userId;
    delete sanitized.created_at;
    delete sanitized.createdAt;
    return sanitized;
};

// V50.35 TAHAP 2: Auth Storm Control
let authStormActive = false;
let authStormTimeout: any = null;

const handleResponse = async (res: Response) => {
    // V50.35 TAHAP 2: Auth Storm Interceptor
    // If backend sends X-Auth-Status: Expired on 401, block all pending requests
    if (res.status === 401) {
        const authStatus = res.headers.get('X-Auth-Status');
        
        if (authStatus === 'Expired' && !authStormActive) {
            console.warn(`[Auth Storm] Session expired detected. Blocking subsequent requests.`);
            authStormActive = true;
            
            // Clear auth data
            localStorage.removeItem('paydone_session_token');
            localStorage.removeItem('paydone_active_user');
            localStorage.removeItem('paydone_user_role');
            
            // Dispatch logout event (let App component handle the redirect)
            window.dispatchEvent(new CustomEvent('PAYDONE_AUTH_EXPIRED', { 
                detail: { reason: 'X-Auth-Status: Expired' } 
            }));
            
            // Redirect after short delay (allow other cleanup)
            setTimeout(() => {
                if (!window.location.hash.includes('login')) {
                    window.location.href = '/#/login';
                }
            }, 200);
        }
        
        throw new Error("UNAUTHORIZED");
    }

    // Clear auth storm flag on successful response
    if (res.ok && authStormActive) {
        authStormActive = false;
    }

    // V50.36: Intercept 403 Forbidden with upgrade_required action
    if (res.status === 403) {
        const data = await res.json().catch(() => ({}));
        if (data.action === 'upgrade_required') {
            window.dispatchEvent(new CustomEvent('PAYDONE_UPGRADE_REQUIRED', {
                detail: { error: data.error, feature: data.feature || '' }
            }));
            throw new Error(data.error || 'Fitur terkunci. Upgrade diperlukan.');
        }
        throw new Error(data.error || data.message || `Forbidden (403)`);
    }

    if (res.status === 404) {
        throw new Error(`Endpoint not found (404): ${res.url}`);
    }

    const data = await res.json().catch(() => ({}));
    
    if (!res.ok) {
        throw new Error(data.error || data.message || `HTTP Error ${res.status}`);
    }

    return data;
};

export const api = {
    get: async (endpoint: string, options: RequestInit = {}) => {
        const url = `${getBaseUrl()}/api${endpoint}`;
        try {
            const res = await fetch(url, {
                method: 'GET',
                ...options,
                headers: { ...getAuthHeaders(endpoint), ...options.headers }
            });
            return await handleResponse(res);
        } catch (e) {
            throw e;
        }
    },

    post: async (endpoint: string, body: any, options: RequestInit = {}) => {
        const url = `${getBaseUrl()}/api${endpoint}`;
        try {
            // V50.35 TAHAP 2: Time Sanitizer - Format all dates to ISO
            const sanitizedBody = sanitizeDatePayload(body);
            const res = await fetch(url, {
                method: 'POST',
                ...options,
                headers: { ...getAuthHeaders(endpoint), ...options.headers },
                body: JSON.stringify(sanitizedBody)
            });
            return await handleResponse(res);
        } catch (e) {
            throw e;
        }
    },

    // V50.18 Protocol 4: Strip restricted fields from PUT payload
    // V50.35 TAHAP 2: Also sanitize dates to ISO format
    put: async (endpoint: string, body: any, options: RequestInit = {}) => {
        const url = `${getBaseUrl()}/api${endpoint}`;
        let sanitizedBody = stripRestrictedFieldsForPut(body);
        sanitizedBody = sanitizeDatePayload(sanitizedBody);
        try {
            const res = await fetch(url, {
                method: 'PUT',
                ...options,
                headers: { ...getAuthHeaders(endpoint), ...options.headers },
                body: JSON.stringify(sanitizedBody)
            });
            return await handleResponse(res);
        } catch (e) {
            throw e;
        }
    },

    delete: async (endpoint: string, options: RequestInit = {}) => {
        const url = `${getBaseUrl()}/api${endpoint}`;
        try {
            const res = await fetch(url, {
                method: 'DELETE',
                ...options,
                headers: { ...getAuthHeaders(endpoint), ...options.headers }
            });
            return await handleResponse(res);
        } catch (e) {
            throw e;
        }
    }
};

/**
 * Admin SQL Executor (Legacy support / Admin specific)
 */
export const adminExecuteSql = async (sql: string): Promise<boolean> => {
    try {
        await api.post('/admin/execute-sql', { sql });
        return true;
    } catch (e) {
        console.error("SQL Exec Error:", e);
        throw e;
    }
};
