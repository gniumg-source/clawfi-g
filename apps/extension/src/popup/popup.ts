/**
 * ClawFi Extension - Liquid Glass Popup
 * v0.4.2 - Fully Functional
 */

import { getWatchlist, getAlerts, getRecentTokens, type WatchlistToken, type StoredPriceAlert, type RecentToken } from '../services/storage';
import { dexscreenerAPI } from '../services/api/dexscreener';
import type { TrendingToken } from '../services/api/types';

// ============================================
// STATE
// ============================================

interface PopupState {
  activeTab: 'home' | 'watchlist' | 'trending' | 'alerts';
  loading: boolean;
  connected: boolean;
  error: string | null;
  watchlist: WatchlistToken[];
  alerts: StoredPriceAlert[];
  recent: RecentToken[];
  trending: TrendingToken[];
  trendingLoading: boolean;
}

let state: PopupState = {
  activeTab: 'home',
  loading: true,
  connected: true,
  error: null,
  watchlist: [],
  alerts: [],
  recent: [],
  trending: [],
  trendingLoading: false,
};

// ============================================
// STYLES
// ============================================

const styles = `
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  
  body {
    width: 400px;
    height: 580px;
    overflow: hidden;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
    background: linear-gradient(145deg, #0a0a12 0%, #12121a 50%, #0d0d15 100%);
    color: rgba(255, 255, 255, 0.95);
    -webkit-font-smoothing: antialiased;
  }
  
  body::before {
    content: '';
    position: fixed;
    inset: 0;
    background: 
      radial-gradient(ellipse at 20% 0%, rgba(10, 132, 255, 0.15) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 100%, rgba(88, 86, 214, 0.12) 0%, transparent 50%);
    pointer-events: none;
  }
  
  .popup {
    display: flex;
    flex-direction: column;
    height: 100%;
    position: relative;
    z-index: 1;
  }
  
  .header {
    padding: 20px;
    background: linear-gradient(180deg, rgba(10, 132, 255, 0.2) 0%, transparent 100%);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .header-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }
  
  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .logo {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: linear-gradient(135deg, #0A84FF 0%, #5856D6 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 16px rgba(10, 132, 255, 0.3);
  }
  
  .logo img {
    width: 28px;
    height: 28px;
    border-radius: 6px;
  }
  
  .brand-text h1 {
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.5px;
  }
  
  .brand-text span {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
  }
  
  .header-actions {
    display: flex;
    gap: 8px;
  }
  
  .icon-btn {
    width: 38px;
    height: 38px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.05);
    cursor: pointer;
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }
  
  .icon-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  
  .status-bar {
    display: flex;
    gap: 12px;
  }
  
  .status-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 100px;
    font-size: 12px;
  }
  
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #30D158;
    box-shadow: 0 0 8px #30D158;
  }
  
  .status-dot.offline {
    background: #FF453A;
    box-shadow: 0 0 8px #FF453A;
  }
  
  .tabs {
    display: flex;
    padding: 12px 16px;
    gap: 8px;
    background: rgba(0, 0, 0, 0.2);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
  
  .tab {
    flex: 1;
    padding: 12px 8px;
    border: none;
    border-radius: 10px;
    background: transparent;
    color: rgba(255, 255, 255, 0.6);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  
  .tab:hover {
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.9);
  }
  
  .tab.active {
    background: rgba(10, 132, 255, 0.2);
    color: #0A84FF;
    border: 1px solid rgba(10, 132, 255, 0.3);
  }
  
  .tab-icon {
    font-size: 20px;
  }
  
  .tab-badge {
    background: #FF453A;
    color: white;
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 10px;
    margin-left: 4px;
  }
  
  .content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }
  
  .content::-webkit-scrollbar {
    width: 4px;
  }
  
  .content::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 2px;
  }
  
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    margin-bottom: 20px;
  }
  
  .stat-card {
    padding: 16px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
  }
  
  .stat-label {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 6px;
  }
  
  .stat-value {
    font-size: 28px;
    font-weight: 700;
    color: #0A84FF;
  }
  
  .quick-actions {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin-bottom: 20px;
  }
  
  .quick-action {
    padding: 14px 8px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.03);
    text-decoration: none;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;
    color: inherit;
  }
  
  .quick-action:hover {
    background: rgba(255, 255, 255, 0.08);
    transform: translateY(-2px);
  }
  
  .quick-action-icon {
    font-size: 24px;
    display: block;
    margin-bottom: 6px;
  }
  
  .quick-action-label {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.6);
  }
  
  .card {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    overflow: hidden;
    margin-bottom: 16px;
  }
  
  .card-header {
    padding: 14px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
  
  .card-title {
    font-size: 14px;
    font-weight: 600;
  }
  
  .card-body {
    padding: 0;
  }
  
  .empty-state {
    text-align: center;
    padding: 30px;
    color: rgba(255, 255, 255, 0.4);
  }
  
  .empty-icon {
    font-size: 40px;
    margin-bottom: 12px;
    opacity: 0.5;
  }
  
  .token-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .token-item:hover {
    background: rgba(255, 255, 255, 0.05);
  }
  
  .token-item:last-child {
    border-bottom: none;
  }
  
  .token-info {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 0;
  }
  
  .token-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: linear-gradient(135deg, rgba(10, 132, 255, 0.3), rgba(88, 86, 214, 0.3));
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    flex-shrink: 0;
  }
  
  .token-icon img {
    width: 100%;
    height: 100%;
    border-radius: 10px;
    object-fit: cover;
  }
  
  .token-details {
    min-width: 0;
    flex: 1;
  }
  
  .token-symbol {
    font-weight: 600;
    font-size: 14px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .token-name {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .token-chain {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.4);
    background: rgba(255, 255, 255, 0.08);
    padding: 2px 6px;
    border-radius: 4px;
    text-transform: uppercase;
  }
  
  .token-price {
    text-align: right;
    flex-shrink: 0;
  }
  
  .token-price-value {
    font-weight: 600;
    font-size: 14px;
  }
  
  .token-change {
    font-size: 12px;
  }
  
  .token-change.positive {
    color: #30D158;
  }
  
  .token-change.negative {
    color: #FF453A;
  }
  
  .alert-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }
  
  .alert-item:last-child {
    border-bottom: none;
  }
  
  .alert-info {
    flex: 1;
  }
  
  .alert-symbol {
    font-weight: 600;
    font-size: 14px;
  }
  
  .alert-condition {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
  }
  
  .alert-status {
    font-size: 10px;
    padding: 4px 8px;
    border-radius: 6px;
  }
  
  .alert-status.active {
    background: rgba(48, 209, 88, 0.2);
    color: #30D158;
  }
  
  .alert-status.triggered {
    background: rgba(255, 149, 0, 0.2);
    color: #FF9500;
  }
  
  .loading-spinner {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 30px;
  }
  
  .spinner {
    width: 24px;
    height: 24px;
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-top-color: #0A84FF;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .footer {
    padding: 14px 20px;
    background: rgba(0, 0, 0, 0.3);
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  
  .footer-version {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
  }
  
  .btn-dashboard {
    padding: 10px 20px;
    border: none;
    border-radius: 100px;
    background: linear-gradient(135deg, #0A84FF 0%, #5856D6 100%);
    color: white;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s;
  }
  
  .btn-dashboard:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(10, 132, 255, 0.4);
  }
  
  .error-banner {
    background: rgba(255, 69, 58, 0.15);
    border: 1px solid rgba(255, 69, 58, 0.3);
    color: #FF453A;
    padding: 12px 16px;
    border-radius: 10px;
    margin-bottom: 16px;
    font-size: 13px;
  }
  
  .rank-badge {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.6);
    margin-right: 8px;
  }
  
  .rank-badge.top3 {
    background: linear-gradient(135deg, #FFD700 0%, #FF9500 100%);
    color: #000;
  }
`;

