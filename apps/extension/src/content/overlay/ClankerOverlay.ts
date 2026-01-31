/**
 * ClawFi Clanker Overlay
 * 
 * Renders a shadow DOM overlay for Clanker token pages.
 * Shows token info, metadata, and ClawFi signals.
 */

interface ClankerTokenMetadata {
  address: string;
  chain: 'base';
  version?: string;
  creator?: string;
  admin?: string;
  verified?: boolean;
  name?: string;
  symbol?: string;
}

interface Signal {
  id: string;
  ts: number;
  severity: string;
  signalType?: string;
  title: string;
  summary: string;
  recommendedAction: string;
}

interface RiskBadges {
  hasLaunch: boolean;
  hasConcentration: boolean;
  hasLiquidityRisk: boolean;
}

interface OverlayState {
  metadata: ClankerTokenMetadata;
  signals: Signal[];
  badges: RiskBadges;
  loading: boolean;
  error: string | null;
  expanded: boolean;
  closed: boolean;
}

const SHADOW_HOST_ID = 'clawfi-clanker-overlay';
const BASESCAN_URL = 'https://basescan.org/address/';

let shadowHost: HTMLDivElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let state: OverlayState | null = null;

/**
 * Format address for display
 */
function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Format relative time
 */
function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Copy text to clipboard
 */
async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}

/**
 * Get severity color
 */
function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#eab308',
    low: '#3b82f6',
  };
  return colors[severity] || colors.low;
}

/**
 * Generate overlay styles (injected into shadow DOM)
 */
