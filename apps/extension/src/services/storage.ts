/**
 * ClawFi Extension - Storage Service
 * 
 * Manages persistent storage for:
 * - Watchlist
 * - Price alerts
 * - Recent tokens
 * - User preferences
 */

import type { ChainId, WatchlistItem, PriceAlert, TrackedWallet } from './api/types';

// ============================================
// STORAGE KEYS
// ============================================

const STORAGE_KEYS = {
  WATCHLIST: 'clawfi_watchlist',
  ALERTS: 'clawfi_alerts',
  RECENT_TOKENS: 'clawfi_recent',
  TRACKED_WALLETS: 'clawfi_wallets',
  PREFERENCES: 'clawfi_prefs',
};

// ============================================
// WATCHLIST
// ============================================

export interface WatchlistToken {
  address: string;
  chain: ChainId;
  symbol?: string;
  name?: string;
  addedAt: number;
  entryPrice?: number;
  notes?: string;
}

/**
 * Get watchlist
 */
export async function getWatchlist(): Promise<WatchlistToken[]> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.WATCHLIST);
    return result[STORAGE_KEYS.WATCHLIST] || [];
  } catch {
    return [];
  }
}

/**
 * Add token to watchlist
 */
export async function addToWatchlist(token: WatchlistToken): Promise<void> {
  const watchlist = await getWatchlist();
  
  // Check if already exists
  const exists = watchlist.some(
    t => t.address.toLowerCase() === token.address.toLowerCase() && t.chain === token.chain
  );
  
  if (!exists) {
    watchlist.unshift(token);
    await chrome.storage.local.set({ [STORAGE_KEYS.WATCHLIST]: watchlist });
  }
}

/**
 * Remove token from watchlist
 */
export async function removeFromWatchlist(address: string, chain: ChainId): Promise<void> {
  const watchlist = await getWatchlist();
  const filtered = watchlist.filter(
    t => !(t.address.toLowerCase() === address.toLowerCase() && t.chain === chain)
  );
  await chrome.storage.local.set({ [STORAGE_KEYS.WATCHLIST]: filtered });
}

/**
 * Check if token is in watchlist
 */
export async function isInWatchlist(address: string, chain: ChainId): Promise<boolean> {
  const watchlist = await getWatchlist();
  return watchlist.some(
    t => t.address.toLowerCase() === address.toLowerCase() && t.chain === chain
  );
}

/**
 * Update watchlist token
 */
export async function updateWatchlistToken(
  address: string,
  chain: ChainId,
  updates: Partial<WatchlistToken>
): Promise<void> {
  const watchlist = await getWatchlist();
  const index = watchlist.findIndex(
    t => t.address.toLowerCase() === address.toLowerCase() && t.chain === chain
  );
  
  if (index !== -1) {
    watchlist[index] = { ...watchlist[index], ...updates };
    await chrome.storage.local.set({ [STORAGE_KEYS.WATCHLIST]: watchlist });
  }
}

// ============================================
// PRICE ALERTS
// ============================================

export interface StoredPriceAlert {
  id: string;
  address: string;
  chain: ChainId;
  type: 'above' | 'below' | 'change';
  value: number;
  enabled: boolean;
  triggered?: boolean;
  triggeredAt?: number;
  createdAt: number;
  symbol?: string;
}

/**
 * Get all alerts
 */
export async function getAlerts(): Promise<StoredPriceAlert[]> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.ALERTS);
    return result[STORAGE_KEYS.ALERTS] || [];
  } catch {
    return [];
  }
}

/**
 * Add price alert
 */
export async function addAlert(alert: Omit<StoredPriceAlert, 'id' | 'createdAt'>): Promise<StoredPriceAlert> {
  const alerts = await getAlerts();
  const newAlert: StoredPriceAlert = {
    ...alert,
    id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
  };
  
  alerts.unshift(newAlert);
  await chrome.storage.local.set({ [STORAGE_KEYS.ALERTS]: alerts });
  return newAlert;
}

/**
 * Remove alert
 */
export async function removeAlert(alertId: string): Promise<void> {
  const alerts = await getAlerts();
  const filtered = alerts.filter(a => a.id !== alertId);
  await chrome.storage.local.set({ [STORAGE_KEYS.ALERTS]: filtered });
}

/**
 * Update alert
 */
export async function updateAlert(alertId: string, updates: Partial<StoredPriceAlert>): Promise<void> {
  const alerts = await getAlerts();
  const index = alerts.findIndex(a => a.id === alertId);
  
  if (index !== -1) {
    alerts[index] = { ...alerts[index], ...updates };
    await chrome.storage.local.set({ [STORAGE_KEYS.ALERTS]: alerts });
  }
}

