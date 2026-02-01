/**
 * ClawFi Extension - PancakeSwap Content Script
 * 
 * Detects tokens on PancakeSwap and shows ClawFi overlay
 * Supports: BSC, Ethereum, Base, Arbitrum
 */

import { unifiedDataService, tokenSafetyChecker } from '../../services/api';
import type { ChainId, MarketData, TokenSafety } from '../../services/api/types';
import { initHoverCards } from '../components/TokenHoverCard';

const VERSION = '0.3.1';
const ETH_ADDRESS_REGEX = /0x[a-fA-F0-9]{40}/;

// Get extension icon URL
function getIconUrl(size: number = 48): string {
  try {
    return chrome.runtime.getURL(`icons/icon${size}.png`);
  } catch {
    return '';
  }
}

// State
let currentToken: string | null = null;
let currentChain: ChainId = 'bsc';
let overlayContainer: HTMLDivElement | null = null;
let shadowRoot: ShadowRoot | null = null;

interface OverlayState {
  loading: boolean;
  token: string;
  chain: ChainId;
  marketData: MarketData | null;
  safety: TokenSafety | null;
  expanded: boolean;
}

let state: OverlayState | null = null;

/**
 * Detect chain from URL/page
 */
function detectChain(): ChainId {
  const url = window.location.href.toLowerCase();
  const params = new URLSearchParams(window.location.search);
  const chainParam = params.get('chain')?.toLowerCase();
  
  if (chainParam === 'eth' || chainParam === 'ethereum' || chainParam === '1') return 'ethereum';
  if (chainParam === 'base' || chainParam === '8453') return 'base';
  if (chainParam === 'arb' || chainParam === 'arbitrum' || chainParam === '42161') return 'arbitrum';
  
  if (url.includes('chain=eth') || url.includes('chain=1')) return 'ethereum';
  if (url.includes('chain=base') || url.includes('chain=8453')) return 'base';
  if (url.includes('chain=arbitrum') || url.includes('chain=42161')) return 'arbitrum';
  
  return 'bsc'; // Default
}

/**
 * Extract token from URL
 */
function extractTokenFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  
  // Check outputCurrency first
  const outputCurrency = params.get('outputCurrency');
  if (outputCurrency && ETH_ADDRESS_REGEX.test(outputCurrency)) {
    return outputCurrency;
  }
  
  // Check inputCurrency
  const inputCurrency = params.get('inputCurrency');
  if (inputCurrency && ETH_ADDRESS_REGEX.test(inputCurrency)) {
    // Skip if it's a native token address
    if (inputCurrency.toLowerCase() !== '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
      return inputCurrency;
    }
  }
  
  // Try path /swap/TOKEN
  const pathMatch = window.location.pathname.match(/\/swap\/(0x[a-fA-F0-9]{40})/i);
  if (pathMatch) {
    return pathMatch[1];
  }
  
  return null;
}

/**
 * Get overlay styles
 */
