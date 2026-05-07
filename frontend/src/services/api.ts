// src/services/api.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Constants.expoConfig?.extra as any)?.apiBaseUrl ||
  'https://api.cosger.com';

const STORAGE_TOKEN = 'paydone_session_token';
const STORAGE_USER_ID = 'paydone_active_user';

export const storage = {
  async setToken(token: string) {
    await AsyncStorage.setItem(STORAGE_TOKEN, token);
  },
  async getToken() {
    return AsyncStorage.getItem(STORAGE_TOKEN);
  },
  async setUserId(id: string) {
    await AsyncStorage.setItem(STORAGE_USER_ID, id);
  },
  async getUserId() {
    return AsyncStorage.getItem(STORAGE_USER_ID);
  },
  async setUser(user: any) {
    await AsyncStorage.setItem('paydone_user', JSON.stringify(user));
  },
  async getUser() {
    const raw = await AsyncStorage.getItem('paydone_user');
    return raw ? JSON.parse(raw) : null;
  },
  async clearAll() {
    await AsyncStorage.multiRemove([STORAGE_TOKEN, STORAGE_USER_ID, 'paydone_user']);
  },
};

async function buildHeaders(): Promise<Record<string, string>> {
  const token = (await storage.getToken()) || '';
  const userId = (await storage.getUserId()) || '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (token) {
    headers['x-session-token'] = token;
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (userId) headers['x-user-id'] = userId;
  return headers;
}

async function handleResponse(res: Response) {
  let data: any = null;
  const text = await res.text();
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) {
    const msg = data?.error || data?.message || `HTTP ${res.status}`;
    const err: any = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  baseUrl: API_BASE_URL,

  async get(path: string) {
    const headers = await buildHeaders();
    const res = await fetch(`${API_BASE_URL}/api${path}`, { method: 'GET', headers });
    return handleResponse(res);
  },

  async post(path: string, body: any) {
    const headers = await buildHeaders();
    const res = await fetch(`${API_BASE_URL}/api${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  },

  async put(path: string, body: any) {
    const headers = await buildHeaders();
    // Strip restricted fields like web app
    const sanitized = { ...body };
    delete sanitized.id;
    delete sanitized.user_id;
    delete sanitized.userId;
    delete sanitized.created_at;
    delete sanitized.createdAt;
    const res = await fetch(`${API_BASE_URL}/api${path}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(sanitized),
    });
    return handleResponse(res);
  },

  async delete(path: string) {
    const headers = await buildHeaders();
    const res = await fetch(`${API_BASE_URL}/api${path}`, { method: 'DELETE', headers });
    return handleResponse(res);
  },
};

// Auth functions
export async function login(email: string, password: string) {
  const res = await api.post('/auth/login', { email, password });
  const user = res.user || res.data?.user;
  if (!user) throw new Error('Format respons tidak valid: data user kosong.');
  // Prefer camelCase token (active session)
  const token = user.sessionToken || user.session_token;
  if (!token) throw new Error('Token sesi tidak diterima dari server.');
  await storage.setToken(token);
  await storage.setUserId(user.id);
  // Normalize user
  const normalized = {
    id: user.id,
    username: user.username || (user.email ? String(user.email).split('@')[0] : 'User'),
    email: user.email || '',
    role: user.role || 'user',
    photoUrl: user.photoUrl || user.photo_url || null,
    financialFreedomTarget:
      user.financialFreedomTarget ?? user.financial_freedom_target ?? 3_000_000_000,
    riskProfile: user.riskProfile || user.risk_profile || null,
    preferredCurrency: user.preferredCurrency || user.preferred_currency || 'IDR',
  };
  await storage.setUser(normalized);
  return normalized;
}

export async function logout() {
  await storage.clearAll();
}

// Bulk sync
export async function fetchSync(userId: string) {
  return api.get(`/sync?userId=${encodeURIComponent(userId)}`);
}

// Resource map (matches web app)
const RESOURCE_MAP: Record<string, string> = {
  debts: 'debts',
  incomes: 'incomes',
  dailyExpenses: 'daily-expenses',
  allocations: 'allocations',
  debtInstallments: 'debt-installments',
  tasks: 'tasks',
  paymentRecords: 'payment-records',
  sinkingFunds: 'sinking-funds',
  bankAccounts: 'bank-accounts',
};

const SQL_TABLE_MAP: Record<string, string> = {
  debts: 'debts',
  incomes: 'incomes',
  dailyExpenses: 'daily_expenses',
  allocations: 'allocations',
  tasks: 'tasks',
  sinkingFunds: 'sinking_funds',
  paymentRecords: 'payment_records',
  bankAccounts: 'bank_accounts',
  debtInstallments: 'debt_installments',
};

export async function createItem(collection: string, item: any) {
  const endpoint = RESOURCE_MAP[collection] || collection;
  const userId = (await storage.getUserId()) || '';
  if (!item.id) item.id = `${collection}-${Date.now()}`;
  if (!item.userId) item.userId = userId;
  return api.post(`/${endpoint}`, item);
}

export async function updateItem(collection: string, item: any) {
  const endpoint = RESOURCE_MAP[collection] || collection;
  return api.put(`/${endpoint}/${item.id}`, item);
}

export async function deleteItem(collection: string, id: string) {
  const table = SQL_TABLE_MAP[collection];
  if (!table) throw new Error(`Tidak ada mapping table untuk ${collection}`);
  return api.delete(`/sync/${table}/${id}`);
}
