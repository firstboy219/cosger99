// [BUGFIX] Import React secara eksplisit di baris pertama — WAJIB untuk file .ts
// yang menggunakan hooks (useState, useEffect, useCallback).
// Rollup/esbuild memproses file .ts berbeda dari .tsx: tanpa JSX transform,
// named hook imports (useState dll) harus punya React sebagai side-effect
// import agar bundle tahu modul ini bergantung pada react chunk.
// Tanpa ini, Rollup bisa menempatkan freemiumStore lebih awal dari react-vendor
// di evaluation order → hooks undefined saat dipanggil → TDZ error.
import React from 'react';
// [BUGFIX] Hook imports tetap di baris ke-2 (setelah React) — urutan ini
// dijamin aman karena React sudah diinisialisasi di baris sebelumnya.
import { useState, useEffect, useCallback } from 'react';
import { ActiveFeatures, SubscriptionStatus } from '../types';
import { getDB } from './mockDb';

const FREEMIUM_KEY = 'paydone_freemium';
const FREEMIUM_EVENT = 'PAYDONE_FREEMIUM_UPDATE';

interface FreemiumState {
  activeFeatures: ActiveFeatures;
  subscriptionStatus: SubscriptionStatus;
}

const DEFAULT_STATUS: SubscriptionStatus = {
  inGracePeriod: false,
  daysLeftGrace: 0,
  isFreeTier: true,
  currentPackage: 'Free',
};

// --- READ ---
export const getFreemiumState = (): FreemiumState => {
  // Priority 1: Read from DB (synced from backend)
  try {
    const db = getDB();
    if (db.activeFeatures || db.subscriptionStatus) {
      return {
        activeFeatures: db.activeFeatures || {},
        subscriptionStatus: db.subscriptionStatus || DEFAULT_STATUS,
      };
    }
  } catch { /* fallback */ }

  // Priority 2: Read from localStorage cache
  try {
    const raw = localStorage.getItem(FREEMIUM_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* fallback */ }

  return { activeFeatures: {}, subscriptionStatus: DEFAULT_STATUS };
};

export const getActiveFeatures = (): ActiveFeatures => getFreemiumState().activeFeatures;
export const getSubscriptionStatus = (): SubscriptionStatus => getFreemiumState().subscriptionStatus;

/**
 * Check if a feature is available.
 * IMPORTANT: If the key does NOT exist in activeFeatures, default to TRUE (backward compat).
 * Only explicitly `false` values are locked.
 */
export const isFeatureAvailable = (featureKey: string): boolean => {
  const features = getActiveFeatures();
  if (!(featureKey in features)) return true; // backward compat: unlocked by default
  return features[featureKey] === true;
};

// --- WRITE ---
export const setFreemiumData = (data: Partial<FreemiumState>) => {
  const current = getFreemiumState();
  const next: FreemiumState = {
    activeFeatures: data.activeFeatures ?? current.activeFeatures,
    subscriptionStatus: data.subscriptionStatus ?? current.subscriptionStatus,
  };

  // Persist to localStorage cache
  localStorage.setItem(FREEMIUM_KEY, JSON.stringify(next));

  // Dispatch event for reactive updates
  window.dispatchEvent(new CustomEvent(FREEMIUM_EVENT, { detail: next }));
};

// --- REACT HOOK ---
export const useFreemium = () => {
  const [state, setState] = useState<FreemiumState>(getFreemiumState);

  const refresh = useCallback(() => setState(getFreemiumState()), []);

  useEffect(() => {
    const onUpdate = () => refresh();
    window.addEventListener(FREEMIUM_EVENT, onUpdate);
    window.addEventListener('PAYDONE_DB_UPDATE', onUpdate);
    return () => {
      window.removeEventListener(FREEMIUM_EVENT, onUpdate);
      window.removeEventListener('PAYDONE_DB_UPDATE', onUpdate);
    };
  }, [refresh]);

  return {
    activeFeatures: state.activeFeatures,
    subscriptionStatus: state.subscriptionStatus,
    isFeatureAvailable: (key: string) => {
      if (!(key in state.activeFeatures)) return true;
      return state.activeFeatures[key] === true;
    },
    isFreeTier: state.subscriptionStatus.isFreeTier,
    inGracePeriod: state.subscriptionStatus.inGracePeriod,
    refresh,
  };
};
