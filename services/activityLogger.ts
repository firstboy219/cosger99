
import { getDB, saveDB, DBSchema } from './mockDb';
import { LogItem } from '../types';

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
    category
  };

  // Ensure logs array exists
  if (!db.logs) {
    db.logs = [];
  }

  // Prepend log (newest first)
  db.logs.unshift(newLog);
  
  // Limit logs to last 100 entries to prevent localStorage bloat
  if (db.logs.length > 100) {
    db.logs = db.logs.slice(0, 100);
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
