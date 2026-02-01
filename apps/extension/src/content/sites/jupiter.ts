/**
 * ClawFi Extension - Jupiter Content Script
 * 
 * Detects tokens on Jupiter (jup.ag) and shows ClawFi overlay
 * Chain: Solana
 */

import { unifiedDataService, tokenSafetyChecker } from '../../services/api';
import type { MarketData, TokenSafety } from '../../services/api/types';
import { initHoverCards } from '../components/TokenHoverCard';

const VERSION = '0.3.1';
const SOLANA_ADDRESS_REGEX = /[1-9A-HJ-NP-Za-km-z]{32,44}/;

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
let overlayContainer: HTMLDivElement | null = null;
let shadowRoot: ShadowRoot | null = null;

interface OverlayState {
  loading: boolean;
  token: string;
  marketData: MarketData | null;
  safety: TokenSafety | null;
  expanded: boolean;
}

let state: OverlayState | null = null;

/**
 * Extract token from Jupiter URL
 * Patterns:
 * - /swap/SOL-TOKEN
 * - /swap?inputCurrency=...&outputCurrency=TOKEN
 */
function extractTokenFromUrl(): string | null {
  const url = window.location.href;
  const pathname = window.location.pathname;
  const params = new URLSearchParams(window.location.search);
  
  // Check URL params
  const outputCurrency = params.get('outputCurrency') || params.get('outputMint');
  if (outputCurrency && SOLANA_ADDRESS_REGEX.test(outputCurrency)) {
    return outputCurrency;
  }
  
  // Check path pattern /swap/X-Y
  const pathMatch = pathname.match(/\/swap\/([^-]+)-([^\/\?]+)/);
  if (pathMatch) {
    const output = pathMatch[2];
    if (SOLANA_ADDRESS_REGEX.test(output)) {
      return output;
    }
  }
  
  // Check for token in any part of URL
  const match = url.match(SOLANA_ADDRESS_REGEX);
  if (match && match[0].length >= 32) {
    // Exclude common addresses
    const common = ['So11111111111111111111111111111111111111112'];
    if (!common.includes(match[0])) {
      return match[0];
    }
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
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    .clawfi-jup-overlay {
      position: fixed;
      top: 80px;
      right: 20px;
      z-index: 2147483647;
      font-size: 13px;
      -webkit-font-smoothing: antialiased;
    }
    
    .clawfi-jup-fab {
      width: 56px;
      height: 56px;
      border-radius: 16px;
      background: linear-gradient(180deg, rgba(153, 69, 255, 0.9) 0%, rgba(20, 241, 149, 0.9) 100%);
      border: 1px solid rgba(255, 255, 255, 0.25);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 10px 40px rgba(153, 69, 255, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3);
      transition: all 0.3s ease;
      position: relative;
    }
    
    .clawfi-jup-fab:hover {
      transform: scale(1.05);
    }
    
    .clawfi-jup-fab-icon {
      width: 32px;
      height: 32px;
      border-radius: 8px;
    }
    
    .clawfi-jup-fab-badge {
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
    
    .clawfi-jup-fab-badge.safe { background: #30D158; color: white; }
    .clawfi-jup-fab-badge.low { background: #0A84FF; color: white; }
    .clawfi-jup-fab-badge.medium { background: #FFD60A; color: black; }
    .clawfi-jup-fab-badge.high { background: #FF9F0A; color: white; }
    .clawfi-jup-fab-badge.critical { background: #FF453A; color: white; }
    
    .clawfi-jup-panel {
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
    
    .clawfi-jup-header {
      padding: 14px 16px;
      background: linear-gradient(180deg, rgba(153, 69, 255, 0.8) 0%, rgba(20, 241, 149, 0.8) 100%);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .clawfi-jup-header-title {
      display: flex;
      align-items: center;
      gap: 8px;
      color: white;
      font-weight: 600;
      font-size: 15px;
    }
    
    .clawfi-jup-header-logo {
      width: 22px;
      height: 22px;
      border-radius: 5px;
    }
    
    .clawfi-jup-close {
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
    
    .clawfi-jup-body {
      padding: 16px;
    }
    
    .clawfi-jup-address {
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
    
    .clawfi-jup-risk {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 14px;
      border-radius: 12px;
      margin-bottom: 14px;
    }
    
    .clawfi-jup-risk.safe { background: rgba(48, 209, 88, 0.15); border: 1px solid rgba(48, 209, 88, 0.3); }
    .clawfi-jup-risk.low { background: rgba(10, 132, 255, 0.15); border: 1px solid rgba(10, 132, 255, 0.3); }
    .clawfi-jup-risk.medium { background: rgba(255, 214, 10, 0.15); border: 1px solid rgba(255, 214, 10, 0.3); }
    .clawfi-jup-risk.high { background: rgba(255, 159, 10, 0.15); border: 1px solid rgba(255, 159, 10, 0.3); }
    .clawfi-jup-risk.critical { background: rgba(255, 69, 58, 0.15); border: 1px solid rgba(255, 69, 58, 0.3); }
    
    .clawfi-jup-risk-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }
    
    .clawfi-jup-risk.safe .clawfi-jup-risk-dot { background: #30D158; box-shadow: 0 0 10px #30D158; }
    .clawfi-jup-risk.low .clawfi-jup-risk-dot { background: #0A84FF; box-shadow: 0 0 10px #0A84FF; }
    .clawfi-jup-risk.medium .clawfi-jup-risk-dot { background: #FFD60A; box-shadow: 0 0 10px #FFD60A; }
    .clawfi-jup-risk.high .clawfi-jup-risk-dot { background: #FF9F0A; box-shadow: 0 0 10px #FF9F0A; }
    .clawfi-jup-risk.critical .clawfi-jup-risk-dot { background: #FF453A; box-shadow: 0 0 10px #FF453A; }
    
    .clawfi-jup-risk-text {
      flex: 1;
      color: white;
      font-weight: 500;
      font-size: 14px;
    }
    
    .clawfi-jup-risk-score {
      color: rgba(255, 255, 255, 0.6);
      font-size: 12px;
    }
    
    .clawfi-jup-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      margin-bottom: 14px;
    }
    
    .clawfi-jup-stat {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      padding: 12px;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    
    .clawfi-jup-stat-label {
      font-size: 10px;
      color: rgba(255, 255, 255, 0.4);
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    
    .clawfi-jup-stat-value {
      font-size: 16px;
      font-weight: 600;
      color: white;
    }
    
    .clawfi-jup-stat-sub {
      font-size: 11px;
      margin-top: 2px;
    }
    
    .clawfi-jup-stat-sub.positive { color: #30D158; }
    .clawfi-jup-stat-sub.negative { color: #FF453A; }
    
    .clawfi-jup-actions {
      display: flex;
      gap: 10px;
    }
    
    .clawfi-jup-btn {
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
    
    .clawfi-jup-btn:hover {
      background: rgba(255, 255, 255, 0.15);
    }
    
    .clawfi-jup-btn.primary {
      background: linear-gradient(135deg, rgba(153, 69, 255, 0.5) 0%, rgba(20, 241, 149, 0.5) 100%);
      border-color: rgba(153, 69, 255, 0.6);
    }
    
    .clawfi-jup-loading {
      padding: 40px;
      text-align: center;
      color: rgba(255, 255, 255, 0.5);
    }
    
    .clawfi-jup-spinner {
      width: 28px;
      height: 28px;
      border: 2px solid rgba(255, 255, 255, 0.1);
      border-top-color: #9945FF;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 12px;
    }
    
    @keyframes spin { to { transform: rotate(360deg); } }
    
    .clawfi-jup-footer {
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
      <div class="clawfi-jup-overlay">
        <button class="clawfi-jup-fab" id="expand-btn">
          ${iconUrl ? `<img class="clawfi-jup-fab-icon" src="${iconUrl}">` : '🦀'}
          <span class="clawfi-jup-fab-badge ${riskLevel}">${riskBadge.emoji}</span>
        </button>
      </div>
    `;
  } else {
    const { marketData, safety } = state;
    const dexUrl = unifiedDataService.getDexscreenerUrl('solana', state.token);
    
    shadowRoot.innerHTML = `
      <style>${getStyles()}</style>
      <div class="clawfi-jup-overlay">
        <div class="clawfi-jup-panel">
          <div class="clawfi-jup-header">
            <div class="clawfi-jup-header-title">
              ${iconUrl ? `<img class="clawfi-jup-header-logo" src="${iconUrl}">` : '🦀'}
              ClawFi • Solana
            </div>
            <button class="clawfi-jup-close" id="close-btn">×</button>
          </div>
          
          <div class="clawfi-jup-body">
            ${state.loading ? `
              <div class="clawfi-jup-loading">
                <div class="clawfi-jup-spinner"></div>
                Analyzing token...
              </div>
            ` : `
              <div class="clawfi-jup-address">
                <span>${state.token.slice(0, 8)}...${state.token.slice(-6)}</span>
                <span style="cursor: pointer;" id="copy-btn">📋</span>
              </div>
              
              <div class="clawfi-jup-risk ${riskLevel}">
                <span class="clawfi-jup-risk-dot"></span>
                <span class="clawfi-jup-risk-text">${riskBadge.text}</span>
                <span class="clawfi-jup-risk-score">${safety?.riskScore || 0}/100 risk</span>
              </div>
              
              ${marketData ? `
                <div class="clawfi-jup-grid">
                  <div class="clawfi-jup-stat">
                    <div class="clawfi-jup-stat-label">Price</div>
                    <div class="clawfi-jup-stat-value">$${marketData.priceUsd < 0.01 ? marketData.priceUsd.toExponential(2) : marketData.priceUsd.toFixed(4)}</div>
                    <div class="clawfi-jup-stat-sub ${marketData.priceChange24h >= 0 ? 'positive' : 'negative'}">
                      ${marketData.priceChange24h >= 0 ? '+' : ''}${marketData.priceChange24h.toFixed(2)}%
                    </div>
                  </div>
                  <div class="clawfi-jup-stat">
                    <div class="clawfi-jup-stat-label">Liquidity</div>
                    <div class="clawfi-jup-stat-value">$${formatNumber(marketData.liquidity)}</div>
                    <div class="clawfi-jup-stat-sub" style="color: rgba(255,255,255,0.5);">${marketData.dex}</div>
                  </div>
                  <div class="clawfi-jup-stat">
                    <div class="clawfi-jup-stat-label">Volume 24h</div>
                    <div class="clawfi-jup-stat-value">$${formatNumber(marketData.volume24h)}</div>
                  </div>
                  <div class="clawfi-jup-stat">
                    <div class="clawfi-jup-stat-label">Market Cap</div>
                    <div class="clawfi-jup-stat-value">${marketData.marketCap ? '$' + formatNumber(marketData.marketCap) : 'N/A'}</div>
                  </div>
                </div>
              ` : ''}
              
              <div class="clawfi-jup-actions">
                <a class="clawfi-jup-btn" href="${dexUrl}" target="_blank">📊 Chart</a>
                <a class="clawfi-jup-btn primary" href="https://birdeye.so/token/${state.token}?chain=solana" target="_blank">🦅 Birdeye</a>
              </div>
            `}
          </div>
          
          <div class="clawfi-jup-footer">ClawFi v${VERSION}</div>
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
  
  const copyBtn = shadowRoot.getElementById('copy-btn');
  copyBtn?.addEventListener('click', async () => {
    if (state) {
      await navigator.clipboard.writeText(state.token);
      copyBtn.textContent = '✓';
      setTimeout(() => {
        copyBtn.textContent = '📋';
      }, 1000);
    }
  });
}

/**
 * Create overlay container
 */
function createOverlay(): void {
  if (overlayContainer) return;
  
  overlayContainer = document.createElement('div');
  overlayContainer.id = 'clawfi-jupiter-overlay';
  document.body.appendChild(overlayContainer);
  shadowRoot = overlayContainer.attachShadow({ mode: 'closed' });
}

/**
 * Initialize overlay for a token
 */
async function initOverlay(token: string): Promise<void> {
  createOverlay();
  
  state = {
    loading: true,
    token,
    marketData: null,
    safety: null,
    expanded: false,
  };
  
  render();
  
  // Notify background
  chrome.runtime.sendMessage({
    type: 'DETECTED_TOKEN',
    token,
    chain: 'solana',
    source: 'jupiter',
  });
  
  // Fetch data
  try {
    const [marketData, safety] = await Promise.all([
      unifiedDataService.getMarketData(token, 'solana'),
      unifiedDataService.getTokenSafety(token, 'solana'),
    ]);
    
    if (state && state.token === token) {
      state.loading = false;
      state.marketData = marketData;
      state.safety = safety;
      render();
    }
  } catch (error) {
    console.error('[ClawFi Jupiter] Error:', error);
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
  
  if (token && token !== currentToken) {
    currentToken = token;
    cleanupOverlay();
    initOverlay(token);
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
  console.log('[ClawFi] Jupiter content script loaded');
  
  // Initialize hover cards
  initHoverCards();
  
  // Setup navigation detection
  setupNavigationDetection();
  
  // Check initial page
  handleRouteChange();
}

// Start
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