function getStyles(): string {
  return `
    :host {
      all: initial;
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif;
    }
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    .clawfi-pcs-overlay {
      position: fixed;
      top: 80px;
      right: 20px;
      z-index: 2147483647;
      font-size: 13px;
      -webkit-font-smoothing: antialiased;
    }
    
    .clawfi-pcs-fab {
      width: 56px;
      height: 56px;
      border-radius: 16px;
      background: linear-gradient(180deg, rgba(31, 199, 212, 0.9) 0%, rgba(118, 69, 217, 0.9) 100%);
      border: 1px solid rgba(255, 255, 255, 0.25);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 10px 40px rgba(31, 199, 212, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3);
      transition: all 0.3s ease;
      position: relative;
    }
    
    .clawfi-pcs-fab:hover { transform: scale(1.05); }
    
    .clawfi-pcs-fab-icon {
      width: 32px;
      height: 32px;
      border-radius: 8px;
    }
    
    .clawfi-pcs-fab-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      min-width: 20px;
      height: 20px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 5px;
    }
    
    .clawfi-pcs-fab-badge.safe { background: #30D158; color: white; }
    .clawfi-pcs-fab-badge.low { background: #0A84FF; color: white; }
    .clawfi-pcs-fab-badge.medium { background: #FFD60A; color: black; }
    .clawfi-pcs-fab-badge.high { background: #FF9F0A; color: white; }
    .clawfi-pcs-fab-badge.critical { background: #FF453A; color: white; }
    
    .clawfi-pcs-panel {
      width: 340px;
      background: rgba(20, 20, 30, 0.9);
      backdrop-filter: blur(40px);
      border-radius: 20px;
      border: 1px solid rgba(255, 255, 255, 0.15);
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      overflow: hidden;
      animation: slideIn 0.25s ease;
    }
    
    @keyframes slideIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .clawfi-pcs-header {
      padding: 14px 16px;
      background: linear-gradient(180deg, rgba(31, 199, 212, 0.8) 0%, rgba(118, 69, 217, 0.8) 100%);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .clawfi-pcs-header-title {
      display: flex;
      align-items: center;
      gap: 8px;
      color: white;
      font-weight: 600;
      font-size: 15px;
    }
    
    .clawfi-pcs-header-logo {
      width: 22px;
      height: 22px;
      border-radius: 5px;
    }
    
    .clawfi-pcs-close {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      font-size: 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .clawfi-pcs-body { padding: 16px; }
    
    .clawfi-pcs-address {
      font-family: 'SF Mono', monospace;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.7);
      background: rgba(255, 255, 255, 0.08);
      padding: 8px 12px;
      border-radius: 10px;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .clawfi-pcs-chain-badge {
      font-size: 10px;
      padding: 3px 8px;
      border-radius: 100px;
      background: rgba(31, 199, 212, 0.3);
      color: #1FC7D4;
      border: 1px solid rgba(31, 199, 212, 0.5);
      text-transform: uppercase;
    }
    
    .clawfi-pcs-risk {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 14px;
      border-radius: 12px;
      margin-bottom: 14px;
    }
    
    .clawfi-pcs-risk.safe { background: rgba(48, 209, 88, 0.15); border: 1px solid rgba(48, 209, 88, 0.3); }
    .clawfi-pcs-risk.low { background: rgba(10, 132, 255, 0.15); border: 1px solid rgba(10, 132, 255, 0.3); }
    .clawfi-pcs-risk.medium { background: rgba(255, 214, 10, 0.15); border: 1px solid rgba(255, 214, 10, 0.3); }
    .clawfi-pcs-risk.high { background: rgba(255, 159, 10, 0.15); border: 1px solid rgba(255, 159, 10, 0.3); }
    .clawfi-pcs-risk.critical { background: rgba(255, 69, 58, 0.15); border: 1px solid rgba(255, 69, 58, 0.3); }
    
    .clawfi-pcs-risk-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }
    
    .clawfi-pcs-risk.safe .clawfi-pcs-risk-dot { background: #30D158; box-shadow: 0 0 10px #30D158; }
    .clawfi-pcs-risk.low .clawfi-pcs-risk-dot { background: #0A84FF; box-shadow: 0 0 10px #0A84FF; }
    .clawfi-pcs-risk.medium .clawfi-pcs-risk-dot { background: #FFD60A; box-shadow: 0 0 10px #FFD60A; }
    .clawfi-pcs-risk.high .clawfi-pcs-risk-dot { background: #FF9F0A; box-shadow: 0 0 10px #FF9F0A; }
    .clawfi-pcs-risk.critical .clawfi-pcs-risk-dot { background: #FF453A; box-shadow: 0 0 10px #FF453A; }
    
    .clawfi-pcs-risk-text { flex: 1; color: white; font-weight: 500; font-size: 14px; }
    .clawfi-pcs-risk-score { color: rgba(255, 255, 255, 0.6); font-size: 12px; }
    
    .clawfi-pcs-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      margin-bottom: 14px;
    }
    
    .clawfi-pcs-stat {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      padding: 12px;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    
    .clawfi-pcs-stat-label {
      font-size: 10px;
      color: rgba(255, 255, 255, 0.4);
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    
    .clawfi-pcs-stat-value { font-size: 16px; font-weight: 600; color: white; }
    .clawfi-pcs-stat-sub { font-size: 11px; margin-top: 2px; }
    .clawfi-pcs-stat-sub.positive { color: #30D158; }
    .clawfi-pcs-stat-sub.negative { color: #FF453A; }
    
    .clawfi-pcs-actions { display: flex; gap: 10px; }
    
    .clawfi-pcs-btn {
      flex: 1;
      padding: 12px;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.15);
      background: rgba(255, 255, 255, 0.08);
      color: white;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      text-align: center;
      text-decoration: none;
      transition: all 0.2s;
    }
    
    .clawfi-pcs-btn:hover { background: rgba(255, 255, 255, 0.15); }
    
    .clawfi-pcs-btn.primary {
      background: linear-gradient(135deg, rgba(31, 199, 212, 0.5) 0%, rgba(118, 69, 217, 0.5) 100%);
      border-color: rgba(31, 199, 212, 0.6);
    }
    
    .clawfi-pcs-loading {
      padding: 40px;
      text-align: center;
      color: rgba(255, 255, 255, 0.5);
    }
    
    .clawfi-pcs-spinner {
      width: 28px;
      height: 28px;
      border: 2px solid rgba(255, 255, 255, 0.1);
      border-top-color: #1FC7D4;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 12px;
    }
    
    @keyframes spin { to { transform: rotate(360deg); } }
    
    .clawfi-pcs-footer {
      padding: 12px 16px;
      background: rgba(0, 0, 0, 0.2);
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      font-size: 11px;
      color: rgba(255, 255, 255, 0.4);
      text-align: center;
    }
  `;
}