// ============================================
// HELPERS
// ============================================

function getIconUrl(): string {
  try {
    return chrome.runtime.getURL('icons/icon48.png');
  } catch {
    return '../icons/icon48.png';
  }
}

function formatPrice(price: number): string {
  if (price === 0) return '$0.00';
  if (price < 0.0001) return `$${price.toExponential(2)}`;
  if (price < 1) return `$${price.toFixed(6)}`;
  if (price < 1000) return `$${price.toFixed(2)}`;
  return `$${(price / 1000).toFixed(1)}K`;
}

function formatChange(change: number): string {
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(2)}%`;
}

function truncateAddress(addr: string): string {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// ============================================
// DATA LOADING
// ============================================

async function loadLocalData(): Promise<void> {
  try {
    const [watchlist, alerts, recent] = await Promise.all([
      getWatchlist(),
      getAlerts(),
      getRecentTokens(),
    ]);
    
    state.watchlist = watchlist;
    state.alerts = alerts;
    state.recent = recent;
    state.loading = false;
    render();
  } catch (error) {
    console.error('[ClawFi] Error loading local data:', error);
    state.loading = false;
    render();
  }
}

async function loadTrendingData(): Promise<void> {
  if (state.trendingLoading) return;
  
  state.trendingLoading = true;
  render();
  
  try {
    const trending = await dexscreenerAPI.getBoostedTokens();
    state.trending = trending.slice(0, 10);
  } catch (error) {
    console.error('[ClawFi] Error loading trending:', error);
    state.trending = [];
  }
  
  state.trendingLoading = false;
  render();
}

// ============================================
// RENDER
// ============================================

function render(): void {
  const app = document.getElementById('app');
  if (!app) return;

  const iconUrl = getIconUrl();
  const activeAlerts = state.alerts.filter(a => a.enabled && !a.triggered).length;

  app.innerHTML = `
    <div class="popup">
      <div class="header">
        <div class="header-top">
          <div class="brand">
            <div class="logo">
              <img src="${iconUrl}" alt="ClawFi" onerror="this.style.display='none'">
            </div>
            <div class="brand-text">
              <h1>ClawFi</h1>
              <span>Degen Trading Assistant</span>
            </div>
          </div>
          <div class="header-actions">
            <button class="icon-btn" id="refresh-btn" title="Refresh">🔄</button>
            <button class="icon-btn" id="settings-btn" title="Settings">⚙️</button>
          </div>
        </div>
        <div class="status-bar">
          <div class="status-item">
            <span class="status-dot ${state.connected ? '' : 'offline'}"></span>
            <span>${state.connected ? 'Active' : 'Offline'}</span>
          </div>
          <div class="status-item">
            <span>🦀</span>
            <span>v0.4.2</span>
          </div>
        </div>
      </div>
      
      <div class="tabs">
        <button class="tab ${state.activeTab === 'home' ? 'active' : ''}" data-tab="home">
          <span class="tab-icon">🏠</span>
          <span>Home</span>
        </button>
        <button class="tab ${state.activeTab === 'watchlist' ? 'active' : ''}" data-tab="watchlist">
          <span class="tab-icon">⭐</span>
          <span>Watch${state.watchlist.length > 0 ? ` (${state.watchlist.length})` : ''}</span>
        </button>
        <button class="tab ${state.activeTab === 'trending' ? 'active' : ''}" data-tab="trending">
          <span class="tab-icon">🔥</span>
          <span>Hot</span>
        </button>
        <button class="tab ${state.activeTab === 'alerts' ? 'active' : ''}" data-tab="alerts">
          <span class="tab-icon">🔔</span>
          <span>Alerts${activeAlerts > 0 ? `<span class="tab-badge">${activeAlerts}</span>` : ''}</span>
        </button>
      </div>
      
      <div class="content">
        ${state.error ? `<div class="error-banner">${state.error}</div>` : ''}
        ${state.loading ? renderLoading() : renderContent()}
      </div>
      
      <div class="footer">
        <span class="footer-version">ClawFi v0.4.2</span>
        <button class="btn-dashboard" id="dashboard-btn">
          🦀 Open Dashboard
        </button>
      </div>
    </div>
  `;

  attachListeners();
}

function renderLoading(): string {
  return `
    <div class="loading-spinner">
      <div class="spinner"></div>
    </div>
  `;
}

function renderContent(): string {
  switch (state.activeTab) {
    case 'home':
      return renderHome();
    case 'watchlist':
      return renderWatchlist();
    case 'trending':
      return renderTrending();
    case 'alerts':
      return renderAlerts();
    default:
      return '';
  }
}

function renderHome(): string {
  const activeAlerts = state.alerts.filter(a => a.enabled && !a.triggered).length;
  
  return `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Watchlist</div>
        <div class="stat-value">${state.watchlist.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Active Alerts</div>
        <div class="stat-value">${activeAlerts}</div>
      </div>
    </div>
    
    <div class="quick-actions">
      <a class="quick-action" href="https://dexscreener.com" target="_blank">
        <span class="quick-action-icon">📊</span>
        <span class="quick-action-label">DEXScreener</span>
      </a>
      <a class="quick-action" href="https://jup.ag" target="_blank">
        <span class="quick-action-icon">🪐</span>
        <span class="quick-action-label">Jupiter</span>
      </a>
      <a class="quick-action" href="https://pump.fun" target="_blank">
        <span class="quick-action-icon">🎰</span>
        <span class="quick-action-label">Pump.fun</span>
      </a>
      <a class="quick-action" href="https://clanker.world" target="_blank">
        <span class="quick-action-icon">🚀</span>
        <span class="quick-action-label">Clanker</span>
      </a>
    </div>
    
    <div class="card">
      <div class="card-header">
        <span class="card-title">🕐 Recent Activity</span>
      </div>
      <div class="card-body">
        ${state.recent.length > 0 ? renderRecentTokens() : `
          <div class="empty-state">
            <div class="empty-icon">🔍</div>
            <p>Browse DEX sites to see history</p>
          </div>
        `}
      </div>
    </div>
  `;
}

function renderRecentTokens(): string {
  return state.recent.slice(0, 5).map(token => `
    <div class="token-item" data-address="${token.address}" data-chain="${token.chain}">
      <div class="token-info">
        <div class="token-icon">🪙</div>
        <div class="token-details">
          <div class="token-symbol">${token.symbol || truncateAddress(token.address)}</div>
          <div class="token-name">${token.name || token.source || 'Token'}</div>
        </div>
      </div>
      <div class="token-price">
        <span class="token-chain">${token.chain}</span>
        <div class="token-name">${timeAgo(token.lastViewed)}</div>
      </div>
    </div>
  `).join('');
}

function renderWatchlist(): string {
  if (state.watchlist.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-icon">⭐</div>
        <p>No tokens in watchlist</p>
        <p style="font-size: 12px; margin-top: 8px;">Add tokens while browsing DEX sites</p>
      </div>
    `;
  }

  return `
    <div class="card">
      <div class="card-body">
        ${state.watchlist.map(token => `
          <div class="token-item" data-address="${token.address}" data-chain="${token.chain}">
            <div class="token-info">
              <div class="token-icon">⭐</div>
              <div class="token-details">
                <div class="token-symbol">${token.symbol || truncateAddress(token.address)}</div>
                <div class="token-name">${token.name || token.chain}</div>
              </div>
            </div>
            <div class="token-price">
              <span class="token-chain">${token.chain}</span>
              <div class="token-name">Added ${timeAgo(token.addedAt)}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderTrending(): string {
  if (state.trendingLoading) {
    return renderLoading();
  }

  if (state.trending.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-icon">🔥</div>
        <p>No trending tokens found</p>
        <p style="font-size: 12px; margin-top: 8px;">Pull to refresh</p>
      </div>
    `;
  }

  return `
    <div class="card">
      <div class="card-header">
        <span class="card-title">🔥 Trending on Dexscreener</span>
      </div>
      <div class="card-body">
        ${state.trending.map((item, index) => `
          <div class="token-item" data-address="${item.token.address}" data-chain="${item.pair.chain}" data-url="${item.pair.url || ''}">
            <div class="token-info">
              <span class="rank-badge ${index < 3 ? 'top3' : ''}">${index + 1}</span>
              <div class="token-icon">
                ${item.token.logoUrl ? `<img src="${item.token.logoUrl}" onerror="this.parentElement.innerHTML='🔥'">` : '🔥'}
              </div>
              <div class="token-details">
                <div class="token-symbol">${item.token.symbol || truncateAddress(item.token.address)}</div>
                <div class="token-name">${item.token.name || 'Unknown'}</div>
              </div>
            </div>
            <div class="token-price">
              <span class="token-chain">${item.pair.chain}</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderAlerts(): string {
  if (state.alerts.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-icon">🔔</div>
        <p>No price alerts</p>
        <p style="font-size: 12px; margin-top: 8px;">Create alerts from token overlays</p>
      </div>
    `;
  }

  return `
    <div class="card">
      <div class="card-body">
        ${state.alerts.map(alert => `
          <div class="alert-item">
            <div class="alert-info">
              <div class="alert-symbol">${alert.symbol || truncateAddress(alert.address)}</div>
              <div class="alert-condition">
                ${alert.type === 'above' ? '↑' : alert.type === 'below' ? '↓' : '↔'} 
                ${alert.type === 'change' ? `${alert.value}%` : formatPrice(alert.value)}
              </div>
            </div>
            <span class="alert-status ${alert.triggered ? 'triggered' : 'active'}">
              ${alert.triggered ? 'Triggered' : 'Active'}
            </span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ============================================
// EVENT LISTENERS
// ============================================

function attachListeners(): void {
  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      const newTab = target.dataset.tab as PopupState['activeTab'];
      state.activeTab = newTab;
      
      // Load trending data when switching to trending tab
      if (newTab === 'trending' && state.trending.length === 0) {
        loadTrendingData();
      }
      
      render();
    });
  });

  // Refresh button
  document.getElementById('refresh-btn')?.addEventListener('click', async () => {
    state.loading = true;
    render();
    await loadLocalData();
    if (state.activeTab === 'trending') {
      await loadTrendingData();
    }
  });

  // Settings button
  document.getElementById('settings-btn')?.addEventListener('click', () => {
    chrome.runtime.openOptionsPage?.();
  });

  // Dashboard button - Open trending on Dexscreener
  document.getElementById('dashboard-btn')?.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://dexscreener.com/new-pairs' });
  });

  // Token items click - open in dexscreener
  document.querySelectorAll('.token-item').forEach(item => {
    item.addEventListener('click', () => {
      const el = item as HTMLElement;
      const url = el.dataset.url;
      const address = el.dataset.address;
      const chain = el.dataset.chain;
      
      if (url) {
        chrome.tabs.create({ url });
      } else if (address && chain) {
        chrome.tabs.create({ url: `https://dexscreener.com/${chain}/${address}` });
      }
    });
  });
}

// ============================================
// INIT
// ============================================

function init(): void {
  console.log('[ClawFi Popup] Initializing v0.4.2...');
  
  // Add styles
  const styleEl = document.createElement('style');
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);
  
  // Load data and render
  loadLocalData();
}

// Start
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
