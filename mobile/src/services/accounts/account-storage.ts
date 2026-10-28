import { Platform } from 'react-native';

import { type AccountStore, createEmptyStore } from './accounts';

// Persists the local AccountStore. On web it lives in the browser's
// localStorage (per device and browser); elsewhere it stays in memory for the
// session. Storage can be missing or blocked (private mode), so every access
// falls back to memory instead of throwing.
const STORAGE_KEY = 'the-arena.accounts.v1';
let memoryStore: AccountStore = createEmptyStore();

function webStorage(): Storage | null {
  if (Platform.OS !== 'web') return null;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadAccountStore(): AccountStore {
  const storage = webStorage();
  if (!storage) return memoryStore;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return memoryStore;
    const parsed = JSON.parse(raw) as AccountStore;
    if (parsed?.version !== 1 || !Array.isArray(parsed.accounts)) return memoryStore;
    memoryStore = parsed;
    return parsed;
  } catch {
    return memoryStore;
  }
}

export function saveAccountStore(store: AccountStore): void {
  memoryStore = store;
  try {
    webStorage()?.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Quota or privacy mode: the memory copy still works for this session.
  }
}

// Ids and salts only need to be unique, not secret.
export function createLocalId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
