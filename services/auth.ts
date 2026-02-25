
import { api } from './api';
import { pullUserDataFromCloud } from './cloudSync';
import { getDB, saveDB, addUser, getAllUsers } from './mockDb';
import { recordActivityLog } from './activityLogger';
import { User } from '../types';

export const handleLoginFlow = async (credentials: any) => {
    console.log("Starting Login Flow...");
    
    // 1. LOGIN REQUEST
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
    
    // 3. SAVE USER TO LOCAL DB (Critical for Profile page and other lookups)
    const normalizedUser: User = {
        id: user.id,
        username: user.username || user.name || user.email?.split('@')[0] || 'User',
        email: user.email || '',
        role: user.role || 'user',
        status: user.status || 'active',
        createdAt: user.createdAt || user.created_at || new Date().toISOString(),
        updatedAt: user.updatedAt || user.updated_at || new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        photoUrl: user.photoUrl || user.photo_url || '',
        sessionToken: token,
        parentUserId: user.parentUserId || user.parent_user_id || null,
        badges: user.badges || [],
        riskProfile: user.riskProfile || user.risk_profile,
        bigWhyUrl: user.bigWhyUrl || user.big_why_url || '',
        financialFreedomTarget: user.financialFreedomTarget || user.financial_freedom_target || 3000000000
    };
    
    // Upsert user in local DB
    const existingUsers = getAllUsers();
    const existingIdx = existingUsers.findIndex(u => u.id === user.id);
    if (existingIdx >= 0) {
        // Update existing
        const db = getDB();
        db.users = db.users.map(u => u.id === user.id ? { ...u, ...normalizedUser } : u);
        saveDB(db);
    } else {
        // Add new
        addUser(normalizedUser);
    }

    // 3b. LOG LOGIN ACTIVITY
    recordActivityLog(
      'Login Berhasil',
      `User ${normalizedUser.username} berhasil login dari ${navigator.userAgent?.includes('Mobile') ? 'Mobile' : 'Desktop'}.`,
      { email: normalizedUser.email },
      { role: normalizedUser.role },
      'success'
    );

    // 4. HYDRATE DATA (Pull all user-specific data from cloud)
    if (user.role !== 'admin') {
        try {
            console.log("Starting Hydration...");
            const result = await pullUserDataFromCloud(user.id, token);
            
            if (result.success) {
                console.log("Hydration Complete. Data Synced.");
            } else {
                console.warn("Hydration Warning:", result.error);
            }
        } catch (err) {
            console.error("Hydration Failed:", err);
        }
    }

    return user;
};
