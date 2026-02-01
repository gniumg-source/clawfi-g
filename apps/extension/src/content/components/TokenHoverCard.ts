/**
 * ClawFi Extension - Token Hover Card
 * 
 * Shows token info when hovering over token addresses
 * Works on any page with token addresses
 * 
 * Design: Apple Liquid Glass (iOS 26)
 */

import { unifiedDataService, tokenSafetyChecker } from '../../services/api';
import type { ChainId, MarketData, TokenSafety } from '../../services/api/types';

// ============================================
// CONSTANTS
// ============================================

const HOVER_DELAY = 300; // ms before showing card
const HIDE_DELAY = 200; // ms before hiding card
const CARD_WIDTH = 320;
const CARD_HEIGHT_MIN = 200;

// Address patterns
const ETH_ADDRESS = /0x[a-fA-F0-9]{40}/;
const SOL_ADDRESS = /[1-9A-HJ-NP-Za-km-z]{32,44}/;

// ============================================
// HOVER CARD COMPONENT
// ============================================

interface HoverCardState {
  visible: boolean;
  loading: boolean;
  address: string;
  chain: ChainId;
  marketData: MarketData | null;
  safety: TokenSafety | null;
  position: { x: number; y: number };
}

let cardElement: HTMLDivElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let state: HoverCardState | null = null;
let hoverTimeout: ReturnType<typeof setTimeout> | null = null;
let hideTimeout: ReturnType<typeof setTimeout> | null = null;

// Get extension icon URL
function getIconUrl(size: number = 48): string {
  try {
    return chrome.runtime.getURL(`icons/icon${size}.png`);
  } catch {
    return '';
  }
}

