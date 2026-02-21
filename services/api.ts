
import { getConfig } from './mockDb';

const getBaseUrl = () => getConfig().backendUrl?.replace(/\/$/, '') || 'https://api.cosger.online';

const getAuthHeaders = () => {
    const userId = localStorage.getItem('paydone_active_user') || '';
    const token = localStorage.getItem('paydone_session_token') || '';
    
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-user-id': userId,
        'x-session-token': token
    };

    // Add standard Authorization header as fallback/primary depending on backend config
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
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
                headers: { ...getAuthHeaders(), ...options.headers }
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
                headers: { ...getAuthHeaders(), ...options.headers },
                body: JSON.stringify(body)
            });
            return await handleResponse(res);
        } catch (e) {
            throw e;
        }
    },

    put: async (endpoint: string, body: any, options: RequestInit = {}) => {
        const url = `${getBaseUrl()}/api${endpoint}`;
        try {
            const res = await fetch(url, {
                method: 'PUT',
                ...options,
                headers: { ...getAuthHeaders(), ...options.headers },
                body: JSON.stringify(body)
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
                headers: { ...getAuthHeaders(), ...options.headers }
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