/**
 * Mark alert as triggered
 */
export async function triggerAlert(alertId: string): Promise<void> {
  await updateAlert(alertId, { triggered: true, triggeredAt: Date.now() });
}

/**
 * Get alerts for a token
 */
export async function getTokenAlerts(address: string, chain: ChainId): Promise<StoredPriceAlert[]> {
  const alerts = await getAlerts();
  return alerts.filter(
    a => a.address.toLowerCase() === address.toLowerCase() && a.chain === chain
  );
}

// ============================================
// RECENT TOKENS
// ============================================

export interface RecentToken {
  address: string;
  chain: ChainId;
  symbol?: string;
  name?: string;
  lastViewed: number;
  source?: string;
}

const MAX_RECENT = 50;

/**
 * Get recent tokens
 */
export async function getRecentTokens(): Promise<RecentToken[]> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.RECENT_TOKENS);
    return result[STORAGE_KEYS.RECENT_TOKENS] || [];
  } catch {
    return [];
  }
}

/**
 * Add recent token
 */
export async function addRecentToken(token: RecentToken): Promise<void> {
  const recent = await getRecentTokens();
  
  // Remove if already exists
  const filtered = recent.filter(
    t => !(t.address.toLowerCase() === token.address.toLowerCase() && t.chain === token.chain)
  );
  
  // Add to front
  filtered.unshift({ ...token, lastViewed: Date.now() });
  
  // Limit size
  const trimmed = filtered.slice(0, MAX_RECENT);
  
  await chrome.storage.local.set({ [STORAGE_KEYS.RECENT_TOKENS]: trimmed });
}

/**
 * Clear recent tokens
 */
export async function clearRecentTokens(): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.RECENT_TOKENS]: [] });
}

// ============================================
// TRACKED WALLETS
// ============================================

/**
 * Get tracked wallets
 */
export async function getTrackedWallets(): Promise<TrackedWallet[]> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.TRACKED_WALLETS);
    return result[STORAGE_KEYS.TRACKED_WALLETS] || [];
  } catch {
    return [];
  }
}

/**
 * Add tracked wallet
 */
export async function addTrackedWallet(wallet: TrackedWallet): Promise<void> {
  const wallets = await getTrackedWallets();
  
  // Check if already exists
  const exists = wallets.some(
    w => w.address.toLowerCase() === wallet.address.toLowerCase() && w.chain === wallet.chain
  );
  
  if (!exists) {
    wallets.unshift(wallet);
    await chrome.storage.local.set({ [STORAGE_KEYS.TRACKED_WALLETS]: wallets });
  }
}

/**
 * Remove tracked wallet
 */
export async function removeTrackedWallet(address: string, chain: ChainId): Promise<void> {
  const wallets = await getTrackedWallets();
  const filtered = wallets.filter(
    w => !(w.address.toLowerCase() === address.toLowerCase() && w.chain === chain)
  );
  await chrome.storage.local.set({ [STORAGE_KEYS.TRACKED_WALLETS]: filtered });
}

// ============================================
// USER PREFERENCES
// ============================================

export interface UserPreferences {
  theme: 'dark' | 'light' | 'system';
  defaultChain: ChainId;
  showRiskWarnings: boolean;
  autoExpandOverlay: boolean;
  enableNotifications: boolean;
  enableHoverCards: boolean;
  notificationSound: boolean;
  compactMode: boolean;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'dark',
  defaultChain: 'ethereum',
  showRiskWarnings: true,
  autoExpandOverlay: false,
  enableNotifications: true,
  enableHoverCards: true,
  notificationSound: true,
  compactMode: false,
};

/**
 * Get preferences
 */
export async function getPreferences(): Promise<UserPreferences> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.PREFERENCES);
    return { ...DEFAULT_PREFERENCES, ...(result[STORAGE_KEYS.PREFERENCES] || {}) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/**
 * Update preferences
 */
export async function updatePreferences(updates: Partial<UserPreferences>): Promise<void> {
  const current = await getPreferences();
  await chrome.storage.local.set({
    [STORAGE_KEYS.PREFERENCES]: { ...current, ...updates },
  });
}

// ============================================
// EXPORT ALL
// ============================================

export const storage = {
  // Watchlist
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  isInWatchlist,
  updateWatchlistToken,
  
  // Alerts
  getAlerts,
  addAlert,
  removeAlert,
  updateAlert,
  triggerAlert,
  getTokenAlerts,
  
  // Recent
  getRecentTokens,
  addRecentToken,
  clearRecentTokens,
  
  // Wallets
  getTrackedWallets,
  addTrackedWallet,
  removeTrackedWallet,
  
  // Preferences
  getPreferences,
  updatePreferences,
};

export default storage;
