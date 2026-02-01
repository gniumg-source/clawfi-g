/**
 * ClawFi Extension - Four.meme Content Script
 * 
 * Detects tokens on Four.meme (BSC memecoin launchpad)
 * Design: Apple Liquid Glass (iOS 26)
 */

const VERSION = '0.3.1';

interface FourMemeTokenInfo {
  address: string;
  name?: string;
  symbol?: string;
  creator?: string;
  marketCap?: string;
}

interface Signal {
  id: string;
  ts: number;
  severity: string;
  title: string;
  summary: string;
  recommendedAction?: string;
}

interface MarketData {
  priceUsd: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  marketCap?: number;
}

interface Settings {
  nodeUrl: string;
  authToken: string;
  overlayEnabled: boolean;
}

// BSC address regex
const BSC_ADDRESS_REGEX = /0x[a-fA-F0-9]{40}/g;

// Format numbers
function formatNumber(num: number): string {
  if (num >= 1000000000) return (num / 1000000000).toFixed(2) + 'B';
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toFixed(0);
}

// Detect token from Four.meme page
function detectFourMemeToken(): FourMemeTokenInfo | null {
  const url = window.location.href;
  
  // Try URL pattern
  const urlMatch = url.match(/four\.meme\/(?:token|meme)\/(.+)/);
  if (urlMatch) {
    const addressMatch = urlMatch[1].match(BSC_ADDRESS_REGEX);
    if (addressMatch) {
      return { address: addressMatch[0] };
    }
  }
  
  // Try page selectors
  const addressEl = document.querySelector('[data-contract-address]');
  if (addressEl) {
    const address = addressEl.getAttribute('data-contract-address');
    if (address) return { address };
  }
  
  // Try URL
  const addresses = url.match(BSC_ADDRESS_REGEX);
  if (addresses && addresses.length > 0) {
    return { address: addresses[0] };
  }
  
  return null;
}

