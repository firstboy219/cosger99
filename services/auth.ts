
import { api } from './api';
import { pullUserDataFromCloud } from './cloudSync';

export const handleLoginFlow = async (credentials: any) => {
    console.log("🚀 Starting Login Flow...");
    
    // 1. LOGIN REQUEST
    // Note: api.post uses getAuthHeaders which reads from localStorage.
    // Since we are logging in, we might have stale tokens or no tokens.
    // The backend /auth/login endpoint typically doesn't require auth headers, or ignores them.
    const res = await api.post('/auth/login', credentials);
    
    // Support multiple response structures (e.g. root user obj or data.user)
    const user = res.user || res.data?.user;
    
    if (!user) {
        throw new Error("Invalid response format: User data missing.");
    }

    const token = user.sessionToken || user.session_token;

    if (!token) {
        throw new Error("CRITICAL: No session token returned from server!");
    }

    // 2. SAVE SESSION (Crucial)
    localStorage.setItem('paydone_session_token', token);
    localStorage.setItem('paydone_active_user', user.id);
    
    console.log("✅ Session Saved.");

    // 3. HYDRATE DATA (The Missing Step!)
    // Triggers the "Dual Engine" to pull Debts, Incomes, etc.
    if (user.role !== 'admin') {
        try {
            console.log("🚀 Starting Hydration...");
            // Force a sync call using the new token to ensure we have access
            const result = await pullUserDataFromCloud(user.id, token);
            
            if (result.success) {
                console.log("✅ Hydration Complete. Data Synced.");
            } else {
                console.warn("⚠️ Hydration Warning:", result.error);
            }
        } catch (err) {
            console.error("❌ Hydration Failed:", err);
            // We do not throw here, as login was successful. The dashboard will retry sync.
        }
    }

    return user;
};
