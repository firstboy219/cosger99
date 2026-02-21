
import { IncomeItem } from '../types';
import { getBackendUrl } from './mockDb';

export const incomeService = {
    async getAll(userId: string): Promise<IncomeItem[]> {
        if (!userId) return [];
        try {
            const url = getBackendUrl().replace(/\/$/, '');
            const token = localStorage.getItem('paydone_session_token') || '';
            const res = await fetch(`${url}/api/incomes?userId=${userId}`, {
                headers: { 
                    'x-user-id': userId, // V42 Header Injection
                    'x-session-token': token, // V47 Security Header
                    'Content-Type': 'application/json'
                }
            });
            if (res.status === 401) throw new Error("SESSION_EXPIRED");
            if (!res.ok) {
                console.warn("[IncomeService] Fetch failed:", res.status);
                return [];
            }
            const data = await res.json();
            return data.map((d: any) => ({
                ...d,
                dateReceived: d.dateReceived ? new Date(d.dateReceived).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
            }));
        } catch (e: any) {
            if (e.message === 'SESSION_EXPIRED') throw e;
            console.error("[IncomeService] Error fetching incomes:", e);
            return [];
        }
    },

    async save(income: IncomeItem): Promise<boolean> {
        if (!income.userId) return false;
        try {
            const url = getBackendUrl().replace(/\/$/, '');
            const token = localStorage.getItem('paydone_session_token') || '';
            const res = await fetch(`${url}/api/incomes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': income.userId, // V42 Header Injection
                    'x-session-token': token // V47 Security Header
                },
                body: JSON.stringify(income)
            });
            if (res.status === 401) throw new Error("SESSION_EXPIRED");
            return res.ok;
        } catch (e: any) {
            if (e.message === 'SESSION_EXPIRED') throw e;
            console.error("[IncomeService] Error saving income:", e);
            return false;
        }
    }
};