// Liquid Glass Styles
function getStyles(): string {
  return `
    #clawfi-fourmeme-overlay {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    
    /* FAB Button */
    .clawfi-fm-fab {
      width: 60px;
      height: 60px;
      border-radius: 18px;
      background: linear-gradient(180deg, rgba(240, 185, 11, 0.9) 0%, rgba(200, 155, 10, 0.95) 100%);
      border: 1px solid rgba(255, 255, 255, 0.25);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 
        0 10px 40px rgba(240, 185, 11, 0.4),
        0 2px 10px rgba(0, 0, 0, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.3);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
    }
    
    .clawfi-fm-fab::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.1) 30%, transparent 50%);
      pointer-events: none;
      border-radius: inherit;
    }
    
    .clawfi-fm-fab:hover {
      transform: scale(1.08) translateY(-3px);
      box-shadow: 
        0 16px 50px rgba(240, 185, 11, 0.5),
        0 4px 15px rgba(0, 0, 0, 0.25);
    }
    
    .clawfi-fm-fab-icon {
      font-size: 28px;
      position: relative;
      z-index: 1;
    }
    
    .clawfi-fm-badge {
      position: absolute;
      top: -5px;
      right: -5px;
      min-width: 22px;
      height: 22px;
      border-radius: 11px;
      background: #FF453A;
      color: white;
      font-size: 12px;
      font-weight: 600;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 0 6px;
      box-shadow: 0 2px 8px rgba(255, 69, 58, 0.5);
      z-index: 2;
    }
    
    .clawfi-fm-badge.has-signals {
      display: flex;
    }
    
    /* Panel */
    .clawfi-fm-panel {
      display: none;
      width: 380px;
      background: rgba(30, 30, 40, 0.75);
      backdrop-filter: blur(60px) saturate(200%);
      -webkit-backdrop-filter: blur(60px) saturate(200%);
      border-radius: 24px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      box-shadow: 
        0 25px 80px rgba(0, 0, 0, 0.5),
        0 10px 30px rgba(0, 0, 0, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.08);
      overflow: hidden;
      animation: slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .clawfi-fm-panel.expanded {
      display: block;
    }
    
    @keyframes slideIn {
      from { opacity: 0; transform: translateY(-10px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    
    /* Header */
    .clawfi-fm-header {
      padding: 18px 20px;
      background: linear-gradient(180deg, rgba(240, 185, 11, 0.85) 0%, rgba(200, 155, 10, 0.9) 100%);
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: relative;
      border-bottom: 1px solid rgba(255, 255, 255, 0.15);
    }
    
    .clawfi-fm-header::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.08) 40%, transparent 70%);
      pointer-events: none;
    }
    
    .clawfi-fm-header-title {
      font-weight: 600;
      color: #0a0f14;
      font-size: 17px;
      position: relative;
      z-index: 1;
      letter-spacing: -0.3px;
    }
    
    .clawfi-fm-close {
      background: rgba(0, 0, 0, 0.15);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(0, 0, 0, 0.1);
      color: #0a0f14;
      width: 32px;
      height: 32px;
      border-radius: 10px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      transition: all 0.2s ease;
      position: relative;
      z-index: 1;
    }
    
    .clawfi-fm-close:hover {
      background: rgba(0, 0, 0, 0.25);
    }
    
    /* Tabs */
    .clawfi-fm-tabs {
      display: flex;
      padding: 12px 16px;
      gap: 8px;
      background: rgba(0, 0, 0, 0.2);
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }
    
    .clawfi-fm-tab {
      flex: 1;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid transparent;
      background: transparent;
      color: rgba(255, 255, 255, 0.6);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .clawfi-fm-tab:hover {
      background: rgba(255, 255, 255, 0.05);
    }
    
    .clawfi-fm-tab.active {
      background: rgba(240, 185, 11, 0.3);
      color: white;
      border-color: rgba(240, 185, 11, 0.5);
    }
    
    /* Section */
    .clawfi-fm-section {
      padding: 16px 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }
    
    .clawfi-fm-section-title {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.4);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 12px;
      font-weight: 600;
    }
    
    .clawfi-fm-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    
    .clawfi-fm-label {
      color: rgba(255, 255, 255, 0.6);
      font-size: 14px;
    }
    
    .clawfi-fm-value {
      color: rgba(255, 255, 255, 0.95);
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .clawfi-fm-address {
      font-family: 'SF Mono', Menlo, Monaco, monospace;
      background: rgba(255, 255, 255, 0.08);
      padding: 6px 12px;
      border-radius: 10px;
      font-size: 12px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .clawfi-fm-chain-badge {
      background: rgba(240, 185, 11, 0.2);
      color: #F0B90B;
      padding: 5px 12px;
      border-radius: 100px;
      font-size: 12px;
      font-weight: 500;
      border: 1px solid rgba(240, 185, 11, 0.35);
    }
    
    /* Market Grid */
    .clawfi-fm-market-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      margin-top: 12px;
    }
    
    .clawfi-fm-market-card {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 14px;
      padding: 12px 14px;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    
    .clawfi-fm-market-label {
      font-size: 10px;
      color: rgba(255, 255, 255, 0.4);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 4px;
    }
    
    .clawfi-fm-market-value {
      font-size: 18px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.95);
    }
    
    .clawfi-fm-market-change {
      font-size: 12px;
      font-weight: 500;
      margin-top: 2px;
    }
    
    .clawfi-fm-market-change.positive { color: #30D158; }
    .clawfi-fm-market-change.negative { color: #FF453A; }
    
    /* Signals */
    .clawfi-fm-signals {
      max-height: 200px;
      overflow-y: auto;
    }
    
    .clawfi-fm-signals::-webkit-scrollbar {
      width: 6px;
    }
    
    .clawfi-fm-signals::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.15);
      border-radius: 3px;
    }
    
    .clawfi-fm-empty {
      padding: 32px;
      text-align: center;
      color: rgba(255, 255, 255, 0.4);
      font-size: 14px;
    }
    
    .clawfi-fm-signal {
      padding: 14px 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      transition: background 0.2s ease;
    }
    
    .clawfi-fm-signal:hover {
      background: rgba(255, 255, 255, 0.04);
    }
    
    .clawfi-fm-signal-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 4px;
    }
    
    .clawfi-fm-signal-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    
    .clawfi-fm-signal-dot.critical { background: #FF453A; box-shadow: 0 0 8px #FF453A; }
    .clawfi-fm-signal-dot.high { background: #FF9F0A; box-shadow: 0 0 8px #FF9F0A; }
    .clawfi-fm-signal-dot.medium { background: #FFD60A; box-shadow: 0 0 8px #FFD60A; }
    .clawfi-fm-signal-dot.low { background: #0A84FF; box-shadow: 0 0 8px #0A84FF; }
    
    .clawfi-fm-signal-title {
      color: rgba(255, 255, 255, 0.95);
      font-weight: 500;
      font-size: 14px;
      flex: 1;
    }
    
    .clawfi-fm-signal-summary {
      color: rgba(255, 255, 255, 0.6);
      font-size: 13px;
      margin-left: 20px;
      line-height: 1.5;
    }
    
    /* Footer */
    .clawfi-fm-footer {
      padding: 14px 20px;
      background: rgba(255, 255, 255, 0.03);
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .clawfi-fm-footer-text {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.4);
    }
    
    .clawfi-fm-dashboard-btn {
      background: rgba(240, 185, 11, 0.5);
      color: #0a0f14;
      border: 1px solid rgba(240, 185, 11, 0.6);
      padding: 10px 18px;
      border-radius: 100px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s ease;
    }
    
    .clawfi-fm-dashboard-btn:hover {
      background: rgba(240, 185, 11, 0.65);
      transform: scale(1.03);
    }
  `;
}

