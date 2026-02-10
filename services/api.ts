
import { getConfig } from './mockDb';
import { getHeaders } from './cloudSync';

/**
 * Executes raw SQL DDL/DML commands on the backend database.
 * Requirement: Backend V45.4+
 */
export const adminExecuteSql = async (sql: string): Promise<boolean> => {
    const config = getConfig();
    const baseUrl = config.backendUrl?.replace(/\/$/, '') || 'https://api.cosger.online';
    const adminId = localStorage.getItem('paydone_active_user') || 'admin';

    const response = await fetch(`${baseUrl}/api/admin/execute-sql`, {
        method: 'POST',
        headers: getHeaders(adminId),
        body: JSON.stringify({ sql })
    });

    if (!response.ok) {
        let errorMessage = "SQL Execution Failed";
        try {
            const errData = await response.json();
            errorMessage = errData.error || errorMessage;
        } catch (e) {
            // response not json
        }
        throw new Error(errorMessage);
    }

    return true;
};