function getOverlayStyles(): string {
  return `
    :host {
      all: initial;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    .clawfi-overlay {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 2147483647;
      font-size: 13px;
      line-height: 1.4;
    }
    
    .clawfi-fab {
      width: 52px;
      height: 52px;
      border-radius: 14px;
      background: linear-gradient(135deg, #14b899 0%, #0d957d 100%);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 20px rgba(20, 184, 153, 0.5);
      transition: transform 0.2s, box-shadow 0.2s;
      position: relative;
    }
    
    .clawfi-fab:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 28px rgba(20, 184, 153, 0.6);
    }
    
    .clawfi-fab-icon {
      font-size: 24px;
      font-weight: bold;
      color: white;
    }
    
    .clawfi-fab-badge {
      position: absolute;
      top: -6px;
      right: -6px;
      min-width: 22px;
      height: 22px;
      border-radius: 11px;
      background: #ef4444;
      color: white;
      font-size: 11px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 6px;
    }
    
    .clawfi-panel {
      width: 340px;
      background: #0a0f14;
      border-radius: 14px;
      border: 1px solid #1e2a36;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
      overflow: hidden;
    }
    
    .clawfi-header {
      padding: 14px 16px;
      background: linear-gradient(135deg, #14b899 0%, #0d957d 100%);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .clawfi-header-title {
      font-weight: 700;
      color: white;
      font-size: 15px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .clawfi-header-actions {
      display: flex;
      gap: 8px;
    }
    
    .clawfi-header-btn {
      background: rgba(255,255,255,0.15);
      border: none;
      color: white;
      width: 28px;
      height: 28px;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      transition: background 0.2s;
    }
    
    .clawfi-header-btn:hover {
      background: rgba(255,255,255,0.25);
    }
    
    .clawfi-body {
      max-height: 420px;
      overflow-y: auto;
    }
    
    .clawfi-section {
      padding: 14px 16px;
      border-bottom: 1px solid #1e2a36;
    }
    
    .clawfi-section:last-child {
      border-bottom: none;
    }
    
    .clawfi-section-title {
      font-size: 11px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    
    .clawfi-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    
    .clawfi-row:last-child {
      margin-bottom: 0;
    }
    
    .clawfi-row-label {
      color: #94a3b8;
      font-size: 12px;
    }
    
    .clawfi-row-value {
      color: #f1f5f9;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .clawfi-address {
      font-family: 'SF Mono', Monaco, monospace;
      background: #1e2a36;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
    }
    
    .clawfi-copy-btn {
      background: transparent;
      border: none;
      color: #64748b;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      transition: color 0.2s, background 0.2s;
    }
    
    .clawfi-copy-btn:hover {
      color: #14b899;
      background: rgba(20, 184, 153, 0.1);
    }
    
    .clawfi-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
    }
    
    .clawfi-badge-base {
      background: #0052ff20;
      color: #0052ff;
    }
    
    .clawfi-badge-version {
      background: #8b5cf620;
      color: #a78bfa;
    }
    
    .clawfi-badge-verified {
      background: #14b89920;
      color: #14b899;
    }
    
    /* Alert badges for risk indicators */
    .clawfi-badges-container {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    
    .clawfi-alert-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .clawfi-alert-badge:hover {
      transform: scale(1.05);
    }
    
    .clawfi-alert-launch {
      background: #22c55e20;
      color: #22c55e;
      border: 1px solid #22c55e40;
    }
    
    .clawfi-alert-concentration {
      background: #f59e0b20;
      color: #f59e0b;
      border: 1px solid #f59e0b40;
    }
    
    .clawfi-alert-liquidity {
      background: #ef444420;
      color: #ef4444;
      border: 1px solid #ef444440;
    }
    
    .clawfi-fab-risk {
      animation: pulse-risk 2s ease-in-out infinite;
    }
    
    .clawfi-fab-risk-dot {
      position: absolute;
      top: 2px;
      right: 2px;
      width: 8px;
      height: 8px;
      background: #ef4444;
      border-radius: 50%;
      box-shadow: 0 0 4px #ef4444;
    }
    
    @keyframes pulse-risk {
      0%, 100% { box-shadow: 0 4px 16px rgba(239, 68, 68, 0.3); }
      50% { box-shadow: 0 4px 24px rgba(239, 68, 68, 0.5); }
    }
    
    .clawfi-link {
      color: #14b899;
      text-decoration: none;
      transition: color 0.2s;
    }
    
    .clawfi-link:hover {
      color: #5eeacb;
      text-decoration: underline;
    }
    
    .clawfi-signals-empty {
      padding: 24px;
      text-align: center;
      color: #64748b;
    }
    
    .clawfi-signal {
      padding: 12px 16px;
      border-bottom: 1px solid #1e2a36;
      transition: background 0.2s;
    }
    
    .clawfi-signal:last-child {
      border-bottom: none;
    }
    
    .clawfi-signal:hover {
      background: #0d1117;
    }
    
    .clawfi-signal-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }
    
    .clawfi-signal-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    
    .clawfi-signal-title {
      color: #f1f5f9;
      font-weight: 500;
      font-size: 13px;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .clawfi-signal-summary {
      color: #94a3b8;
      font-size: 12px;
      margin-left: 16px;
      margin-bottom: 4px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    
    .clawfi-signal-meta {
      color: #64748b;
      font-size: 11px;
      margin-left: 16px;
    }
    
    .clawfi-loading {
      padding: 24px;
      text-align: center;
      color: #64748b;
    }
    
    .clawfi-loading-spinner {
      width: 24px;
      height: 24px;
      border: 2px solid #1e2a36;
      border-top-color: #14b899;
      border-radius: 50%;
      animation: clawfi-spin 0.8s linear infinite;
      margin: 0 auto 8px;
    }
    
    @keyframes clawfi-spin {
      to { transform: rotate(360deg); }
    }
    
    .clawfi-error {
      padding: 16px;
      background: #ef444420;
      border-radius: 8px;
      margin: 12px 16px;
    }
    
    .clawfi-error-text {
      color: #fca5a5;
      font-size: 12px;
      margin-bottom: 8px;
    }
    
    .clawfi-retry-btn {
      background: #ef4444;
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
      transition: background 0.2s;
    }
    
    .clawfi-retry-btn:hover {
      background: #dc2626;
    }
    
    .clawfi-footer {
      padding: 10px 16px;
      background: #0d1117;
      border-top: 1px solid #1e2a36;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .clawfi-footer-text {
      color: #64748b;
      font-size: 10px;
    }
    
    .clawfi-dashboard-btn {
      background: #14b899;
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      text-decoration: none;
      transition: background 0.2s;
    }
    
    .clawfi-dashboard-btn:hover {
      background: #0d957d;
    }
    
    /* Assist Mode Button (OpenClaw-style) */
    .clawfi-assist-btn {
      background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);
      color: white;
      border: none;
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
      margin-top: 8px;
      width: 100%;
      justify-content: center;
    }
    
    .clawfi-assist-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
    }
    
    .clawfi-assist-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }
    
    .clawfi-assist-icon {
      font-size: 14px;
    }
    
    .clawfi-assist-modal {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #0a0f14;
      border: 1px solid #8b5cf6;
      border-radius: 12px;
      padding: 24px;
      z-index: 2147483648;
      min-width: 300px;
      text-align: center;
    }
    
    .clawfi-assist-modal-title {
      color: #f1f5f9;
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 12px;
    }
    
    .clawfi-assist-modal-text {
      color: #94a3b8;
      font-size: 13px;
      margin-bottom: 16px;
    }
    
    .clawfi-assist-modal-close {
      background: #1e2a36;
      color: #f1f5f9;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
    }
    
    .clawfi-assist-modal-close:hover {
      background: #2d3a48;
    }
    
    .clawfi-modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      z-index: 2147483647;
    }
  `;
}

