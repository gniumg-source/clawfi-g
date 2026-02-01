/**
 * ClawFi Extension - Popup Script
 * 
 * Handles the extension popup UI with quick stats, recent signals,
 * trending tokens, and quick actions.
 * 
 * Design: Apple Liquid Glass (iOS 26)
 */

const VERSION = '0.3.1';

interface ExtensionSettings {
  nodeUrl: string;
  authToken: string;
  overlayEnabled: boolean;
  clankerOverlayEnabled: boolean;
}

interface Signal {
  id: string;
  ts: number;
  severity: string;
  title: string;
  summary: string;
  token?: string;
  chain?: string;
}

interface PopupStats {
  signalsToday: number;
  tokensTracked: number;
  alertsToday: number;
}

interface TrendingToken {
  chainId: string;
  tokenAddress: string;
  totalAmount: number;
  icon?: string;
  description?: string;
  url: string;
}

const DEFAULT_SETTINGS: ExtensionSettings = {
  nodeUrl: 'https://api.clawfi.ai',
  authToken: '',
  overlayEnabled: true,
  clankerOverlayEnabled: true,
};

// Send message with retry
async function sendMessage<T>(message: unknown, retries = 3): Promise<T | null> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await new Promise<T>((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response as T);
          }
        });
      });
    } catch (error) {
      console.warn(`[ClawFi Popup] Message failed (attempt ${attempt + 1}):`, error);
      if (attempt < retries - 1) {
        await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
      }
    }
  }
  return null;
}

// Get settings from background with retry and fallback
async function getSettings(): Promise<ExtensionSettings> {
  // First try background
  const settings = await sendMessage<ExtensionSettings>({ type: 'GET_SETTINGS' });
  if (settings && settings.authToken) {
    console.log('[ClawFi Popup] Got settings from background');
    return settings;
  }
  
  // Fallback to direct storage access - prioritize local storage
  try {
    const localResult = await chrome.storage.local.get('settings');
    if (localResult.settings && localResult.settings.authToken) {
      console.log('[ClawFi Popup] Got settings from local storage');
      return { ...DEFAULT_SETTINGS, ...localResult.settings };
    }
    
    const syncResult = await chrome.storage.sync.get('settings');
    if (syncResult.settings) {
      console.log('[ClawFi Popup] Got settings from sync storage');
      return { ...DEFAULT_SETTINGS, ...syncResult.settings };
    }
  } catch (error) {
    console.error('[ClawFi Popup] Storage access failed:', error);
  }
  
  console.log('[ClawFi Popup] Using default settings');
  return DEFAULT_SETTINGS;
}

