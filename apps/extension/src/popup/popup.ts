/**
 * ClawFi Extension - Popup Script
 * 
 * Handles the extension popup UI with quick stats and recent signals
 */

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

// Get settings from background
async function getSettings(): Promise<ExtensionSettings> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (settings) => {
      resolve(settings);
    });
  });
}

// Fetch recent signals
async function fetchRecentSignals(nodeUrl: string, authToken: string): Promise<Signal[]> {
  try {
    const response = await fetch(`${nodeUrl}/signals?limit=5`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch signals');
    }

    const data = await response.json() as { success: boolean; data: Signal[] };
    return data.success ? data.data : [];
  } catch (error) {
    console.error('[ClawFi Popup] Failed to fetch signals:', error);
    return [];
  }
}

// Fetch stats
async function fetchStats(nodeUrl: string, authToken: string): Promise<PopupStats> {
  try {
    const response = await fetch(`${nodeUrl}/agent/status`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch stats');
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

// Check API health
async function checkApiHealth(nodeUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${nodeUrl}/health`, { 
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
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

// Render signals list
function renderSignals(signals: Signal[]): void {
  const container = document.getElementById('signals-list');
  if (!container) return;

  if (signals.length === 0) {
    container.innerHTML = '<div class="empty-state">No recent signals</div>';
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
function updateStatus(apiConnected: boolean, wsConnected: boolean): void {
  const apiStatus = document.getElementById('api-status');
  const apiStatusText = document.getElementById('api-status-text');
  const wsStatus = document.getElementById('ws-status');

  if (apiStatus && apiStatusText) {
    apiStatus.className = `status-dot ${apiConnected ? 'connected' : 'disconnected'}`;
    apiStatusText.textContent = apiConnected ? 'Connected' : 'Disconnected';
  }

  if (wsStatus) {
    wsStatus.className = `status-dot ${wsConnected ? 'connected' : 'warning'}`;
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

// Initialize popup
async function init(): Promise<void> {
  const settings = await getSettings();

  // Update status
  const apiConnected = await checkApiHealth(settings.nodeUrl);
  updateStatus(apiConnected, false); // WebSocket status would need more tracking

  if (!settings.authToken) {
    document.getElementById('signals-list')!.innerHTML = 
      '<div class="empty-state">Please configure your API token in settings</div>';
    return;
  }

  // Fetch and render data
  const [signals, stats] = await Promise.all([
    fetchRecentSignals(settings.nodeUrl, settings.authToken),
    fetchStats(settings.nodeUrl, settings.authToken),
  ]);

  renderSignals(signals);
  updateStats(stats);
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  init();

  // Dashboard button
  document.getElementById('btn-dashboard')?.addEventListener('click', async () => {
    const settings = await getSettings();
    // Try to open dashboard - use baseUrl from settings or default
    const dashboardUrl = settings.nodeUrl.replace(/:\d+$/, ':4321');
    chrome.tabs.create({ url: dashboardUrl });
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
});