/**
 * Generate overlay HTML
 */
function generateOverlayHTML(state: OverlayState): string {
  const { metadata, signals, badges, loading, error, expanded, closed } = state;
  
  if (closed) {
    return '';
  }
  
  // Count active risk badges for FAB indicator
  const riskCount = [badges.hasConcentration, badges.hasLiquidityRisk].filter(Boolean).length;
  
  if (!expanded) {
    // Collapsed FAB with risk indicator
    return `
      <div class="clawfi-overlay">
        <button class="clawfi-fab ${riskCount > 0 ? 'clawfi-fab-risk' : ''}" data-action="expand">
          <span class="clawfi-fab-icon">🦀</span>
          ${signals.length > 0 ? `<span class="clawfi-fab-badge">${signals.length}</span>` : ''}
          ${riskCount > 0 ? `<span class="clawfi-fab-risk-dot"></span>` : ''}
        </button>
      </div>
    `;
  }
  
  // Expanded panel
  const tokenRows = `
    <div class="clawfi-row">
      <span class="clawfi-row-label">Token</span>
      <span class="clawfi-row-value">
        <code class="clawfi-address">${formatAddress(metadata.address)}</code>
        <button class="clawfi-copy-btn" data-action="copy" data-value="${metadata.address}" title="Copy address">📋</button>
      </span>
    </div>
    <div class="clawfi-row">
      <span class="clawfi-row-label">Chain</span>
      <span class="clawfi-row-value">
        <span class="clawfi-badge clawfi-badge-base">⬡ Base</span>
      </span>
    </div>
    ${(badges.hasLaunch || badges.hasConcentration || badges.hasLiquidityRisk) ? `
    <div class="clawfi-row clawfi-badges-row">
      <span class="clawfi-row-label">Alerts</span>
      <span class="clawfi-row-value clawfi-badges-container">
        ${badges.hasLaunch ? '<span class="clawfi-alert-badge clawfi-alert-launch" title="Launch detected">🚀 Launch</span>' : ''}
        ${badges.hasConcentration ? '<span class="clawfi-alert-badge clawfi-alert-concentration" title="High token concentration">⚠️ High Concentration</span>' : ''}
        ${badges.hasLiquidityRisk ? '<span class="clawfi-alert-badge clawfi-alert-liquidity" title="Liquidity risk detected">🔥 Liquidity Risk</span>' : ''}
      </span>
    </div>
    ` : ''}
    ${metadata.version ? `
    <div class="clawfi-row">
      <span class="clawfi-row-label">Version</span>
      <span class="clawfi-row-value">
        <span class="clawfi-badge clawfi-badge-version">${metadata.version}</span>
      </span>
    </div>
    ` : ''}
    ${metadata.verified ? `
    <div class="clawfi-row">
      <span class="clawfi-row-label">Status</span>
      <span class="clawfi-row-value">
        <span class="clawfi-badge clawfi-badge-verified">✓ Verified</span>
      </span>
    </div>
    ` : ''}
  `;
  
  const creatorRows = `
    ${metadata.creator ? `
    <div class="clawfi-row">
      <span class="clawfi-row-label">Creator</span>
      <span class="clawfi-row-value">
        <a class="clawfi-link" href="${BASESCAN_URL}${metadata.creator}" target="_blank" rel="noopener">
          ${formatAddress(metadata.creator)}
        </a>
        <button class="clawfi-copy-btn" data-action="copy" data-value="${metadata.creator}" title="Copy">📋</button>
      </span>
    </div>
    ` : ''}
    ${metadata.admin ? `
    <div class="clawfi-row">
      <span class="clawfi-row-label">Admin</span>
      <span class="clawfi-row-value">
        <a class="clawfi-link" href="${BASESCAN_URL}${metadata.admin}" target="_blank" rel="noopener">
          ${formatAddress(metadata.admin)}
        </a>
        <button class="clawfi-copy-btn" data-action="copy" data-value="${metadata.admin}" title="Copy">📋</button>
      </span>
    </div>
    ` : ''}
  `;
  
  let signalsContent = '';
  if (loading) {
    signalsContent = `
      <div class="clawfi-loading">
        <div class="clawfi-loading-spinner"></div>
        <div>Loading signals...</div>
      </div>
    `;
  } else if (error) {
    signalsContent = `
      <div class="clawfi-error">
        <div class="clawfi-error-text">${error}</div>
        <button class="clawfi-retry-btn" data-action="retry">Retry</button>
      </div>
    `;
  } else if (signals.length === 0) {
    signalsContent = `
      <div class="clawfi-signals-empty">
        No signals for this token
      </div>
    `;
  } else {
    signalsContent = signals.map(signal => `
      <div class="clawfi-signal">
        <div class="clawfi-signal-header">
          <span class="clawfi-signal-dot" style="background: ${getSeverityColor(signal.severity)}"></span>
          <span class="clawfi-signal-title">${escapeHtml(signal.title)}</span>
        </div>
        <div class="clawfi-signal-summary">${escapeHtml(signal.summary.slice(0, 120))}${signal.summary.length > 120 ? '...' : ''}</div>
        <div class="clawfi-signal-meta">${formatRelativeTime(signal.ts)} • ${signal.recommendedAction.replace(/_/g, ' ')}</div>
      </div>
    `).join('');
  }
  
  return `
    <div class="clawfi-overlay">
      <div class="clawfi-panel">
        <div class="clawfi-header">
          <div class="clawfi-header-title">
            <span>🦀</span>
            <span>ClawFi</span>
          </div>
          <div class="clawfi-header-actions">
            <button class="clawfi-header-btn" data-action="collapse" title="Minimize">−</button>
            <button class="clawfi-header-btn" data-action="close" title="Close">×</button>
          </div>
        </div>
        
        <div class="clawfi-body">
          <div class="clawfi-section">
            <div class="clawfi-section-title">Token Info</div>
            ${tokenRows}
          </div>
          
          ${(metadata.creator || metadata.admin) ? `
          <div class="clawfi-section">
            <div class="clawfi-section-title">Addresses</div>
            ${creatorRows}
          </div>
          ` : ''}
          
          <div class="clawfi-section">
            <div class="clawfi-section-title">Signals (${signals.length})</div>
          </div>
          ${signalsContent}
        </div>
        
        <div class="clawfi-footer">
          <span class="clawfi-footer-text">ClawFi v0.2.0 • Clanker</span>
          <a class="clawfi-dashboard-btn" data-action="dashboard">Open Dashboard</a>
        </div>
        
        <!-- Assist Mode Button (OpenClaw-style stub) -->
        <div style="padding: 0 16px 14px;">
          <button class="clawfi-assist-btn" data-action="assist-mode">
            <span class="clawfi-assist-icon">⚡</span>
            Assist Mode
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Fetch signals from ClawFi Node
 */
async function fetchSignals(token: string): Promise<Signal[]> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'GET_SIGNALS', token, chain: 'base', limit: 5 },
      (response) => {
        if (Array.isArray(response)) {
          resolve(response);
        } else {
          resolve([]);
        }
      }
    );
  });
}

/**
 * Open dashboard
 */
async function openDashboard(): Promise<void> {
  const settings = await new Promise<{ nodeUrl: string }>((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, resolve);
  });
  
  // Assume dashboard is on port 3000 if node is on 3001
  let dashboardUrl = settings.nodeUrl.replace(':3001', ':3000');
  if (!dashboardUrl.includes(':3000')) {
    dashboardUrl = 'http://localhost:3000';
  }
  
  if (state?.metadata.address) {
    dashboardUrl += `/dashboard/signals?token=${state.metadata.address}`;
  }
  
  window.open(dashboardUrl, '_blank');
}

/**
 * Update overlay render
 */
function render(): void {
  if (!shadowRoot || !state) return;
  
  shadowRoot.innerHTML = `
    <style>${getOverlayStyles()}</style>
    ${generateOverlayHTML(state)}
  `;
  
  // Attach event listeners
  attachEventListeners();
}

/**
 * Attach event listeners to overlay elements
 */
function attachEventListeners(): void {
  if (!shadowRoot) return;
  
  // Expand FAB
  const fab = shadowRoot.querySelector('[data-action="expand"]');
  fab?.addEventListener('click', () => {
    if (state) {
      state.expanded = true;
      render();
    }
  });
  
  // Collapse panel
  const collapseBtn = shadowRoot.querySelector('[data-action="collapse"]');
  collapseBtn?.addEventListener('click', () => {
    if (state) {
      state.expanded = false;
      render();
    }
  });
  
  // Close panel
  const closeBtn = shadowRoot.querySelector('[data-action="close"]');
  closeBtn?.addEventListener('click', () => {
    if (state) {
      state.closed = true;
      render();
    }
  });
  
  // Copy buttons
  const copyBtns = shadowRoot.querySelectorAll('[data-action="copy"]');
  copyBtns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const value = (e.currentTarget as HTMLElement).dataset.value;
      if (value) {
        await copyToClipboard(value);
        // Visual feedback
        const el = e.currentTarget as HTMLElement;
        const original = el.textContent;
        el.textContent = '✓';
        setTimeout(() => {
          el.textContent = original;
        }, 1000);
      }
    });
  });
  
  // Retry button
  const retryBtn = shadowRoot.querySelector('[data-action="retry"]');
  retryBtn?.addEventListener('click', async () => {
    if (state) {
      state.loading = true;
      state.error = null;
      render();
      
      try {
        const signals = await fetchSignals(state.metadata.address);
        state.signals = signals;
        state.loading = false;
      } catch {
        state.error = 'Failed to connect to ClawFi Node';
        state.loading = false;
      }
      render();
    }
  });
  
  // Dashboard button
  const dashboardBtn = shadowRoot.querySelector('[data-action="dashboard"]');
  dashboardBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    openDashboard();
  });
  
  // Assist Mode button (stub - shows "coming soon" modal)
  const assistBtn = shadowRoot.querySelector('[data-action="assist-mode"]');
  assistBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    showAssistModeModal();
  });
}

/**
 * Show Assist Mode "coming soon" modal
 */
function showAssistModeModal(): void {
  if (!shadowRoot) return;
  
  // Check if modal already exists
  const existing = shadowRoot.querySelector('.clawfi-modal-backdrop');
  if (existing) {
    existing.remove();
    return;
  }
  
  // Create modal HTML
  const modalHtml = `
    <div class="clawfi-modal-backdrop" data-action="close-modal">
      <div class="clawfi-assist-modal" onclick="event.stopPropagation()">
        <div class="clawfi-assist-modal-title">⚡ Assist Mode</div>
        <div class="clawfi-assist-modal-text">
          Assist Mode allows ClawFi to prepare transactions for you to review and sign.
          <br><br>
          <strong>Coming Soon!</strong>
          <br><br>
          This feature is under development. ClawFi will never sign transactions automatically.
        </div>
        <button class="clawfi-assist-modal-close" data-action="close-modal">Got it</button>
      </div>
    </div>
  `;
  
  // Append to shadow root
  const modalContainer = document.createElement('div');
  modalContainer.innerHTML = modalHtml;
  shadowRoot.appendChild(modalContainer.firstElementChild!);
  
  // Add close handlers
  const closeElements = shadowRoot.querySelectorAll('[data-action="close-modal"]');
  closeElements.forEach(el => {
    el.addEventListener('click', () => {
      const backdrop = shadowRoot?.querySelector('.clawfi-modal-backdrop');
      backdrop?.remove();
    });
  });
}

/**
 * Render the Clanker overlay
 */
/**
 * Calculate risk badges from signals
 */
function calculateBadges(signals: Signal[]): RiskBadges {
  return {
    hasLaunch: signals.some(s => s.signalType === 'LaunchDetected'),
    hasConcentration: signals.some(s => s.signalType === 'EarlyDistribution'),
    hasLiquidityRisk: signals.some(s => s.signalType === 'LiquidityRisk'),
  };
}

export async function renderClankerOverlay(metadata: ClankerTokenMetadata): Promise<void> {
  // Create shadow host if doesn't exist
  if (!shadowHost) {
    shadowHost = document.createElement('div');
    shadowHost.id = SHADOW_HOST_ID;
    document.body.appendChild(shadowHost);
    shadowRoot = shadowHost.attachShadow({ mode: 'closed' });
  }
  
  // Initialize state with default badges
  state = {
    metadata,
    signals: [],
    badges: { hasLaunch: false, hasConcentration: false, hasLiquidityRisk: false },
    loading: true,
    error: null,
    expanded: false,
    closed: false,
  };
  
  // Initial render
  render();
  
  // Fetch signals
  try {
    const signals = await fetchSignals(metadata.address);
    if (state && state.metadata.address === metadata.address) {
      state.signals = signals;
      state.badges = calculateBadges(signals);
      state.loading = false;
      render();
    }
  } catch (error) {
    if (state && state.metadata.address === metadata.address) {
      state.error = 'Unable to reach ClawFi Node';
      state.loading = false;
      render();
    }
  }
}

/**
 * Unmount the overlay
 */
export function unmountClankerOverlay(): void {
  if (shadowHost) {
    shadowHost.remove();
    shadowHost = null;
    shadowRoot = null;
    state = null;
  }
}