// Fetch with timeout
async function fetchWithTimeout(url: string, options: RequestInit, timeout = 8000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Fetch recent signals with timeout
async function fetchRecentSignals(nodeUrl: string, authToken: string): Promise<Signal[]> {
  if (!authToken) return [];
  
  try {
    const response = await fetchWithTimeout(`${nodeUrl}/signals?limit=5`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json() as { success: boolean; data: Signal[] };
    return data.success ? data.data : [];
  } catch (error) {
    console.error('[ClawFi Popup] Failed to fetch signals:', error);
    return [];
  }
}

// Fetch stats with timeout
async function fetchStats(nodeUrl: string, authToken: string): Promise<PopupStats> {
  if (!authToken) return { signalsToday: 0, tokensTracked: 0, alertsToday: 0 };
  
  try {
    const response = await fetchWithTimeout(`${nodeUrl}/agent/status`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json() as { 
      success: boolean; 
      data: { 
        stats: { 
          signalsToday: number; 
          watchedTokens: number;
          alertsToday?: number;
        } 
      } 
    };
    
    if (data.success) {
      return {
        signalsToday: data.data.stats.signalsToday || 0,
        tokensTracked: data.data.stats.watchedTokens || 0,
        alertsToday: data.data.stats.alertsToday || 0,
      };
    }
    return { signalsToday: 0, tokensTracked: 0, alertsToday: 0 };
  } catch (error) {
    console.error('[ClawFi Popup] Failed to fetch stats:', error);
    return { signalsToday: 0, tokensTracked: 0, alertsToday: 0 };
  }
}

// Fetch trending tokens
async function fetchTrendingTokens(nodeUrl: string): Promise<TrendingToken[]> {
  try {
    const response = await fetchWithTimeout(`${nodeUrl}/dexscreener/boosts/top`, {
      headers: {
        'Content-Type': 'application/json',
      },
    }, 5000);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json() as { success: boolean; data: TrendingToken[] };
    return data.success ? data.data.slice(0, 3) : [];
  } catch (error) {
    console.error('[ClawFi Popup] Failed to fetch trending:', error);
    return [];
  }
}

// Check API health with timeout
async function checkApiHealth(nodeUrl: string): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(`${nodeUrl}/health`, {
      method: 'GET',
    }, 5000);
    return response.ok;
  } catch {
    return false;
  }
}

// Format time
function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Format address
function formatAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// Render signals list
function renderSignals(signals: Signal[]): void {
  const container = document.getElementById('signals-list');
  if (!container) return;

  if (signals.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div style="font-size: 24px; margin-bottom: 8px;">✨</div>
        No recent signals
      </div>
    `;
    return;
  }

  container.innerHTML = signals.map((signal) => `
    <div class="signal-item">
      <div class="signal-severity ${signal.severity}"></div>
      <div class="signal-content">
        <div class="signal-title">${escapeHtml(signal.title)}</div>
        <div class="signal-time">${formatTime(signal.ts)}</div>
      </div>
    </div>
  `).join('');
}

// Escape HTML
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Update status indicators
function updateStatus(apiConnected: boolean, hasToken: boolean): void {
  const apiStatus = document.getElementById('api-status');
  const apiStatusText = document.getElementById('api-status-text');
  const wsStatus = document.getElementById('ws-status');
  const wsStatusText = document.getElementById('ws-status-text');

  if (apiStatus && apiStatusText) {
    if (!hasToken) {
      apiStatus.className = 'status-dot warning';
      apiStatusText.textContent = 'No Token';
    } else if (apiConnected) {
      apiStatus.className = 'status-dot connected';
      apiStatusText.textContent = 'Connected';
    } else {
      apiStatus.className = 'status-dot disconnected';
      apiStatusText.textContent = 'Offline';
    }
  }

  if (wsStatus && wsStatusText) {
    if (apiConnected) {
      wsStatus.className = 'status-dot connected';
      wsStatusText.textContent = 'Active';
    } else {
      wsStatus.className = 'status-dot warning';
      wsStatusText.textContent = 'N/A';
    }
  }
}

// Update stats
function updateStats(stats: PopupStats): void {
  const signalsEl = document.getElementById('signals-count');
  const tokensEl = document.getElementById('tokens-count');
  const alertsEl = document.getElementById('alerts-count');

  if (signalsEl) signalsEl.textContent = String(stats.signalsToday);
  if (tokensEl) tokensEl.textContent = String(stats.tokensTracked);
  if (alertsEl) alertsEl.textContent = String(stats.alertsToday);
}

// Render trending tokens
function renderTrendingTokens(tokens: TrendingToken[]): void {
  const container = document.getElementById('trending-list');
  if (!container) return;
  
  if (tokens.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 16px;">
        Loading trending...
      </div>
    `;
    return;
  }
  
  container.innerHTML = tokens.map(token => `
    <a class="trending-item" href="${token.url}" target="_blank" rel="noopener">
      <div class="trending-chain">${token.chainId === 'solana' ? '◎' : token.chainId === 'base' ? '⬡' : '◆'}</div>
      <div class="trending-info">
        <div class="trending-address">${formatAddress(token.tokenAddress)}</div>
        <div class="trending-boost">🔥 ${token.totalAmount} boosts</div>
      </div>
    </a>
  `).join('');
}

// Initialize popup
async function init(): Promise<void> {
  console.log('[ClawFi Popup] Initializing v' + VERSION);
  
  // Update version display
  const versionEl = document.querySelector('.version');
  if (versionEl) versionEl.textContent = `v${VERSION}`;
  
  // Show loading state
  updateStatus(false, false);
  const signalsList = document.getElementById('signals-list');
  if (signalsList) signalsList.innerHTML = '<div class="empty-state">Loading...</div>';

  // Get settings
  const settings = await getSettings();
  console.log('[ClawFi Popup] Settings loaded:', { 
    nodeUrl: settings.nodeUrl, 
    hasToken: !!settings.authToken 
  });

  // Check API health first (doesn't require auth)
  const apiConnected = await checkApiHealth(settings.nodeUrl);
  
  // Fetch trending tokens in parallel (doesn't require auth)
  fetchTrendingTokens(settings.nodeUrl).then(renderTrendingTokens);

  // Check if token is configured
  if (!settings.authToken) {
    updateStatus(apiConnected, false);
    if (signalsList) {
      signalsList.innerHTML = `
        <div class="empty-state">
          <div style="font-size: 24px; margin-bottom: 8px;">🔑</div>
          Configure token in Settings
        </div>
      `;
    }
    return;
  }

  updateStatus(apiConnected, true);

  if (!apiConnected) {
    if (signalsList) {
      signalsList.innerHTML = `
        <div class="empty-state">
          <div style="font-size: 24px; margin-bottom: 8px;">📡</div>
          Cannot reach API
        </div>
      `;
    }
    return;
  }

  // Fetch and render data in parallel
  try {
    const [signals, stats] = await Promise.all([
      fetchRecentSignals(settings.nodeUrl, settings.authToken),
      fetchStats(settings.nodeUrl, settings.authToken),
    ]);

    renderSignals(signals);
    updateStats(stats);
  } catch (error) {
    console.error('[ClawFi Popup] Data fetch error:', error);
    if (signalsList) {
      signalsList.innerHTML = `
        <div class="empty-state">
          <div style="font-size: 24px; margin-bottom: 8px;">⚠️</div>
          Error loading data
        </div>
      `;
    }
  }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  init();

  // Dashboard button
  document.getElementById('btn-dashboard')?.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://dashboard.clawfi.ai' });
  });

  // Settings button
  document.getElementById('btn-settings')?.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Docs link
  document.getElementById('link-docs')?.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://github.com/clawfiai/clawfi#readme' });
  });
  
  // Quick action links
  document.getElementById('link-dexscreener')?.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://dexscreener.com' });
  });
  
  document.getElementById('link-clanker')?.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://clanker.world' });
  });
});