/**
 * Get styles for hover card
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
    
    .clawfi-hover-card {
      position: fixed;
      width: ${CARD_WIDTH}px;
      background: rgba(30, 30, 40, 0.85);
      backdrop-filter: blur(40px) saturate(180%);
      -webkit-backdrop-filter: blur(40px) saturate(180%);
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.15);
      box-shadow: 
        0 20px 60px rgba(0, 0, 0, 0.5),
        0 8px 24px rgba(0, 0, 0, 0.3);
      z-index: 2147483647;
      overflow: hidden;
      animation: fadeIn 0.2s ease;
      pointer-events: auto;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.95) translateY(-5px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
    
    .clawfi-hover-header {
      padding: 12px 14px;
      background: linear-gradient(180deg, rgba(10, 132, 255, 0.8) 0%, rgba(10, 100, 200, 0.85) 100%);
      display: flex;
      align-items: center;
      gap: 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .clawfi-hover-logo {
      width: 24px;
      height: 24px;
      border-radius: 6px;
    }
    
    .clawfi-hover-title {
      font-size: 14px;
      font-weight: 600;
      color: white;
      flex: 1;
    }
    
    .clawfi-hover-chain {
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 100px;
      background: rgba(255, 255, 255, 0.2);
      color: white;
    }
    
    .clawfi-hover-body {
      padding: 12px 14px;
    }
    
    .clawfi-hover-address {
      font-family: 'SF Mono', Menlo, monospace;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.7);
      background: rgba(255, 255, 255, 0.08);
      padding: 6px 10px;
      border-radius: 8px;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
    }
    
    .clawfi-hover-address:hover {
      background: rgba(255, 255, 255, 0.12);
    }
    
    .clawfi-hover-copy {
      font-size: 12px;
      opacity: 0.6;
    }
    
    .clawfi-hover-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      margin-bottom: 12px;
    }
    
    .clawfi-hover-stat {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 10px;
      padding: 10px 12px;
      border: 1px solid rgba(255, 255, 255, 0.06);
    }
    
    .clawfi-hover-stat-label {
      font-size: 10px;
      color: rgba(255, 255, 255, 0.4);
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    
    .clawfi-hover-stat-value {
      font-size: 15px;
      font-weight: 600;
      color: white;
    }
    
    .clawfi-hover-stat-sub {
      font-size: 11px;
      margin-top: 2px;
    }
    
    .clawfi-hover-stat-sub.positive { color: #30D158; }
    .clawfi-hover-stat-sub.negative { color: #FF453A; }
    
    .clawfi-hover-risk {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border-radius: 10px;
      margin-bottom: 12px;
    }
    
    .clawfi-hover-risk.safe {
      background: rgba(48, 209, 88, 0.15);
      border: 1px solid rgba(48, 209, 88, 0.3);
    }
    
    .clawfi-hover-risk.low {
      background: rgba(10, 132, 255, 0.15);
      border: 1px solid rgba(10, 132, 255, 0.3);
    }
    
    .clawfi-hover-risk.medium {
      background: rgba(255, 214, 10, 0.15);
      border: 1px solid rgba(255, 214, 10, 0.3);
    }
    
    .clawfi-hover-risk.high {
      background: rgba(255, 159, 10, 0.15);
      border: 1px solid rgba(255, 159, 10, 0.3);
    }
    
    .clawfi-hover-risk.critical {
      background: rgba(255, 69, 58, 0.15);
      border: 1px solid rgba(255, 69, 58, 0.3);
    }
    
    .clawfi-hover-risk-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    
    .clawfi-hover-risk.safe .clawfi-hover-risk-dot { background: #30D158; box-shadow: 0 0 8px #30D158; }
    .clawfi-hover-risk.low .clawfi-hover-risk-dot { background: #0A84FF; box-shadow: 0 0 8px #0A84FF; }
    .clawfi-hover-risk.medium .clawfi-hover-risk-dot { background: #FFD60A; box-shadow: 0 0 8px #FFD60A; }
    .clawfi-hover-risk.high .clawfi-hover-risk-dot { background: #FF9F0A; box-shadow: 0 0 8px #FF9F0A; }
    .clawfi-hover-risk.critical .clawfi-hover-risk-dot { background: #FF453A; box-shadow: 0 0 8px #FF453A; }
    
    .clawfi-hover-risk-text {
      font-size: 13px;
      font-weight: 500;
      color: white;
      flex: 1;
    }
    
    .clawfi-hover-risk-score {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.6);
    }
    
    .clawfi-hover-actions {
      display: flex;
      gap: 8px;
    }
    
    .clawfi-hover-btn {
      flex: 1;
      padding: 10px;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.15);
      background: rgba(255, 255, 255, 0.08);
      color: white;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      text-decoration: none;
      text-align: center;
      transition: all 0.2s ease;
    }
    
    .clawfi-hover-btn:hover {
      background: rgba(255, 255, 255, 0.15);
      transform: translateY(-1px);
    }
    
    .clawfi-hover-btn.primary {
      background: rgba(10, 132, 255, 0.5);
      border-color: rgba(10, 132, 255, 0.6);
    }
    
    .clawfi-hover-btn.primary:hover {
      background: rgba(10, 132, 255, 0.7);
    }
    
    .clawfi-hover-loading {
      padding: 40px;
      text-align: center;
      color: rgba(255, 255, 255, 0.5);
    }
    
    .clawfi-hover-spinner {
      width: 24px;
      height: 24px;
      border: 2px solid rgba(255, 255, 255, 0.1);
      border-top-color: #0A84FF;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 12px;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .clawfi-hover-error {
      padding: 20px;
      text-align: center;
      color: rgba(255, 255, 255, 0.5);
      font-size: 13px;
    }
  `;
}

/**
 * Format number for display
 */
function formatNumber(num: number): string {
  if (num >= 1000000000) return (num / 1000000000).toFixed(2) + 'B';
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toFixed(0);
}

/**
 * Render card HTML
 */
