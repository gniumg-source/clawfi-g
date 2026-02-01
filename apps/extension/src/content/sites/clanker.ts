/**
 * ClawFi Extension - Clanker.world Content Script
 * 
 * Detects Clanker token pages and shows ClawFi overlay with signals.
 * Handles SPA navigation via history API patching.
 * 
 * URL Pattern: https://clanker.world/clanker/0x...
 * Chain: Base (always)
 */

import { renderClankerOverlay, unmountClankerOverlay } from '../overlay/ClankerOverlay';

// Ethereum address validation regex
const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

// Clanker path pattern - matches /clanker/0x... with any trailing content
const CLANKER_PATH_REGEX = /^\/clanker\/(0x[a-fA-F0-9]{40})/i;

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

/**
 * Extract token address from current URL
 */
function extractTokenFromUrl(): string | null {
  const pathname = window.location.pathname;
  const match = pathname.match(CLANKER_PATH_REGEX);
  
  if (match && match[1]) {
    const address = match[1];
    if (ETH_ADDRESS_REGEX.test(address)) {
      return address;
    }
  }
  
  return null;
}

/**
 * Best-effort metadata extraction from page content
 * This is optional UX enhancement - failures are silently ignored
 */
function extractPageMetadata(): Partial<ClankerTokenMetadata> {
  const metadata: Partial<ClankerTokenMetadata> = {};
  
  try {
    const bodyText = document.body.innerText || '';
    
    // Version detection: V3, V3.1, V4
    const versionMatch = bodyText.match(/\bV(3(?:\.1)?|4)\b/i);
    if (versionMatch) {
      metadata.version = `V${versionMatch[1]}`;
    }
    
    // Creator address detection
    const creatorMatch = bodyText.match(/Creator[:\s]+(?:\n|\s)*(0x[a-fA-F0-9]{40})/i);
    if (creatorMatch && creatorMatch[1]) {
      metadata.creator = creatorMatch[1];
    }
    
    // Admin address detection
    const adminMatch = bodyText.match(/Admin[:\s]+(?:\n|\s)*(0x[a-fA-F0-9]{40})/i);
    if (adminMatch && adminMatch[1]) {
      metadata.admin = adminMatch[1];
    }
    
    // Verified status detection
    const hasVerified = /verified\s*token|✓\s*verified|\bverified\b/i.test(bodyText);
    if (hasVerified) {
      metadata.verified = true;
    }
    
    // Try to get token name/symbol from page title or content
    const titleMatch = document.title.match(/^([^|–-]+)/);
    if (titleMatch && titleMatch[1]) {
      const titleParts = titleMatch[1].trim().split(/\s+/);
      if (titleParts.length >= 1) {
        metadata.name = titleParts.slice(0, -1).join(' ') || titleParts[0];
        if (titleParts.length > 1) {
          const lastPart = titleParts[titleParts.length - 1];
          if (lastPart && lastPart.length <= 10 && /^[A-Z0-9$]+$/i.test(lastPart)) {
            metadata.symbol = lastPart.toUpperCase();
          }
        }
      }
    }
  } catch (error) {
    // Silently ignore extraction errors - this is optional UX
    console.debug('[ClawFi] Metadata extraction error (non-fatal):', error);
  }
  
  return metadata;
}

/**
 * Build full token metadata
 */
function buildTokenMetadata(address: string): ClankerTokenMetadata {
  const pageMetadata = extractPageMetadata();
  
  return {
    address,
    chain: 'base',
    ...pageMetadata,
  };
}

// Track current state
let currentToken: string | null = null;
let isOverlayMounted = false;
let retryTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Send message to background with retry
 */
async function sendMessageWithRetry<T>(
  message: unknown,
  retries = 3
): Promise<T | null> {
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
      console.warn(`[ClawFi] Message failed (attempt ${attempt + 1}/${retries}):`, error);
      if (attempt < retries - 1) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }
  return null;
}

/**
 * Handle route change - detect token and update overlay
 */
