
import { getDB, saveDB, DBSchema } from './mockDb';
import { LogItem } from '../types';
import { api } from './api';

/**
 * V50.21: Enhanced Activity Logger with Cloud Sync
 * - recordActivityLog(): Full-featured logger with payload/response/status
 * - addLogEntry(): Legacy lightweight logger (kept for backward compat)
 * - getLogs(): Read logs from local DB with optional filtering
 * - syncLogsToCloud(): Push local logs to backend
 */

// V50.21: Full-featured logger with payload, response, and status tracking
export const recordActivityLog = (
  action: string,
  description: string,
  payload?: any,
  response?: any,
  status: 'success' | 'error' | 'warning' | 'info' = 'info'
): LogItem => {
  const db = getDB();
  const userId = localStorage.getItem('paydone_active_user') || 'unknown';
  const username = userId; // Simplified: userId as username for now

  // Determine category from action string
  let category: 'System' | 'Finance' | 'AI' | 'Security' = 'System';
  const actionLower = action.toLowerCase();
  if (actionLower.includes('debt') || actionLower.includes('income') || actionLower.includes('expense') || actionLower.includes('payment') || actionLower.includes('allocation')) {
    category = 'Finance';
  } else if (actionLower.includes('ai') || actionLower.includes('gemini') || actionLower.includes('strateg')) {
    category = 'AI';
  } else if (actionLower.includes('login') || actionLower.includes('logout') || actionLower.includes('auth') || actionLower.includes('register') || actionLower.includes('password')) {
    category = 'Security';
  }

  const newLog: LogItem = {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    userType: 'user',
    username,
    userId,
    action,
    details: description,
    category,
    // V50.21: Store payload/response safely (null-safe)
    payload: payload ?? undefined,
    response: response ?? undefined,
    status
  };

  if (!db.logs) db.logs = [];
  db.logs.unshift(newLog);

  // Limit logs to last 200 entries
  if (db.logs.length > 200) {
    db.logs = db.logs.slice(0, 200);
  }

  saveDB(db);

  // Fire-and-forget cloud sync for this log entry
  syncSingleLogToCloud(newLog).catch(() => {});

  return newLog;
};

// Fire-and-forget: Push a single log to backend
const syncSingleLogToCloud = async (log: LogItem): Promise<void> => {
  try {
    await api.post('/activity-logs', {
      ...log,
      // Ensure payload/response are safely serializable
      payload: log.payload !== undefined ? log.payload : null,
      response: log.response !== undefined ? log.response : null
    });
  } catch (e) {
    // Silent fail - logs are already saved locally
  }
};

// Legacy logger (backward compatible with existing code)
export const addLogEntry = (
  userType: 'user' | 'admin',
  username: string,
  action: string,
  details: string,
  category: 'System' | 'Finance' | 'AI' | 'Security'
) => {
  const db = getDB();
  
  const newLog: LogItem = {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    userType,
    username,
    action,
    details,
    category,
    status: 'info'
  };

  if (!db.logs) {
    db.logs = [];
  }

  db.logs.unshift(newLog);
  
  if (db.logs.length > 200) {
    db.logs = db.logs.slice(0, 200);
  }

  saveDB(db);
  return newLog;
};

export const getLogs = (userType?: 'user' | 'admin'): LogItem[] => {
  const db = getDB();
  if (!db.logs) return [];
  
  if (userType) {
    return db.logs.filter((log: LogItem) => log.userType === userType);
  }
  return db.logs;
};

// V50.21: Bulk sync local logs to cloud (called by sync engine)
export const getUnsyncedLogs = (): LogItem[] => {
  return getLogs();
};