function renderCard(state: HoverCardState): string {
  const iconUrl = getIconUrl(24);
  
  if (state.loading) {
    return `
      <div class="clawfi-hover-card" style="top: ${state.position.y}px; left: ${state.position.x}px;">
        <div class="clawfi-hover-header">
          ${iconUrl ? `<img class="clawfi-hover-logo" src="${iconUrl}" alt="">` : '<span>🦀</span>'}
          <span class="clawfi-hover-title">ClawFi</span>
          <span class="clawfi-hover-chain">${state.chain}</span>
        </div>
        <div class="clawfi-hover-loading">
          <div class="clawfi-hover-spinner"></div>
          Loading token data...
        </div>
      </div>
    `;
  }
  
  if (!state.marketData) {
    return `
      <div class="clawfi-hover-card" style="top: ${state.position.y}px; left: ${state.position.x}px;">
        <div class="clawfi-hover-header">
          ${iconUrl ? `<img class="clawfi-hover-logo" src="${iconUrl}" alt="">` : '<span>🦀</span>'}
          <span class="clawfi-hover-title">ClawFi</span>
          <span class="clawfi-hover-chain">${state.chain}</span>
        </div>
        <div class="clawfi-hover-error">
          No data available for this token
        </div>
      </div>
    `;
  }
  
  const { marketData, safety } = state;
  const riskLevel = safety?.overallRisk || 'low';
  const riskBadge = tokenSafetyChecker.getRiskBadge(riskLevel);
  
  const dexscreenerUrl = unifiedDataService.getDexscreenerUrl(state.chain, state.address);
  const swapUrls = unifiedDataService.getDexSwapUrl(state.chain, state.address);
  const swapUrl = swapUrls.uniswap || swapUrls.jupiter || swapUrls.pancakeswap || dexscreenerUrl;
  
  return `
    <div class="clawfi-hover-card" style="top: ${state.position.y}px; left: ${state.position.x}px;">
      <div class="clawfi-hover-header">
        ${iconUrl ? `<img class="clawfi-hover-logo" src="${iconUrl}" alt="">` : '<span>🦀</span>'}
        <span class="clawfi-hover-title">ClawFi</span>
        <span class="clawfi-hover-chain">${state.chain}</span>
      </div>
      
      <div class="clawfi-hover-body">
        <div class="clawfi-hover-address" data-copy="${state.address}">
          <span>${state.address.slice(0, 8)}...${state.address.slice(-6)}</span>
          <span class="clawfi-hover-copy">📋</span>
        </div>
        
        <div class="clawfi-hover-grid">
          <div class="clawfi-hover-stat">
            <div class="clawfi-hover-stat-label">Price</div>
            <div class="clawfi-hover-stat-value">$${marketData.priceUsd < 0.01 ? marketData.priceUsd.toExponential(2) : marketData.priceUsd.toFixed(4)}</div>
            <div class="clawfi-hover-stat-sub ${marketData.priceChange24h >= 0 ? 'positive' : 'negative'}">
              ${marketData.priceChange24h >= 0 ? '+' : ''}${marketData.priceChange24h.toFixed(2)}%
            </div>
          </div>
          
          <div class="clawfi-hover-stat">
            <div class="clawfi-hover-stat-label">Liquidity</div>
            <div class="clawfi-hover-stat-value">$${formatNumber(marketData.liquidity)}</div>
            <div class="clawfi-hover-stat-sub" style="color: rgba(255,255,255,0.5);">${marketData.dex}</div>
          </div>
          
          <div class="clawfi-hover-stat">
            <div class="clawfi-hover-stat-label">Volume 24h</div>
            <div class="clawfi-hover-stat-value">$${formatNumber(marketData.volume24h)}</div>
            <div class="clawfi-hover-stat-sub" style="color: rgba(255,255,255,0.5);">${marketData.txns24h.buys}↑ ${marketData.txns24h.sells}↓</div>
          </div>
          
          <div class="clawfi-hover-stat">
            <div class="clawfi-hover-stat-label">MCap</div>
            <div class="clawfi-hover-stat-value">${marketData.marketCap ? '$' + formatNumber(marketData.marketCap) : 'N/A'}</div>
          </div>
        </div>
        
        <div class="clawfi-hover-risk ${riskLevel}">
          <span class="clawfi-hover-risk-dot"></span>
          <span class="clawfi-hover-risk-text">${riskBadge.text}</span>
          <span class="clawfi-hover-risk-score">${safety?.riskScore || 0}/100</span>
        </div>
        
        <div class="clawfi-hover-actions">
          <a class="clawfi-hover-btn" href="${dexscreenerUrl}" target="_blank">📊 Chart</a>
          <a class="clawfi-hover-btn primary" href="${swapUrl}" target="_blank">💱 Swap</a>
        </div>
      </div>
    </div>
  `;
}

