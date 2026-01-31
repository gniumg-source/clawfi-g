/**
 * ClawFi Extension - Four.meme Content Script
 * 
 * Detects tokens on Four.meme (BSC memecoin launchpad)
 */

interface FourMemeTokenInfo {
  address: string;
  name?: string;
  symbol?: string;
  creator?: string;
  marketCap?: string;
}

interface Settings {
  nodeUrl: string;
  authToken: string;
  overlayEnabled: boolean;
}

// BSC address regex
const BSC_ADDRESS_REGEX = /0x[a-fA-F0-9]{40}/g;

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

// Create and inject overlay
function createOverlay(token: FourMemeTokenInfo): HTMLElement {
  const overlay = document.createElement('div');
  overlay.id = 'clawfi-fourmeme-overlay';
  overlay.innerHTML = `
    <style>
      #clawfi-fourmeme-overlay {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 999999;
        font-family: system-ui, -apple-system, sans-serif;
      }
      
      .clawfi-fm-btn {
        width: 48px;
        height: 48px;
        border-radius: 12px;
        background: linear-gradient(135deg, #F0B90B 0%, #d4a00a 100%);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 20px rgba(240, 185, 11, 0.4);
        position: relative;
      }
      
      .clawfi-fm-btn span {
        font-size: 20px;
        font-weight: bold;
        color: #0a0f14;
      }
      
      .clawfi-fm-badge {
        position: absolute;
        top: -4px;
        right: -4px;
        width: 20px;
        height: 20px;
        border-radius: 10px;
        background: #ef4444;
        color: white;
        font-size: 12px;
        font-weight: bold;
        display: none;
        align-items: center;
        justify-content: center;
      }
      
      .clawfi-fm-badge.has-signals {
        display: flex;
      }
      
      .clawfi-fm-panel {
        display: none;
        width: 320px;
        background: #0a0f14;
        border-radius: 12px;
        border: 1px solid #F0B90B33;
        box-shadow: 0 8px 32px rgba(240, 185, 11, 0.2);
        overflow: hidden;
      }
      
      .clawfi-fm-panel.expanded {
        display: block;
      }
      
      .clawfi-fm-header {
        padding: 12px 16px;
        background: linear-gradient(135deg, #F0B90B 0%, #d4a00a 100%);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      
      .clawfi-fm-header span {
        font-weight: bold;
        color: #0a0f14;
        font-size: 14px;
      }
      
      .clawfi-fm-close {
        background: transparent;
        border: none;
        color: #0a0f14;
        cursor: pointer;
        font-size: 18px;
      }
      
      .clawfi-fm-content {
        padding: 12px 16px;
        border-bottom: 1px solid #1a2530;
      }
      
      .clawfi-fm-label {
        font-size: 12px;
        color: #64748b;
        margin-bottom: 4px;
      }
      
      .clawfi-fm-address {
        font-size: 13px;
        color: #f1f5f9;
        background: #1a2530;
        padding: 4px 8px;
        border-radius: 4px;
        font-family: monospace;
      }
      
      .clawfi-fm-chain {
        font-size: 11px;
        color: #F0B90B;
        margin-left: 8px;
      }
      
      .clawfi-fm-signals {
        max-height: 240px;
        overflow: auto;
      }
      
      .clawfi-fm-empty {
        padding: 24px;
        text-align: center;
        color: #64748b;
        font-size: 13px;
      }
      
      .clawfi-fm-signal {
        padding: 12px 16px;
        border-bottom: 1px solid #1a2530;
      }
      
      .clawfi-fm-footer {
        padding: 8px 16px;
        background: #0d1117;
        font-size: 11px;
        color: #64748b;
        text-align: center;
      }
    </style>
    
    <button class="clawfi-fm-btn" id="clawfi-fm-toggle">
      <span>4</span>
      <div class="clawfi-fm-badge" id="clawfi-fm-badge">0</div>
    </button>
    
    <div class="clawfi-fm-panel" id="clawfi-fm-panel">
      <div class="clawfi-fm-header">
        <span>ClawFi • BSC</span>
        <button class="clawfi-fm-close" id="clawfi-fm-close">×</button>
      </div>
      <div class="clawfi-fm-content">
        <div class="clawfi-fm-label">Detected Token</div>
        <span class="clawfi-fm-address">${token.address.slice(0, 6)}...${token.address.slice(-4)}</span>
        <span class="clawfi-fm-chain">BSC</span>
      </div>
      <div class="clawfi-fm-signals" id="clawfi-fm-signals">
        <div class="clawfi-fm-empty">Loading signals...</div>
      </div>
      <div class="clawfi-fm-footer">ClawFi v0.2.1 • Four.meme Support</div>
    </div>
  `;
  
  return overlay;
}

// Initialize overlay
async function initFourMemeOverlay(): Promise<void> {
  // Check settings
  const settings = await new Promise<Settings>((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (s) => resolve(s));
  });
  
  if (!settings.overlayEnabled) return;
  
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
  
  // Add event listeners
  const toggleBtn = document.getElementById('clawfi-fm-toggle');
  const closeBtn = document.getElementById('clawfi-fm-close');
  const panel = document.getElementById('clawfi-fm-panel');
  
  toggleBtn?.addEventListener('click', () => {
    panel?.classList.toggle('expanded');
    if (toggleBtn) toggleBtn.style.display = panel?.classList.contains('expanded') ? 'none' : 'flex';
  });
  
  closeBtn?.addEventListener('click', () => {
    panel?.classList.remove('expanded');
    if (toggleBtn) toggleBtn.style.display = 'flex';
  });
  
  // Fetch signals
  chrome.runtime.sendMessage(
    { type: 'GET_SIGNALS', token: token.address, chain: 'bsc' },
    (signals: Array<{ id: string; ts: number; severity: string; title: string; summary: string }>) => {
      const container = document.getElementById('clawfi-fm-signals');
      const badge = document.getElementById('clawfi-fm-badge');
      
      if (!signals || signals.length === 0) {
        if (container) {
          container.innerHTML = '<div class="clawfi-fm-empty">No signals for this token</div>';
        }
        return;
      }
      
      // Update badge
      if (badge) {
        badge.textContent = String(signals.length);
        badge.classList.add('has-signals');
      }
      
      // Render signals
      if (container) {
        container.innerHTML = signals.map((s) => `
          <div class="clawfi-fm-signal">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <span style="width: 8px; height: 8px; border-radius: 4px; background: ${
                s.severity === 'critical' ? '#ef4444' :
                s.severity === 'high' ? '#f97316' :
                s.severity === 'medium' ? '#eab308' : '#3b82f6'
              };"></span>
              <span style="font-size: 13px; font-weight: 500; color: #f1f5f9;">${s.title}</span>
            </div>
            <p style="font-size: 12px; color: #94a3b8; margin: 0 0 4px 16px;">${s.summary.slice(0, 80)}${s.summary.length > 80 ? '...' : ''}</p>
          </div>
        `).join('');
      }
    }
  );
}

// Wait for page to load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFourMemeOverlay);
} else {
  initFourMemeOverlay();
}