// Create overlay HTML
function createOverlay(token: FourMemeTokenInfo): HTMLElement {
  const overlay = document.createElement('div');
  overlay.id = 'clawfi-fourmeme-overlay';
  overlay.innerHTML = `
    <style>${getStyles()}</style>
    
    <button class="clawfi-fm-fab" id="clawfi-fm-toggle">
      <span class="clawfi-fm-fab-icon">🦀</span>
      <div class="clawfi-fm-badge" id="clawfi-fm-badge">0</div>
    </button>
    
    <div class="clawfi-fm-panel" id="clawfi-fm-panel">
      <div class="clawfi-fm-header">
        <span class="clawfi-fm-header-title">🦀 ClawFi • BSC</span>
        <button class="clawfi-fm-close" id="clawfi-fm-close">×</button>
      </div>
      
      <div class="clawfi-fm-tabs">
        <button class="clawfi-fm-tab active" id="clawfi-fm-tab-signals">🚨 Signals</button>
        <button class="clawfi-fm-tab" id="clawfi-fm-tab-market">📊 Market</button>
      </div>
      
      <div class="clawfi-fm-section">
        <div class="clawfi-fm-section-title">Detected Token</div>
        <div class="clawfi-fm-row">
          <span class="clawfi-fm-label">Address</span>
          <span class="clawfi-fm-value">
            <code class="clawfi-fm-address">${token.address.slice(0, 6)}...${token.address.slice(-4)}</code>
            <span class="clawfi-fm-chain-badge">⬡ BSC</span>
          </span>
        </div>
      </div>
      
      <div id="clawfi-fm-content">
        <div class="clawfi-fm-signals" id="clawfi-fm-signals">
          <div class="clawfi-fm-empty">
            <div style="margin-bottom: 12px;">
              <div style="width: 30px; height: 30px; border: 2.5px solid rgba(255,255,255,0.1); border-top-color: #F0B90B; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto;"></div>
            </div>
            Loading signals...
          </div>
        </div>
      </div>
      
      <div class="clawfi-fm-footer">
        <span class="clawfi-fm-footer-text">ClawFi v${VERSION}</span>
        <a class="clawfi-fm-dashboard-btn" href="https://dashboard.clawfi.ai/signals?token=${token.address}" target="_blank">Dashboard</a>
      </div>
    </div>
    
    <style>
      @keyframes spin { to { transform: rotate(360deg); } }
    </style>
  `;
  
  return overlay;
}

// Render signals
function renderSignals(signals: Signal[]): string {
  if (signals.length === 0) {
    return `
      <div class="clawfi-fm-empty">
        <div style="font-size: 32px; margin-bottom: 12px;">✨</div>
        No signals detected
        <div style="font-size: 12px; margin-top: 4px; color: rgba(255,255,255,0.3);">This token appears clean</div>
      </div>
    `;
  }
  
  return signals.map(s => `
    <div class="clawfi-fm-signal">
      <div class="clawfi-fm-signal-header">
        <span class="clawfi-fm-signal-dot ${s.severity}"></span>
        <span class="clawfi-fm-signal-title">${s.title}</span>
      </div>
      <p class="clawfi-fm-signal-summary">${s.summary.slice(0, 100)}${s.summary.length > 100 ? '...' : ''}</p>
    </div>
  `).join('');
}