/**
 * Create or update hover card
 */
function createCard(): void {
  if (cardElement) return;
  
  cardElement = document.createElement('div');
  cardElement.id = 'clawfi-hover-card-host';
  document.body.appendChild(cardElement);
  
  shadowRoot = cardElement.attachShadow({ mode: 'closed' });
}

/**
 * Show hover card
 */
async function showCard(address: string, chain: ChainId, x: number, y: number): Promise<void> {
  createCard();
  if (!shadowRoot) return;
  
  // Calculate position (avoid going off screen)
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  let posX = x + 10;
  let posY = y + 10;
  
  if (posX + CARD_WIDTH > viewportWidth - 20) {
    posX = x - CARD_WIDTH - 10;
  }
  
  if (posY + CARD_HEIGHT_MIN > viewportHeight - 20) {
    posY = viewportHeight - CARD_HEIGHT_MIN - 20;
  }
  
  // Set initial loading state
  state = {
    visible: true,
    loading: true,
    address,
    chain,
    marketData: null,
    safety: null,
    position: { x: posX, y: posY },
  };
  
  // Render loading state
  shadowRoot.innerHTML = `
    <style>${getStyles()}</style>
    ${renderCard(state)}
  `;
  
  // Fetch data
  try {
    const [marketData, safety] = await Promise.all([
      unifiedDataService.getMarketData(address, chain),
      unifiedDataService.getTokenSafety(address, chain),
    ]);
    
    // Update state and re-render
    if (state && state.address === address) {
      state.loading = false;
      state.marketData = marketData;
      state.safety = safety;
      
      shadowRoot.innerHTML = `
        <style>${getStyles()}</style>
        ${renderCard(state)}
      `;
      
      // Attach event listeners
      attachCardEvents();
    }
  } catch (error) {
    console.error('[ClawFi HoverCard] Error fetching data:', error);
    if (state && state.address === address) {
      state.loading = false;
      shadowRoot.innerHTML = `
        <style>${getStyles()}</style>
        ${renderCard(state)}
      `;
    }
  }
}

/**
 * Hide hover card
 */
function hideCard(): void {
  if (cardElement) {
    cardElement.remove();
    cardElement = null;
    shadowRoot = null;
  }
  state = null;
}

/**
 * Attach event listeners to card
 */
function attachCardEvents(): void {
  if (!shadowRoot) return;
  
  // Copy address
  const addressEl = shadowRoot.querySelector('[data-copy]');
  addressEl?.addEventListener('click', async () => {
    const address = addressEl.getAttribute('data-copy');
    if (address) {
      try {
        await navigator.clipboard.writeText(address);
        // Show brief feedback
        const copyIcon = addressEl.querySelector('.clawfi-hover-copy');
        if (copyIcon) {
          copyIcon.textContent = '✓';
          setTimeout(() => {
            copyIcon.textContent = '📋';
          }, 1000);
        }
      } catch (e) {
        console.error('[ClawFi] Copy failed:', e);
      }
    }
  });
  
  // Keep card visible when hovering over it
  const card = shadowRoot.querySelector('.clawfi-hover-card');
  card?.addEventListener('mouseenter', () => {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }
  });
  
  card?.addEventListener('mouseleave', () => {
    hideTimeout = setTimeout(hideCard, HIDE_DELAY);
  });
}