/**
 * Format number
 */
function formatNumber(num: number): string {
  if (num >= 1000000000) return (num / 1000000000).toFixed(2) + 'B';
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toFixed(0);
}

/**
 * Render overlay
 */
function render(): void {
  if (!shadowRoot || !state) return;
  
  const iconUrl = getIconUrl(32);
  const riskLevel = state.safety?.overallRisk || 'low';
  const riskBadge = tokenSafetyChecker.getRiskBadge(riskLevel);
  
  if (!state.expanded) {
    shadowRoot.innerHTML = `
      <style>${getStyles()}</style>
      <div class="clawfi-pcs-overlay">
        <button class="clawfi-pcs-fab" id="expand-btn">
          ${iconUrl ? `<img class="clawfi-pcs-fab-icon" src="${iconUrl}">` : '🦀'}
          <span class="clawfi-pcs-fab-badge ${riskLevel}">${riskBadge.emoji}</span>
        </button>
      </div>
    `;
  } else {
    const { marketData, safety, chain } = state;
    const dexUrl = unifiedDataService.getDexscreenerUrl(chain, state.token);
    
    shadowRoot.innerHTML = `
      <style>${getStyles()}</style>
      <div class="clawfi-pcs-overlay">
        <div class="clawfi-pcs-panel">
          <div class="clawfi-pcs-header">
            <div class="clawfi-pcs-header-title">
              ${iconUrl ? `<img class="clawfi-pcs-header-logo" src="${iconUrl}">` : '🦀'}
              ClawFi
            </div>
            <button class="clawfi-pcs-close" id="close-btn">×</button>
          </div>
          
          <div class="clawfi-pcs-body">
            ${state.loading ? `
              <div class="clawfi-pcs-loading">
                <div class="clawfi-pcs-spinner"></div>
                Analyzing token...
              </div>
            ` : `
              <div class="clawfi-pcs-address">
                <span>${state.token.slice(0, 8)}...${state.token.slice(-6)}</span>
                <span class="clawfi-pcs-chain-badge">${chain}</span>
              </div>
              
              <div class="clawfi-pcs-risk ${riskLevel}">
                <span class="clawfi-pcs-risk-dot"></span>
                <span class="clawfi-pcs-risk-text">${riskBadge.text}</span>
                <span class="clawfi-pcs-risk-score">${safety?.riskScore || 0}/100</span>
              </div>
              
              ${marketData ? `
                <div class="clawfi-pcs-grid">
                  <div class="clawfi-pcs-stat">
                    <div class="clawfi-pcs-stat-label">Price</div>
                    <div class="clawfi-pcs-stat-value">$${marketData.priceUsd < 0.01 ? marketData.priceUsd.toExponential(2) : marketData.priceUsd.toFixed(4)}</div>
                    <div class="clawfi-pcs-stat-sub ${marketData.priceChange24h >= 0 ? 'positive' : 'negative'}">
                      ${marketData.priceChange24h >= 0 ? '+' : ''}${marketData.priceChange24h.toFixed(2)}%
                    </div>
                  </div>
                  <div class="clawfi-pcs-stat">
                    <div class="clawfi-pcs-stat-label">Liquidity</div>
                    <div class="clawfi-pcs-stat-value">$${formatNumber(marketData.liquidity)}</div>
                  </div>
                  <div class="clawfi-pcs-stat">
                    <div class="clawfi-pcs-stat-label">Volume 24h</div>
                    <div class="clawfi-pcs-stat-value">$${formatNumber(marketData.volume24h)}</div>
                  </div>
                  <div class="clawfi-pcs-stat">
                    <div class="clawfi-pcs-stat-label">Market Cap</div>
                    <div class="clawfi-pcs-stat-value">${marketData.marketCap ? '$' + formatNumber(marketData.marketCap) : 'N/A'}</div>
                  </div>
                </div>
              ` : ''}
              
              <div class="clawfi-pcs-actions">
                <a class="clawfi-pcs-btn" href="${dexUrl}" target="_blank">📊 Chart</a>
                <a class="clawfi-pcs-btn primary" href="${unifiedDataService.getSwapUrl(chain, 'ETH', state.token)}" target="_blank">💱 Swap</a>
              </div>
            `}
          </div>
          
          <div class="clawfi-pcs-footer">ClawFi v${VERSION}</div>
        </div>
      </div>
    `;
  }
  
  attachEventListeners();
}