// Render market data
function renderMarketData(data: MarketData | null): string {
  if (!data) {
    return `<div class="clawfi-fm-empty">Loading market data...</div>`;
  }
  
  return `
    <div class="clawfi-fm-section">
      <div class="clawfi-fm-market-grid">
        <div class="clawfi-fm-market-card">
          <div class="clawfi-fm-market-label">Price</div>
          <div class="clawfi-fm-market-value">$${data.priceUsd < 0.01 ? data.priceUsd.toExponential(2) : data.priceUsd.toFixed(4)}</div>
          <div class="clawfi-fm-market-change ${data.priceChange24h >= 0 ? 'positive' : 'negative'}">
            ${data.priceChange24h >= 0 ? '+' : ''}${data.priceChange24h.toFixed(2)}%
          </div>
        </div>
        <div class="clawfi-fm-market-card">
          <div class="clawfi-fm-market-label">Volume 24h</div>
          <div class="clawfi-fm-market-value">$${formatNumber(data.volume24h)}</div>
        </div>
        <div class="clawfi-fm-market-card">
          <div class="clawfi-fm-market-label">Liquidity</div>
          <div class="clawfi-fm-market-value">$${formatNumber(data.liquidity)}</div>
        </div>
        <div class="clawfi-fm-market-card">
          <div class="clawfi-fm-market-label">Market Cap</div>
          <div class="clawfi-fm-market-value">${data.marketCap ? '$' + formatNumber(data.marketCap) : 'N/A'}</div>
        </div>
      </div>
    </div>
  `;
}

// Initialize overlay
async function initFourMemeOverlay(): Promise<void> {
  // Check settings
  const settings = await new Promise<Settings>((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (s) => resolve(s));
  });
  
  if (settings && settings.overlayEnabled === false) return;
  
  // Detect token
  const token = detectFourMemeToken();
  if (!token) return;
  
  // Notify background
  chrome.runtime.sendMessage({
    type: 'DETECTED_TOKEN',
    token: token.address,
    chain: 'bsc',
    source: 'fourmeme',
  });
  
  // Create overlay
  const overlay = createOverlay(token);
  document.body.appendChild(overlay);
  
  // State
  let signals: Signal[] = [];
  let marketData: MarketData | null = null;
  let activeTab = 'signals';
  
  // Elements
  const toggleBtn = document.getElementById('clawfi-fm-toggle');
  const closeBtn = document.getElementById('clawfi-fm-close');
  const panel = document.getElementById('clawfi-fm-panel');
  const badge = document.getElementById('clawfi-fm-badge');
  const content = document.getElementById('clawfi-fm-content');
  const tabSignals = document.getElementById('clawfi-fm-tab-signals');
  const tabMarket = document.getElementById('clawfi-fm-tab-market');
  
  // Toggle handler
  toggleBtn?.addEventListener('click', () => {
    panel?.classList.toggle('expanded');
    if (toggleBtn) toggleBtn.style.display = panel?.classList.contains('expanded') ? 'none' : 'flex';
  });
  
  // Close handler
  closeBtn?.addEventListener('click', () => {
    panel?.classList.remove('expanded');
    if (toggleBtn) toggleBtn.style.display = 'flex';
  });
  
  // Tab handlers
  function updateTabs() {
    if (activeTab === 'signals') {
      tabSignals?.classList.add('active');
      tabMarket?.classList.remove('active');
      if (content) {
        content.innerHTML = `<div class="clawfi-fm-signals">${renderSignals(signals)}</div>`;
      }
    } else {
      tabSignals?.classList.remove('active');
      tabMarket?.classList.add('active');
      if (content) {
        content.innerHTML = renderMarketData(marketData);
      }
    }
  }
  
  tabSignals?.addEventListener('click', () => {
    activeTab = 'signals';
    updateTabs();
  });
  
  tabMarket?.addEventListener('click', () => {
    activeTab = 'market';
    updateTabs();
  });
  
  // Fetch signals
  chrome.runtime.sendMessage(
    { type: 'GET_SIGNALS', token: token.address, chain: 'bsc' },
    (data: Signal[]) => {
      signals = data || [];
      
      // Update badge
      if (badge && signals.length > 0) {
        badge.textContent = String(signals.length);
        badge.classList.add('has-signals');
      }
      
      // Update content
      updateTabs();
    }
  );
  
  // Fetch market data
  if (settings) {
    try {
      const nodeUrl = settings.nodeUrl || 'https://api.clawfi.ai';
      const response = await fetch(`${nodeUrl}/dexscreener/token/${token.address}?chain=bsc`, {
        headers: settings.authToken ? { 'Authorization': `Bearer ${settings.authToken}` } : {},
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          marketData = {
            priceUsd: data.data.priceUsd || 0,
            priceChange24h: data.data.priceChange24h || 0,
            volume24h: data.data.volume24h || 0,
            liquidity: data.data.liquidity || 0,
            marketCap: data.data.marketCap,
          };
          if (activeTab === 'market') {
            updateTabs();
          }
        }
      }
    } catch (err) {
      console.warn('[ClawFi] Market data error:', err);
    }
  }
}

// Wait for page to load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFourMemeOverlay);
} else {
  initFourMemeOverlay();
}
