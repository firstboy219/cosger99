
import { getConfig } from './mockDb';

const getBaseUrl = () => getConfig().backendUrl?.replace(/\/$/, '') || 'https://api.cosger.online';

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

const handleResponse = async (res: Response) => {
    if (res.status === 401) {
        // Auto-Logout trigger
        console.warn(`Session expired (401) on ${res.url}. Redirecting...`);
        localStorage.removeItem('paydone_session_token');
        
        // Prevent redirect loop if already on login
        if (!window.location.hash.includes('login')) {
            window.location.href = '/#/login';
        }
        throw new Error("UNAUTHORIZED");
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
            const res = await fetch(url, {
                method: 'POST',
                ...options,
                headers: { ...getAuthHeaders(endpoint), ...options.headers },
                body: JSON.stringify(body)
            });
            return await handleResponse(res);
        } catch (e) {
            throw e;
        }
    },

    // V50.18 Protocol 4: Strip restricted fields from PUT payload
    put: async (endpoint: string, body: any, options: RequestInit = {}) => {
        const url = `${getBaseUrl()}/api${endpoint}`;
        const sanitizedBody = stripRestrictedFieldsForPut(body);
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
