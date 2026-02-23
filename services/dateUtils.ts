/**
 * V50.35 TAHAP 2: GZIP & Time Sanitizer
 * Ensure all date payloads are formatted in absolute ISO format
 * Prevents time drift from device local time corrupting backend data
 */

/**
 * Sanitize a date to ISO string format
 * Input can be: Date object, ISO string, timestamp (ms), or unix timestamp (s)
 * Output: Always ISO 8601 string
 */
export const toISOString = (date: any): string => {
  try {
    if (!date) return new Date().toISOString();
    
    if (typeof date === 'string') {
      // Already a string - validate and convert to Date then back to ISO
      const parsed = new Date(date);
      if (isNaN(parsed.getTime())) {
        // Invalid date string - use current time
        return new Date().toISOString();
      }
      return parsed.toISOString();
    }
    
    if (typeof date === 'number') {
      // Could be milliseconds or seconds
      // If > 10^11, likely milliseconds; if < 10^10, likely seconds
      const timeMs = date > 100000000000 ? date : date * 1000;
      return new Date(timeMs).toISOString();
    }
    
    if (date instanceof Date) {
      return date.toISOString();
    }
    
    // Fallback
    return new Date().toISOString();
  } catch (e) {
    console.warn('[dateUtils] toISOString failed, using current time', date, e);
    return new Date().toISOString();
  }
};

/**
 * Format date for display (human-readable)
 * Default: "2025-02-23 14:30:45"
 */
export const formatDateDisplay = (date: any, includeTime: boolean = true): string => {
  try {
    let d: Date;
    
    if (typeof date === 'string') {
      d = new Date(date);
    } else if (typeof date === 'number') {
      const timeMs = date > 100000000000 ? date : date * 1000;
      d = new Date(timeMs);
    } else if (date instanceof Date) {
      d = date;
    } else {
      return '';
    }
    
    if (isNaN(d.getTime())) return '';
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    if (!includeTime) return dateStr;
    
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    
    return `${dateStr} ${hours}:${minutes}:${seconds}`;
  } catch (e) {
    console.warn('[dateUtils] formatDateDisplay failed', date, e);
    return '';
  }
};

/**
 * Get current timestamp in ISO format
 */
export const getNowISO = (): string => {
  return new Date().toISOString();
};

/**
 * Parse date string and return ISO string
 * Handles both ISO and various date formats
 */
export const parseAndToISO = (dateStr: string): string | null => {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
};

/**
 * Sanitize a payload object that might contain date fields
 * Converts common date field names to ISO format
 */
export const sanitizeDatePayload = (obj: any, dateFields: string[] = []): any => {
  if (!obj || typeof obj !== 'object') return obj;
  
  const result = { ...obj };
  
  // Common date field names to always check
  const commonDateFields = [
    'date', 'createdAt', 'created_at', 'updatedAt', 'updated_at',
    'deletedAt', 'deleted_at', 'startDate', 'start_date', 'endDate', 'end_date',
    'dueDate', 'due_date', 'paidAt', 'paid_at', 'sentAt', 'sent_at',
    'validUntil', 'valid_until', 'subscriptAt', 'subscript_at',
    'timestamp', 'publishedAt', 'published_at', 'verifyAt', 'verify_at'
  ];
  
  const fieldsToCheck = [...new Set([...commonDateFields, ...dateFields])];
  
  fieldsToCheck.forEach(field => {
    if (result[field] !== undefined && result[field] !== null) {
      try {
        result[field] = toISOString(result[field]);
      } catch (e) {
        console.warn(`[dateUtils] Failed to sanitize field ${field}`, e);
      }
    }
  });
  
  return result;
};
