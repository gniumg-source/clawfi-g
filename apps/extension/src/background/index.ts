/**
 * ClawFi Extension - Background Service Worker
 * 
 * Handles:
 * - Settings storage
 * - Communication between content scripts and options page
 * - Badge updates
 * - Signal fetching from ClawFi Node
 */

interface ExtensionSettings {
  nodeUrl: string;
  authToken: string;
  overlayEnabled: boolean;
  clankerOverlayEnabled: boolean;
}

const DEFAULT_SETTINGS: ExtensionSettings = {
  nodeUrl: 'http://localhost:3001',
  authToken: '',
  overlayEnabled: true,
  clankerOverlayEnabled: true,
};

// Message types
interface GetSettingsMessage {
  type: 'GET_SETTINGS';
}

interface SetSettingsMessage {
  type: 'SET_SETTINGS';
  settings: Partial<ExtensionSettings>;
}

interface GetSignalsMessage {
  type: 'GET_SIGNALS';
  token: string;
  chain?: string;
  limit?: number;
}

interface DetectedTokenMessage {
  type: 'DETECTED_TOKEN';
  token: string;
  chain?: string;
  source?: string;
}

type ExtensionMessage = 
  | GetSettingsMessage 
  | SetSettingsMessage 
  | GetSignalsMessage
  | DetectedTokenMessage;

// Get settings from storage
async function getSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...result.settings };
}

// Save settings to storage
async function saveSettings(settings: Partial<ExtensionSettings>): Promise<ExtensionSettings> {
  const current = await getSettings();
  const updated = { ...current, ...settings };
  await chrome.storage.local.set({ settings: updated });
  return updated;
}

// Fetch signals from node API
async function fetchSignals(token: string, chain?: string, limit?: number): Promise<unknown[]> {
  const settings = await getSettings();
  
  if (!settings.authToken) {
    console.debug('[ClawFi] No auth token configured');
    return [];
  }

  try {
    const params = new URLSearchParams({ token: token.toLowerCase() });
    if (chain) params.set('chain', chain);
    if (limit) params.set('limit', String(limit));

    const response = await fetch(`${settings.nodeUrl}/signals/token?${params}`, {
      headers: {
        Authorization: `Bearer ${settings.authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('[ClawFi] Signal fetch failed:', response.status);
      throw new Error('Failed to fetch signals');
    }

    const data = await response.json() as { success: boolean; data: unknown[] };
    return data.success ? data.data : [];
  } catch (error) {
    console.error('[ClawFi] Failed to fetch signals:', error);
    return [];
  }
}

// Handle messages from content scripts and options page
chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  (async () => {
    switch (message.type) {
      case 'GET_SETTINGS':
        sendResponse(await getSettings());
        break;

      case 'SET_SETTINGS':
        sendResponse(await saveSettings(message.settings));
        break;

      case 'GET_SIGNALS':
        sendResponse(await fetchSignals(message.token, message.chain, message.limit));
        break;

      case 'DETECTED_TOKEN':
        // Update badge to show token detected
        const badgeColor = message.source === 'clanker' ? '#0052ff' : '#14b899';
        chrome.action.setBadgeText({ text: '!' });
        chrome.action.setBadgeBackgroundColor({ color: badgeColor });
        setTimeout(() => {
          chrome.action.setBadgeText({ text: '' });
        }, 3000);
        
        console.log(`[ClawFi] Token detected: ${message.token} on ${message.chain || 'unknown'} from ${message.source || 'generic'}`);
        sendResponse({ ok: true });
        break;

      default:
        sendResponse({ error: 'Unknown message type' });
    }
  })();
  return true; // Keep message channel open for async response
});

// Extension installed
chrome.runtime.onInstalled.addListener(() => {
  console.log('[ClawFi] Extension installed/updated');
});

// Export for testing
export { getSettings, saveSettings, fetchSignals };