/**
 * Detect chain from context
 */
function detectChainFromContext(): ChainId {
  const url = window.location.href.toLowerCase();
  
  if (url.includes('solscan.io') || url.includes('pump.fun') || url.includes('jupiter')) {
    return 'solana';
  }
  if (url.includes('basescan') || url.includes('/base/') || url.includes('clanker')) {
    return 'base';
  }
  if (url.includes('arbiscan') || url.includes('/arbitrum/')) {
    return 'arbitrum';
  }
  if (url.includes('bscscan') || url.includes('/bsc/') || url.includes('four.meme') || url.includes('pancakeswap')) {
    return 'bsc';
  }
  if (url.includes('polygonscan') || url.includes('/polygon/')) {
    return 'polygon';
  }
  if (url.includes('dexscreener.com')) {
    // Extract chain from URL
    const match = url.match(/dexscreener\.com\/([^\/]+)/);
    if (match) {
      const chain = match[1];
      if (chain === 'ethereum' || chain === 'eth') return 'ethereum';
      if (chain === 'base') return 'base';
      if (chain === 'arbitrum') return 'arbitrum';
      if (chain === 'bsc') return 'bsc';
      if (chain === 'solana') return 'solana';
      return chain as ChainId;
    }
  }
  
  return 'ethereum';
}

/**
 * Handle mouse enter on address element
 */
function handleAddressHover(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  const text = target.textContent || target.innerText || '';
  
  // Check for ETH address
  const ethMatch = text.match(ETH_ADDRESS);
  if (ethMatch) {
    const address = ethMatch[0];
    const chain = detectChainFromContext();
    
    if (hoverTimeout) clearTimeout(hoverTimeout);
    hoverTimeout = setTimeout(() => {
      showCard(address, chain, event.clientX, event.clientY);
    }, HOVER_DELAY);
    return;
  }
  
  // Check for Solana address
  const solMatch = text.match(SOL_ADDRESS);
  if (solMatch && solMatch[0].length >= 32 && solMatch[0].length <= 44) {
    const address = solMatch[0];
    
    if (hoverTimeout) clearTimeout(hoverTimeout);
    hoverTimeout = setTimeout(() => {
      showCard(address, 'solana', event.clientX, event.clientY);
    }, HOVER_DELAY);
  }
}

/**
 * Handle mouse leave
 */
function handleAddressLeave(): void {
  if (hoverTimeout) {
    clearTimeout(hoverTimeout);
    hoverTimeout = null;
  }
  
  hideTimeout = setTimeout(hideCard, HIDE_DELAY);
}

/**
 * Initialize hover card system
 */
export function initHoverCards(): void {
  // Add event listeners for potential address elements
  // This is a simple implementation - could be improved with MutationObserver
  
  document.addEventListener('mouseover', (event) => {
    const target = event.target as HTMLElement;
    
    // Skip if target is inside our card
    if (target.closest('#clawfi-hover-card-host')) return;
    
    // Check if element might contain an address
    const text = target.textContent || '';
    if (ETH_ADDRESS.test(text) || SOL_ADDRESS.test(text)) {
      handleAddressHover(event);
    }
  });
  
  document.addEventListener('mouseout', (event) => {
    const target = event.target as HTMLElement;
    
    // Skip if target is inside our card
    if (target.closest('#clawfi-hover-card-host')) return;
    
    const text = target.textContent || '';
    if (ETH_ADDRESS.test(text) || SOL_ADDRESS.test(text)) {
      handleAddressLeave();
    }
  });
  
  console.log('[ClawFi] Hover cards initialized');
}

/**
 * Cleanup hover cards
 */
export function destroyHoverCards(): void {
  hideCard();
  if (hoverTimeout) {
    clearTimeout(hoverTimeout);
    hoverTimeout = null;
  }
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }
}