async function handleRouteChange(): Promise<void> {
  // Clear any pending retry
  if (retryTimeout) {
    clearTimeout(retryTimeout);
    retryTimeout = null;
  }
  
  const token = extractTokenFromUrl();
  
  console.log('[ClawFi] Route change detected, token:', token);
  
  // If same token, no change needed
  if (token === currentToken && isOverlayMounted) {
    return;
  }
  
  // Remove existing overlay if token changed or no token
  if (isOverlayMounted) {
    unmountClankerOverlay();
    isOverlayMounted = false;
  }
  
  currentToken = token;
  
  if (!token) {
    return;
  }
  
  // Check if overlay is enabled (with fallback if background fails)
  let overlayEnabled = true;
  try {
    const settings = await sendMessageWithRetry<{ 
      clankerOverlayEnabled?: boolean; 
      overlayEnabled?: boolean 
    }>({ type: 'GET_SETTINGS' });
    
    if (settings) {
      if (settings.clankerOverlayEnabled === false || settings.overlayEnabled === false) {
        overlayEnabled = false;
      }
    }
  } catch (err) {
    console.warn('[ClawFi] Error getting settings, defaulting to enabled:', err);
  }
  
  if (!overlayEnabled) {
    console.log('[ClawFi] Overlay disabled in settings');
    return;
  }
  
  // Build metadata and render overlay
  // Small delay to let page content load for metadata extraction
  setTimeout(() => {
    if (currentToken === token) {
      console.log('[ClawFi] Rendering overlay for token:', token);
      const metadata = buildTokenMetadata(token);
      renderClankerOverlay(metadata);
      isOverlayMounted = true;
      
      // Notify background (non-blocking)
      sendMessageWithRetry({
        type: 'DETECTED_TOKEN',
        token,
        chain: 'base',
        source: 'clanker',
      }).catch(() => {
        // Ignore errors
      });
    }
  }, 500);
}

/**
 * Setup SPA navigation detection
 * Patches history.pushState and replaceState, listens for popstate
 */
function setupNavigationDetection(): void {
  // Store original methods
  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);
  
  // Patch pushState
  history.pushState = function (...args) {
    const result = originalPushState(...args);
    handleRouteChange();
    return result;
  };
  
  // Patch replaceState
  history.replaceState = function (...args) {
    const result = originalReplaceState(...args);
    handleRouteChange();
    return result;
  };
  
  // Listen for popstate (back/forward navigation)
  window.addEventListener('popstate', () => {
    handleRouteChange();
  });
  
  // Also listen for hashchange just in case
  window.addEventListener('hashchange', () => {
    handleRouteChange();
  });
  
  // Watch for DOM changes that might indicate navigation in Next.js/React apps
  const observer = new MutationObserver(() => {
    const newToken = extractTokenFromUrl();
    if (newToken !== currentToken) {
      handleRouteChange();
    }
  });
  
  // Observe URL changes through DOM mutations
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

/**
 * Initialize Clanker content script
 */
function init(): void {
  console.log('[ClawFi] Clanker content script initialized on:', window.location.href);
  console.log('[ClawFi] Current pathname:', window.location.pathname);
  
  const token = extractTokenFromUrl();
  console.log('[ClawFi] Token from URL:', token);
  
  // Setup navigation detection for SPA
  setupNavigationDetection();
  
  // Handle initial page load
  handleRouteChange();
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  console.log('[ClawFi] Waiting for DOMContentLoaded...');
  document.addEventListener('DOMContentLoaded', init);
} else {
  console.log('[ClawFi] DOM already ready, initializing...');
  init();
}

// Also try after a delay in case page is still loading
setTimeout(() => {
  const token = extractTokenFromUrl();
  if (token && !isOverlayMounted) {
    console.log('[ClawFi] Delayed check - token found but overlay not mounted, retrying...');
    handleRouteChange();
  }
}, 2000);

export { extractTokenFromUrl, buildTokenMetadata, handleRouteChange };