/**
 * Attach event listeners
 */
function attachEventListeners(): void {
  if (!shadowRoot) return;
  
  const expandBtn = shadowRoot.getElementById('expand-btn');
  expandBtn?.addEventListener('click', () => {
    if (state) {
      state.expanded = true;
      render();
    }
  });
  
  const closeBtn = shadowRoot.getElementById('close-btn');
  closeBtn?.addEventListener('click', () => {
    if (state) {
      state.expanded = false;
      render();
    }
  });
}

/**
 * Create overlay container
 */
function createOverlay(): void {
  if (overlayContainer) return;
  
  overlayContainer = document.createElement('div');
  overlayContainer.id = 'clawfi-pancakeswap-overlay';
  document.body.appendChild(overlayContainer);
  shadowRoot = overlayContainer.attachShadow({ mode: 'closed' });
}

/**
 * Initialize overlay for a token
 */
async function initOverlay(token: string, chain: ChainId): Promise<void> {
  createOverlay();
  
  state = {
    loading: true,
    token,
    chain,
    marketData: null,
    safety: null,
    expanded: false,
  };
  
  render();
  
  // Notify background
  chrome.runtime.sendMessage({
    type: 'DETECTED_TOKEN',
    token,
    chain,
    source: 'pancakeswap',
  });
  
  // Fetch data
  try {
    const [marketData, safety] = await Promise.all([
      unifiedDataService.getMarketData(token, chain),
      unifiedDataService.getTokenSafety(token, chain),
    ]);
    
    if (state && state.token === token) {
      state.loading = false;
      state.marketData = marketData;
      state.safety = safety;
      render();
    }
  } catch (error) {
    console.error('[ClawFi PancakeSwap] Error:', error);
    if (state) {
      state.loading = false;
      render();
    }
  }
}

/**
 * Cleanup overlay
 */
function cleanupOverlay(): void {
  if (overlayContainer) {
    overlayContainer.remove();
    overlayContainer = null;
    shadowRoot = null;
  }
  state = null;
}

/**
 * Handle route changes
 */
function handleRouteChange(): void {
  const token = extractTokenFromUrl();
  const chain = detectChain();
  
  if (token && (token !== currentToken || chain !== currentChain)) {
    currentToken = token;
    currentChain = chain;
    cleanupOverlay();
    initOverlay(token, chain);
  } else if (!token && currentToken) {
    currentToken = null;
    cleanupOverlay();
  }
}

/**
 * Setup navigation detection
 */
function setupNavigationDetection(): void {
  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);
  
  history.pushState = function (...args) {
    const result = originalPushState(...args);
    handleRouteChange();
    return result;
  };
  
  history.replaceState = function (...args) {
    const result = originalReplaceState(...args);
    handleRouteChange();
    return result;
  };
  
  window.addEventListener('popstate', handleRouteChange);
}

/**
 * Initialize
 */
function init(): void {
  console.log('[ClawFi] PancakeSwap content script loaded');
  
  initHoverCards();
  setupNavigationDetection();
  handleRouteChange();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
