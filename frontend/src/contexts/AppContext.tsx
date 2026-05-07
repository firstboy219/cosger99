// src/contexts/AppContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { storage, fetchSync, login as apiLogin, logout as apiLogout } from '../services/api';

type User = {
  id: string;
  username: string;
  email: string;
  role: string;
  photoUrl?: string | null;
  financialFreedomTarget?: number;
  preferredCurrency?: string;
};

type DataState = {
  debts: any[];
  incomes: any[];
  dailyExpenses: any[];
  tasks: any[];
  sinkingFunds: any[];
  allocations: any[]; // flat array
  debtInstallments: any[];
  paymentRecords: any[];
  bankAccounts: any[];
};

const EMPTY_DATA: DataState = {
  debts: [],
  incomes: [],
  dailyExpenses: [],
  tasks: [],
  sinkingFunds: [],
  allocations: [],
  debtInstallments: [],
  paymentRecords: [],
  bankAccounts: [],
};

type Ctx = {
  user: User | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  isSyncing: boolean;
  data: DataState;
  signIn: (email: string, password: string) => Promise<User>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  patchData: (collection: keyof DataState, item: any, mode: 'add' | 'update' | 'delete') => void;
};

const AppContext = createContext<Ctx | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [data, setData] = useState<DataState>(EMPTY_DATA);

  // Convert API sync response to flat DataState
  const normalizeSync = (raw: any): DataState => {
    const resolve = (camel: string, snake: string) => raw[camel] ?? raw[snake] ?? [];
    const allocationsRaw = resolve('allocations', 'allocations');
    const allocFlat = Array.isArray(allocationsRaw)
      ? allocationsRaw
      : Object.values(allocationsRaw || {}).flat();
    return {
      debts: resolve('debts', 'debts'),
      incomes: resolve('incomes', 'incomes'),
      dailyExpenses: resolve('dailyExpenses', 'daily_expenses'),
      tasks: resolve('tasks', 'tasks'),
      sinkingFunds: resolve('sinkingFunds', 'sinking_funds'),
      allocations: allocFlat as any[],
      debtInstallments: resolve('debtInstallments', 'debt_installments'),
      paymentRecords: resolve('paymentRecords', 'payment_records'),
      bankAccounts: resolve('bankAccounts', 'bank_accounts'),
    };
  };

  const refresh = useCallback(async () => {
    const uid = await storage.getUserId();
    if (!uid) return;
    setIsSyncing(true);
    try {
      const raw = await fetchSync(uid);
      setData(normalizeSync(raw));
    } catch (e) {
      console.warn('[Sync] failed', e);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Bootstrap: restore session
  useEffect(() => {
    (async () => {
      try {
        const token = await storage.getToken();
        const uid = await storage.getUserId();
        const cachedUser = await storage.getUser();
        if (token && uid && cachedUser) {
          setUser(cachedUser);
          // background sync
          refresh();
        }
      } catch (e) {
        console.warn('[Bootstrap] error', e);
      } finally {
        setIsBootstrapping(false);
      }
    })();
  }, [refresh]);

  const signIn = useCallback(async (email: string, password: string) => {
    const u = await apiLogin(email, password);
    setUser(u);
    // load data
    try {
      const raw = await fetchSync(u.id);
      setData(normalizeSync(raw));
    } catch (e) {
      console.warn('[SignIn] sync failed', e);
    }
    return u;
  }, []);

  const signOut = useCallback(async () => {
    await apiLogout();
    setUser(null);
    setData(EMPTY_DATA);
  }, []);

  const patchData = useCallback(
    (collection: keyof DataState, item: any, mode: 'add' | 'update' | 'delete') => {
      setData((prev) => {
        const list = (prev[collection] as any[]) || [];
        let next: any[];
        if (mode === 'add') next = [item, ...list.filter((i) => i.id !== item.id)];
        else if (mode === 'update') next = list.map((i) => (i.id === item.id ? { ...i, ...item } : i));
        else next = list.filter((i) => i.id !== item.id);
        return { ...prev, [collection]: next };
      });
    },
    []
  );

  const value: Ctx = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isBootstrapping,
      isSyncing,
      data,
      signIn,
      signOut,
      refresh,
      patchData,
    }),
    [user, isBootstrapping, isSyncing, data, signIn, signOut, refresh, patchData]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
};
